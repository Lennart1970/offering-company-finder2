/**
 * Sales Intelligence Brief Generator
 * 
 * Generates comprehensive sales briefs using xAI Grok Responses API with
 * explicit web_search tool calling for:
 * - Urgency detection with verifiable, traceable sources
 * - Company intelligence with working URLs and direct quotes
 * 
 * Uses Grok 4.1 fast-reasoning mode with explicit web_search() tool
 * via Responses API (/v1/responses) to ensure current 2026 content.
 */

import { getCompanyById, getActiveBrain } from "./db";
import type { VerifiedSource, SalesIntelligenceBrief, FitScoreResult } from "../shared/contractTypes";

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = "https://api.x.ai/v1";

/**
 * Build Brain context string for injection into prompts.
 * Returns empty string if no brain is active.
 */
async function getBrainContext(userId: number): Promise<string> {
  try {
    const brain = await getActiveBrain(userId);
    if (!brain || brain.status !== "completed") return "";

    const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
    const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
    const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
    const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
    const buyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals) : [];
    const fitCriteria = brain.fitCriteria ? JSON.parse(brain.fitCriteria) : { mustHave: [], niceToHave: [], disqualifiers: [] };
    const urgencyTriggers = brain.urgencyTriggers ? JSON.parse(brain.urgencyTriggers) : [];

    return `
**YOUR COMPANY (Seller) — Offering Brain Intelligence:**
- Company: ${brain.companyName}
- Summary: ${brain.offeringSummary}
- Core Capabilities: ${capabilities.join("; ")}
- Value Propositions: ${valueProps.map((vp: any) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
- Competitive Advantages: ${brain.competitiveAdvantages}
- ICP Industries: ${icpIndustries.join(", ")}
- ICP Company Size: ${brain.icpCompanySize}
- ICP Pain Points: ${painPoints.join("; ")}
- Buying Signals to Watch: ${buyingSignals.join("; ")}
- Fit Must-Haves: ${fitCriteria.mustHave?.join("; ") || "None"}
- Fit Disqualifiers: ${fitCriteria.disqualifiers?.join("; ") || "None"}
- Urgency Triggers: ${urgencyTriggers.join("; ")}
`;
  } catch (error) {
    console.warn("[Brain Context] Failed to load brain:", error);
    return "";
  }
}

// Types moved to shared/contractTypes.ts — imported above
// Re-export for backward compatibility with any existing consumers
export type { VerifiedSource, SalesIntelligenceBrief, FitScoreResult } from "../shared/contractTypes";

/** @deprecated Use SalesIntelligenceBrief from shared/contractTypes.ts */
interface _SalesIntelligenceBrief_LEGACY {
  companyName: string;
  generatedAt: string;
  urgencyScore: number;
  urgencyBreakdown: {
    companyContext: number;
    marketSignals: number;
    recentActivity: number;
  };
  executiveSummary: {
    company: string;
    industry: string;
    employees: number | string;
    revenue: string;
    domain: string;
    linkedin: string;
  };
  verifiedContacts: {
    website: { value: string; source: string; verified: boolean };
    linkedin: { value: string; source: string; verified: boolean };
  };
  productsServices: Array<{
    category: string;
    description: string;
    sourceUrl?: string;
  }>;
  keyTechnologies: Array<{
    name: string;
    description: string;
    sourceUrl?: string;
  }>;
  recentDevelopments: Array<{
    text: string;
    date: string;
    sourceUrl: string;
    snippet: string;
  }>;
  targetMarkets: Array<{
    segment: string;
    description: string;
  }>;
  industryKeywords: string[];
  naicsCodes: string[];
  urgencySignals: Array<{
    category: string;
    type: string;
    description: string;
    weight: number;
    sourceUrl: string;
    snippet: string;
    detectedAt: string;
  }>;
  sources: VerifiedSource[];
  rawGrokUrgency?: string;
  rawGrokIntelligence?: string;
}

// Helper: get today's date as a readable string for prompt injection
function todayString(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** Strip markdown code fences that Grok sometimes wraps around JSON responses */
function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

/**
 * Call xAI Responses API with explicit web_search tool.
 * Pass a json_schema object to enforce strict structured output.
 */
async function callGrokWithWebSearch(
  input: string,
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  const responseFormat = jsonSchema
    ? { type: "json_schema", json_schema: { name: "output", strict: true, schema: jsonSchema } }
    : { type: "json_object" };

  // 180-second timeout wraps the ENTIRE call including body read.
  // The controller must NOT be cleared until after response.json() completes
  // — clearing it in a finally after fetch() only covers headers, not the body stream.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await fetch(`${XAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        tools: [{ type: "web_search" }],  // Explicit web_search tool
        input,
        response_format: responseFormat,
      }),
      signal: controller.signal,
    });

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
            return stripJsonFences(textContent.text);
          }
        }
      }
    }

    // Fallback: check for direct text field (older format)
    if (data.text) {
      return stripJsonFences(data.text);
    }

    throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate a sales intelligence brief for a company
 */
export async function generateSalesIntelligenceBrief(
  companyId: number,
  userId?: number
): Promise<SalesIntelligenceBrief> {
  // Load company data from database
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  console.log(`[Brief Generator] Generating brief for ${company.name}`);

  const domain = company.primaryDomain || company.websiteUrl || "unknown.com";
  const naicsCodes = company.naicsCodes ? JSON.parse(company.naicsCodes) : [];
  const industry = inferIndustryFromNAICS(naicsCodes);

  // Load Brain context if userId is available
  const brainContext = userId ? await getBrainContext(userId) : "";
  if (brainContext) {
    console.log(`[Brief Generator] Brain context loaded — will inform fit/urgency evaluation`);
  }

  // JSON schemas for strict output enforcement (Fix 3 — prompt-contracts-audit.md)
  const URGENCY_SCHEMA = {
    type: "object",
    properties: {
      urgencyScore: { type: "number" },
      urgencyBreakdown: {
        type: "object",
        properties: {
          companyContext: { type: "number" },
          marketSignals: { type: "number" },
          recentActivity: { type: "number" },
        },
        required: ["companyContext", "marketSignals", "recentActivity"],
        additionalProperties: false,
      },
      recentDevelopments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            date: { type: "string" },
            sourceUrl: { type: "string" },
            snippet: { type: "string" },
          },
          required: ["text", "date", "sourceUrl", "snippet"],
          additionalProperties: false,
        },
      },
      urgencySignals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            type: { type: "string" },
            description: { type: "string" },
            weight: { type: "number" },
            sourceUrl: { type: "string" },
            snippet: { type: "string" },
            detectedAt: { type: "string" },
          },
          required: ["category", "type", "description", "weight", "sourceUrl", "snippet", "detectedAt"],
          additionalProperties: false,
        },
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
            dateAccessed: { type: "string" },
          },
          required: ["url", "title", "snippet", "dateAccessed"],
          additionalProperties: false,
        },
      },
      searchNotes: { type: "string" },
    },
    required: ["urgencyScore", "urgencyBreakdown", "recentDevelopments", "urgencySignals", "sources", "searchNotes"],
    additionalProperties: false,
  };

  const INTELLIGENCE_SCHEMA = {
    type: "object",
    properties: {
      productsServices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            description: { type: "string" },
            sourceUrl: { type: "string" },
          },
          required: ["category", "description", "sourceUrl"],
          additionalProperties: false,
        },
      },
      keyTechnologies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            sourceUrl: { type: "string" },
          },
          required: ["name", "description", "sourceUrl"],
          additionalProperties: false,
        },
      },
      targetMarkets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            segment: { type: "string" },
            description: { type: "string" },
          },
          required: ["segment", "description"],
          additionalProperties: false,
        },
      },
      industryKeywords: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
            dateAccessed: { type: "string" },
          },
          required: ["url", "title", "snippet", "dateAccessed"],
          additionalProperties: false,
        },
      },
    },
    required: ["productsServices", "keyTechnologies", "targetMarkets", "industryKeywords", "sources"],
    additionalProperties: false,
  };

  // Phase 1: Detect urgency signals with verified sources
  const urgencyPrompt = `You are a B2B sales intelligence analyst. Today is ${todayString()}. Your goal is to provide verifiable answers with traceable sources from the most recent content available.
${brainContext ? `${brainContext}
**Use the Offering Brain intelligence above to:**
- Assess how well this prospect fits the seller's ICP
- Identify specific buying signals that match the seller's offering
- Weight urgency higher when the prospect shows signals matching the seller's urgency triggers
- Note any disqualifiers from the fit criteria

` : ""}**Target Company:** "${company.name}" (${domain})

**Instructions:**
1. Search for the absolute latest news and developments about "${company.name}" from the past 12 months
2. Focus on: product launches, expansions, hiring, partnerships, acquisitions, funding
3. Prioritize sources from 2026 and late 2025
4. Only use verified data from your searches — do NOT hallucinate URLs or facts

**Score urgency 0-100 based on:**
- Company Context (0-40): Growth stage, financial health, industry momentum
- Market Signals (0-35): Competitive pressure, market expansion, technology shifts
- Recent Activity (0-25): Hiring, announcements, news mentions in past 12 months

**Return JSON only:**
{
  "urgencyScore": 45,
  "urgencyBreakdown": {
    "companyContext": 20,
    "marketSignals": 15,
    "recentActivity": 10
  },
  "recentDevelopments": [
    {
      "text": "Launched new product line for IoT sensors",
      "date": "2026-01-15",
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote or excerpt from the verified source page"
    }
  ],
  "urgencySignals": [
    {
      "category": "Growth",
      "type": "Product Launch",
      "description": "Launched new IoT sensor line in Q4 2025",
      "weight": 8,
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote from verified source",
      "detectedAt": "2026-01-15"
    }
  ],
  "sources": [
    {
      "url": "https://working.website.com/article",
      "title": "Page title from search",
      "snippet": "Key excerpt from the page",
      "dateAccessed": "2026-02-23"
    }
  ],
  "searchNotes": "Any caveats about source availability or search limitations"
}`;

  // Phase 2: Company intelligence prompt (runs concurrently with Phase 1 via Promise.all below)
  const intelligencePrompt = `You are a B2B sales intelligence analyst. Today is ${todayString()}. Your goal is to provide verifiable company intelligence with traceable sources.
${brainContext ? `${brainContext}
**Use the Offering Brain intelligence above to:**
- Focus on products/services that overlap with the seller's capabilities
- Identify technologies that indicate the prospect needs the seller's services
- Highlight target markets where the seller can add value

` : ""}**Target Company:** "${company.name}" (${domain})

**Instructions:**
1. Research "${company.name}" to find:
   - Products & services offerings
   - Technology stack and platform
   - Target markets and customer industries
2. Visit the company website (${domain}) if possible
3. Only include facts backed by verified sources — do NOT hallucinate

**Return JSON only:**
{
  "productsServices": [
    {
      "category": "IoT Devices",
      "description": "Smart home sensors and gateways",
      "sourceUrl": "https://company.com/products"
    }
  ],
  "keyTechnologies": [
    {
      "name": "IoT",
      "description": "Internet of Things connectivity platform",
      "sourceUrl": "https://company.com/technology"
    }
  ],
  "targetMarkets": [
    {"segment": "Smart Home", "description": "Residential automation systems"},
    {"segment": "Healthcare", "description": "Medical diagnostic equipment"}
  ],
  "industryKeywords": ["IoT", "sensors", "wireless", "embedded systems", "PCB", "electronics"],
  "sources": [
    {
      "url": "https://company.com/products",
      "title": "Products page title",
      "snippet": "Key excerpt",
      "dateAccessed": "2026-02-23"
    }
  ]
}`;

  // Run both Grok web-search phases concurrently — they are fully independent
  console.log(`[Brief Generator] Phase 1: Detecting urgency signals with source verification...`);
  const [urgencyRaw, intelligenceRaw] = await Promise.all([
    callGrokWithWebSearch(urgencyPrompt, URGENCY_SCHEMA),
    callGrokWithWebSearch(intelligencePrompt, INTELLIGENCE_SCHEMA),
  ]);
  const urgencyData = JSON.parse(urgencyRaw);
  const intelligenceData = JSON.parse(intelligenceRaw);
  console.log(`[Brief Generator] Urgency score: ${urgencyData.urgencyScore}`);
  console.log(`[Brief Generator] Sources found: ${urgencyData.sources?.length || 0}`);
  console.log(
    `[Brief Generator] Found ${intelligenceData.productsServices?.length || 0} product categories`
  );
  console.log(`[Brief Generator] Intelligence sources: ${intelligenceData.sources?.length || 0}`);

  // Normalize recentDevelopments to new format (handle legacy string format)
  const normalizedDevelopments = (urgencyData.recentDevelopments || []).map((dev: any) => {
    if (typeof dev === "string") {
      return { text: dev, date: "", sourceUrl: "", snippet: "" };
    }
    return {
      text: dev.text || dev.event || "",
      date: dev.date || "",
      sourceUrl: dev.sourceUrl || dev.url || "",
      snippet: dev.snippet || "",
    };
  });

  // Normalize urgencySignals to new format (handle legacy format)
  const normalizedSignals = (urgencyData.urgencySignals || []).map((signal: any) => ({
    category: signal.category || "Unknown",
    type: signal.type || "Unknown",
    description: signal.description || "",
    weight: signal.weight || 0,
    sourceUrl: signal.sourceUrl || signal.url || "",
    snippet: signal.snippet || "",
    detectedAt: signal.detectedAt || signal.date || new Date().toISOString().split("T")[0],
  }));

  // Combine sources from both phases
  const allSources = [
    ...(urgencyData.sources || []),
    ...(intelligenceData.sources || []),
  ];

  // Build final brief
  const brief: SalesIntelligenceBrief = {
    companyName: company.name,
    generatedAt: new Date().toISOString(),
    urgencyScore: urgencyData.urgencyScore || 0,
    urgencyBreakdown: urgencyData.urgencyBreakdown || {
      companyContext: 0,
      marketSignals: 0,
      recentActivity: 0,
    },
    executiveSummary: {
      company: company.name,
      industry: industry,
      employees: "Unknown",  // Employee count not stored in schema
      revenue: company.revenue || "Unknown",
      domain: domain,
      linkedin: company.linkedinUrl || "",
    },
    verifiedContacts: {
      website: {
        value: domain,
        source: "Apollo API",
        verified: true,
      },
      linkedin: {
        value: company.linkedinUrl || "",
        source: "Apollo API",
        verified: !!company.linkedinUrl,
      },
    },
    productsServices: intelligenceData.productsServices || [],
    keyTechnologies: intelligenceData.keyTechnologies || [],
    recentDevelopments: normalizedDevelopments,
    targetMarkets: intelligenceData.targetMarkets || [],
    industryKeywords: intelligenceData.industryKeywords || [],
    naicsCodes: naicsCodes,
    urgencySignals: normalizedSignals,
    sources: allSources,
    rawGrokUrgency: urgencyRaw,
    rawGrokIntelligence: intelligenceRaw,
  };

  console.log(`[Brief Generator] Brief complete for ${company.name}`);
  return brief;
}

/**
 * Infer industry from NAICS codes
 */
function inferIndustryFromNAICS(naicsCodes: string[]): string {
  if (!naicsCodes || naicsCodes.length === 0) return "Unknown";

  const firstCode = naicsCodes[0];
  const sector = firstCode.substring(0, 2);

  const sectorMap: Record<string, string> = {
    "11": "Agriculture",
    "21": "Mining",
    "22": "Utilities",
    "23": "Construction",
    "31": "Manufacturing",
    "32": "Manufacturing",
    "33": "Manufacturing",
    "42": "Wholesale Trade",
    "44": "Retail Trade",
    "45": "Retail Trade",
    "48": "Transportation",
    "49": "Transportation",
    "51": "Information",
    "52": "Finance",
    "53": "Real Estate",
    "54": "Professional Services",
    "55": "Management",
    "56": "Administrative Services",
    "61": "Educational Services",
    "62": "Healthcare",
    "71": "Arts & Entertainment",
    "72": "Accommodation & Food",
    "81": "Other Services",
    "92": "Public Administration",
  };

  return sectorMap[sector] || "Unknown";
}


// ============================================================================
// FIT SCORING — Grok-powered ICP match analysis
// ============================================================================

// FitScoreResult is now defined in shared/contractTypes.ts and imported at the top

/**
 * Score a company's fit against the active Brain's ICP criteria.
 * Returns a 0-100 fit score with full breakdown for transparency.
 * Does NOT require a web search — uses only stored company data + Brain context.
 */
export async function scoreCompanyFit(
  companyId: number,
  userId?: number
): Promise<FitScoreResult> {
  const company = await getCompanyById(companyId);
  if (!company) throw new Error(`Company ${companyId} not found`);

  const brain = userId ? await getActiveBrain(userId) : null;
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Brain found — cannot score fit without ICP criteria");
  }

  const brainContext = await getBrainContext(userId!);

  // Parse brain fields for structured scoring
  const fitCriteria = brain.fitCriteria ? JSON.parse(brain.fitCriteria) : { mustHave: [], niceToHave: [], disqualifiers: [] };
  const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const buyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals) : [];

  const companyProfile = `
Company: ${company.name}
Website: ${company.websiteUrl || "unknown"}
Location: ${[company.city, company.state, company.country].filter(Boolean).join(", ") || "unknown"}
Revenue: ${company.revenue || "unknown"}
Industry (NAICS): ${company.naicsCodes ? JSON.parse(company.naicsCodes).slice(0, 5).join(", ") : "unknown"}
Industry (SIC): ${company.sicCodes ? JSON.parse(company.sicCodes).slice(0, 5).join(", ") : "unknown"}
Short description: ${(company as any).shortDescription || "not available"}
`;

  const prompt = `You are a B2B sales qualification analyst. Score the prospect company's fit against the seller's Ideal Customer Profile (ICP).

${brainContext}

**PROSPECT COMPANY:**
${companyProfile}

**SCORING TASK:**
Evaluate the prospect against the Brain's ICP criteria and return a JSON object with this exact structure:

{
  "fitScore": <integer 0-100>,
  "breakdown": {
    "industryFit": {
      "score": <0-30>,
      "max": 30,
      "rationale": "<1-2 sentences explaining the industry match>"
    },
    "sizeFit": {
      "score": <0-20>,
      "max": 20,
      "rationale": "<1-2 sentences explaining the size/revenue match>"
    },
    "mustHavesFit": {
      "score": <0-30>,
      "max": 30,
      "rationale": "<1-2 sentences>",
      "matched": ["<must-have criteria that appear to be met>"],
      "missing": ["<must-have criteria that appear to be missing>"]
    },
    "disqualifiers": {
      "triggered": <true|false>,
      "reasons": ["<any disqualifier criteria that appear to apply>"]
    },
    "buyingSignalsFit": {
      "score": <0-20>,
      "max": 20,
      "rationale": "<1-2 sentences on buying signal alignment>"
    }
  },
  "overallRationale": "<3-4 sentence executive summary of why this company is or isn't a strong fit>"
}

Scoring rules:
- industryFit (0-30): Does the company operate in the Brain's ICP industries? Full score = perfect match, 0 = complete mismatch
- sizeFit (0-20): Does the company's revenue/headcount match the Brain's ICP company size?
- mustHavesFit (0-30): How many of the Brain's must-have criteria does this company appear to meet?
- disqualifiers: If ANY disqualifier is triggered, cap fitScore at 25 regardless of other scores
- buyingSignalsFit (0-20): Does the company profile suggest any of the Brain's buying signals are present?
- fitScore = industryFit.score + sizeFit.score + mustHavesFit.score + buyingSignalsFit.score (capped at 25 if disqualifier triggered)

ICP Industries to match against: ${icpIndustries.join(", ")}
Must-haves: ${fitCriteria.mustHave?.join("; ") || "none specified"}
Disqualifiers: ${fitCriteria.disqualifiers?.join("; ") || "none specified"}
Buying signals: ${buyingSignals.join("; ")}
ICP company size: ${brain.icpCompanySize || "not specified"}

Return ONLY the JSON object, no markdown, no explanation outside the JSON.`;

  console.log(`[Fit Scorer] Scoring fit for ${company.name}...`);
  const rawGrokFit = await callGrokWithWebSearch(prompt);

  // Parse the JSON response
  const firstBrace = rawGrokFit.indexOf("{");
  const lastBrace = rawGrokFit.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Grok fit scoring returned no valid JSON");
  }
  const parsed = JSON.parse(rawGrokFit.slice(firstBrace, lastBrace + 1));

  // Apply disqualifier cap
  let finalScore = parsed.fitScore ?? 0;
  if (parsed.breakdown?.disqualifiers?.triggered) {
    finalScore = Math.min(finalScore, 25);
  }
  finalScore = Math.max(0, Math.min(100, finalScore));

  console.log(`[Fit Scorer] ${company.name} → fitScore: ${finalScore}`);

  return {
    fitScore: finalScore,
    scoredAt: new Date().toISOString(),
    companyName: company.name,
    brainName: brain.brainName,
    breakdown: parsed.breakdown,
    overallRationale: parsed.overallRationale,
    rawGrokFit,
  };
}
