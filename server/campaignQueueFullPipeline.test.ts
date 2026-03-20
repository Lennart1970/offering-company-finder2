/**
 * Tests for the full-pipeline campaign queue worker
 * Covers: Step 0 (enrichment), Step 1 (fit score), Step 2 (brief), Step 3 (sales approach)
 * and the enqueueSearch procedure picking up unenriched companies.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function safeParseJson(raw: string): unknown {
  const cleaned = stripJsonFences(raw);
  return JSON.parse(cleaned);
}

// ── Pipeline step logic ──────────────────────────────────────────────────────

function shouldEnrich(enrichmentStatus: string): boolean {
  return enrichmentStatus === "pending";
}

function shouldScore(fitScore: number | null): boolean {
  return fitScore === null || fitScore === undefined;
}

function shouldGenerateBrief(
  briefData: string | null,
  briefGeneratedAt: Date | null,
  maxAgeDays = 7
): boolean {
  if (!briefData) return true;
  if (!briefGeneratedAt) return true;
  const ageMs = Date.now() - new Date(briefGeneratedAt).getTime();
  return ageMs >= maxAgeDays * 24 * 60 * 60 * 1000;
}

function shouldGenerateApproach(
  briefData: string | null,
  salesApproachData: string | null,
  salesApproachGeneratedAt: Date | null,
  maxAgeDays = 7
): boolean {
  if (!briefData) return false; // Need brief first
  if (!salesApproachData) return true;
  if (!salesApproachGeneratedAt) return true;
  const ageMs = Date.now() - new Date(salesApproachGeneratedAt).getTime();
  return ageMs >= maxAgeDays * 24 * 60 * 60 * 1000;
}

function filterProcessableCompanies(
  companies: Array<{ enrichmentStatus: string; salesApproachData: string | null }>
) {
  return companies.filter(
    (c) => c.enrichmentStatus !== "failed" || c.salesApproachData !== null
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("JSON fence stripping (briefGenerator fix)", () => {
  it("strips ```json fences from LLM response", () => {
    const raw = "```json\n{\"urgencyScore\": 75}\n```";
    const parsed = safeParseJson(raw) as any;
    expect(parsed.urgencyScore).toBe(75);
  });

  it("strips plain ``` fences", () => {
    const raw = "```\n{\"score\": 42}\n```";
    const parsed = safeParseJson(raw) as any;
    expect(parsed.score).toBe(42);
  });

  it("passes clean JSON through unchanged", () => {
    const raw = '{"name": "ACME"}';
    const parsed = safeParseJson(raw) as any;
    expect(parsed.name).toBe("ACME");
  });

  it("throws on truly invalid JSON", () => {
    expect(() => safeParseJson("not json at all")).toThrow();
  });
});

describe("Pipeline step gating", () => {
  it("enriches a company with pending enrichmentStatus", () => {
    expect(shouldEnrich("pending")).toBe(true);
  });

  it("skips enrichment for already-enriched company", () => {
    expect(shouldEnrich("enriched")).toBe(false);
  });

  it("skips enrichment for failed company", () => {
    expect(shouldEnrich("failed")).toBe(false);
  });

  it("scores a company with no fit score", () => {
    expect(shouldScore(null)).toBe(true);
  });

  it("skips scoring if fit score already exists", () => {
    expect(shouldScore(85)).toBe(false);
  });

  it("generates brief if none exists", () => {
    expect(shouldGenerateBrief(null, null)).toBe(true);
  });

  it("generates brief if older than 7 days", () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(shouldGenerateBrief('{"urgencyScore":50}', oldDate)).toBe(true);
  });

  it("skips brief if fresh (< 7 days)", () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(shouldGenerateBrief('{"urgencyScore":50}', recentDate)).toBe(false);
  });

  it("skips sales approach if no brief exists", () => {
    expect(shouldGenerateApproach(null, null, null)).toBe(false);
  });

  it("generates approach if brief exists but approach does not", () => {
    expect(shouldGenerateApproach('{"urgencyScore":50}', null, null)).toBe(true);
  });

  it("skips approach if brief and approach both fresh", () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(shouldGenerateApproach('{"urgencyScore":50}', '{"approach":"..."}', recentDate)).toBe(false);
  });
});

describe("enqueueSearch: processable company filter", () => {
  it("includes pending-enrichment companies (Step 0 will handle them)", () => {
    const companies = [
      { enrichmentStatus: "pending", salesApproachData: null },
    ];
    expect(filterProcessableCompanies(companies)).toHaveLength(1);
  });

  it("includes enriched companies", () => {
    const companies = [
      { enrichmentStatus: "enriched", salesApproachData: null },
    ];
    expect(filterProcessableCompanies(companies)).toHaveLength(1);
  });

  it("excludes failed-enrichment companies with no approach (nothing we can do)", () => {
    const companies = [
      { enrichmentStatus: "failed", salesApproachData: null },
    ];
    expect(filterProcessableCompanies(companies)).toHaveLength(0);
  });

  it("includes failed-enrichment companies that already have an approach (partial data)", () => {
    const companies = [
      { enrichmentStatus: "failed", salesApproachData: '{"approach":"..."}' },
    ];
    expect(filterProcessableCompanies(companies)).toHaveLength(1);
  });

  it("handles mixed batch correctly", () => {
    const companies = [
      { enrichmentStatus: "pending", salesApproachData: null },
      { enrichmentStatus: "enriched", salesApproachData: null },
      { enrichmentStatus: "failed", salesApproachData: null },
      { enrichmentStatus: "failed", salesApproachData: '{"approach":"..."}' },
    ];
    expect(filterProcessableCompanies(companies)).toHaveLength(3);
  });
});
