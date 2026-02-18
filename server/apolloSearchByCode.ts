/**
 * Apollo Search by NAICS Code
 * 
 * Searches Apollo API for companies matching specific NAICS codes in a location.
 * Used in batched search flow where we search one code at a time for maximum coverage.
 */

import axios from "axios";
import { ApolloCompany } from "./apolloSearch";

export interface SearchByCodeParams {
  location: string;
  naicsCode: string;
  limit?: number;
}

/**
 * Normalize location to state-level for Apollo API
 */
function normalizeLocation(location: string): string {
  const stateMap: Record<string, string> = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
  };

  // Extract state abbreviation or name
  const parts = location.split(",").map((p) => p.trim());
  const statePart = parts[parts.length - 1];

  // If it's a 2-letter code, expand it
  if (statePart.length === 2 && stateMap[statePart.toUpperCase()]) {
    return stateMap[statePart.toUpperCase()];
  }

  // Otherwise return the state part as-is
  return statePart;
}

/**
 * Search Apollo for companies matching a specific NAICS code
 */
export async function searchByNaicsCode(
  params: SearchByCodeParams
): Promise<ApolloCompany[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  const { location, naicsCode, limit = 50 } = params;
  const normalizedLocation = normalizeLocation(location);

  console.log(`[Apollo Code Search] Location: ${normalizedLocation}, NAICS: ${naicsCode}, Limit: ${limit}`);

  try {
    const companies: ApolloCompany[] = [];
    let page = 1;
    const perPage = 25;

    while (companies.length < limit) {
      const requestBody: Record<string, unknown> = {
        page,
        per_page: perPage,
        organization_locations: [normalizedLocation],
        organization_industry_tag_ids: [naicsCode], // Apollo uses this field for NAICS filtering
      };

      console.log(`[Apollo Code Search] NAICS ${naicsCode} - Page ${page} request...`);

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

      const results = response.data.organizations || [];

      if (results.length === 0) {
        console.log(`[Apollo Code Search] NAICS ${naicsCode} - No more results`);
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

      console.log(`[Apollo Code Search] NAICS ${naicsCode} - Page ${page}: got ${results.length} results, total: ${companies.length}`);

      // If we got fewer results than requested, we've reached the end
      if (results.length < perPage) {
        break;
      }

      page++;
    }

    console.log(`[Apollo Code Search] NAICS ${naicsCode} - Final count: ${companies.length}`);
    return companies;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Apollo Code Search] NAICS ${naicsCode} - API error:`, error.response?.data || error.message);
      throw new Error(`Apollo API error: ${error.response?.data?.error || error.message}`);
    }
    throw error;
  }
}
