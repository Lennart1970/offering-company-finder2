/**
 * Clustering Service
 *
 * Runs k-means++ on company embeddings to discover niche clusters.
 * Uses silhouette score to auto-select the optimal K (3–12 clusters).
 *
 * Pipeline: generateEmbeddings → clusterCompanies → scoreNiches
 */
import { invokeLLM } from "./_core/llm";
import type { CompanyEmbedding } from "./embeddingService";
import type { Company } from "../drizzle/schema";

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

// ─── K-Means++ ──────────────────────────────────────────────────────────────

function kMeansPlusPlus(
  embeddings: number[][],
  k: number
): { assignments: number[]; centroids: number[][] } {
  const n = embeddings.length;

  // K-means++ initialisation: pick first centroid randomly, then pick
  // subsequent centroids with probability proportional to distance squared
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

  // Iterate
  for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
    // Assign each point to nearest centroid
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

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    // Update centroids
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

    // a(i): mean distance to same-cluster points
    const a = sameCluster.reduce((sum, v) => sum + cosineDistance(embeddings[i], v), 0) / sameCluster.length;

    // b(i): min mean distance to any other cluster
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
    // Run k-means 3 times and pick best (reduces sensitivity to random init)
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

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Cluster companies by embedding similarity using k-means++ with auto-K selection.
 * Returns NicheCluster[] with LLM-generated names and descriptions.
 */
export async function clusterCompanies(
  companyEmbeddings: CompanyEmbedding[],
  allCompanies: Company[]
): Promise<NicheCluster[]> {
  if (companyEmbeddings.length < MIN_K * MIN_COMPANIES_PER_CLUSTER) {
    throw new Error(
      `Need at least ${MIN_K * MIN_COMPANIES_PER_CLUSTER} companies to cluster. Got ${companyEmbeddings.length}.`
    );
  }

  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));
  const embeddings = companyEmbeddings.map((e) => e.embedding);

  console.log(`[Clustering] Running k-means++ on ${embeddings.length} companies (k=${MIN_K}–${MAX_K})`);
  const { k, assignments, centroids } = selectOptimalK(embeddings, MIN_K, MAX_K);

  // Group companies by cluster
  const clusters: NicheCluster[] = [];
  for (let c = 0; c < k; c++) {
    const clusterEmbeddings = companyEmbeddings.filter((_, i) => assignments[i] === c);
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

  console.log(`[Clustering] Done: ${clusters.length} niches identified`);
  return clusters;
}
