/**
 * Full CG lead import using Apollo enrichment data.
 *
 * Two passes:
 *   Pass 1 — INSERT new companies from Apollo export (with Apollo ID + firmographics + CG metadata)
 *   Pass 2 — UPDATE already-matched companies with new CG contact fields
 *
 * Usage: node scripts/import-cg-apollo.mjs
 */
import "dotenv/config";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");

const CG_CSV   = "/home/ubuntu/upload/2040LeadlistDatabase(1).csv";
const APO_CSV  = "/home/ubuntu/upload/apollo-accounts-export(42).csv";
const CG_SEARCH_ID = 2040001; // Dedicated 'CG Lead Import' search anchor row (userId=1)

// ── helpers ──────────────────────────────────────────────────────────────────

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
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toInt(v) {
  const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function toFloat(v) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

// Format revenue as a string range like Apollo uses (e.g. "1000000")
function revenueStr(v) {
  const n = toFloat(v);
  if (!n) return null;
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(n);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Parse CG CSV
  const cgRaw = fs.readFileSync(CG_CSV, "utf-8");
  const cgLines = cgRaw.split("\n");
  const hIdx = cgLines.findIndex(l => l.includes('"Company"') && l.includes('"Website"') && l.includes('"BU"'));
  const cgRecords = parse(cgLines.slice(hIdx).join("\n"), {
    columns: true, skip_empty_lines: true, relax_quotes: true, trim: true,
  });

  // Build CG lookup by domain and name
  const cgByDomain = new Map();
  const cgByName   = new Map();
  for (const r of cgRecords) {
    const dom = normalizeDomain(clean(r["Website"]));
    const name = clean(r["Company"])?.toLowerCase().trim();
    if (dom)  cgByDomain.set(dom, r);
    if (name) cgByName.set(name, r);
  }
  console.log(`CG records: ${cgRecords.length}`);

  // 2. Parse Apollo export
  const apoRecords = parse(fs.readFileSync(APO_CSV, "utf-8"), {
    columns: true, skip_empty_lines: true, relax_quotes: true, trim: true,
  });
  console.log(`Apollo records: ${apoRecords.length}`);

  // 3. Connect to TiDB
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Load existing companies for dedup
  const [existing] = await conn.execute(
    "SELECT id, name, websiteUrl, searchId, cgSharepointId FROM companies"
  );
  const bySearchId  = new Map(existing.filter(c => c.searchId).map(c => [c.searchId, c.id]));
  const byDomain    = new Map(existing.filter(c => c.websiteUrl).map(c => [normalizeDomain(c.websiteUrl), c.id]));
  const byName      = new Map(existing.filter(c => c.name).map(c => [c.name.toLowerCase().trim(), c.id]));
  const bySPId      = new Map(existing.filter(c => c.cgSharepointId).map(c => [c.cgSharepointId, c.id]));

  console.log(`\nExisting TiDB companies: ${existing.length}`);

  // ── PASS 1: Insert new companies from Apollo export ───────────────────────
  console.log("\n[Pass 1] Inserting new companies from Apollo export...");
  let inserted = 0, alreadyExists = 0, insertErrors = 0;
  const now = new Date();

  for (const apo of apoRecords) {
    const apolloId  = clean(apo["Apollo Account Id"]);
    const website   = clean(apo["Website"]);
    const apoName   = clean(apo["Company Name"]);
    const domain    = normalizeDomain(website);

    // Skip if already in TiDB
    if (apolloId && bySearchId.has(apolloId)) { alreadyExists++; continue; }
    if (domain   && byDomain.has(domain))     { alreadyExists++; continue; }
    if (apoName  && byName.has(apoName.toLowerCase().trim())) { alreadyExists++; continue; }

    // Find matching CG row for metadata
    const cgRow = (domain && cgByDomain.get(domain))
               || (apoName && cgByName.get(apoName.toLowerCase().trim()))
               || null;

    const employeeCount = toInt(apo["# Employees"]);
    const revenue       = revenueStr(apo["Annual Revenue"]);

    // Build sliceMetadata (same shape as Apollo import pipeline)
    const sliceMeta = {
      industry:      clean(apo["Industry"]),
      description:   clean(apo["Short Description"])?.slice(0, 500),
      employeeBand:  employeeCount ? `${employeeCount}` : null,
      linkedinUrl:   clean(apo["Company Linkedin Url"]),
      logoUrl:       clean(apo["Logo Url"]),
      keywords:      clean(apo["Keywords"])?.slice(0, 500),
    };

    try {
      await conn.execute(
        `INSERT INTO companies (
          name, websiteUrl, searchId, apolloId,
          sector, country, city, state, streetAddress,
          linkedinUrl, twitterUrl, phone, revenue,
          sliceMetadata,
          cgBusinessUnit, cgSalesManager, cgLeadClass, cgLeadOrigin,
          cgMarket, cgComment, cgRemarks, cgSharepointId, cgImportedAt,
          cgParentCompany, cgContactGender, cgContactFirstName, cgContactLastName,
          cgContactPosition, cgContactPhone, cgContactEmail, cgHqAddress
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          apoName,                           // name
          website,                           // websiteUrl
          CG_SEARCH_ID,                      // searchId
          apolloId,                          // apolloId
          clean(apo["Industry"]),            // sector
          clean(apo["Company Country"]),     // country
          clean(apo["Company City"]),        // city
          clean(apo["Company State"]),       // state
          clean(apo["Company Address"]),     // streetAddress
          clean(apo["Company Linkedin Url"]),// linkedinUrl
          clean(apo["Twitter Url"]),         // twitterUrl
          clean(apo["Company Phone"]),       // phone
          revenue,                           // revenue
          JSON.stringify(sliceMeta),         // sliceMetadata
          // CG fields
          cgRow ? clean(cgRow["BU"])       : null,
          cgRow ? clean(cgRow["SalesManager"]) : null,
          cgRow ? clean(cgRow["Class"])    : null,
          cgRow ? clean(cgRow["Origin"])   : null,
          cgRow ? clean(cgRow["Market"])   : null,
          cgRow ? clean(cgRow["Comment"])  : null,
          cgRow ? clean(cgRow["Remarks"])  : null,
          cgRow ? clean(cgRow["ID"])       : null,
          cgRow ? now : null,
          cgRow ? clean(cgRow["Parent"])   : null,
          cgRow ? clean(cgRow["Contact Gender"]) : null,
          cgRow ? clean(cgRow["Contact Name"])   : null,
          cgRow ? clean(cgRow["Contact Surname"]) : null,
          cgRow ? clean(cgRow["Position"]) : null,
          cgRow ? clean(cgRow["Phone"])    : null,
          cgRow ? clean(cgRow["Email"])    : null,
          cgRow ? clean(cgRow["HQ Address"]) : null,
        ]
      );
      inserted++;
      if (apolloId) bySearchId.set(apolloId, true);
      if (domain)   byDomain.set(domain, true);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") { alreadyExists++; }
      else { console.error(`  Insert error ${apoName}: ${e.message}`); insertErrors++; }
    }
  }

  console.log(`  Inserted: ${inserted} | Already existed: ${alreadyExists} | Errors: ${insertErrors}`);

  // ── PASS 2: Update already-matched companies with new CG contact fields ───
  console.log("\n[Pass 2] Updating matched companies with CG contact fields...");
  let updated = 0, updateErrors = 0;

  for (const cgRow of cgRecords) {
    const sharepointId = clean(cgRow["ID"]);
    const website      = clean(cgRow["Website"]);
    const cgName       = clean(cgRow["Company"]);
    const domain       = normalizeDomain(website);

    let companyId = null;
    if (sharepointId && bySPId.has(sharepointId))          companyId = bySPId.get(sharepointId);
    else if (domain  && byDomain.has(domain))              companyId = byDomain.get(domain);
    else if (cgName  && byName.has(cgName.toLowerCase()))  companyId = byName.get(cgName.toLowerCase());

    if (!companyId || typeof companyId !== "number") continue;

    try {
      await conn.execute(
        `UPDATE companies SET
          cgBusinessUnit=?, cgSalesManager=?, cgLeadClass=?, cgLeadOrigin=?,
          cgMarket=?, cgComment=?, cgRemarks=?, cgSharepointId=?, cgImportedAt=?,
          cgParentCompany=?, cgContactGender=?, cgContactFirstName=?, cgContactLastName=?,
          cgContactPosition=?, cgContactPhone=?, cgContactEmail=?, cgHqAddress=?
        WHERE id=?`,
        [
          clean(cgRow["BU"]),
          clean(cgRow["SalesManager"]),
          clean(cgRow["Class"]),
          clean(cgRow["Origin"]),
          clean(cgRow["Market"]),
          clean(cgRow["Comment"]),
          clean(cgRow["Remarks"]),
          sharepointId,
          now,
          clean(cgRow["Parent"]),
          clean(cgRow["Contact Gender"]),
          clean(cgRow["Contact Name"]),
          clean(cgRow["Contact Surname"]),
          clean(cgRow["Position"]),
          clean(cgRow["Phone"]),
          clean(cgRow["Email"]),
          clean(cgRow["HQ Address"]),
          companyId,
        ]
      );
      updated++;
    } catch (e) {
      console.error(`  Update error ${cgName}: ${e.message}`);
      updateErrors++;
    }
  }

  console.log(`  Updated: ${updated} | Errors: ${updateErrors}`);

  await conn.end();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== Final Summary ===");
  console.log(`  New companies inserted (Apollo+CG): ${inserted}`);
  console.log(`  Existing companies updated (CG):    ${updated}`);
  console.log(`  Total CG leads processed:           ${cgRecords.length}`);
  console.log(`  Finished: ${new Date().toISOString()}`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
