/**
 * Standalone FIT-SIM bulk scorer
 * Scores all companies against the active Brain ICP embedding (cosine similarity)
 * Writes to companies.similarityScore
 *
 * Brain vector source: lt_mns_brain_embeddings (Supabase), keyed by MySQL offering_brain.id
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SUPABASE_PAGE_SIZE = 1000;
const MYSQL_BATCH = 200;

function toCompanyUUID(id) { return uuidv5(`company-${id}`, LT_NAMESPACE); }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; }
function mag(v) { return Math.sqrt(dot(v, v)); }
function cosine(a, b) { const d = mag(a)*mag(b); return d === 0 ? 0 : dot(a,b)/d; }

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Get active Brain ID from MySQL, then fetch its embedding from Supabase
  console.log("[1/5] Fetching active Brain embedding...");
  const [brainRows] = await conn.execute(
    "SELECT id, brainName FROM offering_brain WHERE isActive = 1 AND show_on_leadtrigger = 1 ORDER BY updatedAt DESC LIMIT 1"
  );
  if (!brainRows?.length) throw new Error("No active Brain found in MySQL");
  const brain = brainRows[0];
  const brainId = String(brain.id);

  const { data: brainEmb, error: brainErr } = await supabase
    .from("lt_mns_brain_embeddings")
    .select("brain_id, embedding")
    .eq("brain_id", brainId)
    .single();
  if (brainErr || !brainEmb) throw new Error("Brain embedding not found in Supabase: " + brainErr?.message);
  const brainVec = typeof brainEmb.embedding === "string" ? JSON.parse(brainEmb.embedding) : brainEmb.embedding;
  console.log(`  Brain: "${brain.brainName}" (id=${brainId}), dims=${brainVec.length}`);

  // 2. Get all company IDs from MySQL that need scoring
  console.log("[2/5] Fetching company IDs from MySQL...");
  const [rows] = await conn.execute("SELECT id FROM companies WHERE similarityScore IS NULL OR similarityScore = 0");
  const allIds = rows.map(r => r.id);
  console.log(`  Found ${allIds.length} companies to score`);

  // Build UUID → MySQL ID map
  const uuidToId = new Map();
  for (const id of allIds) uuidToId.set(toCompanyUUID(id), id);

  // 3. Fetch company embeddings from Supabase (paginated)
  console.log("[3/5] Fetching company embeddings from Supabase...");
  let page = 0, totalFetched = 0, updates = [];
  while (true) {
    const from = page * SUPABASE_PAGE_SIZE;
    const { data: embs, error: embErr } = await supabase
      .from("lt_mns_company_embeddings")
      .select("watchlist_id, embedding")
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (embErr) throw new Error("Supabase fetch error: " + embErr.message);
    if (!embs?.length) break;
    totalFetched += embs.length;

    for (const row of embs) {
      const mysqlId = uuidToId.get(row.watchlist_id);
      if (!mysqlId) continue;
      const vec = typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding;
      const score = Math.round(cosine(vec, brainVec) * 100);
      updates.push({ id: mysqlId, score });
    }

    if (page % 10 === 0) console.log(`  Page ${page+1}: fetched ${totalFetched} embeddings, ${updates.length} matches so far`);
    if (embs.length < SUPABASE_PAGE_SIZE) break;
    page++;
  }
  console.log(`  Total: ${totalFetched} embeddings fetched, ${updates.length} matched to MySQL companies`);

  // 4. Write similarityScore to MySQL in batches
  console.log("[4/5] Writing similarityScore to MySQL...");
  let written = 0;
  for (let i = 0; i < updates.length; i += MYSQL_BATCH) {
    const batch = updates.slice(i, i + MYSQL_BATCH);
    const caseScore = batch.map(u => `WHEN ${u.id} THEN ${u.score}`).join(" ");
    const ids = batch.map(u => u.id).join(",");
    await conn.execute(
      `UPDATE companies SET similarityScore = CASE id ${caseScore} END, similarityScoreGeneratedAt = NOW() WHERE id IN (${ids})`
    );
    written += batch.length;
    if (written % 2000 === 0) console.log(`  Written ${written}/${updates.length}`);
  }

  console.log(`\n✅ Done! Scored ${written} companies. Brain: "${brain.brainName}"`);
  await conn.end();
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
