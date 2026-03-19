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
});
