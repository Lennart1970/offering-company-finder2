/**
 * Brain Re-Embedding Pipeline
 * 
 * Purpose: Regenerate all brain embedding texts using a buyer-characteristics-only prompt
 * that eliminates solution-domain language contamination.
 * 
 * The key insight: Company embeddings describe WHAT a company does/is.
 * Brain embeddings must describe WHAT THE BUYER looks like (observable characteristics),
 * NOT what solution they need. Otherwise, the vector space matches competitors.
 * 
 * Flow:
 * 1. Pull all brain definitions from Supabase
 * 2. For each brain, generate a new content_to_embed using GPT-4o with the new prompt
 * 3. Embed the new text using text-embedding-3-small
 * 4. Update lt_mns_brain_embeddings with new content_to_embed + embedding
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// The new prompt template - buyer-characteristics-only, NO solution language
const SYSTEM_PROMPT = `You are an expert at writing company profile descriptions for vector similarity matching.

Your task: Given a Brain (ICP definition for a seller), write a text that describes what the IDEAL BUYER looks like as if it were a company profile/description. This text will be embedded and compared against company profile embeddings using cosine similarity.

CRITICAL RULES:
1. ONLY describe observable characteristics of the buyer company — what they DO, what industry they're in, what products they make, their size, their market
2. NEVER mention the seller's product, solution, or service
3. NEVER mention what the buyer "needs", "wants", "seeks", or "lacks"
4. NEVER use words like "outsource", "leverage", "transform", "enhance", "optimize"
5. NEVER describe the problem the buyer has or the solution they'd buy
6. Write as if you're writing a company profile entry in a business directory
7. Include explicit NEGATIVE statements about what the buyer is NOT (to push away competitors in vector space)
8. Use the same vocabulary and structure that company descriptions use (sector, location, employee count, what they produce/sell)

FORMAT: Write a single paragraph (150-250 words) that reads like a company profile description. Start with "Name: [type of company]. Sector: [sectors]. Location: [geographies]." to match the company embedding format.

EXAMPLE of what NOT to do (contaminated):
"The ideal customer needs AI solutions to handle complexity... they want to transform their content into dynamic AI assistants..."

EXAMPLE of what TO do (clean):
"Name: Mid-sized publishing company. Sector: publishing, media, education. Location: United States, Canada, UK, Western Europe. A content-rich brand with 11-200 employees that publishes articles, recipes, educational materials, or product catalogs. Operates a large website with hundreds or thousands of pages including articles, PDFs, videos, and FAQ sections. Invests heavily in content marketing, SEO, and editorial production. Revenue primarily comes from advertising, subscriptions, or e-commerce of physical products. NOT a technology company. NOT a SaaS platform. NOT a software developer. NOT a chat or messaging provider. NOT an AI/ML company."`;

const USER_PROMPT_TEMPLATE = `Write a buyer-profile embedding text for this Brain:

Brain Name: {{brain_name}}
Company (seller): {{company_name}}
Offering Summary: {{offering_summary}}
Target Sectors: {{target_sectors}}
ICP Description: {{icp_description}}
Fit Criteria: {{fit_criteria}}
Strong Fit Signals: {{strong_fit_signals}}

Remember: Describe what the BUYER looks like as a company profile. Do NOT mention what they need or what solution they'd buy. Include explicit negatives (what the buyer is NOT).`;

async function generateNewEmbeddingText(brain) {
  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{{brain_name}}', brain.brain_name || '')
    .replace('{{company_name}}', brain.company_name || '')
    .replace('{{offering_summary}}', brain.offering_summary || '')
    .replace('{{target_sectors}}', brain.target_sectors || '')
    .replace('{{icp_description}}', brain.icp_description || '')
    .replace('{{fit_criteria}}', brain.fit_criteria || '')
    .replace('{{strong_fit_signals}}', brain.strong_fit_signals || '');

  // Use the built-in LLM via the Forge API
  const baseUrl = (process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.im').replace(/\/$/, '');
  const url = baseUrl + '/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.BUILT_IN_FORGE_API_KEY
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    })
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.log('  LLM response (raw):', text.substring(0, 300));
    throw new Error('Failed to parse LLM response as JSON');
  }
  if (!data.choices || !data.choices[0]) {
    console.log('  LLM response:', JSON.stringify(data).substring(0, 300));
    throw new Error('No choices in LLM response');
  }
  return data.choices[0].message.content.trim();
}

async function embedText(text) {
  // Use OpenAI API directly (same as embeddingService.ts)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  });

  const respText = await response.text();
  let data;
  try {
    data = JSON.parse(respText);
  } catch (e) {
    console.log('  Embedding response (raw):', respText.substring(0, 200));
    throw new Error('Failed to parse embedding response');
  }
  if (!data.data || !data.data[0]) {
    console.log('  Embedding response:', JSON.stringify(data).substring(0, 200));
    throw new Error('No embedding data in response');
  }
  return data.data[0].embedding;
}

async function main() {
  const mode = process.argv[2] || 'test'; // 'test' = InsertChat only, 'all' = all brains
  
  // Pull all brain definitions
  const { data: brains } = await sb
    .from('lt_mns_offering_brains')
    .select('id, brain_name, company_name, offering_summary, target_sectors, icp_description, fit_criteria, urgency_triggers, strong_fit_signals')
    .order('id');

  let brainsToProcess = brains;
  if (mode === 'test') {
    brainsToProcess = brains.filter(b => b.id === 'insertchat-branded-ai');
    console.log('TEST MODE: Processing InsertChat only');
  } else {
    console.log('FULL MODE: Processing all ' + brains.length + ' brains');
  }

  const results = [];

  for (const brain of brainsToProcess) {
    console.log('\n--- Processing: ' + brain.brain_name + ' (id: ' + brain.id + ') ---');
    
    // Step 1: Generate new embedding text
    console.log('  Generating new embedding text...');
    const newText = await generateNewEmbeddingText(brain);
    console.log('  New text (' + newText.length + ' chars): ' + newText.substring(0, 100) + '...');
    
    // Step 2: Embed it
    console.log('  Embedding...');
    const embedding = await embedText(newText);
    console.log('  Got embedding (' + embedding.length + ' dimensions)');
    
    // Step 3: Update Supabase
    console.log('  Updating Supabase...');
    const { error } = await sb
      .from('lt_mns_brain_embeddings')
      .update({
        content_to_embed: newText,
        embedding: embedding
      })
      .eq('brain_id', brain.id);
    
    if (error) {
      console.log('  ERROR: ' + error.message);
    } else {
      console.log('  SUCCESS');
    }

    results.push({
      brain_id: brain.id,
      brain_name: brain.brain_name,
      new_text: newText,
      embedding_dims: embedding.length,
      success: !error
    });
  }

  // Save results
  fs.writeFileSync('/home/ubuntu/reembed_results.json', JSON.stringify(results, null, 2));
  console.log('\n\nDone! Results saved to /home/ubuntu/reembed_results.json');
}

main().catch(console.error);
