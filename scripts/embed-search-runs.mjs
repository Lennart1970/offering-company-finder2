/**
 * Embed companies from specific search runs into Supabase
 * Strategy: resolve existing Supabase company ID (by name or domain),
 * insert new company row only if truly new, then upsert embedding.
 * Usage: node scripts/embed-search-runs.mjs [searchId1,searchId2,...]
 */
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const BATCH_SIZE = 20;
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-ada-002";

const argSearchIds = process.argv[2]
  ? process.argv[2].split(",").map(Number)
  : [1980002, 1980003, 1980004, 1980005, 1980006];

function toUUID(id) { return uuidv5(`company-${id}`, LT_NAMESPACE); }

async function getEmbedding(text) {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.substring(0, 8000) }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

function buildCompanyText(c) {
  const parts = [c.name, c.primaryDomain || c.websiteUrl || "", c.country || "", c.sector || ""];
  try {
    const meta = typeof c.sliceMetadata === "string" ? JSON.parse(c.sliceMetadata) : c.sliceMetadata;
    if (meta?.description) parts.push(meta.description);
    if (meta?.industry) parts.push(meta.industry);
    if (meta?.keywords) parts.push(Array.isArray(meta.keywords) ? meta.keywords.join(", ") : meta.keywords);
  } catch {}
  return parts.filter(Boolean).join(" | ");
}

/**
 * Resolve the correct Supabase UUID for a company.
 * Priority: existing row by name → existing row by domain → our v5 UUID
 */
async function resolveSupabaseId(supabase, company) {
  const domain = company.primaryDomain || company.websiteUrl || null;
  
  // Try by name first
  if (company.name) {
    const { data } = await supabase
      .from("lt_mns_companies")
      .select("id")
      .eq("company_name", company.name)
      .limit(1)
      .single();
    if (data?.id) return { id: data.id, isNew: false };
  }
  
  // Try by domain
  if (domain) {
    const { data } = await supabase
      .from("lt_mns_companies")
      .select("id")
      .eq("domain", domain)
      .limit(1)
      .single();
    if (data?.id) return { id: data.id, isNew: false };
  }
  
  // Truly new — use our v5 UUID
  return { id: toUUID(company.id), isNew: true };
}

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  console.log(`[embed-search-runs] Search IDs: ${argSearchIds.join(", ")}`);

  const [allRows] = await conn.execute(
    `SELECT id, name, primaryDomain, websiteUrl, country, sector, apolloId, sliceMetadata 
     FROM companies WHERE searchId IN (${argSearchIds.join(",")})`
  );
  console.log(`Found ${allRows.length} companies total`);

  // Check which ones already have embeddings
  const allUUIDs = allRows.map(r => toUUID(r.id));
  let alreadyEmbedded = new Set();
  for (let i = 0; i < allUUIDs.length; i += 500) {
    const batch = allUUIDs.slice(i, i + 500);
    const { data } = await supabase
      .from("lt_mns_company_embeddings")
      .select("watchlist_id")
      .in("watchlist_id", batch);
    if (data) data.forEach(d => alreadyEmbedded.add(d.watchlist_id));
  }

  // Also check by resolving existing Supabase IDs for all companies
  // (some may be embedded under a different UUID)
  const toEmbed = allRows.filter(r => !alreadyEmbedded.has(toUUID(r.id)));
  console.log(`Already embedded (by v5 UUID): ${alreadyEmbedded.size} | To process: ${toEmbed.length}`);

  if (toEmbed.length === 0) {
    console.log("All companies already embedded. Done.");
    await conn.end();
    return;
  }

  let done = 0, failed = 0, skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < toEmbed.length; i++) {
    const company = toEmbed[i];
    
    try {
      // Step 1: resolve Supabase ID (avoids constraint conflicts)
      const { id: supabaseId, isNew } = await resolveSupabaseId(supabase, company);
      
      // Step 2: if new company, insert it
      if (isNew) {
        const domain = company.primaryDomain || company.websiteUrl || null;
        const { error: insErr } = await supabase
          .from("lt_mns_companies")
          .insert({
            id: supabaseId,
            company_name: company.name,
            domain,
            country: company.country || null,
            sector: company.sector || null,
            apollo_id: company.apolloId || null,
          });
        if (insErr && !insErr.message.includes("duplicate")) {
          throw new Error("Insert failed: " + insErr.message);
        }
      }
      
      // Step 3: check if this supabaseId already has an embedding
      const { data: existingEmb } = await supabase
        .from("lt_mns_company_embeddings")
        .select("watchlist_id")
        .eq("watchlist_id", supabaseId)
        .single();
      
      if (existingEmb) {
        skipped++;
        done++;
      } else {
        // Step 4: generate embedding
        const text = buildCompanyText(company);
        const embedding = await getEmbedding(text);
        
        // Step 5: upsert embedding
        const { error: embErr } = await supabase
          .from("lt_mns_company_embeddings")
          .upsert({ watchlist_id: supabaseId, embedding }, { onConflict: "watchlist_id" });
        if (embErr) throw new Error("Embedding upsert failed: " + embErr.message);
        done++;
      }
    } catch (e) {
      console.error(`  [${i+1}/${toEmbed.length}] Failed ${company.name}: ${e.message}`);
      failed++;
    }

    // Progress every 25 companies
    if ((i + 1) % 25 === 0 || i + 1 === toEmbed.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (done + failed) / (elapsed || 1);
      const remaining = Math.round((toEmbed.length - i - 1) / (rate || 1));
      console.log(`  [${i+1}/${toEmbed.length}] Done:${done} Skipped:${skipped} Failed:${failed} | ~${remaining}s left`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nComplete in ${elapsed}s: ${done} processed (${skipped} already had embedding), ${failed} failed`);
  await conn.end();
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
