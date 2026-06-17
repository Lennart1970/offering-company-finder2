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

/** Convert UI minSim (0–100) to RPC p_threshold (raw cosine -1..1). */
export function minSim0to100ToRpcThreshold(minSim: number): number {
  return Math.max(0, Math.min(1, (minSim / 100) * 2 - 1));
}

/** Convert RPC similarity_score (raw cosine) to UI simScore (0–100). */
export function rpcSimilarityToSim0to100(score: number): number {
  return Math.round(((score + 1) / 2) * 100);
}

export interface RpcMatchRow {
  company_id: string;
  company_name: string;
  domain?: string | null;
  sector?: string | null;
  country?: string | null;
  similarity_score: number;
}

export interface RpcSearchOptions {
  minSim: number;
  maxResults: number;
  excludeWatchlistIds?: string[];
  /** When true, request more rows from RPC before post-filters (country/sector). */
  overfetchForFilters?: boolean;
}

/**
 * Fast vector search via Supabase pgvector RPC (replaces full-table scan).
 */
export async function matchCompaniesByEmbeddingRpc(
  sb: SupabaseClient,
  queryVector: number[],
  opts: RpcSearchOptions,
): Promise<{ matches: RpcMatchRow[]; totalMatched: number }> {
  const exclude = new Set(opts.excludeWatchlistIds ?? []);
  const multiplier = opts.overfetchForFilters ? 3 : 1;
  const pLimit = Math.min(500, opts.maxResults * multiplier);

  const { data, error } = await sb.rpc("match_companies_to_embedding", {
    p_embedding: queryVector,
    p_limit: pLimit,
    p_threshold: minSim0to100ToRpcThreshold(opts.minSim),
  });

  if (error) {
    throw new Error(`Vector search RPC failed: ${error.message}`);
  }

  const raw = (data ?? []) as RpcMatchRow[];
  const matches = raw.filter((r) => !exclude.has(String(r.company_id)));
  return { matches, totalMatched: matches.length };
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
 * Resolve RPC matches to MySQL company rows (targeted UUID lookup, no full-table scan).
 */
export async function mapRpcMatchesToMysqlCompanies(
  sb: SupabaseClient,
  matches: RpcMatchRow[],
  filters?: MapCompaniesFilters,
  maxResults?: number,
): Promise<{ companies: MysqlCompanySimRow[]; totalMatched: number }> {
  if (matches.length === 0) return { companies: [], totalMatched: 0 };

  let filtered = [...matches];
  if (filters?.country) {
    const countryLower = filters.country.toLowerCase();
    filtered = filtered.filter((r) => r.country?.toLowerCase().includes(countryLower));
  }
  if (filters?.sector) {
    const sectorLower = filters.sector.toLowerCase();
    filtered = filtered.filter((r) => r.sector?.toLowerCase().includes(sectorLower));
  }

  const totalMatched = filtered.length;
  const capped = maxResults ? filtered.slice(0, maxResults) : filtered;
  if (capped.length === 0) return { companies: [], totalMatched };

  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const watchlistIds = capped.map((m) => String(m.company_id));
  const uuidToMysql = await resolveWatchlistIdsToMysqlIds(sb, db, watchlistIds);

  const simByMysqlId = new Map<number, number>();
  for (const m of capped) {
    const mysqlId = uuidToMysql.get(String(m.company_id));
    if (mysqlId !== undefined) {
      simByMysqlId.set(mysqlId, rpcSimilarityToSim0to100(m.similarity_score));
    }
  }

  const mysqlIds = [...simByMysqlId.keys()];
  if (mysqlIds.length === 0) return { companies: [], totalMatched };

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
    .where(inArray(companies.id, mysqlIds));

  const result = companyRows
    .map((c) => ({ ...c, simScore: simByMysqlId.get(c.id) ?? 0 }))
    .sort((a, b) => b.simScore - a.simScore);

  return { companies: result, totalMatched };
}

/** Resolve watchlist UUIDs → MySQL company ids via Supabase registry, with paginated fallback. */
async function resolveWatchlistIdsToMysqlIds(
  sb: SupabaseClient,
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  watchlistIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unresolved = new Set(watchlistIds);

  const CHUNK = 100;
  for (let i = 0; i < watchlistIds.length; i += CHUNK) {
    const chunk = watchlistIds.slice(i, i + CHUNK);
    const { data } = await sb
      .from("lt_mns_companies")
      .select("id, mysql_id")
      .in("id", chunk);

    for (const row of data ?? []) {
      const id = String(row.id);
      const mysqlId = row.mysql_id != null ? Number(row.mysql_id) : undefined;
      if (mysqlId && !Number.isNaN(mysqlId)) {
        map.set(id, mysqlId);
        unresolved.delete(id);
      }
    }
  }

  if (unresolved.size === 0) return map;

  // Fallback: paginate MySQL ids until all unresolved UUIDs are mapped
  const BATCH = 5000;
  let offset = 0;
  while (unresolved.size > 0) {
    const rows = await db.select({ id: companies.id }).from(companies).limit(BATCH).offset(offset);
    if (rows.length === 0) break;
    for (const { id } of rows) {
      const uuid = toCompanyUUID(id);
      if (unresolved.has(uuid)) {
        map.set(uuid, id);
        unresolved.delete(uuid);
      }
    }
    if (unresolved.size === 0 || rows.length < BATCH) break;
    offset += BATCH;
  }

  return map;
}

export interface PreviewByVectorOptions extends RpcSearchOptions {
  filters?: MapCompaniesFilters;
}

/**
 * Preview similar companies: RPC fast path with brute-force fallback.
 */
export async function previewSimilarityByVector(
  sb: SupabaseClient,
  queryVector: number[],
  opts: PreviewByVectorOptions,
): Promise<{ companies: MysqlCompanySimRow[]; totalMatched: number }> {
  try {
    const { matches } = await matchCompaniesByEmbeddingRpc(sb, queryVector, opts);
    const { companies: result, totalMatched } = await mapRpcMatchesToMysqlCompanies(
      sb,
      matches,
      opts.filters,
      opts.maxResults,
    );
    return { companies: result, totalMatched };
  } catch (rpcErr) {
    console.warn(
      "[companySimilaritySearch] RPC failed, falling back to brute-force scan:",
      rpcErr instanceof Error ? rpcErr.message : rpcErr,
    );
    const { scored, top } = await scoreAllEmbeddingsAgainstVector(sb, queryVector, {
      minScore: opts.minSim,
      maxResults: opts.maxResults,
      excludeWatchlistIds: opts.excludeWatchlistIds,
    });
    const { companies: result } = await mapWatchlistIdsToMysqlCompanies(top, opts.filters);
    return { companies: result, totalMatched: scored.length };
  }
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
