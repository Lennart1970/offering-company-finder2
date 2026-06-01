/**
 * POST /api/excel-import
 *
 * Session-authenticated endpoint for importing companies from an Apollo CSV export.
 *
 * Accepts multipart/form-data with:
 *   - file: .xlsx, .xls, or .csv file (Apollo export format)
 *   - campaignName: string (required)
 *
 * Apollo CSV columns mapped directly to DB — NO Apollo API calls made.
 * Expected Apollo columns (auto-detected, case-insensitive):
 *   Company Name, Website, Industry, # Employees, Company City, Company State,
 *   Company Country, Keywords, Annual Revenue, SIC Codes, Short Description,
 *   Company Linkedin Url, Apollo Account Id, etc.
 *
 * Streams NDJSON progress back to the client.
 */

import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { sdk } from "../_core/sdk";
import { createSearch, createCompanies, getDb, getCompaniesBySearchId } from "../db";
import type { InsertCompany } from "../../drizzle/schema";
import { generateEmbeddings } from "../embeddingService";
import { persistCompanyEmbeddings, scoreCompaniesAgainstAllBrains, aggregateBrainScores } from "../supabaseEmbeddings";

const router = Router();

// Store file in memory (max 100MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "text/plain",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(xlsx|xls|csv)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx, .xls, and .csv files are supported."));
    }
  },
});

// ── Column aliases (case-insensitive) ────────────────────────────────────────
// Each entry: [canonical key, ...aliases]
const COL_MAP: Record<string, string[]> = {
  name:         ["company name", "name", "company", "bedrijf", "exhibitor", "organisation", "organization", "naam"],
  website:      ["website", "url", "web", "domain", "website url", "site", "homepage", "link"],
  industry:     ["industry", "sector", "industrie"],
  employees:    ["# employees", "employees", "headcount", "employee count", "aantal medewerkers"],
  city:         ["company city", "city", "stad"],
  state:        ["company state", "state", "provincie"],
  country:      ["company country", "country", "land"],
  street:       ["company street", "street", "address", "straat"],
  address:      ["company address", "full address", "volledig adres"],
  keywords:     ["keywords", "trefwoorden"],
  revenue:      ["annual revenue", "revenue", "omzet"],
  sicCodes:     ["sic codes", "sic", "sic code"],
  description:  ["short description", "description", "omschrijving", "beschrijving"],
  linkedin:     ["company linkedin url", "linkedin", "linkedin url"],
  twitter:      ["twitter url", "twitter"],
  phone:        ["company phone", "phone", "telefoon"],
  apolloId:     ["apollo account id", "apollo id"],
  lists:        ["lists"],
  logoUrl:      ["logo url", "logo"],
  subsidiaryOf: ["subsidiary of"],
  subsidiaryId: ["subsidiary of (organization id)"],
};

function buildColIndex(headers: string[]): Record<string, number> {
  const lower = headers.map((h) => (h || "").toString().toLowerCase().trim());
  const idx: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    for (const alias of aliases) {
      const col = lower.indexOf(alias);
      if (col !== -1) { idx[key] = col; break; }
    }
  }
  return idx;
}

function cell(row: any[], col: number | undefined): string | null {
  if (col === undefined || col < 0) return null;
  const v = row[col];
  if (v === null || v === undefined || v === "") return null;
  const s = v.toString().trim();
  if (s === "–" || s === "-" || s === "—" || s === "n/a" || s === "N/A") return null;
  return s;
}

function extractDomain(url: string): string | null {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function mapRowToCompany(
  row: any[],
  idx: Record<string, number>,
  searchId: number
): Omit<InsertCompany, "id" | "createdAt"> {
  const websiteRaw = cell(row, idx.website);
  const primaryDomain = websiteRaw ? extractDomain(websiteRaw) : null;

  const sicRaw = cell(row, idx.sicCodes);
  const sicCodes = sicRaw
    ? sicRaw.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const employeeRaw = cell(row, idx.employees);
  const employeeCount = employeeRaw ? parseInt(employeeRaw.replace(/[^0-9]/g, "")) || null : null;

  const sliceMetadata = {
    employeeCount,
    industry: cell(row, idx.industry),
    keywords: cell(row, idx.keywords),
    description: cell(row, idx.description),
    lists: cell(row, idx.lists),
    logoUrl: cell(row, idx.logoUrl),
  };

  const stateVal = cell(row, idx.state);
  const countryVal = cell(row, idx.country);

  return {
    searchId,
    apolloId: cell(row, idx.apolloId),
    name: cell(row, idx.name) || "Unknown",
    websiteUrl: websiteRaw,
    primaryDomain,
    linkedinUrl: cell(row, idx.linkedin),
    twitterUrl: cell(row, idx.twitter),
    facebookUrl: null,
    phone: cell(row, idx.phone),
    foundedYear: null,
    revenue: cell(row, idx.revenue),
    headcountGrowth: null,
    parentCompanyName: cell(row, idx.subsidiaryOf),
    parentCompanyId: cell(row, idx.subsidiaryId),
    searchLocation: stateVal || countryVal || null,
    city: cell(row, idx.city),
    state: stateVal,
    country: countryVal,
    streetAddress: cell(row, idx.street),
    rawAddress: cell(row, idx.address),
    sicCodes: JSON.stringify(sicCodes),
    naicsCodes: null,
    sliceMetadata: JSON.stringify(sliceMetadata),
    urgencyScore: null,
    briefData: null,
    briefGeneratedAt: null,
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    // Apollo CSV exports already contain enriched data (revenue, SIC codes, description,
    // employees, etc.) — mark as enriched immediately so the scoring pipeline
    // can process these companies without a separate Apollo API enrichment step.
    enrichmentStatus: "enriched",
  };
}

router.post("/", upload.single("file"), async (req: any, res: any) => {
  // Authenticate via session cookie
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Send a .xlsx, .xls, or .csv file as 'file' field." });
  }

  const campaignName = (req.body?.campaignName || "").toString().trim();
  if (!campaignName) {
    return res.status(400).json({ error: "campaignName is required." });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const send = (obj: object) => {
    try { res.write(JSON.stringify(obj) + "\n"); } catch { /* client disconnected */ }
  };

  try {
    send({ status: "parsing", message: "Parsing file..." });

    // Parse workbook
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (rows.length < 2) {
      send({ error: "File appears empty or has no data rows." });
      return res.end();
    }

    const headers = rows[0] as string[];
    const idx = buildColIndex(headers);

    if (idx.name === undefined) {
      send({
        error: `Could not find a company name column. Expected one of: Company Name, Name, Company, Bedrijf. Found headers: ${headers.join(", ")}`,
      });
      return res.end();
    }

    // Detect if this is an Apollo export
    const isApolloExport = idx.apolloId !== undefined || idx.industry !== undefined || idx.sicCodes !== undefined;

    // Parse all data rows
    const companyRows: Omit<InsertCompany, "id" | "createdAt">[] = [];
    let skipped = 0;

    // Create campaign record first
    const searchId = await createSearch({
      userId: user.id,
      companyWebsite: "",
      location: "Excel Import",
      offeringName: campaignName,
      offeringDescription: `Direct import: ${rows.length - 1} rows from "${req.file.originalname}"`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: JSON.stringify(["excel-import"]),
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: 0,
      codesTotal: rows.length - 1,
      status: "searching",
    });

    send({ status: "campaign_created", searchId, message: `Campaign created (id=${searchId})` });

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = cell(row, idx.name);
      if (!name) { skipped++; continue; }
      companyRows.push(mapRowToCompany(row, idx, searchId));
    }

    send({
      status: "parsed",
      total: companyRows.length,
      skipped,
      isApolloExport,
      message: `Parsed ${companyRows.length} companies${isApolloExport ? " (Apollo export detected — direct import, no API calls)" : ""}`,
    });

    // Bulk insert in batches of 200
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
      inserted += Math.min(BATCH, companyRows.length - i);
      send({
        status: "progress",
        done: inserted,
        total: companyRows.length,
        message: `Saved ${inserted} / ${companyRows.length} companies...`,
      });
    }

    // Mark campaign as completed
    const db = await getDb();
    if (db) {
      const { searches } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(searches)
        .set({ status: "completed", codesSearched: companyRows.length })
        .where(eq(searches.id, searchId));
    }

    send({
      status: "done",
      searchId,
      total: companyRows.length,
      skipped,
      isApolloExport,
      message: `Import complete. ${companyRows.length} companies saved directly from file — no Apollo API calls used.`,
    });

    // ── Background: embed companies + score against all Brains ────────────────
    // Fire-and-forget — does not block the NDJSON response
    setImmediate(async () => {
      try {
        console.log(`[ExcelImport] Starting background embedding+scoring for search ${searchId}`);
        const allCompanies = await getCompaniesBySearchId(searchId);
        if (allCompanies.length === 0) return;

        // 1. Generate embeddings for all companies
        const embeddings = await generateEmbeddings(allCompanies);

        // 2. Persist embeddings to Supabase lt_mns_company_embeddings
        await persistCompanyEmbeddings(embeddings);

        // 3. Score each company against all Brain embeddings
        const brainScores = await scoreCompaniesAgainstAllBrains(embeddings);
        const scoreMap = aggregateBrainScores(brainScores);

        // 4. Write best Brain score back to companies.fitScore in MySQL
        const dbConn = await getDb();
        if (dbConn && scoreMap.size > 0) {
          const { companies: companiesTable } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          for (const [companyId, { bestScore, bestBrainId, allScores }] of Array.from(scoreMap.entries())) {
            await dbConn
              .update(companiesTable)
              .set({
                fitScore: bestScore,
                fitScoreData: JSON.stringify({ brainScores: allScores, bestBrainId, method: "cosine-similarity" }),
              })
              .where(eq(companiesTable.id, companyId));
          }
          console.log(`[ExcelImport] Brain scores written for ${scoreMap.size} companies (search ${searchId})`);
        }
      } catch (bgErr: any) {
        console.error(`[ExcelImport] Background embedding/scoring error for search ${searchId}:`, bgErr.message);
      }
    });

  } catch (err: any) {
    console.error("[Excel Import] Fatal error:", err.message);
    send({ error: err.message });
  }

  res.end();
});

export default router;
