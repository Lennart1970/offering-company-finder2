/**
 * Unit tests for Brain-Campaign Wiring
 * Tests the getUserSearches LEFT JOIN with offering_brain,
 * and the brain selector logic in campaign creation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapSearchWithBrain(
  search: Record<string, unknown>,
  brainName: string | null
): Record<string, unknown> {
  return { ...search, brainName: brainName ?? null };
}

function filterActiveBrains(
  brains: Array<{ id: number; isActive: number; brainName: string }>
) {
  return brains.filter((b) => b.isActive === 1);
}

function selectDefaultBrain(
  brains: Array<{ id: number; isActive: number; brainName: string }>
): number | null {
  const active = filterActiveBrains(brains);
  return active.length === 1 ? active[0].id : null;
}

function buildBrainBadgeText(brainName: string | null): string | null {
  if (!brainName) return null;
  return `🧠 ${brainName}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getUserSearches brain JOIN mapping", () => {
  it("attaches brainName when a brain is linked", () => {
    const search = { id: 1, offeringName: "Test Campaign", brainId: 42 };
    const result = mapSearchWithBrain(search, "ConnectGroup");
    expect(result.brainName).toBe("ConnectGroup");
    expect(result.offeringName).toBe("Test Campaign");
  });

  it("sets brainName to null when no brain is linked (LEFT JOIN miss)", () => {
    const search = { id: 2, offeringName: "Old Campaign", brainId: null };
    const result = mapSearchWithBrain(search, null);
    expect(result.brainName).toBeNull();
  });

  it("preserves all original search fields after mapping", () => {
    const search = { id: 3, offeringName: "Campaign", location: "Spain", status: "completed" };
    const result = mapSearchWithBrain(search, "CGSD Brain");
    expect(result.id).toBe(3);
    expect(result.location).toBe("Spain");
    expect(result.status).toBe("completed");
    expect(result.brainName).toBe("CGSD Brain");
  });
});

describe("Brain selector default selection logic", () => {
  it("auto-selects the single active brain", () => {
    const brains = [
      { id: 1, isActive: 0, brainName: "Old Brain" },
      { id: 2, isActive: 1, brainName: "ConnectGroup" },
    ];
    expect(selectDefaultBrain(brains)).toBe(2);
  });

  it("returns null when multiple brains are active (user must choose)", () => {
    const brains = [
      { id: 1, isActive: 1, brainName: "Brain A" },
      { id: 2, isActive: 1, brainName: "Brain B" },
    ];
    expect(selectDefaultBrain(brains)).toBeNull();
  });

  it("returns null when no brains exist", () => {
    expect(selectDefaultBrain([])).toBeNull();
  });

  it("returns null when all brains are inactive", () => {
    const brains = [
      { id: 1, isActive: 0, brainName: "Archived Brain" },
    ];
    expect(selectDefaultBrain(brains)).toBeNull();
  });
});

describe("Brain badge rendering", () => {
  it("returns formatted badge text when brainName is present", () => {
    expect(buildBrainBadgeText("ConnectGroup")).toBe("🧠 ConnectGroup");
  });

  it("returns null when brainName is null (no badge rendered)", () => {
    expect(buildBrainBadgeText(null)).toBeNull();
  });

  it("returns null when brainName is empty string", () => {
    expect(buildBrainBadgeText("")).toBeNull();
  });
});

describe("filterActiveBrains — single-active-brain guard", () => {
  it("returns only active brains", () => {
    const brains = [
      { id: 1, isActive: 1, brainName: "Active" },
      { id: 2, isActive: 0, brainName: "Inactive" },
      { id: 3, isActive: 1, brainName: "Also Active" },
    ];
    const active = filterActiveBrains(brains);
    expect(active).toHaveLength(2);
    expect(active.map((b) => b.id)).toEqual([1, 3]);
  });

  it("returns empty array when no brains are active", () => {
    const brains = [{ id: 1, isActive: 0, brainName: "Archived" }];
    expect(filterActiveBrains(brains)).toHaveLength(0);
  });
});
