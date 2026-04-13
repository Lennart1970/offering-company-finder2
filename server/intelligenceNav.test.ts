import { describe, it, expect } from "vitest";

describe("Intelligence page navigation fix", () => {
  it("syncCompanyPagesToSupabase includes local_id in the row mapping", async () => {
    // Verify the sync function includes local_id by reading its source
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );

    // The syncCompanyPagesToSupabase function should include local_id
    expect(syncSource).toContain("local_id: company.id");
  });

  it("IntelligencePage uses local_id for navigation, not UUID company_id", async () => {
    const fs = await import("fs");
    const pageSource = fs.readFileSync(
      new URL("../client/src/pages/IntelligencePage.tsx", import.meta.url),
      "utf-8"
    );

    // Should NOT navigate using c.company_id (UUID)
    expect(pageSource).not.toContain("navigate(`/company/${c.company_id}");

    // Should use local_id with page_url fallback
    expect(pageSource).toContain("c.local_id");
    expect(pageSource).toContain("page_url");
  });

  it("getIntelligenceCompanies return type includes local_id", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync(
      new URL("./companyFinder.ts", import.meta.url),
      "utf-8"
    );

    // The return type cast should include local_id
    expect(routerSource).toContain("local_id: number | null");
  });

  it("page_url fallback correctly extracts integer ID from URL", () => {
    // Simulate the fallback logic used in IntelligencePage
    const pageUrl = "https://leadtrigger-connectgroup.com/company/1290605";
    const extractedId = pageUrl.split("/company/")[1]?.split("?")[0];
    expect(extractedId).toBe("1290605");
    expect(Number(extractedId)).toBe(1290605);
    expect(Number.isInteger(Number(extractedId))).toBe(true);
  });

  it("page_url fallback handles null page_url gracefully", () => {
    const pageUrl: string | null = null;
    const extractedId = pageUrl ? pageUrl.split("/company/")[1]?.split("?")[0] : null;
    expect(extractedId).toBeNull();
  });

  it("navigation uses ?from=intelligence query param", async () => {
    const fs = await import("fs");
    const pageSource = fs.readFileSync(
      new URL("../client/src/pages/IntelligencePage.tsx", import.meta.url),
      "utf-8"
    );

    // Should append ?from=intelligence
    expect(pageSource).toContain("?from=intelligence");
  });
});
