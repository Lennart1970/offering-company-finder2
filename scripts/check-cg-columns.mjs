import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: '/home/ubuntu/offering-company-finder/.env' });

const url = process.env.DATABASE_URL;
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/);
const [, user, pass, host, port, db] = match;

const conn = await mysql.createConnection({
  host, port: parseInt(port || '4000'), user, password: pass, database: db,
  ssl: { rejectUnauthorized: true }
});

// Check CG columns
const [rows] = await conn.execute("SHOW COLUMNS FROM companies LIKE 'cg%'");
console.log('CG columns:', rows.map(r => r.Field));

// Check if getCompanyDbMeta would work
const [searches] = await conn.execute("SELECT COUNT(*) as cnt FROM searches");
console.log('Searches count:', searches[0].cnt);

const [countries] = await conn.execute("SELECT COUNT(DISTINCT country) as cnt FROM companies WHERE country IS NOT NULL AND country != ''");
console.log('Countries count:', countries[0].cnt);

const [sectors] = await conn.execute("SELECT COUNT(DISTINCT sector) as cnt FROM companies WHERE sector IS NOT NULL");
console.log('Sectors count:', sectors[0].cnt);

// Test the count() issue in TiDB
try {
  const [cgBu] = await conn.execute("SELECT cgBusinessUnit as bu, COUNT(*) as cnt FROM companies WHERE cgBusinessUnit IS NOT NULL GROUP BY cgBusinessUnit ORDER BY COUNT(*) DESC LIMIT 5");
  console.log('CG BU rows:', cgBu.length, cgBu.slice(0, 3));
} catch(e) {
  console.error('CG BU query error:', e.message);
}

// Check if there are any CG-imported companies
const [cgCount] = await conn.execute("SELECT COUNT(*) as cnt FROM companies WHERE cgBusinessUnit IS NOT NULL");
console.log('Companies with CG data:', cgCount[0].cnt);

await conn.end();
