import { ENV } from "./_core/env";

export interface SerperImage {
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  source: string;
  domain: string;
  link: string;
}

/**
 * Domains to exclude — e-commerce/retail/social/stock-photo sites that
 * produce irrelevant or misleading product images.
 */
const BLOCKED_DOMAINS = new Set([
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.nl",
  "amazon.es", "amazon.it", "amazon.ca", "amazon.com.au",
  "ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr", "ebay.nl",
  "alibaba.com", "aliexpress.com", "dhgate.com", "made-in-china.com",
  "walmart.com", "target.com", "bestbuy.com", "newegg.com",
  "etsy.com", "wish.com", "temu.com", "shein.com",
  "pinterest.com", "instagram.com", "facebook.com", "twitter.com",
  "shutterstock.com", "gettyimages.com", "istockphoto.com", "dreamstime.com",
  "alamy.com", "depositphotos.com", "123rf.com",
  "google.com", "bing.com", "yahoo.com",
  "wikipedia.org", "wikimedia.org",
]);

function isDomainBlocked(domain: string): boolean {
  if (!domain) return false;
  const clean = domain.replace(/^www\./, "").toLowerCase();
  // Check exact match
  if (BLOCKED_DOMAINS.has(clean)) return true;
  // Check if it's a subdomain of a blocked domain
  const blockedList = Array.from(BLOCKED_DOMAINS);
  for (let i = 0; i < blockedList.length; i++) {
    if (clean.endsWith(`.${blockedList[i]}`)) return true;
  }
  return false;
}

/**
 * Fetch product/company images from Serper Images API.
 *
 * Strategy:
 * 1. First pass: query with site: operator on the company's own domain (highest quality)
 * 2. Second pass: query with company name + technology/product terms, excluding e-commerce
 * 3. Merge, deduplicate, prefer own-domain results, exclude blocked domains
 */
export async function fetchSerperImages(
  companyName: string,
  primaryDomain: string | null | undefined,
  limit = 6
): Promise<SerperImage[]> {
  const apiKey = ENV.serperApiKey;
  if (!apiKey) throw new Error("SERPER_API_KEY is not configured");

  const ownDomain = primaryDomain?.replace(/^www\./, "").toLowerCase() ?? null;

  // Build two complementary queries
  const queries: string[] = [];

  if (ownDomain) {
    // Pass 1: images from the company's own website
    queries.push(`site:${ownDomain} products technology`);
  }

  // Pass 2: broader search with tech context, explicitly avoiding retail
  // Using -site: exclusions for the worst offenders
  queries.push(
    `"${companyName}" products technology -site:amazon.com -site:ebay.com -site:alibaba.com -site:pinterest.com`
  );

  const allImages: any[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const response = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 10 }),
      });

      if (!response.ok) {
        throw new Error(`Serper Images API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { images?: any[] };
      for (const img of data.images ?? []) {
        const url = img.imageUrl ?? "";
        if (!url || seenUrls.has(url)) continue;
        if (isDomainBlocked(img.domain ?? "")) continue;
        seenUrls.add(url);
        allImages.push(img);
      }
    } catch (err) {
      // If the first query fails (e.g. site: returns nothing), continue to next
      if (queries.indexOf(query) === queries.length - 1) throw err;
    }
  }

  // Sort: own-domain images first, then everything else
  const domainMatched = ownDomain
    ? allImages.filter((img) => img.domain?.replace(/^www\./, "").toLowerCase() === ownDomain)
    : [];
  const others = ownDomain
    ? allImages.filter((img) => img.domain?.replace(/^www\./, "").toLowerCase() !== ownDomain)
    : allImages;

  const ordered = [...domainMatched, ...others].slice(0, limit);

  return ordered.map((img) => {
    // Strip base64 data URIs from thumbnailUrl — they can be hundreds of KB each
    // and blow up the MySQL packet size when stored as JSON in the productImages column.
    const thumb = img.thumbnailUrl ?? "";
    const safeThumb = thumb.startsWith("data:") ? "" : thumb;
    return {
      imageUrl: img.imageUrl ?? "",
      thumbnailUrl: safeThumb || (img.imageUrl ?? ""),
      title: img.title ?? "",
      source: img.source ?? img.domain ?? "",
      domain: img.domain ?? "",
      link: img.link ?? "",
    };
  });
}
