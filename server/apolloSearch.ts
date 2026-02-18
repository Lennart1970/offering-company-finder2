import axios from "axios";

export interface ApolloCompany {
  id?: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  linkedin_url?: string;
  phone?: string;
  founded_year?: number;
  organization_revenue_printed?: string;
  organization_revenue?: number;
  organization_headcount_six_month_growth?: number;
  organization_headcount_twelve_month_growth?: number;
  // SIC/NAICS codes from search response
  sic_codes?: string[];
  naics_codes?: string[];
  // Location fields from enrichment
  city?: string;
  state?: string;
  country?: string;
  street_address?: string;
  raw_address?: string;
}

interface EmployeeRange {
  min: number;
  max: number | null;
}

function parseTargetMarket(targetMarket: string): EmployeeRange[] {
  const lower = targetMarket.toLowerCase();

  if (lower.includes("fortune") || lower.includes("global")) {
    return [{ min: 10001, max: null }];
  }

  if (lower.includes("large") || lower.includes("enterprise")) {
    return [
      { min: 501, max: 1000 },
      { min: 1001, max: 5000 },
      { min: 5001, max: 10000 },
    ];
  }

  if (lower.includes("mid-market") || lower.includes("medium") || lower.includes("mid-sized")) {
    return [
      { min: 51, max: 200 },
      { min: 201, max: 500 },
      { min: 501, max: 1000 },
    ];
  }

  if (lower.includes("smb") || lower.includes("small")) {
    return [
      { min: 11, max: 50 },
      { min: 51, max: 200 },
    ];
  }

  // Default: broad range to not miss companies
  return [
    { min: 51, max: 200 },
    { min: 201, max: 500 },
    { min: 501, max: 1000 },
    { min: 1001, max: 5000 },
    { min: 5001, max: 10000 },
  ];
}

function normalizeLocation(location: string): string {
  const trimmed = location.trim();
  // Don't append USA if it already has a country indicator
  if (
    !trimmed.toLowerCase().includes("usa") &&
    !trimmed.toLowerCase().includes("united states") &&
    !trimmed.toLowerCase().includes("uk") &&
    !trimmed.toLowerCase().includes("germany") &&
    !trimmed.toLowerCase().includes("france")
  ) {
    // Check if it looks like US city/state format
    if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/.test(trimmed)) {
      return `${trimmed}, USA`;
    }
  }
  return trimmed;
}

/**
 * Enriches a company with full details including location data
 */
async function enrichCompanyDetails(apolloId: string, apiKey: string): Promise<Partial<ApolloCompany>> {
  try {
    const response = await axios.get(
      `https://api.apollo.io/api/v1/organizations/${apolloId}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const org = response.data.organization || {};
    return {
      city: org.city || undefined,
      state: org.state || undefined,
      country: org.country || undefined,
      street_address: org.street_address || undefined,
      raw_address: org.raw_address || undefined,
    };
  } catch (error) {
    console.warn(`[Apollo] Failed to enrich company ${apolloId}:`, error instanceof Error ? error.message : error);
    return {};
  }
}

export interface ApolloSearchParams {
  targetMarketKeywordTags: string[];
  targetMarket: string;
  location: string;
  limit?: number;
}

export interface ApolloSearchResult {
  companies: ApolloCompany[];
  keywordTagsUsed: string[];
  totalFound: number;
}

export async function searchApolloCompanies(
  params: ApolloSearchParams
): Promise<ApolloSearchResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  const { targetMarketKeywordTags, targetMarket, location, limit = 50 } = params;
  const normalizedLocation = normalizeLocation(location);
  const employeeRanges = parseTargetMarket(targetMarket);

  // Use the target market keyword tags directly for Apollo's keyword filter
  const keywordTags = targetMarketKeywordTags.slice(0, 10); // Apollo works best with focused tags

  console.log(`[Apollo Search] Location: ${normalizedLocation}`);
  console.log(`[Apollo Search] Keyword tags: ${JSON.stringify(keywordTags)}`);
  console.log(`[Apollo Search] Employee ranges: ${JSON.stringify(employeeRanges)}`);

  try {
    const companies: ApolloCompany[] = [];
    let page = 1;
    const perPage = 25;
    let totalFound = 0;

    while (companies.length < limit) {
      const requestBody: Record<string, unknown> = {
        page,
        per_page: perPage,
        organization_locations: [normalizedLocation],
        q_organization_keyword_tags: keywordTags,
        organization_num_employees_ranges: employeeRanges.map((range) =>
          range.max ? `${range.min},${range.max}` : `${range.min},`
        ),
      };

      console.log(`[Apollo Search] Page ${page} request:`, JSON.stringify(requestBody, null, 2));

      const response = await axios.post(
        "https://api.apollo.io/api/v1/mixed_companies/search",
        requestBody,
        {
          headers: {
            "X-Api-Key": apiKey,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      totalFound = response.data.pagination?.total_entries || 0;
      const results = response.data.organizations || [];

      if (results.length === 0) {
        break;
      }

      // Map results and capture SIC/NAICS codes from the response
      for (const company of results) {
        const mapped: ApolloCompany = {
          id: company.id,
          name: company.name,
          website_url: company.website_url,
          primary_domain: company.primary_domain,
          linkedin_url: company.linkedin_url,
          phone: company.phone || company.primary_phone?.number,
          founded_year: company.founded_year,
          organization_revenue_printed: company.organization_revenue_printed,
          organization_revenue: company.organization_revenue,
          organization_headcount_six_month_growth: company.organization_headcount_six_month_growth,
          organization_headcount_twelve_month_growth: company.organization_headcount_twelve_month_growth,
          sic_codes: company.sic_codes || [],
          naics_codes: company.naics_codes || [],
        };

        // Enrich with location data
        if (company.id) {
          const enrichedData = await enrichCompanyDetails(company.id, apiKey);
          Object.assign(mapped, enrichedData);
        }

        companies.push(mapped);
      }

      if (companies.length >= limit || results.length < perPage) {
        break;
      }

      page++;
    }

    return {
      companies: companies.slice(0, limit),
      keywordTagsUsed: keywordTags,
      totalFound,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Apollo API Error] Status:", error.response?.status);
      console.error("[Apollo API Error] Response:", JSON.stringify(error.response?.data, null, 2));
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo API error: ${errorMsg}`);
    }
    throw error;
  }
}
