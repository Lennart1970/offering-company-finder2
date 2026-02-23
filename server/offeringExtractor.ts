import axios from "axios";

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

const OFFERING_EXTRACTION_PROMPT = `You are an expert B2B sales strategist and business analyst using Grok 4.1 fast-reasoning mode with full tool access. Your goal is to analyze a company's website with verifiable, traceable sources.

Your job is to determine:
1. What this company offers (their product/service)
2. WHO their ideal customers are — the types of companies that would BUY from them

This is critical: we need to find POTENTIAL CUSTOMERS for this company, not companies similar to them.

**Process step-by-step using tools:**

1. Use web_search to find information about the company. Run searches like:
   - "[Company] products services offerings"
   - "[Company] customers industries served"
   - "[Company] about company overview"
   Set num_results to 10 for broad coverage.

2. Use browse_page on the company's website to extract key information from:
   - Homepage (overview, value proposition)
   - Products/Services page (what they sell)
   - About page (company background, target markets)
   - Solutions/Industries page if available (who they serve)
   Instructions: "Extract product/service descriptions, target customer industries, and value proposition. Include direct quotes. Summarize in 150 words max per page."

3. If any page returns 404 or is unavailable, skip it and note the limitation.

4. Based ONLY on verified data from tools, extract the structured offering information below.

**Extract the following fields:**

1. **name**: The main product/service name (e.g., "Electronics Manufacturing Services (EMS)")
2. **description**: A 2-3 sentence overview of what the company offers
3. **targetMarket**: Ideal customer profile — what industries, company types, and segments buy from them
4. **valueProposition**: Unique value and problems solved (2-3 sentences)
5. **keywords**: 5-10 keywords describing the company's OWN offering
6. **targetMarketKeywordTags**: THIS IS THE MOST IMPORTANT FIELD. Provide 5-15 specific industry keyword tags that describe the CUSTOMERS who would buy from this company.

   Rules for targetMarketKeywordTags:
   - Each tag should be a single industry term or market segment (1-3 words max)
   - Tags should describe the BUYER's industry, not the seller's
   - Include both broad and specific terms
   - Think: "What industries need this company's products/services?"
   
   Example: If the company makes industrial connectors, their targetMarketKeywordTags would be:
   ["industrial automation", "manufacturing", "aerospace", "defense", "medical devices", "telecommunications", "automotive", "energy", "oil and gas", "robotics"]

7. **crossBorderIndicators**: Evidence of international operations (2-3 sentences, or empty string)
8. **sources**: Array of verified source URLs used to extract this information

Only use verified data from tools — do NOT hallucinate URLs or facts.

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "name": "...",
  "description": "...",
  "targetMarket": "...",
  "valueProposition": "...",
  "keywords": ["...", "..."],
  "targetMarketKeywordTags": ["...", "..."],
  "crossBorderIndicators": "...",
  "sources": [
    {"url": "https://company.com/about", "title": "About Page", "snippet": "Key excerpt"}
  ]
}`;

export async function extractOffering(companyWebsite: string): Promise<OfferingData> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable not set");
  }

  try {
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-4-1-fast-reasoning",
        messages: [
          {
            role: "system",
            content: OFFERING_EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: `Analyze this company website and extract offering information: ${companyWebsite}\n\nUse web_search and browse_page tools to visit the website, browse the key pages (homepage, about, products/services, solutions), and extract the structured data as JSON. Pay special attention to identifying who their CUSTOMERS are — what industries and company types buy from them. Verify all information through tool results.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 180000, // 3 minute timeout
      }
    );

    // Extract the assistant's final message
    const assistantMessage = response.data.choices[0]?.message?.content;
    if (!assistantMessage) {
      throw new Error("No response from Grok API");
    }

    // Parse JSON from response (handle markdown code blocks and thinking tags)
    let jsonStr = assistantMessage.trim();
    
    // Remove <think>...</think> blocks if present
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```\n?/g, "").replace(/```\n?$/g, "");
    }

    const offering = JSON.parse(jsonStr) as OfferingData;

    // Validate required fields
    if (!offering.name || !offering.description || !offering.targetMarket || !offering.valueProposition) {
      throw new Error("Missing required fields in offering extraction");
    }

    if (!offering.keywords || offering.keywords.length === 0) {
      offering.keywords = ["business", "services"];
    }

    // Ensure targetMarketKeywordTags exists
    if (!offering.targetMarketKeywordTags || offering.targetMarketKeywordTags.length === 0) {
      // Fallback: derive from targetMarket description
      offering.targetMarketKeywordTags = offering.targetMarket
        .split(/[,;]/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 2 && s.length < 40)
        .slice(0, 10);
    }

    if (!offering.crossBorderIndicators) {
      offering.crossBorderIndicators = "";
    }

    // Log source verification stats
    const sourceCount = offering.sources?.length || 0;
    console.log(`[Offering Extractor] Extracted offering with ${sourceCount} verified sources`);

    return offering;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Grok API Error] Status:", error.response?.status);
      console.error("[Grok API Error] Response data:", JSON.stringify(error.response?.data, null, 2));
      console.error("[Grok API Error] Request data:", JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messagesCount: 2,
        temperature: 0.3,
        max_tokens: 4000,
      }));

      const errorDetails = error.response?.data?.error?.message || error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Grok API error: ${errorDetails}`);
    }
    throw error;
  }
}
