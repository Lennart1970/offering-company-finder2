/**
 * nicheFitScorer.ts
 *
 * Dynamic niche-level fit scoring engine.
 *
 * Instead of hardcoded components (Cross-Border Activity, Payment Complexity, etc.),
 * the LLM reads the active Offering Brain and INFERS the most relevant scoring
 * dimensions for THIS specific offering. Dimensions, weights, and scores are all
 * generated at runtime — making the scorer fully Brain-driven.
 *
 * Architecture:
 *   Offering Brain (offering summary, ICP, fit criteria, pain points, buying signals)
 *   + Niche cluster (name, description, top keywords, sample companies, rationale)
 *   → LLM infers 3-5 scoring dimensions with weights summing to 100
 *   → Returns fitScore (0-100) + per-dimension breakdown + overall reasoning
 *
 * Future plan: Allow the Offering Brain to explicitly define scoring dimensions
 * with user-tunable weights (replacing inference with full transparency and control).
 */

import { invokeLLM } from "./_core/llm";
import { getActiveBrain, getOfferingBrainById } from "./db";

// ── Safe parsers for brain fields that may be stored as plain text or JSON ────

/**
 * Parse a brain field that may be a JSON array string OR a plain comma-separated string.
 * Returns an empty array if the value is null/undefined/empty.
 */
function safeParseStringArray(value: string | null | undefined): string[] {
  if (!value || !value.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  // Plain comma-separated or raw string — split and clean
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a brain field that should be a JSON object (e.g. fitCriteria, valuePropositions).
 * Returns the fallback if parsing fails.
 */
function safeParseBrainField<T>(value: string | null | undefined, fallback: T): T {
  if (!value || !value.trim()) return fallback;
  const trimmed = value.trim();
  try { return JSON.parse(trimmed); } catch { return fallback; }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NicheScoreDimension {
  dimension: string;    // LLM-inferred name, e.g. "Industry Alignment"
  score: number;        // 0 to maxScore
  maxScore: number;     // LLM-assigned weight (all maxScores sum to 100)
  weight: number;       // Same as maxScore, kept for UI clarity
  reasoning: string;    // 1-2 sentence explanation
}

export interface NicheFitResult {
  fitScore: number;                    // 0-100 overall (sum of dimension scores)
  fitReasoning: string;                // One paragraph overall assessment
  scoreBreakdown: NicheScoreDimension[]; // Variable-length array of inferred dimensions
  scoredAt: string;                    // ISO timestamp
  brainName: string;                   // Name of the brain used for scoring
  brainId: number;                     // ID of the brain used for scoring
  nicheName: string;                   // Name of the niche cluster
}

export interface NicheClusterInput {
  name: string;
  description?: string | null;
  topKeywords?: string[];
  sampleCompanies?: string[];
  rationale?: string | null;
  companyCount?: number;
}

// ── Main Scorer ───────────────────────────────────────────────────────────────

/**
 * Score a niche cluster's fit against the active Offering Brain.
 *
 * The LLM infers 3-5 scoring dimensions relevant to the offering,
 * assigns weights (summing to 100), and scores each dimension.
 *
 * @param niche - The niche cluster to score
 * @param userId - The user ID (used to fetch the active Brain)
 * @returns NicheFitResult with dynamic breakdown
 */
export async function scoreNicheFit(
  niche: NicheClusterInput,
  userId: number,
  brainId?: number,
  angleName?: string
): Promise<NicheFitResult> {
  const brain = brainId
    ? await getOfferingBrainById(brainId, userId)
    : await getActiveBrain(userId);
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Offering Brain found — cannot score niche fit without ICP criteria");
  }

  // Parse brain fields — use safe parsers to handle fields stored as plain text
  // (not JSON arrays), which would otherwise throw "is not valid JSON" errors.
  const offeringSummary = brain.offeringSummary || "";
  const coreCapabilities: string[] = safeParseStringArray(brain.coreCapabilities);
  const icpIndustries: string[] = safeParseStringArray(brain.icpIndustries);
  const icpPainPoints: string[] = safeParseStringArray(brain.icpPainPoints);
  const icpBuyingSignals: string[] = safeParseStringArray(brain.icpBuyingSignals);
  const fitCriteria = safeParseBrainField(brain.fitCriteria, { mustHave: [], niceToHave: [], disqualifiers: [] });
  const valuePropositions: Array<{ audience: string; value: string }> = safeParseBrainField(brain.valuePropositions, []);

  // Build niche profile string
  const nicheProfile = [
    `Niche Name: ${niche.name}`,
    niche.description ? `Description: ${niche.description}` : null,
    niche.rationale ? `Rationale: ${niche.rationale}` : null,
    niche.companyCount ? `Company Count: ${niche.companyCount}` : null,
    niche.topKeywords?.length ? `Top Keywords: ${niche.topKeywords.join(", ")}` : null,
    niche.sampleCompanies?.length ? `Sample Companies: ${niche.sampleCompanies.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  // Build brain context string
  const brainContext = [
    `Offering: ${brain.companyName} — ${offeringSummary}`,
    coreCapabilities.length ? `Core Capabilities: ${coreCapabilities.join("; ")}` : null,
    valuePropositions.length
      ? `Value Propositions: ${valuePropositions.map(v => `${v.value} (for ${v.audience})`).join("; ")}`
      : null,
    icpIndustries.length ? `ICP Industries: ${icpIndustries.join(", ")}` : null,
    brain.icpCompanySize ? `ICP Company Size: ${brain.icpCompanySize}` : null,
    brain.icpGeography ? `ICP Geography: ${brain.icpGeography}` : null,
    icpPainPoints.length ? `Pain Points Solved: ${icpPainPoints.join("; ")}` : null,
    icpBuyingSignals.length ? `Buying Signals: ${icpBuyingSignals.join("; ")}` : null,
    fitCriteria.mustHave?.length ? `Must-Have Criteria: ${fitCriteria.mustHave.join("; ")}` : null,
    fitCriteria.disqualifiers?.length ? `Disqualifiers: ${fitCriteria.disqualifiers.join("; ")}` : null,
  ].filter(Boolean).join("\n");

  // Build angle context if provided
  const angleSection = angleName
    ? `\n\n## SCORING ANGLE\nEvaluate this niche specifically from the perspective of a **${angleName}** relationship. Tailor your scoring dimensions and reasoning to reflect what matters most when approaching this niche as a ${angleName}. For example: if Potential Customer, prioritise buying likelihood and pain-point fit; if Strategic Partner, prioritise complementary capabilities and co-sell potential; if Potential Target, prioritise acquisition attractiveness and strategic value.`
    : "";

  const prompt = `You are a B2B sales qualification analyst scoring a niche cluster of companies against a seller's Offering Brain.

## OFFERING BRAIN
${brainContext}${angleSection}

## NICHE CLUSTER TO SCORE
${nicheProfile}

## YOUR TASK
1. Identify 3 to 5 scoring dimensions that are MOST RELEVANT to evaluating this niche against this specific offering. Do NOT use generic or hardcoded dimensions — infer dimensions that reflect what actually matters for THIS offering's ICP.

2. Assign weights to each dimension. Weights must sum to exactly 100. Assign higher weights to dimensions that are most critical for the offering's success criteria.

3. Score each dimension from 0 to its maxScore based on how well the niche cluster aligns.

4. Compute the overall fitScore as the sum of all dimension scores (0-100).

5. If any disqualifier criteria clearly apply to this niche, cap the fitScore at 20.

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):
{
  "fitScore": <integer 0-100>,
  "fitReasoning": "<one paragraph (3-5 sentences) explaining the overall fit assessment>",
  "scoreBreakdown": [
    {
      "dimension": "<inferred dimension name>",
      "score": <integer 0 to maxScore>,
      "maxScore": <integer, this dimension's weight>,
      "weight": <same integer as maxScore>,
      "reasoning": "<1-2 sentences explaining this dimension's score>"
    }
  ]
}

Rules:
- scoreBreakdown must have 3-5 items
- All maxScore values must sum to exactly 100
- fitScore must equal the sum of all score values
- dimension names must be specific to the offering (e.g. "Manufacturing Complexity Fit", "Industrial Supply Chain Alignment") — NOT generic names like "Industry Fit" or "Size Fit"
- reasoning must reference specific keywords or signals from the niche cluster`;

  console.log(`[Niche Fit Scorer] Scoring niche "${niche.name}" against brain "${brain.brainName}"...`);

  const raw = await invokeLLM({
    messages: [
      { role: "system" as const, content: "You are a B2B sales qualification analyst. Return only valid JSON." },
      { role: "user" as const, content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "niche_fit_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            fitScore: { type: "integer" },
            fitReasoning: { type: "string" },
            scoreBreakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  score: { type: "integer" },
                  maxScore: { type: "integer" },
                  weight: { type: "integer" },
                  reasoning: { type: "string" },
                },
                required: ["dimension", "score", "maxScore", "weight", "reasoning"],
                additionalProperties: false,
              },
            },
          },
          required: ["fitScore", "fitReasoning", "scoreBreakdown"],
          additionalProperties: false,
        },
      },
    },
  });

  // Parse the response
  const rawContent = raw.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response for niche fit scoring");

  // content can be string or array of content parts
  const contentStr: string = typeof rawContent === "string"
    ? rawContent
    : rawContent.map((p: any) => (p.type === "text" ? p.text : "")).join("");

  let parsed: { fitScore: number; fitReasoning: string; scoreBreakdown: NicheScoreDimension[] };
  try {
    parsed = JSON.parse(contentStr);
  } catch {
    // Fallback: extract JSON from content between first { and last }
    const firstBrace = contentStr.indexOf("{");
    const lastBrace = contentStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(contentStr.slice(firstBrace, lastBrace + 1));
      } catch {
        // LLM returned plain text — return a null score so the UI can show a retry option
        console.warn(`[Niche Fit Scorer] LLM returned non-JSON for "${niche.name}": ${contentStr.slice(0, 80)}`);
        return {
          fitScore: 0,
          fitReasoning: `Scoring failed: LLM returned an unexpected response. Please retry.`,
          scoreBreakdown: [],
          scoredAt: new Date().toISOString(),
          brainName: brain.brainName,
          brainId: brain.id,
          nicheName: niche.name,
        };
      }
    } else {
      // No JSON braces at all — graceful fallback
      console.warn(`[Niche Fit Scorer] LLM returned plain text for "${niche.name}": ${contentStr.slice(0, 80)}`);
      return {
        fitScore: 0,
        fitReasoning: `Scoring failed: LLM returned an unexpected response. Please retry.`,
        scoreBreakdown: [],
        scoredAt: new Date().toISOString(),
        brainName: brain.brainName,
        brainId: brain.id,
        nicheName: niche.name,
      };
    }
  }

  // Validate and clamp scores
  const breakdown: NicheScoreDimension[] = (parsed.scoreBreakdown || []).map((d: any) => ({
    dimension: String(d.dimension || "Unknown"),
    score: Math.max(0, Math.min(d.maxScore ?? 100, Math.round(d.score ?? 0))),
    maxScore: Math.round(d.maxScore ?? 20),
    weight: Math.round(d.weight ?? d.maxScore ?? 20),
    reasoning: String(d.reasoning || ""),
  }));

  // Recompute fitScore from breakdown to ensure consistency
  const computedScore = breakdown.reduce((sum, d) => sum + d.score, 0);
  const finalScore = Math.max(0, Math.min(100, computedScore));

  console.log(`[Niche Fit Scorer] "${niche.name}" → fitScore: ${finalScore} (${breakdown.length} dimensions)`);

  return {
    fitScore: finalScore,
    fitReasoning: parsed.fitReasoning || "",
    scoreBreakdown: breakdown,
    scoredAt: new Date().toISOString(),
    brainName: brain.brainName,
    brainId: brain.id,
    nicheName: niche.name,
  };
}

// ── Batch Scorer ──────────────────────────────────────────────────────────────

/**
 * Score multiple niche clusters in sequence.
 * Returns results in the same order as the input array.
 * Errors per niche are caught and logged — failed niches get fitScore: -1.
 */
export async function scoreNichesBatch(
  niches: NicheClusterInput[],
  userId: number,
  brainId?: number
): Promise<Array<NicheFitResult | { error: string; nicheName: string }>> {
  const results = [];
  for (const niche of niches) {
    try {
      const result = await scoreNicheFit(niche, userId, brainId);
      results.push(result);
    } catch (err: any) {
      console.error(`[Niche Fit Scorer] Failed to score niche "${niche.name}":`, err.message);
      results.push({ error: err.message, nicheName: niche.name });
    }
  }
  return results;
}
