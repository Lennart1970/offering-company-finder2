import { invokeLLM } from "./_core/llm";
import { buildCodeSelectionPrompt, type OfferingInput, type IndustryCodeSelection } from "./prompts/selectIndustryCodes";

/**
 * Use LLM to select relevant SIC/NAICS codes based on the offering
 */
export async function selectIndustryCodes(offering: OfferingInput): Promise<IndustryCodeSelection> {
  console.log(`[Code Selection] Analyzing offering: ${offering.offeringName}`);
  
  const prompt = buildCodeSelectionPrompt(offering);
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an industry classification expert. Always respond with valid JSON matching the requested schema."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "industry_code_selection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sicCodes: {
                type: "array",
                items: { type: "string" },
                description: "Array of 4-digit SIC codes representing potential customer industries"
              },
              naicsCodes: {
                type: "array",
                items: { type: "string" },
                description: "Array of 6-digit NAICS codes representing potential customer industries"
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of why these codes were selected"
              }
            },
            required: ["sicCodes", "naicsCodes", "reasoning"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed: IndustryCodeSelection = JSON.parse(contentStr);
    
    // Deduplicate codes (LLM may return duplicates)
    const selection: IndustryCodeSelection = {
      sicCodes: Array.from(new Set(parsed.sicCodes)),
      naicsCodes: Array.from(new Set(parsed.naicsCodes)),
      reasoning: parsed.reasoning,
    };
    
    console.log(`[Code Selection] Selected ${selection.sicCodes.length} SIC codes and ${selection.naicsCodes.length} NAICS codes (deduped from ${parsed.sicCodes.length}/${parsed.naicsCodes.length})`);
    console.log(`[Code Selection] SIC: ${selection.sicCodes.join(", ")}`);
    console.log(`[Code Selection] NAICS: ${selection.naicsCodes.join(", ")}`);
    console.log(`[Code Selection] Reasoning: ${selection.reasoning}`);
    
    return selection;
  } catch (error) {
    console.error("[Code Selection] Failed:", error);
    throw new Error(`Code selection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
