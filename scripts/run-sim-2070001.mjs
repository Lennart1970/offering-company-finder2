/**
 * One-shot script: Run FIT-SIM scoring for Run #2070001
 * Uses campaign mode — scores all companies in searchId=2070001
 * against the Brain assigned to that campaign (falls back to globally-active Brain).
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load env
const dotenv = require("dotenv");
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const SEARCH_ID = 2070001;

async function main() {
  console.log(`[run-sim-2070001] Starting FIT-SIM for Run #${SEARCH_ID}...`);

  // Dynamically import the compiled service (tsx handles TS at runtime)
  const { runBulkSimilarityScoring } = await import("../server/bulkSimilarityService.ts");

  // Look up the campaign's brainId from the DB
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [[search]] = await conn.execute(
    "SELECT id, brainId FROM searches WHERE id = ? LIMIT 1",
    [SEARCH_ID]
  );
  await conn.end();

  if (!search) {
    console.error(`[run-sim-2070001] Search #${SEARCH_ID} not found`);
    process.exit(1);
  }

  const brainId = search.brainId ?? undefined;
  console.log(`[run-sim-2070001] Campaign brainId: ${brainId ?? "(none — will use globally-active Brain)"}`);

  const result = await runBulkSimilarityScoring({
    mode: "campaign",
    searchId: SEARCH_ID,
    brainId,
  });

  console.log(`[run-sim-2070001] Done!`);
  console.log(`  Brain:   ${result.activeBrainName} (id=${result.activeBrainId})`);
  console.log(`  Scored:  ${result.scored}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Range:   ${result.scoreRange.min}–${result.scoreRange.max} (avg ${result.scoreRange.avg})`);
  process.exit(0);
}

main().catch(err => {
  console.error("[run-sim-2070001] Fatal error:", err);
  process.exit(1);
});
