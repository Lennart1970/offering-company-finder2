/**
 * Apollo CSV Parser
 * 
 * Parses Apollo company export CSVs and maps fields to our database schema
 */

import { parse } from "csv-parse/sync";
import type { InsertCompany } from "../drizzle/schema";

export interface ApolloCSVRow {
  "Company Name": string;
  "Lists": string;
  "# Employees": string;
  "Industry": string;
  "Website": string;
  "Company Linkedin Url": string;
  "Twitter Url": string;
  "Company Street": string;
  "Company City": string;
  "Company State": string;
  "Company Country": string;
  "Company Postal Code": string;
  "Company Address": string;
  "Keywords": string;
  "Company Phone": string;
  "Annual Revenue": string;
  "Apollo Account Id": string;
  "SIC Codes": string;
  "Short Description": string;
  "Logo Url": string;
  "Subsidiary of": string;
  "Subsidiary of (Organization ID)": string;
}

/**
 * Parse Apollo CSV file content
 */
export function parseApolloCSV(csvContent: string): ApolloCSVRow[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ApolloCSVRow[];
  return records;
}

/**
 * Map Apollo CSV row to database company record
 */
export function mapApolloRowToCompany(
  row: ApolloCSVRow,
  searchId: number
): Omit<InsertCompany, "id" | "createdAt"> {
  // Parse employee count
  const employeeCount = row["# Employees"] ? parseInt(row["# Employees"]) : null;

  // Parse SIC codes (comma-separated string to array)
  const sicCodes = row["SIC Codes"]
    ? row["SIC Codes"].split(",").map((code) => code.trim()).filter(Boolean)
    : [];

  // Build slice metadata with additional fields
  const sliceMetadata = {
    employeeCount,
    industry: row["Industry"] || null,
    keywords: row["Keywords"] || null,
    description: row["Short Description"] || null,
    lists: row["Lists"] || null,
    logoUrl: row["Logo Url"] || null,
  };

  // Extract domain from website URL
  let primaryDomain = null;
  if (row["Website"]) {
    try {
      const url = new URL(row["Website"].startsWith("http") ? row["Website"] : `https://${row["Website"]}`);
      primaryDomain = url.hostname.replace(/^www\./, "");
    } catch (e) {
      // Invalid URL, skip domain extraction
    }
  }

  return {
    searchId,
    apolloId: row["Apollo Account Id"] || null,
    name: row["Company Name"],
    websiteUrl: row["Website"] || null,
    primaryDomain,
    linkedinUrl: row["Company Linkedin Url"] || null,
    twitterUrl: row["Twitter Url"] || null,
    facebookUrl: null, // Not in Apollo CSV
    phone: row["Company Phone"] || null,
    foundedYear: null, // Not in Apollo CSV
    revenue: row["Annual Revenue"] || null,
    headcountGrowth: null, // Not in Apollo CSV
    parentCompanyName: row["Subsidiary of"] || null,
    parentCompanyId: row["Subsidiary of (Organization ID)"] || null,
    searchLocation: row["Company State"] || row["Company Country"] || null,
    city: row["Company City"] || null,
    state: row["Company State"] || null,
    country: row["Company Country"] || null,
    streetAddress: row["Company Street"] || null,
    rawAddress: row["Company Address"] || null,
    sicCodes: JSON.stringify(sicCodes),
    naicsCodes: null, // Not in Apollo CSV
    sliceMetadata: JSON.stringify(sliceMetadata),
    urgencyScore: null,
    briefData: null,
    briefGeneratedAt: null,
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    enrichmentStatus: "pending",
  };
}
