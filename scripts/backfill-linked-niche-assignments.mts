/**
 * Backfill niche assignments for linked campaign companies.
 *
 * Before nicheRouter used companyBelongsToSearch(), companies attached via
 * search_company_memberships were invisible to k-means. They appear in the
 * campaign but keep nicheId NULL (or a stale nicheId from another campaign).
 *
 * This script finds those companies per search, embeds them, and assigns each
 * to the nearest existing niche centroid (same type-split rules as Phase 2).
 *
 * Usage:
 *   npx tsx scripts/backfill-linked-niche-assignments.mts --searchId 1800001
 *   npx tsx scripts/backfill-linked-niche-assignments.mts --all
 *   npx tsx scripts/backfill-linked-niche-assignments.mts --searchId 1800001 --dry-run
 *
 * Requires: DATABASE_URL, OPENAI_API_KEY
 */

import dotenv from "dotenv";
dotenv.config();

import { isNotNull, and, isNull } from "drizzle-orm";
import {
  getCompaniesBySearchId,
  getDb,
  getNichesBySearchId,
  updateCompany,
  updateNiche,
} from "../server/db";
import { generateEmbeddings } from "../server/embeddingService";
import { assignRemainingByProximity } from "../server/clusteringService";
import { splitByCompanyType } from "../server/companyTypeClassifier";
import { niches } from "../drizzle/schema";
import type { Company } from "../drizzle/schema";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allSearches = args.includes("--all");
const searchIdArg = args.find((a, i) => args[i - 1] === "--searchId");
const searchId = searchIdArg ? Number(searchIdArg) : null;

if (!allSearches && (searchId == null || Number.isNaN(searchId))) {
  console.error("Usage: npx tsx scripts/backfill-linked-niche-assignments.mts --searchId <id>");
  console.error("   or: npx tsx scripts/backfill-linked-niche-assignments.mts --all");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

type NicheCentroid = { nicheId: number; centroid: number[] };

function parseCentroids(savedNiches: Awaited<ReturnType<typeof getNichesBySearchId>>) {
  const withCentroid = savedNiches.filter((n) => n.centroid && !n.parentNicheId);
  const mfgCentroids: NicheCentroid[] = withCentroid
    .filter((n) => n.name.startsWith("[Manufacturing]"))
    .map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid!) as number[] }));
  const svcCentroids: NicheCentroid[] = withCentroid
    .filter((n) => n.name.startsWith("[Service]"))
    .map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid!) as number[] }));
  const untaggedCentroids: NicheCentroid[] = withCentroid
    .filter((n) => !n.name.startsWith("[Manufacturing]") && !n.name.startsWith("[Service]"))
    .map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid!) as number[] }));
  const allCentroids = [...mfgCentroids, ...svcCentroids, ...untaggedCentroids];
  const hasTypeSplit = mfgCentroids.length > 0 && svcCentroids.length > 0;
  return { mfgCentroids, svcCentroids, untaggedCentroids, allCentroids, hasTypeSplit };
}

function companiesNeedingAssignment(
  allCompanies: Company[],
  nicheIdsForSearch: Set<number>
): Company[] {
  return allCompanies.filter(
    (c) => c.nicheId == null || !nicheIdsForSearch.has(c.nicheId)
  );
}

async function refreshNicheCounts(searchId: number, dryRun: boolean) {
  const allCompanies = await getCompaniesBySearchId(searchId);
  const nicheCounts = new Map<number, number>();
  for (const company of allCompanies) {
    if (company.nicheId) {
      nicheCounts.set(company.nicheId, (nicheCounts.get(company.nicheId) ?? 0) + 1);
    }
  }
  if (!dryRun) {
    for (const [nicheId, count] of nicheCounts) {
      await updateNiche(nicheId, { companyCount: count });
    }
  }
  return nicheCounts.size;
}

async function backfillSearch(targetSearchId: number): Promise<{
  searchId: number;
  assigned: number;
  skipped: number;
  needsAssignment: number;
}> {
  const savedNiches = await getNichesBySearchId(targetSearchId);
  const { mfgCentroids, svcCentroids, allCentroids, hasTypeSplit } = parseCentroids(savedNiches);

  if (allCentroids.length === 0) {
    console.log(`  searchId=${targetSearchId}: no niches with centroids — skip`);
    return { searchId: targetSearchId, assigned: 0, skipped: 1, needsAssignment: 0 };
  }

  const nicheIdsForSearch = new Set(savedNiches.map((n) => n.id));
  const allCompanies = await getCompaniesBySearchId(targetSearchId);
  const toAssign = companiesNeedingAssignment(allCompanies, nicheIdsForSearch);

  if (toAssign.length === 0) {
    console.log(`  searchId=${targetSearchId}: all ${allCompanies.length} companies already assigned to campaign niches`);
    return { searchId: targetSearchId, assigned: 0, skipped: 0, needsAssignment: 0 };
  }

  // Highlight linked-only rows (home searchId differs from campaign)
  const linkedOnly = toAssign.filter((c) => c.searchId !== targetSearchId);
  console.log(
    `  searchId=${targetSearchId}: ${toAssign.length} need assignment (${linkedOnly.length} linked-only, ${allCompanies.length} total in campaign)`
  );

  if (dryRun) {
    const sample = toAssign.slice(0, 10).map((c) => c.name);
    console.log(`  [dry-run] would assign: ${sample.join(", ")}${toAssign.length > 10 ? " …" : ""}`);
    return { searchId: targetSearchId, assigned: 0, skipped: 0, needsAssignment: toAssign.length };
  }

  let assigned = 0;

  if (hasTypeSplit) {
    const { manufacturing: mfgCompanies, service: svcCompanies } = splitByCompanyType(toAssign);

    if (mfgCompanies.length > 0 && mfgCentroids.length > 0) {
      const emb = await generateEmbeddings(mfgCompanies);
      const map = await assignRemainingByProximity(emb, mfgCentroids);
      for (const [companyId, nicheId] of map) {
        await updateCompany(companyId, { nicheId });
        assigned++;
      }
    } else if (mfgCompanies.length > 0) {
      const emb = await generateEmbeddings(mfgCompanies);
      const map = await assignRemainingByProximity(emb, allCentroids);
      for (const [companyId, nicheId] of map) {
        await updateCompany(companyId, { nicheId });
        assigned++;
      }
    }

    if (svcCompanies.length > 0 && svcCentroids.length > 0) {
      const emb = await generateEmbeddings(svcCompanies);
      const map = await assignRemainingByProximity(emb, svcCentroids);
      for (const [companyId, nicheId] of map) {
        await updateCompany(companyId, { nicheId });
        assigned++;
      }
    } else if (svcCompanies.length > 0) {
      const emb = await generateEmbeddings(svcCompanies);
      const map = await assignRemainingByProximity(emb, allCentroids);
      for (const [companyId, nicheId] of map) {
        await updateCompany(companyId, { nicheId });
        assigned++;
      }
    }
  } else {
    const emb = await generateEmbeddings(toAssign);
    const map = await assignRemainingByProximity(emb, allCentroids);
    for (const [companyId, nicheId] of map) {
      await updateCompany(companyId, { nicheId });
      assigned++;
    }
  }

  const nichesUpdated = await refreshNicheCounts(targetSearchId, false);
  console.log(`  searchId=${targetSearchId}: assigned ${assigned}, refreshed counts on ${nichesUpdated} niches`);

  return { searchId: targetSearchId, assigned, skipped: 0, needsAssignment: toAssign.length };
}

async function listSearchIdsWithNiches(): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .selectDistinct({ searchId: niches.searchId })
    .from(niches)
    .where(and(isNotNull(niches.searchId), isNotNull(niches.centroid), isNull(niches.parentNicheId)));

  return rows
    .map((r) => r.searchId)
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b);
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  BACKFILL: linked company niche assignments");
  console.log(`  mode: ${dryRun ? "DRY RUN" : "LIVE"} | ${allSearches ? "all searches" : `searchId=${searchId}`}`);
  console.log("═══════════════════════════════════════════════════\n");

  const searchIds = allSearches ? await listSearchIdsWithNiches() : [searchId!];
  console.log(`Processing ${searchIds.length} search(es)…\n`);

  let totalAssigned = 0;
  let totalNeeds = 0;
  let searchesSkipped = 0;

  for (const sid of searchIds) {
    try {
      const result = await backfillSearch(sid);
      totalAssigned += result.assigned;
      totalNeeds += result.needsAssignment;
      searchesSkipped += result.skipped;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  searchId=${sid}: FAILED — ${msg}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Done. ${totalAssigned} companies assigned across ${searchIds.length - searchesSkipped} searches.`);
  if (dryRun) console.log(`  Dry run: ${totalNeeds} companies would be assigned.`);
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
