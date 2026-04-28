import { Router, Request, Response } from "express";
import * as XLSX from "xlsx";
import { getDb } from "../db";
import { shareTokens, companies, offeringBrain, companyBrainOutputs, contacts } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sdk } from "../_core/sdk";

const router = Router();

/**
 * GET /api/share-list-export?tokens=abc,def,ghi
 * Returns an XLSX file with all share-list columns including clickable share links.
 * Requires authentication.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    let user: any = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    const { tokens: tokensParam } = req.query as { tokens?: string };
    if (!tokensParam) {
      res.status(400).json({ error: "Provide tokens as comma-separated list" });
      return;
    }

    const tokenList = tokensParam.split(",").map((t) => t.trim()).filter(Boolean);
    if (!tokenList.length) {
      res.status(400).json({ error: "No tokens provided" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database unavailable" });
      return;
    }

    // Resolve tokens
    const tokenRows = await db
      .select()
      .from(shareTokens)
      .where(inArray(shareTokens.token, tokenList));

    if (!tokenRows.length) {
      res.status(404).json({ error: "No valid tokens found" });
      return;
    }

    // Determine base URL from request
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000";
    const baseUrl = `${proto}://${host}`;

    const wsRows: Record<string, string | number>[] = [];

    for (const tokenRow of tokenRows) {
      // Company
      const companyRows = await db.select().from(companies).where(eq(companies.id, tokenRow.companyId)).limit(1);
      const company = companyRows[0];
      if (!company) continue;

      // Brain
      const brainRows = await db.select().from(offeringBrain).where(eq(offeringBrain.id, tokenRow.brainId)).limit(1);
      const brain = brainRows[0] ?? null;

      // Brain output
      const outputRows = await db
        .select()
        .from(companyBrainOutputs)
        .where(and(eq(companyBrainOutputs.companyId, tokenRow.companyId), eq(companyBrainOutputs.brainId, tokenRow.brainId)))
        .limit(1);
      const output = outputRows[0] ?? null;

      // Top contact
      const contactRows = await db.select().from(contacts).where(eq(contacts.companyId, tokenRow.companyId)).limit(1);
      const contact = contactRows[0] ?? null;

      // Parse sector from sliceMetadata
      let sector = "";
      try {
        if (company.sliceMetadata) {
          const meta = JSON.parse(company.sliceMetadata as string);
          sector = meta?.industry ?? "";
        }
      } catch {}

      // Parse key signal from briefData
      let keySignal = "";
      try {
        const briefStr = output?.briefData ?? company.briefData;
        if (briefStr) {
          const brief = JSON.parse(briefStr);
          keySignal =
            brief?.urgencySignals?.[0]?.description ??
            brief?.urgencySignals?.[0]?.signal ??
            brief?.signals?.[0]?.signal ??
            brief?.keySignal ??
            "";
        }
      } catch {}

      const fitScore = output?.fitScore ?? company.fitScore ?? "";
      const urgencyScore = output?.urgencyScore ?? company.urgencyScore ?? "";
      const employeeCount = (company as any).employeeCount ?? (company as any).headcount ?? "";
      const contactName = contact?.fullName ?? [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ?? "";

      wsRows.push({
        "Company Name": company.name ?? "",
        "Website": company.websiteUrl ?? company.primaryDomain ?? "",
        "Country": company.country ?? "",
        "Employee Count": employeeCount,
        "Sector": sector,
        "Brain": brain?.brainName ?? "",
        "Fit Score": fitScore,
        "Urgency Score": urgencyScore,
        "Key Signal": keySignal,
        "Contact Name": contactName,
        "Contact Title": contact?.title ?? "",
        "Contact Email": contact?.email ?? "",
        "Share Link": `${baseUrl}/share/${tokenRow.token}`,
      });
    }

    // Sort by urgency descending
    wsRows.sort((a, b) => Number(b["Urgency Score"] || 0) - Number(a["Urgency Score"] || 0));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsRows);

    ws["!cols"] = [
      { wch: 30 }, // Company Name
      { wch: 28 }, // Website
      { wch: 14 }, // Country
      { wch: 14 }, // Employee Count
      { wch: 22 }, // Sector
      { wch: 22 }, // Brain
      { wch: 10 }, // Fit Score
      { wch: 14 }, // Urgency Score
      { wch: 55 }, // Key Signal
      { wch: 28 }, // Contact Name
      { wch: 32 }, // Contact Title
      { wch: 36 }, // Contact Email
      { wch: 60 }, // Share Link
    ];
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, "Share List");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `share-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("[shareListExport] Error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
