/**
 * Sales Approach Generator
 * 
 * Generates personalized sales outreach materials using xAI Grok API based on
 * deep research data (urgency signals, company intelligence, engagement strategy).
 * 
 * Now leverages verified sources from the Deep Research brief to ground
 * conversation starters and outreach in real, traceable developments.
 * 
 * Outputs:
 * - Email draft (personalized cold outreach)
 * - LinkedIn message (connection request + follow-up)
 * - Call script (structured talking points for phone/video call)
 */

import OpenAI from "openai";
import { getCompanyById } from "./db";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export interface SalesApproach {
  companyName: string;
  generatedAt: string;
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
}

/**
 * Generate personalized sales approach for a company
 * Requires that Deep Research (briefData) has already been generated
 */
export async function generateSalesApproach(
  companyId: number
): Promise<SalesApproach> {
  // Load company data from database
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Check if deep research exists
  if (!company.briefData) {
    throw new Error(`Deep research not found for company ${companyId}. Run Deep Research first.`);
  }

  const briefData = JSON.parse(company.briefData);
  console.log(`[Sales Approach] Generating personalized outreach for ${company.name}`);

  const domain = company.primaryDomain || company.websiteUrl || "unknown.com";

  // Build verified developments summary with source URLs
  const verifiedDevelopments = (briefData.recentDevelopments || [])
    .filter((d: any) => d && (typeof d === "string" || d.text))
    .map((d: any) => {
      if (typeof d === "string") return `- ${d}`;
      const sourceNote = d.sourceUrl ? ` [Source: ${d.sourceUrl}]` : "";
      return `- ${d.text}${d.date ? ` (${d.date})` : ""}${sourceNote}`;
    })
    .join("\n");

  // Build verified sources list for the prompt
  const verifiedSources = (briefData.sources || [])
    .map((s: any) => `- ${s.title || "Source"}: ${s.url}`)
    .join("\n");

  // Generate comprehensive sales approach (conversation starters, strategy, outreach)
  const approachPrompt = `You are a B2B sales expert using Grok 4.1 fast-reasoning mode with full tool access. You are crafting a complete sales approach for ConnectGroup (EMS provider: PCB assembly, cable assembly, module building, design-to-product services).

**Target Company:** ${company.name} (${domain})

**Deep Research Summary (with verified sources):**
- Urgency Score: ${briefData.urgencyScore}/100
- Products/Services: ${briefData.productsServices?.map((p: any) => p.category).join(", ") || "Unknown"}
- Key Technologies: ${briefData.keyTechnologies?.map((t: any) => t.name).join(", ") || "Unknown"}
- Target Markets: ${briefData.targetMarkets?.map((m: any) => m.segment).join(", ") || "Unknown"}

**Verified Recent Developments:**
${verifiedDevelopments || "No verified developments available."}

**Verified Sources from Deep Research:**
${verifiedSources || "No verified sources available."}

**IMPORTANT INSTRUCTIONS:**
1. Use web_search to verify and supplement the deep research data. Search for "${company.name} news 2025 2026" and "${company.name} ${domain} products latest" to find any additional recent developments from 2025-2026.
2. For the top 2-3 results, use browse_page to extract specific details that can be referenced in outreach.
3. Ground ALL conversation starters in specific, verified developments with working source URLs.
4. The email draft should reference at least one specific, verified development.
5. Only use verified data from tools — do NOT hallucinate URLs or facts.

**Your Task:** Generate a complete sales approach including:
1. Conversation starters (3 specific openers, each tied to a verified source URL)
2. Engagement strategy (why this prospect matters, recommended approach, key talking points)
3. Personalized outreach materials (email, LinkedIn, call script)

Return JSON only:
{
  "conversationStarters": [
    {
      "opener": "I saw that you recently launched X - are you evaluating manufacturing partners to scale production?",
      "sourceUrl": "https://verified.source.com/article",
      "basedOn": "Brief description of the verified development this references"
    }
  ],
  "engagementStrategy": {
    "whyThisProspectMatters": [
      "Strong fit with ConnectGroup's IoT manufacturing capabilities",
      "Growing market presence indicates scaling needs"
    ],
    "recommendedApproach": [
      "Lead with design-to-product capabilities for their expansion",
      "Highlight our experience in similar projects"
    ],
    "keyTalkingPoints": [
      "Our PCB assembly capabilities support complex designs",
      "We've helped similar companies scale from prototype to production"
    ]
  },
  "emailDraft": {
    "subject": "Brief, specific subject line referencing a verified recent development",
    "body": "3-paragraph email:\\n1. Hook (reference specific verified development with implicit source knowledge)\\n2. Value prop (how ConnectGroup solves their specific challenge)\\n3. CTA (request 15-min call)\\n\\nTone: Professional, consultative, not salesy. Use 'you/your' not 'we/our'.",
    "referencedSources": ["https://source-url-referenced-in-email.com"]
  },
  "linkedinMessage": {
    "connectionRequest": "Short connection request (max 200 chars) mentioning shared industry/interest",
    "followUp": "Follow-up message after connection accepted (2-3 sentences, reference verified development, soft CTA)"
  },
  "callScript": {
    "opening": "30-second opening statement (introduce self, reference verified trigger event, state purpose)",
    "discoveryQuestions": [
      "Question 1 about their current manufacturing process",
      "Question 2 about pain points or challenges",
      "Question 3 about growth plans or new products"
    ],
    "valueProposition": "2-3 sentence value prop tailored to their specific situation",
    "callToAction": "Specific next step (demo, facility tour, technical discussion)"
  }
}`;

  const approachResponse = await xai.chat.completions.create({
    model: "grok-4-1-fast-reasoning",
    messages: [{ role: "user", content: approachPrompt }],
    response_format: { type: "json_object" },
  });

  const approachData = JSON.parse(
    approachResponse.choices[0].message.content || "{}"
  );

  // Normalize conversation starters (handle both old and new format)
  const normalizedStarters = (approachData.conversationStarters || []).map((starter: any) => {
    if (typeof starter === "string") {
      return { opener: starter, sourceUrl: "", basedOn: "" };
    }
    return {
      opener: starter.opener || starter,
      sourceUrl: starter.sourceUrl || "",
      basedOn: starter.basedOn || "",
    };
  });

  // Normalize email draft
  const normalizedEmail = approachData.emailDraft || {
    subject: "Exploring EMS partnership opportunities",
    body: "Email generation failed. Please try again.",
    referencedSources: [],
  };
  if (!normalizedEmail.referencedSources) {
    normalizedEmail.referencedSources = [];
  }

  // Assemble final sales approach
  const salesApproach: SalesApproach = {
    companyName: company.name,
    generatedAt: new Date().toISOString(),
    conversationStarters: normalizedStarters,
    engagementStrategy: approachData.engagementStrategy || {
      whyThisProspectMatters: [],
      recommendedApproach: [],
      keyTalkingPoints: [],
    },
    emailDraft: normalizedEmail,
    linkedinMessage: approachData.linkedinMessage || {
      connectionRequest: "Connection request generation failed.",
      followUp: "Follow-up message generation failed.",
    },
    callScript: approachData.callScript || {
      opening: "Call script generation failed.",
      discoveryQuestions: [],
      valueProposition: "Value prop generation failed.",
      callToAction: "Next step generation failed.",
    },
  };

  console.log(`[Sales Approach] Personalized outreach generated for ${company.name} with ${normalizedStarters.length} source-backed conversation starters`);

  return salesApproach;
}
