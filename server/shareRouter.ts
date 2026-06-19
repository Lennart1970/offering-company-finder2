import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, desc, gte, inArray, sql } from "drizzle-orm";
import crypto from "crypto";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, batchFindCgLeadsForCompanies, createContact, getContactsByCompanyId } from "./db";
import { getCachedToken, setCachedToken, getCachedList, setCachedList, invalidateToken } from "./shareCache";
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
  shareFeedback,
  brainShareTokens,
  shareVisitors,
  shareContactRetrievalLog,
  shareResearchRequests,
  leadinfoVisits,
} from "../drizzle/schema";

const SHARE_RESEARCH_DAILY_LIMIT = 10;
const LLM_SCORE_FRESH_MS = 3 * 24 * 60 * 60 * 1000;

function hasFreshLlmScore(
  fitScoreSource: string | null | undefined,
  fitScoreGeneratedAt: Date | string | null | undefined,
): boolean {
  if (fitScoreSource !== "llm" || !fitScoreGeneratedAt) return false;
  const age = Date.now() - new Date(fitScoreGeneratedAt).getTime();
  return age >= 0 && age < LLM_SCORE_FRESH_MS;
}

/** Auto-complete pending requests when the company already has a fresh LLM fit score. */
async function autoCompleteResearchRequestsWithFreshLlmScore(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<number> {
  const pending = await db
    .select({
      id: shareResearchRequests.id,
      companyId: shareResearchRequests.companyId,
    })
    .from(shareResearchRequests)
    .where(eq(shareResearchRequests.status, "pending"));

  if (pending.length === 0) return 0;

  const companyIds = [...new Set(pending.map((r) => r.companyId))];
  const companyRows = await db
    .select({
      id: companies.id,
      fitScoreSource: companies.fitScoreSource,
      fitScoreGeneratedAt: companies.fitScoreGeneratedAt,
    })
    .from(companies)
    .where(inArray(companies.id, companyIds));

  const freshCompanyIds = new Set(
    companyRows
      .filter((c) => hasFreshLlmScore(c.fitScoreSource, c.fitScoreGeneratedAt))
      .map((c) => c.id),
  );

  const toComplete = pending.filter((r) => freshCompanyIds.has(r.companyId)).map((r) => r.id);
  if (toComplete.length === 0) return 0;

  await db
    .update(shareResearchRequests)
    .set({ status: "completed" })
    .where(inArray(shareResearchRequests.id, toComplete));

  return toComplete.length;
}

/** Generate a cryptographically random 32-char hex token */
function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function logShareContactRetrieval(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  params: {
    visitorEmail: string;
    shareToken: string;
    companyId: number;
    companyName: string | null;
    actionType: "decision_makers" | "all_personnel";
    contactsReturned: number;
  }
) {
  const domain = params.visitorEmail.split("@")[1]?.toLowerCase() ?? "";
  await db.insert(shareContactRetrievalLog).values({
    visitorEmail: params.visitorEmail.toLowerCase(),
    domain,
    shareToken: params.shareToken,
    companyId: params.companyId,
    companyName: params.companyName,
    actionType: params.actionType,
    contactsReturned: params.contactsReturned,
  });
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
      // Skip cache if it has no leadinfo data (domain-based fallback may now find it)
      const cached = getCachedToken(input.token);
      if (cached && cached.leadinfo !== null) return cached;
      if (cached) {
        // Cached but leadinfo was null — invalidate so we re-query with domain fallback
        invalidateToken(input.token);
      }

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
      // First try direct companyId match; if nothing found, fall back to domain-based match
      let leadinfoRows = await db
        .select()
        .from(leadinfoVisits)
        .where(eq(leadinfoVisits.companyId, tokenRow.companyId));

      if (leadinfoRows.length === 0 && company.websiteUrl) {
        // Normalise domain: strip protocol, www., trailing slash
        const normDomain = (url: string) =>
          url.toLowerCase().replace(/^https?:\/\//, "").replace(/^\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0].replace(/\/$/, "");
        const companyDomain = normDomain(company.websiteUrl);
        if (companyDomain) {
          // Find all companies sharing the same domain across all campaigns
          const domainCompanies = await db
            .select({ id: companies.id })
            .from(companies)
            .where(or(
              eq(companies.websiteUrl, company.websiteUrl),
              eq(companies.websiteUrl, `https://${companyDomain}`),
              eq(companies.websiteUrl, `http://${companyDomain}`),
              eq(companies.websiteUrl, `https://www.${companyDomain}`),
              eq(companies.websiteUrl, `http://www.${companyDomain}`),
            ));
          const domainIds = domainCompanies.map(c => c.id);
          if (domainIds.length > 0) {
            leadinfoRows = await db
              .select()
              .from(leadinfoVisits)
              .where(inArray(leadinfoVisits.companyId, domainIds));
          }
        }
      }
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
      // Derive dominant brainId from the items
      const brainFreq2 = new Map<number, number>();
      for (const t of tokenResults) { brainFreq2.set(t.brainId, (brainFreq2.get(t.brainId) ?? 0) + 1); }
      const dominantBrainId2 = Array.from(brainFreq2.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const listToken = generateToken();
      await db.insert(shareLists).values({ listToken, shareListName: input.shareListName ?? null, createdBy: userId, brainId: dominantBrainId2 ?? undefined });
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

      const crmMap = await batchFindCgLeadsForCompanies(companyRows.map((r) => r.companyId));
      const enrichedCompanies = companyRows.map((row) => {
        const crm = crmMap.get(row.companyId);
        return {
          ...row,
          linkId: crm ? String(crm.linkId) : null,
          sharepointPageLink: crm?.sharepointPageLink ?? null,
        };
      });

      const result = {
        shareListName: shareList.shareListName,
        createdAt: shareList.createdAt,
        companies: enrichedCompanies,
      };

      // Cache for 24h
      setCachedList(input.listToken, result);

      return result;
    }),

  /**
   * Returns all share lists — public, no login required.
   */
  getShareLists: publicProcedure.query(async () => {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const [rows] = await conn.execute<any[]>(
        `SELECT sl.id, sl.listToken, sl.shareListName, sl.createdAt, sl.brainId,
                ob.brainName,
                COUNT(sli.id) AS companyCount
         FROM share_lists sl
         LEFT JOIN share_list_items sli ON sli.shareListId = sl.id
         LEFT JOIN offering_brain ob ON ob.id = sl.brainId
         GROUP BY sl.id, ob.brainName
         ORDER BY sl.createdAt DESC`
      );
      const lists = rows.map((r: any) => ({
        id: Number(r.id),
        listToken: String(r.listToken),
        shareListName: r.shareListName ? String(r.shareListName) : null,
        createdAt: new Date(r.createdAt),
        companyCount: Number(r.companyCount),
        brainId: r.brainId ? Number(r.brainId) : null,
        brainName: r.brainName ? String(r.brainName) : null,
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

  /**
   * Rename a share list. Only the owner can rename their own list.
   */
  renameShareList: protectedProcedure
    .input(z.object({ listId: z.number(), name: z.string().max(200) }))
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
      await db
        .update(shareLists)
        .set({ shareListName: input.name.trim() || null })
        .where(eq(shareLists.id, input.listId));
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

  /** Public — check remaining deep-research request quota for a visitor email today */
  getResearchRequestQuota: publicProcedure
    .input(z.object({ visitorEmail: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const normalizedEmail = input.visitorEmail.toLowerCase().trim();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(shareResearchRequests)
        .where(and(
          eq(shareResearchRequests.visitorEmail, normalizedEmail),
          gte(shareResearchRequests.createdAt, todayStart),
        ));

      const usedToday = Number(countRow?.count ?? 0);
      return {
        limit: SHARE_RESEARCH_DAILY_LIMIT,
        usedToday,
        remaining: Math.max(0, SHARE_RESEARCH_DAILY_LIMIT - usedToday),
      };
    }),

  /**
   * Public — request deep research + outreach for a company on a share page.
   * Log-only: internal team processes manually. Max 10 requests per visitor email per day.
   */
  requestDeepResearch: publicProcedure
    .input(z.object({
      token: z.string(),
      visitorEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const normalizedEmail = input.visitorEmail.toLowerCase().trim();
      const domain = normalizedEmail.split("@")[1] ?? "";

      const allowed = await db
        .select()
        .from(shareAllowedDomains)
        .where(eq(shareAllowedDomains.domain, domain))
        .limit(1);
      if (allowed.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied: email domain not on allowlist",
        });
      }

      const tokenRows = await db
        .select()
        .from(shareTokens)
        .where(eq(shareTokens.token, input.token))
        .limit(1);
      if (tokenRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid share token" });
      }
      const tokenRow = tokenRows[0];

      const companyRows = await db
        .select()
        .from(companies)
        .where(eq(companies.id, tokenRow.companyId))
        .limit(1);
      if (companyRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      }
      const company = companyRows[0];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(shareResearchRequests)
        .where(and(
          eq(shareResearchRequests.visitorEmail, normalizedEmail),
          gte(shareResearchRequests.createdAt, todayStart),
        ));

      const usedToday = Number(countRow?.count ?? 0);
      if (usedToday >= SHARE_RESEARCH_DAILY_LIMIT) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Daily limit reached (${SHARE_RESEARCH_DAILY_LIMIT} requests per day). Try again tomorrow.`,
        });
      }

      const autoCompleted = hasFreshLlmScore(company.fitScoreSource, company.fitScoreGeneratedAt);

      await db.insert(shareResearchRequests).values({
        visitorEmail: normalizedEmail,
        domain,
        shareToken: input.token,
        companyId: company.id,
        companyName: company.name ?? null,
        brainId: tokenRow.brainId,
        status: autoCompleted ? "completed" : "pending",
      });

      return {
        ok: true,
        autoCompleted,
        remainingToday: SHARE_RESEARCH_DAILY_LIMIT - usedToday - 1,
      };
    }),

  /** Admin — deep research requests from share pages (auto-completes when LLM score < 3 days old) */
  getShareResearchRequests: protectedProcedure
    .input(z.object({ limit: z.number().default(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await autoCompleteResearchRequestsWithFreshLlmScore(db);
      return db
        .select()
        .from(shareResearchRequests)
        .orderBy(desc(shareResearchRequests.createdAt))
        .limit(input.limit);
    }),

  /** Admin — mark a share research request completed or cancelled */
  updateShareResearchRequestStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["completed", "cancelled"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [existing] = await db
        .select({ id: shareResearchRequests.id })
        .from(shareResearchRequests)
        .where(eq(shareResearchRequests.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Research request not found" });
      }

      await db
        .update(shareResearchRequests)
        .set({ status: input.status })
        .where(eq(shareResearchRequests.id, input.id));

      return { ok: true };
    }),

  /** Admin — who retrieved contact details on share pages */
  getShareContactRetrievalLog: protectedProcedure
    .input(z.object({ limit: z.number().default(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db
        .select()
        .from(shareContactRetrievalLog)
        .orderBy(desc(shareContactRetrievalLog.createdAt))
        .limit(input.limit);
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

      // 1. Fetch companies from MySQL directly (source of truth — Supabase may be stale)
      const { isNotNull, gte: gteOp, inArray: inArrayOp } = await import("drizzle-orm");
      const { searches } = await import("../drizzle/schema");

      // Build conditions
      const conditions: any[] = [isNotNull(companies.briefData)];
      if (input.campaignIds && input.campaignIds.length > 0) {
        conditions.push(inArrayOp(companies.searchId, input.campaignIds));
      }
      if (input.urgencyLabel) {
        // urgencyLabel is stored in fitScoreData.label — filter by score range instead
        if (input.urgencyLabel === "HIGH") conditions.push(gteOp(companies.urgencyScore, 70));
        else if (input.urgencyLabel === "MEDIUM") {
          const { between } = await import("drizzle-orm");
          conditions.push(between(companies.urgencyScore, 40, 69));
        } else if (input.urgencyLabel === "LOW") {
          const { lt: ltOp } = await import("drizzle-orm");
          conditions.push(ltOp(companies.urgencyScore, 40));
        }
      }
      if (input.minFit) {
        conditions.push(gteOp(companies.fitScore, input.minFit));
      }

      const mysqlRows = await db
        .select({ company: companies, search: searches })
        .from(companies)
        .leftJoin(searches, eq(companies.searchId, searches.id))
        .where(and(...conditions))
        .orderBy(companies.urgencyScore)
        .limit(2000);

      if (mysqlRows.length === 0) throw new Error("No companies match the active filters");

      // 2. For each company, find the brainId via searches table
      const searchCache = new Map<number, number | null>();

      const tokenResults: Array<{ companyId: number; brainId: number; token: string; tokenId: number }> = [];

      for (const { company: row, search } of mysqlRows) {
        const companyId = row.id;

        // Find brainId from campaign (searchId)
        let brainId: number | null = null;
        const campaignId = row.searchId;
        if (campaignId) {
          if (searchCache.has(campaignId)) {
            brainId = searchCache.get(campaignId) ?? null;
          } else {
            brainId = search?.brainId ?? null;
            searchCache.set(campaignId, brainId);
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
      // Determine dominant brainId (most frequently used across all tokens in this list)
      const brainFreq = new Map<number, number>();
      for (const t of tokenResults) { brainFreq.set(t.brainId, (brainFreq.get(t.brainId) ?? 0) + 1); }
      const dominantBrainId = Array.from(brainFreq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const listToken = generateToken();
      const listName = `Intelligence — ${new Date().toLocaleDateString()} (${tokenResults.length} companies)`;
      await db.insert(shareLists).values({ listToken, shareListName: listName, createdBy: userId, brainId: dominantBrainId ?? undefined });;
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

      const returned = savedContacts.filter(Boolean);
      await logShareContactRetrieval(db, {
        visitorEmail: input.visitorEmail,
        shareToken: input.token,
        companyId,
        companyName: company.name ?? null,
        actionType: "decision_makers",
        contactsReturned: returned.length,
      });

      return { contacts: returned, tierLabel: result.tierLabel, tiersSearched: result.tiersSearched };
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

      await logShareContactRetrieval(db, {
        visitorEmail: input.visitorEmail,
        shareToken: input.token,
        companyId,
        companyName: company.name ?? null,
        actionType: "all_personnel",
        contactsReturned: allContacts.length,
      });

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

  /**
   * Admin: fetch all feedback rows from MySQL share_feedback.
   * Protected — only logged-in users.
   */
  getFeedback: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const rows = await db
      .select()
      .from(shareFeedback)
      .orderBy(desc(shareFeedback.submittedAt))
      .limit(500);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        shareToken: r.shareToken,
        companyId: r.companyId ?? null,
        companyName: r.companyName ?? null,
        rating: r.rating ?? null,
        comment: r.comment ?? null,
        submitterName: r.submitterName ?? null,
        submitterEmail: r.submitterEmail ?? null,
        submittedAt: r.submittedAt instanceof Date ? r.submittedAt.toISOString() : String(r.submittedAt),
      })),
    };
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

});
