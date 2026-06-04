import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT id, briefData FROM companies 
   WHERE briefData IS NOT NULL AND briefData != '' 
   AND briefData LIKE '%fitScore%'
   LIMIT 3`
);
for (const row of rows) {
  console.log('\n=== Company ID:', row.id, '===');
  try {
    const d = JSON.parse(row.briefData);
    console.log('fitScore:', d.fitScore);
    console.log('fitLabel:', d.fitLabel);
    console.log('fitDimensions:', JSON.stringify(d.fitDimensions, null, 2));
    console.log('fitBreakdown:', JSON.stringify(d.fitBreakdown, null, 2));
    console.log('fitReasoning:', d.fitReasoning);
    console.log('All fit-related keys:', Object.keys(d).filter(k => k.toLowerCase().includes('fit')));
  } catch (e) {
    console.log('Parse error:', e.message);
  }
}
await conn.end();
process.exit(0);
