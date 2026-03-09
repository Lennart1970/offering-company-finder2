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
    const mockImages = [
      { imageUrl: "https://other.com/img1.jpg", thumbnailUrl: "https://other.com/t1.jpg", title: "Other image", source: "Other", domain: "other.com", link: "https://other.com" },
      { imageUrl: "https://connectgroup.com/img2.jpg", thumbnailUrl: "https://connectgroup.com/t2.jpg", title: "CG image", source: "Connect Group", domain: "www.connectgroup.com", link: "https://connectgroup.com" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: mockImages }),
    });

    const { fetchSerperImages } = await import("./serperImages");
    const result = await fetchSerperImages("Connect Group", "connectgroup.com", 6);

    // Domain-matched image should come first
    expect(result[0].domain).toBe("www.connectgroup.com");
    expect(result[1].domain).toBe("other.com");
  });

  it("calls the Serper API with correct headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: [] }),
    });

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
    // Temporarily override the mock to return empty key
    vi.mocked(global.fetch); // ensure fetch mock is active
    // We test this indirectly: the module is already loaded with test-key-123
    // so we just verify the guard logic by calling with a spy that checks the env
    // Instead, test the guard directly by importing a fresh module
    const envMod = await import("./_core/env");
    const original = (envMod as any).ENV.serperApiKey;
    (envMod as any).ENV.serperApiKey = "";
    const { fetchSerperImages: fetchNoKey } = await import("./serperImages");
    await expect(fetchNoKey("Test", "test.com")).rejects.toThrow("SERPER_API_KEY");
    (envMod as any).ENV.serperApiKey = original;
  });

  it("throws on non-ok API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const { fetchSerperImages } = await import("./serperImages");
    await expect(fetchSerperImages("Test Co", "test.com")).rejects.toThrow("401");
  });

  it("returns empty array when API returns no images", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: [] }),
    });

    const { fetchSerperImages } = await import("./serperImages");
    const result = await fetchSerperImages("Empty Corp", "empty.com");
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    const mockImages = Array.from({ length: 10 }, (_, i) => ({
      imageUrl: `https://example.com/img${i}.jpg`,
      thumbnailUrl: `https://example.com/t${i}.jpg`,
      title: `Image ${i}`,
      source: "Example",
      domain: "example.com",
      link: `https://example.com/${i}`,
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: mockImages }),
    });

    const { fetchSerperImages } = await import("./serperImages");
    const result = await fetchSerperImages("Example", "example.com", 4);
    expect(result.length).toBe(4);
  });
});
