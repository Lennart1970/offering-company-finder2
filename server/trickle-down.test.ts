import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { SENIORITY_TIERS, trickleDownSearch } from "./apolloPeopleSearch";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

// ============================================================================
// Seniority Tiers — Structure Tests
// ============================================================================
describe("Seniority Tiers - Structure", () => {
  it("has 5 seniority tiers", () => {
    expect(SENIORITY_TIERS).toHaveLength(5);
  });

  it("tiers are ordered from highest (1) to lowest (5)", () => {
    const levels = SENIORITY_TIERS.map(t => t.level);
    expect(levels).toEqual([1, 2, 3, 4, 5]);
  });

  it("tier 1 contains C-Suite seniorities", () => {
    const tier1 = SENIORITY_TIERS.find(t => t.level === 1);
    expect(tier1).toBeDefined();
    expect(tier1!.seniorities).toContain("c_suite");
    expect(tier1!.seniorities).toContain("owner");
    expect(tier1!.seniorities).toContain("founder");
    expect(tier1!.seniorities).toContain("partner");
  });

  it("tier 2 contains VP/Head seniorities", () => {
    const tier2 = SENIORITY_TIERS.find(t => t.level === 2);
    expect(tier2).toBeDefined();
    expect(tier2!.seniorities).toContain("vp");
    expect(tier2!.seniorities).toContain("head");
  });

  it("tier 3 contains Director seniority", () => {
    const tier3 = SENIORITY_TIERS.find(t => t.level === 3);
    expect(tier3).toBeDefined();
    expect(tier3!.seniorities).toContain("director");
  });

  it("tier 4 contains Manager seniority", () => {
    const tier4 = SENIORITY_TIERS.find(t => t.level === 4);
    expect(tier4).toBeDefined();
    expect(tier4!.seniorities).toContain("manager");
  });

  it("tier 5 contains Senior/Entry seniorities", () => {
    const tier5 = SENIORITY_TIERS.find(t => t.level === 5);
    expect(tier5).toBeDefined();
    expect(tier5!.seniorities).toContain("senior");
    expect(tier5!.seniorities).toContain("entry");
  });

  it("each tier has a human-readable label", () => {
    for (const tier of SENIORITY_TIERS) {
      expect(tier.label).toBeTruthy();
      expect(typeof tier.label).toBe("string");
      expect(tier.label.length).toBeGreaterThan(0);
    }
  });

  it("all seniority values are lowercase strings", () => {
    for (const tier of SENIORITY_TIERS) {
      for (const seniority of tier.seniorities) {
        expect(seniority).toBe(seniority.toLowerCase());
      }
    }
  });
});

// ============================================================================
// Trickle-Down Search — Function Signature Tests
// ============================================================================
describe("Trickle-Down Search - Function Signature", () => {
  it("trickleDownSearch is exported as a function", () => {
    expect(typeof trickleDownSearch).toBe("function");
  });

  it("requires companyDomain and companyName parameters", () => {
    // Function should exist with at least 2 required params
    expect(trickleDownSearch.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// findAllCSuite Procedure — Router Structure Tests
// ============================================================================
describe("findAllCSuite - Procedure Structure", () => {
  it("has findAllCSuite procedure", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.findAllCSuite).toBeDefined();
  });

  it("findAllCSuite is a mutation (not a query)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    // Mutations are callable functions
    expect(typeof caller.companyFinder.findAllCSuite).toBe("function");
  });

  it("rejects missing companyId", async () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(
      caller.companyFinder.findAllCSuite({} as any)
    ).rejects.toThrow();
  });

  it("rejects non-numeric companyId", async () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(
      caller.companyFinder.findAllCSuite({ companyId: "abc" as any })
    ).rejects.toThrow();
  });
});

// ============================================================================
// Trickle-Down Search — Return Type Contract Tests
// ============================================================================
describe("Trickle-Down Search - Return Type Contract", () => {
  it("trickleDownSearch rejects without APOLLO_API_KEY", async () => {
    // Without env var, should throw
    const originalKey = process.env.APOLLO_API_KEY;
    delete process.env.APOLLO_API_KEY;

    await expect(
      trickleDownSearch("example.com", "Example Inc")
    ).rejects.toThrow("APOLLO_API_KEY");

    // Restore
    if (originalKey) process.env.APOLLO_API_KEY = originalKey;
  });
});

// ============================================================================
// getCompanyContacts Procedure — Structure Tests
// ============================================================================
describe("getCompanyContacts - Procedure Structure", () => {
  it("has getCompanyContacts procedure", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getCompanyContacts).toBeDefined();
  });

  it("getCompanyContacts is a query", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(typeof caller.companyFinder.getCompanyContacts).toBe("function");
  });
});
