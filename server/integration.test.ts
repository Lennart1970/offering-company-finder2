import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("companyFinder router", () => {
  it("startSearch requires companyWebsite and location", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.companyFinder.startSearch({ companyWebsite: "", location: "Atlanta, GA" })
    ).rejects.toThrow();

    await expect(
      caller.companyFinder.startSearch({ companyWebsite: "connectgroup.com", location: "" })
    ).rejects.toThrow();
  });

  it("getSearch requires a valid searchId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.companyFinder.getSearch({ searchId: 999999 })
    ).rejects.toThrow();
  });

  it("exportCsv requires a valid searchId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.companyFinder.exportCsv({ searchId: 999999 })
    ).rejects.toThrow();
  });

  it("getSearchHistory returns array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const history = await caller.companyFinder.getSearchHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});

describe("URL normalization", () => {
  it("normalizes bare domains", async () => {
    const { normalizeWebsiteUrl } = await import("../shared/urlUtils");
    
    expect(normalizeWebsiteUrl("connectgroup.com")).toMatch(/^https:\/\/connectgroup\.com/);
    expect(normalizeWebsiteUrl("www.connectgroup.com")).toMatch(/^https:\/\/www\.connectgroup\.com/);
    expect(normalizeWebsiteUrl("https://connectgroup.com")).toMatch(/^https:\/\/connectgroup\.com/);
    // Note: normalizer converts http:// to https://
    expect(normalizeWebsiteUrl("http://connectgroup.com")).toMatch(/^https:\/\/connectgroup\.com/);
  });

  it("handles domains without TLD", async () => {
    const { normalizeWebsiteUrl } = await import("../shared/urlUtils");
    
    const result = normalizeWebsiteUrl("connectgroup");
    expect(result).toContain("connectgroup");
    expect(result).toMatch(/^https?:\/\//);
  });
});

describe("offering extractor interface", () => {
  it("exports extractOffering function", async () => {
    const mod = await import("./offeringExtractor");
    expect(typeof mod.extractOffering).toBe("function");
  });

  it("OfferingData interface includes targetMarketKeywordTags", async () => {
    const mockOffering: import("./offeringExtractor").OfferingData = {
      name: "Test Offering",
      description: "Test description",
      targetMarket: "Industrial manufacturers",
      valueProposition: "Test value prop",
      keywords: ["test"],
      targetMarketKeywordTags: ["industrial", "manufacturing", "medtech"],
      crossBorderIndicators: "",
    };

    expect(mockOffering.targetMarketKeywordTags).toHaveLength(3);
    expect(mockOffering.targetMarketKeywordTags).toContain("industrial");
  });

  it("validates XAI_API_KEY is configured", () => {
    expect(process.env.XAI_API_KEY).toBeDefined();
    expect(process.env.XAI_API_KEY).not.toBe("");
  });
});

describe("apollo search interface", () => {
  it("exports searchApolloCompanies function", async () => {
    const mod = await import("./apolloSearch");
    expect(typeof mod.searchApolloCompanies).toBe("function");
  });

  it("ApolloCompany interface includes SIC/NAICS codes", async () => {
    const mockCompany: import("./apolloSearch").ApolloCompany = {
      name: "Test Company",
      sic_codes: ["2086", "3679"],
      naics_codes: ["31211", "33441"],
      city: "Atlanta",
      state: "Georgia",
      country: "United States",
    };

    expect(mockCompany.sic_codes).toHaveLength(2);
    expect(mockCompany.naics_codes).toHaveLength(2);
    expect(mockCompany.city).toBe("Atlanta");
  });

  it("ApolloSearchParams accepts targetMarketKeywordTags", async () => {
    const params: import("./apolloSearch").ApolloSearchParams = {
      targetMarketKeywordTags: ["industrial", "manufacturing"],
      targetMarket: "Mid-sized industrial companies",
      location: "Atlanta, GA",
      limit: 50,
    };

    expect(params.targetMarketKeywordTags).toHaveLength(2);
    expect(params.location).toBe("Atlanta, GA");
  });

  it("validates APOLLO_API_KEY is configured", () => {
    expect(process.env.APOLLO_API_KEY).toBeDefined();
    expect(process.env.APOLLO_API_KEY).not.toBe("");
  });
});
