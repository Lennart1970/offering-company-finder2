import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV module so we can control the API key
vi.mock("./_core/env", () => ({
  ENV: { serperApiKey: "test-key-123" },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("fetchSerperImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns domain-matched images first", async () => {
    const ownDomainImages = [
      { imageUrl: "https://connectgroup.com/img2.jpg", thumbnailUrl: "https://connectgroup.com/t2.jpg", title: "CG image", source: "Connect Group", domain: "www.connectgroup.com", link: "https://connectgroup.com" },
    ];
    const broadImages = [
      { imageUrl: "https://other.com/img1.jpg", thumbnailUrl: "https://other.com/t1.jpg", title: "Other image", source: "Other", domain: "other.com", link: "https://other.com" },
    ];

    // Two fetch calls: first for site: query, second for broad query
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: ownDomainImages }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: broadImages }) });

    const { fetchSerperImages } = await import("./serperImages");
    const result = await fetchSerperImages("Connect Group", "connectgroup.com", 6);

    // Domain-matched image should come first
    expect(result[0].domain).toBe("www.connectgroup.com");
    expect(result[1].domain).toBe("other.com");
  });

  it("calls the Serper API with correct headers", async () => {
    // Two fetch calls: site: query + broad query
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: [] }) });

    const { fetchSerperImages } = await import("./serperImages");
    await fetchSerperImages("Acme Corp", "acme.com", 3);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://google.serper.dev/images",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-KEY": "test-key-123",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("throws when API key is missing", async () => {
    const envMod = await import("./_core/env");
    const original = (envMod as any).ENV.serperApiKey;
    (envMod as any).ENV.serperApiKey = "";
    const { fetchSerperImages: fetchNoKey } = await import("./serperImages");
    await expect(fetchNoKey("Test", "test.com")).rejects.toThrow("SERPER_API_KEY");
    (envMod as any).ENV.serperApiKey = original;
  });

  it("throws on non-ok API response", async () => {
    // First call (site: query) fails with 401
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: "Unauthorized" })
      // Second call (broad query) also fails so the error propagates
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: "Unauthorized" });

    const { fetchSerperImages } = await import("./serperImages");
    await expect(fetchSerperImages("Test Co", "test.com")).rejects.toThrow("401");
  });

  it("returns empty array when API returns no images", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: [] }) });

    const { fetchSerperImages } = await import("./serperImages");
    const result = await fetchSerperImages("Empty Corp", "empty.com");
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    const siteImages = Array.from({ length: 5 }, (_, i) => ({
      imageUrl: `https://example.com/img${i}.jpg`,
      thumbnailUrl: `https://example.com/t${i}.jpg`,
      title: `Site Image ${i}`,
      source: "Example",
      domain: "example.com",
      link: `https://example.com/${i}`,
    }));
    const broadImages = Array.from({ length: 5 }, (_, i) => ({
      imageUrl: `https://other.com/img${i}.jpg`,
      thumbnailUrl: `https://other.com/t${i}.jpg`,
      title: `Other Image ${i}`,
      source: "Other",
      domain: "other.com",
      link: `https://other.com/${i}`,
    }));

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: siteImages }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: broadImages }) });

    const { fetchSerperImages } = await import("./serperImages");
    const result = await fetchSerperImages("Example", "example.com", 4);
    expect(result.length).toBe(4);
  });
});
