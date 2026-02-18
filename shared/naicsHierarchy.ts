/**
 * NAICS Hierarchical Classification System
 * 
 * NAICS is a hierarchical economic behavior map — every extra digit narrows
 * HOW a company makes money, invests, trades, hires, and takes risk.
 * 
 * Structure:
 *   XX      = Sector (macro economy role)
 *   XXX     = Subsector (business function type)
 *   XXXX    = Industry group (production style)
 *   XXXXX   = Industry (market niche)
 *   XXXXXX  = National specialization
 */

export type NaicsLevel = "sector" | "subsector" | "industry_group" | "industry" | "national";

export interface NaicsBreakdown {
  sector: string;        // 2-digit
  subsector: string;     // 3-digit
  industryGroup: string; // 4-digit
  industry: string;      // 5-digit
  national: string;      // 6-digit (full code)
  sectorLabel: string;   // Human-readable sector name
}

/** The 20 NAICS sectors — a modern economy map */
export const NAICS_SECTORS: Record<string, string> = {
  "11": "Agriculture, Forestry, Fishing & Hunting",
  "21": "Mining, Quarrying & Oil/Gas Extraction",
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
  "51": "Information (Data/Media/Software)",
  "52": "Finance & Insurance",
  "53": "Real Estate & Rental/Leasing",
  "54": "Professional, Scientific & Technical Services",
  "55": "Management of Companies & Enterprises",
  "56": "Administrative & Support Services",
  "61": "Educational Services",
  "62": "Health Care & Social Assistance",
  "71": "Arts, Entertainment & Recreation",
  "72": "Accommodation & Food Services",
  "81": "Other Services",
  "92": "Public Administration",
};

/** Operational reality labels — what each sector REALLY represents */
export const NAICS_SECTOR_REALITY: Record<string, string> = {
  "11": "Resource extraction & cultivation",
  "21": "Raw materials",
  "22": "Infrastructure utilities",
  "23": "Built environment",
  "31": "Physical production",
  "32": "Physical production",
  "33": "Physical production",
  "42": "B2B distribution",
  "44": "Consumer trade",
  "45": "Consumer trade",
  "48": "Logistics",
  "49": "Logistics",
  "51": "Data/media/software",
  "52": "Money & risk",
  "53": "Assets",
  "54": "Knowledge work",
  "55": "Holding/control",
  "56": "Operational services",
  "61": "Human capital",
  "62": "Care economy",
  "71": "Experience economy",
  "72": "Hospitality",
  "81": "Personal & repair",
  "92": "Government",
};

/**
 * Parse a NAICS code into its hierarchical components
 */
export function parseNaicsCode(code: string): NaicsBreakdown {
  const padded = code.padEnd(6, "0");
  const sector = padded.substring(0, 2);
  
  return {
    sector,
    subsector: padded.substring(0, 3),
    industryGroup: padded.substring(0, 4),
    industry: padded.substring(0, 5),
    national: padded,
    sectorLabel: NAICS_SECTORS[sector] || "Unknown",
  };
}

/**
 * Get the sector label for a NAICS code
 */
export function getNaicsSectorLabel(code: string): string {
  const sector = code.substring(0, 2);
  return NAICS_SECTORS[sector] || "Unknown";
}

/**
 * Get the operational reality label for a NAICS code
 */
export function getNaicsRealityLabel(code: string): string {
  const sector = code.substring(0, 2);
  return NAICS_SECTOR_REALITY[sector] || "Unknown";
}

/**
 * Hierarchical NAICS matching — checks if a company's code matches
 * at ANY level of the hierarchy (sector, subsector, industry group, etc.)
 * 
 * This is the key insight: instead of exact 6-digit matching,
 * we match at prefix level. If we select subsector "333" (Machinery),
 * then a company with code "333249" matches because it starts with "333".
 */
export function naicsMatchesHierarchically(
  companyCode: string,
  selectedCodes: string[]
): boolean {
  for (const selected of selectedCodes) {
    // If the selected code is a prefix of the company code, it matches
    // e.g., selected "333" matches company "333249"
    if (companyCode.startsWith(selected)) return true;
    // If the company code is a prefix of the selected code, it also matches
    // e.g., company has "33" and we selected "333249"
    if (selected.startsWith(companyCode)) return true;
  }
  return false;
}

/**
 * SIC hierarchical matching — SIC uses 2-digit major groups and 4-digit specifics
 * SIC structure: XX = Major Group, XXX = Industry Group, XXXX = Industry
 */
export function sicMatchesHierarchically(
  companyCode: string,
  selectedCodes: string[]
): boolean {
  for (const selected of selectedCodes) {
    if (companyCode.startsWith(selected)) return true;
    if (selected.startsWith(companyCode)) return true;
  }
  return false;
}

/**
 * Group NAICS codes by sector for display
 */
export function groupCodesBySector(codes: string[]): Record<string, { label: string; reality: string; codes: string[] }> {
  const grouped: Record<string, { label: string; reality: string; codes: string[] }> = {};
  
  for (const code of codes) {
    const sector = code.substring(0, 2);
    if (!grouped[sector]) {
      grouped[sector] = {
        label: NAICS_SECTORS[sector] || "Unknown",
        reality: NAICS_SECTOR_REALITY[sector] || "Unknown",
        codes: [],
      };
    }
    grouped[sector].codes.push(code);
  }
  
  return grouped;
}

/**
 * Determine the abstraction level of a code based on its length
 */
export function getCodeLevel(code: string): NaicsLevel {
  switch (code.length) {
    case 2: return "sector";
    case 3: return "subsector";
    case 4: return "industry_group";
    case 5: return "industry";
    case 6: return "national";
    default: return "national";
  }
}
