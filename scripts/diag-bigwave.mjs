import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Find Bigwave in MySQL
const [rows] = await conn.execute(
  "SELECT id, name, apolloId, sector, similarityScore, primaryDomain FROM companies WHERE name LIKE '%Bigwave%' LIMIT 10"
);
console.log('\n=== MySQL: Bigwave rows ===');
rows.forEach(r => console.log(JSON.stringify(r)));

// 2. Check what tables have campaign-company relationship
const [tables] = await conn.execute("SHOW TABLES");
const tableNames = tables.map(t => Object.values(t)[0]);
const campaignTables = tableNames.filter(t => t.toLowerCase().includes('campaign'));
console.log('\n=== Campaign-related tables ===', campaignTables);

// 3. Check lt_mns_companies in Supabase for Bigwave
const { data: sbRows } = await sb.from('lt_mns_companies')
  .select('id, company_name, domain, campaign_id, campaign_name')
  .ilike('company_name', '%Bigwave%');
console.log('\n=== Supabase lt_mns_companies: Bigwave rows ===');
(sbRows || []).forEach(r => console.log(JSON.stringify(r)));

// 4. Check if lt_mns_companies has campaign_id column
const { data: sample } = await sb.from('lt_mns_companies').select('*').limit(1);
if (sample && sample[0]) {
  console.log('\n=== lt_mns_companies columns ===', Object.keys(sample[0]));
}

// 5. Check if there's a separate campaign-company join table in Supabase
// by looking at what tables exist
const { data: pgTables } = await sb.rpc('exec_sql', { 
  query: "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%campaign%'" 
}).catch(() => ({ data: null }));
console.log('\n=== Supabase campaign tables ===', pgTables);

await conn.end();
