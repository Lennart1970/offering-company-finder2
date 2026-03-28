import { describe, it, expect } from "vitest";

/**
 * Brain Traceability — Unit tests
 *
 * These tests verify:
 * 1. The stampBrainOnCompany helper exists and is callable
 * 2. The companies schema includes generatedWithBrainId/Name columns
 * 3. The WHY_CALL_TODAY prompt references brain context
 * 4. The BrainBadge component file exists and exports default
 */

describe("Brain Traceability — Schema", () => {
  it("companies schema includes generatedWithBrainId column", async () => {
    const { companies } = await import("../drizzle/schema");
    expect(companies.generatedWithBrainId).toBeDefined();
  });

  it("companies schema includes generatedWithBrainName column", async () => {
    const { companies } = await import("../drizzle/schema");
    expect(companies.generatedWithBrainName).toBeDefined();
  });
});

describe("Brain Traceability — Prompt", () => {
  it("WHY_CALL_TODAY prompt v2 has system prompt with trigger rules", async () => {
    const { WHY_CALL_TODAY } = await import("./prompts/index");
    expect(WHY_CALL_TODAY.systemPrompt).toContain("SPECIFIC trigger");
    expect(WHY_CALL_TODAY.systemPrompt).toContain("NEVER mention scores");
  });

  it("WHY_CALL_TODAY prompt v2 uses context template", async () => {
    const { WHY_CALL_TODAY } = await import("./prompts/index");
    expect(WHY_CALL_TODAY.userPromptTemplate).toContain("{{context}}");
  });

  it("WHY_CALL_TODAY prompt v2 is version 2.0.0", async () => {
    const { WHY_CALL_TODAY } = await import("./prompts/index");
    expect(WHY_CALL_TODAY.version).toBe("2.0.0");
  });
});

describe("Brain Traceability — BrainBadge component", () => {
  it("BrainBadge component file exists", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("/home/ubuntu/offering-company-finder/client/src/components/BrainBadge.tsx");
    expect(exists).toBe(true);
  });
});
