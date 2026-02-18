import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Stores company search history with extracted offering data
 */
export const searches = mysqlTable("searches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  companyWebsite: varchar("companyWebsite", { length: 512 }).notNull(),
  location: varchar("location", { length: 256 }).notNull(),
  offeringName: text("offeringName"),
  offeringDescription: text("offeringDescription"),
  targetMarket: text("targetMarket"),
  valueProposition: text("valueProposition"),
  keywords: text("keywords"), // JSON array stored as text
  crossBorderIndicators: text("crossBorderIndicators"),
  keywordTagsUsed: text("keywordTagsUsed"), // JSON array of keyword tags sent to Apollo
  status: mysqlEnum("status", ["pending", "extracting", "searching", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Search = typeof searches.$inferSelect;
export type InsertSearch = typeof searches.$inferInsert;

/**
 * Stores companies found by Apollo matching the offering criteria
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  searchId: int("searchId").notNull().references(() => searches.id),
  apolloId: varchar("apolloId", { length: 128 }),
  name: varchar("name", { length: 512 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  primaryDomain: varchar("primaryDomain", { length: 256 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  phone: varchar("phone", { length: 64 }),
  foundedYear: int("foundedYear"),
  revenue: varchar("revenue", { length: 64 }),
  headcountGrowth: varchar("headcountGrowth", { length: 256 }),
  // Location data from Apollo enrichment
  searchLocation: varchar("searchLocation", { length: 256 }), // Location used in search query
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 128 }),
  country: varchar("country", { length: 128 }),
  streetAddress: varchar("streetAddress", { length: 512 }),
  rawAddress: text("rawAddress"),
  sicCodes: text("sicCodes"), // JSON array of SIC codes
  naicsCodes: text("naicsCodes"), // JSON array of NAICS codes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;