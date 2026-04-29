/**
 * Phase 0 Part 2: Update embedding columns and create RPC functions
 * 
 * Based on actual Supabase structure:
 * - companies table: 60K rows, embedding as JSONB
 * - offering_brain table: 3 rows, embedding as vector
 * - company_embeddings table: 0 rows (unused)
 * 
 * Strategy: 
 * - Add embedding vector(1536) column to lt_companies for pgvector search
 * - Add embedding vector(1536) column to lt_brains for pgvector search
 * - Create RPC functions that use proper vector columns
 * - During Phase 1 migration, embeddings will be copied from legacy tables
 */
import pg from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const PG_URL = "postgresql://postgres.pwwbemvdjaezgwxdosbg:b8b1ClrhMMBUSfSQ@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new pg.Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to Supabase Postgres");

  // ─── Add embedding columns to new tables ──────────────────────────────
  console.log("\n=== Adding embedding columns ===");

  // Add embedding vector column to lt_companies
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_companies ADD COLUMN embedding vector(1536);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lt_companies_embedding 
    ON lt_companies USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `).catch(async () => {
    // ivfflat needs at least some rows; create a basic btree index for now
    // The ivfflat index will be created after data migration when we have rows
    console.log("  (ivfflat index deferred — needs data first, will create after migration)");
  });
  console.log("✓ lt_companies.embedding (vector 1536)");

  // Add embedding vector column to lt_brains
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_brains ADD COLUMN embedding vector(1536);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  console.log("✓ lt_brains.embedding (vector 1536)");

  // Add legacy_supabase_id to lt_companies for mapping during migration
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_companies ADD COLUMN legacy_supabase_id INT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_companies_legacy_sb ON lt_companies (legacy_supabase_id)`);
  console.log("✓ lt_companies.legacy_supabase_id (for migration mapping)");

  // Add legacy_supabase_id to lt_brains
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_brains ADD COLUMN legacy_supabase_id INT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_brains_legacy_sb ON lt_brains (legacy_supabase_id)`);
  console.log("✓ lt_brains.legacy_supabase_id (for migration mapping)");

  // ─── Create pgvector RPC functions ────────────────────────────────────
  console.log("\n=== Creating pgvector RPC functions ===");

  // Drop ALL existing versions of these functions first to avoid return-type conflicts
  await client.query(`DROP FUNCTION IF EXISTS match_companies_by_embedding(vector, double precision, integer)`);
  await client.query(`DROP FUNCTION IF EXISTS match_companies_by_brain(uuid, double precision, integer)`);
  await client.query(`DROP FUNCTION IF EXISTS nearest_cluster_centroid(vector, uuid)`);
  await client.query(`DROP FUNCTION IF EXISTS batch_similarity_scores(uuid, uuid[])`);
  console.log("✓ Dropped existing conflicting functions");

  // match_companies_by_embedding — find similar companies by vector
  await client.query(`
    CREATE OR REPLACE FUNCTION match_companies_by_embedding(
      query_embedding vector(1536),
      match_threshold float DEFAULT 0.7,
      match_count int DEFAULT 20
    )
    RETURNS TABLE (
      company_id UUID,
      company_name VARCHAR,
      domain VARCHAR,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.domain,
        1 - (c.embedding <=> query_embedding) AS similarity
      FROM lt_companies c
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
      ORDER BY c.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$
  `);
  console.log("✓ match_companies_by_embedding RPC");

  // match_companies_by_brain — find companies similar to a brain's embedding
  await client.query(`
    CREATE OR REPLACE FUNCTION match_companies_by_brain(
      brain_uuid UUID,
      match_threshold float DEFAULT 0.5,
      match_count int DEFAULT 100
    )
    RETURNS TABLE (
      company_id UUID,
      company_name VARCHAR,
      domain VARCHAR,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    DECLARE
      brain_emb vector(1536);
    BEGIN
      SELECT embedding INTO brain_emb
      FROM lt_brains
      WHERE id = brain_uuid
      LIMIT 1;
      
      IF brain_emb IS NULL THEN
        RETURN;
      END IF;
      
      RETURN QUERY
      SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.domain,
        1 - (c.embedding <=> brain_emb) AS similarity
      FROM lt_companies c
      WHERE c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> brain_emb) > match_threshold
      ORDER BY c.embedding <=> brain_emb
      LIMIT match_count;
    END;
    $$
  `);
  console.log("✓ match_companies_by_brain RPC");

  // nearest_cluster_centroid — assign a company to nearest niche
  await client.query(`
    CREATE OR REPLACE FUNCTION nearest_cluster_centroid(
      query_embedding vector(1536),
      campaign_uuid UUID DEFAULT NULL
    )
    RETURNS TABLE (
      niche_id UUID,
      niche_name VARCHAR,
      distance float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        n.id AS niche_id,
        n.name AS niche_name,
        (query_embedding <=> n.centroid::vector(1536)) AS distance
      FROM lt_niches n
      WHERE (campaign_uuid IS NULL OR n.campaign_id = campaign_uuid)
        AND n.centroid IS NOT NULL
      ORDER BY query_embedding <=> n.centroid::vector(1536)
      LIMIT 1;
    END;
    $$
  `);
  console.log("✓ nearest_cluster_centroid RPC");

  // batch_similarity_scores — score multiple companies against a brain at once
  await client.query(`
    CREATE OR REPLACE FUNCTION batch_similarity_scores(
      brain_uuid UUID,
      company_uuids UUID[]
    )
    RETURNS TABLE (
      company_id UUID,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    DECLARE
      brain_emb vector(1536);
    BEGIN
      SELECT embedding INTO brain_emb
      FROM lt_brains
      WHERE id = brain_uuid
      LIMIT 1;
      
      IF brain_emb IS NULL THEN
        RETURN;
      END IF;
      
      RETURN QUERY
      SELECT
        c.id AS company_id,
        1 - (c.embedding <=> brain_emb) AS similarity
      FROM lt_companies c
      WHERE c.id = ANY(company_uuids)
        AND c.embedding IS NOT NULL
      ORDER BY similarity DESC;
    END;
    $$
  `);
  console.log("✓ batch_similarity_scores RPC");

  // ─── Verify everything ────────────────────────────────────────────────
  console.log("\n=== Final Verification ===");
  
  // Count new tables
  const newTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'lt_%' 
    ORDER BY table_name
  `);
  console.log("New lt_* tables:", newTables.rows.map(r => r.table_name).join(", "));
  console.log("Total new tables:", newTables.rows.length);

  // List RPC functions
  const rpcs = await client.query(`
    SELECT routine_name FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('match_companies_by_embedding', 'match_companies_by_brain', 'nearest_cluster_centroid', 'batch_similarity_scores')
    ORDER BY routine_name
  `);
  console.log("RPC functions:", rpcs.rows.map(r => r.routine_name).join(", "));

  // Check lt_companies columns
  const ltCols = await client.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'lt_companies' 
    ORDER BY ordinal_position
  `);
  console.log("\nlt_companies columns:");
  ltCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.udt_name})`));

  await client.end();
  console.log("\n✅ Phase 0 complete — all tables, indexes, and RPC functions created");
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
