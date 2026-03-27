/**
 * Batch Contacts + Sales Rep Profile Generator
 * ─────────────────────────────────────────────
 * Runs as a background task inside the Express process.
 * 
 * Phase 1: Find 1-3 decision makers per company via Apollo trickle-down search
 * Phase 2: Generate sales rep profiles via LLM for all companies
 * 
 * Designed to be idempotent — skips companies that already have contacts/profiles.
 * Respects Apollo rate limits with delays between calls.
 */

import { companies, contacts } from "../drizzle/schema";
import { eq, and, inArray, sql, isNull } from "drizzle-orm";

const CONTACTS_DELAY_MS = 1000;   // 1s between Apollo calls
const REP_DELAY_MS = 500;         // 0.5s between LLM calls
const CONCURRENCY_CONTACTS = 3;   // 3 parallel contact searches
const CONCURRENCY_REPS = 5;       // 5 parallel LLM calls

interface BatchProgress {
  phase: "contacts" | "salesRep" | "done";
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  currentCompany: string | null;
}

let progress: BatchProgress = {
  phase: "contacts",
  total: 0,
  processed: 0,
  skipped: 0,
  failed: 0,
  currentCompany: null,
};

let isRunning = false;

export function getBatchProgress(): BatchProgress & { running: boolean } {
  return { ...progress, running: isRunning };
}

async function findContactsForCompany(
  company: { id: number; name: string | null; primaryDomain: string | null; websiteUrl: string | null },
): Promise<{ found: number; skipped: boolean }> {
  const { getContactsByCompanyId, createContact } = await import("./db");
  
  // Skip if contacts already exist
  const existing = await getContactsByCompanyId(company.id);
  if (existing.length > 0) {
    return { found: 0, skipped: true };
  }

  const domain = (company.primaryDomain || company.websiteUrl || "")
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) {
    return { found: 0, skipped: false };
  }

  const { trickleDownSearch } = await import("./apolloPeopleSearch");
  const result = await trickleDownSearch(domain, company.name || "", 3, false);

  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  let saved = 0;

  for (const contact of result.contacts) {
    const email = contact.email?.toLowerCase();
    const name = contact.name?.toLowerCase();
    if ((email && seenEmails.has(email)) || (name && seenNames.has(name))) continue;
    try {
      await createContact({
        companyId: company.id,
        apolloPersonId: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.name,
        title: contact.title,
        email: contact.email || null,
        phone: contact.phone || null,
        linkedinUrl: contact.linkedinUrl || null,
        searchedTitle: `Tier ${result.tierFound}: ${result.tierLabel}`,
      });
      if (email) seenEmails.add(email);
      if (name) seenNames.add(name);
      saved++;
    } catch { /* duplicate — ignore */ }
  }

  return { found: saved, skipped: false };
}

async function generateSalesRepForCompany(
  companyId: number,
  userId: number,
): Promise<boolean> {
  const { getCompanyById, updateCompany, getActiveBrain } = await import("./db");
  const { invokeLLM } = await import("./_core/llm");

  const company = await getCompanyById(companyId);
  if (!company) return false;

  // Skip if already has a profile
  if (company.salesRepProfile && company.salesRepProfile.trim()) {
    return false; // skipped
  }

  let brainContext = "";
  let sellerName = "ConnectGroup";
  try {
    const brain = await getActiveBrain(userId);
    if (brain && brain.status === "completed") {
      sellerName = brain.companyName || sellerName;
      const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
      const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
      brainContext = `
SELLER: ${brain.companyName}
Offering: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp: any) => vp.proposition).join("; ")}
`;
    }
  } catch (_) { /* use defaults */ }

  const briefData = company.briefData ? (typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData) : null;
  const sliceMeta = company.sliceMetadata ? (() => { try { return JSON.parse(company.sliceMetadata as string); } catch { return {}; } })() : {};
  const companyContext = briefData ? `
COMPANY: ${company.name}
Industry: ${sliceMeta.industry || "unknown"}
Size: ${sliceMeta.employeeBand || "unknown"}
Urgency Score: ${briefData.urgencyScore ?? "unknown"}
Key Signals: ${(briefData.urgencySignals || []).slice(0, 3).map((s: any) => s.description).join("; ")}
Engagement Strategy: ${briefData.engagementStrategy || ""}
` : `
COMPANY: ${company.name}
Industry: ${sliceMeta.industry || "unknown"}
`;

  const prompt = `${brainContext}${companyContext}
You are advising a sales manager at ${sellerName} on which type of sales rep to assign to this account.

Based on the company profile and the seller's offering, describe the IDEAL SALES REP PROFILE for this specific account in 3-4 sentences. Cover:
1. Personality and communication style that would resonate with this company's culture
2. Background or domain knowledge that would build instant credibility
3. One specific trait or skill that would make the difference in winning this account

Be specific to this company — do NOT give generic advice. Write in plain prose, no bullet points, no headers.
Return ONLY the profile description.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a precise B2B sales coaching assistant. Return only the requested text, nothing else." },
      { role: "user", content: prompt },
    ],
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const profile = (typeof rawContent === "string" ? rawContent : "").trim();
  if (!profile) return false;

  await updateCompany(companyId, {
    salesRepProfile: profile,
    salesRepProfileGeneratedAt: new Date(),
  });

  return true; // generated
}

/**
 * Process items in parallel with concurrency limit
 */
async function processInParallel<T>(
  items: T[],
  concurrency: number,
  delayMs: number,
  processor: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      await processor(items[i], i);
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
  });
  await Promise.all(workers);
}

export async function runBatchContactsAndReps(searchIds: number[], userId: number = 1) {
  if (isRunning) {
    console.log("[BatchCR] Already running, skipping");
    return;
  }
  isRunning = true;

  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Get all companies from the specified searches
    const allCompanies = await db
      .select({
        id: companies.id,
        name: companies.name,
        primaryDomain: companies.primaryDomain,
        websiteUrl: companies.websiteUrl,
        salesRepProfile: companies.salesRepProfile,
      })
      .from(companies)
      .where(inArray(companies.searchId, searchIds));

    console.log(`[BatchCR] Starting for ${allCompanies.length} companies across searches ${searchIds.join(", ")}`);

    // ── Phase 1: Find Contacts ──────────────────────────────────────────────
    progress = {
      phase: "contacts",
      total: allCompanies.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      currentCompany: null,
    };

    console.log(`[BatchCR] Phase 1: Finding decision makers (1-3 per company)...`);

    await processInParallel(allCompanies, CONCURRENCY_CONTACTS, CONTACTS_DELAY_MS, async (company, i) => {
      progress.currentCompany = company.name;
      try {
        const result = await findContactsForCompany(company);
        if (result.skipped) {
          progress.skipped++;
          console.log(`[BatchCR] ↩ Contacts cached: ${company.name}`);
        } else if (result.found > 0) {
          progress.processed++;
          console.log(`[BatchCR] ✓ Contacts: ${company.name} → ${result.found} decision makers`);
        } else {
          progress.failed++;
          console.log(`[BatchCR] ✗ No contacts: ${company.name}`);
        }
      } catch (err: any) {
        progress.failed++;
        console.error(`[BatchCR] ✗ Contact error for ${company.name}: ${err.message}`);
      }
    });

    console.log(`[BatchCR] Phase 1 complete: ${progress.processed} found, ${progress.skipped} cached, ${progress.failed} failed`);

    // ── Phase 2: Generate Sales Rep Profiles ────────────────────────────────
    progress = {
      phase: "salesRep",
      total: allCompanies.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      currentCompany: null,
    };

    console.log(`[BatchCR] Phase 2: Generating sales rep profiles...`);

    await processInParallel(allCompanies, CONCURRENCY_REPS, REP_DELAY_MS, async (company, i) => {
      progress.currentCompany = company.name;
      try {
        const generated = await generateSalesRepForCompany(company.id, userId);
        if (generated) {
          progress.processed++;
          console.log(`[BatchCR] ✓ Sales rep: ${company.name}`);
        } else {
          progress.skipped++;
        }
      } catch (err: any) {
        progress.failed++;
        console.error(`[BatchCR] ✗ Sales rep error for ${company.name}: ${err.message}`);
      }
    });

    console.log(`[BatchCR] Phase 2 complete: ${progress.processed} generated, ${progress.skipped} cached, ${progress.failed} failed`);

    progress.phase = "done";
    progress.currentCompany = null;
    console.log(`[BatchCR] ✅ All done!`);

  } catch (err: any) {
    console.error(`[BatchCR] Fatal error:`, err.message);
  } finally {
    isRunning = false;
  }
}
