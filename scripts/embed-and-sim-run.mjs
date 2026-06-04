/**
 * Embed companies from a specific search run into Supabase, then run FIT-SIM scoring.
 * Usage: node scripts/embed-and-sim-run.mjs <searchId>
 */
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-ada-002";
const SUPABASE_PAGE_SIZE = 1000;
const MYSQL_BATCH = 200;

const SEARCH_ID = parseInt(process.argv[2]);
if (!SEARCH_ID) { console.error("Usage: node embed-and-sim-run.mjs <searchId>"); process.exit(1); }

function toUUID(id) { return uuidv5(`company-${id}`, LT_NAMESPACE); }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; }
function mag(v) { return Math.sqrt(dot(v, v)); }
function cosine(a, b) { const d = mag(a)*mag(b); return d === 0 ? 0 : dot(a,b)/d; }

async function getEmbedding(text) {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.substring(0, 8000) }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return (await res.json()).data[0].embedding;
}

function buildText(c) {
  const parts = [c.name, c.primaryDomain || c.websiteUrl || "", c.country || "", c.sector || ""];
  try {
    const m = typeof c.sliceMetadata === "string" ? JSON.parse(c.sliceMetadata) : c.sliceMetadata;
    if (m?.description) parts.push(m.description);
    if (m?.industry) parts.push(m.industry);
    if (m?.keywords) parts.push(Array.isArray(m.keywords) ? m.keywords.join(", ") : m.keywords);
  } catch {}
  return parts.filter(Boolean).join(" | ");
}

async function resolveSupabaseId(supabase, company) {
  const domain = company.primaryDomain || company.websiteUrl || null;
  if (company.name) {
    const { data } = await supabase.from("lt_mns_companies").select("id").eq("company_name", company.name).limit(1).single();
    if (data?.id) return { id: data.id, isNew: false };
  }
  if (domain) {
    const { data } = await supabase.from("lt_mns_companies").select("id").eq("domain", domain).limit(1).single();
    if (data?.id) return { id: data.id, isNew: false };
  }
  return { id: toUUID(company.id), isNew: true };
}

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // --- PHASE 1: EMBED ---
  console.log(`\n=== PHASE 1: EMBED (searchId=${SEARCH_ID}) ===`);
  const [companies] = await conn.execute(
    `SELECT id, name, primaryDomain, websiteUrl, country, sector, apolloId, sliceMetadata FROM companies WHERE searchId = ${SEARCH_ID}`
  );
  console.log(`Companies in run: ${companies.length}`);

  // Check existing embeddings by v5 UUID
  const v5UUIDs = companies.map(c => toUUID(c.id));
  let alreadyEmbedded = new Set();
  for (let i = 0; i < v5UUIDs.length; i += 500) {
    const { data } = await supabase.from("lt_mns_company_embeddings").select("watchlist_id").in("watchlist_id", v5UUIDs.slice(i, i+500));
    if (data) data.forEach(d => alreadyEmbedded.add(d.watchlist_id));
  }

  const toEmbed = companies.filter(c => !alreadyEmbedded.has(toUUID(c.id)));
  console.log(`Need embedding: ${toEmbed.length} | Already have: ${alreadyEmbedded.size}`);

  // Map from supabase UUID back to mysql ID for FIT-SIM
  const supabaseToMysql = new Map();
  // Pre-populate with already-embedded ones (v5 UUID → mysql id)
  for (const c of companies) {
    if (alreadyEmbedded.has(toUUID(c.id))) supabaseToMysql.set(toUUID(c.id), c.id);
  }

  let embDone = 0, embFailed = 0, embSkipped = 0;
  for (const company of toEmbed) {
    try {
      const { id: supabaseId, isNew } = await resolveSupabaseId(supabase, company);
      supabaseToMysql.set(supabaseId, company.id);

      if (isNew) {
        const domain = company.primaryDomain || company.websiteUrl || null;
        const { error } = await supabase.from("lt_mns_companies").insert({
          id: supabaseId, company_name: company.name, domain,
          country: company.country || null, sector: company.sector || null, apollo_id: company.apolloId || null,
        });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message);
      }

      // Check if supabaseId already has embedding (different UUID path)
      const { data: existEmb } = await supabase.from("lt_mns_company_embeddings").select("watchlist_id").eq("watchlist_id", supabaseId).single();
      if (existEmb) { embSkipped++; embDone++; supabaseToMysql.set(supabaseId, company.id); continue; }

      const embedding = await getEmbedding(buildText(company));
      const { error: embErr } = await supabase.from("lt_mns_company_embeddings").upsert({ watchlist_id: supabaseId, embedding }, { onConflict: "watchlist_id" });
      if (embErr) throw new Error(embErr.message);
      embDone++;
    } catch (e) {
      console.error(`  Embed failed [${company.name}]: ${e.message}`);
      embFailed++;
    }
    if ((embDone + embFailed) % 25 === 0) console.log(`  Embed progress: ${embDone+embFailed}/${toEmbed.length} | failed: ${embFailed}`);
  }
  console.log(`Embed complete: ${embDone} done (${embSkipped} skipped), ${embFailed} failed`);

  // --- PHASE 2: FIT-SIM ---
  console.log(`\n=== PHASE 2: FIT-SIM (searchId=${SEARCH_ID}) ===`);

  // Get active brain embedding
  const [brainRows] = await conn.execute(
    "SELECT id, brainName FROM offering_brain WHERE isActive = 1 AND show_on_leadtrigger = 1 ORDER BY updatedAt DESC LIMIT 1"
  );
  if (!brainRows?.length) throw new Error("No active Brain found");
  const brain = brainRows[0];
  const { data: brainEmb, error: brainErr } = await supabase.from("lt_mns_brain_embeddings").select("brain_id, embedding").eq("brain_id", String(brain.id)).single();
  if (brainErr || !brainEmb) throw new Error("Brain embedding not found: " + brainErr?.message);
  const brainVec = typeof brainEmb.embedding === "string" ? JSON.parse(brainEmb.embedding) : brainEmb.embedding;
  console.log(`Brain: "${brain.brainName}", dims=${brainVec.length}`);

  // Build full UUID→mysqlId map for all companies in this run
  const allUUIDToMysql = new Map();
  for (const c of companies) allUUIDToMysql.set(toUUID(c.id), c.id);
  // Also add resolved supabase IDs
  for (const [sid, mid] of supabaseToMysql) allUUIDToMysql.set(sid, mid);

  // Fetch all company embeddings from Supabase
  console.log(`Fetching embeddings from Supabase...`);
  let page = 0, updates = [];
  while (true) {
    const from = page * SUPABASE_PAGE_SIZE;
    const { data: embs, error } = await supabase.from("lt_mns_company_embeddings").select("watchlist_id, embedding").range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!embs || embs.length === 0) break;
    for (const emb of embs) {
      const mysqlId = allUUIDToMysql.get(emb.watchlist_id);
      if (!mysqlId) continue;
      const vec = typeof emb.embedding === "string" ? JSON.parse(emb.embedding) : emb.embedding;
      if (!vec || vec.length !== brainVec.length) continue;
      updates.push({ id: mysqlId, score: Math.round(cosine(brainVec, vec) * 100) });
    }
    if (embs.length < SUPABASE_PAGE_SIZE) break;
    page++;
  }
  console.log(`Matched ${updates.length}/${companies.length} companies with embeddings`);

  // Write scores to MySQL
  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += MYSQL_BATCH) {
      const batch = updates.slice(i, i + MYSQL_BATCH);
      const cases = batch.map(u => `WHEN id = ${u.id} THEN ${u.score}`).join(" ");
      const ids = batch.map(u => u.id).join(",");
      await conn.execute(`UPDATE companies SET similarityScore = CASE ${cases} END WHERE id IN (${ids})`);
    }
    console.log(`FIT-SIM scores written: ${updates.length}`);
  }

  // Final stats
  const [final] = await conn.execute(
    `SELECT COUNT(*) as total, SUM(CASE WHEN similarityScore IS NOT NULL THEN 1 ELSE 0 END) as scored, MIN(similarityScore) as min_s, MAX(similarityScore) as max_s, ROUND(AVG(similarityScore),1) as avg_s FROM companies WHERE searchId = ${SEARCH_ID}`
  );
  console.log(`\nFinal: ${final[0].scored}/${final[0].total} scored | min=${final[0].min_s} max=${final[0].max_s} avg=${final[0].avg_s}`);

  await conn.end();
  console.log("\nDone.");
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
