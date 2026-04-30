/**
 * Share Page Cache
 * 
 * In-memory cache for share page data to avoid repeated DB queries + Serper API calls.
 * - Individual share pages: cached by token (company + brain + images)
 * - Share list pages: cached by listToken (all companies pre-assembled)
 * - TTL: 24 hours (refreshed by daily scheduled task)
 * - Manual invalidation: when company data is updated
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

// Individual share page cache: token -> resolved page data
const tokenCache = new Map<string, CacheEntry<any>>();

// Share list cache: listToken -> resolved list data
const listCache = new Map<string, CacheEntry<any>>();

export function getCachedToken(token: string): any | null {
  const entry = tokenCache.get(token);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    tokenCache.delete(token);
    return null;
  }
  return entry.data;
}

export function setCachedToken(token: string, data: any): void {
  tokenCache.set(token, { data, cachedAt: Date.now() });
}

export function getCachedList(listToken: string): any | null {
  const entry = listCache.get(listToken);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    listCache.delete(listToken);
    return null;
  }
  return entry.data;
}

export function setCachedList(listToken: string, data: any): void {
  listCache.set(listToken, { data, cachedAt: Date.now() });
}

export function invalidateToken(token: string): void {
  tokenCache.delete(token);
}

export function invalidateList(listToken: string): void {
  listCache.delete(listToken);
}

export function invalidateAll(): void {
  tokenCache.clear();
  listCache.clear();
}

export function getCacheStats(): { tokenEntries: number; listEntries: number } {
  return {
    tokenEntries: tokenCache.size,
    listEntries: listCache.size,
  };
}
