/**
 * Sales Approach Generator
 * 
 * Generates personalized sales outreach materials using xAI Grok Responses API
 * with explicit web_search tool based on deep research data.
 * 
 * Outputs:
 * - Email draft (personalized cold outreach)
 * - LinkedIn message (connection request + follow-up)
 * - Call script (structured talking points for phone/video call)
 *
 * Prompt-contract: uses strict json_schema mode to enforce SalesApproach interface.
 * Type is defined in shared/contractTypes.ts — single source of truth.
 */

import { getCompanyById, getActiveBrain, getOfferingBrainById } from "./db";
import type { SalesApproach } from "../shared/contractTypes";

// SalesApproach type is defined in shared/contractTypes.ts and imported above.
// Re-export for backward compatibility with any consumers that import from this file.
export type { SalesApproach } from "../shared/contractTypes";

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = "https://api.x.ai/v1";

/**
 * Build Brain context string for injection into sales approach prompts.
 */
async function getBrainContextForApproach(userId: number, brainId?: number): Promise<{ context: string; companyName: string }> {
  try {
    const brain = brainId
      ? await getOfferingBrainById(brainId, userId)
      : await getActiveBrain(userId);
    if (!brain || brain.status !== "completed") return { context: "", companyName: "Your Company" };

    const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
    const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
    const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];

    return {
      companyName: brain.companyName || "Your Company",
      context: `
**YOUR COMPANY (Seller) — ${brain.companyName}:**
- Summary: ${brain.offeringSummary}
- Core Capabilities: ${capabilities.join("; ")}
- Value Propositions: ${valueProps.map((vp: any) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
- Competitive Advantages: ${brain.competitiveAdvantages}
- Pain Points We Solve: ${painPoints.join("; ")}
`,
    };
  } catch (error) {
    console.warn("[Brain Context] Failed to load brain for sales approach:", error);
    return { context: "", companyName: "Your Company" };
  }
}

// ---------------------------------------------------------------------------
// JSON Schema — strict structured output contract, mirrors SalesApproach interface
// Governance: any field change here MUST also be reflected in shared/contractTypes.ts
// ---------------------------------------------------------------------------
const SALES_APPROACH_SCHEMA = {
  type: "object",
  properties: {
    conversationStarters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          opener: { type: "string" },
          sourceUrl: { type: "string" },
          basedOn: { type: "string" },
        },
        required: ["opener", "sourceUrl", "basedOn"],
        additionalProperties: false,
      },
    },
    engagementStrategy: {
      type: "object",
      properties: {
        whyThisProspectMatters: { type: "array", items: { type: "string" } },
        recommendedApproach: { type: "array", items: { type: "string" } },
        keyTalkingPoints: { type: "array", items: { type: "string" } },
      },
      required: ["whyThisProspectMatters", "recommendedApproach", "keyTalkingPoints"],
      additionalProperties: false,
    },
    emailDraft: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        referencedSources: { type: "array", items: { type: "string" } },
      },
      required: ["subject", "body", "referencedSources"],
      additionalProperties: false,
    },
    linkedinMessage: {
      type: "object",
      properties: {
        connectionRequest: { type: "string" },
        followUp: { type: "string" },
      },
      required: ["connectionRequest", "followUp"],
      additionalProperties: false,
    },
    callScript: {
      type: "object",
      properties: {
        opening: { type: "string" },
        discoveryQuestions: { type: "array", items: { type: "string" } },
        valueProposition: { type: "string" },
        callToAction: { type: "string" },
      },
      required: ["opening", "discoveryQuestions", "valueProposition", "callToAction"],
      additionalProperties: false,
    },
  },
  required: ["conversationStarters", "engagementStrategy", "emailDraft", "linkedinMessage", "callScript"],
  additionalProperties: false,
};

/**
 * Normalise a conversationStarters array so every item is {opener, sourceUrl, basedOn}.
 * Handles all known LLM output shapes:
 *   - plain string
 *   - {opener, sourceUrl, basedOn}  (canonical)
 *   - {type, description, conversationStarter}  (legacy Grok shape)
 *   - {text, ...} or any other object
 */
export function normaliseConversationStarters(raw: any[]): Array<{opener: string; sourceUrl: string; basedOn: string}> {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    if (typeof s === "string") return { opener: s, sourceUrl: "", basedOn: "" };
    if (s && typeof s === "object") {
      const opener: string = s.opener ?? s.conversationStarter ?? s.description ?? s.text ?? JSON.stringify(s);
      return {
        opener,
        sourceUrl: typeof s.sourceUrl === "string" ? s.sourceUrl : "",
        basedOn: typeof s.basedOn === "string" ? s.basedOn : (typeof s.type === "string" ? s.type : ""),
      };
    }
    return { opener: String(s ?? ""), sourceUrl: "", basedOn: "" };
  });
}

/**
 * Call xAI Responses API with explicit web_search tool.
 * Uses strict json_schema mode to enforce the SalesApproach contract.
 */
async function callGrokWithWebSearch(input: string): Promise<string> {
  // 120-second timeout — Grok with web search can take 60-90 s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  let response: Response;
  try {
    response = await fetch(`${XAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        tools: [{ type: "web_search" }],  // Explicit web_search tool
        input,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sales_approach",
            strict: true,
            schema: SALES_APPROACH_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Responses API returns output in nested array structure:
  // response.output[] contains tool calls and content items
  // The actual text output is in items with content[].text where content[].type === "output_text"
  if (data.output && Array.isArray(data.output)) {
    // Find the output item that contains content (not tool calls)
    for (const item of data.output) {
      if (item.content && Array.isArray(item.content)) {
        const textContent = item.content.find((c: any) => c.type === "output_text");
        if (textContent?.text) {
          return textContent.text;
        }
      }
    }
  }
  
  // Fallback: check for direct text field (older format)
  if (data.text) {
    return data.text;
  }
  
  throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
}

/**
 * Generate personalized sales approach for a company
 * Requires that Deep Research (briefData) has already been generated
 */
export async function generateSalesApproach(
  companyId: number,
  userId?: number,
  brainId?: number
): Promise<SalesApproach> {
  // Load company data from database
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Check if deep research exists
  if (!company.briefData) {
    throw new Error(`Deep research not found for company ${companyId}. Run Deep Research first.`);
  }

  const briefData = JSON.parse(company.briefData);
  console.log(`[Sales Approach] Generating personalized outreach for ${company.name}`);

  const domain = company.primaryDomain || company.websiteUrl || "unknown.com";

  // Load Brain context for seller intelligence
  const brainInfo = userId ? await getBrainContextForApproach(userId, brainId) : { context: "", companyName: "Your Company" };
  const sellerName = brainInfo.companyName;

  // Build verified developments summary with source URLs
  const verifiedDevelopments = (briefData.recentDevelopments || [])
    .filter((d: any) => d && (typeof d === "string" || d.text))
    .map((d: any) => {
      if (typeof d === "string") return `- ${d}`;
      const sourceNote = d.sourceUrl ? ` [Source: ${d.sourceUrl}]` : "";
      return `- ${d.text}${d.date ? ` (${d.date})` : ""}${sourceNote}`;
    })
    .join("\n");

  // Build verified sources list for the prompt
  const verifiedSources = (briefData.sources || [])
    .map((s: any) => `- ${s.title || "Source"}: ${s.url}`)
    .join("\n");

  // Today's date — dynamic, never hardcoded
  const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Generate comprehensive sales approach
  const approachPrompt = `You are a B2B sales expert. Today is ${todayStr}. You are crafting a complete sales approach for ${sellerName}.
${brainInfo.context ? `${brainInfo.context}
**Use the seller intelligence above to tailor all outreach materials to the seller's specific capabilities and value propositions.**
` : ""}

**Target Company:** ${company.name} (${domain})

**Deep Research Summary (with verified sources):**
- Urgency Score: ${briefData.urgencyScore}/100
- Products/Services: ${briefData.productsServices?.map((p: any) => p.category).join(", ") || "Unknown"}
- Key Technologies: ${briefData.keyTechnologies?.map((t: any) => t.name).join(", ") || "Unknown"}
- Target Markets: ${briefData.targetMarkets?.map((m: any) => m.segment).join(", ") || "Unknown"}

**Verified Recent Developments:**
${verifiedDevelopments || "No verified developments available."}

**Verified Sources from Deep Research:**
${verifiedSources || "No verified sources available."}

**INSTRUCTIONS:**
1. Search for the absolute latest news about "${company.name}" from the past 12 months to supplement the deep research
2. Ground ALL conversation starters in specific, verified developments with working source URLs
3. The email draft should reference at least one specific, verified development
4. Only use verified data from your searches — do NOT hallucinate URLs or facts

**Generate a complete sales approach. Return JSON matching the required schema:**
- conversationStarters: 3 specific openers, each tied to a verified source URL
- engagementStrategy: why this prospect matters, recommended approach, key talking points
- emailDraft: personalized cold email with subject, body (3 paragraphs), and referenced sources
- linkedinMessage: connection request (max 200 chars) and follow-up message
- callScript: 30-second opening, 3 discovery questions, value proposition, call to action`;

  const approachRaw = await callGrokWithWebSearch(approachPrompt);
  const approachData = JSON.parse(approachRaw);

  // Assemble final sales approach — with strict json_schema, fields are guaranteed present
  const salesApproach: SalesApproach = {
    companyName: company.name,
    generatedAt: new Date().toISOString(),
    conversationStarters: normaliseConversationStarters(approachData.conversationStarters || []),
    engagementStrategy: approachData.engagementStrategy || {
      whyThisProspectMatters: [],
      recommendedApproach: [],
      keyTalkingPoints: [],
    },
    emailDraft: approachData.emailDraft || {
      subject: "Exploring partnership opportunities",
      body: "Email generation failed. Please try again.",
      referencedSources: [],
    },
    linkedinMessage: approachData.linkedinMessage || {
      connectionRequest: "Connection request generation failed.",
      followUp: "Follow-up message generation failed.",
    },
    callScript: approachData.callScript || {
      opening: "Call script generation failed.",
      discoveryQuestions: [],
      valueProposition: "Value prop generation failed.",
      callToAction: "Next step generation failed.",
    },
  };

  console.log(`[Sales Approach] Personalized outreach generated for ${company.name} with ${salesApproach.conversationStarters.length} source-backed conversation starters`);

  return salesApproach;
}
