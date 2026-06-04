import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, name, fitScoreData FROM companies WHERE name LIKE '%Independence Automation%' LIMIT 1"
);
if (!rows.length) { console.log('NOT FOUND'); process.exit(0); }
const r = rows[0];
const fsd = JSON.parse(r.fitScoreData || '{}');
console.log('fitScoreData keys:', Object.keys(fsd).join(', '));
console.log('narrative/summary:', JSON.stringify(fsd.narrative || fsd.summary || fsd.executiveSummary || fsd.overallAssessment || fsd.reasoning)?.substring(0, 600));
// print all string values at top level
for (const [k, v] of Object.entries(fsd)) {
  if (typeof v === 'string' && v.length > 30) console.log(`${k}:`, v.substring(0, 300));
}
await conn.end();
