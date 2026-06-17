import { describe, it, expect, vi } from "vitest";
import { v5 as uuidv5 } from "uuid";
import {
  cosineSimilarityScore0to100,
  scoreAllEmbeddingsAgainstVector,
} from "./companySimilaritySearch";
import { toCompanyUUID } from "./supabaseEmbeddings";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("company lookalike helpers", () => {
  describe("toCompanyUUID round-trip", () => {
    it("maps mysql id to deterministic watchlist uuid", () => {
      expect(toCompanyUUID(42)).toBe(uuidv5("company-42", LT_NAMESPACE));
      expect(toCompanyUUID(12345)).toBe(uuidv5("company-12345", LT_NAMESPACE));
    });
  });

  describe("cosineSimilarityScore0to100", () => {
    it("returns 100 for identical vectors", () => {
      const v = [0.1, 0.2, 0.3];
      expect(cosineSimilarityScore0to100(v, v)).toBe(100);
    });

    it("returns 50 for orthogonal unit vectors", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarityScore0to100(a, b)).toBe(50);
    });

    it("respects minScore threshold when ranking embeddings", async () => {
      const queryVector = [1, 0, 0];
      const rows = [
        { watchlist_id: toCompanyUUID(1), embedding: [1, 0, 0] },
        { watchlist_id: toCompanyUUID(2), embedding: [0.99, 0.01, 0] },
        { watchlist_id: toCompanyUUID(3), embedding: [0, 1, 0] },
      ];

      const sb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            range: vi.fn(async (from: number, to: number) => ({
              data: rows.slice(from, to + 1),
              error: null,
            })),
          })),
        })),
      } as any;

      const { scored, top } = await scoreAllEmbeddingsAgainstVector(sb, queryVector, {
        minScore: 90,
        maxResults: 10,
      });

      expect(scored.length).toBeGreaterThanOrEqual(2);
      expect(top.every((t) => t.score >= 90)).toBe(true);
    });
  });

  describe("scoreAllEmbeddingsAgainstVector seed exclusion", () => {
    it("excludes seed watchlist id from results", async () => {
      const queryVector = [1, 0, 0];
      const seedWatchlistId = toCompanyUUID(1);
      const rows = [
        { watchlist_id: seedWatchlistId, embedding: [1, 0, 0] },
        { watchlist_id: toCompanyUUID(2), embedding: [0.95, 0.05, 0] },
        { watchlist_id: toCompanyUUID(3), embedding: [0.9, 0.1, 0] },
      ];

      const sb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            range: vi.fn(async (from: number, to: number) => ({
              data: rows.slice(from, to + 1),
              error: null,
            })),
          })),
        })),
      } as any;

      const { top } = await scoreAllEmbeddingsAgainstVector(sb, queryVector, {
        minScore: 50,
        maxResults: 10,
        excludeWatchlistIds: [seedWatchlistId],
      });

      expect(top.every((t) => t.watchlistId !== seedWatchlistId)).toBe(true);
      expect(top.length).toBe(2);
    });
  });
});

describe("createCampaignFromLookalike naming contract", () => {
  it("documents expected search row shape for lookalike campaigns", () => {
    const seedName = "AIRBUS";
    const seedCompanyId = 7;
    const campaignName = "Like AIRBUS peers";

    const offeringName = `[LIKE] ${campaignName}`;
    const location = `Lookalike: ${seedName} (id=${seedCompanyId})`;

    expect(offeringName).toBe("[LIKE] Like AIRBUS peers");
    expect(location).toBe("Lookalike: AIRBUS (id=7)");
  });
});
