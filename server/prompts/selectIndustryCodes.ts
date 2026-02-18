/**
 * LLM Prompt: Select Relevant SIC/NAICS Codes for Offering
 * 
 * Uses hierarchical NAICS reasoning — the LLM selects codes at multiple
 * abstraction levels (sector, subsector, industry group, industry, national)
 * to cast a wide but intelligent net.
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

Identify which SIC and NAICS codes represent companies that would be **potential customers** for this offering.

**CRITICAL: USE HIERARCHICAL NAICS REASONING**

NAICS is a hierarchical economic behavior map. Each extra digit narrows how a company operates:

\`\`\`
XX      = Sector (macro economy role)        → e.g., "31-33" = Manufacturing
XXX     = Subsector (business function type)  → e.g., "333" = Machinery Manufacturing
XXXX    = Industry group (production style)   → e.g., "3332" = Industrial Machinery
XXXXX   = Industry (market niche)             → e.g., "33324" = Industrial Machinery Mfg
XXXXXX  = National specialization             → e.g., "333249" = Other Industrial Machinery
\`\`\`

The 20 NAICS sectors (modern economy map):

| Sector | Official Name                              | What it really represents |
|--------|-------------------------------------------|--------------------------|
| 11     | Agriculture, Forestry, Fishing & Hunting  | Resource extraction & cultivation |
| 21     | Mining, Quarrying & Oil/Gas Extraction    | Raw materials |
| 22     | Utilities                                  | Infrastructure utilities |
| 23     | Construction                               | Built environment |
| 31-33  | Manufacturing                              | Physical production |
| 42     | Wholesale Trade                            | B2B distribution |
| 44-45  | Retail Trade                               | Consumer trade |
| 48-49  | Transportation & Warehousing              | Logistics |
| 51     | Information                                | Data/media/software |
| 52     | Finance & Insurance                        | Money & risk |
| 53     | Real Estate & Rental/Leasing              | Assets |
| 54     | Professional, Scientific & Technical      | Knowledge work |
| 55     | Management of Companies                    | Holding/control |
| 56     | Administrative & Support Services         | Operational services |
| 61     | Educational Services                       | Human capital |
| 62     | Health Care & Social Assistance           | Care economy |
| 71     | Arts, Entertainment & Recreation          | Experience economy |
| 72     | Accommodation & Food Services             | Hospitality |
| 81     | Other Services                             | Personal & repair |
| 92     | Public Administration                      | Government |

**YOU CAN MIX ABSTRACTION LEVELS.** Use this strategically:

- Use **2-digit sector codes** when an ENTIRE sector is relevant (e.g., "22" for all utilities)
- Use **3-digit subsector codes** for broad coverage (e.g., "333" for all machinery manufacturing)
- Use **4-6 digit codes** only when you need to be specific within a sector

This is much more powerful than listing 50 individual 6-digit codes. A single "333" covers ALL machinery manufacturing.

---

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

4. **Be comprehensive — use hierarchy to cast a wide net**:
   - Use sector/subsector codes (2-3 digits) for broad coverage of entire market segments
   - Add specific 4-6 digit codes for niche industries not covered by broader codes
   - For each target market segment mentioned, decide the right abstraction level
   - When in doubt, use a BROADER code (fewer digits) to capture more companies
   - Better to have too many matches than too few — we filter on the backend

5. **SIC codes follow a similar hierarchy**:
   - 2-digit = Major Group (e.g., "35" = Industrial Machinery)
   - 3-digit = Industry Group (e.g., "357" = Computer Equipment)
   - 4-digit = Industry (e.g., "3571" = Electronic Computers)
   - Use the same multi-level strategy for SIC codes

**OUTPUT FORMAT**

Respond with a JSON object in this exact structure:

{
  "sicCodes": ["35", "36", "3714", "3841", ...],
  "naicsCodes": ["333", "334", "336320", "339112", ...],
  "reasoning": "Brief explanation of why these codes were selected, organized by target market segment"
}

**EXAMPLE**

For an offering like "Industrial IoT sensors for predictive maintenance" targeting Manufacturing, Utilities, Oil & Gas, Mining:

{
  "sicCodes": ["10", "12", "13", "14", "20", "22", "24", "26", "28", "29", "30", "32", "33", "34", "35", "36", "37", "49", "1381", "1382", "1389"],
  "naicsCodes": ["21", "22", "31", "32", "33", "48", "211130", "213111", "213112", "486210", "486910", "562211"],
  "reasoning": "Used broad sector codes for maximum coverage: Manufacturing (SIC 20-37, NAICS 31-33) covers all factories with equipment needing predictive maintenance. Mining (SIC 10-14, NAICS 21) and Utilities (SIC 49, NAICS 22) are heavy equipment sectors. Added specific codes for oil/gas services (1381-1389, 213111-213112) and pipeline transport (486) as niche segments. Logistics (NAICS 48) included for fleet/equipment monitoring."
}

Notice how mixing 2-digit broad codes with specific 4-6 digit codes gives comprehensive coverage with far fewer codes to manage.

Now analyze the offering above and return your code selection.`;
}
