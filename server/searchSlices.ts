/**
 * Multi-slice search configuration for comprehensive company discovery
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
 * Employee bands: 50-1000 FTE (ConnectGroup's target range)
 */
export const EMPLOYEE_BANDS: EmployeeBand[] = [
  { min: 50, max: 200, label: "50-200" },
  { min: 201, max: 500, label: "201-500" },
  { min: 501, max: 1000, label: "501-1000" },
];

/**
 * Industry slices: Target industries for EMS/PCB services
 */
export const INDUSTRY_SLICES: IndustrySlice[] = [
  {
    name: "Electronics Manufacturing",
    keywords: ["electronics manufacturing", "electrical manufacturing", "pcb manufacturing"],
  },
  {
    name: "Industrial Automation",
    keywords: ["industrial automation", "automation equipment", "control systems"],
  },
  {
    name: "Automotive Suppliers",
    keywords: ["automotive supplier", "automotive electronics", "vehicle electronics"],
  },
  {
    name: "Medical Devices",
    keywords: ["medical devices", "medical equipment", "healthcare technology"],
  },
  {
    name: "Aerospace & Defense",
    keywords: ["aerospace", "defense", "avionics"],
  },
  {
    name: "Hardware & Embedded",
    keywords: ["hardware", "embedded systems", "iot devices"],
  },
  {
    name: "Renewable Energy",
    keywords: ["renewable energy", "solar", "wind energy", "energy storage"],
  },
];

/**
 * Keyword sets: Different aspects of EMS/PCB complexity
 */
export const KEYWORD_SETS: KeywordSet[] = [
  {
    name: "Core EMS/PCB",
    description: "Core electronics manufacturing services",
    keywords: [
      "pcb",
      "pcba",
      "smt",
      "electronics assembly",
      "contract manufacturing",
      "ems",
      "box build",
    ],
  },
  {
    name: "Complexity & Production",
    description: "High-mix, low-volume complexity indicators",
    keywords: [
      "npi",
      "high mix low volume",
      "low volume high mix",
      "dfm",
      "conformal coating",
      "cable assembly",
      "harness",
    ],
  },
  {
    name: "Embedded & Hardware",
    description: "Embedded systems and hardware signals",
    keywords: [
      "embedded",
      "firmware",
      "sensor",
      "iot",
      "robotics",
      "motion control",
      "industrial pc",
    ],
  },
];

/**
 * Generate all search slices (employee band × industry × keyword set)
 */
export function generateSearchSlices() {
  const slices: Array<{
    employeeBand: EmployeeBand;
    industry: IndustrySlice;
    keywordSet: KeywordSet;
    sliceId: string;
  }> = [];

  for (const employeeBand of EMPLOYEE_BANDS) {
    for (const industry of INDUSTRY_SLICES) {
      for (const keywordSet of KEYWORD_SETS) {
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
 * Get total number of slices
 */
export function getTotalSlices(): number {
  return EMPLOYEE_BANDS.length * INDUSTRY_SLICES.length * KEYWORD_SETS.length;
}
