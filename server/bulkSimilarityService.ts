/**
 * Bulk Similarity Scoring Service
 *
 * Scores companies against the active Brain using cosine similarity (no LLM calls).
 * Writes results to companies.similarityScore and companies.similarityScoreGeneratedAt.
 *
 * Two modes:
 *   - "ungraded"  : only companies where similarityScore IS NULL (default)
 *   - "all"       : all companies regardless of existing score
 *   - "campaign"  : only companies belonging to a specific searchId
 *
 * Pipeline:
 *   1. Fetch active Brain embedding from Supabase
 *   2. Build UUID→MySQL ID map for target companies
 *   3. Fetch stored company embeddings from Supabase (paginated)
 *   4. Compute cosine similarity for each
 *   5. Bulk-update companies.similarityScore in MySQL
 */

import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { getDb } from "./db";
import { companies } from "../drizzle/schema";
import { eq, isNull, inArray } from "drizzle-orm";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SUPABASE_PAGE_SIZE = 1000;
const MYSQL_BATCH = 200;

function toCompanyUUID(mysqlId: number): string {
  return uuidv5(`company-${mysqlId}`, LT_NAMESPACE);
}

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const d = magnitude(a) * magnitude(b);
  return d === 0 ? 0 : dotProduct(a, b) / d;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface SimilarityJobOptions {
  mode: "ungraded" | "all" | "campaign";
  searchId?: number; // required when mode === "campaign"
  brainId?: number;  // optional: use a specific Brain instead of the globally-active one
}

export interface SimilarityJobResult {
  scored: number;
  updated: number;
  activeBrainId: string;
  activeBrainName: string;
  scoreRange: { min: number; max: number; avg: number };
}

/**
 * Run bulk similarity scoring.
 * Returns a summary of what was scored and updated.
 */
export async function runBulkSimilarityScoring(
  opts: SimilarityJobOptions
): Promise<SimilarityJobResult> {
  const sb = getSupabase();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Step 1: Fetch Brain from MySQL (specific brainId or globally-active) ────
  const { sql } = await import("drizzle-orm");
  const brainRows = opts.brainId
    ? await db.execute(sql`SELECT id, brainName FROM offering_brain WHERE id = ${opts.brainId} LIMIT 1`)
    : await db.execute(sql`SELECT id, brainName FROM offering_brain WHERE isActive = 1 AND show_on_leadtrigger = 1 ORDER BY updatedAt DESC LIMIT 1`);

  const brainArr = brainRows as unknown as { id: number; brainName: string }[];
  if (!brainArr || brainArr.length === 0) {
    throw new Error(opts.brainId
      ? `Brain id=${opts.brainId} not found`
      : "No active Brain found — cannot compute similarity scores");
  }
  const brain = brainArr[0];
  const activeBrainId = String(brain.id);
  console.log(`[BulkSimilarity] Brain: "${brain.brainName}" (id=${activeBrainId})${opts.brainId ? " [campaign-specific]" : " [globally-active]"}`);


  // ── Step 2: Fetch Brain embedding from Supabase ───────────────────────────
  const { data: brainEmbRow, error: brainEmbErr } = await sb
    .from("lt_mns_brain_embeddings")
    .select("brain_id, embedding")
    .eq("brain_id", activeBrainId)
    .single();

  if (brainEmbErr || !brainEmbRow) {
    throw new Error(`Brain embedding not found for brain_id=${activeBrainId}: ${brainEmbErr?.message}`);
  }

  const brainVector = (
    typeof brainEmbRow.embedding === "string"
      ? JSON.parse(brainEmbRow.embedding)
      : brainEmbRow.embedding
  ) as number[];
  console.log(`[BulkSimilarity] Brain vector loaded (${brainVector.length} dims)`);

  // ── Step 3: Build UUID→MySQL ID map for target companies ──────────────────
  // Fetch only the company IDs we care about based on mode
  let targetIds: number[] = [];

  if (opts.mode === "ungraded") {
    const rows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(isNull(companies.similarityScore));
    targetIds = rows.map((r) => r.id);
  } else if (opts.mode === "campaign" && opts.searchId) {
    const rows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.searchId, opts.searchId));
    targetIds = rows.map((r) => r.id);
  } else {
    // "all" mode
    const rows = await db.select({ id: companies.id }).from(companies);
    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    console.log("[BulkSimilarity] No target companies — nothing to score");
    return {
      scored: 0,
      updated: 0,
      activeBrainId,
      activeBrainName: brain.brainName,
      scoreRange: { min: 0, max: 0, avg: 0 },
    };
  }

  // Build UUID→MySQL ID lookup (only for target companies)
  const uuidToMysqlId = new Map<string, number>();
  for (const id of targetIds) {
    uuidToMysqlId.set(toCompanyUUID(id), id);
  }
  console.log(`[BulkSimilarity] Target companies: ${targetIds.length} (mode=${opts.mode})`);

  // ── Step 4: Page through Supabase embeddings, score matching companies ────
  const mysqlUpdates: { mysqlId: number; score: number }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * SUPABASE_PAGE_SIZE;
    const to = from + SUPABASE_PAGE_SIZE - 1;

    const { data: embRows, error: embErr } = await sb
      .from("lt_mns_company_embeddings")
      .select("watchlist_id, embedding")
      .range(from, to);

    if (embErr) {
      console.error(`[BulkSimilarity] Supabase error on page ${page + 1}:`, embErr.message);
      break;
    }

    if (!embRows || embRows.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of embRows) {
      const mysqlId = uuidToMysqlId.get(row.watchlist_id);
      if (!mysqlId) continue; // not in our target set

      const vec = (
        typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding
      ) as number[];

      const sim = cosineSimilarity(vec, brainVector);
      // Normalise cosine similarity (−1 to 1) → score (0 to 100)
      const score = Math.round(((sim + 1) / 2) * 100);
      mysqlUpdates.push({ mysqlId, score });
    }

    console.log(`[BulkSimilarity] Page ${page + 1}: ${embRows.length} embeddings, ${mysqlUpdates.length} matched so far`);

    if (embRows.length < SUPABASE_PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // ── Step 5: Bulk-update companies.similarityScore in MySQL ────────────────
  const now = new Date();
  let updated = 0;

  for (let i = 0; i < mysqlUpdates.length; i += MYSQL_BATCH) {
    const batch = mysqlUpdates.slice(i, i + MYSQL_BATCH);
    const batchIds = batch.map((u) => u.mysqlId);

    // Use drizzle inArray + individual updates via a CASE expression via raw SQL
    const caseScore = batch.map((u) => `WHEN ${u.mysqlId} THEN ${u.score}`).join(" ");
    const inList = batchIds.join(",");

    await db.execute(sql`
      UPDATE companies
      SET similarityScore = CASE id ${sql.raw(caseScore)} END,
          similarityScoreGeneratedAt = ${now}
      WHERE id IN (${sql.raw(inList)})
    `);

    updated += batch.length;
    if (updated % 2000 === 0 || updated === mysqlUpdates.length) {
      console.log(`[BulkSimilarity] Updated ${updated}/${mysqlUpdates.length} companies`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const allScores = mysqlUpdates.map((u) => u.score);
  const scoreRange =
    allScores.length > 0
      ? {
          min: Math.min(...allScores),
          max: Math.max(...allScores),
          avg: Math.round(allScores.reduce((a, s) => a + s, 0) / allScores.length),
        }
      : { min: 0, max: 0, avg: 0 };

  console.log(
    `[BulkSimilarity] Done — scored: ${mysqlUpdates.length}, updated: ${updated}, range: ${scoreRange.min}–${scoreRange.max} (avg ${scoreRange.avg})`
  );

  return {
    scored: mysqlUpdates.length,
    updated,
    activeBrainId,
    activeBrainName: brain.brainName,
    scoreRange,
  };
}
