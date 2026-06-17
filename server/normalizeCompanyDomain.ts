/**
 * Normalised hostname for CRM domain matching (companies.normalizedDomain).
 * Mirrors cgLeadRouter / import-sharepoint-leads domain extraction.
 */

/** Strip www, lowercase, drop path/port from a bare host string. */
export function normalizeHostname(host: string): string | null {
  const s = host
    .trim()
    .replace(/^www\./i, "")
    .toLowerCase()
    .split("/")[0]
    .split(":")[0]
    .trim();
  return s.length > 0 ? s : null;
}

/** Extract hostname from a website URL (with or without protocol). */
export function extractHostnameFromWebsite(websiteUrl: string): string | null {
  const raw = websiteUrl.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return normalizeHostname(url.hostname);
  } catch {
    return normalizeHostname(raw.replace(/^https?:\/\//i, ""));
  }
}

/** Preferred CRM match domain: primaryDomain first, else host from websiteUrl. */
export function normalizeCompanyDomain(opts: {
  primaryDomain?: string | null;
  websiteUrl?: string | null;
}): string | null {
  if (opts.primaryDomain?.trim()) {
    const fromPrimary = normalizeHostname(opts.primaryDomain);
    if (fromPrimary) return fromPrimary;
  }
  if (opts.websiteUrl?.trim()) {
    return extractHostnameFromWebsite(opts.websiteUrl);
  }
  return null;
}
