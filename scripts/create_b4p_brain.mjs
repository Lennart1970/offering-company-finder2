/**
 * Standalone script to create an Offering Brain for Build4Performance
 * Uses xAI Grok with web search to research the company
 */
import mysql from 'mysql2/promise';

const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const FORGE_API_URL = (process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.im').replace(/\/$/, '') + '/v1/chat/completions';
const SERPER_API_KEY = process.env.SERPER_API_KEY;

async function serperSearch(query) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  const data = await res.json();
  return (data.organic || []).map(r => `${r.title}\n${r.snippet}\nURL: ${r.link}`).join('\n\n');
}

async function researchBrain(websiteUrl, companyName) {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `You are a B2B sales intelligence analyst. Today is ${today}.

Task: Analyze "${companyName}" (website: ${websiteUrl}) to build complete understanding of their offering, ideal customer profile, and competitive positioning.

Instructions:
1. Search the company website and available sources
2. Focus on WHAT they sell, WHO they sell to, WHY customers choose them
3. Be specific and actionable — this intelligence drives downstream B2B sales decisions

Research areas:
- Company overview and core offering (products/services)
- Specific capabilities and features
- Value propositions for different customer segments
- Competitive advantages (what makes them unique)
- Ideal customer profile: industries, company size, geography, pain points
- Buying signals: observable signals that a prospect needs this product
- Fit criteria: what makes a great fit vs poor fit vs disqualifier
- Urgency triggers: events creating immediate purchase need
- Relevant SIC and NACE industry codes

Return ONLY valid JSON with this exact structure:
{
  "companyName": "string",
  "companyWebsite": "string",
  "offeringSummary": "2-3 sentence overview",
  "coreCapabilities": ["capability1", "capability2"],
  "valuePropositions": [{"proposition": "string", "targetAudience": "string"}],
  "competitiveAdvantages": "string",
  "icpIndustries": ["industry1", "industry2"],
  "icpCompanySize": "string (e.g. 50-500 employees)",
  "icpGeography": "string",
  "icpPainPoints": ["pain1", "pain2"],
  "icpBuyingSignals": ["signal1", "signal2"],
  "fitCriteria": {
    "mustHave": ["criteria1"],
    "niceToHave": ["criteria1"],
    "disqualifiers": ["criteria1"]
  },
  "urgencyTriggers": ["trigger1", "trigger2"],
  "sicCodes": ["code1"],
  "naceCodes": ["code1"]
}`;

  // Gather web context via Serper
  console.log('[Brain] Searching web for context...');
  const [mainSearch, businessSearch, reviewSearch] = await Promise.all([
    serperSearch(`${companyName} ${websiteUrl} products services offering`),
    serperSearch(`${companyName} business B2B customers target market`),
    serperSearch(`${companyName} reviews clients case studies`),
  ]);
  const webContext = `=== Web Search Results ===\n\n${mainSearch}\n\n${businessSearch}\n\n${reviewSearch}`;

  const fullPrompt = prompt + '\n\n' + webContext;

  console.log('[Brain] Calling LLM for analysis...');
  const response = await fetch(FORGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FORGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a B2B sales intelligence analyst. Always return valid JSON only, no markdown, no explanation.' },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log('[Brain] Raw response length:', content.length);

  // Extract JSON from response
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON in response');
    parsed = JSON.parse(match[0]);
  }
  return parsed;
}

async function main() {
  console.log('[Brain] Starting Build4Performance brain creation...');
  
  const result = await researchBrain('https://www.build4performance.com', 'Build4Performance');
  
  console.log('[Brain] Research complete!');
  console.log('[Brain] Summary:', result.offeringSummary);
  console.log('[Brain] ICP Industries:', result.icpIndustries?.slice(0, 5));
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Deactivate existing brains for user 1
  await conn.execute('UPDATE offering_brain SET isActive = 0 WHERE userId = 1');
  
  // Insert new brain
  const [insertResult] = await conn.execute(
    `INSERT INTO offering_brain (
      userId, brainName, companyName, companyWebsite,
      offeringSummary, coreCapabilities, valuePropositions, competitiveAdvantages,
      icpIndustries, icpCompanySize, icpGeography, icpPainPoints, icpBuyingSignals,
      fitCriteria, urgencyTriggers, rawResearchData, status, isActive
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1)`,
    [
      1,
      'Build4Performance - Professional Race Simulators',
      result.companyName || 'Build4Performance',
      'https://www.build4performance.com',
      result.offeringSummary,
      JSON.stringify(result.coreCapabilities || []),
      JSON.stringify(result.valuePropositions || []),
      result.competitiveAdvantages || '',
      JSON.stringify(result.icpIndustries || []),
      result.icpCompanySize || '',
      result.icpGeography || '',
      JSON.stringify(result.icpPainPoints || []),
      JSON.stringify(result.icpBuyingSignals || []),
      JSON.stringify(result.fitCriteria || {}),
      JSON.stringify(result.urgencyTriggers || []),
      JSON.stringify(result),
    ]
  );
  
  const brainId = insertResult.insertId;
  console.log('[Brain] ✓ Saved with ID:', brainId);
  console.log('[Brain] Brain name: Build4Performance - Professional Race Simulators');
  
  await conn.end();
  return { brainId, result };
}

main().then(({ brainId, result }) => {
  console.log('\n=== BRAIN CREATED SUCCESSFULLY ===');
  console.log('Brain ID:', brainId);
  console.log('Company:', result.companyName);
  console.log('Summary:', result.offeringSummary);
  console.log('ICP Industries:', result.icpIndustries);
  console.log('ICP Geography:', result.icpGeography);
  console.log('ICP Size:', result.icpCompanySize);
  console.log('Must-Have Fit Criteria:', result.fitCriteria?.mustHave);
  console.log('Urgency Triggers:', result.urgencyTriggers);
}).catch(e => {
  console.error('[Brain] FAILED:', e.message);
  process.exit(1);
});
