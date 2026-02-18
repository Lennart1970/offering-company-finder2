import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createSearch,
  updateSearch,
  getSearchById,
  getUserSearches,
  createCompanies,
  getCompaniesBySearchId,
  getCompanyById,
  updateCompany,
  getPendingCompaniesBySearchId,
} from "./db";
import { extractOffering } from "./offeringExtractor";
import { searchApolloCompanies, enrichCompanyDetails } from "./apolloSearch";
import { normalizeWebsiteUrl } from "../shared/urlUtils";

export const companyFinderRouter = router({
  // Create a new search with hardcoded ConnectGroup offering (skip extraction)
  startSearch: protectedProcedure
    .input(
      z.object({
        location: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Hardcoded ConnectGroup offering data (EXPANDED for wider reach)
      const connectGroupOffering = {
        name: "Electronics Manufacturing Services (EMS) - PCB Assembly, Cable Assembly & Module Building",
        description: "ConnectGroup is a full-service EMS subcontractor providing PCB assembly, cable assembly (from complex harnesses to automated large-scale), and module building (integration of cables, electronics, and mechanics). With 33 years of industrial experience and 9 locations across 8 countries, they support companies from design to successful product with focus on efficiency, quality, and shorter time-to-market.",
        targetMarket: "Mid-market to enterprise companies in Railway, Healthcare/MedTech, Infrastructure, Automotive & Off-road, Defense & Avionics, Industrial Manufacturing, Electronics, Telecommunications, Energy, Automation, Instrumentation, Aerospace, Marine, Agricultural Equipment, Construction Equipment, Mining, Oil & Gas, Renewable Energy, IoT, and Embedded Systems that require EMS services, cable assemblies, PCB assembly, or module building.",
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

      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: "https://www.connectgroup.com/en/",
        location: input.location,
        status: "searching",
        offeringName: connectGroupOffering.name,
        offeringDescription: connectGroupOffering.description,
        targetMarket: connectGroupOffering.targetMarket,
        keywords: JSON.stringify(connectGroupOffering.keywords),
        keywordTagsUsed: JSON.stringify(connectGroupOffering.targetMarketKeywordTags),
      });

      // Start search immediately (skip extraction)
      searchWithHardcodedOffering(searchId, connectGroupOffering, input.location).catch(async (error) => {
        await updateSearch(searchId, {
          status: "failed",
          errorMessage: error.message,
        });
      });

      return { searchId };
    }),

  // Get search status and results
  getSearch: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }

      const companiesList = await getCompaniesBySearchId(input.searchId);

      // Count enrichment stats
      const enrichedCount = companiesList.filter((c) => c.enrichmentStatus === "enriched").length;
      const pendingCount = companiesList.filter((c) => c.enrichmentStatus === "pending").length;

      return {
        search,
        companies: companiesList,
        enrichmentStats: {
          total: companiesList.length,
          enriched: enrichedCount,
          pending: pendingCount,
        },
      };
    }),

  // Get user's search history
  getSearchHistory: protectedProcedure.query(async ({ ctx }) => {
    return getUserSearches(ctx.user.id);
  }),

  // STEP 2: Batch enrich all pending companies for a search
  enrichAll: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }

      const pendingCompanies = await getPendingCompaniesBySearchId(input.searchId);

      if (pendingCompanies.length === 0) {
        return { enriched: 0, failed: 0, message: "All companies already enriched" };
      }

      console.log(`[Enrich] Starting batch enrichment for ${pendingCompanies.length} companies in search ${input.searchId}`);

      let enriched = 0;
      let failed = 0;

      // Process in parallel batches of 5 to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < pendingCompanies.length; i += batchSize) {
        const batch = pendingCompanies.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (company) => {
            if (!company.apolloId) {
              await updateCompany(company.id, { enrichmentStatus: "failed" });
              failed++;
              return;
            }

            try {
              const details = await enrichCompanyDetails(company.apolloId);
              await updateCompany(company.id, {
                city: details.city || null,
                state: details.state || null,
                country: details.country || null,
                streetAddress: details.street_address || null,
                rawAddress: details.raw_address || null,
                enrichmentStatus: "enriched",
              });
              enriched++;
            } catch (error) {
              console.warn(`[Enrich] Failed for company ${company.id}:`, error instanceof Error ? error.message : error);
              await updateCompany(company.id, { enrichmentStatus: "failed" });
              failed++;
            }
          })
        );

        console.log(`[Enrich] Batch progress: ${Math.min(i + batchSize, pendingCompanies.length)}/${pendingCompanies.length}`);
      }

      console.log(`[Enrich] Done. Enriched: ${enriched}, Failed: ${failed}`);

      return { enriched, failed, message: `Enriched ${enriched} companies, ${failed} failed` };
    }),

  // Export companies as CSV
  exportCsv: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }

      const companiesList = await getCompaniesBySearchId(input.searchId);

      const headers = [
        "Name",
        "Website",
        "Domain",
        "LinkedIn",
        "Phone",
        "Founded",
        "Revenue",
        "Headcount Growth",
        "SIC Codes",
        "NAICS Codes",
        "Enrichment Status",
        "Search Location",
        "City",
        "State",
        "Country",
        "Street Address",
      ];
      const rows = companiesList.map((c) => [
        c.name,
        c.websiteUrl || "",
        c.primaryDomain || "",
        c.linkedinUrl || "",
        c.phone || "",
        c.foundedYear?.toString() || "",
        c.revenue || "",
        c.headcountGrowth || "",
        c.sicCodes || "",
        c.naicsCodes || "",
        c.enrichmentStatus || "pending",
        c.searchLocation || "",
        c.city || "",
        c.state || "",
        c.country || "",
        c.streetAddress || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      return { csv: csvContent };
    }),
});

// Background search function for hardcoded ConnectGroup offering (skip extraction)
async function searchWithHardcodedOffering(
  searchId: number,
  offering: {
    name: string;
    description: string;
    targetMarket: string;
    keywords: string[];
    targetMarketKeywordTags: string[];
  },
  location: string
) {
  try {
    console.log(`[Search ${searchId}] Using hardcoded ConnectGroup offering`);
    console.log(`[Search ${searchId}] Target market tags: ${JSON.stringify(offering.targetMarketKeywordTags)}`);

    // Fast bulk search - NO enrichment, just find companies
    console.log(`[Search ${searchId}] Fast Apollo search for companies in ${location}`);
    const apolloResult = await searchApolloCompanies({
      targetMarketKeywordTags: offering.targetMarketKeywordTags,
      targetMarket: offering.targetMarket,
      location,
      limit: 100,
    });

    console.log(`[Search ${searchId}] Apollo found ${apolloResult.totalFound} total, returning ${apolloResult.companies.length}`);

    // Store companies in database (all with enrichmentStatus: "pending")
    const companiesToInsert = apolloResult.companies.map((company) => ({
      searchId,
      apolloId: company.id,
      name: company.name,
      websiteUrl: company.website_url,
      primaryDomain: company.primary_domain,
      linkedinUrl: company.linkedin_url,
      phone: company.phone,
      foundedYear: company.founded_year,
      revenue: company.organization_revenue_printed,
      headcountGrowth: [
        company.organization_headcount_six_month_growth
          ? `6mo: ${(company.organization_headcount_six_month_growth * 100).toFixed(1)}%`
          : "",
        company.organization_headcount_twelve_month_growth
          ? `12mo: ${(company.organization_headcount_twelve_month_growth * 100).toFixed(1)}%`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
      sicCodes: company.sic_codes?.length ? JSON.stringify(company.sic_codes) : null,
      naicsCodes: company.naics_codes?.length ? JSON.stringify(company.naics_codes) : null,
      searchLocation: location,
      enrichmentStatus: "pending" as const,
    }));

    await createCompanies(companiesToInsert);

    await updateSearch(searchId, {
      status: "completed",
    });

    console.log(`[Search ${searchId}] Completed with ${companiesToInsert.length} companies (pending enrichment)`);
  } catch (error) {
    console.error(`[Search ${searchId}] Error in searchWithHardcodedOffering:`, error);
    throw error;
  }
}

// Background extraction and search function (STEP 1 only - no enrichment)
async function extractAndSearch(searchId: number, companyWebsite: string, location: string) {
  try {
    // Step 1: Extract offering using native xAI Grok integration
    console.log(`[Search ${searchId}] Step 1: Extracting offering from ${companyWebsite}`);
    const offering = await extractOffering(companyWebsite);

    console.log(`[Search ${searchId}] Offering extracted: ${offering.name}`);
    console.log(`[Search ${searchId}] Target market tags: ${JSON.stringify(offering.targetMarketKeywordTags)}`);

    await updateSearch(searchId, {
      offeringName: offering.name,
      offeringDescription: offering.description,
      targetMarket: offering.targetMarket,
      valueProposition: offering.valueProposition,
      keywords: JSON.stringify(offering.keywords),
      crossBorderIndicators: offering.crossBorderIndicators || "",
      status: "searching",
    });

    // Step 2: Fast bulk search - NO enrichment, just find companies
    console.log(`[Search ${searchId}] Step 2: Fast Apollo search for companies in ${location}`);
    const apolloResult = await searchApolloCompanies({
      targetMarketKeywordTags: offering.targetMarketKeywordTags,
      targetMarket: offering.targetMarket,
      location,
      limit: 100, // Higher limit since we skip enrichment
    });

    console.log(`[Search ${searchId}] Apollo found ${apolloResult.totalFound} total, returning ${apolloResult.companies.length}`);

    await updateSearch(searchId, {
      keywordTagsUsed: JSON.stringify(apolloResult.keywordTagsUsed),
    });

    // Step 3: Store companies in database (all with enrichmentStatus: "pending")
    const companiesToInsert = apolloResult.companies.map((company) => ({
      searchId,
      apolloId: company.id,
      name: company.name,
      websiteUrl: company.website_url,
      primaryDomain: company.primary_domain,
      linkedinUrl: company.linkedin_url,
      phone: company.phone,
      foundedYear: company.founded_year,
      revenue: company.organization_revenue_printed,
      headcountGrowth: [
        company.organization_headcount_six_month_growth
          ? `6mo: ${(company.organization_headcount_six_month_growth * 100).toFixed(1)}%`
          : "",
        company.organization_headcount_twelve_month_growth
          ? `12mo: ${(company.organization_headcount_twelve_month_growth * 100).toFixed(1)}%`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
      sicCodes: company.sic_codes?.length ? JSON.stringify(company.sic_codes) : null,
      naicsCodes: company.naics_codes?.length ? JSON.stringify(company.naics_codes) : null,
      searchLocation: location,
      // No location data yet - enrichment will fill these in
      enrichmentStatus: "pending" as const,
    }));

    await createCompanies(companiesToInsert);

    await updateSearch(searchId, {
      status: "completed",
    });

    console.log(`[Search ${searchId}] Completed with ${companiesToInsert.length} companies (pending enrichment)`);
  } catch (error) {
    console.error(`[Search ${searchId}] Error in extractAndSearch:`, error);
    throw error;
  }
}
