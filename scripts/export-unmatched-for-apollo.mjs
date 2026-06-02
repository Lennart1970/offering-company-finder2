/**
 * Extracts CG lead list companies that are NOT yet in TiDB
 * and outputs a CSV with name + domain ready for Apollo bulk enrichment.
 *
 * Usage: node scripts/export-unmatched-for-apollo.mjs
 * Output: /tmp/cg-unmatched-for-apollo.csv
 */
import "dotenv/config";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");

const CSV_PATH = "/home/ubuntu/upload/2040LeadlistDatabase(1).csv";
const OUTPUT_PATH = "/tmp/cg-unmatched-for-apollo.csv";

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

async function main() {
  // Parse CSV
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex(l => l.includes('"Company"') && l.includes('"Website"') && l.includes('"BU"'));
  const csvData = lines.slice(headerIdx).join("\n");
  const records = parse(csvData, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true });

  console.log(`CSV rows: ${records.length}`);

  // Load TiDB companies
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [existing] = await conn.execute("SELECT id, name, websiteUrl, cgSharepointId FROM companies");
  await conn.end();

  const bySharepointId = new Set(existing.filter(c => c.cgSharepointId).map(c => c.cgSharepointId));
  const byDomain = new Set(existing.filter(c => c.websiteUrl).map(c => normalizeDomain(c.websiteUrl)).filter(Boolean));
  const byName = new Set(existing.filter(c => c.name).map(c => c.name.toLowerCase().trim()));

  console.log(`TiDB companies: ${existing.length}`);

  // Find unmatched
  const unmatched = [];
  for (const row of records) {
    const sharepointId = clean(row["ID"]);
    const website = clean(row["Website"]);
    const companyName = clean(row["Company"]);
    const domain = normalizeDomain(website);

    const isMatched =
      (sharepointId && bySharepointId.has(sharepointId)) ||
      (domain && byDomain.has(domain)) ||
      (companyName && byName.has(companyName.toLowerCase().trim()));

    if (!isMatched && companyName) {
      unmatched.push({
        company_name: companyName,
        domain: domain || "",
        website: website || "",
        bu: clean(row["BU"]) || "",
        market: clean(row["Market"]) || "",
        country: clean(row["Country"]) || "",
        city: clean(row["City"]) || "",
        sharepoint_id: sharepointId || "",
      });
    }
  }

  console.log(`Unmatched (need Apollo enrichment): ${unmatched.length}`);

  // Write Apollo-ready CSV
  // Apollo bulk enrichment expects: name, domain (or website)
  const header = "name,domain,website,bu,market,country,city,sharepoint_id";
  const csvLines = [header];
  for (const r of unmatched) {
    const escape = v => `"${String(v).replace(/"/g, '""')}"`;
    csvLines.push([
      escape(r.company_name),
      escape(r.domain),
      escape(r.website),
      escape(r.bu),
      escape(r.market),
      escape(r.country),
      escape(r.city),
      escape(r.sharepoint_id),
    ].join(","));
  }

  fs.writeFileSync(OUTPUT_PATH, csvLines.join("\n"), "utf-8");
  console.log(`\nOutput written to: ${OUTPUT_PATH}`);
  console.log(`Ready for Apollo bulk enrichment — ${unmatched.length} companies`);

  // Print a sample
  console.log("\nSample rows:");
  unmatched.slice(0, 5).forEach(r => console.log(`  ${r.company_name} | ${r.domain} | ${r.country}`));
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
