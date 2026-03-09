/**
 * nicheFitScorer.test.ts
 *
 * Unit tests for the dynamic niche fit scoring engine.
 * Tests focus on the scoring logic, validation, and score consistency —
 * not on the LLM call itself (which is mocked).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NicheClusterInput, NicheFitResult } from "./nicheFitScorer";

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => ({
  getActiveBrain: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { getActiveBrain } from "./db";
import { scoreNicheFit, scoreNichesBatch } from "./nicheFitScorer";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const mockBrain = {
  id: 1,
  userId: 42,
  brainName: "FX Payments Brain",
  companyName: "Acme FX",
  companyWebsite: "https://acmefx.com",
  offeringSummary: "Cross-border payment solutions for mid-market exporters",
  coreCapabilities: JSON.stringify(["FX hedging", "Multi-currency accounts", "Trade finance"]),
  valuePropositions: JSON.stringify([
    { audience: "CFOs", value: "Reduce FX exposure by 40%" },
    { audience: "Finance teams", value: "Automate multi-currency reconciliation" },
  ]),
  icpIndustries: JSON.stringify(["Manufacturing", "Export", "Wholesale Trade"]),
  icpCompanySize: "50-500 employees",
  icpGeography: "Europe, Middle East",
  icpPainPoints: JSON.stringify(["FX volatility risk", "Manual reconciliation", "High bank fees"]),
  icpBuyingSignals: JSON.stringify(["International expansion", "New export markets", "ERP upgrade"]),
  fitCriteria: JSON.stringify({
    mustHave: ["International revenue", "Regular FX transactions"],
    niceToHave: ["Multiple currencies", "Trade finance needs"],
    disqualifiers: ["Domestic only", "Public sector"],
  }),
  urgencyTriggers: null,
  sicCodes: null,
  naceCodes: null,
  rawResearchData: null,
  competitiveAdvantages: null,
  status: "completed" as const,
  isActive: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockNiche: NicheClusterInput = {
  name: "Export + Manufacturing + Trade Finance",
  description: "Mid-market manufacturers with significant export activity and trade finance needs.",
  topKeywords: ["export", "manufacturing", "trade finance", "international", "multi-currency"],
  sampleCompanies: ["Acme Steel", "Beta Plastics", "Gamma Textiles"],
  rationale: "Companies grouped by export orientation and manufacturing sector with cross-border payment complexity.",
  companyCount: 45,
};

const mockLLMResponse = {
  choices: [
    {
      index: 0,
      message: {
        role: "assistant" as const,
        content: JSON.stringify({
          fitScore: 82,
          fitReasoning:
            "This niche shows strong alignment with the FX payments offering. The export + manufacturing profile directly matches the ICP, and the trade finance keyword signals active cross-border payment needs. Company size and geography are well within target parameters.",
          scoreBreakdown: [
            {
              dimension: "Export & Cross-Border Activity",
              score: 28,
              maxScore: 30,
              weight: 30,
              reasoning:
                "Keywords 'export' and 'international' confirm active cross-border operations. Trade finance signals regular FX transactions.",
            },
            {
              dimension: "Manufacturing Sector Alignment",
              score: 22,
              maxScore: 25,
              weight: 25,
              reasoning:
                "Manufacturing is a top ICP industry. The cluster's focus on manufacturers with export activity is a direct match.",
            },
            {
              dimension: "Payment Complexity Fit",
              score: 18,
              maxScore: 25,
              weight: 25,
              reasoning:
                "Multi-currency keyword and trade finance needs indicate payment complexity that the offering directly addresses.",
            },
            {
              dimension: "Company Size & Geography Fit",
              score: 14,
              maxScore: 20,
              weight: 20,
              reasoning:
                "Mid-market sizing aligns with ICP. Geography inference from sample companies suggests European presence.",
            },
          ],
        }),
      },
      finish_reason: "stop",
    },
  ],
  id: "test-id",
  created: Date.now(),
  model: "test-model",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("scoreNicheFit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveBrain).mockResolvedValue(mockBrain as any);
    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse as any);
  });

  it("returns a valid NicheFitResult with correct structure", async () => {
    const result = await scoreNicheFit(mockNiche, 42);

    expect(result).toMatchObject({
      fitScore: expect.any(Number),
      fitReasoning: expect.any(String),
      scoreBreakdown: expect.any(Array),
      scoredAt: expect.any(String),
      brainName: "FX Payments Brain",
      brainId: 1,
      nicheName: "Export + Manufacturing + Trade Finance",
    });
  });

  it("fitScore equals the sum of all dimension scores", async () => {
    const result = await scoreNicheFit(mockNiche, 42);
    const sumOfScores = result.scoreBreakdown.reduce((s, d) => s + d.score, 0);
    expect(result.fitScore).toBe(sumOfScores);
  });

  it("fitScore is clamped between 0 and 100", async () => {
    const result = await scoreNicheFit(mockNiche, 42);
    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.fitScore).toBeLessThanOrEqual(100);
  });

  it("each dimension score does not exceed its maxScore", async () => {
    const result = await scoreNicheFit(mockNiche, 42);
    for (const dim of result.scoreBreakdown) {
      expect(dim.score).toBeLessThanOrEqual(dim.maxScore);
      expect(dim.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("scoreBreakdown has between 3 and 5 dimensions", async () => {
    const result = await scoreNicheFit(mockNiche, 42);
    expect(result.scoreBreakdown.length).toBeGreaterThanOrEqual(3);
    expect(result.scoreBreakdown.length).toBeLessThanOrEqual(5);
  });

  it("throws if no active brain is found", async () => {
    vi.mocked(getActiveBrain).mockResolvedValue(null);
    await expect(scoreNicheFit(mockNiche, 42)).rejects.toThrow(
      "No active Offering Brain found"
    );
  });

  it("throws if brain status is not completed", async () => {
    vi.mocked(getActiveBrain).mockResolvedValue({
      ...mockBrain,
      status: "researching",
    } as any);
    await expect(scoreNicheFit(mockNiche, 42)).rejects.toThrow(
      "No active Offering Brain found"
    );
  });

  it("handles LLM returning array content (not string)", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      ...mockLLMResponse,
      choices: [
        {
          ...mockLLMResponse.choices[0],
          message: {
            ...mockLLMResponse.choices[0].message,
            content: [
              {
                type: "text",
                text: mockLLMResponse.choices[0].message.content as string,
              },
            ] as any,
          },
        },
      ],
    } as any);

    const result = await scoreNicheFit(mockNiche, 42);
    expect(result.fitScore).toBeGreaterThan(0);
  });

  it("passes the offering brain context to the LLM prompt", async () => {
    await scoreNicheFit(mockNiche, 42);
    const callArgs = vi.mocked(invokeLLM).mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === "user");
    // Brain name is in the console log, not the prompt body — check for company name and niche name instead
    expect(userMessage?.content).toContain("Acme FX");
    expect(userMessage?.content).toContain("Export + Manufacturing + Trade Finance");
  });

  it("passes niche keywords to the LLM prompt", async () => {
    await scoreNicheFit(mockNiche, 42);
    const callArgs = vi.mocked(invokeLLM).mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === "user");
    expect(userMessage?.content).toContain("export");
    expect(userMessage?.content).toContain("trade finance");
  });
});

describe("scoreNichesBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveBrain).mockResolvedValue(mockBrain as any);
    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse as any);
  });

  it("returns results for all niches", async () => {
    const niches: NicheClusterInput[] = [
      mockNiche,
      { ...mockNiche, name: "Domestic Retail Only", topKeywords: ["retail", "domestic"] },
    ];
    const results = await scoreNichesBatch(niches, 42);
    expect(results).toHaveLength(2);
  });

  it("catches errors per niche without failing the whole batch", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(mockLLMResponse as any)
      .mockRejectedValueOnce(new Error("LLM timeout"));

    const niches: NicheClusterInput[] = [
      mockNiche,
      { ...mockNiche, name: "Failing Niche" },
    ];
    const results = await scoreNichesBatch(niches, 42);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty("fitScore");
    expect(results[1]).toHaveProperty("error", "LLM timeout");
  });
});
