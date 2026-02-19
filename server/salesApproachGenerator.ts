/**
 * Sales Approach Generator
 * 
 * Generates personalized sales outreach materials using xAI Grok API based on
 * deep research data (urgency signals, company intelligence, engagement strategy).
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
  conversationStarters: string[];
  engagementStrategy: {
    whyThisProspectMatters: string[];
    recommendedApproach: string[];
    keyTalkingPoints: string[];
  };
  emailDraft: {
    subject: string;
    body: string;
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

  // Generate comprehensive sales approach (conversation starters, strategy, outreach)
  const approachPrompt = `You are a B2B sales expert crafting a complete sales approach for ConnectGroup (EMS provider: PCB assembly, cable assembly, module building, design-to-product services).

**Target Company:** ${company.name} (${domain})

**Deep Research Summary:**
- Urgency Score: ${briefData.urgencyScore}/100
- Recent Developments: ${briefData.recentDevelopments?.join("; ") || "None"}
- Products/Services: ${briefData.productsServices?.map((p: any) => p.category).join(", ") || "Unknown"}
- Key Technologies: ${briefData.keyTechnologies?.map((t: any) => t.name).join(", ") || "Unknown"}
- Target Markets: ${briefData.targetMarkets?.map((m: any) => m.segment).join(", ") || "Unknown"}

**Your Task:** Generate a complete sales approach including:
1. Conversation starters (3 specific openers referencing recent developments)
2. Engagement strategy (why this prospect matters, recommended approach, key talking points)
3. Personalized outreach materials (email, LinkedIn, call script)

Return JSON only:
{
  "conversationStarters": [
    "I saw that you recently launched X - are you evaluating manufacturing partners to scale production?",
    "Noticed your expansion into Y market - how are you handling the increased PCB assembly demands?",
    "Your recent Z announcement suggests growth - are you looking to optimize your supply chain for faster time-to-market?"
  ],
  "engagementStrategy": {
    "whyThisProspectMatters": [
      "Strong fit with ConnectGroup's IoT manufacturing capabilities",
      "Growing market presence indicates scaling needs",
      "Technology stack aligns with our expertise"
    ],
    "recommendedApproach": [
      "Lead with design-to-product capabilities for their IoT expansion",
      "Highlight our experience in similar smart home projects",
      "Emphasize fast time-to-market and supply chain optimization"
    ],
    "keyTalkingPoints": [
      "Our PCB assembly capabilities support complex IoT designs",
      "We've helped similar companies scale from prototype to production",
      "Our cable assembly expertise can streamline their manufacturing"
    ]
  },
  "emailDraft": {
    "subject": "Brief, specific subject line referencing recent development or pain point",
    "body": "3-paragraph email:\n1. Hook (reference specific recent development)\n2. Value prop (how ConnectGroup solves their specific challenge)\n3. CTA (request 15-min call)\n\nTone: Professional, consultative, not salesy. Use 'you/your' not 'we/our'."
  },
  "linkedinMessage": {
    "connectionRequest": "Short connection request (max 200 chars) mentioning shared industry/interest",
    "followUp": "Follow-up message after connection accepted (2-3 sentences, reference recent development, soft CTA)"
  },
  "callScript": {
    "opening": "30-second opening statement (introduce self, reference trigger event, state purpose)",
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

  // Assemble final sales approach
  const salesApproach: SalesApproach = {
    companyName: company.name,
    generatedAt: new Date().toISOString(),
    conversationStarters: approachData.conversationStarters || [],
    engagementStrategy: approachData.engagementStrategy || {
      whyThisProspectMatters: [],
      recommendedApproach: [],
      keyTalkingPoints: [],
    },
    emailDraft: approachData.emailDraft || {
      subject: "Exploring EMS partnership opportunities",
      body: "Email generation failed. Please try again.",
    },
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

  console.log(`[Sales Approach] ✓ Personalized outreach generated for ${company.name}`);

  return salesApproach;
}
