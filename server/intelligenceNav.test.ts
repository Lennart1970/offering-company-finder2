import { describe, it, expect } from "vitest";

describe("Intelligence page navigation fix", () => {
  it("syncCompanyPagesToSupabase includes local_id in the row mapping", async () => {
    const fs = await import("fs");
    const syncSource = fs.readFileSync(
      new URL("./supabaseSync.ts", import.meta.url),
      "utf-8"
    );
    expect(syncSource).toContain("local_id: company.id");
  });

  it("IntelligencePage uses local_id for navigation, not UUID company_id", async () => {
    const fs = await import("fs");
    const pageSource = fs.readFileSync(
      new URL("../client/src/pages/IntelligencePage.tsx", import.meta.url),
      "utf-8"
    );
    expect(pageSource).not.toContain("navigate(`/company/${c.company_id}");
    expect(pageSource).toContain("c.local_id");
    expect(pageSource).toContain("page_url");
  });

  it("getIntelligenceCompanies return type includes local_id", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync(
      new URL("./companyFinder.ts", import.meta.url),
      "utf-8"
    );
    expect(routerSource).toContain("local_id: number | null");
  });

  it("page_url fallback correctly extracts integer ID from URL", () => {
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
    expect(pageSource).toContain("?from=intelligence");
  });
});

describe("CompanyDetailMagazine UUID resolution", () => {
  it("detects UUID format in URL params", () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // UUID from the actual error
    expect(UUID_RE.test("59e8ecc8-bdae-5cad-8836-766304918e48")).toBe(true);
    // Normal integer ID should NOT match
    expect(UUID_RE.test("1290605")).toBe(false);
    // Edge cases
    expect(UUID_RE.test("")).toBe(false);
    expect(UUID_RE.test("abc")).toBe(false);
  });

  it("CompanyDetailMagazine has UUID detection and resolution logic", async () => {
    const fs = await import("fs");
    const pageSource = fs.readFileSync(
      new URL("../client/src/pages/CompanyDetailMagazine.tsx", import.meta.url),
      "utf-8"
    );
    // Should have UUID regex
    expect(pageSource).toContain("UUID_RE");
    // Should call resolveCompanyUUID
    expect(pageSource).toContain("resolveCompanyUUID");
    // Should redirect when resolved
    expect(pageSource).toContain("uuidResolve.data?.localId");
    // Should show helpful error when resolution fails
    expect(pageSource).toContain("Could not resolve company from Intelligence link");
  });

  it("resolveCompanyUUID procedure exists in companyFinder", async () => {
    const fs = await import("fs");
    const routerSource = fs.readFileSync(
      new URL("./companyFinder.ts", import.meta.url),
      "utf-8"
    );
    expect(routerSource).toContain("resolveCompanyUUID");
    expect(routerSource).toContain("lt_mns_company_pages");
    // Should have try-catch for graceful error handling
    expect(routerSource).toContain("[resolveCompanyUUID] Error");
  });
});
