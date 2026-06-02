/**
 * Sync ALL TiDB companies → Supabase lt_mns_companies
 *
 * Steps:
 *  1. Count companies in TiDB
 *  2. Count companies already in Supabase
 *  3. Find TiDB company IDs not yet in Supabase
 *  4. Sync in batches of 200 using the existing syncCompaniesToSupabase logic
 *
 * Run: node scripts/sync-all-to-supabase.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const BATCH_SIZE = 200;

function toCompanyUUID(mysqlId) {
  return uuidv5(`company-${mysqlId}`, LT_NAMESPACE);
}

async function getDbConnection() {
  const url = process.env.DATABASE_URL;
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
  const [, user, pass, host, port, db] = match;
  return mysql.createConnection({
    host, port: parseInt(port || "4000"), user, password: pass, database: db,
    ssl: { rejectUnauthorized: true }
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dbUrl || !supabaseUrl || !supabaseKey) {
    console.error("Missing required env vars: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const conn = await getDbConnection();
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // ── Step 1: Count TiDB companies ──────────────────────────────────────────
  const [[{ total }]] = await conn.execute("SELECT COUNT(*) as total FROM companies");
  console.log(`[1/4] TiDB companies: ${total}`);

  // ── Step 2: Count Supabase companies ──────────────────────────────────────
  const { count: sbCount, error: sbCountErr } = await sb
    .from("lt_mns_companies")
    .select("*", { count: "exact", head: true });
  if (sbCountErr) {
    console.error("Failed to count Supabase companies:", sbCountErr.message);
    process.exit(1);
  }
  console.log(`[2/4] Supabase lt_mns_companies: ${sbCount}`);

  // ── Step 3: Get all TiDB IDs and all Supabase UUIDs ───────────────────────
  console.log("[3/4] Fetching TiDB company IDs...");
  const [tidbRows] = await conn.execute("SELECT id FROM companies ORDER BY id");
  const tidbIds = tidbRows.map(r => r.id);
  console.log(`      TiDB IDs fetched: ${tidbIds.length}`);

  // Get all UUIDs already in Supabase in pages
  console.log("      Fetching Supabase UUIDs...");
  const sbUuids = new Set();
  let sbOffset = 0;
  const SB_PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("lt_mns_companies")
      .select("id")
      .range(sbOffset, sbOffset + SB_PAGE - 1);
    if (error) { console.error("Supabase fetch error:", error.message); break; }
    if (!data || data.length === 0) break;
    data.forEach(r => sbUuids.add(r.id));
    sbOffset += data.length;
    if (data.length < SB_PAGE) break;
    process.stdout.write(`\r      Supabase UUIDs fetched: ${sbUuids.size}`);
  }
  console.log(`\n      Supabase UUIDs fetched: ${sbUuids.size}`);

  // Find TiDB IDs not yet in Supabase
  const missingIds = tidbIds.filter(id => !sbUuids.has(toCompanyUUID(id)));
  console.log(`      Missing from Supabase: ${missingIds.length}`);

  if (missingIds.length === 0) {
    console.log("\n✅ All TiDB companies are already in Supabase. Nothing to sync.");
    await conn.end();
    return;
  }

  // ── Step 4: Sync missing companies in batches ─────────────────────────────
  console.log(`\n[4/4] Syncing ${missingIds.length} companies in batches of ${BATCH_SIZE}...`);
  let synced = 0;
  let errors = 0;
  const totalBatches = Math.ceil(missingIds.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchIds = missingIds.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);

    // Fetch full company data from TiDB
    const placeholders = batchIds.map(() => "?").join(",");
    const [rows] = await conn.execute(
      `SELECT id, name, websiteUrl, primaryDomain, city, country, sector, fitScore, urgencyScore,
              sliceMetadata, sicCodes, naicsCodes, searchId, createdAt, enrichmentStatus,
              briefGeneratedAt, salesApproachGeneratedAt, generatedWithBrainId, generatedWithBrainName,
              cgBusinessUnit, cgSalesManager, cgLeadClass, cgLeadOrigin, cgMarket,
              cgComment, cgRemarks, cgSharepointId, cgImportedAt
       FROM companies WHERE id IN (${placeholders})`,
      batchIds
    );

    // Map to Supabase schema
    const upsertRows = rows.map(c => ({
      id: toCompanyUUID(c.id),
      mysql_id: c.id,
      company_name: c.name ?? "",
      domain: c.websiteUrl ?? c.primaryDomain ?? "",
      city: c.city ?? null,
      country: c.country ?? null,
      sector: c.sector ?? null,
      fit_score: c.fitScore ?? null,
      urgency_score: c.urgencyScore ?? null,
      search_id: c.searchId ?? null,
      enrichment_status: c.enrichmentStatus ?? null,
      brief_generated_at: c.briefGeneratedAt ?? null,
      sales_approach_generated_at: c.salesApproachGeneratedAt ?? null,
      generated_with_brain_id: c.generatedWithBrainId ?? null,
      generated_with_brain_name: c.generatedWithBrainName ?? null,
      cg_business_unit: c.cgBusinessUnit ?? null,
      cg_sales_manager: c.cgSalesManager ?? null,
      cg_lead_class: c.cgLeadClass ?? null,
      cg_lead_origin: c.cgLeadOrigin ?? null,
      cg_market: c.cgMarket ?? null,
      slice_metadata: c.sliceMetadata ?? null,
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }));

    const { error } = await sb
      .from("lt_mns_companies")
      .upsert(upsertRows, { onConflict: "id" });

    if (error) {
      console.error(`\n  Batch ${batchIdx + 1}/${totalBatches} ERROR: ${error.message}`);
      errors += batchIds.length;
    } else {
      synced += batchIds.length;
    }

    const pct = Math.round(((batchIdx + 1) / totalBatches) * 100);
    process.stdout.write(`\r  Progress: ${batchIdx + 1}/${totalBatches} batches (${pct}%) — ${synced} synced, ${errors} errors`);
  }

  console.log(`\n\n✅ Sync complete!`);
  console.log(`   Synced: ${synced}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total in Supabase (approx): ${(sbCount ?? 0) + synced}`);

  await conn.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
