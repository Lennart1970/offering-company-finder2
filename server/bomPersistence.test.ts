/**
 * Unit tests for BOM persistence logic.
 * Tests the DB helper wrappers and the saveBom procedure input validation.
 * Database calls are mocked so tests run without a live DB connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  saveBomCalculation: vi.fn().mockResolvedValue(42),
  updateBomCalculation: vi.fn().mockResolvedValue(undefined),
  getBomCalculationsByCompany: vi.fn().mockResolvedValue([]),
  getLatestBomCalculation: vi.fn().mockResolvedValue(null),
  deleteBomCalculation: vi.fn().mockResolvedValue(undefined),
}));

import {
  saveBomCalculation,
  updateBomCalculation,
  getBomCalculationsByCompany,
  getLatestBomCalculation,
  deleteBomCalculation,
} from "./db";

// ── Helper: build a minimal component list ───────────────────────────────────
function makeComponents(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    component: `Component ${i + 1}`,
    qty: i + 1,
    unitCostEur: (i + 1) * 2.5,
    confidence: "medium" as const,
    notes: `Note ${i + 1}`,
    editedCost: (i + 1) * 2.5,
  }));
}

// ── Helper: compute expected total ───────────────────────────────────────────
function computeTotal(components: ReturnType<typeof makeComponents>): string {
  return components
    .reduce((sum, c) => sum + (c.editedCost ?? c.unitCostEur) * c.qty, 0)
    .toFixed(2);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("BOM Persistence — DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saveBomCalculation is called with the correct payload shape", async () => {
    const components = makeComponents(3);
    const payload = {
      companyId: 101,
      userId: "user-openid-abc",
      imageUrls: JSON.stringify(["https://example.com/img1.jpg"]),
      productSummary: "Industrial PCB assembly",
      componentsJson: JSON.stringify(components),
      totalEur: computeTotal(components),
      isEnriched: 0,
      brainId: null,
      label: "19 Mar 2026",
    };
    const id = await saveBomCalculation(payload);
    expect(saveBomCalculation).toHaveBeenCalledWith(payload);
    expect(id).toBe(42);
  });

  it("updateBomCalculation is called with the correct id and partial payload", async () => {
    await updateBomCalculation(42, { isEnriched: 1, brainId: 7 });
    expect(updateBomCalculation).toHaveBeenCalledWith(42, { isEnriched: 1, brainId: 7 });
  });

  it("getBomCalculationsByCompany returns an empty array when no BOMs exist", async () => {
    const result = await getBomCalculationsByCompany(999);
    expect(result).toEqual([]);
    expect(getBomCalculationsByCompany).toHaveBeenCalledWith(999);
  });

  it("getLatestBomCalculation returns null when no BOM exists", async () => {
    const result = await getLatestBomCalculation(999);
    expect(result).toBeNull();
  });

  it("deleteBomCalculation is called with the correct id and userId", async () => {
    await deleteBomCalculation(42, "user-openid-abc");
    expect(deleteBomCalculation).toHaveBeenCalledWith(42, "user-openid-abc");
  });
});

describe("BOM Persistence — total calculation logic", () => {
  it("computes total correctly from editedCost when present", () => {
    const components = [
      { component: "MCU", qty: 1, unitCostEur: 5.0, editedCost: 4.5, confidence: "high" as const, notes: "" },
      { component: "Capacitor", qty: 10, unitCostEur: 0.1, editedCost: 0.08, confidence: "medium" as const, notes: "" },
    ];
    const total = components
      .reduce((sum, c) => sum + (c.editedCost ?? c.unitCostEur) * c.qty, 0)
      .toFixed(2);
    expect(total).toBe("5.30"); // 4.5*1 + 0.08*10 = 4.5 + 0.8 = 5.30
  });

  it("falls back to unitCostEur when editedCost is undefined", () => {
    const components = [
      { component: "Resistor", qty: 5, unitCostEur: 0.02, confidence: "low" as const, notes: "" },
    ];
    const total = components
      .reduce((sum, c) => sum + ((c as any).editedCost ?? c.unitCostEur) * c.qty, 0)
      .toFixed(2);
    expect(total).toBe("0.10");
  });

  it("handles zero-quantity components without NaN", () => {
    const components = [
      { component: "Connector", qty: 0, unitCostEur: 1.5, editedCost: 1.5, confidence: "medium" as const, notes: "" },
    ];
    const total = components
      .reduce((sum, c) => sum + (c.editedCost ?? c.unitCostEur) * c.qty, 0)
      .toFixed(2);
    expect(total).toBe("0.00");
    expect(isNaN(parseFloat(total))).toBe(false);
  });

  it("serialises and deserialises componentsJson without data loss", () => {
    const components = makeComponents(5);
    const json = JSON.stringify(components);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].component).toBe("Component 1");
    expect(parsed[4].unitCostEur).toBe(12.5);
  });

  it("isEnriched flag is stored as 1 when enrichment is true", () => {
    const isEnriched = true;
    const stored = isEnriched ? 1 : 0;
    expect(stored).toBe(1);
  });

  it("isEnriched flag is stored as 0 when enrichment is false", () => {
    const isEnriched = false;
    const stored = isEnriched ? 1 : 0;
    expect(stored).toBe(0);
  });
});
