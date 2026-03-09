import { describe, it, expect } from "vitest";
import {
  ALL_PROMPTS,
  fillTemplate,
  URGENCY_RESEARCH,
  COMPANY_INTELLIGENCE,
  ICP_FIT_SCORING,
  SALES_APPROACH,
  OFFERING_EXTRACTION,
  BRAIN_RESEARCH,
  WHY_CALL_TODAY,
  INDUSTRY_CODE_SELECTION,
} from "./index";

describe("Prompt Repository — catalogue integrity", () => {
  it("exports exactly 8 prompts in ALL_PROMPTS", () => {
    expect(ALL_PROMPTS).toHaveLength(8);
  });

  it("every prompt has a unique key", () => {
    const keys = ALL_PROMPTS.map((p) => p.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("every prompt has all required fields", () => {
    for (const p of ALL_PROMPTS) {
      expect(p.key, `${p.key} missing key`).toBeTruthy();
      expect(p.name, `${p.key} missing name`).toBeTruthy();
      expect(p.description, `${p.key} missing description`).toBeTruthy();
      expect(p.category, `${p.key} missing category`).toBeTruthy();
      expect(p.version, `${p.key} missing version`).toBeTruthy();
      expect(p.systemPrompt, `${p.key} missing systemPrompt`).toBeTruthy();
      expect(p.userPromptTemplate, `${p.key} missing userPromptTemplate`).toBeTruthy();
      expect(p.outputFormat, `${p.key} missing outputFormat`).toBeTruthy();
    }
  });

  it("every prompt version follows semver pattern", () => {
    const semver = /^\d+\.\d+\.\d+$/;
    for (const p of ALL_PROMPTS) {
      expect(p.version, `${p.key} bad version`).toMatch(semver);
    }
  });

  it("all categories are valid enum values", () => {
    const validCategories = new Set([
      "research",
      "qualification",
      "outreach",
      "extraction",
      "classification",
      "coaching",
    ]);
    for (const p of ALL_PROMPTS) {
      expect(
        validCategories.has(p.category),
        `${p.key} invalid category: ${p.category}`
      ).toBe(true);
    }
  });

  it("contains the expected named exports", () => {
    const keys = ALL_PROMPTS.map((p) => p.key);
    expect(keys).toContain("urgency_research");
    expect(keys).toContain("company_intelligence");
    expect(keys).toContain("icp_fit_scoring");
    expect(keys).toContain("sales_approach");
    expect(keys).toContain("offering_extraction");
    expect(keys).toContain("brain_research");
    expect(keys).toContain("why_call_today");
    expect(keys).toContain("industry_code_selection");
  });
});

describe("fillTemplate", () => {
  it("replaces a single variable", () => {
    const result = fillTemplate("Hello {{name}}!", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("replaces multiple variables", () => {
    const result = fillTemplate("{{a}} + {{b}} = {{c}}", { a: "1", b: "2", c: "3" });
    expect(result).toBe("1 + 2 = 3");
  });

  it("leaves unknown variables intact", () => {
    const result = fillTemplate("Hello {{name}} and {{other}}!", { name: "World" });
    expect(result).toBe("Hello World and {{other}}!");
  });

  it("handles empty vars object", () => {
    const result = fillTemplate("{{x}} and {{y}}", {});
    expect(result).toBe("{{x}} and {{y}}");
  });

  it("handles template with no placeholders", () => {
    const result = fillTemplate("No placeholders here.", { name: "World" });
    expect(result).toBe("No placeholders here.");
  });

  it("replaces the same variable multiple times", () => {
    const result = fillTemplate("{{x}} and {{x}}", { x: "foo" });
    expect(result).toBe("foo and foo");
  });

  it("works with real URGENCY_RESEARCH template", () => {
    const filled = fillTemplate(URGENCY_RESEARCH.userPromptTemplate, {
      context: "Brain context here",
      companyName: "Acme Corp",
      domain: "acme.com",
    });
    expect(filled).toContain("Acme Corp");
    expect(filled).toContain("acme.com");
    expect(filled).toContain("Brain context here");
  });

  it("works with real INDUSTRY_CODE_SELECTION template", () => {
    const filled = fillTemplate(INDUSTRY_CODE_SELECTION.userPromptTemplate, {
      offeringName: "IoT Sensors",
      offeringDescription: "Industrial sensors",
      targetMarket: "Manufacturing",
      valueProposition: "Reduce downtime",
    });
    expect(filled).toContain("IoT Sensors");
    expect(filled).toContain("Manufacturing");
    expect(filled).not.toContain("{{offeringName}}");
  });
});

describe("Individual prompt spot-checks", () => {
  it("URGENCY_RESEARCH is in research category", () => {
    expect(URGENCY_RESEARCH.category).toBe("research");
  });

  it("ICP_FIT_SCORING is in qualification category", () => {
    expect(ICP_FIT_SCORING.category).toBe("qualification");
  });

  it("SALES_APPROACH is in outreach category", () => {
    expect(SALES_APPROACH.category).toBe("outreach");
  });

  it("OFFERING_EXTRACTION is in extraction category", () => {
    expect(OFFERING_EXTRACTION.category).toBe("extraction");
  });

  it("INDUSTRY_CODE_SELECTION is in classification category", () => {
    expect(INDUSTRY_CODE_SELECTION.category).toBe("classification");
  });

  it("WHY_CALL_TODAY is in coaching category", () => {
    expect(WHY_CALL_TODAY.category).toBe("coaching");
  });

  it("BRAIN_RESEARCH and COMPANY_INTELLIGENCE are in research category", () => {
    expect(BRAIN_RESEARCH.category).toBe("research");
    expect(COMPANY_INTELLIGENCE.category).toBe("research");
  });
});
