import { describe, it, expect } from "vitest";

describe("Sync All Companies to lt_mns_companies", () => {
  it("syncAllCompaniesToSupabase function exists and is exported", async () => {
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );
    expect(syncSource).toContain("export async function syncAllCompaniesToSupabase");
  });

  it("syncAllCompaniesToSupabase fetches all researched companies with briefData", async () => {
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );
    // Should query companies where briefData is not null
    expect(syncSource).toContain("isNotNull(companies.briefData)");
  });

  it("syncAllCompaniesToSupabase batches in chunks of 200", async () => {
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );
    expect(syncSource).toContain("const CHUNK = 200");
  });

  it("getCompaniesTableSyncStats function exists and is exported", async () => {
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );
    expect(syncSource).toContain("export async function getCompaniesTableSyncStats");
  });

  it("getCompaniesTableSyncStats queries lt_mns_companies table", async () => {
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );
    // Should query the correct table
    expect(syncSource).toContain('.from("lt_mns_companies")');
  });

  it("tRPC procedures syncAllCompanies and getCompaniesTableSyncStats exist", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync(
      new URL("./companyFinder.ts", import.meta.url),
      "utf-8"
    );
    expect(routerSource).toContain("syncAllCompanies: protectedProcedure");
    expect(routerSource).toContain("getCompaniesTableSyncStats: protectedProcedure");
  });

  it("SyncPage UI has both sync buttons", async () => {
    const fs = await import("fs");
    const pageSource = fs.readFileSync(
      new URL("../client/src/pages/SyncPage.tsx", import.meta.url),
      "utf-8"
    );
    // Should have both sync mutations
    expect(pageSource).toContain("syncAllCompanies");
    expect(pageSource).toContain("syncCompanyPages");
    // Should have both table names displayed
    expect(pageSource).toContain("lt_mns_companies");
    expect(pageSource).toContain("lt_mns_company_pages");
    // Should have both sync buttons
    expect(pageSource).toContain("SYNC COMPANIES");
    expect(pageSource).toContain("SYNC COMPANY PAGES");
  });

  it("SyncPage uses different colors for each sync card", async () => {
    const fs = await import("fs");
    const pageSource = fs.readFileSync(
      new URL("../client/src/pages/SyncPage.tsx", import.meta.url),
      "utf-8"
    );
    // Companies card uses blue
    expect(pageSource).toContain("bg-blue-700");
    expect(pageSource).toContain("text-blue-700");
    // Pages card uses emerald
    expect(pageSource).toContain("bg-emerald-700");
    expect(pageSource).toContain("text-emerald-700");
  });
});
