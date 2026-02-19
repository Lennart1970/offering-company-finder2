/**
 * Citation Enrichment Utility
 * 
 * Enriches raw URLs with metadata for better UX display.
 * Based on citation-processing skill from LeadTrigger.
 */

export interface EnrichedCitation {
  url: string;
  domain: string;
  sourceType: 'web' | 'news' | 'x';
  title: string;
}

/**
 * Detect source type from URL
 */
function detectSourceType(url: string): 'web' | 'news' | 'x' {
  const urlLower = url.toLowerCase();
  
  // X/Twitter
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'x';
  }
  
  // News sources
  const newsSources = [
    'reuters.com',
    'bloomberg.com',
    'wsj.com',
    'ft.com',
    'cnbc.com',
    'forbes.com',
    'businesswire.com',
    'prnewswire.com',
    'techcrunch.com',
    'theverge.com',
  ];
  
  if (newsSources.some(source => urlLower.includes(source))) {
    return 'news';
  }
  
  // Default to web
  return 'web';
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Enrich a citation with metadata
 */
export function enrichCitation(url: string): EnrichedCitation {
  const sourceType = detectSourceType(url);
  const domain = extractDomain(url);
  
  // Generate title based on source type
  let title: string;
  if (sourceType === 'x') {
    title = `X Post`;
  } else if (sourceType === 'news') {
    title = `${domain.split('.')[0]}`;
  } else {
    title = domain;
  }
  
  return {
    url,
    domain,
    sourceType,
    title,
  };
}

/**
 * Enrich multiple citations
 */
export function enrichCitations(urls: string[]): EnrichedCitation[] {
  return urls.map(enrichCitation);
}
