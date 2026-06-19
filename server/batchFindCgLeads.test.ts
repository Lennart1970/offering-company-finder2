import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

import { getDb, batchFindCgLeadsForCompanies } from "./db";

function chainSelect(result: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function chainSelectWhere(result: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(result),
    }),
  };
}

describe("batchFindCgLeadsForCompanies", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReset();
  });

  it("returns empty map for empty input", async () => {
    const result = await batchFindCgLeadsForCompanies([]);
    expect(result.size).toBe(0);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("matches by numeric cgSharepointId", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 10,
            cgSharepointId: "42",
            normalizedDomain: "example.com",
            name: "Example Corp",
          },
        ]),
      )
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 42,
            sharepointUrl: "https://sharepoint.example.com/DispForm.aspx?ID=42",
          },
        ]),
      );

    vi.mocked(getDb).mockResolvedValue({ select } as any);

    const result = await batchFindCgLeadsForCompanies([10]);
    expect(result.get(10)).toEqual({
      linkId: 42,
      sharepointPageLink: "https://sharepoint.example.com/DispForm.aspx?ID=42",
    });
  });

  it("matches by normalizedDomain when SharePoint ID is absent", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 20,
            cgSharepointId: null,
            normalizedDomain: "thales.com",
            name: "Thales Group",
          },
        ]),
      )
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 1,
            domain: "thales.com",
            sharepointUrl: "https://sharepoint.example.com/DispForm.aspx?ID=1",
          },
        ]),
      );

    vi.mocked(getDb).mockResolvedValue({ select } as any);

    const result = await batchFindCgLeadsForCompanies([20]);
    expect(result.get(20)).toEqual({
      linkId: 1,
      sharepointPageLink: "https://sharepoint.example.com/DispForm.aspx?ID=1",
    });
  });

  it("returns no entry when no CRM match exists", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 30,
            cgSharepointId: null,
            normalizedDomain: "unknown.com",
            name: "Unknown Co",
          },
        ]),
      )
      .mockReturnValueOnce(chainSelectWhere([]))
      .mockReturnValueOnce(chainSelect([]));

    vi.mocked(getDb).mockResolvedValue({ select } as any);

    const result = await batchFindCgLeadsForCompanies([30]);
    expect(result.has(30)).toBe(false);
  });

  it("prefers SharePoint ID over domain match", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 40,
            cgSharepointId: "5",
            normalizedDomain: "thales.com",
            name: "Thales Group",
          },
        ]),
      )
      .mockReturnValueOnce(
        chainSelectWhere([
          {
            id: 5,
            sharepointUrl: "https://sharepoint.example.com/DispForm.aspx?ID=5",
          },
        ]),
      );

    vi.mocked(getDb).mockResolvedValue({ select } as any);

    const result = await batchFindCgLeadsForCompanies([40]);
    expect(result.get(40)).toEqual({
      linkId: 5,
      sharepointPageLink: "https://sharepoint.example.com/DispForm.aspx?ID=5",
    });
    // Domain pass should not run when all companies matched in pass 1
    expect(select).toHaveBeenCalledTimes(2);
  });
});
