/**
 * One-off script: Import Leadinfo data for campaign 1500003
 * Run with: cd /home/ubuntu/offering-company-finder && npx tsx server/importLeadinfo1500003.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { parseLeadinfoExcel, enrichCompanies, matchCompaniesToCampaign } from "./leadinfoService";
import { getDb } from "./db";
import { leadinfoVisits, companies } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function main() {
  const SEARCH_ID = 1500003;
  const USER_ID = 1;
  const FILE_PATH = "/home/ubuntu/upload/Leadinfo_export_24_03_2026.xlsx";

  console.log(`Reading Leadinfo file: ${FILE_PATH}`);
  const buffer = readFileSync(FILE_PATH);

  console.log("Parsing Excel...");
  const { companies: parsedCompanies, pageViews, warnings } = parseLeadinfoExcel(buffer);
  console.log(`Parsed: ${parsedCompanies.length} companies, ${pageViews.length} page views`);
  if (warnings.length) console.log("Warnings:", warnings);

  console.log("Enriching with page view data...");
  const enriched = enrichCompanies(parsedCompanies, pageViews);

  console.log("Connecting to database...");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log(`Fetching campaign ${SEARCH_ID} companies...`);
  const campaignCompanies = await db
    .select({
      id: companies.id,
      name: companies.name,
      primaryDomain: companies.primaryDomain,
      websiteUrl: companies.websiteUrl,
    })
    .from(companies)
    .where(eq(companies.searchId, SEARCH_ID));
  console.log(`Found ${campaignCompanies.length} companies in campaign ${SEARCH_ID}`);

  console.log("Matching by domain...");
  const matches = matchCompaniesToCampaign(enriched, campaignCompanies);

  const matched = matches.filter(m => m.matchType !== "unmatched");
  const unmatched = matches.filter(m => m.matchType === "unmatched");
  console.log(`Matched: ${matched.length}, Unmatched: ${unmatched.length}`);

  // Show match details
  for (const m of matched) {
    console.log(`  ✓ ${m.leadinfoCompany.companyName} (${m.leadinfoCompany.domain}) → ${m.matchedCompanyName} [${m.matchType}]`);
  }

  // Save to DB
  const batchId = randomUUID();
  let savedCount = 0;

  console.log(`\nSaving to database (batchId: ${batchId})...`);
  for (const m of matches) {
    // Save matched only (same as the original import)
    if (m.matchType === "unmatched") continue;

    const lc = m.leadinfoCompany;
    try {
      await db.insert(leadinfoVisits).values({
        userId: USER_ID,
        searchId: SEARCH_ID,
        companyId: m.matchedCompanyId,
        companyName: lc.companyName,
        domain: lc.domain,
        rawUrl: lc.url,
        city: lc.city || null,
        country: lc.country || null,
        salesRegion: lc.salesRegion || null,
        employees: lc.employees,
        branch: lc.branch || null,
        linkedinUrl: lc.linkedinUrl || null,
        salesVolume: lc.salesVolume || null,
        totalPages: lc.pages,
        totalSessions: lc.sessions,
        totalDuration: lc.duration,
        engagementScore: lc.engagementScore,
        pagesViewed: JSON.stringify(lc.pagesViewed),
        topPages: JSON.stringify(lc.topPages),
        intentSignals: JSON.stringify(lc.intentSignals),
        personas: JSON.stringify(lc.personas),
        importBatchId: batchId,
      });
      savedCount++;
    } catch (err: any) {
      console.error(`  ✗ Failed to save ${lc.companyName}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done! Saved ${savedCount} Leadinfo records for campaign ${SEARCH_ID}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
