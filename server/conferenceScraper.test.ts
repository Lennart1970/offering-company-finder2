import { describe, expect, it, vi, afterEach } from "vitest";

/**
 * Tests for the robust conference scraper pipeline.
 *
 * We mock axios and puppeteer-core to test all pipeline layers without
 * making real network requests.
 */

vi.mock("axios");
import axios from "axios";

// Mock puppeteer-core so tests don't launch a real browser
vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePageHtml(companies: { name: string; url: string }[], nextUrl?: string, totalPages?: number): string {
  const links = companies.map(c => `<a href="${c.url}"><img alt="${c.name}" src="${c.name.toLowerCase().replace(/\s/g, "-")}.png"/></a>`).join("\n");
  const pagination = nextUrl ? `<a href="${nextUrl}">Next</a>` : "";
  const pageLinks = totalPages
    ? Array.from({ length: totalPages }, (_, i) =>
        `<a href="/exhibitors?page=${i + 1}">${i + 1}</a>`
      ).join("")
    : "";
  return `<html><head><title>Test Conference</title></head><body>${links}${pagination}${pageLinks}</body></html>`;
}

const FIVE_COMPANIES = [
  { name: "Alpha Corp", url: "https://alpha.com" },
  { name: "Beta Industries", url: "https://beta.com" },
  { name: "Gamma Solutions", url: "https://gamma.com" },
  { name: "Delta Manufacturing", url: "https://delta.com" },
  { name: "Epsilon Tech", url: "https://epsilon.com" },
];

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

describe("Conference Scraper - extractDomain", () => {
  it("strips www. prefix", async () => {
    const { extractDomain } = await import("./conferenceScraper");
    expect(extractDomain("https://www.caterpillar.com/en/products")).toBe("caterpillar.com");
  });

  it("strips path and query params", async () => {
    const { extractDomain } = await import("./conferenceScraper");
    expect(extractDomain("https://johndeere.com/en/products?ref=conference")).toBe("johndeere.com");
  });

  it("returns null for invalid URL", async () => {
    const { extractDomain } = await import("./conferenceScraper");
    expect(extractDomain("not-a-url")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HTML extraction strategies (single-page, axios path)
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

  it("returns empty exhibitors when page has no extractable companies (no Grok key)", async () => {
    const html = `
      <html>
        <head><title>Empty Page</title></head>
        <body><p>No exhibitors listed yet.</p></body>
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
});

// ---------------------------------------------------------------------------
// Normalised deduplication
// ---------------------------------------------------------------------------

describe("Conference Scraper - Normalised deduplication", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates companies with same name but different legal suffixes", async () => {
    const mockedAxios = axios as any;
    // Page 1: "ACME Corp" — Page 2: "ACME Corporation" (same company, different suffix)
    const page1 = makePageHtml([
      ...FIVE_COMPANIES,
      { name: "ACME Corp", url: "https://acme.com" },
    ], "/exhibitors?page=2");
    const page2 = makePageHtml([
      { name: "ACME Corporation", url: "https://acme.com" }, // duplicate with different suffix
      { name: "Zeta Systems", url: "https://zeta.com" },
      { name: "Eta Engineering", url: "https://eta.com" },
      { name: "Theta Robotics", url: "https://theta.com" },
      { name: "Iota Automation", url: "https://iota.com" },
      { name: "Kappa Controls", url: "https://kappa.com" },
    ]);

    mockedAxios.get = vi.fn()
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 })
      .mockResolvedValueOnce({ data: "<html><body><p>No more</p></body></html>" });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://conf.com/exhibitors");

    const names = result.exhibitors.map(e => e.name);
    // "ACME Corp" and "ACME Corporation" should be deduplicated
    const acmeCount = names.filter(n => n.toLowerCase().includes("acme")).length;
    expect(acmeCount).toBe(1);
  });

  it("deduplicates companies with same name but different casing", async () => {
    const mockedAxios = axios as any;
    const html = `
      <html><head><title>Case Test</title></head><body>
        <a href="https://alpha.com"><img alt="Alpha Corp" src="a.png"/></a>
        <a href="https://alpha2.com"><img alt="ALPHA CORP" src="a2.png"/></a>
        <a href="https://beta.com"><img alt="Beta Industries" src="b.png"/></a>
        <a href="https://gamma.com"><img alt="Gamma Solutions" src="g.png"/></a>
        <a href="https://delta.com"><img alt="Delta Manufacturing" src="d.png"/></a>
        <a href="https://epsilon.com"><img alt="Epsilon Tech" src="e.png"/></a>
      </body></html>
    `;
    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://conf.com/exhibitors");

    const names = result.exhibitors.map(e => e.name.toLowerCase());
    const alphaCount = names.filter(n => n.includes("alpha corp")).length;
    expect(alphaCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Puppeteer fallback
// ---------------------------------------------------------------------------

describe("Conference Scraper - Puppeteer headless fallback", () => {
  const mockedAxios = axios as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to Puppeteer when axios returns JS-rendered page with <5 companies", async () => {
    // Close any cached browser singleton so this test gets a fresh launch
    const { closePuppeteerBrowser } = await import("./conferenceScraper");
    await closePuppeteerBrowser();

    // axios returns a nearly-empty SPA shell
    const spaShell = `<html><head><title>SPA Conference</title></head><body><div id="root"></div></body></html>`;

    // Puppeteer renders the full content
    const renderedHtml = makePageHtml(FIVE_COMPANIES);

    mockedAxios.get = vi.fn().mockResolvedValue({ data: spaShell });

    // Mock puppeteer-core browser via vi.spyOn on the mocked module
    const puppeteerModule = await import("puppeteer-core");
    const mockPage = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(renderedHtml),
      title: vi.fn().mockResolvedValue("SPA Conference"),
      close: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(false),
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      pages: vi.fn().mockResolvedValue([mockPage]),
      close: vi.fn(),
    };
    vi.spyOn(puppeteerModule.default, "launch").mockResolvedValue(mockBrowser as any);

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://spa-conf.com/exhibitors");

    // Should have used Puppeteer
    expect(result.fetchMethod).toBe("puppeteer");
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(5);
    const names = result.exhibitors.map(e => e.name);
    expect(names).toContain("Alpha Corp");
    expect(names).toContain("Epsilon Tech");
  });

  it("uses axios directly when it returns enough companies (no Puppeteer needed)", async () => {
    const html = makePageHtml(FIVE_COMPANIES);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const puppeteerModule = await import("puppeteer-core");
    const launchSpy = vi.spyOn(puppeteerModule.default, "launch");

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://static-conf.com/exhibitors");

    // Should have used axios (fast path) — Puppeteer should NOT be launched
    expect(result.fetchMethod).toBe("axios");
    expect(launchSpy).not.toHaveBeenCalled();
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(5);
  });

  it("falls back to axios HTML when Puppeteer throws", async () => {
    // axios returns a page with some (but <5) companies
    const partialHtml = `
      <html><head><title>Partial Conf</title></head><body>
        <a href="https://alpha.com"><img alt="Alpha Corp" src="a.png"/></a>
        <a href="https://beta.com"><img alt="Beta Industries" src="b.png"/></a>
      </body></html>
    `;
    mockedAxios.get = vi.fn().mockResolvedValue({ data: partialHtml });

    const puppeteerModule = await import("puppeteer-core");
    vi.spyOn(puppeteerModule.default, "launch").mockRejectedValue(new Error("Browser failed to launch"));

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://partial-conf.com/exhibitors");

    // Should fall back to axios result gracefully
    expect(result.fetchMethod).toBe("axios");
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

describe("Conference Scraper - Retry logic", () => {
  const mockedAxios = axios as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on network error and succeeds on second attempt", async () => {
    const html = makePageHtml(FIVE_COMPANIES);

    let callCount = 0;
    mockedAxios.get = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: network error (no response)
        return Promise.reject(new Error("ECONNRESET"));
      }
      return Promise.resolve({ data: html });
    });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://flaky-conf.com/exhibitors");

    expect(callCount).toBe(2); // failed once, succeeded on retry
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(5);
    expect(result.fetchMethod).toBe("axios");
  });

  it("retries on 503 Service Unavailable", async () => {
    const html = makePageHtml(FIVE_COMPANIES);

    let callCount = 0;
    mockedAxios.get = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        const err: any = new Error("Service Unavailable");
        err.response = { status: 503 };
        return Promise.reject(err);
      }
      return Promise.resolve({ data: html });
    });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://slow-conf.com/exhibitors");

    expect(callCount).toBe(3); // failed twice, succeeded on third attempt
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(5);
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

  it("crawls 3 pages, deduplicates across pages", async () => {
    const page1 = makePageHtml([
      ...FIVE_COMPANIES,
      { name: "Sigma Tech", url: "https://sigma.com" },
    ], "/exhibitors?page=2", 3);
    const page2 = makePageHtml([
      { name: "Zeta Systems", url: "https://zeta.com" },
      { name: "Eta Engineering", url: "https://eta.com" },
      { name: "Theta Robotics", url: "https://theta.com" },
      { name: "Iota Automation", url: "https://iota.com" },
      { name: "Kappa Controls", url: "https://kappa.com" },
    ], "/exhibitors?page=3");
    const page3 = makePageHtml([
      { name: "Lambda Tech", url: "https://lambda.com" },
      { name: "Mu Manufacturing", url: "https://mu.com" },
      // Alpha Corp appears again — should be deduplicated
      { name: "Alpha Corp", url: "https://alpha.com" },
    ]);
    const page4 = `<html><body><p>No more exhibitors.</p></body></html>`;

    mockedAxios.get = vi.fn()
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 })
      .mockResolvedValueOnce({ data: page3 })
      .mockResolvedValueOnce({ data: page4 });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const progressCalls: any[] = [];
    const result = await scrapeConferenceExhibitors(
      "https://big-conf.com/exhibitors",
      (p) => progressCalls.push(p)
    );

    expect(result.pagesScraped).toBe(3);

    // Alpha Corp appears on page 1 and page 3 — should only appear once
    const names = result.exhibitors.map(e => e.name);
    const alphaCount = names.filter(n => n === "Alpha Corp").length;
    expect(alphaCount).toBe(1);

    // Total unique: 6 (p1) + 5 (p2) + 2 new (p3) = 13
    expect(result.exhibitors.length).toBe(13);

    // At minimum 3 progress calls (one per page with content);
    // may include extra events from Puppeteer fallback checks
    expect(progressCalls.length).toBeGreaterThanOrEqual(3);
    // The final progress call should report page 3
    const pageProgressCalls = progressCalls.filter(p => p.page !== undefined);
    expect(pageProgressCalls.some(p => p.page === 3)).toBe(true);
  });

  it("stops at maxPages limit", async () => {
    let callCount = 0;
    mockedAxios.get = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ data: makePageHtml(FIVE_COMPANIES, `/exhibitors?page=${callCount + 1}`) });
    });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors(
      "https://huge-conf.com/exhibitors",
      undefined,
      3 // maxPages = 3
    );

    expect(result.pagesScraped).toBe(3);
    // All 3 pages have the same 5 companies — dedup reduces to 5 unique
    expect(result.exhibitors.length).toBe(5);
  });

  it("does not revisit the same URL (loop protection)", async () => {
    // Page always points to itself as "Next"
    const html = makePageHtml(FIVE_COMPANIES, "/exhibitors"); // next = same URL

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://loop-conf.com/exhibitors");

    expect(result.pagesScraped).toBe(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// __NEXT_DATA__ JSON extractor
// ---------------------------------------------------------------------------

describe("Conference Scraper - __NEXT_DATA__ extractor", () => {
  const mockedAxios = axios as any;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts exhibitors from __NEXT_DATA__ JSON blob (Intertraffic pattern)", async () => {
    const exhibitors = [
      { name: "Siemens Mobility", slug: "siemens-mobility", countryCode: "DE" },
      { name: "Kapsch TrafficCom", slug: "kapsch-trafficcom", countryCode: "AT" },
      { name: "Iteris Inc.", slug: "iteris-inc", countryCode: "US" },
      { name: "Q-Free ASA", slug: "q-free-asa", countryCode: "NO" },
      { name: "Yunex Traffic", slug: "yunex-traffic", countryCode: "DE" },
    ];
    const nextData = JSON.stringify({
      props: { pageProps: { exhibitors } }
    });
    const html = `<html><head><title>Intertraffic Amsterdam</title></head><body>
      <script id="__NEXT_DATA__" type="application/json">${nextData}</script>
    </body></html>`;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://www.intertraffic.com/amsterdam/exhibitors");

    expect(result.strategy).toBe("next-data");
    expect(result.exhibitors.length).toBe(5);
    const names = result.exhibitors.map(e => e.name);
    expect(names).toContain("Siemens Mobility");
    expect(names).toContain("Kapsch TrafficCom");
    // countryCode should be preserved
    const siemens = result.exhibitors.find(e => e.name === "Siemens Mobility");
    expect(siemens?.countryCode).toBe("DE");
  });

  it("extracts exhibitors from __NEXT_DATA__ with website URLs when available", async () => {
    const exhibitors = [
      { name: "Alpha Corp", slug: "alpha-corp", countryCode: "NL", website: "https://alpha.com" },
      { name: "Beta Industries", slug: "beta-industries", countryCode: "DE", website: "https://beta.com" },
      { name: "Gamma Solutions", slug: "gamma-solutions", countryCode: "FR", website: "https://gamma.com" },
      { name: "Delta Manufacturing", slug: "delta-mfg", countryCode: "IT" },
      { name: "Epsilon Tech", slug: "epsilon-tech", countryCode: "ES" },
    ];
    const nextData = JSON.stringify({ props: { pageProps: { exhibitors } } });
    const html = `<html><head><title>Test Conf</title></head><body>
      <script id="__NEXT_DATA__">${nextData}</script>
    </body></html>`;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://testconf.com/exhibitors");

    expect(result.strategy).toBe("next-data");
    const alpha = result.exhibitors.find(e => e.name === "Alpha Corp");
    expect(alpha?.websiteUrl).toBe("https://alpha.com");
    const delta = result.exhibitors.find(e => e.name === "Delta Manufacturing");
    expect(delta?.websiteUrl).toBeNull();
  });

  it("falls through to logo-link when no __NEXT_DATA__ present", async () => {
    const html = makePageHtml(FIVE_COMPANIES);
    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://static-conf.com/exhibitors");

    expect(result.strategy).toBe("logo-link");
    expect(result.exhibitors.length).toBeGreaterThanOrEqual(5);
  });

  it("ignores __NEXT_DATA__ arrays that look like nav items (no slug/country/stand)", async () => {
    const navItems = [
      { name: "Home", id: 1 },
      { name: "About", id: 2 },
      { name: "Contact", id: 3 },
    ];
    const nextData = JSON.stringify({ props: { pageProps: { navItems } } });
    // Also include real exhibitors via logo-link
    const logoLinks = FIVE_COMPANIES.map(c =>
      `<a href="${c.url}"><img alt="${c.name}" src="logo.png"/></a>`
    ).join("");
    const html = `<html><head><title>Mixed</title></head><body>
      <script id="__NEXT_DATA__">${nextData}</script>
      ${logoLinks}
    </body></html>`;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: html });

    const { scrapeConferenceExhibitors } = await import("./conferenceScraper");
    const result = await scrapeConferenceExhibitors("https://mixed-conf.com/exhibitors");

    // Should fall through to logo-link since nav array has no slug/country/stand
    expect(result.strategy).toBe("logo-link");
    const names = result.exhibitors.map(e => e.name);
    expect(names).not.toContain("Home");
    expect(names).not.toContain("About");
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

  it("apolloEnrichByName: searches by name + country using organizations/search", async () => {
    const mockedAxios = axios as any;
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        organizations: [{
          id: "apollo-org-456",
          name: "Siemens Mobility GmbH",
          website_url: "https://mobility.siemens.com",
          primary_domain: "mobility.siemens.com",
          linkedin_url: "https://linkedin.com/company/siemens-mobility",
          founded_year: 2017,
          organization_revenue_printed: "€9.9B",
          sic_codes: ["3743"],
          naics_codes: ["336510"],
          city: "Munich",
          state: "Bavaria",
          country: "Germany",
        }],
      },
    });

    const { apolloEnrichByName } = await import("./conferenceScraper");
    const result = await apolloEnrichByName("Siemens Mobility GmbH", "DE");

    expect(result).not.toBeNull();
    expect(result!.apolloId).toBe("apollo-org-456");
    expect(result!.name).toBe("Siemens Mobility GmbH");
    expect(result!.country).toBe("Germany");
    // Verify the API was called with organizations/search (NOT enrich)
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.apollo.io/api/v1/organizations/search",
      expect.objectContaining({
        q_organization_name: "Siemens Mobility GmbH",
        organization_locations: ["Germany"],
      }),
      expect.any(Object)
    );
  });

  it("apolloEnrichByName: picks exact name match over first result", async () => {
    const mockedAxios = axios as any;
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        organizations: [
          { id: "org-wrong", name: "Arvoo Systems Inc", country: "US" },
          { id: "org-correct", name: "Arvoo Imaging Products B.V.", country: "Netherlands", primary_domain: "arvoo.com" },
        ],
      },
    });

    const { apolloEnrichByName } = await import("./conferenceScraper");
    const result = await apolloEnrichByName("Arvoo Imaging Products B.V.", "NL");

    expect(result).not.toBeNull();
    expect(result!.apolloId).toBe("org-correct");
    expect(result!.primaryDomain).toBe("arvoo.com");
  });

  it("apolloEnrichByName: returns null when no organizations found", async () => {
    const mockedAxios = axios as any;
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: { organizations: [] },
    });

    const { apolloEnrichByName } = await import("./conferenceScraper");
    const result = await apolloEnrichByName("Unknown Company XYZ", "NL");

    expect(result).toBeNull();
  });

  it("apolloEnrichByName: works without country code (no location filter)", async () => {
    const mockedAxios = axios as any;
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: { organizations: [{ id: "org-789", name: "ACME Corp" }] },
    });

    const { apolloEnrichByName } = await import("./conferenceScraper");
    const result = await apolloEnrichByName("ACME Corp");

    expect(result).not.toBeNull();
    // Should NOT include organization_locations when no country code
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.apollo.io/api/v1/organizations/search",
      expect.not.objectContaining({ organization_locations: expect.anything() }),
      expect.any(Object)
    );
  });
});
