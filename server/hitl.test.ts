import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

/** Shared mock search owned by userId=1 with searchId=10 */
function createMockSearch(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 10,
    userId: 1,
    companyWebsite: "https://connectgroup.com",
    location: "Georgia, USA",
    offeringName: "Test Offering",
    offeringDescription: null,
    targetMarket: null,
    valueProposition: null,
    keywords: null,
    crossBorderIndicators: null,
    keywordTagsUsed: null,
    selectedSicCodes: null,
    selectedNaicsCodes: null,
    codeSelectionReasoning: null,
    excludedSectors: null,
    codesSearched: 0,
    codesTotal: 0,
    status: "completed" as const,
    sharedWithTeam: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

/** Shared mock company belonging to searchId=10 */
function createMockCompany(id: number, overrides: Partial<Record<string, any>> = {}) {
  return {
    id,
    searchId: 10,
    apolloId: `apollo-${id}`,
    name: `Company ${id}`,
    websiteUrl: `https://company${id}.com`,
    primaryDomain: `company${id}.com`,
    linkedinUrl: null,
    phone: null,
    foundedYear: null,
    revenue: null,
    headcountGrowth: null,
    searchLocation: "Georgia, USA",
    city: null,
    state: null,
    country: null,
    streetAddress: null,
    rawAddress: null,
    sicCodes: null,
    naicsCodes: null,
    enrichmentStatus: "pending" as const,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("HITL Decision Capture", () => {
  describe("submitDecision", () => {
    it("submits a 'call_today' decision", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = createMockCompany(1, {
        city: "Atlanta", state: "Georgia", country: "US",
        sicCodes: JSON.stringify(["3672"]),
        naicsCodes: JSON.stringify(["334412"]),
        enrichmentStatus: "enriched" as const,
      });

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(1);

      const result = await caller.companyFinder.submitDecision({
        companyId: 1,
        searchId: 10,
        decision: "call_today",
      });

      expect(result).toEqual({ decisionId: 1, success: true });
      expect(mockCreateDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 1,
          searchId: 10,
          userId: 1,
          decision: "call_today",
          reasonCode: null,
          reasonNotes: null,
        })
      );

      mockGetCompanyById.mockRestore();
      mockGetSearchById.mockRestore();
      mockCreateDecision.mockRestore();
    });

    it("submits a 'park' decision", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(createMockCompany(2));
      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(2);

      const result = await caller.companyFinder.submitDecision({
        companyId: 2,
        searchId: 10,
        decision: "park",
      });

      expect(result).toEqual({ decisionId: 2, success: true });

      mockGetCompanyById.mockRestore();
      mockGetSearchById.mockRestore();
      mockCreateDecision.mockRestore();
    });

    it("submits 'not_relevant' with wrong_industry and adds SIC/NAICS to exclusion list", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = createMockCompany(3, {
        city: "Savannah", state: "Georgia", country: "US",
        sicCodes: JSON.stringify(["5812", "5813"]),
        naicsCodes: JSON.stringify(["722511"]),
        enrichmentStatus: "enriched" as const,
      });

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(3);
      const mockAddExcludedCode = vi.spyOn(db, "addExcludedCode").mockResolvedValue(1);

      const result = await caller.companyFinder.submitDecision({
        companyId: 3,
        searchId: 10,
        decision: "not_relevant",
        reasonCode: "wrong_industry",
      });

      expect(result).toEqual({ decisionId: 3, success: true });

      // Should add 2 SIC codes + 1 NAICS code = 3 calls
      expect(mockAddExcludedCode).toHaveBeenCalledTimes(3);
      expect(mockAddExcludedCode).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, codeType: "sic", code: "5812" })
      );
      expect(mockAddExcludedCode).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, codeType: "sic", code: "5813" })
      );
      expect(mockAddExcludedCode).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, codeType: "naics", code: "722511" })
      );

      mockGetCompanyById.mockRestore();
      mockGetSearchById.mockRestore();
      mockCreateDecision.mockRestore();
      mockAddExcludedCode.mockRestore();
    });

    it("submits 'not_relevant' with too_small reason (no exclusion)", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = createMockCompany(4, {
        sicCodes: JSON.stringify(["3672"]),
        naicsCodes: JSON.stringify(["334412"]),
        enrichmentStatus: "enriched" as const,
      });

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(4);
      const mockAddExcludedCode = vi.spyOn(db, "addExcludedCode").mockResolvedValue(1);

      await caller.companyFinder.submitDecision({
        companyId: 4,
        searchId: 10,
        decision: "not_relevant",
        reasonCode: "too_small",
      });

      // Should NOT add codes to exclusion list (only wrong_industry triggers that)
      expect(mockAddExcludedCode).not.toHaveBeenCalled();

      mockGetCompanyById.mockRestore();
      mockGetSearchById.mockRestore();
      mockCreateDecision.mockRestore();
      mockAddExcludedCode.mockRestore();
    });

    it("throws error when company not found", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(undefined);

      await expect(
        caller.companyFinder.submitDecision({
          companyId: 999,
          searchId: 10,
          decision: "call_today",
        })
      ).rejects.toThrow("Company not found");

      mockGetCompanyById.mockRestore();
    });

    it("validates decision enum values", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.companyFinder.submitDecision({
          companyId: 1,
          searchId: 10,
          decision: "invalid_decision" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("getDecision", () => {
    it("returns existing decision for a company", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockDecision = {
        id: 1,
        companyId: 1,
        searchId: 10,
        userId: 1,
        decision: "call_today" as const,
        reasonCode: null,
        reasonNotes: null,
        decidedAt: new Date(),
      };

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(createMockCompany(1));
      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockGetDecision = vi.spyOn(db, "getCompanyDecision").mockResolvedValue(mockDecision);

      const result = await caller.companyFinder.getDecision({ companyId: 1 });

      expect(result).toEqual(mockDecision);
      expect(mockGetDecision).toHaveBeenCalledWith(1, 1);

      mockGetCompanyById.mockRestore();
      mockGetSearchById.mockRestore();
      mockGetDecision.mockRestore();
    });

    it("returns null when no decision exists", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(createMockCompany(999));
      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockGetDecision = vi.spyOn(db, "getCompanyDecision").mockResolvedValue(undefined);

      const result = await caller.companyFinder.getDecision({ companyId: 999 });

      expect(result).toBeNull();

      mockGetCompanyById.mockRestore();
      mockGetSearchById.mockRestore();
      mockGetDecision.mockRestore();
    });
  });

  describe("getSearchDecisions", () => {
    it("returns all decisions for a search", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockDecisions = [
        {
          id: 1,
          companyId: 1,
          searchId: 10,
          userId: 1,
          decision: "call_today" as const,
          reasonCode: null,
          reasonNotes: null,
          decidedAt: new Date(),
        },
        {
          id: 2,
          companyId: 2,
          searchId: 10,
          userId: 1,
          decision: "not_relevant" as const,
          reasonCode: "wrong_industry",
          reasonNotes: "Restaurant chain",
          decidedAt: new Date(),
        },
      ];

      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
      const mockGetDecisions = vi.spyOn(db, "getDecisionsBySearch").mockResolvedValue(mockDecisions);

      const result = await caller.companyFinder.getSearchDecisions({ searchId: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].decision).toBe("call_today");
      expect(result[1].decision).toBe("not_relevant");
      expect(result[1].reasonCode).toBe("wrong_industry");

      mockGetSearchById.mockRestore();
      mockGetDecisions.mockRestore();
    });
  });

  describe("getExcludedCodes", () => {
    it("returns excluded codes for the user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCodes = [
        {
          id: 1,
          userId: 1,
          codeType: "sic" as const,
          code: "5812",
          codeDescription: null,
          rejectionCount: 3,
          lastRejectedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          codeType: "naics" as const,
          code: "722511",
          codeDescription: null,
          rejectionCount: 1,
          lastRejectedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      const mockGetCodes = vi.spyOn(db, "getExcludedCodes").mockResolvedValue(mockCodes);

      const result = await caller.companyFinder.getExcludedCodes();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe("5812");
      expect(result[0].codeType).toBe("sic");
      expect(result[0].rejectionCount).toBe(3);

      mockGetCodes.mockRestore();
    });

    it("returns empty array when no codes excluded", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetCodes = vi.spyOn(db, "getExcludedCodes").mockResolvedValue([]);

      const result = await caller.companyFinder.getExcludedCodes();

      expect(result).toEqual([]);

      mockGetCodes.mockRestore();
    });
  });

  describe("removeExcludedCode", () => {
    it("removes an excluded code", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockRemove = vi.spyOn(db, "removeExcludedCode").mockResolvedValue(undefined);

      const result = await caller.companyFinder.removeExcludedCode({ codeId: 1 });

      expect(result).toEqual({ success: true });
      expect(mockRemove).toHaveBeenCalledWith(1, 1);

      mockRemove.mockRestore();
    });
  });
});

describe("HITL Workflow Integration", () => {
  it("wrong_industry rejection with no SIC/NAICS codes does not add exclusions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(createMockCompany(5));
    const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
    const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(5);
    const mockAddExcludedCode = vi.spyOn(db, "addExcludedCode").mockResolvedValue(1);

    await caller.companyFinder.submitDecision({
      companyId: 5,
      searchId: 10,
      decision: "not_relevant",
      reasonCode: "wrong_industry",
    });

    // No codes to add (company has null sicCodes/naicsCodes)
    expect(mockAddExcludedCode).not.toHaveBeenCalled();

    mockGetCompanyById.mockRestore();
    mockGetSearchById.mockRestore();
    mockCreateDecision.mockRestore();
    mockAddExcludedCode.mockRestore();
  });

  it("submits decision with optional reason notes", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(createMockCompany(6));
    const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(createMockSearch());
    const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(6);

    await caller.companyFinder.submitDecision({
      companyId: 6,
      searchId: 10,
      decision: "not_relevant",
      reasonCode: "other",
      reasonNotes: "Company is going through bankruptcy",
    });

    expect(mockCreateDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "other",
        reasonNotes: "Company is going through bankruptcy",
      })
    );

    mockGetCompanyById.mockRestore();
    mockGetSearchById.mockRestore();
    mockCreateDecision.mockRestore();
  });
});
