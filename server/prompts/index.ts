/**
 * Prompt Repository
 *
 * Single source of truth for all AI prompts used in this application.
 * Every prompt is typed, versioned, and categorised for auditability.
 *
 * Usage:
 *   import { URGENCY_RESEARCH, fillTemplate } from "./prompts/index";
 *   const userMsg = fillTemplate(URGENCY_RESEARCH.userPromptTemplate, { companyName: "Acme" });
 */

export type PromptCategory =
  | "research"
  | "qualification"
  | "outreach"
  | "extraction"
  | "classification"
  | "coaching";

export interface PromptTemplate {
  /** Unique machine-readable key */
  key: string;
  /** Human-readable display name */
  name: string;
  /** What this prompt does */
  description: string;
  /** Functional category */
  category: PromptCategory;
  /** Semantic version */
  version: string;
  /** Injected as the system message */
  systemPrompt: string;
  /** User message template — use {{variable}} placeholders */
  userPromptTemplate: string;
  /** Expected output format description */
  outputFormat: string;
}

/**
 * Replace {{variable}} placeholders in a template string.
 * Unknown variables are left intact.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in vars ? vars[key] : match
  );
}

// ---------------------------------------------------------------------------
// 1. Urgency Research
// ---------------------------------------------------------------------------
export const URGENCY_RESEARCH: PromptTemplate = {
  key: "urgency_research",
  name: "Urgency Research",
  description:
    "Detects buying signals and scores urgency (0-100) for a prospect company using live web search. Produces verified recent developments, urgency signals, and source citations.",
  category: "research",
  version: "1.2.0",
  systemPrompt:
    "You are a B2B sales intelligence analyst. Today is February 25, 2026. Your goal is to provide verifiable answers with traceable sources from the most recent content available.",
  userPromptTemplate: `{{context}}

**Target Company:** "{{companyName}}" ({{domain}})
**Instructions:**
1. Search for the absolute latest news and developments about "{{companyName}}" from the past 12 months
2. Focus on: product launches, expansions, hiring, partnerships, acquisitions, funding
3. Prioritize sources from 2026 and late 2025
4. Only use verified data from your searches — do NOT hallucinate URLs or facts

**Score urgency 0-100 based on:**
- Company Context (0-40): Growth stage, financial health, industry momentum
- Market Signals (0-35): Competitive pressure, market expansion, technology shifts
- Recent Activity (0-25): Hiring, announcements, news mentions in past 12 months

Return JSON only with urgencyScore, urgencyBreakdown, recentDevelopments, urgencySignals, sources, searchNotes.`,
  outputFormat:
    "JSON with urgencyScore (0-100), urgencyBreakdown, recentDevelopments[], urgencySignals[], sources[], searchNotes",
};

// ---------------------------------------------------------------------------
// 2. Company Intelligence
// ---------------------------------------------------------------------------
export const COMPANY_INTELLIGENCE: PromptTemplate = {
  key: "company_intelligence",
  name: "Company Intelligence",
  description:
    "Gathers deep company intelligence: products/services, key technologies, target markets, and competitive positioning. Used in Phase 2 of the Brief Generator.",
  category: "research",
  version: "1.2.0",
  systemPrompt:
    "You are a B2B sales intelligence analyst. Today is February 25, 2026. Your goal is to provide verifiable company intelligence with traceable sources.",
  userPromptTemplate: `{{context}}

**Target Company:** "{{companyName}}" ({{domain}})
**Instructions:**
1. Search for and browse the company website to extract structured intelligence
2. Focus on products/services, technologies, target markets, and competitive positioning
3. Only use verified data — do NOT hallucinate URLs or facts

Return JSON with productsServices[], keyTechnologies[], targetMarkets[], competitivePositioning, sources[].`,
  outputFormat:
    "JSON with productsServices[], keyTechnologies[], targetMarkets[], competitivePositioning, sources[]",
};

// ---------------------------------------------------------------------------
// 3. ICP Fit Scoring
// ---------------------------------------------------------------------------
export const ICP_FIT_SCORING: PromptTemplate = {
  key: "icp_fit_scoring",
  name: "ICP Fit Scoring",
  description:
    "Scores a prospect company's fit against the seller's Ideal Customer Profile (ICP). Produces a 0-100 fit score with dimension breakdown and a human-readable rationale.",
  category: "qualification",
  version: "1.1.0",
  systemPrompt:
    "You are a B2B sales qualification analyst. Score the prospect company's fit against the seller's Ideal Customer Profile (ICP).",
  userPromptTemplate: `{{brainContext}}

**Prospect Company:** {{companyName}} ({{domain}})
**Brief Data Summary:**
{{briefSummary}}

Score the prospect's ICP fit 0-100. Return JSON with fitScore, fitBreakdown (industryFit, companySizeFit, technologyFit, painPointFit, geographyFit), fitRationale, keyStrengths[], keyWeaknesses[], recommendation.`,
  outputFormat:
    "JSON with fitScore (0-100), fitBreakdown, fitRationale, keyStrengths[], keyWeaknesses[], recommendation",
};

// ---------------------------------------------------------------------------
// 4. Sales Approach
// ---------------------------------------------------------------------------
export const SALES_APPROACH: PromptTemplate = {
  key: "sales_approach",
  name: "Sales Approach Generator",
  description:
    "Generates a full personalised sales approach for a prospect: conversation starters grounded in verified sources, engagement strategy, email draft, LinkedIn message, and call script.",
  category: "outreach",
  version: "1.3.0",
  systemPrompt:
    "You are a B2B sales expert. Today is February 25, 2026. You are crafting a complete sales approach based on verified deep research data.",
  userPromptTemplate: `{{sellerContext}}

**Target Company:** {{companyName}} ({{domain}})
**Deep Research Summary:**
- Urgency Score: {{urgencyScore}}/100
- Products/Services: {{productsServices}}
- Key Technologies: {{keyTechnologies}}
- Target Markets: {{targetMarkets}}

**Verified Recent Developments:**
{{verifiedDevelopments}}

**Verified Sources:**
{{verifiedSources}}

Generate: conversationStarters (3, each with sourceUrl), engagementStrategy, emailDraft, linkedinMessage, callScript. Return JSON only.`,
  outputFormat:
    "JSON with conversationStarters[], engagementStrategy, emailDraft, linkedinMessage, callScript",
};

// ---------------------------------------------------------------------------
// 5. Offering Extraction
// ---------------------------------------------------------------------------
export const OFFERING_EXTRACTION: PromptTemplate = {
  key: "offering_extraction",
  name: "Offering Extraction",
  description:
    "Analyses a company website to extract what they offer and who their ideal customers are. Produces structured offering data used to seed the Offering Brain.",
  category: "extraction",
  version: "1.1.0",
  systemPrompt:
    "You are an expert B2B sales strategist and business analyst. Today is February 23, 2026. Your goal is to analyze a company's website with verifiable, traceable sources.",
  userPromptTemplate: `Analyze this company website and extract offering information: {{companyWebsite}}

Search for and browse the website to extract the structured data as JSON. Pay special attention to identifying who their CUSTOMERS are — what industries and company types buy from them. Verify all information through your searches.

Extract: name, description, targetMarket, valueProposition, keywords[], targetMarketKeywordTags[], crossBorderIndicators, sources[].`,
  outputFormat:
    "JSON with name, description, targetMarket, valueProposition, keywords[], targetMarketKeywordTags[], crossBorderIndicators, sources[]",
};

// ---------------------------------------------------------------------------
// 6. Brain Research
// ---------------------------------------------------------------------------
export const BRAIN_RESEARCH: PromptTemplate = {
  key: "brain_research",
  name: "Offering Brain Research",
  description:
    "Deeply analyses the seller's own company to build the Offering Brain: core capabilities, value propositions, ICP definition, competitive advantages, and urgency triggers.",
  category: "research",
  version: "1.0.0",
  systemPrompt:
    "You are a B2B sales intelligence analyst specializing in deep company analysis. Today is February 25, 2026.",
  userPromptTemplate: `**Task:** Conduct a thorough analysis of "{{companyName}}" (website: {{companyWebsite}}) to build a complete understanding of their offering, ideal customer profile, and competitive positioning.

Search for and browse the website, LinkedIn, and recent news. Extract: offeringSummary, coreCapabilities[], valuePropositions[], icpDescription, icpIndustries[], icpCompanySize, icpPainPoints[], competitiveAdvantages, urgencyTriggers[], sources[].`,
  outputFormat:
    "JSON with offeringSummary, coreCapabilities[], valuePropositions[], icpDescription, icpIndustries[], icpCompanySize, icpPainPoints[], competitiveAdvantages, urgencyTriggers[], sources[]",
};

// ---------------------------------------------------------------------------
// 7. Why Call Today
// ---------------------------------------------------------------------------
export const WHY_CALL_TODAY: PromptTemplate = {
  key: "why_call_today",
  name: "Why Call Today",
  description:
    "Generates a single punchy sentence (max 25 words) explaining why a sales rep should call this company today, grounded in a specific trigger event or signal.",
  category: "coaching",
  version: "1.0.0",
  systemPrompt:
    "You are a B2B sales coach. Write exactly ONE sentence (max 25 words) that tells a sales rep WHY this company is worth calling TODAY. Be specific — mention a real trigger event or signal if available. No fluff, no generic phrases.",
  userPromptTemplate: `{{context}}`,
  outputFormat: "Plain text — one sentence, max 25 words",
};

// ---------------------------------------------------------------------------
// 8. Industry Code Selection
// ---------------------------------------------------------------------------
export const INDUSTRY_CODE_SELECTION: PromptTemplate = {
  key: "industry_code_selection",
  name: "Industry Code Selection",
  description:
    "Selects the most relevant SIC and NAICS codes for a given offering using hierarchical reasoning. Used to filter Apollo company searches to the right prospect universe.",
  category: "classification",
  version: "2.0.0",
  systemPrompt:
    "You are an industry classification expert helping identify potential customers for a B2B offering. Return your answer as a JSON object with sicCodes[], naicsCodes[], and reasoning.",
  userPromptTemplate: `**OFFERING ANALYSIS**
Offering Name: {{offeringName}}
Description: {{offeringDescription}}
Target Market: {{targetMarket}}
Value Proposition: {{valueProposition}}

Select SIC and NAICS codes for companies that would be POTENTIAL CUSTOMERS for this offering. Use hierarchical codes (2-3 digit sector codes for broad coverage, 4-6 digit for niche segments). Return JSON with sicCodes[], naicsCodes[], reasoning.`,
  outputFormat: "JSON with sicCodes[], naicsCodes[], reasoning",
};

// ---------------------------------------------------------------------------
// Full catalogue (used by the Prompt Repository page)
// ---------------------------------------------------------------------------
export const ALL_PROMPTS: PromptTemplate[] = [
  URGENCY_RESEARCH,
  COMPANY_INTELLIGENCE,
  ICP_FIT_SCORING,
  SALES_APPROACH,
  OFFERING_EXTRACTION,
  BRAIN_RESEARCH,
  WHY_CALL_TODAY,
  INDUSTRY_CODE_SELECTION,
];
