/**
 * Dynamic SIC/NAICS Code Description Lookup
 * Fetches descriptions by scraping siccode.com pages
 */

interface CodeDescription {
  code: string;
  description: string | null;
  source: 'cache' | 'web';
}

/**
 * Fetch SIC code description from siccode.com
 */
export async function fetchSicDescription(code: string): Promise<string | null> {
  try {
    const url = `https://siccode.com/sic-code/${code}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Extract description from the page title pattern: "SIC Code XXXX - Description"
    const titleMatch = html.match(/<title>SIC Code \d+ - ([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    // Fallback: try to extract from h1 heading
    const h1Match = html.match(/<h1[^>]*>SIC Code \d+ - ([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`[SIC Lookup] Failed to fetch description for ${code}:`, error);
    return null;
  }
}

/**
 * Fetch NAICS code description from siccode.com or naics.com
 */
export async function fetchNaicsDescription(code: string): Promise<string | null> {
  try {
    // Try siccode.com first
    const url = `https://siccode.com/naics-code/${code}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Extract description from the page title pattern: "NAICS Code XXXXX - Description"
    const titleMatch = html.match(/<title>NAICS Code \d+ - ([^<|]+)/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    // Fallback: try to extract from h1 heading
    const h1Match = html.match(/<h1[^>]*>NAICS Code \d+ - ([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`[NAICS Lookup] Failed to fetch description for ${code}:`, error);
    return null;
  }
}

/**
 * Batch fetch multiple SIC code descriptions
 */
export async function batchFetchSicDescriptions(codes: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Process in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const promises = batch.map(async (code) => {
      const description = await fetchSicDescription(code);
      if (description) {
        results.set(code, description);
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to be respectful
    if (i + batchSize < codes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

/**
 * Batch fetch multiple NAICS code descriptions
 */
export async function batchFetchNaicsDescriptions(codes: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Process in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const promises = batch.map(async (code) => {
      const description = await fetchNaicsDescription(code);
      if (description) {
        results.set(code, description);
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to be respectful
    if (i + batchSize < codes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}
