/**
 * Prompt-Contract Types — Single Source of Truth
 *
 * All inter-layer data contracts are defined here.
 * Both LLM-calling services and UI consumers MUST import from this file.
 * Any field name change here will produce a TypeScript compile error in all consumers,
 * preventing silent contract drift.
 *
 * Governance: see prompt-contracts-audit.md
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface VerifiedSource {
  url: string;
  title: string;
  snippet: string;
  dateAccessed: string;
}

// ---------------------------------------------------------------------------
// SalesIntelligenceBrief
// Output contract for briefGenerator.ts (urgency + intelligence phases)
// Consumers: CompanyDetail.tsx, SearchResults.tsx, salesApproachGenerator.ts
// ---------------------------------------------------------------------------

export interface SalesIntelligenceBrief {
  companyName: string;
  generatedAt: string;

  // Urgency phase
  urgencyScore: number;
  urgencyBreakdown: {
    companyContext: number;
    marketSignals: number;
    recentActivity: number;
  };
  urgencySignals: Array<{
    category: string;
    type: string;
    description: string;
    weight: number;
    sourceUrl: string;
    snippet: string;
    detectedAt: string;
  }>;
  recentDevelopments: Array<{
    text: string;
    date: string;
    sourceUrl: string;
    snippet: string;
  }>;

  // Intelligence phase
  executiveSummary: {
    company: string;
    industry: string;
    employees: number | string;
    revenue: string;
    domain: string;
    linkedin: string;
  };
  verifiedContacts: {
    website: { value: string; source: string; verified: boolean };
    linkedin: { value: string; source: string; verified: boolean };
  };
  /** Canonical field name: productsServices (not productsAndServices) */
  productsServices: Array<{
    category: string;
    description: string;
    sourceUrl?: string;
  }>;
  keyTechnologies: Array<{
    name: string;
    description: string;
    sourceUrl?: string;
  }>;
  targetMarkets: Array<{
    segment: string;
    description: string;
  }>;
  industryKeywords: string[];
  naicsCodes: string[];
  sources: VerifiedSource[];

  // Derived / optional
  /** Derived from executiveSummary.company — populated by normalisation shim in UI */
  companyOverview?: string;
  /** Why this company should be called today — populated when urgency analysis includes a rationale */
  whyNow?: string;

  rawGrokUrgency?: string;
  rawGrokIntelligence?: string;
}

// ---------------------------------------------------------------------------
// SalesApproach
// Output contract for salesApproachGenerator.ts
// Consumers: CompanyDetail.tsx, SearchResults.tsx
// ---------------------------------------------------------------------------

export interface SalesApproach {
  companyName: string;
  generatedAt: string;
  angleId?: string; // The angle UUID used to generate this approach — used for cache invalidation
  conversationStarters: Array<{
    opener: string;
    sourceUrl: string;
    basedOn: string;
  }>;
  engagementStrategy: {
    whyThisProspectMatters: string[];
    recommendedApproach: string[];
    keyTalkingPoints: string[];
  };
  emailDraft: {
    subject: string;
    body: string;
    referencedSources: string[];
  };
  linkedinMessage: {
    connectionRequest: string;
    followUp: string;
  };
  callScript: {
    opening: string;
    discoveryQuestions: string[];
    valueProposition: string;
    callToAction: string;
  };
  rawGrokApproach?: string; // Debug: raw Grok output for auditability and HITL review
}

// ---------------------------------------------------------------------------
// FitScoreResult
// Output contract for briefGenerator.ts scoreCompanyFit()
// Consumers: CompanyDetail.tsx, NicheReview.tsx
// ---------------------------------------------------------------------------

export interface FitScoreResult {
  fitScore: number;        // Final score after geography multiplier applied
  rawLlmScore: number;     // LLM-assigned score before geography multiplier
  scoredAt: string;
  companyName: string;
  brainName: string;
  breakdown: {
    industryFit: { score: number; max: number; rationale: string };
    sizeFit: { score: number; max: number; rationale: string };
    mustHavesFit: { score: number; max: number; rationale: string; matched: string[]; missing: string[] };
    disqualifiers: { triggered: boolean; reasons: string[] };
    buyingSignalsFit: { score: number; max: number; rationale: string };
    geographyMultiplier: {
      multiplier: number;  // e.g. 0.40 for China
      region: string;      // "EU" | "US" | "APAC" | "China" | "Other"
      countryCode: string; // ISO-2 code used for lookup (e.g. "CN", "DE")
      rationale: string;   // Human-readable explanation
    };
  };
  overallRationale: string;
  rawGrokFit?: string;
}

// ---------------------------------------------------------------------------
// OfferingData
// Output contract for offeringExtractor.ts
// Consumers: companyFinder.ts, brainResearchService.ts
// ---------------------------------------------------------------------------

export interface OfferingData {
  name: string;
  description: string;
  targetMarket: string;
  valueProposition: string;
  keywords: string[];
  targetMarketKeywordTags: string[];
  crossBorderIndicators?: string;
  sources?: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
}
