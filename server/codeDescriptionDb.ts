import { getDb } from "./db";
import { codeDescriptions } from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { fetchSicDescription, fetchNaicsDescription, batchFetchSicDescriptions, batchFetchNaicsDescriptions } from "./codeDescriptionLookup";

/**
 * Get SIC code description with caching
 */
export async function getSicDescriptionCached(code: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  // Check cache first
  const cached = await db
    .select()
    .from(codeDescriptions)
    .where(and(
      eq(codeDescriptions.code, code),
      eq(codeDescriptions.codeType, "SIC")
    ))
    .limit(1);

  if (cached.length > 0) {
    return cached[0].description;
  }

  // Fetch from web
  const description = await fetchSicDescription(code);
  
  // Cache the result (even if null)
  try {
    await db.insert(codeDescriptions).values({
      code,
      codeType: "SIC",
      description,
    }).onDuplicateKeyUpdate({
      set: { description: sql`VALUES(description)` }
    });
  } catch (error) {
    console.error(`[Code Cache] Failed to cache SIC ${code}:`, error);
  }

  return description;
}

/**
 * Get NAICS code description with caching
 */
export async function getNaicsDescriptionCached(code: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  // Check cache first
  const cached = await db
    .select()
    .from(codeDescriptions)
    .where(and(
      eq(codeDescriptions.code, code),
      eq(codeDescriptions.codeType, "NAICS")
    ))
    .limit(1);

  if (cached.length > 0) {
    return cached[0].description;
  }

  // Fetch from web
  const description = await fetchNaicsDescription(code);
  
  // Cache the result (even if null)
  try {
    await db.insert(codeDescriptions).values({
      code,
      codeType: "NAICS",
      description,
    }).onDuplicateKeyUpdate({
      set: { description: sql`VALUES(description)` }
    });
  } catch (error) {
    console.error(`[Code Cache] Failed to cache NAICS ${code}:`, error);
  }

  return description;
}

/**
 * Batch get SIC code descriptions with caching
 */
export async function batchGetSicDescriptions(codes: string[]): Promise<Map<string, string | null>> {
  const db = await getDb();
  const results = new Map<string, string | null>();
  
  if (!db || codes.length === 0) {
    return results;
  }

  // Check cache for all codes
  const cached = await db
    .select()
    .from(codeDescriptions)
    .where(and(
      inArray(codeDescriptions.code, codes),
      eq(codeDescriptions.codeType, "SIC")
    ));

  // Map cached results
  const cachedMap = new Map(cached.map(c => [c.code, c.description]));
  
  // Find codes not in cache
  const uncachedCodes = codes.filter(code => !cachedMap.has(code));
  
  // Fetch uncached codes from web
  if (uncachedCodes.length > 0) {
    const fetchedDescriptions = await batchFetchSicDescriptions(uncachedCodes);
    
    // Cache newly fetched descriptions
    const toInsert = uncachedCodes.map(code => ({
      code,
      codeType: "SIC" as const,
      description: fetchedDescriptions.get(code) || null,
    }));
    
    if (toInsert.length > 0) {
      try {
        await db.insert(codeDescriptions).values(toInsert).onDuplicateKeyUpdate({
          set: { description: sql`VALUES(description)` }
        });
      } catch (error) {
        console.error("[Code Cache] Failed to batch cache SIC codes:", error);
      }
    }
    
    // Add to results
    uncachedCodes.forEach(code => {
      results.set(code, fetchedDescriptions.get(code) || null);
    });
  }
  
  // Add cached results
  cachedMap.forEach((description, code) => {
    results.set(code, description);
  });
  
  return results;
}

/**
 * Batch get NAICS code descriptions with caching
 */
export async function batchGetNaicsDescriptions(codes: string[]): Promise<Map<string, string | null>> {
  const db = await getDb();
  const results = new Map<string, string | null>();
  
  if (!db || codes.length === 0) {
    return results;
  }

  // Check cache for all codes
  const cached = await db
    .select()
    .from(codeDescriptions)
    .where(and(
      inArray(codeDescriptions.code, codes),
      eq(codeDescriptions.codeType, "NAICS")
    ));

  // Map cached results
  const cachedMap = new Map(cached.map(c => [c.code, c.description]));
  
  // Find codes not in cache
  const uncachedCodes = codes.filter(code => !cachedMap.has(code));
  
  // Fetch uncached codes from web
  if (uncachedCodes.length > 0) {
    const fetchedDescriptions = await batchFetchNaicsDescriptions(uncachedCodes);
    
    // Cache newly fetched descriptions
    const toInsert = uncachedCodes.map(code => ({
      code,
      codeType: "NAICS" as const,
      description: fetchedDescriptions.get(code) || null,
    }));
    
    if (toInsert.length > 0) {
      try {
        await db.insert(codeDescriptions).values(toInsert).onDuplicateKeyUpdate({
          set: { description: sql`VALUES(description)` }
        });
      } catch (error) {
        console.error("[Code Cache] Failed to batch cache NAICS codes:", error);
      }
    }
    
    // Add to results
    uncachedCodes.forEach(code => {
      results.set(code, fetchedDescriptions.get(code) || null);
    });
  }
  
  // Add cached results
  cachedMap.forEach((description, code) => {
    results.set(code, description);
  });
  
  return results;
}
