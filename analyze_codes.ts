import { getDb } from "./server/db.js";
import { companies } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

async function analyzeCodes() {
  console.log("Fetching companies with SIC/NAICS codes...\n");
  
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }
  
  const enrichedCompanies = await db
    .select({
      sicCodes: companies.sicCodes,
      naicsCodes: companies.naicsCodes,
    })
    .from(companies)
    .where(eq(companies.enrichmentStatus, "enriched"))
    .limit(200);

  const allSicCodes = new Set<string>();
  const allNaicsCodes = new Set<string>();

  for (const company of enrichedCompanies) {
    if (company.sicCodes) {
      try {
        const codes = JSON.parse(company.sicCodes);
        codes.forEach((code: string) => allSicCodes.add(code));
      } catch (e) {
        // Skip invalid JSON
      }
    }
    if (company.naicsCodes) {
      try {
        const codes = JSON.parse(company.naicsCodes);
        codes.forEach((code: string) => allNaicsCodes.add(code));
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  console.log(`Found ${allSicCodes.size} unique SIC codes:`);
  console.log(Array.from(allSicCodes).sort().join(", "));
  console.log("\n");
  
  console.log(`Found ${allNaicsCodes.size} unique NAICS codes:`);
  console.log(Array.from(allNaicsCodes).sort().join(", "));
  
  process.exit(0);
}

analyzeCodes().catch(console.error);
