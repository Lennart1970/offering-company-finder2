import { protectedProcedure, superAdminProcedure, router } from "./_core/trpc";
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
  getCompaniesBySearchIdRaw,
  countCompaniesBySearchId,
  upsertCompanyBrainOutput,
  getCompanyBrainOutput,
  getCompanyBrainOutputsForSearch,
  getCompanyDatabase,
  countCompanyDatabase,
  getCompanyDatabaseSearches,
  getCompanyDatabaseCountries,
  getCompanyDatabaseSectors,
  getCompanyDatabaseBrains,
  getCompanyDatabaseCgBusinessUnits,
  getCompanyDatabaseCgLeadClasses,
  getCompanyDatabaseCgLeadOrigins,
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
  getContactById,
  setOfferingBrainActive,
  deleteOfferingBrain,
  getOfferingBrainById,
  setContactPhonePending,
  updateContactPhone,
  getAllBrainOutputsForCompany,
  getNicheById,
} from "./db";
import { extractOffering } from "./offeringExtractor";
import { searchApolloCompanies, enrichCompanyDetails } from "./apolloSearch";
import { normalizeWebsiteUrl } from "../shared/urlUtils";

import { selectIndustryCodes } from "./codeSelectionService";
import { naicsMatchesHierarchically, sicMatchesHierarchically } from "../shared/naicsHierarchy";

// Helper: check if user can access a search
// All authenticated users on this system are trusted super-admins — any logged-in user
// can read any search. Public share pages are controlled separately by share tokens.
async function assertSearchAccess(searchId: number, _userId: number) {
  const search = await getSearchById(searchId);
  if (!search) {
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

// Helper: stamp the resolved brain on a company after any generation pass.
// IMPORTANT: always pass the explicitly selected brain from the mutation input to avoid
// overwriting with the active brain when a different brain was intentionally chosen.
// Falls back to active brain only when no resolvedBrain is provided.
async function stampBrainOnCompany(
  companyId: number,
  userId: number,
  resolvedBrain?: { id: number; brainName: string } | null
) {
  try {
    const brain = resolvedBrain ?? await getActiveBrain(userId);
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
  getSearchRaw: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      page: z.number().optional().default(0),
      pageSize: z.number().optional().default(100),
      sortBy: z.enum(["name", "country", "city", "id", "fitScore"]).optional().default("id"),
      sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);
      const offset = input.page * input.pageSize;
      const [rows, total] = await Promise.all([
        getCompaniesBySearchIdRaw(input.searchId, input.pageSize, offset, input.sortBy as "name" | "country" | "city" | "id" | "fitScore", input.sortDir, input.search || undefined),
        countCompaniesBySearchId(input.searchId, input.search || undefined),
      ]);
      return {
        companies: rows,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          hasMore: offset + rows.length < total,
        },
      };
    }),

    // ── Company Database view (cross-campaign, scored) ──────────────────────────
  getCompanyDb: protectedProcedure
    .input(z.object({
      page: z.number().optional().default(0),
      pageSize: z.number().optional().default(100),
      sortBy: z.enum(["name", "country", "city", "fitScore", "similarityScore", "urgencyScore", "urgencyScoreSynth", "urgencyScoreNews", "urgencyScoreLLM", "createdAt", "searchId", "briefGeneratedAt", "salesApproachGeneratedAt", "brainName"]).optional().default("fitScore"),
      sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      search: z.string().optional(),
      searchId: z.number().optional(),
      searchIds: z.array(z.number()).optional(), // multi-select campaign filter
      country: z.string().optional(),
      countries: z.array(z.string()).optional(), // region filter
      sector: z.string().optional(),
      brainId: z.number().optional(),
      minFitScore: z.number().optional(),
      hasFitScore: z.boolean().optional(),
      articleFilter: z.enum(["any", "brief", "approach", "both", "none"]).optional(),
      cgBusinessUnit: z.string().optional(),
      cgLeadClass: z.string().optional(),
      cgLeadOrigin: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const offset = input.page * input.pageSize;
      const [rows, total] = await Promise.all([
        getCompanyDatabase({
          limit: input.pageSize,
          offset,
          sortBy: input.sortBy as any,
          sortDir: input.sortDir,
          search: input.search || undefined,
          searchId: input.searchId,
          searchIds: input.searchIds,
          country: input.country || undefined,
          countries: input.countries,
          sector: input.sector || undefined,
          brainId: input.brainId,
          minFitScore: input.minFitScore,
          hasFitScore: input.hasFitScore,
          articleFilter: input.articleFilter,
          cgBusinessUnit: input.cgBusinessUnit || undefined,
          cgLeadClass: input.cgLeadClass || undefined,
          cgLeadOrigin: input.cgLeadOrigin || undefined,
        }),
        countCompanyDatabase({
          search: input.search || undefined,
          searchId: input.searchId,
          searchIds: input.searchIds,
          country: input.country || undefined,
          countries: input.countries,
          sector: input.sector || undefined,
          brainId: input.brainId,
          minFitScore: input.minFitScore,
          hasFitScore: input.hasFitScore,
          articleFilter: input.articleFilter,
          cgBusinessUnit: input.cgBusinessUnit || undefined,
          cgLeadClass: input.cgLeadClass || undefined,
          cgLeadOrigin: input.cgLeadOrigin || undefined,
        }),
      ]);
      return {
        companies: rows,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          hasMore: offset + rows.length < total,
        },
      };
    }),

  getCompanyDbMeta: protectedProcedure
    .query(async () => {
      const [searches, countries, sectors, brains, cgBusinessUnits, cgLeadClasses, cgLeadOrigins] = await Promise.all([
        getCompanyDatabaseSearches(),
        getCompanyDatabaseCountries(),
        getCompanyDatabaseSectors(),
        getCompanyDatabaseBrains(),
        getCompanyDatabaseCgBusinessUnits(),
        getCompanyDatabaseCgLeadClasses(),
        getCompanyDatabaseCgLeadOrigins(),
      ]);
      return { searches, countries, sectors, brains, cgBusinessUnits, cgLeadClasses, cgLeadOrigins };
    }),

  getSearch: protectedProcedure
  .input(z.object({ searchId: z.number(), page: z.number().optional().default(0), pageSize: z.number().optional().default(100), brainId: z.union([z.number(), z.string()]).optional().transform(v => v !== undefined ? (typeof v === 'string' ? (isNaN(Number(v)) ? undefined : Number(v)) : v) : undefined) }))
    .query(async ({ ctx, input }) => {
      const search = await assertSearchAccess(input.searchId, ctx.user.id);

      const offset = input.page * input.pageSize;
      const [companiesList, decisions, totalCount] = await Promise.all([
        getCompaniesBySearchIdPaged(input.searchId, input.pageSize, offset),
        getDecisionsBySearch(input.searchId),
        countCompaniesBySearchId(input.searchId),
      ]);

      // If a brainId is provided, merge brain-scoped outputs into each company row
      // so that urgencyScore, fitScore, briefGeneratedAt, salesApproachGeneratedAt
      // reflect the selected brain's data rather than the legacy columns.
      let mergedCompanies = companiesList as Array<typeof companiesList[0] & {
        brainUrgencyScore?: number | null;
        brainFitScore?: number | null;
        brainBriefGeneratedAt?: Date | null;
        brainSalesApproachGeneratedAt?: Date | null;
      }>;

      if (input.brainId) {
        const enrichedIds = companiesList.filter(c => c.enrichmentStatus === "enriched").map(c => c.id);
        const brainOutputMap = await getCompanyBrainOutputsForSearch(enrichedIds, input.brainId);
        mergedCompanies = companiesList.map(c => {
          const out = brainOutputMap.get(c.id);
          return {
            ...c,
            // Override display fields with brain-scoped values
            urgencyScore: out?.urgencyScore ?? c.urgencyScore,
            fitScore: out?.fitScore ?? c.fitScore,
            briefGeneratedAt: out?.briefGeneratedAt ?? null,
            salesApproachGeneratedAt: out?.salesApproachGeneratedAt ?? null,
            // Keep original values accessible under brain-prefixed keys
            brainUrgencyScore: out?.urgencyScore ?? null,
            brainFitScore: out?.fitScore ?? null,
            brainBriefGeneratedAt: out?.briefGeneratedAt ?? null,
            brainSalesApproachGeneratedAt: out?.salesApproachGeneratedAt ?? null,
          };
        });
      }

      // Compute enrichment stats from the merged company list
      const enrichedCount = mergedCompanies.filter((c) => c.enrichmentStatus === "enriched").length;
      const pendingCount = mergedCompanies.filter((c) => c.enrichmentStatus === "pending").length;
      const nameOnlyCount = mergedCompanies.filter(
        (c) => c.enrichmentStatus === "pending" && !c.apolloId && !c.primaryDomain
      ).length;
      const outreachReadyCount = mergedCompanies.filter(
        (c) => c.enrichmentStatus === "enriched" && !!c.salesApproachGeneratedAt
      ).length;

      return {
        search,
        companies: mergedCompanies,
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
    .input(z.object({ searchId: z.number(), limit: z.number().optional().default(10), brainId: z.union([z.number(), z.string()]).optional().transform(v => v !== undefined ? (typeof v === 'string' ? (isNaN(Number(v)) ? undefined : Number(v)) : v) : undefined), angleId: z.string().optional() }))
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

          // Resolve the brain to use — explicit brainId or fall back to active brain
          const brain = input.brainId
            ? await getOfferingBrainById(input.brainId, ctx.user.id)
            : await getActiveBrain(ctx.user.id);
          const resolvedBrainId = brain?.id;

          // Brain-scoped queue: a company needs work if it has no output row for this brain
          let brainOutputMap = new Map<number, any>();
          if (resolvedBrainId) {
            const enrichedIds = all.filter(c => c.enrichmentStatus === "enriched").map(c => c.id);
            brainOutputMap = await getCompanyBrainOutputsForSearch(enrichedIds, resolvedBrainId);
          }

          const pending = all.filter((c) => c.enrichmentStatus === "pending" && !!c.apolloId);
          const needsBrief = all.filter((c) => {
            if (c.enrichmentStatus !== "enriched") return false;
            if (!resolvedBrainId) return !c.briefGeneratedAt;
            const out = brainOutputMap.get(c.id);
            return !out?.briefGeneratedAt;
          });
          const needsApproach = all.filter((c) => {
            if (c.enrichmentStatus !== "enriched") return false;
            if (!resolvedBrainId) return !!c.briefGeneratedAt && !c.salesApproachGeneratedAt;
            const out = brainOutputMap.get(c.id);
            return !!out?.briefGeneratedAt && !out?.salesApproachGeneratedAt;
          });
          const queue = [...pending, ...needsBrief, ...needsApproach].slice(0, limit);

          await updateBatchJob(jobId, { totalCompanies: queue.length });
          console.log(`[doNext10] jobId=${jobId} searchId=${input.searchId} brainId=${resolvedBrainId} — ${queue.length} companies queued`);

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
                // Get the current brain output for this company (re-check after enrichment)
                const existingOutput = resolvedBrainId ? await getCompanyBrainOutput(company.id, resolvedBrainId) : null;
                const hasBrief = resolvedBrainId ? !!existingOutput?.briefGeneratedAt : !!company.briefGeneratedAt;
                const hasApproach = resolvedBrainId ? !!existingOutput?.salesApproachGeneratedAt : !!company.salesApproachGeneratedAt;

                if (!hasBrief) {
                  const brief = await generateSalesIntelligenceBrief(company.id, ctx.user.id, input.brainId);
                  // Write to company_brain_outputs
                  if (resolvedBrainId) {
                    await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                      urgencyScore: brief.urgencyScore,
                      briefData: JSON.stringify(brief),
                      briefGeneratedAt: new Date(),
                    });
                  }
                  // Also keep legacy columns in sync for backwards compat
                  await updateCompany(company.id, {
                    urgencyScore: brief.urgencyScore,
                    briefData: JSON.stringify(brief),
                    briefGeneratedAt: new Date(),
                    generatedWithBrainId: resolvedBrainId ?? null,
                    generatedWithBrainName: brain?.brainName ?? null,
                  });
                  researched++;
                  console.log(`[doNext10] ✓ Researched: ${company.name}`);
                }
                if (!hasApproach) {
                  const approach = await generateSalesApproach(company.id, ctx.user.id, input.brainId, input.angleId);
                  if (resolvedBrainId) {
                    await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                      salesApproachData: JSON.stringify(approach),
                      salesApproachGeneratedAt: new Date(),
                    });
                  }
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

          // Remaining count scoped to the selected brain
          const refreshed = await getCompaniesBySearchId(input.searchId);
          let remaining: number;
          if (resolvedBrainId) {
            const allIds = refreshed.filter(c => c.enrichmentStatus === "enriched").map(c => c.id);
            const refreshedMap = await getCompanyBrainOutputsForSearch(allIds, resolvedBrainId);
            remaining = refreshed.filter(c =>
              (c.enrichmentStatus === "pending" && !!c.apolloId) ||
              (c.enrichmentStatus === "enriched" && !refreshedMap.get(c.id)?.salesApproachGeneratedAt)
            ).length;
          } else {
            remaining = refreshed.filter(
              (c) => c.enrichmentStatus === "pending" || !c.briefGeneratedAt || !c.salesApproachGeneratedAt
            ).length;
          }
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
      // Treat stale "running" jobs (no update in >5 min) as failed — server restarted or worker hung
      if (job.status === "running") {
        const staleCutoff = new Date(Date.now() - 5 * 60 * 1000);
        if (job.updatedAt < staleCutoff) {
          await updateBatchJob(job.id, { status: "failed", errorMessage: "Job interrupted — no progress for 5 minutes" });
          return null; // Don't resume a stale job
        }
        return { jobId: job.id };
      }
      return null; // Only surface actively running jobs
    }),

  // ---------------------------------------------------------------------------
  // doAll — process ALL remaining companies in a search in one background job
  // Same logic as doNext10 but no limit and checks for cancellation each step.
  // ---------------------------------------------------------------------------
  doAll: protectedProcedure
    .input(z.object({ searchId: z.number(), brainId: z.union([z.number(), z.string()]).optional().transform(v => v !== undefined ? (typeof v === 'string' ? (isNaN(Number(v)) ? undefined : Number(v)) : v) : undefined), angleId: z.string().optional() }))
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

          // Resolve the brain to use — explicit brainId or fall back to active brain
          const brain = input.brainId
            ? await getOfferingBrainById(input.brainId, ctx.user.id)
            : await getActiveBrain(ctx.user.id);
          const resolvedBrainId = brain?.id;

          // Brain-scoped queue: load existing outputs for this brain
          let brainOutputMap = new Map<number, any>();
          if (resolvedBrainId) {
            const enrichedIds = all.filter(c => c.enrichmentStatus === "enriched").map(c => c.id);
            brainOutputMap = await getCompanyBrainOutputsForSearch(enrichedIds, resolvedBrainId);
          }

          // Build a deduplicated queue of unique companies that need ANY work for this brain
          const needsWork = all.filter((c) => {
            if (c.enrichmentStatus === "pending" && !!c.apolloId) return true;
            if (c.enrichmentStatus !== "enriched") return false;
            if (!resolvedBrainId) return !c.briefGeneratedAt || !c.salesApproachGeneratedAt;
            const out = brainOutputMap.get(c.id);
            return !out?.salesApproachGeneratedAt; // needs work if approach not done for this brain
          });
          const queue = needsWork;

          await updateBatchJob(jobId, { totalCompanies: queue.length });
          console.log(`[doAll] jobId=${jobId} searchId=${input.searchId} brainId=${resolvedBrainId} — ${queue.length} companies queued`);

          // Parallel concurrency — default 5, configurable via DOALL_CONCURRENCY env var
          const CONCURRENCY = Math.max(1, parseInt(process.env.DOALL_CONCURRENCY || "5", 10));
          const PER_COMPANY_TIMEOUT_MS = 4 * 60 * 1000;

          // Shared atomic counters (safe because Node.js is single-threaded for JS)
          let enriched = 0, researched = 0, approached = 0, failed = 0, completed = 0;
          let cancelled = false;

          // Process a single company through all its pending steps
          const processCompany = async (company: typeof queue[0]) => {
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
              // Re-check brain output after enrichment
              const existingOutput = resolvedBrainId ? await getCompanyBrainOutput(company.id, resolvedBrainId) : null;
              const hasBrief = resolvedBrainId ? !!existingOutput?.briefGeneratedAt : !!company.briefGeneratedAt;
              const hasApproach = resolvedBrainId ? !!existingOutput?.salesApproachGeneratedAt : !!company.salesApproachGeneratedAt;

              if (!hasBrief) {
                const brief = await generateSalesIntelligenceBrief(company.id, ctx.user.id, input.brainId);
                if (resolvedBrainId) {
                  await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                    urgencyScore: brief.urgencyScore,
                    briefData: JSON.stringify(brief),
                    briefGeneratedAt: new Date(),
                  });
                }
                await updateCompany(company.id, {
                  urgencyScore: brief.urgencyScore,
                  briefData: JSON.stringify(brief),
                  briefGeneratedAt: new Date(),
                  generatedWithBrainId: resolvedBrainId ?? null,
                  generatedWithBrainName: brain?.brainName ?? null,
                });
                researched++;
                console.log(`[doAll] ✓ Researched: ${company.name}`);
              }
              if (!hasApproach) {
                const approach = await generateSalesApproach(company.id, ctx.user.id, input.brainId, input.angleId);
                if (resolvedBrainId) {
                  await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                    salesApproachData: JSON.stringify(approach),
                    salesApproachGeneratedAt: new Date(),
                  });
                }
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
            try {
              await Promise.race([companyWork(), timeoutGuard]);
            } catch (err: any) {
              failed++;
              console.error(`[doAll] ✗ ${company.name}:`, err.message);
            } finally {
              completed++;
              const progress = Math.round((completed / queue.length) * 100);
              // Update progress every completion — non-blocking
              updateBatchJob(jobId, {
                currentCompany: company.name || null,
                progress,
                enriched,
                researched,
                approached,
                failed,
              }).catch(() => {});
            }
          };

          // Semaphore-based concurrency pool
          // Processes CONCURRENCY companies at a time, checking cancellation between batches
          for (let i = 0; i < queue.length; i += CONCURRENCY) {
            // Check cancellation at the start of each batch
            const currentJob = await getBatchJob(jobId);
            if (currentJob?.status === "cancelled") {
              cancelled = true;
              console.log(`[doAll] Cancelled at batch starting company ${i + 1}/${queue.length}`);
              break;
            }

            const batch = queue.slice(i, i + CONCURRENCY);
            console.log(`[doAll] Processing batch ${Math.floor(i / CONCURRENCY) + 1}: companies ${i + 1}–${i + batch.length} of ${queue.length} (${CONCURRENCY} parallel)`);
            await Promise.allSettled(batch.map(processCompany));
          }

          if (!cancelled) {
            const refreshed = await getCompaniesBySearchId(input.searchId);
            let remaining: number;
            if (resolvedBrainId) {
              const allIds = refreshed.filter(c => c.enrichmentStatus === "enriched").map(c => c.id);
              const refreshedMap = await getCompanyBrainOutputsForSearch(allIds, resolvedBrainId);
              remaining = refreshed.filter(c =>
                (c.enrichmentStatus === "pending" && !!c.apolloId) ||
                (c.enrichmentStatus === "enriched" && !refreshedMap.get(c.id)?.salesApproachGeneratedAt)
              ).length;
            } else {
              remaining = refreshed.filter(
                (c) => c.enrichmentStatus === "pending" || !c.briefGeneratedAt || !c.salesApproachGeneratedAt
              ).length;
            }
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
            console.log(`[doAll] Done — enriched:${enriched} researched:${researched} approached:${approached} failed:${failed} remaining:${remaining} (${CONCURRENCY} workers)`);
          }
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
      brainId: z.number().optional(), // If provided, use this brain and write to company_brain_outputs
      angleId: z.string().optional(), // If provided, use this angle for scoring/content framing
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      console.log(`[generateBrief] Starting brief generation for company ${input.companyId} brainId=${input.brainId ?? 'active'}`);

      // If a specific brainId is provided, check the brain-scoped cache instead
      if (!input.force && input.brainId) {
        const existingOutput = await getCompanyBrainOutput(input.companyId, input.brainId);
        if (existingOutput?.briefData && existingOutput.briefGeneratedAt) {
          const cacheAge = Date.now() - new Date(existingOutput.briefGeneratedAt).getTime();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          if (cacheAge < sevenDaysMs) {
            console.log(`[generateBrief] Using brain-scoped cached brief (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days)`);
            return { success: true, brief: JSON.parse(existingOutput.briefData), cached: true, cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)) };
          }
        }
      } else if (!input.force && company.briefData && company.briefGeneratedAt) {
        const cacheAge = Date.now() - new Date(company.briefGeneratedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (cacheAge < sevenDaysMs) {
          console.log(`[generateBrief] Using cached brief (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days)`);
          const cachedBrief = JSON.parse(company.briefData);
          return { success: true, brief: cachedBrief, cached: true, cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1000)) };
        } else {
          console.log(`[generateBrief] Cached brief expired (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days), regenerating...`);
        }
      }

      // Import brief generator
      const { generateSalesIntelligenceBrief } = await import("./briefGenerator");

      try {
        // Generate the brief with Brain context if available
        const brief = await generateSalesIntelligenceBrief(input.companyId, ctx.user.id, input.brainId);

        // Write to brain-scoped output table
        const resolvedBrainId = input.brainId ?? (await getActiveBrain(ctx.user.id))?.id;
        if (resolvedBrainId) {
          await upsertCompanyBrainOutput(input.companyId, resolvedBrainId, {
            urgencyScore: brief.urgencyScore,
            briefData: JSON.stringify(brief),
            briefGeneratedAt: new Date(),
          });
        }

        // Also update legacy columns for backwards compatibility
        await updateCompany(input.companyId, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: new Date(),
        });
        // Resolve brain for stamping — prefer the explicitly selected brain
        const briefBrain = input.brainId ? await getOfferingBrainById(input.brainId, ctx.user.id) : null;
        await stampBrainOnCompany(input.companyId, ctx.user.id, briefBrain);

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
      brainId: z.number().optional(), // If provided, use this brain and write to company_brain_outputs
      angleId: z.string().optional(), // If provided, use this angle for content framing
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);

      // Check if deep research exists (brain-scoped or legacy)
      const brainOutput = input.brainId ? await getCompanyBrainOutput(input.companyId, input.brainId) : null;
      const hasBrief = input.brainId ? !!brainOutput?.briefData : !!company.briefData;
      if (!hasBrief) {
        throw new Error("Deep research not found for this brain. Please run Research first.");
      }

      console.log(`[generateSalesApproach] Starting sales approach generation for company ${input.companyId}`);

      // Check if cached sales approach exists and is recent (< 7 days old)
      // Cache is ANGLE-AWARE: if the requested angle differs from the cached angle, bypass cache
      if (company.salesApproachData && company.salesApproachGeneratedAt) {
        const cacheAge = Date.now() - new Date(company.salesApproachGeneratedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const cachedApproach = JSON.parse(company.salesApproachData);
        // Check if the cached approach was generated with the same angle
        const cachedAngleId = cachedApproach?.angleId as string | undefined;
        const angleChanged = input.angleId && cachedAngleId && input.angleId !== cachedAngleId;
        
        if (cacheAge < sevenDaysMs && !angleChanged) {
          console.log(`[generateSalesApproach] Using cached sales approach (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days, angle: ${cachedAngleId ?? 'default'})`);
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
        } else if (angleChanged) {
          console.log(`[generateSalesApproach] Angle changed (cached: ${cachedAngleId}, requested: ${input.angleId}), regenerating...`);
        } else {
          console.log(`[generateSalesApproach] Cached sales approach expired (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days), regenerating...`);
        }
      }

      // Import sales approach generator
      const { generateSalesApproach } = await import("./salesApproachGenerator");

      try {
        // Generate personalized sales approach with Brain context
        const salesApproach = await generateSalesApproach(input.companyId, ctx.user.id, input.brainId, input.angleId);

        // Write to brain-scoped output table
        const resolvedBrainId = input.brainId ?? (await getActiveBrain(ctx.user.id))?.id;
        if (resolvedBrainId) {
          await upsertCompanyBrainOutput(input.companyId, resolvedBrainId, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: new Date(),
          });
        }

        // Also update legacy columns for backwards compatibility
        await updateCompany(input.companyId, {
          salesApproachData: JSON.stringify(salesApproach),
          salesApproachGeneratedAt: new Date(),
        });
        // Resolve brain for stamping — prefer the explicitly selected brain
        const approachBrain = input.brainId ? await getOfferingBrainById(input.brainId, ctx.user.id) : null;
        await stampBrainOnCompany(input.companyId, ctx.user.id, approachBrain);

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

  // Get brain history — Supabase is single source of truth
  getBrainHistory: protectedProcedure
    .query(async ({ ctx }) => {
      type BrainEntry = {
        id: string;         // Supabase UUID (display/selector key)
        localId: number | null; // Local MySQL numeric ID (used for mutations)
        brainName: string;
        companyName: string;
        status: string;
        isActive: number;
        userId: number;
        showOnLeadtrigger: number;
        createdAt: Date | null;
      };

      // ── Supabase primary ─────────────────────────────────────────────────
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          const { data: sbBrains, error } = await sb
            .from("lt_mns_offering_brains")
            .select("id, brain_name, company_name, status, show_on_leadtrigger, is_active, created_at, local_brain_id")
            .eq("show_on_leadtrigger", true)
            .order("created_at", { ascending: false });

          if (!error && sbBrains) {
            const history: BrainEntry[] = sbBrains.map((b: any): BrainEntry => ({
              id: String(b.id),
              localId: b.local_brain_id ? Number(b.local_brain_id) : null,
              brainName: b.brain_name ?? "Unnamed Brain",
              companyName: b.company_name ?? "",
              status: b.status ?? "completed",
              isActive: b.is_active ? 1 : 0,
              userId: ctx.user.id,
              showOnLeadtrigger: b.show_on_leadtrigger ? 1 : 0,
              createdAt: b.created_at ? new Date(b.created_at) : null,
            }));
            return { history };
          }
        }
      } catch (err) {
        console.warn("[getBrainHistory] Supabase unavailable, falling back to local MySQL:", err);
      }

      // ── Local MySQL fallback ───────────────────────────────────────────
      const localHistory = await getBrainHistory(ctx.user.id);
      const history: BrainEntry[] = localHistory.map((b): BrainEntry => ({
        id: String(b.id),
        localId: typeof b.id === 'number' ? b.id : null, // local MySQL fallback uses numeric IDs
        brainName: b.brainName,
        companyName: b.companyName,
        status: b.status,
        isActive: b.isActive ?? 0,
        userId: b.userId,
        showOnLeadtrigger: b.showOnLeadtrigger ?? 1,
        createdAt: b.createdAt ?? null,
      }));
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
        geographyWeights: z.string().optional(), // JSON string {eu, us, apac, china, other}
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
      brainId: z.union([z.number(), z.string()]),
    }))
    .mutation(async ({ ctx, input }) => {
      const brainIdStr = String(input.brainId);
      const brainIdNum = typeof input.brainId === "number" ? input.brainId : parseInt(input.brainId, 10);

      // ── Supabase: deactivate all, activate the selected one ────────────
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          // Deactivate all
          await sb.from("lt_mns_offering_brains").update({ is_active: false }).neq("id", "__none__");
          // Activate by Supabase id
          await sb.from("lt_mns_offering_brains").update({ is_active: true }).eq("id", brainIdStr);
          // Also try by local_brain_id (for numeric IDs)
          if (!isNaN(brainIdNum)) {
            await sb.from("lt_mns_offering_brains").update({ is_active: true }).eq("local_brain_id", brainIdNum);
          }
        }
      } catch (err) {
        console.warn("[setActiveBrain] Supabase update failed:", err);
      }

      // ── Local MySQL: also sync if the brain has a local record ───────────
      if (!isNaN(brainIdNum)) {
        try {
          await setOfferingBrainActive(brainIdNum, ctx.user.id);
        } catch {
          // Supabase-only brain — no local record, that's fine
        }
      }

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

  // Toggle shared flag — owner only
  toggleBrainShared: protectedProcedure
    .input(z.object({
      brainId: z.number(),
      isShared: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only the owner can change the shared flag
      const brain = await getOfferingBrainById(input.brainId, ctx.user.id);
      if (!brain) throw new Error("Brain not found or access denied");
      if (brain.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the brain owner can change sharing settings" });
      await updateOfferingBrain(input.brainId, { isShared: input.isShared ? 1 : 0 });
      return { success: true, isShared: input.isShared };
    }),

  // ============================================================================
  // Find All C-Suite: Bulk Contact Search
  // ============================================================================

  // Get single company with all data (for Company Detail page)
  getCompany: protectedProcedure
    .input(z.object({ companyId: z.number(), brainId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const company = await assertCompanyAccess(input.companyId, ctx.user.id);
      const contacts = await getContactsByCompanyId(input.companyId);
      const decision = await getCompanyDecision(input.companyId, ctx.user.id);
      const search = await getSearchById(company.searchId);

      // Load all brain outputs for this company (for the brain switcher)
      const allBrainOutputs = await getAllBrainOutputsForCompany(input.companyId);

      // If a specific brainId is requested, override the company's legacy fields
      // with the brain-scoped output so the detail page shows the correct brief/approach
      let companyWithBrainData = company as typeof company & {
        brainBriefData?: string | null;
        brainSalesApproachData?: string | null;
        brainUrgencyScore?: number | null;
        activeBrainId?: number | null;
      };
      if (input.brainId) {
        const brainOutput = allBrainOutputs.find(o => o.brainId === input.brainId);
        if (brainOutput) {
          companyWithBrainData = {
            ...company,
            // Override display fields with brain-scoped values
            briefData: brainOutput.briefData ?? company.briefData,
            salesApproachData: brainOutput.salesApproachData ?? company.salesApproachData,
            urgencyScore: brainOutput.urgencyScore ?? company.urgencyScore,
            briefGeneratedAt: brainOutput.briefGeneratedAt ?? company.briefGeneratedAt,
            salesApproachGeneratedAt: brainOutput.salesApproachGeneratedAt ?? company.salesApproachGeneratedAt,
            // Use brain-scoped fit score and full breakdown if available
            fitScore: brainOutput.fitScore ?? company.fitScore,
            fitScoreData: brainOutput.fitScoreData ?? company.fitScoreData,
            activeBrainId: input.brainId,
          };
        }
      }

      // Load niche context if company has a nicheId
      let niche = null;
      if (company.nicheId) {
        niche = await getNicheById(company.nicheId);
      }
      return {
        company: companyWithBrainData,
        contacts,
        decision: decision ?? null,
        search: search ?? null,
        allBrainOutputs,
        niche: niche ?? null,
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
      const contact = await getContactById(input.contactId);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

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

      // Build webhook URL for async phone delivery (Apollo requires this when reveal_phone_number=true)
      const webhookUrl = process.env.APP_URL
        ? `${process.env.APP_URL}/api/apollo-webhook`
        : `https://leadtrigger-connectgroup.com/api/apollo-webhook`;

      const enriched = await enrichPerson(
        contact.firstName,
        contact.lastName,
        domain,
        input.includePhone || false,
        webhookUrl
      );

      // Update contact in database — use existing contact row (update in place)
      const db = await import("./db");
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { contacts: contactsTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await drizzleDb.update(contactsTable)
        .set({
          email: enriched.email || contact.email || null,
          phone: enriched.phone || contact.phone || null,
          linkedinUrl: enriched.linkedinUrl || contact.linkedinUrl || null,
          phonePending: enriched.phonePending ? 1 : 0,
          // Save Apollo person ID so webhook can match this contact when phone arrives
          ...(enriched.apolloPersonId ? { apolloPersonId: enriched.apolloPersonId } : {}),
        })
        .where(eq(contactsTable.id, contact.id));

      const updatedContact = await getContactById(contact.id);
      if (!updatedContact) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch updated contact" });

      console.log(`[Enrich Contact] Completed: ${updatedContact.fullName} enriched. phonePending=${enriched.phonePending}`);

      return {
        contact: updatedContact,
        phonePending: enriched.phonePending || false,
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

  pullAllBrainsFromSupabase: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { pullAllBrainsFromSupabase } = await import("./supabaseSync");
      return pullAllBrainsFromSupabase(ctx.user.id);
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

    // DEPRECATED: syncAllCompanies previously wrote to lt_mns_companies which no longer exists.
  // The live Supabase schema uses lt_companies (master registry) + lt_campaign_companies (enrichment).
  // This procedure now returns a deprecation notice instead of running the broken sync.
  // TODO: Replace with a procedure that syncs to lt_companies when needed.
  syncAllCompanies: protectedProcedure
    .mutation(async () => {
      return {
        synced: 0,
        errors: 0,
        message: "⚠️ DEPRECATED: lt_mns_companies no longer exists. The live schema uses lt_companies + lt_campaign_companies. This sync has been disabled to prevent silent failures. See references/db-architecture.md.",
      };
    }),
  // Get sync stats for lt_mns_companies (the real Supabase master registry for this project).
  // lt_companies does NOT exist in this Supabase project.
  getCompaniesTableSyncStats: protectedProcedure
    .query(async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );
        const { count, error } = await (supabase.from("lt_mns_companies") as any)
          .select("*", { count: "exact", head: true });
        if (error) throw error;
        const { data: lastRow } = await (supabase.from("lt_mns_companies") as any)
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        return {
          count: count ?? 0,
          lastSyncedAt: lastRow?.updated_at ?? null,
          table: "lt_mns_companies",
          note: "Master registry — 85K+ companies imported from external pipeline",
        };
      } catch (e) {
        console.warn("[getCompaniesTableSyncStats] Supabase unavailable:", e);
        return { count: 0, lastSyncedAt: null, table: "lt_mns_companies", note: "Supabase unavailable" };
      }
    }),

  // Sync all researched company pages to Supabase lt_mns_company_pages table
  // Incremental (default): runs synchronously within the request — only syncs new companies since last sync.
  //   Fast enough (typically <10s) to complete within Cloud Run's 180s request timeout.
  // forceFullSync=true: fire-and-forget background loop for all 4,800+ companies.
  syncCompanyPages: protectedProcedure
    .input(z.object({ appBaseUrl: z.string().optional(), forceFullSync: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const forceFullSync = input?.forceFullSync ?? false;
      const { syncCompanyPagesToSupabase, getLastSyncedCompanyId } = await import("./supabaseSync");
      const BATCH_SIZE = 300;

      if (!forceFullSync) {
        // INCREMENTAL: synchronous — only syncs companies newer than the last synced ID
        const offsetId = await getLastSyncedCompanyId();
        console.log(`[SupabaseSync] syncCompanyPages INCREMENTAL — offsetId=${offsetId}`);
        const result = await syncCompanyPagesToSupabase(input?.appBaseUrl, BATCH_SIZE, offsetId);
        console.log(`[SupabaseSync] syncCompanyPages INCREMENTAL DONE: ${result.message}`);
        return { synced: result.synced, errors: result.errors, message: result.synced === 0 ? 'Already up to date — no new articles to sync' : `Synced ${result.synced} new articles to Supabase` };
      }

      // FULL SYNC: fire-and-forget background loop (too slow for synchronous)
      (async () => {
        try {
          let offsetId = 0;
          let totalSynced = 0;
          let totalErrors = 0;
          let batchNum = 0;
          console.log(`[SupabaseSync] syncCompanyPages FULL starting`);
          while (true) {
            batchNum++;
            const result = await syncCompanyPagesToSupabase(input?.appBaseUrl, BATCH_SIZE, offsetId);
            totalSynced += result.synced;
            totalErrors += result.errors;
            console.log(`[SupabaseSync] syncCompanyPages FULL batch ${batchNum} (offsetId=${offsetId}): ${result.message}`);
            if (result.nextOffsetId === undefined) break;
            offsetId = result.nextOffsetId;
          }
          console.log(`[SupabaseSync] syncCompanyPages FULL DONE: ${totalSynced} synced, ${totalErrors} errors across ${batchNum} batches`);
        } catch (e) {
          console.error("[SupabaseSync] syncCompanyPages FULL error:", e instanceof Error ? e.message : String(e));
        }
      })();
      return { synced: 0, errors: 0, message: 'Full sync started in background — re-syncing all companies. Refresh stats in ~5 minutes' };
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
      campaignIds: z.array(z.number()).optional(),
      urgencyLabel: z.enum(["HIGH", "MEDIUM", "LOW", "ALL"]).optional(),
      minFit: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
      brainName: z.string().optional(),
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
      // Support both single campaignId (legacy) and campaignIds array (multi-select)
      const effectiveCampaignIds = input.campaignIds && input.campaignIds.length > 0
        ? input.campaignIds
        : input.campaignId ? [input.campaignId] : [];
      if (effectiveCampaignIds.length === 1) {
        query = query.eq("campaign_id", effectiveCampaignIds[0]);
      } else if (effectiveCampaignIds.length > 1) {
        query = query.in("campaign_id", effectiveCampaignIds);
      }
      if (input.urgencyLabel && input.urgencyLabel !== "ALL") {
        query = query.eq("urgency_label", input.urgencyLabel);
      }
      if (input.minFit) {
        query = query.gte("fit_score", input.minFit);
      }
      // Note: dateFrom/dateTo are used to filter campaigns on the MySQL side (getIntelligenceCampaigns).
      // The resulting campaignIds already encode the date scope — we do NOT filter Supabase by synced_at
      // because synced_at reflects the push timestamp, not the campaign run date.
      if (input.brainName) {
        // Resolve campaign IDs for this brain from the local DB, then filter by them in Supabase
        const { getDb: getLocalDb } = await import("./db");
        const { offeringBrain: obSchema, searches: searchesSchema } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const localDb = await getLocalDb();
        if (localDb) {
          const brainRows = await localDb
            .select({ id: obSchema.id })
            .from(obSchema)
            .where(eqOp(obSchema.brainName, input.brainName))
            .limit(1);
          if (brainRows.length > 0) {
            const brainId = brainRows[0].id;
            const searchRows = await localDb
              .select({ id: searchesSchema.id })
              .from(searchesSchema)
              .where(eqOp(searchesSchema.brainId, brainId));
            const campaignIds = searchRows.map((r: { id: number }) => r.id);
            if (campaignIds.length > 0) {
              query = query.in("campaign_id", campaignIds);
            } else {
              // No campaigns for this brain — return empty
              query = query.eq("campaign_id", -1);
            }
          }
        }
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
          telegram_sent_at: string | null;
          conversation_starter: string | null;
          top_signal_headline: string | null;
          top_signal_type: string | null;
          brain_name: string | null;
        }>,
        total: count ?? 0,
      };
    }),

  // Get distinct campaigns from lt_mns_company_pages for the filter dropdown
  getIntelligenceCampaigns: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      // Query MySQL directly — Supabase synced_at is the push timestamp, not the campaign run date
      const { getDb: getLocalDb } = await import("./db");
      const { searches: searchesSchema, companies: companiesSchema } = await import("../drizzle/schema");
      const { isNotNull: isNotNullOp, gte: gteOp, lte: lteOp, and: andOp, eq: eqOp2, desc: descOp } = await import("drizzle-orm");
      const localDb = await getLocalDb();
      if (!localDb) return [];

      // Find all campaigns that have at least one researched company (briefData not null)
      // Filter by briefGeneratedAt date range if provided
      const conditions: any[] = [isNotNullOp(companiesSchema.briefData), isNotNullOp(companiesSchema.searchId)];
      if (input?.dateFrom) conditions.push(gteOp(companiesSchema.briefGeneratedAt, new Date(input.dateFrom)));
      if (input?.dateTo) {
        const toDate = new Date(input.dateTo);
        toDate.setDate(toDate.getDate() + 1);
        conditions.push(lteOp(companiesSchema.briefGeneratedAt, toDate));
      }

      const rows = await localDb
        .selectDistinct({ campaignId: companiesSchema.searchId, campaignName: searchesSchema.offeringName })
        .from(companiesSchema)
        .leftJoin(searchesSchema, eqOp2(companiesSchema.searchId, searchesSchema.id))
        .where(andOp(...conditions))
        .orderBy(descOp(companiesSchema.searchId));

      return rows
        .filter((r: { campaignId: number | null; campaignName: string | null }) => r.campaignId !== null)
        .map((r: { campaignId: number | null; campaignName: string | null }) => ({
          id: r.campaignId!,
          name: r.campaignName ?? `Campaign ${r.campaignId}`,
        }));
    }),

  // Get distinct business units from the local offering_brain table (those that have at least one campaign)
  getIntelligenceBusinessUnits: protectedProcedure
    .query(async () => {
      const { getDb: getLocalDb } = await import("./db");
      const { offeringBrain: obSchema, searches: searchesSchema } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const localDb = await getLocalDb();
      if (!localDb) return [];
      // Return all brains that have at least one search/campaign linked
      const rows = await localDb
        .selectDistinct({ brainName: obSchema.brainName })
        .from(obSchema)
        .innerJoin(searchesSchema, eqOp(searchesSchema.brainId, obSchema.id))
        .orderBy(obSchema.brainName);
      return rows.map((r: { brainName: string }) => r.brainName).filter(Boolean) as string[];
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

  // ---------------------------------------------------------------------------
  // deduplicateSearch — remove duplicate apolloId rows within a search
  // Keeps the most-enriched row (enriched > pending, then most recent brief, then lowest id)
  // ---------------------------------------------------------------------------
  deduplicateSearch: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertSearchAccess(input.searchId, ctx.user.id);

      // Use mysql2 directly for raw SQL dedup logic
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection(process.env.DATABASE_URL!);

      try {
        // Find all duplicate groups for this search
        const [dups] = await conn.execute<any[]>(
          `SELECT apolloId, COUNT(*) as cnt
           FROM companies
           WHERE searchId = ? AND apolloId IS NOT NULL
           GROUP BY apolloId
           HAVING cnt > 1`,
          [input.searchId]
        );

        let totalDeleted = 0;

        for (const dup of dups) {
          const [rows] = await conn.execute<any[]>(
            `SELECT id, enrichmentStatus, briefGeneratedAt
             FROM companies
             WHERE searchId = ? AND apolloId = ?
             ORDER BY
               CASE enrichmentStatus WHEN 'enriched' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END ASC,
               briefGeneratedAt DESC,
               id ASC`,
            [input.searchId, dup.apolloId]
          );

          const [, ...toDelete] = rows;
          const deleteIds = toDelete.map((r: any) => Number(r.id));

          if (deleteIds.length > 0) {
            const placeholders = deleteIds.map(() => '?').join(',');
            await conn.execute(`DELETE FROM company_brain_outputs WHERE companyId IN (${placeholders})`, deleteIds);
            await conn.execute(`DELETE FROM companies WHERE id IN (${placeholders})`, deleteIds);
            totalDeleted += deleteIds.length;
          }
        }

        console.log(`[deduplicateSearch] search=${input.searchId} removed ${totalDeleted} duplicates from ${dups.length} groups`);
        return { removed: totalDeleted, groups: dups.length };
      } finally {
        await conn.end();
      }
    }),

  // ── Brain Visibility Management ─────────────────────────────────────────────

  /**
   * Return ALL brains (visible and hidden) for the visibility management table.
   * Admin-only: only the owner user can see all brains.
   */
  listAllBrainsAdmin: protectedProcedure
    .query(async () => {
      // ── Supabase primary ──────────────────────────────────────────────────────
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          const { data, error } = await sb
            .from("lt_mns_offering_brains")
            .select("id, brain_name, company_name, status, is_active, show_on_leadtrigger, created_at, updated_at, local_brain_id")
            .order("created_at", { ascending: false });
          if (!error && data) {
            // Cross-reference with local MySQL to find the true single active brain.
            // Supabase is_active can be stale if setActiveBrain wasn't synced.
            let localActiveId: number | null = null;
            try {
              const { getDb: getDbLocal } = await import("./db");
              const dbLocal = await getDbLocal();
              if (dbLocal) {
                const { offeringBrain: obSchema } = await import("../drizzle/schema");
                const { eq: eqOp } = await import("drizzle-orm");
                const [activeRow] = await dbLocal.select({ id: obSchema.id }).from(obSchema).where(eqOp(obSchema.isActive, 1)).limit(1);
                if (activeRow) localActiveId = activeRow.id;
              }
            } catch { /* local DB unavailable — trust Supabase */ }

            const brains = data.map((b: any) => {
              // Determine active: if we have a local active ID, use that as truth.
              // A brain is active if its local_brain_id matches OR its id matches.
              let isActive = false;
              if (localActiveId !== null) {
                isActive = (b.local_brain_id === localActiveId) || (String(b.id) === String(localActiveId));
              } else {
                isActive = !!b.is_active;
              }
              return {
                id: String(b.id),           // Supabase string ID
                localId: b.local_brain_id ? Number(b.local_brain_id) : null, // local MySQL int (if synced)
                brainName: b.brain_name ?? "Unnamed Brain",
                companyName: b.company_name ?? "",
                status: b.status ?? "completed",
                isActive: isActive ? 1 : 0,
                isShared: 0, // not stored in Supabase, defaults to 0
                showOnLeadtrigger: b.show_on_leadtrigger ? 1 : 0,
                createdAt: b.created_at ?? null,
                updatedAt: b.updated_at ?? null,
                isSupabaseOnly: !b.local_brain_id, // true = no local MySQL record
              };
            });
            return { brains };
          }
        }
      } catch (err) {
        console.warn("[listAllBrainsAdmin] Supabase unavailable, falling back to local MySQL:", err);
      }

      // ── Local MySQL fallback ──────────────────────────────────────────────────
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { brains: [] };
      const { offeringBrain } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await db
        .select({
          id: offeringBrain.id,
          brainName: offeringBrain.brainName,
          companyName: offeringBrain.companyName,
          status: offeringBrain.status,
          isActive: offeringBrain.isActive,
          isShared: offeringBrain.isShared,
          showOnLeadtrigger: offeringBrain.showOnLeadtrigger,
          createdAt: offeringBrain.createdAt,
          updatedAt: offeringBrain.updatedAt,
        })
        .from(offeringBrain)
        .orderBy(desc(offeringBrain.createdAt));
      const brains = rows.map((b) => ({
        id: String(b.id),
        localId: b.id,
        brainName: b.brainName,
        companyName: b.companyName,
        status: b.status,
        isActive: b.isActive ?? 0,
        isShared: b.isShared ?? 0,
        showOnLeadtrigger: b.showOnLeadtrigger ?? 1,
        createdAt: b.createdAt ?? null,
        updatedAt: b.updatedAt ?? null,
        isSupabaseOnly: false,
      }));
      return { brains };
    }),

  /**
   * Toggle show_on_leadtrigger for a single brain.
   * Accepts either a Supabase string ID or a local MySQL int ID.
   * Supabase is updated first (primary); local MySQL is updated as fallback/sync.
   */
  toggleBrainVisibility: superAdminProcedure
    .input(z.object({
      brainId: z.union([z.string(), z.number()]),
      visible: z.boolean(),
      localId: z.number().int().positive().optional(), // local MySQL id if available
    }))
    .mutation(async ({ input }) => {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      // Update Supabase (primary)
      if (supabaseUrl && supabaseKey) {
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          await sb
            .from("lt_mns_offering_brains")
            .update({ show_on_leadtrigger: input.visible })
            .eq("id", String(input.brainId));
        } catch (err) {
          console.warn("[toggleBrainVisibility] Supabase update failed:", err);
        }
      }
      // Also update local MySQL if we have a local int ID
      const localId = input.localId ?? (typeof input.brainId === "number" ? input.brainId : null);
      if (localId) {
        try {
          const { getDb } = await import("./db");
          const db = await getDb();
          if (db) {
            const { offeringBrain } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await db
              .update(offeringBrain)
              .set({ showOnLeadtrigger: input.visible ? 1 : 0 })
              .where(eq(offeringBrain.id, localId));
          }
        } catch (err) {
          console.warn("[toggleBrainVisibility] Local MySQL update failed:", err);
        }
      }
      return { success: true, brainId: input.brainId, visible: input.visible };
    }),

  /**
   * Fetch all available angles from Supabase lt_mns_angles table.
   */
  getAngles: protectedProcedure
    .query(async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
          const { data, error } = await sb
            .from("lt_mns_angles")
            .select("id, name, description")
            .order("name", { ascending: true });
          if (!error && data) {
            return { angles: data.map((a: any) => ({ id: a.id as string, name: a.name as string, description: a.description as string | null })) };
          }
        }
      } catch (err) {
        console.warn("[getAngles] Supabase unavailable:", err);
      }
      // Fallback: return hardcoded angles if Supabase is down
      return {
        angles: [
          { id: "default", name: "Potential Customer", description: "Direct end-user buyer" },
          { id: "distributor", name: "Distributor", description: "Channel partner who resells to end customers" },
        ],
      };
    }),

  /**
   * Bulk similarity scoring — computes cosine similarity for companies
   * that don't yet have a similarityScore (or all companies in a campaign).
   * No LLM calls — uses stored Supabase embeddings.
   */
  runSimilarityScoring: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["ungraded", "all", "campaign"]).default("ungraded"),
        searchId: z.number().optional(), // required when mode === "campaign"
        brainId: z.number().optional(),  // optional: use a specific Brain instead of globally-active
      })
    )
    .mutation(async ({ input }) => {
      const { runBulkSimilarityScoring } = await import("./bulkSimilarityService");
      const result = await runBulkSimilarityScoring({
        mode: input.mode,
        searchId: input.searchId,
        brainId: input.brainId,
      });
      return result;
    }),

  /**
   * Path D: Bulk News Urgency Scoring
   * Fetches Google News snippets via Serper, embeds them, and scores cosine
   * similarity against the ABC scenario centroid → writes to urgencyScoreNews
   */
  runNewsUrgencyScoring: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["unscored", "all"]).default("unscored"),
        limit: z.number().min(1).max(2000).default(500),
      })
    )
    .mutation(async ({ input }) => {
      const { runBulkNewsUrgencyScoring } = await import("./bulkNewsUrgencyService");
      const result = await runBulkNewsUrgencyScoring({
        mode: input.mode,
        limit: input.limit,
      });
            return result;
    }),

  /**
   * Database Health Check — aggregates KPI completeness and sync status
   * across all pipeline stages for the admin dashboard.
   */
  getDatabaseHealth: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { count, isNotNull, sql, inArray } = await import("drizzle-orm");
    const { companies, searches, offeringBrain } = await import("../drizzle/schema");

    const db = await getDb();
    if (!db) return null;

    // ── Global totals ──────────────────────────────────────────────────────────
    const [totalCompaniesRow] = await db.select({ total: count() }).from(companies);
    const total = totalCompaniesRow?.total ?? 0;

    // ── Enrichment status ──────────────────────────────────────────────────────
    const [enrichedRow] = await db.select({ n: count() }).from(companies).where(sql`enrichmentStatus = 'enriched'`);
    const [failedRow] = await db.select({ n: count() }).from(companies).where(sql`enrichmentStatus = 'failed'`);
    const [pendingRow] = await db.select({ n: count() }).from(companies).where(sql`enrichmentStatus = 'pending'`);

    // ── Scoring KPIs ───────────────────────────────────────────────────────────
    const [simRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.similarityScore));
    const [fitRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.fitScore));
    const [urgSynthRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.urgencyScoreSynth));
    const [urgNewsRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.urgencyScoreNews));
    const [urgLLMRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.urgencyScoreLLM));
    const [urgHITLRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.urgencyScoreHITL));
    const [fitHITLRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.fitScoreHITL));

    // ── Content generation KPIs ────────────────────────────────────────────────
    const [briefRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.briefGeneratedAt));
    const [salesRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.salesApproachGeneratedAt));
    const [contactsRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.contactsFetchedAt));
    const [cgRow] = await db.select({ n: count() }).from(companies).where(isNotNull(companies.cgImportedAt));

    // ── Last activity timestamps ───────────────────────────────────────────────
    const [lastEnrichedRow] = await db.select({ ts: sql<Date | null>`MAX(createdAt)` }).from(companies).where(sql`enrichmentStatus = 'enriched'`);
    const [lastFitRow] = await db.select({ ts: sql<Date | null>`MAX(fitScoreGeneratedAt)` }).from(companies);
    const [lastUrgSynthRow] = await db.select({ ts: sql<Date | null>`MAX(urgencyScoreSynthGeneratedAt)` }).from(companies);
    const [lastUrgNewsRow] = await db.select({ ts: sql<Date | null>`MAX(urgencyScoreNewsGeneratedAt)` }).from(companies);
    const [lastUrgLLMRow] = await db.select({ ts: sql<Date | null>`MAX(urgencyScoreLLMGeneratedAt)` }).from(companies);
    const [lastBriefRow] = await db.select({ ts: sql<Date | null>`MAX(briefGeneratedAt)` }).from(companies);
    const [lastSalesRow] = await db.select({ ts: sql<Date | null>`MAX(salesApproachGeneratedAt)` }).from(companies);

    // ── Campaign / search stats ────────────────────────────────────────────────
    const [totalSearchesRow] = await db.select({ total: count() }).from(searches);
    const [completedSearchesRow] = await db.select({ n: count() }).from(searches).where(sql`status = 'completed'`);
    const [failedSearchesRow] = await db.select({ n: count() }).from(searches).where(sql`status = 'failed'`);
    const [lastSearchRow] = await db.select({ ts: sql<Date | null>`MAX(updatedAt)` }).from(searches);

    // ── Brain stats ────────────────────────────────────────────────────────────
    const [totalBrainsRow] = await db.select({ total: count() }).from(offeringBrain);
    const [activeBrainsRow] = await db.select({ n: count() }).from(offeringBrain).where(sql`isActive = 1`);

    // ── Per-campaign breakdown (top 20 most recent) ────────────────────────────
    const campaignRows = await db
      .select({
        searchId: companies.searchId,
        total: count(),
        enriched: sql<number>`SUM(CASE WHEN enrichmentStatus = 'enriched' THEN 1 ELSE 0 END)`,
        withSimilarity: sql<number>`SUM(CASE WHEN similarityScore IS NOT NULL THEN 1 ELSE 0 END)`,
        withFit: sql<number>`SUM(CASE WHEN fitScore IS NOT NULL THEN 1 ELSE 0 END)`,
        withUrgSynth: sql<number>`SUM(CASE WHEN urgencyScoreSynth IS NOT NULL THEN 1 ELSE 0 END)`,
        withUrgNews: sql<number>`SUM(CASE WHEN urgencyScoreNews IS NOT NULL THEN 1 ELSE 0 END)`,
        withUrgLLM: sql<number>`SUM(CASE WHEN urgencyScoreLLM IS NOT NULL THEN 1 ELSE 0 END)`,
        withBrief: sql<number>`SUM(CASE WHEN briefGeneratedAt IS NOT NULL THEN 1 ELSE 0 END)`,
        withSales: sql<number>`SUM(CASE WHEN salesApproachGeneratedAt IS NOT NULL THEN 1 ELSE 0 END)`,
        withContacts: sql<number>`SUM(CASE WHEN contactsFetchedAt IS NOT NULL THEN 1 ELSE 0 END)`,
        lastActivity: sql<Date | null>`MAX(createdAt)`,
      })
      .from(companies)
      .groupBy(companies.searchId)
      .orderBy(sql`MAX(createdAt) DESC`)
      .limit(20);

    // Enrich with search names
    const searchIds = campaignRows.map((r) => r.searchId).filter(Boolean) as number[];
    let searchNames: Record<number, string> = {};
    if (searchIds.length > 0) {
      const searchRows = await db
        .select({ id: searches.id, offeringName: searches.offeringName, companyWebsite: searches.companyWebsite })
        .from(searches)
        .where(inArray(searches.id, searchIds));
      searchNames = Object.fromEntries(
        searchRows.map((s) => [s.id, s.offeringName || s.companyWebsite || `Campaign ${s.id}`])
      );
    }

    // ── Supabase sync stats (lt_companies / lt_campaign_companies schema) ────────
    // Real Supabase schema for this project: lt_mns_companies (master, 85K+),
    // lt_mns_company_pages (enriched pages, 9K+), lt_mns_company_embeddings (vectors, 71K+).
    // lt_companies / lt_campaign_companies / lt_campaigns do NOT exist in this project.
    let supabaseSyncStats = {
      // lt_mns_companies — master company registry (imported externally)
      companiesCount: 0,
      lastSyncedAt: null as string | null,
      // lt_mns_company_pages — enriched pages with fit/urgency scores
      pagesCount: 0,
      pagesLastSyncedAt: null as string | null,
      // lt_mns_company_embeddings — vector embeddings for similarity search
      embeddingsCount: 0,
      // MySQL coverage: how many Supabase companies are also in MySQL
      mysqlCoverage: 0,
      mysqlCoveragePct: 0,
    };
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

      // lt_mns_companies — master registry
      const { count: mnsCoCount } = await (supabase.from("lt_mns_companies") as any)
        .select("*", { count: "exact", head: true });
      const { data: mnsCoLast } = await (supabase.from("lt_mns_companies") as any)
        .select("updated_at").order("updated_at", { ascending: false }).limit(1).single();

      // lt_mns_company_pages — enriched campaign pages
      const { count: pagesCount } = await (supabase.from("lt_mns_company_pages") as any)
        .select("*", { count: "exact", head: true });
      const { data: latestPage } = await (supabase.from("lt_mns_company_pages") as any)
        .select("synced_at").order("synced_at", { ascending: false }).limit(1).single();

      // lt_mns_company_embeddings — vector embeddings
      const { count: embCount } = await (supabase.from("lt_mns_company_embeddings") as any)
        .select("*", { count: "exact", head: true });

      supabaseSyncStats.companiesCount = mnsCoCount ?? 0;
      supabaseSyncStats.lastSyncedAt = mnsCoLast?.updated_at ?? null;
      supabaseSyncStats.pagesCount = pagesCount ?? 0;
      supabaseSyncStats.pagesLastSyncedAt = latestPage?.synced_at ?? null;
      supabaseSyncStats.embeddingsCount = embCount ?? 0;
      // MySQL coverage: MySQL total vs Supabase master
      supabaseSyncStats.mysqlCoverage = total;
      supabaseSyncStats.mysqlCoveragePct = mnsCoCount && mnsCoCount > 0 ? Math.round((total / mnsCoCount) * 100) : 0;
    } catch (e) {
      console.warn("[DatabaseHealth] Supabase stats unavailable:", e);
    }

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return {
      generatedAt: new Date(),
      totals: {
        companies: total,
        searches: totalSearchesRow?.total ?? 0,
        completedSearches: completedSearchesRow?.n ?? 0,
        failedSearches: failedSearchesRow?.n ?? 0,
        brains: totalBrainsRow?.total ?? 0,
        activeBrains: activeBrainsRow?.n ?? 0,
        lastSearchActivity: lastSearchRow?.ts ?? null,
      },
      enrichment: {
        enriched: enrichedRow?.n ?? 0,
        pending: pendingRow?.n ?? 0,
        failed: failedRow?.n ?? 0,
        enrichedPct: pct(enrichedRow?.n ?? 0),
        lastEnrichedAt: lastEnrichedRow?.ts ?? null,
      },
      scoring: {
        similarityScore: { count: simRow?.n ?? 0, pct: pct(simRow?.n ?? 0) },
        fitScore: { count: fitRow?.n ?? 0, pct: pct(fitRow?.n ?? 0), lastAt: lastFitRow?.ts ?? null },
        urgencyScoreSynth: { count: urgSynthRow?.n ?? 0, pct: pct(urgSynthRow?.n ?? 0), lastAt: lastUrgSynthRow?.ts ?? null },
        urgencyScoreNews: { count: urgNewsRow?.n ?? 0, pct: pct(urgNewsRow?.n ?? 0), lastAt: lastUrgNewsRow?.ts ?? null },
        urgencyScoreLLM: { count: urgLLMRow?.n ?? 0, pct: pct(urgLLMRow?.n ?? 0), lastAt: lastUrgLLMRow?.ts ?? null },
        urgencyScoreHITL: { count: urgHITLRow?.n ?? 0, pct: pct(urgHITLRow?.n ?? 0) },
        fitScoreHITL: { count: fitHITLRow?.n ?? 0, pct: pct(fitHITLRow?.n ?? 0) },
      },
      content: {
        brief: { count: briefRow?.n ?? 0, pct: pct(briefRow?.n ?? 0), lastAt: lastBriefRow?.ts ?? null },
        salesApproach: { count: salesRow?.n ?? 0, pct: pct(salesRow?.n ?? 0), lastAt: lastSalesRow?.ts ?? null },
        contactsFetched: { count: contactsRow?.n ?? 0, pct: pct(contactsRow?.n ?? 0) },
        cgImported: { count: cgRow?.n ?? 0, pct: pct(cgRow?.n ?? 0) },
      },
      supabaseSync: supabaseSyncStats,
      campaigns: campaignRows.map((r) => ({
        searchId: r.searchId,
        name: r.searchId ? (searchNames[r.searchId] ?? `Campaign ${r.searchId}`) : "Unknown",
        total: r.total,
        enriched: Number(r.enriched),
        enrichedPct: r.total > 0 ? Math.round((Number(r.enriched) / r.total) * 100) : 0,
        withSimilarity: Number(r.withSimilarity),
        withFit: Number(r.withFit),
        withUrgSynth: Number(r.withUrgSynth),
        withUrgNews: Number(r.withUrgNews),
        withUrgLLM: Number(r.withUrgLLM),
        withBrief: Number(r.withBrief),
        withSales: Number(r.withSales),
        withContacts: Number(r.withContacts),
        lastActivity: r.lastActivity,
      })),
    };
  }),

  // ─── LLM Country Backfill ────────────────────────────────────────────────────
  // Infer country (ISO-2) from briefData for a single company that has no country
  // set by Apollo. Uses the executive summary, urgency signal snippets, website
  // domain TLD, and company name as signals — no external API call needed.
  inferCountryFromBrief: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { companies } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [company] = await db
        .select({
          id: companies.id,
          name: companies.name,
          websiteUrl: companies.websiteUrl,
          country: companies.country,
          city: companies.city,
          briefData: companies.briefData,
          fitScoreData: companies.fitScoreData,
        })
        .from(companies)
        .where(eq(companies.id, input.companyId))
        .limit(1);

      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      // Allow inference from fitScoreData even if briefData is missing
      const hasAnyData = company.briefData || company.fitScoreData;
      if (!hasAnyData) throw new TRPCError({ code: "BAD_REQUEST", message: "No research data available for this company" });

      // ── Extract signals from briefData ──────────────────────────────────────
      let brief: Record<string, unknown> = {};
      try { if (company.briefData) brief = JSON.parse(company.briefData); } catch { /* ignore */ }

      const execSummary = typeof brief.executiveSummary === "string"
        ? brief.executiveSummary.substring(0, 600)
        : typeof brief.executiveSummary === "object" && brief.executiveSummary !== null
          ? JSON.stringify(brief.executiveSummary).substring(0, 600)
          : "";

      const signals = Array.isArray(brief.urgencySignals)
        ? (brief.urgencySignals as Array<{ snippet?: string; description?: string }>)
            .slice(0, 3)
            .map((s) => s.snippet || s.description || "")
            .filter(Boolean)
            .join(" | ")
        : "";

      // ── Extract fit score summary (often contains explicit country mentions) ─
      let fitSummary = "";
      try {
        if (company.fitScoreData) {
          const fitData = JSON.parse(company.fitScoreData as string);
          // fitScoreData may be an object with a summary/rationale field, or an array
          if (typeof fitData === "string") {
            fitSummary = fitData.substring(0, 500);
          } else if (typeof fitData?.summary === "string") {
            fitSummary = fitData.summary.substring(0, 500);
          } else if (typeof fitData?.rationale === "string") {
            fitSummary = fitData.rationale.substring(0, 500);
          } else if (typeof fitData?.overallRationale === "string") {
            fitSummary = fitData.overallRationale.substring(0, 500);
          } else if (Array.isArray(fitData) && typeof fitData[0]?.rationale === "string") {
            fitSummary = fitData[0].rationale.substring(0, 500);
          } else {
            fitSummary = JSON.stringify(fitData).substring(0, 500);
          }
        }
      } catch { /* ignore */ }

      // urgencyData column does not exist — urgency signals are read from briefData above

      // ── Pre-compute domain geography signals before calling the LLM ──────────
      const domainHints: string[] = [];
      let hasCcTld = false;
      if (company.websiteUrl) {
        try {
          const rawUrl = company.websiteUrl.startsWith("http") ? company.websiteUrl : `https://${company.websiteUrl}`;
          const url = new URL(rawUrl);
          const host = url.hostname.toLowerCase().replace(/^www\./, "");
          // Country-code TLD map (checked longest-first to catch .co.uk / .com.vn before .uk / .vn)
          const ccTlds: [string, string][] = [
            [".co.uk", "GB"], [".com.vn", "VN"], [".com.br", "BR"], [".com.au", "AU"],
            [".de", "DE"], [".nl", "NL"], [".fr", "FR"], [".it", "IT"], [".es", "ES"],
            [".pl", "PL"], [".se", "SE"], [".no", "NO"], [".dk", "DK"], [".fi", "FI"],
            [".be", "BE"], [".ch", "CH"], [".at", "AT"], [".pt", "PT"], [".cz", "CZ"],
            [".hu", "HU"], [".ro", "RO"], [".sk", "SK"], [".uk", "GB"],
            [".cn", "CN"], [".jp", "JP"], [".kr", "KR"], [".tw", "TW"], [".hk", "HK"],
            [".sg", "SG"], [".in", "IN"], [".vn", "VN"], [".br", "BR"],
            [".mx", "MX"], [".ca", "CA"], [".za", "ZA"], [".nz", "NZ"],
          ];
          for (const [tld, code] of ccTlds) {
            if (host.endsWith(tld)) {
              domainHints.push(`STRONG SIGNAL: Domain TLD '${tld}' → headquarters country is ${code}`);
              hasCcTld = true;
              break;
            }
          }
          if (!hasCcTld) {
            // Subdomain geography signals (usa.siemens.com → US, uk.company.com → GB)
            const subMap: [string, string][] = [
              ["usa.", "US"], ["us.", "US"], ["uk.", "GB"], ["de.", "DE"],
              ["fr.", "FR"], ["nl.", "NL"], ["it.", "IT"], ["es.", "ES"],
              ["cn.", "CN"], ["jp.", "JP"], ["au.", "AU"], ["ca.", "CA"],
              ["in.", "IN"], ["sg.", "SG"], ["br.", "BR"],
            ];
            for (const [sub, code] of subMap) {
              if (host.startsWith(sub)) {
                domainHints.push(`STRONG SIGNAL: Subdomain '${sub}' → headquarters country is ${code}`);
                hasCcTld = true; // treat as definitive
                break;
              }
            }
          }
        } catch { /* ignore URL parse errors */ }
      }

      const context = [
        `Company name: ${company.name}`,
        company.websiteUrl ? `Website: ${company.websiteUrl}` : "",
        domainHints.length > 0 ? `Domain signals: ${domainHints.join("; ")}` : "",
        execSummary ? `Executive summary: ${execSummary}` : "",
        fitSummary ? `Fit analysis: ${fitSummary}` : "",
        signals ? `News signals: ${signals.substring(0, 400)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { invokeLLM } = await import("./_core/llm");
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a company HEADQUARTERS location expert. Identify the country of the company's HEADQUARTERS only — not where it sells, operates, or has customers.\n" +
              "Priority rules (apply in strict order):\n" +
              "1. If 'Domain signals: STRONG SIGNAL' is present, that IS the answer. Return it with confidence 'high'. Do not override it with text content.\n" +
              "2. Country-code TLDs (.de, .nl, .co.uk, .com.vn, etc.) are definitive.\n" +
              "3. For .com / .org / .net / .io domains with NO domain signals: infer from text if ANY field EXPLICITLY states the HQ country or city. Examples that qualify: 'US-based company', 'headquartered in Indiana', 'Chinese robotics integrator', 'founded in Shenzhen'. Use confidence 'high' for direct HQ statements, 'medium' for strong contextual clues (e.g. US state names, city names). Do NOT infer from: the language of the brief alone, countries mentioned only as customers or markets.\n" +
              "4. If unsure, return null with confidence 'low'. Never guess.\n" +
              "Return ONLY: {\"country\": \"XX\" or null, \"confidence\": \"high\" | \"medium\" | \"low\"}",
          },
          { role: "user", content: context },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "country_inference",
            strict: true,
            schema: {
              type: "object",
              properties: {
                country: { type: ["string", "null"], description: "ISO 3166-1 alpha-2 country code or null" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["country", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

            let result: { country: string | null; confidence: string } = { country: null, confidence: "low" };
      try {
        const raw = response?.choices?.[0]?.message?.content;
        if (raw) result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      } catch { /* ignore parse error */ }
      // Only write back if we got a country and confidence is high or medium
      if (result.country && (result.confidence === "high" || result.confidence === "medium")) {
        const { eq: eq2 } = await import("drizzle-orm");
        const { companies: co2 } = await import("../drizzle/schema");
        await db
          .update(co2)
          .set({ country: result.country.toUpperCase() })
          .where(eq2(co2.id, input.companyId));
      }

      return {
        companyId: input.companyId,
        companyName: company.name,
        inferredCountry: result.country,
        confidence: result.confidence,
        written: !!(result.country && (result.confidence === "high" || result.confidence === "medium")),
      };
    }),

  // Bulk backfill: process up to `limit` companies with briefData but no country.
  // Runs sequentially with a small delay to avoid LLM rate limits.
  // Returns a summary of how many were written vs skipped (low confidence).
    bulkInferCountry: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(50),
      dryRun: z.boolean().default(false), // preview mode — infer but do NOT write to DB
      searchId: z.number().optional(), // optional: restrict to a specific campaign/run
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and, or, isNull, isNotNull } = await import("drizzle-orm");
      const { companies } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const whereClause = and(
        or(isNull(companies.country), eq(companies.country, "")),
        isNotNull(companies.briefData),
        input.searchId !== undefined ? eq(companies.searchId, input.searchId) : undefined,
      );
      const batch = await db
        .select({ id: companies.id, name: companies.name, websiteUrl: companies.websiteUrl, briefData: companies.briefData, fitScoreData: companies.fitScoreData, city: companies.city, state: companies.state, rawAddress: companies.rawAddress, sourceCountryCode: companies.sourceCountryCode })
        .from(companies)
        .where(whereClause)
        .limit(input.limit);
      if (batch.length === 0) return { processed: 0, written: 0, skipped: 0, errors: 0, dryRun: input.dryRun, results: [] };
      const { invokeLLM } = await import("./_core/llm");
      let written = 0;
      let skipped = 0;
      let errors = 0;
      const results: Array<{ id: number; name: string; websiteUrl: string | null; country: string | null; confidence: string; written: boolean; domainSignal: string | null }> = [];

      // ─── Deterministic pre-LLM country resolver ─────────────────────────────
      // Returns ISO-2 + 'high' confidence for unambiguous legal entity suffixes or
      // Apollo address fields — no LLM call needed for these cases.
      function resolveCountryDeterministically(
        name: string,
        apolloCity: string | null,
        apolloState: string | null,
        apolloRawAddress: string | null,
        apolloSourceCountryCode: string | null,
      ): { country: string; confidence: 'high' } | null {
        // 1. Apollo sourceCountryCode (most reliable)
        if (apolloSourceCountryCode && /^[A-Z]{2}$/.test(apolloSourceCountryCode.trim())) {
          return { country: apolloSourceCountryCode.trim().toUpperCase(), confidence: 'high' };
        }
        // 2. Legal entity suffix in company name (unambiguous suffixes only)
        const suffixMap: [RegExp, string][] = [
          [/\b(Inc\.?|Incorporated|Corp\.?|Corporation|LLC|L\.L\.C\.?|LLP|L\.L\.P\.?|PLLC|LLLP)\b/i, 'US'],
          [/\bGmbH\b/i, 'DE'],
          [/\bAG\b(?!\s*&)/i, 'DE'],  // AG alone (not AG & Co)
          [/\bGmbH\s*&\s*Co\.?\s*KG\b/i, 'DE'],
          [/\bKG\b/i, 'DE'],
          [/\bOHG\b/i, 'DE'],
          [/\bB\.?V\.?\b/i, 'NL'],
          [/\bN\.?V\.?\b/i, 'NL'],
          [/\bS\.?A\.?S\.?\b/i, 'FR'],
          [/\bS\.?A\.?R\.?L\.?\b/i, 'FR'],
          [/\bS\.?A\.?\b(?!\s*S)/i, 'FR'],
          [/\bPte\.?\s*Ltd\.?\b/i, 'SG'],
          [/\bS\.?R\.?L\.?\b/i, 'IT'],
          [/\bS\.?p\.?A\.?\b/i, 'IT'],
          [/\bAB\b/i, 'SE'],
          [/\bAS\b/i, 'NO'],
          [/\bA\/S\b/i, 'DK'],
          [/\bOy\b/i, 'FI'],
          [/\bSp\.?\s*z\.?\s*o\.?\s*o\.?\b/i, 'PL'],
          [/\bS\.?A\.?\s*de\s*C\.?V\.?\b/i, 'MX'],
          [/\bLtda?\.?\b/i, 'BR'],
          [/\bPty\.?\s*Ltd\.?\b/i, 'AU'],
        ];
        for (const [re, code] of suffixMap) {
          if (re.test(name)) return { country: code, confidence: 'high' };
        }
        // 3. Apollo city/state/rawAddress — look for explicit US state abbreviations
        const addressText = [apolloCity, apolloState, apolloRawAddress].filter(Boolean).join(' ');
        if (addressText) {
          const usStates = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;
          if (usStates.test(addressText)) return { country: 'US', confidence: 'high' };
          const deKeywords = /\b(Bayern|Berlin|Hamburg|München|Frankfurt|Stuttgart|Düsseldorf|Köln|Dresden|Leipzig|Hannover|Bremen|Nürnberg)\b/i;
          if (deKeywords.test(addressText)) return { country: 'DE', confidence: 'high' };
          const nlKeywords = /\b(Amsterdam|Rotterdam|Den Haag|Utrecht|Eindhoven|Noord|Zuid|Noord-Holland|Zuid-Holland)\b/i;
          if (nlKeywords.test(addressText)) return { country: 'NL', confidence: 'high' };
        }
        return null;
      }

      // Shared helper: extract domain geography signals (same logic as single-company procedure)
      function extractDomainSignals(websiteUrl: string | null): { hints: string[]; isDefinitive: boolean } {
        if (!websiteUrl) return { hints: [], isDefinitive: false };
        try {
          const rawUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
          const url = new URL(rawUrl);
          const host = url.hostname.toLowerCase().replace(/^www\./, "");
          const ccTlds: [string, string][] = [
            [".co.uk", "GB"], [".com.vn", "VN"], [".com.br", "BR"], [".com.au", "AU"],
            [".de", "DE"], [".nl", "NL"], [".fr", "FR"], [".it", "IT"], [".es", "ES"],
            [".pl", "PL"], [".se", "SE"], [".no", "NO"], [".dk", "DK"], [".fi", "FI"],
            [".be", "BE"], [".ch", "CH"], [".at", "AT"], [".pt", "PT"], [".cz", "CZ"],
            [".hu", "HU"], [".ro", "RO"], [".sk", "SK"], [".uk", "GB"],
            [".cn", "CN"], [".jp", "JP"], [".kr", "KR"], [".tw", "TW"], [".hk", "HK"],
            [".sg", "SG"], [".in", "IN"], [".vn", "VN"], [".br", "BR"],
            [".mx", "MX"], [".ca", "CA"], [".za", "ZA"], [".nz", "NZ"],
          ];
          for (const [tld, code] of ccTlds) {
            if (host.endsWith(tld)) return { hints: [`STRONG SIGNAL: Domain TLD '${tld}' → headquarters country is ${code}`], isDefinitive: true };
          }
          const subMap: [string, string][] = [
            ["usa.", "US"], ["us.", "US"], ["uk.", "GB"], ["de.", "DE"],
            ["fr.", "FR"], ["nl.", "NL"], ["it.", "IT"], ["es.", "ES"],
            ["cn.", "CN"], ["jp.", "JP"], ["au.", "AU"], ["ca.", "CA"],
            ["in.", "IN"], ["sg.", "SG"], ["br.", "BR"],
          ];
          for (const [sub, code] of subMap) {
            if (host.startsWith(sub)) return { hints: [`STRONG SIGNAL: Subdomain '${sub}' → headquarters country is ${code}`], isDefinitive: true };
          }
        } catch { /* ignore */ }
        return { hints: [], isDefinitive: false };
      }

      for (const co of batch) {
        try {
          let brief: Record<string, unknown> = {};
          try { brief = JSON.parse(co.briefData!); } catch { /* ignore */ }

          // Flatten executiveSummary: if it's a metadata object (not a narrative string), convert to readable text
          let execSummaryText = "";
          if (typeof brief.executiveSummary === "string") {
            execSummaryText = brief.executiveSummary.substring(0, 600);
          } else if (typeof brief.executiveSummary === "object" && brief.executiveSummary !== null) {
            const es = brief.executiveSummary as Record<string, unknown>;
            // Build a readable sentence from the metadata fields
            const parts: string[] = [];
            if (es.company) parts.push(`Company: ${es.company}`);
            if (es.industry && es.industry !== "Unknown") parts.push(`Industry: ${es.industry}`);
            if (es.employees && es.employees !== "Unknown") parts.push(`Employees: ${es.employees}`);
            if (es.revenue && es.revenue !== "Unknown") parts.push(`Revenue: ${es.revenue}`);
            if (es.headquarters) parts.push(`Headquarters: ${es.headquarters}`);
            if (es.location) parts.push(`Location: ${es.location}`);
            execSummaryText = parts.join("; ");
          }

          // Read productsServices[0].description — often contains "X-based manufacturer" language
          const prodDesc = Array.isArray(brief.productsServices)
            ? (brief.productsServices as Array<{ description?: string; category?: string }>)
                .slice(0, 2)
                .map((p) => [p.category, p.description].filter(Boolean).join(": "))
                .join(" | ")
                .substring(0, 400)
            : "";

          // Read recentDevelopments[0].text — narrative snippets with company context
          const devText = Array.isArray(brief.recentDevelopments)
            ? (brief.recentDevelopments as Array<{ text?: string }>)
                .slice(0, 2)
                .map((d) => d.text || "")
                .filter(Boolean)
                .join(" | ")
                .substring(0, 400)
            : "";

          // NOTE: urgencySignals intentionally excluded — they contain trade show/event city names
          // (e.g. "AUTOMATE 2026 Chicago") which mislead the model into inferring US/Mexico/Brazil.

          // Read fitScoreData narrative — this is the richest source of "X-based" language
          // (e.g. "Independence Automation Services LLC is a small US-based industrial automation...")
          let fitNarrative = "";
          try {
            const fsd = JSON.parse((co as any).fitScoreData || "{}");
            // Try common narrative field names used by the fit score LLM
            const narrative =
              fsd.narrative ||
              fsd.summary ||
              fsd.overallAssessment ||
              fsd.executiveSummary ||
              fsd.reasoning ||
              fsd.assessment ||
              fsd.companyProfile ||
              "";
            if (typeof narrative === "string") {
              fitNarrative = narrative.substring(0, 600);
            } else if (typeof narrative === "object" && narrative !== null) {
              fitNarrative = JSON.stringify(narrative).substring(0, 600);
            }
            // Also check for a top-level string field that looks like a paragraph
            if (!fitNarrative) {
              for (const v of Object.values(fsd)) {
                if (typeof v === "string" && v.length > 80 && /based|headquarter|located|founded/i.test(v)) {
                  fitNarrative = v.substring(0, 600);
                  break;
                }
              }
            }
          } catch { /* ignore */ }

          // ── Deterministic pre-check: skip LLM for unambiguous cases ──────────
          const deterministicResult = resolveCountryDeterministically(
            co.name,
            (co as any).city ?? null,
            (co as any).state ?? null,
            (co as any).rawAddress ?? null,
            (co as any).sourceCountryCode ?? null,
          );
          if (deterministicResult) {
            const shouldWrite = !input.dryRun;
            if (shouldWrite) {
              const { eq: eqUpd } = await import('drizzle-orm');
              const { companies: coUpd } = await import('../drizzle/schema');
              await db.update(coUpd).set({ country: deterministicResult.country }).where(eqUpd(coUpd.id, co.id));
              written++;
            } else {
              written++; // dry-run count
            }
            results.push({
              id: co.id,
              name: co.name,
              websiteUrl: co.websiteUrl ?? null,
              country: deterministicResult.country,
              confidence: deterministicResult.confidence,
              written: true,
              domainSignal: 'deterministic (suffix/address)',
            });
            continue; // skip LLM call entirely
          }

          // ── LinkedIn JSON-LD fallback: fetch public LinkedIn page, extract Organization.address.addressCountry ──
          const linkedinUrl: string | null = (co as any).linkedinUrl ?? null;
          if (linkedinUrl && linkedinUrl.includes('linkedin.com/company/')) {
            try {
              const liRes = await fetch(linkedinUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
                signal: AbortSignal.timeout(8000),
              });
              if (liRes.ok) {
                const html = await liRes.text();
                // Extract all JSON-LD blocks and look for Organization with address.addressCountry
                // Use exec loop instead of matchAll for ES2017 compat; strip newlines before matching
                const htmlFlat = html.replace(/\r?\n/g, ' ');
                const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gi;
                let ldMatch: RegExpExecArray | null;
                let liCountryFound = false;
                while ((ldMatch = ldRe.exec(htmlFlat)) !== null && !liCountryFound) {
                  try {
                    const parsed = JSON.parse(ldMatch[1]);
                    const orgs: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
                    for (const org of orgs) {
                      const o = org as Record<string, any>;
                      const countryCode: string | null = o?.address?.addressCountry ?? o?.location?.addressCountry ?? null;
                      if (countryCode && typeof countryCode === 'string' && /^[A-Z]{2}$/.test(countryCode.trim())) {
                        const country = countryCode.trim().toUpperCase();
                        if (!input.dryRun) {
                          const { eq: eqUpd } = await import('drizzle-orm');
                          const { companies: coUpd } = await import('../drizzle/schema');
                          await db.update(coUpd).set({ country }).where(eqUpd(coUpd.id, co.id));
                          written++;
                        } else {
                          written++;
                        }
                        results.push({ id: co.id, name: co.name, websiteUrl: co.websiteUrl ?? null, country, confidence: 'high', written: true, domainSignal: 'linkedin-jsonld' });
                        liCountryFound = true;
                        break;
                      }
                    }
                  } catch { /* ignore malformed JSON-LD */ }
                }
              }
            } catch { /* timeout or network error — fall through to LLM */ }
          }

          const { hints: domainHints } = extractDomainSignals(co.websiteUrl ?? null);
          const context = [
            `Company name: ${co.name}`,
            co.websiteUrl ? `Website: ${co.websiteUrl}` : "",
            domainHints.length > 0 ? `Domain signals: ${domainHints.join("; ")}` : "",
            fitNarrative ? `Company profile (fit assessment): ${fitNarrative}` : "",
            execSummaryText ? `Company metadata: ${execSummaryText}` : "",
            prodDesc ? `Products/services: ${prodDesc}` : "",
            devText ? `Recent developments: ${devText}` : "",
          ]
            .filter(Boolean)
            .join("\n");
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "You are a company HEADQUARTERS location expert. Identify the ISO-2 country code of the company's HEADQUARTERS only.\n" +
                  "CRITICAL: Do NOT infer from trade show locations, event cities, customer countries, or markets served.\n" +
                  "Priority rules (apply in strict order):\n" +
                  "1. If 'Domain signals: STRONG SIGNAL' is present, that IS the answer — return it with confidence 'high'.\n" +
                  "2. Country-code TLDs (.de, .nl, .co.uk, .com.vn, .cn, .sg, etc.) are definitive.\n" +
                  "3. For generic TLDs (.com/.org/.net/.io): infer ONLY if the text EXPLICITLY states the HQ city/country (e.g. 'Singapore-based', 'headquartered in Ningbo, China', 'Pte. Ltd.' → SG).\n" +
                  "4. Legal entity suffixes are strong signals: 'Pte. Ltd.' → SG, 'GmbH/AG' → DE/CH/AT, 'BV/NV' → NL/BE, 'Ltd.' alone → ambiguous.\n" +
                  "5. If unsure, return null with confidence 'low'. Never guess from event or customer locations.\n" +
                  "Return ONLY: {\"country\": \"XX\" or null, \"confidence\": \"high\" | \"medium\" | \"low\"}",
              },
              { role: "user", content: context },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "country_inference",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    country: { type: ["string", "null"], description: "ISO 3166-1 alpha-2 country code or null" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["country", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          });
          let result: { country: string | null; confidence: string } = { country: null, confidence: "low" };
          try {
            const raw = response?.choices?.[0]?.message?.content;
            if (raw) result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          } catch { /* ignore */ }
          const shouldWrite = !!(result.country && (result.confidence === "high" || result.confidence === "medium"));
          // Only write to DB if NOT a dry run
          if (shouldWrite && !input.dryRun) {
            const { eq: eqUpd } = await import("drizzle-orm");
            const { companies: coUpd } = await import("../drizzle/schema");
            await db.update(coUpd).set({ country: result.country!.toUpperCase() }).where(eqUpd(coUpd.id, co.id));
            written++;
          } else if (shouldWrite && input.dryRun) {
            written++; // count as "would write" in dry-run
          } else {
            skipped++;
          }
          results.push({
            id: co.id,
            name: co.name,
            websiteUrl: co.websiteUrl ?? null,
            country: result.country,
            confidence: result.confidence,
            written: shouldWrite,
            domainSignal: domainHints.length > 0 ? domainHints[0] : null,
          });
        } catch (e) {
          errors++;
          results.push({ id: co.id, name: co.name, websiteUrl: co.websiteUrl ?? null, country: null, confidence: "error", written: false, domainSignal: null });
        }
      }
      return { processed: batch.length, written, skipped, errors, dryRun: input.dryRun, results };
    }),

  // Count companies eligible for country backfill (no country, has briefData)
  getCountryBackfillStats: protectedProcedure
    .input(z.object({ searchId: z.number().optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { count, sql, eq, and } = await import("drizzle-orm");
      const { companies } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) return { eligible: 0, total: 0, missingCountry: 0 };
      const whereClause = input.searchId !== undefined ? eq(companies.searchId, input.searchId) : undefined;
      const [stats] = await db
        .select({
          total: count(),
          missingCountry: count(sql`CASE WHEN (${companies.country} IS NULL OR ${companies.country} = '') THEN 1 END`),
          eligible: count(sql`CASE WHEN (${companies.country} IS NULL OR ${companies.country} = '') AND ${companies.briefData} IS NOT NULL THEN 1 END`),
        })
        .from(companies)
        .where(whereClause);
      return {
        total: Number(stats.total),
        missingCountry: Number(stats.missingCountry),
        eligible: Number(stats.eligible),
      };
    }),

  // ── Ghost Duplicate Deduplication ──────────────────────────────────────────
  // A "ghost duplicate" is a company row that shares a domain with another row
  // that has actual data (briefData / fitScoreData), but is itself empty.
  // These accumulate when Apollo returns the same company across multiple searches.

  getDuplicateStats: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { totalGhosts: 0, affectedDomains: 0 };
    // Count ghost rows: same primaryDomain as another row, but no briefData AND no fitScoreData
    const rawResult = await db.execute<any>(`
      SELECT
        COUNT(*) AS totalGhosts,
        COUNT(DISTINCT c.primaryDomain) AS affectedDomains
      FROM companies c
      WHERE
        c.primaryDomain IS NOT NULL
        AND c.primaryDomain != ''
        AND (c.briefData IS NULL OR c.briefData = '{}' OR c.briefData = '')
        AND (c.fitScoreData IS NULL OR c.fitScoreData = '{}' OR c.fitScoreData = '')
        AND EXISTS (
          SELECT 1 FROM companies c2
          WHERE c2.primaryDomain = c.primaryDomain
            AND c2.id != c.id
            AND c2.briefData IS NOT NULL
            AND c2.briefData != '{}'
            AND c2.briefData != ''
        )
    `);
    const resultRows = Array.isArray(rawResult) ? (Array.isArray(rawResult[0]) ? rawResult[0] : rawResult) : [];
    const firstRow = (resultRows as any[])[0] ?? {};
    return {
      totalGhosts: Number(firstRow?.totalGhosts ?? 0),
      affectedDomains: Number(firstRow?.affectedDomains ?? 0),
    };
  }),

  previewDuplicates: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { rows: [] };
      const rawRows = await db.execute<any>(`
        SELECT
          c.id,
          c.name,
          c.primaryDomain,
          c.websiteUrl,
          c.searchId,
          c.country,
          c.createdAt,
          keeper.id AS keeperId,
          keeper.name AS keeperName,
          keeper.country AS keeperCountry
        FROM companies c
        JOIN (
          SELECT primaryDomain, MIN(id) AS id
          FROM companies
          WHERE briefData IS NOT NULL AND briefData != '{}' AND briefData != ''
          GROUP BY primaryDomain
        ) best ON best.primaryDomain = c.primaryDomain
        JOIN companies keeper ON keeper.id = best.id
        WHERE
          c.primaryDomain IS NOT NULL
          AND c.primaryDomain != ''
          AND (c.briefData IS NULL OR c.briefData = '{}' OR c.briefData = '')
          AND (c.fitScoreData IS NULL OR c.fitScoreData = '{}' OR c.fitScoreData = '')
          AND c.id != best.id
        ORDER BY c.primaryDomain, c.id
        LIMIT ${input.limit}
      `);
      const previewRows = Array.isArray(rawRows) ? (Array.isArray(rawRows[0]) ? rawRows[0] : rawRows) : [];
      return { rows: previewRows as Array<{ id: number; name: string; primaryDomain: string; websiteUrl: string | null; searchId: number | null; country: string | null; createdAt: string | null; keeperId: number; keeperName: string; keeperCountry: string | null }> };
    }),

  purgeDuplicates: protectedProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Identify ghost IDs
      const rawGhostRows = await db.execute<any>(`
        SELECT c.id
        FROM companies c
        WHERE
          c.primaryDomain IS NOT NULL
          AND c.primaryDomain != ''
          AND (c.briefData IS NULL OR c.briefData = '{}' OR c.briefData = '')
          AND (c.fitScoreData IS NULL OR c.fitScoreData = '{}' OR c.fitScoreData = '')
          AND EXISTS (
            SELECT 1 FROM companies c2
            WHERE c2.primaryDomain = c.primaryDomain
              AND c2.id != c.id
              AND c2.briefData IS NOT NULL
              AND c2.briefData != '{}'
              AND c2.briefData != ''
          )
      `);
      const ghostRowsArr = Array.isArray(rawGhostRows) ? (Array.isArray(rawGhostRows[0]) ? rawGhostRows[0] : rawGhostRows) : [];
      const ghostIds = (ghostRowsArr as Array<{ id: number }>).map((r) => r.id);
      if (ghostIds.length === 0) return { deleted: 0, dryRun: input.dryRun };
      if (!input.dryRun) {
        // Delete in batches of 500 to avoid huge IN clauses
        const batchSize = 500;
        let deleted = 0;
        for (let i = 0; i < ghostIds.length; i += batchSize) {
          const batch = ghostIds.slice(i, i + batchSize);
          const placeholders = batch.map(() => "?").join(",");
          // Use raw mysql2 for parameterized batch delete
          const mysql2 = await import("mysql2/promise");
          const conn = await mysql2.createConnection(process.env.DATABASE_URL!);
          await conn.execute(`DELETE FROM companies WHERE id IN (${placeholders})`, batch);
          await conn.end();
          deleted += batch.length;
        }
        return { deleted, dryRun: false };
      }
      return { deleted: ghostIds.length, dryRun: true };
    }),

  // ── Similarity-Based Campaign Creation ──────────────────────────────────────
  /**
   * Preview the top N companies from the existing DB ranked by cosine similarity
   * against a given Brain — no writes, no Apollo calls.
   */
  previewSimilaritySearch: protectedProcedure
    .input(z.object({
      brainId: z.number(),
      minSim: z.number().min(0).max(100).default(55),
      maxResults: z.number().min(1).max(500).default(200),
    }))
    .query(async ({ input }) => {
      const { createClient } = await import("@supabase/supabase-js");
      const { v5: uuidv5 } = await import("uuid");
      const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const { inArray: inArr } = await import("drizzle-orm");
      const { companies } = await import("../drizzle/schema");
      const { getDb: _getDb1 } = await import("./db");
      const db = await _getDb1();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const sb = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      // 1. Fetch brain embedding
      const { data: brainRow, error: brainErr } = await sb
        .from("lt_mns_brain_embeddings")
        .select("embedding")
        .eq("brain_id", String(input.brainId))
        .single();
      if (brainErr || !brainRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: `No embedding found for brain ${input.brainId}. Please generate the brain embedding first.` });
      }
      const brainVec: number[] = typeof brainRow.embedding === "string"
        ? JSON.parse(brainRow.embedding)
        : (brainRow.embedding as number[]);
      // 2. Fetch all company embeddings from Supabase (paginated)
      const PAGE = 1000;
      const scored: { watchlistId: string; score: number }[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: rows, error } = await sb
          .from("lt_mns_company_embeddings")
          .select("watchlist_id, embedding")
          .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error || !rows || rows.length === 0) { hasMore = false; break; }
        for (const row of rows) {
          const vec: number[] = typeof row.embedding === "string" ? JSON.parse(row.embedding) : (row.embedding as number[]);
          let dot = 0, ma = 0, mb = 0;
          for (let i = 0; i < vec.length; i++) { dot += vec[i] * brainVec[i]; ma += vec[i] ** 2; mb += brainVec[i] ** 2; }
          const sim = (ma === 0 || mb === 0) ? 0 : dot / (Math.sqrt(ma) * Math.sqrt(mb));
          const score = Math.round(((sim + 1) / 2) * 100);
          if (score >= input.minSim) scored.push({ watchlistId: row.watchlist_id, score });
        }
        if (rows.length < PAGE) hasMore = false;
        else page++;
      }
      // 3. Sort by score desc, take top N
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, input.maxResults);
      if (top.length === 0) return { companies: [], brainId: input.brainId, totalMatched: 0 };
      // 4. Build UUID → MySQL ID map
      const allCompanyIds = await db.select({ id: companies.id }).from(companies);
      const mysqlUuidMap = new Map<string, number>();
      for (const { id } of allCompanyIds) {
        mysqlUuidMap.set(uuidv5(`company-${id}`, LT_NAMESPACE), id);
      }
      const topWithIds = top
        .map(t => ({ ...t, mysqlId: mysqlUuidMap.get(t.watchlistId) }))
        .filter((t): t is { watchlistId: string; score: number; mysqlId: number } => t.mysqlId !== undefined);
      if (topWithIds.length === 0) return { companies: [], brainId: input.brainId, totalMatched: 0 };
      // 5. Fetch company details from MySQL
      const ids = topWithIds.map(t => t.mysqlId);
      const companyRows = await db
        .select({
          id: companies.id,
          name: companies.name,
          websiteUrl: companies.websiteUrl,
          primaryDomain: companies.primaryDomain,
          city: companies.city,
          country: companies.country,
          sector: companies.sector,
          fitScore: companies.fitScore,
          searchId: companies.searchId,
          generatedWithBrainName: companies.generatedWithBrainName,
        })
        .from(companies)
        .where(inArr(companies.id, ids));
      // 6. Merge sim scores and sort
      const simMap = new Map(topWithIds.map(t => [t.mysqlId, t.score]));
      const result = companyRows
        .map(c => ({ ...c, simScore: simMap.get(c.id) ?? 0 }))
        .sort((a, b) => b.simScore - a.simScore);
      return { companies: result, brainId: input.brainId, totalMatched: scored.length };
    }),

  /**
   * Create a new campaign from a similarity search result — no Apollo calls.
   * Clones matching companies into a new search row and queues score_only FIT jobs.
   */
  createCampaignFromSimilarity: protectedProcedure
    .input(z.object({
      brainId: z.number(),
      campaignName: z.string().min(1).max(255),
      companyIds: z.array(z.number()).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { inArray: inArr, sql: sqlRaw } = await import("drizzle-orm");
      const { companies } = await import("../drizzle/schema");
      const { getDb: _getDb2 } = await import("./db");
      const db = await _getDb2();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // 1. Fetch brain info
      const brainRows = await db.execute(
        sqlRaw`SELECT id, brainName, companyWebsite FROM offering_brain WHERE id = ${input.brainId} LIMIT 1`
      ) as unknown as { id: number; brainName: string; companyWebsite: string }[];
      const brainArr = Array.isArray(brainRows[0]) ? brainRows[0] : brainRows;
      if (!brainArr || brainArr.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Brain ${input.brainId} not found` });
      }
      const brain = (brainArr as { id: number; brainName: string; companyWebsite: string }[])[0];
      // 2. Create search row
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: brain.companyWebsite || "similarity-search",
        location: input.campaignName,
        offeringName: `[SIM] ${input.campaignName}`,
        brainId: input.brainId,
        status: "completed",
        sharedWithTeam: 0,
        isArchived: 0,
      });
      // 3. Fetch source company data
      const sourceCompanies = await db
        .select()
        .from(companies)
        .where(inArr(companies.id, input.companyIds));
      // 4. Clone companies into new search (preserve enrichment, reset scoring)
      const toInsert = sourceCompanies.map(c => ({
        searchId,
        name: c.name,
        apolloId: c.apolloId,
        websiteUrl: c.websiteUrl,
        primaryDomain: c.primaryDomain,
        linkedinUrl: c.linkedinUrl,
        twitterUrl: c.twitterUrl,
        facebookUrl: c.facebookUrl,
        phone: c.phone,
        foundedYear: c.foundedYear,
        revenue: c.revenue,
        headcountGrowth: c.headcountGrowth,
        parentCompanyName: c.parentCompanyName,
        parentCompanyId: c.parentCompanyId,
        searchLocation: c.searchLocation,
        city: c.city,
        state: c.state,
        country: c.country,
        streetAddress: c.streetAddress,
        rawAddress: c.rawAddress,
        sicCodes: c.sicCodes,
        naicsCodes: c.naicsCodes,
        sector: c.sector,
        sliceMetadata: c.sliceMetadata,
        similarityScore: c.similarityScore,
        enrichmentStatus: c.enrichmentStatus,
        generatedWithBrainId: input.brainId,
        generatedWithBrainName: brain.brainName,
      }));
      if (toInsert.length > 0) {
        await createCompanies(toInsert as any);
      }
      // 5. Fetch newly inserted company IDs for this search
      const newCompanies = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(sqlRaw`${companies.searchId} = ${searchId}`);
      // 6. Queue score_only FIT jobs
      if (newCompanies.length > 0) {
        const { campaignQueue } = await import("../drizzle/schema");
        await db.insert(campaignQueue).values(
          newCompanies.map(c => ({
            searchId,
            companyId: c.id,
            userId: ctx.user.id,
            companyName: c.name,
            jobType: "score_only" as const,
            status: "pending" as const,
          }))
        );
      }
      return { searchId, companiesCreated: newCompanies.length };
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

// ── Similarity-Based Campaign Creation ──────────────────────────────────────
// These procedures are appended to the router via module augmentation below.
// We extend the router by re-exporting a merged router in routers.ts instead.
