/**
 * Brain Research Service
 * 
 * Uses Grok 4.1 fast-reasoning with web_search to deeply analyze a company's
 * offerings, ICP, competitive positioning, and buying signals.
 * 
 * This produces the "Brain" — structured intelligence that informs all
 * downstream prospect evaluation (fit scoring, urgency detection, sales approach).
 */

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = "https://api.x.ai/v1";

export interface BrainResearchResult {
  companyName: string;
  companyWebsite: string;
  offeringSummary: string;
  coreCapabilities: string[];
  valuePropositions: Array<{
    proposition: string;
    targetAudience: string;
  }>;
  competitiveAdvantages: string;
  icpIndustries: string[];
  icpCompanySize: string;
  icpGeography: string;
  icpPainPoints: string[];
  icpBuyingSignals: string[];
  fitCriteria: {
    mustHave: string[];
    niceToHave: string[];
    disqualifiers: string[];
  };
  urgencyTriggers: string[];
}

/**
 * Call Grok Responses API with web_search tool
 */
async function callGrokWithWebSearch(input: string): Promise<string> {
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable not set");
  }

  const response = await fetch(`${XAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      tools: [{ type: "web_search" }],
      input,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Responses API returns output in nested array structure
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.content && Array.isArray(item.content)) {
        const textContent = item.content.find((c: any) => c.type === "output_text");
        if (textContent?.text) {
          return textContent.text;
        }
      }
    }
  }

  if (data.text) {
    return data.text;
  }

  throw new Error("Unexpected Responses API format: no output text found");
}

/**
 * Research a company's offering deeply using Grok web search
 */
export async function researchOfferingBrain(
  companyWebsite: string,
  companyName?: string
): Promise<BrainResearchResult> {
  const domain = companyWebsite
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  const displayName = companyName || domain;

  console.log(`[Brain Research] Starting deep offering research for ${displayName} (${domain})`);

  const prompt = `You are a B2B sales intelligence analyst specializing in deep company analysis. Today is ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.

**Task:** Conduct a thorough analysis of "${displayName}" (website: ${companyWebsite}) to build a complete understanding of their offering, ideal customer profile, and competitive positioning.

**Instructions:**
1. Search the company website and any available sources for comprehensive information
2. Focus on understanding WHAT they sell, WHO they sell to, and WHY customers choose them
3. Be specific and actionable — this intelligence will be used to evaluate every prospect

**Research areas:**
- Company overview and core offering
- Specific capabilities and services
- Value propositions for different customer segments
- Competitive advantages and differentiators
- Ideal customer profile (industries, company size, geography, pain points)
- Buying signals that indicate a prospect needs this company's services
- Fit criteria: what makes a prospect a great fit vs. a poor fit
- Urgency triggers: events that create immediate need

**Return JSON only:**
{
  "companyName": "${displayName}",
  "companyWebsite": "${companyWebsite}",
  "offeringSummary": "2-3 sentence summary of what the company does and their core value",
  "coreCapabilities": [
    "Specific capability 1 (e.g., 'PCB assembly for high-reliability applications')",
    "Specific capability 2",
    "..."
  ],
  "valuePropositions": [
    {
      "proposition": "Specific value proposition",
      "targetAudience": "Who this resonates with most"
    }
  ],
  "competitiveAdvantages": "What makes this company unique vs competitors (paragraph)",
  "icpIndustries": ["Industry 1", "Industry 2", "..."],
  "icpCompanySize": "Description of ideal company size (e.g., 'Mid-market to enterprise, 100-10,000 employees')",
  "icpGeography": "Target geographies and any cross-border capabilities",
  "icpPainPoints": [
    "Specific pain point the offering solves (e.g., 'Need to reduce time-to-market for electronic products')",
    "..."
  ],
  "icpBuyingSignals": [
    "Observable signal that a company needs this (e.g., 'Company announced new product line requiring electronics manufacturing')",
    "..."
  ],
  "fitCriteria": {
    "mustHave": [
      "Criteria that must be true for a prospect to be a good fit",
      "..."
    ],
    "niceToHave": [
      "Criteria that improve fit but aren't required",
      "..."
    ],
    "disqualifiers": [
      "Red flags that indicate a prospect is NOT a fit",
      "..."
    ]
  },
  "urgencyTriggers": [
    "Event or signal that creates immediate need (e.g., 'Current supplier capacity issues')",
    "..."
  ]
}`;

  const rawResponse = await callGrokWithWebSearch(prompt);

  console.log(`[Brain Research] Received response, parsing...`);

  try {
    // Extract JSON using first { and last } to avoid greedy regex stripping
    // nested object opening braces (e.g. the '{' inside fitCriteria).
    // The greedy /\{[\s\S]*\}/ pattern was previously causing fitCriteria
    // to be stored without its opening brace when the LLM response had
    // extra text after the closing brace.
    let jsonStr = rawResponse;
    const firstBrace = rawResponse.indexOf('{');
    const lastBrace = rawResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = rawResponse.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
    const result: BrainResearchResult = {
      companyName: parsed.companyName || displayName,
      companyWebsite: parsed.companyWebsite || companyWebsite,
      offeringSummary: parsed.offeringSummary || "",
      coreCapabilities: Array.isArray(parsed.coreCapabilities) ? parsed.coreCapabilities : [],
      valuePropositions: Array.isArray(parsed.valuePropositions) ? parsed.valuePropositions : [],
      competitiveAdvantages: parsed.competitiveAdvantages || "",
      icpIndustries: Array.isArray(parsed.icpIndustries) ? parsed.icpIndustries : [],
      icpCompanySize: parsed.icpCompanySize || "",
      icpGeography: parsed.icpGeography || "",
      icpPainPoints: Array.isArray(parsed.icpPainPoints) ? parsed.icpPainPoints : [],
      icpBuyingSignals: Array.isArray(parsed.icpBuyingSignals) ? parsed.icpBuyingSignals : [],
      fitCriteria: {
        mustHave: Array.isArray(parsed.fitCriteria?.mustHave) ? parsed.fitCriteria.mustHave : [],
        niceToHave: Array.isArray(parsed.fitCriteria?.niceToHave) ? parsed.fitCriteria.niceToHave : [],
        disqualifiers: Array.isArray(parsed.fitCriteria?.disqualifiers) ? parsed.fitCriteria.disqualifiers : [],
      },
      urgencyTriggers: Array.isArray(parsed.urgencyTriggers) ? parsed.urgencyTriggers : [],
    };

    console.log(`[Brain Research] ✓ Successfully parsed brain for ${result.companyName}`);
    console.log(`[Brain Research]   - ${result.coreCapabilities.length} capabilities`);
    console.log(`[Brain Research]   - ${result.valuePropositions.length} value propositions`);
    console.log(`[Brain Research]   - ${result.icpIndustries.length} ICP industries`);
    console.log(`[Brain Research]   - ${result.icpPainPoints.length} pain points`);
    console.log(`[Brain Research]   - ${result.icpBuyingSignals.length} buying signals`);

    return result;
  } catch (parseError) {
    console.error(`[Brain Research] Failed to parse response:`, parseError);
    console.error(`[Brain Research] Raw response:`, rawResponse.substring(0, 500));
    throw new Error(`Failed to parse brain research response: ${parseError}`);
  }
}
