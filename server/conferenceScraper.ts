/**
 * Conference Exhibitor Scraper
 *
 * Fetches an exhibitor list page and extracts company names + website URLs.
 * Uses a multi-strategy approach:
 *   1. Logo-link pattern: <a href="..."><img alt="Company Name"/></a>
 *   2. Text-link pattern: <a href="https://...">Company Name</a>
 *   3. Grok fallback: send raw HTML to Grok and ask it to extract the list
 *
 * Returns an array of { name, websiteUrl } objects.
 */

import axios from "axios";

export interface ScrapedExhibitor {
  name: string;
  websiteUrl: string | null;
}

/**
 * Clean a URL: strip tracking params, normalise to https, remove trailing slashes.
 */
function cleanUrl(raw: string): string | null {
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
     "gclid", "msclkid", "fbclid", "cid", "redirectFromFleet"].forEach(p => url.searchParams.delete(p));
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Is this URL likely a company website (not a social media or map link)?
 */
function isCompanyWebsite(url: string): boolean {
  const lower = url.toLowerCase();
  const excluded = [
    "google.com", "maps.google", "goo.gl",
    "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "youtube.com",
    "policies.google.com", "recaptcha", "captcha",
    "conexpoconagg.com", "bauma.de", "ifat.de", "intermat.fr", "cemat.de",
  ];
  return !excluded.some(d => lower.includes(d));
}

/**
 * Strategy 1: Logo-link pattern.
 * Looks for <a href="..."><img alt="Company Name"/></a>
 */
function extractLogoLinks(html: string): ScrapedExhibitor[] {
  const results: ScrapedExhibitor[] = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const imgAltRegex = /<img[^>]+alt=["']([^"']{2,100})["'][^>]*>/i;

  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];
    const imgMatch = imgAltRegex.exec(inner);
    if (!imgMatch) continue;

    const name = imgMatch[1].trim();
    const url = cleanUrl(href);
    if (!url || !isCompanyWebsite(url)) continue;
    if (name.length < 2 || name.length > 120) continue;
    if (/^(home|contact|menu|search|register|login|sign in|privacy|cookie|terms)$/i.test(name)) continue;

    results.push({ name, websiteUrl: url });
  }

  return results;
}

/**
 * Strategy 2: Text-link pattern.
 * Looks for <a href="https://external.com">Company Name</a>
 */
function extractTextLinks(html: string, pageHost: string): ScrapedExhibitor[] {
  const results: ScrapedExhibitor[] = [];
  const anchorRegex = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]{2,100})<\/a>/gi;

  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim().replace(/\s+/g, " ");
    const url = cleanUrl(href);
    if (!url || !isCompanyWebsite(url)) continue;

    try {
      const linkHost = new URL(url).hostname.replace(/^www\./, "");
      if (linkHost === pageHost.replace(/^www\./, "")) continue;
    } catch { continue; }

    if (text.length < 2 || text.length > 100) continue;
    if (/^(home|contact|menu|search|register|login|sign in|privacy|cookie|terms|read more|click here|learn more|visit|website)$/i.test(text)) continue;

    results.push({ name: text, websiteUrl: url });
  }

  return results;
}

/**
 * Strategy 3: Grok fallback.
 */
async function extractWithGrok(html: string, pageUrl: string): Promise<ScrapedExhibitor[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.warn("[Conference Scraper] XAI_API_KEY not set, skipping Grok fallback");
    return [];
  }

  const truncated = html.slice(0, 30000);

  const prompt = `You are a data extraction assistant. I will give you the HTML of a conference exhibitor list page (${pageUrl}).

Your task: extract ALL company names and their website URLs from this page.

Return ONLY a JSON array of objects with this exact schema:
[{"name": "Company Name", "websiteUrl": "https://example.com"}, ...]

Rules:
- Include every company/exhibitor listed on the page
- If a company has no website link, set websiteUrl to null
- Do NOT include the conference organizer's own website
- Do NOT include social media links (LinkedIn, Twitter, Facebook, etc.)
- Company names should be clean (no extra whitespace, no HTML entities)
- Return ONLY the JSON array, no explanation

HTML:
${truncated}`;

  try {
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-3-fast-beta",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 8000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item.name && typeof item.name === "string")
      .map((item: any) => ({
        name: item.name.trim(),
        websiteUrl: item.websiteUrl ? cleanUrl(item.websiteUrl) : null,
      }));
  } catch (error: any) {
    console.error("[Conference Scraper] Grok fallback failed:", error.message);
    return [];
  }
}

/**
 * Deduplicate exhibitors by name (case-insensitive).
 */
function deduplicateByName(exhibitors: ScrapedExhibitor[]): ScrapedExhibitor[] {
  const seen = new Set<string>();
  return exhibitors.filter(e => {
    const key = e.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Main entry point: scrape exhibitors from a conference URL.
 */
export async function scrapeConferenceExhibitors(url: string): Promise<{
  exhibitors: ScrapedExhibitor[];
  strategy: string;
  pageTitle: string;
}> {
  console.log(`[Conference Scraper] Fetching: ${url}`);

  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SalesIntelligenceBot/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 30000,
    maxRedirects: 5,
  });

  const html: string = response.data;

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : url;
  const pageHost = new URL(url).hostname;

  console.log(`[Conference Scraper] Page fetched (${(html.length / 1024).toFixed(0)} KB). Trying strategies...`);

  // Strategy 1: Logo-link pattern
  let exhibitors = extractLogoLinks(html);
  let strategy = "logo-link";
  console.log(`[Conference Scraper] Strategy 1 (logo-link): ${exhibitors.length} companies`);

  // Strategy 2: Text-link pattern (if strategy 1 found fewer than 5)
  if (exhibitors.length < 5) {
    const textLinks = extractTextLinks(html, pageHost);
    console.log(`[Conference Scraper] Strategy 2 (text-link): ${textLinks.length} companies`);
    if (textLinks.length > exhibitors.length) {
      exhibitors = textLinks;
      strategy = "text-link";
    }
  }

  // Strategy 3: Grok fallback (if both strategies found fewer than 5)
  if (exhibitors.length < 5) {
    console.log(`[Conference Scraper] Strategy 3 (Grok): invoking AI extraction...`);
    const grokResults = await extractWithGrok(html, url);
    console.log(`[Conference Scraper] Strategy 3 (Grok): ${grokResults.length} companies`);
    if (grokResults.length > exhibitors.length) {
      exhibitors = grokResults;
      strategy = "grok";
    }
  }

  exhibitors = deduplicateByName(exhibitors);
  console.log(`[Conference Scraper] Final: ${exhibitors.length} unique companies (strategy: ${strategy})`);

  return { exhibitors, strategy, pageTitle };
}

/**
 * Look up a company in Apollo by domain to get Apollo ID + firmographic data.
 * Uses the organizations/enrich endpoint (1 credit per call).
 */
export async function apolloEnrichByDomain(domain: string): Promise<{
  apolloId?: string;
  name?: string;
  websiteUrl?: string;
  primaryDomain?: string;
  linkedinUrl?: string;
  phone?: string;
  foundedYear?: number;
  revenue?: string;
  headcountGrowth?: string;
  sicCodes?: string[];
  naicsCodes?: string[];
  city?: string;
  state?: string;
  country?: string;
  streetAddress?: string;
} | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY not set");

  try {
    const response = await axios.post(
      "https://api.apollo.io/api/v1/organizations/enrich",
      { domain },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const org = response.data.organization;
    if (!org) return null;

    const sixMonth = org.organization_headcount_six_month_growth;
    const twelveMonth = org.organization_headcount_twelve_month_growth;
    const growthStr = sixMonth != null || twelveMonth != null
      ? `6mo: ${sixMonth != null ? (sixMonth * 100).toFixed(1) + "%" : "N/A"} | 12mo: ${twelveMonth != null ? (twelveMonth * 100).toFixed(1) + "%" : "N/A"}`
      : null;

    return {
      apolloId: org.id,
      name: org.name,
      websiteUrl: org.website_url,
      primaryDomain: org.primary_domain,
      linkedinUrl: org.linkedin_url,
      phone: org.phone || org.primary_phone?.number,
      foundedYear: org.founded_year,
      revenue: org.organization_revenue_printed,
      headcountGrowth: growthStr || undefined,
      sicCodes: org.sic_codes || [],
      naicsCodes: org.naics_codes || [],
      city: org.city,
      state: org.state,
      country: org.country,
      streetAddress: org.street_address,
    };
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 422) {
      return null;
    }
    console.warn(`[Apollo Enrich] Failed for domain ${domain}:`, error.message);
    return null;
  }
}
