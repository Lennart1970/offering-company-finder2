import axios from "axios";
import { readFileSync } from "fs";

// Load env from .env file if present
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {}

const apiKey = process.env.APOLLO_API_KEY;
console.log("API key present:", !!apiKey, apiKey ? `(${apiKey.slice(0,8)}...)` : "");

// Test 1: organizations/enrich with name only
console.log("\n--- Test 1: organizations/enrich with name only ---");
try {
  const r = await axios.post(
    "https://api.apollo.io/api/v1/organizations/enrich",
    { name: "Siemens Mobility" },
    { headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
  );
  console.log("Status:", r.status);
  console.log("org found:", !!r.data?.organization);
  if (r.data?.organization) console.log("org name:", r.data.organization.name, "| domain:", r.data.organization.primary_domain);
  else console.log("response:", JSON.stringify(r.data).slice(0, 200));
} catch (e) {
  console.log("Error:", e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
}

// Test 2: organizations/enrich with name + country
console.log("\n--- Test 2: organizations/enrich with name + country ---");
try {
  const r = await axios.post(
    "https://api.apollo.io/api/v1/organizations/enrich",
    { name: "Siemens Mobility", organization_country_code: "DE" },
    { headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
  );
  console.log("Status:", r.status);
  console.log("org found:", !!r.data?.organization);
  if (r.data?.organization) console.log("org name:", r.data.organization.name, "| domain:", r.data.organization.primary_domain);
  else console.log("response:", JSON.stringify(r.data).slice(0, 200));
} catch (e) {
  console.log("Error:", e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
}

// Test 3: mixed_companies search with q_organization_name
console.log("\n--- Test 3: mixed_companies search with q_organization_name ---");
try {
  const r = await axios.post(
    "https://api.apollo.io/api/v1/mixed_companies/search",
    {
      q_organization_name: "Siemens Mobility",
      page: 1,
      per_page: 3,
    },
    { headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
  );
  console.log("Status:", r.status);
  const orgs = r.data?.organizations || [];
  console.log("orgs found:", orgs.length);
  orgs.slice(0, 3).forEach(o => console.log(" -", o.name, "|", o.primary_domain, "|", o.country));
} catch (e) {
  console.log("Error:", e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
}

// Test 4: organizations search with q_organization_name
console.log("\n--- Test 4: organizations search with q_organization_name ---");
try {
  const r = await axios.post(
    "https://api.apollo.io/api/v1/organizations/search",
    {
      q_organization_name: "Kapsch TrafficCom",
      page: 1,
      per_page: 3,
    },
    { headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" }, timeout: 15000 }
  );
  console.log("Status:", r.status);
  const orgs = r.data?.organizations || [];
  console.log("orgs found:", orgs.length);
  orgs.slice(0, 3).forEach(o => console.log(" -", o.name, "|", o.primary_domain, "|", o.country));
} catch (e) {
  console.log("Error:", e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
}
