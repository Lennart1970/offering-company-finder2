/**
 * Public Share List API
 *
 * Two endpoints — no authentication required beyond knowing the listToken
 * (same trust model as the /share/list/:token page itself).
 *
 * GET /api/public/share-lists[?brainId=123]
 *   Returns all share lists (optionally filtered by brainId).
 *
 * GET /api/public/share-lists/:listToken[?format=csv]
 *   Returns the full company table for a specific share list.
 *   Add ?format=csv to receive a CSV file instead of JSON.
 */

import { Router } from "express";
import mysql from "mysql2/promise";
import { getDb } from "../db";
import { shareFeedback } from "../../drizzle/schema";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCsv(companies: any[]): string {
  if (!companies.length) return "id,name,websiteUrl,country,city,fitScore,urgencyScore,brainName,contactName,contactTitle,contactEmail,shareUrl\n";

  const headers = [
    "id", "name", "websiteUrl", "country", "city",
    "fitScore", "urgencyScore", "brainName",
    "contactName", "contactTitle", "contactEmail", "shareUrl",
  ];

  const escape = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Wrap in quotes if contains comma, quote, or newline
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = companies.map((c) => [
    c.id, c.name, c.websiteUrl, c.country, c.city,
    c.fitScore, c.urgencyScore, c.brainName,
    c.contact?.name, c.contact?.title, c.contact?.email,
    c.shareUrl,
  ].map(escape).join(","));

  return [headers.join(","), ...rows].join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// GET /api/public/share-lists[?brainId=123]
// Returns all share lists with metadata and company count.
// Optional ?brainId filter narrows results to lists that contain companies
// scored against a specific Offering Brain.
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  const brainId = req.query.brainId ? Number(req.query.brainId) : null;

  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL as string);

    let query: string;
    let params: any[];

    if (brainId) {
      // Filter: only share lists whose tokens reference the given brainId
      query = `
        SELECT
          sl.id,
          sl.listToken,
          sl.shareListName AS name,
          sl.createdAt,
          COUNT(DISTINCT v.companyId) AS companyCount,
          MAX(ob.id)       AS brainId,
          MAX(ob.brainName) AS brainName
        FROM share_lists sl
        LEFT JOIN share_list_company_view v ON v.shareListId = sl.id
        LEFT JOIN offering_brain ob ON ob.id = v.brainId
        WHERE v.brainId = ?
        GROUP BY sl.id, sl.listToken, sl.shareListName, sl.createdAt
        ORDER BY sl.createdAt DESC
      `;
      params = [brainId];
    } else {
      query = `
        SELECT
          sl.id,
          sl.listToken,
          sl.shareListName AS name,
          sl.createdAt,
          COUNT(DISTINCT v.companyId) AS companyCount,
          MAX(ob.id)        AS brainId,
          MAX(ob.brainName) AS brainName
        FROM share_lists sl
        LEFT JOIN share_list_company_view v ON v.shareListId = sl.id
        LEFT JOIN offering_brain ob ON ob.id = v.brainId
        GROUP BY sl.id, sl.listToken, sl.shareListName, sl.createdAt
        ORDER BY sl.createdAt DESC
      `;
      params = [];
    }

    const [rows] = await conn.query(query, params) as any[];
    await conn.end();

    const lists = (rows as any[]).map((r: any) => ({
      id: r.id,
      listToken: r.listToken,
      name: r.name ?? null,
      createdAt: r.createdAt,
      companyCount: Number(r.companyCount ?? 0),
      brainId: r.brainId ? Number(r.brainId) : null,
      brainName: r.brainName ?? null,
      url: `https://leadtrigger-connectgroup.com/share/list/${r.listToken}`,
      apiUrl: `https://leadtrigger-connectgroup.com/api/public/share-lists/${r.listToken}`,
      csvUrl: `https://leadtrigger-connectgroup.com/api/public/share-lists/${r.listToken}?format=csv`,
    }));

    return res.json({
      ok: true,
      totalCount: lists.length,
      filteredByBrainId: brainId ?? undefined,
      lists,
    });
  } catch (err) {
    console.error("[PublicShareListApi] GET /share-lists error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/public/share-lists/:listToken[?format=csv]
// Returns the full company table for a specific list.
// ?format=csv  → returns a downloadable CSV file
// (default)    → returns JSON
// ---------------------------------------------------------------------------
router.get("/:listToken", async (req, res) => {
  const { listToken } = req.params;
  const format = (req.query.format as string | undefined)?.toLowerCase();

  if (!listToken || !/^[a-f0-9]{32}$/.test(listToken)) {
    return res.status(400).json({ ok: false, error: "Invalid listToken format" });
  }

  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL as string);

    // Resolve the share list
    const [listRows] = await conn.query(
      "SELECT id, listToken, shareListName, createdAt FROM share_lists WHERE listToken = ? LIMIT 1",
      [listToken]
    ) as any[];

    if (!(listRows as any[]).length) {
      await conn.end();
      return res.status(404).json({ ok: false, error: "Share list not found" });
    }

    const list = (listRows as any[])[0];

    // Fetch all companies via the pre-joined view — single query
    const [companyRows] = await conn.query(`
      SELECT
        v.companyId        AS id,
        v.token            AS shareToken,
        v.companyName      AS name,
        v.websiteUrl,
        v.country,
        v.city,
        COALESCE(v.outputFitScore,     v.fitScore)     AS fitScore,
        COALESCE(v.outputUrgencyScore, v.urgencyScore) AS urgencyScore,
        v.brainName,
        v.contactName,
        v.contactTitle,
        v.contactEmail
      FROM share_list_company_view v
      WHERE v.shareListId = ?
      ORDER BY COALESCE(v.outputFitScore,     v.fitScore)     DESC,
               COALESCE(v.outputUrgencyScore, v.urgencyScore) DESC
    `, [list.id]) as any[];

    await conn.end();

    const companies = (companyRows as any[]).map((r: any) => ({
      id: r.id,
      shareToken: r.shareToken,
      name: r.name ?? null,
      websiteUrl: r.websiteUrl ?? null,
      country: r.country ?? null,
      city: r.city ?? null,
      fitScore: r.fitScore !== null ? Number(r.fitScore) : null,
      urgencyScore: r.urgencyScore !== null ? Number(r.urgencyScore) : null,
      brainName: r.brainName ?? null,
      contact: {
        name: r.contactName ?? null,
        title: r.contactTitle ?? null,
        email: r.contactEmail ?? null,
      },
      shareUrl: `https://leadtrigger-connectgroup.com/share/${r.shareToken}`,
    }));

    // ── CSV response ──────────────────────────────────────────────────────────
    if (format === "csv") {
      const safeName = (list.shareListName ?? listToken).replace(/[^a-z0-9_-]/gi, "_");
      const filename = `share-list-${safeName}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(toCsv(companies));
    }

    // ── JSON response (default) ───────────────────────────────────────────────
    return res.json({
      ok: true,
      list: {
        id: list.id,
        listToken: list.listToken,
        name: list.shareListName ?? null,
        createdAt: list.createdAt,
        url: `https://leadtrigger-connectgroup.com/share/list/${list.listToken}`,
        csvUrl: `https://leadtrigger-connectgroup.com/api/public/share-lists/${list.listToken}?format=csv`,
      },
      totalCount: companies.length,
      generatedAt: new Date().toISOString(),
      companies,
    });
  } catch (err) {
    console.error("[PublicShareListApi] GET /share-lists/:token error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/share-lists/feedback — store anonymous feedback to MySQL
// ---------------------------------------------------------------------------
router.post("/feedback", async (req, res) => {
  try {
    const { shareToken, companyId, companyName, rating, comment, submitterName, submitterEmail } = req.body ?? {};
    if (!shareToken) return res.status(400).json({ ok: false, error: "shareToken required" });

    const db = await getDb();
    if (!db) return res.status(500).json({ ok: false, error: "Database not available" });

    const validRatings = ["thumbs_up", "thumbs_down", "neutral"] as const;
    await db.insert(shareFeedback).values({
      shareToken: String(shareToken).slice(0, 200),
      companyId: companyId ? Number(companyId) : null,
      companyName: companyName ? String(companyName).slice(0, 300) : null,
      rating: validRatings.includes(rating) ? (rating as typeof validRatings[number]) : null,
      comment: comment ? String(comment).slice(0, 2000) : null,
      submitterName: submitterName ? String(submitterName).slice(0, 200) : null,
      submitterEmail: submitterEmail ? String(submitterEmail).slice(0, 200) : null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ShareFeedback] POST error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

export default router;

