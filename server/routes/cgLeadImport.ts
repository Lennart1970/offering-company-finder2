/**
 * POST /api/cg-lead-import
 *
 * Session-authenticated endpoint for importing the Connect Group SharePoint lead list.
 *
 * Accepts multipart/form-data with:
 *   - file: .csv file (SharePoint export with XML schema row at line 1)
 *
 * Dedup logic:
 *   1. Match on normalised website domain → update CG fields on existing row
 *   2. If no domain match, match on exact company name → update CG fields
 *   3. If no match → insert new row (linked to a dedicated "CG Lead List" search campaign)
 *
 * Contact import: rows with a Contact Name/Email are upserted to the contacts table.
 *
 * Streams NDJSON progress back to the client.
 */

import { Router } from "express";
import multer from "multer";
import { sdk } from "../_core/sdk";
import { createSearch, getDb } from "../db";
import { companies, contacts } from "../../drizzle/schema";
import { eq, or, and, isNotNull } from "drizzle-orm";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.csv$/i) || file.mimetype.includes("csv") || file.mimetype.includes("text")) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are supported."));
    }
  },
});

// ── Country normalisation ────────────────────────────────────────────────────
const ISO2_TO_COUNTRY: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CH: "Switzerland",
  CZ: "Czech Republic", DE: "Germany", DK: "Denmark", ES: "Spain",
  FR: "France", GB: "United Kingdom", GE: "Georgia", HR: "Croatia",
  HU: "Hungary", IT: "Italy", MX: "Mexico", NL: "Netherlands",
  PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SK: "Slovakia", US: "United States", CN: "China",
};

// Also handle common variants
const COUNTRY_VARIANTS: Record<string, string> = {
  "czechia": "Czech Republic", "czech rep": "Czech Republic",
  "be": "Belgium", "de": "Germany", "nl": "Netherlands",
  "fr": "France", "ch": "Switzerland", "at": "Austria",
  "cz": "Czech Republic", "dk": "Denmark", "ge": "Georgia",
  "gé": "Georgia", "usa": "United States", "uk": "United Kingdom",
};

function normaliseCountry(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  // Check ISO-2 map first
  const upper = trimmed.toUpperCase();
  if (ISO2_TO_COUNTRY[upper]) return ISO2_TO_COUNTRY[upper];
  // Check variant map
  const lower = trimmed.toLowerCase();
  if (COUNTRY_VARIANTS[lower]) return COUNTRY_VARIANTS[lower];
  // Return as-is (already a full name)
  return trimmed;
}

function extractDomain(url: string): string | null {
  if (!url || !url.trim()) return null;
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    const hostname = new URL(u).hostname.replace(/^www\./, "").toLowerCase().trim();
    if (!hostname || hostname === "localhost" || hostname === "www.https") return null;
    return hostname;
  } catch {
    return null;
  }
}

function parseSharePointCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString("utf-8");
  const lines = text.split(/\r?\n/);

  // Line 0 is the XML schema dump — skip it
  // Line 1 is the header row
  const headerLine = lines[1];
  if (!headerLine) return [];

  // Parse CSV properly (handle quoted fields)
  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseCsvLine(headerLine);
  const rows: Record<string, string>[] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function normaliseLeadClass(raw: string): string {
  if (!raw) return "Lead";
  const lower = raw.toLowerCase().trim();
  if (lower === "suspect") return "Suspect";
  if (lower === "customer") return "Customer";
  return "Lead";
}

router.post("/", upload.single("file"), async (req: any, res: any) => {
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const send = (obj: object) => {
    try { res.write(JSON.stringify(obj) + "\n"); } catch { /* client disconnected */ }
  };

  try {
    send({ status: "parsing", message: "Parsing CG lead list CSV..." });

    const rows = parseSharePointCsv(req.file.buffer);

    if (rows.length === 0) {
      send({ error: "File appears empty or could not be parsed." });
      return res.end();
    }

    // Validate we have the expected columns
    const firstRow = rows[0];
    if (!("Company" in firstRow) && !("company" in firstRow)) {
      send({ error: `Expected a 'Company' column. Found: ${Object.keys(firstRow).join(", ")}` });
      return res.end();
    }

    send({ status: "parsed", total: rows.length, message: `Parsed ${rows.length} rows` });

    // Create a dedicated campaign for this import
    const importDate = new Date().toISOString().split("T")[0];
    const searchId = await createSearch({
      userId: user.id,
      companyWebsite: "",
      location: "CG Lead List Import",
      offeringName: `CG Lead List — ${importDate}`,
      offeringDescription: `Connect Group SharePoint lead list import: ${rows.length} rows from "${req.file.originalname}"`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: JSON.stringify(["cg-lead-import"]),
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: 0,
      codesTotal: rows.length,
      status: "searching",
    });

    send({ status: "campaign_created", searchId, message: `Campaign created (id=${searchId})` });

    const db = await getDb();
    if (!db) {
      send({ error: "Database connection failed." });
      return res.end();
    }

    const now = new Date();
    let inserted = 0;
    let updated = 0;
    let contactsCreated = 0;
    let skipped = 0;

    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      for (const row of batch) {
        const companyName = (row["Company"] || "").trim();
        if (!companyName) { skipped++; continue; }

        const websiteRaw = (row["Website"] || "").trim();
        const domain = extractDomain(websiteRaw);
        const country = normaliseCountry(row["Country"] || "");
        const cgFields = {
          cgBusinessUnit: row["BU"] || null,
          cgSalesManager: row["SalesManager"] || null,
          cgLeadClass: normaliseLeadClass(row["Class"]),
          cgLeadOrigin: (row["Origin"] || "").substring(0, 256) || null,
          cgMarket: row["Market"] || null,
          cgComment: row["Comment"] || null,
          cgRemarks: row["Remarks"] || null,
          cgSharepointId: row["ID"] || null,
          cgImportedAt: now,
        };

        // Try to find existing company by domain, then by name
        let existingId: number | null = null;

        if (domain) {
          const byDomain = await db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.primaryDomain, domain))
            .limit(1);
          if (byDomain.length > 0) existingId = byDomain[0].id;
        }

        if (!existingId) {
          const byName = await db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.name, companyName))
            .limit(1);
          if (byName.length > 0) existingId = byName[0].id;
        }

        if (existingId) {
          // Update CG fields on existing company
          await db
            .update(companies)
            .set({
              ...cgFields,
              ...(domain ? { normalizedDomain: domain } : {}),
            })
            .where(eq(companies.id, existingId));
          updated++;

          // Upsert contact if present
          const contactEmail = (row["Email"] || "").trim();
          const contactFirstName = (row["Contact Name"] || "").trim();
          const contactLastName = (row["Contact Surname"] || "").trim();
          if (contactFirstName || contactEmail) {
            // Check if contact already exists for this company+email
            if (contactEmail) {
              const existing = await db
                .select({ id: contacts.id })
                .from(contacts)
                .where(and(eq(contacts.companyId, existingId), eq(contacts.email, contactEmail)))
                .limit(1);
              if (existing.length === 0) {
                await db.insert(contacts).values({
                  companyId: existingId,
                  firstName: contactFirstName || null,
                  lastName: contactLastName || null,
                  fullName: [contactFirstName, contactLastName].filter(Boolean).join(" ") || null,
                  title: row["Position"] || null,
                  email: contactEmail || null,
                  phone: row["Phone"] || null,
                  linkedinUrl: null,
                  searchedTitle: row["Position"] || null,
                });
                contactsCreated++;
              }
            } else if (contactFirstName) {
              // No email — insert by name if not already present
              const existing = await db
                .select({ id: contacts.id })
                .from(contacts)
                .where(and(
                  eq(contacts.companyId, existingId),
                  eq(contacts.firstName, contactFirstName),
                  eq(contacts.lastName, contactLastName || "")
                ))
                .limit(1);
              if (existing.length === 0) {
                await db.insert(contacts).values({
                  companyId: existingId,
                  firstName: contactFirstName,
                  lastName: contactLastName || null,
                  fullName: [contactFirstName, contactLastName].filter(Boolean).join(" ") || null,
                  title: row["Position"] || null,
                  email: null,
                  phone: row["Phone"] || null,
                  linkedinUrl: null,
                  searchedTitle: row["Position"] || null,
                });
                contactsCreated++;
              }
            }
          }
        } else {
          // Insert new company
          await db.insert(companies).values({
            searchId,
            name: companyName,
            websiteUrl: websiteRaw || null,
            primaryDomain: domain,
            normalizedDomain: domain,
            country,
            city: row["City"] || null,
            streetAddress: row["HQ Address"] || null,
            parentCompanyName: (row["Parent"] && row["Parent"] !== companyName) ? row["Parent"] : null,
            enrichmentStatus: "pending",
            sector: row["Market"] || null,
            ...cgFields,
          });

          // Fetch the newly inserted company id
          const newRow = await db
            .select({ id: companies.id })
            .from(companies)
            .where(and(
              eq(companies.searchId, searchId),
              eq(companies.name, companyName)
            ))
            .orderBy(companies.id)
            .limit(1);

          if (newRow.length > 0) {
            const newId = newRow[0].id;
            const contactEmail = (row["Email"] || "").trim();
            const contactFirstName = (row["Contact Name"] || "").trim();
            const contactLastName = (row["Contact Surname"] || "").trim();
            if (contactFirstName || contactEmail) {
              await db.insert(contacts).values({
                companyId: newId,
                firstName: contactFirstName || null,
                lastName: contactLastName || null,
                fullName: [contactFirstName, contactLastName].filter(Boolean).join(" ") || null,
                title: row["Position"] || null,
                email: contactEmail || null,
                phone: row["Phone"] || null,
                linkedinUrl: null,
                searchedTitle: row["Position"] || null,
              });
              contactsCreated++;
            }
          }

          inserted++;
        }
      }

      send({
        status: "progress",
        done: Math.min(i + BATCH, rows.length),
        total: rows.length,
        inserted,
        updated,
        contactsCreated,
        message: `Processed ${Math.min(i + BATCH, rows.length)} / ${rows.length} rows (${inserted} new, ${updated} updated)...`,
      });
    }

    // Mark campaign as completed
    const { searches } = await import("../../drizzle/schema");
    await db
      .update(searches)
      .set({ status: "completed", codesSearched: rows.length })
      .where(eq(searches.id, searchId));

    send({
      status: "done",
      searchId,
      total: rows.length,
      inserted,
      updated,
      contactsCreated,
      skipped,
      message: `Import complete. ${inserted} new companies, ${updated} updated, ${contactsCreated} contacts created, ${skipped} skipped.`,
    });

  } catch (err: any) {
    console.error("[CG Lead Import] Fatal error:", err.message, err.stack);
    send({ error: err.message });
  }

  res.end();
});

export default router;
