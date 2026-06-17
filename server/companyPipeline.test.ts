/**
 * Unit tests for unified company pipeline queue + stats logic.
 */
import { describe, it, expect } from "vitest";
import {
  buildPipelineQueue,
  countPipelineRemaining,
  computePipelineStats,
  hasLlmFit,
  companyNeedsPipelineWork,
} from "./companyPipeline";

type MockCo = {
  id: number;
  name: string;
  apolloId: string | null;
  enrichmentStatus: string;
  briefGeneratedAt?: Date | null;
  salesApproachGeneratedAt?: Date | null;
  fitScoreSource?: string | null;
  primaryDomain?: string | null;
};

describe("hasLlmFit", () => {
  const base: MockCo = {
    id: 1,
    name: "Acme",
    apolloId: "a1",
    enrichmentStatus: "enriched",
    fitScoreSource: "embed",
  };

  it("legacy: embed source is not LLM fit", () => {
    expect(hasLlmFit(base, null, null)).toBe(false);
  });

  it("legacy: llm source counts as LLM fit", () => {
    expect(hasLlmFit({ ...base, fitScoreSource: "llm" }, null, null)).toBe(true);
  });

  it("brain-scoped: brain output fitScore counts", () => {
    expect(hasLlmFit(base, { fitScore: 72 }, 5)).toBe(true);
  });
});

describe("buildPipelineQueue", () => {
  const companies: MockCo[] = [
    { id: 1, name: "Pending", apolloId: "a1", enrichmentStatus: "pending" },
    { id: 2, name: "NeedsFit", apolloId: "a2", enrichmentStatus: "enriched", fitScoreSource: "embed" },
    { id: 3, name: "NeedsBrief", apolloId: "a3", enrichmentStatus: "enriched", fitScoreSource: "llm" },
    { id: 4, name: "NeedsApproach", apolloId: "a4", enrichmentStatus: "enriched", fitScoreSource: "llm", briefGeneratedAt: new Date() },
    { id: 5, name: "Done", apolloId: "a5", enrichmentStatus: "enriched", fitScoreSource: "llm", briefGeneratedAt: new Date(), salesApproachGeneratedAt: new Date() },
  ];

  it("orders pending → fit → brief → approach", () => {
    const queue = buildPipelineQueue(companies, new Map(), null);
    expect(queue.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });

  it("respects limit", () => {
    const queue = buildPipelineQueue(companies, new Map(), null, 2);
    expect(queue).toHaveLength(2);
    expect(queue[0].id).toBe(1);
    expect(queue[1].id).toBe(2);
  });

  it("excludes fully complete companies", () => {
    const queue = buildPipelineQueue(companies, new Map(), null);
    expect(queue.find((c) => c.id === 5)).toBeUndefined();
  });
});

describe("countPipelineRemaining", () => {
  it("counts companies needing any pipeline step", () => {
    const companies: MockCo[] = [
      { id: 1, name: "A", apolloId: "a1", enrichmentStatus: "pending" },
      { id: 2, name: "B", apolloId: "a2", enrichmentStatus: "enriched", fitScoreSource: "llm", briefGeneratedAt: new Date(), salesApproachGeneratedAt: new Date() },
    ];
    expect(countPipelineRemaining(companies, new Map(), null)).toBe(1);
  });
});

describe("computePipelineStats", () => {
  it("reports pipeline stages", () => {
    const stats = computePipelineStats([
      { id: 1, name: "A", apolloId: "a1", enrichmentStatus: "enriched", fitScoreSource: "llm", briefGeneratedAt: new Date(), salesApproachGeneratedAt: new Date() },
      { id: 2, name: "B", apolloId: "a2", enrichmentStatus: "enriched", fitScoreSource: "embed" },
      { id: 3, name: "C", apolloId: null, enrichmentStatus: "pending", primaryDomain: null },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.llmFitScored).toBe(1);
    expect(stats.needsFit).toBe(1);
    expect(stats.pipelineComplete).toBe(1);
    expect(stats.remaining).toBe(2);
  });
});

describe("companyNeedsPipelineWork", () => {
  it("needs fit when only embed score exists", () => {
    const c: MockCo = { id: 1, name: "X", apolloId: "a", enrichmentStatus: "enriched", fitScoreSource: "embed" };
    expect(companyNeedsPipelineWork(c, null, null)).toBe(true);
  });
});
