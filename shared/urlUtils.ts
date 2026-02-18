/**
 * Normalize a user-provided website input to a proper URL format
 * Handles various input formats:
 * - "connectgroup" -> "https://connectgroup.com"
 * - "connectgroup.com" -> "https://connectgroup.com"
 * - "www.connectgroup.com" -> "https://www.connectgroup.com"
 * - "http://connectgroup.com" -> "https://connectgroup.com"
 * - "https://connectgroup.com" -> "https://connectgroup.com"
 */
export function normalizeWebsiteUrl(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid URL input");
  }

  let normalized = input.trim().toLowerCase();

  // Remove any whitespace
  normalized = normalized.replace(/\s+/g, "");

  // If it already has a protocol, ensure it's https
  if (normalized.startsWith("http://")) {
    normalized = normalized.replace("http://", "https://");
  } else if (normalized.startsWith("https://")) {
    // Already has https, keep it
  } else {
    // No protocol - add https://
    normalized = `https://${normalized}`;
  }

  // If no TLD (top-level domain) is present, assume .com
  const urlObj = new URL(normalized);
  const hostname = urlObj.hostname;

  // Check if hostname has a dot (indicating a TLD)
  if (!hostname.includes(".")) {
    // No TLD, add .com
    urlObj.hostname = `${hostname}.com`;
    normalized = urlObj.toString();
  }

  // Validate the final URL
  try {
    const finalUrl = new URL(normalized);
    return finalUrl.toString();
  } catch (error) {
    throw new Error(`Could not normalize URL: ${input}`);
  }
}

/**
 * Validate if a string can be normalized to a valid URL
 */
export function isValidWebsiteInput(input: string): boolean {
  try {
    normalizeWebsiteUrl(input);
    return true;
  } catch {
    return false;
  }
}
