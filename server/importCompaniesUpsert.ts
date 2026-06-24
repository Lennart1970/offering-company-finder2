/**
 * Global company import upsert — used by Apollo CSV / Excel import paths.
 *
 * - Dedupes within the upload batch (apolloId, else normalizedDomain)
 * - Matches existing rows globally (apolloId first, then normalizedDomain)
 * - Inserts only genuinely new companies
 * - Updates firmographics on match without overwriting enrichment, scores, or briefs
 */

import { and, inArray, isNotNull } from "drizzle-orm";
import { companies, type Company, type InsertCompany } from "../drizzle/schema";
import { createCompanies, getDb, linkCompaniesToSearch, updateCompany } from "./db";
import { normalizeCompanyDomain } from "./normalizeCompanyDomain";

export type ImportCompanyRow = Omit<InsertCompany, "id" | "createdAt">;

export type ImportUpsertResult = {
  inserted: number;
  updated: number;
  /** Existing companies linked to the target campaign via junction table */
  linked: number;
  unchanged: number;
  /** Rows dropped as duplicates within the same upload file */
  dedupedInFile: number;
};

const FIRMOPGRAPHIC_FIELDS = [
  "name",
  "websiteUrl",
  "primaryDomain",
  "linkedinUrl",
  "twitterUrl",
  "facebookUrl",
  "phone",
  "foundedYear",
  "revenue",
  "headcountGrowth",
  "parentCompanyName",
  "parentCompanyId",
  "searchLocation",
  "city",
  "state",
  "country",
  "streetAddress",
  "rawAddress",
  "sicCodes",
  "naicsCodes",
  "sector",
  "sliceMetadata",
] as const satisfies readonly (keyof ImportCompanyRow)[];

type FirmographicField = (typeof FIRMOPGRAPHIC_FIELDS)[number];

function stampNormalizedDomain(row: ImportCompanyRow): ImportCompanyRow {
  return {
    ...row,
    normalizedDomain:
      row.normalizedDomain ??
      normalizeCompanyDomain({
        primaryDomain: row.primaryDomain,
        websiteUrl: row.websiteUrl,
      }),
  };
}

/** Dedupe within a single upload — last row wins per apolloId / domain key. */
export function dedupeImportRows(rows: ImportCompanyRow[]): {
  unique: ImportCompanyRow[];
  dedupedInFile: number;
} {
  const byKey = new Map<string, ImportCompanyRow>();
  for (const raw of rows) {
    const row = stampNormalizedDomain(raw);
    const key = row.apolloId
      ? `apollo:${row.apolloId}`
      : row.normalizedDomain
        ? `domain:${row.normalizedDomain}`
        : `name:${row.name.trim().toLowerCase()}|${(row.country ?? "").trim().toLowerCase()}`;
    byKey.set(key, row);
  }
  const unique = Array.from(byKey.values());
  return { unique, dedupedInFile: rows.length - unique.length };
}

function hasMeaningfulString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function companyHasEnrichmentWork(existing: Company): boolean {
  return (
    existing.enrichmentStatus === "enriched" ||
    existing.fitScore != null ||
    existing.similarityScore != null ||
    existing.urgencyScore != null ||
    hasMeaningfulString(existing.briefData) ||
    hasMeaningfulString(existing.salesApproachData) ||
    hasMeaningfulString(existing.fitScoreData)
  );
}

/**
 * Build a patch for an existing company from incoming import data.
 * Preserves scores, briefs, brain outputs metadata, CG fields, and campaign membership.
 */
export function buildFirmographicPatch(
  existing: Company,
  incoming: ImportCompanyRow
): Partial<InsertCompany> {
  const patch: Partial<InsertCompany> = {};
  const stamped = stampNormalizedDomain(incoming);
  const enriched = companyHasEnrichmentWork(existing);

  for (const field of FIRMOPGRAPHIC_FIELDS) {
    const value = stamped[field as FirmographicField];
    if (value == null || value === "") continue;
    if (enriched && field === "sliceMetadata" && hasMeaningfulString(existing.sliceMetadata)) {
      continue;
    }
    (patch as Record<string, unknown>)[field] = value;
  }

  if (!existing.apolloId && stamped.apolloId) {
    patch.apolloId = stamped.apolloId;
  }

  if (stamped.normalizedDomain && stamped.normalizedDomain !== existing.normalizedDomain) {
    patch.normalizedDomain = stamped.normalizedDomain;
  }

  if (!enriched && stamped.enrichmentStatus === "enriched" && existing.enrichmentStatus === "pending") {
    patch.enrichmentStatus = "enriched";
  }

  return patch;
}

function patchIsEmpty(patch: Partial<InsertCompany>): boolean {
  return Object.keys(patch).length === 0;
}

async function loadExistingByApolloAndDomain(
  apolloIds: string[],
  domains: string[]
): Promise<{ byApolloId: Map<string, Company>; byDomain: Map<string, Company> }> {
  const db = await getDb();
  const byApolloId = new Map<string, Company>();
  const byDomain = new Map<string, Company>();
  if (!db) return { byApolloId, byDomain };

  const CHUNK = 500;
  const seenIds = new Set<number>();

  const ingest = (row: Company) => {
    if (seenIds.has(row.id)) return;
    seenIds.add(row.id);
    if (row.apolloId) byApolloId.set(row.apolloId, row);
    if (row.normalizedDomain) byDomain.set(row.normalizedDomain, row);
  };

  for (let i = 0; i < apolloIds.length; i += CHUNK) {
    const chunk = apolloIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const rows = await db
      .select()
      .from(companies)
      .where(and(isNotNull(companies.apolloId), inArray(companies.apolloId, chunk)));
    for (const row of rows) ingest(row);
  }

  for (let i = 0; i < domains.length; i += CHUNK) {
    const chunk = domains.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const rows = await db
      .select()
      .from(companies)
      .where(and(isNotNull(companies.normalizedDomain), inArray(companies.normalizedDomain, chunk)));
    for (const row of rows) ingest(row);
  }

  return { byApolloId, byDomain };
}

function resolveExisting(
  row: ImportCompanyRow,
  byApolloId: Map<string, Company>,
  byDomain: Map<string, Company>
): Company | undefined {
  const stamped = stampNormalizedDomain(row);
  if (stamped.apolloId) {
    const byApollo = byApolloId.get(stamped.apolloId);
    if (byApollo) return byApollo;
  }
  if (stamped.normalizedDomain) {
    return byDomain.get(stamped.normalizedDomain);
  }
  return undefined;
}

/**
 * Import companies with global apolloId / domain upsert.
 * Existing rows keep their searchId (campaign), scores, and enrichment artifacts.
 */
export async function importCompaniesWithGlobalUpsert(
  rows: ImportCompanyRow[]
): Promise<ImportUpsertResult> {
  const { unique, dedupedInFile } = dedupeImportRows(rows);
  if (unique.length === 0) {
    return { inserted: 0, updated: 0, linked: 0, unchanged: 0, dedupedInFile };
  }

  const apolloIds = [
    ...new Set(unique.map((r) => r.apolloId).filter((id): id is string => !!id)),
  ];
  const domains = [
    ...new Set(
      unique
        .map((r) => stampNormalizedDomain(r).normalizedDomain)
        .filter((d): d is string => !!d)
    ),
  ];

  const { byApolloId, byDomain } = await loadExistingByApolloAndDomain(apolloIds, domains);

  const toInsert: ImportCompanyRow[] = [];
  const toUpdate: Array<{ id: number; patch: Partial<InsertCompany> }> = [];
  const toLinkIds: number[] = [];
  let unchanged = 0;

  for (const row of unique) {
    const existing = resolveExisting(row, byApolloId, byDomain);
    if (!existing) {
      toInsert.push(stampNormalizedDomain(row));
      continue;
    }

    toLinkIds.push(existing.id);
    const patch = buildFirmographicPatch(existing, row);
    if (patchIsEmpty(patch)) {
      unchanged++;
      continue;
    }
    toUpdate.push({ id: existing.id, patch });
  }

  let inserted = 0;
  const INSERT_BATCH = 200;
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const batch = toInsert.slice(i, i + INSERT_BATCH);
    await createCompanies(batch);
    inserted += batch.length;
  }

  let updated = 0;
  for (const { id, patch } of toUpdate) {
    await updateCompany(id, patch);
    updated++;
  }

  const targetSearchId = unique[0]?.searchId;
  let linked = 0;
  if (targetSearchId != null && toLinkIds.length > 0) {
    linked = await linkCompaniesToSearch(targetSearchId, toLinkIds);
  }

  return { inserted, updated, linked, unchanged, dedupedInFile };
}
