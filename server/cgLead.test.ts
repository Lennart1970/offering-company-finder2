import { describe, it, expect } from "vitest";
import { normalizeCgCompanyName } from "./db";

describe("normalizeCgCompanyName", () => {
  it("strips legal suffixes and normalises punctuation", () => {
    expect(normalizeCgCompanyName("Thales Group B.V.")).toBe("thales group");
    expect(normalizeCgCompanyName("Acme Corp Ltd")).toBe("acme");
    expect(normalizeCgCompanyName("Siemens AG")).toBe("siemens");
  });

  it("handles short names", () => {
    expect(normalizeCgCompanyName("AB")).toBe("ab");
  });
});
