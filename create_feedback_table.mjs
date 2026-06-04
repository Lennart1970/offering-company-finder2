import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Create the table via SQL
const { data, error } = await sb.rpc("exec_sql", {
  sql: `
    CREATE TABLE IF NOT EXISTS lt_share_feedback (
      id          BIGSERIAL PRIMARY KEY,
      share_token TEXT NOT NULL,
      company_id  BIGINT,
      company_name TEXT,
      rating      TEXT CHECK (rating IN ('thumbs_up','thumbs_down','neutral')),
      comment     TEXT,
      submitter_name  TEXT,
      submitter_email TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_share_feedback_token ON lt_share_feedback(share_token);
    CREATE INDEX IF NOT EXISTS idx_share_feedback_company ON lt_share_feedback(company_id);
  `
});

if (error) {
  console.error("RPC error:", error);
  // Try direct insert to check if table exists
  const { error: e2 } = await sb.from("lt_share_feedback").select("id").limit(1);
  if (e2) {
    console.log("Table does not exist, need to create via Supabase dashboard SQL editor");
    console.log("SQL to run:\n");
    console.log(`CREATE TABLE IF NOT EXISTS lt_share_feedback (
  id          BIGSERIAL PRIMARY KEY,
  share_token TEXT NOT NULL,
  company_id  BIGINT,
  company_name TEXT,
  rating      TEXT CHECK (rating IN ('thumbs_up','thumbs_down','neutral')),
  comment     TEXT,
  submitter_name  TEXT,
  submitter_email TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_share_feedback_token ON lt_share_feedback(share_token);
CREATE INDEX IF NOT EXISTS idx_share_feedback_company ON lt_share_feedback(company_id);`);
  } else {
    console.log("Table already exists!");
  }
} else {
  console.log("Table created successfully:", data);
}
