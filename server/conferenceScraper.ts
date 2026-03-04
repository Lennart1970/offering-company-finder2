/**
 * Conference Exhibitor Scraper
 *
 * Fetches an exhibitor list page (and all subsequent pages) and extracts
 * company names + website URLs.
 *
 * Extraction strategies per page:
 *   1. Logo-link pattern: <a href="..."><img alt="Company Name"/></a>
 *   2. Text-link pattern: <a href="https://...">Company Name</a>
 *   3. Grok fallback: send raw HTML to Grok and ask it to extract the list
 *
 * Pagination detection:
 *   A. Query-param pages  (?page=N, ?p=N, ?pg=N, ?pagenum=N, ?start=N)
 *   B. Path-segment pages (/page/N, /p/N, /exhibitors/N)
 *   C. "Next" anchor links (<a>Next</a>, <a>›</a>, <a>>></a>, rel="next")
 *   D. Numbered page links (same-host anchors containing /page/2, ?page=2, etc.)
 *   E. Grok AI fallback to detect non-standard pagination
 *
 * Returns an array of { name, websiteUrl } objects deduplicated across all pages.
 */

import axios from "axios";

export interface ScrapedExhibitor {
  name: string;
  websiteUrl: string | null;
}

export interface ScrapeResult {
  exhibitors: ScrapedExhibitor[];
  strategy: string;
  pageTitle: string;
  pagesScraped: number;
}

/** Progress callback so the route can stream page-by-page updates. */
export type ScrapeProgressCallback = (msg: {
  page: number;
  totalPages: number | null;
  found: number;
  message: string;
}) => void;

const MAX_PAGES = 20;

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

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
    // Known conference organiser domains — add more as needed
    "conexpoconagg.com", "bauma.de", "ifat.de", "intermat.fr", "cemat.de",
    "hannovermesse.de", "messe-muenchen.de", "messe-frankfurt.de",
  ];
  return !excluded.some(d => lower.includes(d));
}

// ---------------------------------------------------------------------------
// Extraction strategies (single page)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pagination detection
// ---------------------------------------------------------------------------

/**
 * Detect the "next page" URL from an HTML page.
 *
 * Strategies (in priority order):
 *   A. rel="next" link element
 *   B. Anchor with text Next / › / >> / → / »
 *   C. Numbered page links: same-host href containing ?page=N or /page/N
 *      where N > currentPage
 *   D. Query-param increment: if current URL has ?page=N, try ?page=N+1
 *   E. Path-segment increment: if current URL has /page/N, try /page/N+1
 */
export function detectNextPageUrl(
  html: string,
  currentUrl: string,
  currentPage: number
): string | null {
  const base = new URL(currentUrl);
  const baseHost = base.hostname;

  // A. rel="next"
  const relNextMatch = html.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']next["']/i);
  if (relNextMatch) {
    try {
      return new URL(relNextMatch[1], currentUrl).toString();
    } catch {}
  }

  // B. "Next" anchor text
  const nextTextPatterns = [
    /href=["']([^"']+)["'][^>]*>\s*(?:next|›|»|>>|→|&rsaquo;|&raquo;|&#8250;|&#187;)\s*</i,
    />\s*(?:next|›|»|>>|→|&rsaquo;|&raquo;|&#8250;|&#187;)\s*<\/a[^>]*>.*?href=["']([^"']+)["']/i,
  ];
  for (const pat of nextTextPatterns) {
    const m = html.match(pat);
    if (m) {
      const href = m[1] || m[2];
      if (href) {
        try {
          const resolved = new URL(href, currentUrl);
          if (resolved.hostname === baseHost) return resolved.toString();
        } catch {}
      }
    }
  }

  // Also check <a ...>Next</a> in a more robust way
  const anchorRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    if (/^(next|›|»|>>|→|next page)$/i.test(inner)) {
      try {
        const resolved = new URL(href, currentUrl);
        if (resolved.hostname === baseHost) return resolved.toString();
      } catch {}
    }
  }

  // C. Numbered page links — find the smallest page number > currentPage
  const pageUrlCandidates: { page: number; url: string }[] = [];

  // Pattern: href contains ?page=N or &page=N
  const queryPageRegex = /href=["']([^"']+[?&](?:page|p|pg|pagenum)=(\d+)[^"']*)["']/gi;
  while ((m = queryPageRegex.exec(html)) !== null) {
    const n = parseInt(m[2], 10);
    if (n > currentPage) {
      try {
        pageUrlCandidates.push({ page: n, url: new URL(m[1], currentUrl).toString() });
      } catch {}
    }
  }

  // Pattern: href contains /page/N or /p/N
  const pathPageRegex = /href=["']([^"']*\/(?:page|p)\/(\d+)[^"']*)["']/gi;
  while ((m = pathPageRegex.exec(html)) !== null) {
    const n = parseInt(m[2], 10);
    if (n > currentPage) {
      try {
        pageUrlCandidates.push({ page: n, url: new URL(m[1], currentUrl).toString() });
      } catch {}
    }
  }

  if (pageUrlCandidates.length > 0) {
    pageUrlCandidates.sort((a, b) => a.page - b.page);
    const next = pageUrlCandidates.find(c => c.page === currentPage + 1) || pageUrlCandidates[0];
    return next.url;
  }

  // D. Query-param increment: ?page=N → ?page=N+1
  const pageParam = base.searchParams.get("page") || base.searchParams.get("p") ||
    base.searchParams.get("pg") || base.searchParams.get("pagenum");
  if (pageParam) {
    const n = parseInt(pageParam, 10);
    if (!isNaN(n)) {
      const next = new URL(currentUrl);
      const paramName = base.searchParams.has("page") ? "page"
        : base.searchParams.has("p") ? "p"
        : base.searchParams.has("pg") ? "pg"
        : "pagenum";
      next.searchParams.set(paramName, String(n + 1));
      return next.toString();
    }
  }

  // E. Path-segment increment: /page/N → /page/N+1
  const pathPageMatch = base.pathname.match(/^(.*\/(?:page|p)\/)(\d+)(\/.*)?$/);
  if (pathPageMatch) {
    const n = parseInt(pathPageMatch[2], 10);
    if (!isNaN(n)) {
      const next = new URL(currentUrl);
      next.pathname = `${pathPageMatch[1]}${n + 1}${pathPageMatch[3] || ""}`;
      return next.toString();
    }
  }

  return null;
}

/**
 * Count total pages from HTML (best-effort).
 * Looks for the highest page number in pagination links.
 */
export function detectTotalPages(html: string, currentUrl: string): number | null {
  const base = new URL(currentUrl);
  const baseHost = base.hostname;

  let maxPage = 1;

  // Query-param page numbers
  const queryPageRegex = /href=["'][^"']*[?&](?:page|p|pg|pagenum)=(\d+)[^"']*["']/gi;
  let m: RegExpExecArray | null;
  while ((m = queryPageRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }

  // Path-segment page numbers
  const pathPageRegex = /href=["'][^"']*\/(?:page|p)\/(\d+)[^"']*["']/gi;
  while ((m = pathPageRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }

  // Explicit "of N pages" text
  const ofPagesMatch = html.match(/(?:of|\/)\s*(\d+)\s*(?:pages?|pg)/i);
  if (ofPagesMatch) {
    const n = parseInt(ofPagesMatch[1], 10);
    if (n > maxPage) maxPage = n;
  }

  return maxPage > 1 ? maxPage : null;
}

// ---------------------------------------------------------------------------
// Single-page extraction (tries all 3 strategies)
// ---------------------------------------------------------------------------

async function extractFromPage(html: string, pageUrl: string): Promise<{
  exhibitors: ScrapedExhibitor[];
  strategy: string;
}> {
  const pageHost = new URL(pageUrl).hostname;

  // Strategy 1: Logo-link
  let exhibitors = extractLogoLinks(html);
  let strategy = "logo-link";

  // Strategy 2: Text-link (if strategy 1 found fewer than 5)
  if (exhibitors.length < 5) {
    const textLinks = extractTextLinks(html, pageHost);
    if (textLinks.length > exhibitors.length) {
      exhibitors = textLinks;
      strategy = "text-link";
    }
  }

  // Strategy 3: Grok fallback (if both found fewer than 5)
  if (exhibitors.length < 5) {
    const grokResults = await extractWithGrok(html, pageUrl);
    if (grokResults.length > exhibitors.length) {
      exhibitors = grokResults;
      strategy = "grok";
    }
  }

  return { exhibitors, strategy };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicateByName(exhibitors: ScrapedExhibitor[]): ScrapedExhibitor[] {
  const seen = new Set<string>();
  return exhibitors.filter(e => {
    const key = e.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// HTTP fetch helper
// ---------------------------------------------------------------------------

async function fetchPage(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SalesIntelligenceBot/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 30000,
    maxRedirects: 5,
  });
  return response.data as string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Scrape exhibitors from a conference URL, following pagination automatically.
 *
 * @param url         Starting URL (exhibitor list page)
 * @param onProgress  Optional callback called after each page is scraped
 * @param maxPages    Maximum pages to crawl (default: 20)
 */
export async function scrapeConferenceExhibitors(
  url: string,
  onProgress?: ScrapeProgressCallback,
  maxPages = MAX_PAGES
): Promise<ScrapeResult> {
  console.log(`[Conference Scraper] Starting multi-page scrape: ${url}`);

  const allExhibitors: ScrapedExhibitor[] = [];
  const visitedUrls = new Set<string>();
  let currentUrl: string | null = url;
  let pageNum = 1;
  let pagesWithContent = 0; // pages that actually returned ≥1 company
  let dominantStrategy = "logo-link";
  let pageTitle = url;
  let totalPages: number | null = null;

  while (currentUrl && pageNum <= maxPages) {
    // Normalise URL to avoid revisiting the same page with trailing slash differences
    const normUrl = currentUrl.replace(/\/$/, "");
    if (visitedUrls.has(normUrl)) {
      console.log(`[Conference Scraper] Already visited ${normUrl}, stopping pagination`);
      break;
    }
    visitedUrls.add(normUrl);

    console.log(`[Conference Scraper] Fetching page ${pageNum}: ${currentUrl}`);

    let html: string;
    try {
      html = await fetchPage(currentUrl);
    } catch (err: any) {
      console.warn(`[Conference Scraper] Failed to fetch page ${pageNum}: ${err.message}`);
      break;
    }

    // Extract page title from first page only
    if (pageNum === 1) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      pageTitle = titleMatch ? titleMatch[1].trim() : url;
    }

    // Detect total pages from first page
    if (pageNum === 1) {
      totalPages = detectTotalPages(html, currentUrl);
      if (totalPages) {
        console.log(`[Conference Scraper] Detected ${totalPages} total pages`);
      }
    }

    const { exhibitors, strategy } = await extractFromPage(html, currentUrl);
    console.log(`[Conference Scraper] Page ${pageNum}: ${exhibitors.length} companies (strategy: ${strategy})`);

    if (pageNum === 1) dominantStrategy = strategy;

    // If this page found 0 companies and it's not the first page, stop — likely past the end
    if (exhibitors.length === 0 && pageNum > 1) {
      console.log(`[Conference Scraper] Page ${pageNum} returned 0 companies, stopping pagination`);
      break;
    }

    pagesWithContent++;
    allExhibitors.push(...exhibitors);

    onProgress?.({
      page: pagesWithContent,
      totalPages,
      found: allExhibitors.length,
      message: `Page ${pagesWithContent}${totalPages ? ` of ${totalPages}` : ""}: found ${exhibitors.length} exhibitors (${allExhibitors.length} total so far)`,
    });

    // Detect next page
    const nextUrl = detectNextPageUrl(html, currentUrl, pageNum);
    if (!nextUrl || nextUrl === currentUrl) {
      console.log(`[Conference Scraper] No next page detected after page ${pageNum}`);
      break;
    }

    currentUrl = nextUrl;
    pageNum++;

    // Polite delay between pages
    await new Promise(r => setTimeout(r, 500));
  }

  const unique = deduplicateByName(allExhibitors);
  console.log(`[Conference Scraper] Done: ${unique.length} unique companies across ${pagesWithContent} page(s)`);

  return {
    exhibitors: unique,
    strategy: dominantStrategy,
    pageTitle,
    pagesScraped: pagesWithContent,
  };
}

// ---------------------------------------------------------------------------
// Apollo enrichment
// ---------------------------------------------------------------------------

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
