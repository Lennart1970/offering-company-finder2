/**
 * Full embedding backfill for all MySQL companies.
 * Uses watchlist_id = toCompanyUUID(mysqlId) as the upsert key (same as production).
 * Safe to re-run — upserts on conflict.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import OpenAI from "openai";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const EMBED_BATCH = 50;
const UPSERT_BATCH = 100;

function toCompanyUUID(id) {
  return uuidv5(`company-${id}`, LT_NAMESPACE);
}

function buildEmbeddingText(company) {
  const parts = [`Company: ${company.name}`];
  if (company.sliceMetadata) {
    try {
      const meta = JSON.parse(company.sliceMetadata);
      if (meta.industry) parts.push(`Industry: ${meta.industry}`);
      if (meta.description) parts.push(`Description: ${meta.description.slice(0, 300)}`);
      if (meta.employeeCount) parts.push(`Employees: ${meta.employeeCount}`);
    } catch {}
  }
  if (company.sector) parts.push(`Sector: ${company.sector}`);
  const loc = [company.city, company.country].filter(Boolean).join(", ");
  if (loc) parts.push(`Location: ${loc}`);
  if (company.websiteUrl) parts.push(`Website: ${company.websiteUrl}`);
  return parts.join(". ");
}

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1" });
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  console.log("=== Full Embedding Backfill (all MySQL companies) ===");
  console.log("Started:", new Date().toISOString());

  // Check how many already exist with our UUID scheme
  console.log("\n[1/3] Checking existing embeddings with our UUID scheme...");
  const [countRows] = await conn.execute("SELECT COUNT(*) as cnt FROM companies");
  const totalCompanies = countRows[0].cnt;
  console.log("  Total MySQL companies:", totalCompanies);

  // Fetch all IDs
  const [idRows] = await conn.execute("SELECT id FROM companies ORDER BY id");
  const allIds = idRows.map(r => r.id);

  // Check which already have embeddings (by watchlist_id)
  console.log("  Checking Supabase for existing embeddings by our UUID scheme...");
  const existingWatchlistIds = new Set();
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from("lt_mns_company_embeddings")
      .select("watchlist_id")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    data.forEach(r => existingWatchlistIds.add(r.watchlist_id));
    page++;
    if (data.length < 1000) break;
  }
  console.log("  Total Supabase embeddings:", existingWatchlistIds.size);

  const missingIds = allIds.filter(id => !existingWatchlistIds.has(toCompanyUUID(id)));
  console.log("  Missing (our UUID scheme):", missingIds.length);

  if (missingIds.length === 0) {
    console.log("\nAll companies already have embeddings. Done.");
    await conn.end();
    return;
  }

  console.log("\n[2/3] Generating and upserting embeddings...");
  let embedded = 0, errors = 0;
  const totalBatches = Math.ceil(missingIds.length / EMBED_BATCH);

  for (let i = 0; i < missingIds.length; i += EMBED_BATCH) {
    const batchIds = missingIds.slice(i, i + EMBED_BATCH);
    const batchNum = Math.floor(i / EMBED_BATCH) + 1;
    const placeholders = batchIds.map(() => "?").join(",");
    const [rows] = await conn.execute(
      `SELECT id, name, sliceMetadata, sector, city, country, websiteUrl FROM companies WHERE id IN (${placeholders})`,
      batchIds
    );
    if (rows.length === 0) continue;
    const texts = rows.map(buildEmbeddingText);
    let embeddingResponse;
    try {
      embeddingResponse = await openai.embeddings.create({ model: "text-embedding-3-small", input: texts });
    } catch (e) {
      console.error(`  OpenAI error batch ${batchNum}:`, e.message);
      errors += rows.length;
      continue;
    }
    const upsertRows = rows.map((company, idx) => ({
      watchlist_id: toCompanyUUID(company.id),
      embedding: embeddingResponse.data[idx].embedding,
      content_to_embed: texts[idx],
      last_updated_at: new Date().toISOString(),
    }));
    for (let j = 0; j < upsertRows.length; j += UPSERT_BATCH) {
      const sub = upsertRows.slice(j, j + UPSERT_BATCH);
      const { error: upsertError } = await supabase
        .from("lt_mns_company_embeddings")
        .upsert(sub, { onConflict: "watchlist_id", ignoreDuplicates: false });
      if (upsertError) {
        console.error(`  Supabase error:`, upsertError.message);
        errors += sub.length;
      } else {
        embedded += sub.length;
      }
    }
    if (batchNum % 20 === 0 || batchNum === totalBatches) {
      const pct = ((i + batchIds.length) / missingIds.length * 100).toFixed(1);
      console.log(`  Batch ${batchNum}/${totalBatches} (${pct}%) — embedded: ${embedded}, errors: ${errors}`);
    }
  }

  await conn.end();
  console.log("\n[3/3] Summary");
  console.log("  Total missing:  ", missingIds.length);
  console.log("  Embedded:       ", embedded);
  console.log("  Errors:         ", errors);
  console.log("  Finished:       ", new Date().toISOString());
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
