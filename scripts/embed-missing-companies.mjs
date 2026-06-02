/**
 * Bulk Embed Missing Companies
 *
 * Finds all companies in MySQL that have NO embedding in Supabase lt_mns_company_embeddings,
 * generates text-embedding-3-small vectors for them, and upserts into Supabase.
 *
 * Usage:
 *   node scripts/embed-missing-companies.mjs [--limit 1000] [--batch 100]
 *
 * After running, re-run abc-centroid-score.mjs to score the newly embedded companies.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import { v5 as uuidv5 } from 'uuid';

const LT_NAMESPACE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Must match server/supabaseEmbeddings.ts
const toUUID = (id) => uuidv5(`company-${id}`, LT_NAMESPACE);

const LIMIT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--limit') ?? '999999');
const EMBED_BATCH = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--batch') ?? '100');
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = await mysql.createConnection(process.env.DATABASE_URL);

// ── Build text to embed for a company (mirrors embeddingService.ts) ───────────
function buildEmbedText(company) {
  const parts = [company.name];
  if (company.primaryDomain) parts.push(company.primaryDomain);
  if (company.sector) parts.push(company.sector);
  if (company.employeeCount) parts.push(`${company.employeeCount} employees`);
  if (company.city) parts.push(company.city);
  if (company.country) parts.push(company.country);
  if (company.shortDescription) parts.push(company.shortDescription);
  if (company.keywords) {
    try { parts.push(JSON.parse(company.keywords).slice(0, 10).join(', ')); } catch {}
  }
  return parts.filter(Boolean).join(' | ');
}

// ── Embed batch via OpenAI ─────────────────────────────────────────────────────
async function embedBatch(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════');
console.log('  BULK EMBED MISSING COMPANIES');
console.log('═══════════════════════════════════════════════════');

// Step 1: Get all MySQL IDs
console.log('[1/4] Loading all company IDs from MySQL...');
const [allCompanies] = await db.execute(
  `SELECT id, name, primaryDomain, sector, employeeCount, city, country, shortDescription, keywords
   FROM companies ORDER BY id ASC LIMIT ?`,
  [LIMIT]
);
console.log(`   Loaded ${allCompanies.length} companies`);

// Step 2: Get all embedded UUIDs from Supabase (paginated)
console.log('[2/4] Loading all embedded UUIDs from Supabase...');
const embeddedUUIDs = new Set();
let page = 0;
while (true) {
  const from = page * 1000;
  const { data, error } = await sb
    .from('lt_mns_company_embeddings')
    .select('watchlist_id')
    .range(from, from + 999);
  if (error) { console.error('Supabase error:', error.message); break; }
  if (!data || data.length === 0) break;
  data.forEach(r => embeddedUUIDs.add(r.watchlist_id));
  page++;
  if (data.length < 1000) break;
}
console.log(`   Found ${embeddedUUIDs.size} existing embeddings`);

// Step 3: Find missing companies
const missing = allCompanies.filter(c => !embeddedUUIDs.has(toUUID(c.id)));
console.log(`   Missing embeddings: ${missing.length} companies`);

if (missing.length === 0) {
  console.log('\n✓ All companies already embedded. Nothing to do.');
  await db.end();
  process.exit(0);
}

// Step 4: Embed in batches and upsert to Supabase
console.log(`[3/4] Embedding ${missing.length} companies in batches of ${EMBED_BATCH}...`);
let embedded = 0;
let failed = 0;

for (let i = 0; i < missing.length; i += EMBED_BATCH) {
  const batch = missing.slice(i, i + EMBED_BATCH);
  const texts = batch.map(buildEmbedText);
  
  try {
    const embeddings = await embedBatch(texts);
    
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
      console.warn(`   Upsert warning batch ${i / EMBED_BATCH + 1}: ${upsertErr.message}`);
      failed += batch.length;
    } else {
      embedded += batch.length;
    }
    
    process.stdout.write(`\r   Progress: ${embedded + failed}/${missing.length} (${embedded} ok, ${failed} failed)`);
    
    // Rate limit: ~3000 tokens/min for embeddings — small pause between batches
    await new Promise(r => setTimeout(r, 200));
    
  } catch (e) {
    console.warn(`\n   Batch ${i / EMBED_BATCH + 1} error: ${e.message}`);
    failed += batch.length;
  }
}

console.log('\n');
console.log('═══════════════════════════════════════════════════');
console.log('  EMBEDDING COMPLETE');
console.log('═══════════════════════════════════════════════════');
console.log(`  Total missing     : ${missing.length}`);
console.log(`  Successfully embedded: ${embedded}`);
console.log(`  Failed            : ${failed}`);
console.log(`  Total in Supabase : ~${embeddedUUIDs.size + embedded}`);
console.log('\n  Next step: run abc-centroid-score.mjs to score the new embeddings');
console.log('═══════════════════════════════════════════════════\n');

await db.end();
