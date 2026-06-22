import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { companies, companyBrainOutputs, searches } from "../drizzle/schema";
import {
  createCompanies,
  createSearch,
  getCompanyBrainOutputsForSearch,
  getDb,
  type CompanyDbSortBy,
} from "./db";

export const COMPANY_DB_CAMPAIGN_MAX = 100;

export type CloneCompaniesToCampaignOpts = {
  userId: number;
  brainId: number;
  campaignName: string;
  companyIds: number[];
};

export type CloneCompaniesToCampaignResult = {
  searchId: number;
  companiesCopied: number;
};

function companyMatchKey(c: {
  apolloId?: string | null;
  primaryDomain?: string | null;
  name: string;
  country?: string | null;
}): string {
  if (c.apolloId) return `apollo:${c.apolloId}`;
  const domain = c.primaryDomain?.trim().toLowerCase();
  if (domain) return `domain:${domain}`;
  return `name:${c.name.trim().toLowerCase()}|${(c.country ?? "").trim().toLowerCase()}`;
}

/**
 * Clone up to 100 companies (full row + brain outputs) into a new campaign search.
 * Preserves scores, briefs, and sales approaches — no campaign queue jobs.
 */
export async function cloneCompaniesToCampaign(
  opts: CloneCompaniesToCampaignOpts
): Promise<CloneCompaniesToCampaignResult> {
  const { userId, brainId, campaignName, companyIds } = opts;

  if (companyIds.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No companies selected" });
  }
  if (companyIds.length > COMPANY_DB_CAMPAIGN_MAX) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Maximum ${COMPANY_DB_CAMPAIGN_MAX} companies per campaign`,
    });
  }

  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  }

  const brainRows = await db.execute(
    sql`SELECT id, brainName, companyWebsite FROM offering_brain WHERE id = ${brainId} LIMIT 1`
  ) as unknown as { id: number; brainName: string; companyWebsite: string }[];
  const brainArr = Array.isArray(brainRows[0]) ? brainRows[0] : brainRows;
  if (!brainArr?.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Brain ${brainId} not found` });
  }
  const brain = brainArr[0] as { id: number; brainName: string; companyWebsite: string };

  const uniqueIds = [...new Set(companyIds)];
  const sourceCompanies = await db
    .select()
    .from(companies)
    .where(inArray(companies.id, uniqueIds));

  if (sourceCompanies.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No matching companies found" });
  }

  const searchId = await createSearch({
    userId,
    companyWebsite: brain.companyWebsite || "company-database",
    location: campaignName,
    offeringName: `[DB] ${campaignName}`,
    brainId,
    status: "completed",
    sharedWithTeam: 0,
    isArchived: 0,
  });

  const sourceBrainOutputs = await getCompanyBrainOutputsForSearch(
    sourceCompanies.map((c) => c.id),
    brainId
  );

  let copied = 0;
  try {
    const BATCH_SIZE = 100;
    for (let i = 0; i < sourceCompanies.length; i += BATCH_SIZE) {
      const batch = sourceCompanies.slice(i, i + BATCH_SIZE).map((c) => {
        const { id: _id, searchId: _searchId, ...rest } = c;
        return { ...rest, searchId };
      });
      await createCompanies(batch);
      copied += batch.length;
    }

    const newCompanies = await db
      .select({
        id: companies.id,
        apolloId: companies.apolloId,
        primaryDomain: companies.primaryDomain,
        name: companies.name,
        country: companies.country,
      })
      .from(companies)
      .where(eq(companies.searchId, searchId));

    const newByKey = new Map<string, number>();
    for (const row of newCompanies) {
      newByKey.set(companyMatchKey(row), row.id);
    }

    const outputRows: (typeof companyBrainOutputs.$inferInsert)[] = [];
    for (const source of sourceCompanies) {
      const output = sourceBrainOutputs.get(source.id);
      if (!output) continue;
      const newCompanyId = newByKey.get(companyMatchKey(source));
      if (!newCompanyId) continue;
      const { id: _oid, companyId: _oc, createdAt: _ca, updatedAt: _ua, ...outputRest } = output;
      outputRows.push({
        ...outputRest,
        companyId: newCompanyId,
        brainId,
      });
    }

    if (outputRows.length > 0) {
      await db.insert(companyBrainOutputs).values(outputRows);
    }
  } catch (copyErr: unknown) {
    try {
      await db.delete(searches).where(eq(searches.id, searchId));
    } catch {
      /* best-effort rollback */
    }
    const message = copyErr instanceof Error ? copyErr.message : String(copyErr);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to copy companies into campaign: ${message}`,
    });
  }

  if (copied === 0) {
    try {
      await db.delete(searches).where(eq(searches.id, searchId));
    } catch {
      /* best-effort rollback */
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Campaign creation failed: 0 companies were copied",
    });
  }

  console.log(
    `[companyDbCampaign] Created "[DB] ${campaignName}" (searchId=${searchId}) with ${copied} companies`
  );

  return { searchId, companiesCopied: copied };
}

export type CompanyDbFilterParams = {
  sortBy?: CompanyDbSortBy;
  sortDir?: "asc" | "desc";
  search?: string;
  searchId?: number;
  searchIds?: number[];
  country?: string;
  countries?: string[];
  sector?: string;
  brainId?: number;
  minFitScore?: number;
  hasFitScore?: boolean;
  articleFilter?: "any" | "brief" | "approach" | "both" | "none";
  cgBusinessUnit?: string;
  cgLeadClass?: string;
  cgLeadOrigin?: string;
  crmFilter?: "in" | "not_in";
};

export async function resolveCompanyIdsFromFilter(
  filter: CompanyDbFilterParams
): Promise<{ companyIds: number[]; totalMatched: number }> {
  const { getCompanyDatabase, countCompanyDatabase } = await import("./db");
  const articleFilter =
    filter.articleFilter && filter.articleFilter !== "any" ? filter.articleFilter : undefined;

  const [rows, totalMatched] = await Promise.all([
    getCompanyDatabase({
      limit: COMPANY_DB_CAMPAIGN_MAX,
      offset: 0,
      sortBy: filter.sortBy,
      sortDir: filter.sortDir,
      search: filter.search,
      searchId: filter.searchId,
      searchIds: filter.searchIds,
      country: filter.country,
      countries: filter.countries,
      sector: filter.sector,
      brainId: filter.brainId,
      minFitScore: filter.minFitScore,
      hasFitScore: filter.hasFitScore,
      articleFilter,
      cgBusinessUnit: filter.cgBusinessUnit,
      cgLeadClass: filter.cgLeadClass,
      cgLeadOrigin: filter.cgLeadOrigin,
      crmFilter: filter.crmFilter,
    }),
    countCompanyDatabase({
      search: filter.search,
      searchId: filter.searchId,
      searchIds: filter.searchIds,
      country: filter.country,
      countries: filter.countries,
      sector: filter.sector,
      brainId: filter.brainId,
      minFitScore: filter.minFitScore,
      hasFitScore: filter.hasFitScore,
      articleFilter,
      cgBusinessUnit: filter.cgBusinessUnit,
      cgLeadClass: filter.cgLeadClass,
      cgLeadOrigin: filter.cgLeadOrigin,
      crmFilter: filter.crmFilter,
    }),
  ]);

  return {
    companyIds: rows.map((r) => r.id),
    totalMatched,
  };
}
