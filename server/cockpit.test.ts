import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Verify the tRPC router exposes all procedures needed by the cockpit screens

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

describe("Cockpit Router Structure", () => {
  it("exposes companyFinder router", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder).toBeDefined();
  });

  it("exposes codeDescriptions router", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.codeDescriptions).toBeDefined();
  });

  it("exposes auth router with me and logout", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.auth).toBeDefined();
    expect(caller.auth.me).toBeDefined();
    expect(caller.auth.logout).toBeDefined();
  });
});

describe("Screen 1: Focused Offering - Required Procedures", () => {
  it("has startSearch procedure (creates search with offering extraction)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.startSearch).toBeDefined();
  });

  it("has getSearch procedure (fetches search data for review)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getSearch).toBeDefined();
  });

  it("has getSearchHistory procedure (lists previous searches)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getSearchHistory).toBeDefined();
  });

  it("has acceptOffering procedure (HITL gate: accept extracted offering)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.acceptOffering).toBeDefined();
  });

  it("has reExtractOffering procedure (HITL gate: re-run extraction)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.reExtractOffering).toBeDefined();
  });

  it("has editOffering procedure (HITL gate: manual edit)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.editOffering).toBeDefined();
  });
});

describe("Screen 2: Search Scenario - Required Procedures", () => {
  it("has runCodeTargeting procedure (AI code selection)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.runCodeTargeting).toBeDefined();
  });

  it("has acceptCodeTargeting procedure (accept selected codes)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.acceptCodeTargeting).toBeDefined();
  });

  it("has updateCodeTargeting procedure (manual code edit)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.updateCodeTargeting).toBeDefined();
  });

  it("has confirmAndSearch procedure (launch batched Apollo search)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.confirmAndSearch).toBeDefined();
  });

  it("has updateExcludedSectors procedure (sector-level exclusion)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.updateExcludedSectors).toBeDefined();
  });
});

describe("Screen 3: Search Results - Required Procedures", () => {
  it("has enrichAll procedure (batch enrichment)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.enrichAll).toBeDefined();
  });

  it("has enrichSingle procedure (single company enrichment)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.enrichSingle).toBeDefined();
  });

  it("has generateBrief procedure (deep research)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.generateBrief).toBeDefined();
  });

  it("has generateSalesApproach procedure (sales approach generation)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.generateSalesApproach).toBeDefined();
  });

  it("has findContact procedure (Apollo people search)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.findContact).toBeDefined();
  });

  it("has getContact procedure (cached contact lookup)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getContact).toBeDefined();
  });

  it("has submitDecision procedure (HITL decision tracking)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.submitDecision).toBeDefined();
  });

  it("has getDecision procedure (fetch existing decision)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getDecision).toBeDefined();
  });

  it("has exportCsv procedure (CSV export)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.exportCsv).toBeDefined();
  });

  it("has getExcludedCodes procedure (code exclusion list)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getExcludedCodes).toBeDefined();
  });
});

describe("Screen 4: Deep Research Dashboard - Required Procedures", () => {
  it("has getCallToday procedure (aggregated call today companies)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getCallToday).toBeDefined();
  });

  it("has getSearchDecisions procedure (decisions for a search)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getSearchDecisions).toBeDefined();
  });
});

describe("Frontend Page Imports", () => {
  it("FocusedOffering page module exists", async () => {
    // This verifies the module can be resolved at build time
    const mod = await import("../client/src/pages/FocusedOffering");
    expect(mod.default).toBeDefined();
  });

  it("SearchScenario page module exists", async () => {
    const mod = await import("../client/src/pages/SearchScenario");
    expect(mod.default).toBeDefined();
  });

  it("SearchResults page module exists", async () => {
    const mod = await import("../client/src/pages/SearchResults");
    expect(mod.default).toBeDefined();
  });

  it("DeepResearchDashboard page module exists", async () => {
    const mod = await import("../client/src/pages/DeepResearchDashboard");
    expect(mod.default).toBeDefined();
  });
});
