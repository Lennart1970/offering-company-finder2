import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, name, country, websiteUrl, briefData, fitScoreData FROM companies WHERE name LIKE '%JBT Automated%' LIMIT 3"
);
if (!rows.length) { console.log('NOT FOUND'); process.exit(0); }
for (const r of rows) {
  console.log('\n=== COMPANY:', r.name, '(id:', r.id, ') country:', r.country, '===');
  console.log('websiteUrl:', r.websiteUrl);
  
  // briefData
  const bd = JSON.parse(r.briefData || '{}');
  console.log('briefData keys:', Object.keys(bd).join(', '));
  if (bd.executiveSummary) console.log('executiveSummary type:', typeof bd.executiveSummary, JSON.stringify(bd.executiveSummary).substring(0, 200));
  if (Array.isArray(bd.productsServices)) console.log('productsServices[0]:', JSON.stringify(bd.productsServices[0]).substring(0, 200));
  
  // fitScoreData
  const fsd = JSON.parse(r.fitScoreData || '{}');
  console.log('fitScoreData keys:', Object.keys(fsd).join(', '));
  for (const [k, v] of Object.entries(fsd)) {
    if (typeof v === 'string' && v.length > 50) console.log(`  fitScoreData.${k}:`, v.substring(0, 300));
  }
}
await conn.end();
