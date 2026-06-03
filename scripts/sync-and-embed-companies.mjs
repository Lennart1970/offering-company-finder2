/**
 * sync-and-embed-companies.mjs
 *
 * Pipeline: MySQL companies → OpenAI text-embedding-3-small → Supabase
 *
 * UUID resolution strategy:
 *   1. If company already has embedding in lt_mns_company_embeddings → skip (already done)
 *   2. If company already exists in lt_mns_companies (by our v5 UUID) → use that UUID
 *   3. If company exists in lt_mns_companies under a DIFFERENT UUID (name conflict) → use existing UUID
 *   4. Otherwise → insert new row with our v5 UUID, then embed
 *
 * This handles the case where some companies were previously imported under a different UUID namespace.
 *
 * Usage:
 *   node scripts/sync-and-embed-companies.mjs              # full run
 *   node scripts/sync-and-embed-companies.mjs --limit 50   # test with 50
 *   node scripts/sync-and-embed-companies.mjs --batch 200  # larger batches (faster)
 */

import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import { v5 as uuidv5 } from 'uuid';

// ── Constants ────────────────────────────────────────────────────────────────
const LT_NAMESPACE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const toUUID = (id) => uuidv5(`company-${id}`, LT_NAMESPACE);

// ── Args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (flag, def) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : def; };
const LIMIT = parseInt(getArg('--limit', '999999'));
const BATCH = parseInt(getArg('--batch', '25')); // keep small to avoid Supabase statement timeouts
const MAX_RETRIES = 3;

// ── Env check ────────────────────────────────────────────────────────────────
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('❌ OPENAI_API_KEY not set'); process.exit(1); }
if (!DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

// ── Clients ──────────────────────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = await mysql.createConnection(DATABASE_URL);

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  MySQL → OpenAI Embed → Supabase Pipeline');
console.log(`  Limit: ${LIMIT} | Batch: ${BATCH}`);
console.log('══════════════════════════════════════════════════════════════\n');

// ── Step 1: Load all MySQL companies ─────────────────────────────────────────
console.log('[1/4] Loading companies from MySQL...');
const [allCompanies] = await db.execute(
  `SELECT id, name, primaryDomain, sector, headcountGrowth, city, country, revenue
   FROM companies ORDER BY id ASC LIMIT ${LIMIT}`
);
await db.end();
console.log(`   ✓ Loaded ${allCompanies.length} companies`);

// ── Step 2: Find which are already embedded (skip those) ─────────────────────
console.log('\n[2/4] Fetching already-embedded UUIDs from Supabase...');
const embeddedSet = new Set();  // watchlist_ids already in lt_mns_company_embeddings
let page = 0;
while (true) {
  const { data, error } = await sb
    .from('lt_mns_company_embeddings')
    .select('watchlist_id')
    .range(page * 1000, page * 1000 + 999);
  if (error) { console.warn('   ⚠ Pagination error:', error.message); break; }
  if (!data || data.length === 0) break;
  data.forEach(r => embeddedSet.add(r.watchlist_id));
  if (data.length < 1000) break;
  page++;
  if (page % 10 === 0) process.stdout.write(`\r   Fetched ${embeddedSet.size} existing embeddings...`);
}
console.log(`\n   Already embedded: ${embeddedSet.size}`);

// Companies whose v5 UUID is NOT yet in embeddings
const toProcess = allCompanies.filter(c => !embeddedSet.has(toUUID(c.id)));
console.log(`   Need to process: ${toProcess.length}`);

if (toProcess.length === 0) {
  console.log('\n✅ All companies already embedded. Nothing to do.');
  process.exit(0);
}

// ── Step 3: Build UUID resolution map ────────────────────────────────────────
// For each company to process, determine the correct Supabase UUID to use:
//   - Our v5 UUID if it already exists in lt_mns_companies
//   - Existing Supabase UUID if company exists under a different UUID (name conflict)
//   - Our v5 UUID (new insert) if company doesn't exist at all
console.log('\n[3/4] Resolving Supabase UUIDs (handling name conflicts)...');

// First check: which of our v5 UUIDs already exist in lt_mns_companies
const ourUUIDs = toProcess.map(c => toUUID(c.id));
const existingByOurUUID = new Set();
const CHUNK = 400;
for (let i = 0; i < ourUUIDs.length; i += CHUNK) {
  const { data } = await sb.from('lt_mns_companies').select('id').in('id', ourUUIDs.slice(i, i + CHUNK));
  if (data) data.forEach(r => existingByOurUUID.add(r.id));
}
console.log(`   Companies with our UUID already in lt_mns_companies: ${existingByOurUUID.size}`);

  // For companies NOT found by our UUID, check by name AND domain to find conflicts
  const needsResolution = toProcess.filter(c => !existingByOurUUID.has(toUUID(c.id)));
  console.log(`   Companies needing name/domain-based UUID resolution: ${needsResolution.length}`);

  // Build name→existing_uuid and domain→existing_uuid maps for conflict resolution
  const nameToSupabaseUUID = new Map();   // company.name → existing Supabase UUID
  const domainToSupabaseUUID = new Map(); // company.domain → existing Supabase UUID
  const needsNewInsert = [];              // companies that truly don't exist yet

  if (needsResolution.length > 0) {
    // Batch lookup by name — groups of 20
    const NAME_CHUNK = 20;
    for (let i = 0; i < needsResolution.length; i += NAME_CHUNK) {
      const chunk = needsResolution.slice(i, i + NAME_CHUNK);
      const names = chunk.map(c => c.name).filter(Boolean);
      if (names.length === 0) continue;

      const { data } = await sb.from('lt_mns_companies')
        .select('id, company_name, domain')
        .in('company_name', names);

      if (data && data.length > 0) {
        data.forEach(row => {
          if (!nameToSupabaseUUID.has(row.company_name)) {
            nameToSupabaseUUID.set(row.company_name, row.id);
          }
          // Also index by clean domain for fallback
          if (row.domain) {
            const cleanDomain = row.domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
            if (!domainToSupabaseUUID.has(cleanDomain)) {
              domainToSupabaseUUID.set(cleanDomain, row.id);
            }
          }
        });
      }

      if (i % 200 === 0 && i > 0) {
        process.stdout.write(`\r   Resolved ${i}/${needsResolution.length}...`);
      }
    }

    // Also do domain-based lookup for those not found by name
    const notFoundByName = needsResolution.filter(c => !nameToSupabaseUUID.has(c.name));
    if (notFoundByName.length > 0) {
      const DOMAIN_CHUNK = 20;
      for (let i = 0; i < notFoundByName.length; i += DOMAIN_CHUNK) {
        const chunk = notFoundByName.slice(i, i + DOMAIN_CHUNK);
        const domains = chunk.map(c => c.primaryDomain).filter(Boolean);
        if (domains.length === 0) continue;
        // Also try with http:// prefix variants
        const domainVariants = [];
        domains.forEach(d => {
          domainVariants.push(d);
          if (!d.startsWith('http')) domainVariants.push(`http://www.${d}`, `https://www.${d}`);
        });
        const { data } = await sb.from('lt_mns_companies')
          .select('id, company_name, domain')
          .in('domain', domainVariants);
        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.domain) {
              const cleanDomain = row.domain.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
              if (!domainToSupabaseUUID.has(cleanDomain)) domainToSupabaseUUID.set(cleanDomain, row.id);
            }
          });
        }
      }
    }

    // Separate: companies found by name/domain vs truly new
    for (const c of needsResolution) {
      const cleanDomain = (c.primaryDomain || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
      if (!nameToSupabaseUUID.has(c.name) && !domainToSupabaseUUID.has(cleanDomain)) {
        needsNewInsert.push(c);
      }
    }

    console.log(`\n   Found by name (reuse existing UUID): ${nameToSupabaseUUID.size}`);
    console.log(`   Found by domain (reuse existing UUID): ${domainToSupabaseUUID.size}`);
    console.log(`   Truly new (insert with our UUID): ${needsNewInsert.length}`);
  }

// ── Step 4: Insert truly new companies into lt_mns_companies ─────────────────
if (needsNewInsert.length > 0) {
  console.log(`\n   Inserting ${needsNewInsert.length} new companies into lt_mns_companies...`);
  let inserted = 0, insertFailed = 0;
  for (let i = 0; i < needsNewInsert.length; i += BATCH) {
    const batch = needsNewInsert.slice(i, i + BATCH);
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
      console.warn(`\n   ⚠ Insert error batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      insertFailed += batch.length;
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r   Inserted: ${inserted + insertFailed}/${needsNewInsert.length}`);
    await new Promise(r => setTimeout(r, 50));
  }
  console.log(`\n   ✓ Inserted ${inserted}, failed ${insertFailed}`);
}

// ── Step 5: Embed all companies ───────────────────────────────────────────────
console.log(`\n[4/4] Embedding ${toProcess.length} companies in batches of ${BATCH}...\n`);

let embedded = 0, failed = 0;
const startTime = Date.now();

for (let i = 0; i < toProcess.length; i += BATCH) {
  const batch = toProcess.slice(i, i + BATCH);

  // Resolve the correct Supabase UUID for each company in this batch
  const resolvedBatch = batch.map(c => {
    const ourUUID = toUUID(c.id);
    const cleanDomain = (c.primaryDomain || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    // Priority: 1) our UUID in lt_mns_companies, 2) existing UUID by name, 3) by domain, 4) our UUID (new)
    const supabaseUUID = existingByOurUUID.has(ourUUID)
      ? ourUUID
      : (nameToSupabaseUUID.get(c.name) || domainToSupabaseUUID.get(cleanDomain) || ourUUID);
    return { ...c, supabaseUUID };
  });

  // Build embedding texts
  const texts = resolvedBatch.map(c => {
    const parts = [];
    if (c.name) parts.push(c.name);
    if (c.primaryDomain) parts.push(c.primaryDomain);
    if (c.sector) parts.push(c.sector);
    if (c.country) parts.push(c.country);
    if (c.city) parts.push(c.city);
    if (c.revenue) parts.push(`revenue: ${c.revenue}`);
    if (c.headcountGrowth) parts.push(`headcount growth: ${c.headcountGrowth}`);
    return parts.filter(Boolean).join(' | ');
  });

  try {
    // Call OpenAI embeddings API
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    const embeddings = json.data.map(d => d.embedding);

    // Upsert into lt_mns_company_embeddings using the resolved UUID
    // Deduplicate by supabaseUUID — if two MySQL companies resolve to the same
    // Supabase UUID (name conflict), keep only the first occurrence per batch
    const seenUUIDs = new Set();
    const embRows = [];
    resolvedBatch.forEach((company, j) => {
      if (!seenUUIDs.has(company.supabaseUUID)) {
        seenUUIDs.add(company.supabaseUUID);
        embRows.push({
          watchlist_id: company.supabaseUUID,
          content_to_embed: texts[j],
          embedding: JSON.stringify(embeddings[j]),
          last_updated_at: new Date().toISOString(),
        });
      }
    });

    // Retry upsert up to MAX_RETRIES times on timeout
    let embErr = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { error } = await sb
        .from('lt_mns_company_embeddings')
        .upsert(embRows, { onConflict: 'watchlist_id' });
      embErr = error;
      if (!error) break;
      if (error.message.includes('timeout') || error.message.includes('canceling')) {
        await new Promise(r => setTimeout(r, 2000 * attempt)); // exponential backoff
      } else {
        break; // non-timeout error, don't retry
      }
    }

    if (embErr) {
      console.warn(`\n   ⚠ Embedding upsert error (batch ${Math.floor(i / BATCH) + 1}): ${embErr.message}`);
      failed += batch.length;
    } else {
      embedded += batch.length;
    }
  } catch (e) {
    console.warn(`\n   ⚠ Batch ${Math.floor(i / BATCH) + 1} error: ${e.message}`);
    failed += batch.length;
    await new Promise(r => setTimeout(r, 3000)); // back off on error
  }

  // Progress line
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = embedded / Math.max(1, elapsed);
  const remaining = toProcess.length - (embedded + failed);
  const eta = rate > 0 ? Math.round(remaining / rate / 60) : '?';
  process.stdout.write(
    `\r   [${embedded + failed}/${toProcess.length}] ✓ ${embedded} | ✗ ${failed} | ${elapsed.toFixed(0)}s | ~${eta}min left   `
  );

  await new Promise(r => setTimeout(r, 100));
}

const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
console.log(`\n\n══════════════════════════════════════════════════════════════`);
console.log(`  ✅ Pipeline complete`);
console.log(`  Embeddings created/updated: ${embedded}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total time: ${totalTime} minutes`);
console.log(`══════════════════════════════════════════════════════════════`);
console.log(`\n💡 Next: node scripts/run-fit-sim.mjs`);
process.exit(0);
