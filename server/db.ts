import { eq, and, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, salesPackages, InsertSalesPackage, companyDecisions, InsertCompanyDecision, excludedCodes, InsertExcludedCode, companies, Company, InsertCompany, searches, Search, InsertSearch, contacts, Contact, InsertContact, niches, Niche, InsertNiche } from "../drizzle/schema";
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
      values.role = 'admin';
      updateSet.role = 'admin';
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

import { desc } from "drizzle-orm";

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

export async function getUserSearches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(searches)
    .where(or(
      eq(searches.userId, userId),
      eq(searches.sharedWithTeam, 1)
    ))
    .orderBy(desc(searches.createdAt));
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

import { offeringBrain, OfferingBrain, InsertOfferingBrain } from "../drizzle/schema";

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
  
  const [brain] = await db.select().from(offeringBrain)
    .where(and(
      eq(offeringBrain.userId, userId),
      eq(offeringBrain.isActive, 1)
    ))
    .limit(1);
  return brain || null;
}

export async function updateOfferingBrain(id: number, updates: Partial<InsertOfferingBrain>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(offeringBrain).set(updates).where(eq(offeringBrain.id, id));
}

export async function getBrainHistory(userId: number): Promise<OfferingBrain[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(offeringBrain)
    .where(eq(offeringBrain.userId, userId))
    .orderBy(desc(offeringBrain.createdAt));
}

export async function setOfferingBrainActive(brainId: number, userId: number): Promise<void> {
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
  
  const [brain] = await db.select().from(offeringBrain)
    .where(and(
      eq(offeringBrain.id, brainId),
      eq(offeringBrain.userId, userId)
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
