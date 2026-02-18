/**
 * Multi-slice search: Employee bands × Industry keywords × Keyword sets
 * 
 * This replaces the simple batched keyword search with a comprehensive
 * multi-dimensional search strategy that maximizes company coverage.
 */

import { updateSearch, createCompanies } from "./db";
import { searchApolloCompanies, ApolloSearchParams } from "./apolloSearch";
import { naicsMatchesHierarchically } from "../shared/naicsHierarchy";
import { generateSearchSlices, getTotalSlices } from "./searchSlices";

interface MultiSliceSearchParams {
  searchId: number;
  location: string;
  confirmedSectors: string[];
  targetMarket: string;
}

export async function multiSliceSearch({
  searchId,
  location,
  confirmedSectors,
  targetMarket,
}: MultiSliceSearchParams) {
  const companiesMap = new Map<string, any>(); // Deduplicate by Apollo organization_id
  const slices = generateSearchSlices();
  const totalSlices = getTotalSlices();

  console.log(`[Multi-Slice Search] Starting search with ${totalSlices} slices`);
  console.log(`[Multi-Slice Search] Employee bands: 3, Industries: 7, Keyword sets: 3`);

  // Update search with total slice count
  await updateSearch(searchId, {
    status: "searching",
    codesTotal: totalSlices,
    codesSearched: 0,
  });

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const { employeeBand, industry, keywordSet } = slice;

    console.log(
      `[Multi-Slice Search] Slice ${i + 1}/${totalSlices}: ${employeeBand.label} × ${industry.name} × ${keywordSet.name}`
    );

    try {
      // Combine industry keywords + keyword set keywords
      const allKeywords = [...industry.keywords, ...keywordSet.keywords];

      // Search Apollo with this slice configuration
      const searchParams: ApolloSearchParams = {
        targetMarketKeywordTags: allKeywords,
        targetMarket,
        location,
        limit: 10000, // Pull all available companies per slice
        employeeRanges: [employeeBand], // Single employee band per slice
      };

      const result = await searchApolloCompanies(searchParams);
      const companies = result.companies;

      console.log(
        `[Multi-Slice Search] Slice ${i + 1}: found ${companies.length} companies before filtering`
      );

      // Filter by confirmed NAICS sectors using hierarchical matching
      const filteredCompanies = companies.filter((company) => {
        const naicsCodes = company.naics_codes || [];
        if (naicsCodes.length === 0) return false; // Skip companies with no NAICS codes

        // Check if any of the company's NAICS codes match confirmed sectors
        return naicsCodes.some((code) =>
          naicsMatchesHierarchically(code, confirmedSectors)
        );
      });

      console.log(
        `[Multi-Slice Search] Slice ${i + 1}: ${filteredCompanies.length} companies after NAICS filtering`
      );

      // Add to deduplication map with slice metadata
      for (const company of filteredCompanies) {
        if (company.id) {
          if (!companiesMap.has(company.id)) {
            // First time seeing this company - add with slice metadata
            companiesMap.set(company.id, {
              ...company,
              sliceMetadata: {
                employeeBand: employeeBand.label,
                industry: industry.name,
                keywordSet: keywordSet.name,
                matchedKeywords: allKeywords,
              },
            });
          } else {
            // Company already exists - could track multiple slice hits here
            // For now, we just keep the first slice that found it
          }
        }
      }
    } catch (error) {
      console.error(`[Multi-Slice Search] Error in slice ${i + 1}:`, error);
      // Continue with next slice even if one fails
    }

    // Update progress
    await updateSearch(searchId, {
      codesSearched: i + 1,
    });
  }

  // Convert map to array and store in database
  const uniqueCompanies = Array.from(companiesMap.values());
  console.log(
    `[Multi-Slice Search] Total unique companies after deduplication: ${uniqueCompanies.length}`
  );

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
        naicsCodes: company.naics_codes
          ? JSON.stringify(company.naics_codes)
          : null,
        enrichmentStatus: "pending",
        searchLocation: location,
        // Store slice metadata for later analysis
        sliceMetadata: company.sliceMetadata
          ? JSON.stringify(company.sliceMetadata)
          : null,
        // Location fields will be populated during enrichment
        city: null,
        state: null,
        country: null,
        postalCode: null,
        streetAddress: null,
      }))
    );
  }
}
