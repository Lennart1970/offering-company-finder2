import { describe, it, expect } from "vitest";

describe("Sector Exclusion Logic", () => {
  // Test the core filtering logic that runs in the frontend
  function filterByExcludedSectors(
    companies: { naicsCodes: string | null }[],
    excludedSectors: string[]
  ) {
    const excludedSet = new Set(excludedSectors);
    return companies.filter((company) => {
      if (!company.naicsCodes || excludedSet.size === 0) return true;
      try {
        const codes: string[] = JSON.parse(company.naicsCodes);
        return !codes.some((c) => excludedSet.has(c.substring(0, 2)));
      } catch {
        return true;
      }
    });
  }

  it("should filter companies in excluded NAICS sectors", () => {
    const companies = [
      { naicsCodes: JSON.stringify(["334412", "334418"]) }, // Sector 33 (Manufacturing)
      { naicsCodes: JSON.stringify(["511210"]) },           // Sector 51 (Information)
      { naicsCodes: JSON.stringify(["541330"]) },           // Sector 54 (Professional Services)
      { naicsCodes: JSON.stringify(["561110"]) },           // Sector 56 (Administrative)
      { naicsCodes: JSON.stringify(["221112"]) },           // Sector 22 (Utilities)
    ];

    const result = filterByExcludedSectors(companies, ["51", "54", "56"]);
    expect(result).toHaveLength(2);
    expect(JSON.parse(result[0].naicsCodes!)[0]).toBe("334412"); // Manufacturing kept
    expect(JSON.parse(result[1].naicsCodes!)[0]).toBe("221112"); // Utilities kept
  });

  it("should keep all companies when no sectors are excluded", () => {
    const companies = [
      { naicsCodes: JSON.stringify(["334412"]) },
      { naicsCodes: JSON.stringify(["511210"]) },
      { naicsCodes: JSON.stringify(["541330"]) },
    ];

    const result = filterByExcludedSectors(companies, []);
    expect(result).toHaveLength(3);
  });

  it("should keep companies with null NAICS codes", () => {
    const companies = [
      { naicsCodes: null },
      { naicsCodes: JSON.stringify(["511210"]) },
    ];

    const result = filterByExcludedSectors(companies, ["51"]);
    expect(result).toHaveLength(1);
    expect(result[0].naicsCodes).toBeNull();
  });

  it("should exclude companies that have ANY code in an excluded sector", () => {
    const companies = [
      { naicsCodes: JSON.stringify(["334412", "511210"]) }, // Has both 33 and 51
    ];

    // Excluding sector 51 should remove this company even though it also has 33
    const result = filterByExcludedSectors(companies, ["51"]);
    expect(result).toHaveLength(0);
  });

  it("should handle multiple excluded sectors", () => {
    const companies = [
      { naicsCodes: JSON.stringify(["334412"]) }, // 33
      { naicsCodes: JSON.stringify(["511210"]) }, // 51
      { naicsCodes: JSON.stringify(["541330"]) }, // 54
      { naicsCodes: JSON.stringify(["561110"]) }, // 56
      { naicsCodes: JSON.stringify(["221112"]) }, // 22
      { naicsCodes: JSON.stringify(["484110"]) }, // 48
    ];

    const result = filterByExcludedSectors(companies, ["51", "54", "56"]);
    expect(result).toHaveLength(3); // 33, 22, 48 remain
  });

  it("should handle invalid JSON gracefully", () => {
    const companies = [
      { naicsCodes: "not-valid-json" },
      { naicsCodes: JSON.stringify(["334412"]) },
    ];

    const result = filterByExcludedSectors(companies, ["33"]);
    expect(result).toHaveLength(1); // Invalid JSON company kept, 33 excluded
    expect(result[0].naicsCodes).toBe("not-valid-json");
  });

  // Test sector code extraction
  it("should correctly extract 2-digit sector from various NAICS code lengths", () => {
    const codes = ["33", "334", "3344", "33441", "334412"];
    const sector = "33";
    
    for (const code of codes) {
      expect(code.substring(0, 2)).toBe(sector);
    }
  });

  // Test excludedSectors JSON serialization
  it("should correctly serialize and deserialize excluded sectors", () => {
    const sectors = ["51", "54", "56"];
    const json = JSON.stringify(sectors);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(sectors);
  });

  // Test deduplication of excluded sectors
  it("should handle duplicate sector exclusions", () => {
    const sectors = ["51", "54", "51", "56", "54"];
    const unique = Array.from(new Set(sectors));
    expect(unique).toEqual(["51", "54", "56"]);
  });
});
