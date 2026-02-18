import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
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

import { companies, Company, InsertCompany, searches, Search, InsertSearch } from "../drizzle/schema";
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
  
  return db.select().from(searches).where(eq(searches.userId, userId)).orderBy(desc(searches.createdAt));
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
