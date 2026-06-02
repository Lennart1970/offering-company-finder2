/**
 * Bulk News Urgency Scoring Service (Path D)
 *
 * For each company (in batches):
 *   1. Fetch Google News snippets via Serper API
 *   2. Concatenate top-3 snippet texts into a "news summary"
 *   3. Embed the news summary (OpenAI text-embedding-3-small)
 *   4. Compute cosine similarity vs the ABC scenario centroid for the active Brain
 *   5. Write score (0–100) to MySQL companies.urgencyScoreNews
 */

import { createClient } from "@supabase/supabase-js";
import { getDb } from "./db";
import { companies } from "../drizzle/schema";
import { isNull, eq } from "drizzle-orm";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const ACTIVE_BRAIN_ID = 210002; // EMS Intelligence Brain
const SERPER_DELAY_MS = 1300;

// ─── Vector helpers ───────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// ─── ABC centroid ─────────────────────────────────────────────────────────────

let cachedCentroid: number[] | null = null;

async function getABCCentroid(): Promise<number[]> {
  if (cachedCentroid) return cachedCentroid;

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("lt_mns_trigger_references")
    .select("embedding")
    .eq("brain_id", ACTIVE_BRAIN_ID)
    .eq("is_active", true)
    .not("embedding", "is", null);

  if (error) throw new Error(`Supabase centroid error: ${error.message}`);
  if (!data || data.length === 0) throw new Error("No ABC scenario embeddings found");

  const vecs: number[][] = [];
  for (const row of data) {
    let vec = row.embedding as unknown;
    if (typeof vec === "string") vec = JSON.parse(vec as string);
    if (Array.isArray(vec) && (vec as number[]).length === 1536) {
      vecs.push(vec as number[]);
    }
  }
  if (vecs.length === 0) throw new Error("No valid 1536-dim embeddings found");

  const dim = 1536;
  const centroid = new Array(dim).fill(0) as number[];
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= vecs.length;

  cachedCentroid = centroid;
  console.log(`[NewsUrgency] ABC centroid built from ${vecs.length} scenarios`);
  return centroid;
}

// ─── Serper news fetch ────────────────────────────────────────────────────────

async function fetchNewsText(name: string, domain: string | null): Promise<string | null> {
  const query = domain ? `${name}` : name;
  try {
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 5, tbs: "qdr:y" }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { news?: Array<{ title?: string; snippet?: string }> };
    const items = data.news ?? [];
    if (items.length === 0) return null;
    return items.slice(0, 3).map(n => `${n.title ?? ""}. ${n.snippet ?? ""}`).join(" ");
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface NewsUrgencyResult {
  total: number;
  scored: number;
  noNews: number;
  errors: number;
  avgScore: number;
}

export async function runBulkNewsUrgencyScoring(opts: {
  mode: "unscored" | "all";
  limit?: number;
}): Promise<NewsUrgencyResult> {
  const limit = opts.limit ?? 500;

  // 1. Build centroid
  const centroid = await getABCCentroid();

  // 2. Fetch companies
  const drizzleDb = await getDb();
  if (!drizzleDb) throw new Error("Database connection unavailable");
  const rows = await drizzleDb
    .select({ id: companies.id, name: companies.name, domain: companies.primaryDomain })
    .from(companies)
    .where(opts.mode === "unscored" ? isNull(companies.urgencyScoreNews) : undefined)
    .orderBy(companies.id)
    .limit(limit);

  console.log(`[NewsUrgency] Scoring ${rows.length} companies (mode=${opts.mode})`);

  let scored = 0, noNews = 0, errors = 0;
  const scoreSum: number[] = [];

  for (const company of rows) {
    try {
      const newsText = await fetchNewsText(company.name, company.domain ?? null);
      if (!newsText) {
        noNews++;
        await new Promise(r => setTimeout(r, SERPER_DELAY_MS));
        continue;
      }

      const newsEmbed = await embedText(newsText);
      const sim = cosineSimilarity(newsEmbed, centroid);
      const score = Math.round(sim * 100);

      await drizzleDb
        .update(companies)
        .set({ urgencyScoreNews: score, urgencyScoreNewsGeneratedAt: new Date() as unknown as null })
        .where(eq(companies.id, company.id));

      scoreSum.push(score);
      scored++;
    } catch (err) {
      errors++;
      console.error(`[NewsUrgency] Error for ${company.name}: ${(err as Error).message}`);
    }

    await new Promise(r => setTimeout(r, SERPER_DELAY_MS));
  }

  const avgScore = scoreSum.length > 0
    ? Math.round(scoreSum.reduce((a, b) => a + b, 0) / scoreSum.length)
    : 0;

  console.log(`[NewsUrgency] Done — scored: ${scored}, no-news: ${noNews}, errors: ${errors}, avg: ${avgScore}`);

  return { total: rows.length, scored, noNews, errors, avgScore };
}
