import { Router, Request, Response } from "express";
import * as XLSX from "xlsx";
import { getDb } from "../db";
import { companies, contacts, Contact } from "../../drizzle/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

const router = Router();

interface UrgencySignal {
  category?: string;
  type?: string;
  description?: string;
  snippet?: string;
  sourceUrl?: string;
  detectedAt?: string;
  weight?: number;
}

interface BriefData {
  urgencySignals?: UrgencySignal[];
  recentDevelopments?: { text: string; date?: string; sourceUrl?: string; snippet?: string }[];
  executiveSummary?: { industry?: string };
}

interface ContactRow {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
}

// GET /api/export-excel?searchId=123  (or ?companyIds=1,2,3)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { searchId, companyIds: companyIdsParam } = req.query as {
      searchId?: string;
      companyIds?: string;
    };

    // Fetch companies
    const dbInstance = await getDb();
    if (!dbInstance) {
      res.status(500).json({ error: "Database unavailable" });
      return;
    }

    let rows;
    if (companyIdsParam) {
      const ids = companyIdsParam.split(",").map(Number).filter(Boolean);
      rows = await dbInstance
        .select()
        .from(companies)
        .where(inArray(companies.id, ids));
    } else if (searchId) {
      rows = await dbInstance
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.searchId, Number(searchId)),
            isNotNull(companies.urgencyScore)
          )
        )
        .orderBy(companies.urgencyScore);
    } else {
      res.status(400).json({ error: "Provide searchId or companyIds" });
      return;
    }

    // Fetch top contact per company
    const companyIdList = rows.map((c) => c.id);
    const allContacts =
      companyIdList.length > 0
        ? await dbInstance
            .select()
            .from(contacts)
            .where(inArray(contacts.companyId, companyIdList))
        : [];

    // Group contacts by companyId — pick first (highest seniority, as stored)
    const topContactMap = new Map<number, ContactRow>();
    for (const c of allContacts as Contact[]) {
      if (!topContactMap.has(c.companyId)) {
        topContactMap.set(c.companyId, c);
      }
    }

    // Build worksheet rows
    const wsRows: Record<string, string | number>[] = [];

    for (const company of rows) {
      let signals: UrgencySignal[] = [];
      try {
        if (company.briefData) {
          const brief: BriefData = JSON.parse(company.briefData);
          signals = (brief.urgencySignals || [])
            .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
            .slice(0, 3);
        }
      } catch {
        // briefData not parseable — leave signals empty
      }

      const sig = (i: number) => signals[i] ?? null;
      const contact = topContactMap.get(company.id);

      wsRows.push({
        "Company": company.name ?? "",
        "Domain": company.primaryDomain ?? company.websiteUrl ?? "",
        "Industry": (() => { try { const m = company.sliceMetadata ? JSON.parse(company.sliceMetadata as string) : null; return (m?.industry ?? "") as string; } catch { return ""; } })(),
        "Revenue (USD)": company.revenue ?? "",
        "Country": company.country ?? "",
        "Urgency Score": company.urgencyScore ?? "",
        "Fit Score": company.fitScore ?? "",

        // Signal 1
        "Signal 1 — Type": sig(0) ? `${sig(0)!.category ?? ""} / ${sig(0)!.type ?? ""}`.trim().replace(/^\/|\/$/g, "").trim() : "",
        "Signal 1 — Headline": sig(0)?.description ?? "",
        "Signal 1 — Snippet": sig(0)?.snippet ?? "",
        "Signal 1 — Source URL": sig(0)?.sourceUrl ?? "",
        "Signal 1 — Date": sig(0)?.detectedAt ?? "",

        // Signal 2
        "Signal 2 — Type": sig(1) ? `${sig(1)!.category ?? ""} / ${sig(1)!.type ?? ""}`.trim().replace(/^\/|\/$/g, "").trim() : "",
        "Signal 2 — Headline": sig(1)?.description ?? "",
        "Signal 2 — Snippet": sig(1)?.snippet ?? "",
        "Signal 2 — Source URL": sig(1)?.sourceUrl ?? "",
        "Signal 2 — Date": sig(1)?.detectedAt ?? "",

        // Signal 3
        "Signal 3 — Type": sig(2) ? `${sig(2)!.category ?? ""} / ${sig(2)!.type ?? ""}`.trim().replace(/^\/|\/$/g, "").trim() : "",
        "Signal 3 — Headline": sig(2)?.description ?? "",
        "Signal 3 — Snippet": sig(2)?.snippet ?? "",
        "Signal 3 — Source URL": sig(2)?.sourceUrl ?? "",
        "Signal 3 — Date": sig(2)?.detectedAt ?? "",

        // Top contact
        "Top Contact — Name": ((contact?.fullName ?? `${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`)).trim(),
        "Top Contact — Title": contact?.title ?? "",
        "Top Contact — LinkedIn": contact?.linkedinUrl ?? "",
        "Top Contact — Email": contact?.email ?? "",
      });
    }

    // Sort by urgency score descending
    wsRows.sort((a, b) => Number(b["Urgency Score"] || 0) - Number(a["Urgency Score"] || 0));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsRows);

    // Column widths
    const colWidths = [
      { wch: 30 }, // Company
      { wch: 28 }, // Domain
      { wch: 22 }, // Industry
      { wch: 18 }, // Revenue
      { wch: 12 }, // Country
      { wch: 14 }, // Urgency Score
      { wch: 10 }, // Fit Score
      // Signal 1
      { wch: 22 }, { wch: 45 }, { wch: 60 }, { wch: 55 }, { wch: 12 },
      // Signal 2
      { wch: 22 }, { wch: 45 }, { wch: 60 }, { wch: 55 }, { wch: 12 },
      // Signal 3
      { wch: 22 }, { wch: 45 }, { wch: 60 }, { wch: 55 }, { wch: 12 },
      // Contact
      { wch: 28 }, { wch: 32 }, { wch: 50 }, { wch: 36 },
    ];
    ws["!cols"] = colWidths;

    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, "Sales Intelligence");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `sales-intelligence-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("[exportExcel] Error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
