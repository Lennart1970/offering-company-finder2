/**
 * Tests for the BOM image proxy helper (fetchImageAsDataUri).
 *
 * The helper is a private function inside prototypeRouter.ts, so we replicate
 * its logic here to keep tests fast and free of server dependencies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Replicate the proxy logic from prototypeRouter.ts ────────────────────────
async function fetchImageAsDataUri(
  url: string,
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BOMAnalyser/1.0)",
          "Accept": "image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType.split(";")[0].trim()};base64,${base64}`;
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeResponse(
  status: number,
  contentType: string,
  body: Uint8Array | string = new Uint8Array([0xff, 0xd8]) // minimal JPEG magic bytes
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("fetchImageAsDataUri (BOM image proxy)", () => {
  it("returns a base64 data URI for a valid JPEG response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(200, "image/jpeg", new Uint8Array([0xff, 0xd8, 0xff]))
    );
    const result = await fetchImageAsDataUri("https://example.com/img.jpg", mockFetch as any);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("returns a base64 data URI for a valid PNG response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(200, "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    );
    const result = await fetchImageAsDataUri("https://example.com/img.png", mockFetch as any);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("strips charset from content-type (e.g. image/jpeg; charset=utf-8)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(200, "image/jpeg; charset=utf-8")
    );
    const result = await fetchImageAsDataUri("https://example.com/img.jpg", mockFetch as any);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("returns null for a 404 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(404, "text/html", "Not Found")
    );
    const result = await fetchImageAsDataUri("https://example.com/missing.jpg", mockFetch as any);
    expect(result).toBeNull();
  });

  it("returns null for a 403 response (CDN blocked)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(403, "text/html", "Forbidden")
    );
    const result = await fetchImageAsDataUri("https://cdn.example.com/img.jpg", mockFetch as any);
    expect(result).toBeNull();
  });

  it("returns null when content-type is text/html (not an image)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(200, "text/html", "<html>redirect page</html>")
    );
    const result = await fetchImageAsDataUri("https://example.com/redirect", mockFetch as any);
    expect(result).toBeNull();
  });

  it("returns null when content-type is application/json", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(200, "application/json", "{}")
    );
    const result = await fetchImageAsDataUri("https://api.example.com/img", mockFetch as any);
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await fetchImageAsDataUri("https://example.com/img.jpg", mockFetch as any);
    expect(result).toBeNull();
  });

  it("returns null when fetch is aborted (timeout)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
    );
    const result = await fetchImageAsDataUri("https://slow.example.com/img.jpg", mockFetch as any);
    expect(result).toBeNull();
  });

  it("sends correct User-Agent and Accept headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse(200, "image/jpeg")
    );
    await fetchImageAsDataUri("https://example.com/img.jpg", mockFetch as any);
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("BOMAnalyser");
    expect(headers["Accept"]).toContain("image/*");
  });

  it("filters out null results when processing multiple images", async () => {
    const results = await Promise.all([
      fetchImageAsDataUri("https://ok.com/img.jpg", vi.fn().mockResolvedValue(makeResponse(200, "image/jpeg")) as any),
      fetchImageAsDataUri("https://broken.com/img.jpg", vi.fn().mockResolvedValue(makeResponse(404, "text/html")) as any),
      fetchImageAsDataUri("https://ok2.com/img.png", vi.fn().mockResolvedValue(makeResponse(200, "image/png")) as any),
    ]);
    const valid = results.filter((r): r is string => r !== null);
    expect(valid).toHaveLength(2);
    expect(valid[0]).toMatch(/^data:image\/jpeg/);
    expect(valid[1]).toMatch(/^data:image\/png/);
  });
});
