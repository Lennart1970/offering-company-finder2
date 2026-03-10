/**
 * POST /api/excel-import
 *
 * Session-authenticated endpoint for importing companies from an Excel/CSV file.
 *
 * Accepts multipart/form-data with:
 *   - file: .xlsx, .xls, or .csv file
 *   - campaignName: string (required)
 *
 * Expected columns (case-insensitive, flexible names):
 *   - Company Name / Name / Company / Bedrijf / Exhibitor
 *   - Website / URL / Web / Domain / Website URL
 *
 * Enrichment strategy:
 *   1. If website URL present → extract domain → apolloEnrichByDomain
 *   2. Fallback → apolloEnrichByName (name only, no country hint from Excel)
 *
 * Streams NDJSON progress back to the client.
 */

import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { sdk } from "../_core/sdk";
import { createSearch, createCompanies, getDb } from "../db";

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

// Column name aliases for flexible header detection
const NAME_ALIASES = ["company name", "name", "company", "bedrijf", "exhibitor", "organisation", "organization", "naam"];
const WEBSITE_ALIASES = ["website", "url", "web", "domain", "website url", "site", "homepage", "link"];

function detectColumns(headers: string[]): { nameCol: number; websiteCol: number } {
  const lower = headers.map((h) => (h || "").toString().toLowerCase().trim());
  const nameCol = lower.findIndex((h) => NAME_ALIASES.includes(h));
  const websiteCol = lower.findIndex((h) => WEBSITE_ALIASES.includes(h));
  return { nameCol, websiteCol };
}

function cleanWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toString().trim();
  // Treat placeholder dashes as empty
  if (s === "–" || s === "-" || s === "—" || s === "n/a" || s === "N/A" || s === "") return null;
  // Add protocol if missing
  if (!s.startsWith("http")) return `https://${s}`;
  return s;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
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
    const { apolloEnrichByDomain, apolloEnrichByName } = await import("../conferenceScraper");

    // Parse the workbook from buffer
    send({ status: "parsing", message: "Parsing file..." });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (rows.length < 2) {
      send({ error: "File appears empty or has no data rows." });
      return res.end();
    }

    const headers = rows[0] as string[];
    const { nameCol, websiteCol } = detectColumns(headers);

    if (nameCol === -1) {
      send({
        error: `Could not find a company name column. Expected one of: ${NAME_ALIASES.slice(0, 5).join(", ")}. Found headers: ${headers.join(", ")}`,
      });
      return res.end();
    }

    // Parse rows into exhibitors
    const exhibitors: { name: string; websiteUrl: string | null }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = (row[nameCol] || "").toString().trim();
      if (!name) continue;
      const rawWebsite = websiteCol >= 0 ? row[websiteCol] : null;
      const websiteUrl = cleanWebsite(rawWebsite);
      exhibitors.push({ name, websiteUrl });
    }

    if (exhibitors.length === 0) {
      send({ error: "No valid company rows found in the file." });
      return res.end();
    }

    send({
      status: "parsed",
      total: exhibitors.length,
      hasWebsite: exhibitors.filter((e) => e.websiteUrl).length,
      nameOnly: exhibitors.filter((e) => !e.websiteUrl).length,
      message: `Parsed ${exhibitors.length} companies from "${sheetName}"`,
    });

    // Create campaign record
    const searchId = await createSearch({
      userId: user.id,
      companyWebsite: "",
      location: "Excel Import",
      offeringName: campaignName,
      offeringDescription: `Excel import: ${exhibitors.length} companies from "${req.file.originalname}"`,
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
      codesTotal: exhibitors.length,
      status: "searching",
    });

    send({ status: "campaign_created", searchId, message: `Campaign created (id=${searchId})` });

    // Enrich each company
    let enriched = 0;
    let notFound = 0;
    let failed = 0;
    const companyRows: any[] = [];

    for (let i = 0; i < exhibitors.length; i++) {
      const exhibitor = exhibitors[i];
      try {
        let domain: string | null = null;
        if (exhibitor.websiteUrl) {
          domain = extractDomain(exhibitor.websiteUrl);
        }

        let apolloData = null;
        if (domain) {
          apolloData = await apolloEnrichByDomain(domain);
        }

        // Fallback: name-based search when no domain or domain not found
        if (!apolloData) {
          apolloData = await apolloEnrichByName(exhibitor.name, null);
        }

        const enrichMethod = apolloData ? (domain && apolloData ? "domain" : "name") : null;

        if (apolloData) {
          enriched++;
          companyRows.push({
            searchId,
            apolloId: apolloData.apolloId || null,
            name: apolloData.name || exhibitor.name,
            websiteUrl: apolloData.websiteUrl || exhibitor.websiteUrl,
            primaryDomain: apolloData.primaryDomain || domain,
            linkedinUrl: apolloData.linkedinUrl || null,
            phone: apolloData.phone || null,
            foundedYear: apolloData.foundedYear || null,
            revenue: apolloData.revenue || null,
            headcountGrowth: apolloData.headcountGrowth || null,
            sicCodes: apolloData.sicCodes?.length ? JSON.stringify(apolloData.sicCodes) : null,
            naicsCodes: apolloData.naicsCodes?.length ? JSON.stringify(apolloData.naicsCodes) : null,
            city: apolloData.city || null,
            state: apolloData.state || null,
            country: apolloData.country || null,
            streetAddress: apolloData.streetAddress || null,
            searchLocation: "Excel Import",
            enrichmentStatus: "enriched",
          });
        } else {
          notFound++;
          companyRows.push({
            searchId,
            apolloId: null,
            name: exhibitor.name,
            websiteUrl: exhibitor.websiteUrl || null,
            primaryDomain: domain,
            searchLocation: "Excel Import",
            enrichmentStatus: "pending",
          });
        }

        send({
          status: "progress",
          done: i + 1,
          total: exhibitors.length,
          enriched,
          notFound,
          failed,
          company: exhibitor.name,
          apolloFound: apolloData !== null,
          enrichMethod,
        });
      } catch (err: any) {
        failed++;
        companyRows.push({
          searchId,
          apolloId: null,
          name: exhibitor.name,
          websiteUrl: exhibitor.websiteUrl || null,
          searchLocation: "Excel Import",
          enrichmentStatus: "failed",
        });
        send({
          status: "progress",
          done: i + 1,
          total: exhibitors.length,
          enriched,
          notFound,
          failed,
          company: exhibitor.name,
          apolloFound: false,
          error: err.message,
        });
      }

      // Small delay between companies to avoid Apollo rate limits
      if (i < exhibitors.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    // Bulk insert all company rows
    const BATCH = 200;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
    }

    // Mark campaign as completed
    const db = await getDb();
    if (db) {
      const { searches } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(searches)
        .set({ status: "completed", codesSearched: exhibitors.length })
        .where(eq(searches.id, searchId));
    }

    send({
      status: "done",
      searchId,
      total: exhibitors.length,
      enriched,
      notFound,
      failed,
      message: `Import complete. ${enriched} enriched via Apollo, ${notFound} not found (basic info saved), ${failed} failed.`,
    });
  } catch (err: any) {
    console.error("[Excel Import] Fatal error:", err.message);
    send({ error: err.message });
  }

  res.end();
});

export default router;
