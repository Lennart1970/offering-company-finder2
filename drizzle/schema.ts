import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, tinyint } from "drizzle-orm/mysql-core";

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
  selectedSicCodes: text("selectedSicCodes"), // JSON array of LLM-selected SIC codes for filtering
  selectedNaicsCodes: text("selectedNaicsCodes"), // JSON array of LLM-selected NAICS codes for filtering
  codeSelectionReasoning: text("codeSelectionReasoning"), // LLM explanation for code selection
  excludedSectors: text("excludedSectors"), // JSON array of 2-digit NAICS sector codes excluded by user
  codesSearched: int("codesSearched").default(0), // Number of keyword tags already searched in batched Apollo queries
  codesTotal: int("codesTotal").default(0), // Total number of keyword tags to search
  status: mysqlEnum("status", ["pending", "extracting", "code_targeting", "searching", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  sharedWithTeam: tinyint("sharedWithTeam").default(0).notNull(),
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
  searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
  apolloId: varchar("apolloId", { length: 128 }),
  name: varchar("name", { length: 512 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  primaryDomain: varchar("primaryDomain", { length: 256 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  twitterUrl: varchar("twitterUrl", { length: 512 }),
  facebookUrl: varchar("facebookUrl", { length: 512 }),
  phone: varchar("phone", { length: 64 }),
  foundedYear: int("foundedYear"),
  revenue: varchar("revenue", { length: 64 }),
  headcountGrowth: varchar("headcountGrowth", { length: 256 }),
  parentCompanyName: varchar("parentCompanyName", { length: 512 }),
  parentCompanyId: varchar("parentCompanyId", { length: 128 }),
  // Location data from Apollo enrichment
  searchLocation: varchar("searchLocation", { length: 256 }), // Location used in search query
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 128 }),
  country: varchar("country", { length: 128 }),
  streetAddress: varchar("streetAddress", { length: 512 }),
  rawAddress: text("rawAddress"),
  sicCodes: text("sicCodes"), // JSON array of SIC codes
  naicsCodes: text("naicsCodes"), // JSON array of NAICS codes
  sliceMetadata: text("sliceMetadata"), // JSON object: { employeeBand, industry, keywordSet, matchedKeywords }
  sourceCountryCode: varchar("sourceCountryCode", { length: 8 }), // ISO-2 country code from conference scraper (e.g. "NL", "DE")
  urgencyScore: int("urgencyScore"), // 0-100 urgency score from Grok analysis
  fitScore: int("fitScore"), // 0-100 fit score from Grok ICP analysis
  fitScoreData: text("fitScoreData"), // JSON-stringified FitScoreResult (breakdown + rationale)
  briefData: text("briefData"), // JSON-stringified SalesIntelligenceBrief (Deep Research)
  briefGeneratedAt: timestamp("briefGeneratedAt"), // When the brief was generated
  salesApproachData: text("salesApproachData"), // JSON-stringified SalesApproach (email, LinkedIn, call script)
  salesApproachGeneratedAt: timestamp("salesApproachGeneratedAt"), // When the sales approach was generated
  callReadinessSummary: text("callReadinessSummary"), // LLM-generated 1-sentence pre-call briefing
  productImages: text("productImages"), // JSON array of { imageUrl, thumbnailUrl, title, source } from Serper Images API
  enrichmentStatus: mysqlEnum("enrichmentStatus", ["pending", "enriched", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Stores generated sales intelligence packages for companies
 */
export const salesPackages = mysqlTable("salesPackages", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  packageData: text("packageData").notNull(), // JSON-stringified SalesIntelligencePackage
  markdownContent: text("markdownContent").notNull(),
  status: mysqlEnum("status", ["generating", "completed", "failed"]).default("generating").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SalesPackage = typeof salesPackages.$inferSelect;
export type InsertSalesPackage = typeof salesPackages.$inferInsert;

/**
 * Stores user decisions on company relevance (HITL training data)
 */
export const companyDecisions = mysqlTable("companyDecisions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  decision: mysqlEnum("decision", ["call_today", "park", "not_relevant"]).notNull(),
  reasonCode: varchar("reasonCode", { length: 50 }), // 'wrong_industry', 'too_small', 'wrong_geo', 'competitor', 'other'
  reasonNotes: text("reasonNotes"),
  decidedAt: timestamp("decidedAt").defaultNow().notNull(),
});

export type CompanyDecision = typeof companyDecisions.$inferSelect;
export type InsertCompanyDecision = typeof companyDecisions.$inferInsert;

/**
 * Stores SIC/NAICS codes to exclude from future searches (built from HITL feedback)
 */
export const excludedCodes = mysqlTable("excludedCodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  codeType: mysqlEnum("codeType", ["sic", "naics"]).notNull(),
  code: varchar("code", { length: 16 }).notNull(),
  codeDescription: text("codeDescription"),
  rejectionCount: int("rejectionCount").default(1).notNull(), // How many times companies with this code were rejected
  lastRejectedAt: timestamp("lastRejectedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExcludedCode = typeof excludedCodes.$inferSelect;
export type InsertExcludedCode = typeof excludedCodes.$inferInsert;
/**
 * Caches SIC/NAICS code descriptions fetched from external sources
 */
export const codeDescriptions = mysqlTable("code_descriptions", {
  code: varchar("code", { length: 10 }).primaryKey(),
  codeType: mysqlEnum("code_type", ["SIC", "NAICS"]).notNull(),
  description: text("description"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export type CodeDescription = typeof codeDescriptions.$inferSelect;
export type InsertCodeDescription = typeof codeDescriptions.$inferInsert;

/**
 * Stores contact details (decision-makers) found via Apollo People Search
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  apolloPersonId: varchar("apolloPersonId", { length: 128 }),
  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  fullName: varchar("fullName", { length: 256 }),
  title: varchar("title", { length: 256 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  searchedTitle: varchar("searchedTitle", { length: 256 }), // The job title user searched for
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Stores deep offering intelligence ("Brain") for the user's own company.
 * This is the contextual intelligence layer that informs fit/urgency scoring.
 * One active brain per user — can be refreshed or edited.
 */
export const offeringBrain = mysqlTable("offering_brain", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  brainName: varchar("brainName", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 256 }).notNull(),
  companyWebsite: varchar("companyWebsite", { length: 512 }).notNull(),
  // Core offering intelligence
  offeringSummary: text("offeringSummary"), // What the company does in 2-3 sentences
  coreCapabilities: text("coreCapabilities"), // JSON array of key capabilities
  valuePropositions: text("valuePropositions"), // JSON array of value props with target audience
  competitiveAdvantages: text("competitiveAdvantages"), // What makes them unique
  // Ideal Customer Profile
  icpIndustries: text("icpIndustries"), // JSON array of ideal industries
  icpCompanySize: text("icpCompanySize"), // Ideal company size range
  icpGeography: text("icpGeography"), // Target geographies
  icpPainPoints: text("icpPainPoints"), // JSON array of pain points the offering solves
  icpBuyingSignals: text("icpBuyingSignals"), // JSON array of signals indicating readiness to buy
  // Fit & Urgency Scoring Criteria
  fitCriteria: text("fitCriteria"), // JSON: structured criteria for scoring prospect fit
  urgencyTriggers: text("urgencyTriggers"), // JSON: events/signals that indicate urgency
  // Industry Classification
  sicCodes: text("sicCodes"), // JSON array of SIC codes with explanations
  naceCodes: text("naceCodes"), // JSON array of NACE codes with explanations
  // Metadata
  rawResearchData: text("rawResearchData"), // Full LLM research output for reference
  status: mysqlEnum("status", ["researching", "completed", "failed"]).default("researching").notNull(),
  isActive: int("isActive").default(1).notNull(), // 1 = active brain, 0 = archived
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OfferingBrain = typeof offeringBrain.$inferSelect;
export type InsertOfferingBrain = typeof offeringBrain.$inferInsert;

/**
 * Stores call outcomes logged by sales reps per company
 */
export const callOutcomes = mysqlTable("callOutcomes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  outcome: mysqlEnum("outcome", ["reached", "voicemail", "no_answer", "meeting_booked", "not_interested"]).notNull(),
  notes: text("notes"),
  followUpDate: varchar("followUpDate", { length: 16 }), // ISO date string YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallOutcome = typeof callOutcomes.$inferSelect;
export type InsertCallOutcome = typeof callOutcomes.$inferInsert;
