import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// We test the pure extraction functions by importing the module and testing
// the exported scrapeConferenceExhibitors function with mocked axios.

vi.mock("axios");
import axios from "axios";

describe("Conference Scraper - HTML extraction strategies", () => {
  const mockedAxios = axios as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts exhibitors using logo-link strategy (img alt + anchor href)", async () => {
    const html = `
      <html>
        <head><title>CONEXPO Exhibitors</title></head>
        <body>
          <a href="https://caterpillar.com"><img alt="Caterpillar" src="cat.png"/></a>
          <a href="https://johndeere.com"><img alt="John Deere" src="jd.png"/></a>
          <a href="https://komatsu.com"><img alt="Komatsu" src="kom.png"/></a>
          <a href="https://conexpoconagg.com"><img alt="Home" src="logo.png"/></a>
        </body>
      </html>
    `;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://www.conexpoconagg.com/exhibitor-sponsors");

    expect(result.strategy).toBe("logo-link");
    expect(result.pageTitle).toBe("CONEXPO Exhibitors");
    // Should include Caterpillar, John Deere, Komatsu but NOT the conference site itself
    const names = result.exhibitors.map(e => e.name);
    expect(names).toContain("Caterpillar");
    expect(names).toContain("John Deere");
    expect(names).toContain("Komatsu");
    expect(names).not.toContain("Home");
  });

  it("deduplicates exhibitors with the same name", async () => {
    const html = `
      <html>
        <head><title>Test Conference</title></head>
        <body>
          <a href="https://acme.com"><img alt="ACME Corp" src="acme.png"/></a>
          <a href="https://acme.com/contact"><img alt="ACME Corp" src="acme2.png"/></a>
          <a href="https://beta.com"><img alt="Beta Industries" src="beta.png"/></a>
        </body>
      </html>
    `;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://example-conf.com/exhibitors");

    const names = result.exhibitors.map(e => e.name);
    const acmeCount = names.filter(n => n.toLowerCase() === "acme corp").length;
    expect(acmeCount).toBe(1); // deduplicated
    expect(names).toContain("Beta Industries");
  });

  it("filters out social media links", async () => {
    const html = `
      <html>
        <head><title>Conference</title></head>
        <body>
          <a href="https://linkedin.com/company/acme"><img alt="ACME on LinkedIn" src="li.png"/></a>
          <a href="https://twitter.com/acme"><img alt="ACME Twitter" src="tw.png"/></a>
          <a href="https://realcompany.com"><img alt="Real Company" src="rc.png"/></a>
        </body>
      </html>
    `;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://example-conf.com/exhibitors");

    const names = result.exhibitors.map(e => e.name);
    expect(names).toContain("Real Company");
    // LinkedIn/Twitter links should be filtered
    expect(names).not.toContain("ACME on LinkedIn");
    expect(names).not.toContain("ACME Twitter");
  });

  it("falls back to text-link strategy when logo-link finds fewer than 5 companies", async () => {
    const html = `
      <html>
        <head><title>Small Conference</title></head>
        <body>
          <ul>
            <li><a href="https://alpha.com">Alpha Corp</a></li>
            <li><a href="https://beta.com">Beta Industries</a></li>
            <li><a href="https://gamma.com">Gamma Solutions</a></li>
            <li><a href="https://delta.com">Delta Manufacturing</a></li>
            <li><a href="https://epsilon.com">Epsilon Tech</a></li>
            <li><a href="https://zeta.com">Zeta Systems</a></li>
          </ul>
        </body>
      </html>
    `;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://small-conf.com/exhibitors");

    // text-link strategy should pick up these companies
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(5);
    const names = result.exhibitors.map(e => e.name);
    expect(names).toContain("Alpha Corp");
    expect(names).toContain("Beta Industries");
  });

  it("returns empty exhibitors when page has no extractable companies", async () => {
    const html = `
      <html>
        <head><title>Empty Page</title></head>
        <body>
          <p>No exhibitors listed yet.</p>
        </body>
      </html>
    `;

    // Mock XAI_API_KEY as undefined to skip Grok fallback
    const originalKey = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://empty-conf.com/exhibitors");

    expect(result.exhibitors).toHaveLength(0);

    if (originalKey) process.env.XAI_API_KEY = originalKey;
  });

  it("cleans URLs by removing tracking parameters", async () => {
    const html = `
      <html>
        <head><title>Tracking Test</title></head>
        <body>
          <a href="https://company.com?utm_source=conference&utm_medium=web&utm_campaign=2026">
            <img alt="Company Name" src="logo.png"/>
          </a>
        </body>
      </html>
    `;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://conf.com/exhibitors");

    expect(result.exhibitors).toHaveLength(1);
    expect(result.exhibitors[0].websiteUrl).toBe("https://company.com");
    expect(result.exhibitors[0].name).toBe("Company Name");
  });
});

describe("Conference Scraper - Apollo enrichment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when Apollo returns 404 for unknown domain", async () => {
    const mockedAxios = axios as any;
    mockedAxios.post = vi.fn().mockRejectedValue({
      response: { status: 404 },
      message: "Not Found",
    });

    const { apolloEnrichByDomain } = await import("./conferenceScraper");
    const result = await apolloEnrichByDomain("unknowncompany12345.com");

    expect(result).toBeNull();
  });

  it("returns enriched data when Apollo finds the company", async () => {
    const mockedAxios = axios as any;
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        organization: {
          id: "apollo-org-123",
          name: "Caterpillar Inc.",
          website_url: "https://cat.com",
          primary_domain: "cat.com",
          linkedin_url: "https://linkedin.com/company/caterpillar",
          phone: "+1-309-675-1000",
          founded_year: 1925,
          organization_revenue_printed: "$59.4B",
          organization_headcount_six_month_growth: 0.02,
          organization_headcount_twelve_month_growth: 0.04,
          sic_codes: ["3531"],
          naics_codes: ["333120"],
          city: "Deerfield",
          state: "Illinois",
          country: "US",
          street_address: "510 Lake Cook Rd",
        },
      },
    });

    const { apolloEnrichByDomain } = await import("./conferenceScraper");
    const result = await apolloEnrichByDomain("cat.com");

    expect(result).not.toBeNull();
    expect(result!.apolloId).toBe("apollo-org-123");
    expect(result!.name).toBe("Caterpillar Inc.");
    expect(result!.sicCodes).toContain("3531");
    expect(result!.naicsCodes).toContain("333120");
    expect(result!.headcountGrowth).toContain("2.0%");
  });
});
