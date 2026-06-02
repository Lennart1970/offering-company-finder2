/**
 * News Urgency Scorer (Path D)
 *
 * For each company (in batches):
 *   1. Fetch Google News snippets via Serper API
 *   2. Concatenate top-3 snippet texts into a single "news summary"
 *   3. Embed the news summary (OpenAI text-embedding-3-small)
 *   4. Compute cosine similarity vs the ABC scenario centroid for the active Brain
 *   5. Write score (0-100) to MySQL companies.urgencyScoreNews
 *
 * The centroid is computed fresh each run from lt_mns_trigger_references in Supabase.
 *
 * Usage:
 *   node scripts/news-urgency-score.mjs [--brain-id 210002] [--limit 500] [--mode all|unscored]
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SERPER_API_KEY, OPENAI_API_KEY
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

const BRAIN_ID = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--brain-id') ?? '210002');
const LIMIT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--limit') ?? '500');
const MODE = process.argv.find((a, i) => process.argv[i - 1] === '--mode') ?? 'unscored';
const SERPER_DELAY_MS = 1200; // ~50 req/min safe rate

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function fetchNewsSnippets(companyName, domain) {
  const query = domain ? `${companyName} site:${domain} OR ${companyName}` : companyName;
  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 5, tbs: 'qdr:y' }), // past year
  });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data.news ?? [];
  if (items.length === 0) return null;
  // Concatenate top-3 title + snippet for embedding
  return items.slice(0, 3).map(n => `${n.title ?? ''}. ${n.snippet ?? ''}`).join(' ');
}

// ─── Step 1: Build ABC centroid from Supabase ─────────────────────────────────

async function buildCentroid(brainId) {
  console.log(`\n📐 Building ABC scenario centroid for Brain ${brainId}...`);
  let page = 0;
  const PAGE = 500;
  const allEmbeddings = [];

  while (true) {
    const { data, error } = await sb
      .from('lt_mns_trigger_references')
      .select('embedding')
      .eq('brain_id', brainId)
      .eq('is_active', true)
      .not('embedding', 'is', null)
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      let vec = row.embedding;
      if (typeof vec === 'string') {
        vec = JSON.parse(vec);
      }
      if (Array.isArray(vec) && vec.length === 1536) {
        allEmbeddings.push(vec);
      }
    }
    if (data.length < PAGE) break;
    page++;
  }

  if (allEmbeddings.length === 0) throw new Error('No valid embeddings found for centroid');
  console.log(`   ✓ ${allEmbeddings.length} scenario embeddings loaded`);

  // Compute centroid: element-wise average
  const dim = allEmbeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const vec of allEmbeddings) {
    for (let i = 0; i < dim; i++) centroid[i] += vec[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= allEmbeddings.length;

  return centroid;
}

// ─── Step 2: Fetch companies to score ─────────────────────────────────────────

async function fetchCompanies(db, mode, limit) {
  let sql;
  if (mode === 'unscored') {
    sql = `SELECT id, name, primaryDomain FROM companies 
           WHERE urgencyScoreNews IS NULL AND name IS NOT NULL 
           ORDER BY fitScore DESC, id ASC 
           LIMIT ?`;
  } else {
    sql = `SELECT id, name, primaryDomain FROM companies 
           WHERE name IS NOT NULL 
           ORDER BY fitScore DESC, id ASC 
           LIMIT ?`;
  }
  const [rows] = await db.execute(sql, [limit]);
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 News Urgency Scorer — Path D`);
  console.log(`   Brain: ${BRAIN_ID} | Mode: ${MODE} | Limit: ${LIMIT}`);

  // Build centroid
  const centroid = await buildCentroid(BRAIN_ID);

  // Connect to MySQL
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  // Fetch companies
  const companies = await fetchCompanies(db, MODE, LIMIT);
  console.log(`\n📋 ${companies.length} companies to score`);

  let scored = 0, noNews = 0, errors = 0;
  const results = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    try {
      // 1. Fetch news snippets
      const newsText = await fetchNewsSnippets(company.name, company.primaryDomain);
      if (!newsText) {
        noNews++;
        if (i % 50 === 0) process.stdout.write(`\r   Progress: ${i}/${companies.length} (scored: ${scored}, no-news: ${noNews}, errors: ${errors})`);
        await new Promise(r => setTimeout(r, SERPER_DELAY_MS));
        continue;
      }

      // 2. Embed the news text
      const newsEmbedding = await embedText(newsText);

      // 3. Cosine similarity vs ABC centroid
      const sim = cosineSimilarity(newsEmbedding, centroid);
      const score = Math.round(sim * 100);

      results.push([score, new Date(), company.id]);
      scored++;

      if (i % 10 === 0) {
        process.stdout.write(`\r   Progress: ${i}/${companies.length} (scored: ${scored}, no-news: ${noNews}, errors: ${errors})`);
      }
    } catch (err) {
      errors++;
      console.error(`\n   ⚠ Error for ${company.name}: ${err.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, SERPER_DELAY_MS));
  }

  // Batch write to MySQL
  console.log(`\n\n   Writing ${results.length} news urgency scores to MySQL...`);
  const chunkSize = 100;
  let totalUpdated = 0;
  for (let i = 0; i < results.length; i += chunkSize) {
    const chunk = results.slice(i, i + chunkSize);
    await Promise.all(chunk.map(([score, ts, id]) =>
      db.execute(
        'UPDATE companies SET urgencyScoreNews = ?, urgencyScoreNewsGeneratedAt = ? WHERE id = ?',
        [score, ts, id]
      )
    ));
    totalUpdated += chunk.length;
    process.stdout.write(`\r   Updated ${totalUpdated}/${results.length}...`);
  }

  await db.end();

  const scores = results.map(r => r[0]);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const max = scores.length > 0 ? Math.max(...scores) : 0;

  console.log(`\n\n✅ Done!`);
  console.log(`   Scored:   ${scored}`);
  console.log(`   No news:  ${noNews}`);
  console.log(`   Errors:   ${errors}`);
  console.log(`   Avg score: ${avg} | Max: ${max}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
