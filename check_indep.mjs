import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, name, country, briefData FROM companies WHERE name LIKE '%Independence Automation%' LIMIT 1"
);
if (!rows.length) { console.log('NOT FOUND'); process.exit(0); }
const r = rows[0];
console.log('ID:', r.id, '| name:', r.name, '| country:', r.country);
const bd = JSON.parse(r.briefData || '{}');
console.log('KEYS:', Object.keys(bd).join(', '));
const es = bd.executiveSummary;
console.log('executiveSummary type:', typeof es);
console.log('executiveSummary:', JSON.stringify(es)?.substring(0, 500));
const ps = bd.productsServices?.[0];
console.log('productsServices[0]:', JSON.stringify(ps)?.substring(0, 500));
const rd = bd.recentDevelopments?.[0];
console.log('recentDevelopments[0]:', JSON.stringify(rd)?.substring(0, 300));
await conn.end();
