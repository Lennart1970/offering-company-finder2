/**
 * Multi-slice search configuration for comprehensive company discovery
 * 
 * BRAIN-AGNOSTIC: All slices are generated dynamically from the Offering Brain.
 * No hardcoded industries, keywords, or employee ranges.
 * 
 * Strategy: Search across employee bands × industry keywords × keyword sets
 * to maximize coverage of relevant companies
 */

export interface EmployeeBand {
  min: number;
  max: number;
  label: string;
}

export interface KeywordSet {
  name: string;
  keywords: string[];
  description: string;
}

export interface IndustrySlice {
  name: string;
  keywords: string[];
}

/**
 * Default employee bands when brain doesn't specify ICP company size.
 * Covers the typical B2B mid-market range.
 */
export const DEFAULT_EMPLOYEE_BANDS: EmployeeBand[] = [
  { min: 50, max: 200, label: "50-200" },
  { min: 201, max: 500, label: "201-500" },
  { min: 501, max: 1000, label: "501-1000" },
];

/**
 * Parse employee bands from brain's icpCompanySize field.
 * Falls back to DEFAULT_EMPLOYEE_BANDS if parsing fails.
 */
export function parseEmployeeBands(icpCompanySize: string | null | undefined): EmployeeBand[] {
  if (!icpCompanySize) return DEFAULT_EMPLOYEE_BANDS;

  // Try to extract numeric ranges from text like "50-500 employees" or "mid-market (100-1000)"
  const rangeMatch = icpCompanySize.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = parseInt(rangeMatch[2]);
    if (min > 0 && max > min) {
      // Split into 3 bands
      const third = Math.round((max - min) / 3);
      return [
        { min, max: min + third, label: `${min}-${min + third}` },
        { min: min + third + 1, max: min + 2 * third, label: `${min + third + 1}-${min + 2 * third}` },
        { min: min + 2 * third + 1, max, label: `${min + 2 * third + 1}-${max}` },
      ];
    }
  }

  return DEFAULT_EMPLOYEE_BANDS;
}

/**
 * Build industry slices from brain's ICP industries.
 * Each industry becomes a slice with the industry name as keyword.
 */
export function buildIndustrySlices(icpIndustries: string[]): IndustrySlice[] {
  if (!icpIndustries || icpIndustries.length === 0) {
    return [{ name: "General Industry", keywords: ["manufacturing", "technology", "services"] }];
  }

  return icpIndustries.map(industry => ({
    name: industry,
    keywords: [industry.toLowerCase()],
  }));
}

/**
 * Build keyword sets from brain's core capabilities and pain points.
 * Groups capabilities into logical sets for search diversity.
 */
export function buildKeywordSets(
  coreCapabilities: string[],
  icpPainPoints: string[],
  icpBuyingSignals: string[]
): KeywordSet[] {
  const sets: KeywordSet[] = [];

  // Set 1: Core capabilities (always present)
  if (coreCapabilities.length > 0) {
    sets.push({
      name: "Core Capabilities",
      description: "Primary offering capabilities",
      keywords: coreCapabilities.map(c => c.toLowerCase()).slice(0, 7),
    });
  }

  // Set 2: Pain points as search keywords (if available)
  if (icpPainPoints.length > 0) {
    sets.push({
      name: "Pain Points",
      description: "Customer pain points the offering solves",
      keywords: icpPainPoints.map(p => p.toLowerCase()).slice(0, 7),
    });
  }

  // Set 3: Buying signals (if available)
  if (icpBuyingSignals.length > 0) {
    sets.push({
      name: "Buying Signals",
      description: "Signals indicating readiness to buy",
      keywords: icpBuyingSignals.map(s => s.toLowerCase()).slice(0, 7),
    });
  }

  // Fallback: if no sets were created, use a generic one
  if (sets.length === 0) {
    sets.push({
      name: "General",
      description: "General search terms",
      keywords: ["manufacturing", "technology", "services", "solutions"],
    });
  }

  return sets;
}

/**
 * Brain data needed to generate dynamic search slices
 */
export interface BrainSliceConfig {
  icpCompanySize?: string | null;
  icpIndustries: string[];
  coreCapabilities: string[];
  icpPainPoints: string[];
  icpBuyingSignals: string[];
}

/**
 * Generate all search slices dynamically from brain data
 * (employee band × industry × keyword set)
 */
export function generateSearchSlices(brainConfig?: BrainSliceConfig) {
  const employeeBands = brainConfig
    ? parseEmployeeBands(brainConfig.icpCompanySize)
    : DEFAULT_EMPLOYEE_BANDS;

  const industrySlices = brainConfig
    ? buildIndustrySlices(brainConfig.icpIndustries)
    : [{ name: "General Industry", keywords: ["manufacturing", "technology", "services"] }];

  const keywordSets = brainConfig
    ? buildKeywordSets(brainConfig.coreCapabilities, brainConfig.icpPainPoints, brainConfig.icpBuyingSignals)
    : [{ name: "General", description: "General search terms", keywords: ["manufacturing", "technology", "services"] }];

  const slices: Array<{
    employeeBand: EmployeeBand;
    industry: IndustrySlice;
    keywordSet: KeywordSet;
    sliceId: string;
  }> = [];

  for (const employeeBand of employeeBands) {
    for (const industry of industrySlices) {
      for (const keywordSet of keywordSets) {
        slices.push({
          employeeBand,
          industry,
          keywordSet,
          sliceId: `${employeeBand.label}_${industry.name.replace(/\s+/g, "-")}_${keywordSet.name.replace(/\s+/g, "-")}`,
        });
      }
    }
  }

  return slices;
}

/**
 * Get total number of slices for a given brain config
 */
export function getTotalSlices(brainConfig?: BrainSliceConfig): number {
  const employeeBands = brainConfig
    ? parseEmployeeBands(brainConfig.icpCompanySize)
    : DEFAULT_EMPLOYEE_BANDS;

  const industrySlices = brainConfig
    ? buildIndustrySlices(brainConfig.icpIndustries)
    : [{ name: "General Industry", keywords: ["manufacturing", "technology", "services"] }];

  const keywordSets = brainConfig
    ? buildKeywordSets(brainConfig.coreCapabilities, brainConfig.icpPainPoints, brainConfig.icpBuyingSignals)
    : [{ name: "General", description: "General search terms", keywords: ["manufacturing", "technology", "services"] }];

  return employeeBands.length * industrySlices.length * keywordSets.length;
}
