import { describe, expect, it } from "vitest";
import { packageToMarkdown } from "./packageGenerator";

describe("packageGenerator", () => {
  it("converts package data to markdown format", () => {
    const packageData = {
      companyName: "Test Company",
      quickFacts: {
        employees: "100-500",
        revenue: "$10M-$50M",
        foundingYear: 2010,
        headquarters: "Atlanta, GA, USA",
        website: "https://test.com",
      },
      businessOverview: "Test business overview",
      productsAndServices: "Test products and services",
      keyTechnologies: "Test key technologies",
      recentDevelopments: "Test recent developments",
      targetMarkets: "Test target markets",
      connectGroupStrategy: "Test ConnectGroup strategy",
      talkingPoints: ["Point 1", "Point 2", "Point 3"],
    };

    const markdown = packageToMarkdown(packageData);

    expect(markdown).toContain("# Sales Intelligence Brief: Test Company");
    expect(markdown).toContain("## Quick Facts");
    expect(markdown).toContain("**Employees** | 100-500");
    expect(markdown).toContain("**Revenue** | $10M-$50M");
    expect(markdown).toContain("**Founded** | 2010");
    expect(markdown).toContain("**Headquarters** | Atlanta, GA, USA");
    expect(markdown).toContain("**Website** | https://test.com");
    expect(markdown).toContain("## Business Overview");
    expect(markdown).toContain("Test business overview");
    expect(markdown).toContain("## Products and Services");
    expect(markdown).toContain("Test products and services");
    expect(markdown).toContain("## Key Technologies");
    expect(markdown).toContain("Test key technologies");
    expect(markdown).toContain("## Target Markets");
    expect(markdown).toContain("Test target markets");
    expect(markdown).toContain("## Connect Group Engagement Strategy");
    expect(markdown).toContain("Test ConnectGroup strategy");
    expect(markdown).toContain("## Key Talking Points");
    expect(markdown).toContain("1. Point 1");
  });

  it("handles minimal data", () => {
    const packageData = {
      companyName: "Minimal Company",
      quickFacts: {
        employees: "Unknown",
        revenue: "Unknown",
        foundingYear: null,
        headquarters: "Unknown",
        website: "https://minimal.com",
      },
      businessOverview: "Minimal overview",
      productsAndServices: "Minimal products",
      keyTechnologies: "Minimal technologies",
      recentDevelopments: "Minimal developments",
      targetMarkets: "Minimal markets",
      connectGroupStrategy: "Minimal strategy",
      talkingPoints: ["Point 1"],
    };

    const markdown = packageToMarkdown(packageData);

    expect(markdown).toContain("# Sales Intelligence Brief: Minimal Company");
    expect(markdown).toContain("## Quick Facts");
    expect(markdown).toContain("https://minimal.com");
  });
});
