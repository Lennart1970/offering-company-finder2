/**
 * ABC-Centroid Similarity Scorer
 *
 * Option C implementation:
 *   1. Fetch existing ABC scenario embeddings from lt_mns_trigger_references for the target Brain
 *   2. Generate fresh ABC scenarios via LLM, embed them, insert into lt_mns_trigger_references
 *   3. Compute centroid of ALL scenario embeddings (existing + new)
 *   4. Score all embedded companies against the centroid → write to similarityScore in MySQL
 *
 * Usage:
 *   node scripts/abc-centroid-score.mjs [--brain-id 210002] [--generate 30] [--mode all|ungraded]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import { v5 as uuidv5 } from 'uuid';

const LT_NAMESPACE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Must match server/supabaseEmbeddings.ts
function toCompanyUUID(mysqlId) {
  return uuidv5(`company-${mysqlId}`, LT_NAMESPACE);
}

const BRAIN_ID = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--brain-id') ?? '210002');
const GENERATE_COUNT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--generate') ?? '20');
const MODE = process.argv.find((a, i) => process.argv[i - 1] === '--mode') ?? 'all';
const BATCH_SIZE = 1000;

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Use built-in Forge LLM API (same as server-side invokeLLM)
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/$/, '') + '/v1/chat/completions';
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function invokeLLM(messages, responseFormat) {
  const payload = { model: 'gemini-2.5-flash', messages };
  if (responseFormat) payload.response_format = responseFormat;
  const res = await fetch(FORGE_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${FORGE_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`LLM API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
const db = await mysql.createConnection(process.env.DATABASE_URL);

// ── Helpers ────────────────────────────────────────────────────────────────────

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function centroid(vectors) {
  const dim = vectors[0].length;
  const c = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) c[i] += v[i];
  const n = vectors.length;
  for (let i = 0; i < dim; i++) c[i] /= n;
  return c;
}

async function embedText(text) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`Embed API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── Step 1: Load Brain ─────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════');
console.log('  ABC-CENTROID SIMILARITY SCORER');
console.log('═══════════════════════════════════════════════════');
console.log(`[1/5] Loading Brain id=${BRAIN_ID} from MySQL...`);

const [brainRows] = await db.execute(
  `SELECT id, brainName, offeringSummary, coreCapabilities, valuePropositions,
          icpIndustries, icpPainPoints, icpBuyingSignals, urgencyTriggers
   FROM offering_brain WHERE id = ? LIMIT 1`,
  [BRAIN_ID]
);
if (!brainRows.length) { console.error('Brain not found'); process.exit(1); }
const brain = brainRows[0];
console.log(`   Brain: "${brain.brainName}"`);

// ── Step 2: Fetch existing scenario embeddings ─────────────────────────────────

console.log(`\n[2/5] Fetching existing ABC scenario embeddings from Supabase...`);
const { data: existingRefs, error: refErr } = await sb
  .from('lt_mns_trigger_references')
  .select('id, a_event, b_challenge, brain_connection, angle_template, embedding')
  .eq('brain_id', BRAIN_ID)
  .eq('is_active', true)
  .not('embedding', 'is', null);

if (refErr) { console.error('Supabase error:', refErr.message); process.exit(1); }
console.log(`   Found ${existingRefs.length} existing scenario embeddings`);

// Supabase returns embeddings as JSON strings — parse them
const existingVectors = existingRefs.map(r => typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding);

// ── Step 3: Generate fresh ABC scenarios ──────────────────────────────────────

console.log(`\n[3/5] Generating ${GENERATE_COUNT} fresh ABC scenarios via LLM...`);

const icpIndustries = brain.icpIndustries || 'Industrial manufacturing, healthcare, railway, defense';
const offeringSummary = brain.offeringSummary || '';
const urgencyTriggers = brain.urgencyTriggers ? JSON.parse(brain.urgencyTriggers).slice(0, 5).join('; ') : '';
const buyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals).slice(0, 4).join('; ') : '';

const systemPrompt = `You are a B2B sales intelligence expert generating synthetic training scenarios for an AI scoring model.

Your task: generate ${GENERATE_COUNT} diverse, realistic ABC trigger scenarios for the following offering.

OFFERING: ${offeringSummary.substring(0, 500)}
TARGET INDUSTRIES: ${icpIndustries}
BUYING SIGNALS: ${buyingSignals}
URGENCY TRIGGERS: ${urgencyTriggers}

Each scenario must follow the ABC structure:
- A (aEvent): A specific, observable company event or announcement (1-2 sentences, news-headline style)
- B (bChallenge): The business pressure or challenge this event creates for the company
- C (brainConnection): Why Connect Group EMS is uniquely positioned to help right now
- angleTemplate: A concise outreach opening line (max 20 words)

Rules:
1. Cover DIVERSE trigger types: product launches, regulatory changes, capacity expansions, M&A, leadership changes, new facilities, certifications, supply chain issues, market entries
2. Cover DIVERSE industries from the target list — do NOT repeat the same industry more than 3 times
3. Make events specific and realistic (real company names are fine as examples)
4. Vary company sizes: some large OEMs, some mid-market, some scale-ups
5. Include both positive triggers (growth) and stress triggers (problems to solve)
6. Each scenario should feel like a real news item that a sales rep would act on

Return a JSON object with key "scenarios" containing an array of exactly ${GENERATE_COUNT} objects.
Each object must have keys: aEvent, bChallenge, brainConnection, angleTemplate, signalType
signalType must be one of: Product Launch, Regulatory Change, Capacity Expansion, M&A Activity, Leadership Change, New Facility, Certification, Supply Chain Issue, Market Entry, Technology Upgrade
Keep each field SHORT (max 25 words each) to avoid truncation.`;

// Generate in batches of 10 to avoid JSON truncation
const BATCH_GEN = 10;
const numBatches = Math.ceil(GENERATE_COUNT / BATCH_GEN);
let newScenarios = [];

for (let b = 0; b < numBatches; b++) {
  const batchCount = Math.min(BATCH_GEN, GENERATE_COUNT - b * BATCH_GEN);
  process.stdout.write(`   Batch ${b + 1}/${numBatches} (${batchCount} scenarios)... `);
  try {
    const rawContent = await invokeLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate exactly ${batchCount} ABC scenarios (batch ${b + 1}). Return {"scenarios": [...]}. Max 20 words per field.` }
      ],
      { type: 'json_object' }
    );
    const parsed = JSON.parse(rawContent);
    const batch = Array.isArray(parsed) ? parsed : parsed.scenarios || parsed.data || Object.values(parsed)[0];
    newScenarios.push(...batch);
    console.log(`ok (${batch.length})`);
  } catch (e) {
    console.warn(`failed: ${e.message}`);
  }
}
console.log(`   Generated ${newScenarios.length} scenarios total`);

// ── Step 4: Embed new scenarios and insert into Supabase ──────────────────────

console.log(`\n[4/5] Embedding and inserting ${newScenarios.length} new scenarios...`);
const newVectors = [];
let inserted = 0;

for (const scenario of newScenarios) {
  const text = `${scenario.aEvent} ${scenario.bChallenge} ${scenario.brainConnection}`;
  try {
    const embedding = await embedText(text); // already a number[]
    newVectors.push(embedding);

    const { error: insertErr } = await sb.from('lt_mns_trigger_references').insert({
      brain_id: BRAIN_ID,
      brain_name: brain.brainName,
      headline: scenario.aEvent,
      snippet: scenario.bChallenge,
      a_event: scenario.aEvent,
      b_challenge: scenario.bChallenge,
      brain_connection: scenario.brainConnection,
      angle_template: scenario.angleTemplate,
      signal_type: scenario.signalType || 'Product Launch',
      trigger_type: 'direct',
      source_type: 'synthetic',
      is_active: true,
      quality_score: 0.8,
      embedding,
    });

    if (insertErr) {
      console.warn(`   Insert warning: ${insertErr.message}`);
    } else {
      inserted++;
    }
  } catch (e) {
    console.warn(`   Embed error for scenario: ${e.message}`);
  }
}
console.log(`   Inserted ${inserted}/${newScenarios.length} new scenarios`);

// ── Step 5: Compute centroid and score companies ───────────────────────────────

const allVectors = [...existingVectors, ...newVectors];
console.log(`\n[5/5] Computing centroid from ${allVectors.length} scenario vectors...`);
const centroidVector = centroid(allVectors);
console.log(`   Centroid computed (${centroidVector.length} dims)`);

// Build UUID→MySQL ID map using deterministic uuidv5 (same as score-all-against-active-brain.mjs)
const [companyRows] = await db.execute('SELECT id FROM companies');
const uuidToId = new Map(companyRows.map(r => [toCompanyUUID(r.id), r.id]));
console.log(`   UUID→MySQL map: ${uuidToId.size} companies`);

// Score all embedded companies
let page = 0;
let totalScored = 0;
let totalUpdated = 0;
const updates = [];

while (true) {
  const from = page * BATCH_SIZE;
  const to = from + BATCH_SIZE - 1;
  process.stdout.write(`   Scoring page ${page + 1} (rows ${from}–${to})... `);

  const { data: rows, error: pageErr } = await sb
    .from('lt_mns_company_embeddings')
    .select('watchlist_id, embedding')
    .range(from, to);

  if (pageErr) { console.error(pageErr.message); break; }
  if (!rows || rows.length === 0) { console.log('done.'); break; }

  for (const row of rows) {
    const mysqlId = uuidToId.get(row.watchlist_id);
    if (!mysqlId) continue;
    const embVec = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
    const sim = cosine(centroidVector, embVec);
    const score = Math.round(sim * 100);
    updates.push([score, new Date(), mysqlId]);
  }

  totalScored += rows.length;
  console.log(`${rows.length} rows`);
  page++;
  if (rows.length < BATCH_SIZE) break;
}

// Batch write to MySQL — write to urgencyScore (ABC scenario match = urgency signal)
console.log(`\n   Writing ${updates.length} ABC urgency scores to MySQL (urgencyScore)...`);
const chunkSize = 500;
for (let i = 0; i < updates.length; i += chunkSize) {
  const chunk = updates.slice(i, i + chunkSize);
  for (const [score, ts, id] of chunk) {
    await db.execute(
      'UPDATE companies SET urgencyScoreSynth = ?, urgencyScoreSynthGeneratedAt = ? WHERE id = ?',
      [score, ts, id]
    );
  }
  totalUpdated += chunk.length;
  console.log(`   Updated ${totalUpdated}/${updates.length}...`);
}

// Summary
const scores = updates.map(u => u[0]);
const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
const high = scores.filter(s => s >= 70).length;
const med = scores.filter(s => s >= 50 && s < 70).length;
const low = scores.filter(s => s < 50).length;

console.log('\n═══════════════════════════════════════════════════');
console.log('  ABC-CENTROID SCORING COMPLETE');
console.log('═══════════════════════════════════════════════════');
console.log(`  Brain                  : ${brain.brainName}`);
console.log(`  Existing scenarios     : ${existingRefs.length}`);
console.log(`  New scenarios generated: ${inserted}`);
console.log(`  Total centroid vectors : ${allVectors.length}`);
console.log(`  Companies scored       : ${totalUpdated}`);
console.log(`  Score range            : ${Math.min(...scores)} – ${Math.max(...scores)} (avg ${avg})`);
console.log(`  High fit (≥70)         : ${high} (${Math.round(high/totalUpdated*100)}%)`);
console.log(`  Medium fit (50–69)     : ${med} (${Math.round(med/totalUpdated*100)}%)`);
console.log(`  Low fit (<50)          : ${low} (${Math.round(low/totalUpdated*100)}%)`);
console.log('═══════════════════════════════════════════════════\n');

await db.end();
