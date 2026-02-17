import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createSearch, updateSearch, getSearchById, getUserSearches, createCompanies, getCompaniesBySearchId } from "./db";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// Schema for offering extraction result
const OfferingSchema = z.object({
  name: z.string(),
  description: z.string(),
  targetMarket: z.string(),
  valueProposition: z.string(),
  keywords: z.array(z.string()),
  crossBorderIndicators: z.string().optional(),
});

// Schema for Apollo company result
const ApolloCompanySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  website_url: z.string().optional(),
  primary_domain: z.string().optional(),
  linkedin_url: z.string().optional(),
  phone: z.string().optional(),
  founded_year: z.number().optional(),
  organization_revenue_printed: z.string().optional(),
  organization_headcount_six_month_growth: z.number().optional(),
  organization_headcount_twelve_month_growth: z.number().optional(),
});

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

// Background extraction and search function
async function extractAndSearch(searchId: number, companyWebsite: string, location: string) {
  try {
    // Step 1: Extract offering using offering-extractor skill
    const offeringTmpFile = join(tmpdir(), `offering-${searchId}.json`);
    
    const extractCmd = `cd /home/ubuntu/skills/offering-extractor && python3 scripts/extract_offering.py "${companyWebsite}" --output json > ${offeringTmpFile}`;
    await execAsync(extractCmd, { timeout: 180000 }); // 3 minute timeout

    const offeringJson = await readFile(offeringTmpFile, "utf-8");
    const offering = OfferingSchema.parse(JSON.parse(offeringJson));

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

    // Clean up temp file
    await unlink(offeringTmpFile);

    // Step 2: Save offering to temp file for apollo-company-finder
    const offeringInputFile = join(tmpdir(), `offering-input-${searchId}.json`);
    await writeFile(offeringInputFile, JSON.stringify(offering));

    // Step 3: Search Apollo for matching companies
    const apolloOutputFile = join(tmpdir(), `apollo-output-${searchId}.json`);
    const searchCmd = `cd /home/ubuntu/skills/apollo-company-finder && python3 scripts/find_companies.py ${offeringInputFile} "${location}" --limit 50 --output json > ${apolloOutputFile}`;
    await execAsync(searchCmd, { timeout: 180000 }); // 3 minute timeout

    const apolloJson = await readFile(apolloOutputFile, "utf-8");
    const apolloResults = z.array(ApolloCompanySchema).parse(JSON.parse(apolloJson));

    // Step 4: Store companies in database
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

    // Clean up temp files
    await unlink(offeringInputFile);
    await unlink(apolloOutputFile);

    // Mark search as completed
    await updateSearch(searchId, {
      status: "completed",
    });
  } catch (error) {
    console.error("Error in extractAndSearch:", error);
    throw error;
  }
}
