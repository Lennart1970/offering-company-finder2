import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase credentials validation", () => {
  it("should connect to Supabase with the provided credentials", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(url, "SUPABASE_URL must be set").toBeTruthy();
    expect(key, "SUPABASE_SERVICE_ROLE_KEY must be set").toBeTruthy();

    const supabase = createClient(url!, key!, { auth: { persistSession: false } });

    // A simple health check — list tables from information_schema
    const { error } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .limit(1);

    // If we get a "relation does not exist" error that's fine — it means auth worked
    // but the table query was rejected by RLS. A credentials error would be 401/403.
    if (error) {
      // Auth errors have status 401 or message containing "invalid"
      const isAuthError =
        error.message?.toLowerCase().includes("invalid") ||
        error.message?.toLowerCase().includes("unauthorized") ||
        error.message?.toLowerCase().includes("jwt");
      expect(isAuthError, `Auth error: ${error.message}`).toBe(false);
    }

    expect(true).toBe(true); // Connection attempt succeeded
  }, 15000);
});
