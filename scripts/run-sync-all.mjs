/**
 * Run syncAllCompaniesToSupabase using the production server-side function.
 * This uses the exact same column mapping as the app.
 *
 * Run: node --loader ts-node/esm scripts/run-sync-all.mjs
 * Or:  npx tsx scripts/run-sync-all.mjs
 */
import "dotenv/config";
import { syncAllCompaniesToSupabase, getCompaniesTableSyncStats } from "../server/supabaseSync.ts";
import { getDb } from "../server/db.ts";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Pre-flight: count TiDB companies
  const { count: countResult } = await import("drizzle-orm");
  const { companies } = await import("../drizzle/schema.ts");
  const [{ total }] = await db.select({ total: countResult() }).from(companies);
  console.log(`TiDB companies: ${total}`);

  // Pre-flight: count Supabase companies
  const stats = await getCompaniesTableSyncStats();
  console.log(`Supabase lt_mns_companies: ${stats.count}`);
  console.log(`Last synced: ${stats.lastSyncedAt ?? "never"}`);
  console.log(`\nStarting full sync...`);

  const start = Date.now();
  const result = await syncAllCompaniesToSupabase();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   ${result.message}`);
  if (result.errors > 0) {
    console.warn(`   ⚠️  ${result.errors} errors — check server logs for details`);
  }

  // Post-flight count
  const statsAfter = await getCompaniesTableSyncStats();
  console.log(`\nSupabase lt_mns_companies after sync: ${statsAfter.count}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
