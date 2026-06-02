/**
 * Campaign Research Queue Worker — ACCELERATED
 * ──────────────────────────────────────────────
 * Runs inside the Express process. Picks pending jobs from campaign_queue
 * and runs the FULL pipeline:
 *
 *   Step 0: Apollo Enrichment  (if enrichmentStatus === "pending")
 *   Step 1: Fit Score          (scoreCompanyFit)
 *   Step 2+3: Brief + Sales Approach  (run IN PARALLEL after fit score)
 *
 * Acceleration strategies:
 *  1. Polling interval: 2 seconds (was 5 minutes)
 *  2. Brief + Approach run concurrently via Promise.allSettled
 *  3. Multiple concurrent workers (CONCURRENCY = 5) with DB-level job locking
 *
 * Designed to be indestructible:
 *  - Catches all errors per company and marks them failed without crashing
 *  - Skips steps already done (idempotent — re-enqueue is safe)
 *  - Survives server restarts (state is fully in the DB)
 *  - DB-level atomic claim prevents double-processing across workers
 */

import { campaignQueue } from "../drizzle/schema";
import { eq, asc, and, sql } from "drizzle-orm";

const POLL_INTERVAL_MS = 2_000;  // 2 seconds (was 5 minutes)
const CONCURRENCY = 5;           // 5 parallel workers
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let activeWorkers = 0;
let workerInterval: ReturnType<typeof setInterval> | null = null;

// ── Atomic job claim ────────────────────────────────────────────────────────
// TiDB-compatible two-step claim:
// 1. SELECT the oldest pending job id
// 2. UPDATE it to 'running' with a WHERE status = 'pending' guard
// If another worker claimed it between steps, affectedRows = 0 and we retry.

async function claimNextJob() {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return null;

  // Step 1: Find the oldest pending job
  const [candidate] = await db
    .select({ id: campaignQueue.id })
    .from(campaignQueue)
    .where(eq(campaignQueue.status, "pending"))
    .orderBy(asc(campaignQueue.createdAt))
    .limit(1);

  if (!candidate) return null;

  // Step 2: Atomically claim it — only succeeds if still 'pending'
  const result: any = await db.execute(
    sql`UPDATE campaign_queue
        SET status = 'running', startedAt = NOW()
        WHERE id = ${candidate.id} AND status = 'pending'
        LIMIT 1`
  );

  const affectedRows = result?.[0]?.affectedRows ?? result?.rowsAffected ?? 0;
  if (affectedRows === 0) return null; // Another worker claimed it first

  // Fetch the full job row we just claimed
  const [job] = await db
    .select()
    .from(campaignQueue)
    .where(eq(campaignQueue.id, candidate.id))
    .limit(1);

  return job ?? null;
}

// ── Process one job ─────────────────────────────────────────────────────────

async function processJob() {
  const job = await claimNextJob();
  if (!job) return false; // No work available

  console.log(`[CampaignQueue] ▶ Worker claiming Job ${job.id} — ${job.companyName} (companyId: ${job.companyId})`);

  try {
    const { getDb, getCompanyById, updateCompany, getActiveBrain } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Helper: stamp brain traceability on this company
    const stampBrain = async () => {
      try {
        const brain = await getActiveBrain(job.userId);
        if (brain) {
          await updateCompany(job.companyId, {
            generatedWithBrainId: brain.id,
            generatedWithBrainName: brain.brainName,
          });
        }
      } catch { /* non-fatal */ }
    };

    // Fetch fresh company data
    let company = await getCompanyById(job.companyId);
    if (!company) {
      await db.update(campaignQueue).set({
        status: "failed",
        errorMessage: "Company not found in DB",
        completedAt: new Date(),
      }).where(eq(campaignQueue.id, job.id));
      return true; // Job handled (failed), but there may be more work
    }

    // ── Step 0: Apollo Enrichment ──────────────────────────────────────────
    if (company.enrichmentStatus === "pending") {
      if (!company.apolloId) {
        console.warn(`[CampaignQueue] ⚠ Company ${company.name} has no apolloId — skipping enrichment`);
        await updateCompany(job.companyId, { enrichmentStatus: "enriched" });
      } else {
        try {
          const { enrichCompanyDetails } = await import("./apolloSearch");
          console.log(`[CampaignQueue] Step 0: Enriching ${company.name} via Apollo...`);
          const details = await enrichCompanyDetails(company.apolloId);
          await updateCompany(job.companyId, {
            city: details.city,
            state: details.state,
            country: details.country,
            streetAddress: details.street_address,
            rawAddress: details.raw_address,
            enrichmentStatus: "enriched",
          });
          console.log(`[CampaignQueue] ✓ Enriched: ${company.name} (${details.city ?? "?"}, ${details.country ?? "?"})`);
        } catch (err: any) {
          console.warn(`[CampaignQueue] ⚠ Enrichment failed for ${company.name}: ${err.message}`);
          await updateCompany(job.companyId, { enrichmentStatus: "failed" });
        }
      }
      // Refresh company data after enrichment
      company = await getCompanyById(job.companyId) ?? company;
    } else {
      console.log(`[CampaignQueue] ↩ Already enriched: ${company.name}`);
    }

    // ── Step 1: Fit Score ──────────────────────────────────────────────────
    // Runs for: "full" (if not yet scored), "score_only" (always — rescore forces it)
    const needsFitScore =
      (job.jobType === "full" && !company.fitScore) ||
      job.jobType === "score_only";  // score_only always rescores

    if (needsFitScore) {
      try {
        const { scoreCompanyFit } = await import("./briefGenerator");
        const result = await scoreCompanyFit(job.companyId, job.userId);
        await updateCompany(job.companyId, {
          fitScore: result.fitScore,
          fitScoreData: JSON.stringify(result),
          fitScoreGeneratedAt: new Date(),
        });
        console.log(
          `[CampaignQueue] ✓ Fit score: ${company.name} → LLM:${result.rawLlmScore} × geo(${result.breakdown.geographyMultiplier?.region}) = ${result.fitScore}`
        );
      } catch (err: any) {
        console.warn(`[CampaignQueue] ⚠ Fit score failed for ${company.name}: ${err.message}`);
      }
    } else if (company.fitScore) {
      console.log(`[CampaignQueue] ↩ Fit score cached: ${company.name} (${company.fitScore})`);
    }

    // ── score_only: stop here, skip brief + approach ───────────────────────
    if (job.jobType === "score_only") {
      await stampBrain();
      await db!.update(campaignQueue).set({
        status: "completed",
        completedAt: new Date(),
      }).where(eq(campaignQueue.id, job.id));
      console.log(`[CampaignQueue] ✅ Score-only job ${job.id} complete — ${company.name}`);
      return true;
    }

    // ── Step 2 + 3: Brief + Sales Approach IN PARALLEL ─────────────────────
    // These are independent once we have the fit score. Run them concurrently.
    const freshCompany = await getCompanyById(job.companyId) ?? company;

    const needsBrief =
      !freshCompany.briefData ||
      !freshCompany.briefGeneratedAt ||
      Date.now() - new Date(freshCompany.briefGeneratedAt).getTime() >= SEVEN_DAYS_MS;

    const needsApproach =
      !freshCompany.salesApproachData ||
      !freshCompany.salesApproachGeneratedAt ||
      Date.now() - new Date(freshCompany.salesApproachGeneratedAt).getTime() >= SEVEN_DAYS_MS;

    const parallelTasks: Promise<void>[] = [];

    if (needsBrief) {
      parallelTasks.push(
        (async () => {
          const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
          const brief = await generateSalesIntelligenceBrief(job.companyId, job.userId);
          await updateCompany(job.companyId, {
            urgencyScore: brief.urgencyScore,
            briefData: JSON.stringify(brief),
            briefGeneratedAt: new Date(),
          });
          console.log(`[CampaignQueue] ✓ Brief: ${company.name} (urgency: ${brief.urgencyScore})`);
        })()
      );
    } else {
      console.log(`[CampaignQueue] ↩ Brief cached: ${company.name}`);
    }

    if (needsApproach) {
      parallelTasks.push(
        (async () => {
          // If we need a fresh brief AND approach, the approach needs the brief data.
          // But if brief is cached, we can start approach immediately.
          // If both are needed, brief runs first (approach depends on briefData).
          if (needsBrief) {
            // Wait for brief to complete first, then generate approach
            // This is handled by the brief task above completing first in the array
            // We'll do a sequential fallback for this specific case
            return; // Will be handled after parallel block
          }
          const { generateSalesApproach } = await import("./salesApproachGenerator");
          const salesApproach = await generateSalesApproach(job.companyId, job.userId);
          await updateCompany(job.companyId, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: new Date(),
          });
          console.log(`[CampaignQueue] ✓ Sales approach: ${company.name}`);
        })()
      );
    } else {
      console.log(`[CampaignQueue] ↩ Sales approach cached: ${company.name}`);
    }

    // Run parallel tasks
    if (parallelTasks.length > 0) {
      const results = await Promise.allSettled(parallelTasks);
      for (const r of results) {
        if (r.status === "rejected") {
          console.warn(`[CampaignQueue] ⚠ Parallel task failed for ${company.name}: ${r.reason?.message ?? r.reason}`);
        }
      }
    }

    // If both brief and approach were needed, approach was skipped above.
    // Now generate approach with the fresh brief data.
    if (needsBrief && needsApproach) {
      try {
        const refreshedForApproach = await getCompanyById(job.companyId);
        if (refreshedForApproach?.briefData) {
          const { generateSalesApproach } = await import("./salesApproachGenerator");
          const salesApproach = await generateSalesApproach(job.companyId, job.userId);
          await updateCompany(job.companyId, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: new Date(),
          });
          console.log(`[CampaignQueue] ✓ Sales approach (after brief): ${company.name}`);
        }
      } catch (err: any) {
        console.warn(`[CampaignQueue] ⚠ Sales approach failed for ${company.name}: ${err.message}`);
      }
    }

    // Stamp brain traceability after all generation steps
    await stampBrain();

    // ── Mark complete ────────────────────────────────────────────────────────────────────
    await db!.update(campaignQueue).set({
      status: "completed",
      completedAt: new Date(),
    }).where(eq(campaignQueue.id, job.id));

    console.log(`[CampaignQueue] ✅ Job ${job.id} complete — ${company.name}`);
    return true; // More work may be available

  } catch (err: any) {
    console.error(`[CampaignQueue] ❌ Unhandled error for Job ${job.id}:`, err.message);
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (db) {
        await db.update(campaignQueue).set({
          status: "failed",
          errorMessage: (err.message ?? "Unknown error").slice(0, 512),
          completedAt: new Date(),
        }).where(eq(campaignQueue.id, job.id));
      }
    } catch (dbErr) {
      console.error(`[CampaignQueue] Could not mark job as failed:`, dbErr);
    }
    return true; // There may be more work even if this one failed
  }
}

// ── Worker loop (one of N concurrent workers) ───────────────────────────────

async function workerLoop(workerId: number) {
  activeWorkers++;
  try {
    const hadWork = await processJob();
    if (hadWork) {
      // Immediately try next job (no delay when there's work)
      setImmediate(() => workerLoop(workerId));
      return;
    }
    // No work found — this worker slot goes idle until next tick
  } catch (err: any) {
    console.error(`[CampaignQueue] Worker ${workerId} error:`, err.message);
  } finally {
    activeWorkers--;
  }
}

// ── Tick: spawn workers up to CONCURRENCY ───────────────────────────────────

function tick() {
  const slotsAvailable = CONCURRENCY - activeWorkers;
  for (let i = 0; i < slotsAvailable; i++) {
    workerLoop(i + 1);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startCampaignQueueWorker() {
  if (workerInterval) return; // Already running
  console.log(`[CampaignQueue] Worker started — interval: ${POLL_INTERVAL_MS / 1000}s, concurrency: ${CONCURRENCY} (Enrich → Score → Brief+Approach parallel)`);
  // Run immediately on startup
  tick();
  workerInterval = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopCampaignQueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[CampaignQueue] Worker stopped");
  }
}

export function getWorkerStatus(): { running: boolean; busy: boolean; activeWorkers: number; concurrency: number } {
  return {
    running: workerInterval !== null,
    busy: activeWorkers > 0,
    activeWorkers,
    concurrency: CONCURRENCY,
  };
}
