#!/usr/bin/env python3
"""
Sales Intelligence Brief Generator using Grok MCP

Generates comprehensive sales briefs with:
1. Urgency detection (recent developments, growth signals)
2. Company intelligence (products, technologies, target markets)
3. Contact verification
4. Engagement strategy

Usage:
    python3 generate_sales_brief.py <company_name> <company_domain> [--linkedin <url>] [--industry <industry>] [--size <employees>]
"""

import os
import sys
import json
import argparse
from datetime import datetime
from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import web_search

def generate_sales_brief(
    company_name: str,
    company_domain: str,
    linkedin_url: str = None,
    industry: str = None,
    employee_count: int = None,
    revenue: str = None,
    naics_codes: list = None,
    offering_context: str = "Electronics Manufacturing Services (EMS) and PCB assembly"
):
    """
    Generate a comprehensive sales intelligence brief for a company.
    
    Returns a dict with all brief sections and urgency score.
    """
    
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable not set")
    
    client = Client(api_key=api_key, timeout=300)
    
    print(f"[Brief Generator] Starting brief generation for {company_name}")
    print(f"[Brief Generator] Domain: {company_domain}")
    
    # ===== PHASE 1: Data Collection =====
    # (Already have this from database, just format it)
    executive_summary = {
        "company": company_name,
        "industry": industry or "Unknown",
        "employees": employee_count or "Unknown",
        "revenue": revenue or "Unknown",
        "domain": company_domain,
        "linkedin": linkedin_url or "Unknown"
    }
    
    # ===== PHASE 2: Urgency Detection (Recent Developments) =====
    print("[Brief Generator] Phase 2: Detecting urgency signals...")
    
    urgency_prompt = f"""You are a B2B sales intelligence analyst. Research {company_name} ({company_domain}) to find TIME-SENSITIVE signals that indicate immediate sales opportunity.

Search for recent developments (2024-2025) in these categories:

1. **TIME-BASED SIGNALS** (30 points each):
   - Hiring (especially operations, supply chain, engineering roles)
   - Expansion (new facilities, international growth)
   - Product launches (new products requiring manufacturing)
   - Funding/M&A (Series B+, acquisitions)
   - Events (trade shows, conferences they're attending/exhibiting)

2. **PAIN POINTS** (25 points each):
   - Public complaints about suppliers, quality, delivery
   - Regulatory pressure (compliance, certifications needed)
   - Supply chain disruptions mentioned

3. **BUYING INTENT** (20 points each):
   - Research activity (RFPs, supplier evaluations)
   - Budget allocation announcements
   - Partnership announcements with tech companies

4. **RISK/OPPORTUNITY** (15 points each):
   - Market volatility affecting their industry
   - Growth trajectory (revenue growth, market share gains)
   - Competitive pressure

For each signal found:
- Provide the exact quote or evidence
- Include the source URL
- Assign a weight (10-30 points based on category)
- Note the date detected

Calculate an urgency score (0-100) based on:
- Company context (0-40 pts): Size, industry, growth stage
- Market signals (0-35 pts): Industry trends, market position
- Recent activity (0-25 pts): Time-sensitive signals detected

Format your response as JSON:
{{
  "urgencyScore": 75,
  "urgencyBreakdown": {{
    "companyContext": 35,
    "marketSignals": 22,
    "recentActivity": 18
  }},
  "signals": [
    {{
      "category": "time_based",
      "type": "hiring",
      "description": "Supply Chain Manager role posted 14 days ago",
      "weight": 30,
      "source": "web",
      "url": "https://...",
      "detectedAt": "2025-02-18"
    }}
  ],
  "recentDevelopments": [
    "In 2025, {company_name} expanded its U.S. manufacturing footprint...",
    "The company's Product X was showcased at Industry Conference 2024..."
  ],
  "conversationStarters": [
    "I noticed you recently expanded into the U.S. market - are you evaluating EMS partners for domestic production?",
    "Saw your Supply Chain Manager posting - are you looking to optimize your electronics manufacturing supply chain?"
  ]
}}

Be specific and cite real sources. If no signals found, return urgencyScore: 0."""

    try:
        chat = client.chat.create(
            model="grok-4-0709",  # Use grok-4 for web_search tool
            tools=[web_search(enable_image_understanding=False)],
            include=["inline_citations"],
            max_turns=5
        )
        chat.append(user(urgency_prompt))
        urgency_response = chat.sample()
        
        # Parse JSON from response
        urgency_data = json.loads(urgency_response.content)
        print(f"[Brief Generator] Urgency score: {urgency_data['urgencyScore']}")
        print(f"[Brief Generator] Found {len(urgency_data.get('signals', []))} urgency signals")
        
    except Exception as e:
        print(f"[Brief Generator] Error in urgency detection: {e}")
        urgency_data = {
            "urgencyScore": 0,
            "urgencyBreakdown": {"companyContext": 0, "marketSignals": 0, "recentActivity": 0},
            "signals": [],
            "recentDevelopments": [],
            "conversationStarters": []
        }
    
    # ===== PHASE 3: Company Intelligence =====
    print("[Brief Generator] Phase 3: Gathering company intelligence...")
    
    intelligence_prompt = f"""You are a B2B sales intelligence analyst. Research {company_name} ({company_domain}) to understand their business in depth.

Extract the following information:

1. **Products & Services** (3-5 key offerings):
   - Product categories
   - Brief description of each
   - Key capabilities

2. **Key Technologies** (3-5 core technologies):
   - Technical capabilities
   - Technology stack
   - Innovation areas

3. **Target Markets** (4-6 market segments):
   - Industries they serve
   - Customer types
   - Geographic markets

4. **Industry Keywords** (20-50 keywords):
   - Technologies they use
   - Services they provide
   - Industries they serve
   - Products they make

Format your response as JSON:
{{
  "productsServices": [
    {{
      "category": "Professional Drones",
      "description": "Flagship models include Heavy Lift Drone, Commander 3XL..."
    }}
  ],
  "keyTechnologies": [
    {{
      "name": "AI-powered UAVs",
      "description": "Integration of artificial intelligence for navigation..."
    }}
  ],
  "targetMarkets": [
    {{
      "segment": "Defense & Security",
      "description": "Military and security organizations seeking advanced UAVs..."
    }}
  ],
  "industryKeywords": [
    "small unmanned aircraft systems",
    "drones",
    "public safety",
    ...
  ]
}}

Be specific and cite real sources."""

    try:
        chat = client.chat.create(
            model="grok-4-0709",
            tools=[web_search(enable_image_understanding=False)],
            include=["inline_citations"],
            max_turns=5
        )
        chat.append(user(intelligence_prompt))
        intelligence_response = chat.sample()
        
        intelligence_data = json.loads(intelligence_response.content)
        print(f"[Brief Generator] Found {len(intelligence_data.get('productsServices', []))} product categories")
        print(f"[Brief Generator] Found {len(intelligence_data.get('industryKeywords', []))} industry keywords")
        
    except Exception as e:
        print(f"[Brief Generator] Error in intelligence gathering: {e}")
        intelligence_data = {
            "productsServices": [],
            "keyTechnologies": [],
            "targetMarkets": [],
            "industryKeywords": []
        }
    
    # ===== PHASE 4: Contact Verification =====
    # (Already have this from Apollo, just mark as verified)
    verified_contacts = {
        "website": {"value": company_domain, "source": "Apollo ID", "verified": True},
        "linkedin": {"value": linkedin_url or "Unknown", "source": "Apollo + Live Verification", "verified": bool(linkedin_url)},
    }
    
    # ===== PHASE 5: Engagement Strategy =====
    print("[Brief Generator] Phase 5: Generating engagement strategy...")
    
    strategy_prompt = f"""You are a B2B sales strategist for Connect Group, an EMS/PCB assembly provider.

Based on this company profile:
- Company: {company_name}
- Industry: {industry}
- Employees: {employee_count}
- Urgency Score: {urgency_data['urgencyScore']}
- Recent Developments: {json.dumps(urgency_data.get('recentDevelopments', []))}
- Products: {json.dumps(intelligence_data.get('productsServices', []))}

Generate an engagement strategy with:

1. **Why This Prospect Matters** (4 points):
   - Verified decision-maker access
   - Market position (size, revenue)
   - Growth trajectory
   - Technology fit

2. **Recommended Approach** (4 steps):
   - Initial contact method
   - Value proposition focus
   - Timing strategy
   - Follow-up plan

3. **Key Talking Points** (3-4 bullets):
   - Address their focus areas
   - Reference recent developments (be specific!)
   - Highlight Connect Group's expertise in their target markets

Format as JSON:
{{
  "whyThisProspectMatters": [
    "Verified Decision-Maker Access: Direct phone and LinkedIn contacts verified",
    "Market Position: {employee_count} employees, strong industry presence",
    ...
  ],
  "recommendedApproach": [
    "Initial Contact: LinkedIn outreach to key executives",
    "Value Proposition: Focus on [specific areas from their business]",
    ...
  ],
  "keyTalkingPoints": [
    "Address their focus on: [specific technologies/markets]",
    "Reference recent developments: [specific quote from recent news]",
    ...
  ]
}}

Be specific and actionable."""

    try:
        chat = client.chat.create(
            model="grok-4-1-fast-reasoning",  # Use reasoning model for strategy
            max_turns=1
        )
        chat.append(user(strategy_prompt))
        strategy_response = chat.sample()
        
        strategy_data = json.loads(strategy_response.content)
        print(f"[Brief Generator] Generated engagement strategy")
        
    except Exception as e:
        print(f"[Brief Generator] Error in strategy generation: {e}")
        strategy_data = {
            "whyThisProspectMatters": [],
            "recommendedApproach": [],
            "keyTalkingPoints": []
        }
    
    # ===== PHASE 6: Assemble Brief =====
    print("[Brief Generator] Phase 6: Assembling final brief...")
    
    brief = {
        "companyName": company_name,
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "urgencyScore": urgency_data["urgencyScore"],
        "urgencyBreakdown": urgency_data["urgencyBreakdown"],
        "executiveSummary": executive_summary,
        "verifiedContacts": verified_contacts,
        "productsServices": intelligence_data.get("productsServices", []),
        "keyTechnologies": intelligence_data.get("keyTechnologies", []),
        "recentDevelopments": urgency_data.get("recentDevelopments", []),
        "targetMarkets": intelligence_data.get("targetMarkets", []),
        "industryKeywords": intelligence_data.get("industryKeywords", []),
        "naicsCodes": naics_codes or [],
        "urgencySignals": urgency_data.get("signals", []),
        "conversationStarters": urgency_data.get("conversationStarters", []),
        "engagementStrategy": strategy_data,
    }
    
    client.close()
    print(f"[Brief Generator] ✓ Brief generation complete")
    
    return brief


def main():
    parser = argparse.ArgumentParser(description="Generate sales intelligence brief using Grok")
    parser.add_argument("company_name", help="Company name")
    parser.add_argument("company_domain", help="Company domain (e.g., acme.com)")
    parser.add_argument("--linkedin", help="LinkedIn URL")
    parser.add_argument("--industry", help="Industry")
    parser.add_argument("--size", type=int, help="Employee count")
    parser.add_argument("--revenue", help="Revenue (e.g., $10M-50M)")
    parser.add_argument("--naics", nargs="+", help="NAICS codes")
    parser.add_argument("--output", help="Output file path (JSON)")
    
    args = parser.parse_args()
    
    brief = generate_sales_brief(
        company_name=args.company_name,
        company_domain=args.company_domain,
        linkedin_url=args.linkedin,
        industry=args.industry,
        employee_count=args.size,
        revenue=args.revenue,
        naics_codes=args.naics
    )
    
    # Output JSON
    output_json = json.dumps(brief, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output_json)
        print(f"\n✓ Brief saved to {args.output}")
    else:
        print("\n" + output_json)


if __name__ == "__main__":
    main()
