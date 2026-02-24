/**
 * Offering Extractor
 * 
 * Extracts company offering data using xAI Grok Responses API with explicit web_search tool.
 * Analyzes company websites to determine what they offer and who their ideal customers are.
 */

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

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = "https://api.x.ai/v1";

const OFFERING_EXTRACTION_PROMPT = `You are an expert B2B sales strategist and business analyst. Today is February 23, 2026. Your goal is to analyze a company's website with verifiable, traceable sources.

Your job is to determine:
1. What this company offers (their product/service)
2. WHO their ideal customers are — the types of companies that would BUY from them

This is critical: we need to find POTENTIAL CUSTOMERS for this company, not companies similar to them.

**Instructions:**
1. Search for information about the company's products, services, customers, and industries served
2. Visit the company website to extract key information from homepage, products/services, about, and solutions pages
3. Only use verified data from your searches — do NOT hallucinate URLs or facts

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
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable not set");
  }

  try {
    const response = await fetch(`${XAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        tools: [{ type: "web_search" }],  // Explicit web_search tool
        input: `${OFFERING_EXTRACTION_PROMPT}\n\nAnalyze this company website and extract offering information: ${companyWebsite}\n\nSearch for and browse the website to extract the structured data as JSON. Pay special attention to identifying who their CUSTOMERS are — what industries and company types buy from them. Verify all information through your searches.`,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Responses API returns output in nested array structure:
    // response.output[] contains tool calls and content items
    // The actual text output is in items with content[].text where content[].type === "output_text"
    let assistantMessage: string | null = null;
    
    if (data.output && Array.isArray(data.output)) {
      // Find the output item that contains content (not tool calls)
      for (const item of data.output) {
        if (item.content && Array.isArray(item.content)) {
          const textContent = item.content.find((c: any) => c.type === "output_text");
          if (textContent?.text) {
            assistantMessage = textContent.text;
            break;
          }
        }
      }
    }
    
    // Fallback: check for direct text field (older format)
    if (!assistantMessage && data.text) {
      assistantMessage = data.text;
    }
    
    if (!assistantMessage) {
      throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
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
        .slice(0, 15);
    }

    return offering;
  } catch (error: any) {
    console.error("Error extracting offering:", error);
    throw new Error(`Failed to extract offering: ${error.message}`);
  }
}
