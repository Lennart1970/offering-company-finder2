import axios from "axios";

const apiKey = process.env.APOLLO_API_KEY;
console.log("API key present:", !!apiKey);

// Test: organizations/search — what fields does it return?
const r = await axios.post(
  "https://api.apollo.io/api/v1/organizations/search",
  {
    q_organization_name: "Kapsch TrafficCom",
    organization_locations: ["Austria"],
    page: 1,
    per_page: 3,
  },
  { headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
);

const orgs = r.data?.organizations || [];
console.log("orgs found:", orgs.length);
if (orgs[0]) {
  const o = orgs[0];
  console.log("Fields available:", Object.keys(o).join(", "));
  console.log("\nKey fields:");
  console.log("  id:", o.id);
  console.log("  name:", o.name);
  console.log("  primary_domain:", o.primary_domain);
  console.log("  website_url:", o.website_url);
  console.log("  linkedin_url:", o.linkedin_url);
  console.log("  city:", o.city);
  console.log("  country:", o.country);
  console.log("  founded_year:", o.founded_year);
  console.log("  organization_revenue_printed:", o.organization_revenue_printed);
  console.log("  sic_codes:", o.sic_codes);
  console.log("  naics_codes:", o.naics_codes);
  console.log("  headcount_six_month_growth:", o.organization_headcount_six_month_growth);
  console.log("  headcount_twelve_month_growth:", o.organization_headcount_twelve_month_growth);
  console.log("  primary_phone:", o.primary_phone);
}
