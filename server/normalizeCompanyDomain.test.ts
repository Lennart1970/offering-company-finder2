import { describe, it, expect } from "vitest";
import {
  normalizeHostname,
  extractHostnameFromWebsite,
  normalizeCompanyDomain,
} from "./normalizeCompanyDomain";

describe("normalizeCompanyDomain", () => {
  it("prefers primaryDomain over websiteUrl", () => {
    expect(
      normalizeCompanyDomain({
        primaryDomain: "www.saab.com",
        websiteUrl: "https://other.com",
      }),
    ).toBe("saab.com");
  });

  it("falls back to website host when primaryDomain is empty", () => {
    expect(
      normalizeCompanyDomain({
        primaryDomain: "",
        websiteUrl: "https://www.thalesgroup.com/en/countries",
      }),
    ).toBe("thalesgroup.com");
  });

  it("handles website without protocol", () => {
    expect(normalizeCompanyDomain({ websiteUrl: "www.siemens-energy.com" })).toBe(
      "siemens-energy.com",
    );
  });

  it("returns null when no domain source", () => {
    expect(normalizeCompanyDomain({})).toBeNull();
  });
});

describe("normalizeHostname", () => {
  it("strips www and lowercases", () => {
    expect(normalizeHostname("WWW.Example.COM/path")).toBe("example.com");
  });
});

describe("extractHostnameFromWebsite", () => {
  it("parses https URLs", () => {
    expect(extractHostnameFromWebsite("https://www.smartphotonics.nl")).toBe(
      "smartphotonics.nl",
    );
  });
});
