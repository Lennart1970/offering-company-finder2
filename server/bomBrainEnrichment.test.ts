/**
 * Unit tests for BOM Brain enrichment logic
 * Tests the JSON parsing, canSupply normalisation, and DOM report structure
 */
import { describe, it, expect } from "vitest";

// ── Helpers extracted from prototypeRouter for unit testing ──────────────────

function normaliseCanSupply(raw: string | undefined): "yes" | "partial" | "no" {
  if (raw === "yes" || raw === "partial" || raw === "no") return raw;
  return "no";
}

function parseEnrichmentResponse(raw: string): {
  enriched: Array<{ index: number; canSupply: string; reason: string; deliverableCategory: string }>;
} {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { enriched: [] };
  }
}

function parseDomReport(raw: string): Record<string, string | boolean> {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { componentName: "Unknown", canDeliver: false, deliveryStatement: "Unable to generate report." };
  }
}

function mergeEnrichmentOntoComponents(
  components: Array<{ component: string; qty: number; unitCostEur: number; confidence: string; notes: string }>,
  enriched: Array<{ index: number; canSupply: string; reason: string; deliverableCategory: string }>
) {
  return components.map((c, i) => {
    const match = enriched.find((e) => e.index === i + 1);
    return {
      ...c,
      canSupply: normaliseCanSupply(match?.canSupply),
      supplyReason: match?.reason ?? "",
      deliverableCategory: match?.deliverableCategory ?? "Unknown",
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("BOM Brain Enrichment — canSupply normalisation", () => {
  it("passes through valid values unchanged", () => {
    expect(normaliseCanSupply("yes")).toBe("yes");
    expect(normaliseCanSupply("partial")).toBe("partial");
    expect(normaliseCanSupply("no")).toBe("no");
  });

  it("defaults unknown values to 'no'", () => {
    expect(normaliseCanSupply("maybe")).toBe("no");
    expect(normaliseCanSupply(undefined)).toBe("no");
    expect(normaliseCanSupply("")).toBe("no");
    expect(normaliseCanSupply("YES")).toBe("no"); // case-sensitive
  });
});

describe("BOM Brain Enrichment — JSON parsing", () => {
  it("parses a clean enrichment response", () => {
    const raw = JSON.stringify({
      enriched: [
        { index: 1, canSupply: "yes", reason: "PCB fabrication is our core", deliverableCategory: "PCB Fabrication" },
        { index: 2, canSupply: "no", reason: "We don't supply raw ICs", deliverableCategory: "Active IC" },
      ],
    });
    const result = parseEnrichmentResponse(raw);
    expect(result.enriched).toHaveLength(2);
    expect(result.enriched[0].canSupply).toBe("yes");
    expect(result.enriched[1].deliverableCategory).toBe("Active IC");
  });

  it("strips markdown code fences before parsing", () => {
    const raw = "```json\n{\"enriched\": [{\"index\": 1, \"canSupply\": \"partial\", \"reason\": \"Assembly only\", \"deliverableCategory\": \"SMT Assembly\"}]}\n```";
    const result = parseEnrichmentResponse(raw);
    expect(result.enriched[0].canSupply).toBe("partial");
  });

  it("returns empty enriched array on invalid JSON", () => {
    const result = parseEnrichmentResponse("not valid json {{");
    expect(result.enriched).toHaveLength(0);
  });
});

describe("BOM Brain Enrichment — component merging", () => {
  const components = [
    { component: "FR4 PCB 4-layer", qty: 1, unitCostEur: 12, confidence: "high", notes: "Main board" },
    { component: "STM32 MCU", qty: 1, unitCostEur: 8, confidence: "medium", notes: "Microcontroller" },
    { component: "Aluminium enclosure", qty: 1, unitCostEur: 25, confidence: "low", notes: "Housing" },
  ];

  const enriched = [
    { index: 1, canSupply: "yes", reason: "4-layer PCB fabrication is our specialty", deliverableCategory: "PCB Fabrication" },
    { index: 2, canSupply: "partial", reason: "SMT assembly but not IC sourcing", deliverableCategory: "SMT Assembly" },
    { index: 3, canSupply: "no", reason: "Mechanical enclosures out of scope", deliverableCategory: "Mechanical" },
  ];

  it("merges enrichment data correctly onto all components", () => {
    const merged = mergeEnrichmentOntoComponents(components, enriched);
    expect(merged).toHaveLength(3);
    expect(merged[0].canSupply).toBe("yes");
    expect(merged[0].supplyReason).toBe("4-layer PCB fabrication is our specialty");
    expect(merged[0].deliverableCategory).toBe("PCB Fabrication");
    expect(merged[1].canSupply).toBe("partial");
    expect(merged[2].canSupply).toBe("no");
  });

  it("defaults to 'no' and 'Unknown' when enrichment index is missing", () => {
    const merged = mergeEnrichmentOntoComponents(components, [
      { index: 1, canSupply: "yes", reason: "Core capability", deliverableCategory: "PCB Fabrication" },
    ]);
    expect(merged[1].canSupply).toBe("no");
    expect(merged[1].deliverableCategory).toBe("Unknown");
    expect(merged[2].canSupply).toBe("no");
  });
});

describe("DOM Report — JSON parsing", () => {
  it("parses a valid DOM report", () => {
    const raw = JSON.stringify({
      componentName: "FR4 PCB 4-layer",
      canDeliver: true,
      deliveryStatement: "We fabricate 4-layer FR4 boards in-house with 5-day turnaround.",
      specification: "IPC Class 2, 1.6mm, ENIG finish",
      leadTimeEstimate: "5-7 working days for prototype",
      manufacturingProcess: "PCB Fabrication → SMT Assembly",
      qualityStandards: "ISO 9001, IPC-A-610",
      pricingNote: "Estimate of €12/unit is realistic for low volumes",
      whyUs: "We specialise in prototype PCBs with fast turnaround.",
      limitations: "Volume pricing requires NRE discussion",
    });
    const result = parseDomReport(raw);
    expect(result.canDeliver).toBe(true);
    expect(result.componentName).toBe("FR4 PCB 4-layer");
    expect(result.leadTimeEstimate).toBe("5-7 working days for prototype");
  });

  it("returns fallback on invalid JSON", () => {
    const result = parseDomReport("broken {{{");
    expect(result.canDeliver).toBe(false);
    expect(result.deliveryStatement).toBe("Unable to generate report.");
  });

  it("strips markdown code fences from DOM report", () => {
    const raw = "```json\n{\"componentName\": \"Resistor\", \"canDeliver\": true, \"deliveryStatement\": \"Passive component sourcing available.\"}\n```";
    const result = parseDomReport(raw);
    expect(result.componentName).toBe("Resistor");
    expect(result.canDeliver).toBe(true);
  });
});
