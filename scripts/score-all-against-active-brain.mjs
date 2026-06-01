/**
 * Full-corpus scoring script
 *
 * Reads ALL embeddings from lt_mns_company_embeddings in Supabase,
 * scores each one against the active Brain using cosine similarity,
 * writes results to lt_mns_company_brain_scores,
 * and updates companies.fitScore in MySQL.
 *
 * No re-embedding needed — uses vectors already stored in Supabase.
 *
 * Run: node scripts/score-all-against-active-brain.mjs
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SUPABASE_PAGE_SIZE = 1000; // rows per Supabase page fetch
const SCORE_BATCH = 500;         // rows per lt_mns_company_brain_scores upsert
const MYSQL_BATCH = 200;         // companies per MySQL update batch

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCompanyUUID(mysqlId) {
  return uuidv5(`company-${mysqlId}`, LT_NAMESPACE);
}

// Reverse: given a UUID, find the MySQL id by brute-force search
// (we don't need this — we store the UUID→id mapping from MySQL directly)

function dotProduct(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function magnitude(v) {
  return Math.sqrt(dotProduct(v, v));
}

function cosineSimilarity(a, b) {
  const d = magnitude(a) * magnitude(b);
  return d === 0 ? 0 : dotProduct(a, b) / d;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dbUrl || !supabaseUrl || !supabaseKey) {
    console.error("Missing required env vars (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  const conn = await mysql.createConnection(dbUrl);
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // ── Step 1: Fetch active Brain from MySQL ─────────────────────────────────
  console.log("\n[1/5] Fetching active Brain from MySQL...");
  const [brainRows] = await conn.execute(
    `SELECT id, brainName FROM offering_brain
     WHERE isActive = 1 AND show_on_leadtrigger = 1
     ORDER BY updatedAt DESC LIMIT 1`
  );
  if (!brainRows || brainRows.length === 0) {
    console.error("No active Brain found — aborting");
    process.exit(1);
  }
  const brain = brainRows[0];
  const activeBrainId = String(brain.id);
  console.log(`   Active Brain: "${brain.brainName}" (id=${activeBrainId})`);

  // ── Step 2: Fetch Brain vector from Supabase ──────────────────────────────
  console.log("\n[2/5] Fetching Brain embedding from Supabase...");
  const { data: brainEmbRow, error: brainEmbErr } = await sb
    .from("lt_mns_brain_embeddings")
    .select("brain_id, embedding")
    .eq("brain_id", activeBrainId)
    .single();

  if (brainEmbErr || !brainEmbRow) {
    console.error(`Brain embedding not found for brain_id=${activeBrainId}:`, brainEmbErr?.message);
    process.exit(1);
  }
  const brainVector = typeof brainEmbRow.embedding === "string"
    ? JSON.parse(brainEmbRow.embedding)
    : brainEmbRow.embedding;
  console.log(`   Brain vector loaded (${brainVector.length} dims)`);

  // ── Step 3: Build UUID → MySQL ID map from MySQL ──────────────────────────
  // We need to map Supabase watchlist_id (UUID) back to MySQL company id
  // so we can write fitScore back to the right row.
  console.log("\n[3/5] Building UUID→MySQL ID map from companies table...");
  const [allCompanyIds] = await conn.execute(`SELECT id FROM companies`);
  const uuidToMysqlId = new Map();
  for (const row of allCompanyIds) {
    uuidToMysqlId.set(toCompanyUUID(row.id), row.id);
  }
  console.log(`   Mapped ${uuidToMysqlId.size} companies`);

  // ── Step 4: Page through all embeddings in Supabase, score, persist ───────
  console.log("\n[4/5] Scoring all embeddings against Brain...");
  const now = new Date().toISOString();
  let totalScored = 0;
  let page = 0;
  let hasMore = true;

  // Collect all scores for MySQL update (memory-efficient: process page by page)
  const mysqlUpdates = []; // { mysqlId, score }

  while (hasMore) {
    const from = page * SUPABASE_PAGE_SIZE;
    const to = from + SUPABASE_PAGE_SIZE - 1;

    process.stdout.write(`   Fetching page ${page + 1} (rows ${from}–${to})...`);
    const { data: embRows, error: embErr } = await sb
      .from("lt_mns_company_embeddings")
      .select("watchlist_id, embedding")
      .range(from, to);

    if (embErr) {
      console.error(`\n   Supabase error on page ${page + 1}:`, embErr.message);
      break;
    }

    if (!embRows || embRows.length === 0) {
      process.stdout.write(" (empty — done)\n");
      hasMore = false;
      break;
    }

    process.stdout.write(` ${embRows.length} rows — scoring...`);

    // Score each embedding
    const scoreRows = [];
    for (const row of embRows) {
      const vec = typeof row.embedding === "string"
        ? JSON.parse(row.embedding)
        : row.embedding;
      const sim = cosineSimilarity(vec, brainVector);
      const score = Math.round(((sim + 1) / 2) * 100);

      scoreRows.push({
        company_id: row.watchlist_id,
        brain_id: activeBrainId,
        score,
        scored_at: now,
        method: "cosine-similarity-v1",
      });

      // Map UUID back to MySQL id for fitScore update
      const mysqlId = uuidToMysqlId.get(row.watchlist_id);
      if (mysqlId) {
        mysqlUpdates.push({ mysqlId, score, brainId: activeBrainId });
      }
    }

    // Upsert this page's scores to lt_mns_company_brain_scores in batches
    for (let i = 0; i < scoreRows.length; i += SCORE_BATCH) {
      const batch = scoreRows.slice(i, i + SCORE_BATCH);
      const { error: upsertErr } = await sb
        .from("lt_mns_company_brain_scores")
        .upsert(batch, { onConflict: "company_id,brain_id" });
      if (upsertErr) {
        console.error(`\n   Score upsert error:`, upsertErr.message);
      }
    }

    totalScored += embRows.length;
    process.stdout.write(` persisted\n`);

    if (embRows.length < SUPABASE_PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`   Total scored: ${totalScored}`);

  // ── Step 5: Write fitScore back to MySQL ──────────────────────────────────
  console.log(`\n[5/5] Writing fitScore to MySQL for ${mysqlUpdates.length} companies...`);
  let updated = 0;
  for (let i = 0; i < mysqlUpdates.length; i += MYSQL_BATCH) {
    const batch = mysqlUpdates.slice(i, i + MYSQL_BATCH);
    // Build a single multi-row UPDATE using CASE for efficiency
    const ids = batch.map((u) => u.mysqlId);
    const caseScore = batch.map((u) => `WHEN ${u.mysqlId} THEN ${u.score}`).join(" ");
    const caseFitData = batch.map((u) =>
      `WHEN ${u.mysqlId} THEN '${JSON.stringify({ brainScores: { [u.brainId]: u.score }, bestBrainId: u.brainId, method: "cosine-similarity-v1" })}'`
    ).join(" ");
    const inList = ids.join(",");

    await conn.execute(
      `UPDATE companies
       SET fitScore = CASE id ${caseScore} END,
           fitScoreData = CASE id ${caseFitData} END
       WHERE id IN (${inList})`
    );
    updated += batch.length;
    if (updated % 2000 === 0 || updated === mysqlUpdates.length) {
      console.log(`   Updated ${updated}/${mysqlUpdates.length} companies...`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const allScores = mysqlUpdates.map((u) => u.score);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const avgScore = Math.round(allScores.reduce((a, s) => a + s, 0) / allScores.length);
  const highFit = allScores.filter((s) => s >= 70).length;
  const medFit = allScores.filter((s) => s >= 50 && s < 70).length;
  const lowFit = allScores.filter((s) => s < 50).length;

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  FULL-CORPUS SCORING COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Embeddings scored       : ${totalScored}`);
  console.log(`  MySQL companies updated : ${updated}`);
  console.log(`  Brain used              : ${brain.brainName} (id=${activeBrainId})`);
  console.log(`  Score range             : ${minScore} – ${maxScore} (avg ${avgScore})`);
  console.log(`  High fit (≥70)          : ${highFit} (${Math.round(highFit/allScores.length*100)}%)`);
  console.log(`  Medium fit (50–69)      : ${medFit} (${Math.round(medFit/allScores.length*100)}%)`);
  console.log(`  Low fit (<50)           : ${lowFit} (${Math.round(lowFit/allScores.length*100)}%)`);
  console.log("═══════════════════════════════════════════════════\n");

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
