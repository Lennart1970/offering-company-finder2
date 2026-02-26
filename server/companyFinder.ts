import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createSearch,
  updateSearch,
  getSearchById,
  getUserSearches,
  getPreviousOffering,
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
  getCallTodayCompanies,
} from "./db";
// Brain and contacts-by-company imports are above with brainResearchService
import { searchApolloContacts, searchApolloContacts as searchApolloContactsSingle } from "./apolloPeopleSearch";
import { researchOfferingBrain } from "./brainResearchService";
import {
  createOfferingBrain,
  getActiveBrain,
  updateOfferingBrain,
  getBrainHistory,
  getContactsByCompanyId,
  setOfferingBrainActive,
  deleteOfferingBrain,
  getOfferingBrainById,
} from "./db";
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
      const decisions = await getDecisionsBySearch(input.searchId);

      // Count enrichment stats
      const enrichedCount = companiesList.filter((c) => c.enrichmentStatus === "enriched").length;
      const pendingCount = companiesList.filter((c) => c.enrichmentStatus === "pending").length;

      return {
        search,
        companies: companiesList,
        decisions,
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

      // If decision is "call_today", auto-trigger Deep Research and Sales Approach in background
      if (input.decision === "call_today") {
        // Don't await - run in background
        (async () => {
          try {
            // Step 1: Generate Deep Research if not already done
            if (!company.briefData) {
              console.log(`[submitDecision] Auto-triggering Deep Research for company ${input.companyId}`);
              const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
              const brief = await generateSalesIntelligenceBrief(input.companyId, ctx.user.id);
              await updateCompany(input.companyId, {
                urgencyScore: brief.urgencyScore,
                briefData: JSON.stringify(brief),
                briefGeneratedAt: new Date(),
              });
              console.log(`[submitDecision] ✓ Deep Research completed for company ${input.companyId}`);
            } else {
              console.log(`[submitDecision] Deep Research already exists for company ${input.companyId}, skipping`);
            }

            // Step 2: Generate Sales Approach if not already done
            if (!company.salesApproachData) {
              console.log(`[submitDecision] Auto-triggering Sales Approach for company ${input.companyId}`);
              const { generateSalesApproach } = await import("./salesApproachGenerator");
              const salesApproach = await generateSalesApproach(input.companyId, ctx.user.id);
              await updateCompany(input.companyId, {
                salesApproachData: JSON.stringify(salesApproach),
                salesApproachGeneratedAt: new Date(),
              });
              console.log(`[submitDecision] ✓ Sales Approach completed for company ${input.companyId}`);
            } else {
              console.log(`[submitDecision] Sales Approach already exists for company ${input.companyId}, skipping`);
            }
          } catch (error: any) {
            console.error(`[submitDecision] Background generation error for company ${input.companyId}:`, error.message);
          }
        })();
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
      if (search.status !== "searching") {
        throw new Error("Search must be in searching status");
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
        // Generate the brief with Brain context if available
        const brief = await generateSalesIntelligenceBrief(input.companyId, ctx.user.id);

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

      // Check if cached sales approach exists and is recent (< 7 days old)
      if (company.salesApproachData && company.salesApproachGeneratedAt) {
        const cacheAge = Date.now() - new Date(company.salesApproachGeneratedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        if (cacheAge < sevenDaysMs) {
          console.log(`[generateSalesApproach] Using cached sales approach (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days)`);
          const cachedApproach = JSON.parse(company.salesApproachData);
          return {
            success: true,
            salesApproach: cachedApproach,
            cached: true,
            cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)), // days
          };
        } else {
          console.log(`[generateSalesApproach] Cached sales approach expired (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days), regenerating...`);
        }
      }

      // Import sales approach generator
      const { generateSalesApproach } = await import("./salesApproachGenerator");

      try {
        // Generate personalized sales approach with Brain context
        const salesApproach = await generateSalesApproach(input.companyId, ctx.user.id);

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
      includePhone: z.boolean().optional(), // Optional: 8 credits per net-new phone
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
          includePhone: input.includePhone || false,
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

  // Get all companies marked as CALL TODAY for the current user
  getCallToday: protectedProcedure
    .query(async ({ ctx }) => {
      const results = await getCallTodayCompanies(ctx.user.id);
      return { companies: results };
    }),

  // ============================================================================
  // HITL Gate Procedures
  // ============================================================================

  // Check if user has a previous offering for this website
  checkPreviousOffering: protectedProcedure
    .input(z.object({
      websiteUrl: z.string().url(),
    }))
    .query(async ({ ctx, input }) => {
      const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
      const previousSearch = await getPreviousOffering(ctx.user.id, normalizedUrl);
      
      if (!previousSearch || !previousSearch.offeringName) {
        return { hasPrevious: false, previousOffering: null };
      }

      return {
        hasPrevious: true,
        previousOffering: {
          name: previousSearch.offeringName,
          description: previousSearch.offeringDescription,
          targetMarket: previousSearch.targetMarket,
          valueProposition: previousSearch.valueProposition,
          keywords: previousSearch.keywords ? JSON.parse(previousSearch.keywords) : [],
        },
      };
    }),

  // Create new search and extract offering from website
  extractOffering: protectedProcedure
    .input(z.object({
      websiteUrl: z.string().url(),
      location: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
      
      // Create search record in "extracting" status
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: normalizedUrl,
        location: input.location,
        status: "extracting",
      });

      try {
        // Extract offering from website
        const offering = await extractOffering(normalizedUrl);

        // Update search with offering data
        await updateSearch(searchId, {
          offeringName: offering.name,
          offeringDescription: offering.description,
          targetMarket: offering.targetMarket,
          valueProposition: offering.valueProposition,
          keywords: JSON.stringify(offering.keywords),
          crossBorderIndicators: offering.crossBorderIndicators,
          status: "code_targeting",
        });

        return { searchId, offering };
      } catch (error: any) {
        await updateSearch(searchId, {
          status: "failed",
          errorMessage: error.message,
        });
        throw error;
      }
    }),

  // Accept previous offering and create new search with copied data
  acceptPreviousOffering: protectedProcedure
    .input(z.object({
      websiteUrl: z.string().url(),
      location: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
      const previousSearch = await getPreviousOffering(ctx.user.id, normalizedUrl);

      if (!previousSearch) {
        throw new Error("No previous offering found");
      }

      // Create new search with copied offering data
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: normalizedUrl,
        location: input.location,
        offeringName: previousSearch.offeringName,
        offeringDescription: previousSearch.offeringDescription,
        targetMarket: previousSearch.targetMarket,
        valueProposition: previousSearch.valueProposition,
        keywords: previousSearch.keywords,
        crossBorderIndicators: previousSearch.crossBorderIndicators,
        status: "code_targeting",
      });

      const offering = {
        name: previousSearch.offeringName || "",
        description: previousSearch.offeringDescription || "",
        targetMarket: previousSearch.targetMarket || "",
        valueProposition: previousSearch.valueProposition || "",
        keywords: previousSearch.keywords ? JSON.parse(previousSearch.keywords) : [],
      };

      return { searchId, offering };
    }),

  // Manually update offering data
  updateOffering: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      offering: z.object({
        name: z.string(),
        description: z.string(),
        targetMarket: z.string(),
        valueProposition: z.string().optional(),
        keywords: z.array(z.string()),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateSearch(input.searchId, {
        offeringName: input.offering.name,
        offeringDescription: input.offering.description,
        targetMarket: input.offering.targetMarket,
        valueProposition: input.offering.valueProposition,
        keywords: JSON.stringify(input.offering.keywords),
        status: "code_targeting",
      });

      return { success: true };
    }),

  // Run code targeting (LLM selection of NAICS/SIC codes)
  runCodeTargeting: protectedProcedure
    .input(z.object({
      searchId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search) throw new Error("Search not found");

      try {
        // Run LLM code selection
        const codeSelection = await selectIndustryCodes({
          offeringName: search.offeringName || "",
          offeringDescription: search.offeringDescription || "",
          targetMarket: search.targetMarket || "",
          valueProposition: search.valueProposition || "",
        });

        // Update search with selected codes
        await updateSearch(input.searchId, {
          selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
          selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
          codeSelectionReasoning: codeSelection.reasoning,
          status: "searching",
        });

        return { 
          success: true,
          codes: {
            sicCodes: codeSelection.sicCodes,
            naicsCodes: codeSelection.naicsCodes,
            reasoning: codeSelection.reasoning,
          },
        };
      } catch (error: any) {
        await updateSearch(input.searchId, {
          status: "failed",
          errorMessage: error.message,
        });
        throw error;
      }
    }),

  // Accept code targeting (use codes from previous search or current extraction)
  acceptCodeTargeting: protectedProcedure
    .input(z.object({
      searchId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Just update status to "searching" - codes are already in the search record
      await updateSearch(input.searchId, {
        status: "searching",
      });

      return { success: true };
    }),

  // Manually expand/edit code targeting
  updateCodeTargeting: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      codes: z.object({
        sicCodes: z.array(z.string()),
        naicsCodes: z.array(z.string()),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateSearch(input.searchId, {
        selectedSicCodes: JSON.stringify(input.codes.sicCodes),
        selectedNaicsCodes: JSON.stringify(input.codes.naicsCodes),
        status: "searching",
      });

      return { success: true };
    }),

  // ============================================================================
  // National Scan Procedures
  // ============================================================================

  // Start a national scan across all 50 US states
  startNationalScan: protectedProcedure
    .input(z.object({ testMode: z.boolean().optional().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const { runNationalScan } = await import("./nationalScan");
      
      // Run in background (don't await)
      runNationalScan(ctx.user.id, input.testMode).catch(error => {
        console.error(`[National Scan] Fatal error:`, error);
      });
      
      const stateCount = input.testMode ? 2 : 50;
      const timeEstimate = input.testMode ? "3-5 minutes" : "2-4 hours";
      
      return { 
        success: true, 
        message: `${input.testMode ? 'Test' : 'National'} scan started for ${stateCount} states. Estimated time: ${timeEstimate}.` 
      };
    }),

  // Get progress of the current national scan
  getNationalScanProgress: protectedProcedure
    .query(async () => {
      const { getNationalScanProgress } = await import("./nationalScan");
      return getNationalScanProgress();
    }),

  // Stop the currently running national scan
  stopNationalScan: protectedProcedure
    .mutation(async () => {
      const { stopNationalScan } = await import("./nationalScan");
      return stopNationalScan();
    }),

  // Import companies from Apollo CSV export
  importCampaignFromCSV: protectedProcedure
    .input(z.object({
      csvContent: z.string(),
      campaignName: z.string().min(1),
      location: z.string().optional(), // Optional location override
    }))
    .mutation(async ({ ctx, input }) => {
      const { parseApolloCSV, mapApolloRowToCompany } = await import("./apolloCSVParser");
      
      console.log(`[CSV Import] Starting campaign: ${input.campaignName}`);
      
      // Parse CSV
      const rows = parseApolloCSV(input.csvContent);
      console.log(`[CSV Import] Parsed ${rows.length} companies from CSV`);
      
      if (rows.length === 0) {
        throw new Error("CSV file is empty or invalid");
      }
      
      // Create a search record for this campaign
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: "N/A", // Not applicable for CSV imports
        location: input.location || "CSV Import",
        offeringName: input.campaignName,
        offeringDescription: `Campaign imported from Apollo CSV with ${rows.length} companies`,
        targetMarket: null,
        valueProposition: null,
        keywords: null,
        crossBorderIndicators: null,
        keywordTagsUsed: null,
        selectedSicCodes: null,
        selectedNaicsCodes: null,
        codeSelectionReasoning: null,
        excludedSectors: null,
        codesSearched: rows.length,
        codesTotal: rows.length,
        status: "completed",
      });
      
      console.log(`[CSV Import] Created search record ${searchId}`);
      
      // Map and insert all companies
      const companies = rows.map((row) => mapApolloRowToCompany(row, searchId));
      
      await createCompanies(companies);
      
      console.log(`[CSV Import] ✓ Imported ${companies.length} companies for campaign: ${input.campaignName}`);
      
      return {
        searchId,
        companiesImported: companies.length,
        campaignName: input.campaignName,
      };
    }),

  // ============================================================================
  // Brain: Deep Offering Intelligence
  // ============================================================================

  // Get the active brain for the current user
  getActiveBrain: protectedProcedure
    .query(async ({ ctx }) => {
      const brain = await getActiveBrain(ctx.user.id);
      return { brain };
    }),

  // Get brain history for the current user
  getBrainHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const history = await getBrainHistory(ctx.user.id);
      return { history };
    }),

  // Research a company offering to create/update the Brain
  researchBrain: protectedProcedure
    .input(z.object({
      companyWebsite: z.string().min(1),
      companyName: z.string().optional(),
      brainName: z.string().min(1), // Required: user-provided brain name
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedUrl = normalizeWebsiteUrl(input.companyWebsite);
      const displayName = input.companyName || normalizedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

      console.log(`[Brain] Starting research for ${displayName} (${normalizedUrl})`);

      // Create a brain record with "researching" status
      const brainId = await createOfferingBrain({
        userId: ctx.user.id,
        brainName: input.brainName,
        companyName: displayName,
        companyWebsite: normalizedUrl,
        status: "researching",
      });

      try {
        // Run the deep research
        const result = await researchOfferingBrain(normalizedUrl, displayName);

        // Store structured intelligence
        await updateOfferingBrain(brainId, {
          companyName: result.companyName,
          offeringSummary: result.offeringSummary,
          coreCapabilities: JSON.stringify(result.coreCapabilities),
          valuePropositions: JSON.stringify(result.valuePropositions),
          competitiveAdvantages: result.competitiveAdvantages,
          icpIndustries: JSON.stringify(result.icpIndustries),
          icpCompanySize: result.icpCompanySize,
          icpGeography: result.icpGeography,
          icpPainPoints: JSON.stringify(result.icpPainPoints),
          icpBuyingSignals: JSON.stringify(result.icpBuyingSignals),
          fitCriteria: JSON.stringify(result.fitCriteria),
          urgencyTriggers: JSON.stringify(result.urgencyTriggers),
          rawResearchData: JSON.stringify(result),
          status: "completed",
        });

        console.log(`[Brain] ✓ Research completed for ${displayName}`);

        // Fetch the updated brain
        const brain = await getActiveBrain(ctx.user.id);
        return { brain, isNew: true };
      } catch (error: any) {
        console.error(`[Brain] Research failed:`, error);
        await updateOfferingBrain(brainId, {
          status: "failed",
          rawResearchData: JSON.stringify({ error: error.message }),
        });
        throw new Error(`Brain research failed: ${error.message}`);
      }
    }),

  // Update brain fields (HITL editing)
  updateBrain: protectedProcedure
    .input(z.object({
      brainId: z.number(),
      updates: z.object({
        brainName: z.string().optional(),
        offeringSummary: z.string().optional(),
        coreCapabilities: z.string().optional(), // JSON string
        valuePropositions: z.string().optional(), // JSON string
        competitiveAdvantages: z.string().optional(),
        icpIndustries: z.string().optional(), // JSON string
        icpCompanySize: z.string().optional(),
        icpGeography: z.string().optional(),
        icpPainPoints: z.string().optional(), // JSON string
        icpBuyingSignals: z.string().optional(), // JSON string
        fitCriteria: z.string().optional(), // JSON string
        urgencyTriggers: z.string().optional(), // JSON string
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the brain belongs to this user
      const brain = await getActiveBrain(ctx.user.id);
      if (!brain || brain.id !== input.brainId) {
        throw new Error("Brain not found or access denied");
      }

      await updateOfferingBrain(input.brainId, input.updates);
      const updated = await getActiveBrain(ctx.user.id);
      return { brain: updated };
    }),

  // Set a brain as active
  setActiveBrain: protectedProcedure
    .input(z.object({
      brainId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await setOfferingBrainActive(input.brainId, ctx.user.id);
      const brain = await getActiveBrain(ctx.user.id);
      return { brain };
    }),

  // Delete a brain
  deleteBrain: protectedProcedure
    .input(z.object({
      brainId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await deleteOfferingBrain(input.brainId, ctx.user.id);
      return { success: true };
    }),

  // Get a specific brain by ID
  getBrainById: protectedProcedure
    .input(z.object({
      brainId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const brain = await getOfferingBrainById(input.brainId, ctx.user.id);
      if (!brain) {
        throw new Error("Brain not found or access denied");
      }
      return { brain };
    }),

  // ============================================================================
  // Find All C-Suite: Bulk Contact Search
  // ============================================================================

  // Get all contacts for a company
  getCompanyContacts: protectedProcedure
    .input(z.object({
      companyId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const contacts = await getContactsByCompanyId(input.companyId);
      return { contacts };
    }),

  // Find all C-Suite contacts at a company
  findAllCSuite: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      titles: z.array(z.string()).optional(), // Custom titles, defaults to C-Suite
      includePhone: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) throw new Error("Company not found");

      const domain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : null;
      if (!domain) throw new Error("Company has no website URL for contact search");

      const titles = input.titles || [
        "CEO",
        "CFO",
        "CTO",
        "COO",
        "VP Operations",
        "VP Supply Chain",
        "VP Engineering",
        "Director Procurement",
      ];

      console.log(`[C-Suite] Searching ${titles.length} titles at ${company.name} (${domain})`);

      // Check existing contacts to avoid duplicates
      const existingContacts = await getContactsByCompanyId(input.companyId);
      const existingEmails = new Set(existingContacts.map(c => c.email?.toLowerCase()).filter(Boolean));
      const existingNames = new Set(existingContacts.map(c => (c.fullName || `${c.firstName} ${c.lastName}`).toLowerCase()));

      const results: Array<{ title: string; found: boolean; contact?: any; error?: string }> = [];
      const foundContacts: any[] = [...existingContacts];

      for (const title of titles) {
        try {
          // Check if we already have someone with this searched title
          const alreadySearched = existingContacts.some(
            c => c.searchedTitle?.toLowerCase() === title.toLowerCase()
          );
          if (alreadySearched) {
            const existing = existingContacts.find(
              c => c.searchedTitle?.toLowerCase() === title.toLowerCase()
            );
            results.push({ title, found: true, contact: existing });
            continue;
          }

          const contact = await searchApolloContactsSingle({
            companyDomain: domain,
            companyName: company.name,
            jobTitle: title,
            limit: 1,
            includePhone: input.includePhone || false,
          });

          if (!contact) {
            results.push({ title, found: false });
            continue;
          }

          // Check for duplicates by email or name
          const contactEmail = contact.email?.toLowerCase();
          const contactName = contact.name?.toLowerCase();

          if ((contactEmail && existingEmails.has(contactEmail)) ||
              (contactName && existingNames.has(contactName))) {
            results.push({ title, found: true, contact: { ...contact, duplicate: true } });
            continue;
          }

          // Save to database
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
            searchedTitle: title,
          });

          if (contactEmail) existingEmails.add(contactEmail);
          if (contactName) existingNames.add(contactName);
          foundContacts.push(savedContact);
          results.push({ title, found: true, contact: savedContact });

          console.log(`[C-Suite] ✓ Found ${contact.name} for "${title}"`);
        } catch (error: any) {
          console.error(`[C-Suite] Error searching "${title}":`, error.message);
          results.push({ title, found: false, error: error.message });
        }

        // Small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const totalFound = results.filter(r => r.found).length;
      console.log(`[C-Suite] Completed: ${totalFound}/${titles.length} titles found at ${company.name}`);

      return {
        results,
        totalFound,
        totalSearched: titles.length,
        allContacts: foundContacts,
      };
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
