/**
 * Direct sync runner — bypasses HTTP/tRPC, calls supabaseSync functions directly.
 * Run with: node run-sync.mjs
 */
import * as dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const DB_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DB_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

// Parse DATABASE_URL
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
const [, user, pass, host, port, db] = match;

const conn = await mysql.createConnection({
  host, port: parseInt(port || "4000"), user, password: pass, database: db,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// UUID namespace (must match server/supabaseSync.ts)
const UUID_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
function toUUID(prefix, id) {
  return uuidv5(`${prefix}:${id}`, UUID_NS);
}

// ── Sync company pages ──────────────────────────────────────────────────────
console.log("Fetching companies with briefData from MySQL...");

const [rows] = await conn.execute(`
  SELECT 
    c.id, c.name, c.websiteUrl, c.searchId, c.urgencyScore, c.fitScore,
    c.fitScoreData, c.briefData, c.createdAt,
    s.offeringName
  FROM companies c
  LEFT JOIN searches s ON c.searchId = s.id
  WHERE c.briefData IS NOT NULL
`);

console.log(`Found ${rows.length} companies with briefData`);

const pageRows = rows.map(row => {
  let fitLabel = null;
  try {
    const fd = row.fitScoreData ? JSON.parse(row.fitScoreData) : {};
    fitLabel = fd.label ?? null;
  } catch {}

  const urgencyLabel =
    (row.urgencyScore ?? 0) >= 70 ? "HIGH" :
    (row.urgencyScore ?? 0) >= 40 ? "MEDIUM" : "LOW";

  return {
    id: toUUID("page", row.id),
    company_id: toUUID("company", row.id),
    company_name: row.name,
    domain: row.websiteUrl ?? null,
    campaign_id: row.searchId ?? null,
    campaign_name: row.offeringName ?? null,
    urgency_score: row.urgencyScore ?? null,
    fit_score: row.fitScore ?? null,
    urgency_label: urgencyLabel,
    fit_label: fitLabel,
    page_url: `/company/${row.id}`,
    synced_at: new Date().toISOString(),
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
});

console.log(`Built ${pageRows.length} page rows. Upserting in chunks of 500...`);

const CHUNK = 500;
let synced = 0, errors = 0;

for (let i = 0; i < pageRows.length; i += CHUNK) {
  const chunk = pageRows.slice(i, i + CHUNK);
  const { error } = await supabase
    .from("lt_mns_company_pages")
    .upsert(chunk, { onConflict: "id" });

  if (error) {
    console.error(`Chunk ${i}-${i+CHUNK} ERROR:`, error.message, error.code);
    // Try one by one to isolate
    for (const row of chunk) {
      const { error: e2 } = await supabase
        .from("lt_mns_company_pages")
        .upsert([row], { onConflict: "id" });
      if (e2) {
        console.error(`  Row ${row.company_name} (${row.domain}) FAILED:`, e2.message);
        errors++;
      } else {
        synced++;
      }
    }
  } else {
    synced += chunk.length;
    process.stdout.write(`  Chunk ${Math.floor(i/CHUNK)+1}: ${synced} synced so far\r`);
  }
}

console.log(`\n✅ Company pages sync complete: ${synced} synced, ${errors} errors`);

// ── Verify ──────────────────────────────────────────────────────────────────
const { count } = await supabase
  .from("lt_mns_company_pages")
  .select("id", { count: "exact", head: true });

console.log(`Supabase lt_mns_company_pages now has ${count} rows`);

// Check campaign 1980003
const { data: check } = await supabase
  .from("lt_mns_company_pages")
  .select("company_name, campaign_id")
  .eq("campaign_id", 1980003)
  .limit(3);

console.log(`Campaign 1980003 in Supabase:`, check?.length ?? 0, "rows");
if (check?.length) console.log("Sample:", check.map(r => r.company_name).join(", "));

await conn.end();
