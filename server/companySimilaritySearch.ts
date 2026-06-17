/**
 * Shared company embedding similarity search against a query vector.
 * Used by brain-based DB similarity preview and company lookalike preview.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inArray } from "drizzle-orm";
import { companies } from "../drizzle/schema";
import { getDb } from "./db";
import { toCompanyUUID } from "./supabaseEmbeddings";

const PAGE_SIZE = 1000;

export function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function parseEmbedding(raw: string | number[]): number[] {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export function cosineSimilarityScore0to100(a: number[], b: number[]): number {
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] ** 2;
    mb += b[i] ** 2;
  }
  const sim = ma === 0 || mb === 0 ? 0 : dot / (Math.sqrt(ma) * Math.sqrt(mb));
  return Math.round(((sim + 1) / 2) * 100);
}

export interface ScoredWatchlistRow {
  watchlistId: string;
  score: number;
}

export interface ScoreEmbeddingsOptions {
  minScore: number;
  maxResults: number;
  excludeWatchlistIds?: string[];
}

/**
 * Scan all company embeddings and score against the given query vector.
 */
export async function scoreAllEmbeddingsAgainstVector(
  sb: SupabaseClient,
  queryVector: number[],
  opts: ScoreEmbeddingsOptions,
): Promise<{ scored: ScoredWatchlistRow[]; top: ScoredWatchlistRow[] }> {
  const exclude = new Set(opts.excludeWatchlistIds ?? []);
  const scored: ScoredWatchlistRow[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: rows, error } = await sb
      .from("lt_mns_company_embeddings")
      .select("watchlist_id, embedding")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error || !rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of rows) {
      const watchlistId = String(row.watchlist_id);
      if (exclude.has(watchlistId)) continue;
      const vec = parseEmbedding(row.embedding as string | number[]);
      const score = cosineSimilarityScore0to100(vec, queryVector);
      if (score >= opts.minScore) {
        scored.push({ watchlistId, score });
      }
    }

    if (rows.length < PAGE_SIZE) hasMore = false;
    else page++;
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, opts.maxResults);
  return { scored, top };
}

/**
 * Fetch a company's stored embedding vector from Supabase.
 */
export async function fetchSeedEmbedding(
  sb: SupabaseClient,
  seedCompanyId: number,
): Promise<number[] | null> {
  const watchlistId = toCompanyUUID(seedCompanyId);
  const { data, error } = await sb
    .from("lt_mns_company_embeddings")
    .select("embedding")
    .eq("watchlist_id", watchlistId)
    .maybeSingle();

  if (error || !data?.embedding) return null;
  return parseEmbedding(data.embedding as string | number[]);
}

export interface MysqlCompanySimRow {
  id: number;
  name: string;
  websiteUrl: string | null;
  primaryDomain: string | null;
  city: string | null;
  country: string | null;
  sector: string | null;
  fitScore: number | null;
  searchId: number;
  generatedWithBrainName: string | null;
  simScore: number;
}

export interface MapCompaniesFilters {
  country?: string;
  sector?: string;
}

/**
 * Resolve watchlist UUIDs to MySQL company rows with similarity scores.
 */
export async function mapWatchlistIdsToMysqlCompanies(
  top: ScoredWatchlistRow[],
  filters?: MapCompaniesFilters,
): Promise<{ companies: MysqlCompanySimRow[]; totalMatched: number }> {
  if (top.length === 0) return { companies: [], totalMatched: 0 };

  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const allCompanyIds = await db.select({ id: companies.id }).from(companies);
  const mysqlUuidMap = new Map<string, number>();
  for (const { id } of allCompanyIds) {
    mysqlUuidMap.set(toCompanyUUID(id), id);
  }

  const topWithIds = top
    .map((t) => ({ ...t, mysqlId: mysqlUuidMap.get(t.watchlistId) }))
    .filter((t): t is ScoredWatchlistRow & { mysqlId: number } => t.mysqlId !== undefined);

  if (topWithIds.length === 0) return { companies: [], totalMatched: 0 };

  const ids = topWithIds.map((t) => t.mysqlId);
  const companyRows = await db
    .select({
      id: companies.id,
      name: companies.name,
      websiteUrl: companies.websiteUrl,
      primaryDomain: companies.primaryDomain,
      city: companies.city,
      country: companies.country,
      sector: companies.sector,
      fitScore: companies.fitScore,
      searchId: companies.searchId,
      generatedWithBrainName: companies.generatedWithBrainName,
    })
    .from(companies)
    .where(inArray(companies.id, ids));

  const simMap = new Map(topWithIds.map((t) => [t.mysqlId, t.score]));

  let result = companyRows
    .map((c) => ({ ...c, simScore: simMap.get(c.id) ?? 0 }))
    .sort((a, b) => b.simScore - a.simScore);

  if (filters?.country) {
    const countryLower = filters.country.toLowerCase();
    result = result.filter((c) => c.country?.toLowerCase().includes(countryLower));
  }
  if (filters?.sector) {
    const sectorLower = filters.sector.toLowerCase();
    result = result.filter((c) => c.sector?.toLowerCase().includes(sectorLower));
  }

  return { companies: result, totalMatched: topWithIds.length };
}

/**
 * Fetch brain embedding vector from Supabase.
 */
export async function fetchBrainEmbedding(sb: SupabaseClient, brainId: number): Promise<number[]> {
  const { data: brainRow, error: brainErr } = await sb
    .from("lt_mns_brain_embeddings")
    .select("embedding")
    .eq("brain_id", String(brainId))
    .single();

  if (brainErr || !brainRow) {
    throw new Error(`No embedding found for brain ${brainId}. Please generate the brain embedding first.`);
  }

  return parseEmbedding(brainRow.embedding as string | number[]);
}
