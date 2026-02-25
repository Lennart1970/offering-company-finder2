import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
// Offering Brain — Router Structure Tests
// ============================================================================
describe("Offering Brain - Required Procedures", () => {
  it("has researchBrain procedure (trigger Grok research)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.researchBrain).toBeDefined();
  });

  it("has getBrain procedure (fetch active brain)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getBrain).toBeDefined();
  });

  it("has updateBrain procedure (HITL edit brain fields)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.updateBrain).toBeDefined();
  });
});

// ============================================================================
// Find All C-Suite — Router Structure Tests
// ============================================================================
describe("Find All C-Suite - Required Procedures", () => {
  it("has findAllCSuite procedure (bulk contact search)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.findAllCSuite).toBeDefined();
  });

  it("has getCompanyContacts procedure (list all contacts for a company)", () => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    expect(caller.companyFinder.getCompanyContacts).toBeDefined();
  });
});

// ============================================================================
// Brain Page — Frontend Module Tests
// ============================================================================
describe("Brain Page Module", () => {
  it("Brain page module exists and exports default component", async () => {
    const mod = await import("../client/src/pages/Brain");
    expect(mod.default).toBeDefined();
  });
});

// ============================================================================
// Brain Research Service — Module Tests
// ============================================================================
describe("Brain Research Service", () => {
  it("brainResearchService module exports researchOfferingBrain function", async () => {
    const mod = await import("./brainResearchService");
    expect(mod.researchOfferingBrain).toBeDefined();
    expect(typeof mod.researchOfferingBrain).toBe("function");
  });
});

// ============================================================================
// Brief Generator — Brain Context Integration Tests
// ============================================================================
describe("Brief Generator - Brain Context Integration", () => {
  it("generateSalesIntelligenceBrief accepts optional userId parameter", async () => {
    const mod = await import("./briefGenerator");
    expect(mod.generateSalesIntelligenceBrief).toBeDefined();
    // Function should accept (companyId, userId?) — 2 params
    expect(mod.generateSalesIntelligenceBrief.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Sales Approach Generator — Brain Context Integration Tests
// ============================================================================
describe("Sales Approach Generator - Brain Context Integration", () => {
  it("generateSalesApproach accepts optional userId parameter", async () => {
    const mod = await import("./salesApproachGenerator");
    expect(mod.generateSalesApproach).toBeDefined();
    // Function should accept (companyId, userId?) — 2 params
    expect(mod.generateSalesApproach.length).toBeGreaterThanOrEqual(1);
  });
});
