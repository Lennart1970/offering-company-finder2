/**
 * Sales Intelligence Brief Generator
 * 
 * Generates comprehensive sales briefs using xAI Grok API for:
 * - Urgency detection (recent developments, growth signals)
 * - Company intelligence (products, technologies, target markets)
 * - Engagement strategy generation
 */

import OpenAI from "openai";
import { getCompanyById } from "./db";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

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
  }>;
  keyTechnologies: Array<{
    name: string;
    description: string;
  }>;
  recentDevelopments: string[];
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
    source: string;
    url: string;
    detectedAt: string;
  }>;
  conversationStarters: string[];
  engagementStrategy: {
    whyThisProspectMatters: string[];
    recommendedApproach: string[];
    keyTalkingPoints: string[];
  };
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

  // Phase 1: Detect urgency signals
  console.log(`[Brief Generator] Phase 1: Detecting urgency signals...`);
  const urgencyPrompt = `You are a B2B sales intelligence analyst. Analyze the company "${company.name}" (${domain}) to detect urgency signals for potential EMS/electronics manufacturing partnerships.

Use web search to find recent developments (2024-2025) including:
- Expansion plans or new facilities
- Product launches or R&D announcements
- Hiring trends (especially engineering/manufacturing roles)
- Partnerships or acquisitions
- Funding rounds or financial growth

Score urgency 0-100 based on:
- Company Context (0-40): Growth stage, financial health, industry momentum
- Market Signals (0-35): Competitive pressure, market expansion, technology shifts
- Recent Activity (0-25): Hiring, announcements, news mentions in past 6 months

Return JSON only:
{
  "urgencyScore": 45,
  "urgencyBreakdown": {
    "companyContext": 20,
    "marketSignals": 15,
    "recentActivity": 10
  },
  "recentDevelopments": ["2025: Launched new product line...", "2024: Expanded to APAC..."],
  "urgencySignals": [
    {
      "category": "Growth",
      "type": "Product Launch",
      "description": "Launched new IoT sensor line in Q1 2025",
      "weight": 8,
      "source": "Company press release",
      "url": "https://example.com/news",
      "detectedAt": "2025-01-15"
    }
  ]
}`;

  const urgencyResponse = await xai.chat.completions.create({
    model: "grok-2-1212",
    messages: [{ role: "user", content: urgencyPrompt }],
    response_format: { type: "json_object" },
  });

  const urgencyData = JSON.parse(
    urgencyResponse.choices[0].message.content || "{}"
  );
  console.log(`[Brief Generator] Urgency score: ${urgencyData.urgencyScore}`);

  // Phase 2: Gather company intelligence
  console.log(`[Brief Generator] Phase 2: Gathering company intelligence...`);
  const intelligencePrompt = `You are a B2B sales intelligence analyst. Research "${company.name}" (${domain}) to gather detailed company intelligence for an EMS sales approach.

Use web search to find:
1. Products & Services (categorized)
2. Key Technologies used
3. Target Markets/Industries they serve
4. Industry keywords (50+ terms)

Return JSON only:
{
  "productsServices": [
    {"category": "IoT Devices", "description": "Smart home sensors and gateways"},
    {"category": "Medical Devices", "description": "Diagnostic equipment"}
  ],
  "keyTechnologies": [
    {"name": "IoT", "description": "Internet of Things connectivity"},
    {"name": "Bluetooth LE", "description": "Low-energy wireless communication"}
  ],
  "targetMarkets": [
    {"segment": "Smart Home", "description": "Residential automation systems"},
    {"segment": "Healthcare", "description": "Medical diagnostic equipment"}
  ],
  "industryKeywords": ["IoT", "sensors", "wireless", "embedded systems", "PCB", "electronics", ...]
}`;

  const intelligenceResponse = await xai.chat.completions.create({
    model: "grok-2-1212",
    messages: [{ role: "user", content: intelligencePrompt }],
    response_format: { type: "json_object" },
  });

  const intelligenceData = JSON.parse(
    intelligenceResponse.choices[0].message.content || "{}"
  );
  console.log(
    `[Brief Generator] Found ${intelligenceData.productsServices?.length || 0} product categories`
  );

  // Phase 3: Generate conversation starters
  console.log(`[Brief Generator] Phase 3: Generating conversation starters...`);
  const conversationPrompt = `Based on these recent developments for "${company.name}":
${urgencyData.recentDevelopments?.join("\n") || "No recent developments found"}

Generate 3 specific conversation starters that reference these developments and position ConnectGroup's EMS capabilities (PCB assembly, cable assembly, module building, design-to-product).

Return JSON only:
{
  "conversationStarters": [
    "I saw that you recently launched X - are you evaluating manufacturing partners to scale production?",
    "Noticed your expansion into Y market - how are you handling the increased PCB assembly demands?",
    "Your recent Z announcement suggests growth - are you looking to optimize your supply chain for faster time-to-market?"
  ]
}`;

  const conversationResponse = await xai.chat.completions.create({
    model: "grok-2-1212",
    messages: [{ role: "user", content: conversationPrompt }],
    response_format: { type: "json_object" },
  });

  const conversationData = JSON.parse(
    conversationResponse.choices[0].message.content || "{}"
  );
  console.log(
    `[Brief Generator] Generated ${conversationData.conversationStarters?.length || 0} conversation starters`
  );

  // Phase 4: Generate engagement strategy
  console.log(`[Brief Generator] Phase 4: Generating engagement strategy...`);
  const strategyPrompt = `You are a B2B sales strategist. Based on this intelligence for "${company.name}":

Urgency Score: ${urgencyData.urgencyScore}/100
Products: ${intelligenceData.productsServices?.map((p: any) => p.category).join(", ")}
Technologies: ${intelligenceData.keyTechnologies?.map((t: any) => t.name).join(", ")}
Recent Developments: ${urgencyData.recentDevelopments?.join("; ")}

Generate an engagement strategy for ConnectGroup (EMS provider: PCB assembly, cable assembly, module building, design-to-product) to approach this prospect.

Return JSON only:
{
  "whyThisProspectMatters": [
    "Strong fit with ConnectGroup's IoT manufacturing capabilities",
    "Growing market presence indicates scaling needs",
    "Technology stack aligns with our expertise"
  ],
  "recommendedApproach": [
    "Lead with design-to-product capabilities for their IoT expansion",
    "Highlight our experience in similar smart home projects",
    "Emphasize fast time-to-market and supply chain optimization"
  ],
  "keyTalkingPoints": [
    "Our PCB assembly capabilities support complex IoT designs",
    "We've helped similar companies scale from prototype to production",
    "Our cable assembly expertise can streamline their manufacturing"
  ]
}`;

  const strategyResponse = await xai.chat.completions.create({
    model: "grok-2-1212",
    messages: [{ role: "user", content: strategyPrompt }],
    response_format: { type: "json_object" },
  });

  const strategyData = JSON.parse(
    strategyResponse.choices[0].message.content || "{}"
  );
  console.log(`[Brief Generator] Generated engagement strategy`);

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
      employees: "Unknown", // Employee count not stored in schema
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
    productsServices: intelligenceData.productsServices || [],
    keyTechnologies: intelligenceData.keyTechnologies || [],
    recentDevelopments: urgencyData.recentDevelopments || [],
    targetMarkets: intelligenceData.targetMarkets || [],
    industryKeywords: intelligenceData.industryKeywords || [],
    naicsCodes: naicsCodes,
    urgencySignals: urgencyData.urgencySignals || [],
    conversationStarters: conversationData.conversationStarters || [],
    engagementStrategy: {
      whyThisProspectMatters: strategyData.whyThisProspectMatters || [],
      recommendedApproach: strategyData.recommendedApproach || [],
      keyTalkingPoints: strategyData.keyTalkingPoints || [],
    },
  };

  console.log(
    `[Brief Generator] ✓ Brief generated with urgency score: ${brief.urgencyScore}`
  );

  return brief;
}

/**
 * Infer industry from NAICS codes (simplified mapping)
 */
function inferIndustryFromNAICS(naicsCodes: string[]): string | null {
  if (naicsCodes.length === 0) return null;

  // Get the first 2-digit sector code
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
