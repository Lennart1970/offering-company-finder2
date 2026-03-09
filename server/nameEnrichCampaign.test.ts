import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for POST /api/v1/name-enrich-campaign endpoint.
 *
 * We mock the database helpers and apolloEnrichByName to test the
 * endpoint logic without real network calls.
 */

// Mock db helpers
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getSearchById: vi.fn(),
  getPendingCompaniesBySearchId: vi.fn(),
  getCompaniesBySearchId: vi.fn(),
  updateCompany: vi.fn(),
  createSearch: vi.fn(),
  createCompanies: vi.fn(),
}));

// Mock conferenceScraper to control apolloEnrichByName
vi.mock("./conferenceScraper", () => ({
  apolloEnrichByName: vi.fn(),
}));

import { getSearchById, getPendingCompaniesBySearchId, updateCompany } from "./db";
import { apolloEnrichByName } from "./conferenceScraper";

// Helper: build a minimal Express-like request/response for testing the handler
function makeReqRes(body: object) {
  const chunks: string[] = [];
  const res = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => { chunks.push(chunk); }),
    end: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    getChunks: () => chunks.map(c => JSON.parse(c.trim())),
  };
  const req = { body, headers: {} };
  return { req, res };
}

// Import the router handler by loading the module and extracting the route
// Since the endpoint is in api.ts, we test the logic by calling the handler directly
// via a lightweight integration approach using the actual Express app
async function callNameEnrichEndpoint(body: object): Promise<any[]> {
  const apiKey = process.env.API_KEY || "test-key";
  // We'll test the logic by invoking the handler function directly
  // by extracting the route handler from the router
  const { default: router } = await import("./routes/api");

  const chunks: any[] = [];
  const res: any = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      try { chunks.push(JSON.parse(chunk.trim())); } catch {}
    }),
    end: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn((data: any) => { chunks.push(data); }),
  };

  // Find the name-enrich-campaign route handler
  const stack = (router as any).stack || [];
  const route = stack.find((layer: any) =>
    layer.route?.path === "/name-enrich-campaign" &&
    layer.route?.methods?.post
  );

  if (!route) throw new Error("Route /name-enrich-campaign not found in router");

  const handler = route.route.stack[0].handle;
  const req = { body, headers: { authorization: `Bearer ${apiKey}` } };
  await handler(req, res, vi.fn());

  return chunks;
}

describe("POST /api/v1/name-enrich-campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 when searchId is missing", async () => {
    // Test via the router directly
    const { default: router } = await import("./routes/api");
    const stack = (router as any).stack || [];
    const route = stack.find((layer: any) =>
      layer.route?.path === "/name-enrich-campaign" &&
      layer.route?.methods?.post
    );
    const handler = route.route.stack[0].handle;

    const res: any = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const req = { body: {}, headers: {} };
    await handler(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "searchId is required" }));
  });

  it("streams 'done' with 0 enriched when no pending companies", async () => {
    const { getSearchById, getPendingCompaniesBySearchId } = await import("./db");
    (getSearchById as any).mockResolvedValue({ id: 123, companyWebsite: "test.com" });
    (getPendingCompaniesBySearchId as any).mockResolvedValue([]);

    const chunks = await callNameEnrichEndpoint({ searchId: 123, limit: 10 });

    const done = chunks.find(c => c.status === "done");
    expect(done).toBeDefined();
    expect(done.enriched).toBe(0);
    expect(done.failed).toBe(0);
  });

  it("enriches companies found by Apollo and marks failed ones", async () => {
    const { getSearchById, getPendingCompaniesBySearchId, updateCompany } = await import("./db");
    const { apolloEnrichByName } = await import("./conferenceScraper");

    (getSearchById as any).mockResolvedValue({ id: 900002 });
    (getPendingCompaniesBySearchId as any).mockResolvedValue([
      { id: 1, name: "Arvoo Imaging Products B.V.", apolloId: null, primaryDomain: null, websiteUrl: null, country: null },
      { id: 2, name: "Unknown Corp XYZ", apolloId: null, primaryDomain: null, websiteUrl: null, country: null },
    ]);

    (apolloEnrichByName as any)
      .mockResolvedValueOnce({
        apolloId: "apollo-001",
        name: "Arvoo Imaging Products B.V.",
        primaryDomain: "arvoo.com",
        websiteUrl: "https://www.arvoo.com",
        country: "Netherlands",
        city: "Harmelen",
        sicCodes: ["3827"],
        naicsCodes: ["333314"],
      })
      .mockResolvedValueOnce(null); // Not found

    const chunks = await callNameEnrichEndpoint({ searchId: 900002, limit: 10, concurrency: 1 });

    const done = chunks.find(c => c.status === "done");
    expect(done).toBeDefined();
    expect(done.enriched).toBe(1);
    expect(done.failed).toBe(1);

    // Verify updateCompany was called correctly for the found company
    expect(updateCompany).toHaveBeenCalledWith(1, expect.objectContaining({
      apolloId: "apollo-001",
      primaryDomain: "arvoo.com",
      country: "Netherlands",
      enrichmentStatus: "enriched",
    }));

    // Verify failed company was marked as failed
    expect(updateCompany).toHaveBeenCalledWith(2, { enrichmentStatus: "failed" });
  });

  it("skips junk localhost entries from Next.js internal routes", async () => {
    const { getSearchById, getPendingCompaniesBySearchId } = await import("./db");
    const { apolloEnrichByName } = await import("./conferenceScraper");

    (getSearchById as any).mockResolvedValue({ id: 900002 });
    (getPendingCompaniesBySearchId as any).mockResolvedValue([
      { id: 1, name: "Metadata", apolloId: null, primaryDomain: null, websiteUrl: "https://localhost/presentation/partial-designs/web/label/metadata", country: null },
      { id: 2, name: "Real Company", apolloId: null, primaryDomain: null, websiteUrl: null, country: null },
    ]);

    (apolloEnrichByName as any).mockResolvedValue({
      apolloId: "apollo-real",
      name: "Real Company",
      primaryDomain: "realco.com",
    });

    const chunks = await callNameEnrichEndpoint({ searchId: 900002, limit: 10, concurrency: 1 });

    // apolloEnrichByName should only be called for the real company, not the localhost junk
    expect(apolloEnrichByName).toHaveBeenCalledTimes(1);
    expect(apolloEnrichByName).toHaveBeenCalledWith("Real Company", null);

    const done = chunks.find(c => c.status === "done");
    expect(done.enriched).toBe(1);
  });

  it("respects the limit parameter", async () => {
    const { getSearchById, getPendingCompaniesBySearchId } = await import("./db");
    const { apolloEnrichByName } = await import("./conferenceScraper");

    (getSearchById as any).mockResolvedValue({ id: 900002 });
    // Return 10 companies but limit=3
    (getPendingCompaniesBySearchId as any).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Company ${i + 1}`,
        apolloId: null,
        primaryDomain: null,
        websiteUrl: null,
        country: null,
      }))
    );

    (apolloEnrichByName as any).mockResolvedValue(null);

    const chunks = await callNameEnrichEndpoint({ searchId: 900002, limit: 3, concurrency: 1 });

    // Should only process 3 companies
    expect(apolloEnrichByName).toHaveBeenCalledTimes(3);
    const started = chunks.find(c => c.status === "started");
    expect(started.total).toBe(3);
  });

  it("returns error when search not found", async () => {
    const { getSearchById } = await import("./db");
    (getSearchById as any).mockResolvedValue(null);

    const chunks = await callNameEnrichEndpoint({ searchId: 99999 });

    expect(chunks.some(c => c.error && c.error.includes("99999"))).toBe(true);
  });
});
