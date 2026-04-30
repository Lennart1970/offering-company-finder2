/**
 * /api/scheduled/refresh-shares
 * 
 * Pre-fetches Serper images for all share tokens that don't have cached images yet.
 * Called by a daily scheduled task to ensure share pages load instantly.
 * 
 * Also pre-warms the in-memory cache for share lists.
 * 
 * Authentication: requires valid session cookie (scheduled task gets one automatically).
 */
import { Router } from "express";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { shareTokens, companies, shareLists } from "../drizzle/schema";
import { sdk } from "./_core/sdk";

const router = Router();

router.post("/", async (req, res) => {
  // Authenticate — scheduled task provides session cookie
  try {
    await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) return res.status(500).json({ error: "Database unavailable" });

  // Find all share tokens without cached images
  const uncachedTokens = await db
    .select({
      id: shareTokens.id,
      token: shareTokens.token,
      companyId: shareTokens.companyId,
    })
    .from(shareTokens)
    .where(isNull(shareTokens.cachedImages));

  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    return res.status(500).json({ error: "SERPER_API_KEY not configured" });
  }

  let cached = 0;
  let failed = 0;
  let skipped = 0;

  // Process in batches of 10 to avoid overwhelming Serper
  for (let i = 0; i < uncachedTokens.length; i += 10) {
    const batch = uncachedTokens.slice(i, i + 10);
    
    await Promise.all(batch.map(async (token) => {
      try {
        // Get company name for the image search
        const companyRows = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, token.companyId))
          .limit(1);
        
        const companyName = companyRows[0]?.name;
        if (!companyName) {
          skipped++;
          return;
        }

        const searchQuery = `${companyName} company office headquarters`;
        const serperRes = await fetch("https://google.serper.dev/images", {
          method: "POST",
          headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: searchQuery, num: 5 }),
        });

        if (serperRes.ok) {
          const serperData = await serperRes.json() as { images?: Array<{ imageUrl?: string; thumbnailUrl?: string }> };
          const images = serperData.images ?? [];
          const imageUrls = images
            .map((img) => img.imageUrl ?? img.thumbnailUrl ?? "")
            .filter((url) => url && url.startsWith("http"))
            .slice(0, 2);

          if (imageUrls.length > 0) {
            await db.update(shareTokens)
              .set({ cachedImages: JSON.stringify(imageUrls), cachedAt: new Date() })
              .where(eq(shareTokens.id, token.id));
            cached++;
          } else {
            // Store empty array to avoid re-fetching
            await db.update(shareTokens)
              .set({ cachedImages: "[]", cachedAt: new Date() })
              .where(eq(shareTokens.id, token.id));
            skipped++;
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }));

    // Small delay between batches to be nice to Serper API
    if (i + 10 < uncachedTokens.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Also count total stats
  const totalTokens = await db.select({ id: shareTokens.id }).from(shareTokens);
  const totalLists = await db.select({ id: shareLists.id }).from(shareLists);

  return res.json({
    success: true,
    stats: {
      totalTokens: totalTokens.length,
      totalLists: totalLists.length,
      newlyCached: cached,
      failed,
      skipped,
      alreadyCached: totalTokens.length - uncachedTokens.length,
    },
  });
});

export const scheduledRefreshSharesRouter = router;
