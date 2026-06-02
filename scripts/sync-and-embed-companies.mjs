/**
 * Sync and Embed Missing Companies
 *
 * Step 1: Find MySQL companies missing from lt_mns_companies (Supabase) and insert them.
 * Step 2: Find companies missing from lt_mns_company_embeddings and embed them.
 * Step 3: After embedding, re-run FIT-SIM scoring.
 *
 * Usage:
 *   node scripts/sync-and-embed-companies.mjs [--limit 999999] [--batch 100]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import { v5 as uuidv5 } from 'uuid';

const LT_NAMESPACE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const toUUID = (id) => uuidv5(`company-${id}`, LT_NAMESPACE);

const LIMIT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--limit') ?? '999999');
const EMBED_BATCH = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--batch') ?? '100');
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = await mysql.createConnection(process.env.DATABASE_URL);

console.log('\n═══════════════════════════════════════════════════');
console.log('  SYNC & EMBED MISSING COMPANIES');
console.log('═══════════════════════════════════════════════════\n');

// ── Step 1: Load all MySQL companies ─────────────────────────────────────────
console.log('[1/5] Loading companies from MySQL...');
const [allCompanies] = await db.execute(
  `SELECT id, name, primaryDomain, sector, headcountGrowth, city, country, revenue
   FROM companies ORDER BY id ASC LIMIT ${LIMIT}`
);
console.log(`   Loaded ${allCompanies.length} companies`);

// ── Step 2: Find which are missing from lt_mns_companies ─────────────────────
console.log('[2/5] Checking which companies are missing from Supabase lt_mns_companies...');
const allUUIDs = allCompanies.map(c => toUUID(c.id));
const existingUUIDs = new Set();

// Page through lt_mns_companies to find existing UUIDs
// We check in chunks of 500 to avoid URL length limits
const CHUNK = 500;
for (let i = 0; i < allUUIDs.length; i += CHUNK) {
  const chunk = allUUIDs.slice(i, i + CHUNK);
  const { data, error } = await sb.from('lt_mns_companies').select('id').in('id', chunk);
  if (error) {
    console.warn(`   Warning checking chunk ${i}-${i + CHUNK}: ${error.message}`);
  } else {
    data.forEach(r => existingUUIDs.add(r.id));
  }
  if (i % 5000 === 0 && i > 0) process.stdout.write(`\r   Checked ${i}/${allUUIDs.length}...`);
}
console.log(`\n   Already in lt_mns_companies: ${existingUUIDs.size}`);

const missingFromSupabase = allCompanies.filter(c => !existingUUIDs.has(toUUID(c.id)));
console.log(`   Missing from lt_mns_companies: ${missingFromSupabase.length}`);

// ── Step 3: Insert missing companies into lt_mns_companies ───────────────────
if (missingFromSupabase.length > 0) {
  console.log(`[3/5] Inserting ${missingFromSupabase.length} companies into lt_mns_companies...`);
  let synced = 0;
  let syncFailed = 0;
  for (let i = 0; i < missingFromSupabase.length; i += EMBED_BATCH) {
    const batch = missingFromSupabase.slice(i, i + EMBED_BATCH);
    const rows = batch.map(c => ({
      id: toUUID(c.id),
      company_name: c.name || 'Unknown',
      domain: c.primaryDomain || null,
      sector: c.sector || null,
      country: c.country || null,
      city: c.city || null,
      revenue_range: c.revenue || null,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await sb.from('lt_mns_companies').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn(`\n   Sync warning batch ${Math.floor(i / EMBED_BATCH) + 1}: ${error.message}`);
      syncFailed += batch.length;
    } else {
      synced += batch.length;
    }
    process.stdout.write(`\r   Synced: ${synced + syncFailed}/${missingFromSupabase.length} (${synced} ok, ${syncFailed} failed)`);
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\n   ✅ Sync complete: ${synced} inserted, ${syncFailed} failed`);
} else {
  console.log('[3/5] All companies already in lt_mns_companies — skipping sync');
}

// ── Step 4: Find companies missing from lt_mns_company_embeddings ────────────
console.log('[4/5] Checking which companies are missing embeddings...');
const embeddedUUIDs = new Set();
let page = 0;
while (true) {
  const from = page * 1000;
  const { data, error } = await sb
    .from('lt_mns_company_embeddings')
    .select('watchlist_id')
    .range(from, from + 999);
  if (error || !data || data.length === 0) break;
  data.forEach(r => embeddedUUIDs.add(r.watchlist_id));
  if (data.length < 1000) break;
  page++;
}
console.log(`   Already embedded: ${embeddedUUIDs.size}`);

const missingEmbeddings = allCompanies.filter(c => !embeddedUUIDs.has(toUUID(c.id)));
console.log(`   Missing embeddings: ${missingEmbeddings.length}`);

// ── Step 5: Embed missing companies ──────────────────────────────────────────
if (missingEmbeddings.length === 0) {
  console.log('[5/5] All companies already embedded — nothing to do!');
} else {
  console.log(`[5/5] Embedding ${missingEmbeddings.length} companies in batches of ${EMBED_BATCH}...`);
  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < missingEmbeddings.length; i += EMBED_BATCH) {
    const batch = missingEmbeddings.slice(i, i + EMBED_BATCH);
    const texts = batch.map(c => {
      const parts = [c.name];
      if (c.primaryDomain) parts.push(c.primaryDomain);
      if (c.sector) parts.push(c.sector);
      if (c.headcountGrowth) parts.push(`headcount: ${c.headcountGrowth}`);
      if (c.city) parts.push(c.city);
      if (c.country) parts.push(c.country);
      if (c.revenue) parts.push(`revenue: ${c.revenue}`);
      return parts.filter(Boolean).join(' | ');
    });

    try {
      // Call OpenAI embeddings API
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
      });
      if (!res.ok) throw new Error(`OpenAI embed error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const embeddings = data.data.map(d => d.embedding);

      const rows = batch.map((company, j) => ({
        watchlist_id: toUUID(company.id),
        content_to_embed: texts[j],
        embedding: JSON.stringify(embeddings[j]),
        last_updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await sb
        .from('lt_mns_company_embeddings')
        .upsert(rows, { onConflict: 'watchlist_id' });

      if (upsertErr) {
        console.warn(`\n   Upsert warning batch ${Math.floor(i / EMBED_BATCH) + 1}: ${upsertErr.message}`);
        failed += batch.length;
      } else {
        embedded += batch.length;
      }
    } catch (e) {
      console.warn(`\n   Batch ${Math.floor(i / EMBED_BATCH) + 1} error: ${e.message}`);
      failed += batch.length;
    }

    process.stdout.write(`\r   Progress: ${embedded + failed}/${missingEmbeddings.length} (${embedded} ok, ${failed} failed)`);
    await new Promise(r => setTimeout(r, 200)); // rate limit pause
  }
  console.log(`\n\n✅ Embedding complete: ${embedded} embedded, ${failed} failed`);
  console.log('\n💡 Next: run "node scripts/run-fit-sim.mjs" to score all newly embedded companies');
}

await db.end();
process.exit(0);
