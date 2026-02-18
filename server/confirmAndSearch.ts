/**
 * Confirm code targeting and start batched Apollo search
 * 
 * This is Step B of the two-step search flow:
 * 1. Get keyword tags from target markets
 * 2. Run separate Apollo search per keyword tag (Railway, Healthcare, etc.)
 * 3. Filter results by confirmed NAICS sectors using hierarchical matching
 * 4. Deduplicate and aggregate results
 */

import { updateSearch, getSearchById } from "./db";
import { extractSectors } from "../shared/naicsExpansion";
import { multiSliceSearch } from "./multiSliceSearch";

interface ConfirmAndSearchParams {
  searchId: number;
  location: string;
}

export async function confirmAndSearch({ searchId, location }: ConfirmAndSearchParams) {
  const search = await getSearchById(searchId);
  if (!search) {
    throw new Error("Search not found");
  }

  // Parse selected NAICS codes and excluded sectors
  const selectedNaicsCodes: string[] = search.selectedNaicsCodes ? JSON.parse(search.selectedNaicsCodes) : [];
  const excludedSectors: string[] = search.excludedSectors ? JSON.parse(search.excludedSectors) : [];

  // Extract 2-digit sectors from selected NAICS codes
  const allSectors = extractSectors(selectedNaicsCodes);
  
  // Filter out excluded sectors
  const confirmedSectors = allSectors.filter(sector => !excludedSectors.includes(sector));

  console.log(`[Confirm & Search] All sectors: ${allSectors.join(", ")}`);
  console.log(`[Confirm & Search] Excluded sectors: ${excludedSectors.join(", ")}`);
  console.log(`[Confirm & Search] Confirmed sectors: ${confirmedSectors.join(", ")}`);

  // Get keyword tags from keywordTagsUsed (Apollo search tags)
  const keywordTags: string[] = search.keywordTagsUsed ? JSON.parse(search.keywordTagsUsed) : [];
  
  console.log(`[Confirm & Search] Using ${keywordTags.length} Apollo search tags: ${keywordTags.join(", ")}`);

  // Update search with keyword count and status
  await updateSearch(searchId, {
    status: "searching",
    codesTotal: keywordTags.length,
    codesSearched: 0,
  });

  // Start multi-slice Apollo search
  await multiSliceSearch({
    searchId,
    location,
    confirmedSectors,
    targetMarket: search.targetMarket || "mid-market",
  });

  // Mark as completed
  await updateSearch(searchId, {
    status: "completed",
  });
}


