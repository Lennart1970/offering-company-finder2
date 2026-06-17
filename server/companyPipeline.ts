/**
 * Unified company pipeline: Enrich → LLM FIT → Brief/Urgency → Outreach.
 * Shared by doNext10 and doAll batch jobs.
 */
import {
  updateCompany,
  getCompanyBrainOutput,
  upsertCompanyBrainOutput,
} from "./db";
import { enrichCompanyDetails } from "./apolloSearch";

export type PipelineCompanyRow = {
  id: number;
  name: string | null;
  apolloId: string | null;
  country?: string | null;
  enrichmentStatus: string;
  briefGeneratedAt?: Date | null;
  salesApproachGeneratedAt?: Date | null;
  fitScoreSource?: string | null;
};

export type BrainOutputSlice = {
  fitScore?: number | null;
  briefGeneratedAt?: Date | null;
  salesApproachGeneratedAt?: Date | null;
} | null | undefined;

export type PipelineStepCounts = {
  enriched: number;
  fitScored: number;
  researched: number;
  approached: number;
};

export function hasLlmFit(
  company: PipelineCompanyRow,
  brainOutput: BrainOutputSlice,
  resolvedBrainId?: number | null
): boolean {
  if (resolvedBrainId) return brainOutput?.fitScore != null;
  return company.fitScoreSource === "llm";
}

export function hasBrief(
  company: PipelineCompanyRow,
  brainOutput: BrainOutputSlice,
  resolvedBrainId?: number | null
): boolean {
  if (resolvedBrainId) return !!brainOutput?.briefGeneratedAt;
  return !!company.briefGeneratedAt;
}

export function hasApproach(
  company: PipelineCompanyRow,
  brainOutput: BrainOutputSlice,
  resolvedBrainId?: number | null
): boolean {
  if (resolvedBrainId) return !!brainOutput?.salesApproachGeneratedAt;
  return !!company.salesApproachGeneratedAt;
}

export function companyNeedsPipelineWork(
  company: PipelineCompanyRow,
  brainOutput: BrainOutputSlice,
  resolvedBrainId?: number | null
): boolean {
  if (company.enrichmentStatus === "pending" && !!company.apolloId) return true;
  if (company.enrichmentStatus !== "enriched") return false;
  if (!hasLlmFit(company, brainOutput, resolvedBrainId)) return true;
  if (!hasBrief(company, brainOutput, resolvedBrainId)) return true;
  if (!hasApproach(company, brainOutput, resolvedBrainId)) return true;
  return false;
}

export function buildPipelineQueue(
  all: PipelineCompanyRow[],
  brainOutputMap: Map<number, BrainOutputSlice>,
  resolvedBrainId?: number | null,
  limit?: number
): PipelineCompanyRow[] {
  const pending = all.filter((c) => c.enrichmentStatus === "pending" && !!c.apolloId);
  const needsFit = all.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    const out = brainOutputMap.get(c.id);
    return !hasLlmFit(c, out, resolvedBrainId);
  });
  const needsBrief = all.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    const out = brainOutputMap.get(c.id);
    if (!hasLlmFit(c, out, resolvedBrainId)) return false;
    return !hasBrief(c, out, resolvedBrainId);
  });
  const needsApproach = all.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    const out = brainOutputMap.get(c.id);
    if (!hasBrief(c, out, resolvedBrainId)) return false;
    return !hasApproach(c, out, resolvedBrainId);
  });
  const full = [...pending, ...needsFit, ...needsBrief, ...needsApproach];
  return limit !== undefined ? full.slice(0, limit) : full;
}

export function countPipelineRemaining(
  all: PipelineCompanyRow[],
  brainOutputMap: Map<number, BrainOutputSlice>,
  resolvedBrainId?: number | null
): number {
  return all.filter((c) =>
    companyNeedsPipelineWork(c, brainOutputMap.get(c.id), resolvedBrainId)
  ).length;
}

export type PipelineStatsCompany = PipelineCompanyRow & {
  fitScoreSource?: string | null;
  brainFitScore?: number | null;
  primaryDomain?: string | null;
};

export function computePipelineStats(companies: PipelineStatsCompany[]) {
  const enriched = companies.filter((c) => c.enrichmentStatus === "enriched").length;
  const pending = companies.filter((c) => c.enrichmentStatus === "pending").length;
  const nameOnly = companies.filter(
    (c) => c.enrichmentStatus === "pending" && !c.apolloId && !c.primaryDomain
  ).length;
  const llmFitScored = companies.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    if (c.brainFitScore != null) return true;
    return c.fitScoreSource === "llm";
  }).length;
  const needsFit = companies.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    if (c.brainFitScore != null) return false;
    return c.fitScoreSource !== "llm";
  }).length;
  const needsUrgency = companies.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    const fitDone = c.brainFitScore != null || c.fitScoreSource === "llm";
    return fitDone && !c.briefGeneratedAt;
  }).length;
  const needsOutreach = companies.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    return !!c.briefGeneratedAt && !c.salesApproachGeneratedAt;
  }).length;
  const urgencyScored = companies.filter(
    (c) => c.enrichmentStatus === "enriched" && !!c.briefGeneratedAt
  ).length;
  const outreachReady = companies.filter(
    (c) => c.enrichmentStatus === "enriched" && !!c.salesApproachGeneratedAt
  ).length;
  const pipelineComplete = companies.filter((c) => {
    if (c.enrichmentStatus !== "enriched") return false;
    const fitDone = c.brainFitScore != null || c.fitScoreSource === "llm";
    return fitDone && !!c.briefGeneratedAt && !!c.salesApproachGeneratedAt;
  }).length;
  const remaining = companies.filter((c) => {
    if (c.enrichmentStatus === "pending" && !!c.apolloId) return true;
    if (c.enrichmentStatus !== "enriched") return false;
    const fitDone = c.brainFitScore != null || c.fitScoreSource === "llm";
    if (!fitDone) return true;
    if (!c.briefGeneratedAt) return true;
    if (!c.salesApproachGeneratedAt) return true;
    return false;
  }).length;

  return {
    total: companies.length,
    enriched,
    pending,
    nameOnly,
    outreachReady,
    llmFitScored,
    needsFit,
    needsUrgency,
    needsOutreach,
    urgencyScored,
    pipelineComplete,
    remaining,
  };
}

export type ProcessCompanyPipelineOptions = {
  userId: number;
  brainId?: number;
  angleId?: string;
  resolvedBrainId?: number | null;
  brainName?: string | null;
  logPrefix?: string;
};

/**
 * Run all pending pipeline steps for one company. Idempotent per step.
 */
export async function processCompanyPipeline(
  company: PipelineCompanyRow,
  options: ProcessCompanyPipelineOptions
): Promise<PipelineStepCounts> {
  const counts: PipelineStepCounts = { enriched: 0, fitScored: 0, researched: 0, approached: 0 };
  const { userId, brainId, angleId, resolvedBrainId, brainName, logPrefix = "[pipeline]" } = options;
  const label = company.name ?? `id:${company.id}`;

  let enrichmentStatus = company.enrichmentStatus;

  if (enrichmentStatus === "pending" && company.apolloId) {
    const details = await enrichCompanyDetails(company.apolloId);
    await updateCompany(company.id, {
      city: details.city || null,
      state: details.state || null,
      country: details.country || company.country || null,
      streetAddress: details.street_address || null,
      rawAddress: details.raw_address || null,
      enrichmentStatus: "enriched",
    });
    enrichmentStatus = "enriched";
    counts.enriched++;
    console.log(`${logPrefix} ✓ Enriched: ${label}`);
  }

  let brainOutput = resolvedBrainId
    ? await getCompanyBrainOutput(company.id, resolvedBrainId)
    : null;

  const rowAfterEnrich: PipelineCompanyRow = {
    ...company,
    enrichmentStatus,
    fitScoreSource: company.fitScoreSource,
  };

  if (
    enrichmentStatus === "enriched" &&
    !hasLlmFit(rowAfterEnrich, brainOutput, resolvedBrainId)
  ) {
    const { scoreCompanyFit } = await import("./briefGenerator");
    const result = await scoreCompanyFit(company.id, userId, brainId, angleId);
    await updateCompany(company.id, {
      fitScore: result.fitScore,
      fitScoreData: JSON.stringify(result),
      fitScoreGeneratedAt: new Date(),
      fitScoreSource: "llm",
    } as any);
    if (resolvedBrainId) {
      await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
        fitScore: result.fitScore,
        fitScoreData: JSON.stringify(result),
      });
      brainOutput = await getCompanyBrainOutput(company.id, resolvedBrainId);
    }
    rowAfterEnrich.fitScoreSource = "llm";
    counts.fitScored++;
    console.log(`${logPrefix} ✓ FIT scored: ${label} → ${result.fitScore}`);
  }

  if (
    enrichmentStatus === "enriched" &&
    !hasBrief(rowAfterEnrich, brainOutput, resolvedBrainId)
  ) {
    const { generateSalesIntelligenceBrief } = await import("./briefGenerator");
    const brief = await generateSalesIntelligenceBrief(company.id, userId, brainId);
    if (resolvedBrainId) {
      await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
        urgencyScore: brief.urgencyScore,
        briefData: JSON.stringify(brief),
        briefGeneratedAt: new Date(),
      });
      brainOutput = await getCompanyBrainOutput(company.id, resolvedBrainId);
    }
    await updateCompany(company.id, {
      urgencyScore: brief.urgencyScore,
      briefData: JSON.stringify(brief),
      briefGeneratedAt: new Date(),
      generatedWithBrainId: resolvedBrainId ?? null,
      generatedWithBrainName: brainName ?? null,
    });
    counts.researched++;
    console.log(`${logPrefix} ✓ Researched: ${label}`);
  }

  if (
    enrichmentStatus === "enriched" &&
    !hasApproach(rowAfterEnrich, brainOutput, resolvedBrainId)
  ) {
    const { generateSalesApproach } = await import("./salesApproachGenerator");
    const approach = await generateSalesApproach(company.id, userId, brainId, angleId);
    if (resolvedBrainId) {
      await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
        salesApproachData: JSON.stringify(approach),
        salesApproachGeneratedAt: new Date(),
      });
    }
    await updateCompany(company.id, {
      salesApproachData: JSON.stringify(approach),
      salesApproachGeneratedAt: new Date(),
    });
    counts.approached++;
    console.log(`${logPrefix} ✓ Approached: ${label}`);
  }

  return counts;
}
