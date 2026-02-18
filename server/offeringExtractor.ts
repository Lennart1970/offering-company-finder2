import axios from "axios";

export interface OfferingData {
  name: string;
  description: string;
  targetMarket: string;
  valueProposition: string;
  keywords: string[];
  crossBorderIndicators?: string;
}

const OFFERING_EXTRACTION_PROMPT = `You are an expert business analyst. Analyze the provided company website URL and extract structured offering information.

Your task: Visit the website and extract the following fields by analyzing the homepage, about page, and solutions/products pages:

1. **name**: The main product/service name (e.g., "Electronics Manufacturing Services (EMS)")
2. **description**: A 2-3 sentence overview of what the company offers
3. **targetMarket**: Ideal customer profile - company size, industries, geography (e.g., "Mid-sized to large enterprises in industrial sectors across Europe and North America")
4. **valueProposition**: Unique value and problems solved (2-3 sentences)
5. **keywords**: 5-10 relevant industry keywords (e.g., ["EMS", "Cable Assembly", "PCB Assembly", "Industrial Manufacturing"])
6. **crossBorderIndicators**: Evidence of international operations - production facilities in multiple countries, global customer base, multi-currency pricing, cross-border supply chain (2-3 sentences, or empty string if no clear indicators)

Tag each field with confidence:
- [WELL-SOURCED]: Directly stated on website
- [INDICATIVE]: Inferred from context
- [SPECULATIVE]: Educated guess

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
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
    // Use standard chat completions API with the website URL in the prompt
    // Grok will use its built-in web browsing capabilities
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
            content: `Analyze this company website and extract offering information: ${companyWebsite}\n\nVisit the website, browse the key pages, and extract the structured data as JSON.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
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

    // Ensure crossBorderIndicators is a string (not undefined)
    if (!offering.crossBorderIndicators) {
      offering.crossBorderIndicators = "";
    }

    return offering;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorDetails = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      throw new Error(`Grok API error: ${errorDetails}`);
    }
    throw error;
  }
}
