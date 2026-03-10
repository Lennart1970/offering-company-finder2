/**
 * Clustering Service
 *
 * Two-phase clustering pipeline:
 *
 * Phase 1 — Seed (fast, in-browser):
 *   Take a stratified sample of up to SEED_SAMPLE_SIZE companies,
 *   run k-means++ with silhouette auto-K, name each cluster with LLM.
 *   Returns NicheCluster[] with stable centroids.
 *
 * Phase 2 — Assign (background-safe):
 *   For remaining companies not in the seed sample, embed them and
 *   assign each to the nearest centroid by cosine similarity.
 *   Can run as a background job — no re-clustering needed.
 */
import { invokeLLM } from "./_core/llm";
import type { CompanyEmbedding } from "./embeddingService";
import type { Company } from "../drizzle/schema";

export const SEED_SAMPLE_SIZE = 500;
const MIN_K = 3;
const MAX_K = 12;
const MIN_COMPANIES_PER_CLUSTER = 3;
const KMEANS_MAX_ITERATIONS = 100;

// ─── Vector Math ────────────────────────────────────────────────────────────

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

function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += v[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= vectors.length;
  return mean;
}

// ─── Stratified Sample ───────────────────────────────────────────────────────

/**
 * Pick up to `size` companies using stratified sampling by industry.
 * Falls back to random if no industry metadata is available.
 */
export function stratifiedSample(
  companyEmbeddings: CompanyEmbedding[],
  allCompanies: Company[],
  size: number
): { sample: CompanyEmbedding[]; remainder: CompanyEmbedding[] } {
  if (companyEmbeddings.length <= size) {
    return { sample: companyEmbeddings, remainder: [] };
  }

  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  // Group by industry
  const byIndustry = new Map<string, CompanyEmbedding[]>();
  for (const ce of companyEmbeddings) {
    const company = companyMap.get(ce.companyId);
    const meta = company?.sliceMetadata
      ? (() => { try { return JSON.parse(company.sliceMetadata!); } catch { return {}; } })()
      : {};
    const industry: string = meta.industry || "Unknown";
    if (!byIndustry.has(industry)) byIndustry.set(industry, []);
    byIndustry.get(industry)!.push(ce);
  }

  // Proportional allocation across industries
  const total = companyEmbeddings.length;
  const sampled: CompanyEmbedding[] = [];
  const remainderSet = new Set<number>();

  for (const [, group] of Array.from(byIndustry)) {
    const quota = Math.max(1, Math.round((group.length / total) * size));
    // Shuffle group
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    sampled.push(...shuffled.slice(0, quota));
    shuffled.slice(quota).forEach((ce) => remainderSet.add(ce.companyId));
  }

  // Trim or top-up to exact size
  const finalSample = sampled.slice(0, size);
  const sampledIds = new Set(finalSample.map((ce) => ce.companyId));
  const remainder = companyEmbeddings.filter((ce) => !sampledIds.has(ce.companyId));

  console.log(
    `[Clustering] Stratified sample: ${finalSample.length} seed companies, ${remainder.length} remainder`
  );

  return { sample: finalSample, remainder };
}

// ─── K-Means++ ──────────────────────────────────────────────────────────────

function kMeansPlusPlus(
  embeddings: number[][],
  k: number
): { assignments: number[]; centroids: number[][] } {
  const n = embeddings.length;

  const centroidIndices: number[] = [];
  centroidIndices.push(Math.floor(Math.random() * n));

  for (let c = 1; c < k; c++) {
    const distances = embeddings.map((emb) => {
      const minDist = Math.min(
        ...centroidIndices.map((ci) => cosineDistance(emb, embeddings[ci]))
      );
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      rand -= distances[i];
      if (rand <= 0) {
        chosen = i;
        break;
      }
    }
    centroidIndices.push(chosen);
  }

  let centroids = centroidIndices.map((i) => [...embeddings[i]]);
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
    const newAssignments = embeddings.map((emb) => {
      let minDist = Infinity;
      let nearest = 0;
      for (let c = 0; c < k; c++) {
        const d = cosineDistance(emb, centroids[c]);
        if (d < minDist) {
          minDist = d;
          nearest = c;
        }
      }
      return nearest;
    });

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    for (let c = 0; c < k; c++) {
      const clusterVecs = embeddings.filter((_, i) => assignments[i] === c);
      if (clusterVecs.length > 0) {
        centroids[c] = meanVector(clusterVecs);
      }
    }
  }

  return { assignments, centroids };
}

// ─── Silhouette Score ────────────────────────────────────────────────────────

function silhouetteScore(embeddings: number[][], assignments: number[]): number {
  const n = embeddings.length;
  if (n < 2) return 0;

  let totalScore = 0;
  for (let i = 0; i < n; i++) {
    const clusterI = assignments[i];
    const sameCluster = embeddings.filter((_, j) => j !== i && assignments[j] === clusterI);
    if (sameCluster.length === 0) continue;

    const a = sameCluster.reduce((sum, v) => sum + cosineDistance(embeddings[i], v), 0) / sameCluster.length;

    const clusters = Array.from(new Set(assignments)).filter((c) => c !== clusterI);
    if (clusters.length === 0) continue;

    const b = Math.min(
      ...clusters.map((c) => {
        const otherCluster = embeddings.filter((_, j) => assignments[j] === c);
        if (otherCluster.length === 0) return Infinity;
        return otherCluster.reduce((sum, v) => sum + cosineDistance(embeddings[i], v), 0) / otherCluster.length;
      })
    );

    totalScore += (b - a) / Math.max(a, b);
  }

  return totalScore / n;
}

// ─── Auto-K Selection ────────────────────────────────────────────────────────

function selectOptimalK(
  embeddings: number[][],
  minK: number,
  maxK: number
): { k: number; assignments: number[]; centroids: number[][] } {
  const effectiveMax = Math.min(maxK, Math.floor(embeddings.length / MIN_COMPANIES_PER_CLUSTER));
  const effectiveMin = Math.min(minK, effectiveMax);

  let bestK = effectiveMin;
  let bestScore = -Infinity;
  let bestResult = kMeansPlusPlus(embeddings, effectiveMin);

  for (let k = effectiveMin; k <= effectiveMax; k++) {
    let bestRunResult = kMeansPlusPlus(embeddings, k);
    let bestRunScore = silhouetteScore(embeddings, bestRunResult.assignments);

    for (let run = 1; run < 3; run++) {
      const result = kMeansPlusPlus(embeddings, k);
      const score = silhouetteScore(embeddings, result.assignments);
      if (score > bestRunScore) {
        bestRunScore = score;
        bestRunResult = result;
      }
    }

    console.log(`[Clustering] k=${k} silhouette=${bestRunScore.toFixed(4)}`);

    if (bestRunScore > bestScore) {
      bestScore = bestRunScore;
      bestK = k;
      bestResult = bestRunResult;
    }
  }

  console.log(`[Clustering] Optimal k=${bestK} (silhouette=${bestScore.toFixed(4)})`);
  return { k: bestK, ...bestResult };
}

// ─── LLM Niche Naming ────────────────────────────────────────────────────────

export interface NicheCluster {
  name: string;
  description: string;
  companyIds: number[];
  sampleCompanies: string[];
  topKeywords: string[];
  centroid: number[];
  clusterIndex: number;
}

async function nameCluster(
  companies: Company[],
  clusterIndex: number
): Promise<{ name: string; description: string; topKeywords: string[] }> {
  const sampleNames = companies.slice(0, 10).map((c) => {
    const meta = c.sliceMetadata ? (() => { try { return JSON.parse(c.sliceMetadata!); } catch { return {}; } })() : {};
    return `${c.name}${meta.industry ? ` (${meta.industry})` : ""}`;
  });

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a B2B market analyst. Given a list of companies that were grouped together by semantic similarity, identify the niche they represent.",
      },
      {
        role: "user",
        content: `These companies were clustered together (cluster ${clusterIndex + 1}):\n${sampleNames.join("\n")}\n\nReturn a JSON object with:\n- name: a short 2-5 word niche label (e.g. "Industrial Automation Manufacturers")\n- description: 2-3 sentences explaining what unites these companies and why they form a distinct niche\n- topKeywords: array of 5-8 keywords that best describe this niche`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "niche_label",
        strict: true,
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            topKeywords: { type: "array", items: { type: "string" } },
          },
          required: ["name", "description", "topKeywords"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices[0].message.content);

  try {
    return JSON.parse(content);
  } catch {
    return {
      name: `Cluster ${clusterIndex + 1}`,
      description: `A group of ${companies.length} similar companies.`,
      topKeywords: [],
    };
  }
}

// ─── Phase 1: Seed Clustering ─────────────────────────────────────────────────

/**
 * Phase 1: Cluster a seed sample of up to SEED_SAMPLE_SIZE companies.
 * Returns NicheCluster[] with stable centroids for Phase 2 assignment.
 */
export async function clusterCompanies(
  companyEmbeddings: CompanyEmbedding[],
  allCompanies: Company[],
  options?: {
    /** Target number of companies per cluster. Derives K = ceil(sampleSize / targetGroupSize). */
    targetGroupSize?: number;
    /** Explicit K override — takes precedence over targetGroupSize and auto-K. */
    explicitK?: number;
    /** Seed sample size override (default SEED_SAMPLE_SIZE). */
    seedSampleSize?: number;
  }
): Promise<NicheCluster[]> {
  if (companyEmbeddings.length < MIN_K * MIN_COMPANIES_PER_CLUSTER) {
    throw new Error(
      `Need at least ${MIN_K * MIN_COMPANIES_PER_CLUSTER} companies to cluster. Got ${companyEmbeddings.length}.`
    );
  }

  const seedSize = options?.seedSampleSize ?? SEED_SAMPLE_SIZE;

  // Use stratified sample for seeding if we have more than seedSize
  const { sample } = stratifiedSample(companyEmbeddings, allCompanies, seedSize);

  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));
  const embeddings = sample.map((e) => e.embedding);

  // Derive K: explicit > target-size-derived > auto silhouette
  let resolvedK: number | undefined;
  if (options?.explicitK) {
    resolvedK = Math.max(MIN_K, Math.min(options.explicitK, Math.floor(embeddings.length / MIN_COMPANIES_PER_CLUSTER)));
  } else if (options?.targetGroupSize && options.targetGroupSize > 0) {
    resolvedK = Math.max(MIN_K, Math.ceil(sample.length / options.targetGroupSize));
    resolvedK = Math.min(resolvedK, Math.floor(embeddings.length / MIN_COMPANIES_PER_CLUSTER));
  }

  let k: number;
  let assignments: number[];
  let centroids: number[][];

  if (resolvedK !== undefined) {
    console.log(`[Clustering] Phase 1: k-means++ on ${embeddings.length} seed companies (k=${resolvedK}, target-size-driven)`);
    const result = kMeansPlusPlus(embeddings, resolvedK);
    k = resolvedK;
    assignments = result.assignments;
    centroids = result.centroids;
  } else {
    console.log(`[Clustering] Phase 1: k-means++ on ${embeddings.length} seed companies (k=${MIN_K}–${MAX_K}, auto silhouette)`);
    const result = selectOptimalK(embeddings, MIN_K, MAX_K);
    k = result.k;
    assignments = result.assignments;
    centroids = result.centroids;
  }

  const clusters: NicheCluster[] = [];
  for (let c = 0; c < k; c++) {
    const clusterEmbeddings = sample.filter((_, i) => assignments[i] === c);
    const clusterCompanyIds = clusterEmbeddings.map((e) => e.companyId);
    const clusterCompanies = clusterCompanyIds
      .map((id) => companyMap.get(id))
      .filter((c): c is Company => c !== undefined);

    if (clusterCompanies.length < MIN_COMPANIES_PER_CLUSTER) {
      console.log(`[Clustering] Skipping cluster ${c} — only ${clusterCompanies.length} companies (min ${MIN_COMPANIES_PER_CLUSTER})`);
      continue;
    }

    console.log(`[Clustering] Naming cluster ${c + 1}/${k} (${clusterCompanies.length} companies)...`);
    const label = await nameCluster(clusterCompanies, c);

    clusters.push({
      name: label.name,
      description: label.description,
      companyIds: clusterCompanyIds,
      sampleCompanies: clusterCompanies.slice(0, 5).map((c) => c.name),
      topKeywords: label.topKeywords,
      centroid: centroids[c],
      clusterIndex: c,
    });
  }

  console.log(`[Clustering] Phase 1 done: ${clusters.length} niches from ${sample.length} seed companies`);
  return clusters;
}

// ─── Phase 2: Proximity Assignment ───────────────────────────────────────────

/**
 * Assign a single company embedding to the nearest centroid.
 * Returns the cluster index (0-based) of the nearest niche.
 */
export function assignToNearestCentroid(
  embedding: number[],
  centroids: number[][]
): number {
  let nearest = 0;
  let minDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = cosineDistance(embedding, centroids[i]);
    if (d < minDist) {
      minDist = d;
      nearest = i;
    }
  }
  return nearest;
}

/**
 * Phase 2: Assign remaining companies (not in seed) to the nearest niche centroid.
 * Returns a map of companyId → nicheId (DB row ID).
 *
 * @param remainingEmbeddings - embeddings for companies not in the seed sample
 * @param nicheCentroids - array of { nicheId, centroid } from the saved niches
 * @param onProgress - optional callback called after each batch (for polling)
 */
export async function assignRemainingByProximity(
  remainingEmbeddings: CompanyEmbedding[],
  nicheCentroids: { nicheId: number; centroid: number[] }[],
  onProgress?: (assigned: number, total: number) => void
): Promise<Map<number, number>> {
  const assignments = new Map<number, number>(); // companyId → nicheId
  const centroids = nicheCentroids.map((n) => n.centroid);

  for (let i = 0; i < remainingEmbeddings.length; i++) {
    const ce = remainingEmbeddings[i];
    const clusterIdx = assignToNearestCentroid(ce.embedding, centroids);
    const nicheId = nicheCentroids[clusterIdx].nicheId;
    assignments.set(ce.companyId, nicheId);

    if (onProgress && (i + 1) % 100 === 0) {
      onProgress(i + 1, remainingEmbeddings.length);
    }
  }

  if (onProgress) onProgress(remainingEmbeddings.length, remainingEmbeddings.length);

  console.log(`[Clustering] Phase 2 done: ${assignments.size} companies assigned by proximity`);
  return assignments;
}

// ─── Online Clustering (Expand with Discovery) ───────────────────────────────

/**
 * Similarity threshold below which a company is considered a "poor fit"
 * for all existing centroids and should be considered for new niche discovery.
 * Cosine similarity range: -1 (opposite) to 1 (identical).
 * 0.35 means the company shares less than ~35% directional alignment with
 * the nearest existing centroid — a reasonable signal for a distinct sub-pattern.
 */
export const DISCOVERY_SIMILARITY_THRESHOLD = 0.35;

/**
 * Minimum number of poor-fit companies needed to attempt forming a new niche.
 * Below this, they are assigned to the nearest centroid anyway (not enough signal).
 */
export const MIN_DISCOVERY_CLUSTER_SIZE = 9;

export interface ExpandWithDiscoveryResult {
  /** companyId → nicheId (existing or newly created) */
  assignments: Map<number, number>;
  /** New NicheCluster objects discovered from poor-fit companies */
  newClusters: NicheCluster[];
}

/**
 * Assign a batch of company embeddings to existing centroids.
 * Companies with cosine similarity below DISCOVERY_SIMILARITY_THRESHOLD
 * to their nearest centroid are collected and re-clustered to discover
 * new niches. If enough poor-fit companies exist, new NicheCluster objects
 * are returned for the caller to persist.
 *
 * @param batchEmbeddings - embeddings for the batch of companies to process
 * @param allCompanies    - full company objects (for LLM naming)
 * @param nicheCentroids  - existing { nicheId, centroid } pairs
 */
export async function expandWithDiscovery(
  batchEmbeddings: CompanyEmbedding[],
  allCompanies: Company[],
  nicheCentroids: { nicheId: number; centroid: number[] }[]
): Promise<ExpandWithDiscoveryResult> {
  const assignments = new Map<number, number>();
  const poorFitEmbeddings: CompanyEmbedding[] = [];
  const centroids = nicheCentroids.map((n) => n.centroid);

  for (const ce of batchEmbeddings) {
    let bestSim = -Infinity;
    let bestIdx = 0;
    for (let i = 0; i < centroids.length; i++) {
      const sim = cosineSimilarity(ce.embedding, centroids[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    if (bestSim >= DISCOVERY_SIMILARITY_THRESHOLD) {
      // Good fit — assign to nearest existing niche
      assignments.set(ce.companyId, nicheCentroids[bestIdx].nicheId);
    } else {
      // Poor fit — collect for potential new niche discovery
      poorFitEmbeddings.push(ce);
      // Tentatively assign to nearest (will be overridden if new niche is formed)
      assignments.set(ce.companyId, nicheCentroids[bestIdx].nicheId);
    }
  }

  const newClusters: NicheCluster[] = [];

  if (poorFitEmbeddings.length >= MIN_DISCOVERY_CLUSTER_SIZE) {
    console.log(
      `[Clustering] Expand: ${poorFitEmbeddings.length} poor-fit companies (sim < ${DISCOVERY_SIMILARITY_THRESHOLD}) — attempting new niche discovery`
    );

    try {
      const companyMap = new Map(allCompanies.map((c) => [c.id, c]));
      const poorFitCompanies = poorFitEmbeddings
        .map((ce) => companyMap.get(ce.companyId))
        .filter((c): c is Company => c !== undefined);

      // Re-cluster the poor-fit companies
      const discoveredClusters = await clusterCompanies(poorFitEmbeddings, poorFitCompanies);

      for (const cluster of discoveredClusters) {
        newClusters.push(cluster);
        // Override assignments for companies in this new cluster
        for (const companyId of cluster.companyIds) {
          // Use a sentinel value (-cluster.clusterIndex - 1) so the caller
          // can map them to newly created niche IDs after persisting
          assignments.set(companyId, -(cluster.clusterIndex + 1));
        }
      }

      console.log(`[Clustering] Expand: discovered ${discoveredClusters.length} new niches from poor-fit companies`);
    } catch (e) {
      console.warn("[Clustering] Expand: new niche discovery failed, falling back to proximity assignment:", e);
      // Fall back: keep the tentative proximity assignments for poor-fit companies
    }
  } else if (poorFitEmbeddings.length > 0) {
    console.log(
      `[Clustering] Expand: ${poorFitEmbeddings.length} poor-fit companies (below min ${MIN_DISCOVERY_CLUSTER_SIZE} for discovery) — assigned to nearest centroid`
    );
  }

  return { assignments, newClusters };
}
