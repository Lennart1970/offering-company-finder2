import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as codeSelectionService from "./codeSelectionService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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

describe("companyFinder router", () => {
  describe("startSearch", () => {
    it("creates a search record using active brain offering data", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Mock active brain
      const mockBrain = {
        id: 1,
        userId: 1,
        brainName: "Test Brain",
        companyName: "Acme Corp",
        companyWebsite: "https://www.acme.com",
        status: "completed" as const,
        offeringSummary: "Industrial Automation Solutions",
        coreCapabilities: JSON.stringify(["robotics", "PLC programming", "SCADA"]),
        icpIndustries: JSON.stringify(["Manufacturing", "Automotive"]),
        valuePropositions: JSON.stringify([{ audience: "Manufacturers", value: "Reduce downtime by 40%" }]),
        competitiveAdvantages: "20 years experience, ISO certified",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockGetActiveBrain = vi.spyOn(db, "getActiveBrain").mockResolvedValue(mockBrain as any);

      // Mock LLM code selection
      const mockSelectCodes = vi.spyOn(codeSelectionService, "selectIndustryCodes").mockResolvedValue({
        sicCodes: ["3559", "3825"],
        naicsCodes: ["333249", "334513"],
        reasoning: "Test reasoning"
      });

      // Mock database function
      const mockCreateSearch = vi.spyOn(db, "createSearch").mockResolvedValue(123);

      const result = await caller.companyFinder.startSearch({
        location: "Detroit, MI",
      });

      expect(result).toEqual({ searchId: 123 });
      expect(mockCreateSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          companyWebsite: "https://www.acme.com",
          location: "Detroit, MI",
          status: "code_targeting",
          offeringName: "Industrial Automation Solutions",
        })
      );

      mockGetActiveBrain.mockRestore();
      mockCreateSearch.mockRestore();
      mockSelectCodes.mockRestore();
    }, 10000);

    it("throws PRECONDITION_FAILED when no active brain exists", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetActiveBrain = vi.spyOn(db, "getActiveBrain").mockResolvedValue(null);

      await expect(
        caller.companyFinder.startSearch({ location: "Atlanta, GA" })
      ).rejects.toThrow("No active Offering Brain found");

      mockGetActiveBrain.mockRestore();
    });

    it("validates location is required", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.companyFinder.startSearch({
          location: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("getSearch", () => {
    it("returns search and companies data with pagination", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockSearch = {
        id: 123,
        userId: 1,
        companyWebsite: "https://example.com",
        location: "Atlanta, GA",
        offeringName: "Test Offering",
        offeringDescription: "Test description",
        targetMarket: "Test market",
        valueProposition: "Test value",
        keywords: JSON.stringify(["test", "keywords"]),
        crossBorderIndicators: "Test indicators",
        status: "completed" as const,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompanies = [
        {
          id: 1,
          searchId: 123,
          apolloId: "apollo-123",
          name: "Test Company",
          websiteUrl: "https://testcompany.com",
          primaryDomain: "testcompany.com",
          linkedinUrl: "https://linkedin.com/company/test",
          phone: "+1234567890",
          foundedYear: 2020,
          revenue: "5M",
          headcountGrowth: "6mo: 10%, 12mo: 20%",
          enrichmentStatus: "enriched",
          createdAt: new Date(),
        },
      ];

      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(mockSearch);
      const mockGetCompaniesBySearchIdPaged = vi
        .spyOn(db, "getCompaniesBySearchIdPaged")
        .mockResolvedValue(mockCompanies);
      const mockGetDecisionsBySearch = vi
        .spyOn(db, "getDecisionsBySearch")
        .mockResolvedValue([]);
      const mockCountCompaniesBySearchId = vi
        .spyOn(db, "countCompaniesBySearchId")
        .mockResolvedValue(1);

      const result = await caller.companyFinder.getSearch({ searchId: 123 });

      expect(result.search).toEqual(mockSearch);
      expect(result.companies).toEqual(mockCompanies);
      expect(result.pagination).toBeDefined();
      expect(result.enrichmentStats).toBeDefined();

      mockGetSearchById.mockRestore();
      mockGetCompaniesBySearchIdPaged.mockRestore();
      mockGetDecisionsBySearch.mockRestore();
      mockCountCompaniesBySearchId.mockRestore();
    });

    it("throws error when search not found", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(undefined);

      await expect(caller.companyFinder.getSearch({ searchId: 999 })).rejects.toThrow(
        "Search not found"
      );

      mockGetSearchById.mockRestore();
    });

    it("throws error when search belongs to different user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockSearch = {
        id: 123,
        userId: 999, // Different user
        companyWebsite: "https://example.com",
        location: "Atlanta, GA",
        offeringName: null,
        offeringDescription: null,
        targetMarket: null,
        valueProposition: null,
        keywords: null,
        crossBorderIndicators: null,
        status: "pending" as const,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(mockSearch);

      await expect(caller.companyFinder.getSearch({ searchId: 123 })).rejects.toThrow(
        "Search not found"
      );

      mockGetSearchById.mockRestore();
    });
  });

  describe("exportCsv", () => {
    it("generates CSV with company data", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockSearch = {
        id: 123,
        userId: 1,
        companyWebsite: "https://example.com",
        location: "Atlanta, GA",
        offeringName: "Test Offering",
        offeringDescription: "Test description",
        targetMarket: "Test market",
        valueProposition: "Test value",
        keywords: JSON.stringify(["test"]),
        crossBorderIndicators: "Test indicators",
        status: "completed" as const,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCompanies = [
        {
          id: 1,
          searchId: 123,
          apolloId: "apollo-123",
          name: "Test Company",
          websiteUrl: "https://testcompany.com",
          primaryDomain: "testcompany.com",
          linkedinUrl: "https://linkedin.com/company/test",
          phone: "+1234567890",
          foundedYear: 2020,
          revenue: "5M",
          headcountGrowth: "6mo: 10%",
          createdAt: new Date(),
        },
      ];

      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(mockSearch);
      const mockGetCompaniesBySearchId = vi
        .spyOn(db, "getCompaniesBySearchId")
        .mockResolvedValue(mockCompanies);

      const result = await caller.companyFinder.exportCsv({ searchId: 123 });

      expect(result.csv).toContain("Name,Website,Domain,LinkedIn,Phone,Founded,Revenue,Headcount Growth");
      expect(result.csv).toContain("Test Company");
      expect(result.csv).toContain("https://testcompany.com");
      expect(result.csv).toContain("+1234567890");

      mockGetSearchById.mockRestore();
      mockGetCompaniesBySearchId.mockRestore();
    });

    it("handles empty companies list", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockSearch = {
        id: 123,
        userId: 1,
        companyWebsite: "https://example.com",
        location: "Atlanta, GA",
        offeringName: null,
        offeringDescription: null,
        targetMarket: null,
        valueProposition: null,
        keywords: null,
        crossBorderIndicators: null,
        status: "completed" as const,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockGetSearchById = vi.spyOn(db, "getSearchById").mockResolvedValue(mockSearch);
      const mockGetCompaniesBySearchId = vi.spyOn(db, "getCompaniesBySearchId").mockResolvedValue([]);

      const result = await caller.companyFinder.exportCsv({ searchId: 123 });

      expect(result.csv).toContain("Name,Website,Domain,LinkedIn,Phone,Founded,Revenue,Headcount Growth");
      // Should only have header row
      expect(result.csv.split("\n").length).toBe(1);

      mockGetSearchById.mockRestore();
      mockGetCompaniesBySearchId.mockRestore();
    });
  });
});
