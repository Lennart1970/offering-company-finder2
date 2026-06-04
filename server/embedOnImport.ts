/**
 * Embed-on-Import Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Called from the campaign queue worker after Apollo enrichment completes.
 * For a single company:
 *   1. Generate OpenAI text-embedding-3-small vector
 *   2. Upsert into Supabase lt_mns_company_embeddings
 *   3. Fetch active Brain embedding from Supabase
 *   4. Compute cosine similarity → score (0–100)
 *   5. Write companies.similarityScore + companies.similarityScoreGeneratedAt in MySQL
 *
 * This keeps FIT-SIM scores fresh for every newly imported company without
 * requiring a separate bulk-scoring pass.
 */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Company } from "../drizzle/schema";
import { buildEmbeddingText } from "./embeddingService";

const EMBEDDING_MODEL = "text-embedding-3-small";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key);
}

/** Convert MySQL integer ID to the deterministic UUID used in Supabase */
function toCompanyUUID(mysqlId: number): string {
  const hex = mysqlId.toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-0000-0000-0000-000000000000`;
}

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}
function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  return denom === 0 ? 0 : dotProduct(a, b) / denom;
}

export interface EmbedOnImportResult {
  embedded: boolean;
  similarityScore: number | null;
  activeBrainId: string | null;
  error?: string;
}

/**
 * Embed a single company and compute its FIT-SIM score against the active Brain.
 * Writes similarityScore to MySQL.
 * Safe to call even if Supabase is unavailable — errors are caught and logged.
 */
export async function embedAndScoreCompany(
  company: Company
): Promise<EmbedOnImportResult> {
  try {
    const openai = getOpenAI();
    const sb = getSupabase();

    // ── Step 1: Generate embedding ──────────────────────────────────────────
    const text = buildEmbeddingText(company);
    const embResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: [text],
    });
    const vector = embResponse.data[0].embedding;

    // ── Step 2: Upsert into Supabase ────────────────────────────────────────
    const uuid = toCompanyUUID(company.id);
    const { error: upsertErr } = await sb
      .from("lt_mns_company_embeddings")
      .upsert(
        [{
          watchlist_id: uuid,
          embedding: vector,
          content_to_embed: text,
          last_updated_at: new Date().toISOString(),
        }],
        { onConflict: "watchlist_id" }
      );
    if (upsertErr) {
      console.warn(`[EmbedOnImport] Supabase upsert failed for company ${company.id}: ${upsertErr.message}`);
      return { embedded: false, similarityScore: null, activeBrainId: null, error: upsertErr.message };
    }

    // ── Step 3: Fetch active Brain embedding ────────────────────────────────
    const { getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) {
      return { embedded: true, similarityScore: null, activeBrainId: null, error: "DB not available" };
    }

    const brainRows = await db.execute(sql`
      SELECT id, brainName FROM offering_brain
      WHERE isActive = 1 AND show_on_leadtrigger = 1
      ORDER BY updatedAt DESC LIMIT 1
    `);
    const brainArr = brainRows as unknown as { id: number; brainName: string }[];
    if (!brainArr || brainArr.length === 0) {
      console.warn("[EmbedOnImport] No active Brain found — skipping FIT-SIM");
      return { embedded: true, similarityScore: null, activeBrainId: null };
    }
    const activeBrainId = String(brainArr[0].id);

    const { data: brainEmbRow, error: brainEmbErr } = await sb
      .from("lt_mns_brain_embeddings")
      .select("embedding")
      .eq("brain_id", activeBrainId)
      .single();

    if (brainEmbErr || !brainEmbRow) {
      console.warn(`[EmbedOnImport] Brain embedding not found for brain_id=${activeBrainId}`);
      return { embedded: true, similarityScore: null, activeBrainId };
    }

    // ── Step 4: Compute cosine similarity ───────────────────────────────────
    const brainVector = (
      typeof brainEmbRow.embedding === "string"
        ? JSON.parse(brainEmbRow.embedding)
        : brainEmbRow.embedding
    ) as number[];

    const sim = cosineSimilarity(vector, brainVector);
    const score = Math.round(((sim + 1) / 2) * 100);

    // ── Step 5: Write similarityScore to MySQL ──────────────────────────────
    const now = new Date();
    await db.execute(sql`
      UPDATE companies
      SET similarityScore = ${score},
          similarityScoreGeneratedAt = ${now}
      WHERE id = ${company.id}
    `);

    console.log(`[EmbedOnImport] ✓ ${company.name} → FIT-SIM: ${score} (brain=${activeBrainId})`);
    return { embedded: true, similarityScore: score, activeBrainId };

  } catch (err: any) {
    console.warn(`[EmbedOnImport] ⚠ Failed for company ${company.id} (${company.name}): ${err.message}`);
    return { embedded: false, similarityScore: null, activeBrainId: null, error: err.message };
  }
}
