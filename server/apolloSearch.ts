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
  organization_headcount_six_month_growth?: number;
  organization_headcount_twelve_month_growth?: number;
}

interface EmployeeRange {
  min: number;
  max: number;
}

function parseTargetMarket(targetMarket: string): EmployeeRange[] {
  const lower = targetMarket.toLowerCase();

  // Check for specific size indicators
  if (lower.includes("fortune") || lower.includes("global")) {
    return [{ min: 10001, max: null as any }];
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

  // Default: mid-market range
  return [
    { min: 51, max: 200 },
    { min: 201, max: 500 },
    { min: 501, max: 1000 },
    { min: 1001, max: 5000 },
  ];
}

function normalizeLocation(location: string): string {
  // Ensure location ends with country
  const trimmed = location.trim();
  if (!trimmed.toLowerCase().includes("usa") && !trimmed.toLowerCase().includes("united states")) {
    // Check if it looks like US city/state format
    if (/^[A-Za-z\s]+,\s*[A-Z]{2}$/.test(trimmed)) {
      return `${trimmed}, USA`;
    }
  }
  return trimmed;
}

export async function searchApolloCompanies(
  offering: { keywords: string[]; targetMarket: string },
  location: string,
  radiusMiles: number = 300,
  limit: number = 50
): Promise<ApolloCompany[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  const normalizedLocation = normalizeLocation(location);
  const employeeRanges = parseTargetMarket(offering.targetMarket);
  const searchKeywords = offering.keywords.slice(0, 5); // Use first 5 keywords

  try {
    const companies: ApolloCompany[] = [];
    let page = 1;
    const perPage = 10; // Apollo returns 10 per page

    while (companies.length < limit) {
      const response = await axios.post(
        "https://api.apollo.io/v1/mixed_companies/search",
        {
          q_keywords: searchKeywords.join(" "),
          page,
          per_page: perPage,
          organization_locations: [normalizedLocation],
          organization_num_employees_ranges: employeeRanges.map((range) =>
            range.max ? `${range.min},${range.max}` : `${range.min},`
          ),
        },
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
        break; // No more results
      }

      companies.push(...results);

      if (companies.length >= limit || results.length < perPage) {
        break;
      }

      page++;
    }

    return companies.slice(0, limit);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo API error: ${errorMsg}`);
    }
    throw error;
  }
}
