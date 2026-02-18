import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("HITL Decision Capture", () => {
  describe("submitDecision", () => {
    it("submits a 'call_today' decision", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = {
        id: 1,
        searchId: 10,
        apolloId: "apollo-1",
        name: "Good Company",
        websiteUrl: "https://good.com",
        primaryDomain: "good.com",
        linkedinUrl: null,
        phone: null,
        foundedYear: null,
        revenue: null,
        headcountGrowth: null,
        searchLocation: "Georgia, USA",
        city: "Atlanta",
        state: "Georgia",
        country: "US",
        streetAddress: null,
        rawAddress: null,
        sicCodes: JSON.stringify(["3672"]),
        naicsCodes: JSON.stringify(["334412"]),
        enrichmentStatus: "enriched" as const,
        createdAt: new Date(),
      };

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
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
      mockCreateDecision.mockRestore();
    });

    it("submits a 'park' decision", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = {
        id: 2,
        searchId: 10,
        apolloId: "apollo-2",
        name: "Maybe Company",
        websiteUrl: "https://maybe.com",
        primaryDomain: "maybe.com",
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
      };

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
      const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(2);

      const result = await caller.companyFinder.submitDecision({
        companyId: 2,
        searchId: 10,
        decision: "park",
      });

      expect(result).toEqual({ decisionId: 2, success: true });

      mockGetCompanyById.mockRestore();
      mockCreateDecision.mockRestore();
    });

    it("submits 'not_relevant' with wrong_industry and adds SIC/NAICS to exclusion list", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = {
        id: 3,
        searchId: 10,
        apolloId: "apollo-3",
        name: "Bad Industry Company",
        websiteUrl: "https://bad.com",
        primaryDomain: "bad.com",
        linkedinUrl: null,
        phone: null,
        foundedYear: null,
        revenue: null,
        headcountGrowth: null,
        searchLocation: "Georgia, USA",
        city: "Savannah",
        state: "Georgia",
        country: "US",
        streetAddress: null,
        rawAddress: null,
        sicCodes: JSON.stringify(["5812", "5813"]),
        naicsCodes: JSON.stringify(["722511"]),
        enrichmentStatus: "enriched" as const,
        createdAt: new Date(),
      };

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
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
        expect.objectContaining({
          userId: 1,
          codeType: "sic",
          code: "5812",
        })
      );
      expect(mockAddExcludedCode).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          codeType: "sic",
          code: "5813",
        })
      );
      expect(mockAddExcludedCode).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          codeType: "naics",
          code: "722511",
        })
      );

      mockGetCompanyById.mockRestore();
      mockCreateDecision.mockRestore();
      mockAddExcludedCode.mockRestore();
    });

    it("submits 'not_relevant' with too_small reason (no exclusion)", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCompany = {
        id: 4,
        searchId: 10,
        apolloId: "apollo-4",
        name: "Small Company",
        websiteUrl: "https://small.com",
        primaryDomain: "small.com",
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
        sicCodes: JSON.stringify(["3672"]),
        naicsCodes: JSON.stringify(["334412"]),
        enrichmentStatus: "enriched" as const,
        createdAt: new Date(),
      };

      const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
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

      const mockGetDecision = vi.spyOn(db, "getCompanyDecision").mockResolvedValue(mockDecision);

      const result = await caller.companyFinder.getDecision({ companyId: 1 });

      expect(result).toEqual(mockDecision);
      expect(mockGetDecision).toHaveBeenCalledWith(1, 1);

      mockGetDecision.mockRestore();
    });

    it("returns undefined when no decision exists", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetDecision = vi.spyOn(db, "getCompanyDecision").mockResolvedValue(undefined);

      const result = await caller.companyFinder.getDecision({ companyId: 999 });

      expect(result).toBeUndefined();

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

      const mockGetDecisions = vi.spyOn(db, "getDecisionsBySearch").mockResolvedValue(mockDecisions);

      const result = await caller.companyFinder.getSearchDecisions({ searchId: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].decision).toBe("call_today");
      expect(result[1].decision).toBe("not_relevant");
      expect(result[1].reasonCode).toBe("wrong_industry");

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

    const mockCompany = {
      id: 5,
      searchId: 10,
      apolloId: "apollo-5",
      name: "No Codes Company",
      websiteUrl: "https://nocodes.com",
      primaryDomain: "nocodes.com",
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
      sicCodes: null, // No SIC codes
      naicsCodes: null, // No NAICS codes
      enrichmentStatus: "pending" as const,
      createdAt: new Date(),
    };

    const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
    const mockCreateDecision = vi.spyOn(db, "createCompanyDecision").mockResolvedValue(5);
    const mockAddExcludedCode = vi.spyOn(db, "addExcludedCode").mockResolvedValue(1);

    await caller.companyFinder.submitDecision({
      companyId: 5,
      searchId: 10,
      decision: "not_relevant",
      reasonCode: "wrong_industry",
    });

    // No codes to add
    expect(mockAddExcludedCode).not.toHaveBeenCalled();

    mockGetCompanyById.mockRestore();
    mockCreateDecision.mockRestore();
    mockAddExcludedCode.mockRestore();
  });

  it("submits decision with optional reason notes", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockCompany = {
      id: 6,
      searchId: 10,
      apolloId: "apollo-6",
      name: "Notes Company",
      websiteUrl: "https://notes.com",
      primaryDomain: "notes.com",
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
    };

    const mockGetCompanyById = vi.spyOn(db, "getCompanyById").mockResolvedValue(mockCompany);
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
    mockCreateDecision.mockRestore();
  });
});
