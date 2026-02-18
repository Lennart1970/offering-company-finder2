import axios from "axios";

export interface OfferingData {
  name: string;
  description: string;
  targetMarket: string;
  valueProposition: string;
  keywords: string[];
  targetMarketKeywordTags: string[];
  crossBorderIndicators?: string;
}

const OFFERING_EXTRACTION_PROMPT = `You are an expert B2B sales strategist and business analyst. Your job is to analyze a company's website and determine:
1. What this company offers (their product/service)
2. WHO their ideal customers are — the types of companies that would BUY from them

This is critical: we need to find POTENTIAL CUSTOMERS for this company, not companies similar to them.

Analyze the provided company website URL and extract:

1. **name**: The main product/service name (e.g., "Electronics Manufacturing Services (EMS)")
2. **description**: A 2-3 sentence overview of what the company offers
3. **targetMarket**: Ideal customer profile — what industries, company types, and segments buy from them (e.g., "Industrial manufacturers, MedTech companies, Measurement & Control equipment makers")
4. **valueProposition**: Unique value and problems solved (2-3 sentences)
5. **keywords**: 5-10 keywords describing the company's OWN offering (e.g., ["EMS", "Cable Assembly", "PCB Assembly"])
6. **targetMarketKeywordTags**: THIS IS THE MOST IMPORTANT FIELD. Provide 5-15 specific industry keyword tags that describe the CUSTOMERS who would buy from this company. These tags will be used to search a B2B database for potential customers.

   Rules for targetMarketKeywordTags:
   - Each tag should be a single industry term or market segment (1-3 words max)
   - Tags should describe the BUYER's industry, not the seller's
   - Include both broad and specific terms
   - Think: "What industries need this company's products/services?"
   
   Example: If the company makes industrial connectors, their targetMarketKeywordTags would be:
   ["industrial automation", "manufacturing", "aerospace", "defense", "medical devices", "telecommunications", "automotive", "energy", "oil and gas", "robotics"]
   
   Example: If the company provides cloud hosting, their targetMarketKeywordTags would be:
   ["saas", "fintech", "e-commerce", "healthcare IT", "enterprise software", "gaming", "media streaming", "digital agency"]

7. **crossBorderIndicators**: Evidence of international operations (2-3 sentences, or empty string)

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "name": "...",
  "description": "...",
  "targetMarket": "...",
  "valueProposition": "...",
  "keywords": ["...", "..."],
  "targetMarketKeywordTags": ["...", "..."],
  "crossBorderIndicators": "..."
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
            content: `Analyze this company website and extract offering information: ${companyWebsite}\n\nVisit the website, browse the key pages (homepage, about, products/services, solutions), and extract the structured data as JSON. Pay special attention to identifying who their CUSTOMERS are — what industries and company types buy from them.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 3000,
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

    return offering;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Grok API Error] Status:", error.response?.status);
      console.error("[Grok API Error] Response data:", JSON.stringify(error.response?.data, null, 2));
      console.error("[Grok API Error] Request data:", JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messagesCount: 2,
        temperature: 0.3,
        max_tokens: 3000,
      }));

      const errorDetails = error.response?.data?.error?.message || error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Grok API error: ${errorDetails}`);
    }
    throw error;
  }
}
