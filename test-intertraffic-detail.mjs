import axios from "axios";

// Fetch the exhibitor detail page
const r = await axios.get("https://www.intertraffic.com/amsterdam/exhibitors/3m-deutschland-gmbh", {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
  timeout: 20000,
});

const html = r.data;

// Extract all external links
const linkMatches = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)];
const externalLinks = linkMatches
  .map(m => m[1])
  .filter(l => !l.includes("intertraffic.com") && !l.includes("localhost"));

console.log("External links found:", externalLinks.length);
externalLinks.slice(0, 20).forEach(l => console.log(" ", l));

// Check __NEXT_DATA__ for website field
const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (nextDataMatch) {
  const data = JSON.parse(nextDataMatch[1]);
  const raw = JSON.stringify(data);
  
  // Look for website-related fields
  const websiteMatches = [...raw.matchAll(/"website[^"]*"\s*:\s*"([^"]+)"/gi)];
  console.log("\nWebsite fields in __NEXT_DATA__:");
  websiteMatches.slice(0, 10).forEach(m => console.log(" ", m[0]));
  
  // Look for any .com domain that looks like a company website
  const domainMatches = [...raw.matchAll(/"(https?:\/\/(?!.*intertraffic|.*stpsprod|.*localhost)[a-z0-9.-]+\.[a-z]{2,}[^"]*)"/gi)];
  console.log("\nExternal domains in __NEXT_DATA__:");
  domainMatches.slice(0, 15).forEach(m => console.log(" ", m[1]));
}
