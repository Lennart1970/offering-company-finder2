import { z } from "zod";
import { eq, and, or } from "drizzle-orm";
import crypto from "crypto";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { createContact, getContactsByCompanyId } from "./db";
import { inArray } from "drizzle-orm";
import { getCachedToken, setCachedToken, getCachedList, setCachedList } from "./shareCache";
import { trickleDownSearch, getAllPersonnel } from "./apolloPeopleSearch";
import {
  shareTokens,
  shareLists,
  shareListItems,
  companies,
  offeringBrain,
  companyBrainOutputs,
  contacts,
  shareAccessLog,
  shareAllowedDomains,
  brainShareTokens,
  shareVisitors,
  leadinfoVisits,
} from "../drizzle/schema";

/** Generate a cryptographically random 32-char hex token */
function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export const shareRouter = router({
  /**
   * Create share tokens for a list of (companyId, brainId) pairs.
   * Returns the generated tokens. Protected — only logged-in users.
   */
  createShareList: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            companyId: z.number(),
            brainId: z.number(),
          })
        ),
        shareListName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;
      const results: Array<{ companyId: number; brainId: number; token: string }> = [];

      for (const item of input.items) {
        // Reuse existing token for same company+brain+user
        const existing = await db
          .select()
          .from(shareTokens)
          .where(
            and(
              eq(shareTokens.companyId, item.companyId),
              eq(shareTokens.brainId, item.brainId),
              eq(shareTokens.createdBy, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          results.push({ companyId: item.companyId, brainId: item.brainId, token: existing[0].token });
        } else {
          const token = generateToken();
          await db.insert(shareTokens).values({
            token,
            companyId: item.companyId,
            brainId: item.brainId,
            createdBy: userId,
            shareListName: input.shareListName ?? null,
          });
          results.push({ companyId: item.companyId, brainId: item.brainId, token });
        }
      }

      return results;
    }),

  /**
   * Public endpoint — resolves a share token and returns all data needed
   * to render the read-only company+brain page. No authentication required.
   */
  resolveToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      // Check cache first — avoids DB queries + Serper API call
      const cached = getCachedToken(input.token);
      if (cached) return cached;

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const tokenRows = await db
        .select()
        .from(shareTokens)
        .where(eq(shareTokens.token, input.token))
        .limit(1);

      if (tokenRows.length === 0) throw new Error("Invalid or expired share link");
      const tokenRow = tokenRows[0];

      const companyRows = await db
        .select()
        .from(companies)
        .where(eq(companies.id, tokenRow.companyId))
        .limit(1);
      if (companyRows.length === 0) throw new Error("Company not found");
      const company = companyRows[0];

      const brainRows = await db
        .select()
        .from(offeringBrain)
        .where(eq(offeringBrain.id, tokenRow.brainId))
        .limit(1);
      const brain = brainRows[0] ?? null;

      const brainOutputRows = await db
        .select()
        .from(companyBrainOutputs)
        .where(
          and(
            eq(companyBrainOutputs.companyId, tokenRow.companyId),
            eq(companyBrainOutputs.brainId, tokenRow.brainId)
          )
        )
        .limit(1);
      const brainOutput = brainOutputRows[0] ?? null;

      const contactRows = await db
        .select()
        .from(contacts)
        .where(eq(contacts.companyId, tokenRow.companyId));

      // Fetch Leadinfo visit data for this company (if any)
      const leadinfoRows = await db
        .select()
        .from(leadinfoVisits)
        .where(eq(leadinfoVisits.companyId, tokenRow.companyId));
      // Aggregate across all rows (a company may have multiple import batches)
      const leadinfoData = leadinfoRows.length > 0 ? {
        totalSessions: leadinfoRows.reduce((s, r) => s + (r.totalSessions ?? 0), 0),
        totalPages: leadinfoRows.reduce((s, r) => s + (r.totalPages ?? 0), 0),
        totalDuration: leadinfoRows.reduce((s, r) => s + (r.totalDuration ?? 0), 0),
        engagementScore: Math.max(...leadinfoRows.map(r => r.engagementScore ?? 0)),
        avgPagesPerSession: (() => {
          const sessions = leadinfoRows.reduce((s, r) => s + (r.totalSessions ?? 0), 0);
          const pages = leadinfoRows.reduce((s, r) => s + (r.totalPages ?? 0), 0);
          return sessions > 0 ? Math.round((pages / sessions) * 10) / 10 : 0;
        })(),
        intentSignals: (() => {
          const all: string[] = [];
          for (const r of leadinfoRows) {
            try { all.push(...(JSON.parse(r.intentSignals ?? "[]") as string[])); } catch {}
          }
          return Array.from(new Set(all));
        })(),
        topPages: (() => {
          const all: string[] = [];
          for (const r of leadinfoRows) {
            try { all.push(...(JSON.parse(r.topPages ?? "[]") as string[])); } catch {}
          }
          return Array.from(new Set(all)).slice(0, 5);
        })(),
      } : null;

      // Use cached images from DB, or fetch from Serper and cache
      let companyImages: string[] = [];
      if (tokenRow.cachedImages) {
        try { companyImages = JSON.parse(tokenRow.cachedImages); } catch {}
      }
      if (companyImages.length === 0) {
        try {
          const serperKey = process.env.SERPER_API_KEY;
          if (serperKey && company.name) {
            const searchQuery = `${company.name} company office headquarters`;
            const serperRes = await fetch("https://google.serper.dev/images", {
              method: "POST",
              headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
              body: JSON.stringify({ q: searchQuery, num: 5 }),
            });
            if (serperRes.ok) {
              const serperData = await serperRes.json() as { images?: Array<{ imageUrl?: string; thumbnailUrl?: string }> };
              const images = serperData.images ?? [];
              companyImages = images
                .map((img) => img.imageUrl ?? img.thumbnailUrl ?? "")
                .filter((url) => url && url.startsWith("http"))
                .slice(0, 2);
              // Persist to DB so next visit skips Serper
              if (companyImages.length > 0) {
                await db.update(shareTokens)
                  .set({ cachedImages: JSON.stringify(companyImages), cachedAt: new Date() })
                  .where(eq(shareTokens.id, tokenRow.id));
              }
            }
          }
        } catch {
          // Image fetch is best-effort — never fail the page load
        }
      }

      const result = {
        company,
        brain,
        brainOutput,
        contacts: contactRows,
        contactsFetchedAt: company.contactsFetchedAt ?? null,
        leadinfo: leadinfoData,
        shareListName: tokenRow.shareListName,
        companyImages,
      };

      // Cache for 24h
      setCachedToken(input.token, result);

      return result;
    }),

  /**
   * Get export data for a share list — returns all columns for Excel export.
   * Protected — only logged-in users.
   */
  getShareListExport: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            companyId: z.number(),
            brainId: z.number(),
            token: z.string(),
          })
        ),
        baseUrl: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const rows: Array<{
        companyName: string;
        website: string;
        country: string;
        employeeCount: string;
        sector: string;
        brainName: string;
        fitScore: number | null;
        urgencyScore: number | null;
        keySignal: string;
        contactName: string;
        shareLink: string;
      }> = [];

      for (const item of input.items) {
        const companyRows = await db
          .select()
          .from(companies)
          .where(eq(companies.id, item.companyId))
          .limit(1);
        const company = companyRows[0];
        if (!company) continue;

        const brainRows = await db
          .select()
          .from(offeringBrain)
          .where(eq(offeringBrain.id, item.brainId))
          .limit(1);
        const brain = brainRows[0] ?? null;

        const brainOutputRows = await db
          .select()
          .from(companyBrainOutputs)
          .where(
            and(
              eq(companyBrainOutputs.companyId, item.companyId),
              eq(companyBrainOutputs.brainId, item.brainId)
            )
          )
          .limit(1);
        const brainOutput = brainOutputRows[0] ?? null;

        const contactRows = await db
          .select()
          .from(contacts)
          .where(eq(contacts.companyId, item.companyId))
          .limit(1);
        const firstContact = contactRows[0] ?? null;

        // Extract key signal
        let keySignal = "";
        const briefStr = brainOutput?.briefData ?? company.briefData;
        if (briefStr) {
          try {
            const brief = JSON.parse(briefStr);
            keySignal =
              brief?.urgencySignals?.[0]?.signal ??
              brief?.signals?.[0]?.signal ??
              brief?.keySignal ??
              "";
          } catch {}
        }

        // Employee count
        const empCount = (company as any).employeeCount ?? (company as any).headcount ?? "";

        // Sector from sliceMetadata
        let sector = "";
        if (company.sliceMetadata) {
          try {
            const meta = JSON.parse(company.sliceMetadata);
            sector = meta?.industry ?? "";
          } catch {}
        }

        rows.push({
          companyName: company.name,
          website: company.websiteUrl ?? "",
          country: company.country ?? "",
          employeeCount: String(empCount),
          sector,
          brainName: brain?.brainName ?? "",
          fitScore: brainOutput?.fitScore ?? company.fitScore ?? null,
          urgencyScore: brainOutput?.urgencyScore ?? company.urgencyScore ?? null,
          keySignal,
          contactName: firstContact?.fullName ?? "",
          shareLink: `${input.baseUrl}/share/${item.token}`,
        });
      }

      return rows;
    }),

  /**
   * Create a list-level share token that groups all company tokens.
   * Returns a single listToken URL for the public overview page.
   */
  createShareListWithToken: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            companyId: z.number(),
            brainId: z.number(),
          })
        ),
        shareListName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;

      // 1. Upsert individual company tokens
      const tokenResults: Array<{ companyId: number; brainId: number; token: string; tokenId: number }> = [];
      for (const item of input.items) {
        const existing = await db
          .select()
          .from(shareTokens)
          .where(and(eq(shareTokens.companyId, item.companyId), eq(shareTokens.brainId, item.brainId), eq(shareTokens.createdBy, userId)))
          .limit(1);
        if (existing.length > 0) {
          tokenResults.push({ companyId: item.companyId, brainId: item.brainId, token: existing[0].token, tokenId: existing[0].id });
        } else {
          const token = generateToken();
          await db.insert(shareTokens).values({ token, companyId: item.companyId, brainId: item.brainId, createdBy: userId, shareListName: input.shareListName ?? null });
          const inserted = await db.select().from(shareTokens).where(eq(shareTokens.token, token)).limit(1);
          tokenResults.push({ companyId: item.companyId, brainId: item.brainId, token, tokenId: inserted[0].id });
        }
      }

      // 2. Create the list-level token
      const listToken = generateToken();
      await db.insert(shareLists).values({ listToken, shareListName: input.shareListName ?? null, createdBy: userId });
      const listRows = await db.select().from(shareLists).where(eq(shareLists.listToken, listToken)).limit(1);
      const shareListId = listRows[0].id;

      // 3. Link tokens to the list
      for (const t of tokenResults) {
        await db.insert(shareListItems).values({ shareListId, shareTokenId: t.tokenId });
      }

      return { listToken, tokens: tokenResults };
    }),

  /**
   * Public endpoint — resolves a list token and returns all companies with their data.
   */
  resolveListToken: publicProcedure
    .input(z.object({ listToken: z.string() }))
    .query(async ({ input }) => {
      // Check cache first — avoids N+1 queries for 700+ companies
      const cached = getCachedList(input.listToken);
      if (cached) return cached;

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const listRows = await db.select().from(shareLists).where(eq(shareLists.listToken, input.listToken)).limit(1);
      if (listRows.length === 0) throw new Error("Invalid or expired share list link");
      const shareList = listRows[0];

      // Single-query path via pre-joined view — replaces the old 5-queries-per-company loop
      const db2 = await getDb();
      if (!db2) throw new Error("Database unavailable");
      const viewRows = await db2.execute(
        `SELECT * FROM share_list_company_view WHERE shareListId = ${shareList.id}`
      ) as unknown as Array<Record<string, unknown>>;
      const rawRows: Array<Record<string, unknown>> = Array.isArray(viewRows[0]) ? viewRows[0] as Array<Record<string, unknown>> : viewRows;

      const companyRows = rawRows.map((row) => {
        let keySignal = "";
        const briefStr = (row.outputBriefData ?? row.briefData) as string | null;
        if (briefStr) {
          try {
            const brief = JSON.parse(briefStr);
            keySignal = brief?.urgencySignals?.[0]?.signal ?? brief?.signals?.[0]?.signal ?? brief?.keySignal ?? "";
          } catch {}
        }
        let sector = "";
        if (row.sliceMetadata) {
          try { const meta = JSON.parse(row.sliceMetadata as string); sector = meta?.industry ?? ""; } catch {}
        }
        return {
          companyId: Number(row.companyId),
          brainId: Number(row.brainId),
          token: String(row.token ?? ""),
          companyName: String(row.companyName ?? ""),
          website: String(row.websiteUrl ?? ""),
          country: String(row.country ?? ""),
          city: String(row.city ?? ""),
          employeeCount: "",
          sector,
          brainName: String(row.brainName ?? ""),
          fitScore: row.outputFitScore != null ? Number(row.outputFitScore) : row.fitScore != null ? Number(row.fitScore) : null,
          urgencyScore: row.outputUrgencyScore != null ? Number(row.outputUrgencyScore) : row.urgencyScore != null ? Number(row.urgencyScore) : null,
          keySignal,
          contactName: String(row.contactName ?? ""),
          contactTitle: String(row.contactTitle ?? ""),
          contactEmail: String(row.contactEmail ?? ""),
        };
      });

      const result = {
        shareListName: shareList.shareListName,
        createdAt: shareList.createdAt,
        companies: companyRows,
      };

      // Cache for 24h
      setCachedList(input.listToken, result);

      return result;
    }),

  /**
   * Returns all share lists created by the current user, with company count.
   */
  getShareLists: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await conn.execute<any[]>(
        `SELECT sl.id, sl.listToken, sl.shareListName, sl.createdAt,
                COUNT(sli.id) AS companyCount
         FROM share_lists sl
         LEFT JOIN share_list_items sli ON sli.shareListId = sl.id
         WHERE sl.createdBy = ?
         GROUP BY sl.id
         ORDER BY sl.createdAt DESC`,
        [userId]
      );
      const lists = rows.map((r: any) => ({
        id: Number(r.id),
        listToken: String(r.listToken),
        shareListName: r.shareListName ? String(r.shareListName) : null,
        createdAt: new Date(r.createdAt),
        companyCount: Number(r.companyCount),
      }));
      return { lists };
    } finally {
      await conn.end();
    }
  }),

  /**
   * Delete a share list (and cascade-delete its items via FK).
   * Only the owner can delete their own list.
   */
  deleteShareList: protectedProcedure
    .input(z.object({ listId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;
      const [existing] = await db
        .select({ id: shareLists.id })
        .from(shareLists)
        .where(and(eq(shareLists.id, input.listId), eq(shareLists.createdBy, userId)))
        .limit(1);
      if (!existing) throw new Error("Share list not found or access denied");
      await db.delete(shareLists).where(eq(shareLists.id, input.listId));
      return { ok: true };
    }),
});

// ─── Extended share procedures (email gate, brain share) ──────────────────────

export const shareExtRouter = router({
  /**
   * Public — verify an email address against the domain allowlist.
   * Logs the access attempt and returns whether access is granted.
   */
  verifyShareAccess: publicProcedure
    .input(z.object({
      email: z.string().email(),
      tokenType: z.enum(["company", "list", "brain"]),
      tokenValue: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const domain = input.email.split("@")[1]?.toLowerCase() ?? "";

      // Check allowlist
      const allowed = await db
        .select()
        .from(shareAllowedDomains)
        .where(eq(shareAllowedDomains.domain, domain))
        .limit(1);

      const accessGranted = allowed.length > 0;

      // Log the attempt
      await db.insert(shareAccessLog).values({
        email: input.email.toLowerCase(),
        domain,
        tokenType: input.tokenType,
        tokenValue: input.tokenValue,
        accessGranted: accessGranted ? 1 : 0,
        ipAddress: null,
      });

      // Upsert visitor record for persistent identity tracking
      if (accessGranted) {
        const normalizedEmail = input.email.toLowerCase();
        const existing = await db
          .select()
          .from(shareVisitors)
          .where(eq(shareVisitors.email, normalizedEmail))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(shareVisitors)
            .set({ accessCount: existing[0].accessCount + 1 })
            .where(eq(shareVisitors.email, normalizedEmail));
        } else {
          await db.insert(shareVisitors).values({ email: normalizedEmail, accessCount: 1 });
        }
      }

      return { accessGranted, domain };
    }),

  /** Admin — get all allowed domains */
  getShareAllowedDomains: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    return db.select().from(shareAllowedDomains).orderBy(shareAllowedDomains.createdAt);
  }),

  /** Admin — add a domain to the allowlist */
  addShareAllowedDomain: protectedProcedure
    .input(z.object({ domain: z.string().min(3) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const domain = input.domain.toLowerCase().trim().replace(/^@/, "");
      await db.insert(shareAllowedDomains).values({ domain, addedBy: ctx.user.id });
      return { domain };
    }),

  /** Admin — remove a domain from the allowlist */
  removeShareAllowedDomain: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(shareAllowedDomains).where(eq(shareAllowedDomains.domain, input.domain));
      return { ok: true };
    }),

  /** Admin — get access log entries */
  getShareAccessLog: protectedProcedure
    .input(z.object({ limit: z.number().default(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { desc } = await import("drizzle-orm");
      return db
        .select()
        .from(shareAccessLog)
        .orderBy(desc(shareAccessLog.createdAt))
        .limit(input.limit);
    }),

  /** Admin — get all unique visitors */
  getShareVisitors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { desc } = await import("drizzle-orm");
    return db
      .select()
      .from(shareVisitors)
      .orderBy(desc(shareVisitors.lastSeen));
  }),

  /** Protected — create or reuse a brain share token */
  createBrainShareToken: protectedProcedure
    .input(z.object({ brainId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const existing = await db
        .select()
        .from(brainShareTokens)
        .where(and(eq(brainShareTokens.brainId, input.brainId), eq(brainShareTokens.createdBy, ctx.user.id)))
        .limit(1);
      if (existing.length > 0) return { token: existing[0].token };
      const token = crypto.randomBytes(16).toString("hex");
      await db.insert(brainShareTokens).values({ token, brainId: input.brainId, createdBy: ctx.user.id });
      return { token };
    }),

  /** Public — resolve a brain share token */
  resolveBrainToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db
        .select()
        .from(brainShareTokens)
        .where(eq(brainShareTokens.token, input.token))
        .limit(1);
      if (rows.length === 0) throw new Error("Invalid or expired brain share link");
      const brainRows = await db
        .select()
        .from(offeringBrain)
        .where(eq(offeringBrain.id, rows[0].brainId))
        .limit(1);
      if (brainRows.length === 0) throw new Error("Brain not found");
      return { brain: brainRows[0] };
    }),

  /**
   * Protected — create a shareable intelligence list.
   * Fetches all researched companies with fit > 50 from Supabase,
   * auto-generates share tokens for each, and returns a list token URL.
   */
  shareIntelligenceList: protectedProcedure
    .input(z.object({
      origin: z.string(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      campaignIds: z.array(z.number()).optional(),
      urgencyLabel: z.string().optional(),
      minFit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;

      // 1. Fetch companies from Supabase respecting the active filters
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      // Fetch in batches (Supabase max 1000 per query)
      let allRows: Array<{ page_url: string | null; campaign_id: number | null; company_name: string; domain: string | null; urgency_score: number | null; fit_score: number | null; urgency_label: string | null; campaign_name: string | null }> = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        let q = (supabase.from("lt_mns_company_pages") as any)
          .select("page_url, campaign_id, company_name, domain, urgency_score, fit_score, urgency_label, campaign_name")
          .not("page_url", "is", null)
          .order("urgency_score", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (input.dateFrom) q = q.gte("synced_at", input.dateFrom);
        if (input.dateTo) {
          const toDate = new Date(input.dateTo);
          toDate.setDate(toDate.getDate() + 1);
          q = q.lt("synced_at", toDate.toISOString());
        }
        if (input.minFit) q = q.gte("fit_score", input.minFit);
        if (input.urgencyLabel) q = q.eq("urgency_label", input.urgencyLabel);
        if (input.campaignIds && input.campaignIds.length > 0) q = q.in("campaign_id", input.campaignIds);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      if (allRows.length === 0) throw new Error("No companies match the active filters");

      // 2. For each company, find the brainId via searches table
      const { searches } = await import("../drizzle/schema");
      const searchCache = new Map<number, number | null>();

      const tokenResults: Array<{ companyId: number; brainId: number; token: string; tokenId: number }> = [];

      for (const row of allRows) {
        // Extract local company ID from page_url (e.g. "/company/1560001/extended?..." → 1560001)
        const localIdMatch = row.page_url?.match(/\/company\/(\d+)/);
        if (!localIdMatch) continue;
        const companyId = parseInt(localIdMatch[1], 10);
        if (isNaN(companyId)) continue;

        // Find brainId from campaign (searchId)
        let brainId: number | null = null;
        if (row.campaign_id) {
          if (searchCache.has(row.campaign_id)) {
            brainId = searchCache.get(row.campaign_id) ?? null;
          } else {
            const searchRows = await db.select({ brainId: searches.brainId }).from(searches).where(eq(searches.id, row.campaign_id)).limit(1);
            brainId = searchRows[0]?.brainId ?? null;
            searchCache.set(row.campaign_id, brainId);
          }
        }

        // Fallback: use the active brain
        if (!brainId) {
          const { getActiveBrain } = await import("./db");
          const active = await getActiveBrain(userId);
          brainId = active?.id ?? null;
        }
        if (!brainId) continue; // skip if no brain available

        // 3. Upsert share token
        const existing = await db
          .select()
          .from(shareTokens)
          .where(and(eq(shareTokens.companyId, companyId), eq(shareTokens.brainId, brainId), eq(shareTokens.createdBy, userId)))
          .limit(1);

        if (existing.length > 0) {
          tokenResults.push({ companyId, brainId, token: existing[0].token, tokenId: existing[0].id });
        } else {
          const token = generateToken();
          await db.insert(shareTokens).values({ token, companyId, brainId, createdBy: userId, shareListName: "Intelligence Share" });
          const inserted = await db.select().from(shareTokens).where(eq(shareTokens.token, token)).limit(1);
          tokenResults.push({ companyId, brainId, token, tokenId: inserted[0].id });
        }
      }

      if (tokenResults.length === 0) throw new Error("No companies could be shared (missing brain links)");

      // 4. Create the list-level token
      const listToken = generateToken();
      const listName = `Intelligence — ${new Date().toLocaleDateString()} (${tokenResults.length} companies)`;
      await db.insert(shareLists).values({ listToken, shareListName: listName, createdBy: userId });
      const listRows = await db.select().from(shareLists).where(eq(shareLists.listToken, listToken)).limit(1);
      const shareListId = listRows[0].id;

      // 5. Link tokens to the list
      for (const t of tokenResults) {
        await db.insert(shareListItems).values({ shareListId, shareTokenId: t.tokenId });
      }

      const listUrl = `${input.origin}/share/list/${listToken}`;
      return { listToken, listUrl, count: tokenResults.length };
    }),

  /**
   * Public — Find Decision-Makers at a company via share token.
   * Requires email verification (checked via shareAllowedDomains).
   * Saves found contacts to DB and returns them.
   */
  findDecisionMakers: publicProcedure
    .input(z.object({
      token: z.string(),
      visitorEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify visitor email is on allowlist
      const domain = input.visitorEmail.split("@")[1]?.toLowerCase() ?? "";
      const allowed = await db.select().from(shareAllowedDomains).where(eq(shareAllowedDomains.domain, domain)).limit(1);
      if (allowed.length === 0) throw new Error("Access denied: email domain not on allowlist");

      // Resolve token → company
      const tokenRows = await db.select().from(shareTokens).where(eq(shareTokens.token, input.token)).limit(1);
      if (tokenRows.length === 0) throw new Error("Invalid share token");
      const { companyId } = tokenRows[0];

      const companyRows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      if (companyRows.length === 0) throw new Error("Company not found");
      const company = companyRows[0];

      const companyDomain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : company.primaryDomain ?? null;
      if (!companyDomain) throw new Error("Company has no domain");

      // Run trickle-down decision-maker search
      const result = await trickleDownSearch(companyDomain, company.name ?? "", 5, false);

      // Upsert contacts to DB
      const savedContacts: any[] = [];
      const existingContacts = await getContactsByCompanyId(companyId);
      const existingEmails = new Set(existingContacts.map((c: any) => c.email?.toLowerCase()).filter(Boolean));
      const existingNames = new Set(existingContacts.map((c: any) => c.fullName?.toLowerCase()).filter(Boolean));

      for (const contact of result.contacts) {
        const emailKey = contact.email?.toLowerCase();
        const nameKey = contact.name?.toLowerCase();
        // Skip if already exists
        if ((emailKey && existingEmails.has(emailKey)) || (nameKey && existingNames.has(nameKey))) {
          savedContacts.push(existingContacts.find((c: any) => c.email?.toLowerCase() === emailKey || c.fullName?.toLowerCase() === nameKey));
          continue;
        }
        try {
          const saved = await createContact({
            companyId,
            apolloPersonId: contact.id ?? null,
            firstName: contact.firstName ?? null,
            lastName: contact.lastName ?? null,
            fullName: contact.name ?? null,
            title: contact.title ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            linkedinUrl: contact.linkedinUrl ?? null,
            searchedTitle: "Decision Maker",
          });
          savedContacts.push(saved);
          if (emailKey) existingEmails.add(emailKey);
          if (nameKey) existingNames.add(nameKey);
        } catch { /* skip duplicates */ }
      }

      return { contacts: savedContacts, tierLabel: result.tierLabel, tiersSearched: result.tiersSearched };
    }),

  /**
   * Public — Get All Personnel at a company via share token.
   * Requires email verification. Saves contacts to DB and returns them.
   */
  getAllPersonnelForShare: publicProcedure
    .input(z.object({
      token: z.string(),
      visitorEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify visitor email is on allowlist
      const domain = input.visitorEmail.split("@")[1]?.toLowerCase() ?? "";
      const allowed = await db.select().from(shareAllowedDomains).where(eq(shareAllowedDomains.domain, domain)).limit(1);
      if (allowed.length === 0) throw new Error("Access denied: email domain not on allowlist");

      // Resolve token → company
      const tokenRows = await db.select().from(shareTokens).where(eq(shareTokens.token, input.token)).limit(1);
      if (tokenRows.length === 0) throw new Error("Invalid share token");
      const { companyId } = tokenRows[0];

      const companyRows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      if (companyRows.length === 0) throw new Error("Company not found");
      const company = companyRows[0];

      const companyDomain = company.websiteUrl
        ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
        : company.primaryDomain ?? null;
      if (!companyDomain) throw new Error("Company has no domain");

      // Fetch ALL personnel from Apollo (no limit)
      const result = await getAllPersonnel(companyDomain, company.name ?? "", 500);

      // Upsert all contacts to DB
      const existingContacts = await getContactsByCompanyId(companyId);
      const existingEmails = new Set(existingContacts.map((c: any) => c.email?.toLowerCase()).filter(Boolean));
      const existingNames = new Set(existingContacts.map((c: any) => c.fullName?.toLowerCase()).filter(Boolean));

      for (const contact of result.contacts) {
        const emailKey = contact.email?.toLowerCase();
        const nameKey = contact.name?.toLowerCase();
        if ((emailKey && existingEmails.has(emailKey)) || (nameKey && existingNames.has(nameKey))) continue;
        try {
          await createContact({
            companyId,
            apolloPersonId: contact.id ?? null,
            firstName: contact.firstName ?? null,
            lastName: contact.lastName ?? null,
            fullName: contact.name ?? null,
            title: contact.title ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            linkedinUrl: contact.linkedinUrl ?? null,
            searchedTitle: "All Personnel",
          });
          if (emailKey) existingEmails.add(emailKey);
          if (nameKey) existingNames.add(nameKey);
        } catch { /* skip duplicates */ }
      }

      // Stamp contactsFetchedAt on the company
      await db.update(companies).set({ contactsFetchedAt: new Date() }).where(eq(companies.id, companyId));

      // Return all stored contacts
      const allContacts = await getContactsByCompanyId(companyId);
      return { contacts: allContacts, total: result.totalFound, fetchedAt: new Date() };
    }),

  /** Public -- get stored contacts for a company via share token (no Apollo call) */
  getStoredContacts: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const tokenRows = await db.select().from(shareTokens).where(eq(shareTokens.token, input.token)).limit(1);
      if (tokenRows.length === 0) throw new Error("Invalid share token");
      const { companyId } = tokenRows[0];

      const companyRows = await db.select({ contactsFetchedAt: companies.contactsFetchedAt })
        .from(companies).where(eq(companies.id, companyId)).limit(1);
      const fetchedAt = companyRows[0]?.contactsFetchedAt ?? null;

      const storedContacts = await getContactsByCompanyId(companyId);
      return { contacts: storedContacts, fetchedAt };
    }),

  /** Public -- list ALL brains with their share tokens (if any) for the overview page */
  listSharedBrains: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    // Get all brains
    const brainRows = await db.select().from(offeringBrain);
    // Get all share tokens
    const tokenRows = await db.select().from(brainShareTokens);
    // Map brains with their first token
    const tokenMap = new Map<number, string>();
    for (const t of tokenRows) {
      if (!tokenMap.has(t.brainId)) tokenMap.set(t.brainId, t.token);
    }
    const brains = brainRows.map((b) => ({
      id: b.id,
      brainName: b.brainName,
      companyName: b.companyName,
      companyWebsite: b.companyWebsite,
      offeringSummary: b.offeringSummary,
      isActive: b.isActive,
      showOnLeadtrigger: b.showOnLeadtrigger,
      token: tokenMap.get(b.id) ?? "",
    }));
    return { brains };
  }),

  /**
   * Returns all share lists created by the current user, with company count.
   */
  getShareLists: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await conn.execute<any[]>(
        `SELECT sl.id, sl.listToken, sl.shareListName, sl.createdAt,
                COUNT(sli.id) AS companyCount
         FROM share_lists sl
         LEFT JOIN share_list_items sli ON sli.shareListId = sl.id
         WHERE sl.createdBy = ?
         GROUP BY sl.id
         ORDER BY sl.createdAt DESC`,
        [userId]
      );
      const lists = rows.map((r: any) => ({
        id: Number(r.id),
        listToken: String(r.listToken),
        shareListName: r.shareListName ? String(r.shareListName) : null,
        createdAt: new Date(r.createdAt),
        companyCount: Number(r.companyCount),
      }));
      return { lists };
    } finally {
      await conn.end();
    }
  }),

  /**
   * Delete a share list (and cascade-delete its items via FK).
   * Only the owner can delete their own list.
   */
  deleteShareList: protectedProcedure
    .input(z.object({ listId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;
      // Verify ownership
      const [existing] = await db
        .select({ id: shareLists.id })
        .from(shareLists)
        .where(and(eq(shareLists.id, input.listId), eq(shareLists.createdBy, userId)))
        .limit(1);
      if (!existing) throw new Error("Share list not found or access denied");
      await db.delete(shareLists).where(eq(shareLists.id, input.listId));
      return { ok: true };
    }),
});
