/**
 * Batch fetch product images + urgency images for all companies
 * in campaigns #1500003 and #1350004 that are missing them.
 * 
 * Run with: npx tsx batch-fetch-images.mts
 */

import { getCompaniesBySearchId, updateCompany } from "./server/db";
import { fetchSerperImages } from "./server/serperImages";
import dotenv from "dotenv";
dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const BLOCKED = new Set([
  "amazon.com","ebay.com","alibaba.com","pinterest.com",
  "shutterstock.com","gettyimages.com","istockphoto.com","dreamstime.com",
  "alamy.com","depositphotos.com","123rf.com","google.com","bing.com"
]);

async function fetchUrgencyImagesForCompany(company: any): Promise<any[]> {
  if (!SERPER_API_KEY) return [];
  
  const query = `"${company.name}" news 2025 2026 -site:amazon.com -site:pinterest.com -site:shutterstock.com -site:gettyimages.com`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 12 }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    let images: any[] = [];
    if (response.ok) {
      const data = await response.json() as { images?: any[] };
      images = (data.images ?? [])
        .filter((img: any) => {
          const d = (img.domain ?? "").replace(/^www\./, "").toLowerCase();
          return img.imageUrl && !BLOCKED.has(d);
        })
        .slice(0, 8)
        .map((img: any) => ({
          imageUrl: img.imageUrl ?? "",
          thumbnailUrl: img.thumbnailUrl ?? "",
          title: img.title ?? "",
          source: img.source ?? img.domain ?? "",
          domain: img.domain ?? "",
          link: img.link ?? "",
        }));
    }
    
    // Fallback to company website if no news images
    if (images.length === 0) {
      const websiteUrl = company.websiteUrl || company.primaryDomain;
      if (websiteUrl) {
        const rawDomain = websiteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
        if (rawDomain) {
          try {
            const wsResp = await fetch("https://google.serper.dev/images", {
              method: "POST",
              headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ q: `site:${rawDomain}`, num: 12 }),
            });
            if (wsResp.ok) {
              const wsData = await wsResp.json() as { images?: any[] };
              images = (wsData.images ?? []).filter((img: any) => img.imageUrl).slice(0, 8)
                .map((img: any) => ({
                  imageUrl: img.imageUrl ?? "",
                  thumbnailUrl: img.thumbnailUrl ?? "",
                  title: img.title ?? "",
                  source: img.source ?? img.domain ?? "",
                  domain: img.domain ?? "",
                  link: img.link ?? "",
                }));
            }
          } catch { /* ignore */ }
        }
      }
    }
    
    return images;
  } catch (err: any) {
    console.warn(`  urgency fetch error: ${err.message}`);
    return [];
  }
}

async function batchFetchForSearch(searchId: number, label: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${label} (searchId: ${searchId})`);
  console.log(`${"=".repeat(70)}`);
  
  const allCompanies = await getCompaniesBySearchId(searchId);
  const enriched = allCompanies.filter(c => c.enrichmentStatus === "enriched");
  
  const needProduct = enriched.filter(c => !c.productImages || c.productImages === "[]" || c.productImages === "null");
  const needUrgency = enriched.filter(c => !c.urgencyImages || c.urgencyImages === "[]" || c.urgencyImages === "null");
  
  console.log(`  Total enriched: ${enriched.length}`);
  console.log(`  Missing product images: ${needProduct.length}`);
  console.log(`  Missing urgency images: ${needUrgency.length}`);
  
  let productDone = 0, productFailed = 0;
  let urgencyDone = 0, urgencyFailed = 0;
  
  // ── Product images ──
  if (needProduct.length > 0) {
    console.log(`\n  📸 Fetching product images...`);
    for (const company of needProduct) {
      try {
        const images = await fetchSerperImages(company.name, company.primaryDomain, 6);
        await updateCompany(company.id, { productImages: JSON.stringify(images) });
        productDone++;
        process.stdout.write(`\r  product: ${productDone}/${needProduct.length} (${productFailed} failed)`);
        await new Promise(r => setTimeout(r, 250));
      } catch (err: any) {
        productFailed++;
        process.stdout.write(`\r  product: ${productDone}/${needProduct.length} (${productFailed} failed)`);
      }
    }
    console.log(`\n  ✓ Product images done: ${productDone}/${needProduct.length}`);
  }
  
  // ── Urgency images ──
  if (needUrgency.length > 0) {
    console.log(`\n  📰 Fetching urgency images...`);
    for (const company of needUrgency) {
      try {
        const images = await fetchUrgencyImagesForCompany(company);
        await updateCompany(company.id, { urgencyImages: JSON.stringify(images) });
        urgencyDone++;
        process.stdout.write(`\r  urgency: ${urgencyDone}/${needUrgency.length} (${urgencyFailed} failed)`);
        await new Promise(r => setTimeout(r, 250));
      } catch (err: any) {
        urgencyFailed++;
        process.stdout.write(`\r  urgency: ${urgencyDone}/${needUrgency.length} (${urgencyFailed} failed)`);
      }
    }
    console.log(`\n  ✓ Urgency images done: ${urgencyDone}/${needUrgency.length}`);
  }
  
  return { productDone, productFailed, urgencyDone, urgencyFailed };
}

async function main() {
  console.log("🚀 Batch Image Fetcher — Demo Prep");
  console.log(`SERPER_API_KEY: ${SERPER_API_KEY ? "✓ configured" : "✗ MISSING"}`);
  
  const start = Date.now();
  
  const r1 = await batchFetchForSearch(1500003, "[Niche] Diverse Industrial & Manufacturing Solutions");
  const r2 = await batchFetchForSearch(1350004, "[Niche] AI-Powered Video Surveillance & Analytics");
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  SUMMARY (${elapsed}s total)`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  #1500003: product ${r1.productDone} ok / ${r1.productFailed} fail | urgency ${r1.urgencyDone} ok / ${r1.urgencyFailed} fail`);
  console.log(`  #1350004: product ${r2.productDone} ok / ${r2.productFailed} fail | urgency ${r2.urgencyDone} ok / ${r2.urgencyFailed} fail`);
  console.log(`\nDone! 🎉`);
  
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
