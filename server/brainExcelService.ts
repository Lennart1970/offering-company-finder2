/**
 * Brain Excel Upload Service
 *
 * Parses an uploaded Offering Brain Excel template and normalises the data
 * into the same BrainResearchResult shape used by brainResearchService.ts.
 * An optional LLM pass cleans and enriches sparse inputs.
 */

import * as XLSX from "xlsx";
import type { BrainResearchResult } from "./brainResearchService";
import { invokeLLM } from "./_core/llm";

// ── Helpers ────────────────────────────────────────────────────────────────

function col(sheet: XLSX.WorkSheet, row: number, colIdx: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: colIdx });
  const cell = sheet[addr];
  return cell ? String(cell.v ?? "").trim() : "";
}

/** Read all non-empty values in a column (skip header row 0) */
function readColumn(sheet: XLSX.WorkSheet, colIdx: number, maxRows = 50): string[] {
  const results: string[] = [];
  for (let r = 1; r < maxRows; r++) {
    const v = col(sheet, r, colIdx);
    if (v) results.push(v);
  }
  return results;
}

/** Read a named-row value from the Overview sheet (col 1 = answer) */
function overviewField(sheet: XLSX.WorkSheet, fieldName: string): string {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:C20");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const label = col(sheet, r, 0).toUpperCase();
    if (label.includes(fieldName.toUpperCase())) {
      return col(sheet, r, 1);
    }
  }
  return "";
}

// ── Main parser ────────────────────────────────────────────────────────────

export interface ExcelParseResult {
  raw: Partial<BrainResearchResult>;
  brainName: string;
  warnings: string[];
}

export function parseOfferingExcel(buffer: Buffer): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const warnings: string[] = [];

  // ── Overview sheet ──────────────────────────────────────────────────────
  const ws1 = wb.Sheets["Overview"];
  if (!ws1) throw new Error("Missing 'Overview' sheet — please use the official template.");

  const companyName       = overviewField(ws1, "Company Name");
  const companyWebsite    = overviewField(ws1, "Company Website");
  const brainName         = overviewField(ws1, "Brain Name");
  const offeringSummary   = overviewField(ws1, "Offering Summary");
  const competitiveAdv    = overviewField(ws1, "Competitive Advantages");
  const icpCompanySize    = overviewField(ws1, "ICP Company Size");
  const icpGeography      = overviewField(ws1, "ICP Geography");

  if (!companyName) warnings.push("Company Name is empty — please fill in the Overview sheet.");
  if (!offeringSummary) warnings.push("Offering Summary is empty — the brain will have limited context.");

  // ── Capabilities sheet ──────────────────────────────────────────────────
  const ws2 = wb.Sheets["Capabilities"];
  const coreCapabilities = ws2 ? readColumn(ws2, 0) : [];
  if (coreCapabilities.length === 0) warnings.push("No capabilities found in the Capabilities sheet.");

  // ── Value Propositions sheet ────────────────────────────────────────────
  const ws3 = wb.Sheets["Value Propositions"];
  const valuePropositions: Array<{ proposition: string; targetAudience: string }> = [];
  if (ws3) {
    for (let r = 1; r < 50; r++) {
      const prop = col(ws3, r, 0);
      const audience = col(ws3, r, 1);
      if (prop) valuePropositions.push({ proposition: prop, targetAudience: audience || "" });
    }
  }

  // ── ICP sheet ───────────────────────────────────────────────────────────
  const ws4 = wb.Sheets["ICP"];
  const icpIndustries   = ws4 ? readColumn(ws4, 0) : [];
  const icpPainPoints   = ws4 ? readColumn(ws4, 1) : [];
  const icpBuyingSignals = ws4 ? readColumn(ws4, 2) : [];

  // ── Fit Criteria sheet ──────────────────────────────────────────────────
  const ws5 = wb.Sheets["Fit Criteria"];
  const mustHave      = ws5 ? readColumn(ws5, 0) : [];
  const niceToHave    = ws5 ? readColumn(ws5, 1) : [];
  const disqualifiers = ws5 ? readColumn(ws5, 2) : [];

  // ── Urgency Triggers sheet ──────────────────────────────────────────────
  const ws6 = wb.Sheets["Urgency Triggers"];
  const urgencyTriggers = ws6 ? readColumn(ws6, 0) : [];

  const raw: Partial<BrainResearchResult> = {
    companyName:          companyName || "Unknown Company",
    companyWebsite:       companyWebsite || "",
    offeringSummary:      offeringSummary || "",
    coreCapabilities,
    valuePropositions,
    competitiveAdvantages: competitiveAdv || "",
    icpIndustries,
    icpCompanySize:       icpCompanySize || "",
    icpGeography:         icpGeography || "",
    icpPainPoints,
    icpBuyingSignals,
    fitCriteria:          { mustHave, niceToHave, disqualifiers },
    urgencyTriggers,
  };

  return { raw, brainName: brainName || `${companyName || "Company"} Brain`, warnings };
}

// ── LLM normalisation ──────────────────────────────────────────────────────

/**
 * Optional: pass the parsed Excel data through a lightweight LLM step
 * to fill gaps, clean phrasing, and ensure consistency.
 */
export async function normaliseBrainFromExcel(
  parsed: Partial<BrainResearchResult>
): Promise<BrainResearchResult> {
  const prompt = `You are a B2B sales intelligence analyst. A user has uploaded an Excel sheet describing their company's offering. Your task is to review the data, fill any obvious gaps with reasonable inferences, clean up phrasing, and return a complete, consistent brain profile.

Input data:
${JSON.stringify(parsed, null, 2)}

Rules:
- Keep all user-provided content — do NOT invent facts that contradict it
- If a field is empty or sparse, infer reasonable content from the other fields
- Return valid JSON matching the schema exactly
- No markdown, no explanation — JSON only

Return JSON:
{
  "companyName": string,
  "companyWebsite": string,
  "offeringSummary": string,
  "coreCapabilities": string[],
  "valuePropositions": [{ "proposition": string, "targetAudience": string }],
  "competitiveAdvantages": string,
  "icpIndustries": string[],
  "icpCompanySize": string,
  "icpGeography": string,
  "icpPainPoints": string[],
  "icpBuyingSignals": string[],
  "fitCriteria": { "mustHave": string[], "niceToHave": string[], "disqualifiers": string[] },
  "urgencyTriggers": string[]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a B2B sales intelligence analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === 'string' ? rawContent : null;
  if (!content) throw new Error("LLM returned empty response during brain normalisation");

  const result = JSON.parse(content) as BrainResearchResult;
  return result;
}
