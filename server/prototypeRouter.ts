/**
 * Prototype Router
 * 
 * tRPC procedures for the Fast Prototyping from Product Picture feature.
 * Handles image upload → LLM extraction → request creation → internal workflow.
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";
import {
  extractProductFromImages,
  createPrototypeRequest,
  getPrototypeRequestById,
  getPrototypeRequestsByUser,
  getAllPrototypeRequests,
  updatePrototypeRequest,
} from "./prototypeService";
import {
  saveBomCalculation,
  updateBomCalculation,
  getBomCalculationsByCompany,
  getLatestBomCalculation,
  deleteBomCalculation,
} from "./db";

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const prototypeRouter = router({
  /**
   * Step 1: Upload images (base64) → store in S3 → return URLs
   */
  uploadImages: protectedProcedure
    .input(z.object({
      images: z.array(z.object({
        base64: z.string().min(1),
        filename: z.string().min(1),
        mimeType: z.string().min(1),
      })).min(1).max(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const imageUrls: string[] = [];
      for (const img of input.images) {
        const buffer = Buffer.from(img.base64, "base64");
        const key = `prototype/${ctx.user.id}/${Date.now()}-${randomSuffix()}-${img.filename}`;
        const { url } = await storagePut(key, buffer, img.mimeType);
        imageUrls.push(url);
      }
      return { imageUrls };
    }),

  /**
   * Step 2: Analyze images with LLM vision → extract product intelligence
   */
  analyzeImages: protectedProcedure
    .input(z.object({
      imageUrls: z.array(z.string().url()).min(1).max(3),
      productUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const extraction = await extractProductFromImages(input.imageUrls, input.productUrl);
      return extraction;
    }),

  /**
   * Step 3: Create a prototype request with extraction + customer info
   */
  createRequest: protectedProcedure
    .input(z.object({
      imageUrls: z.array(z.string()).min(1),
      productUrl: z.string().optional(),
      productTypeGuess: z.string(),
      keyFeatureGuess: z.array(z.string()),
      whatWeStillNeed: z.array(z.string()),
      extractionRaw: z.string().optional(),
      // Customer info
      annualUnits: z.string().optional(),
      expectedSop: z.string().optional(),
      region: z.enum(["EU", "US", "APAC", "Other"]).optional(),
      designIntent: z.enum(["equivalent", "modified"]).optional(),
      hasBom: z.boolean().optional(),
      customerNotes: z.string().optional(),
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
      customerCompany: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createPrototypeRequest({
        userId: ctx.user.id,
        imageUrls: JSON.stringify(input.imageUrls),
        productUrl: input.productUrl ?? null,
        productTypeGuess: input.productTypeGuess,
        keyFeatureGuess: JSON.stringify(input.keyFeatureGuess),
        whatWeStillNeed: JSON.stringify(input.whatWeStillNeed),
        extractionRaw: input.extractionRaw ?? null,
        annualUnits: input.annualUnits ?? null,
        expectedSop: input.expectedSop ?? null,
        region: input.region ?? null,
        designIntent: input.designIntent ?? null,
        hasBom: input.hasBom ? 1 : 0,
        customerNotes: input.customerNotes ?? null,
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerCompany: input.customerCompany ?? null,
        status: "submitted",
      });
      return { id, message: "Thanks — we're analyzing your pictures. We'll contact you for the next steps." };
    }),

  /**
   * Get a single prototype request by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const request = await getPrototypeRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Prototype request not found" });
      return request;
    }),

  /**
   * List all prototype requests for the current user
   */
  myRequests: protectedProcedure
    .query(async ({ ctx }) => {
      return getPrototypeRequestsByUser(ctx.user.id);
    }),

  /**
   * List ALL prototype requests (internal/admin view)
   */
  allRequests: protectedProcedure
    .query(async () => {
      return getAllPrototypeRequests();
    }),

  /**
   * Internal: Update request status (Request more info / Ask for sample / Start costing)
   */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["more_info_requested", "sample_requested", "costing", "completed"]),
      internalNotes: z.string().optional(),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await updatePrototypeRequest(input.id, {
        status: input.status,
        internalNotes: input.internalNotes ?? undefined,
        assignedTo: input.assignedTo ?? undefined,
      });
      return { success: true };
    }),

  /**
   * Extract BOM components from product images — used on Company Detail page
   * Returns estimated components with rough unit cost guesses for the BOM calculator.
   * Results are AI estimates only — not quotes.
   */
  extractBomFromImages: protectedProcedure
    .input(z.object({
      imageUrls: z.array(z.string()).min(1).max(6),
      productContext: z.string().optional(), // e.g. company name + product type hint
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");
      const imageContent = input.imageUrls.slice(0, 6).map((url) => ({
        type: "image_url" as const,
        image_url: { url, detail: "low" as const },
      }));
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an experienced electronics and mechanical engineering cost estimator. " +
              "Analyse the product images and return a rough Bill of Materials (BOM) with estimated unit costs in EUR. " +
              "Focus on main components visible or inferable from the product. " +
              "Be honest about uncertainty — these are rough estimates only, not quotes. " +
              "Return ONLY valid JSON matching the schema.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Analyse these product images${input.productContext ? ` for: ${input.productContext}` : ""}. ` +
                  "Return a JSON object with: " +
                  "{ productSummary: string, components: Array<{ component: string, qty: number, unitCostEur: number, confidence: 'high'|'medium'|'low', notes: string }> }. " +
                  "Include 5-15 main components. unitCostEur should be a realistic market price estimate per unit.",
              },
              ...imageContent,
            ],
          },
        ],
        response_format: { type: "json_object" },
      });
      const raw = response.choices?.[0]?.message?.content ?? "{}";
      let parsed: { productSummary?: string; components?: Array<{ component: string; qty: number; unitCostEur: number; confidence: string; notes: string }> } = {};
      try {
        const text = typeof raw === "string" ? raw : JSON.stringify(raw);
        // Strip markdown code fences if present
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { productSummary: "Unable to parse AI response", components: [] };
      }
      // Normalise confidence values
      const components = (parsed.components ?? []).map((c) => ({
        ...c,
        confidence: (["high", "medium", "low"].includes(c.confidence) ? c.confidence : "medium") as "high" | "medium" | "low",
      }));
      return { productSummary: parsed.productSummary ?? "Product analysis", components };
    }),

  /**
   * Enrich BOM components with Brain-awareness.
   * Cross-references each component against the active Offering Brain's capabilities
   * and returns canSupply: 'yes' | 'partial' | 'no' with a short reason for each.
   */
  enrichBomWithBrain: protectedProcedure
    .input(z.object({
      components: z.array(z.object({
        component: z.string(),
        qty: z.number(),
        unitCostEur: z.number(),
        confidence: z.enum(["high", "medium", "low"]),
        notes: z.string(),
      })).min(1).max(20),
      // Brain context — passed from the frontend so we avoid an extra DB round-trip
      brainContext: z.object({
        companyName: z.string(),
        offeringSummary: z.string().optional(),
        coreCapabilities: z.string().optional(), // JSON array string
        valuePropositions: z.string().optional(), // JSON array string
        competitiveAdvantages: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");

      // Build a concise Brain profile for the LLM
      const caps = (() => {
        try { return JSON.parse(input.brainContext.coreCapabilities ?? "[]"); } catch { return []; }
      })();
      const props = (() => {
        try { return JSON.parse(input.brainContext.valuePropositions ?? "[]"); } catch { return []; }
      })();

      const brainProfile = [
        `Company: ${input.brainContext.companyName}`,
        input.brainContext.offeringSummary ? `Offering: ${input.brainContext.offeringSummary}` : null,
        caps.length > 0 ? `Core Capabilities: ${Array.isArray(caps) ? caps.map((c: any) => typeof c === "string" ? c : c.capability || c.name || JSON.stringify(c)).join("; ") : caps}` : null,
        props.length > 0 ? `Value Propositions: ${Array.isArray(props) ? props.map((p: any) => typeof p === "string" ? p : p.proposition || p.value || JSON.stringify(p)).join("; ") : props}` : null,
        input.brainContext.competitiveAdvantages ? `Competitive Advantages: ${input.brainContext.competitiveAdvantages}` : null,
      ].filter(Boolean).join("\n");

      const componentList = input.components.map((c, i) =>
        `${i + 1}. ${c.component} (qty: ${c.qty}, ~€${c.unitCostEur}/unit) — ${c.notes}`
      ).join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a PCB and electronics manufacturing expert. " +
              "Given a manufacturer's capabilities profile and a BOM component list, " +
              "assess whether the manufacturer can supply each component. " +
              "Return ONLY valid JSON — no markdown, no explanation outside the JSON.",
          },
          {
            role: "user",
            content:
              `MANUFACTURER PROFILE:\n${brainProfile}\n\n` +
              `BOM COMPONENTS:\n${componentList}\n\n` +
              "For each component, return a JSON array with objects: " +
              "{ index: number (1-based), canSupply: 'yes'|'partial'|'no', reason: string (max 15 words), deliverableCategory: string (e.g. 'PCB Fabrication', 'SMT Assembly', 'Through-Hole', 'Mechanical', 'Passive Component', 'Active IC', 'Connector', 'Cable', 'Enclosure', 'Raw Material', 'Out-of-scope') }. " +
              "Return: { enriched: [...] }",
          },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices?.[0]?.message?.content ?? "{}";
      let parsed: { enriched?: Array<{ index: number; canSupply: string; reason: string; deliverableCategory: string }> } = {};
      try {
        const text = typeof raw === "string" ? raw : JSON.stringify(raw);
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { enriched: [] };
      }

      // Merge enrichment back onto original components
      const enriched = input.components.map((c, i) => {
        const match = (parsed.enriched ?? []).find((e) => e.index === i + 1);
        return {
          ...c,
          canSupply: (["yes", "partial", "no"].includes(match?.canSupply ?? "") ? match!.canSupply : "no") as "yes" | "partial" | "no",
          supplyReason: match?.reason ?? "",
          deliverableCategory: match?.deliverableCategory ?? "Unknown",
        };
      });

      return { enriched };
    }),

  /**
   * Generate a DOM (Deliverables of Materials) mini-report for a specific BOM component.
   * Grounds the report in the Brain's capabilities and the component's context.
   */
  generateDomReport: protectedProcedure
    .input(z.object({
      component: z.string(),
      qty: z.number(),
      unitCostEur: z.number(),
      notes: z.string(),
      deliverableCategory: z.string(),
      productContext: z.string().optional(), // e.g. company name + product type
      brainContext: z.object({
        companyName: z.string(),
        offeringSummary: z.string().optional(),
        coreCapabilities: z.string().optional(),
        competitiveAdvantages: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");

      const caps = (() => {
        try { return JSON.parse(input.brainContext.coreCapabilities ?? "[]"); } catch { return []; }
      })();
      const capsStr = Array.isArray(caps)
        ? caps.map((c: any) => typeof c === "string" ? c : c.capability || c.name || JSON.stringify(c)).join("; ")
        : String(caps);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a senior PCB manufacturing engineer and technical sales expert. " +
              "Write a concise Deliverables of Materials (DOM) report for a specific component. " +
              "Ground every claim in the manufacturer's actual capabilities. " +
              "Return ONLY valid JSON — no markdown outside the JSON.",
          },
          {
            role: "user",
            content:
              `MANUFACTURER: ${input.brainContext.companyName}\n` +
              (input.brainContext.offeringSummary ? `OFFERING: ${input.brainContext.offeringSummary}\n` : "") +
              (capsStr ? `CAPABILITIES: ${capsStr}\n` : "") +
              (input.brainContext.competitiveAdvantages ? `ADVANTAGES: ${input.brainContext.competitiveAdvantages}\n` : "") +
              `\nCOMPONENT: ${input.component}` +
              `\nQTY NEEDED: ${input.qty}` +
              `\nESTIMATED UNIT COST: €${input.unitCostEur}` +
              `\nCATEGORY: ${input.deliverableCategory}` +
              (input.notes ? `\nNOTES: ${input.notes}` : "") +
              (input.productContext ? `\nPRODUCT CONTEXT: ${input.productContext}` : "") +
              "\n\nReturn a JSON object: { " +
              "componentName: string, " +
              "canDeliver: boolean, " +
              "deliveryStatement: string (1-2 sentences: how we deliver this), " +
              "specification: string (key technical specs, tolerances, standards), " +
              "leadTimeEstimate: string (e.g. '5-7 working days for prototype'), " +
              "manufacturingProcess: string (which of our processes applies), " +
              "qualityStandards: string (relevant certifications/standards we meet), " +
              "pricingNote: string (rough pricing context vs the estimate), " +
              "whyUs: string (2-3 sentences: why our capabilities make us the right fit), " +
              "limitations: string (honest caveats or out-of-scope items, if any) }",
          },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, string | boolean> = {};
      try {
        const text = typeof raw === "string" ? raw : JSON.stringify(raw);
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { componentName: input.component, canDeliver: false, deliveryStatement: "Unable to generate report." };
      }

      return parsed as {
        componentName: string;
        canDeliver: boolean;
        deliveryStatement: string;
        specification: string;
        leadTimeEstimate: string;
        manufacturingProcess: string;
        qualityStandards: string;
        pricingNote: string;
        whyUs: string;
        limitations: string;
      };
    }),

  /**
   * Internal: Add/update internal notes
   */
  addNotes: protectedProcedure
    .input(z.object({
      id: z.number(),
      internalNotes: z.string(),
    }))
    .mutation(async ({ input }) => {
      await updatePrototypeRequest(input.id, {
        internalNotes: input.internalNotes,
      });
      return { success: true };
    }),

  // ── BOM Persistence ──────────────────────────────────────────────────────

  /**
   * Save (or update) a BOM calculation for a company.
   * If bomId is provided, updates the existing row; otherwise inserts a new one.
   */
  saveBom: protectedProcedure
    .input(z.object({
      bomId: z.number().optional(),
      companyId: z.number(),
      imageUrls: z.array(z.string()),
      productSummary: z.string(),
      components: z.array(z.object({
        component: z.string(),
        qty: z.number(),
        unitCostEur: z.number(),
        confidence: z.enum(["high", "medium", "low"]),
        notes: z.string(),
        editedCost: z.number().optional(),
        canSupply: z.enum(["yes", "partial", "no"]).optional(),
        supplyReason: z.string().optional(),
        deliverableCategory: z.string().optional(),
      })),
      isEnriched: z.boolean().default(false),
      brainId: z.number().optional(),
      label: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const totalEur = input.components
        .reduce((sum, c) => sum + (c.editedCost ?? c.unitCostEur) * c.qty, 0)
        .toFixed(2);

      const payload = {
        companyId: input.companyId,
        userId: ctx.user.openId,
        imageUrls: JSON.stringify(input.imageUrls),
        productSummary: input.productSummary,
        componentsJson: JSON.stringify(input.components),
        totalEur,
        isEnriched: input.isEnriched ? 1 : 0,
        brainId: input.brainId ?? null,
        label: input.label ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      };

      if (input.bomId) {
        await updateBomCalculation(input.bomId, payload);
        return { bomId: input.bomId };
      } else {
        const bomId = await saveBomCalculation(payload);
        return { bomId };
      }
    }),

  /**
   * Get all BOM calculations for a company, newest first.
   */
  getBomHistory: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const rows = await getBomCalculationsByCompany(input.companyId);
      return {
        boms: rows.map(r => ({
          id: r.id,
          label: r.label,
          totalEur: r.totalEur,
          isEnriched: r.isEnriched === 1,
          brainId: r.brainId,
          createdAt: r.createdAt,
          productSummary: r.productSummary,
          componentsJson: r.componentsJson,
          imageUrls: r.imageUrls,
        })),
      };
    }),

  /**
   * Get the latest BOM calculation for a company (for auto-loading on modal open).
   */
  getLatestBom: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const row = await getLatestBomCalculation(input.companyId);
      if (!row) return { bom: null };
      return {
        bom: {
          id: row.id,
          label: row.label,
          totalEur: row.totalEur,
          isEnriched: row.isEnriched === 1,
          brainId: row.brainId,
          createdAt: row.createdAt,
          productSummary: row.productSummary,
          componentsJson: row.componentsJson,
          imageUrls: row.imageUrls,
        },
      };
    }),

  /**
   * Delete a BOM calculation (owner only).
   */
  deleteBom: protectedProcedure
    .input(z.object({ bomId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteBomCalculation(input.bomId, ctx.user.openId);
      return { success: true };
    }),
});
