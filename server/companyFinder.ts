import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// DB-backed job store for fire-and-forget doNext10 jobs
// In-memory Map is intentionally removed; all state lives in batch_jobs table.
// ---------------------------------------------------------------------------
import {
  createSearch,
  updateSearch,
  getSearchById,
  getUserSearches,
  toggleShareSearch,
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
  createBatchJob,
  getBatchJob,
  updateBatchJob,
  getLatestBatchJobForSearch,
  archiveSearch,
  getCompaniesBySearchIdPaged,
  countCompaniesBySearchId,
} from "./db";
// Brain and contacts-by-company imports are above with brainResearchService
import { searchApolloContacts, searchApolloContacts as searchApolloContactsSingle, trickleDownSearch, getAllPersonnel, enrichPerson, SENIORITY_TIERS } from "./apolloPeopleSearch";
import { researchOfferingBrain } from "./brainResearchService";
import { parseOfferingExcel, normaliseBrainFromExcel } from "./brainExcelService";
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

// Helper: check if user can access a search (owns it OR it's shared)
async function assertSearchAccess(searchId: number, userId: number) {
  const search = await getSearchById(searchId);
  if (!search || (search.userId !== userId && !search.sharedWithTeam)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Search not found" });
  }
  return search;
}

// Helper: check if user OWNS the search (for write/destructive operations)
async function assertSearchOwner(searchId: number, userId: number) {
  const search = await getSearchById(searchId);
  if (!search || search.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the campaign owner can perform this action" });
  }
  return search;
}

// Helper: check if user can access a company (owns the search OR search is shared)
async function assertCompanyAccess(companyId: number, userId: number) {
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
  const search = await getSearchById(company.searchId);
  if (!search || (search.userId !== userId && !search.sharedWithTeam)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
  return company;
}

// Helper: stamp the active brain on a company after any generation pass
// Call this after every updateCompany that stores LLM-generated content
async function stampBrainOnCompany(companyId: number, userId: number) {
  try {
    const brain = await getActiveBrain(userId);
    if (brain) {
      await updateCompany(companyId, {
        generatedWithBrainId: brain.id,
        generatedWithBrainName: brain.brainName,
      });
    }
  } catch { /* non-fatal — don't break generation if brain lookup fails */ }
}

export const companyFinderRouter = router({
  // Create a new search using the active Offering Brain (brain-agnostic)
  startSearch: protectedProcedure
    .input(
      z.object({
        location: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Load the active Offering Brain for this user
      const brain = await getActiveBrain(ctx.user.id);
      if (!brain || brain.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active Offering Brain found. Please create one first on the Brain page.",
        });
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

      // STEP 1: Select relevant SIC/NAICS codes using LLM
      console.log(`[Search] Selecting industry codes for offering: ${brainOffering.name}`);
      const codeSelection = await selectIndustryCodes({
        offeringName: brainOffering.name,
        offeringDescription: brainOffering.description,
        targetMarket: brainOffering.targetMarket,
        valueProposition: vpSummary,
      });

      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: brain.companyWebsite,
        location: input.location,
        status: "code_targeting", // STOP here for user review
        offeringName: brainOffering.name,
        offeringDescription: brainOffering.description,
        targetMarket: brainOffering.targetMarket,
        keywords: JSON.stringify(brainOffering.keywords),
        keywordTagsUsed: JSON.stringify(brainOffering.targetMarketKeywordTags),
        selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
        selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
        codeSelectionReasoning: codeSelection.reasoning,
        excludedSectors: JSON.stringify([]), // Empty initially, user can exclude sectors
        brainId: brain.id,
      });

      // DO NOT start search yet - wait for user confirmation
      return { searchId };
    }),

  // Get search status and results (paginated — default 100 per page)
  getSearch: protectedProcedure
    .input(z.object({ searchId: z.number(), page: z.number().optional().default(0), pageSize: z.number().optional().default(100) }))
    .query(async ({ ctx, input }) => {
      const search = await assertSearchAccess(input.searchId, ctx.user.id);

      const offset = input.page * input.pageSize;
      const [companiesList, decisions, totalCount] = await Promise.all([
        getCompaniesBySearchIdPaged(input.searchId, input.pageSize, offset),
        getDecisionsBySearch(input.searchId),
        countCompaniesBySearchId(input.searchId),
      ]);

      // Compute enrichment stats from the full page (approximate for display)
      const enrichedCount = companiesList.filter((c) => c.enrichmentStatus === "enriched").length;
      const pendingCount = companiesList.filter((c) => c.enrichmentStatus === "pending").length;
      const nameOnlyCount = companiesList.filter(
        (c) => c.enrichmentStatus === "pending" && !c.apolloId && !c.primaryDomain
      ).length;
      const outreachReadyCount = companiesList.filter(
        (c) => c.enrichmentStatus === "enriched" && !!c.salesApproachData
      ).length;

      return {
        search,
        companies: companiesList,
        decisions,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: totalCount,
          hasMore: offset + companiesList.length < totalCount,
        },
        enrichmentStats: {
          total: totalCount,
          enriched: enrichedCount,
          pending: pendingCount,
          nameOnly: nameOnlyCount,
          outreachReady: outreachReadyCount,
        },
      };
    }),

  // Get user's search history
  getSearchHistory: protectedProcedure
    .input(z.object({ showArchived: z.boolean().optional().default(false) }))
    .query(async ({ ctx, input }) => {
      return getUserSearches(ctx.user.id, input.showArchived);
    }),

  // Archive / unarchive a search run
  archiveSearch: protectedProcedure
    .input(z.object({ searchId: z.number(), archive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await archiveSearch(input.searchId, ctx.user.id, input.archive);
      return { success: true };
    }),

  // STEP 2: Batch enrich all pending companies for a search
  enrichAll: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const search = await assertSearchOwner(input.searchId, ctx.user.id);

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

  // ---------------------------------------------------------------------------
  // doNext10 — enrich + research + approach the next N companies in one shot
  // Priority: pending (unenriched) first, then enriched-but-no-brief, then brief-but-no-approach
  // ---------------------------------------------------------------------------
  // fire-and-forget: returns jobId immediately, runs in background.
  // Job state is persisted to batch_jobs table so it survives server restarts.
  doNext10: protectedProcedure
    .input(z.object({ searchId: z.number(), limit: z.number().optional().default(10) }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const jobId = randomUUID();

      // Persist initial job row immediately so the client can start polling
      await createBatchJob({
        id: jobId,
        searchId: input.searchId,
        userId: ctx.user.id,
        status: "running",
        progress: 0,
        currentCompany: null,
        totalCompanies: 0,
        enriched: 0,
        researched: 0,
        approached: 0,
        failed: 0,
        remaining: 0,
      });

      // Run in background — NOT awaited
      (async () => {
        try {
          const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
          const { generateSalesApproach } = await import("./salesApproachGenerator");
          const all = await getCompaniesBySearchId(input.searchId);
          const limit = input.limit;
          const pending = all.filter((c) => c.enrichmentStatus === "pending" && !!c.apolloId);
          const needsBrief = all.filter((c) => c.enrichmentStatus === "enriched" && !c.briefData);
          const needsApproach = all.filter((c) => c.enrichmentStatus === "enriched" && !!c.briefData && !c.salesApproachData);
          const queue = [...pending, ...needsBrief, ...needsApproach].slice(0, limit);

          await updateBatchJob(jobId, { totalCompanies: queue.length });
          console.log(`[doNext10] jobId=${jobId} searchId=${input.searchId} — ${queue.length} companies queued`);

          let enriched = 0, researched = 0, approached = 0, failed = 0;

          // Per-company hard timeout: 4 minutes. If a single company takes longer
          // (e.g. Grok body stream stalls), we skip it and continue with the next.
          const PER_COMPANY_TIMEOUT_MS = 4 * 60 * 1000;

          for (let i = 0; i < queue.length; i++) {
            const company = queue[i];
            const progress = Math.round((i / queue.length) * 100);
            await updateBatchJob(jobId, { currentCompany: company.name || null, progress, enriched, researched, approached, failed });
            try {
              const companyWork = async () => {
                if (company.enrichmentStatus === "pending") {
                  const details = await enrichCompanyDetails(company.apolloId!);
                  await updateCompany(company.id, {
                    city: details.city || null,
                    state: details.state || null,
                    country: details.country || null,
                    streetAddress: details.street_address || null,
                    rawAddress: details.raw_address || null,
                    enrichmentStatus: "enriched",
                  });
                  enriched++;
                  console.log(`[doNext10] ✓ Enriched: ${company.name}`);
                }
                if (!company.briefData) {
                  const brief = await generateSalesIntelligenceBrief(company.id, ctx.user.id);
                  await updateCompany(company.id, {
                    urgencyScore: brief.urgencyScore,
                    briefData: JSON.stringify(brief),
                    briefGeneratedAt: new Date(),
                  });
                  researched++;
                  console.log(`[doNext10] ✓ Researched: ${company.name}`);
                }
                if (!company.salesApproachData) {
                  const approach = await generateSalesApproach(company.id, ctx.user.id);
                  await updateCompany(company.id, {
                    salesApproachData: JSON.stringify(approach),
                    salesApproachGeneratedAt: new Date(),
                  });
                  approached++;
                  console.log(`[doNext10] ✓ Approached: ${company.name}`);
                }
              };

              const timeoutGuard = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Per-company timeout after ${PER_COMPANY_TIMEOUT_MS / 1000}s`)), PER_COMPANY_TIMEOUT_MS)
              );

              await Promise.race([companyWork(), timeoutGuard]);
            } catch (err: any) {
              failed++;
              console.error(`[doNext10] ✗ ${company.name}:`, err.message);
            }
          }

          const refreshed = await getCompaniesBySearchId(input.searchId);
          const remaining = refreshed.filter(
            (c) => c.enrichmentStatus === "pending" || !c.briefData || !c.salesApproachData
          ).length;
          await updateBatchJob(jobId, {
            status: "completed",
            progress: 100,
            currentCompany: null,
            enriched,
            researched,
            approached,
            failed,
            remaining,
          });
          console.log(`[doNext10] Done — enriched:${enriched} researched:${researched} approached:${approached} failed:${failed} remaining:${remaining}`);
        } catch (err: any) {
          await updateBatchJob(jobId, { status: "failed", errorMessage: err.message }).catch(() => {});
          console.error(`[doNext10] Fatal:`, err.message);
        }
      })();

      return { jobId };
    }),

  // Poll job status (lightweight, called every 3s by client while job runs)
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = await getBatchJob(input.jobId);
      if (!job) return null;
      // Map DB status to client-side status strings
      const clientStatus =
        job.status === "completed" ? "done" :
        job.status === "failed" ? "error" :
        job.status === "cancelled" ? "cancelled" :
        "running";
      return {
        status: clientStatus as "running" | "done" | "error" | "cancelled",
        jobType: job.jobType as "do10" | "doAll",
        current: job.currentCompany ?? null,
        progress: job.progress,
        stats: {
          enriched: job.enriched,
          researched: job.researched,
          approached: job.approached,
          failed: job.failed,
          total: job.totalCompanies,
          remaining: job.remaining,
        },
        error: job.errorMessage ?? null,
      };
    }),

  // Returns the most recent batch job for a search so the client can resume
  // polling after a page reload without losing visibility into a running job.
  getLatestJob: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const job = await getLatestBatchJobForSearch(input.searchId);
      if (!job) return null;
      // Treat stale "running" jobs (no update in >10 min) as failed — the server restarted
      if (job.status === "running") {
        const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
        if (job.updatedAt < staleCutoff) {
          await updateBatchJob(job.id, { status: "failed", errorMessage: "Job interrupted by server restart" });
          return null; // Don't resume a stale job
        }
      }
      if (job.status !== "running") return null; // Only resume actively running jobs
      return { jobId: job.id };
    }),

  // ---------------------------------------------------------------------------
  // doAll — process ALL remaining companies in a search in one background job
  // Same logic as doNext10 but no limit and checks for cancellation each step.
  // ---------------------------------------------------------------------------
  doAll: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const jobId = randomUUID();

      await createBatchJob({
        id: jobId,
        searchId: input.searchId,
        userId: ctx.user.id,
        status: "running",
        jobType: "doAll",
        progress: 0,
        currentCompany: null,
        totalCompanies: 0,
        enriched: 0,
        researched: 0,
        approached: 0,
        failed: 0,
        remaining: 0,
      });

      // Run in background — NOT awaited
      (async () => {
        try {
          const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
          const { generateSalesApproach } = await import("./salesApproachGenerator");
          const all = await getCompaniesBySearchId(input.searchId);
          // Build a deduplicated queue of unique companies that need ANY work
          const needsWork = all.filter((c) =>
            (c.enrichmentStatus === "pending" && !!c.apolloId) ||
            (c.enrichmentStatus === "enriched" && !c.briefData) ||
            (c.enrichmentStatus === "enriched" && !!c.briefData && !c.salesApproachData)
          );
          const queue = needsWork; // Each company appears once — all steps handled inside the loop

          await updateBatchJob(jobId, { totalCompanies: queue.length });
          console.log(`[doAll] jobId=${jobId} searchId=${input.searchId} — ${queue.length} companies queued`);

          let enriched = 0, researched = 0, approached = 0, failed = 0;

          // Per-company hard timeout: 4 minutes. If a single company takes longer
          // (e.g. Grok body stream stalls), we skip it and continue with the next.
          const PER_COMPANY_TIMEOUT_MS = 4 * 60 * 1000;

          for (let i = 0; i < queue.length; i++) {
            // Check for cancellation before each company
            const currentJob = await getBatchJob(jobId);
            if (currentJob?.status === "cancelled") {
              console.log(`[doAll] Cancelled at company ${i + 1}/${queue.length}`);
              return;
            }

            const company = queue[i];
            const progress = Math.round((i / queue.length) * 100);
            await updateBatchJob(jobId, { currentCompany: company.name || null, progress, enriched, researched, approached, failed });
            try {
              const companyWork = async () => {
                if (company.enrichmentStatus === "pending") {
                  const details = await enrichCompanyDetails(company.apolloId!);
                  await updateCompany(company.id, {
                    city: details.city || null,
                    state: details.state || null,
                    country: details.country || null,
                    streetAddress: details.street_address || null,
                    rawAddress: details.raw_address || null,
                    enrichmentStatus: "enriched",
                  });
                  enriched++;
                  console.log(`[doAll] ✓ Enriched: ${company.name}`);
                }
                if (!company.briefData) {
                  const brief = await generateSalesIntelligenceBrief(company.id, ctx.user.id);
                  await updateCompany(company.id, {
                    urgencyScore: brief.urgencyScore,
                    briefData: JSON.stringify(brief),
                    briefGeneratedAt: new Date(),
                  });
                  researched++;
                  console.log(`[doAll] ✓ Researched: ${company.name}`);
                }
                if (!company.salesApproachData) {
                  const approach = await generateSalesApproach(company.id, ctx.user.id);
                  await updateCompany(company.id, {
                    salesApproachData: JSON.stringify(approach),
                    salesApproachGeneratedAt: new Date(),
                  });
                  approached++;
                  console.log(`[doAll] ✓ Approached: ${company.name}`);
                }
              };

              const timeoutGuard = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Per-company timeout after ${PER_COMPANY_TIMEOUT_MS / 1000}s`)), PER_COMPANY_TIMEOUT_MS)
              );

              await Promise.race([companyWork(), timeoutGuard]);
            } catch (err: any) {
              failed++;
              console.error(`[doAll] ✗ ${company.name}:`, err.message);
            }
          }

          const refreshed = await getCompaniesBySearchId(input.searchId);
          const remaining = refreshed.filter(
            (c) => c.enrichmentStatus === "pending" || !c.briefData || !c.salesApproachData
          ).length;
          await updateBatchJob(jobId, {
            status: "completed",
            progress: 100,
            currentCompany: null,
            enriched,
            researched,
            approached,
            failed,
            remaining,
          });
          console.log(`[doAll] Done — enriched:${enriched} researched:${researched} approached:${approached} failed:${failed} remaining:${remaining}`);
        } catch (err: any) {
          await updateBatchJob(jobId, { status: "failed", errorMessage: err.message }).catch(() => {});
          console.error(`[doAll] Fatal:`, err.message);
        }
      })();

      return { jobId };
    }),

  // Cancel a running job — sets DB status to "cancelled".
  // The doAll background loop checks this flag before each company and exits cleanly.
  cancelJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await getBatchJob(input.jobId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      // Only the job owner can cancel it
      if (job.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your job" });
      if (job.status !== "running") return { cancelled: false, reason: "Job is not running" };
      await updateBatchJob(input.jobId, { status: "cancelled", errorMessage: "Cancelled by user" });
      console.log(`[cancelJob] jobId=${input.jobId} cancelled by user ${ctx.user.id}`);
      return { cancelled: true };
    }),

  // Returns prev/next company IDs for a given company within a search (server-side queue navigation)
  getAdjacentCompany: protectedProcedure
    .input(z.object({ searchId: z.number(), companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const all = await getCompaniesBySearchId(input.searchId);
      const idx = all.findIndex((c) => c.id === input.companyId);
      if (idx === -1) return null;
      return {
        position: idx + 1,
        total: all.length,
        prevId: idx > 0 ? all[idx - 1].id : null,
        nextId: idx < all.length - 1 ? all[idx + 1].id : null,
      };
    }),

  // Export companies as CSV
  enrichSingle: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

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
      const search = await assertSearchAccess(input.searchId, ctx.user.id);

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
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

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
      await assertCompanyAccess(input.companyId, ctx.user.id);
      const decision = await getCompanyDecision(input.companyId, ctx.user.id);
      return decision ?? null;
    }),

  // HITL: Get all decisions for a search
  getSearchDecisions: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
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
      await assertSearchOwner(input.searchId, ctx.user.id);
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
      const search = await assertSearchOwner(input.searchId, ctx.user.id);
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
      force: z.boolean().optional(), // If true, bypass cache and regenerate
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      console.log(`[generateBrief] Starting brief generation for company ${input.companyId}`);
      // Check if cached brief exists and is recent (< 7 days old) — skip if force=true
      if (!input.force && company.briefData && company.briefGeneratedAt) {
        const cacheAge = Date.now() - new Date(company.briefGeneratedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        if (cacheAge < sevenDaysMs) {
          console.log(`[generateBrief] Using cached brief (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days)`);;
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
        await stampBrainOnCompany(input.companyId, ctx.user.id);

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
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

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
          // Normalise conversationStarters in case legacy data has wrong shape
          const { normaliseConversationStarters } = await import("./salesApproachGenerator");
          if (cachedApproach && Array.isArray(cachedApproach.conversationStarters)) {
            cachedApproach.conversationStarters = normaliseConversationStarters(cachedApproach.conversationStarters);
          }
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
        await stampBrainOnCompany(input.companyId, ctx.user.id);

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
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

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
      // Prefer websiteUrl, fall back to primaryDomain
      const domain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : company.primaryDomain || null;
      if (!domain) throw new TRPCError({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable contact search." });

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
      await assertCompanyAccess(input.companyId, ctx.user.id);
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
      brainId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
      
      // Create search record in "extracting" status
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: normalizedUrl,
        location: input.location,
        status: "extracting",
        ...(input.brainId ? { brainId: input.brainId } : {}),
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
      brainId: z.number().optional(),
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
        ...(input.brainId ? { brainId: input.brainId } : {}),
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
      const search = await assertSearchOwner(input.searchId, ctx.user.id);

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

  // Create brain from uploaded Excel file
  uploadBrainExcel: protectedProcedure
    .input(z.object({
      fileBase64: z.string().min(1),  // base64-encoded xlsx file
      brainName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Decode base64 → Buffer
      const buffer = Buffer.from(input.fileBase64, "base64");

      // Parse the Excel template
      const { raw, brainName: parsedBrainName, warnings } = parseOfferingExcel(buffer);

      const finalBrainName = input.brainName?.trim() || parsedBrainName;
      const companyName = raw.companyName || "Unknown Company";
      const companyWebsite = raw.companyWebsite || "";

      console.log(`[Brain Excel] Parsed brain for ${companyName}, warnings: ${warnings.length}`);

      // Create a brain record with "researching" status
      const brainId = await createOfferingBrain({
        userId: ctx.user.id,
        brainName: finalBrainName,
        companyName,
        companyWebsite,
        status: "researching",
      });

      try {
        // Run LLM normalisation to fill gaps and clean phrasing
        const result = await normaliseBrainFromExcel(raw);

        // Store structured intelligence (same shape as website research path)
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

        console.log(`[Brain Excel] ✓ Brain saved for ${companyName}`);

        const brain = await getActiveBrain(ctx.user.id);
        return { brain, isNew: true, warnings };
      } catch (error: any) {
        console.error(`[Brain Excel] Failed:`, error);
        await updateOfferingBrain(brainId, {
          status: "failed",
          rawResearchData: JSON.stringify({ error: error.message }),
        });
        throw new Error(`Brain Excel upload failed: ${error.message}`);
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

  // Get single company with all data (for Company Detail page)
  getCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      const contacts = await getContactsByCompanyId(input.companyId);
      const decision = await getCompanyDecision(input.companyId, ctx.user.id);
      const search = await getSearchById(company.searchId);
      return {
        company,
        contacts,
        decision: decision ?? null,
        search: search ?? null,
      };
    }),

  // Get all contacts for a company
  getCompanyContacts: protectedProcedure
    .input(z.object({
      companyId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await assertCompanyAccess(input.companyId, ctx.user.id);
      const contacts = await getContactsByCompanyId(input.companyId);
      return { contacts };
    }),

  // Find all C-Suite contacts at a company (trickle-down approach)
  findAllCSuite: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      includePhone: z.boolean().optional(),
      maxContacts: z.number().optional(), // Max contacts to return per tier
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

      const domain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : company.primaryDomain || null;
      if (!domain) throw new TRPCError({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable contact search." });

      console.log(`[Trickle-Down] Starting trickle-down search at ${company.name} (${domain})`);

      // Check existing contacts to avoid duplicates
      const existingContacts = await getContactsByCompanyId(input.companyId);
      if (existingContacts.length > 0) {
        console.log(`[Trickle-Down] Found ${existingContacts.length} existing contacts, returning cached`);
        return {
          contacts: existingContacts,
          tierFound: 0,
          tierLabel: "Cached",
          tiersSearched: [],
          cached: true,
        };
      }

      // Run trickle-down search
      const result = await trickleDownSearch(
        domain,
        company.name,
        input.maxContacts || 5,
        input.includePhone || false,
      );

      // Save found contacts to database (deduplicated)
      const savedContacts: any[] = [];
      const seenEmails = new Set<string>();
      const seenNames = new Set<string>();

      for (const contact of result.contacts) {
        const contactEmail = contact.email?.toLowerCase();
        const contactName = contact.name?.toLowerCase();

        // Skip duplicates
        if ((contactEmail && seenEmails.has(contactEmail)) ||
            (contactName && seenNames.has(contactName))) {
          continue;
        }

        try {
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
            searchedTitle: `Tier ${result.tierFound}: ${result.tierLabel}`,
          });
          savedContacts.push(savedContact);
          if (contactEmail) seenEmails.add(contactEmail);
          if (contactName) seenNames.add(contactName);
        } catch (err: any) {
          console.error(`[Trickle-Down] Failed to save contact ${contact.name}:`, err.message);
        }
      }

      console.log(`[Trickle-Down] Completed: ${savedContacts.length} contacts saved from Tier ${result.tierFound} (${result.tierLabel})`);

      return {
        contacts: savedContacts,
        tierFound: result.tierFound,
        tierLabel: result.tierLabel,
        tiersSearched: result.tiersSearched,
        cached: false,
      };
    }),

  // Get all personnel at a company (no seniority filtering)
  getAllPersonnel: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      includePhone: z.boolean().optional(),
      limit: z.number().optional(),         // Max contacts to return (default 25)
      seniorities: z.array(z.string()).optional(), // e.g. ["owner","founder","c_suite","vp","head"]
      department: z.string().optional(),    // e.g. "engineering", "operations", "any"
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

      const domain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : company.primaryDomain || null;
      if (!domain) throw new TRPCError({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable contact search." });

      console.log(`[Get All Personnel] Starting search at ${company.name} (${domain}), seniorities: ${input.seniorities?.join(",") || "all"}, dept: ${input.department || "any"}`);

      // Run get all personnel search (basic data only, no enrichment)
      const result = await getAllPersonnel(
        domain,
        company.name,
        input.limit || 25,
        input.seniorities,
        input.department
      );

      // Save found contacts to database (deduplicated)
      const savedContacts: any[] = [];
      const seenEmails = new Set<string>();
      const seenNames = new Set<string>();

      for (const contact of result.contacts) {
        const contactEmail = contact.email?.toLowerCase();
        const contactName = contact.name?.toLowerCase();

        // Skip duplicates
        if ((contactEmail && seenEmails.has(contactEmail)) ||
            (contactName && seenNames.has(contactName))) {
          continue;
        }

        try {
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
            searchedTitle: "All Personnel",
          });
          savedContacts.push(savedContact);
          if (contactEmail) seenEmails.add(contactEmail);
          if (contactName) seenNames.add(contactName);
        } catch (err: any) {
          console.error(`[Get All Personnel] Failed to save contact ${contact.name}:`, err.message);
        }
      }

      console.log(`[Get All Personnel] Completed: ${savedContacts.length} contacts saved (total found: ${result.totalFound})`);

      return {
        contacts: savedContacts,
        totalFound: result.totalFound,
      };
    }),

  // Enrich a specific contact with email/phone (selective enrichment)
  enrichContact: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      includePhone: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get contact from database
      const contacts = await getContactsByCompanyId(0); // We need to add getContactById to db.ts
      const contact = contacts.find((c: any) => c.id === input.contactId);
      if (!contact) throw new Error("Contact not found");

      // Get company to get domain (also checks access)
      const company = await assertCompanyAccess(contact.companyId, ctx.user.id);

      const domain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : company.primaryDomain || null;
      if (!domain) throw new TRPCError({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable enrichment." });

      console.log(`[Enrich Contact] Enriching ${contact.fullName} at ${company.name}`);

      // Enrich with Apollo
      if (!contact.firstName || !contact.lastName) {
        throw new Error("Contact must have first name and last name for enrichment");
      }

      const enriched = await enrichPerson(
        contact.firstName,
        contact.lastName,
        domain,
        input.includePhone || false
      );

      // Update contact in database
      const updatedContact = await createContact({
        companyId: contact.companyId,
        apolloPersonId: contact.apolloPersonId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.fullName,
        title: contact.title,
        email: enriched.email || contact.email || null,
        phone: enriched.phone || contact.phone || null,
        linkedinUrl: enriched.linkedinUrl || contact.linkedinUrl || null,
        searchedTitle: contact.searchedTitle,
      });

      console.log(`[Enrich Contact] Completed: ${updatedContact.fullName} enriched`);

      return {
        contact: updatedContact,
      };
    }),

  // Force re-research a company — clears cache and regenerates brief fresh
  reResearchCompany: protectedProcedure
    .input(z.object({
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

      console.log(`[reResearch] Clearing cache and regenerating brief for ${company.name}`);

      // Clear cached brief so generator runs fresh
      await updateCompany(input.companyId, {
        briefData: null,
        briefGeneratedAt: null,
      });

      const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
      try {
        const brief = await generateSalesIntelligenceBrief(input.companyId, ctx.user.id);
        await updateCompany(input.companyId, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: new Date(),
        });
        await stampBrainOnCompany(input.companyId, ctx.user.id);
        console.log(`[reResearch] ✓ Brief regenerated for ${company.name} — urgency: ${brief.urgencyScore}`);
        return { success: true, brief };
      } catch (error: any) {
        console.error(`[reResearch] Error:`, error);
        throw new Error(`Failed to re-research: ${error.message}`);
      }
    }),

  // ---------------------------------------------------------------------------
  // toggleShareSearch — share/unshare a campaign with all team members
  // ---------------------------------------------------------------------------
  toggleShareSearch: protectedProcedure
    .input(z.object({ searchId: z.number(), shared: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchOwner(input.searchId, ctx.user.id);
      await toggleShareSearch(input.searchId, ctx.user.id, input.shared);
      return { success: true, shared: input.shared };
    }),

  // ---------------------------------------------------------------------------
  // nameEnrichCampaign — name-based Apollo enrichment for conference imports
  // Processes all pending companies with no apolloId/domain using organizations/search
  // ---------------------------------------------------------------------------
  nameEnrichCampaign: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      limit: z.number().min(1).max(500).default(200),
      concurrency: z.number().min(1).max(5).default(3),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);

      const { apolloEnrichByName } = await import("./conferenceScraper");
      const pending = await getPendingCompaniesBySearchId(input.searchId);
      const toEnrich = pending
        .filter((c: any) => !c.apolloId && !c.primaryDomain)
        .filter((c: any) => c.name && c.name.length > 1)
        .filter((c: any) => !c.websiteUrl || !c.websiteUrl.includes("localhost"))
        .slice(0, input.limit);

      let enriched = 0;
      let failed = 0;

      for (let i = 0; i < toEnrich.length; i += input.concurrency) {
        const batch = toEnrich.slice(i, i + input.concurrency);
        await Promise.all(
          batch.map(async (company: any) => {
            try {
              const countryHint = company.sourceCountryCode || company.country || null;
              const result = await apolloEnrichByName(company.name, countryHint);
              if (result) {
                await updateCompany(company.id, {
                  apolloId: result.apolloId || undefined,
                  name: result.name || company.name,
                  websiteUrl: result.websiteUrl || undefined,
                  primaryDomain: result.primaryDomain || undefined,
                  linkedinUrl: result.linkedinUrl || undefined,
                  phone: result.phone || undefined,
                  foundedYear: result.foundedYear || undefined,
                  revenue: result.revenue || undefined,
                  headcountGrowth: result.headcountGrowth || undefined,
                  city: result.city || undefined,
                  state: result.state || undefined,
                  country: result.country || undefined,
                  streetAddress: result.streetAddress || undefined,
                  sicCodes: result.sicCodes?.length ? JSON.stringify(result.sicCodes) : undefined,
                  naicsCodes: result.naicsCodes?.length ? JSON.stringify(result.naicsCodes) : undefined,
                  enrichmentStatus: "enriched",
                });
                enriched++;
              } else {
                await updateCompany(company.id, { enrichmentStatus: "failed" });
                failed++;
              }
            } catch {
              await updateCompany(company.id, { enrichmentStatus: "failed" });
              failed++;
            }
          })
        );
        if (i + input.concurrency < toEnrich.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      return { success: true, total: toEnrich.length, enriched, failed };
    }),

  // ---------------------------------------------------------------------------
  // batchSalesApproach — generate sales approaches for all enriched companies in a search
  // ---------------------------------------------------------------------------
  batchSalesApproach: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      skipCached: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getCompaniesBySearchId } = await import("./db");
      const { generateSalesApproach } = await import("./salesApproachGenerator");

      const allCompanies = await getCompaniesBySearchId(input.searchId);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Only process enriched companies that also have a brief (sales approach needs deep research)
      const toProcess = allCompanies.filter((c) => {
        if (c.enrichmentStatus !== "enriched") return false;
        if (!c.briefData) return false; // needs deep research first
        if (!input.skipCached) return true;
        if (!c.salesApproachData || !c.salesApproachGeneratedAt) return true;
        const age = Date.now() - new Date(c.salesApproachGeneratedAt).getTime();
        return age >= sevenDaysMs;
      });

      console.log(`[batchSalesApproach] searchId=${input.searchId} — ${toProcess.length} companies to process`);

      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const company of toProcess) {
        try {
          const salesApproach = await generateSalesApproach(company.id, ctx.user.id);
          await updateCompany(company.id, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: new Date(),
          });
          completed++;
          console.log(`[batchSalesApproach] ✓ ${company.name} (${completed}/${toProcess.length})`);
        } catch (err: any) {
          failed++;
          errors.push(`${company.name}: ${err.message}`);
          console.error(`[batchSalesApproach] ✗ ${company.name}:`, err.message);
        }
      }

      return {
        success: true,
        total: toProcess.length,
        completed,
        failed,
        skippedNoResearch: allCompanies.filter((c) => c.enrichmentStatus === "enriched" && !c.briefData).length,
        errors: errors.slice(0, 10),
      };
    }),

  // ---------------------------------------------------------------------------
  // batchResearchAndOutreach — run deep research THEN sales approach for all enriched companies
  // ---------------------------------------------------------------------------
  batchResearchAndOutreach: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      skipCached: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getCompaniesBySearchId } = await import("./db");
      const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
      const { generateSalesApproach } = await import("./salesApproachGenerator");

      const allCompanies = await getCompaniesBySearchId(input.searchId);
      const enriched = allCompanies.filter((c) => c.enrichmentStatus === "enriched");
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // --- Phase 1: Deep Research ---
      const toResearch = enriched.filter((c) => {
        if (!input.skipCached) return true;
        if (!c.briefData || !c.briefGeneratedAt) return true;
        return Date.now() - new Date(c.briefGeneratedAt).getTime() >= sevenDaysMs;
      });

      let researchCompleted = 0;
      let researchFailed = 0;

      console.log(`[batchResearchAndOutreach] Phase 1: ${toResearch.length} companies to research`);
      for (const company of toResearch) {
        try {
          const brief = await generateSalesIntelligenceBrief(company.id, ctx.user.id);
          await updateCompany(company.id, {
            urgencyScore: brief.urgencyScore,
            briefData: JSON.stringify(brief),
            briefGeneratedAt: new Date(),
          });
          researchCompleted++;
          console.log(`[batchResearchAndOutreach] ✓ Research: ${company.name} (${researchCompleted}/${toResearch.length})`);
        } catch (err: any) {
          researchFailed++;
          console.error(`[batchResearchAndOutreach] ✗ Research: ${company.name}:`, err.message);
        }
      }

      // Re-fetch companies so sales approach sees fresh briefData
      const refreshedCompanies = await getCompaniesBySearchId(input.searchId);
      const enrichedRefreshed = refreshedCompanies.filter((c) => c.enrichmentStatus === "enriched");

      // --- Phase 2: Sales Approach ---
      const toApproach = enrichedRefreshed.filter((c) => {
        if (!c.briefData) return false; // must have research
        if (!input.skipCached) return true;
        if (!c.salesApproachData || !c.salesApproachGeneratedAt) return true;
        return Date.now() - new Date(c.salesApproachGeneratedAt).getTime() >= sevenDaysMs;
      });

      let approachCompleted = 0;
      let approachFailed = 0;

      console.log(`[batchResearchAndOutreach] Phase 2: ${toApproach.length} companies for sales approach`);
      for (const company of toApproach) {
        try {
          const salesApproach = await generateSalesApproach(company.id, ctx.user.id);
          await updateCompany(company.id, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: new Date(),
          });
          approachCompleted++;
          console.log(`[batchResearchAndOutreach] ✓ Approach: ${company.name} (${approachCompleted}/${toApproach.length})`);
        } catch (err: any) {
          approachFailed++;
          console.error(`[batchResearchAndOutreach] ✗ Approach: ${company.name}:`, err.message);
        }
      }

      return {
        success: true,
        research: { total: toResearch.length, completed: researchCompleted, failed: researchFailed },
        approach: { total: toApproach.length, completed: approachCompleted, failed: approachFailed },
      };
    }),

  // ---------------------------------------------------------------------------
  // batchGenerateBriefs — run deep research for all enriched companies in a search
  // ---------------------------------------------------------------------------
  batchGenerateBriefs: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      skipCached: z.boolean().optional().default(true), // skip companies with a brief < 7 days old
    }))
    .mutation(async ({ ctx, input }) => {
      const { getCompaniesBySearchId } = await import("./db");
      const { generateSalesIntelligenceBrief } = await import("./briefGenerator");

      const allCompanies = await getCompaniesBySearchId(input.searchId);

      // Only process enriched companies (need a domain for Grok web search)
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const toResearch = allCompanies.filter((c) => {
        if (c.enrichmentStatus !== "enriched") return false;
        if (!input.skipCached) return true;
        if (!c.briefData || !c.briefGeneratedAt) return true;
        const age = Date.now() - new Date(c.briefGeneratedAt).getTime();
        return age >= sevenDaysMs; // skip fresh briefs
      });

      console.log(`[batchGenerateBriefs] searchId=${input.searchId} — ${toResearch.length} companies to research (${allCompanies.length} total)`);

      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process sequentially to avoid hammering Grok / rate limits
      for (const company of toResearch) {
        try {
          const brief = await generateSalesIntelligenceBrief(company.id, ctx.user.id);
          await updateCompany(company.id, {
            urgencyScore: brief.urgencyScore,
            briefData: JSON.stringify(brief),
            briefGeneratedAt: new Date(),
          });
          completed++;
          console.log(`[batchGenerateBriefs] ✓ ${company.name} (${completed}/${toResearch.length})`);
        } catch (err: any) {
          failed++;
          errors.push(`${company.name}: ${err.message}`);
          console.error(`[batchGenerateBriefs] ✗ ${company.name}:`, err.message);
        }
      }

      return {
        success: true,
        total: toResearch.length,
        completed,
        failed,
        errors: errors.slice(0, 10), // cap error list
      };
    }),

  // ---------------------------------------------------------------------------
  // scoreCompanyFit — Grok-powered ICP fit scoring (0-100) with full breakdown
  // ---------------------------------------------------------------------------
  scoreCompanyFit: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

      const { scoreCompanyFit } = await import("./briefGenerator");
      try {
        const result = await scoreCompanyFit(input.companyId, ctx.user.id);
        await updateCompany(input.companyId, {
          fitScore: result.fitScore,
          fitScoreData: JSON.stringify(result),
        });
        await stampBrainOnCompany(input.companyId, ctx.user.id);
        console.log(`[Fit Score] ✓ ${company.name} → ${result.fitScore}`);
        return { success: true, result };
      } catch (error: any) {
        console.error(`[Fit Score] Error:`, error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

  // Log a call outcome for a company
  logCallOutcome: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      outcome: z.enum(["reached", "voicemail", "no_answer", "meeting_booked", "not_interested"]),
      notes: z.string().optional(),
      followUpDate: z.string().optional(), // YYYY-MM-DD
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCompanyAccess(input.companyId, ctx.user.id);
      const { getDb } = await import("./db");
      const { callOutcomes } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(callOutcomes).values({
        companyId: input.companyId,
        userId: ctx.user.id,
        outcome: input.outcome,
        notes: input.notes ?? null,
        followUpDate: input.followUpDate ?? null,
      });
      return { success: true };
    }),

  // Get call outcomes for a company
  getCallOutcomes: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCompanyAccess(input.companyId, ctx.user.id);
      const { getDb } = await import("./db");
      const { callOutcomes } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { outcomes: [] };
      const outcomes = await db
        .select()
        .from(callOutcomes)
        .where(eq(callOutcomes.companyId, input.companyId))
        .orderBy(desc(callOutcomes.createdAt));
      return { outcomes };
    }),

  // Get all companies with follow-up dates set (nurture list)
  getNurtureList: protectedProcedure
    .query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { callOutcomes, companies, searches } = await import("../drizzle/schema");
      const { eq, and, isNotNull, asc, desc, sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { items: [] };

      // Get all call outcomes with follow-up dates for this user, joined with company info
      const rows = await db
        .select({
          outcomeId: callOutcomes.id,
          outcome: callOutcomes.outcome,
          notes: callOutcomes.notes,
          followUpDate: callOutcomes.followUpDate,
          createdAt: callOutcomes.createdAt,
          companyId: companies.id,
          companyName: companies.name,
          companyWebsite: companies.websiteUrl,
          companyCity: companies.city,
          companyCountry: companies.country,
          urgencyScore: companies.urgencyScore,
          searchId: companies.searchId,
        })
        .from(callOutcomes)
        .innerJoin(companies, eq(callOutcomes.companyId, companies.id))
        .where(
          and(
            eq(callOutcomes.userId, ctx.user.id),
            isNotNull(callOutcomes.followUpDate)
          )
        )
        .orderBy(asc(callOutcomes.followUpDate));

      // Deduplicate: keep only the latest outcome per company that has a follow-up date
      const seen = new Set<number>();
      const items = rows.filter(r => {
        if (seen.has(r.companyId)) return false;
        seen.add(r.companyId);
        return true;
      });

      const today = new Date().toISOString().slice(0, 10);
      return {
        items: items.map(item => ({
          ...item,
          isOverdue: !!(item.followUpDate && item.followUpDate < today),
          isDueToday: item.followUpDate === today,
        }))
      };
    }),

  // Generate a 1-sentence call readiness summary for a company
  // v2: Rich context from brief, approach, leadinfo, fit score, and brain
  generateCallReadiness: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      const { invokeLLM } = await import("./_core/llm");
      const { WHY_CALL_TODAY } = await import("./prompts/index");

      // Parse all available intelligence
      const brief = company.briefData ? (() => { try { return JSON.parse(company.briefData); } catch { return null; } })() : null;
      const approach = company.salesApproachData ? (() => { try { return JSON.parse(company.salesApproachData); } catch { return null; } })() : null;
      const fitData = company.fitScoreData ? (() => { try { return JSON.parse(company.fitScoreData); } catch { return null; } })() : null;
      const signalOpeners = company.signalOpeners ? (() => { try { return JSON.parse(company.signalOpeners); } catch { return null; } })() : null;

      // Fetch Leadinfo visitor data if available
      let leadinfoVisit: any = null;
      try {
        const { getDb } = await import("./db");
        const { leadinfoVisits } = await import("../drizzle/schema");
        const { eq, sql } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const rows = await db.select().from(leadinfoVisits)
            .where(eq(leadinfoVisits.companyId, input.companyId))
            .orderBy(sql`${leadinfoVisits.importedAt} DESC`)
            .limit(1);
          leadinfoVisit = rows[0] || null;
        }
      } catch { /* Leadinfo not available, continue without it */ }

      // Load Brain context for offering awareness
      let brainOffering = "";
      try {
        const brain = await getActiveBrain(ctx.user.id);
        if (brain && brain.status === "completed") {
          brainOffering = brain.offeringSummary || "";
        }
      } catch { /* no brain, continue */ }

      // Build rich context — prioritise actionable signals over generic facts
      const contextParts: string[] = [];

      contextParts.push(`COMPANY: ${company.name}`);
      if (company.city) contextParts.push(`Location: ${company.city}, ${company.country ?? ""}`);

      // Seller's offering (so the LLM can connect trigger to offering)
      if (brainOffering) {
        contextParts.push(`\nSELLER'S OFFERING: ${brainOffering}`);
      }

      // HIGHEST PRIORITY: Website visitor data (Leadinfo)
      if (leadinfoVisit) {
        const visitParts = [`\nWEBSITE VISITOR (STRONGEST SIGNAL):`];
        visitParts.push(`- This company visited your website`);
        if (leadinfoVisit.totalSessions) visitParts.push(`- Sessions: ${leadinfoVisit.totalSessions}`);
        if (leadinfoVisit.totalPages) visitParts.push(`- Pages viewed: ${leadinfoVisit.totalPages}`);
        if (leadinfoVisit.engagementScore) visitParts.push(`- Engagement score: ${leadinfoVisit.engagementScore}`);
        const intentSignals = leadinfoVisit.intentSignals ? (() => { try { return JSON.parse(leadinfoVisit.intentSignals); } catch { return []; } })() : [];
        if (intentSignals.length) visitParts.push(`- Intent signals: ${intentSignals.join(", ")}`);
        const topPages = leadinfoVisit.topPages ? (() => { try { return JSON.parse(leadinfoVisit.topPages); } catch { return []; } })() : [];
        if (topPages.length) visitParts.push(`- Top pages: ${topPages.join(", ")}`);
        contextParts.push(visitParts.join("\n"));
      }

      // Urgency signals — the concrete trigger events
      if (brief?.urgencySignals?.length) {
        const topSignals = brief.urgencySignals
          .sort((a: any, b: any) => (b.weight ?? 0) - (a.weight ?? 0))
          .slice(0, 3);
        contextParts.push(`\nURGENCY SIGNALS (trigger events):`);
        topSignals.forEach((s: any) => {
          contextParts.push(`- [${s.category}/${s.type}] ${s.description}`);
        });
      }

      // Recent developments — concrete news
      if (brief?.recentDevelopments?.length) {
        const topDevs = brief.recentDevelopments.slice(0, 3);
        contextParts.push(`\nRECENT NEWS:`);
        topDevs.forEach((d: any) => {
          const text = d.text || d.headline || d.summary || d;
          const date = d.date ? ` (${d.date})` : "";
          contextParts.push(`- ${text}${date}`);
        });
      }

      // Pre-generated signal openers (if available, use the best one as a hint)
      if (Array.isArray(signalOpeners) && signalOpeners.length > 0) {
        const best = signalOpeners[0];
        if (best?.opener) {
          contextParts.push(`\nBEST SIGNAL OPENER (for reference): "${best.opener}"`);
        }
      }

      // Fit rationale (brief, not the score number)
      if (fitData?.overallRationale) {
        contextParts.push(`\nFIT RATIONALE: ${fitData.overallRationale}`);
      }

      const context = contextParts.join("\n");

      const result = await invokeLLM({
        messages: [
          { role: "system", content: WHY_CALL_TODAY.systemPrompt },
          { role: "user", content: context },
        ],
      });

      const rawContent = result.choices?.[0]?.message?.content;
      const summary = typeof rawContent === "string" ? rawContent.trim().replace(/^"|"$/g, "") : "";
      await updateCompany(input.companyId, { callReadinessSummary: summary });
      await stampBrainOnCompany(input.companyId, ctx.user.id);
      return { summary };
    }),

  // Batch-refresh "Why Call Today" summaries for all companies in a campaign
  // Uses the v2 rich-context prompt for every company that has briefData
  batchRefreshCallReadiness: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const allCompanies = await getCompaniesBySearchId(input.searchId);
      const { invokeLLM } = await import("./_core/llm");
      const { WHY_CALL_TODAY } = await import("./prompts/index");
      const { getDb } = await import("./db");
      const { leadinfoVisits } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");

      // Only process companies that have brief data (enriched + researched)
      const eligible = allCompanies.filter(c => c.briefData && c.enrichmentStatus === "enriched");

      // Load brain offering once
      let brainOffering = "";
      try {
        const brain = await getActiveBrain(ctx.user.id);
        if (brain && brain.status === "completed") brainOffering = brain.offeringSummary || "";
      } catch { /* no brain */ }

      // Pre-load all Leadinfo visits for this campaign in one query
      const db = await getDb();
      const leadinfoMap = new Map<number, any>();
      if (db) {
        try {
          const allVisits = await db.select().from(leadinfoVisits)
            .where(eq(leadinfoVisits.searchId, input.searchId));
          for (const v of allVisits) {
            if (v.companyId) leadinfoMap.set(v.companyId, v);
          }
        } catch { /* no leadinfo table or data */ }
      }

      let completed = 0;
      let failed = 0;

      for (const company of eligible) {
        try {
          const brief = JSON.parse(company.briefData!);
          const fitData = company.fitScoreData ? JSON.parse(company.fitScoreData) : null;
          const signalOpeners = company.signalOpeners ? JSON.parse(company.signalOpeners) : null;
          const leadinfoVisit = leadinfoMap.get(company.id) || null;

          // Build rich context (same logic as single-company version)
          const contextParts: string[] = [`COMPANY: ${company.name}`];
          if (company.city) contextParts.push(`Location: ${company.city}, ${company.country ?? ""}`);
          if (brainOffering) contextParts.push(`\nSELLER'S OFFERING: ${brainOffering}`);

          if (leadinfoVisit) {
            const vp = [`\nWEBSITE VISITOR (STRONGEST SIGNAL):`, `- This company visited your website`];
            if (leadinfoVisit.totalSessions) vp.push(`- Sessions: ${leadinfoVisit.totalSessions}`);
            if (leadinfoVisit.totalPages) vp.push(`- Pages viewed: ${leadinfoVisit.totalPages}`);
            const intentSigs = leadinfoVisit.intentSignals ? (() => { try { return JSON.parse(leadinfoVisit.intentSignals); } catch { return []; } })() : [];
            if (intentSigs.length) vp.push(`- Intent signals: ${intentSigs.join(", ")}`);
            contextParts.push(vp.join("\n"));
          }

          if (brief?.urgencySignals?.length) {
            const topSigs = brief.urgencySignals.sort((a: any, b: any) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 3);
            contextParts.push(`\nURGENCY SIGNALS:`);
            topSigs.forEach((s: any) => contextParts.push(`- [${s.category}/${s.type}] ${s.description}`));
          }

          if (brief?.recentDevelopments?.length) {
            contextParts.push(`\nRECENT NEWS:`);
            brief.recentDevelopments.slice(0, 3).forEach((d: any) => {
              const text = d.text || d.headline || d.summary || d;
              const date = d.date ? ` (${d.date})` : "";
              contextParts.push(`- ${text}${date}`);
            });
          }

          if (Array.isArray(signalOpeners) && signalOpeners[0]?.opener) {
            contextParts.push(`\nBEST SIGNAL OPENER: "${signalOpeners[0].opener}"`);
          }

          if (fitData?.overallRationale) {
            contextParts.push(`\nFIT RATIONALE: ${fitData.overallRationale}`);
          }

          const result = await invokeLLM({
            messages: [
              { role: "system", content: WHY_CALL_TODAY.systemPrompt },
              { role: "user", content: contextParts.join("\n") },
            ],
          });

          const raw = result.choices?.[0]?.message?.content;
          const summary = typeof raw === "string" ? raw.trim().replace(/^"|"$/g, "") : "";
          await updateCompany(company.id, { callReadinessSummary: summary });
          completed++;
          console.log(`[BatchCallReadiness] ✓ ${company.name}: ${summary.slice(0, 60)}...`);
        } catch (err: any) {
          failed++;
          console.error(`[BatchCallReadiness] ✗ ${company.name}: ${err.message}`);
        }
      }

      return { total: eligible.length, completed, failed };
    }),

  // Fetch and cache product images for a company via Serper Images API
  fetchProductImages: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

      // Return cached images if already fetched
      if (company.productImages) {
        try {
          const cached = JSON.parse(company.productImages);
          if (Array.isArray(cached) && cached.length > 0) {
            return { images: cached, cached: true };
          }
        } catch { /* fall through to re-fetch */ }
      }

      const { fetchSerperImages } = await import("./serperImages");
      const images = await fetchSerperImages(company.name, company.primaryDomain, 6);
      await updateCompany(input.companyId, { productImages: JSON.stringify(images) });
      return { images, cached: false };
    }),

  // Return cached product images without re-fetching (for initial page load)
  getProductImages: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      if (!company.productImages) return { images: [] };
      try {
        const images = JSON.parse(company.productImages);
        return { images: Array.isArray(images) ? images : [] };
      } catch {
        return { images: [] };
      }
    }),

  // ---------------------------------------------------------------------------
  // fetchUrgencyImages — editorial/news images for the Urgency tab (Serper)
  // ---------------------------------------------------------------------------
  fetchUrgencyImages: protectedProcedure
    .input(z.object({ companyId: z.number(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      // Return cached images unless force-refresh requested
      if (!input.force && company.urgencyImages) {
        try {
          const cached = JSON.parse(company.urgencyImages);
          if (Array.isArray(cached) && cached.length > 0) {
            return { images: cached, cached: true };
          }
        } catch { /* fall through to re-fetch */ }
      }
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        console.warn("[fetchUrgencyImages] SERPER_API_KEY not configured — returning empty images");
        return { images: [], cached: false };
      }
      // Editorial/news-style query — not product-focused
      const query = `"${company.name}" news 2025 2026 -site:amazon.com -site:pinterest.com -site:shutterstock.com -site:gettyimages.com`;
      let data: { images?: any[] } = {};
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        let response: Response;
        try {
          response = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q: query, num: 12 }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        if (response.ok) {
          data = await response.json() as { images?: any[] };
        } else {
          console.warn(`[fetchUrgencyImages] Serper news query returned ${response.status} — falling back to empty`);
        }
      } catch (err: any) {
        console.warn(`[fetchUrgencyImages] Serper news query failed: ${err.message} — falling back to empty`);
      }
      const BLOCKED = new Set(["amazon.com","ebay.com","alibaba.com","pinterest.com",
        "shutterstock.com","gettyimages.com","istockphoto.com","dreamstime.com",
        "alamy.com","depositphotos.com","123rf.com","google.com","bing.com"]);
      const images = (data.images ?? [])
        .filter((img: any) => {
          const d = (img.domain ?? "").replace(/^www\./, "").toLowerCase();
          return img.imageUrl && !BLOCKED.has(d);
        })
        .slice(0, 8)
        .map((img: any) => ({
          imageUrl: img.imageUrl ?? "",
          thumbnailUrl: img.thumbnailUrl ?? "",
          title: img.title ?? "",
          source: img.source ?? img.domain ?? "",
          domain: img.domain ?? "",
          link: img.link ?? "",
        }));
       // If news query returned nothing, fall back to the company's own website domain
      if (images.length === 0) {
        const websiteUrl = company.websiteUrl || company.primaryDomain;
        if (websiteUrl) {
          try {
            const rawDomain = websiteUrl
              .replace(/^https?:\/\//i, "")
              .replace(/^www\./i, "")
              .split("/")[0]
              .split("?")[0]
              .toLowerCase();
            if (rawDomain) {
              const wsController = new AbortController();
              const wsTimeoutId = setTimeout(() => wsController.abort(), 10_000);
              let websiteResponse: Response | null = null;
              try {
                websiteResponse = await fetch("https://google.serper.dev/images", {
                  method: "POST",
                  headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ q: `site:${rawDomain}`, num: 12 }),
                  signal: wsController.signal,
                });
              } catch (wsErr: any) {
                console.warn(`[fetchUrgencyImages] Serper website fallback failed: ${wsErr.message}`);
              } finally {
                clearTimeout(wsTimeoutId);
              }
              if (websiteResponse?.ok) {
                const websiteData = await websiteResponse.json() as { images?: any[] };
                const websiteImages = (websiteData.images ?? [])
                  .filter((img: any) => img.imageUrl)
                  .slice(0, 8)
                  .map((img: any) => ({
                    imageUrl: img.imageUrl ?? "",
                    thumbnailUrl: img.thumbnailUrl ?? "",
                    title: img.title ?? "",
                    source: img.source ?? img.domain ?? "",
                    domain: img.domain ?? "",
                    link: img.link ?? "",
                    _fallback: "website",
                  }));
                if (websiteImages.length > 0) {
                  await updateCompany(input.companyId, { urgencyImages: JSON.stringify(websiteImages) });
                  return { images: websiteImages, cached: false, fallback: "website" as const };
                }
              }
            }
          } catch { /* ignore website fallback errors */ }
        }
      }

      await updateCompany(input.companyId, { urgencyImages: JSON.stringify(images) });
      return { images, cached: false };
    }),
  getUrgencyImages: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      if (!company.urgencyImages) return { images: [] };
      try {
        const images = JSON.parse(company.urgencyImages);
        return { images: Array.isArray(images) ? images : [] };
      } catch {
        return { images: [] };
      }
    }),

  // ---------------------------------------------------------------------------
  // getBatchStatus — returns per-company research/approach status for a search
  // ---------------------------------------------------------------------------
  getBatchStatus: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getCompaniesBySearchId } = await import("./db");
      await assertSearchAccess(input.searchId, ctx.user.id);
      const companies = await getCompaniesBySearchId(input.searchId);
      const enriched = companies.filter((c) => c.enrichmentStatus === "enriched");
      const hasResearch = enriched.filter((c) => c.briefData != null);
      const hasApproach = enriched.filter((c) => c.salesApproachData != null);
      const missingApproach = hasResearch.filter((c) => c.salesApproachData == null);
      return {
        total: enriched.length,
        researched: hasResearch.length,
        approached: hasApproach.length,
        missingApproach: missingApproach.length,
        missingApproachIds: missingApproach.map((c) => c.id),
      };
    }),

  // ---------------------------------------------------------------------------
  // completeMissingApproach — run sales approach ONLY for companies that have
  // research but no salesApproachData (catch-up after a partial batch run)
  // ---------------------------------------------------------------------------
  completeMissingApproach: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getCompaniesBySearchId } = await import("./db");
      const { generateSalesApproach } = await import("./salesApproachGenerator");
      await assertSearchAccess(input.searchId, ctx.user.id);

      const companies = await getCompaniesBySearchId(input.searchId);
      const toApproach = companies.filter(
        (c) => c.enrichmentStatus === "enriched" && c.briefData != null && c.salesApproachData == null
      );

      console.log(`[completeMissingApproach] searchId=${input.searchId} — ${toApproach.length} companies need sales approach`);

      let completed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const company of toApproach) {
        try {
          const salesApproach = await generateSalesApproach(company.id, ctx.user.id);
          await updateCompany(company.id, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: new Date(),
          });
          completed++;
          console.log(`[completeMissingApproach] ✓ ${company.name} (${completed}/${toApproach.length})`);
        } catch (err: any) {
          failed++;
          errors.push(`${company.name}: ${err.message}`);
          console.error(`[completeMissingApproach] ✗ ${company.name}:`, err.message);
        }
      }

      return { success: true, total: toApproach.length, completed, failed, errors: errors.slice(0, 10) };
    }),

  // ── Per-signal approach sub-agent ──────────────────────────────────────────
  // Takes one urgency signal + companyId, returns one targeted conversation
  // starter grounded in that specific signal. Fast (no web search), uses
  // invokeLLM with Offering Brain context injected.
  generateSalesRepProfile: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { invokeLLM } = await import("./_core/llm");
      const { getActiveBrain, getCompanyById } = await import("./db");

      const company = await getCompanyById(input.companyId);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      let brainContext = "";
      let sellerName = "Your Company";
      try {
        const brain = await getActiveBrain(ctx.user.id);
        if (brain && brain.status === "completed") {
          sellerName = brain.companyName || sellerName;
          const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
          const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
          brainContext = `
SELLER: ${brain.companyName}
Offering: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp: any) => vp.proposition).join("; ")}
`;
        }
      } catch (_) { /* use defaults */ }

      const briefData = company.briefData ? (typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData) : null;
      const sliceMeta = company.sliceMetadata ? (() => { try { return JSON.parse(company.sliceMetadata as string); } catch { return {}; } })() : {};
      const companyContext = briefData ? `
COMPANY: ${company.name}
Industry: ${sliceMeta.industry || "unknown"}
Size: ${sliceMeta.employeeBand || "unknown"}
Urgency Score: ${briefData.urgencyScore ?? "unknown"}
Key Signals: ${(briefData.urgencySignals || []).slice(0, 3).map((s: any) => s.description).join("; ")}
Engagement Strategy: ${briefData.engagementStrategy || ""}
` : `
COMPANY: ${company.name}
Industry: ${sliceMeta.industry || "unknown"}
`;

      const prompt = `${brainContext}${companyContext}
You are advising a sales manager at ${sellerName} on which type of sales rep to assign to this account.

Based on the company profile and the seller's offering, describe the IDEAL SALES REP PROFILE for this specific account in 3-4 sentences. Cover:
1. Personality and communication style that would resonate with this company's culture
2. Background or domain knowledge that would build instant credibility
3. One specific trait or skill that would make the difference in winning this account

Be specific to this company — do NOT give generic advice. Write in plain prose, no bullet points, no headers.
Return ONLY the profile description.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a precise B2B sales coaching assistant. Return only the requested text, nothing else." },
          { role: "user", content: prompt },
        ],
      });

      const rawContent = response?.choices?.[0]?.message?.content;
      const profile = (typeof rawContent === "string" ? rawContent : "").trim();
      if (!profile) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty profile" });

      // Persist to DB
      await updateCompany(input.companyId, {
        salesRepProfile: profile,
        salesRepProfileGeneratedAt: new Date(),
      });
      await stampBrainOnCompany(input.companyId, ctx.user.id);

      return { profile };
    }),

  // Load persisted sales rep profile for a company
  getSalesRepProfile: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const company = await getCompanyById(input.companyId);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      return {
        profile: company.salesRepProfile ?? null,
        generatedAt: company.salesRepProfileGeneratedAt ?? null,
      };
    }),

  generateSignalApproach: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        signal: z.object({
          category: z.string(),
          type: z.string().optional(),
          description: z.string(),
          snippet: z.string().optional(),
          sourceUrl: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { invokeLLM } = await import("./_core/llm");
      const { getActiveBrain, getCompanyById } = await import("./db");

      const company = await getCompanyById(input.companyId);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      // Load Offering Brain for seller context
      let brainContext = "";
      let sellerName = "Your Company";
      try {
        const brain = await getActiveBrain(ctx.user.id);
        if (brain && brain.status === "completed") {
          sellerName = brain.companyName || sellerName;
          const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
          const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
          const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
          brainContext = `
YOU ARE A SALES REP FOR: ${brain.companyName}
Offering Summary: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp: any) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
Pain Points We Solve: ${painPoints.join("; ")}
`;
        }
      } catch (_) { /* use defaults */ }

      const { signal } = input;
      const prompt = `${brainContext}
You are crafting ONE sharp, specific B2B conversation opener for a sales rep at ${sellerName}.

TARGET COMPANY: ${company.name}

URGENCY SIGNAL:
- Category: ${signal.category}${signal.type ? ` / ${signal.type}` : ""}
- What happened: ${signal.description}
${signal.snippet ? `- Quote: "${signal.snippet}"` : ""}
${signal.sourceUrl ? `- Source: ${signal.sourceUrl}` : ""}

INSTRUCTIONS:
1. Write exactly ONE conversation opener (2-3 sentences max)
2. Reference the specific signal above — do NOT be generic
3. Connect the signal to a concrete pain point or opportunity ${sellerName} can address
4. End with a soft, open question
5. Tone: peer-to-peer, not salesy

Return ONLY the opener text. No labels, no JSON, no preamble.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a precise B2B sales writing assistant. Return only the requested text, nothing else." },
          { role: "user", content: prompt },
        ],
      });

      const rawContent = response?.choices?.[0]?.message?.content;
      const opener = (typeof rawContent === "string" ? rawContent : "").trim();
      if (!opener) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty opener" });

      return { opener };
    }),

  // Batch find decision makers for all companies with urgency >= threshold in a search
  batchFindDecisionMakers: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      minUrgencyScore: z.number().default(50),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const jobId = randomUUID();
      await createBatchJob({
        id: jobId,
        searchId: input.searchId,
        userId: ctx.user.id,
        status: "running",
        jobType: "doAll",
        progress: 0,
        currentCompany: null,
        totalCompanies: 0,
        enriched: 0,
        researched: 0,
        approached: 0,
        failed: 0,
        remaining: 0,
      });
      // Run in background — NOT awaited
      (async () => {
        try {
          const all = await getCompaniesBySearchId(input.searchId);
          // Filter: urgency >= threshold, has a domain, no contacts yet
          const queue = all.filter((c) => {
            const score = c.urgencyScore ?? 0;
            const hasDomain = !!(c.primaryDomain || c.websiteUrl);
            return score >= input.minUrgencyScore && hasDomain;
          });
          await updateBatchJob(jobId, { totalCompanies: queue.length });
          console.log(`[BatchContacts] jobId=${jobId} — ${queue.length} companies with urgency>=${input.minUrgencyScore}`);
          let found = 0, skipped = 0, failed = 0;
          for (let i = 0; i < queue.length; i++) {
            const currentJob = await getBatchJob(jobId);
            if (currentJob?.status === "cancelled") {
              console.log(`[BatchContacts] Cancelled at ${i + 1}/${queue.length}`);
              return;
            }
            const company = queue[i];
            const progress = Math.round((i / queue.length) * 100);
            await updateBatchJob(jobId, { currentCompany: company.name || null, progress, enriched: found, failed });
            try {
              // Skip if contacts already exist
              const existing = await getContactsByCompanyId(company.id);
              if (existing.length > 0) {
                skipped++;
                console.log(`[BatchContacts] Skipped (cached): ${company.name}`);
                continue;
              }
              const domain = (company.primaryDomain || company.websiteUrl || "")
                .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
              if (!domain) { failed++; continue; }
              const result = await trickleDownSearch(domain, company.name || "", 5, false);
              const seenEmails = new Set<string>();
              const seenNames = new Set<string>();
              for (const contact of result.contacts) {
                const email = contact.email?.toLowerCase();
                const name = contact.name?.toLowerCase();
                if ((email && seenEmails.has(email)) || (name && seenNames.has(name))) continue;
                try {
                  await createContact({
                    companyId: company.id,
                    apolloPersonId: contact.id,
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    fullName: contact.name,
                    title: contact.title,
                    email: contact.email || null,
                    phone: contact.phone || null,
                    linkedinUrl: contact.linkedinUrl || null,
                    searchedTitle: `Tier ${result.tierFound}: ${result.tierLabel}`,
                  });
                  if (email) seenEmails.add(email);
                  if (name) seenNames.add(name);
                } catch { /* duplicate — ignore */ }
              }
              found++;
              console.log(`[BatchContacts] ✓ ${company.name}: ${result.contacts.length} contacts (Tier ${result.tierFound})`);
            } catch (err: any) {
              failed++;
              console.error(`[BatchContacts] ✗ ${company.name}:`, err.message);
            }
            // Small delay to avoid Apollo rate limits
            await new Promise(r => setTimeout(r, 800));
          }
          await updateBatchJob(jobId, {
            status: "completed",
            progress: 100,
            enriched: found,
            failed,
            remaining: skipped,
            currentCompany: null,
          });
          console.log(`[BatchContacts] Done — ${found} found, ${skipped} skipped, ${failed} failed`);
        } catch (err: any) {
          await updateBatchJob(jobId, { status: "failed", errorMessage: err.message }).catch(() => {});
          console.error(`[BatchContacts] Fatal error:`, err);
        }
      })();
      return { jobId };
    }),

  syncToSupabase: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ input }) => {
      const { syncSearchRunToSupabase, syncBrainsToSupabase } = await import("./supabaseSync");
      const [searchResult, brainResult] = await Promise.all([
        syncSearchRunToSupabase(input.searchId),
        syncBrainsToSupabase(),
      ]);
      return {
        companiesSynced: searchResult.companiesSynced,
        contactsSynced: searchResult.contactsSynced,
        brainsSynced: brainResult.synced,
        errors: searchResult.errors + brainResult.errors,
        message: `${searchResult.message} | ${brainResult.message}`,
      };
    }),

  pushBrainToSupabase: protectedProcedure
    .input(z.object({ brainId: z.number() }))
    .mutation(async ({ input }) => {
      const { pushSingleBrainToSupabase } = await import("./supabaseSync");
      return pushSingleBrainToSupabase(input.brainId);
    }),

  // ---------------------------------------------------------------------------
  // getCompanyFeedItems — fetch raw Serper feed_items from Supabase for the
  // NEWS chapter of the company detail page. Looks up the company domain and
  // queries feed_items by matching the raw_content query field.
  // ---------------------------------------------------------------------------
  getCompanyFeedItems: protectedProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) return { items: [] };

      const company = await getCompanyById(input.companyId);
      if (!company) return { items: [] };

      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

      // Search feed_items where the raw_content JSON contains the company name
      const { data, error } = await supabase
        .from("feed_items")
        .select("id, title, link, description, author, published_at, created_at, raw_content")
        .ilike("raw_content", `%${company.name}%`)
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (error || !data) return { items: [] };

      const items = data.map((row: any) => {
        let kind = "web";
        let query = "";
        try {
          const rc = typeof row.raw_content === "string" ? JSON.parse(row.raw_content) : row.raw_content;
          kind = rc?.kind ?? rc?.serper_type ?? "web";
          query = rc?.query ?? "";
        } catch { /* ignore */ }
        return {
          id: row.id as string,
          title: (row.title as string) || "",
          link: (row.link as string) || "",
          description: (row.description as string) || "",
          author: (row.author as string) || null,
          publishedAt: row.published_at as string | null,
          createdAt: row.created_at as string,
          kind,
          query,
        };
      });

      return { items };
    }),

  pullBrainFromSupabase: protectedProcedure
    .input(z.object({ brainId: z.number() }))
    .mutation(async ({ input }) => {
      const { pullSingleBrainFromSupabase } = await import("./supabaseSync");
      return pullSingleBrainFromSupabase(input.brainId);
    }),

  // ---------------------------------------------------------------------------
  // batchFetchImages — fetch product images + urgency images for all companies
  // in a campaign that are missing them. Designed for demo prep.
  // ---------------------------------------------------------------------------
  batchFetchImages: protectedProcedure
    .input(z.object({ searchId: z.number(), type: z.enum(["product", "urgency", "both"]).default("both") }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const allCompanies = await getCompaniesBySearchId(input.searchId);
      const enriched = allCompanies.filter(c => c.enrichmentStatus === "enriched");

      const needProduct = (input.type === "both" || input.type === "product")
        ? enriched.filter(c => !c.productImages || c.productImages === "[]" || c.productImages === "null")
        : [];
      const needUrgency = (input.type === "both" || input.type === "urgency")
        ? enriched.filter(c => !c.urgencyImages || c.urgencyImages === "[]" || c.urgencyImages === "null")
        : [];

      console.log(`[batchFetchImages] searchId=${input.searchId} — ${needProduct.length} need product images, ${needUrgency.length} need urgency images`);

      let productDone = 0, productFailed = 0;
      let urgencyDone = 0, urgencyFailed = 0;

      // Fetch product images (uses serperImages module)
      if (needProduct.length > 0) {
        const { fetchSerperImages } = await import("./serperImages");
        for (const company of needProduct) {
          try {
            const images = await fetchSerperImages(company.name, company.primaryDomain, 6);
            await updateCompany(company.id, { productImages: JSON.stringify(images) });
            productDone++;
            if (productDone % 10 === 0) console.log(`[batchFetchImages] product: ${productDone}/${needProduct.length}`);
            // Rate limit: 200ms between Serper calls
            await new Promise(r => setTimeout(r, 200));
          } catch (err: any) {
            productFailed++;
            console.warn(`[batchFetchImages] product ✗ ${company.name}: ${err.message}`);
          }
        }
      }

      // Fetch urgency images (inline Serper call matching existing logic)
      if (needUrgency.length > 0) {
        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey) {
          console.warn("[batchFetchImages] SERPER_API_KEY not configured — skipping urgency images");
        } else {
          const BLOCKED = new Set(["amazon.com","ebay.com","alibaba.com","pinterest.com",
            "shutterstock.com","gettyimages.com","istockphoto.com","dreamstime.com",
            "alamy.com","depositphotos.com","123rf.com","google.com","bing.com"]);

          for (const company of needUrgency) {
            try {
              const query = `"${company.name}" news 2025 2026 -site:amazon.com -site:pinterest.com -site:shutterstock.com -site:gettyimages.com`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10_000);
              let response: Response;
              try {
                response = await fetch("https://google.serper.dev/images", {
                  method: "POST",
                  headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ q: query, num: 12 }),
                  signal: controller.signal,
                });
              } finally {
                clearTimeout(timeoutId);
              }
              let images: any[] = [];
              if (response.ok) {
                const data = await response.json() as { images?: any[] };
                images = (data.images ?? [])
                  .filter((img: any) => {
                    const d = (img.domain ?? "").replace(/^www\./, "").toLowerCase();
                    return img.imageUrl && !BLOCKED.has(d);
                  })
                  .slice(0, 8)
                  .map((img: any) => ({
                    imageUrl: img.imageUrl ?? "",
                    thumbnailUrl: img.thumbnailUrl ?? "",
                    title: img.title ?? "",
                    source: img.source ?? img.domain ?? "",
                    domain: img.domain ?? "",
                    link: img.link ?? "",
                  }));
              }
              // Fallback to company website if no news images found
              if (images.length === 0) {
                const websiteUrl = company.websiteUrl || company.primaryDomain;
                if (websiteUrl) {
                  const rawDomain = websiteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
                  if (rawDomain) {
                    try {
                      const wsResp = await fetch("https://google.serper.dev/images", {
                        method: "POST",
                        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
                        body: JSON.stringify({ q: `site:${rawDomain}`, num: 12 }),
                      });
                      if (wsResp.ok) {
                        const wsData = await wsResp.json() as { images?: any[] };
                        images = (wsData.images ?? []).filter((img: any) => img.imageUrl).slice(0, 8)
                          .map((img: any) => ({ imageUrl: img.imageUrl ?? "", thumbnailUrl: img.thumbnailUrl ?? "", title: img.title ?? "", source: img.source ?? img.domain ?? "", domain: img.domain ?? "", link: img.link ?? "", _fallback: "website" }));
                      }
                    } catch { /* ignore fallback errors */ }
                  }
                }
              }
              await updateCompany(company.id, { urgencyImages: JSON.stringify(images) });
              urgencyDone++;
              if (urgencyDone % 10 === 0) console.log(`[batchFetchImages] urgency: ${urgencyDone}/${needUrgency.length}`);
              await new Promise(r => setTimeout(r, 200));
            } catch (err: any) {
              urgencyFailed++;
              console.warn(`[batchFetchImages] urgency ✗ ${company.name}: ${err.message}`);
            }
          }
        }
      }

      console.log(`[batchFetchImages] DONE — product: ${productDone}/${needProduct.length} (${productFailed} failed), urgency: ${urgencyDone}/${needUrgency.length} (${urgencyFailed} failed)`);
      return {
        success: true,
        product: { total: needProduct.length, done: productDone, failed: productFailed },
        urgency: { total: needUrgency.length, done: urgencyDone, failed: urgencyFailed },
      };
    }),

  // Sales Menu — list all campaigns with stats (company count + avg fit score)
  getSalesMenuCampaigns: protectedProcedure
    .query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { searches, companies, offeringBrain } = await import("../drizzle/schema");
      const { eq, and, or, desc, sql, inArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];

      // Get all non-archived searches for this user (or shared with team)
      const rows = await db
        .select({
          search: searches,
          brainName: offeringBrain.brainName,
        })
        .from(searches)
        .leftJoin(offeringBrain, eq(searches.brainId, offeringBrain.id))
        .where(
          and(
            or(eq(searches.userId, ctx.user.id), eq(searches.sharedWithTeam, 1)),
            eq(searches.isArchived, 0)
          )
        )
        .orderBy(desc(searches.createdAt));

      if (rows.length === 0) return [];

      // For each search, compute company count and average fit score
      const searchIds = rows.map(r => r.search.id);

      // Batch query: count + avg fit per searchId
      const statsRows = await db
        .select({
          searchId: companies.searchId,
          companyCount: sql<number>`COUNT(*)`,
          avgFit: sql<number>`ROUND(AVG(CASE WHEN ${companies.fitScore} IS NOT NULL THEN ${companies.fitScore} END), 0)`,
        })
        .from(companies)
        .where(inArray(companies.searchId, searchIds))
        .groupBy(companies.searchId);

      const statsMap = new Map(statsRows.map(s => [s.searchId, s]));

      return rows.map(r => {
        const stats = statsMap.get(r.search.id);
        return {
          id: r.search.id,
          offeringName: r.search.offeringName ?? "Untitled Campaign",
          location: r.search.location,
          brainName: r.brainName ?? null,
          status: r.search.status,
          createdAt: r.search.createdAt,
          companyCount: stats?.companyCount ?? 0,
          avgFitScore: stats?.avgFit ?? null,
        };
      });
    }),

  // Sync ALL researched companies to Supabase lt_mns_companies table
  syncAllCompanies: protectedProcedure
    .mutation(async () => {
      const { syncAllCompaniesToSupabase } = await import("./supabaseSync");
      const result = await syncAllCompaniesToSupabase();
      return result;
    }),

  // Get sync stats for lt_mns_companies table
  getCompaniesTableSyncStats: protectedProcedure
    .query(async () => {
      const { getCompaniesTableSyncStats } = await import("./supabaseSync");
      return await getCompaniesTableSyncStats();
    }),

  // Sync all researched company pages to Supabase lt_mns_company_pages table
  syncCompanyPages: protectedProcedure
    .input(z.object({ appBaseUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { syncCompanyPagesToSupabase } = await import("./supabaseSync");
      const result = await syncCompanyPagesToSupabase(input.appBaseUrl);
      return result;
    }),

  // Get last sync stats for the company pages table
  getCompanyPagesSyncStats: protectedProcedure
    .query(async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const { count, error } = await (supabase.from("lt_mns_company_pages") as any)
        .select("*", { count: "exact", head: true });
      if (error) return { count: 0, lastSyncedAt: null, error: error.message };

      // Get the most recent synced_at
      const { data: latest } = await (supabase.from("lt_mns_company_pages") as any)
        .select("synced_at")
        .order("synced_at", { ascending: false })
        .limit(1)
        .single();

      return {
        count: count ?? 0,
        lastSyncedAt: latest?.synced_at ?? null,
        error: null,
      };
    }),

  // Query lt_mns_company_pages from Supabase with search/filter support
  getIntelligenceCompanies: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      campaignId: z.number().optional(),
      urgencyLabel: z.enum(["HIGH", "MEDIUM", "LOW", "ALL"]).optional(),
      minFit: z.number().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from("lt_mns_company_pages") as any)
        .select("*", { count: "exact" })
        .order("urgency_score", { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.search) {
        query = query.or(`company_name.ilike.%${input.search}%,domain.ilike.%${input.search}%,campaign_name.ilike.%${input.search}%`);
      }
      if (input.campaignId) {
        query = query.eq("campaign_id", input.campaignId);
      }
      if (input.urgencyLabel && input.urgencyLabel !== "ALL") {
        query = query.eq("urgency_label", input.urgencyLabel);
      }
      if (input.minFit) {
        query = query.gte("fit_score", input.minFit);
      }

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);

      return {
        companies: (data ?? []) as Array<{
          id: string;
          company_id: string;
          local_id: number | null;
          company_name: string;
          domain: string | null;
          campaign_id: number | null;
          campaign_name: string | null;
          urgency_score: number | null;
          fit_score: number | null;
          urgency_label: string | null;
          fit_label: string | null;
          page_url: string | null;
          synced_at: string | null;
        }>,
        total: count ?? 0,
      };
    }),

  // Get distinct campaigns from lt_mns_company_pages for the filter dropdown
  getIntelligenceCampaigns: protectedProcedure
    .query(async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("lt_mns_company_pages") as any)
        .select("campaign_id, campaign_name")
        .not("campaign_id", "is", null);
      if (error) throw new Error(error.message);
      // Deduplicate by campaign_id
      const seen = new Set<number>();
      const campaigns: Array<{ id: number; name: string }> = [];
      for (const row of (data ?? [])) {
        if (!seen.has(row.campaign_id)) {
          seen.add(row.campaign_id);
          campaigns.push({ id: row.campaign_id, name: row.campaign_name ?? `Campaign ${row.campaign_id}` });
        }
      }
      return campaigns.sort((a, b) => a.name.localeCompare(b.name));
    }),

  // Resolve a Supabase UUID to a local integer company ID
  // Used when Intelligence page navigates with UUID instead of local ID
  resolveCompanyUUID: protectedProcedure
    .input(z.object({ uuid: z.string() }))
    .query(async ({ input }) => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );

        // Try looking up by company_id (the UUID stored in lt_mns_company_pages)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("lt_mns_company_pages") as any)
          .select("local_id, page_url")
          .eq("company_id", input.uuid)
          .limit(1)
          .single();

        if (error || !data) {
          // Also try looking up by the page row id itself
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: data2 } = await (supabase.from("lt_mns_company_pages") as any)
            .select("local_id, page_url")
            .eq("id", input.uuid)
            .limit(1)
            .single();
          if (!data2) return { localId: null };
          const localId = data2.local_id ?? (data2.page_url ? parseInt(data2.page_url.split('/company/')[1]?.split('?')[0], 10) : null);
          return { localId: (localId && !isNaN(localId)) ? localId : null };
        }

        const localId = data.local_id ?? (data.page_url ? parseInt(data.page_url.split('/company/')[1]?.split('?')[0], 10) : null);
        return { localId: (localId && !isNaN(localId)) ? localId : null };
      } catch (e) {
        // Table may not exist yet — return null gracefully
        console.error("[resolveCompanyUUID] Error:", e);
        return { localId: null };
      }
    }),
});

// Background search function using brain offering data
async function searchWithBrainOffering(
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
    console.log(`[Search ${searchId}] Using brain-driven offering data`);
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
