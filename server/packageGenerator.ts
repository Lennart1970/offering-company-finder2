export interface SalesIntelligencePackage {
  companyName: string;
  quickFacts: {
    employees: string;
    revenue: string;
    foundingYear: string;
    headquarters: string;
    website: string;
  };
  businessOverview: string;
  productsAndServices: string;
  keyTechnologies: string;
  recentDevelopments: string;
  targetMarkets: string;
  connectGroupStrategy: string;
  talkingPoints: string[];
}

/**
 * Generate a simple placeholder sales intelligence package for a company
 * Uses template-based generation instead of LLM to avoid API failures
 */
export async function generateSalesPackage(
  companyName: string,
  companyWebsite: string,
  companyData: {
    revenue?: string;
    employees?: string;
    foundedYear?: number;
    city?: string;
    state?: string;
    country?: string;
    sicCodes?: string[];
    naicsCodes?: string[];
  }
): Promise<SalesIntelligencePackage> {
  // Build location string
  const locationParts = [companyData.city, companyData.state, companyData.country].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Unknown";

  // Format founding year
  const foundingYear = companyData.foundedYear ? String(companyData.foundedYear) : "Unknown";

  // Build industry codes string
  const industryCodes: string[] = [];
  if (companyData.sicCodes && companyData.sicCodes.length > 0) {
    industryCodes.push(`SIC: ${companyData.sicCodes.join(", ")}`);
  }
  if (companyData.naicsCodes && companyData.naicsCodes.length > 0) {
    industryCodes.push(`NAICS: ${companyData.naicsCodes.length > 0 ? companyData.naicsCodes.join(", ") : "N/A"}`);
  }
  const industryCodesStr = industryCodes.length > 0 ? industryCodes.join(" | ") : "Not available";

  // Generate placeholder package
  const salesPackage: SalesIntelligencePackage = {
    companyName,
    quickFacts: {
      employees: companyData.employees || "Unknown",
      revenue: companyData.revenue || "Unknown",
      foundingYear,
      headquarters: location,
      website: companyWebsite,
    },
    businessOverview: `${companyName} is a company operating in the ${location} area. Based on available data (${industryCodesStr}), they appear to be active in sectors that align with ConnectGroup's target markets for Electronics Manufacturing Services (EMS).

**Company Profile:**
- Headquarters: ${location}
- Founded: ${foundingYear}
- Revenue: ${companyData.revenue || "Not disclosed"}
- Employees: ${companyData.employees || "Not disclosed"}
- Website: ${companyWebsite}

This company was identified through Apollo's database as a potential customer for ConnectGroup's supply chain visibility and traceability solutions.`,

    productsAndServices: `Based on industry classification codes (${industryCodesStr}), ${companyName} likely operates in sectors requiring:

- Complex supply chain management
- Component traceability and quality control
- Multi-tier supplier coordination
- Regulatory compliance documentation
- Product lifecycle management

These operational needs align with ConnectGroup's core EMS offerings: PCB Assembly, Cable Assembly, Module Building, and Design to Product services.`,

    keyTechnologies: `Companies in this industry segment typically utilize:

- Supply chain management systems
- Quality management software
- Component tracking and traceability tools
- Manufacturing execution systems (MES)
- Product lifecycle management (PLM) platforms

ConnectGroup's solutions can integrate with or enhance these existing technology stacks to provide end-to-end visibility and traceability.`,

    recentDevelopments: `*Note: Detailed recent developments require manual research of ${companyName}'s website, press releases, and industry news.*

Key areas to investigate:
- Recent product launches or expansions
- New facility openings or capacity increases
- Strategic partnerships or acquisitions
- Technology investments or digital transformation initiatives
- Regulatory compliance updates or certifications

Visit ${companyWebsite} for the latest company news and announcements.`,

    targetMarkets: `Based on industry classification, ${companyName} likely serves one or more of ConnectGroup's target markets:

**Primary Target Markets:**
- Railway (rolling stock, signaling, infrastructure)
- Healthcare/MedTech (medical devices, diagnostic equipment)
- Infrastructure (smart city, utilities, construction)
- Automotive & Off-road (vehicles, components, systems)
- Defense & Avionics (military, aerospace systems)
- Industrial (automation, instrumentation, control systems)

**Secondary Markets:**
- Electronics (consumer, commercial, embedded)
- Telecommunications (network equipment, devices)
- Energy (renewable, oil & gas, utilities)
- IoT & Embedded Systems (connected devices, sensors)

*Manual verification recommended by reviewing ${companyName}'s product portfolio and customer base.*`,

    connectGroupStrategy: `**Engagement Approach for ${companyName}:**

1. **Initial Research Phase**
   - Review ${companyWebsite} thoroughly for product portfolio and customer base
   - Identify specific supply chain pain points in their industry segment
   - Research recent news, press releases, and LinkedIn activity
   - Identify key decision-makers (VP Operations, Head of Supply Chain, CTO)

2. **Value Proposition Alignment**
   - Emphasize ConnectGroup's expertise in their specific industry vertical
   - Highlight relevant case studies from similar companies
   - Focus on supply chain visibility and traceability benefits
   - Demonstrate compliance and quality control capabilities

3. **Outreach Strategy**
   - Lead with industry-specific challenges and ConnectGroup solutions
   - Offer a supply chain assessment or consultation
   - Provide relevant white papers or case studies
   - Request introduction through mutual connections if available

4. **Key Differentiators to Emphasize**
   - Full-service EMS: PCB Assembly • Cable Assembly • Module Building • Design to Product
   - End-to-end supply chain visibility and traceability
   - Multi-industry expertise (Railway, MedTech, Industrial, etc.)
   - Quality certifications and regulatory compliance experience
   - European manufacturing presence and capabilities`,

    talkingPoints: [
      `${companyName} operates in a sector where supply chain visibility and component traceability are critical for quality assurance and regulatory compliance.`,
      
      `ConnectGroup's EMS solutions (PCB Assembly, Cable Assembly, Module Building) can help ${companyName} streamline their supply chain while maintaining full traceability from design to product.`,
      
      `Based on their industry classification (${industryCodesStr}), ${companyName} likely faces challenges in multi-tier supplier coordination and documentation—areas where ConnectGroup excels.`,
      
      `ConnectGroup has proven experience serving companies in similar markets (Railway, Healthcare/MedTech, Infrastructure, Automotive, Defense, Industrial) with complex supply chain requirements.`,
      
      `A discovery call could explore how ConnectGroup's supply chain visibility solutions might address ${companyName}'s specific operational challenges and growth objectives.`,
    ],
  };

  return salesPackage;
}

/**
 * Convert a sales intelligence package to Markdown format
 */
export function packageToMarkdown(pkg: SalesIntelligencePackage): string {
  return `# Sales Intelligence Brief: ${pkg.companyName}

## Quick Facts

| Metric | Value |
|--------|-------|
| **Employees** | ${pkg.quickFacts.employees} |
| **Revenue** | ${pkg.quickFacts.revenue} |
| **Founded** | ${pkg.quickFacts.foundingYear} |
| **Headquarters** | ${pkg.quickFacts.headquarters} |
| **Website** | ${pkg.quickFacts.website} |

## Business Overview

${pkg.businessOverview}

## Products and Services

${pkg.productsAndServices}

## Key Technologies and Capabilities

${pkg.keyTechnologies}

## Recent Developments (2024-2025)

${pkg.recentDevelopments}

## Target Markets and Business Intelligence

${pkg.targetMarkets}

## Connect Group Engagement Strategy

${pkg.connectGroupStrategy}

## Key Talking Points

${pkg.talkingPoints.map((point, i) => `${i + 1}. ${point}`).join("\n\n")}

---

*Generated by Connect Group Company Finder*
*Data sources: Apollo.io, company website, public records*
`;
}
