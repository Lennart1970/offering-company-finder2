/**
 * Import SharePoint lead list from Excel or CSV into MySQL lt_mns_cg_leads.
 *
 * Usage:
 *   SHAREPOINT_LEADS_BASE_URL="https://yourorg.sharepoint.com/.../DispForm.aspx?ID=" \
 *   node scripts/import-sharepoint-leads.mjs /path/to/leads.xlsx
 *
 * CSV with a LinkToItem column (full SharePoint URLs) does not need --base-url.
 *
 * Options:
 *   --table     MySQL table name (default: lt_mns_cg_leads)
 *   --sheet     Sheet index (default: 0)
 *   --base-url  Overrides SHAREPOINT_LEADS_BASE_URL env var
 */
import "dotenv/config";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");
const XLSX = require("xlsx");

function extractDomain(url) {
  if (!url) return null;
  let s = String(url).trim().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const domain = s.split("/")[0].split(":")[0].trim();
  return domain ? domain.toLowerCase() : null;
}

/** Take first http(s) URL from messy multi-line / spaced cells. */
function firstWebsite(raw) {
  if (!raw) return null;
  const text = String(raw).replace(/\s+/g, " ").trim();
  const match = text.match(/https?:\/\/[^\s;,"]+/i) || text.match(/(?:^|\s)((?:www\.)?[a-z0-9][-a-z0-9.]+\.[a-z]{2,})/i);
  if (!match) return text || null;
  const url = (match[1] ?? match[0]).trim().replace(/\s+/g, "");
  return url.startsWith("http") ? url : `https://${url}`;
}

function findCol(headers, ...candidates) {
  const lower = headers.map(h => (h ? String(h).toLowerCase().trim() : ""));
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return null;
}

function parseDelimitedFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const firstLine = raw.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    // Simple split — good enough for our export (no embedded semicolons in values except quoted)
    const parts = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === delimiter && !inQuotes) { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.map(p => p.trim().replace(/^"|"$/g, ""));
  });
  return { headers, rows };
}

function loadSheetData(filePath, sheetIndex) {
  const ext = filePath.toLowerCase();
  if (ext.endsWith(".csv") || ext.endsWith(".txt")) {
    const { headers, rows } = parseDelimitedFile(filePath);
    return { headers, data: rows };
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[sheetIndex] ?? wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  return { headers: data[0] || [], data: data.slice(1) };
}

function parseArgs(argv) {
  const args = { table: "lt_mns_cg_leads", sheet: 0, baseUrl: null, excelFile: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--table") args.table = argv[++i];
    else if (argv[i] === "--sheet") args.sheet = parseInt(argv[++i], 10);
    else if (argv[i] === "--base-url") args.baseUrl = argv[++i];
    else if (!argv[i].startsWith("--")) args.excelFile = argv[i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args.baseUrl || process.env.SHAREPOINT_LEADS_BASE_URL || "";
  const dbUrl = process.env.DATABASE_URL || "";

  if (!args.excelFile) {
    console.error("Usage: node scripts/import-sharepoint-leads.mjs [--base-url URL] [--table NAME] [--sheet N] file.xlsx|file.csv");
    process.exit(1);
  }
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }
  if (!fs.existsSync(args.excelFile)) {
    console.error(`ERROR: File not found: ${args.excelFile}`);
    process.exit(1);
  }

  const { headers, data } = loadSheetData(args.excelFile, args.sheet);

  const colCompany = findCol(headers, "company", "company name", "naam", "bedrijf");
  const colWebsite = findCol(headers, "website", "url", "web", "site");
  const colId = findCol(headers, "id", "item id", "sharepoint id");
  const colLink = findCol(headers, "linktoitem", "link to item", "sharepoint url", "crm url", "crm link");

  if (colCompany === null) {
    console.error(`ERROR: No Company column. Headers: ${JSON.stringify(headers)}`);
    process.exit(1);
  }
  if (colId === null) {
    console.error(`ERROR: No ID column. Headers: ${JSON.stringify(headers)}`);
    process.exit(1);
  }
  if (!baseUrl && colLink === null) {
    console.error("ERROR: Set SHAREPOINT_LEADS_BASE_URL, pass --base-url, or include a LinkToItem column");
    process.exit(1);
  }

  const rows = [];
  let skipped = 0;

  for (const row of data) {
    if (!row) continue;
    const company = row[colCompany];
    const idVal = row[colId];
    const website = colWebsite !== null ? row[colWebsite] : null;
    const linkRaw = colLink !== null ? row[colLink] : null;

    if (!company || idVal == null || idVal === "") {
      skipped++;
      continue;
    }
    const idInt = parseInt(String(idVal), 10);
    if (Number.isNaN(idInt)) {
      skipped++;
      continue;
    }

    const websiteStr = firstWebsite(website);
    let sharepointUrl = linkRaw ? String(linkRaw).trim() : null;
    if (!sharepointUrl && baseUrl) {
      sharepointUrl = baseUrl.includes("=")
        ? `${baseUrl.replace(/=+$/, "")}=${idInt}`
        : `${baseUrl}${idInt}`;
    }
    if (!sharepointUrl) {
      skipped++;
      continue;
    }

    rows.push([idInt, String(company).trim(), websiteStr, extractDomain(websiteStr), sharepointUrl]);
  }

  console.log(`Loaded ${rows.length} rows (${skipped} skipped)`);

  const conn = await mysql.createConnection(dbUrl);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`${args.table}\` (
      id INT PRIMARY KEY,
      company_name TEXT NOT NULL,
      website TEXT,
      domain TEXT,
      sharepoint_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const insertSql =
    `INSERT INTO \`${args.table}\` (id, company_name, website, domain, sharepoint_url) ` +
    `VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ` +
    `company_name=VALUES(company_name), website=VALUES(website), ` +
    `domain=VALUES(domain), sharepoint_url=VALUES(sharepoint_url)`;

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    for (const row of batch) {
      await conn.execute(insertSql, row);
    }
    console.log(`  Inserted ${Math.min(i + 500, rows.length)}/${rows.length}...`);
  }

  await conn.end();
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
