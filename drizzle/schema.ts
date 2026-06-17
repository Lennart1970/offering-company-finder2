import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, tinyint, decimal } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin", "super_admin"]).default("user").notNull(),
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
  isArchived: tinyint("isArchived").default(0).notNull(),
  sourceNicheId: int("sourceNicheId"), // Set when campaign was created from a Market Segment niche
  brainId: int("brainId"), // Brain used for this campaign (FK to offering_brain added via migration)
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
  sector: varchar("sector", { length: 255 }), // Extracted from sliceMetadata.industry — dedicated column for fast filtering
  sourceCountryCode: varchar("sourceCountryCode", { length: 8 }), // ISO-2 country code from conference scraper (e.g. "NL", "DE")
  urgencyScore: int("urgencyScore"), // 0-100 urgency score: ABC scenario match (cosine vs scenario centroid) — high = known trigger pattern applies
  urgencyScoreGeneratedAt: timestamp("urgencyScoreGeneratedAt"), // legacy — will be migrated to urgencyScoreSynth

  // ── Three-Tier Urgency Scoring ─────────────────────────────────────────────
  // Tier 1: ABC scenario cosine match (fast, zero LLM cost)
  urgencyScoreSynth: int("urgencyScoreSynth"),
  urgencyScoreSynthGeneratedAt: timestamp("urgencyScoreSynthGeneratedAt"),
  // Tier 1b: News embedding similarity — Serper news snippet → embed → cosine vs ABC centroid
  urgencyScoreNews: int("urgencyScoreNews"),
  urgencyScoreNewsGeneratedAt: timestamp("urgencyScoreNewsGeneratedAt"),
  // Tier 2: LLM-based urgency analysis via Grok (on-demand)
  urgencyScoreLLM: int("urgencyScoreLLM"),
  urgencyScoreLLMGeneratedAt: timestamp("urgencyScoreLLMGeneratedAt"),
  // Tier 3: Human-in-the-loop override (ground truth for model calibration)
  urgencyScoreHITL: int("urgencyScoreHITL"),
  urgencyScoreHITLUpdatedAt: timestamp("urgencyScoreHITLUpdatedAt"),
  urgencyScoreHITLNote: text("urgencyScoreHITLNote"),

  // ── Three-Tier Fit Scoring ─────────────────────────────────────────────────
  // Tier 1: SIM = cosine similarity vs Brain ICP embedding (fast, zero LLM cost)
  similarityScore: int("similarityScore"),
  similarityScoreGeneratedAt: timestamp("similarityScoreGeneratedAt"),
  // Tier 2: LLM deep-analysis fit score via Grok (on-demand)
  fitScore: int("fitScore"),
  fitScoreData: text("fitScoreData"),
  fitScoreGeneratedAt: timestamp("fitScoreGeneratedAt"),
  fitScoreSource: varchar("fitScoreSource", { length: 10 }), // 'embed' | 'llm' — how the fitScore was produced
  // Tier 3: Human-in-the-loop override (ground truth for model calibration)
  fitScoreHITL: int("fitScoreHITL"),
  fitScoreHITLUpdatedAt: timestamp("fitScoreHITLUpdatedAt"),
  fitScoreHITLNote: text("fitScoreHITLNote"),
  briefData: text("briefData"), // JSON-stringified SalesIntelligenceBrief (Deep Research)
  briefGeneratedAt: timestamp("briefGeneratedAt"), // When the brief was generated
  salesApproachData: text("salesApproachData"), // JSON-stringified SalesApproach (email, LinkedIn, call script)
  salesApproachGeneratedAt: timestamp("salesApproachGeneratedAt"), // When the sales approach was generated
  callReadinessSummary: text("callReadinessSummary"), // LLM-generated 1-sentence pre-call briefing
  productImages: text("productImages"), // JSON array of { imageUrl, thumbnailUrl, title, source } from Serper Images API
  urgencyImages: text("urgencyImages"), // JSON array of editorial/news images from Serper for the Urgency tab
  salesRepProfile: text("salesRepProfile"), // LLM-generated ideal sales rep profile for this company
  salesRepProfileGeneratedAt: timestamp("salesRepProfileGeneratedAt"), // When the rep profile was generated
  signalOpeners: text("signalOpeners"), // JSON array of pre-generated per-signal openers [{signalIndex, opener}]
  signalOpenersGeneratedAt: timestamp("signalOpenersGeneratedAt"), // When signal openers were batch-generated
  enrichmentStatus: mysqlEnum("enrichmentStatus", ["pending", "enriched", "failed"]).default("pending").notNull(),
  // Brain traceability — which brain was used for the latest generation pass
  generatedWithBrainId: int("generatedWithBrainId"), // FK to offering_brain.id — stamped on every generation
  generatedWithBrainName: varchar("generatedWithBrainName", { length: 255 }), // Denormalised for fast display without JOIN
  // Niche cluster assignment (set during Phase 1 seed clustering or Phase 2 proximity assignment)
  // Note: FK constraint added via SQL migration to avoid circular reference in schema definition
  nicheId: int("nicheId"),
  contactsFetchedAt: timestamp("contactsFetchedAt"), // When all personnel were last fetched from Apollo
  // Connect Group CRM fields — populated from SharePoint lead list import
  cgBusinessUnit: varchar("cgBusinessUnit", { length: 128 }), // BU: DACH & EE, Benelux & FR, Spain, Mexico, China
  cgSalesManager: varchar("cgSalesManager", { length: 256 }), // Sales manager email from CG CRM
  cgLeadClass: varchar("cgLeadClass", { length: 64 }), // Lead / Suspect / Customer
  cgLeadOrigin: varchar("cgLeadOrigin", { length: 256 }), // Fair / Network / Market Research etc.
  cgMarket: varchar("cgMarket", { length: 256 }), // Market segment from CG CRM (Industry, Healthcare, Defence etc.)
  cgComment: text("cgComment"), // Free-text comment from CRM
  cgRemarks: text("cgRemarks"), // Additional remarks from CRM
  cgSharepointId: varchar("cgSharepointId", { length: 64 }), // Original SharePoint list item ID for dedup/sync
  cgImportedAt: timestamp("cgImportedAt"), // When this row was last synced from the CG lead list
  // CG contact-level fields (from SharePoint lead list — one primary contact per company row)
  cgParentCompany: varchar("cgParentCompany", { length: 512 }), // Parent company name from CRM
  cgContactGender: varchar("cgContactGender", { length: 16 }), // M / F / blank
  cgContactFirstName: varchar("cgContactFirstName", { length: 128 }), // Contact first name
  cgContactLastName: varchar("cgContactLastName", { length: 128 }), // Contact last name
  cgContactPosition: varchar("cgContactPosition", { length: 256 }), // Job title
  cgContactPhone: varchar("cgContactPhone", { length: 64 }), // Direct phone
  cgContactEmail: varchar("cgContactEmail", { length: 256 }), // Direct email
  cgHqAddress: varchar("cgHqAddress", { length: 512 }), // Full HQ address string from CRM
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
  phonePending: tinyint("phonePending").default(0), // 1 while waiting for Apollo webhook callback
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
  geographyWeights: text("geographyWeights"), // JSON: { eu: 1.0, us: 0.95, apac: 0.75, china: 0.40, other: 0.65 } — multipliers applied after LLM fit score
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
  isShared: int("isShared").default(0).notNull(), // 1 = visible to all users, 0 = owner only
  showOnLeadtrigger: tinyint("show_on_leadtrigger").default(1).notNull(), // 1 = visible in LeadTrigger UI, 0 = hidden (managed from DB)
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

/**
 * Niche clusters — groups of companies with similar profiles.
 * Created during the Scouting import pipeline (k-means clustering on embeddings).
 * Fit scoring is done at niche level first (pre-scoring gate) before individual company scoring.
 */
export const niches = mysqlTable("niches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  searchId: int("searchId").references(() => searches.id, { onDelete: "cascade" }),
  brainId: int("brainId").references(() => offeringBrain.id, { onDelete: "set null" }),
  // Cluster identity
  name: varchar("name", { length: 255 }).notNull(), // e.g. "Export + Manufacturing + Trade"
  description: text("description"), // LLM-generated 2-3 sentence plain-English summary
  companyCount: int("companyCount").default(0).notNull(),
  topKeywords: text("topKeywords"), // JSON array of top keywords (max 10)
  sampleCompanies: text("sampleCompanies"), // JSON array of first 5 company names
  companyIds: text("companyIds"), // JSON array of company IDs in this cluster
  centroid: text("centroid"), // JSON array of floats (mean embedding vector)
  rationale: text("rationale"), // Human-readable grouping rationale
  // Dynamic fit scoring (Brain-driven, LLM-inferred components)
  fitScore: int("fitScore"), // 0-100 overall fit score
  fitReasoning: text("fitReasoning"), // One paragraph overall fit assessment
  scoreBreakdown: text("scoreBreakdown"), // JSON array of { dimension, score, maxScore, weight, reasoning }
  scoredAt: timestamp("scoredAt"), // When the fit score was last computed
  scoredWithBrainId: int("scoredWithBrainId"), // Which brain version was used for scoring
  // Hierarchy: sub-clustering
  parentNicheId: int("parentNicheId"), // null = top-level segment; set = child niche of a parent segment
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Niche = typeof niches.$inferSelect;
export type InsertNiche = typeof niches.$inferInsert;

/**
 * Scoring dimension schema (stored as JSON in niches.scoreBreakdown):
 * [
 *   {
 *     dimension: string,   // LLM-inferred name, e.g. "Industry Alignment"
 *     score: number,       // 0 to maxScore
 *     maxScore: number,    // LLM-assigned weight (all maxScores sum to 100)
 *     weight: number,      // Same as maxScore, kept for UI clarity
 *     reasoning: string    // 1-2 sentence explanation
 *   },
 *   ...
 * ]
 */

/**
 * Persists DO 10 batch-processing job state so jobs survive server restarts.
 * One row per doNext10 invocation; polled by the frontend every 3 seconds.
 */
export const batchJobs = mysqlTable("batch_jobs", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID job ID
  searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  status: mysqlEnum("status", ["running", "completed", "failed", "cancelled"]).default("running").notNull(),
  jobType: mysqlEnum("jobType", ["do10", "doAll"]).default("do10").notNull(), // do10 = limited batch, doAll = full niche
  progress: int("progress").default(0).notNull(),          // 0-100 percentage
  currentCompany: varchar("currentCompany", { length: 512 }), // Name of company currently processing
  totalCompanies: int("totalCompanies").default(0).notNull(), // Total companies in this job's queue
  enriched: int("enriched").default(0).notNull(),
  researched: int("researched").default(0).notNull(),
  approached: int("approached").default(0).notNull(),
  failed: int("failed").default(0).notNull(),
  remaining: int("remaining").default(0).notNull(),        // Companies still needing work after this job
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BatchJob = typeof batchJobs.$inferSelect;
export type InsertBatchJob = typeof batchJobs.$inferInsert;

/**
 * Fast Prototyping from Product Picture — prototype request tickets.
 * A customer uploads product images, the system extracts intelligence via LLM vision,
 * and the customer fills in basic info to create a prototype request.
 */
export const prototypeRequests = mysqlTable("prototype_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  // Images (up to 3 S3 URLs)
  imageUrls: text("imageUrls").notNull(), // JSON array of S3 image URLs
  productUrl: varchar("productUrl", { length: 1024 }), // Optional: URL to competing product page
  // LLM Vision Extraction
  productTypeGuess: text("productTypeGuess"), // e.g. "Lithium battery module with integrated BMS"
  keyFeatureGuess: text("keyFeatureGuess"), // JSON array of extracted features
  whatWeStillNeed: text("whatWeStillNeed"), // JSON array of questions to ask customer
  extractionRaw: text("extractionRaw"), // Full LLM response for reference
  // Customer-entered info
  annualUnits: varchar("annualUnits", { length: 128 }), // EAU - Expected Annual Units
  expectedSop: varchar("expectedSop", { length: 128 }), // SOP - Start of Production date
  region: mysqlEnum("region", ["EU", "US", "APAC", "Other"]),
  designIntent: mysqlEnum("designIntent", ["equivalent", "modified"]), // 1:1 equivalent or modified design
  hasBom: tinyint("hasBom").default(0), // Customer has BOM / dimensions / extra pictures
  customerNotes: text("customerNotes"), // Free text notes from customer
  customerName: varchar("customerName", { length: 256 }), // Name of the requesting person
  customerEmail: varchar("customerEmail", { length: 320 }), // Email for follow-up
  customerCompany: varchar("customerCompany", { length: 256 }), // Company name
  // Internal workflow
  status: mysqlEnum("status", ["draft", "analyzing", "pending_info", "submitted", "more_info_requested", "sample_requested", "costing", "completed"]).default("draft").notNull(),
  internalNotes: text("internalNotes"), // Notes from the internal team
  assignedTo: varchar("assignedTo", { length: 256 }), // Internal team member
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PrototypeRequest = typeof prototypeRequests.$inferSelect;
export type InsertPrototypeRequest = typeof prototypeRequests.$inferInsert;

/**
 * Bill of Materials (BOM) line items for prototype cost calculation
 */
export const bomItems = mysqlTable("bom_items", {
  id: int("id").autoincrement().primaryKey(),
  prototypeRequestId: int("prototypeRequestId").notNull(),
  component: varchar("component", { length: 256 }).notNull(), // Component / material name
  qty: int("qty").notNull().default(1),                        // Quantity
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull(), // Cost per unit
  currency: varchar("currency", { length: 8 }).notNull().default("EUR"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BomItem = typeof bomItems.$inferSelect;
export type InsertBomItem = typeof bomItems.$inferInsert;

/**
 * Persistent BOM calculations — one row per AI-generated BOM analysis.
 * Linked to a prospect company and the user who ran the analysis.
 * Stores the full component list as JSON so it can be reloaded without re-running the AI.
 */
export const bomCalculations = mysqlTable("bom_calculations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),          // FK → companies.id
  userId: varchar("userId", { length: 256 }).notNull(), // user openId
  // Source images used for this analysis (JSON array of image URLs)
  imageUrls: text("imageUrls").notNull(),
  // AI-generated product summary sentence
  productSummary: text("productSummary").notNull(),
  // Full component list as JSON array
  // Each item: { component, qty, unitCostEur, confidence, notes, editedCost?, canSupply?, supplyReason?, deliverableCategory? }
  componentsJson: text("componentsJson").notNull(),
  // Computed total (sum of editedCost * qty) stored for quick display
  totalEur: decimal("totalEur", { precision: 14, scale: 2 }).notNull().default("0"),
  // Whether Brain enrichment (canSupply) has been run on this BOM
  isEnriched: tinyint("isEnriched").default(0).notNull(),
  // Brain id used for enrichment (null if not enriched)
  brainId: int("brainId"),
  // Optional user-editable label (defaults to date string)
  label: varchar("label", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BomCalculation = typeof bomCalculations.$inferSelect;
export type InsertBomCalculation = typeof bomCalculations.$inferInsert;

/**
 * Campaign Research Queue — persistent job queue for background deep research.
 * One row per company per enqueue event. The worker picks pending jobs FIFO,
 * runs fit score → brief → sales approach, and marks them completed/failed.
 * Survives server restarts — state is fully in the DB.
 */
export const campaignQueue = mysqlTable("campaign_queue", {
  id: int("id").autoincrement().primaryKey(),
  searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  companyName: varchar("companyName", { length: 512 }).notNull(),
  jobType: mysqlEnum("jobType", ["full", "brief_only", "score_only", "score_urgency_only", "outreach_only"]).default("full").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CampaignQueueJob = typeof campaignQueue.$inferSelect;
export type InsertCampaignQueueJob = typeof campaignQueue.$inferInsert;

/**
 * Leadinfo website visitor data — imported from Leadinfo Excel exports.
 * Each row represents one company that visited the user's website.
 * Matched to campaign companies by domain for enrichment.
 */
export const leadinfoVisits = mysqlTable("leadinfo_visits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  searchId: int("searchId").references(() => searches.id, { onDelete: "cascade" }), // Campaign this was matched against
  companyId: int("companyId").references(() => companies.id, { onDelete: "cascade" }), // Matched company (null if unmatched)
  // Leadinfo company data
  companyName: varchar("companyName", { length: 512 }).notNull(),
  domain: varchar("domain", { length: 256 }).notNull(), // Normalised root domain from Leadinfo URL
  rawUrl: varchar("rawUrl", { length: 1024 }), // Original URL from Leadinfo
  city: varchar("city", { length: 128 }),
  country: varchar("country", { length: 8 }), // ISO-2 country code
  salesRegion: varchar("salesRegion", { length: 64 }),
  employees: int("employees"),
  branch: varchar("branch", { length: 256 }), // Industry/branch from Leadinfo
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  salesVolume: varchar("salesVolume", { length: 128 }), // Raw sales volume string from Leadinfo
  // Engagement metrics
  totalPages: int("totalPages").default(0),
  totalSessions: int("totalSessions").default(0),
  totalDuration: int("totalDuration").default(0), // Total seconds across all sessions
  engagementScore: int("engagementScore").default(0), // Computed: sessions * log(duration+1) * pageDepthMultiplier
  // Visitor intent signals
  pagesViewed: text("pagesViewed"), // JSON array of { url, title, duration, visitedAt }
  topPages: text("topPages"), // JSON array of top 5 most-viewed page titles
  intentSignals: text("intentSignals"), // JSON array of detected intent signals (e.g. "Viewed services page", "Visited contact page")
  // Persona data (from Leadinfo page views sheet)
  personas: text("personas"), // JSON array of { firstName, lastName, email, jobTitle }
  // Import metadata
  importBatchId: varchar("importBatchId", { length: 36 }), // UUID grouping one Excel upload
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LeadinfoVisit = typeof leadinfoVisits.$inferSelect;
export type InsertLeadinfoVisit = typeof leadinfoVisits.$inferInsert;

/**
 * Audit log for every Apollo webhook callback received.
 * Stores the full payload summary so delivery issues can be diagnosed
 * without reading server logs.
 */
export const apolloWebhookLogs = mysqlTable("apolloWebhookLogs", {
  id: int("id").autoincrement().primaryKey(),
  /** Raw status field from Apollo payload ("success" | "failed" | etc.) */
  apolloStatus: varchar("apolloStatus", { length: 64 }),
  /** Apollo person ID from the people[0].id field */
  apolloPersonId: varchar("apolloPersonId", { length: 128 }),
  /** Phone number delivered (sanitized_number from phone_numbers[0]) */
  phoneDelivered: varchar("phoneDelivered", { length: 64 }),
  /** Our internal contact ID if a match was found, null otherwise */
  contactId: int("contactId"),
  /** Contact full name for quick reference */
  contactName: varchar("contactName", { length: 256 }),
  /** Whether we successfully updated the contact record */
  updated: tinyint("updated").default(0).notNull(),
  /** Reason code when not updated: no_phone | contact_not_found | no_people | error */
  failReason: varchar("failReason", { length: 64 }),
  /** Number of people entries in the payload */
  peopleCount: int("peopleCount").default(0),
  /** Credits consumed as reported by Apollo */
  creditsConsumed: int("creditsConsumed").default(0),
  /** Full raw payload stored as JSON string for deep debugging */
  rawPayload: text("rawPayload"),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});

export type ApolloWebhookLog = typeof apolloWebhookLogs.$inferSelect;
export type InsertApolloWebhookLog = typeof apolloWebhookLogs.$inferInsert;

/**
 * Multi-brain output store — one row per (company, brain) pair.
 * Replaces the flat briefData/salesApproachData columns on companies for
 * brain-aware queries. The companies table columns are kept as legacy fallback.
 */
export const companyBrainOutputs = mysqlTable("company_brain_outputs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  brainId: int("brainId").notNull().references(() => offeringBrain.id, { onDelete: "cascade" }),
  urgencyScore: int("urgencyScore"),
  fitScore: int("fitScore"),
  fitScoreData: text("fitScoreData"),         // JSON FitScoreResult
  briefData: text("briefData"),               // JSON SalesIntelligenceBrief
  briefGeneratedAt: timestamp("briefGeneratedAt"),
  salesApproachData: text("salesApproachData"), // JSON SalesApproach
  salesApproachGeneratedAt: timestamp("salesApproachGeneratedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyBrainOutput = typeof companyBrainOutputs.$inferSelect;
export type InsertCompanyBrainOutput = typeof companyBrainOutputs.$inferInsert;

/**
 * Sales materials (presentations, PDFs, etc.) uploaded by admin for the sales team.
 */
export const salesMaterials = mysqlTable("sales_materials", {
  id: int("id").autoincrement().primaryKey(),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: int("fileSize"),           // bytes
  mimeType: varchar("mimeType", { length: 128 }),
  category: varchar("category", { length: 128 }),  // e.g. "Railway", "Automotive", "General"
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SalesMaterial = typeof salesMaterials.$inferSelect;
export type InsertSalesMaterial = typeof salesMaterials.$inferInsert;

/**
 * Public share tokens — allow unauthenticated access to a company+brain detail page.
 * Each token is a random 32-char hex string that maps to a specific company+brain pair.
 * Tokens are created by admins/users when building a share list for SharePoint export.
 */
export const shareTokens = mysqlTable("share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  brainId: int("brainId").notNull().references(() => offeringBrain.id, { onDelete: "cascade" }),
  createdBy: int("createdBy").notNull().references(() => users.id),
  // Optional label for the share list this token belongs to
  shareListName: varchar("shareListName", { length: 256 }),
  // Pre-rendered image URLs (JSON array) — avoids Serper API call on every page visit
  cachedImages: text("cachedImages"),
  // When the cache was last refreshed
  cachedAt: timestamp("cachedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareToken = typeof shareTokens.$inferSelect;
export type InsertShareToken = typeof shareTokens.$inferInsert;

/**
 * A share list groups multiple share tokens under a single public list token.
 * The list token gives access to a public overview page + Excel download.
 */
export const shareLists = mysqlTable("share_lists", {
  id: int("id").autoincrement().primaryKey(),
  listToken: varchar("listToken", { length: 64 }).notNull().unique(),
  shareListName: varchar("shareListName", { length: 256 }),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  brainId: int("brainId").references(() => offeringBrain.id, { onDelete: "set null" }),
});

export type ShareList = typeof shareLists.$inferSelect;
export type InsertShareList = typeof shareLists.$inferInsert;

/**
 * Join table linking a share list to its individual company share tokens.
 */
export const shareListItems = mysqlTable("share_list_items", {
  id: int("id").autoincrement().primaryKey(),
  shareListId: int("shareListId").notNull().references(() => shareLists.id, { onDelete: "cascade" }),
  shareTokenId: int("shareTokenId").notNull().references(() => shareTokens.id, { onDelete: "cascade" }),
});

export type ShareListItem = typeof shareListItems.$inferSelect;
export type InsertShareListItem = typeof shareListItems.$inferInsert;

/**
 * Logs email-based access attempts to public share pages.
 * Used for audit trail and domain allowlist enforcement.
 */
export const shareAccessLog = mysqlTable("share_access_log", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  domain: varchar("domain", { length: 128 }).notNull(),
  tokenType: mysqlEnum("tokenType", ["company", "list", "brain"]).notNull(),
  tokenValue: varchar("tokenValue", { length: 64 }).notNull(),
  accessGranted: tinyint("accessGranted").notNull().default(0),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareAccessLog = typeof shareAccessLog.$inferSelect;
export type InsertShareAccessLog = typeof shareAccessLog.$inferInsert;

/**
 * Allowlist of email domains permitted to access public share pages.
 * Admins can add/remove domains from the app.
 */
export const shareAllowedDomains = mysqlTable("share_allowed_domains", {
  id: int("id").autoincrement().primaryKey(),
  domain: varchar("domain", { length: 128 }).notNull().unique(),
  addedBy: int("addedBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareAllowedDomain = typeof shareAllowedDomains.$inferSelect;
export type InsertShareAllowedDomain = typeof shareAllowedDomains.$inferInsert;

/**
 * Share tokens for public read-only Brain (ICP) pages.
 */
export const brainShareTokens = mysqlTable("brain_share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  brainId: int("brainId").notNull().references(() => offeringBrain.id, { onDelete: "cascade" }),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrainShareToken = typeof brainShareTokens.$inferSelect;
export type InsertBrainShareToken = typeof brainShareTokens.$inferInsert;

/**
 * Persistent visitor identity for public share pages.
 * One row per unique email address. Upserted on every verified access.
 */
export const shareVisitors = mysqlTable("share_visitors", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  firstSeen: timestamp("firstSeen").defaultNow().notNull(),
  lastSeen: timestamp("lastSeen").defaultNow().onUpdateNow().notNull(),
  accessCount: int("accessCount").default(1).notNull(),
});

export type ShareVisitor = typeof shareVisitors.$inferSelect;
export type InsertShareVisitor = typeof shareVisitors.$inferInsert;

/**
 * SharePoint CRM lead lookup table — read-only reference for CRM presence badges.
 * Populated via scripts/import-sharepoint-leads.mjs from SharePoint Excel export.
 */
export const cgLeads = mysqlTable("lt_mns_cg_leads", {
  id: int("id").primaryKey(),
  companyName: text("company_name").notNull(),
  website: text("website"),
  domain: text("domain"),
  sharepointUrl: text("sharepoint_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CgLead = typeof cgLeads.$inferSelect;
export type InsertCgLead = typeof cgLeads.$inferInsert;
