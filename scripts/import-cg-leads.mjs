/**
 * Import CG lead list CSV into TiDB companies table.
 * Matches on: 1) cgSharepointId, 2) domain (normalized), 3) company name (fuzzy)
 * Upserts all CG fields including new contact-level columns.
 *
 * Usage: node scripts/import-cg-leads.mjs /path/to/2040LeadlistDatabase.csv
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");

const CSV_PATH = process.argv[2] || "/home/ubuntu/upload/2040LeadlistDatabase(1).csv";

// Normalize a URL to a bare domain for matching
function normalizeDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase().trim();
  } catch {
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0].trim() || null;
  }
}

// Clean a string — null if empty
function clean(v) {
  if (!v) return null;
  const s = v.trim();
  return s === "" ? null : s;
}

async function main() {
  // --- Parse CSV ---
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = raw.split("\n");
  // Skip first SharePoint XML metadata row, keep from header onwards
  const headerIdx = lines.findIndex(l => l.includes('"Company"') && l.includes('"Website"') && l.includes('"BU"'));
  if (headerIdx === -1) throw new Error("Could not find header row in CSV");
  const csvData = lines.slice(headerIdx).join("\n");

  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  });

  console.log(`=== CG Lead Import ===`);
  console.log(`CSV rows parsed: ${records.length}`);

  // --- Connect to TiDB ---
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Fetch all existing companies: id, domain, cgSharepointId, name
  console.log("\n[1/3] Loading existing companies from TiDB...");
  const [existing] = await conn.execute(
    "SELECT id, name, websiteUrl, cgSharepointId FROM companies"
  );

  // Build lookup maps
  const bySharepointId = new Map();
  const byDomain = new Map();
  const byName = new Map();
  for (const c of existing) {
    if (c.cgSharepointId) bySharepointId.set(c.cgSharepointId, c.id);
    const dom = normalizeDomain(c.websiteUrl);
    if (dom) byDomain.set(dom, c.id);
    if (c.name) byName.set(c.name.toLowerCase().trim(), c.id);
  }

  console.log(`  Existing companies: ${existing.length}`);
  console.log(`  Indexed by SharePoint ID: ${bySharepointId.size}`);
  console.log(`  Indexed by domain: ${byDomain.size}`);

  // --- Process rows ---
  console.log("\n[2/3] Matching and upserting...");
  let matched = 0, inserted = 0, skipped = 0, errors = 0;
  const now = new Date();

  for (const row of records) {
    const sharepointId = clean(row["ID"]);
    const website = clean(row["Website"]);
    const companyName = clean(row["Company"]);
    const domain = normalizeDomain(website);

    // Find matching company
    let companyId = null;
    let matchMethod = null;

    if (sharepointId && bySharepointId.has(sharepointId)) {
      companyId = bySharepointId.get(sharepointId);
      matchMethod = "sharepoint_id";
    } else if (domain && byDomain.has(domain)) {
      companyId = byDomain.get(domain);
      matchMethod = "domain";
    } else if (companyName && byName.has(companyName.toLowerCase().trim())) {
      companyId = byName.get(companyName.toLowerCase().trim());
      matchMethod = "name";
    }

    // Build the CG field payload
    const cgFields = {
      cgBusinessUnit: clean(row["BU"]),
      cgSalesManager: clean(row["SalesManager"]),
      cgLeadClass: clean(row["Class"]),
      cgLeadOrigin: clean(row["Origin"]),
      cgMarket: clean(row["Market"]),
      cgComment: clean(row["Comment"]),
      cgRemarks: clean(row["Remarks"]),
      cgSharepointId: sharepointId,
      cgImportedAt: now,
      // New contact-level fields
      cgParentCompany: clean(row["Parent"]),
      cgContactGender: clean(row["Contact Gender"]),
      cgContactFirstName: clean(row["Contact Name"]),
      cgContactLastName: clean(row["Contact Surname"]),
      cgContactPosition: clean(row["Position"]),
      cgContactPhone: clean(row["Phone"]),
      cgContactEmail: clean(row["Email"]),
      cgHqAddress: clean(row["HQ Address"]),
    };

    if (companyId) {
      // UPDATE existing company
      try {
        const setClauses = Object.keys(cgFields)
          .map(k => `\`${k}\` = ?`)
          .join(", ");
        const values = [...Object.values(cgFields), companyId];
        await conn.execute(
          `UPDATE companies SET ${setClauses} WHERE id = ?`,
          values
        );
        matched++;
        // Update lookup maps with SharePoint ID for future rows
        if (sharepointId) bySharepointId.set(sharepointId, companyId);
      } catch (e) {
        console.error(`  Error updating ${companyName}: ${e.message}`);
        errors++;
      }
    } else {
      // INSERT new company
      if (!companyName) { skipped++; continue; }
      try {
        const cols = ["name", "websiteUrl", "country", "city", ...Object.keys(cgFields)];
        const vals = [
          companyName,
          website,
          clean(row["Country"]),
          clean(row["City"]),
          ...Object.values(cgFields),
        ];
        const placeholders = cols.map(() => "?").join(", ");
        const [result] = await conn.execute(
          `INSERT INTO companies (${cols.map(c => `\`${c}\``).join(", ")}) VALUES (${placeholders})`,
          vals
        );
        inserted++;
        // Index the new company
        if (sharepointId) bySharepointId.set(sharepointId, result.insertId);
        if (domain) byDomain.set(domain, result.insertId);
        byName.set(companyName.toLowerCase().trim(), result.insertId);
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY") {
          skipped++;
        } else {
          console.error(`  Error inserting ${companyName}: ${e.message}`);
          errors++;
        }
      }
    }
  }

  await conn.end();

  console.log("\n[3/3] Summary");
  console.log(`  Total CSV rows:   ${records.length}`);
  console.log(`  Updated (matched): ${matched}`);
  console.log(`  Inserted (new):    ${inserted}`);
  console.log(`  Skipped (dup/empty): ${skipped}`);
  console.log(`  Errors:            ${errors}`);
  console.log(`  Finished: ${new Date().toISOString()}`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
