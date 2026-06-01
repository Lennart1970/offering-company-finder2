/**
 * Backfill script: embed + score Merio companies (searches 2010001, 2010002)
 *
 * Steps:
 *  1. Fetch all companies for the given search IDs from MySQL
 *  2. Generate OpenAI embeddings (text-embedding-3-small)
 *  3. Upsert embeddings to lt_mns_company_embeddings in Supabase
 *  4. Score against the active Brain (Brain ID from MySQL)
 *  5. Persist scores to lt_mns_company_brain_scores
 *  6. Write fitScore + fitScoreData back to MySQL companies table
 *
 * Run: node scripts/backfill-merio-scores.mjs
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import OpenAI from "openai";
import { v5 as uuidv5 } from "uuid";

const SEARCH_IDS = [2010001, 2010002];
const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const BATCH_SIZE = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCompanyUUID(mysqlId) {
  return uuidv5(`company-${mysqlId}`, LT_NAMESPACE);
}

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

function buildEmbeddingText(company) {
  const parts = [`Company: ${company.name}`];
  if (company.sliceMetadata) {
    try {
      const meta = JSON.parse(company.sliceMetadata);
      if (meta.industry) parts.push(`Industry: ${meta.industry}`);
      if (meta.keywords) parts.push(`Keywords: ${meta.keywords}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
      if (meta.employeeCount) parts.push(`Employees: ${meta.employeeCount}`);
    } catch {}
  }
  const loc = [company.city, company.country].filter(Boolean).join(", ");
  if (loc) parts.push(`Location: ${loc}`);
  if (company.sicCodes) {
    try {
      const codes = JSON.parse(company.sicCodes);
      if (codes.length > 0) parts.push(`SIC: ${codes.slice(0, 3).join(", ")}`);
    } catch {}
  }
  return parts.join(" | ");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!dbUrl || !supabaseUrl || !supabaseKey || !openaiKey) {
    console.error("Missing required env vars");
    process.exit(1);
  }

  // Connect to MySQL
  const conn = await mysql.createConnection(dbUrl);
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const openai = new OpenAI({ apiKey: openaiKey, baseURL: "https://api.openai.com/v1" });

  // ── Step 1: Fetch active Brain ────────────────────────────────────────────
  console.log("\n[1/6] Fetching active Brain...");
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

  // Check Brain embedding exists in Supabase
  const { data: brainEmbRow, error: brainEmbErr } = await sb
    .from("lt_mns_brain_embeddings")
    .select("brain_id, embedding")
    .eq("brain_id", activeBrainId)
    .single();

  if (brainEmbErr || !brainEmbRow) {
    console.error(`Brain embedding not found in Supabase for brain_id=${activeBrainId}:`, brainEmbErr?.message);
    process.exit(1);
  }
  const brainVector = typeof brainEmbRow.embedding === "string"
    ? JSON.parse(brainEmbRow.embedding)
    : brainEmbRow.embedding;
  console.log(`   Brain vector loaded (${brainVector.length} dims)`);

  // ── Step 2: Fetch companies ───────────────────────────────────────────────
  console.log("\n[2/6] Fetching companies for searches:", SEARCH_IDS);
  const placeholders = SEARCH_IDS.map(() => "?").join(",");
  const [companyRows] = await conn.execute(
    `SELECT id, name, city, country, sicCodes, sliceMetadata
     FROM companies WHERE searchId IN (${placeholders})`,
    SEARCH_IDS
  );
  console.log(`   Found ${companyRows.length} companies`);

  if (companyRows.length === 0) {
    console.log("Nothing to process — exiting");
    await conn.end();
    return;
  }

  // ── Step 3: Generate embeddings ───────────────────────────────────────────
  console.log(`\n[3/6] Generating embeddings in batches of ${BATCH_SIZE}...`);
  const embeddings = [];
  for (let i = 0; i < companyRows.length; i += BATCH_SIZE) {
    const batch = companyRows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(companyRows.length / BATCH_SIZE);
    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} companies)...`);
    const resp = await openai.embeddings.create({ model: "text-embedding-3-small", input: texts });
    for (let j = 0; j < batch.length; j++) {
      embeddings.push({
        companyId: batch[j].id,
        embedding: resp.data[j].embedding,
        text: texts[j],
      });
    }
    process.stdout.write(" done\n");
  }
  console.log(`   Total embeddings generated: ${embeddings.length}`);

  // ── Step 4: Persist embeddings to Supabase ────────────────────────────────
  console.log("\n[4/6] Upserting embeddings to lt_mns_company_embeddings...");
  const SB_BATCH = 100;
  const now = new Date().toISOString();
  for (let i = 0; i < embeddings.length; i += SB_BATCH) {
    const batch = embeddings.slice(i, i + SB_BATCH);
    const rows = batch.map((e) => ({
      watchlist_id: toCompanyUUID(e.companyId),
      embedding: e.embedding,
      content_to_embed: e.text,
      last_updated_at: now,
    }));
    const { error } = await sb
      .from("lt_mns_company_embeddings")
      .upsert(rows, { onConflict: "watchlist_id" });
    if (error) {
      console.error(`   Upsert error (batch ${i}–${i + SB_BATCH}):`, error.message);
    } else {
      const batchNum = Math.floor(i / SB_BATCH) + 1;
      const totalBatches = Math.ceil(embeddings.length / SB_BATCH);
      console.log(`   Batch ${batchNum}/${totalBatches}: ${rows.length} rows upserted`);
    }
  }

  // ── Step 5: Score against active Brain ───────────────────────────────────
  console.log(`\n[5/6] Scoring ${embeddings.length} companies against Brain ${activeBrainId}...`);
  const scores = embeddings.map((e) => {
    const sim = cosineSimilarity(e.embedding, brainVector);
    const score = Math.round(((sim + 1) / 2) * 100);
    return {
      companyId: e.companyId,
      companyUUID: toCompanyUUID(e.companyId),
      brainId: activeBrainId,
      score,
    };
  });

  // Persist to lt_mns_company_brain_scores
  const SCORE_BATCH = 500;
  for (let i = 0; i < scores.length; i += SCORE_BATCH) {
    const batch = scores.slice(i, i + SCORE_BATCH);
    const rows = batch.map((s) => ({
      company_id: s.companyUUID,
      brain_id: s.brainId,
      score: s.score,
      scored_at: now,
      method: "cosine-similarity-v1",
    }));
    const { error } = await sb
      .from("lt_mns_company_brain_scores")
      .upsert(rows, { onConflict: "company_id,brain_id" });
    if (error) {
      console.error(`   Brain scores upsert error:`, error.message);
    } else {
      const batchNum = Math.floor(i / SCORE_BATCH) + 1;
      const totalBatches = Math.ceil(scores.length / SCORE_BATCH);
      console.log(`   Brain scores batch ${batchNum}/${totalBatches}: ${rows.length} rows`);
    }
  }

  // ── Step 6: Write fitScore back to MySQL ──────────────────────────────────
  console.log("\n[6/6] Writing fitScore to MySQL companies table...");
  let updated = 0;
  for (const s of scores) {
    await conn.execute(
      `UPDATE companies SET fit_score = ?, fit_score_data = ? WHERE id = ?`,
      [
        s.score,
        JSON.stringify({ brainScores: { [s.brainId]: s.score }, bestBrainId: s.brainId, method: "cosine-similarity-v1" }),
        s.companyId,
      ]
    );
    updated++;
    if (updated % 200 === 0) {
      console.log(`   Updated ${updated}/${scores.length} companies...`);
    }
  }
  console.log(`   Done — ${updated} companies updated`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const minScore = Math.min(...scores.map((s) => s.score));
  const maxScore = Math.max(...scores.map((s) => s.score));
  const avgScore = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
  const highFit = scores.filter((s) => s.score >= 70).length;
  const medFit = scores.filter((s) => s.score >= 50 && s.score < 70).length;
  const lowFit = scores.filter((s) => s.score < 50).length;

  console.log("\n═══════════════════════════════════════════");
  console.log("  BACKFILL COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log(`  Companies processed : ${scores.length}`);
  console.log(`  Brain used          : ${brain.brainName} (id=${activeBrainId})`);
  console.log(`  Score range         : ${minScore} – ${maxScore} (avg ${avgScore})`);
  console.log(`  High fit (≥70)      : ${highFit}`);
  console.log(`  Medium fit (50–69)  : ${medFit}`);
  console.log(`  Low fit (<50)       : ${lowFit}`);
  console.log("═══════════════════════════════════════════\n");

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
