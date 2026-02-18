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

**CRITICAL REQUIREMENT:** You MUST return AT LEAST 30 SIC codes and AT LEAST 30 NAICS codes. Fewer codes will result in missed opportunities and incomplete coverage of the target market.

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

4. **Be comprehensive and expansive (MINIMUM 30 codes per type)**:
   - **REQUIRED: Include AT LEAST 30 SIC codes** (4-digit codes) - aim for 40-50 to cover the full breadth of target markets
   - **REQUIRED: Include AT LEAST 30 NAICS codes** (6-digit codes) - aim for 40-50 for maximum coverage
   - Cast a WIDE net across ALL mentioned target market segments - do not be selective
   - Include both primary and adjacent industries that might use the offering
   - For each target market segment mentioned, include 3-5 relevant codes minimum
   - Prioritize codes that represent mid-to-large companies (avoid retail/small business codes unless explicitly relevant)
   - When in doubt, ALWAYS INCLUDE the code rather than exclude it
   - Better to have too many codes than too few - we filter on the backend

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
  "sicCodes": ["3561", "3562", "3569", "3714", "3724", "2911", "4911", "4922", "3531", "3532", "3533", "3537", "3711", "3713", "3715", "3721", "3728", "1311", "1321", "1381", "1382", "1389", "2911", "2992", "3312", "3316", "3317", "3321", "3324", "4931", "4932", "4939", "4941", "4952", "4953", "1041", "1044", "1061", "1081", "1094", "1099"],
  "naicsCodes": ["333111", "333112", "333120", "336411", "336412", "324110", "221112", "221122", "333131", "333132", "333249", "333611", "333612", "333613", "333618", "336111", "336112", "336120", "336211", "336212", "336213", "336214", "211111", "211112", "211130", "212111", "212112", "212113", "212210", "212221", "212222", "212231", "212234", "212299", "213111", "213112", "221111", "221113", "221114", "221115", "221116", "221117", "221118", "221210", "221310", "221320", "221330"],
  "reasoning": "Selected comprehensive coverage of manufacturing (industrial machinery, construction equipment, engines, automotive), utilities (power generation, natural gas, water), extractive industries (oil/gas extraction, mining of all types), and heavy equipment operators. Expanded to include all major segments that rely on equipment uptime and would benefit from predictive maintenance to prevent failures and optimize operations."
}

Now analyze the offering above and return your code selection.`;
}
