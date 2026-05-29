// Check MySQL for search 1980003 companies and their briefData status
// Uses the app's tRPC server indirectly via a direct HTTP call

const BASE = "http://localhost:3000";

// We need a session cookie — let's check via the server logs approach instead
// Use the supabaseSync function directly by importing it

import * as dotenv from "dotenv";
dotenv.config();

// Parse DATABASE_URL to extract connection params
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("No DATABASE_URL"); process.exit(1); }

// Extract host, user, password, db from mysql://user:pass@host:port/db?params
const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
if (!match) { console.error("Cannot parse DATABASE_URL:", dbUrl.substring(0, 40)); process.exit(1); }

const [, user, pass, host, port, db] = match;
console.log(`Connecting to MySQL: ${user}@${host}:${port || 4000}/${db}`);

import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host,
  port: parseInt(port || "4000"),
  user,
  password: pass,
  database: db,
  ssl: { rejectUnauthorized: false },
});

// 1. Check search 1980003
const [searches] = await conn.execute(
  "SELECT id, offeringName, brainId, status, createdAt FROM searches WHERE id = 1980003"
);
console.log("\n=== Search 1980003 ===");
console.log(JSON.stringify(searches, null, 2));

// 2. Count companies in search 1980003
const [counts] = await conn.execute(
  `SELECT 
    COUNT(*) as total,
    SUM(briefData IS NOT NULL) as withBrief,
    SUM(fitScoreData IS NOT NULL) as withFitScore,
    SUM(enrichmentStatus = 'enriched') as enriched,
    SUM(enrichmentStatus = 'pending') as pending
   FROM companies WHERE searchId = 1980003`
);
console.log("\n=== Companies in search 1980003 ===");
console.log(JSON.stringify(counts[0], null, 2));

// 3. Sample companies with briefData
const [sample] = await conn.execute(
  `SELECT id, name, websiteUrl, enrichmentStatus, urgencyScore, fitScore,
    briefData IS NOT NULL as hasBrief
   FROM companies WHERE searchId = 1980003 LIMIT 5`
);
console.log("\n=== Sample companies ===");
console.log(JSON.stringify(sample, null, 2));

// 4. Check the syncCompanyPagesToSupabase WHERE clause — it filters by briefData IS NOT NULL
const [allSearches] = await conn.execute(
  `SELECT s.id, s.offeringName, COUNT(c.id) as total, SUM(c.briefData IS NOT NULL) as withBrief
   FROM searches s
   LEFT JOIN companies c ON c.searchId = s.id
   GROUP BY s.id, s.offeringName
   ORDER BY s.id DESC
   LIMIT 15`
);
console.log("\n=== All searches (company counts) ===");
console.log(JSON.stringify(allSearches, null, 2));

await conn.end();
