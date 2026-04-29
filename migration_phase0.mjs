/**
 * Phase 0: Create target Supabase schema for migration
 * 
 * This script creates all target tables in Supabase.
 * It's idempotent — safe to run multiple times (uses IF NOT EXISTS).
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Direct Postgres connection for DDL operations
const PG_URL = "postgresql://postgres.pwwbemvdjaezgwxdosbg:b8b1ClrhMMBUSfSQ@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

// Allow self-signed certs for Supabase pooler
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const client = new pg.Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to Supabase Postgres");

  // Check if pgvector extension is enabled
  const extCheck = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
  if (extCheck.rows.length === 0) {
    console.log("Enabling pgvector extension...");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    console.log("pgvector enabled");
  } else {
    console.log("pgvector already enabled");
  }

  // List existing tables
  const existing = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("\nExisting tables:", existing.rows.map(r => r.table_name).join(", "));

  // ─── STEP 1: Core tables ─────────────────────────────────────────────
  console.log("\n=== Creating core tables ===");

  // lt_companies — central entity, deduped by domain
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,                          -- legacy bridge, eventually remove
      apollo_id VARCHAR(128),
      name VARCHAR(512) NOT NULL,
      domain VARCHAR(256),                   -- normalized root domain (unique key for dedup)
      primary_domain VARCHAR(256),
      website_url VARCHAR(512),
      linkedin_url VARCHAR(512),
      twitter_url VARCHAR(512),
      facebook_url VARCHAR(512),
      phone VARCHAR(64),
      founded_year INT,
      revenue VARCHAR(64),
      headcount_growth VARCHAR(256),
      parent_company_name VARCHAR(512),
      parent_company_id VARCHAR(128),
      -- Location
      city VARCHAR(128),
      state VARCHAR(128),
      country VARCHAR(128),
      street_address VARCHAR(512),
      raw_address TEXT,
      -- Classification
      sic_codes JSONB,                       -- array of SIC codes
      naics_codes JSONB,                     -- array of NAICS codes
      slice_metadata JSONB,                  -- { employeeBand, industry, keywordSet, ... }
      source_country_code VARCHAR(8),
      -- Enrichment
      enrichment_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  // Unique index on domain for dedup (partial — only non-null domains)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lt_companies_domain 
    ON lt_companies (domain) WHERE domain IS NOT NULL
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_companies_mysql_id ON lt_companies (mysql_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_companies_name ON lt_companies (name)`);
  console.log("✓ lt_companies");

  // lt_brains — offering intelligence
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_brains (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,                          -- legacy bridge
      user_id INT,                           -- references MySQL users.id
      brain_name VARCHAR(255) NOT NULL,
      company_name VARCHAR(256) NOT NULL,
      company_website VARCHAR(512) NOT NULL,
      -- Core offering intelligence
      offering_summary TEXT,
      core_capabilities JSONB,
      value_propositions JSONB,
      competitive_advantages TEXT,
      -- ICP
      icp_industries JSONB,
      icp_company_size TEXT,
      icp_geography TEXT,
      icp_pain_points JSONB,
      icp_buying_signals JSONB,
      -- Scoring criteria
      fit_criteria JSONB,
      urgency_triggers JSONB,
      -- Classification
      sic_codes JSONB,
      nace_codes JSONB,
      -- Metadata
      raw_research_data TEXT,
      status VARCHAR(20) DEFAULT 'researching' NOT NULL,
      is_active INT DEFAULT 1 NOT NULL,
      is_shared INT DEFAULT 0 NOT NULL,
      show_on_leadtrigger SMALLINT DEFAULT 1 NOT NULL,
      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_brains_mysql_id ON lt_brains (mysql_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_brains_user_id ON lt_brains (user_id)`);
  console.log("✓ lt_brains");

  // lt_campaigns — search campaigns
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,                          -- legacy bridge
      user_id INT NOT NULL,                  -- references MySQL users.id
      brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      -- Campaign definition
      company_website VARCHAR(512) NOT NULL,
      location VARCHAR(256) NOT NULL,
      offering_name TEXT,
      offering_description TEXT,
      target_market TEXT,
      value_proposition TEXT,
      keywords JSONB,
      cross_border_indicators TEXT,
      keyword_tags_used JSONB,
      selected_sic_codes JSONB,
      selected_naics_codes JSONB,
      code_selection_reasoning TEXT,
      excluded_sectors JSONB,
      codes_searched INT DEFAULT 0,
      codes_total INT DEFAULT 0,
      -- Status
      status VARCHAR(30) DEFAULT 'pending' NOT NULL,
      error_message TEXT,
      shared_with_team SMALLINT DEFAULT 0 NOT NULL,
      is_archived SMALLINT DEFAULT 0 NOT NULL,
      source_niche_id UUID,                  -- FK added after lt_niches creation
      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_campaigns_mysql_id ON lt_campaigns (mysql_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_campaigns_user_id ON lt_campaigns (user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_campaigns_brain_id ON lt_campaigns (brain_id)`);
  console.log("✓ lt_campaigns");

  // ─── STEP 2: Junction and dependent tables ────────────────────────────
  console.log("\n=== Creating junction and dependent tables ===");

  // lt_campaign_companies — many-to-many with per-campaign scores
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_campaign_companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES lt_campaigns(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES lt_companies(id) ON DELETE CASCADE,
      brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      -- Scores (per-campaign, per-brain)
      urgency_score INT,
      fit_score INT,
      fit_score_data JSONB,
      brief_data JSONB,
      brief_generated_at TIMESTAMPTZ,
      sales_approach_data JSONB,
      sales_approach_generated_at TIMESTAMPTZ,
      call_readiness_summary TEXT,
      product_images JSONB,
      urgency_images JSONB,
      sales_rep_profile TEXT,
      sales_rep_profile_generated_at TIMESTAMPTZ,
      signal_openers JSONB,
      signal_openers_generated_at TIMESTAMPTZ,
      -- Brain traceability
      generated_with_brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      generated_with_brain_name VARCHAR(255),
      -- Niche assignment
      niche_id UUID,                         -- FK added after lt_niches creation
      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      -- One company per campaign
      UNIQUE(campaign_id, company_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cc_campaign ON lt_campaign_companies (campaign_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cc_company ON lt_campaign_companies (company_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cc_brain ON lt_campaign_companies (brain_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cc_urgency ON lt_campaign_companies (urgency_score DESC NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cc_fit ON lt_campaign_companies (fit_score DESC NULLS LAST)`);
  console.log("✓ lt_campaign_companies");

  // lt_contacts
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      company_id UUID NOT NULL REFERENCES lt_companies(id) ON DELETE CASCADE,
      apollo_person_id VARCHAR(128),
      first_name VARCHAR(128),
      last_name VARCHAR(128),
      full_name VARCHAR(256),
      title VARCHAR(256),
      email VARCHAR(320),
      phone VARCHAR(64),
      linkedin_url VARCHAR(512),
      searched_title VARCHAR(256),
      phone_pending SMALLINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_contacts_company ON lt_contacts (company_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_contacts_mysql_id ON lt_contacts (mysql_id)`);
  console.log("✓ lt_contacts");

  // lt_niches
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_niches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      user_id INT NOT NULL,
      campaign_id UUID REFERENCES lt_campaigns(id) ON DELETE CASCADE,
      brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      parent_niche_id UUID REFERENCES lt_niches(id) ON DELETE SET NULL,
      -- Cluster identity
      name VARCHAR(255) NOT NULL,
      description TEXT,
      company_count INT DEFAULT 0 NOT NULL,
      top_keywords JSONB,
      sample_companies JSONB,
      company_ids JSONB,
      centroid JSONB,                        -- mean embedding vector as JSON array
      rationale TEXT,
      -- Fit scoring
      fit_score INT,
      fit_reasoning TEXT,
      score_breakdown JSONB,
      scored_at TIMESTAMPTZ,
      scored_with_brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_niches_mysql_id ON lt_niches (mysql_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_niches_campaign ON lt_niches (campaign_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_niches_brain ON lt_niches (brain_id)`);

  // Now add the FK from lt_campaign_companies.niche_id → lt_niches
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_campaign_companies 
        ADD CONSTRAINT fk_cc_niche FOREIGN KEY (niche_id) REFERENCES lt_niches(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  // And lt_campaigns.source_niche_id → lt_niches
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_campaigns 
        ADD CONSTRAINT fk_campaigns_source_niche FOREIGN KEY (source_niche_id) REFERENCES lt_niches(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  console.log("✓ lt_niches (+ FK constraints)");

  // ─── STEP 3: Leadinfo, Sharing, CRM tables ───────────────────────────
  console.log("\n=== Creating Leadinfo, Sharing, and CRM tables ===");

  // lt_leadinfo_visits
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_leadinfo_visits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      user_id INT NOT NULL,
      campaign_id UUID REFERENCES lt_campaigns(id) ON DELETE CASCADE,
      company_id UUID REFERENCES lt_companies(id) ON DELETE CASCADE,
      -- Leadinfo company data
      company_name VARCHAR(512) NOT NULL,
      domain VARCHAR(256) NOT NULL,
      raw_url VARCHAR(1024),
      city VARCHAR(128),
      country VARCHAR(8),
      sales_region VARCHAR(64),
      employees INT,
      branch VARCHAR(256),
      linkedin_url VARCHAR(512),
      sales_volume VARCHAR(128),
      -- Engagement metrics
      total_pages INT DEFAULT 0,
      total_sessions INT DEFAULT 0,
      total_duration INT DEFAULT 0,
      engagement_score INT DEFAULT 0,
      -- Visitor intent
      pages_viewed JSONB,
      top_pages JSONB,
      intent_signals JSONB,
      personas JSONB,
      -- Match metadata
      match_type VARCHAR(20),
      match_confidence REAL,
      first_visit_at TIMESTAMPTZ,
      last_visit_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_leadinfo_company ON lt_leadinfo_visits (company_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_leadinfo_campaign ON lt_leadinfo_visits (campaign_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_leadinfo_domain ON lt_leadinfo_visits (domain)`);
  console.log("✓ lt_leadinfo_visits");

  // lt_share_tokens
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_share_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      token VARCHAR(64) NOT NULL UNIQUE,
      company_id UUID NOT NULL REFERENCES lt_companies(id) ON DELETE CASCADE,
      brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      user_id INT NOT NULL,
      page_type VARCHAR(20) DEFAULT 'company' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_share_tokens_token ON lt_share_tokens (token)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_share_tokens_company ON lt_share_tokens (company_id)`);
  console.log("✓ lt_share_tokens");

  // lt_share_allowed_domains
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_share_allowed_domains (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      token_id UUID NOT NULL REFERENCES lt_share_tokens(id) ON DELETE CASCADE,
      domain VARCHAR(256) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  console.log("✓ lt_share_allowed_domains");

  // lt_share_lists
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_share_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      list_token VARCHAR(64) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      campaign_id UUID REFERENCES lt_campaigns(id) ON DELETE SET NULL,
      title VARCHAR(512),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  console.log("✓ lt_share_lists");

  // lt_share_list_items
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_share_list_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      list_id UUID NOT NULL REFERENCES lt_share_lists(id) ON DELETE CASCADE,
      token_id UUID NOT NULL REFERENCES lt_share_tokens(id) ON DELETE CASCADE,
      sort_order INT DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_sli_list ON lt_share_list_items (list_id)`);
  console.log("✓ lt_share_list_items");

  // lt_share_access_log
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_share_access_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      token VARCHAR(64) NOT NULL,
      email VARCHAR(320),
      page_type VARCHAR(20),
      granted BOOLEAN DEFAULT true NOT NULL,
      denial_reason VARCHAR(50),
      ip_address VARCHAR(45),
      user_agent TEXT,
      accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_sal_token ON lt_share_access_log (token)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_sal_email ON lt_share_access_log (email)`);
  console.log("✓ lt_share_access_log");

  // lt_share_visitors
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_share_visitors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      email VARCHAR(320) NOT NULL UNIQUE,
      access_count INT DEFAULT 1 NOT NULL,
      first_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  console.log("✓ lt_share_visitors");

  // lt_call_outcomes
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_call_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      company_id UUID NOT NULL REFERENCES lt_companies(id) ON DELETE CASCADE,
      campaign_id UUID REFERENCES lt_campaigns(id) ON DELETE CASCADE,
      user_id INT NOT NULL,
      outcome VARCHAR(30) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_co_company ON lt_call_outcomes (company_id)`);
  console.log("✓ lt_call_outcomes");

  // lt_company_decisions
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_company_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      company_id UUID NOT NULL REFERENCES lt_companies(id) ON DELETE CASCADE,
      campaign_id UUID NOT NULL REFERENCES lt_campaigns(id) ON DELETE CASCADE,
      user_id INT NOT NULL,
      decision VARCHAR(30) NOT NULL,
      reason_code VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(company_id, campaign_id, user_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cd_company ON lt_company_decisions (company_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cd_campaign ON lt_company_decisions (campaign_id)`);
  console.log("✓ lt_company_decisions");

  // lt_campaign_queue
  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_campaign_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mysql_id INT,
      campaign_id UUID NOT NULL REFERENCES lt_campaigns(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES lt_companies(id) ON DELETE CASCADE,
      brain_id UUID REFERENCES lt_brains(id) ON DELETE SET NULL,
      user_id INT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' NOT NULL,
      priority INT DEFAULT 0 NOT NULL,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(campaign_id, company_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cq_status ON lt_campaign_queue (status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_lt_cq_campaign ON lt_campaign_queue (campaign_id)`);
  console.log("✓ lt_campaign_queue");

  // ─── STEP 4: Update embedding tables ──────────────────────────────────
  console.log("\n=== Updating embedding tables ===");

  // Add lt_company_uuid column to lt_mns_company_embeddings (FK to lt_companies)
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_mns_company_embeddings ADD COLUMN lt_company_uuid UUID REFERENCES lt_companies(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_emb_company_uuid ON lt_mns_company_embeddings (lt_company_uuid)`);
  console.log("✓ lt_mns_company_embeddings — added lt_company_uuid FK");

  // Add lt_brain_uuid column to lt_mns_brain_embeddings (FK to lt_brains)
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE lt_mns_brain_embeddings ADD COLUMN lt_brain_uuid UUID REFERENCES lt_brains(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_emb_brain_uuid ON lt_mns_brain_embeddings (lt_brain_uuid)`);
  console.log("✓ lt_mns_brain_embeddings — added lt_brain_uuid FK");

  // ─── STEP 5: pgvector RPC functions ───────────────────────────────────
  console.log("\n=== Creating pgvector RPC functions ===");

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
        1 - (e.embedding <=> query_embedding) AS similarity
      FROM lt_mns_company_embeddings e
      JOIN lt_companies c ON c.id = e.lt_company_uuid
      WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
      ORDER BY e.embedding <=> query_embedding
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
      FROM lt_mns_brain_embeddings
      WHERE lt_brain_uuid = brain_uuid
      LIMIT 1;
      
      IF brain_emb IS NULL THEN
        RETURN;
      END IF;
      
      RETURN QUERY
      SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.domain,
        1 - (e.embedding <=> brain_emb) AS similarity
      FROM lt_mns_company_embeddings e
      JOIN lt_companies c ON c.id = e.lt_company_uuid
      WHERE 1 - (e.embedding <=> brain_emb) > match_threshold
      ORDER BY e.embedding <=> brain_emb
      LIMIT match_count;
    END;
    $$
  `);
  console.log("✓ match_companies_by_brain RPC");

  // nearest_cluster_centroid — assign a company embedding to nearest niche
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

  // ─── STEP 6: Verify ──────────────────────────────────────────────────
  console.log("\n=== Verification ===");
  const allTables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("All public tables:", allTables.rows.map(r => r.table_name).join(", "));

  const rpcs = await client.query(
    "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name"
  );
  console.log("RPC functions:", rpcs.rows.map(r => r.routine_name).join(", "));

  await client.end();
  console.log("\n✅ Phase 0 complete — all tables and RPC functions created");
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
