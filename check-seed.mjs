import { config } from 'dotenv';
config();
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT id, name, searchId, enrichmentStatus, urgencyScore, briefGeneratedAt,
   CASE WHEN briefData IS NULL THEN 'NULL' WHEN briefData = '' THEN 'EMPTY' ELSE CONCAT('HAS(', LENGTH(briefData), ')') END as briefStatus,
   LEFT(briefData, 150) as briefPreview
   FROM companies WHERE name LIKE '%SEED%' OR name LIKE '%Endoscop%' LIMIT 10`
);
rows.forEach(r => console.log(JSON.stringify({...r, briefPreview: r.briefPreview?.substring(0,100)})));
await conn.end();
