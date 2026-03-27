import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmAndSearch } from "./confirmAndSearch";
import * as db from "./db";
import * as apolloSearch from "./apolloSearch";

// Mock dependencies
vi.mock("./db");
vi.mock("./apolloSearch");

describe("confirmAndSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract sectors from selected NAICS codes and filter out excluded sectors", async () => {
    const mockSearch = {
      id: 1,
      userId: 1,
      companyWebsite: "https://example.com",
      location: "Atlanta, GA",
      status: "code_targeting",
      selectedNaicsCodes: JSON.stringify(["33", "333", "334412", "48", "49"]),
      excludedSectors: JSON.stringify(["48", "49"]), // Exclude Transportation
      targetMarket: "Railway • Healthcare • Infrastructure",
      offeringName: null,
      offeringDescription: null,
      valueProposition: null,
      targetMarkets: null,
      selectedSicCodes: null,
      codeSelectionReasoning: null,
      codesSearched: null,
      codesTotal: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getSearchById).mockResolvedValue(mockSearch);
    vi.mocked(db.updateSearch).mockResolvedValue(undefined);
    vi.mocked(db.createCompanies).mockResolvedValue(undefined);
    vi.mocked(apolloSearch.searchApolloCompanies).mockResolvedValue({
      companies: [
        {
          id: "apollo-1",
          name: "Test Manufacturing Co",
          website_url: "https://test.com",
          naics_codes: ["334412"], // Matches confirmed sector 33
          sic_codes: [],
        },
        {
          id: "apollo-2",
          name: "Test Logistics Co",
          website_url: "https://logistics.com",
          naics_codes: ["484"], // Matches excluded sector 48 → should be filtered out
          sic_codes: [],
        },
      ],
    });

    await confirmAndSearch({ searchId: 1, location: "Atlanta, GA" });

    // Should have called updateSearch to set status to "searching"
    expect(db.updateSearch).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "searching",
    }));

    // Should have called updateSearch to set status to "completed"
    expect(db.updateSearch).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "completed",
    }));

    // Should have created companies (only the one matching confirmed sectors)
    expect(db.createCompanies).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          apolloId: "apollo-1",
          name: "Test Manufacturing Co",
        }),
      ])
    );

    // Should NOT include the logistics company (excluded sector 48)
    const createCompaniesCall = vi.mocked(db.createCompanies).mock.calls[0][0];
    expect(createCompaniesCall).toHaveLength(1);
    expect(createCompaniesCall[0].apolloId).toBe("apollo-1");
  });

  it("should run dynamic brain-driven slices (employee bands × industries × keyword sets)", async () => {
    const mockSearch = {
      id: 2,
      userId: 1,
      companyWebsite: "https://example.com",
      location: "Charlotte, NC",
      status: "code_targeting",
      selectedNaicsCodes: JSON.stringify(["33"]),
      excludedSectors: JSON.stringify([]),
      targetMarket: "Railway • Healthcare • Infrastructure",
      offeringName: null,
      offeringDescription: null,
      valueProposition: null,
      targetMarkets: null,
      selectedSicCodes: null,
      codeSelectionReasoning: null,
      codesSearched: null,
      codesTotal: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getSearchById).mockResolvedValue(mockSearch);
    vi.mocked(db.updateSearch).mockResolvedValue(undefined);
    vi.mocked(db.createCompanies).mockResolvedValue(undefined);
    vi.mocked(apolloSearch.searchApolloCompanies).mockResolvedValue({
      companies: [],
    });

    await confirmAndSearch({ searchId: 2, location: "Charlotte, NC" });

    // With no brain config, defaults are used:
    // 3 employee bands × 1 general industry × 1 general keyword set = 3 slices
    const { DEFAULT_EMPLOYEE_BANDS, generateSearchSlices } = await import("./searchSlices");
    const defaultSlices = generateSearchSlices(); // No brain config → defaults
    const expectedCalls = defaultSlices.length;
    expect(apolloSearch.searchApolloCompanies).toHaveBeenCalledTimes(expectedCalls);

    // Each call should include the location
    expect(apolloSearch.searchApolloCompanies).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "Charlotte, NC",
      })
    );

    // Each call should include targetMarketKeywordTags
    expect(apolloSearch.searchApolloCompanies).toHaveBeenCalledWith(
      expect.objectContaining({
        targetMarketKeywordTags: expect.arrayContaining([expect.any(String)]),
      })
    );
  });

  it("should deduplicate companies across batches by Apollo ID", async () => {
    const mockSearch = {
      id: 3,
      userId: 1,
      companyWebsite: "https://example.com",
      location: "Nashville, TN",
      status: "code_targeting",
      selectedNaicsCodes: JSON.stringify(["33"]),
      excludedSectors: JSON.stringify([]),
      targetMarket: "Railway • Healthcare",
      offeringName: null,
      offeringDescription: null,
      valueProposition: null,
      targetMarkets: null,
      selectedSicCodes: null,
      codeSelectionReasoning: null,
      codesSearched: null,
      codesTotal: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getSearchById).mockResolvedValue(mockSearch);
    vi.mocked(db.updateSearch).mockResolvedValue(undefined);
    vi.mocked(db.createCompanies).mockResolvedValue(undefined);

    // Mock Apollo to return the same company in both batches
    vi.mocked(apolloSearch.searchApolloCompanies)
      .mockResolvedValueOnce({
        companies: [
          {
            id: "apollo-duplicate",
            name: "Duplicate Co",
            website_url: "https://duplicate.com",
            naics_codes: ["334"],
            sic_codes: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        companies: [
          {
            id: "apollo-duplicate", // Same ID → should be deduplicated
            name: "Duplicate Co",
            website_url: "https://duplicate.com",
            naics_codes: ["334"],
            sic_codes: [],
          },
        ],
      });

    await confirmAndSearch({ searchId: 3, location: "Nashville, TN" });

    // Should have created companies only once (deduplicated)
    expect(db.createCompanies).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          apolloId: "apollo-duplicate",
        }),
      ])
    );

    const createCompaniesCall = vi.mocked(db.createCompanies).mock.calls[0][0];
    expect(createCompaniesCall).toHaveLength(1); // Only one company, not two
  });

  it("should update progress after each slice search", async () => {
    const mockSearch = {
      id: 4,
      userId: 1,
      companyWebsite: "https://example.com",
      location: "Miami, FL",
      status: "code_targeting",
      selectedNaicsCodes: JSON.stringify(["33"]),
      excludedSectors: JSON.stringify([]),
      targetMarket: "Railway • Healthcare • Infrastructure",
      offeringName: null,
      offeringDescription: null,
      valueProposition: null,
      targetMarkets: null,
      selectedSicCodes: null,
      codeSelectionReasoning: null,
      codesSearched: null,
      codesTotal: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getSearchById).mockResolvedValue(mockSearch);
    vi.mocked(db.updateSearch).mockResolvedValue(undefined);
    vi.mocked(db.createCompanies).mockResolvedValue(undefined);
    vi.mocked(apolloSearch.searchApolloCompanies).mockResolvedValue({
      companies: [],
    });

    await confirmAndSearch({ searchId: 4, location: "Miami, FL" });

    // With default config, should have 3 slices (3 bands × 1 industry × 1 keyword set)
    // Progress should be updated for each slice
    const { generateSearchSlices } = await import("./searchSlices");
    const defaultSlices = generateSearchSlices();
    for (let i = 1; i <= defaultSlices.length; i++) {
      expect(db.updateSearch).toHaveBeenCalledWith(4, { codesSearched: i });
    }
  });
});
