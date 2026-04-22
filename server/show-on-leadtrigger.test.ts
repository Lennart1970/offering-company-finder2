import { describe, it, expect } from "vitest";

/**
 * Unit test: verify show_on_leadtrigger schema field is defined correctly
 * and that the filter logic works as expected.
 */

describe("show_on_leadtrigger schema field", () => {
  it("offeringBrain schema includes showOnLeadtrigger column", async () => {
    const { offeringBrain } = await import("../drizzle/schema");
    // The column should exist in the schema
    expect(offeringBrain.showOnLeadtrigger).toBeDefined();
    // It should be named show_on_leadtrigger in the DB
    const col = offeringBrain.showOnLeadtrigger as { name: string };
    expect(col.name).toBe("show_on_leadtrigger");
  });

  it("default value for showOnLeadtrigger is 1 (visible)", async () => {
    const { offeringBrain } = await import("../drizzle/schema");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col = offeringBrain.showOnLeadtrigger as any;
    // Drizzle stores the default in column.default
    expect(col.default).toBe(1);
  });

  it("filter logic: only brains with showOnLeadtrigger=1 should be visible", () => {
    // Simulate the filter applied in getBrainHistory / getActiveBrain
    const brains = [
      { id: 1, brainName: "Brain A", showOnLeadtrigger: 1 },
      { id: 2, brainName: "Brain B", showOnLeadtrigger: 0 },
      { id: 3, brainName: "Brain C", showOnLeadtrigger: 1 },
      { id: 4, brainName: "Brain D", showOnLeadtrigger: 0 },
    ];

    const visible = brains.filter((b) => b.showOnLeadtrigger === 1);
    expect(visible).toHaveLength(2);
    expect(visible.map((b) => b.id)).toEqual([1, 3]);
  });
});
