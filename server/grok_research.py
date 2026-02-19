#!/usr/bin/env python3
"""
Grok Research Script with Citations
Uses xAI SDK with web_search() and x_search() tools to get citations.
"""

import json
import sys
import os
from xai_sdk import Client
from xai_sdk.chat import system, user
from xai_sdk.tools import web_search, x_search


def research_urgency(company_name, domain, industry):
    """Research company urgency signals with citations."""
    
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable not set")
    
    client = Client(api_key=api_key)
    
    # Create chat with tools enabled
    chat = client.chat.create(
        model="grok-4-1-fast",
        tools=[web_search(), x_search()],  # Enable web search for citations
    )
    
    # System prompt
    system_prompt = """You are a B2B sales intelligence analyst. Analyze companies to detect urgency signals for potential EMS/electronics manufacturing partnerships."""
    
    # User prompt
    user_prompt = f"""Analyze the company "{company_name}" ({domain}) to detect urgency signals.

Use web search to find recent developments (2024-2025) including:
- Expansion plans or new facilities
- Product launches or R&D announcements
- Hiring trends (especially engineering/manufacturing roles)
- Partnerships or acquisitions
- Funding rounds or financial growth

Score urgency 0-100 based on:
- Company Context (0-40): Growth stage, financial health, industry momentum
- Market Signals (0-35): Competitive pressure, market expansion, technology shifts
- Recent Activity (0-25): Hiring, announcements, news mentions in past 6 months

Return JSON only:
{{
  "urgencyScore": 45,
  "urgencyBreakdown": {{
    "companyContext": 20,
    "marketSignals": 15,
    "recentActivity": 10
  }},
  "recentDevelopments": [
    {{
      "text": "2025: Launched new product line for IoT sensors",
      "source": "https://example.com/press-release",
      "date": "2025-01-15"
    }}
  ],
  "urgencySignals": [
    {{
      "category": "Growth",
      "type": "Product Launch",
      "description": "Launched new IoT sensor line in Q1 2025",
      "weight": 8,
      "source": "Company press release",
      "url": "https://example.com/news",
      "detectedAt": "2025-01-15"
    }}
  ]
}}"""
    
    chat.append(system(system_prompt))
    chat.append(user(user_prompt))
    
    # Get response
    response = chat.sample()
    
    # Extract content and citations
    content = response.content or ""
    citations = list(response.citations) if response.citations else []  # Convert to list
    
    # Parse JSON from content
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # If content is not valid JSON, wrap it
        data = {
            "urgencyScore": 0,
            "urgencyBreakdown": {"companyContext": 0, "marketSignals": 0, "recentActivity": 0},
            "recentDevelopments": [],
            "urgencySignals": [],
            "rawContent": content
        }
    
    # Add citations to response
    data["citations"] = citations
    
    return data


def research_intelligence(company_name, domain):
    """Research company intelligence with citations."""
    
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable not set")
    
    client = Client(api_key=api_key)
    
    # Create chat with tools enabled
    chat = client.chat.create(
        model="grok-4-1-fast",
        tools=[web_search(), x_search()],
    )
    
    # System prompt
    system_prompt = """You are a B2B sales intelligence analyst. Research companies to gather detailed intelligence for EMS sales approaches."""
    
    # User prompt
    user_prompt = f"""Research "{company_name}" ({domain}) to gather detailed company intelligence.

Use web search to find:
1. Products & Services (categorized)
2. Key Technologies used
3. Target Markets/Industries they serve
4. Industry keywords (50+ terms)

Return JSON only:
{{
  "productsServices": [
    {{"category": "IoT Devices", "description": "Smart sensors and connected devices"}},
    {{"category": "Software Platforms", "description": "Cloud-based IoT management"}}
  ],
  "keyTechnologies": [
    {{"name": "Bluetooth LE", "description": "Low-energy wireless communication"}},
    {{"name": "Edge Computing", "description": "On-device data processing"}}
  ],
  "targetMarkets": [
    {{"segment": "Healthcare", "description": "Medical device manufacturers"}},
    {{"segment": "Industrial", "description": "Factory automation systems"}}
  ],
  "industryKeywords": ["IoT", "sensors", "connectivity", "embedded systems", ...]
}}"""
    
    chat.append(system(system_prompt))
    chat.append(user(user_prompt))
    
    # Get response
    response = chat.sample()
    
    # Extract content and citations
    content = response.content or ""
    citations = list(response.citations) if response.citations else []  # Convert to list
    
    # Parse JSON from content
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        data = {
            "productsServices": [],
            "keyTechnologies": [],
            "targetMarkets": [],
            "industryKeywords": [],
            "rawContent": content
        }
    
    # Add citations to response
    data["citations"] = citations
    
    return data


if __name__ == "__main__":
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())
    
    command = input_data.get("command")
    company_name = input_data.get("companyName")
    domain = input_data.get("domain")
    industry = input_data.get("industry")
    
    if command == "urgency":
        result = research_urgency(company_name, domain, industry)
    elif command == "intelligence":
        result = research_intelligence(company_name, domain)
    else:
        result = {"error": f"Unknown command: {command}"}
    
    # Output JSON to stdout
    print(json.dumps(result))
