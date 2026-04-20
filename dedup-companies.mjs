import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find all duplicate groups (same searchId + apolloId)
const [dups] = await conn.execute(`
  SELECT searchId, apolloId, COUNT(*) as cnt
  FROM companies
  WHERE apolloId IS NOT NULL
  GROUP BY searchId, apolloId
  HAVING cnt > 1
`);

console.log(`Found ${dups.length} duplicate groups to clean up`);

let totalDeleted = 0;

for (const dup of dups) {
  // Get all rows for this group, ordered by "richness": enriched > pending, then by briefGeneratedAt desc, then by id asc
  const [rows] = await conn.execute(`
    SELECT id, enrichmentStatus, briefGeneratedAt, salesApproachGeneratedAt, urgencyScore
    FROM companies
    WHERE searchId = ? AND apolloId = ?
    ORDER BY
      CASE enrichmentStatus WHEN 'enriched' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END ASC,
      briefGeneratedAt DESC,
      id ASC
  `, [dup.searchId, dup.apolloId]);

  // Keep the first (most enriched), delete the rest
  const [keep, ...toDelete] = rows;
  const deleteIds = toDelete.map(r => r.id);

  if (deleteIds.length > 0) {
    // Also delete company_brain_outputs for deleted companies
    await conn.execute(`DELETE FROM company_brain_outputs WHERE companyId IN (${deleteIds.map(() => '?').join(',')})`, deleteIds);
    await conn.execute(`DELETE FROM companies WHERE id IN (${deleteIds.map(() => '?').join(',')})`, deleteIds);
    totalDeleted += deleteIds.length;
    console.log(`  search=${dup.searchId} apolloId=${dup.apolloId}: kept id=${keep.id} (${keep.enrichmentStatus}), deleted ${deleteIds.length} duplicates [${deleteIds.join(',')}]`);
  }
}

console.log(`\nDedup complete. Total deleted: ${totalDeleted} rows`);

// Verify
const [remaining] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM (
    SELECT searchId, apolloId FROM companies WHERE apolloId IS NOT NULL
    GROUP BY searchId, apolloId HAVING COUNT(*) > 1
  ) t
`);
console.log(`Remaining duplicate groups: ${remaining[0].cnt}`);

await conn.end();
