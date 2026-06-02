/**
 * Reformats the unmatched CG companies into Apollo's bulk import template:
 * Account Name, Account Stage, Account Website
 */
import "dotenv/config";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");

const CSV_PATH = "/home/ubuntu/upload/2040LeadlistDatabase(1).csv";
const OUTPUT_PATH = "/home/ubuntu/cg-for-apollo.csv";

function normalizeDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase().trim();
  } catch {
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0].trim() || null;
  }
}

function clean(v) {
  if (!v) return null;
  const s = v.trim();
  return s === "" ? null : s;
}

function escape(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

async function main() {
  // Parse CG CSV
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex(l => l.includes('"Company"') && l.includes('"Website"') && l.includes('"BU"'));
  const csvData = lines.slice(headerIdx).join("\n");
  const records = parse(csvData, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });

  console.log(`CSV rows: ${records.length}`);

  // Load TiDB to find already-matched companies
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [existing] = await conn.execute("SELECT id, name, websiteUrl, cgSharepointId FROM companies");
  await conn.end();

  const bySharepointId = new Set(existing.filter(c => c.cgSharepointId).map(c => c.cgSharepointId));
  const byDomain = new Set(existing.filter(c => c.websiteUrl).map(c => normalizeDomain(c.websiteUrl)).filter(Boolean));
  const byName = new Set(existing.filter(c => c.name).map(c => c.name.toLowerCase().trim()));

  // Build Apollo-format output — only unmatched companies
  const csvLines = ["Account Name,Account Stage,Account Website"];
  let unmatched = 0, matched = 0;

  for (const row of records) {
    const sharepointId = clean(row["ID"]);
    const website = clean(row["Website"]);
    const companyName = clean(row["Company"]);
    const domain = normalizeDomain(website);

    const isMatched =
      (sharepointId && bySharepointId.has(sharepointId)) ||
      (domain && byDomain.has(domain)) ||
      (companyName && byName.has(companyName?.toLowerCase().trim()));

    if (isMatched) { matched++; continue; }
    if (!companyName) continue;

    // Use bare domain for Apollo (no protocol, no www)
    const apolloWebsite = domain || (website ? website.replace(/^https?:\/\/(www\.)?/, "") : "");

    csvLines.push(`${escape(companyName)},Cold,${escape(apolloWebsite)}`);
    unmatched++;
  }

  fs.writeFileSync(OUTPUT_PATH, csvLines.join("\n"), "utf-8");

  console.log(`\nResults:`);
  console.log(`  Already in TiDB (skipped): ${matched}`);
  console.log(`  Exported for Apollo:       ${unmatched}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
