import { US_STATES } from "./usStates";
import { selectIndustryCodes } from "./codeSelectionService";
import { confirmAndSearch } from "./confirmAndSearch";
import { createSearch } from "./db";

/**
 * Progress tracking for national scan
 */
let scanProgress = {
  isRunning: false,
  currentState: "",
  currentStateIndex: 0,
  totalStates: 50,
  totalCompaniesFound: 0,
  completedStates: [] as string[],
  failedStates: [] as Array<{ state: string; error: string }>,
  startedAt: null as Date | null,
  estimatedCompletionAt: null as Date | null,
};

/**
 * Get current scan progress
 */
export function getNationalScanProgress() {
  return { ...scanProgress };
}

/**
 * Run a national scan across all 50 US states
 * Only retrieves companies (no Deep Research)
 * @param userId - User ID to associate searches with
 * @param testMode - If true, only run 3 states (Delaware, Rhode Island, Vermont) for testing
 */
export async function runNationalScan(userId: number, testMode = false) {
  if (scanProgress.isRunning) {
    throw new Error("A national scan is already running");
  }

  // Select states to scan
  const statesToScan = testMode 
    ? ["Delaware", "Rhode Island", "Vermont"] 
    : US_STATES;

  // Reset progress
  scanProgress = {
    isRunning: true,
    currentState: "",
    currentStateIndex: 0,
    totalStates: statesToScan.length,
    totalCompaniesFound: 0,
    completedStates: [],
    failedStates: [],
    startedAt: new Date(),
    estimatedCompletionAt: null,
  };

  console.log(`[National Scan] Starting ${testMode ? 'TEST' : 'FULL'} scan for ${statesToScan.length} states`);

  // ConnectGroup offering (same as used in startSearch)
  const connectGroupOffering = {
    name: "Electronics Manufacturing Services (EMS) - PCB Assembly, Cable Assembly & Module Building",
    description: "ConnectGroup is a full-service EMS subcontractor providing PCB assembly, cable assembly (from complex harnesses to automated large-scale), and module building (integration of cables, electronics, and mechanics). With 33 years of industrial experience and 9 locations across 8 countries, they support companies from design to successful product with focus on efficiency, quality, and shorter time-to-market.",
    targetMarket: "Railway • Healthcare/MedTech • Infrastructure • Automotive & Off-road • Defense & Avionics • Industrial Manufacturing • Electronics • Telecommunications • Energy • Automation • Instrumentation • Aerospace • Marine • Agricultural Equipment • Construction Equipment • Mining • Oil & Gas • Renewable Energy • IoT • Embedded Systems",
    keywords: ["ems", "electronics manufacturing", "pcb assembly", "cable assembly", "module building", "industrial", "railway", "healthcare", "automotive", "defense"],
    targetMarketKeywordTags: [
      "railway",
      "rail",
      "medical devices",
      "healthcare",
      "automotive",
      "off-road",
      "defense",
      "avionics",
      "infrastructure",
      "industrial",
      "manufacturing",
      "electronics",
      "telecommunications",
      "energy",
      "power systems",
      "automation",
      "instrumentation",
      "measurement",
      "control systems",
      "process control",
      "robotics",
      "aerospace",
      "marine",
      "agricultural equipment",
      "construction equipment",
      "mining",
      "oil and gas",
      "renewable energy",
      "smart grid",
      "iot",
      "industrial iot",
      "embedded systems",
      "electrical equipment"
    ],
  };

  // STEP 1: Select industry codes once (reuse for all states)
  console.log(`[National Scan] Selecting industry codes (one time)`);
  const codeSelection = await selectIndustryCodes({
    offeringName: connectGroupOffering.name,
    offeringDescription: connectGroupOffering.description,
    targetMarket: connectGroupOffering.targetMarket,
    valueProposition: "Full-service EMS with 33 years experience, 9 global locations, design-to-product support",
  });

  console.log(`[National Scan] Selected ${codeSelection.sicCodes.length} SIC codes and ${codeSelection.naicsCodes.length} NAICS codes`);

  // STEP 2: Loop through selected states
  for (let i = 0; i < statesToScan.length; i++) {
    const state = statesToScan[i];
    scanProgress.currentState = state;
    scanProgress.currentStateIndex = i + 1;

    console.log(`[National Scan] Processing state ${i + 1}/${statesToScan.length}: ${state}`);

    try {
      // Create a search for this state
      const searchId = await createSearch({
        userId,
        companyWebsite: "https://www.connectgroup.com/en/",
        location: state, // Just the state name
        status: "searching", // Skip code_targeting review
        offeringName: connectGroupOffering.name,
        offeringDescription: connectGroupOffering.description,
        targetMarket: connectGroupOffering.targetMarket,
        keywords: JSON.stringify(connectGroupOffering.keywords),
        keywordTagsUsed: JSON.stringify(connectGroupOffering.targetMarketKeywordTags),
        selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
        selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
        codeSelectionReasoning: codeSelection.reasoning,
        excludedSectors: JSON.stringify([]), // No exclusions for national scan
      });

      console.log(`[National Scan] Created search ${searchId} for ${state}`);

      // Run the search (this will call Apollo and store companies)
      await confirmAndSearch({ searchId, location: state });

      // Get company count from database
      const { getCompaniesBySearchId } = await import("./db");
      const companies = await getCompaniesBySearchId(searchId);
      const companiesFound = companies.length;

      scanProgress.totalCompaniesFound += companiesFound;
      scanProgress.completedStates.push(state);

      console.log(`[National Scan] ${state}: Found ${companiesFound} companies (total so far: ${scanProgress.totalCompaniesFound})`);

    } catch (error: any) {
      console.error(`[National Scan] Failed to process ${state}:`, error.message);
      scanProgress.failedStates.push({
        state,
        error: error.message,
      });
      // Continue to next state even if this one failed
    }

    // Estimate completion time based on progress
    if (i > 0) {
      const elapsed = Date.now() - scanProgress.startedAt!.getTime();
      const avgTimePerState = elapsed / (i + 1);
      const remainingStates = statesToScan.length - (i + 1);
      const estimatedRemainingTime = avgTimePerState * remainingStates;
      scanProgress.estimatedCompletionAt = new Date(Date.now() + estimatedRemainingTime);
    }
  }

  // Mark as complete
  scanProgress.isRunning = false;
  scanProgress.currentState = testMode ? "Test Complete" : "Complete";

  console.log(`[National Scan] ${testMode ? 'Test' : 'Full scan'} completed! Total companies: ${scanProgress.totalCompaniesFound}`);
  console.log(`[National Scan] Successful states: ${scanProgress.completedStates.length}`);
  console.log(`[National Scan] Failed states: ${scanProgress.failedStates.length}`);

  return {
    success: true,
    testMode,
    totalCompanies: scanProgress.totalCompaniesFound,
    completedStates: scanProgress.completedStates.length,
    failedStates: scanProgress.failedStates.length,
    failedStatesList: scanProgress.failedStates,
  };
}
