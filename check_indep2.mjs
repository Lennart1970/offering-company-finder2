import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, name, country, city, state, rawAddress, streetAddress, websiteUrl, sourceCountryCode FROM companies WHERE name LIKE '%Independence Automation%' LIMIT 1"
);
if (!rows.length) { console.log('NOT FOUND'); process.exit(0); }
const r = rows[0];
console.log(JSON.stringify(r, null, 2));
await conn.end();
