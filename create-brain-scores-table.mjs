/**
 * Creates lt_mns_company_brain_scores table in Supabase via REST API.
 * Run: node create-brain-scores-table.mjs
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

const sql = `
CREATE TABLE IF NOT EXISTS lt_mns_company_brain_scores (
  company_id   UUID        NOT NULL,
  brain_id     TEXT        NOT NULL,
  score        SMALLINT    NOT NULL CHECK (score >= 0 AND score <= 100),
  scored_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method       TEXT        NOT NULL DEFAULT 'cosine-similarity-v1',
  PRIMARY KEY (company_id, brain_id)
);

CREATE INDEX IF NOT EXISTS idx_brain_scores_brain_id ON lt_mns_company_brain_scores (brain_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_brain_scores_company_id ON lt_mns_company_brain_scores (company_id);
`;

// Use Supabase's pg REST endpoint for raw SQL
const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
  },
  body: JSON.stringify({ sql }),
});

if (!res.ok) {
  const body = await res.text();
  // If exec_sql RPC doesn't exist, fall back to checking if table exists
  if (res.status === 404 || body.includes("does not exist")) {
    console.log("exec_sql RPC not available. Checking if table already exists...");
    
    const checkRes = await fetch(
      `${url}/rest/v1/lt_mns_company_brain_scores?select=company_id&limit=1`,
      {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` },
      }
    );
    
    if (checkRes.ok) {
      console.log("✅ Table lt_mns_company_brain_scores already exists!");
      process.exit(0);
    }
    
    console.log("\n⚠️  Table does not exist. Please run this SQL in the Supabase SQL editor:\n");
    console.log(sql);
    process.exit(1);
  }
  
  console.error("Error:", res.status, body);
  process.exit(1);
}

console.log("✅ Table lt_mns_company_brain_scores created successfully!");
