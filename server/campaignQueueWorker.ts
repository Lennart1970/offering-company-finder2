/**
 * Campaign Research Queue Worker
 * --------------------------------
 * Runs inside the Express process. Every 5 minutes it picks the next
 * pending job from campaign_queue and runs the full deep-research pipeline:
 *   1. Fit Score (scoreCompanyFit)
 *   2. Deep Research Brief (generateSalesIntelligenceBrief)
 *   3. Sales Approach (generateSalesApproach)
 *
 * Designed to be indestructible:
 *  - Catches all errors per company and marks them failed without crashing
 *  - Skips steps already done (idempotent — re-enqueue is safe)
 *  - Survives server restarts (state is fully in the DB)
 *  - Only one job runs at a time (mutex via `isProcessing` flag)
 */

import { campaignQueue } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let isProcessing = false;
let workerInterval: ReturnType<typeof setInterval> | null = null;

// ── Process one job ──────────────────────────────────────────────────────────

async function processNextJob() {
  if (isProcessing) {
    console.log("[CampaignQueue] Worker busy — skipping tick");
    return;
  }
  isProcessing = true;

  try {
    const { getDb, getCompanyById, updateCompany } = await import("./db");
    const db = await getDb();
    if (!db) {
      console.error("[CampaignQueue] DB not available");
      isProcessing = false;
      return;
    }

    // Claim the next pending job (FIFO by createdAt)
    const [job] = await db
      .select()
      .from(campaignQueue)
      .where(eq(campaignQueue.status, "pending"))
      .orderBy(asc(campaignQueue.createdAt))
      .limit(1);

    if (!job) {
      isProcessing = false;
      return; // Nothing to do
    }

    console.log(`[CampaignQueue] ▶ Job ${job.id} — ${job.companyName} (companyId: ${job.companyId})`);

    // Mark as running
    await db
      .update(campaignQueue)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(campaignQueue.id, job.id));

    // Fetch fresh company data
    const company = await getCompanyById(job.companyId);
    if (!company) {
      await db.update(campaignQueue).set({
        status: "failed",
        errorMessage: "Company not found in DB",
        completedAt: new Date(),
      }).where(eq(campaignQueue.id, job.id));
      isProcessing = false;
      return;
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // ── Step 1: Fit Score ────────────────────────────────────────────────────
    if (job.jobType === "full" && !company.fitScore) {
      try {
        const { scoreCompanyFit } = await import("./briefGenerator");
        const result = await scoreCompanyFit(job.companyId, job.userId);
        await updateCompany(job.companyId, {
          fitScore: result.fitScore,
          fitScoreData: JSON.stringify(result),
        });
        console.log(`[CampaignQueue] ✓ Fit score: ${company.name} → ${result.fitScore}`);
      } catch (err: any) {
        console.warn(`[CampaignQueue] ⚠ Fit score failed for ${company.name}: ${err.message}`);
        // Non-fatal — continue to brief
      }
    }

    // ── Step 2: Deep Research Brief ──────────────────────────────────────────
    const needsBrief =
      !company.briefData ||
      !company.briefGeneratedAt ||
      Date.now() - new Date(company.briefGeneratedAt).getTime() >= sevenDaysMs;

    if (needsBrief) {
      const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
      const brief = await generateSalesIntelligenceBrief(job.companyId, job.userId);
      await updateCompany(job.companyId, {
        urgencyScore: brief.urgencyScore,
        briefData: JSON.stringify(brief),
        briefGeneratedAt: new Date(),
      });
      console.log(`[CampaignQueue] ✓ Brief: ${company.name} (urgency: ${brief.urgencyScore})`);
    } else {
      console.log(`[CampaignQueue] ↩ Brief cached: ${company.name}`);
    }

    // ── Step 3: Sales Approach ───────────────────────────────────────────────
    // Re-fetch to get fresh briefData if it was just generated
    const refreshed = await getCompanyById(job.companyId);
    const needsApproach =
      refreshed?.briefData &&
      (!refreshed.salesApproachData ||
        !refreshed.salesApproachGeneratedAt ||
        Date.now() - new Date(refreshed.salesApproachGeneratedAt).getTime() >= sevenDaysMs);

    if (needsApproach) {
      const { generateSalesApproach } = await import("./salesApproachGenerator");
      const salesApproach = await generateSalesApproach(job.companyId, job.userId);
      await updateCompany(job.companyId, {
        salesApproachData: JSON.stringify(salesApproach),
        salesApproachGeneratedAt: new Date(),
      });
      console.log(`[CampaignQueue] ✓ Sales approach: ${company.name}`);
    } else if (!needsApproach) {
      console.log(`[CampaignQueue] ↩ Sales approach cached: ${company.name}`);
    }

    // ── Mark complete ────────────────────────────────────────────────────────
    await db.update(campaignQueue).set({
      status: "completed",
      completedAt: new Date(),
    }).where(eq(campaignQueue.id, job.id));

    console.log(`[CampaignQueue] ✅ Job ${job.id} complete — ${company.name}`);

  } catch (err: any) {
    console.error(`[CampaignQueue] ❌ Unhandled error:`, err.message);
    // Mark any stuck "running" job as failed so the queue doesn't deadlock
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (db) {
        await db.update(campaignQueue).set({
          status: "failed",
          errorMessage: (err.message ?? "Unknown error").slice(0, 512),
          completedAt: new Date(),
        }).where(eq(campaignQueue.status, "running"));
      }
    } catch (dbErr) {
      console.error(`[CampaignQueue] Could not mark job as failed:`, dbErr);
    }
  } finally {
    isProcessing = false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function startCampaignQueueWorker() {
  if (workerInterval) return; // Already running
  console.log(`[CampaignQueue] Worker started — interval: ${INTERVAL_MS / 1000}s`);
  // Run immediately on startup to pick up any pending jobs
  processNextJob().catch(console.error);
  workerInterval = setInterval(() => {
    processNextJob().catch(console.error);
  }, INTERVAL_MS);
}

export function stopCampaignQueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[CampaignQueue] Worker stopped");
  }
}

export function getWorkerStatus(): { running: boolean; busy: boolean } {
  return { running: workerInterval !== null, busy: isProcessing };
}
