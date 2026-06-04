/**
 * FIT-SIM scorer for a specific searchId (or all companies if no searchId given)
 * Usage: node scripts/run-fit-sim-search.mjs [searchId]
 * Scores companies against the active Brain ICP embedding (cosine similarity)
 * Writes to companies.similarityScore — always overwrites (force rescore)
 */
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SUPABASE_PAGE_SIZE = 1000;
const MYSQL_BATCH = 200;

const TARGET_SEARCH_ID = process.argv[2] ? parseInt(process.argv[2]) : null;

function toCompanyUUID(id) { return uuidv5(`company-${id}`, LT_NAMESPACE); }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; }
function mag(v) { return Math.sqrt(dot(v, v)); }
function cosine(a, b) { const d = mag(a)*mag(b); return d === 0 ? 0 : dot(a,b)/d; }

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Get active Brain embedding
  console.log("[1/5] Fetching active Brain embedding...");
  const [brainRows] = await conn.execute(
    "SELECT id, brainName FROM offering_brain WHERE isActive = 1 AND show_on_leadtrigger = 1 ORDER BY updatedAt DESC LIMIT 1"
  );
  if (!brainRows?.length) throw new Error("No active Brain found");
  const brain = brainRows[0];
  const brainId = String(brain.id);
  const { data: brainEmb, error: brainErr } = await supabase
    .from("lt_mns_brain_embeddings")
    .select("brain_id, embedding")
    .eq("brain_id", brainId)
    .single();
  if (brainErr || !brainEmb) throw new Error("Brain embedding not found: " + brainErr?.message);
  const brainVec = typeof brainEmb.embedding === "string" ? JSON.parse(brainEmb.embedding) : brainEmb.embedding;
  console.log(`  Brain: "${brain.brainName}" (id=${brainId}), dims=${brainVec.length}`);

  // 2. Get company IDs — for specific search or all
  console.log(`[2/5] Fetching company IDs${TARGET_SEARCH_ID ? ` for searchId=${TARGET_SEARCH_ID}` : ' (all)'}...`);
  const whereClause = TARGET_SEARCH_ID
    ? `WHERE searchId = ${TARGET_SEARCH_ID}`
    : `WHERE similarityScore IS NULL OR similarityScore = 0`;
  const [rows] = await conn.execute(`SELECT id FROM companies ${whereClause}`);
  const allIds = rows.map(r => r.id);
  console.log(`  Found ${allIds.length} companies to score`);

  if (allIds.length === 0) {
    console.log("Nothing to score. Done.");
    await conn.end();
    return;
  }

  // Build UUID → MySQL ID map
  const uuidToId = new Map();
  for (const id of allIds) uuidToId.set(toCompanyUUID(id), id);

  // 3. Fetch company embeddings from Supabase (paginated)
  console.log("[3/5] Fetching company embeddings from Supabase...");
  let page = 0, totalFetched = 0;
  const updates = [];

  while (true) {
    const from = page * SUPABASE_PAGE_SIZE;
    const { data: embs, error: embErr } = await supabase
      .from("lt_mns_company_embeddings")
      .select("watchlist_id, embedding")
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (embErr) throw new Error("Supabase fetch error: " + embErr.message);
    if (!embs || embs.length === 0) break;
    totalFetched += embs.length;

    for (const emb of embs) {
      const mysqlId = uuidToId.get(emb.watchlist_id);
      if (!mysqlId) continue; // not in our target set
      const compVec = typeof emb.embedding === "string" ? JSON.parse(emb.embedding) : emb.embedding;
      if (!compVec || compVec.length !== brainVec.length) continue;
      const score = Math.round(cosine(brainVec, compVec) * 100);
      updates.push({ id: mysqlId, score });
    }

    console.log(`  Page ${page + 1}: fetched ${embs.length}, matched ${updates.length} so far`);
    if (embs.length < SUPABASE_PAGE_SIZE) break;
    page++;
  }

  console.log(`  Total Supabase pages: ${page + 1}, matched: ${updates.length}/${allIds.length}`);

  // 4. Write scores back to MySQL in batches
  console.log("[4/5] Writing similarity scores to MySQL...");
  let written = 0;
  for (let i = 0; i < updates.length; i += MYSQL_BATCH) {
    const batch = updates.slice(i, i + MYSQL_BATCH);
    const cases = batch.map(u => `WHEN id = ${u.id} THEN ${u.score}`).join(" ");
    const ids = batch.map(u => u.id).join(",");
    await conn.execute(`UPDATE companies SET similarityScore = CASE ${cases} END WHERE id IN (${ids})`);
    written += batch.length;
    if (written % 1000 === 0 || written === updates.length) {
      console.log(`  Written ${written}/${updates.length}`);
    }
  }

  // 5. Summary
  const unmatched = allIds.length - updates.length;
  console.log(`\n[5/5] Done.`);
  console.log(`  Scored:    ${updates.length}`);
  console.log(`  Unmatched: ${unmatched} (no embedding in Supabase yet)`);
  if (TARGET_SEARCH_ID) {
    const [final] = await conn.execute(
      `SELECT COUNT(*) as total, SUM(CASE WHEN similarityScore IS NOT NULL THEN 1 ELSE 0 END) as scored FROM companies WHERE searchId = ${TARGET_SEARCH_ID}`
    );
    console.log(`  SearchId ${TARGET_SEARCH_ID} final: ${final[0].scored}/${final[0].total} scored`);
  }

  await conn.end();
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
