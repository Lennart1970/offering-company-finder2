import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createSearch, updateSearch, getSearchById, getUserSearches, createCompanies, getCompaniesBySearchId } from "./db";
import { extractOffering } from "./offeringExtractor";
import { searchApolloCompanies } from "./apolloSearch";

export const companyFinderRouter = router({
  // Create a new search and start the extraction process
  startSearch: protectedProcedure
    .input(
      z.object({
        companyWebsite: z.string().url(),
        location: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create initial search record
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: input.companyWebsite,
        location: input.location,
        status: "extracting",
      });

      // Start extraction in background (don't await)
      extractAndSearch(searchId, input.companyWebsite, input.location).catch(async (error) => {
        await updateSearch(searchId, {
          status: "failed",
          errorMessage: error.message,
        });
      });

      return { searchId };
    }),

  // Get search status and results
  getSearch: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }

      const companiesList = await getCompaniesBySearchId(input.searchId);

      return {
        search,
        companies: companiesList,
      };
    }),

  // Get user's search history
  getSearchHistory: protectedProcedure.query(async ({ ctx }) => {
    return getUserSearches(ctx.user.id);
  }),

  // Export companies as CSV
  exportCsv: protectedProcedure
    .input(z.object({ searchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const search = await getSearchById(input.searchId);
      if (!search || search.userId !== ctx.user.id) {
        throw new Error("Search not found");
      }

      const companiesList = await getCompaniesBySearchId(input.searchId);

      // Generate CSV
      const headers = [
        "Name",
        "Website",
        "Domain",
        "LinkedIn",
        "Phone",
        "Founded",
        "Revenue",
        "Headcount Growth",
      ];
      const rows = companiesList.map((c) => [
        c.name,
        c.websiteUrl || "",
        c.primaryDomain || "",
        c.linkedinUrl || "",
        c.phone || "",
        c.foundedYear?.toString() || "",
        c.revenue || "",
        c.headcountGrowth || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      return { csv: csvContent };
    }),
});

// Background extraction and search function using native integrations
async function extractAndSearch(searchId: number, companyWebsite: string, location: string) {
  try {
    // Step 1: Extract offering using native xAI Grok integration
    const offering = await extractOffering(companyWebsite);

    // Update search with offering data
    await updateSearch(searchId, {
      offeringName: offering.name,
      offeringDescription: offering.description,
      targetMarket: offering.targetMarket,
      valueProposition: offering.valueProposition,
      keywords: JSON.stringify(offering.keywords),
      crossBorderIndicators: offering.crossBorderIndicators || "",
      status: "searching",
    });

    // Step 2: Search Apollo for matching companies using native integration
    const apolloResults = await searchApolloCompanies(offering, location, 300, 50);

    // Step 3: Store companies in database
    const companiesToInsert = apolloResults.map((company) => ({
      searchId,
      apolloId: company.id,
      name: company.name,
      websiteUrl: company.website_url,
      primaryDomain: company.primary_domain,
      linkedinUrl: company.linkedin_url,
      phone: company.phone,
      foundedYear: company.founded_year,
      revenue: company.organization_revenue_printed,
      headcountGrowth: [
        company.organization_headcount_six_month_growth
          ? `6mo: ${(company.organization_headcount_six_month_growth * 100).toFixed(1)}%`
          : "",
        company.organization_headcount_twelve_month_growth
          ? `12mo: ${(company.organization_headcount_twelve_month_growth * 100).toFixed(1)}%`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
    }));

    await createCompanies(companiesToInsert);

    // Mark search as completed
    await updateSearch(searchId, {
      status: "completed",
    });
  } catch (error) {
    console.error("Error in extractAndSearch:", error);
    throw error;
  }
}
