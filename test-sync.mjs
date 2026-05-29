import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

// Load env from .env file if it exists
try { dotenv.config(); } catch {}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("SUPABASE_URL set:", !!url, url ? url.substring(0, 30) + "..." : "(empty)");
console.log("SUPABASE_KEY set:", !!key);

if (!url || !key) {
  console.error("ERROR: Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(url, key);

// Test: count rows in lt_mns_company_pages
const { data, error, count } = await supabase
  .from("lt_mns_company_pages")
  .select("id", { count: "exact", head: true });

if (error) {
  console.error("ERROR querying lt_mns_company_pages:", error.message, error.code);
} else {
  console.log("lt_mns_company_pages row count:", count);
}

// Test: count rows in lt_mns_companies
const { data: d2, error: e2, count: c2 } = await supabase
  .from("lt_mns_companies")
  .select("id", { count: "exact", head: true });

if (e2) {
  console.error("ERROR querying lt_mns_companies:", e2.message, e2.code);
} else {
  console.log("lt_mns_companies row count:", c2);
}

// Test upsert with a single dummy row to check schema
const testRow = {
  id: "00000000-0000-0000-0000-000000000001",
  company_id: "00000000-0000-0000-0000-000000000002",
  company_name: "TEST COMPANY - DELETE ME",
  domain: "test-delete-me.com",
  campaign_id: 99999,
  campaign_name: "TEST",
  urgency_score: 0,
  fit_score: 0,
  urgency_label: "LOW",
  fit_label: null,
  page_url: "/company/99999",
  synced_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

console.log("\nTesting upsert with row:", JSON.stringify(testRow, null, 2));

const { error: upsertErr } = await supabase
  .from("lt_mns_company_pages")
  .upsert([testRow], { onConflict: "id" });

if (upsertErr) {
  console.error("UPSERT ERROR:", upsertErr.message, upsertErr.code, upsertErr.details);
} else {
  console.log("UPSERT SUCCESS — deleting test row...");
  await supabase.from("lt_mns_company_pages").delete().eq("id", testRow.id);
  console.log("Test row deleted.");
}
