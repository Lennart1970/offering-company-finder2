/**
 * Creates the lt_mns_company_pages table in Supabase.
 * Run once: node create_company_pages_table.mjs
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const sql = `
CREATE TABLE IF NOT EXISTS lt_mns_company_pages (
  id            UUID PRIMARY KEY,
  company_id    UUID,
  company_name  TEXT,
  domain        TEXT,
  campaign_id   INTEGER,
  campaign_name TEXT,
  urgency_score INTEGER,
  fit_score     INTEGER,
  urgency_label TEXT,
  fit_label     TEXT,
  page_url      TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by campaign
CREATE INDEX IF NOT EXISTS idx_company_pages_campaign ON lt_mns_company_pages (campaign_id);
CREATE INDEX IF NOT EXISTS idx_company_pages_company ON lt_mns_company_pages (company_id);
`;

// Supabase JS client doesn't expose raw DDL — use the REST API via fetch
const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  // Try the pg extension approach
  const { data, error } = await supabase.rpc("exec_sql", { query: sql });
  if (error) {
    console.error("RPC approach failed:", error.message);
    console.log("\nPlease run this SQL manually in the Supabase SQL editor:");
    console.log(sql);
  } else {
    console.log("Table created via RPC:", data);
  }
} else {
  const data = await res.json();
  console.log("Table created:", data);
}

// Verify the table exists by counting rows
const { count, error: countError } = await supabase
  .from("lt_mns_company_pages")
  .select("*", { count: "exact", head: true });

if (countError) {
  console.error("Table does not exist yet:", countError.message);
  console.log("\nPlease run this SQL manually in the Supabase SQL editor:");
  console.log(sql);
} else {
  console.log(`✅ lt_mns_company_pages exists — ${count} rows`);
}
