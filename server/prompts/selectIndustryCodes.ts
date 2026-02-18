/**
 * LLM Prompt: Select Relevant SIC/NAICS Codes for Offering
 * 
 * Purpose: Analyze a company's offering and identify which SIC/NAICS industry codes
 * represent potential customers who would need this offering.
 */

export interface OfferingInput {
  offeringName: string;
  offeringDescription: string;
  targetMarket: string;
  valueProposition: string;
}

export interface IndustryCodeSelection {
  sicCodes: string[];
  naicsCodes: string[];
  reasoning: string;
}

export function buildCodeSelectionPrompt(offering: OfferingInput): string {
  return `You are an industry classification expert helping identify potential customers for a B2B offering.

**OFFERING ANALYSIS**

Offering Name: ${offering.offeringName}

Description: ${offering.offeringDescription}

Target Market: ${offering.targetMarket}

Value Proposition: ${offering.valueProposition}

---

**YOUR TASK**

Identify which SIC (Standard Industrial Classification) and NAICS (North American Industry Classification System) codes represent companies that would be **potential customers** for this offering.

**IMPORTANT GUIDELINES:**

1. **Think from the buyer's perspective**: Which industries would NEED or BUY this offering?
   - If the offering is "PCB assembly services", select codes for companies that USE PCBs (electronics manufacturers, medical device makers, automotive electronics), NOT PCB manufacturers themselves
   - If the offering is "industrial automation software", select codes for factories and manufacturers who would IMPLEMENT automation, NOT software companies

2. **Focus on end-users and integrators**: 
   - Manufacturing companies that would integrate this into their products
   - Industries that would deploy this in their operations
   - Companies that would resell or integrate this into larger solutions

3. **Avoid selecting the offering provider's own industry**:
   - If offering is "EMS services", DON'T select EMS provider codes
   - If offering is "supply chain software", DON'T select software publisher codes
   - Select the industries that would BUY and USE the offering

4. **Be specific but comprehensive**:
   - Include 8-15 SIC codes (4-digit codes)
   - Include 8-15 NAICS codes (6-digit codes)
   - Cover the full range of potential customer industries
   - Prioritize codes that represent mid-to-large companies (avoid retail/small business codes unless explicitly relevant)

5. **Common SIC/NAICS patterns to consider**:
   - Manufacturing sectors (SIC 20-39, NAICS 31-33)
   - Technology & Electronics (SIC 357, 367, 382, NAICS 334, 335)
   - Healthcare & Medical Devices (SIC 384, NAICS 3391, 3345)
   - Automotive & Transportation (SIC 371, 373, NAICS 3361-3363)
   - Aerospace & Defense (SIC 372, 376, NAICS 3364)
   - Industrial Equipment (SIC 35, NAICS 333)
   - Energy & Utilities (SIC 49, NAICS 221, 2211)

**OUTPUT FORMAT**

Respond with a JSON object in this exact structure:

{
  "sicCodes": ["1234", "5678", ...],
  "naicsCodes": ["123456", "234567", ...],
  "reasoning": "Brief explanation of why these codes were selected and what customer segments they represent"
}

**EXAMPLE**

For an offering like "Industrial IoT sensors for predictive maintenance":

{
  "sicCodes": ["3561", "3562", "3569", "3714", "3724", "2911", "4911", "4922"],
  "naicsCodes": ["333111", "333112", "333120", "336411", "336412", "324110", "221112", "221122"],
  "reasoning": "Selected manufacturing industries (pumps, industrial machinery, automotive parts) and utilities (oil refineries, power generation, natural gas) that operate heavy equipment requiring predictive maintenance. These companies have high equipment uptime requirements and would benefit from IoT-based monitoring to prevent costly failures."
}

Now analyze the offering above and return your code selection.`;
}
