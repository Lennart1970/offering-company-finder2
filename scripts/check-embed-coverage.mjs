/**
 * Check embedding coverage for specific search runs
 */
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SEARCH_IDS = [1980002, 1980003, 1980004, 1980005, 1980006];

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Get all companies in these runs
const [rows] = await conn.execute(
  `SELECT id, name, searchId FROM companies WHERE searchId IN (${SEARCH_IDS.join(",")})`
);
console.log(`Total companies across 5 runs: ${rows.length}`);

// Build UUID map
const uuidToRow = new Map();
for (const r of rows) {
  uuidToRow.set(uuidv5(`company-${r.id}`, LT_NAMESPACE), r);
}

// Fetch all embeddings for these UUIDs from Supabase (paginated)
const uuids = [...uuidToRow.keys()];
let embedded = new Set();
const PAGE = 500;
for (let i = 0; i < uuids.length; i += PAGE) {
  const batch = uuids.slice(i, i + PAGE);
  const { data } = await supabase
    .from("lt_mns_company_embeddings")
    .select("watchlist_id")
    .in("watchlist_id", batch);
  if (data) data.forEach(d => embedded.add(d.watchlist_id));
}

// Group by searchId
const stats = {};
for (const sid of SEARCH_IDS) stats[sid] = { total: 0, embedded: 0, missing: 0 };

for (const [uuid, row] of uuidToRow) {
  stats[row.searchId].total++;
  if (embedded.has(uuid)) stats[row.searchId].embedded++;
  else stats[row.searchId].missing++;
}

const searchNames = {
  1980002: "Automate show 28_05",
  1980003: "[Niche] [Service] Industrial Sensing & Automation",
  1980004: "[Niche] [Manufacturing] Industrial Vision & Automation",
  1980005: "[Niche] [Manufacturing] Industrial Robotics & Automation",
  1980006: "[Niche] [Manufacturing] Industrial Machinery & Automation",
};

console.log("\nEmbedding coverage per run:");
console.log("─".repeat(80));
for (const sid of SEARCH_IDS) {
  const s = stats[sid];
  const pct = s.total > 0 ? Math.round(s.embedded / s.total * 100) : 0;
  console.log(`Run ${sid} | ${searchNames[sid]}`);
  console.log(`  Total: ${s.total} | Embedded: ${s.embedded} (${pct}%) | Missing: ${s.missing}`);
}
console.log("─".repeat(80));
const totalMissing = Object.values(stats).reduce((a, s) => a + s.missing, 0);
console.log(`Total missing embeddings: ${totalMissing}`);

await conn.end();
