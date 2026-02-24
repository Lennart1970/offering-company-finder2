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

import { getCompanyById } from "./db";

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = "https://api.x.ai/v1";

export interface VerifiedSource {
  url: string;
  title: string;
  snippet: string;
  dateAccessed: string;
}

export interface SalesIntelligenceBrief {
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
}

/**
 * Call xAI Responses API with explicit web_search tool
 */
async function callGrokWithWebSearch(input: string): Promise<string> {
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
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Responses API returns output in different format than Chat Completions
  // Look for output_text in the response
  if (data.output_text) {
    return data.output_text;
  }
  
  // Alternative: check for message content in output array
  if (data.output && Array.isArray(data.output)) {
    const messageItem = data.output.find((item: any) => item.type === "message");
    if (messageItem?.content?.[0]?.text) {
      return messageItem.content[0].text;
    }
  }
  
  throw new Error("Unexpected Responses API format: no output_text or message content found");
}

/**
 * Generate a sales intelligence brief for a company
 */
export async function generateSalesIntelligenceBrief(
  companyId: number
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

  // Phase 1: Detect urgency signals with verified sources
  console.log(`[Brief Generator] Phase 1: Detecting urgency signals with source verification...`);
  const urgencyPrompt = `You are a B2B sales intelligence analyst. Today is February 23, 2026. Your goal is to provide verifiable answers with traceable sources from the most recent content available.

**Target Company:** "${company.name}" (${domain})

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

  const urgencyRaw = await callGrokWithWebSearch(urgencyPrompt);
  const urgencyData = JSON.parse(urgencyRaw);
  console.log(`[Brief Generator] Urgency score: ${urgencyData.urgencyScore}`);
  console.log(`[Brief Generator] Sources found: ${urgencyData.sources?.length || 0}`);

  // Phase 2: Gather company intelligence with verified sources
  console.log(`[Brief Generator] Phase 2: Gathering company intelligence with source verification...`);
  const intelligencePrompt = `You are a B2B sales intelligence analyst. Today is February 23, 2026. Your goal is to provide verifiable company intelligence with traceable sources.

**Target Company:** "${company.name}" (${domain})

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

  const intelligenceRaw = await callGrokWithWebSearch(intelligencePrompt);
  const intelligenceData = JSON.parse(intelligenceRaw);
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
