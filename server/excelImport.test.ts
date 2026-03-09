/**
 * Tests for the Excel import route helper functions.
 * We test the column detection, website cleaning, and domain extraction logic
 * without making real HTTP calls or touching Apollo.
 */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

// ─── Helpers extracted from excelImport.ts for unit testing ───────────────────

const NAME_ALIASES = ["company name", "name", "company", "bedrijf", "exhibitor", "organisation", "organization", "naam"];
const WEBSITE_ALIASES = ["website", "url", "web", "domain", "website url", "site", "homepage", "link"];

function detectColumns(headers: string[]): { nameCol: number; websiteCol: number } {
  const lower = headers.map((h) => (h || "").toString().toLowerCase().trim());
  const nameCol = lower.findIndex((h) => NAME_ALIASES.includes(h));
  const websiteCol = lower.findIndex((h) => WEBSITE_ALIASES.includes(h));
  return { nameCol, websiteCol };
}

function cleanWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toString().trim();
  if (s === "–" || s === "-" || s === "—" || s === "n/a" || s === "N/A" || s === "") return null;
  if (!s.startsWith("http")) return `https://${s}`;
  return s;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("detectColumns", () => {
  it("detects standard Company Name / Website headers", () => {
    const { nameCol, websiteCol } = detectColumns(["Company Name", "Website"]);
    expect(nameCol).toBe(0);
    expect(websiteCol).toBe(1);
  });

  it("is case-insensitive", () => {
    const { nameCol, websiteCol } = detectColumns(["COMPANY NAME", "WEBSITE"]);
    expect(nameCol).toBe(0);
    expect(websiteCol).toBe(1);
  });

  it("detects Dutch header 'Bedrijf'", () => {
    const { nameCol } = detectColumns(["Bedrijf", "Website"]);
    expect(nameCol).toBe(0);
  });

  it("detects 'URL' as website column", () => {
    const { websiteCol } = detectColumns(["Company", "URL"]);
    expect(websiteCol).toBe(1);
  });

  it("detects 'Domain' as website column", () => {
    const { websiteCol } = detectColumns(["Name", "Domain"]);
    expect(websiteCol).toBe(1);
  });

  it("returns -1 for missing columns", () => {
    const { nameCol, websiteCol } = detectColumns(["Foo", "Bar"]);
    expect(nameCol).toBe(-1);
    expect(websiteCol).toBe(-1);
  });

  it("handles extra whitespace in headers", () => {
    const { nameCol } = detectColumns(["  Company Name  ", "Website"]);
    expect(nameCol).toBe(0);
  });
});

describe("cleanWebsite", () => {
  it("returns null for dash placeholder '–'", () => {
    expect(cleanWebsite("–")).toBeNull();
  });

  it("returns null for regular dash '-'", () => {
    expect(cleanWebsite("-")).toBeNull();
  });

  it("returns null for em dash '—'", () => {
    expect(cleanWebsite("—")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(cleanWebsite("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(cleanWebsite(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(cleanWebsite(undefined)).toBeNull();
  });

  it("returns null for 'n/a'", () => {
    expect(cleanWebsite("n/a")).toBeNull();
  });

  it("passes through valid https URL unchanged", () => {
    expect(cleanWebsite("https://www.arcadis.com")).toBe("https://www.arcadis.com");
  });

  it("adds https:// prefix when missing", () => {
    expect(cleanWebsite("www.tomtom.com")).toBe("https://www.tomtom.com");
  });

  it("trims whitespace before processing", () => {
    expect(cleanWebsite("  https://www.arvoo.com  ")).toBe("https://www.arvoo.com");
  });
});

describe("extractDomain", () => {
  it("extracts domain from full URL", () => {
    expect(extractDomain("https://www.arcadis.com")).toBe("arcadis.com");
  });

  it("strips www. prefix", () => {
    expect(extractDomain("https://www.tomtom.com")).toBe("tomtom.com");
  });

  it("handles URLs without www", () => {
    expect(extractDomain("https://avy.eu")).toBe("avy.eu");
  });

  it("handles URLs with paths", () => {
    expect(extractDomain("https://www.ccv.eu/en/products")).toBe("ccv.eu");
  });

  it("returns null for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBeNull();
  });
});

describe("Excel file parsing", () => {
  it("parses a beurs-style workbook with Company Name + Website columns", () => {
    // Build a minimal workbook in memory
    const wb = XLSX.utils.book_new();
    const data = [
      ["Company Name", "Website"],
      ["Arcadis Nederland B.V.", "https://www.arcadis.com"],
      ["Also Nederland B.V.", "–"],
      ["TomTom", "https://www.tomtom.com"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const headers = rows[0] as string[];
    const { nameCol, websiteCol } = detectColumns(headers);

    expect(nameCol).toBe(0);
    expect(websiteCol).toBe(1);

    const exhibitors = rows.slice(1).map((row) => ({
      name: (row[nameCol] || "").toString().trim(),
      websiteUrl: cleanWebsite(websiteCol >= 0 ? row[websiteCol] : null),
    })).filter((e) => e.name);

    expect(exhibitors).toHaveLength(3);
    expect(exhibitors[0]).toEqual({ name: "Arcadis Nederland B.V.", websiteUrl: "https://www.arcadis.com" });
    expect(exhibitors[1]).toEqual({ name: "Also Nederland B.V.", websiteUrl: null }); // dash → null
    expect(exhibitors[2]).toEqual({ name: "TomTom", websiteUrl: "https://www.tomtom.com" });
  });

  it("handles a file with only a Name column (no website)", () => {
    const wb = XLSX.utils.book_new();
    const data = [["Name"], ["Company A"], ["Company B"]];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const { nameCol, websiteCol } = detectColumns(rows[0] as string[]);

    expect(nameCol).toBe(0);
    expect(websiteCol).toBe(-1);

    const exhibitors = rows.slice(1).map((row) => ({
      name: (row[nameCol] || "").toString().trim(),
      websiteUrl: websiteCol >= 0 ? cleanWebsite(row[websiteCol]) : null,
    })).filter((e) => e.name);

    expect(exhibitors).toHaveLength(2);
    expect(exhibitors[0].websiteUrl).toBeNull();
  });
});
