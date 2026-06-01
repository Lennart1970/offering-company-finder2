/**
 * Supabase Embeddings Service
 *
 * Persists company embeddings to lt_mns_company_embeddings and scores them
 * against all Brain embeddings in lt_mns_brain_embeddings using cosine similarity.
 *
 * UUID key: toUUID("company", mysqlId) — same deterministic key used in
 * lt_mns_companies and lt_mns_company_pages, making all three tables joinable.
 */

import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import type { CompanyEmbedding } from "./embeddingService";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export function toCompanyUUID(mysqlId: number): string {
  return uuidv5(`company-${mysqlId}`, LT_NAMESPACE);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  if (denom === 0) return 0;
  return dotProduct(a, b) / denom;
}

/**
 * Upsert company embeddings into lt_mns_company_embeddings.
 * Uses the deterministic UUID (toCompanyUUID) as the watchlist_id key.
 */
export async function persistCompanyEmbeddings(
  embeddings: CompanyEmbedding[]
): Promise<void> {
  if (embeddings.length === 0) return;
  const sb = getSupabase();

  const BATCH = 100;
  for (let i = 0; i < embeddings.length; i += BATCH) {
    const batch = embeddings.slice(i, i + BATCH);
    const rows = batch.map((e) => ({
      watchlist_id: toCompanyUUID(e.companyId),
      embedding: e.embedding,
      content_to_embed: e.text,
      last_updated_at: new Date().toISOString(),
    }));

    const { error } = await sb
      .from("lt_mns_company_embeddings")
      .upsert(rows, { onConflict: "watchlist_id" });

    if (error) {
      console.error(`[supabaseEmbeddings] Upsert error (batch ${i}–${i + BATCH}):`, error.message);
    } else {
      console.log(`[supabaseEmbeddings] Persisted ${rows.length} embeddings (batch ${Math.floor(i / BATCH) + 1})`);
    }
  }
}

export interface BrainScore {
  companyId: number;
  companyUUID: string;
  brainId: string;
  score: number; // 0–100
}

/**
 * Score a list of company embeddings against ALL Brain embeddings in Supabase.
 * Returns one BrainScore per (company, brain) pair.
 */
export async function scoreCompaniesAgainstAllBrains(
  embeddings: CompanyEmbedding[]
): Promise<BrainScore[]> {
  if (embeddings.length === 0) return [];
  const sb = getSupabase();

  // Fetch all Brain embeddings
  const { data: brainRows, error } = await sb
    .from("lt_mns_brain_embeddings")
    .select("brain_id, embedding");

  if (error || !brainRows || brainRows.length === 0) {
    console.warn("[supabaseEmbeddings] No Brain embeddings found:", error?.message);
    return [];
  }

  console.log(`[supabaseEmbeddings] Scoring ${embeddings.length} companies against ${brainRows.length} Brains`);

  // Parse brain vectors (stored as JSON string or array)
  const brains = brainRows.map((b) => ({
    brainId: b.brain_id as string,
    vector: (typeof b.embedding === "string" ? JSON.parse(b.embedding) : b.embedding) as number[],
  }));

  const results: BrainScore[] = [];

  for (const compEmb of embeddings) {
    for (const brain of brains) {
      const similarity = cosineSimilarity(compEmb.embedding, brain.vector);
      // Normalise cosine similarity (−1 to 1) → score (0 to 100)
      const score = Math.round(((similarity + 1) / 2) * 100);
      results.push({
        companyId: compEmb.companyId,
        companyUUID: toCompanyUUID(compEmb.companyId),
        brainId: brain.brainId,
        score,
      });
    }
  }

  return results;
}

/**
 * For each company, find the best Brain score and return a map of
 * companyId → { bestScore, allScores }
 */
export function aggregateBrainScores(scores: BrainScore[]): Map<
  number,
  { bestScore: number; bestBrainId: string; allScores: Record<string, number> }
> {
  const map = new Map<number, { bestScore: number; bestBrainId: string; allScores: Record<string, number> }>();

  for (const s of scores) {
    const existing = map.get(s.companyId);
    if (!existing) {
      map.set(s.companyId, {
        bestScore: s.score,
        bestBrainId: s.brainId,
        allScores: { [s.brainId]: s.score },
      });
    } else {
      existing.allScores[s.brainId] = s.score;
      if (s.score > existing.bestScore) {
        existing.bestScore = s.score;
        existing.bestBrainId = s.brainId;
      }
    }
  }

  return map;
}
