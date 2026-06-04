import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT id, name, fitScore, fitScoreData FROM companies WHERE fitScore IS NOT NULL AND fitScoreData IS NOT NULL AND fitScoreData != "" LIMIT 3'
);
for (const row of rows) {
  console.log('\n=== Company:', row.companyName, '| fitScore:', row.fitScore, '===');
  try {
    const d = JSON.parse(row.fitScoreData);
    console.log('Keys:', Object.keys(d));
    console.log(JSON.stringify(d, null, 2).slice(0, 1500));
  } catch (e) {
    console.log('Parse error:', e.message);
  }
}
await conn.end();
