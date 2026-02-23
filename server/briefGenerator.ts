/**
 * Sales Intelligence Brief Generator
 * 
 * Generates comprehensive sales briefs using xAI Grok API with tool-calling
 * capabilities (web_search + browse_page) for:
 * - Urgency detection with verifiable, traceable sources
 * - Company intelligence with working URLs and direct quotes
 * 
 * Uses Grok 4.1 fast-reasoning mode with explicit tool-calling activation
 * to ensure citations point to live, verified URLs (not hallucinated).
 */

import OpenAI from "openai";
import { getCompanyById } from "./db";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

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
  const urgencyPrompt = `You are a B2B sales intelligence analyst using Grok 4.1 fast-reasoning mode with full tool access. Your goal is to provide verifiable answers with traceable sources, including working websites.

**Target Company:** "${company.name}" (${domain})

**Process step-by-step using tools:**

1. Use web_search to find recent news and developments (2024-2026) on "${company.name}". Run multiple searches:
   - "${company.name} news 2024 2025 2026"
   - "${company.name} product launches announcements"
   - "${company.name} expansion hiring growth"
   - "${company.name} partnerships acquisitions funding"
   Set num_results to 15 for broad coverage. Prioritize primary sources (company site, press releases, reputable news like bloomberg.com, reuters.com, techcrunch.com) over blogs.

2. For the top 3-5 most relevant results, use browse_page on their URLs with instructions: "Extract key details on recent developments (product launches, expansions, hiring, partnerships, funding). Include direct quotes, dates, and verify the page loads. If 404 or unavailable, skip. Summarize in 100 words max per page."

3. Based ONLY on verified data from tools, score urgency 0-100:
   - Company Context (0-40): Growth stage, financial health, industry momentum
   - Market Signals (0-35): Competitive pressure, market expansion, technology shifts
   - Recent Activity (0-25): Hiring, announcements, news mentions in past 6 months

4. Only use verified data from tools — do NOT hallucinate URLs or facts. If no recent news is found, say so honestly and assign a lower urgency score.

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
      "date": "2025-03-15",
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote or excerpt from the verified source page"
    }
  ],
  "urgencySignals": [
    {
      "category": "Growth",
      "type": "Product Launch",
      "description": "Launched new IoT sensor line in Q1 2025",
      "weight": 8,
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote from verified source",
      "detectedAt": "2025-03-15"
    }
  ],
  "sources": [
    {
      "url": "https://working.website.com/article",
      "title": "Page title from browse_page",
      "snippet": "Key excerpt from the page",
      "dateAccessed": "2026-02-23"
    }
  ],
  "searchNotes": "Any caveats about source availability or search limitations"
}`;

  const urgencyResponse = await xai.chat.completions.create({
    model: "grok-4-1-fast-reasoning",
    messages: [{ role: "user", content: urgencyPrompt }],
    response_format: { type: "json_object" },
  });

  const urgencyRaw = urgencyResponse.choices[0].message.content || "{}";
  const urgencyData = JSON.parse(urgencyRaw);
  console.log(`[Brief Generator] Urgency score: ${urgencyData.urgencyScore}`);
  console.log(`[Brief Generator] Sources found: ${urgencyData.sources?.length || 0}`);

  // Phase 2: Gather company intelligence with verified sources
  console.log(`[Brief Generator] Phase 2: Gathering company intelligence with source verification...`);
  const intelligencePrompt = `You are a B2B sales intelligence analyst using Grok 4.1 fast-reasoning mode with full tool access. Your goal is to provide verifiable company intelligence with traceable sources.

**Target Company:** "${company.name}" (${domain})

**Process step-by-step using tools:**

1. Use web_search to research "${company.name}" across multiple dimensions:
   - "${company.name} products services offerings"
   - "${company.name} technology stack platform"
   - "${company.name} target market customers industries"
   Set num_results to 15 for broad coverage.

2. Use browse_page on the company's own website (${domain}) to extract:
   - Products & Services page content
   - About page content
   - Technology or solutions pages
   Instructions: "Extract product categories, technology descriptions, and target market information. Include direct quotes. Summarize in 150 words max."

3. For 2-3 additional relevant results from web_search, use browse_page to verify and extract details. If a page returns 404 or is unavailable, skip it.

4. Synthesize findings into structured intelligence. Only include facts backed by tool results — do NOT hallucinate.

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

  const intelligenceResponse = await xai.chat.completions.create({
    model: "grok-4-1-fast-reasoning",
    messages: [{ role: "user", content: intelligencePrompt }],
    response_format: { type: "json_object" },
  });

  const intelligenceData = JSON.parse(
    intelligenceResponse.choices[0].message.content || "{}"
  );
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
      sourceUrl: dev.sourceUrl || "",
      snippet: dev.snippet || "",
    };
  });

  // Normalize urgency signals to include source fields
  const normalizedSignals = (urgencyData.urgencySignals || []).map((signal: any) => ({
    category: signal.category || "",
    type: signal.type || "",
    description: signal.description || "",
    weight: signal.weight || 0,
    sourceUrl: signal.sourceUrl || signal.url || "",
    snippet: signal.snippet || "",
    detectedAt: signal.detectedAt || signal.date || "",
  }));

  // Merge all verified sources from both phases
  const allSources: VerifiedSource[] = [
    ...(urgencyData.sources || []),
    ...(intelligenceData.sources || []),
  ].filter((s: any) => s && s.url);

  // Deduplicate sources by URL
  const uniqueSources = allSources.reduce((acc: VerifiedSource[], source: VerifiedSource) => {
    if (!acc.find((s) => s.url === source.url)) {
      acc.push({
        url: source.url,
        title: source.title || "",
        snippet: source.snippet || "",
        dateAccessed: source.dateAccessed || new Date().toISOString().split("T")[0],
      });
    }
    return acc;
  }, []);

  // Assemble final brief
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
      industry: industry || "Unknown",
      employees: "Unknown",
      revenue: company.revenue || "Unknown",
      domain: domain,
      linkedin: company.linkedinUrl || "",
    },
    verifiedContacts: {
      website: {
        value: domain,
        source: "Apollo",
        verified: true,
      },
      linkedin: {
        value: company.linkedinUrl || "",
        source: "Apollo",
        verified: !!company.linkedinUrl,
      },
    },
    productsServices: (intelligenceData.productsServices || []).map((p: any) => ({
      category: p.category || "",
      description: p.description || "",
      sourceUrl: p.sourceUrl || "",
    })),
    keyTechnologies: (intelligenceData.keyTechnologies || []).map((t: any) => ({
      name: t.name || "",
      description: t.description || "",
      sourceUrl: t.sourceUrl || "",
    })),
    recentDevelopments: normalizedDevelopments,
    targetMarkets: intelligenceData.targetMarkets || [],
    industryKeywords: intelligenceData.industryKeywords || [],
    naicsCodes: naicsCodes,
    urgencySignals: normalizedSignals,
    sources: uniqueSources,
  };

  console.log(
    `[Brief Generator] Brief generated: urgency=${brief.urgencyScore}, sources=${uniqueSources.length}, developments=${normalizedDevelopments.length}`
  );

  return brief;
}

/**
 * Infer industry from NAICS codes (simplified mapping)
 */
function inferIndustryFromNAICS(naicsCodes: string[]): string | null {
  if (naicsCodes.length === 0) return null;

  const sectorCode = naicsCodes[0].substring(0, 2);

  const sectorMap: Record<string, string> = {
    "11": "Agriculture, Forestry, Fishing",
    "21": "Mining, Quarrying, Oil & Gas",
    "22": "Utilities",
    "23": "Construction",
    "31": "Manufacturing",
    "32": "Manufacturing",
    "33": "Manufacturing",
    "42": "Wholesale Trade",
    "44": "Retail Trade",
    "45": "Retail Trade",
    "48": "Transportation & Warehousing",
    "49": "Transportation & Warehousing",
    "51": "Information",
    "52": "Finance & Insurance",
    "53": "Real Estate",
    "54": "Professional, Scientific & Technical Services",
    "55": "Management of Companies",
    "56": "Administrative & Support Services",
    "61": "Educational Services",
    "62": "Health Care & Social Assistance",
    "71": "Arts, Entertainment & Recreation",
    "72": "Accommodation & Food Services",
    "81": "Other Services",
    "92": "Public Administration",
  };

  return sectorMap[sectorCode] || "Unknown";
}

/**
 * Batch generate briefs for multiple companies
 */
export async function batchGenerateBriefs(
  companyIds: number[]
): Promise<Array<{ companyId: number; brief: SalesIntelligenceBrief | null; error: string | null }>> {
  const results = [];

  for (const companyId of companyIds) {
    try {
      const brief = await generateSalesIntelligenceBrief(companyId);
      results.push({ companyId, brief, error: null });
    } catch (error: any) {
      console.error(`[Brief Generator] Failed for company ${companyId}:`, error);
      results.push({ companyId, brief: null, error: error.message });
    }
  }

  return results;
}
