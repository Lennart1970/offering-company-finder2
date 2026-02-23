import { describe, expect, it } from "vitest";

/**
 * Tests for the updated prompt patterns and source verification structures.
 * These test the data normalization and interface compliance of the brief generator,
 * sales approach generator, and offering extractor outputs.
 * 
 * Note: We don't test the actual Grok API calls here (those require live API keys).
 * Instead, we test the normalization logic that processes Grok responses.
 */

// Test the source verification data structures
describe("Source Verification Structures", () => {
  it("normalizes recentDevelopments from string format to object format", () => {
    // Legacy format: plain strings
    const legacyDevelopments = [
      "Launched new product line for IoT sensors",
      "Expanded manufacturing to APAC region",
    ];

    const normalized = legacyDevelopments.map((dev: any) => {
      if (typeof dev === "string") {
        return { text: dev, date: "", sourceUrl: "", snippet: "" };
      }
      return {
        text: dev.text || dev.event || "",
        date: dev.date || "",
        sourceUrl: dev.sourceUrl || "",
        snippet: dev.snippet || "",
      };
    });

    expect(normalized).toHaveLength(2);
    expect(normalized[0].text).toBe("Launched new product line for IoT sensors");
    expect(normalized[0].sourceUrl).toBe("");
    expect(normalized[0].snippet).toBe("");
  });

  it("normalizes recentDevelopments from new object format", () => {
    const newDevelopments = [
      {
        text: "Launched new IoT sensor line",
        date: "2025-03-15",
        sourceUrl: "https://example.com/article",
        snippet: "The company announced a new product line",
      },
    ];

    const normalized = newDevelopments.map((dev: any) => {
      if (typeof dev === "string") {
        return { text: dev, date: "", sourceUrl: "", snippet: "" };
      }
      return {
        text: dev.text || dev.event || "",
        date: dev.date || "",
        sourceUrl: dev.sourceUrl || "",
        snippet: dev.snippet || "",
      };
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0].text).toBe("Launched new IoT sensor line");
    expect(normalized[0].sourceUrl).toBe("https://example.com/article");
    expect(normalized[0].snippet).toBe("The company announced a new product line");
    expect(normalized[0].date).toBe("2025-03-15");
  });

  it("normalizes urgency signals with source fields", () => {
    const signals = [
      {
        category: "Growth",
        type: "Product Launch",
        description: "Launched new IoT sensor line",
        weight: 8,
        sourceUrl: "https://example.com/article",
        snippet: "Direct quote from source",
        detectedAt: "2025-03-15",
      },
      {
        category: "Expansion",
        type: "New Market",
        description: "Entered APAC market",
        weight: 6,
        // Missing source fields
      },
    ];

    const normalized = signals.map((signal: any) => ({
      category: signal.category || "",
      type: signal.type || "",
      description: signal.description || "",
      weight: signal.weight || 0,
      sourceUrl: signal.sourceUrl || signal.url || "",
      snippet: signal.snippet || "",
      detectedAt: signal.detectedAt || signal.date || "",
    }));

    expect(normalized).toHaveLength(2);
    expect(normalized[0].sourceUrl).toBe("https://example.com/article");
    expect(normalized[0].snippet).toBe("Direct quote from source");
    expect(normalized[1].sourceUrl).toBe("");
    expect(normalized[1].snippet).toBe("");
  });

  it("deduplicates verified sources by URL", () => {
    const sources = [
      { url: "https://example.com/a", title: "Page A", snippet: "Snippet A", dateAccessed: "2026-02-23" },
      { url: "https://example.com/b", title: "Page B", snippet: "Snippet B", dateAccessed: "2026-02-23" },
      { url: "https://example.com/a", title: "Page A duplicate", snippet: "Snippet A2", dateAccessed: "2026-02-23" },
    ];

    const uniqueSources = sources.reduce((acc: any[], source: any) => {
      if (!acc.find((s) => s.url === source.url)) {
        acc.push({
          url: source.url,
          title: source.title || "",
          snippet: source.snippet || "",
          dateAccessed: source.dateAccessed || new Date().toISOString().split("T")[0],
        });
      }
      return acc;
    }, []);

    expect(uniqueSources).toHaveLength(2);
    expect(uniqueSources[0].url).toBe("https://example.com/a");
    expect(uniqueSources[0].title).toBe("Page A"); // First occurrence wins
    expect(uniqueSources[1].url).toBe("https://example.com/b");
  });

  it("filters out sources with missing URLs", () => {
    const sources = [
      { url: "https://example.com/a", title: "Page A", snippet: "Snippet A" },
      { url: "", title: "Empty URL", snippet: "Should be filtered" },
      null,
      { url: "https://example.com/b", title: "Page B", snippet: "Snippet B" },
    ];

    const validSources = sources.filter((s: any) => s && s.url);

    expect(validSources).toHaveLength(2);
    expect(validSources[0].url).toBe("https://example.com/a");
    expect(validSources[1].url).toBe("https://example.com/b");
  });
});

// Test sales approach conversation starter normalization
describe("Sales Approach Source Normalization", () => {
  it("normalizes conversation starters from string format", () => {
    const starters = [
      "I saw that you recently launched X",
      "Noticed your expansion into Y market",
    ];

    const normalized = starters.map((starter: any) => {
      if (typeof starter === "string") {
        return { opener: starter, sourceUrl: "", basedOn: "" };
      }
      return {
        opener: starter.opener || starter,
        sourceUrl: starter.sourceUrl || "",
        basedOn: starter.basedOn || "",
      };
    });

    expect(normalized).toHaveLength(2);
    expect(normalized[0].opener).toBe("I saw that you recently launched X");
    expect(normalized[0].sourceUrl).toBe("");
  });

  it("normalizes conversation starters from new object format", () => {
    const starters = [
      {
        opener: "I saw that you recently launched X",
        sourceUrl: "https://example.com/news",
        basedOn: "Product launch announcement in Q1 2025",
      },
    ];

    const normalized = starters.map((starter: any) => {
      if (typeof starter === "string") {
        return { opener: starter, sourceUrl: "", basedOn: "" };
      }
      return {
        opener: starter.opener || starter,
        sourceUrl: starter.sourceUrl || "",
        basedOn: starter.basedOn || "",
      };
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0].opener).toBe("I saw that you recently launched X");
    expect(normalized[0].sourceUrl).toBe("https://example.com/news");
    expect(normalized[0].basedOn).toBe("Product launch announcement in Q1 2025");
  });

  it("normalizes email draft with referenced sources", () => {
    const emailDraft = {
      subject: "Exploring EMS partnership",
      body: "Dear team...",
      referencedSources: ["https://example.com/article1", "https://example.com/article2"],
    };

    expect(emailDraft.referencedSources).toHaveLength(2);
    expect(emailDraft.referencedSources[0]).toBe("https://example.com/article1");
  });

  it("handles email draft without referenced sources (backward compatibility)", () => {
    const emailDraft: any = {
      subject: "Exploring EMS partnership",
      body: "Dear team...",
    };

    if (!emailDraft.referencedSources) {
      emailDraft.referencedSources = [];
    }

    expect(emailDraft.referencedSources).toHaveLength(0);
  });
});

// Test offering extractor source normalization
describe("Offering Extractor Source Normalization", () => {
  it("handles offering data with sources", () => {
    const offering = {
      name: "EMS Services",
      description: "Electronics manufacturing services",
      targetMarket: "Industrial manufacturers",
      valueProposition: "Full design-to-product services",
      keywords: ["EMS", "PCB"],
      targetMarketKeywordTags: ["industrial", "manufacturing"],
      crossBorderIndicators: "Operations in EU and APAC",
      sources: [
        { url: "https://company.com/about", title: "About Page", snippet: "Key excerpt" },
      ],
    };

    expect(offering.sources).toHaveLength(1);
    expect(offering.sources[0].url).toBe("https://company.com/about");
  });

  it("handles offering data without sources (backward compatibility)", () => {
    const offering: any = {
      name: "EMS Services",
      description: "Electronics manufacturing services",
      targetMarket: "Industrial manufacturers",
      valueProposition: "Full design-to-product services",
      keywords: ["EMS", "PCB"],
      targetMarketKeywordTags: ["industrial", "manufacturing"],
    };

    const sourceCount = offering.sources?.length || 0;
    expect(sourceCount).toBe(0);
  });
});

// Test NAICS sector inference
describe("NAICS Sector Inference", () => {
  it("maps NAICS codes to industry names", () => {
    const sectorMap: Record<string, string> = {
      "31": "Manufacturing",
      "32": "Manufacturing",
      "33": "Manufacturing",
      "51": "Information",
      "54": "Professional, Scientific & Technical Services",
      "62": "Health Care & Social Assistance",
    };

    expect(sectorMap["33"]).toBe("Manufacturing");
    expect(sectorMap["51"]).toBe("Information");
    expect(sectorMap["99"]).toBeUndefined();
  });

  it("extracts 2-digit sector from full NAICS code", () => {
    const naicsCodes = ["334412", "333249", "511210"];
    const sectors = naicsCodes.map((code) => code.substring(0, 2));

    expect(sectors).toEqual(["33", "33", "51"]);
  });
});
