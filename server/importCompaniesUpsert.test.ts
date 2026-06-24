import { describe, it, expect } from "vitest";
import type { Company } from "../drizzle/schema";
import {
  buildFirmographicPatch,
  dedupeImportRows,
  type ImportCompanyRow,
} from "./importCompaniesUpsert";

function baseRow(overrides: Partial<ImportCompanyRow> = {}): ImportCompanyRow {
  return {
    searchId: 99,
    apolloId: "apollo-abc",
    name: "Acme Corp",
    websiteUrl: "https://www.acme.com",
    primaryDomain: "acme.com",
    normalizedDomain: "acme.com",
    linkedinUrl: null,
    twitterUrl: null,
    facebookUrl: null,
    phone: null,
    foundedYear: null,
    revenue: "$10M",
    headcountGrowth: null,
    parentCompanyName: null,
    parentCompanyId: null,
    searchLocation: null,
    city: "Amsterdam",
    state: null,
    country: "Netherlands",
    streetAddress: null,
    rawAddress: null,
    sicCodes: null,
    naicsCodes: null,
    sector: "Software",
    sliceMetadata: JSON.stringify({ industry: "Software" }),
    urgencyScore: null,
    briefData: null,
    briefGeneratedAt: null,
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    enrichmentStatus: "enriched",
    ...overrides,
  };
}

function existingCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    searchId: 10,
    apolloId: "apollo-abc",
    name: "Acme Corp",
    websiteUrl: "https://www.acme.com",
    primaryDomain: "acme.com",
    normalizedDomain: "acme.com",
    linkedinUrl: null,
    twitterUrl: null,
    facebookUrl: null,
    phone: null,
    foundedYear: null,
    revenue: null,
    headcountGrowth: null,
    parentCompanyName: null,
    parentCompanyId: null,
    searchLocation: null,
    city: null,
    state: null,
    country: null,
    streetAddress: null,
    rawAddress: null,
    sicCodes: null,
    naicsCodes: null,
    sector: null,
    sliceMetadata: null,
    sourceCountryCode: null,
    urgencyScore: null,
    urgencyScoreGeneratedAt: null,
    urgencyScoreSynth: null,
    urgencyScoreSynthGeneratedAt: null,
    urgencyScoreNews: null,
    urgencyScoreNewsGeneratedAt: null,
    urgencyScoreLLM: null,
    urgencyScoreLLMGeneratedAt: null,
    urgencyScoreHITL: null,
    urgencyScoreHITLUpdatedAt: null,
    urgencyScoreHITLNote: null,
    similarityScore: 82,
    similarityScoreGeneratedAt: new Date(),
    fitScore: 75,
    fitScoreData: '{"label":"Good"}',
    fitScoreGeneratedAt: new Date(),
    fitScoreSource: "llm",
    fitScoreHITL: null,
    fitScoreHITLUpdatedAt: null,
    fitScoreHITLNote: null,
    briefData: '{"whyThisCompanyMatters":"important"}',
    briefGeneratedAt: new Date(),
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    callReadinessSummary: null,
    productImages: null,
    urgencyImages: null,
    salesRepProfile: null,
    salesRepProfileGeneratedAt: null,
    signalOpeners: null,
    signalOpenersGeneratedAt: null,
    enrichmentStatus: "enriched",
    generatedWithBrainId: 5,
    generatedWithBrainName: "Test Brain",
    nicheId: null,
    contactsFetchedAt: null,
    cgBusinessUnit: null,
    cgSalesManager: null,
    cgLeadClass: null,
    cgLeadOrigin: null,
    cgMarket: null,
    cgComment: null,
    cgRemarks: null,
    cgSharepointId: null,
    cgImportedAt: null,
    cgParentCompany: null,
    cgContactGender: null,
    cgContactFirstName: null,
    cgContactLastName: null,
    cgContactPosition: null,
    cgContactPhone: null,
    cgContactEmail: null,
    cgHqAddress: null,
    createdAt: new Date(),
    ...overrides,
  } as Company;
}

describe("dedupeImportRows", () => {
  it("keeps one row per apolloId within the file", () => {
    const rows = [
      baseRow({ city: "Old City" }),
      baseRow({ city: "New City" }),
    ];
    const { unique, dedupedInFile } = dedupeImportRows(rows);
    expect(unique).toHaveLength(1);
    expect(unique[0].city).toBe("New City");
    expect(dedupedInFile).toBe(1);
  });
});

describe("buildFirmographicPatch", () => {
  it("fills missing firmographics without touching protected enrichment", () => {
    const existing = existingCompany({ city: null, revenue: null });
    const incoming = baseRow({ city: "Amsterdam", revenue: "$10M", searchId: 999 });

    const patch = buildFirmographicPatch(existing, incoming);

    expect(patch.city).toBe("Amsterdam");
    expect(patch.revenue).toBe("$10M");
    expect(patch.searchId).toBeUndefined();
    expect(patch.fitScore).toBeUndefined();
    expect(patch.briefData).toBeUndefined();
    expect(patch.similarityScore).toBeUndefined();
    expect(patch.generatedWithBrainId).toBeUndefined();
  });

  it("does not overwrite sliceMetadata when company already has enrichment work", () => {
    const existing = existingCompany({
      sliceMetadata: JSON.stringify({ industry: "Old" }),
    });
    const incoming = baseRow({
      sliceMetadata: JSON.stringify({ industry: "New" }),
    });

    const patch = buildFirmographicPatch(existing, incoming);
    expect(patch.sliceMetadata).toBeUndefined();
  });

  it("can promote pending rows to enriched from CSV import", () => {
    const existing = existingCompany({
      enrichmentStatus: "pending",
      fitScore: null,
      similarityScore: null,
      briefData: null,
      fitScoreData: null,
    });
    const incoming = baseRow({ enrichmentStatus: "enriched" });

    const patch = buildFirmographicPatch(existing, incoming);
    expect(patch.enrichmentStatus).toBe("enriched");
  });

  it("sets apolloId when existing row only matched by domain", () => {
    const existing = existingCompany({ apolloId: null });
    const patch = buildFirmographicPatch(existing, baseRow());
    expect(patch.apolloId).toBe("apollo-abc");
  });
});
