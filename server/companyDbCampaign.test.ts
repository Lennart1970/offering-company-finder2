import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(),
    createSearch: vi.fn(),
    createCompanies: vi.fn(),
    getCompanyBrainOutputsForSearch: vi.fn(),
    getCompanyDatabase: vi.fn(),
    countCompanyDatabase: vi.fn(),
  };
});

import {
  cloneCompaniesToCampaign,
  resolveCompanyIdsFromFilter,
  COMPANY_DB_CAMPAIGN_MAX,
} from "./companyDbCampaign";
import {
  getDb,
  createSearch,
  createCompanies,
  getCompanyBrainOutputsForSearch,
  getCompanyDatabase,
  countCompanyDatabase,
} from "./db";

describe("companyDbCampaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cloneCompaniesToCampaign", () => {
    const sourceCompany = {
      id: 10,
      searchId: 1,
      name: "Acme GmbH",
      apolloId: "apollo-1",
      primaryDomain: "acme.com",
      country: "Germany",
      fitScore: 88,
      fitScoreData: '{"score":88}',
      briefData: '{"summary":"test brief"}',
      briefGeneratedAt: new Date("2025-01-01"),
      salesApproachData: '{"email":"hi"}',
      similarityScore: 76,
      enrichmentStatus: "enriched" as const,
      generatedWithBrainId: 5,
      generatedWithBrainName: "Test Brain",
    };

    function mockDbChain(opts: {
      brain?: { id: number; brainName: string; companyWebsite: string } | null;
      sources?: typeof sourceCompany[];
      newRows?: { id: number; apolloId: string; primaryDomain: string; name: string; country: string }[];
    }) {
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const insertOutputs = vi.fn().mockResolvedValue(undefined);

      const db = {
        execute: vi.fn().mockResolvedValue(
          opts.brain === null ? [] : [[opts.brain ?? { id: 5, brainName: "Test Brain", companyWebsite: "https://example.com" }]]
        ),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(async () => {
              const fromCall = (db.select as ReturnType<typeof vi.fn>).mock.calls.length;
              if (fromCall === 1) return opts.sources ?? [sourceCompany];
              return opts.newRows ?? [{ id: 100, apolloId: "apollo-1", primaryDomain: "acme.com", name: "Acme GmbH", country: "Germany" }];
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: insertOutputs }),
        delete: vi.fn().mockReturnValue({ where: deleteWhere }),
      };

      vi.mocked(getDb).mockResolvedValue(db as never);
      vi.mocked(createSearch).mockResolvedValue(42);
      vi.mocked(createCompanies).mockResolvedValue(undefined);
      vi.mocked(getCompanyBrainOutputsForSearch).mockResolvedValue(
        new Map([
          [
            10,
            {
              id: 1,
              companyId: 10,
              brainId: 5,
              fitScore: 90,
              fitScoreData: '{"brain":90}',
              briefData: '{"brainBrief":true}',
              briefGeneratedAt: new Date("2025-01-02"),
              salesApproachData: null,
              salesApproachGeneratedAt: null,
              urgencyScore: 55,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        ])
      );

      return { db, insertOutputs, deleteWhere };
    }

    it("creates search with [DB] prefix and clones companies preserving scores", async () => {
      mockDbChain({});

      const result = await cloneCompaniesToCampaign({
        userId: 1,
        brainId: 5,
        campaignName: "Germany MedTech",
        companyIds: [10],
      });

      expect(createSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          offeringName: "[DB] Germany MedTech",
          brainId: 5,
          status: "completed",
        })
      );
      expect(createCompanies).toHaveBeenCalledWith([
        expect.objectContaining({
          searchId: 42,
          name: "Acme GmbH",
          fitScore: 88,
          briefData: '{"summary":"test brief"}',
        }),
      ]);
      expect(result).toEqual({ searchId: 42, companiesCopied: 1 });
    });

    it("copies company_brain_outputs for the campaign brain", async () => {
      const { insertOutputs } = mockDbChain({});

      await cloneCompaniesToCampaign({
        userId: 1,
        brainId: 5,
        campaignName: "Test",
        companyIds: [10],
      });

      expect(insertOutputs).toHaveBeenCalledWith([
        expect.objectContaining({
          companyId: 100,
          brainId: 5,
          fitScore: 90,
          briefData: '{"brainBrief":true}',
        }),
      ]);
    });

    it("rejects more than max companies", async () => {
      const ids = Array.from({ length: COMPANY_DB_CAMPAIGN_MAX + 1 }, (_, i) => i + 1);
      await expect(
        cloneCompaniesToCampaign({
          userId: 1,
          brainId: 5,
          campaignName: "Too many",
          companyIds: ids,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("100"),
      });
    });

    it("rolls back search when copy fails", async () => {
      const { deleteWhere } = mockDbChain({});
      vi.mocked(createCompanies).mockRejectedValue(new Error("insert failed"));

      await expect(
        cloneCompaniesToCampaign({
          userId: 1,
          brainId: 5,
          campaignName: "Fail",
          companyIds: [10],
        })
      ).rejects.toBeInstanceOf(TRPCError);

      expect(deleteWhere).toHaveBeenCalled();
    });
  });

  describe("resolveCompanyIdsFromFilter", () => {
    it("returns ids and total from company database query capped at 100", async () => {
      vi.mocked(getCompanyDatabase).mockResolvedValue([
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ] as never);
      vi.mocked(countCompanyDatabase).mockResolvedValue(250);

      const result = await resolveCompanyIdsFromFilter({
        sortBy: "fitScore",
        sortDir: "desc",
        country: "Germany",
      });

      expect(getCompanyDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 0,
          country: "Germany",
          sortBy: "fitScore",
          sortDir: "desc",
        })
      );
      expect(result).toEqual({ companyIds: [1, 2], totalMatched: 250 });
    });
  });
});
