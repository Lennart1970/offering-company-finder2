import { describe, it, expect } from "vitest";
import {
  parseNaicsCode,
  getNaicsSectorLabel,
  getNaicsRealityLabel,
  naicsMatchesHierarchically,
  sicMatchesHierarchically,
  groupCodesBySector,
  getCodeLevel,
} from "@shared/naicsHierarchy";

describe("NAICS Hierarchy", () => {
  describe("parseNaicsCode", () => {
    it("breaks down a 6-digit NAICS code into hierarchy levels", () => {
      const result = parseNaicsCode("333249");
      expect(result.sector).toBe("33");
      expect(result.subsector).toBe("333");
      expect(result.industryGroup).toBe("3332");
      expect(result.industry).toBe("33324");
      expect(result.national).toBe("333249");
      expect(result.sectorLabel).toBe("Manufacturing");
    });

    it("handles 2-digit sector codes", () => {
      const result = parseNaicsCode("22");
      expect(result.sector).toBe("22");
      expect(result.sectorLabel).toBe("Utilities");
    });
  });

  describe("getNaicsSectorLabel", () => {
    it("returns correct label for manufacturing", () => {
      expect(getNaicsSectorLabel("333249")).toBe("Manufacturing");
      expect(getNaicsSectorLabel("334510")).toBe("Manufacturing");
    });

    it("returns correct label for utilities", () => {
      expect(getNaicsSectorLabel("221112")).toBe("Utilities");
    });

    it("returns correct label for mining", () => {
      expect(getNaicsSectorLabel("211130")).toBe("Mining, Quarrying & Oil/Gas Extraction");
    });
  });

  describe("getNaicsRealityLabel", () => {
    it("returns operational reality for manufacturing", () => {
      expect(getNaicsRealityLabel("333249")).toBe("Physical production");
    });

    it("returns operational reality for utilities", () => {
      expect(getNaicsRealityLabel("221112")).toBe("Infrastructure utilities");
    });

    it("returns operational reality for mining", () => {
      expect(getNaicsRealityLabel("211130")).toBe("Raw materials");
    });
  });

  describe("naicsMatchesHierarchically", () => {
    it("matches exact 6-digit code", () => {
      expect(naicsMatchesHierarchically("333249", ["333249"])).toBe(true);
    });

    it("matches company code against broader sector code", () => {
      // Company has 333249, we selected sector "33" (all Manufacturing)
      expect(naicsMatchesHierarchically("333249", ["33"])).toBe(true);
    });

    it("matches company code against subsector code", () => {
      // Company has 333249, we selected subsector "333" (Machinery)
      expect(naicsMatchesHierarchically("333249", ["333"])).toBe(true);
    });

    it("matches company code against industry group code", () => {
      // Company has 333249, we selected industry group "3332"
      expect(naicsMatchesHierarchically("333249", ["3332"])).toBe(true);
    });

    it("does NOT match unrelated codes", () => {
      expect(naicsMatchesHierarchically("333249", ["22", "334", "3361"])).toBe(false);
    });

    it("matches when company has broader code than selected", () => {
      // Company only reports "33", we selected "333249"
      expect(naicsMatchesHierarchically("33", ["333249"])).toBe(true);
    });

    it("handles multiple selected codes", () => {
      expect(naicsMatchesHierarchically("221112", ["33", "22", "21"])).toBe(true);
      expect(naicsMatchesHierarchically("511210", ["33", "22", "21"])).toBe(false);
    });
  });

  describe("sicMatchesHierarchically", () => {
    it("matches exact 4-digit SIC code", () => {
      expect(sicMatchesHierarchically("3561", ["3561"])).toBe(true);
    });

    it("matches company code against 2-digit major group", () => {
      // Company has 3561, we selected major group "35" (Industrial Machinery)
      expect(sicMatchesHierarchically("3561", ["35"])).toBe(true);
    });

    it("matches company code against 3-digit industry group", () => {
      expect(sicMatchesHierarchically("3561", ["356"])).toBe(true);
    });

    it("does NOT match unrelated codes", () => {
      expect(sicMatchesHierarchically("3561", ["36", "37", "49"])).toBe(false);
    });
  });

  describe("groupCodesBySector", () => {
    it("groups NAICS codes by their 2-digit sector", () => {
      const codes = ["333249", "334510", "221112", "211130"];
      const grouped = groupCodesBySector(codes);

      expect(Object.keys(grouped)).toHaveLength(3); // 33, 22, 21
      expect(grouped["33"].label).toBe("Manufacturing");
      expect(grouped["33"].codes).toHaveLength(2);
      expect(grouped["22"].label).toBe("Utilities");
      expect(grouped["22"].codes).toHaveLength(1);
      expect(grouped["21"].label).toBe("Mining, Quarrying & Oil/Gas Extraction");
      expect(grouped["21"].codes).toHaveLength(1);
    });

    it("includes reality labels", () => {
      const grouped = groupCodesBySector(["333249"]);
      expect(grouped["33"].reality).toBe("Physical production");
    });
  });

  describe("getCodeLevel", () => {
    it("identifies sector (2-digit)", () => {
      expect(getCodeLevel("33")).toBe("sector");
    });

    it("identifies subsector (3-digit)", () => {
      expect(getCodeLevel("333")).toBe("subsector");
    });

    it("identifies industry group (4-digit)", () => {
      expect(getCodeLevel("3332")).toBe("industry_group");
    });

    it("identifies industry (5-digit)", () => {
      expect(getCodeLevel("33324")).toBe("industry");
    });

    it("identifies national (6-digit)", () => {
      expect(getCodeLevel("333249")).toBe("national");
    });
  });
});
