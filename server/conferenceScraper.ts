/**
 * Conference Exhibitor Scraper — Robust Pipeline
 *
 * Fetch layer (per page, in order):
 *   1. axios fast fetch — works for static/SSR pages (~80% of sites)
 *   2. Puppeteer headless browser — for JS-rendered SPAs (React/Vue/Angular)
 *      - waits for networkidle2 so dynamic content is fully loaded
 *   3. Puppeteer + "Load More" interaction — for infinite-scroll / button-paginated SPAs
 *      - clicks every visible "Load More" / "Show More" / "Next" button until none remain
 *
 * Extraction layer (per fetched HTML, in order):
 *   1. Logo-link  — <a href="..."><img alt="Company Name"/></a>
 *   2. Text-link  — <a href="https://external.com">Company Name</a>
 *   3. Grok AI    — send rendered HTML to Grok, ask it to extract the list
 *
 * Pagination (multi-page):
 *   Detects rel=next, "Next" anchors, ›/»/>> chevrons, ?page=N, /page/N
 *   Crawls up to MAX_PAGES pages, deduplicates across all pages.
 *
 * Hardening:
 *   - 3 retries with exponential backoff on network errors
 *   - Normalized company name dedup (strips Inc./Ltd./GmbH/B.V. etc.)
 *   - Domain normalization before Apollo (strips www., paths, query params)
 *   - Single Puppeteer browser instance reused across all pages
 *   - Streams fetch-method events to the caller for frontend display
 */

import axios from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedExhibitor {
  name: string;
  websiteUrl: string | null;
  countryCode?: string | null;  // ISO-2 country code, populated from __NEXT_DATA__ sources
}

export interface ScrapeResult {
  exhibitors: ScrapedExhibitor[];
  strategy: string;
  fetchMethod: string;   // "axios" | "puppeteer" | "puppeteer-loadmore"
  pageTitle: string;
  pagesScraped: number;
}

/** Progress callback so the route can stream page-by-page updates. */
export type ScrapeProgressCallback = (msg: {
  page: number;
  totalPages: number | null;
  found: number;
  message: string;
  fetchMethod?: string;
}) => void;

const MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 30_000;
const PUPPETEER_TIMEOUT_MS = 45_000;
const RETRY_ATTEMPTS = 3;

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
 * Extract the root domain from a URL for Apollo enrichment.
 * e.g. "https://www.caterpillar.com/en/products" → "caterpillar.com"
 */
export function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Is this URL likely a company website (not a social media or map link)?
 */
function isCompanyWebsite(url: string, pageHost: string): boolean {
  const lower = url.toLowerCase();
  const excluded = [
    "google.com", "maps.google", "goo.gl",
    "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
    "youtube.com", "tiktok.com", "pinterest.com", "xing.com",
    "policies.google.com", "recaptcha", "captcha",
    // Known conference organiser domains
    "conexpoconagg.com", "bauma.de", "ifat.de", "intermat.fr", "cemat.de",
    "hannovermesse.de", "messe-muenchen.de", "messe-frankfurt.de",
    "messe-berlin.de", "koelnmesse.de", "messe-duesseldorf.de",
    "messe-stuttgart.de", "messe-essen.de", "messe-nuernberg.de",
  ];
  if (excluded.some(d => lower.includes(d))) return false;
  // Also exclude same-host links
  try {
    const linkHost = new URL(url).hostname.replace(/^www\./, "");
    const ph = pageHost.replace(/^www\./, "");
    if (linkHost === ph) return false;
  } catch { return false; }
  return true;
}

// ---------------------------------------------------------------------------
// Normalise company name for deduplication
// ---------------------------------------------------------------------------

const LEGAL_SUFFIX_RE = /[\s,]+(?:inc\.?|llc\.?|ltd\.?|limited|corp\.?|corporation|co\.?|gmbh|b\.v\.|bv|ag|nv|sa|s\.a\.|plc|pty\.?|pvt\.?|srl|s\.r\.l\.|oy|ab|as|a\/s|kg|kgaa|ohg|gbr|se|spa|s\.p\.a\.)\.?$/i;

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(LEGAL_SUFFIX_RE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Extraction strategies (single page)
// ---------------------------------------------------------------------------

/**
 * Strategy 0: __NEXT_DATA__ JSON extractor.
 *
 * Many modern conference sites (Next.js / Nuxt / similar SSR frameworks) embed
 * their full data payload inside a <script id="__NEXT_DATA__"> tag as JSON.
 * This strategy parses that blob and recursively searches for arrays of objects
 * that look like exhibitor lists (objects with a `name` field and optionally
 * `website`, `url`, `websiteUrl`, `slug`, `countryCode` fields).
 *
 * Returns exhibitors with countryCode when available (used for Apollo name-based enrichment).
 */
function extractNextData(html: string): ScrapedExhibitor[] {
  // Find __NEXT_DATA__ script tag
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
    || html.match(/<script[^>]+type=["']application\/json["'][^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);

  if (!nextDataMatch) return [];

  let data: any;
  try {
    data = JSON.parse(nextDataMatch[1]);
  } catch {
    return [];
  }

  // Recursively search for exhibitor arrays in the JSON tree
  const results: ScrapedExhibitor[] = [];
  const seen = new Set<string>();

  function searchNode(node: any, depth = 0): void {
    if (depth > 15 || !node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      // Check if this looks like an exhibitor list:
      // - Array of objects
      // - Each object has a `name` field
      // - At least 3 items
      if (node.length >= 3 && node[0] && typeof node[0] === "object" && typeof node[0].name === "string") {
        const sample = node.slice(0, 5);
        const hasNameField = sample.every((item: any) => typeof item.name === "string" && item.name.length > 1);

        if (hasNameField) {
          // Score this array: higher score = more likely to be exhibitors
          const hasSlug = sample.some((item: any) => item.slug);
          const hasCountry = sample.some((item: any) => item.countryCode || item.country_code || item.country);
          const hasWebsite = sample.some((item: any) => item.website || item.websiteUrl || item.url || item.website_url);
          const hasStand = sample.some((item: any) => item.stands || item.stand || item.booth || item.hall);

          // Must have at least one of: slug, country, website, stand
          if (hasSlug || hasCountry || hasWebsite || hasStand) {
            for (const item of node) {
              if (!item || typeof item.name !== "string") continue;
              const name = item.name.trim();
              if (!name || name.length < 2 || name.length > 150) continue;

              // Skip obvious non-company entries
              if (/^(home|contact|menu|search|register|login|privacy|cookie|terms|floor plan|register your visit)$/i.test(name)) continue;

              const key = normaliseName(name);
              if (!key || seen.has(key)) continue;
              seen.add(key);

              // Extract website URL if available
              const rawUrl = item.website || item.websiteUrl || item.url || item.website_url || null;
              const websiteUrl = rawUrl ? cleanUrl(rawUrl) : null;

              // Extract country code
              const countryCode = item.countryCode || item.country_code || item.country || null;

              results.push({ name, websiteUrl, countryCode });
            }

            // If we found a good list, don't recurse into its items
            if (results.length > 0) return;
          }
        }
      }

      // Recurse into array items
      for (const item of node) {
        searchNode(item, depth + 1);
      }
    } else {
      // Recurse into object values
      for (const value of Object.values(node)) {
        searchNode(value, depth + 1);
      }
    }
  }

  searchNode(data);
  return results;
}

/**
 * Strategy 1: Logo-link pattern.
 * Looks for <a href="..."><img alt="Company Name"/></a>
 */
function extractLogoLinks(html: string, pageHost: string): ScrapedExhibitor[] {
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
    if (!url || !isCompanyWebsite(url, pageHost)) continue;
    if (name.length < 2 || name.length > 120) continue;
    if (/^(home|contact|menu|search|register|login|sign in|privacy|cookie|terms|logo|banner)$/i.test(name)) continue;

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
    if (!url || !isCompanyWebsite(url, pageHost)) continue;

    if (text.length < 2 || text.length > 100) continue;
    if (/^(home|contact|menu|search|register|login|sign in|privacy|cookie|terms|read more|click here|learn more|visit|website|more info|details|view|see more)$/i.test(text)) continue;

    results.push({ name: text, websiteUrl: url });
  }

  return results;
}

/**
 * Strategy 3: Grok AI fallback.
 * Sends the rendered HTML to Grok and asks it to extract company names + websites.
 */
async function extractWithGrok(html: string, pageUrl: string): Promise<ScrapedExhibitor[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.warn("[Conference Scraper] XAI_API_KEY not set, skipping Grok fallback");
    return [];
  }

  // Truncate to 30k chars to stay within token limits
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
// Extraction dispatcher (tries all strategies on a given HTML string)
// ---------------------------------------------------------------------------

async function extractFromHtml(html: string, pageUrl: string): Promise<{
  exhibitors: ScrapedExhibitor[];
  strategy: string;
}> {
  const pageHost = new URL(pageUrl).hostname;

  // Strategy 0: __NEXT_DATA__ JSON extractor (Next.js / Nuxt SSR sites)
  const nextDataResults = extractNextData(html);
  if (nextDataResults.length >= 3) {
    console.log(`[Conference Scraper] __NEXT_DATA__ strategy found ${nextDataResults.length} companies`);
    return { exhibitors: nextDataResults, strategy: "next-data" };
  }

  // Strategy 1: Logo-link
  let exhibitors = extractLogoLinks(html, pageHost);
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
// Deduplication (normalised name matching)
// ---------------------------------------------------------------------------

function deduplicateExhibitors(exhibitors: ScrapedExhibitor[]): ScrapedExhibitor[] {
  const seen = new Set<string>();
  return exhibitors.filter(e => {
    const key = normaliseName(e.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Fetch layer 1: axios (fast, for static/SSR pages)
// ---------------------------------------------------------------------------

async function fetchWithAxios(url: string, attempt = 1): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      timeout: FETCH_TIMEOUT_MS,
      maxRedirects: 10,
    });
    return response.data as string;
  } catch (err: any) {
    if (attempt < RETRY_ATTEMPTS && isRetryableError(err)) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`[Conference Scraper] axios fetch attempt ${attempt} failed (${err.message}), retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchWithAxios(url, attempt + 1);
    }
    throw err;
  }
}

function isRetryableError(err: any): boolean {
  if (!err.response) return true; // network error, timeout
  const status = err.response.status;
  return status === 429 || status === 503 || status === 502 || status === 504;
}

// ---------------------------------------------------------------------------
// Fetch layer 2: Puppeteer headless browser (for JS-rendered SPAs)
// ---------------------------------------------------------------------------

let _puppeteerBrowser: any = null;

async function getPuppeteerBrowser(): Promise<any> {
  if (_puppeteerBrowser) {
    try {
      // Check if still alive
      const pages = await _puppeteerBrowser.pages();
      if (pages) return _puppeteerBrowser;
    } catch {
      _puppeteerBrowser = null;
    }
  }

  const puppeteer = await import("puppeteer-core");
  _puppeteerBrowser = await puppeteer.default.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  console.log("[Conference Scraper] Puppeteer browser launched");
  return _puppeteerBrowser;
}

export async function closePuppeteerBrowser(): Promise<void> {
  if (_puppeteerBrowser) {
    try { await _puppeteerBrowser.close(); } catch {}
    _puppeteerBrowser = null;
    console.log("[Conference Scraper] Puppeteer browser closed");
  }
}

/**
 * Fetch a page using Puppeteer, waiting for network idle so JS content renders.
 */
async function fetchWithPuppeteer(url: string): Promise<{ html: string; title: string }> {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();

  try {
    // Block images, fonts, media to speed up rendering
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const rt = req.resourceType();
      if (["image", "font", "media", "stylesheet"].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PUPPETEER_TIMEOUT_MS,
    });

    // Extra wait for late-rendering SPAs
    await sleep(2000);

    const html = await page.content();
    const title = await page.title();
    return { html, title };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Fetch a page using Puppeteer and click "Load More" / "Show More" buttons
 * until none remain or no new content appears.
 * Used for infinite-scroll / button-paginated SPAs.
 */
async function fetchWithPuppeteerLoadMore(url: string): Promise<{ html: string; title: string }> {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const rt = req.resourceType();
      if (["image", "font", "media"].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PUPPETEER_TIMEOUT_MS,
    });

    await sleep(2000);

    // Click "Load More" / "Show More" / "Mehr anzeigen" buttons up to 30 times
    const LOAD_MORE_SELECTORS = [
      'button:contains("Load More")',
      'button:contains("Show More")',
      'button:contains("Mehr anzeigen")',
      'button:contains("Voir plus")',
      'a:contains("Load More")',
      'a:contains("Show More")',
      '[data-testid*="load-more"]',
      '[class*="load-more"]',
      '[class*="loadmore"]',
      '[class*="show-more"]',
      '[class*="showmore"]',
    ];

    let clickCount = 0;
    const MAX_CLICKS = 30;

    while (clickCount < MAX_CLICKS) {
      // Try each selector
      let clicked = false;
      for (const sel of LOAD_MORE_SELECTORS) {
        try {
          // Use evaluate to find and click (avoids selector syntax issues)
          const found = await page.evaluate((text: string) => {
            const buttons = Array.from(document.querySelectorAll("button, a"));
            const btn = buttons.find(b => {
              const t = b.textContent?.trim().toLowerCase() || "";
              return t === text.toLowerCase() || t.startsWith(text.toLowerCase());
            }) as HTMLElement | undefined;
            if (btn && btn.offsetParent !== null) {
              btn.click();
              return true;
            }
            return false;
          }, sel.replace(/.*:contains\("(.+)"\)/, "$1"));

          if (found) {
            clicked = true;
            clickCount++;
            await sleep(1500); // wait for new content to load
            break;
          }
        } catch {}
      }

      if (!clicked) break;
    }

    if (clickCount > 0) {
      console.log(`[Conference Scraper] Clicked "Load More" ${clickCount} time(s)`);
      await sleep(1000);
    }

    const html = await page.content();
    const title = await page.title();
    return { html, title };
  } finally {
    await page.close().catch(() => {});
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

  // B. "Next" anchor text (inline regex)
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

  // Also check <a ...>Next</a> robustly
  const anchorRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    if (/^(next|›|»|>>|→|next page|weiter|suivant|siguiente|volgende|nächste)$/i.test(inner)) {
      try {
        const resolved = new URL(href, currentUrl);
        if (resolved.hostname === baseHost) return resolved.toString();
      } catch {}
    }
  }

  // C. Numbered page links — find the smallest page number > currentPage
  const pageUrlCandidates: { page: number; url: string }[] = [];

  const queryPageRegex = /href=["']([^"']+[?&](?:page|p|pg|pagenum)=(\d+)[^"']*)["']/gi;
  while ((m = queryPageRegex.exec(html)) !== null) {
    const n = parseInt(m[2], 10);
    if (n > currentPage) {
      try {
        pageUrlCandidates.push({ page: n, url: new URL(m[1], currentUrl).toString() });
      } catch {}
    }
  }

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

  // D. Query-param increment
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

  // E. Path-segment increment
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
 */
export function detectTotalPages(html: string, currentUrl: string): number | null {
  let maxPage = 1;

  const queryPageRegex = /href=["'][^"']*[?&](?:page|p|pg|pagenum)=(\d+)[^"']*["']/gi;
  let m: RegExpExecArray | null;
  while ((m = queryPageRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }

  const pathPageRegex = /href=["'][^"']*\/(?:page|p)\/(\d+)[^"']*["']/gi;
  while ((m = pathPageRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }

  const ofPagesMatch = html.match(/(?:of|\/)\s*(\d+)\s*(?:pages?|pg)/i);
  if (ofPagesMatch) {
    const n = parseInt(ofPagesMatch[1], 10);
    if (n > maxPage) maxPage = n;
  }

  return maxPage > 1 ? maxPage : null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Scrape exhibitors from a conference URL, following pagination automatically.
 * Uses a 3-layer fetch pipeline: axios → Puppeteer → Puppeteer+LoadMore
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
  let pagesWithContent = 0;
  let dominantStrategy = "logo-link";
  let dominantFetchMethod = "axios";
  let pageTitle = url;
  let totalPages: number | null = null;

  while (currentUrl && pageNum <= maxPages) {
    const normUrl = currentUrl.replace(/\/$/, "");
    if (visitedUrls.has(normUrl)) {
      console.log(`[Conference Scraper] Already visited ${normUrl}, stopping`);
      break;
    }
    visitedUrls.add(normUrl);

    console.log(`[Conference Scraper] Fetching page ${pageNum}: ${currentUrl}`);

    let html: string;
    let fetchedTitle: string | null = null;
    let fetchMethod = "axios";

    // ── Layer 1: axios ──────────────────────────────────────────────────────
    let axiosHtml: string | null = null;
    try {
      axiosHtml = await fetchWithAxios(currentUrl);
    } catch (err: any) {
      console.warn(`[Conference Scraper] axios failed: ${err.message}`);
    }

    if (axiosHtml) {
      // Quick check: does the axios HTML have enough content to be useful?
      const { exhibitors: quickCheck } = await extractFromHtml(axiosHtml, currentUrl);
      if (quickCheck.length >= 5) {
        html = axiosHtml;
        fetchMethod = "axios";
      } else {
        // ── Layer 2: Puppeteer (networkidle2) ─────────────────────────────
        console.log(`[Conference Scraper] axios yielded only ${quickCheck.length} companies, trying Puppeteer...`);
        onProgress?.({
          page: pagesWithContent + 1,
          totalPages,
          found: allExhibitors.length,
          message: `Page ${pagesWithContent + 1}: using headless browser (JS-rendered page detected)...`,
          fetchMethod: "puppeteer",
        });

        try {
          const result = await fetchWithPuppeteer(currentUrl);
          html = result.html;
          fetchedTitle = result.title;
          fetchMethod = "puppeteer";

          // Check if Puppeteer helped
          const { exhibitors: puppeteerCheck } = await extractFromHtml(html, currentUrl);
          if (puppeteerCheck.length < 5) {
            // ── Layer 3: Puppeteer + Load More ─────────────────────────────
            console.log(`[Conference Scraper] Puppeteer yielded only ${puppeteerCheck.length}, trying Load More...`);
            onProgress?.({
              page: pagesWithContent + 1,
              totalPages,
              found: allExhibitors.length,
              message: `Page ${pagesWithContent + 1}: clicking "Load More" buttons...`,
              fetchMethod: "puppeteer-loadmore",
            });

            try {
              const lmResult = await fetchWithPuppeteerLoadMore(currentUrl);
              html = lmResult.html;
              fetchedTitle = lmResult.title;
              fetchMethod = "puppeteer-loadmore";
            } catch (lmErr: any) {
              console.warn(`[Conference Scraper] Load More failed: ${lmErr.message}`);
              // Keep the Puppeteer result
            }
          }
        } catch (puppeteerErr: any) {
          console.warn(`[Conference Scraper] Puppeteer failed: ${puppeteerErr.message}`);
          // Fall back to the axios HTML we already have
          html = axiosHtml;
          fetchMethod = "axios";
        }
      }
    } else {
      // axios completely failed — go straight to Puppeteer
      console.log(`[Conference Scraper] axios failed entirely, trying Puppeteer...`);
      onProgress?.({
        page: pagesWithContent + 1,
        totalPages,
        found: allExhibitors.length,
        message: `Page ${pagesWithContent + 1}: using headless browser (page blocked axios)...`,
        fetchMethod: "puppeteer",
      });

      try {
        const result = await fetchWithPuppeteer(currentUrl);
        html = result.html;
        fetchedTitle = result.title;
        fetchMethod = "puppeteer";
      } catch (puppeteerErr: any) {
        console.error(`[Conference Scraper] All fetch methods failed for page ${pageNum}: ${puppeteerErr.message}`);
        break;
      }
    }

    // Extract page title from first page
    if (pageNum === 1) {
      if (fetchedTitle) {
        pageTitle = fetchedTitle;
      } else {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        pageTitle = titleMatch ? titleMatch[1].trim() : url;
      }
    }

    // Detect total pages from first page
    if (pageNum === 1) {
      totalPages = detectTotalPages(html, currentUrl);
      if (totalPages) {
        console.log(`[Conference Scraper] Detected ${totalPages} total pages`);
      }
    }

    const { exhibitors, strategy } = await extractFromHtml(html, currentUrl);
    console.log(`[Conference Scraper] Page ${pageNum}: ${exhibitors.length} companies (strategy: ${strategy}, fetch: ${fetchMethod})`);

    if (pageNum === 1) {
      dominantStrategy = strategy;
      dominantFetchMethod = fetchMethod;
    }

    // Stop if this page found 0 companies (past the end)
    if (exhibitors.length === 0 && pageNum > 1) {
      console.log(`[Conference Scraper] Page ${pageNum} returned 0 companies, stopping`);
      break;
    }

    pagesWithContent++;
    allExhibitors.push(...exhibitors);

    onProgress?.({
      page: pagesWithContent,
      totalPages,
      found: allExhibitors.length,
      message: `Page ${pagesWithContent}${totalPages ? ` of ${totalPages}` : ""}: ${exhibitors.length} exhibitors found (${allExhibitors.length} total, via ${fetchMethod})`,
      fetchMethod,
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
    await sleep(fetchMethod === "axios" ? 500 : 1000);
  }

  // Close Puppeteer browser if it was used (free resources)
  if (dominantFetchMethod !== "axios") {
    await closePuppeteerBrowser();
  }

  const unique = deduplicateExhibitors(allExhibitors);
  console.log(`[Conference Scraper] Done: ${unique.length} unique companies across ${pagesWithContent} page(s) (fetch: ${dominantFetchMethod})`);

  return {
    exhibitors: unique,
    strategy: dominantStrategy,
    fetchMethod: dominantFetchMethod,
    pageTitle,
    pagesScraped: pagesWithContent,
  };
}

// ---------------------------------------------------------------------------
// Apollo enrichment
// ---------------------------------------------------------------------------

/**
 * Look up a company in Apollo by name + optional country code.
 * Uses the organizations/enrich endpoint with name-based lookup.
 * Less precise than domain lookup but works when no website URL is available.
 * Returns null if not found or ambiguous.
 */
export async function apolloEnrichByName(name: string, countryCode?: string | null): Promise<{
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
    const body: Record<string, string> = { name };
    if (countryCode && countryCode.length === 2) {
      body.organization_country_code = countryCode.toUpperCase();
    }

    const response = await axios.post(
      "https://api.apollo.io/api/v1/organizations/enrich",
      body,
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
    console.warn(`[Apollo Enrich] Failed for name "${name}":`, error.message);
    return null;
  }
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
