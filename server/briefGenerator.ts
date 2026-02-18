/**
 * Sales Intelligence Brief Generator
 * 
 * Generates comprehensive sales briefs using Grok MCP for:
 * - Urgency detection (recent developments, growth signals)
 * - Company intelligence (products, technologies, target markets)
 * - Engagement strategy generation
 */

import { exec } from "child_process";
import { promisify } from "util";
import { getCompanyById } from "./db";

const execAsync = promisify(exec);

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

  // Parse NAICS codes
  const naicsCodes = company.naicsCodes ? JSON.parse(company.naicsCodes) : [];

  // Build command
  const scriptPath = "/home/ubuntu/offering-company-finder/python_scripts/generate_sales_brief.py";
  const args = [
    `"${company.name}"`,
    `"${company.primaryDomain || company.websiteUrl || "unknown.com"}"`,
  ];

  if (company.linkedinUrl) {
    args.push(`--linkedin "${company.linkedinUrl}"`);
  }

  // Try to infer industry from NAICS codes (simplified)
  const industry = inferIndustryFromNAICS(naicsCodes);
  if (industry) {
    args.push(`--industry "${industry}"`);
  }

  // Add employee count (estimate from revenue or use placeholder)
  const employeeCount = estimateEmployeeCount(company.revenue);
  if (employeeCount) {
    args.push(`--size ${employeeCount}`);
  }

  if (company.revenue) {
    args.push(`--revenue "${company.revenue}"`);
  }

  if (naicsCodes.length > 0) {
    args.push(`--naics ${naicsCodes.join(" ")}`);
  }

  const command = `python3 ${scriptPath} ${args.join(" ")}`;

  console.log(`[Brief Generator] Executing: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      timeout: 300000, // 5 minute timeout
    });

    if (stderr) {
      console.error(`[Brief Generator] Stderr: ${stderr}`);
    }

    // Parse JSON output from Python script
    const brief: SalesIntelligenceBrief = JSON.parse(stdout);

    console.log(
      `[Brief Generator] ✓ Brief generated with urgency score: ${brief.urgencyScore}`
    );

    return brief;
  } catch (error: any) {
    console.error(`[Brief Generator] Error:`, error);
    throw new Error(`Failed to generate brief: ${error.message}`);
  }
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
 * Estimate employee count from revenue (rough heuristic)
 */
function estimateEmployeeCount(revenue: string | null): number | null {
  if (!revenue) return null;

  // Parse revenue string (e.g., "$10M-50M", "$100M+")
  const match = revenue.match(/\$(\d+)([MBK])/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toUpperCase();

  let revenueInMillions = 0;
  if (unit === "K") {
    revenueInMillions = value / 1000;
  } else if (unit === "M") {
    revenueInMillions = value;
  } else if (unit === "B") {
    revenueInMillions = value * 1000;
  }

  // Rough heuristic: $200K revenue per employee
  const estimatedEmployees = Math.round((revenueInMillions * 1000000) / 200000);

  return estimatedEmployees > 0 ? estimatedEmployees : null;
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
