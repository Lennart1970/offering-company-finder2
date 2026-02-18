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
  // Location fields from enrichment (only populated after enrichment)
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

/**
 * Parse state from location input for state-wide search
 * Examples:
 *   "Atlanta, GA" → "Georgia, USA"
 *   "GA" → "Georgia, USA"
 *   "Georgia" → "Georgia, USA"
 *   "New York, NY" → "New York, USA"
 */
function normalizeLocation(location: string): string {
  const trimmed = location.trim();
  
  // State abbreviation to full name mapping
  const stateMap: Record<string, string> = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia"
  };
  
  // Pattern: "City, ST" → extract state abbreviation
  const cityStateMatch = trimmed.match(/^[A-Za-z\s]+,\s*([A-Z]{2})$/);
  if (cityStateMatch) {
    const stateAbbr = cityStateMatch[1];
    const stateName = stateMap[stateAbbr];
    if (stateName) {
      console.log(`[Location Parser] "${trimmed}" → "${stateName}, USA" (state-wide)`);
      return `${stateName}, USA`;
    }
  }
  
  // Pattern: Just state abbreviation "GA" → convert to full name
  if (/^[A-Z]{2}$/.test(trimmed)) {
    const stateName = stateMap[trimmed];
    if (stateName) {
      console.log(`[Location Parser] "${trimmed}" → "${stateName}, USA" (state-wide)`);
      return `${stateName}, USA`;
    }
  }
  
  // Pattern: Full state name "Georgia" → add USA
  const stateNames = Object.values(stateMap).map(s => s.toLowerCase());
  if (stateNames.includes(trimmed.toLowerCase())) {
    const properStateName = Object.values(stateMap).find(s => s.toLowerCase() === trimmed.toLowerCase());
    if (properStateName) {
      console.log(`[Location Parser] "${trimmed}" → "${properStateName}, USA" (state-wide)`);
      return `${properStateName}, USA`;
    }
  }
  
  // Fallback: return as-is
  console.log(`[Location Parser] "${trimmed}" → "${trimmed}" (as-is)`);
  return trimmed;
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

/**
 * STEP 1: Fast bulk search - finds companies by keyword tags + location
 * Does NOT enrich with address details (fast, 1 API call per page)
 */
export async function searchApolloCompanies(
  params: ApolloSearchParams
): Promise<ApolloSearchResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  const { targetMarketKeywordTags, targetMarket, location, limit = 100 } = params;
  const normalizedLocation = normalizeLocation(location);
  const employeeRanges = parseTargetMarket(targetMarket);

  const keywordTags = targetMarketKeywordTags.slice(0, 10);

  console.log(`[Apollo Search] Location: ${normalizedLocation}`);
  console.log(`[Apollo Search] Keyword tags: ${JSON.stringify(keywordTags)}`);
  console.log(`[Apollo Search] Employee ranges: ${JSON.stringify(employeeRanges)}`);
  console.log(`[Apollo Search] Target limit: ${limit}`);

  try {
    const companies: ApolloCompany[] = [];
    let page = 1;
    const perPage = 100; // Apollo's max page size for better coverage
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

      console.log(`[Apollo Search] Page ${page} request...`);

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

      // Map results WITHOUT enrichment (fast)
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
          // No location data yet - that comes from enrichment
        };

        companies.push(mapped);
      }

      console.log(`[Apollo Search] Page ${page}: got ${results.length} results, total collected: ${companies.length}/${totalFound}`);

      // Stop if we've collected enough OR if we've reached all available results
      if (companies.length >= limit || companies.length >= totalFound) {
        break;
      }

      page++;
    }

    console.log(`[Apollo Search] Done. Collected ${companies.length} companies out of ${totalFound} total.`);

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

/**
 * STEP 2: Enrich a single company with full details (address, SIC/NAICS from enrichment)
 * Called separately after initial search results are displayed
 */
export async function enrichCompanyDetails(apolloId: string): Promise<{
  city?: string;
  state?: string;
  country?: string;
  street_address?: string;
  raw_address?: string;
}> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

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
    throw error;
  }
}
