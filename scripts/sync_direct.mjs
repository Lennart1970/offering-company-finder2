/**
 * Direct Supabase sync runner — bypasses the HTTP layer.
 * Run: node scripts/sync_direct.mjs
 */
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envContent = readFileSync(join(__dirname, "../.env"), "utf8");
  envContent.split("\n").forEach(line => {
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key) process.env[key] = val;
    }
  });
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DATABASE_URL;
const APP_BASE_URL = "https://leadtrigger-connectgroup.com";

if (!SUPABASE_URL || !SUPABASE_KEY || !DB_URL) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Step 1: Find max company ID already in Supabase
console.log("Step 1: Finding max company ID in Supabase...");
let maxId = 0;
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await supabase
    .from("lt_mns_company_pages")
    .select("page_url")
    .range(from, from + PAGE - 1);
  if (error || !data || data.length === 0) break;
  for (const row of data) {
    const m = String(row.page_url ?? "").match(/\/company\/(\d+)/);
    if (m) { const id = parseInt(m[1], 10); if (id > maxId) maxId = id; }
  }
  if (data.length < PAGE) break;
  from += PAGE;
}
console.log(`  Max company ID in Supabase: ${maxId}`);

// Step 2: Fetch new companies from MySQL
console.log("\nStep 2: Fetching new companies from MySQL...");
const conn = await mysql.createConnection(DB_URL);

const [companies] = await conn.execute(`
  SELECT 
    c.id, c.name, c.websiteUrl, c.primaryDomain, c.country, c.city,
    c.fitScore, c.fitScoreSource, c.urgencyScore,
    c.briefData, c.searchId, c.createdAt,
    s.offeringName as searchName
  FROM companies c
  LEFT JOIN searches s ON c.searchId = s.id
  WHERE c.briefData IS NOT NULL AND c.id > ?
  ORDER BY c.id ASC
  LIMIT 500
`, [maxId]);

console.log(`  Found ${companies.length} new companies to sync`);

if (companies.length === 0) {
  console.log("\n✓ Already up to date — no new articles to sync");
  await conn.end();
  process.exit(0);
}

// Step 3: Build and upsert pages
console.log("\nStep 3: Upserting to Supabase lt_mns_company_pages...");
const rows = companies.map(c => {
  let brief = {};
  try { brief = JSON.parse(c.briefData ?? "{}"); } catch {}
  
  const urgencyScore = c.urgencyScore ?? 0;
  const urgencyLabel = urgencyScore >= 70 ? "HIGH" : urgencyScore >= 40 ? "MEDIUM" : "LOW";
  const fitScore = c.fitScore ?? 0;
  const fitLabel = fitScore >= 80 ? "EXCELLENT" : fitScore >= 60 ? "GOOD" : fitScore >= 40 ? "FAIR" : "LOW";
  
  const domain = c.primaryDomain ?? (c.websiteUrl ? c.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : null);
  const pageUrl = `${APP_BASE_URL}/company/${c.id}`;

  return {
    id: `company-${c.id}`,
    company_id: `company-${c.id}`,
    company_name: c.name,
    domain,
    campaign_id: c.searchId ?? null,
    campaign_name: c.searchName ?? null,
    urgency_score: urgencyScore,
    fit_score: fitScore,
    urgency_label: urgencyLabel,
    fit_label: fitLabel,
    page_url: pageUrl,
    synced_at: new Date().toISOString(),
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  };
});

const BATCH = 100;
let synced = 0;
let errors = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase
    .from("lt_mns_company_pages")
    .upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`  Batch ${Math.floor(i/BATCH)+1} error:`, error.message);
    errors += batch.length;
  } else {
    synced += batch.length;
    process.stdout.write(`  Upserted ${synced}/${rows.length}...\r`);
  }
}

await conn.end();
console.log(`\n\n✓ DONE: ${synced} synced, ${errors} errors`);
console.log(`  Supabase lt_mns_company_pages should now have ${9394 + synced}+ rows`);
