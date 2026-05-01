import { describe, expect, it } from "vitest";

/**
 * Unit tests for the sector exclusion filter logic used in campaignBrainRouter.
 * Tests the filtering logic in isolation (same algorithm as the backend procedure).
 */

type CompanyResult = {
  company_id: string;
  company_name: string;
  domain: string;
  sector: string | null;
  country: string;
  employee_count: number;
  similarity_score: number;
};

function applyExcludeSectors(
  results: CompanyResult[],
  excludeSectors?: string[]
): CompanyResult[] {
  if (!excludeSectors || excludeSectors.length === 0) return results;
  const excluded = new Set(excludeSectors.map((s) => s.toLowerCase()));
  return results.filter(
    (r) => !r.sector || !excluded.has(r.sector.toLowerCase())
  );
}

const mockCompanies: CompanyResult[] = [
  { company_id: "1", company_name: "Contentserv", domain: "contentserv.com", sector: "information technology & services", country: "Germany", employee_count: 200, similarity_score: 0.65 },
  { company_id: "2", company_name: "BuzzFeed", domain: "buzzfeed.com", sector: "media production", country: "United States", employee_count: 500, similarity_score: 0.60 },
  { company_id: "3", company_name: "Publitas", domain: "publitas.com", sector: "publishing", country: "Netherlands", employee_count: 50, similarity_score: 0.58 },
  { company_id: "4", company_name: "CoreMedia", domain: "coremedia.com", sector: "information technology & services", country: "Germany", employee_count: 300, similarity_score: 0.55 },
  { company_id: "5", company_name: "Bookwire", domain: "bookwire.de", sector: "publishing", country: "Germany", employee_count: 80, similarity_score: 0.52 },
  { company_id: "6", company_name: "Superchat", domain: "superchat.de", sector: "marketing & advertising", country: "Germany", employee_count: 100, similarity_score: 0.50 },
  { company_id: "7", company_name: "NoSector Inc", domain: "nosector.com", sector: null, country: "France", employee_count: 20, similarity_score: 0.48 },
];

describe("excludeSectors filter", () => {
  it("returns all companies when no exclusions are set", () => {
    const result = applyExcludeSectors(mockCompanies, undefined);
    expect(result).toHaveLength(7);
  });

  it("returns all companies when exclusions array is empty", () => {
    const result = applyExcludeSectors(mockCompanies, []);
    expect(result).toHaveLength(7);
  });

  it("excludes a single sector", () => {
    const result = applyExcludeSectors(mockCompanies, ["information technology & services"]);
    expect(result).toHaveLength(5);
    expect(result.find((c) => c.company_name === "Contentserv")).toBeUndefined();
    expect(result.find((c) => c.company_name === "CoreMedia")).toBeUndefined();
    expect(result.find((c) => c.company_name === "BuzzFeed")).toBeDefined();
  });

  it("excludes multiple sectors", () => {
    const result = applyExcludeSectors(mockCompanies, [
      "information technology & services",
      "marketing & advertising",
    ]);
    expect(result).toHaveLength(4);
    expect(result.map((c) => c.company_name).sort()).toEqual([
      "Bookwire",
      "BuzzFeed",
      "NoSector Inc",
      "Publitas",
    ]);
  });

  it("is case-insensitive", () => {
    const result = applyExcludeSectors(mockCompanies, ["INFORMATION TECHNOLOGY & SERVICES"]);
    expect(result).toHaveLength(5);
    expect(result.find((c) => c.company_name === "Contentserv")).toBeUndefined();
  });

  it("keeps companies with null sector (not excluded)", () => {
    const result = applyExcludeSectors(mockCompanies, [
      "information technology & services",
      "publishing",
      "marketing & advertising",
      "media production",
    ]);
    // Only NoSector Inc (null sector) should remain
    expect(result).toHaveLength(1);
    expect(result[0].company_name).toBe("NoSector Inc");
  });

  it("handles non-matching exclusion sectors gracefully", () => {
    const result = applyExcludeSectors(mockCompanies, ["automotive", "financial services"]);
    expect(result).toHaveLength(7);
  });
});
