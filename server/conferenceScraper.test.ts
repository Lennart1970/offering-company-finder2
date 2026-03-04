import { describe, expect, it, vi, afterEach } from "vitest";

// We test the pure extraction functions by importing the module and testing
// the exported scrapeConferenceExhibitors function with mocked axios.

vi.mock("axios");
import axios from "axios";

// ---------------------------------------------------------------------------
// HTML extraction strategies (single-page)
// ---------------------------------------------------------------------------

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
    expect(result.pagesScraped).toBe(1);
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

    const originalKey = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://empty-conf.com/exhibitors");

    expect(result.exhibitors).toHaveLength(0);
    expect(result.pagesScraped).toBe(1);

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

// ---------------------------------------------------------------------------
// Pagination detection
// ---------------------------------------------------------------------------

describe("Conference Scraper - Pagination detection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detectNextPageUrl: detects rel=next link", async () => {
    const { detectNextPageUrl } = await import("./conferenceScraper");
    const html = `<link rel="next" href="https://conf.com/exhibitors?page=2"/>`;
    const next = detectNextPageUrl(html, "https://conf.com/exhibitors?page=1", 1);
    expect(next).toBe("https://conf.com/exhibitors?page=2");
  });

  it("detectNextPageUrl: detects Next anchor text", async () => {
    const { detectNextPageUrl } = await import("./conferenceScraper");
    const html = `<a href="/exhibitors?page=2">Next</a>`;
    const next = detectNextPageUrl(html, "https://conf.com/exhibitors?page=1", 1);
    expect(next).toContain("page=2");
  });

  it("detectNextPageUrl: detects › (chevron) anchor", async () => {
    const { detectNextPageUrl } = await import("./conferenceScraper");
    const html = `<a href="https://conf.com/exhibitors?page=3">›</a>`;
    const next = detectNextPageUrl(html, "https://conf.com/exhibitors?page=2", 2);
    expect(next).toBe("https://conf.com/exhibitors?page=3");
  });

  it("detectNextPageUrl: increments query param ?page=N", async () => {
    const { detectNextPageUrl } = await import("./conferenceScraper");
    // No explicit next link, but current URL has ?page=1
    const html = `<p>No pagination links here</p>`;
    const next = detectNextPageUrl(html, "https://conf.com/exhibitors?page=1", 1);
    expect(next).toContain("page=2");
  });

  it("detectNextPageUrl: increments path-segment /page/N", async () => {
    const { detectNextPageUrl } = await import("./conferenceScraper");
    const html = `<p>No pagination links here</p>`;
    const next = detectNextPageUrl(html, "https://conf.com/exhibitors/page/3", 3);
    expect(next).toContain("/page/4");
  });

  it("detectNextPageUrl: returns null when no pagination found", async () => {
    const { detectNextPageUrl } = await import("./conferenceScraper");
    const html = `<a href="https://conf.com/about">About</a>`;
    const next = detectNextPageUrl(html, "https://conf.com/exhibitors", 1);
    expect(next).toBeNull();
  });

  it("detectTotalPages: extracts highest page number from numbered links", async () => {
    const { detectTotalPages } = await import("./conferenceScraper");
    const html = `
      <a href="/exhibitors?page=1">1</a>
      <a href="/exhibitors?page=2">2</a>
      <a href="/exhibitors?page=3">3</a>
      <a href="/exhibitors?page=4">4</a>
      <a href="/exhibitors?page=5">5</a>
    `;
    const total = detectTotalPages(html, "https://conf.com/exhibitors?page=1");
    expect(total).toBe(5);
  });

  it("detectTotalPages: returns null for single-page sites", async () => {
    const { detectTotalPages } = await import("./conferenceScraper");
    const html = `<p>All exhibitors listed here.</p>`;
    const total = detectTotalPages(html, "https://conf.com/exhibitors");
    expect(total).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Multi-page crawling
// ---------------------------------------------------------------------------

describe("Conference Scraper - Multi-page crawling", () => {
  const mockedAxios = axios as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crawls 3 pages when pagination links are present, deduplicates across pages", async () => {
    const page1 = `
      <html>
        <head><title>Big Conference - Exhibitors</title></head>
        <body>
          <a href="https://alpha.com"><img alt="Alpha Corp" src="a.png"/></a>
          <a href="https://beta.com"><img alt="Beta Industries" src="b.png"/></a>
          <a href="https://gamma.com"><img alt="Gamma Solutions" src="g.png"/></a>
          <a href="https://delta.com"><img alt="Delta Manufacturing" src="d.png"/></a>
          <a href="https://epsilon.com"><img alt="Epsilon Tech" src="e.png"/></a>
          <a href="/exhibitors?page=2">Next</a>
          <a href="/exhibitors?page=1">1</a>
          <a href="/exhibitors?page=2">2</a>
          <a href="/exhibitors?page=3">3</a>
        </body>
      </html>
    `;
    const page2 = `
      <html>
        <head><title>Big Conference - Exhibitors</title></head>
        <body>
          <a href="https://zeta.com"><img alt="Zeta Systems" src="z.png"/></a>
          <a href="https://eta.com"><img alt="Eta Engineering" src="eta.png"/></a>
          <a href="https://theta.com"><img alt="Theta Robotics" src="th.png"/></a>
          <a href="https://iota.com"><img alt="Iota Automation" src="io.png"/></a>
          <a href="https://kappa.com"><img alt="Kappa Controls" src="k.png"/></a>
          <a href="/exhibitors?page=3">Next</a>
        </body>
      </html>
    `;
    const page3 = `
      <html>
        <head><title>Big Conference - Exhibitors</title></head>
        <body>
          <a href="https://lambda.com"><img alt="Lambda Tech" src="l.png"/></a>
          <a href="https://mu.com"><img alt="Mu Manufacturing" src="m.png"/></a>
          <!-- Alpha Corp appears again on page 3 — should be deduplicated -->
          <a href="https://alpha.com"><img alt="Alpha Corp" src="a2.png"/></a>
        </body>
      </html>
    `;

    // Page 4 returns 0 companies → scraper stops
    const page4 = `
      <html><head><title>Big Conference</title></head><body><p>No more exhibitors.</p></body></html>
    `;

    mockedAxios.get = vi.fn()
      .mockResolvedValueOnce({ data: page1 })  // page 1
      .mockResolvedValueOnce({ data: page2 })  // page 2
      .mockResolvedValueOnce({ data: page3 })  // page 3
      .mockResolvedValueOnce({ data: page4 }); // page 4 (0 companies → stop)

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const progressCalls: any[] = [];
    const result = await scrapeConferenceExhibitors(
      "https://big-conf.com/exhibitors",
      (p) => progressCalls.push(p)
    );

    // Should have scraped 3 pages (page 4 had 0 companies)
    expect(result.pagesScraped).toBe(3);

    // Alpha Corp appears on page 1 and page 3 but should only appear once
    const names = result.exhibitors.map(e => e.name);
    const alphaCount = names.filter(n => n === "Alpha Corp").length;
    expect(alphaCount).toBe(1);

    // Total unique companies: 5 (p1) + 5 (p2) + 2 new (p3, Alpha deduped) = 12
    expect(result.exhibitors.length).toBe(12);

    // Progress callback should have been called once per page
    expect(progressCalls.length).toBe(3);
    expect(progressCalls[0].page).toBe(1);
    expect(progressCalls[1].page).toBe(2);
    expect(progressCalls[2].page).toBe(3);
  });

  it("stops at MAX_PAGES limit even if more pages exist", async () => {
    // Every page has 5 companies and a "Next" link
    const makePageHtml = (n: number) => `
      <html>
        <head><title>Huge Conference</title></head>
        <body>
          <a href="https://co${n}a.com"><img alt="Company ${n}A" src="a.png"/></a>
          <a href="https://co${n}b.com"><img alt="Company ${n}B" src="b.png"/></a>
          <a href="https://co${n}c.com"><img alt="Company ${n}C" src="c.png"/></a>
          <a href="https://co${n}d.com"><img alt="Company ${n}D" src="d.png"/></a>
          <a href="https://co${n}e.com"><img alt="Company ${n}E" src="e.png"/></a>
          <a href="/exhibitors?page=${n + 1}">Next</a>
        </body>
      </html>
    `;

    // Return a page for every call (simulating infinite pagination)
    let callCount = 0;
    mockedAxios.get = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ data: makePageHtml(callCount) });
    });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors(
      "https://huge-conf.com/exhibitors",
      undefined,
      3 // maxPages = 3 for test speed
    );

    expect(result.pagesScraped).toBe(3);
    expect(result.exhibitors.length).toBe(15); // 5 per page × 3 pages
  });

  it("does not revisit the same URL (loop protection)", async () => {
    // Page always points to itself as "Next"
    const html = `
      <html>
        <head><title>Loop Conference</title></head>
        <body>
          <a href="https://co1.com"><img alt="Company One" src="a.png"/></a>
          <a href="https://co2.com"><img alt="Company Two" src="b.png"/></a>
          <a href="https://co3.com"><img alt="Company Three" src="c.png"/></a>
          <a href="https://co4.com"><img alt="Company Four" src="d.png"/></a>
          <a href="https://co5.com"><img alt="Company Five" src="e.png"/></a>
          <a href="/exhibitors">Next</a>
        </body>
      </html>
    `;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://loop-conf.com/exhibitors");

    // Should only scrape 1 page (next URL = current URL → stop)
    expect(result.pagesScraped).toBe(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Apollo enrichment
// ---------------------------------------------------------------------------

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
