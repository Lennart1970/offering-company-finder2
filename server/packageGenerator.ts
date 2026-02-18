import axios from "axios";

export interface SalesIntelligencePackage {
  companyName: string;
  quickFacts: {
    employees: string;
    revenue: string;
    foundingYear: string;
    headquarters: string;
    website: string;
  };
  businessOverview: string;
  productsAndServices: string;
  keyTechnologies: string;
  recentDevelopments: string;
  targetMarkets: string;
  connectGroupStrategy: string;
  talkingPoints: string[];
}

/**
 * Generate a comprehensive sales intelligence package for a company using Grok API
 */
export async function generateSalesPackage(
  companyName: string,
  companyWebsite: string,
  companyData: {
    revenue?: string;
    employees?: string;
    foundedYear?: number;
    city?: string;
    state?: string;
    country?: string;
    sicCodes?: string[];
    naicsCodes?: string[];
  }
): Promise<SalesIntelligencePackage> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable is not set");
  }

  const prompt = `You are a B2B sales intelligence analyst creating a comprehensive sales brief for Connect Group's sales team.

**Company to Research:** ${companyName}
**Website:** ${companyWebsite}
**Known Data:**
- Revenue: ${companyData.revenue || "Unknown"}
- Employees: ${companyData.employees || "Unknown"}
- Founded: ${companyData.foundedYear || "Unknown"}
- Location: ${[companyData.city, companyData.state, companyData.country].filter(Boolean).join(", ") || "Unknown"}
- SIC Codes: ${companyData.sicCodes?.join(", ") || "Unknown"}
- NAICS Codes: ${companyData.naicsCodes?.join(", ") || "Unknown"}

**About Connect Group:**
Connect Group is a full-service EMS (Electronics Manufacturing Services) subcontractor providing:
- PCB Assembly (complex, high-reliability electronics)
- Cable Assembly (from complex harnesses to automated large-scale production)
- Module Building (integration of cables, electronics, and mechanics)
- Design-to-Product services through their Technology Center

They serve Railway, Healthcare/MedTech, Infrastructure, Automotive & Off-road, Defense & Avionics, Industrial Manufacturing, Electronics, Telecommunications, Energy, Automation, Instrumentation, Aerospace, Marine, Agricultural Equipment, Construction Equipment, Mining, Oil & Gas, Renewable Energy, IoT, and Embedded Systems sectors.

**Your Task:**
Create a detailed sales intelligence brief in JSON format with the following structure:

{
  "companyName": "${companyName}",
  "quickFacts": {
    "employees": "Number or range of employees",
    "revenue": "Annual revenue or range",
    "foundingYear": "Year founded",
    "headquarters": "City, State/Country",
    "website": "${companyWebsite}"
  },
  "businessOverview": "2-3 paragraph overview of what the company does, their market position, and value proposition. Focus on their core business, competitive advantages, and market presence.",
  "productsAndServices": "Detailed breakdown of their main product lines and service offerings. Be specific about technologies, applications, and market segments they serve.",
  "keyTechnologies": "List of key technologies, capabilities, and technical differentiators. Include manufacturing processes, quality certifications, technical expertise areas.",
  "recentDevelopments": "Recent news, product launches, expansions, partnerships, or strategic initiatives from 2024-2025. If no recent news is available, note that.",
  "targetMarkets": "Description of their target customers, industries served, geographic markets, and business intelligence about their go-to-market strategy.",
  "connectGroupStrategy": "Customized engagement strategy for Connect Group. Explain WHY this company needs EMS services, cable assemblies, or PCB assembly. Identify specific pain points Connect Group can solve (supply chain resilience, quality requirements, regulatory compliance, time-to-market pressure, cost optimization). Be specific about which Connect Group services (PCB assembly, cable assembly, module building) are most relevant.",
  "talkingPoints": [
    "3-5 specific talking points for Connect Group sales team to use when approaching this company. Each should connect a company pain point to a Connect Group capability."
  ]
}

**Research Instructions:**
1. Use web search to gather current information about the company
2. Focus on factual, verifiable information
3. Be specific and actionable - avoid generic statements
4. Tailor the Connect Group strategy to this specific company's needs
5. Return ONLY the JSON object, no additional text

Generate the sales intelligence brief now.`;

  try {
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content: "You are a B2B sales intelligence analyst. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
        temperature: 0.3,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in Grok API response");
    }

    const packageData = JSON.parse(content) as SalesIntelligencePackage;
    return packageData;
  } catch (error: any) {
    console.error("[Package Generator] Grok API error:", error.response?.data || error.message);
    throw new Error(`Failed to generate sales package: ${error.message}`);
  }
}

/**
 * Convert sales package to Markdown format
 */
export function packageToMarkdown(pkg: SalesIntelligencePackage): string {
  return `# Sales Intelligence Brief: ${pkg.companyName}

## Quick Facts

| Metric | Value |
|--------|-------|
| **Employees** | ${pkg.quickFacts.employees} |
| **Revenue** | ${pkg.quickFacts.revenue} |
| **Founded** | ${pkg.quickFacts.foundingYear} |
| **Headquarters** | ${pkg.quickFacts.headquarters} |
| **Website** | ${pkg.quickFacts.website} |

## Business Overview

${pkg.businessOverview}

## Products and Services

${pkg.productsAndServices}

## Key Technologies and Capabilities

${pkg.keyTechnologies}

## Recent Developments (2024-2025)

${pkg.recentDevelopments}

## Target Markets and Business Intelligence

${pkg.targetMarkets}

## Connect Group Engagement Strategy

${pkg.connectGroupStrategy}

## Key Talking Points

${pkg.talkingPoints.map((point, i) => `${i + 1}. ${point}`).join("\n\n")}

---

*Generated by Connect Group Company Finder*
*Data sources: Apollo.io, company website, public records*
`;
}
