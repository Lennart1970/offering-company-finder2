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
  createSalesPackage,
  getSalesPackageByCompanyId,
  updateSalesPackage,
  createCompanyDecision,
  getCompanyDecision,
  getDecisionsBySearch,
  addExcludedCode,
  getExcludedCodes,
  removeExcludedCode,
  createContact,
  getContactByCompanyId,
} from "./db";
import { searchApolloContacts } from "./apolloPeopleSearch";
import { extractOffering } from "./offeringExtractor";
import { searchApolloCompanies, enrichCompanyDetails } from "./apolloSearch";
import { normalizeWebsiteUrl } from "../shared/urlUtils";

import { selectIndustryCodes } from "./codeSelectionService";
import { naicsMatchesHierarchically, sicMatchesHierarchically } from "../shared/naicsHierarchy";

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

      // STEP 1: Select relevant SIC/NAICS codes using LLM
      console.log(`[Search] Selecting industry codes for offering: ${connectGroupOffering.name}`);
      const codeSelection = await selectIndustryCodes({
        offeringName: connectGroupOffering.name,
        offeringDescription: connectGroupOffering.description,
        targetMarket: connectGroupOffering.targetMarket,
        valueProposition: "Full-service EMS with 33 years experience, 9 global locations, design-to-product support",
      });

      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: "https://www.connectgroup.com/en/",
        location: input.location,
        status: "code_targeting", // STOP here for user review
        offeringName: connectGroupOffering.name,
        offeringDescription: connectGroupOffering.description,
        targetMarket: connectGroupOffering.targetMarket,
        keywords: JSON.stringify(connectGroupOffering.keywords),
        keywordTagsUsed: JSON.stringify(connectGroupOffering.targetMarketKeywordTags),
        selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
        selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
        codeSelectionReasoning: codeSelection.reasoning,
        excludedSectors: JSON.stringify([]), // Empty initially, user can exclude sectors
      });

      // DO NOT start search yet - wait for user confirmation
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

  // Enrich a single company
  enrichSingle: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      const search = await getSearchById(company.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      if (!company.apolloId) {
        await updateCompany(company.id, { enrichmentStatus: "failed" });
        throw new Error("Company has no Apollo ID");
      }

      try {
        console.log(`[Enrich] Enriching single company ${company.id}`);
        const details = await enrichCompanyDetails(company.apolloId);
        await updateCompany(company.id, {
          city: details.city || null,
          state: details.state || null,
          country: details.country || null,
          streetAddress: details.street_address || null,
          rawAddress: details.raw_address || null,
          enrichmentStatus: "enriched",
        });
        return { success: true, message: "Company enriched successfully" };
      } catch (error) {
        console.warn(`[Enrich] Failed for company ${company.id}:`, error instanceof Error ? error.message : error);
        await updateCompany(company.id, { enrichmentStatus: "failed" });
        throw new Error(`Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
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



  // HITL: Submit decision on company relevance
  submitDecision: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        searchId: z.number(),
        decision: z.enum(["call_today", "park", "not_relevant"]),
        reasonCode: z.string().optional(),
        reasonNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      // Store decision
      const decisionId = await createCompanyDecision({
        companyId: input.companyId,
        searchId: input.searchId,
        userId: ctx.user.id,
        decision: input.decision,
        reasonCode: input.reasonCode || null,
        reasonNotes: input.reasonNotes || null,
      });

      // If decision is "not_relevant" and reason is "wrong_industry", add SIC/NAICS codes to exclusion list
      if (input.decision === "not_relevant" && input.reasonCode === "wrong_industry") {
        const sicCodes = company.sicCodes ? JSON.parse(company.sicCodes) : [];
        const naicsCodes = company.naicsCodes ? JSON.parse(company.naicsCodes) : [];

        for (const code of sicCodes) {
          await addExcludedCode({
            userId: ctx.user.id,
            codeType: "sic",
            code: code,
            codeDescription: null,
          });
        }

        for (const code of naicsCodes) {
          await addExcludedCode({
            userId: ctx.user.id,
            codeType: "naics",
            code: code,
            codeDescription: null,
          });
        }
      }

      return { decisionId, success: true };
    }),

  // HITL: Get decision for a company
  getDecision: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const decision = await getCompanyDecision(input.companyId, ctx.user.id);
      return decision ?? null;
    }),

  // HITL: Get all decisions for a search
  getSearchDecisions: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ input }) => {
      return await getDecisionsBySearch(input.searchId);
    }),

  // HITL: Get excluded codes
  getExcludedCodes: protectedProcedure.query(async ({ ctx }) => {
    return await getExcludedCodes(ctx.user.id);
  }),

  // HITL: Remove excluded code
  removeExcludedCode: protectedProcedure
    .input(z.object({ codeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await removeExcludedCode(input.codeId, ctx.user.id);
      return { success: true };
    }),

  // Sector exclusion: Update excluded sectors for a search
  updateExcludedSectors: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      excludedSectors: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }
      await updateSearch(input.searchId, {
        excludedSectors: JSON.stringify(input.excludedSectors),
      });
      return { success: true };
    }),

  // Two-step search: Confirm code targeting and start batched Apollo search
  confirmAndSearch: protectedProcedure
    .input(z.object({
      searchId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }
      if (search.status !== "code_targeting") {
        throw new Error("Search must be in code_targeting status");
      }
      
      // Import confirmAndSearch function
      const { confirmAndSearch } = await import("./confirmAndSearch");
      
      // Start batched search (runs in background)
      confirmAndSearch({
        searchId: input.searchId,
        location: search.location,
      }).catch(error => {
        console.error(`[confirmAndSearch] Error:`, error);
        updateSearch(input.searchId, {
          status: "failed",
          errorMessage: error.message,
        });
      });
      
      return { success: true, message: "Batched search started" };
    }),

  // Generate sales intelligence brief for a company
  generateBrief: protectedProcedure
    .input(z.object({
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      console.log(`[generateBrief] Starting brief generation for company ${input.companyId}`);

      // Check if cached brief exists and is recent (< 7 days old)
      if (company.briefData && company.briefGeneratedAt) {
        const cacheAge = Date.now() - new Date(company.briefGeneratedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        if (cacheAge < sevenDaysMs) {
          console.log(`[generateBrief] Using cached brief (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days)`);
          const cachedBrief = JSON.parse(company.briefData);
          return {
            success: true,
            brief: cachedBrief,
            cached: true,
            cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
          };
        } else {
          console.log(`[generateBrief] Cached brief expired (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days), regenerating...`);
        }
      }

      // Import brief generator
      const { generateSalesIntelligenceBrief } = await import("./briefGenerator");

      try {
        // Generate the brief (this calls Python script with Grok)
        const brief = await generateSalesIntelligenceBrief(input.companyId);

        // Update company with brief data
        await updateCompany(input.companyId, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: new Date(),
        });

        console.log(`[generateBrief] ✓ Brief generated with urgency score: ${brief.urgencyScore}`);

        return {
          success: true,
          brief,
          cached: false,
        };
      } catch (error: any) {
        console.error(`[generateBrief] Error:`, error);
        throw new Error(`Failed to generate brief: ${error.message}`);
      }
    }),

  // Generate personalized sales approach for a company (requires Deep Research first)
  generateSalesApproach: protectedProcedure
    .input(z.object({
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      // Check if deep research exists
      if (!company.briefData) {
        throw new Error("Deep research not found. Please run Deep Research first.");
      }

      console.log(`[generateSalesApproach] Starting sales approach generation for company ${input.companyId}`);

      // Import sales approach generator
      const { generateSalesApproach } = await import("./salesApproachGenerator");

      try {
        // Generate personalized sales approach
        const salesApproach = await generateSalesApproach(input.companyId);

        // Update company with sales approach data
        await updateCompany(input.companyId, {
          salesApproachData: JSON.stringify(salesApproach),
          salesApproachGeneratedAt: new Date(),
        });

        console.log(`[generateSalesApproach] ✓ Sales approach generated for ${company.name}`);

        return {
          success: true,
          salesApproach,
        };
      } catch (error: any) {
        console.error(`[generateSalesApproach] Error:`, error);
        throw new Error(`Failed to generate sales approach: ${error.message}`);
      }
    }),

  // Find contact at a company by job title (Apollo People Search)
  findContact: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      jobTitle: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) throw new Error("Company not found");

      // Check if we already have a contact for this company
      const existingContact = await getContactByCompanyId(input.companyId);
      if (existingContact) {
        return {
          success: true as const,
          contact: existingContact,
          cached: true,
        };
      }

      // Need company domain for Apollo People Search
      const domain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : null;
      if (!domain) throw new Error("Company has no website URL for contact search");

      console.log(`[findContact] Searching for "${input.jobTitle}" at ${company.name} (${domain})`);

      try {
        const contact = await searchApolloContacts({
          companyDomain: domain,
          jobTitle: input.jobTitle,
          limit: 1,
        });

        if (!contact) {
          return {
            success: false as const,
            message: `No contacts found matching "${input.jobTitle}" at ${company.name}`,
          };
        }

        const savedContact = await createContact({
          companyId: input.companyId,
          apolloPersonId: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.name,
          title: contact.title,
          email: contact.email || null,
          phone: contact.phone || null,
          linkedinUrl: contact.linkedinUrl || null,
          searchedTitle: input.jobTitle,
        });

        console.log(`[findContact] \u2713 Found: ${contact.name} - ${contact.title}`);

        return {
          success: true as const,
          contact: savedContact,
          cached: false,
        };
      } catch (error: any) {
        console.error(`[findContact] Error:`, error);
        throw new Error(`Failed to find contact: ${error.message}`);
      }
    }),

  // Get contact for a company
  getContact: protectedProcedure
    .input(z.object({
      companyId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const contact = await getContactByCompanyId(input.companyId);
      return { contact };
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
  location: string,
  codeSelection: { sicCodes: string[]; naicsCodes: string[]; reasoning: string }
) {
  try {
    console.log(`[Search ${searchId}] Using hardcoded ConnectGroup offering`);
    console.log(`[Search ${searchId}] LLM selected ${codeSelection.sicCodes.length} SIC codes and ${codeSelection.naicsCodes.length} NAICS codes`);
    console.log(`[Search ${searchId}] SIC: ${codeSelection.sicCodes.join(", ")}`);
    console.log(`[Search ${searchId}] NAICS: ${codeSelection.naicsCodes.join(", ")}`);
    console.log(`[Search ${searchId}] Reasoning: ${codeSelection.reasoning}`);

    // Wide cast Apollo search - NO keyword filtering, just location + employee size
    console.log(`[Search ${searchId}] Wide cast Apollo search for companies in ${location}`);
    const apolloResult = await searchApolloCompanies({
      targetMarketKeywordTags: [], // Empty - no keyword filtering
      targetMarket: offering.targetMarket,
      location,
      limit: 500, // Increased limit for wide cast
    });

    console.log(`[Search ${searchId}] Apollo found ${apolloResult.totalFound} total, returned ${apolloResult.companies.length}`);

    // Filter companies by selected SIC/NAICS codes using HIERARCHICAL matching
    // This means a selected code "333" (Machinery Manufacturing) will match
    // a company with code "333249" (Other Industrial Machinery)
    const filteredCompanies = apolloResult.companies.filter(company => {
      // Check if company has any matching SIC codes (hierarchical prefix match)
      const hasSicMatch = company.sic_codes?.some(code => 
        sicMatchesHierarchically(code, codeSelection.sicCodes)
      ) || false;
      // Check if company has any matching NAICS codes (hierarchical prefix match)
      const hasNaicsMatch = company.naics_codes?.some(code => 
        naicsMatchesHierarchically(code, codeSelection.naicsCodes)
      ) || false;
      
      return hasSicMatch || hasNaicsMatch;
    });

    console.log(`[Search ${searchId}] Filtered to ${filteredCompanies.length} companies matching selected codes (from ${apolloResult.companies.length} total)`);

    // Store filtered companies in database (all with enrichmentStatus: "pending")
    const companiesToInsert = filteredCompanies.map((company) => ({
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


