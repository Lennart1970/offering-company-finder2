/**
 * debug-constraint.mjs
 * Diagnoses the duplicate key constraint on lt_mns_companies
 */
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import { v5 as uuidv5 } from 'uuid';

const LT_NAMESPACE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const toUUID = (id) => uuidv5(`company-${id}`, LT_NAMESPACE);

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get first 50 MySQL companies
const [rows] = await conn.execute('SELECT id, name, primaryDomain FROM companies ORDER BY id ASC LIMIT 50');
await conn.end();

// Find which are not yet embedded
const uuids = rows.map(r => toUUID(r.id));
const { data: embedded } = await sb.from('lt_mns_company_embeddings').select('watchlist_id').in('watchlist_id', uuids);
const embSet = new Set((embedded || []).map(e => e.watchlist_id));
const missing = rows.filter(r => !embSet.has(toUUID(r.id)));

console.log('Missing embeddings:', missing.length);
missing.slice(0, 5).forEach(r => console.log(' id:', r.id, '| name:', r.name?.slice(0,40), '| domain:', r.primaryDomain));

// For each missing company, check if a row with same name+domain exists under a different UUID
console.log('\nChecking for name/domain conflicts in lt_mns_companies:');
for (const c of missing.slice(0, 5)) {
  const ourUUID = toUUID(c.id);
  
  // Check by name
  const { data: byName } = await sb.from('lt_mns_companies')
    .select('id, company_name, domain')
    .eq('company_name', c.name || '');
  
  if (byName && byName.length > 0) {
    console.log(`\n  "${c.name}" (our UUID: ${ourUUID})`);
    byName.forEach(r => {
      const isOurs = r.id === ourUUID;
      console.log(`    ${isOurs ? '✓ OUR UUID' : '⚠ DIFFERENT UUID'}: ${r.id} | domain: ${r.domain}`);
    });
  } else {
    console.log(`\n  "${c.name}" → not found in lt_mns_companies at all`);
  }
}

// Also check the constraint name to understand what columns it covers
console.log('\nChecking constraint details...');
const { data: sample, error } = await sb.from('lt_mns_companies').upsert([{
  id: toUUID(missing[0]?.id || 1),
  company_name: missing[0]?.name || 'Test',
  domain: missing[0]?.primaryDomain || null,
  synced_at: new Date().toISOString(),
}], { onConflict: 'id' });
if (error) {
  console.log('Upsert error:', error.message);
  console.log('Error code:', error.code);
  console.log('Error details:', JSON.stringify(error.details));
} else {
  console.log('Upsert succeeded for first missing company');
}

process.exit(0);
