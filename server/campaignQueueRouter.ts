/**
 * Campaign Queue Router
 * Procedures for managing the background research queue.
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { campaignQueue, companies } from "../drizzle/schema";
import { eq, and, inArray, count, sql } from "drizzle-orm";
import { getWorkerStatus } from "./campaignQueueWorker";

export const campaignQueueRouter = router({
  /**
   * Enqueue all unprocessed companies from a search for background deep research.
   * Idempotent — already-queued or already-completed companies are skipped.
   * Returns the number of jobs newly added.
   */
  enqueueSearch: protectedProcedure
    .input(z.object({
      searchId: z.number(),
      jobType: z.enum(["full", "brief_only"]).default("full"),
      // If true, re-enqueue companies that already have a brief (force refresh)
      forceRefresh: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get all enriched companies for this search
      const allCompanies = await db
        .select({
          id: companies.id,
          name: companies.name,
          briefData: companies.briefData,
          salesApproachData: companies.salesApproachData,
          enrichmentStatus: companies.enrichmentStatus,
        })
        .from(companies)
        .where(and(
          eq(companies.searchId, input.searchId),
          eq(companies.enrichmentStatus, "enriched"),
        ));

      if (allCompanies.length === 0) {
        return { enqueued: 0, skipped: 0, total: 0, message: "No enriched companies found in this campaign." };
      }

      // Find companies already in the queue (pending or running — don't double-queue)
      const existingJobs = await db
        .select({ companyId: campaignQueue.companyId })
        .from(campaignQueue)
        .where(and(
          eq(campaignQueue.searchId, input.searchId),
          inArray(campaignQueue.status, ["pending", "running"]),
        ));
      const alreadyQueued = new Set(existingJobs.map((j) => j.companyId));

      // Filter: skip if already queued, and skip if already processed (unless forceRefresh)
      const toEnqueue = allCompanies.filter((c) => {
        if (alreadyQueued.has(c.id)) return false;
        if (!input.forceRefresh && c.briefData && c.salesApproachData) return false;
        return true;
      });

      if (toEnqueue.length === 0) {
        return {
          enqueued: 0,
          skipped: allCompanies.length,
          total: allCompanies.length,
          message: "All companies are already queued or fully processed.",
        };
      }

      // Insert jobs in bulk
      await db.insert(campaignQueue).values(
        toEnqueue.map((c) => ({
          searchId: input.searchId,
          companyId: c.id,
          userId: ctx.user.id,
          companyName: c.name,
          jobType: input.jobType,
          status: "pending" as const,
        }))
      );

      return {
        enqueued: toEnqueue.length,
        skipped: allCompanies.length - toEnqueue.length,
        total: allCompanies.length,
        message: `${toEnqueue.length} companies added to the research queue.`,
      };
    }),

  /**
   * Get the current queue status for a search (or global).
   */
  getQueueStatus: protectedProcedure
    .input(z.object({
      searchId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const baseWhere = input.searchId
        ? and(eq(campaignQueue.userId, ctx.user.id), eq(campaignQueue.searchId, input.searchId))
        : eq(campaignQueue.userId, ctx.user.id);

      const rows = await db
        .select({
          status: campaignQueue.status,
          cnt: count(),
        })
        .from(campaignQueue)
        .where(baseWhere)
        .groupBy(campaignQueue.status);

      const statusMap: Record<string, number> = {};
      for (const row of rows) {
        statusMap[row.status] = Number(row.cnt);
      }

      // Get the currently running job name (if any)
      const [runningJob] = await db
        .select({ companyName: campaignQueue.companyName, startedAt: campaignQueue.startedAt })
        .from(campaignQueue)
        .where(and(
          eq(campaignQueue.userId, ctx.user.id),
          eq(campaignQueue.status, "running"),
          ...(input.searchId ? [eq(campaignQueue.searchId, input.searchId)] : []),
        ))
        .limit(1);

      const worker = getWorkerStatus();

      return {
        pending: statusMap["pending"] ?? 0,
        running: statusMap["running"] ?? 0,
        completed: statusMap["completed"] ?? 0,
        failed: statusMap["failed"] ?? 0,
        currentCompany: runningJob?.companyName ?? null,
        workerRunning: worker.running,
        workerBusy: worker.busy,
        // Estimated minutes remaining (5 min per job)
        estimatedMinutes: ((statusMap["pending"] ?? 0) + (statusMap["running"] ?? 0)) * 5,
      };
    }),

  /**
   * Cancel all pending jobs for a search.
   */
  cancelSearch: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const result = await db
        .update(campaignQueue)
        .set({ status: "failed", errorMessage: "Cancelled by user", completedAt: new Date() })
        .where(and(
          eq(campaignQueue.searchId, input.searchId),
          eq(campaignQueue.userId, ctx.user.id),
          eq(campaignQueue.status, "pending"),
        ));

      return { cancelled: (result as any).affectedRows ?? 0 };
    }),

  /**
   * Get recent job history for a search (last 50 completed/failed).
   */
  getJobHistory: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const jobs = await db
        .select()
        .from(campaignQueue)
        .where(and(
          eq(campaignQueue.searchId, input.searchId),
          eq(campaignQueue.userId, ctx.user.id),
          inArray(campaignQueue.status, ["completed", "failed"]),
        ))
        .orderBy(sql`${campaignQueue.completedAt} DESC`)
        .limit(50);

      return jobs;
    }),
});
