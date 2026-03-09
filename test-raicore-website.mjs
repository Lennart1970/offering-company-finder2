import axios from "axios";

// The detail page is served from company-prd.raicore.com
const r = await axios.get("https://company-prd.raicore.com/exhibitors/arvoo-imaging-products-b-v", {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  timeout: 20000,
});
const html = r.data;

console.log("HTML length:", html.length);

// Look for arvoo.com in the HTML
if (html.includes("arvoo.com")) {
  console.log("✓ arvoo.com found in HTML!");
  const idx = html.indexOf("arvoo.com");
  console.log("Context:", html.slice(Math.max(0, idx - 200), idx + 200));
} else {
  console.log("✗ arvoo.com NOT in HTML");
}

// Look for any external website links
const extLinks = [...html.matchAll(/href=["'](https?:\/\/(?!.*raicore|.*intertraffic|.*rai\.amsterdam|.*rai\.nl|.*google\.com|.*linkedin|.*facebook|.*twitter|.*youtube|.*instagram)[^"']+)["']/gi)];
console.log("\nExternal company website links:");
extLinks.slice(0, 10).forEach(m => console.log(" ", m[1]));

// Check __NEXT_DATA__ in this page
const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (nextDataMatch) {
  const data = JSON.parse(nextDataMatch[1]);
  const raw = JSON.stringify(data);
  
  // Find website field
  const websiteMatches = [...raw.matchAll(/"(?:website|websiteUrl|website_url|url|externalUrl|companyWebsite)":\s*"(https?:\/\/[^"]+)"/gi)];
  console.log("\nWebsite fields in __NEXT_DATA__:");
  websiteMatches.slice(0, 10).forEach(m => console.log(" ", m[0]));
  
  // Find arvoo.com
  if (raw.includes("arvoo.com")) {
    console.log("✓ arvoo.com found in __NEXT_DATA__!");
    const idx = raw.indexOf("arvoo.com");
    console.log("Context:", raw.slice(Math.max(0, idx - 100), idx + 100));
  }
} else {
  console.log("No __NEXT_DATA__ in raicore page");
}
