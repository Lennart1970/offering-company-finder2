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
import { v5 as uuidv5 } from "uuid";
import { getDb } from "./db";
import { companies, contacts, offeringBrain, searches } from "../drizzle/schema";
import type { InferSelectModel } from "drizzle-orm";

// Deterministic UUID namespace for LeadTrigger entities
const LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/** Convert a local integer ID to a stable UUID for Supabase */
function toUUID(prefix: string, id: number): string {
  return uuidv5(`${prefix}-${id}`, LT_NAMESPACE);
}

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

  // Build rows, then deduplicate by domain to avoid unique constraint violations.
  // When multiple local companies share the same domain (e.g., same company in different campaigns),
  // keep the one with the highest urgency score.
  const allRows = rows.map(({ company, search }: { company: CompanyRow; search: SearchRow | null }) => {
    const brief: BriefData = company.briefData ? JSON.parse(company.briefData) : {};
    const fitData: FitScoreData = company.fitScoreData ? JSON.parse(company.fitScoreData) : {};
    const signals = brief.urgencySignals ?? [];
    const topSignal = signals[0];

    const urgencyLabel =
      (company.urgencyScore ?? 0) >= 70 ? "HIGH" :
      (company.urgencyScore ?? 0) >= 40 ? "MEDIUM" : "LOW";

    // Parse sliceMetadata once
    const slice = company.sliceMetadata ? JSON.parse(company.sliceMetadata) as { employeeBand?: string; employeeCount?: number; industry?: string; description?: string; logoUrl?: string } : {};

    // Build a profile_text from available intelligence
    const profileParts: string[] = [];
    if (brief.whyThisCompanyMatters) profileParts.push(brief.whyThisCompanyMatters);
    if (brief.recommendedApproach) profileParts.push(`Approach: ${brief.recommendedApproach}`);
    const profileText = profileParts.join(' | ') || null;

    return {
      id: toUUID("company", company.id),
      company_name: company.name,
      domain: company.websiteUrl ?? null,
      _urgencyScore: company.urgencyScore ?? 0, // temp field for dedup sorting
      linkedin_url: company.linkedinUrl ?? null,
      twitter_url: company.twitterUrl ?? null,
      facebook_url: company.facebookUrl ?? null,
      phone: company.phone ?? null,
      apollo_id: company.apolloId ?? null,
      country: company.country ?? null,
      city: company.city ?? null,
      company_region: company.state ?? null,
      employee_count: slice.employeeCount ?? null,
      employee_range: slice.employeeBand ?? null,
      annual_revenue_usd: null,
      revenue_range: company.revenue ?? null,
      sector: slice.industry ?? null,
      sub_sector: null,
      industry_description: slice.industry ?? null,
      description: slice.description ?? null,
      profile_text: profileText,
      sic_codes: company.sicCodes ?? null,
      nace_codes: company.naicsCodes ?? null,
      urgency_score: company.urgencyScore ?? null,
      fit_score: company.fitScore ?? null,
      urgency_label: urgencyLabel,
      fit_label: fitData.label ?? null,
      fit_tier: fitData.label ?? null,
      why_this_company_matters: brief.whyThisCompanyMatters ?? null,
      conversation_starter: brief.conversationStarter ?? null,
      recommended_approach: brief.recommendedApproach ?? null,
      top_signal_type: topSignal?.type ?? null,
      top_signal_headline: topSignal?.headline ?? null,
      top_signal_source_url: topSignal?.sourceUrl ?? null,
      brain_name: search?.offeringName ?? null,
      search_name: search?.offeringName ?? null,
      segment_name: null,
      pipeline_stage: "prospect",
      research_status: company.enrichmentStatus ?? "pending",
      has_contacts: false, // updated separately after contacts sync
      contact_count: 0,
      notes: null,
      niche_id: company.nicheId ?? null,
      niche_name: null, // populated by niche clustering — not available here
      dimension_scores: null, // populated by fit scoring engine — not available here
      priority: urgencyLabel, // mirror urgency label as a simple priority indicator
      researched_at: company.briefGeneratedAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
      created_at: company.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  });

  // Deduplicate by domain: keep the row with the highest urgency score per domain
  const domainMap = new Map<string, (typeof allRows)[0]>();
  const noDomainRows: (typeof allRows)[0][] = [];
  for (const row of allRows) {
    if (!row.domain) {
      noDomainRows.push(row);
      continue;
    }
    const existing = domainMap.get(row.domain);
    if (!existing || row._urgencyScore > existing._urgencyScore) {
      domainMap.set(row.domain, row);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const companyRows = [...Array.from(domainMap.values()), ...noDomainRows].map(({ _urgencyScore, ...rest }) => rest);

  // Upsert one-by-one to handle rows that conflict on domain unique constraint
  let synced = 0;
  let errors = 0;
  const BATCH = 50;
  for (let i = 0; i < companyRows.length; i += BATCH) {
    const batch = companyRows.slice(i, i + BATCH);
    const { error } = await (supabase
      .from("lt_mns_companies") as any)
      .upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    if (error) {
      // If batch fails, try one-by-one to isolate the problematic rows
      for (const row of batch) {
        const { error: singleError } = await (supabase
          .from("lt_mns_companies") as any)
          .upsert([row], { onConflict: "id", ignoreDuplicates: false });
        if (singleError) {
          console.error(`[SupabaseSync] Error syncing company ${row.company_name} (${row.domain}):`, singleError.message);
          errors++;
        } else {
          synced++;
        }
      }
    } else {
      synced += batch.length;
    }
  }

  // Now sync signals for these companies
  await syncSignalsForCompanies(supabase, rows.map((r: { company: CompanyRow; search: typeof searches.$inferSelect | null }) => r.company));

  return {
    synced,
    errors,
    message: `Synced ${synced} companies to Supabase${errors > 0 ? ` (${errors} errors)` : ""}`,
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
        id: toUUID("signal", company.id * 100 + idx),
        company_id: toUUID("company", company.id),
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

// ─── Sync company pages (shareable links) ──────────────────────────────────

export async function syncCompanyPagesToSupabase(
  appBaseUrl?: string
): Promise<{ synced: number; errors: number; message: string }> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };

  // Fetch all researched companies with their campaign context
  type SearchRow = typeof searches.$inferSelect;
  const rows = await db
    .select({ company: companies, search: searches, brainName: offeringBrain.brainName })
    .from(companies)
    .leftJoin(searches, eq(companies.searchId, searches.id))
    .leftJoin(offeringBrain, eq(searches.brainId, offeringBrain.id))
    .where(isNotNull(companies.briefData));

  if (rows.length === 0) return { synced: 0, errors: 0, message: "No researched companies found" };

  const pageRows = rows.map(({ company, search, brainName }: { company: CompanyRow; search: SearchRow | null; brainName: string | null }) => {
    const brief: BriefData = company.briefData ? JSON.parse(company.briefData) : {};
    const fitData: FitScoreData = company.fitScoreData ? JSON.parse(company.fitScoreData) : {};
    const urgencyLabel =
      (company.urgencyScore ?? 0) >= 70 ? "HIGH" :
      (company.urgencyScore ?? 0) >= 40 ? "MEDIUM" : "LOW";
    // Store relative path so the URL works on any domain (dev, staging, production)
    const pageUrl = `/company/${company.id}`;

    return {
      id: toUUID("page", company.id),
      company_id: toUUID("company", company.id),
      company_name: company.name,
      domain: company.websiteUrl ?? null,
      campaign_id: company.searchId ?? null,
      campaign_name: search?.offeringName ?? null,
      brain_name: brainName ?? null,
      urgency_score: company.urgencyScore ?? null,
      fit_score: company.fitScore ?? null,
      urgency_label: urgencyLabel,
      fit_label: fitData.label ?? null,
      page_url: pageUrl,
      synced_at: new Date().toISOString(),
      created_at: company.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  });

  // Batch upsert in chunks of 500
  const CHUNK = 500;
  let totalErrors = 0;
  for (let i = 0; i < pageRows.length; i += CHUNK) {
    const chunk = pageRows.slice(i, i + CHUNK);
    const { error } = await (supabase.from("lt_mns_company_pages") as any)
      .upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("[SupabaseSync] Error syncing company pages:", error.message);
      totalErrors += chunk.length;
    }
  }

  return {
    synced: pageRows.length - totalErrors,
    errors: totalErrors,
    message: `Synced ${pageRows.length - totalErrors} company pages to Supabase`,
  };
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
  const countByCompany = new Map<number, number>();
  for (const row of rows) {
    const cid = row.contact.companyId;
    countByCompany.set(cid, (countByCompany.get(cid) ?? 0) + 1);
  }

  for (const [companyId, count] of Array.from(countByCompany.entries())) {
    await supabase
      .from("lt_mns_companies")
      .update({ has_contacts: true, contact_count: count, synced_at: new Date().toISOString() })
      .eq("id", toUUID("company", companyId));
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

// ─── Sync ALL companies to lt_mns_companies ────────────────────────────────

export async function syncAllCompaniesToSupabase(): Promise<{
  synced: number;
  errors: number;
  message: string;
}> {
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };

  // Fetch all researched companies (those with briefData)
  const allCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(isNotNull(companies.briefData));

  if (allCompanies.length === 0) {
    return { synced: 0, errors: 0, message: "No researched companies found" };
  }

  // Batch in chunks of 200 to avoid memory issues
  const CHUNK = 200;
  const ids = allCompanies.map((c: { id: number }) => c.id);
  let totalSynced = 0;
  let totalErrors = 0;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const result = await syncCompaniesToSupabase(chunk);
    totalSynced += result.synced;
    totalErrors += result.errors;
  }

  return {
    synced: totalSynced,
    errors: totalErrors,
    message: `Synced ${totalSynced} companies to lt_mns_companies${totalErrors > 0 ? ` (${totalErrors} errors)` : ""}`,
  };
}

// ─── Get sync stats for lt_mns_companies ────────────────────────────────────

export async function getCompaniesTableSyncStats(): Promise<{
  count: number;
  lastSyncedAt: string | null;
}> {
  try {
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase.from("lt_mns_companies") as any)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("[SupabaseSync] Error getting companies stats:", error.message);
      return { count: 0, lastSyncedAt: null };
    }

    // Get last synced_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastRow } = await (supabase.from("lt_mns_companies") as any)
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .single();

    return {
      count: count ?? 0,
      lastSyncedAt: lastRow?.synced_at ?? null,
    };
  } catch (e) {
    console.error("[SupabaseSync] Error getting companies stats:", e);
    return { count: 0, lastSyncedAt: null };
  }
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

// ─── Pull ALL brains from Supabase → MySQL ───────────────────────────────────
/**
 * Fetches every row from lt_mns_offering_brains in Supabase and upserts them
 * into the local MySQL offering_brain table.
 *
 * Matching strategy (in order):
 *  1. If the Supabase row has a numeric `local_brain_id`, match on that.
 *  2. Otherwise match on `brain_name` (case-insensitive).
 *  3. If no match found, INSERT a new row owned by the owner user (userId = 1).
 */
export async function pullAllBrainsFromSupabase(ownerUserId: number = 1): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { imported: 0, updated: 0, skipped: 0, errors: 0, message: "Database not available" };

  // 1. Fetch all brains from Supabase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remoteBrains, error } = await (supabase.from("lt_mns_offering_brains") as any)
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !remoteBrains) {
    return { imported: 0, updated: 0, skipped: 0, errors: 1, message: error?.message ?? "Failed to fetch from Supabase" };
  }

  // 2. Fetch all local brains for comparison
  const localBrains = await db.select().from(offeringBrain);
  const localById = new Map(localBrains.map((b: BrainRow) => [b.id, b]));
  const localByName = new Map(localBrains.map((b: BrainRow) => [b.brainName?.toLowerCase().trim(), b]));

  const fieldMap: Array<{ remote: string; local: keyof BrainRow }> = [
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

  // show_on_leadtrigger is handled separately below (boolean → tinyint conversion)

  let imported = 0, updated = 0, skipped = 0, errors = 0;

  for (const remote of remoteBrains) {
    try {
      // Build the update/insert payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {};
      for (const { remote: rk, local: lk } of fieldMap) {
        if (remote[rk] !== undefined && remote[rk] !== null) {
          payload[lk] = typeof remote[rk] === "object" ? JSON.stringify(remote[rk]) : remote[rk];
        }
      }
      if (!payload.brainName) { skipped++; continue; } // skip unnamed brains

      // Resolve local match
      const localBrainId = remote.local_brain_id ? Number(remote.local_brain_id) : null;
      let existing: BrainRow | undefined;
      if (localBrainId && localById.has(localBrainId)) {
        existing = localById.get(localBrainId);
      } else {
        existing = localByName.get((payload.brainName as string).toLowerCase().trim());
      }

      // Read show_on_leadtrigger from Supabase if the column exists there,
      // otherwise default to 1 (visible). Supabase stores it as boolean; we store tinyint.
      const remoteShowOnLT = remote.show_on_leadtrigger;
      const showOnLeadtrigger: number =
        remoteShowOnLT === false ? 0 :
        remoteShowOnLT === true  ? 1 :
        remoteShowOnLT === 0     ? 0 :
        remoteShowOnLT === 1     ? 1 : 1; // default visible

      if (existing) {
        // UPDATE existing row — also sync show_on_leadtrigger
        await db.update(offeringBrain)
          .set({ ...payload, showOnLeadtrigger })
          .where(eq(offeringBrain.id, existing.id));
        updated++;
      } else {
        // INSERT new row — owned by the owner, not active by default
        await db.insert(offeringBrain).values({
          userId: ownerUserId,
          brainName: payload.brainName ?? "Unnamed Brain",
          companyName: payload.companyName ?? "",
          companyWebsite: payload.companyWebsite ?? "",
          offeringSummary: payload.offeringSummary,
          coreCapabilities: payload.coreCapabilities,
          valuePropositions: payload.valuePropositions,
          competitiveAdvantages: payload.competitiveAdvantages,
          icpIndustries: payload.icpIndustries,
          icpCompanySize: payload.icpCompanySize,
          icpGeography: payload.icpGeography,
          icpPainPoints: payload.icpPainPoints,
          icpBuyingSignals: payload.icpBuyingSignals,
          fitCriteria: payload.fitCriteria,
          urgencyTriggers: payload.urgencyTriggers,
          sicCodes: payload.sicCodes,
          naceCodes: payload.naceCodes,
          rawResearchData: payload.rawResearchData,
          status: "completed",
          isActive: 0,
          isShared: 1, // make visible to all users
          showOnLeadtrigger, // read from Supabase, default 1
        });
        imported++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[SupabaseSync] Error syncing brain "${remote.brain_name}":`, msg);
      errors++;
    }
  }

  return {
    imported,
    updated,
    skipped,
    errors,
    message: `Pulled ${imported} new + ${updated} updated brains from Supabase (${skipped} skipped, ${errors} errors)`,
  };
}
