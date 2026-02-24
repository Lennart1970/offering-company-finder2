import { Router } from "express";
import { getDb } from "../db";
import { companies, searches, users } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

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
router.get("/v1/companies", async (req, res) => {
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
router.get("/v1/companies/:id", async (req, res) => {
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
router.get("/v1/searches", async (req, res) => {
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
router.get("/v1/searches/:id", async (req, res) => {
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
router.get("/v1/searches/:id/companies", async (req, res) => {
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

export default router;
