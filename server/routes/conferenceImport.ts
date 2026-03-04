/**
 * POST /api/conference-import
 *
 * Session-authenticated (uses the same cookie as tRPC) endpoint for importing
 * conference exhibitor lists from the browser UI.
 *
 * Streams NDJSON progress back to the client.
 * Body: { url: string, campaignName: string }
 */

import { Router } from "express";
import { sdk } from "../_core/sdk";
import { createSearch, createCompanies, getDb } from "../db";

const router = Router();

router.post("/", async (req: any, res: any) => {
  // Authenticate via session cookie (same as tRPC)
  let user: any = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }

  const { url, campaignName } = req.body as { url?: string; campaignName?: string };

  if (!url?.trim()) {
    return res.status(400).json({ error: "url is required" });
  }
  if (!campaignName?.trim()) {
    return res.status(400).json({ error: "campaignName is required" });
  }

  try { new URL(url); } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const send = (obj: object) => {
    try { res.write(JSON.stringify(obj) + "\n"); } catch { /* client disconnected */ }
  };

  try {
    const { scrapeConferenceExhibitors, apolloEnrichByDomain } = await import("../conferenceScraper");

    // Step 1: Scrape the exhibitor page (multi-page)
    send({ status: "scraping", message: "Fetching exhibitor page..." });

    let exhibitors: any[];
    let strategy: string;
    let pageTitle: string;
    let pagesScraped: number;

    try {
      const result = await scrapeConferenceExhibitors(
        url.trim(),
        // Stream page-by-page progress to the client
        (progress) => {
          send({
            status: "scraping_page",
            page: progress.page,
            totalPages: progress.totalPages,
            found: progress.found,
            message: progress.message,
          });
        }
      );
      exhibitors = result.exhibitors;
      strategy = result.strategy;
      pageTitle = result.pageTitle;
      pagesScraped = result.pagesScraped;
    } catch (err: any) {
      send({ error: `Failed to fetch page: ${err.message}. Check that the URL is publicly accessible.` });
      res.end();
      return;
    }

    if (exhibitors.length === 0) {
      send({ error: "No exhibitors found on the page. The page may require JavaScript rendering or use a different structure." });
      res.end();
      return;
    }

    send({
      status: "scraped",
      total: exhibitors.length,
      pagesScraped,
      strategy,
      pageTitle,
      message: `Found ${exhibitors.length} exhibitors across ${pagesScraped} page(s) via ${strategy} strategy`,
    });

    // Step 2: Create the search/campaign record
    const searchId = await createSearch({
      userId: user.id,
      companyWebsite: url.trim(),
      location: "Conference Import",
      offeringName: campaignName.trim(),
      offeringDescription: `Exhibitors from ${pageTitle} (${url.trim()}) — ${exhibitors.length} companies scraped across ${pagesScraped} page(s) via ${strategy}`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: JSON.stringify(["conference-import"]),
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: 0,
      codesTotal: exhibitors.length,
      status: "searching",
    });

    send({ status: "campaign_created", searchId, message: `Campaign created (id=${searchId})` });

    // Step 3: Enrich each exhibitor via Apollo by domain
    let enriched = 0;
    let notFound = 0;
    let failed = 0;
    const companyRows: any[] = [];

    for (let i = 0; i < exhibitors.length; i++) {
      const exhibitor = exhibitors[i];
      try {
        let domain: string | null = null;
        if (exhibitor.websiteUrl) {
          try { domain = new URL(exhibitor.websiteUrl).hostname.replace(/^www\./, ""); } catch {}
        }

        let apolloData = null;
        if (domain) {
          apolloData = await apolloEnrichByDomain(domain);
        }

        if (apolloData) {
          enriched++;
          companyRows.push({
            searchId,
            apolloId: apolloData.apolloId || null,
            name: apolloData.name || exhibitor.name,
            websiteUrl: apolloData.websiteUrl || exhibitor.websiteUrl,
            primaryDomain: apolloData.primaryDomain || domain,
            linkedinUrl: apolloData.linkedinUrl || null,
            phone: apolloData.phone || null,
            foundedYear: apolloData.foundedYear || null,
            revenue: apolloData.revenue || null,
            headcountGrowth: apolloData.headcountGrowth || null,
            sicCodes: apolloData.sicCodes?.length ? JSON.stringify(apolloData.sicCodes) : null,
            naicsCodes: apolloData.naicsCodes?.length ? JSON.stringify(apolloData.naicsCodes) : null,
            city: apolloData.city || null,
            state: apolloData.state || null,
            country: apolloData.country || null,
            streetAddress: apolloData.streetAddress || null,
            searchLocation: "Conference Import",
            enrichmentStatus: "enriched",
          });
        } else {
          notFound++;
          companyRows.push({
            searchId,
            apolloId: null,
            name: exhibitor.name,
            websiteUrl: exhibitor.websiteUrl || null,
            primaryDomain: domain,
            searchLocation: "Conference Import",
            enrichmentStatus: "pending",
          });
        }

        send({
          status: "progress",
          done: i + 1,
          total: exhibitors.length,
          enriched,
          notFound,
          failed,
          company: exhibitor.name,
          apolloFound: apolloData !== null,
        });
      } catch (err: any) {
        failed++;
        companyRows.push({
          searchId,
          apolloId: null,
          name: exhibitor.name,
          websiteUrl: exhibitor.websiteUrl || null,
          searchLocation: "Conference Import",
          enrichmentStatus: "failed",
        });
        send({
          status: "progress",
          done: i + 1,
          total: exhibitors.length,
          enriched,
          notFound,
          failed,
          company: exhibitor.name,
          apolloFound: false,
          error: err.message,
        });
      }

      // Small delay to avoid Apollo rate limits
      if (i < exhibitors.length - 1) {
        await new Promise(r => setTimeout(r, 250));
      }
    }

    // Step 4: Bulk insert all company rows
    const BATCH = 200;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
    }

    // Step 5: Mark campaign as completed
    const db = await getDb();
    if (db) {
      const { searches } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(searches)
        .set({ status: "completed", codesSearched: exhibitors.length })
        .where(eq(searches.id, searchId));
    }

    send({
      status: "done",
      searchId,
      total: exhibitors.length,
      enriched,
      notFound,
      failed,
      message: `Import complete. Scraped ${pagesScraped} page(s), found ${exhibitors.length} exhibitors. ${enriched} enriched via Apollo, ${notFound} not found (basic info saved), ${failed} failed.`,
    });
  } catch (err: any) {
    console.error("[Conference Import] Fatal error:", err.message);
    send({ error: err.message });
  }

  res.end();
});

export default router;
