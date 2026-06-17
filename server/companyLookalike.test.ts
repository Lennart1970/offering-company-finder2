import { describe, it, expect, vi, beforeEach } from "vitest";
import { v5 as uuidv5 } from "uuid";
import {
  cosineSimilarityScore0to100,
  scoreAllEmbeddingsAgainstVector,
  minSim0to100ToRpcThreshold,
  rpcSimilarityToSim0to100,
  matchCompaniesByEmbeddingRpc,
  mapRpcMatchesToMysqlCompanies,
  prependSeedToLookalikeResults,
  mergeLookalikeCampaignCompanyIds,
  type RpcMatchRow,
  type MysqlCompanySimRow,
} from "./companySimilaritySearch";
import { toCompanyUUID } from "./supabaseEmbeddings";

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("company lookalike helpers", () => {
  describe("RPC score scale conversion", () => {
    it("converts minSim 55 to RPC threshold 0.1", () => {
      expect(minSim0to100ToRpcThreshold(55)).toBeCloseTo(0.1);
    });

    it("converts minSim 70 to RPC threshold 0.4", () => {
      expect(minSim0to100ToRpcThreshold(70)).toBeCloseTo(0.4);
    });

    it("converts minSim 100 to RPC threshold 1", () => {
      expect(minSim0to100ToRpcThreshold(100)).toBe(1);
    });

    it("converts minSim 50 to RPC threshold 0", () => {
      expect(minSim0to100ToRpcThreshold(50)).toBe(0);
    });

    it("round-trips RPC cosine to UI simScore", () => {
      expect(rpcSimilarityToSim0to100(0.1)).toBe(55);
      expect(rpcSimilarityToSim0to100(1)).toBe(100);
      expect(rpcSimilarityToSim0to100(0)).toBe(50);
    });
  });

  describe("matchCompaniesByEmbeddingRpc", () => {
    it("calls RPC with converted threshold and excludes seed ids", async () => {
      const seedUuid = toCompanyUUID(1);
      const matchUuid = toCompanyUUID(2);
      const rpc = vi.fn(async () => ({
        data: [
          { company_id: seedUuid, company_name: "Seed", similarity_score: 0.99 },
          { company_id: matchUuid, company_name: "Peer", similarity_score: 0.8 },
        ],
        error: null,
      }));

      const sb = { rpc } as any;
      const { matches } = await matchCompaniesByEmbeddingRpc(sb, [1, 0, 0], {
        minSim: 55,
        maxResults: 10,
        excludeWatchlistIds: [seedUuid],
      });

      expect(rpc).toHaveBeenCalledWith("match_companies_to_embedding", {
        p_embedding: [1, 0, 0],
        p_limit: 10,
        p_threshold: expect.closeTo(0.1),
      });
      expect(matches).toHaveLength(1);
      expect(matches[0].company_id).toBe(matchUuid);
    });
  });

  describe("mapRpcMatchesToMysqlCompanies", () => {
    beforeEach(() => {
      vi.mocked(getDb).mockReset();
    });

    it("resolves UUIDs via Supabase registry and enriches from MySQL", async () => {
      const uuid2 = toCompanyUUID(2);
      const uuid3 = toCompanyUUID(3);
      const matches: RpcMatchRow[] = [
        {
          company_id: uuid2,
          company_name: "Peer A",
          country: "France",
          sector: "Aerospace",
          similarity_score: 0.9,
        },
        {
          company_id: uuid3,
          company_name: "Peer B",
          country: "Germany",
          sector: "Defense",
          similarity_score: 0.7,
        },
      ];

      const sb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: uuid2, mysql_id: 2 },
                { id: uuid3, mysql_id: 3 },
              ],
            })),
          })),
        })),
      } as any;

      const companyRows = [
        {
          id: 2,
          name: "Peer A",
          websiteUrl: null,
          primaryDomain: "peera.com",
          city: "Paris",
          country: "France",
          sector: "Aerospace",
          fitScore: 80,
          searchId: 1,
          generatedWithBrainName: null,
        },
        {
          id: 3,
          name: "Peer B",
          websiteUrl: null,
          primaryDomain: "peerb.com",
          city: "Berlin",
          country: "Germany",
          sector: "Defense",
          fitScore: 70,
          searchId: 1,
          generatedWithBrainName: null,
        },
      ];

      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => companyRows),
            limit: vi.fn(() => ({
              offset: vi.fn(async () => []),
            })),
          })),
        })),
      } as any);

      const { companies: result, totalMatched } = await mapRpcMatchesToMysqlCompanies(sb, matches);

      expect(totalMatched).toBe(2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[0].simScore).toBe(rpcSimilarityToSim0to100(0.9));
      expect(result[1].simScore).toBe(rpcSimilarityToSim0to100(0.7));
    });

    it("filters by country and sector on RPC rows before MySQL lookup", async () => {
      const uuid2 = toCompanyUUID(2);
      const matches: RpcMatchRow[] = [
        {
          company_id: uuid2,
          company_name: "Peer A",
          country: "France",
          sector: "Aerospace",
          similarity_score: 0.85,
        },
        {
          company_id: toCompanyUUID(4),
          company_name: "Peer US",
          country: "United States",
          sector: "Aerospace",
          similarity_score: 0.9,
        },
      ];

      const sb = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: uuid2, mysql_id: 2 }],
            })),
          })),
        })),
      } as any;

      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              {
                id: 2,
                name: "Peer A",
                websiteUrl: null,
                primaryDomain: "peera.com",
                city: "Paris",
                country: "France",
                sector: "Aerospace",
                fitScore: 80,
                searchId: 1,
                generatedWithBrainName: null,
              },
            ]),
            limit: vi.fn(() => ({
              offset: vi.fn(async () => []),
            })),
          })),
        })),
      } as any);

      const { companies: result, totalMatched } = await mapRpcMatchesToMysqlCompanies(sb, matches, {
        country: "France",
        sector: "Aero",
      });

      expect(totalMatched).toBe(1);
      expect(result).toHaveLength(1);
      expect(result[0].country).toBe("France");
    });
  });

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

describe("lookalike seed inclusion helpers", () => {
  const baseSeed: Omit<MysqlCompanySimRow, "simScore" | "isSeed"> = {
    id: 1,
    name: "AIRBUS",
    websiteUrl: "https://airbus.com",
    primaryDomain: "airbus.com",
    city: "Toulouse",
    country: "France",
    sector: "Aerospace",
    fitScore: 82,
    searchId: 10,
    generatedWithBrainName: "Industrial IoT",
  };

  const peer: MysqlCompanySimRow = {
    id: 2,
    name: "Peer A",
    websiteUrl: null,
    primaryDomain: "peera.com",
    city: "Paris",
    country: "France",
    sector: "Aerospace",
    fitScore: 75,
    searchId: 11,
    generatedWithBrainName: null,
    simScore: 88,
  };

  it("prepends seed with simScore 100 and isSeed true", () => {
    const result = prependSeedToLookalikeResults(baseSeed, [peer]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[0].simScore).toBe(100);
    expect(result[0].isSeed).toBe(true);
    expect(result[1].id).toBe(2);
  });

  it("dedupes seed when it appears among peers", () => {
    const duplicatePeer: MysqlCompanySimRow = { ...baseSeed, simScore: 99 };
    const result = prependSeedToLookalikeResults(baseSeed, [duplicatePeer, peer]);

    expect(result).toHaveLength(2);
    expect(result[0].isSeed).toBe(true);
    expect(result.filter((c) => c.id === 1)).toHaveLength(1);
  });

  it("mergeLookalikeCampaignCompanyIds always includes seed and dedupes", () => {
    expect(mergeLookalikeCampaignCompanyIds(7, [2, 3])).toEqual([7, 2, 3]);
    expect(mergeLookalikeCampaignCompanyIds(7, [7, 2, 3])).toEqual([7, 2, 3]);
    expect(mergeLookalikeCampaignCompanyIds(7, [2])).toEqual([7, 2]);
  });
});
