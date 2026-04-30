import { eq, and, or, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, salesPackages, InsertSalesPackage, companyDecisions, InsertCompanyDecision, excludedCodes, InsertExcludedCode, companies, Company, InsertCompany, searches, Search, InsertSearch, contacts, Contact, InsertContact, niches, Niche, InsertNiche, batchJobs, BatchJob, InsertBatchJob, bomCalculations, BomCalculation, InsertBomCalculation, apolloWebhookLogs, ApolloWebhookLog, InsertApolloWebhookLog, companyBrainOutputs, CompanyBrainOutput, InsertCompanyBrainOutput, offeringBrain } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // Only set role=admin on INSERT (new user). Never overwrite an existing role
      // on UPDATE — this prevents super_admin from being downgraded on every login.
      values.role = 'admin';
      // Intentionally NOT added to updateSet so existing role is preserved on duplicate
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Search operations
export async function createSearch(search: InsertSearch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(searches).values(search);
  return result[0].insertId;
}

export async function updateSearch(id: number, updates: Partial<InsertSearch>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(searches).set(updates).where(eq(searches.id, id));
}

export async function getSearchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(searches).where(eq(searches.id, id)).limit(1);
  return result[0];
}

export async function getUserSearches(userId: number, showArchived = false) {
  const db = await getDb();
  if (!db) return [];
  
  const baseCondition = or(
    eq(searches.userId, userId),
    eq(searches.sharedWithTeam, 1)
  );
  const archiveCondition = showArchived ? undefined : eq(searches.isArchived, 0);
  const whereClause = archiveCondition ? and(baseCondition, archiveCondition) : baseCondition;
  
  const rows = await db
    .select({ search: searches, brainName: offeringBrain.brainName, userName: users.name, userEmail: users.email })
    .from(searches)
    .leftJoin(offeringBrain, eq(searches.brainId, offeringBrain.id))
    .leftJoin(users, eq(searches.userId, users.id))
    .where(whereClause)
    .orderBy(desc(searches.createdAt));

  return rows.map(r => ({ ...r.search, brainName: r.brainName ?? null, userName: r.userName ?? null, userEmail: r.userEmail ?? null }));
}

export async function archiveSearch(searchId: number, userId: number, archive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(searches)
    .set({ isArchived: archive ? 1 : 0 })
    .where(eq(searches.id, searchId));
}

export async function toggleShareSearch(searchId: number, ownerId: number, shared: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(searches)
    .set({ sharedWithTeam: shared ? 1 : 0 })
    .where(and(eq(searches.id, searchId), eq(searches.userId, ownerId)));
}

export async function getPreviousOffering(userId: number, websiteUrl: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(searches)
    .where(and(
      eq(searches.userId, userId),
      eq(searches.companyWebsite, websiteUrl)
    ))
    .orderBy(desc(searches.createdAt))
    .limit(1);
  
  return result[0];
}

// Company operations
export async function createCompanies(companyList: InsertCompany[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (companyList.length === 0) return;
  await db.insert(companies).values(companyList);
}

export async function getCompaniesBySearchId(searchId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(companies).where(eq(companies.searchId, searchId));
}

export async function getCompaniesBySearchIdPaged(searchId: number, limit = 100, offset = 0) {
  const { desc } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  // Exclude large text blobs (briefData, salesApproachData, fitScoreData, productImages,
  // urgencyImages, salesRepProfile, signalOpeners, callReadinessSummary, rawAddress,
  // sicCodes, naicsCodes, sliceMetadata) from the list query — they are only needed
  // when opening an individual company card and are fetched via getCompanyById.
  return db.select({
    id: companies.id,
    searchId: companies.searchId,
    apolloId: companies.apolloId,
    name: companies.name,
    websiteUrl: companies.websiteUrl,
    primaryDomain: companies.primaryDomain,
    linkedinUrl: companies.linkedinUrl,
    twitterUrl: companies.twitterUrl,
    facebookUrl: companies.facebookUrl,
    phone: companies.phone,
    foundedYear: companies.foundedYear,
    revenue: companies.revenue,
    headcountGrowth: companies.headcountGrowth,
    parentCompanyName: companies.parentCompanyName,
    parentCompanyId: companies.parentCompanyId,
    searchLocation: companies.searchLocation,
    city: companies.city,
    state: companies.state,
    country: companies.country,
    streetAddress: companies.streetAddress,
    sourceCountryCode: companies.sourceCountryCode,
    urgencyScore: companies.urgencyScore,
    fitScore: companies.fitScore,
    briefGeneratedAt: companies.briefGeneratedAt,
    salesApproachGeneratedAt: companies.salesApproachGeneratedAt,
    salesRepProfileGeneratedAt: companies.salesRepProfileGeneratedAt,
    signalOpenersGeneratedAt: companies.signalOpenersGeneratedAt,
    enrichmentStatus: companies.enrichmentStatus,
    generatedWithBrainId: companies.generatedWithBrainId,
    generatedWithBrainName: companies.generatedWithBrainName,
    nicheId: companies.nicheId,
    createdAt: companies.createdAt,
    // Needed for NAICS/SIC filtering and display in list view
    sicCodes: companies.sicCodes,
    naicsCodes: companies.naicsCodes,
    sliceMetadata: companies.sliceMetadata,
    // Presence flags — kept as small booleans would be ideal but the
    // existing frontend code reads these fields directly; keeping them
    // in the list query avoids a cascade of frontend changes.
    // briefData and salesApproachData are intentionally excluded from the list
    // query to keep the payload small (~200KB vs 8MB). The quick-view modal
    // and company detail pages fetch them on demand via getCompany.
  }).from(companies)
    .where(eq(companies.searchId, searchId))
    .orderBy(desc(companies.fitScore), desc(companies.urgencyScore))
    .limit(limit)
    .offset(offset);
}

export async function countCompaniesBySearchId(searchId: number) {
  const { count } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count() }).from(companies).where(eq(companies.searchId, searchId));
  return result[0]?.total ?? 0;
}

export async function getCompaniesByNicheId(nicheId: number, limit = 500, offset = 0) {
  const { and } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    id: companies.id,
    name: companies.name,
    websiteUrl: companies.websiteUrl,
    primaryDomain: companies.primaryDomain,
    country: companies.country,
    city: companies.city,
    revenue: companies.revenue,
    enrichmentStatus: companies.enrichmentStatus,
    fitScore: companies.fitScore,
    urgencyScore: companies.urgencyScore,
    nicheId: companies.nicheId,
    searchId: companies.searchId,
    createdAt: companies.createdAt,
  }).from(companies).where(eq(companies.nicheId, nicheId)).limit(limit).offset(offset);
}

export async function countCompaniesByNicheId(nicheId: number) {
  const { count } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ total: count() }).from(companies).where(eq(companies.nicheId, nicheId));
  return result[0]?.total ?? 0;
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function updateCompany(id: number, updates: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(companies).set(updates).where(eq(companies.id, id));
}

export async function getPendingCompaniesBySearchId(searchId: number) {
  const { and } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(companies).where(
    and(eq(companies.searchId, searchId), eq(companies.enrichmentStatus, "pending"))
  );
}

// Sales Package helpers
export async function createSalesPackage(pkg: InsertSalesPackage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(salesPackages).values(pkg);
  return result[0].insertId;
}

export async function getSalesPackageByCompanyId(companyId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select().from(salesPackages).where(eq(salesPackages.companyId, companyId)).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function updateSalesPackage(id: number, updates: Partial<InsertSalesPackage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(salesPackages).set(updates).where(eq(salesPackages.id, id));
}

// HITL Training: Company Decisions
export async function createCompanyDecision(decision: InsertCompanyDecision) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(companyDecisions).values(decision);
  return result[0].insertId;
}

export async function getCompanyDecision(companyId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(companyDecisions)
    .where(and(
      eq(companyDecisions.companyId, companyId),
      eq(companyDecisions.userId, userId)
    ))
    .orderBy(desc(companyDecisions.decidedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getDecisionsBySearch(searchId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(companyDecisions)
    .where(eq(companyDecisions.searchId, searchId))
    .orderBy(desc(companyDecisions.decidedAt));
}

// HITL Training: Excluded Codes
export async function addExcludedCode(code: InsertExcludedCode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if code already exists for this user
  const existing = await db.select().from(excludedCodes)
    .where(and(
      eq(excludedCodes.userId, code.userId),
      eq(excludedCodes.codeType, code.codeType),
      eq(excludedCodes.code, code.code)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Increment rejection count
    await db.update(excludedCodes)
      .set({
        rejectionCount: existing[0].rejectionCount + 1,
        lastRejectedAt: new Date(),
      })
      .where(eq(excludedCodes.id, existing[0].id));
    return existing[0].id;
  } else {
    // Insert new excluded code
    const result = await db.insert(excludedCodes).values(code);
    return result[0].insertId;
  }
}

export async function getExcludedCodes(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(excludedCodes)
    .where(eq(excludedCodes.userId, userId))
    .orderBy(desc(excludedCodes.rejectionCount));
}

export async function removeExcludedCode(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(excludedCodes)
    .where(and(
      eq(excludedCodes.id, id),
      eq(excludedCodes.userId, userId)
    ));
}

// ============================================================================
// Contact Functions
// ============================================================================

export async function createContact(contact: InsertContact): Promise<Contact> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(contacts).values(contact);
  const [created] = await db.select().from(contacts)
    .where(eq(contacts.id, inserted.insertId));
  return created;
}

export async function getContactByCompanyId(companyId: number): Promise<Contact | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [contact] = await db.select().from(contacts)
    .where(eq(contacts.companyId, companyId))
    .orderBy(desc(contacts.createdAt))
    .limit(1);
  return contact || null;
}

// ============================================================================
// Call Today View
// ============================================================================

export async function getCallTodayCompanies(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all companies marked as "CALL TODAY" by this user (without contacts to avoid duplicates)
  const decisions = await db.select({
    company: companies,
    decision: companyDecisions,
  })
    .from(companyDecisions)
    .innerJoin(companies, eq(companyDecisions.companyId, companies.id))
    .where(and(
      eq(companyDecisions.userId, userId),
      eq(companyDecisions.decision, "call_today")
    ))
    .orderBy(desc(companyDecisions.decidedAt));
  
  // Deduplicate by company ID (in case multiple decisions exist)
  const uniqueCompanies = new Map();
  for (const row of decisions) {
    if (!uniqueCompanies.has(row.company.id)) {
      uniqueCompanies.set(row.company.id, row);
    }
  }
  
  return Array.from(uniqueCompanies.values());
}

// ============================================================================
// Offering Brain Functions
// ============================================================================

import { OfferingBrain, InsertOfferingBrain } from "../drizzle/schema";

export async function createOfferingBrain(brain: InsertOfferingBrain): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Deactivate any existing active brains for this user
  await db.update(offeringBrain)
    .set({ isActive: 0 })
    .where(and(
      eq(offeringBrain.userId, brain.userId),
      eq(offeringBrain.isActive, 1)
    ));
  
  const [inserted] = await db.insert(offeringBrain).values(brain);
  return inserted.insertId;
}

export async function getActiveBrain(userId: number): Promise<OfferingBrain | null> {
  const db = await getDb();
  if (!db) return null;

  // Fetch ALL active brains: own brains OR shared brains from others, filtered to show_on_leadtrigger = 1
  const activeBrains = await db.select().from(offeringBrain)
    .where(and(
      or(
        eq(offeringBrain.userId, userId),
        eq(offeringBrain.isShared, 1)
      ),
      eq(offeringBrain.isActive, 1),
      eq(offeringBrain.showOnLeadtrigger, 1)
    ))
    .orderBy(desc(offeringBrain.updatedAt));

  if (activeBrains.length === 0) return null;

  // Self-healing guard: if more than one active brain exists, keep the most
  // recently updated one and deactivate all others.
  if (activeBrains.length > 1) {
    const keepId = activeBrains[0].id;
    // Deactivate all active brains for this user, then re-activate the winner
    await db.update(offeringBrain)
      .set({ isActive: 0 })
      .where(and(eq(offeringBrain.userId, userId), eq(offeringBrain.isActive, 1)));
    await db.update(offeringBrain)
      .set({ isActive: 1 })
      .where(eq(offeringBrain.id, keepId));
    console.warn(`[Brain] Self-healing: found ${activeBrains.length} active brains for user ${userId}. Kept brain ${keepId}, deactivated the rest.`);
  }

  return activeBrains[0];
}

export async function updateOfferingBrain(id: number, updates: Partial<InsertOfferingBrain>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(offeringBrain).set(updates).where(eq(offeringBrain.id, id));
}

export async function getBrainHistory(userId: number): Promise<OfferingBrain[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Return own brains + shared brains from others, filtered to show_on_leadtrigger = 1
  return db.select().from(offeringBrain)
    .where(and(
      or(
        eq(offeringBrain.userId, userId),
        eq(offeringBrain.isShared, 1)
      ),
      eq(offeringBrain.showOnLeadtrigger, 1)
    ))
    .orderBy(desc(offeringBrain.createdAt));
}

export async function setOfferingBrainActive(brainId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verify brain belongs to user OR is shared
  const [brain] = await db.select().from(offeringBrain)
    .where(and(
      eq(offeringBrain.id, brainId),
      or(
        eq(offeringBrain.userId, userId),
        eq(offeringBrain.isShared, 1)
      )
    ))
    .limit(1);
  
  if (!brain) {
    throw new Error("Brain not found or access denied");
  }
  
  // Deactivate all brains for this user
  await db.update(offeringBrain)
    .set({ isActive: 0 })
    .where(eq(offeringBrain.userId, userId));
  
  // Activate selected brain
  await db.update(offeringBrain)
    .set({ isActive: 1 })
    .where(eq(offeringBrain.id, brainId));
}

export async function deleteOfferingBrain(brainId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verify brain belongs to user
  const [brain] = await db.select().from(offeringBrain)
    .where(and(
      eq(offeringBrain.id, brainId),
      eq(offeringBrain.userId, userId)
    ))
    .limit(1);
  
  if (!brain) {
    throw new Error("Brain not found or does not belong to user");
  }
  
  // Prevent deletion of active brain
  if (brain.isActive === 1) {
    throw new Error("Cannot delete active brain. Please activate another brain first.");
  }
  
  // Delete brain
  await db.delete(offeringBrain).where(eq(offeringBrain.id, brainId));
}

export async function getOfferingBrainById(brainId: number, userId: number): Promise<OfferingBrain | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Allow access to own brains OR shared brains
  const [brain] = await db.select().from(offeringBrain)
    .where(and(
      eq(offeringBrain.id, brainId),
      or(
        eq(offeringBrain.userId, userId),
        eq(offeringBrain.isShared, 1)
      )
    ))
    .limit(1);
  
  return brain || null;
}

export async function getContactsByCompanyId(companyId: number): Promise<Contact[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(contacts)
    .where(eq(contacts.companyId, companyId))
    .orderBy(desc(contacts.createdAt));
}

export async function getContactById(contactId: number): Promise<Contact | null> {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Find a contact by Apollo person ID (used by webhook callback to match the contact).
 */
export async function getContactByApolloPersonId(apolloPersonId: string): Promise<Contact | null> {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(contacts)
    .where(eq(contacts.apolloPersonId, apolloPersonId))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Update a contact's phone number and clear the phonePending flag.
 * Called when Apollo delivers the async webhook callback.
 */
export async function updateContactPhone(contactId: number, phone: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts)
    .set({ phone, phonePending: 0 })
    .where(eq(contacts.id, contactId));
}

/**
 * Set phonePending flag on a contact (1 = waiting for Apollo webhook).
 */
export async function setContactPhonePending(contactId: number, pending: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts)
    .set({ phonePending: pending ? 1 : 0 })
    .where(eq(contacts.id, contactId));
}

// ============================================================================
// Niche Helpers
// ============================================================================

export async function createNiche(niche: InsertNiche): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(niches).values(niche);
  return result[0].insertId;
}

export async function getNichesBySearchId(searchId: number): Promise<Niche[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(niches)
    .where(eq(niches.searchId, searchId))
    .orderBy(desc(niches.fitScore));
}

export async function getNichesByUserId(userId: number): Promise<Niche[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(niches)
    .where(eq(niches.userId, userId))
    .orderBy(desc(niches.fitScore));
}

export async function getNicheById(id: number): Promise<Niche | null> {
  const db = await getDb();
  if (!db) return null;
  const [niche] = await db.select().from(niches).where(eq(niches.id, id)).limit(1);
  return niche || null;
}

export async function updateNiche(id: number, updates: Partial<InsertNiche>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(niches).set(updates).where(eq(niches.id, id));
}

export async function deleteNichesBySearchId(searchId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(niches).where(eq(niches.searchId, searchId));
}

/**
 * Get child niches for a given parent niche ID.
 * Used for the two-level segment hierarchy (sub-clustering).
 */
export async function getNichesByParentId(parentNicheId: number): Promise<Niche[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(niches)
    .where(eq(niches.parentNicheId, parentNicheId))
    .orderBy(desc(niches.fitScore));
}

/**
 * Delete all child niches for a given parent niche ID (before re-sub-clustering).
 */
export async function deleteNichesByParentId(parentNicheId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(niches).where(eq(niches.parentNicheId, parentNicheId));
}

// ---------------------------------------------------------------------------
// Batch Job helpers (DO 10 persistence)
// ---------------------------------------------------------------------------

/**
 * Create a new batch job row and return it.
 */
export async function createBatchJob(data: InsertBatchJob): Promise<BatchJob> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(batchJobs).values(data);
  const [job] = await db.select().from(batchJobs).where(eq(batchJobs.id, data.id)).limit(1);
  return job;
}

/**
 * Fetch a batch job by its UUID.
 * Returns null if the job does not exist.
 */
export async function getBatchJob(id: string): Promise<BatchJob | null> {
  const db = await getDb();
  if (!db) return null;
  const [job] = await db.select().from(batchJobs).where(eq(batchJobs.id, id)).limit(1);
  return job ?? null;
}

/**
 * Partial-update a batch job row.
 * Called on every processing step to keep progress current.
 */
export async function updateBatchJob(id: string, updates: Partial<InsertBatchJob>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(batchJobs).set(updates).where(eq(batchJobs.id, id));
}

/**
 * Return the most recent batch job for a given search.
 * Used to resume polling after a page reload.
 */
export async function getLatestBatchJobForSearch(searchId: number): Promise<BatchJob | null> {
  const db = await getDb();
  if (!db) return null;
  const [job] = await db
    .select()
    .from(batchJobs)
    .where(eq(batchJobs.searchId, searchId))
    .orderBy(desc(batchJobs.createdAt))
    .limit(1);
  return job ?? null;
}

// ── BOM Calculation helpers ──────────────────────────────────────────────────

/**
 * Save a new BOM calculation row and return its new id.
 */
export async function saveBomCalculation(data: InsertBomCalculation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bomCalculations).values(data);
  return result[0].insertId;
}

/**
 * Update an existing BOM calculation (e.g. after Brain enrichment or cost edits).
 */
export async function updateBomCalculation(id: number, updates: Partial<InsertBomCalculation>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bomCalculations).set(updates).where(eq(bomCalculations.id, id));
}

/**
 * Return all BOM calculations for a given company, newest first.
 */
export async function getBomCalculationsByCompany(companyId: number): Promise<BomCalculation[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bomCalculations)
    .where(eq(bomCalculations.companyId, companyId))
    .orderBy(desc(bomCalculations.createdAt));
}

/**
 * Return the most recent BOM calculation for a company.
 */
export async function getLatestBomCalculation(companyId: number): Promise<BomCalculation | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(bomCalculations)
    .where(eq(bomCalculations.companyId, companyId))
    .orderBy(desc(bomCalculations.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Delete a BOM calculation by id (only if it belongs to the requesting user).
 */
export async function deleteBomCalculation(id: number, userId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(bomCalculations)
    .where(and(eq(bomCalculations.id, id), eq(bomCalculations.userId, userId)));
}

// ─── Apollo Webhook Audit Log ────────────────────────────────────────────────

/**
 * Insert a new webhook audit row. Never throws — audit failures should not
 * block the main webhook response.
 */
export async function insertWebhookLog(entry: InsertApolloWebhookLog): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(apolloWebhookLogs).values(entry);
  } catch (err) {
    console.error("[WebhookLog] Failed to insert audit row:", err);
  }
}

/**
 * Return webhook log entries, newest first, with optional pagination.
 */
export async function getWebhookLogs(limit = 50, offset = 0): Promise<ApolloWebhookLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(apolloWebhookLogs)
    .orderBy(desc(apolloWebhookLogs.receivedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Count total webhook log entries for pagination.
 */
export async function countWebhookLogs(): Promise<number> {
  const { count } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count() }).from(apolloWebhookLogs);
  return result[0]?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Multi-brain output store helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a brain output row for a (companyId, brainId) pair.
 * Only updates the fields that are provided (partial update).
 */
export async function upsertCompanyBrainOutput(
  companyId: number,
  brainId: number,
  updates: Partial<Omit<InsertCompanyBrainOutput, "id" | "companyId" | "brainId" | "createdAt" | "updatedAt">>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(companyBrainOutputs)
    .values({ companyId, brainId, ...updates })
    .onDuplicateKeyUpdate({ set: updates });
}

/**
 * Get the brain output row for a specific (companyId, brainId) pair.
 */
export async function getCompanyBrainOutput(
  companyId: number,
  brainId: number
): Promise<CompanyBrainOutput | null> {
  const db = await getDb();
  if (!db) return null;
  const { and } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(companyBrainOutputs)
    .where(and(eq(companyBrainOutputs.companyId, companyId), eq(companyBrainOutputs.brainId, brainId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get all brain output rows for a list of companyIds and a specific brainId.
 * Returns a map of companyId → CompanyBrainOutput for fast lookup.
 */
export async function getCompanyBrainOutputsForSearch(
  companyIds: number[],
  brainId: number
): Promise<Map<number, CompanyBrainOutput>> {
  const db = await getDb();
  const map = new Map<number, CompanyBrainOutput>();
  if (!db || companyIds.length === 0) return map;
  const { inArray, and } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(companyBrainOutputs)
    .where(and(inArray(companyBrainOutputs.companyId, companyIds), eq(companyBrainOutputs.brainId, brainId)));
  for (const row of rows) map.set(row.companyId, row);
  return map;
}

/**
 * Get all brain output rows for a single company (all brains).
 * Used by the company detail page to show the brain switcher.
 */
export async function getAllBrainOutputsForCompany(
  companyId: number
): Promise<(CompanyBrainOutput & { brainName: string | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: companyBrainOutputs.id,
      companyId: companyBrainOutputs.companyId,
      brainId: companyBrainOutputs.brainId,
      urgencyScore: companyBrainOutputs.urgencyScore,
      fitScore: companyBrainOutputs.fitScore,
      fitScoreData: companyBrainOutputs.fitScoreData,
      briefData: companyBrainOutputs.briefData,
      briefGeneratedAt: companyBrainOutputs.briefGeneratedAt,
      salesApproachData: companyBrainOutputs.salesApproachData,
      salesApproachGeneratedAt: companyBrainOutputs.salesApproachGeneratedAt,
      createdAt: companyBrainOutputs.createdAt,
      updatedAt: companyBrainOutputs.updatedAt,
      brainName: offeringBrain.brainName,
    })
    .from(companyBrainOutputs)
    .leftJoin(offeringBrain, eq(companyBrainOutputs.brainId, offeringBrain.id))
    .where(and(
      eq(companyBrainOutputs.companyId, companyId),
      eq(offeringBrain.showOnLeadtrigger, 1)
    ));
  return rows as (CompanyBrainOutput & { brainName: string | null })[];
}
