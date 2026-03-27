/**
 * Company Type Classifier
 *
 * Deterministic classifier that splits companies into "Manufacturing" vs "Service"
 * based on the industry field from Apollo metadata (stored in sliceMetadata).
 *
 * Used as a pre-split step before niche clustering so that manufacturing and
 * service companies are clustered independently — preventing mixed niches.
 *
 * Classification rules:
 * 1. Check industry field against known manufacturing/service industry lists
 * 2. If industry is ambiguous or missing, check SIC codes (20-39 = Manufacturing)
 * 3. If still unclear, default to "Service" (safer assumption for IT-heavy datasets)
 */

import type { Company } from "../drizzle/schema";

export type CompanyType = "manufacturing" | "service";

/**
 * Industries that are clearly manufacturing/production-oriented.
 * Matched case-insensitively against the Apollo industry field.
 */
const MANUFACTURING_INDUSTRIES = new Set([
  "electrical/electronic manufacturing",
  "food production",
  "building materials",
  "machinery",
  "medical devices",
  "glass, ceramics & concrete",
  "automotive",
  "semiconductors",
  "plastics",
  "textiles",
  "printing",
  "furniture",
  "mining & metals",
  "chemicals",
  "paper & forest products",
  "packaging & containers",
  "industrial automation",
  "mechanical or industrial engineering",
  "shipbuilding",
  "railroad manufacture",
  "renewables & environment",
  "oil & energy",
  "food & beverages",
  "dairy",
  "wine and spirits",
  "tobacco",
  "cosmetics",
  "sporting goods",
  "consumer goods",
  "consumer electronics",
  "computer hardware",
  "defense & space",
  "aviation & aerospace",
]);

/**
 * Industries that are clearly service-oriented.
 * Matched case-insensitively against the Apollo industry field.
 */
const SERVICE_INDUSTRIES = new Set([
  "information technology & services",
  "information services",
  "computer & network security",
  "computer software",
  "computer networking",
  "computer games",
  "internet",
  "wireless",
  "telecommunications",
  "management consulting",
  "outsourcing/offshoring",
  "logistics & supply chain",
  "hospital & health care",
  "medical practice",
  "health, wellness & fitness",
  "real estate",
  "construction",
  "civil engineering",
  "architecture & planning",
  "financial services",
  "banking",
  "insurance",
  "accounting",
  "legal services",
  "law practice",
  "staffing & recruiting",
  "human resources",
  "marketing & advertising",
  "public relations & communications",
  "media production",
  "broadcast media",
  "entertainment",
  "music",
  "performing arts",
  "education management",
  "higher education",
  "e-learning",
  "research",
  "think tanks",
  "government administration",
  "nonprofit organization management",
  "philanthropy",
  "religious institutions",
  "wholesale",
  "retail",
  "restaurants",
  "hospitality",
  "leisure, travel & tourism",
  "airlines/aviation",
  "transportation/trucking/railroad",
  "warehousing",
  "utilities",
  "environmental services",
  "events services",
  "design",
  "graphic design",
  "photography",
  "writing & editing",
  "translation & localization",
  "security & investigations",
  "facilities services",
  "professional training & coaching",
  "program development",
  "venture capital & private equity",
  "investment management",
  "capital markets",
  "import & export",
]);

/**
 * SIC code ranges that indicate manufacturing.
 * SIC Division D: Manufacturing = codes 2000-3999 (2-digit: 20-39)
 */
function isMfgSicCode(sicCode: string): boolean {
  const numeric = parseInt(sicCode.replace(/\D/g, ""), 10);
  if (isNaN(numeric)) return false;
  // 2-digit check
  if (numeric >= 20 && numeric <= 39) return true;
  // 4-digit check
  if (numeric >= 2000 && numeric <= 3999) return true;
  return false;
}

/**
 * Classify a single company as "manufacturing" or "service".
 */
export function classifyCompanyType(company: Company): CompanyType {
  // 1. Check industry field
  let industry = "";
  if (company.sliceMetadata) {
    try {
      const meta = JSON.parse(company.sliceMetadata) as { industry?: string };
      industry = (meta.industry || "").toLowerCase().trim();
    } catch {
      // ignore
    }
  }

  if (industry) {
    if (MANUFACTURING_INDUSTRIES.has(industry)) return "manufacturing";
    if (SERVICE_INDUSTRIES.has(industry)) return "service";

    // Fuzzy match: check if industry contains key manufacturing terms
    const mfgTerms = ["manufactur", "production", "fabricat", "assembl", "machining", "foundry", "smelting", "refining", "processing"];
    for (const term of mfgTerms) {
      if (industry.includes(term)) return "manufacturing";
    }
  }

  // 2. Check SIC codes
  if (company.sicCodes) {
    try {
      const codes = JSON.parse(company.sicCodes) as string[];
      const mfgCount = codes.filter(isMfgSicCode).length;
      if (mfgCount > codes.length / 2) return "manufacturing";
      if (mfgCount === 0 && codes.length > 0) return "service";
    } catch {
      // ignore
    }
  }

  // 3. Default: service (safer for IT-heavy datasets)
  return "service";
}

/**
 * Split a list of companies into manufacturing and service groups.
 * Returns both groups with their classifications.
 */
export function splitByCompanyType(
  allCompanies: Company[]
): { manufacturing: Company[]; service: Company[] } {
  const manufacturing: Company[] = [];
  const service: Company[] = [];

  for (const company of allCompanies) {
    const type = classifyCompanyType(company);
    if (type === "manufacturing") {
      manufacturing.push(company);
    } else {
      service.push(company);
    }
  }

  console.log(
    `[CompanyTypeClassifier] Split ${allCompanies.length} companies: ` +
    `${manufacturing.length} manufacturing (${((manufacturing.length / allCompanies.length) * 100).toFixed(1)}%), ` +
    `${service.length} service (${((service.length / allCompanies.length) * 100).toFixed(1)}%)`
  );

  return { manufacturing, service };
}
