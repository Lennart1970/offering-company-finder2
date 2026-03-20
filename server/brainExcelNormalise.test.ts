/**
 * Tests for the defensive normalisation in normaliseBrainFromExcel.
 *
 * The LLM can return null, undefined, or missing sub-arrays (especially for
 * sparse Excel inputs). We replicate the normalisation logic here to verify
 * that every downstream .map() call in Brain.tsx will always receive a real array.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate the normalisation logic from brainExcelService.ts ──────────────

type FitCriteria = { mustHave: string[]; niceToHave: string[]; disqualifiers: string[] };

interface BrainResult {
  companyName: string;
  companyWebsite: string;
  offeringSummary: string;
  coreCapabilities: string[];
  valuePropositions: Array<{ proposition: string; targetAudience: string }>;
  competitiveAdvantages: string;
  icpIndustries: string[];
  icpCompanySize: string;
  icpGeography: string;
  icpPainPoints: string[];
  icpBuyingSignals: string[];
  fitCriteria: FitCriteria;
  urgencyTriggers: string[];
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

function normalise(raw: Partial<BrainResult> & { fitCriteria?: Partial<FitCriteria> | null }): BrainResult {
  return {
    companyName: raw.companyName ?? "",
    companyWebsite: raw.companyWebsite ?? "",
    offeringSummary: raw.offeringSummary ?? "",
    coreCapabilities: toStringArray(raw.coreCapabilities),
    valuePropositions: Array.isArray(raw.valuePropositions)
      ? (raw.valuePropositions as Array<{ proposition?: string; targetAudience?: string }>).map((vp) => ({
          proposition: vp.proposition ?? "",
          targetAudience: vp.targetAudience ?? "",
        }))
      : [],
    competitiveAdvantages: raw.competitiveAdvantages ?? "",
    icpIndustries: toStringArray(raw.icpIndustries),
    icpCompanySize: raw.icpCompanySize ?? "",
    icpGeography: raw.icpGeography ?? "",
    icpPainPoints: toStringArray(raw.icpPainPoints),
    icpBuyingSignals: toStringArray(raw.icpBuyingSignals),
    fitCriteria: {
      mustHave: toStringArray(raw.fitCriteria?.mustHave),
      niceToHave: toStringArray(raw.fitCriteria?.niceToHave),
      disqualifiers: toStringArray(raw.fitCriteria?.disqualifiers),
    },
    urgencyTriggers: toStringArray(raw.urgencyTriggers),
  };
}

// ─── Replicate the Brain.tsx fitCriteria guard ────────────────────────────────

function parseFitCriteriaFromDb(stored: string | null | undefined): FitCriteria {
  if (!stored) return { mustHave: [], niceToHave: [], disqualifiers: [] };
  let raw: Partial<FitCriteria> & { mustHave?: string[] | null; niceToHave?: string[] | null; disqualifiers?: string[] | null } = {};
  try { raw = JSON.parse(stored); } catch { /* ignore */ }
  return {
    mustHave: Array.isArray(raw.mustHave) ? raw.mustHave : [],
    niceToHave: Array.isArray(raw.niceToHave) ? raw.niceToHave : [],
    disqualifiers: Array.isArray(raw.disqualifiers) ? raw.disqualifiers : [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normaliseBrainFromExcel defensive normalisation", () => {
  it("passes through a complete, well-formed LLM response unchanged", () => {
    const result = normalise({
      companyName: "Acme Corp",
      fitCriteria: {
        mustHave: ["EMS manufacturer"],
        niceToHave: ["ISO 9001"],
        disqualifiers: ["consumer only"],
      },
      urgencyTriggers: ["new product launch"],
    });
    expect(result.fitCriteria.mustHave).toEqual(["EMS manufacturer"]);
    expect(result.fitCriteria.niceToHave).toEqual(["ISO 9001"]);
    expect(result.fitCriteria.disqualifiers).toEqual(["consumer only"]);
    expect(result.urgencyTriggers).toEqual(["new product launch"]);
  });

  it("converts null fitCriteria sub-arrays to empty arrays", () => {
    const result = normalise({
      companyName: "Sparse Corp",
      fitCriteria: { mustHave: null as any, niceToHave: null as any, disqualifiers: null as any },
    });
    expect(Array.isArray(result.fitCriteria.mustHave)).toBe(true);
    expect(result.fitCriteria.mustHave).toHaveLength(0);
    expect(Array.isArray(result.fitCriteria.niceToHave)).toBe(true);
    expect(Array.isArray(result.fitCriteria.disqualifiers)).toBe(true);
    // Crucially: .map() must not throw
    expect(() => result.fitCriteria.mustHave.map((x) => x)).not.toThrow();
  });

  it("converts undefined fitCriteria sub-arrays to empty arrays", () => {
    const result = normalise({
      companyName: "Missing Fields Corp",
      fitCriteria: {} as any,
    });
    expect(Array.isArray(result.fitCriteria.mustHave)).toBe(true);
    expect(Array.isArray(result.fitCriteria.niceToHave)).toBe(true);
    expect(Array.isArray(result.fitCriteria.disqualifiers)).toBe(true);
  });

  it("handles entirely missing fitCriteria object", () => {
    const result = normalise({ companyName: "No Criteria Corp" });
    expect(Array.isArray(result.fitCriteria.mustHave)).toBe(true);
    expect(Array.isArray(result.fitCriteria.niceToHave)).toBe(true);
    expect(Array.isArray(result.fitCriteria.disqualifiers)).toBe(true);
  });

  it("converts null top-level arrays to empty arrays", () => {
    const result = normalise({
      companyName: "Null Arrays Corp",
      coreCapabilities: null as any,
      icpIndustries: null as any,
      icpPainPoints: null as any,
      icpBuyingSignals: null as any,
      urgencyTriggers: null as any,
    });
    expect(Array.isArray(result.coreCapabilities)).toBe(true);
    expect(Array.isArray(result.icpIndustries)).toBe(true);
    expect(Array.isArray(result.icpPainPoints)).toBe(true);
    expect(Array.isArray(result.icpBuyingSignals)).toBe(true);
    expect(Array.isArray(result.urgencyTriggers)).toBe(true);
    // All .map() calls must be safe
    expect(() => result.coreCapabilities.map((x) => x)).not.toThrow();
    expect(() => result.urgencyTriggers.map((x) => x)).not.toThrow();
  });

  it("filters non-string values from arrays", () => {
    const result = normalise({
      coreCapabilities: [42, "valid string", null, true, "another"] as any,
    });
    expect(result.coreCapabilities).toEqual(["valid string", "another"]);
  });

  it("handles null valuePropositions gracefully", () => {
    const result = normalise({ valuePropositions: null as any });
    expect(Array.isArray(result.valuePropositions)).toBe(true);
    expect(result.valuePropositions).toHaveLength(0);
  });

  it("fills missing proposition/targetAudience fields with empty strings", () => {
    const result = normalise({
      valuePropositions: [{ proposition: "We save time" }] as any,
    });
    expect(result.valuePropositions[0].proposition).toBe("We save time");
    expect(result.valuePropositions[0].targetAudience).toBe("");
  });
});

describe("Brain.tsx fitCriteria DB guard (parseFitCriteriaFromDb)", () => {
  it("returns empty arrays for null DB value", () => {
    const result = parseFitCriteriaFromDb(null);
    expect(result.mustHave).toEqual([]);
    expect(result.niceToHave).toEqual([]);
    expect(result.disqualifiers).toEqual([]);
  });

  it("returns empty arrays for undefined DB value", () => {
    const result = parseFitCriteriaFromDb(undefined);
    expect(result.mustHave).toEqual([]);
  });

  it("returns empty arrays when stored JSON has null sub-arrays", () => {
    const stored = JSON.stringify({ mustHave: null, niceToHave: null, disqualifiers: null });
    const result = parseFitCriteriaFromDb(stored);
    expect(Array.isArray(result.mustHave)).toBe(true);
    expect(result.mustHave).toHaveLength(0);
    expect(() => result.mustHave.map((x) => x)).not.toThrow();
  });

  it("returns the correct arrays when stored JSON is valid", () => {
    const stored = JSON.stringify({ mustHave: ["EMS"], niceToHave: ["ISO"], disqualifiers: ["consumer"] });
    const result = parseFitCriteriaFromDb(stored);
    expect(result.mustHave).toEqual(["EMS"]);
    expect(result.niceToHave).toEqual(["ISO"]);
    expect(result.disqualifiers).toEqual(["consumer"]);
  });

  it("returns empty arrays for invalid JSON", () => {
    const result = parseFitCriteriaFromDb("not valid json {{");
    expect(result.mustHave).toEqual([]);
  });
});
