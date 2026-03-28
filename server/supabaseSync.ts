/**
 * Supabase Sync Service
 *
 * Pushes LeadTrigger intelligence data (companies, signals, contacts, brains)
 * to a Supabase PostgreSQL database for natural language querying via InsertChat.
 *
 * Architecture:
 * - One-directional: LeadTrigger (TiDB) → Supabase (read-only replica)
 * - Uses UPSERT on primary key — safe to run multiple times
 * - Never syncs user accounts, session tokens, or internal job state
 * - Supabase is accessed with the service role key (server-side only)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "./db";
import { companies, contacts, offeringBrain, searches } from "../drizzle/schema";
import type { InferSelectModel } from "drizzle-orm";

type CompanyRow = InferSelectModel<typeof companies>;
type ContactRow = InferSelectModel<typeof contacts>;
type BrainRow = InferSelectModel<typeof offeringBrain>;
import { eq, inArray, isNotNull, gte } from "drizzle-orm";

// ─── Supabase client (service role — server-side only) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseClient(): SupabaseClient<any> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ─── Type helpers ───────────────────────────────────────────────────────────

interface BriefData {
  urgencySignals?: Array<{
    type?: string;
    headline?: string;
    snippet?: string;
    sourceUrl?: string;
    sourceName?: string;
    date?: string;
    urgencyContribution?: number;
  }>;
  whyThisCompanyMatters?: string;
  conversationStarter?: string;
  recommendedApproach?: string;
}

interface FitScoreData {
  label?: string;
}

// ─── Sync a batch of companies ──────────────────────────────────────────────

export async function syncCompaniesToSupabase(companyIds: number[]): Promise<{
  synced: number;
  errors: number;
  message: string;
}> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };

  // Fetch companies with their search context
  type SearchRow = typeof searches.$inferSelect;
  const rows = await db
    .select({
      company: companies,
      search: searches,
    })
    .from(companies)
    .leftJoin(searches, eq(companies.searchId, searches.id))
    .where(inArray(companies.id, companyIds));

  if (rows.length === 0) return { synced: 0, errors: 0, message: "No companies found" };

  const companyRows = rows.map(({ company, search }: { company: CompanyRow; search: SearchRow | null }) => {
    const brief: BriefData = company.briefData ? JSON.parse(company.briefData) : {};
    const fitData: FitScoreData = company.fitScoreData ? JSON.parse(company.fitScoreData) : {};
    const signals = brief.urgencySignals ?? [];
    const topSignal = signals[0];

    const urgencyLabel =
      (company.urgencyScore ?? 0) >= 70 ? "HIGH" :
      (company.urgencyScore ?? 0) >= 40 ? "MEDIUM" : "LOW";

    return {
      id: String(company.id),
      name: company.name,
      domain: company.websiteUrl ?? null,
      linkedin_url: company.linkedinUrl ?? null,
      apollo_id: company.apolloId ?? null,
      company_country: company.country ?? null,
      company_city: company.city ?? null,
      company_region: null,
      employee_count: null,
      employee_range: company.sliceMetadata ? (JSON.parse(company.sliceMetadata) as { employeeBand?: string }).employeeBand ?? null : null,
      annual_revenue_usd: null,
      revenue_range: company.revenue ?? null,
      primary_sector: company.sliceMetadata ? (JSON.parse(company.sliceMetadata) as { industry?: string }).industry ?? null : null,
      industry_description: company.sliceMetadata ? (JSON.parse(company.sliceMetadata) as { industry?: string }).industry ?? null : null,
      sic_codes: company.sicCodes ?? null,
      nace_codes: null,
      urgency_score: company.urgencyScore ?? null,
      fit_score: company.fitScore ?? null,
      urgency_label: urgencyLabel,
      fit_label: fitData.label ?? null,
      why_this_company_matters: brief.whyThisCompanyMatters ?? null,
      conversation_starter: brief.conversationStarter ?? null,
      recommended_approach: brief.recommendedApproach ?? null,
      top_signal_type: topSignal?.type ?? null,
      top_signal_headline: topSignal?.headline ?? null,
      top_signal_source_url: topSignal?.sourceUrl ?? null,
      brain_name: null,
      search_name: search?.offeringName ?? null,
      segment_name: null,
      research_status: company.enrichmentStatus ?? "pending",
      has_contacts: false, // updated separately after contacts sync
      contact_count: 0,
      researched_at: company.briefGeneratedAt?.toISOString() ?? null,
      synced_at: new Date().toISOString(),
      created_at: company.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  });

  const { error } = await (supabase
    .from("lt_mns_prospect_companies") as any)
    .upsert(companyRows, { onConflict: "id" });

  if (error) {
    console.error("[SupabaseSync] Error syncing companies:", error.message);
    return { synced: 0, errors: companyRows.length, message: error.message };
  }

  // Now sync signals for these companies
  await syncSignalsForCompanies(supabase, rows.map((r: { company: CompanyRow; search: typeof searches.$inferSelect | null }) => r.company));

  return {
    synced: companyRows.length,
    errors: 0,
    message: `Synced ${companyRows.length} companies to Supabase`,
  };
}

// ─── Sync urgency signals ────────────────────────────────────────────────────

async function syncSignalsForCompanies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  companyList: (typeof companies.$inferSelect)[]
) {
  const signalRows: object[] = [];

  for (const company of companyList) {
    if (!company.briefData) continue;
    const brief: BriefData = JSON.parse(company.briefData);
    const signals = brief.urgencySignals ?? [];

    signals.slice(0, 3).forEach((signal, idx) => {
      signalRows.push({
        id: `${company.id}-signal-${idx + 1}`,
        company_id: String(company.id),
        company_name: company.name,
        company_domain: company.websiteUrl ?? null,
        signal_type: signal.type ?? null,
        signal_headline: signal.headline ?? null,
        signal_snippet: signal.snippet ?? null,
        source_url: signal.sourceUrl ?? null,
        source_name: signal.sourceName ?? null,
        signal_date: signal.date ?? null,
        signal_rank: idx + 1,
        urgency_contribution: signal.urgencyContribution ?? null,
        synced_at: new Date().toISOString(),
      });
    });
  }

  if (signalRows.length === 0) return;

  const { error } = await (supabase
    .from("lt_mns_prospect_signals") as any)
    .upsert(signalRows, { onConflict: "id" });

  if (error) {
    console.error("[SupabaseSync] Error syncing signals:", error.message);
  }
}

// ─── Sync contacts for companies ─────────────────────────────────────────────

export async function syncContactsToSupabase(companyIds: number[]): Promise<{
  synced: number;
  errors: number;
  message: string;
}> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };

  const rows = await db
    .select({
      contact: contacts,
      company: companies,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(inArray(contacts.companyId, companyIds));

  if (rows.length === 0) return { synced: 0, errors: 0, message: "No contacts found" };

  const contactRows = rows.map(({ contact, company }: { contact: ContactRow; company: CompanyRow | null }) => ({
    id: String(contact.id),
    company_id: String(contact.companyId),
    company_name: company?.name ?? "",
    company_domain: company?.websiteUrl ?? null,
    company_country: company?.country ?? null,
    full_name: contact.fullName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
    first_name: contact.firstName ?? null,
    last_name: contact.lastName ?? null,
    job_title: contact.title ?? null,
    seniority_level: null, // Apollo doesn't return this in our current schema
    department: null,
    email: contact.email ?? null,
    email_confidence: null,
    linkedin_url: contact.linkedinUrl ?? null,
    phone: contact.phone ?? null,
    apollo_id: contact.apolloPersonId ?? null,
    why_contact_this_person: contact.searchedTitle
      ? `Identified as ${contact.searchedTitle} via Apollo trickle-down search`
      : null,
    synced_at: new Date().toISOString(),
    created_at: contact.createdAt?.toISOString() ?? new Date().toISOString(),
  }));

  const { error } = await (supabase
    .from("lt_mns_prospect_contacts") as any)
    .upsert(contactRows, { onConflict: "id" });

  if (error) {
    console.error("[SupabaseSync] Error syncing contacts:", error.message);
    return { synced: 0, errors: contactRows.length, message: error.message };
  }

  // Update has_contacts and contact_count on prospect_companies
  const countByCompany = new Map<string, number>();
  for (const row of rows) {
    const cid = String(row.contact.companyId);
    countByCompany.set(cid, (countByCompany.get(cid) ?? 0) + 1);
  }

  for (const [companyId, count] of Array.from(countByCompany.entries())) {
    await supabase
      .from("lt_mns_prospect_companies")
      .update({ has_contacts: true, contact_count: count, synced_at: new Date().toISOString() })
      .eq("id", companyId);
  }

  return {
    synced: contactRows.length,
    errors: 0,
    message: `Synced ${contactRows.length} contacts to Supabase`,
  };
}

// ─── Map a local brain row to the Supabase column shape ─────────────────────

function mapBrainToSupabaseRow(brain: BrainRow) {
  return {
    id: String(brain.id),
    brain_name: brain.brainName,
    company_name: brain.companyName ?? null,
    company_website: brain.companyWebsite ?? null,
    offering_summary: brain.offeringSummary ?? null,
    core_capabilities: brain.coreCapabilities ?? null,
    competitive_advantages: brain.competitiveAdvantages ?? null,
    target_sectors: brain.icpIndustries ?? null,
    icp_description: brain.icpCompanySize ?? null,
    icp_geography: brain.icpGeography ?? null,
    icp_pain_points: brain.icpPainPoints ?? null,
    value_propositions: brain.valuePropositions ?? null,
    strong_fit_signals: brain.icpBuyingSignals ?? null,
    fit_criteria: brain.fitCriteria ?? null,
    urgency_triggers: brain.urgencyTriggers ?? null,
    sic_codes: brain.sicCodes ?? null,
    nace_codes: brain.naceCodes ?? null,
    raw_research_data: brain.rawResearchData ?? null,
    weak_fit_signals: null,
    dream_clients: null,
    status: brain.status ?? "completed",
    is_active: brain.isActive === 1,
    local_brain_id: brain.id,
    updated_at: brain.updatedAt?.toISOString() ?? new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

// ─── Sync ALL offering brains ───────────────────────────────────────────────

export async function syncBrainsToSupabase(): Promise<{
  synced: number;
  errors: number;
  message: string;
}> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };

  const brains = await db.select().from(offeringBrain);
  if (brains.length === 0) return { synced: 0, errors: 0, message: "No brains found" };

  const brainRows = brains.map((brain: BrainRow) => mapBrainToSupabaseRow(brain));

  const { error } = await (supabase
    .from("lt_mns_offering_brains") as any)
    .upsert(brainRows, { onConflict: "id" });

  if (error) {
    console.error("[SupabaseSync] Error syncing brains:", error.message);
    return { synced: 0, errors: brainRows.length, message: error.message };
  }

  return {
    synced: brainRows.length,
    errors: 0,
    message: `Synced ${brainRows.length} brains to Supabase`,
  };
}

// ─── Push a SINGLE brain to Supabase ────────────────────────────────────────

export async function pushSingleBrainToSupabase(brainId: number): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { success: false, message: "Database not available" };

  const [brain] = await db.select().from(offeringBrain).where(eq(offeringBrain.id, brainId));
  if (!brain) return { success: false, message: `Brain ${brainId} not found` };

  const row = mapBrainToSupabaseRow(brain);

  const { error } = await (supabase
    .from("lt_mns_offering_brains") as any)
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error("[SupabaseSync] Error pushing brain:", error.message);
    return { success: false, message: error.message };
  }

  return {
    success: true,
    message: `Pushed "${brain.brainName}" to Supabase (${Object.keys(row).length} fields)`,
  };
}

// ─── Pull a SINGLE brain FROM Supabase ──────────────────────────────────────

export async function pullSingleBrainFromSupabase(brainId: number): Promise<{
  success: boolean;
  message: string;
  updatedFields?: string[];
}> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { success: false, message: "Database not available" };

  // Fetch the remote row
  const { data, error } = await (supabase
    .from("lt_mns_offering_brains") as any)
    .select("*")
    .eq("id", String(brainId))
    .single();

  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? `Brain ${brainId} not found in Supabase`,
    };
  }

  // Map Supabase snake_case back to local camelCase
  const updatedFields: string[] = [];
  const updates: Record<string, unknown> = {};

  const fieldMap: Array<{ remote: string; local: string }> = [
    { remote: "brain_name", local: "brainName" },
    { remote: "company_name", local: "companyName" },
    { remote: "company_website", local: "companyWebsite" },
    { remote: "offering_summary", local: "offeringSummary" },
    { remote: "core_capabilities", local: "coreCapabilities" },
    { remote: "competitive_advantages", local: "competitiveAdvantages" },
    { remote: "target_sectors", local: "icpIndustries" },
    { remote: "icp_description", local: "icpCompanySize" },
    { remote: "icp_geography", local: "icpGeography" },
    { remote: "icp_pain_points", local: "icpPainPoints" },
    { remote: "value_propositions", local: "valuePropositions" },
    { remote: "strong_fit_signals", local: "icpBuyingSignals" },
    { remote: "fit_criteria", local: "fitCriteria" },
    { remote: "urgency_triggers", local: "urgencyTriggers" },
    { remote: "sic_codes", local: "sicCodes" },
    { remote: "nace_codes", local: "naceCodes" },
    { remote: "raw_research_data", local: "rawResearchData" },
  ];

  for (const { remote, local } of fieldMap) {
    if (data[remote] !== undefined && data[remote] !== null) {
      updates[local] = data[remote];
      updatedFields.push(local);
    }
  }

  if (updatedFields.length === 0) {
    return { success: true, message: "No fields to update from Supabase", updatedFields: [] };
  }

  await db
    .update(offeringBrain)
    .set(updates)
    .where(eq(offeringBrain.id, brainId));

  return {
    success: true,
    message: `Pulled ${updatedFields.length} fields from Supabase into "${data.brain_name}"`,
    updatedFields,
  };
}

// ─── Full sync for a search run ──────────────────────────────────────────────

export async function syncSearchRunToSupabase(searchId: number): Promise<{
  companiesSynced: number;
  contactsSynced: number;
  errors: number;
  message: string;
}> {
  // Get all researched companies in this search
  const db = await getDb();
  if (!db) return { companiesSynced: 0, contactsSynced: 0, errors: 0, message: "Database not available" };

  const searchCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.searchId, searchId));

  if (searchCompanies.length === 0) {
    return { companiesSynced: 0, contactsSynced: 0, errors: 0, message: "No companies in search" };
  }

  const ids = searchCompanies.map((c: { id: number }) => c.id);

  const companyResult = await syncCompaniesToSupabase(ids);
  const contactResult = await syncContactsToSupabase(ids);

  return {
    companiesSynced: companyResult.synced,
    contactsSynced: contactResult.synced,
    errors: companyResult.errors + contactResult.errors,
    message: `Search ${searchId}: ${companyResult.synced} companies, ${contactResult.synced} contacts synced`,
  };
}
