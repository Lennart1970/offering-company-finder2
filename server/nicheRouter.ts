/**
 * nicheRouter.ts
 *
 * tRPC procedures for niche-level fit scoring.
 *
 * Procedures:
 *   niche.create         — Create a niche cluster manually (for testing / import pipeline)
 *   niche.scoreNiches    — Batch score all niches for a search against the active Brain
 *   niche.rescoreNiche   — Re-score a single niche (e.g. after Brain update)
 *   niche.getNiches      — List niches for a search, sorted by fitScore desc
 *   niche.getAllNiches    — List all niches for the current user
 *   niche.deleteNiche    — Delete a niche by ID
 */

import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createNiche,
  getNichesBySearchId,
  getNichesByParentId,
  deleteNichesByParentId,
  getNichesByUserId,
  getNicheById,
  updateNiche,
  deleteNichesBySearchId,
  getCompaniesBySearchId,
  getCompaniesByNicheId,
  countCompaniesByNicheId,
  updateCompany,
  createSearch,
  getSearchById,
  createCompanies,
} from "./db";
import { scoreNicheFit, NicheClusterInput } from "./nicheFitScorer";
import { generateEmbeddings } from "./embeddingService";
import { clusterCompanies, assignRemainingByProximity, expandWithDiscovery } from "./clusteringService";
import { companies, searches } from "../drizzle/schema";
import { eq, isNull, inArray } from "drizzle-orm";
import { getDb } from "./db";

export const nicheRouter = router({
  /**
   * Full pipeline: generate embeddings → k-means clustering → save niches → score against Brain.
   * Called automatically after CSV import completes.
   */
  clusterAndSaveNiches: adminProcedure
    .input(
      z.object({
        searchId: z.number(),
        autoScore: z.boolean().default(true), // score niches against active Brain after clustering
        targetGroupSize: z.number().min(50).max(2000).optional(), // target companies per cluster (derives K)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Load all companies for this search
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const allCompanies = await db
        .select()
        .from(companies)
        .where(eq(companies.searchId, input.searchId));

      if (allCompanies.length < 9) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Need at least 9 companies to cluster. This search has ${allCompanies.length}.`,
        });
      }

      console.log(`[nicheRouter] Starting clustering for search ${input.searchId}: ${allCompanies.length} companies`);

      // 2. Delete any existing niches for this search (re-clustering)
      await deleteNichesBySearchId(input.searchId);

      // 3. Generate embeddings
      console.log(`[nicheRouter] Generating embeddings...`);
      const embeddings = await generateEmbeddings(allCompanies);

      // 4. Cluster
      console.log(`[nicheRouter] Running k-means clustering (targetGroupSize=${input.targetGroupSize ?? 'auto'})...`);
      const clusters = await clusterCompanies(embeddings, allCompanies, {
        targetGroupSize: input.targetGroupSize,
      });

      // 5. Persist niches
      console.log(`[nicheRouter] Saving ${clusters.length} niches...`);
      const nicheIds: number[] = [];
      // Map clusterIndex → nicheId for Phase 1 company assignment
      const clusterIndexToNicheId = new Map<number, number>();
      for (const cluster of clusters) {
        const id = await createNiche({
          userId,
          searchId: input.searchId,
          brainId: null,
          name: cluster.name,
          description: cluster.description,
          companyCount: cluster.companyIds.length,
          topKeywords: JSON.stringify(cluster.topKeywords),
          sampleCompanies: JSON.stringify(cluster.sampleCompanies),
          companyIds: JSON.stringify(cluster.companyIds),
          centroid: JSON.stringify(cluster.centroid),
          rationale: null,
        });
        nicheIds.push(id);
        clusterIndexToNicheId.set(cluster.clusterIndex, id);
      }

      // 5b. Assign seed companies' nicheId in DB (Phase 1 companies only)
      console.log(`[nicheRouter] Assigning nicheId to seed companies...`);
      for (const cluster of clusters) {
        const nicheId = clusterIndexToNicheId.get(cluster.clusterIndex);
        if (!nicheId) continue;
        for (const companyId of cluster.companyIds) {
          await updateCompany(companyId, { nicheId });
        }
      }

      // 6. Auto-score against active Brain (if requested)
      let scoredCount = 0;
      if (input.autoScore) {
        console.log(`[nicheRouter] Auto-scoring ${clusters.length} niches against active Brain...`);
        const savedNiches = await getNichesBySearchId(input.searchId);
        for (const niche of savedNiches) {
          try {
            const clusterInput: NicheClusterInput = {
              name: niche.name,
              description: niche.description,
              topKeywords: niche.topKeywords ? JSON.parse(niche.topKeywords) : [],
              sampleCompanies: niche.sampleCompanies ? JSON.parse(niche.sampleCompanies) : [],
              rationale: niche.rationale,
              companyCount: niche.companyCount,
            };
            const result = await scoreNicheFit(clusterInput, userId);
            await updateNiche(niche.id, {
              fitScore: result.fitScore,
              fitReasoning: result.fitReasoning,
              scoreBreakdown: JSON.stringify(result.scoreBreakdown),
              scoredAt: new Date(),
              scoredWithBrainId: result.brainId,
              brainId: result.brainId,
            });
            scoredCount++;
          } catch (err: any) {
            console.error(`[nicheRouter] Failed to score niche ${niche.id}:`, err.message);
          }
        }
      }

      const seedCount = clusters.reduce((sum, c) => sum + c.companyIds.length, 0);

      return {
        searchId: input.searchId,
        seedCount,
        totalCompanies: allCompanies.length,
        companiesProcessed: allCompanies.length, // kept for backward compat
        nichesCreated: clusters.length,
        nichesScored: scoredCount,
        nicheIds,
        clusters: clusters.map((c) => ({
          name: c.name,
          description: c.description,
          companyCount: c.companyIds.length,
          sampleCompanies: c.sampleCompanies,
          topKeywords: c.topKeywords,
        })),
      };
    }),

  /**
   * Create a niche cluster (manual entry or from import pipeline).
   * Returns the new niche ID.
   */
  create: adminProcedure
    .input(
      z.object({
        searchId: z.number().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        companyCount: z.number().default(0),
        topKeywords: z.array(z.string()).optional(),
        sampleCompanies: z.array(z.string()).optional(),
        companyIds: z.array(z.number()).optional(),
        rationale: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const id = await createNiche({
        userId,
        searchId: input.searchId ?? null,
        brainId: null,
        name: input.name,
        description: input.description ?? null,
        companyCount: input.companyCount,
        topKeywords: input.topKeywords ? JSON.stringify(input.topKeywords) : null,
        sampleCompanies: input.sampleCompanies ? JSON.stringify(input.sampleCompanies) : null,
        companyIds: input.companyIds ? JSON.stringify(input.companyIds) : null,
        rationale: input.rationale ?? null,
      });
      return { id };
    }),

  /**
   * Batch score all niches for a given searchId against the active Offering Brain.
   * Skips niches that were already scored with the current brain version.
   */
  scoreNiches: adminProcedure
    .input(
      z.object({
        searchId: z.number(),
        force: z.boolean().default(false), // force re-score even if already scored
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const allNiches = await getNichesBySearchId(input.searchId);

      if (allNiches.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No niches found for this search. Create niches first.",
        });
      }

      const results = [];
      for (const niche of allNiches) {
        try {
          const clusterInput: NicheClusterInput = {
            name: niche.name,
            description: niche.description,
            topKeywords: niche.topKeywords ? JSON.parse(niche.topKeywords) : [],
            sampleCompanies: niche.sampleCompanies ? JSON.parse(niche.sampleCompanies) : [],
            rationale: niche.rationale,
            companyCount: niche.companyCount,
          };

          const result = await scoreNicheFit(clusterInput, userId);

          await updateNiche(niche.id, {
            fitScore: result.fitScore,
            fitReasoning: result.fitReasoning,
            scoreBreakdown: JSON.stringify(result.scoreBreakdown),
            scoredAt: new Date(),
            scoredWithBrainId: result.brainId,
            brainId: result.brainId,
          });

          results.push({
            nicheId: niche.id,
            nicheName: niche.name,
            fitScore: result.fitScore,
            dimensions: result.scoreBreakdown.length,
            status: "scored" as const,
          });
        } catch (err: any) {
          console.error(`[nicheRouter] Failed to score niche ${niche.id}:`, err.message);
          results.push({
            nicheId: niche.id,
            nicheName: niche.name,
            fitScore: -1,
            dimensions: 0,
            status: "error" as const,
            error: err.message,
          });
        }
      }

      const scored = results.filter((r) => r.status === "scored").length;
      const failed = results.filter((r) => r.status === "error").length;

      return {
        total: allNiches.length,
        scored,
        failed,
        results,
      };
    }),

  /**
   * Re-score a single niche against the active Offering Brain.
   */
  rescoreNiche: adminProcedure
    .input(z.object({ nicheId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const niche = await getNicheById(input.nicheId);

      if (!niche || niche.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Niche not found" });
      }

      const clusterInput: NicheClusterInput = {
        name: niche.name,
        description: niche.description,
        topKeywords: niche.topKeywords ? JSON.parse(niche.topKeywords) : [],
        sampleCompanies: niche.sampleCompanies ? JSON.parse(niche.sampleCompanies) : [],
        rationale: niche.rationale,
        companyCount: niche.companyCount,
      };

      const result = await scoreNicheFit(clusterInput, userId);

      await updateNiche(niche.id, {
        fitScore: result.fitScore,
        fitReasoning: result.fitReasoning,
        scoreBreakdown: JSON.stringify(result.scoreBreakdown),
        scoredAt: new Date(),
        scoredWithBrainId: result.brainId,
        brainId: result.brainId,
      });

      return {
        nicheId: niche.id,
        fitScore: result.fitScore,
        fitReasoning: result.fitReasoning,
        scoreBreakdown: result.scoreBreakdown,
        brainName: result.brainName,
        scoredAt: result.scoredAt,
      };
    }),

  /**
   * Get all niches for a search, sorted by fitScore descending.
   * Parses JSON fields for the frontend.
   */
  getNiches: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const niches = await getNichesBySearchId(input.searchId);
      return niches.map(parseNicheFields);
    }),

  /**
   * Get all niches for the current user (across all searches).
   */
  getAllNiches: protectedProcedure.query(async ({ ctx }) => {
    const niches = await getNichesByUserId(ctx.user.id);
    return niches.map(parseNicheFields);
  }),

  /**
   * Delete all niches for a search (e.g. before re-clustering).
   */
  deleteBySearch: adminProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the search belongs to this user
      const niches = await getNichesBySearchId(input.searchId);
      if (niches.length > 0 && niches[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your niches" });
      }
      await deleteNichesBySearchId(input.searchId);
      return { deleted: niches.length };
    }),

  /**
   * Count how many companies in a search have not yet been assigned to a niche.
   * Used by the UI to show the "Assign Remaining (N)" button.
   */
  getUnassignedCount: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { unassigned: 0, total: 0 };
      const allCompanies = await db
        .select({ id: companies.id, nicheId: companies.nicheId })
        .from(companies)
        .where(eq(companies.searchId, input.searchId));
      const total = allCompanies.length;
      const unassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === undefined).length;
      return { unassigned, total, assigned: total - unassigned };
    }),

  /**
   * Phase 2: Assign remaining unassigned companies to the nearest niche centroid.
   * Requires Phase 1 (clusterAndSaveNiches) to have been run first.
   *
   * Steps:
   *   1. Load all niches for this search (to get centroids)
   *   2. Load all companies without a nicheId
   *   3. Generate embeddings for unassigned companies
   *   4. Assign each to nearest centroid by cosine similarity
   *   5. Update companies.nicheId and niches.companyCount
   */
  assignRemainingCompanies: adminProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Load niches with centroids
      const savedNiches = await getNichesBySearchId(input.searchId);
      if (savedNiches.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No niches found. Run Phase 1 clustering first.",
        });
      }

      const nicheCentroids = savedNiches
        .filter((n) => n.centroid)
        .map((n) => ({
          nicheId: n.id,
          centroid: JSON.parse(n.centroid!) as number[],
        }));

      if (nicheCentroids.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Niches have no centroid data. Re-run Phase 1 clustering.",
        });
      }

      // 2. Load unassigned companies
      const allCompanies = await db
        .select()
        .from(companies)
        .where(eq(companies.searchId, input.searchId));

      const unassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === undefined);

      if (unassigned.length === 0) {
        return { assigned: 0, message: "All companies are already assigned to niches." };
      }

      console.log(`[nicheRouter] Phase 2: Assigning ${unassigned.length} unassigned companies to ${nicheCentroids.length} niches`);

      // 3. Generate embeddings for unassigned companies
      const embeddings = await generateEmbeddings(unassigned);

      // 4. Assign by proximity
      const assignments = await assignRemainingByProximity(embeddings, nicheCentroids);

      // 5. Update companies.nicheId in DB
      let assigned = 0;
      for (const [companyId, nicheId] of Array.from(assignments)) {
        await updateCompany(companyId, { nicheId });
        assigned++;
      }

      // 6. Update companyCount on each niche
      const nicheCounts = new Map<number, number>();
      for (const company of allCompanies) {
        const nId = assignments.get(company.id) ?? company.nicheId;
        if (nId) nicheCounts.set(nId, (nicheCounts.get(nId) ?? 0) + 1);
      }
      for (const [nicheId, count] of Array.from(nicheCounts)) {
        await updateNiche(nicheId, { companyCount: count });
      }

      console.log(`[nicheRouter] Phase 2 done: ${assigned} companies assigned`);

      return {
        assigned,
        total: allCompanies.length,
        nichesUpdated: nicheCounts.size,
        message: `Assigned ${assigned} companies to ${nicheCounts.size} niches.`,
      };
    }),

  /**
   * Expand Sample: take the next N unassigned companies, embed them, and assign
   * each to the nearest existing centroid. This refines cluster membership without
   * re-running full k-means — useful for iterative exploration of large datasets.
   *
   * Unlike assignRemainingCompanies (which processes ALL unassigned), this processes
   * only a batch of EXPAND_BATCH_SIZE at a time so the user can inspect results
   * incrementally.
   */
  expandClusterSample: adminProcedure
    .input(
      z.object({
        searchId: z.number(),
        batchSize: z.number().min(1).max(2000).default(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Load niches with centroids
      const savedNiches = await getNichesBySearchId(input.searchId);
      if (savedNiches.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No niches found. Run Phase 1 clustering first.",
        });
      }

      const nicheCentroids = savedNiches
        .filter((n) => n.centroid)
        .map((n) => ({
          nicheId: n.id,
          centroid: JSON.parse(n.centroid!) as number[],
        }));

      if (nicheCentroids.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Niches have no centroid data. Re-run Phase 1 clustering.",
        });
      }

      // 2. Load next batch of unassigned companies
      const allCompanies = await db
        .select()
        .from(companies)
        .where(eq(companies.searchId, input.searchId));

      const unassigned = allCompanies
        .filter((c) => c.nicheId === null || c.nicheId === undefined)
        .slice(0, input.batchSize);

      if (unassigned.length === 0) {
        return {
          assigned: 0,
          remaining: 0,
          message: "All companies are already assigned to niches.",
        };
      }

      const totalUnassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === undefined).length;

      console.log(`[nicheRouter] Expand Sample: assigning ${unassigned.length} of ${totalUnassigned} unassigned companies`);

      // 3. Generate embeddings for this batch
      const embeddings = await generateEmbeddings(unassigned);

      // 4. Assign by proximity WITH discovery of new niches for poor-fit companies
      const { assignments: rawAssignments, newClusters } = await expandWithDiscovery(
        embeddings,
        allCompanies,
        nicheCentroids
      );

      // 5. Persist any newly discovered niches and build clusterIndex → nicheId map
      const newClusterToNicheId = new Map<number, number>(); // sentinel index → real nicheId
      for (const cluster of newClusters) {
        const newNicheId = await createNiche({
          userId: ctx.user.id,
          searchId: input.searchId,
          brainId: null,
          parentNicheId: null,
          name: cluster.name,
          description: cluster.description,
          companyCount: cluster.companyIds.length,
          topKeywords: JSON.stringify(cluster.topKeywords),
          sampleCompanies: JSON.stringify(cluster.sampleCompanies),
          companyIds: JSON.stringify(cluster.companyIds),
          centroid: JSON.stringify(cluster.centroid),
          rationale: null,
        });
        // Sentinel: -(clusterIndex + 1)
        newClusterToNicheId.set(-(cluster.clusterIndex + 1), newNicheId);
      }

      // 6. Resolve sentinel values to real niche IDs and write to DB
      let assigned = 0;
      for (const [companyId, nicheIdOrSentinel] of Array.from(rawAssignments)) {
        const resolvedNicheId = nicheIdOrSentinel < 0
          ? newClusterToNicheId.get(nicheIdOrSentinel) ?? null
          : nicheIdOrSentinel;
        if (resolvedNicheId !== null) {
          await updateCompany(companyId, { nicheId: resolvedNicheId });
          assigned++;
        }
      }

      // 7. Update companyCount on each niche (existing + new)
      const nicheCounts = new Map<number, number>();
      const updatedAllCompanies = await db.select().from(companies).where(eq(companies.searchId, input.searchId));
      for (const company of updatedAllCompanies) {
        if (company.nicheId) nicheCounts.set(company.nicheId, (nicheCounts.get(company.nicheId) ?? 0) + 1);
      }
      for (const [nicheId, count] of Array.from(nicheCounts)) {
        await updateNiche(nicheId, { companyCount: count });
      }

      const remainingAfter = totalUnassigned - assigned;
      console.log(`[nicheRouter] Expand Sample done: ${assigned} assigned, ${newClusters.length} new niches, ${remainingAfter} still unassigned`);

      const newNichesMsg = newClusters.length > 0
        ? ` Discovered ${newClusters.length} new segment${newClusters.length > 1 ? "s" : ""}: ${newClusters.map((c) => c.name).join(", ")}.`
        : "";

      return {
        assigned,
        remaining: remainingAfter,
        newNichesCreated: newClusters.length,
        newNicheNames: newClusters.map((c) => c.name),
        nichesUpdated: nicheCounts.size,
        message: `Assigned ${assigned} more companies.${newNichesMsg} ${remainingAfter.toLocaleString()} still unassigned.`,
      };
    }),

  /**
   * Sub-cluster a top-level segment into child niches.
   * Scoped to only the companies already assigned to the given parentNicheId.
   * Deletes any existing child niches for this parent before re-running.
   */
  subClusterNiche: adminProcedure
    .input(
      z.object({
        parentNicheId: z.number(),
        autoScore: z.boolean().default(true),
        targetGroupSize: z.number().min(50).max(2000).optional(), // target companies per sub-cluster (derives K)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Verify parent niche exists and belongs to this user
      const parentNiche = await getNicheById(input.parentNicheId);
      if (!parentNiche) throw new TRPCError({ code: "NOT_FOUND", message: "Parent segment not found" });
      if (parentNiche.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Not your segment" });

      // 2. Load companies assigned to this parent niche
      const allCompanies = await db
        .select()
        .from(companies)
        .where(eq(companies.nicheId, input.parentNicheId));

      if (allCompanies.length < 9) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Need at least 9 companies in this segment to sub-cluster. This segment has ${allCompanies.length}.`,
        });
      }

      console.log(`[nicheRouter] Sub-clustering segment "${parentNiche.name}" (${allCompanies.length} companies)`);

      // 3. Delete existing child niches for this parent
      await deleteNichesByParentId(input.parentNicheId);

      // 4. Generate embeddings
      const embeddings = await generateEmbeddings(allCompanies);

      // 5. Cluster (use all companies as seed — no stratified sampling for sub-clusters)
      const clusters = await clusterCompanies(embeddings, allCompanies, {
        targetGroupSize: input.targetGroupSize ?? 300,
        seedSampleSize: allCompanies.length, // use ALL assigned companies, not just 500
      });

      // 6. Persist child niches
      const childNicheIds: number[] = [];
      const clusterIndexToNicheId = new Map<number, number>();
      for (const cluster of clusters) {
        const id = await createNiche({
          userId,
          searchId: parentNiche.searchId,
          brainId: null,
          parentNicheId: input.parentNicheId,
          name: cluster.name,
          description: cluster.description,
          companyCount: cluster.companyIds.length,
          topKeywords: JSON.stringify(cluster.topKeywords),
          sampleCompanies: JSON.stringify(cluster.sampleCompanies),
          companyIds: JSON.stringify(cluster.companyIds),
          centroid: JSON.stringify(cluster.centroid),
          rationale: null,
        });
        childNicheIds.push(id);
        clusterIndexToNicheId.set(cluster.clusterIndex, id);
      }

      // 7. Update companies.nicheId to point to child niche
      // (companies now belong to the child niche, not the parent)
      for (const cluster of clusters) {
        const childNicheId = clusterIndexToNicheId.get(cluster.clusterIndex);
        if (!childNicheId) continue;
        for (const companyId of cluster.companyIds) {
          await updateCompany(companyId, { nicheId: childNicheId });
        }
      }

      // 8. Optionally auto-score child niches against active Brain
      let scoredCount = 0;
      if (input.autoScore && parentNiche.searchId) {
        const { getActiveBrain } = await import("./db");
        const brain = await getActiveBrain(userId);
        if (brain) {
          for (const childId of childNicheIds) {
            try {
              const childNiche = await getNicheById(childId);
              if (!childNiche) continue;
              const nicheInput: NicheClusterInput = {
                name: childNiche.name,
                description: childNiche.description ?? "",
                sampleCompanies: childNiche.sampleCompanies ? JSON.parse(childNiche.sampleCompanies) : [],
                topKeywords: childNiche.topKeywords ? JSON.parse(childNiche.topKeywords) : [],
                companyCount: childNiche.companyCount,
              };
              const score = await scoreNicheFit(nicheInput, userId);
              await updateNiche(childId, {
                fitScore: score.fitScore,
                fitReasoning: score.fitReasoning,
                scoreBreakdown: JSON.stringify(score.scoreBreakdown),
                scoredAt: new Date(),
                scoredWithBrainId: brain.id,
              });
              scoredCount++;
            } catch (e) {
              console.warn(`[nicheRouter] Sub-cluster auto-score failed for niche ${childId}:`, e);
            }
          }
        }
      }

      console.log(`[nicheRouter] Sub-cluster done: ${clusters.length} child niches from ${allCompanies.length} companies`);

      return {
        parentNicheId: input.parentNicheId,
        parentNicheName: parentNiche.name,
        companiesProcessed: allCompanies.length,
        childNichesCreated: clusters.length,
        childNichesScored: scoredCount,
        childNicheIds,
        clusters: clusters.map((c) => ({
          name: c.name,
          description: c.description,
          companyCount: c.companyIds.length,
          sampleCompanies: c.sampleCompanies,
          topKeywords: c.topKeywords,
        })),
      };
    }),

  /**
   * Get child niches for a given parent niche ID.
   */
  getChildNiches: protectedProcedure
    .input(z.object({ parentNicheId: z.number() }))
    .query(async ({ ctx, input }) => {
      const children = await getNichesByParentId(input.parentNicheId);
      return children.map(parseNicheFields);
    }),

  /**
   * Create a scoped Import Campaign from a niche cluster.
   * Copies all companies assigned to the niche into a new search record,
   * preserving all enrichment data so the full pipeline can run on the subset.
   * Only allowed when fitScore >= 40 (Moderate Fit or better).
   */
  createCampaignFromNiche: adminProcedure
    .input(
      z.object({
        nicheId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Load and validate the niche
      const niche = await getNicheById(input.nicheId);
      if (!niche) throw new TRPCError({ code: "NOT_FOUND", message: "Niche not found" });
      if (niche.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Not your niche" });
      if ((niche.fitScore ?? 0) < 40) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Fit score must be ≥ 40 (Moderate Fit) to create a campaign. This niche scored ${niche.fitScore ?? 0}.`,
        });
      }

      // 2. Load the parent search to copy its offering metadata
      const parentSearch = niche.searchId ? await getSearchById(niche.searchId) : null;

      // 3. Create a new search record named after the niche
      const campaignName = `[Niche] ${niche.name}`;
      const newSearchId = await createSearch({
        userId,
        companyWebsite: parentSearch?.companyWebsite ?? "",
        location: parentSearch?.location ?? "",
        offeringName: campaignName,
        offeringDescription: niche.description ?? parentSearch?.offeringDescription ?? null,
        targetMarket: parentSearch?.targetMarket ?? null,
        valueProposition: parentSearch?.valueProposition ?? null,
        keywords: parentSearch?.keywords ?? null,
        status: "completed",
      });

      // 4. Load all companies assigned to this niche.
      // Primary: query by nicheId column (set after Phase 2 assignment).
      // Fallback: use the companyIds JSON array stored on the niche itself
      //           (populated during Phase 1 clustering, before Phase 2 runs).
      let nicheCompanies = await db
        .select()
        .from(companies)
        .where(eq(companies.nicheId, input.nicheId));

      if (nicheCompanies.length === 0 && niche.companyIds) {
        // Fall back to the companyIds JSON stored on the niche
        let ids: number[] = [];
        try { ids = JSON.parse(niche.companyIds as string); } catch {}
        if (ids.length > 0) {
          // Load in batches of 1000 to avoid IN clause limits
          const CHUNK = 1000;
          for (let i = 0; i < ids.length; i += CHUNK) {
            const chunk = ids.slice(i, i + CHUNK);
            const rows = await db.select().from(companies).where(inArray(companies.id, chunk));
            nicheCompanies = nicheCompanies.concat(rows);
          }
        }
      }

      if (nicheCompanies.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No companies found for niche "${niche.name}". The niche has ${niche.companyCount} companies recorded but none could be loaded. Please re-run clustering for this search.`,
        });
      }

      // 5. Copy companies into the new search (strip id + searchId, keep all enrichment)
      const BATCH_SIZE = 100;
      let copied = 0;
      for (let i = 0; i < nicheCompanies.length; i += BATCH_SIZE) {
        const batch = nicheCompanies.slice(i, i + BATCH_SIZE).map((c) => {
          const { id, searchId, ...rest } = c;
          return {
            ...rest,
            searchId: newSearchId,
            nicheId: input.nicheId, // keep niche reference on copied companies
          };
        });
        await createCompanies(batch);
        copied += batch.length;
      }

      // 6. Update the new search to record its source niche and share with team
      const db2 = await getDb();
      if (db2) {
        await db2.update(searches)
          .set({ sourceNicheId: input.nicheId, sharedWithTeam: 1 })
          .where(eq(searches.id, newSearchId));
      }

      console.log(`[nicheRouter] Created campaign "${campaignName}" (searchId=${newSearchId}) with ${copied} companies from niche ${input.nicheId}`);

      return {
        searchId: newSearchId,
        campaignName,
        companiesCopied: copied,
        nicheId: input.nicheId,
      };
    }),

  /**
   * Get companies assigned to a specific niche (paginated).
   * Available to all logged-in users (read-only).
   */
  getCompaniesByNiche: protectedProcedure
    .input(
      z.object({
        nicheId: z.number(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const [items, total] = await Promise.all([
        getCompaniesByNicheId(input.nicheId, input.limit, input.offset),
        countCompaniesByNicheId(input.nicheId),
      ]);
      return { items, total };
    }),
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function parseNicheFields(niche: any) {
  return {
    ...niche,
    topKeywords: niche.topKeywords ? tryParse(niche.topKeywords, []) : [],
    sampleCompanies: niche.sampleCompanies ? tryParse(niche.sampleCompanies, []) : [],
    companyIds: niche.companyIds ? tryParse(niche.companyIds, []) : [],
    scoreBreakdown: niche.scoreBreakdown ? tryParse(niche.scoreBreakdown, []) : [],
  };
}

function tryParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
