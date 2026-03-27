import { US_STATES } from "./usStates";
import { selectIndustryCodes } from "./codeSelectionService";
import { confirmAndSearch } from "./confirmAndSearch";
import { createSearch, getActiveBrain } from "./db";

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
  shouldStop: false, // Flag to signal scan should stop
};

/**
 * Get current scan progress
 */
export function getNationalScanProgress() {
  return { ...scanProgress };
}

/**
 * Stop the currently running national scan
 */
export function stopNationalScan() {
  if (!scanProgress.isRunning) {
    throw new Error("No scan is currently running");
  }
  
  scanProgress.shouldStop = true;
  console.log("[National Scan] Stop requested by user");
  
  return {
    success: true,
    message: "Scan will stop after completing the current state",
  };
}

/**
 * Run a national scan across all 50 US states
 * BRAIN-AGNOSTIC: Loads offering data from the active Offering Brain.
 * @param userId - User ID to associate searches with
 * @param testMode - If true, only run 2 states (Delaware, Rhode Island) for testing
 * @param customStates - Optional array of specific states to scan (overrides testMode)
 */
export async function runNationalScan(userId: number, testMode = false, customStates?: string[]) {
  if (scanProgress.isRunning) {
    throw new Error("A national scan is already running");
  }

  // Load the active Offering Brain
  const brain = await getActiveBrain(userId);
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Offering Brain found. Please create one first on the Brain page.");
  }

  // Build offering data dynamically from the brain
  const coreCapabilities: string[] = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
  const icpIndustries: string[] = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const valuePropositions: Array<{ audience: string; value: string }> = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];

  const brainOffering = {
    name: brain.offeringSummary || brain.brainName,
    description: `${brain.companyName}: ${brain.offeringSummary || ""} ${brain.competitiveAdvantages || ""}`.trim(),
    targetMarket: icpIndustries.join(" • ") || "General B2B",
    keywords: coreCapabilities.slice(0, 10),
    targetMarketKeywordTags: [
      ...icpIndustries.map(i => i.toLowerCase()),
      ...coreCapabilities.map(c => c.toLowerCase()),
    ].slice(0, 40),
  };

  const vpSummary = valuePropositions.map(vp => vp.value).join("; ") || brain.competitiveAdvantages || "";

  // Select states to scan
  const statesToScan = customStates 
    ? customStates
    : testMode 
    ? ["Delaware", "Rhode Island"] 
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
    shouldStop: false,
  };

  console.log(`[National Scan] Starting ${testMode ? 'TEST' : 'FULL'} scan for ${statesToScan.length} states`);
  console.log(`[National Scan] Using brain: ${brain.brainName} (${brain.companyName})`);

  // STEP 1: Select industry codes once (reuse for all states)
  console.log(`[National Scan] Selecting industry codes (one time)`);
  const codeSelection = await selectIndustryCodes({
    offeringName: brainOffering.name,
    offeringDescription: brainOffering.description,
    targetMarket: brainOffering.targetMarket,
    valueProposition: vpSummary,
  });

  console.log(`[National Scan] Selected ${codeSelection.sicCodes.length} SIC codes and ${codeSelection.naicsCodes.length} NAICS codes`);

  // STEP 2: Loop through selected states
  for (let i = 0; i < statesToScan.length; i++) {
    // Check if stop was requested
    if (scanProgress.shouldStop) {
      console.log(`[National Scan] Stop requested, terminating scan after ${i} states`);
      scanProgress.isRunning = false;
      scanProgress.currentState = "Stopped by user";
      scanProgress.shouldStop = false; // Reset flag
      return {
        success: true,
        stopped: true,
        testMode,
        totalCompanies: scanProgress.totalCompaniesFound,
        completedStates: scanProgress.completedStates.length,
        failedStates: scanProgress.failedStates.length,
        failedStatesList: scanProgress.failedStates,
      };
    }

    const state = statesToScan[i];
    scanProgress.currentState = state;
    scanProgress.currentStateIndex = i + 1;

    console.log(`[National Scan] Processing state ${i + 1}/${statesToScan.length}: ${state}`);

    try {
      // Create a search for this state
      const searchId = await createSearch({
        userId,
        companyWebsite: brain.companyWebsite,
        location: state, // Just the state name
        status: "searching", // Skip code_targeting review
        offeringName: brainOffering.name,
        offeringDescription: brainOffering.description,
        targetMarket: brainOffering.targetMarket,
        keywords: JSON.stringify(brainOffering.keywords),
        keywordTagsUsed: JSON.stringify(brainOffering.targetMarketKeywordTags),
        selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
        selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
        codeSelectionReasoning: codeSelection.reasoning,
        excludedSectors: JSON.stringify([]), // No exclusions for national scan
        brainId: brain.id,
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
