/**
 * Creates lt_mns_company_pages in Supabase via direct pg connection.
 */
import pg from "pg";
const { Client } = pg;

// Build connection string from env
const projectRef = process.env.SUPABASE_URL
  ? process.env.SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")
  : null;

if (!projectRef) {
  console.error("SUPABASE_URL not set");
  process.exit(1);
}

const connStr = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

console.log(`Connecting to Supabase project: ${projectRef}`);
const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("Connected.");

  await client.query(`
    CREATE TABLE IF NOT EXISTS lt_mns_company_pages (
      id            UUID PRIMARY KEY,
      company_id    UUID,
      company_name  TEXT,
      domain        TEXT,
      campaign_id   INTEGER,
      campaign_name TEXT,
      urgency_score INTEGER,
      fit_score     INTEGER,
      urgency_label TEXT,
      fit_label     TEXT,
      page_url      TEXT,
      synced_at     TIMESTAMPTZ DEFAULT NOW(),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("✅ Table lt_mns_company_pages created (or already exists)");

  await client.query(`CREATE INDEX IF NOT EXISTS idx_company_pages_campaign ON lt_mns_company_pages (campaign_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_company_pages_company ON lt_mns_company_pages (company_id)`);
  console.log("✅ Indexes created");

  const res = await client.query(`SELECT COUNT(*) as cnt FROM lt_mns_company_pages`);
  console.log(`✅ Table verified — ${res.rows[0].cnt} rows`);
} catch (err) {
  console.error("❌ Error:", err.message);
} finally {
  await client.end();
}
