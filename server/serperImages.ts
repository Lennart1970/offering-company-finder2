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
 * Fetch product/company images from Serper Images API.
 * Prefers images whose domain matches the company's own domain.
 * Returns up to `limit` images.
 */
export async function fetchSerperImages(
  companyName: string,
  primaryDomain: string | null | undefined,
  limit = 6
): Promise<SerperImage[]> {
  const apiKey = ENV.serperApiKey;
  if (!apiKey) throw new Error("SERPER_API_KEY is not configured");

  // Build query: company name + domain for best relevance
  const query = primaryDomain
    ? `${companyName} site:${primaryDomain} OR ${companyName} products`
    : `${companyName} products`;

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
  const images: any[] = data.images ?? [];

  // Prefer images from the company's own domain first
  const ownDomain = primaryDomain?.replace(/^www\./, "").toLowerCase();
  const domainMatched = ownDomain
    ? images.filter((img) => img.domain?.replace(/^www\./, "").toLowerCase() === ownDomain)
    : [];
  const others = ownDomain
    ? images.filter((img) => img.domain?.replace(/^www\./, "").toLowerCase() !== ownDomain)
    : images;

  const ordered = [...domainMatched, ...others].slice(0, limit);

  return ordered.map((img) => ({
    imageUrl: img.imageUrl ?? "",
    thumbnailUrl: img.thumbnailUrl ?? "",
    title: img.title ?? "",
    source: img.source ?? img.domain ?? "",
    domain: img.domain ?? "",
    link: img.link ?? "",
  }));
}
