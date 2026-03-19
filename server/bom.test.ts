import { describe, it, expect } from "vitest";

// ─── Replicate the parsing logic from prototypeRouter.ts ─────────────────────
function parseBomResponse(raw: unknown): {
  productSummary: string;
  components: Array<{
    component: string;
    qty: number;
    unitCostEur: number;
    confidence: "high" | "medium" | "low";
    notes: string;
    editedCost?: number;
  }>;
} {
  let parsed: {
    productSummary?: string;
    components?: Array<{
      component: string;
      qty: number;
      unitCostEur: number;
      confidence: string;
      notes: string;
    }>;
  } = {};

  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { productSummary: "Unable to parse AI response", components: [] };
  }

  const components = (parsed.components ?? []).map((c) => ({
    ...c,
    confidence: (["high", "medium", "low"].includes(c.confidence)
      ? c.confidence
      : "medium") as "high" | "medium" | "low",
  }));

  return {
    productSummary: parsed.productSummary ?? "Product analysis",
    components,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BOM extraction parser", () => {
  it("parses a clean JSON string response", () => {
    const raw = JSON.stringify({
      productSummary: "Industrial sensor module",
      components: [
        { component: "MCU", qty: 1, unitCostEur: 3.5, confidence: "high", notes: "ARM Cortex-M0" },
        { component: "PCB", qty: 1, unitCostEur: 1.2, confidence: "medium", notes: "4-layer" },
      ],
    });

    const result = parseBomResponse(raw);
    expect(result.productSummary).toBe("Industrial sensor module");
    expect(result.components).toHaveLength(2);
    expect(result.components[0].confidence).toBe("high");
    expect(result.components[1].confidence).toBe("medium");
  });

  it("strips markdown code fences from response", () => {
    const raw = "```json\n{\"productSummary\":\"Test product\",\"components\":[]}\n```";
    const result = parseBomResponse(raw);
    expect(result.productSummary).toBe("Test product");
    expect(result.components).toHaveLength(0);
  });

  it("normalises unknown confidence values to medium", () => {
    const raw = JSON.stringify({
      productSummary: "Widget",
      components: [
        { component: "Screw", qty: 4, unitCostEur: 0.05, confidence: "unknown_value", notes: "" },
      ],
    });

    const result = parseBomResponse(raw);
    expect(result.components[0].confidence).toBe("medium");
  });

  it("returns fallback on invalid JSON", () => {
    const result = parseBomResponse("not valid json at all {{");
    expect(result.productSummary).toBe("Unable to parse AI response");
    expect(result.components).toHaveLength(0);
  });

  it("returns fallback productSummary when field is missing", () => {
    const raw = JSON.stringify({ components: [] });
    const result = parseBomResponse(raw);
    expect(result.productSummary).toBe("Product analysis");
  });

  it("calculates line totals correctly", () => {
    const raw = JSON.stringify({
      productSummary: "Motor driver board",
      components: [
        { component: "MOSFET", qty: 4, unitCostEur: 0.75, confidence: "high", notes: "" },
        { component: "Capacitor", qty: 10, unitCostEur: 0.08, confidence: "low", notes: "" },
      ],
    });

    const result = parseBomResponse(raw);
    const total = result.components.reduce((sum, c) => sum + c.unitCostEur * c.qty, 0);
    expect(total).toBeCloseTo(4 * 0.75 + 10 * 0.08, 5);
  });
});
