import { describe, it, expect } from "vitest";
import { classifyCompanyType, splitByCompanyType, type CompanyType } from "./companyTypeClassifier";

// Helper to create a minimal company-like object with sliceMetadata
function makeCompany(
  id: number,
  industry: string | null,
  sicCodes?: string[]
): any {
  return {
    id,
    sliceMetadata: industry ? JSON.stringify({ industry }) : null,
    sicCodes: sicCodes ? JSON.stringify(sicCodes) : null,
  };
}

describe("classifyCompanyType", () => {
  it("classifies electrical/electronic manufacturing as manufacturing", () => {
    const c = makeCompany(1, "electrical/electronic manufacturing");
    expect(classifyCompanyType(c)).toBe("manufacturing");
  });

  it("classifies information technology & services as service", () => {
    const c = makeCompany(2, "information technology & services");
    expect(classifyCompanyType(c)).toBe("service");
  });

  it("classifies food production as manufacturing", () => {
    const c = makeCompany(3, "food production");
    expect(classifyCompanyType(c)).toBe("manufacturing");
  });

  it("classifies construction as service", () => {
    const c = makeCompany(4, "construction");
    expect(classifyCompanyType(c)).toBe("service");
  });

  it("classifies medical devices as manufacturing", () => {
    const c = makeCompany(5, "medical devices");
    expect(classifyCompanyType(c)).toBe("manufacturing");
  });

  it("classifies management consulting as service", () => {
    const c = makeCompany(6, "management consulting");
    expect(classifyCompanyType(c)).toBe("service");
  });

  it("classifies automotive as manufacturing", () => {
    const c = makeCompany(7, "automotive");
    expect(classifyCompanyType(c)).toBe("manufacturing");
  });

  it("classifies real estate as service", () => {
    const c = makeCompany(8, "real estate");
    expect(classifyCompanyType(c)).toBe("service");
  });

  it("uses fuzzy matching for industries with 'manufactur' in the name", () => {
    const c = makeCompany(9, "custom manufacturing solutions");
    expect(classifyCompanyType(c)).toBe("manufacturing");
  });

  it("falls back to SIC codes when industry is unknown", () => {
    // SIC 3672 = Printed circuit boards (manufacturing range 20-39)
    const c = makeCompany(10, "unknown niche industry", ["3672"]);
    expect(classifyCompanyType(c)).toBe("manufacturing");
  });

  it("falls back to SIC codes for service range", () => {
    // SIC 7371 = Computer services (service range 70+)
    const c = makeCompany(11, "unknown niche industry", ["7371"]);
    expect(classifyCompanyType(c)).toBe("service");
  });

  it("defaults to service when no industry and no SIC codes", () => {
    const c = makeCompany(12, null);
    expect(classifyCompanyType(c)).toBe("service");
  });

  it("handles null sliceMetadata gracefully", () => {
    const c = { id: 13, sliceMetadata: null, sicCodes: null };
    expect(classifyCompanyType(c as any)).toBe("service");
  });

  it("handles malformed JSON in sliceMetadata", () => {
    const c = { id: 14, sliceMetadata: "not-json", sicCodes: null };
    expect(classifyCompanyType(c as any)).toBe("service");
  });
});

describe("splitByCompanyType", () => {
  it("splits a mixed list into manufacturing and service groups", () => {
    const companies = [
      makeCompany(1, "electrical/electronic manufacturing"),
      makeCompany(2, "information technology & services"),
      makeCompany(3, "food production"),
      makeCompany(4, "construction"),
      makeCompany(5, "automotive"),
      makeCompany(6, "management consulting"),
    ];

    const { manufacturing, service } = splitByCompanyType(companies);

    expect(manufacturing).toHaveLength(3);
    expect(service).toHaveLength(3);
    expect(manufacturing.map((c) => c.id)).toEqual([1, 3, 5]);
    expect(service.map((c) => c.id)).toEqual([2, 4, 6]);
  });

  it("handles all-manufacturing list", () => {
    const companies = [
      makeCompany(1, "automotive"),
      makeCompany(2, "machinery"),
      makeCompany(3, "plastics"),
    ];

    const { manufacturing, service } = splitByCompanyType(companies);
    expect(manufacturing).toHaveLength(3);
    expect(service).toHaveLength(0);
  });

  it("handles all-service list", () => {
    const companies = [
      makeCompany(1, "real estate"),
      makeCompany(2, "financial services"),
      makeCompany(3, "legal services"),
    ];

    const { manufacturing, service } = splitByCompanyType(companies);
    expect(manufacturing).toHaveLength(0);
    expect(service).toHaveLength(3);
  });

  it("handles empty list", () => {
    const { manufacturing, service } = splitByCompanyType([]);
    expect(manufacturing).toHaveLength(0);
    expect(service).toHaveLength(0);
  });
});
