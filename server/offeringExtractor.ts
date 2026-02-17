import axios from "axios";

export interface OfferingData {
  name: string;
  description: string;
  targetMarket: string;
  valueProposition: string;
  keywords: string[];
  crossBorderIndicators?: string;
}

const OFFERING_EXTRACTION_PROMPT = `You are an expert business analyst. Analyze the provided company website and extract structured offering information.

Browse the homepage, about page, and solutions/products pages to gather information. Extract the following fields:

1. **name**: The main product/service name (e.g., "Electronics Manufacturing Services (EMS)")
2. **description**: A 2-3 sentence overview of what the company offers
3. **targetMarket**: Ideal customer profile - company size, industries, geography (e.g., "Mid-sized to large enterprises in industrial sectors across Europe and North America")
4. **valueProposition**: Unique value and problems solved (2-3 sentences)
5. **keywords**: 5-10 relevant industry keywords (e.g., ["EMS", "Cable Assembly", "PCB Assembly", "Industrial Manufacturing"])
6. **crossBorderIndicators**: Evidence of international operations - production facilities in multiple countries, global customer base, multi-currency pricing, cross-border supply chain (2-3 sentences, or empty if no clear indicators)

Tag each field with confidence:
- [WELL-SOURCED]: Directly stated on website
- [INDICATIVE]: Inferred from context
- [SPECULATIVE]: Educated guess

Return ONLY a valid JSON object with this exact structure:
{
  "name": "...",
  "description": "...",
  "targetMarket": "...",
  "valueProposition": "...",
  "keywords": ["...", "..."],
  "crossBorderIndicators": "..."
}`;

export async function extractOffering(companyWebsite: string): Promise<OfferingData> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable not set");
  }

  try {
    // Call xAI Grok API with web search tool
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-2-1212",
        messages: [
          {
            role: "system",
            content: OFFERING_EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: `Analyze this company website and extract offering information: ${companyWebsite}`,
          },
        ],
        tools: [
          {
            type: "web_search",
            web_search: {
              enable_image_understanding: true,
            },
          },
        ],
        max_turns: 5,
        temperature: 0.3,
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

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = assistantMessage.trim();
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

    return offering;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Grok API error: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
}
