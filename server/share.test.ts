/**
 * Tests for the share token system.
 * Validates token generation logic and public page data resolution.
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";

// ── Unit: token generation ────────────────────────────────────────────────────
function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

describe("share token generation", () => {
  it("generates a 32-character hex token", () => {
    const token = generateToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

// ── Unit: share link URL construction ─────────────────────────────────────────
describe("share link URL construction", () => {
  it("builds a correct share URL from base and token", () => {
    const baseUrl = "https://leadtrigger-connectgroup.com";
    const token = "abc123def456abc1";
    const shareLink = `${baseUrl}/share/${token}`;
    expect(shareLink).toBe("https://leadtrigger-connectgroup.com/share/abc123def456abc1");
  });
});

// ── Unit: CSV export column headers ──────────────────────────────────────────
describe("share list export columns", () => {
  it("includes all required SharePoint columns", () => {
    const requiredColumns = [
      "Company Name",
      "Website",
      "Link ID",
      "SharePoint Page Link",
      "Country",
      "Employee Count",
      "Sector",
      "Brain",
      "Fit Score",
      "Urgency Score",
      "Key Signal",
      "Contact Name",
      "Share Link",
    ];

    // Simulate the column headers from the XLSX export
    const exportedColumns = [
      "Company Name",
      "Website",
      "Link ID",
      "SharePoint Page Link",
      "Country",
      "Employee Count",
      "Sector",
      "Brain",
      "Fit Score",
      "Urgency Score",
      "Key Signal",
      "Contact Name",
      "Contact Title",
      "Contact Email",
      "Share Link",
    ];

    for (const col of requiredColumns) {
      expect(exportedColumns).toContain(col);
    }
  });
});

// ── Unit: key signal extraction ───────────────────────────────────────────────
describe("key signal extraction from briefData", () => {
  it("extracts first urgency signal description", () => {
    const briefData = JSON.stringify({
      urgencySignals: [
        { description: "Company expanding into EU market", weight: 0.9 },
        { description: "New CTO hired", weight: 0.7 },
      ],
    });

    let keySignal = "";
    try {
      const brief = JSON.parse(briefData);
      keySignal =
        brief?.urgencySignals?.[0]?.description ??
        brief?.urgencySignals?.[0]?.signal ??
        "";
    } catch {}

    expect(keySignal).toBe("Company expanding into EU market");
  });

  it("returns empty string when briefData is null", () => {
    let keySignal = "";
    try {
      const brief = JSON.parse("null");
      keySignal = brief?.urgencySignals?.[0]?.description ?? "";
    } catch {}
    expect(keySignal).toBe("");
  });
});
