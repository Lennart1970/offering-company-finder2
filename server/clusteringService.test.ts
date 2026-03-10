/**
 * Tests for the two-phase clustering service:
 *   - stratifiedSample: proportional sampling by industry
 *   - assignToNearestCentroid: cosine similarity assignment
 *   - assignRemainingByProximity: batch proximity assignment
 */
import { describe, it, expect } from "vitest";
import {
  stratifiedSample,
  assignToNearestCentroid,
  assignRemainingByProximity,
  SEED_SAMPLE_SIZE,
} from "./clusteringService";
import type { CompanyEmbedding } from "./embeddingService";
import type { Company } from "../drizzle/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCompany(id: number, industry?: string): Company {
  return {
    id,
    searchId: 1,
    name: `Company ${id}`,
    apolloId: null,
    websiteUrl: null,
    primaryDomain: null,
    linkedinUrl: null,
    twitterUrl: null,
    facebookUrl: null,
    phone: null,
    foundedYear: null,
    revenue: null,
    headcountGrowth: null,
    parentCompanyName: null,
    parentCompanyId: null,
    searchLocation: null,
    city: null,
    state: null,
    country: null,
    streetAddress: null,
    rawAddress: null,
    sicCodes: null,
    naicsCodes: null,
    sliceMetadata: industry ? JSON.stringify({ industry }) : null,
    sourceCountryCode: null,
    urgencyScore: null,
    fitScore: null,
    fitScoreData: null,
    briefData: null,
    briefGeneratedAt: null,
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    callReadinessSummary: null,
    productImages: null,
    enrichmentStatus: "pending",
    nicheId: null,
    createdAt: new Date(),
  } as unknown as Company;
}

function makeEmbedding(companyId: number, vec: number[]): CompanyEmbedding {
  return { companyId, embedding: vec, text: `Company ${companyId}` };
}

// ─── stratifiedSample ─────────────────────────────────────────────────────────

describe("stratifiedSample", () => {
  it("returns all companies when count <= size", () => {
    const companies = [makeCompany(1), makeCompany(2), makeCompany(3)];
    const embeddings = companies.map((c) => makeEmbedding(c.id, [0.1, 0.2]));
    const { sample, remainder } = stratifiedSample(embeddings, companies, 10);
    expect(sample).toHaveLength(3);
    expect(remainder).toHaveLength(0);
  });

  it("returns sample of requested size when count > size", () => {
    const companies = Array.from({ length: 100 }, (_, i) => makeCompany(i + 1));
    const embeddings = companies.map((c) => makeEmbedding(c.id, [Math.random(), Math.random()]));
    const { sample, remainder } = stratifiedSample(embeddings, companies, 50);
    expect(sample.length).toBeLessThanOrEqual(50);
    expect(sample.length + remainder.length).toBe(100);
  });

  it("preserves industry proportions in sample", () => {
    // 60 Manufacturing + 40 Retail = 100 companies
    const mfg = Array.from({ length: 60 }, (_, i) => makeCompany(i + 1, "Manufacturing"));
    const retail = Array.from({ length: 40 }, (_, i) => makeCompany(i + 61, "Retail"));
    const companies = [...mfg, ...retail];
    const embeddings = companies.map((c) => makeEmbedding(c.id, [Math.random(), Math.random()]));

    const { sample } = stratifiedSample(embeddings, companies, 50);

    // Sample IDs should include both industries
    const sampleIds = new Set(sample.map((e) => e.companyId));
    const mfgSampled = mfg.filter((c) => sampleIds.has(c.id)).length;
    const retailSampled = retail.filter((c) => sampleIds.has(c.id)).length;

    // Both industries should be represented
    expect(mfgSampled).toBeGreaterThan(0);
    expect(retailSampled).toBeGreaterThan(0);
    // Manufacturing should have more samples (proportional)
    expect(mfgSampled).toBeGreaterThan(retailSampled);
  });

  it("no overlap between sample and remainder", () => {
    const companies = Array.from({ length: 200 }, (_, i) => makeCompany(i + 1));
    const embeddings = companies.map((c) => makeEmbedding(c.id, [Math.random()]));
    const { sample, remainder } = stratifiedSample(embeddings, companies, 100);

    const sampleIds = new Set(sample.map((e) => e.companyId));
    const remainderIds = new Set(remainder.map((e) => e.companyId));
    const overlap = [...sampleIds].filter((id) => remainderIds.has(id));
    expect(overlap).toHaveLength(0);
  });

  it("SEED_SAMPLE_SIZE constant is 500", () => {
    expect(SEED_SAMPLE_SIZE).toBe(500);
  });
});

// ─── assignToNearestCentroid ──────────────────────────────────────────────────

describe("assignToNearestCentroid", () => {
  it("assigns to the closest centroid by cosine similarity", () => {
    // centroid 0: points right [1, 0]
    // centroid 1: points up   [0, 1]
    const centroids = [[1, 0], [0, 1]];

    // Vector pointing mostly right → should be centroid 0
    expect(assignToNearestCentroid([0.9, 0.1], centroids)).toBe(0);
    // Vector pointing mostly up → should be centroid 1
    expect(assignToNearestCentroid([0.1, 0.9], centroids)).toBe(1);
  });

  it("handles a single centroid", () => {
    const centroids = [[1, 0, 0]];
    expect(assignToNearestCentroid([0.5, 0.3, 0.2], centroids)).toBe(0);
  });

  it("handles zero vector gracefully", () => {
    const centroids = [[1, 0], [0, 1]];
    // Zero vector → cosine similarity is 0 for all, returns first (index 0)
    const result = assignToNearestCentroid([0, 0], centroids);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(centroids.length);
  });
});

// ─── assignRemainingByProximity ───────────────────────────────────────────────

describe("assignRemainingByProximity", () => {
  it("assigns each company to the nearest niche", async () => {
    const nicheCentroids = [
      { nicheId: 10, centroid: [1, 0, 0] },
      { nicheId: 20, centroid: [0, 1, 0] },
      { nicheId: 30, centroid: [0, 0, 1] },
    ];

    const embeddings: CompanyEmbedding[] = [
      makeEmbedding(1, [0.9, 0.1, 0.0]), // closest to niche 10
      makeEmbedding(2, [0.1, 0.8, 0.1]), // closest to niche 20
      makeEmbedding(3, [0.0, 0.1, 0.9]), // closest to niche 30
    ];

    const assignments = await assignRemainingByProximity(embeddings, nicheCentroids);

    expect(assignments.get(1)).toBe(10);
    expect(assignments.get(2)).toBe(20);
    expect(assignments.get(3)).toBe(30);
  });

  it("returns a map with all company IDs", async () => {
    const nicheCentroids = [{ nicheId: 1, centroid: [1, 0] }];
    const embeddings = [
      makeEmbedding(100, [0.8, 0.2]),
      makeEmbedding(200, [0.6, 0.4]),
      makeEmbedding(300, [0.9, 0.1]),
    ];

    const assignments = await assignRemainingByProximity(embeddings, nicheCentroids);
    expect(assignments.size).toBe(3);
    expect(assignments.has(100)).toBe(true);
    expect(assignments.has(200)).toBe(true);
    expect(assignments.has(300)).toBe(true);
  });

  it("returns empty map for empty input", async () => {
    const nicheCentroids = [{ nicheId: 1, centroid: [1, 0] }];
    const assignments = await assignRemainingByProximity([], nicheCentroids);
    expect(assignments.size).toBe(0);
  });

  it("calls onProgress callback", async () => {
    const nicheCentroids = [{ nicheId: 1, centroid: [1, 0] }];
    const embeddings = Array.from({ length: 250 }, (_, i) =>
      makeEmbedding(i + 1, [Math.random(), Math.random()])
    );

    const progressCalls: number[] = [];
    await assignRemainingByProximity(embeddings, nicheCentroids, (assigned) => {
      progressCalls.push(assigned);
    });

    // Progress should be called at least once (every 100 + final)
    expect(progressCalls.length).toBeGreaterThan(0);
    // Last call should be total
    expect(progressCalls[progressCalls.length - 1]).toBe(250);
  });
});
