/**
 * LeadTrigger Enrichment Pipeline
 *
 * Pipeline:
 * 1. Select a brain and fetch top N unscored companies
 * 2. For each: ICP Fit Score → Urgency → Conversation Starter → Why Call Today
 * 3. Store results in:
 *    - lt_mns_company_brain_scores (fit + urgency per brain)
 *    - lt_mns_companies (urgency + conversation starter on the company record)
 *
 * Usage: node enrich_run.mjs
 * Config: set BRAIN_ID, BRAIN_NAME, BATCH_SIZE below
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────
const BRAIN_ID = '90002';
const BRAIN_NAME = 'Connect Group EMS Intelligence';
const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 10;

const SUPABASE_URL = 'https://yeowqyeafylynavufueo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inllb3dxeWVhZnlseW5hdnVmdWVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ1NTQ2MSwiZXhwIjoyMDg2MDMxNDYxfQ.64Xmk4XybiUcY4_GuTk6tWK0DiYLCtgU1XTR-1KWFic';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const claude = new Anthropic();

// ─── Load brain context ────────────────────────────────────────────────────
const { data: brain } = await sb.from('lt_mns_offering_brains')
  .select('brain_name, company_name, offering_summary, icp_description, core_capabilities, value_propositions, icp_pain_points, strong_fit_signals, weak_fit_signals, urgency_triggers')
  .eq('id', BRAIN_ID)
  .single();

const brainContext = `
SELLER: ${brain.company_name}
OFFERING: ${brain.offering_summary}
ICP: ${brain.icp_description}
CORE CAPABILITIES: ${brain.core_capabilities}
VALUE PROPOSITIONS: ${brain.value_propositions}
ICP PAIN POINTS: ${brain.icp_pain_points}
STRONG FIT SIGNALS: ${brain.strong_fit_signals}
WEAK FIT SIGNALS: ${brain.weak_fit_signals}
URGENCY TRIGGERS: ${brain.urgency_triggers}
`.trim();

// ─── Get already-scored company IDs ───────────────────────────────────────
const { data: scored } = await sb.from('lt_mns_company_brain_scores')
  .select('company_id')
  .eq('brain_id', BRAIN_ID);
const scoredIds = scored?.map(s => s.company_id) ?? [];

// ─── Get top N unscored companies ─────────────────────────────────────────
const { data: allCompanies, error: coErr } = await sb.from('lt_mns_companies')
  .select('id, company_name, domain, sector, country, city, employee_count, description, profile_text')
  .order('created_at', { ascending: false })
  .limit(BATCH_SIZE * 5);

if (coErr) { console.error('Failed to load companies:', coErr.message); process.exit(1); }

const companies = (allCompanies ?? [])
  .filter(c => !scoredIds.includes(c.id))
  .slice(0, BATCH_SIZE);

console.log(`\nBrain: ${BRAIN_NAME}`);
console.log(`Companies to enrich: ${companies.length}`);
console.log('─'.repeat(60));

// ─── LLM helpers ──────────────────────────────────────────────────────────
async function ask(systemPrompt, userPrompt) {
  const msg = await claude.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });
  return msg.content[0].text.trim();
}

function parseJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

// ─── Process each company ─────────────────────────────────────────────────
const brainScoreRows = [];
const companyUpdateRows = [];

for (let i = 0; i < companies.length; i++) {
  const co = companies[i];
  console.log(`\n[${i + 1}/${companies.length}] ${co.company_name} (${co.country})`);

  const companyContext = `
Company: ${co.company_name}
Domain: ${co.domain}
Sector: ${co.sector}
Location: ${co.city}, ${co.country}
Employees: ${co.employee_count}
Description: ${co.description ?? ''}
Profile: ${co.profile_text ?? ''}
`.trim();

  // Step 1: ICP Fit Score
  process.stdout.write('  → Fit scoring...');
  const fitRaw = await ask(
    'You are a B2B sales qualification analyst. Score the prospect company fit against the seller ICP. Return ONLY valid JSON.',
    `${brainContext}\n\n---\n\nPROSPECT:\n${companyContext}\n\nScore ICP fit 0-100. Return JSON: { "fitScore": number, "fitTier": "A"|"B"|"C"|"D", "fitLabel": string, "fitRationale": string, "keyStrengths": string[], "keyWeaknesses": string[] }`
  );
  const fit = parseJSON(fitRaw) ?? { fitScore: 0, fitTier: 'D', fitLabel: 'Unknown', fitRationale: fitRaw.slice(0, 200) };
  console.log(` ${fit.fitScore}/100 (${fit.fitTier})`);

  // Step 2: Urgency signals
  process.stdout.write('  → Urgency research...');
  const urgencyRaw = await ask(
    'You are a B2B sales intelligence analyst. Detect urgency signals from the company description. Score urgency 0-100. Return ONLY valid JSON.',
    `${brainContext}\n\n---\n\nCOMPANY DATA:\n${companyContext}\n\nAnalyze available data for urgency signals. Return JSON: { "urgencyScore": number, "urgencyLabel": "Hot"|"Warm"|"Cold", "topSignalType": string, "topSignalHeadline": string }`
  );
  const urgency = parseJSON(urgencyRaw) ?? { urgencyScore: 0, urgencyLabel: 'Cold', topSignalType: null, topSignalHeadline: null };
  console.log(` ${urgency.urgencyScore}/100 (${urgency.urgencyLabel})`);

  // Step 3: Conversation starter + Why Call Today
  process.stdout.write('  → Generating outreach...');
  const outreachRaw = await ask(
    'You are a B2B sales expert. Write a personalised conversation starter and a one-sentence "Why Call Today" for a sales rep. Return ONLY valid JSON.',
    `SELLER CONTEXT:\n${brainContext}\n\nPROSPECT:\n${companyContext}\n\nFit: ${fit.fitScore}/100 — ${fit.fitRationale}\nUrgency signal: ${urgency.topSignalHeadline ?? 'none detected'}\n\nReturn JSON: { "conversationStarter": string, "whyCallToday": string }`
  );
  const outreach = parseJSON(outreachRaw) ?? { conversationStarter: null, whyCallToday: null };
  console.log(' done');

  const now = new Date().toISOString();

  // Row for lt_mns_company_brain_scores
  brainScoreRows.push({
    company_id: co.id,
    company_name: co.company_name,
    domain: co.domain,
    brain_id: BRAIN_ID,
    brain_name: BRAIN_NAME,
    fit_score: fit.fitScore,
    fit_tier: fit.fitTier,
    fit_label: fit.fitLabel,
    urgency_score: urgency.urgencyScore,
    urgency_label: urgency.urgencyLabel,
    top_signal_type: urgency.topSignalType,
    top_signal_headline: urgency.topSignalHeadline,
    conversation_starter: outreach.conversationStarter,
    updated_at: now,
  });

  // Row for lt_mns_companies
  companyUpdateRows.push({
    id: co.id,
    urgency_score: urgency.urgencyScore,
    urgency_label: urgency.urgencyLabel,
    top_signal_type: urgency.topSignalType,
    top_signal_headline: urgency.topSignalHeadline,
    conversation_starter: outreach.conversationStarter,
    recommended_approach: outreach.whyCallToday,
    research_status: 'enriched',
    researched_at: now,
    brain_name: BRAIN_NAME,
    updated_at: now,
  });

  await new Promise(r => setTimeout(r, 200));
}

// ─── Store results ────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log('Storing to lt_mns_company_brain_scores...');
const { error: e1 } = await sb.from('lt_mns_company_brain_scores')
  .upsert(brainScoreRows, { onConflict: 'company_id,brain_id' });
if (e1) console.error('Brain scores error:', e1.message);
else console.log(`✓ ${brainScoreRows.length} rows written`);

console.log('Storing to lt_mns_companies...');
for (const row of companyUpdateRows) {
  const { id, ...updates } = row;
  const { error: e2 } = await sb.from('lt_mns_companies').update(updates).eq('id', id);
  if (e2) console.error(`  Error updating ${id}:`, e2.message);
}
console.log(`✓ ${companyUpdateRows.length} company records updated`);

console.log('\nSummary:');
brainScoreRows.forEach((r, i) => {
  const emoji = r.urgency_score >= 70 ? '🔴' : r.urgency_score >= 40 ? '🟡' : '🔵';
  console.log(`${String(i + 1).padStart(2)}  ${r.company_name.padEnd(40)} Fit: ${String(r.fit_score).padStart(3)}/100 (${r.fit_tier})  Urgency: ${String(r.urgency_score).padStart(3)}/100 ${emoji} ${r.urgency_label}`);
});
