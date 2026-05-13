/**
 * Leadinfo Router — tRPC procedures for importing, matching, and querying
 * Leadinfo website visitor data.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leadinfoVisits, companies } from "../drizzle/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { normaliseDomain as _normaliseDomain } from "./leadinfoService";
import {
  parseLeadinfoExcel,
  enrichCompanies,
  matchCompaniesToCampaign,
} from "./leadinfoService";
import { randomUUID } from "crypto";

export const leadinfoRouter = router({
  /**
   * Upload a Leadinfo Excel export, parse it, and match against a campaign.
   * Returns match preview before committing.
   */
  importPreview: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string(), // Base64-encoded Excel file
        searchId: z.number(), // Campaign to match against
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const { companies: parsedCompanies, pageViews, warnings } =
        parseLeadinfoExcel(buffer);

      // Enrich with page view data
      const enriched = enrichCompanies(parsedCompanies, pageViews);

      // Fetch campaign companies for matching
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const campaignCompanies = await db
        .select({
          id: companies.id,
          name: companies.name,
          primaryDomain: companies.primaryDomain,
          websiteUrl: companies.websiteUrl,
        })
        .from(companies)
        .where(eq(companies.searchId, input.searchId));

      // Match
      const matches = matchCompaniesToCampaign(enriched, campaignCompanies);

      const matched = matches.filter((m) => m.matchType !== "unmatched");
      const unmatched = matches.filter((m) => m.matchType === "unmatched");

      return {
        totalCompanies: parsedCompanies.length,
        totalPageViews: pageViews.length,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        warnings,
        matches: matches.map((m) => ({
          companyName: m.leadinfoCompany.companyName,
          domain: m.leadinfoCompany.domain,
          matchedCompanyId: m.matchedCompanyId,
          matchedCompanyName: m.matchedCompanyName,
          matchType: m.matchType,
          engagementScore: m.leadinfoCompany.engagementScore,
          sessions: m.leadinfoCompany.sessions,
          pages: m.leadinfoCompany.pages,
          duration: m.leadinfoCompany.duration,
          intentSignals: m.leadinfoCompany.intentSignals,
          personas: m.leadinfoCompany.personas,
          topPages: m.leadinfoCompany.topPages,
        })),
      };
    }),

  /**
   * Commit the import — save matched (and optionally unmatched) Leadinfo data to DB.
   */
  importCommit: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        searchId: z.number(),
        includeUnmatched: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const { companies: parsedCompanies, pageViews } =
        parseLeadinfoExcel(buffer);
      const enriched = enrichCompanies(parsedCompanies, pageViews);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const campaignCompanies = await db
        .select({
          id: companies.id,
          name: companies.name,
          primaryDomain: companies.primaryDomain,
          websiteUrl: companies.websiteUrl,
        })
        .from(companies)
        .where(eq(companies.searchId, input.searchId));

      const matches = matchCompaniesToCampaign(enriched, campaignCompanies);
      const batchId = randomUUID();
      let savedCount = 0;

      for (const m of matches) {
        if (!input.includeUnmatched && m.matchType === "unmatched") continue;

        const lc = m.leadinfoCompany;
        await db.insert(leadinfoVisits).values({
          userId: ctx.user.id,
          searchId: input.searchId,
          companyId: m.matchedCompanyId,
          companyName: lc.companyName,
          domain: lc.domain,
          rawUrl: lc.url,
          city: lc.city || null,
          country: lc.country || null,
          salesRegion: lc.salesRegion || null,
          employees: lc.employees,
          branch: lc.branch || null,
          linkedinUrl: lc.linkedinUrl || null,
          salesVolume: lc.salesVolume || null,
          totalPages: lc.pages,
          totalSessions: lc.sessions,
          totalDuration: lc.duration,
          engagementScore: lc.engagementScore,
          pagesViewed: JSON.stringify(lc.pagesViewed),
          topPages: JSON.stringify(lc.topPages),
          intentSignals: JSON.stringify(lc.intentSignals),
          personas: JSON.stringify(lc.personas),
          importBatchId: batchId,
        });
        savedCount++;
      }

      const matchedCount = matches.filter(
        (m) => m.matchType !== "unmatched"
      ).length;

      return {
        batchId,
        savedCount,
        matchedCount,
        totalParsed: enriched.length,
      };
    }),

  /**
   * Get Leadinfo visit data for a specific company.
   * First tries direct companyId match; falls back to domain matching across all campaigns.
   */
  getByCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // 1. Direct companyId match (fast path)
      const direct = await db
        .select()
        .from(leadinfoVisits)
        .where(eq(leadinfoVisits.companyId, input.companyId))
        .orderBy(sql`${leadinfoVisits.importedAt} DESC`)
        .limit(1);

      if (direct[0]) return direct[0];

      // 2. Domain fallback — look up the company's domain, then find any Leadinfo record with that domain
      const companyRow = await db
        .select({ websiteUrl: companies.websiteUrl, primaryDomain: companies.primaryDomain })
        .from(companies)
        .where(eq(companies.id, input.companyId))
        .limit(1);

      if (!companyRow[0]) return null;

      const rawDomain =
        companyRow[0].primaryDomain ||
        companyRow[0].websiteUrl ||
        "";
      const domain = _normaliseDomain(rawDomain);
      if (!domain) return null;

      const byDomain = await db
        .select()
        .from(leadinfoVisits)
        .where(eq(leadinfoVisits.domain, domain))
        .orderBy(sql`${leadinfoVisits.engagementScore} DESC, ${leadinfoVisits.importedAt} DESC`)
        .limit(1);

      return byDomain[0] || null;
    }),

  /**
   * Get all Leadinfo visits for a campaign (search).
   */
  getByCampaign: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(leadinfoVisits)
        .where(eq(leadinfoVisits.searchId, input.searchId))
        .orderBy(sql`${leadinfoVisits.engagementScore} DESC`);
    }),

  /**
   * Get company IDs that have Leadinfo data for a given campaign.
   * Combines direct companyId matches (same campaign) with domain-based cross-campaign matches.
   */
  getMatchedCompanyIds: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // 1. Direct matches — Leadinfo records already linked to this campaign's companies
      const directRows = await db
        .select({ companyId: leadinfoVisits.companyId })
        .from(leadinfoVisits)
        .where(
          and(
            eq(leadinfoVisits.searchId, input.searchId),
            isNotNull(leadinfoVisits.companyId)
          )
        );
      const directIds = new Set(directRows.map((r) => r.companyId!));

      // 2. Domain-based cross-campaign matches
      // Get all domains that have ANY Leadinfo record
      const allLeadinfoDomains = await db
        .select({ domain: leadinfoVisits.domain })
        .from(leadinfoVisits)
        .where(isNotNull(leadinfoVisits.domain))
        .groupBy(leadinfoVisits.domain);

      const leadinfoDomainSet = new Set(
        allLeadinfoDomains.map((r) => r.domain).filter(Boolean)
      );

      if (leadinfoDomainSet.size === 0) return Array.from(directIds);

      // Find companies in this campaign whose domain matches a Leadinfo domain
      const campaignCompanies = await db
        .select({
          id: companies.id,
          websiteUrl: companies.websiteUrl,
          primaryDomain: companies.primaryDomain,
        })
        .from(companies)
        .where(eq(companies.searchId, input.searchId));

      const crossIds = new Set<number>();
      for (const c of campaignCompanies) {
        if (directIds.has(c.id)) continue; // already included
        const domain = _normaliseDomain(c.primaryDomain || c.websiteUrl || "");
        if (domain && leadinfoDomainSet.has(domain)) {
          crossIds.add(c.id);
        }
      }

      return [...Array.from(directIds), ...Array.from(crossIds)];
    }),

  /**
   * Get import history — list of past imports grouped by batch.
   */
  importHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        importBatchId: leadinfoVisits.importBatchId,
        searchId: leadinfoVisits.searchId,
        count: sql<number>`COUNT(*)`,
        matchedCount: sql<number>`SUM(CASE WHEN ${leadinfoVisits.companyId} IS NOT NULL THEN 1 ELSE 0 END)`,
        importedAt: sql<Date>`MIN(${leadinfoVisits.importedAt})`,
      })
      .from(leadinfoVisits)
      .where(eq(leadinfoVisits.userId, ctx.user.id))
      .groupBy(leadinfoVisits.importBatchId, leadinfoVisits.searchId)
      .orderBy(sql`MIN(${leadinfoVisits.importedAt}) DESC`);

    return rows;
  }),
});
