import axios from "axios";

// The detail page loads from company-prd.raicore.com
// Let's probe what API endpoints it uses

const baseUrl = "https://company-prd.raicore.com";

// Try common API patterns for exhibitor data
const attempts = [
  // Try fetching exhibitor by slug
  `${baseUrl}/api/exhibitors/arvoo-imaging-products-b-v`,
  `${baseUrl}/api/companies/arvoo-imaging-products-b-v`,
  `${baseUrl}/exhibitors/arvoo-imaging-products-b-v`,
  // Try the Next.js data API
  `${baseUrl}/_next/data/arvoo-imaging-products-b-v.json`,
  // Try with event context
  `${baseUrl}/api/exhibitors?slug=arvoo-imaging-products-b-v`,
  `${baseUrl}/api/exhibitors?event=intertraffic-amsterdam&slug=arvoo-imaging-products-b-v`,
];

for (const url of attempts) {
  try {
    const r = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
      timeout: 10000,
    });
    console.log(`✓ ${url}`);
    console.log("  Status:", r.status);
    console.log("  Data:", JSON.stringify(r.data).slice(0, 200));
  } catch (e) {
    console.log(`✗ ${url} → ${e.response?.status || e.message}`);
  }
}

// Also try fetching the Intertraffic exhibitor page with Puppeteer to capture network requests
console.log("\n--- Checking for API calls in the detail page HTML ---");
const r = await axios.get("https://www.intertraffic.com/amsterdam/exhibitors/arvoo-imaging-products-b-v", {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  timeout: 20000,
});
const html = r.data;

// Look for API endpoint references in the HTML/JS
const apiRefs = [...html.matchAll(/["'`](https?:\/\/[^"'`]*(?:api|graphql|exhibitor)[^"'`]*?)["'`]/gi)];
console.log("API references found:");
apiRefs.slice(0, 15).forEach(m => console.log(" ", m[1]));

// Look for raicore.com references
const raicoreRefs = [...html.matchAll(/raicore\.com[^"'\s]*/gi)];
console.log("\nraicore.com references:");
raicoreRefs.slice(0, 10).forEach(m => console.log(" ", m[0]));
