/**
 * Public Share List API
 *
 * Two endpoints — no authentication required beyond knowing the listToken
 * (same trust model as the /share/list/:token page itself).
 *
 * GET /api/public/share-lists
 *   Returns all share lists (id, listToken, name, createdAt, companyCount).
 *
 * GET /api/public/share-lists/:listToken
 *   Returns the full company table for a specific share list.
 *   Uses the share_list_company_view for a single fast query.
 */

import { Router } from "express";
import mysql from "mysql2/promise";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/public/share-lists
// Returns all share lists with metadata and company count.
// ---------------------------------------------------------------------------
router.get("/", async (_req, res) => {
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
    const [rows] = await conn.query(`
      SELECT
        sl.id,
        sl.listToken,
        sl.shareListName AS name,
        sl.createdAt,
        COUNT(DISTINCT v.companyId) AS companyCount
      FROM share_lists sl
      LEFT JOIN share_list_company_view v ON v.shareListId = sl.id
      GROUP BY sl.id, sl.listToken, sl.shareListName, sl.createdAt
      ORDER BY sl.createdAt DESC
    `) as any[];
    await conn.end();

    const lists = (rows as any[]).map((r: any) => ({
      id: r.id,
      listToken: r.listToken,
      name: r.name ?? null,
      createdAt: r.createdAt,
      companyCount: Number(r.companyCount ?? 0),
      url: `https://leadtrigger-connectgroup.com/share/list/${r.listToken}`,
      apiUrl: `https://leadtrigger-connectgroup.com/api/public/share-lists/${r.listToken}`,
    }));

    return res.json({
      ok: true,
      totalCount: lists.length,
      lists,
    });
  } catch (err) {
    console.error("[PublicShareListApi] GET /share-lists error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/public/share-lists/:listToken
// Returns the full company table for a specific list.
// ---------------------------------------------------------------------------
router.get("/:listToken", async (req, res) => {
  const { listToken } = req.params;

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

    if (!listRows.length) {
      await conn.end();
      return res.status(404).json({ ok: false, error: "Share list not found" });
    }

    const list = listRows[0];

    // Fetch all companies via the pre-joined view — single query
    const [companyRows] = await conn.query(`
      SELECT
        v.companyId        AS id,
        v.token            AS shareToken,
        v.companyName      AS name,
        v.websiteUrl,
        v.country,
        v.city,
        COALESCE(v.outputFitScore,    v.fitScore)    AS fitScore,
        COALESCE(v.outputUrgencyScore, v.urgencyScore) AS urgencyScore,
        v.brainName,
        v.contactName,
        v.contactTitle,
        v.contactEmail
      FROM share_list_company_view v
      WHERE v.shareListId = ?
      ORDER BY COALESCE(v.outputFitScore, v.fitScore) DESC,
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

    return res.json({
      ok: true,
      list: {
        id: list.id,
        listToken: list.listToken,
        name: list.shareListName ?? null,
        createdAt: list.createdAt,
        url: `https://leadtrigger-connectgroup.com/share/list/${list.listToken}`,
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

export default router;
