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

import { getCompanyById, getActiveBrain, getOfferingBrainById } from "./db";
import type { VerifiedSource, SalesIntelligenceBrief, FitScoreResult } from "../shared/contractTypes";

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = "https://api.x.ai/v1";

/**
 * Build Brain context string for injection into prompts.
 * Returns empty string if no brain is active.
 */
async function getBrainContext(userId: number, brainId?: number): Promise<string> {
  try {
    const brain = brainId
      ? await getOfferingBrainById(brainId, userId)
      : await getActiveBrain(userId);
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
 * 
 * IMPORTANT: The Grok Responses API does NOT support response_format when tools
 * includes web_search. Passing response_format alongside web_search causes a 422 error.
 * Instead, we instruct Grok to return JSON in the prompt text and extract it via regex.
 */
async function callGrokWithWebSearch(
  input: string,
  _jsonSchema?: Record<string, unknown>  // kept for API compatibility, not sent to Grok
): Promise<string> {
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
        model: "grok-4.3",
        tools: [{ type: "web_search" }],  // Explicit web_search tool
        input,
        // NOTE: response_format intentionally omitted — incompatible with web_search tools
        // The Responses API returns 422 when response_format is combined with web_search.
        // JSON is extracted from the text response via regex instead.
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
    let rawText: string | null = null;
    if (data.output && Array.isArray(data.output)) {
      // Find the output item that contains content (not tool calls)
      for (const item of data.output) {
        if (item.content && Array.isArray(item.content)) {
          const textContent = item.content.find((c: any) => c.type === "output_text");
          if (textContent?.text) {
            rawText = textContent.text;
            break;
          }
        }
        if (rawText) break;
      }
    }

    // Fallback: check for direct text field (older format)
    if (!rawText && data.text) {
      rawText = data.text;
    }

    if (!rawText) {
      throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
    }

    // Strip markdown fences first
    rawText = stripJsonFences(rawText);

    // Extract JSON object from the text (Grok may include explanatory text around the JSON)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return rawText;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate a sales intelligence brief for a company
 */
export async function generateSalesIntelligenceBrief(
  companyId: number,
  userId?: number,
  brainId?: number
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
  const brainContext = userId ? await getBrainContext(userId, brainId) : "";
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
  const urgencyPrompt = `You are a B2B sales intelligence analyst. Today is ${todayString()}. Your task: score how urgently a B2B seller should contact this prospect RIGHT NOW based on verified signals from the past 12 months.
${brainContext ? `${brainContext}
**Use the Offering Brain intelligence above to:**
- Weight urgency higher when the prospect shows signals matching the seller's urgency triggers
- Identify specific buying signals that match the seller's offering

` : ""}**Target Company:** "${company.name}" (${domain})

**Instructions:**
1. Search for the latest news and developments about "${company.name}" from the past 12 months
2. Only use verified data from your searches — do NOT hallucinate URLs or facts
3. Prioritize sources from 2026 and late 2025

**SCORING MODEL — read carefully before scoring:**

Company Context (0-40): Evidence of company growth momentum
  - 30-40: Funding round (Series A+), acquisition, major strategic pivot, IPO filing
  - 20-29: Seed/angel funding, significant revenue growth reported, entering new market
  - 10-19: Award or recognition (national/industry), new product launch, key certification achieved (ISO, FDA, CE)
  - 5-9:  Positive press coverage, new partnership announced, website redesign/relaunch
  - 1-4:  Company has active web presence, recent blog/social activity
  - 0:    No evidence of any company activity found

Market Signals (0-35): External forces creating urgency to buy/partner NOW
  - 25-35: Regulatory deadline, market disruption, competitor acquisition in their space
  - 15-24: Industry growth trend directly affecting their sector, new compliance requirement
  - 8-14:  Market expansion in their geography or vertical, technology shift they must respond to
  - 1-7:   General industry activity, sector-level news
  - 0:     No relevant market signals found

Recent Activity (0-25): Operational signals of active change or investment
  - 20-25: Active hiring for roles that indicate expansion (engineering, sales, ops), M&A activity
  - 12-19: Multiple job postings, conference participation, product roadmap announcements
  - 5-11:  Some hiring activity, event attendance, press releases in past 6 months
  - 1-4:   Minimal recent activity but company is reachable and active
  - 0:     No recent activity found

**CALIBRATION ANCHORS:**
- Score 70-100: Funding announced, active hiring surge, product launch + market expansion simultaneously
- Score 50-69: Award won + new product line, or funding + hiring, or entering new geography
- Score 30-49: Industry award, new certification, partnership announced, or notable press coverage
- Score 15-29: Active company with some recent news but no strong growth signals
- Score 5-14:  Company exists and is reachable but minimal recent signals
- Score 0-4:   No signals found at all — company may be dormant or unfindable

**IMPORTANT:** A company that has won a national award, launched a new product, or received a certification in the past 12 months should score AT LEAST 25. Do not score 0 unless you genuinely found zero evidence of any activity.

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
      "text": "Won EmprendeXXI national startup award for Region of Murcia",
      "date": "2026-05-01",
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote or excerpt from the verified source page"
    }
  ],
  "urgencySignals": [
    {
      "category": "Growth",
      "type": "Award / Recognition",
      "description": "Won national startup award — signals growth phase and partner-seeking behaviour",
      "weight": 8,
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote from verified source",
      "detectedAt": "2026-05-01"
    }
  ],
  "sources": [
    {
      "url": "https://working.website.com/article",
      "title": "Page title from search",
      "snippet": "Key excerpt from the page",
      "dateAccessed": "2026-05-11"
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
 * Build angle context string for injection into prompts.
 * Returns empty string for default (Potential Customer) angle.
 */
export async function getAngleContext(angleId?: string): Promise<{ context: string; isDistributor: boolean; angleName: string }> {
  if (!angleId) return { context: "", isDistributor: false, angleName: "Potential Customer" };
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: angle } = await sb.from("lt_mns_angles").select("id, name, description").eq("id", angleId).single();
    if (!angle) return { context: "", isDistributor: false, angleName: "Potential Customer" };
    const isDistributor = angle.name === "Distributor";
    const context = isDistributor
      ? `\n**ENGAGEMENT ANGLE: DISTRIBUTOR / CHANNEL PARTNER**\nYou are NOT evaluating this company as a direct end-customer. You are evaluating it as a potential DISTRIBUTOR or CHANNEL PARTNER.\nThe goal is to find companies that can RESELL, DISTRIBUTE, or REPRESENT the seller's products to end-users.\nEvaluate: (1) Does this company sell to the target end-customer segment? (2) Does it have an existing complementary product portfolio? (3) Does it have commercial infrastructure (sales team, logistics, showroom/store)? (4) Is there commercial motivation to add a new premium product line?\n`
      : `\n**ENGAGEMENT ANGLE: ${angle.name}**\n${angle.description}\n`;
    return { context, isDistributor, angleName: angle.name };
  } catch (err) {
    console.warn("[Angle Context] Failed to load angle:", err);
    return { context: "", isDistributor: false, angleName: "Potential Customer" };
  }
}

/**
 * Score a company's fit against the active Brain's ICP criteria.
 * Returns a 0-100 fit score with full breakdown for transparency.
 * Does NOT require a web search — uses only stored company data + Brain context.
 */
export async function scoreCompanyFit(
  companyId: number,
  userId?: number,
  angleId?: string
): Promise<FitScoreResult> {
  const company = await getCompanyById(companyId);
  if (!company) throw new Error(`Company ${companyId} not found`);

  const brain = userId ? await getActiveBrain(userId) : null;
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Brain found — cannot score fit without ICP criteria");
  }

  const brainContext = await getBrainContext(userId!);
  const angleInfo = await getAngleContext(angleId);

  // Parse brain fields for structured scoring
  const fitCriteria = brain.fitCriteria ? JSON.parse(brain.fitCriteria) : { mustHave: [], niceToHave: [], disqualifiers: [] };
  const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const buyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals) : [];

  // ── Resolve must-have criteria from EITHER fitCriteria schema ────────────
  // Old schema: { mustHave: string[], niceToHave: string[], disqualifiers: string[] }
  // New schema: { dimensions: [{name, strongFit, weakFit, weight}], strong_fit: string[], mustHave: [], disqualifiers: [] }
  const mustHaveCriteria: string[] = (() => {
    const arr: string[] = [];
    // Old schema: fitCriteria.mustHave
    if (Array.isArray(fitCriteria.mustHave) && fitCriteria.mustHave.length > 0) {
      arr.push(...fitCriteria.mustHave);
    }
    // New schema: fitCriteria.strong_fit
    if (Array.isArray(fitCriteria.strong_fit) && fitCriteria.strong_fit.length > 0) {
      arr.push(...fitCriteria.strong_fit);
    }
    // Dimension schema: each dimension.strongFit is a must-have description
    if (Array.isArray(fitCriteria.dimensions)) {
      for (const dim of fitCriteria.dimensions as Array<{name:string;strongFit:string;weakFit?:string;weight?:number}>) {
        if (dim.strongFit) arr.push(`${dim.name}: ${dim.strongFit}`);
      }
    }
    return arr;
  })();
  const disqualifierCriteria: string[] = (() => {
    const arr: string[] = [];
    if (Array.isArray(fitCriteria.disqualifiers) && fitCriteria.disqualifiers.length > 0) arr.push(...fitCriteria.disqualifiers);
    if (Array.isArray(fitCriteria.weak_fit) && fitCriteria.weak_fit.length > 0) arr.push(...fitCriteria.weak_fit);
    return arr;
  })();

  // ── Enrich company profile with all available size/scale signals ─────────
  const sliceMeta = (() => {
    try { return company.sliceMetadata ? JSON.parse(company.sliceMetadata) : {}; } catch { return {}; }
  })();
  const companyProfile = `
Company: ${company.name}
Website: ${company.websiteUrl || "unknown"}
Location: ${[company.city, company.state, company.country].filter(Boolean).join(", ") || "unknown"}
Revenue (Apollo): ${company.revenue || "unknown"}
Employee band (Apollo): ${sliceMeta.employeeBand || "unknown"}
Headcount growth: ${company.headcountGrowth || "unknown"}
Founded: ${company.foundedYear || "unknown"}
Industry (NAICS): ${company.naicsCodes ? JSON.parse(company.naicsCodes).slice(0, 5).join(", ") : "unknown"}
Industry (SIC): ${company.sicCodes ? JSON.parse(company.sicCodes).slice(0, 5).join(", ") : "unknown"}
Short description: ${(company as any).shortDescription || "not available"}
NOTE: Use your web-search capability to find recent news about this company — especially capital raises, acquisitions, headcount announcements, or expansion plans — before scoring sizeFit.
`;

  const distributorScoringRules = angleInfo.isDistributor
    ? `DISTRIBUTOR SCORING RULES (override standard ICP scoring):
- industryFit (0-35): Does this company operate in DISTRIBUTION, RETAIL, or RESELLER space for the relevant end-market? Are they a dealer, importer, wholesaler, or specialty retailer?
- sizeFit (0-20): Does the company have sufficient commercial scale to be a meaningful channel partner? (revenue, team size, geographic reach). Search the web for recent capital raises, acquisitions, or headcount announcements if Apollo data is missing.
- mustHavesFit (0-30): Does the company have: (1) existing product portfolio in adjacent/complementary categories, (2) access to the target end-customer segment, (3) commercial infrastructure (sales team, logistics, showroom/online store)?
- disqualifiers: Disqualify if the company IS the end-user (uses products internally only), is a pure manufacturer with no distribution arm, or is a direct competitor.
- buyingSignalsFit (0-15): Evidence of channel expansion, new brand partnerships, trade show presence, or distributor agreements?
- overallRationale: Frame as channel partnership potential, not direct sales fit.
IMPORTANT: Location/geography is NOT a scoring dimension. Do not penalise or reward companies for their location. Geography is applied as a separate filter outside of fit scoring.`
    : `Scoring rules:
- industryFit (0-35): Does the company operate in the Brain's ICP industries? Full score = perfect match, 0 = complete mismatch
- sizeFit (0-20): Does the company's revenue/headcount match the Brain's ICP company size? IMPORTANT: use your web-search to find recent capital raises, acquisitions, or headcount announcements if Apollo data is missing or the company is new.
- mustHavesFit (0-30): How many of the Brain's must-have criteria does this company appear to meet? Score proportionally: full 30 if all met, 0 if none met.
- disqualifiers: If ANY disqualifier is triggered, cap fitScore at 25 regardless of other scores
- buyingSignalsFit (0-15): Does the company profile suggest any of the Brain's buying signals are present?
IMPORTANT: Location/geography is NOT a scoring dimension. Do not penalise or reward companies for their location. Geography is applied as a separate filter outside of fit scoring.`;

  const prompt = `You are a B2B sales qualification analyst. Score the prospect company's fit against the seller's Ideal Customer Profile (ICP).${angleInfo.context}

${brainContext}

**PROSPECT COMPANY:**
${companyProfile}

**SCORING TASK:**
Evaluate the prospect and return a JSON object with this exact structure:

{
  "fitScore": <integer 0-100>,
  "breakdown": {
    "industryFit": {
      "score": <0-35>,
      "max": 35,
      "rationale": "<1-2 sentences explaining the industry match>"
    },
    "sizeFit": {
      "score": <0-20>,
      "max": 20,
      "rationale": "<1-2 sentences explaining the size/revenue match — include any news signals found>"
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
      "score": <0-15>,
      "max": 15,
      "rationale": "<1-2 sentences on buying signal alignment>"
    }
  },
  "overallRationale": "<3-4 sentence executive summary of why this company is or isn't a strong fit as a ${angleInfo.isDistributor ? 'DISTRIBUTOR / CHANNEL PARTNER' : 'direct customer'}>"
}

${distributorScoringRules}
fitScore = industryFit.score + sizeFit.score + mustHavesFit.score + buyingSignalsFit.score (max 100, capped at 25 if disqualifier triggered)
Formula: 35 + 20 + 30 + 15 = 100 points total. Location is NOT scored here — it is a filter applied separately.

ICP Industries to match against: ${icpIndustries.join(", ")}
Must-have criteria (score 0 if none met, 30 if all met): ${mustHaveCriteria.length > 0 ? mustHaveCriteria.join("; ") : "none specified — use best judgment from ICP description"}
Disqualifiers / weak-fit signals: ${disqualifierCriteria.length > 0 ? disqualifierCriteria.join("; ") : "none specified"}
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
  let rawLlmScore = parsed.fitScore ?? 0;
  if (parsed.breakdown?.disqualifiers?.triggered) {
    rawLlmScore = Math.min(rawLlmScore, 25);
  }
  rawLlmScore = Math.max(0, Math.min(100, rawLlmScore));

  // ── Location is now a filter, not a score dimension ──────────────────────────────────────
  // geoFit has been removed from the scoring formula (Industry 35 + Size 20 + MustHaves 30 + Signals 15 = 100).
  // Country/region is stored on the company record and applied as a filter on share lists / campaigns.
  const rawCode = (company.country ?? company.sourceCountryCode ?? "").toUpperCase().trim();

  // fitScore is the direct LLM sum (no geo adjustment)
  const finalScore = rawLlmScore;

  console.log(
    `[Fit Scorer] ${company.name} → LLM: ${rawLlmScore} (location: ${rawCode || "unknown"}, not scored) = ${finalScore}`
  );

  return {
    fitScore: finalScore,
    rawLlmScore,
    scoredAt: new Date().toISOString(),
    companyName: company.name,
    brainName: brain.brainName,
    breakdown: {
      ...parsed.breakdown,
      // Location info preserved for display only — not part of score
      locationInfo: {
        countryCode: rawCode || null,
        note: "Location is a filter, not a scoring dimension (v2 formula)",
      },
    },
    overallRationale: parsed.overallRationale,
    rawGrokFit,
  };
}
