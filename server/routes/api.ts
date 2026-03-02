import { Router } from "express";
import multer from "multer";
import { getDb, createSearch, createCompanies, getPendingCompaniesBySearchId, getCompaniesBySearchId, updateCompany, getSearchById } from "../db";
import { companies, searches, users } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { parseApolloCSV, mapApolloRowToCompany } from "../apolloCSVParser";
import { enrichCompanyDetails } from "../apolloSearch";
import { generateSalesIntelligenceBrief } from "../briefGenerator";

const router = Router();

/**
 * API Key Authentication Middleware
 * 
 * To generate an API key:
 * 1. Go to the app's Settings page
 * 2. Generate a new API key
 * 3. Store it securely
 * 
 * To use the API:
 * Add header: Authorization: Bearer YOUR_API_KEY
 */
function apiKeyAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      error: "Unauthorized", 
      message: "Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY" 
    });
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  
  // For now, check against environment variable
  // TODO: Store API keys in database with user association
  const validApiKey = process.env.API_KEY || "your-secret-api-key-here";
  
  if (apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: "Unauthorized", 
      message: "Invalid API key" 
    });
  }

  next();
}

// Apply API key auth to all routes
router.use(apiKeyAuth);

/**
 * GET /api/v1/companies
 * List all companies with pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 200)
 * - searchId: Filter by search ID (optional)
 */
router.get("/companies", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const searchId = req.query.searchId ? parseInt(req.query.searchId as string) : null;
    const offset = (page - 1) * limit;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }

    let query = db.select().from(companies);
    
    if (searchId) {
      query = query.where(eq(companies.searchId, searchId)) as any;
    }

    const results = await query
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);

    // Count total for pagination
    const dbInstance = await getDb();
    if (!dbInstance) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const countQuery = searchId 
      ? dbInstance.select().from(companies).where(eq(companies.searchId, searchId))
      : dbInstance.select().from(companies);
    const total = (await countQuery).length;

    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message 
    });
  }
});

/**
 * GET /api/v1/companies/:id
 * Get a single company by ID
 */
router.get("/companies/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }

    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: "Bad Request", 
        message: "Invalid company ID" 
      });
    }

    const result = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ 
        error: "Not Found", 
        message: "Company not found" 
      });
    }

    res.json({ data: result[0] });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message 
    });
  }
});

/**
 * GET /api/v1/searches
 * List all searches with pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 200)
 */
router.get("/searches", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const results = await db
      .select()
      .from(searches)
      .orderBy(desc(searches.createdAt))
      .limit(limit)
      .offset(offset);

    const dbInstance = await getDb();
    if (!dbInstance) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const total = (await dbInstance.select().from(searches)).length;

    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message 
    });
  }
});

/**
 * GET /api/v1/searches/:id
 * Get a single search by ID
 */
router.get("/searches/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }

    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: "Bad Request", 
        message: "Invalid search ID" 
      });
    }

    const result = await db
      .select()
      .from(searches)
      .where(eq(searches.id, id))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ 
        error: "Not Found", 
        message: "Search not found" 
      });
    }

    res.json({ data: result[0] });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message 
    });
  }
});

/**
 * GET /api/v1/searches/:id/companies
 * Get all companies for a specific search
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 200)
 */
router.get("/searches/:id/companies", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }

    const searchId = parseInt(req.params.id);
    
    if (isNaN(searchId)) {
      return res.status(400).json({ 
        error: "Bad Request", 
        message: "Invalid search ID" 
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const results = await db
      .select()
      .from(companies)
      .where(eq(companies.searchId, searchId))
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);

    const dbInstance = await getDb();
    if (!dbInstance) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const total = (await dbInstance
      .select()
      .from(companies)
      .where(eq(companies.searchId, searchId))).length;

    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message 
    });
  }
});

/**
 * POST /api/v1/import-csv
 * Import an Apollo CSV export as a new campaign.
 * Accepts multipart/form-data with fields:
 *   - file: the CSV file
 *   - campaignName: string
 *   - location: string (optional)
 *   - userId: number (optional, defaults to 1)
 *
 * Use this endpoint when the CSV is too large for the browser JS engine.
 * Example (curl):
 *   curl -X POST http://localhost:3000/api/v1/import-csv \
 *     -H "Authorization: Bearer YOUR_API_KEY" \
 *     -F "file=@/path/to/apollo-export.csv" \
 *     -F "campaignName=My Campaign" \
 *     -F "location=United States"
 */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post("/import-csv", upload.single("file"), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Bad Request", message: "No file uploaded. Use field name \"file\"." });
    }

    const campaignName = (req.body.campaignName || "").trim();
    if (!campaignName) {
      return res.status(400).json({ error: "Bad Request", message: "campaignName is required." });
    }

    const location = (req.body.location || "CSV Import").trim();
    const userId = parseInt(req.body.userId || "1");

    const csvContent = req.file.buffer.toString("utf-8");
    console.log(`[CSV Import API] Parsing CSV (${(req.file.size / 1024 / 1024).toFixed(1)} MB)...`);

    const rows = parseApolloCSV(csvContent);
    console.log(`[CSV Import API] Parsed ${rows.length} rows for campaign: ${campaignName}`);

    if (rows.length === 0) {
      return res.status(400).json({ error: "Bad Request", message: "CSV file is empty or could not be parsed." });
    }

    const searchId = await createSearch({
      userId,
      companyWebsite: "N/A",
      location,
      offeringName: campaignName,
      offeringDescription: `Campaign imported from Apollo CSV with ${rows.length} companies`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: null,
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: rows.length,
      codesTotal: rows.length,
      status: "completed",
    });

    const companyRows = rows.map((row) => mapApolloRowToCompany(row, searchId));

    // Insert in batches of 500 to avoid memory pressure
    const BATCH = 500;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
      console.log(`[CSV Import API] Inserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(companyRows.length / BATCH)}`);
    }

    console.log(`[CSV Import API] ✓ Done — ${companyRows.length} companies imported, searchId=${searchId}`);

    res.json({
      success: true,
      searchId,
      companiesImported: companyRows.length,
      campaignName,
    });
  } catch (error: any) {
    console.error("[CSV Import API] Error:", error.message);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

/**
 * POST /api/v1/enrich-campaign
 * Enrich all pending companies in a campaign with Apollo firmographic data.
 * Runs the same logic as the "ENRICH ALL" button but from the server side.
 *
 * Body (JSON):
 *   { "searchId": 750001, "batchSize": 5 }
 *
 * Streams newline-delimited JSON progress lines, then a final summary.
 * Example (curl):
 *   curl -X POST http://localhost:3000/api/v1/enrich-campaign \
 *     -H "Authorization: Bearer YOUR_API_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"searchId": 750001}'
 */
router.post("/enrich-campaign", async (req: any, res: any) => {
  const { searchId, batchSize = 5 } = req.body || {};

  if (!searchId || isNaN(parseInt(searchId))) {
    return res.status(400).json({ error: "Bad Request", message: "searchId is required." });
  }

  const sid = parseInt(searchId);
  const bs = Math.min(20, Math.max(1, parseInt(batchSize) || 5));

  // Use chunked transfer so the caller can watch progress in real time
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();

  const send = (obj: object) => res.write(JSON.stringify(obj) + "\n");

  try {
    const search = await getSearchById(sid);
    if (!search) {
      send({ error: `Search ${sid} not found.` });
      return res.end();
    }

    const pending = await getPendingCompaniesBySearchId(sid);
    send({ status: "started", searchId: sid, pending: pending.length, batchSize: bs });

    if (pending.length === 0) {
      send({ status: "done", enriched: 0, failed: 0, message: "All companies already enriched." });
      return res.end();
    }

    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i += bs) {
      const batch = pending.slice(i, i + bs);
      await Promise.all(
        batch.map(async (company) => {
          if (!company.apolloId) {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
            return;
          }
          try {
            const details = await enrichCompanyDetails(company.apolloId);
            await updateCompany(company.id, {
              city: details.city || null,
              state: details.state || null,
              country: details.country || null,
              streetAddress: details.street_address || null,
              rawAddress: details.raw_address || null,
              enrichmentStatus: "enriched",
            });
            enriched++;
          } catch (err) {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
          }
        })
      );

      const done = Math.min(i + bs, pending.length);
      send({ status: "progress", done, total: pending.length, enriched, failed });
    }

    send({ status: "done", enriched, failed, message: `Enriched ${enriched} companies, ${failed} failed.` });
  } catch (err: any) {
    send({ error: err.message });
  }

  res.end();
});

/**
 * POST /api/v1/research-campaign
 * Generate Grok-powered sales intelligence briefs for all unresearched companies
 * in a campaign, processing them sequentially (one at a time) to avoid rate limits.
 *
 * Body (JSON):
 *   { "searchId": 750001, "limit": 50, "userId": 1 }
 *
 * - limit: max number of companies to research in this run (default: 50)
 * - userId: owner user ID for Brain context injection (default: 1)
 * - Skips companies that already have a brief < 7 days old
 * - Streams newline-delimited JSON progress lines
 *
 * Example (curl):
 *   curl -X POST http://localhost:3000/api/v1/research-campaign \
 *     -H "Authorization: Bearer YOUR_API_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"searchId": 750001, "limit": 50}'
 */
router.post("/research-campaign", async (req: any, res: any) => {
  const { searchId, limit = 50, userId = 1 } = req.body || {};

  if (!searchId || isNaN(parseInt(searchId))) {
    return res.status(400).json({ error: "Bad Request", message: "searchId is required." });
  }

  const sid = parseInt(searchId);
  const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 50));
  const uid = parseInt(userId) || 1;

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();

  const send = (obj: object) => res.write(JSON.stringify(obj) + "\n");

  try {
    const search = await getSearchById(sid);
    if (!search) {
      send({ error: `Search ${sid} not found.` });
      return res.end();
    }

    // Get all companies for this search
    const allCompanies = await getCompaniesBySearchId(sid);

    // Filter: skip companies that already have a fresh brief (< 7 days old)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const toResearch = allCompanies
      .filter((c) => {
        if (!c.briefData || !c.briefGeneratedAt) return true; // no brief yet
        const age = Date.now() - new Date(c.briefGeneratedAt).getTime();
        return age >= sevenDaysMs; // brief is stale
      })
      .slice(0, maxLimit);

    send({
      status: "started",
      searchId: sid,
      total: allCompanies.length,
      toResearch: toResearch.length,
      alreadyResearched: allCompanies.length - toResearch.length,
      limit: maxLimit,
    });

    if (toResearch.length === 0) {
      send({ status: "done", researched: 0, failed: 0, message: "All companies already have fresh research briefs." });
      return res.end();
    }

    let researched = 0;
    let failed = 0;

    // Process ONE AT A TIME — Grok calls are expensive and slow (~30-60s each)
    for (let i = 0; i < toResearch.length; i++) {
      const company = toResearch[i];
      try {
        console.log(`[Research Campaign] ${i + 1}/${toResearch.length} — ${company.name}`);
        const brief = await generateSalesIntelligenceBrief(company.id, uid);
        await updateCompany(company.id, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: new Date(),
        });
        researched++;
        send({
          status: "progress",
          done: i + 1,
          total: toResearch.length,
          researched,
          failed,
          company: company.name,
          urgencyScore: brief.urgencyScore,
        });
      } catch (err: any) {
        failed++;
        console.warn(`[Research Campaign] Failed for ${company.name}:`, err.message);
        send({
          status: "progress",
          done: i + 1,
          total: toResearch.length,
          researched,
          failed,
          company: company.name,
          error: err.message,
        });
      }
    }

    send({
      status: "done",
      researched,
      failed,
      message: `Researched ${researched} companies, ${failed} failed.`,
    });
  } catch (err: any) {
    send({ error: err.message });
  }

  res.end();
});

export default router;
