/**
 * Confirm code targeting and start batched Apollo search
 * 
 * This is Step B of the two-step search flow:
 * 1. Get keyword tags from target markets
 * 2. Run separate Apollo search per keyword tag (Railway, Healthcare, etc.)
 * 3. Filter results by confirmed NAICS sectors using hierarchical matching
 * 4. Deduplicate and aggregate results
 */

import { updateSearch, createCompanies, getSearchById } from "./db";
import { searchApolloCompanies, ApolloSearchParams } from "./apolloSearch";
import { extractSectors } from "../shared/naicsExpansion";
import { naicsMatchesHierarchically } from "../shared/naicsHierarchy";

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

  // Get keyword tags from target market
  const targetMarkets: string = search.targetMarket || "";
  const keywordTags = targetMarkets.split("•").map(t => t.trim()).filter(Boolean);
  
  console.log(`[Confirm & Search] Keyword tags: ${keywordTags.join(", ")}`);

  // Update search with keyword count and status
  await updateSearch(searchId, {
    status: "searching",
    codesTotal: keywordTags.length,
    codesSearched: 0,
  });

  // Start batched Apollo search
  await batchedKeywordSearch({
    searchId,
    location,
    keywordTags,
    confirmedSectors,
    targetMarket: search.targetMarket || "mid-market",
  });

  // Mark as completed
  await updateSearch(searchId, {
    status: "completed",
  });
}

interface BatchedSearchParams {
  searchId: number;
  location: string;
  keywordTags: string[];
  confirmedSectors: string[];
  targetMarket: string;
}

async function batchedKeywordSearch({ searchId, location, keywordTags, confirmedSectors, targetMarket }: BatchedSearchParams) {
  const companiesMap = new Map<string, any>(); // Deduplicate by Apollo organization_id
  
  for (let i = 0; i < keywordTags.length; i++) {
    const keyword = keywordTags[i];
    console.log(`[Batched Search] Searching keyword ${i + 1}/${keywordTags.length}: "${keyword}"`);

    try {
      // Search Apollo for this specific keyword tag
      const searchParams: ApolloSearchParams = {
        targetMarketKeywordTags: [keyword],
        targetMarket,
        location,
        limit: 100, // Pull up to 100 companies per keyword
      };

      const result = await searchApolloCompanies(searchParams);
      const companies = result.companies;

      console.log(`[Batched Search] Keyword "${keyword}": found ${companies.length} companies before filtering`);

      // Filter by confirmed NAICS sectors using hierarchical matching
      const filteredCompanies = companies.filter(company => {
        const naicsCodes = company.naics_codes || [];
        if (naicsCodes.length === 0) return false; // Skip companies with no NAICS codes
        
        // Check if any of the company's NAICS codes match confirmed sectors
        return naicsCodes.some(code => naicsMatchesHierarchically(code, confirmedSectors));
      });

      console.log(`[Batched Search] Keyword "${keyword}": ${filteredCompanies.length} companies after NAICS filtering`);

      // Add to deduplication map
      for (const company of filteredCompanies) {
        if (company.id && !companiesMap.has(company.id)) {
          companiesMap.set(company.id, company);
        }
      }
    } catch (error) {
      console.error(`[Batched Search] Error searching keyword "${keyword}":`, error);
      // Continue with next keyword even if one fails
    }

    // Update progress
    await updateSearch(searchId, {
      codesSearched: i + 1,
    });
  }

  // Convert map to array and store in database
  const uniqueCompanies = Array.from(companiesMap.values());
  console.log(`[Batched Search] Total unique companies after deduplication: ${uniqueCompanies.length}`);

  if (uniqueCompanies.length > 0) {
    await createCompanies(
      uniqueCompanies.map((company) => ({
        searchId,
        apolloId: company.id,
        name: company.name,
        websiteUrl: company.website_url,
        primaryDomain: company.primary_domain,
        phone: company.phone,
        foundedYear: company.founded_year,
        revenue: company.organization_revenue_printed || null,
        headcountGrowth: company.organization_headcount_six_month_growth 
          ? `${company.organization_headcount_six_month_growth}% (6mo)` 
          : null,
        linkedinUrl: company.linkedin_url,
        sicCodes: company.sic_codes ? JSON.stringify(company.sic_codes) : null,
        naicsCodes: company.naics_codes ? JSON.stringify(company.naics_codes) : null,
        enrichmentStatus: "pending", // Will be enriched later
        searchLocation: location,
        // Location fields will be populated during enrichment
        city: null,
        state: null,
        country: null,
        streetAddress: null,
      }))
    );
  }
}
