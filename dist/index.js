var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  apolloWebhookLogs: () => apolloWebhookLogs,
  batchJobs: () => batchJobs,
  bomCalculations: () => bomCalculations,
  bomItems: () => bomItems,
  callOutcomes: () => callOutcomes,
  campaignQueue: () => campaignQueue,
  codeDescriptions: () => codeDescriptions,
  companies: () => companies,
  companyBrainOutputs: () => companyBrainOutputs,
  companyDecisions: () => companyDecisions,
  contacts: () => contacts,
  excludedCodes: () => excludedCodes,
  leadinfoVisits: () => leadinfoVisits,
  niches: () => niches,
  offeringBrain: () => offeringBrain,
  prototypeRequests: () => prototypeRequests,
  salesPackages: () => salesPackages,
  searches: () => searches,
  users: () => users
});
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, tinyint, decimal } from "drizzle-orm/mysql-core";
var users, searches, companies, salesPackages, companyDecisions, excludedCodes, codeDescriptions, contacts, offeringBrain, callOutcomes, niches, batchJobs, prototypeRequests, bomItems, bomCalculations, campaignQueue, leadinfoVisits, apolloWebhookLogs, companyBrainOutputs;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
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
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    searches = mysqlTable("searches", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id),
      companyWebsite: varchar("companyWebsite", { length: 512 }).notNull(),
      location: varchar("location", { length: 256 }).notNull(),
      offeringName: text("offeringName"),
      offeringDescription: text("offeringDescription"),
      targetMarket: text("targetMarket"),
      valueProposition: text("valueProposition"),
      keywords: text("keywords"),
      // JSON array stored as text
      crossBorderIndicators: text("crossBorderIndicators"),
      keywordTagsUsed: text("keywordTagsUsed"),
      // JSON array of keyword tags sent to Apollo
      selectedSicCodes: text("selectedSicCodes"),
      // JSON array of LLM-selected SIC codes for filtering
      selectedNaicsCodes: text("selectedNaicsCodes"),
      // JSON array of LLM-selected NAICS codes for filtering
      codeSelectionReasoning: text("codeSelectionReasoning"),
      // LLM explanation for code selection
      excludedSectors: text("excludedSectors"),
      // JSON array of 2-digit NAICS sector codes excluded by user
      codesSearched: int("codesSearched").default(0),
      // Number of keyword tags already searched in batched Apollo queries
      codesTotal: int("codesTotal").default(0),
      // Total number of keyword tags to search
      status: mysqlEnum("status", ["pending", "extracting", "code_targeting", "searching", "completed", "failed"]).default("pending").notNull(),
      errorMessage: text("errorMessage"),
      sharedWithTeam: tinyint("sharedWithTeam").default(0).notNull(),
      isArchived: tinyint("isArchived").default(0).notNull(),
      sourceNicheId: int("sourceNicheId"),
      // Set when campaign was created from a Market Segment niche
      brainId: int("brainId"),
      // Brain used for this campaign (FK to offering_brain added via migration)
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    companies = mysqlTable("companies", {
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
      searchLocation: varchar("searchLocation", { length: 256 }),
      // Location used in search query
      city: varchar("city", { length: 128 }),
      state: varchar("state", { length: 128 }),
      country: varchar("country", { length: 128 }),
      streetAddress: varchar("streetAddress", { length: 512 }),
      rawAddress: text("rawAddress"),
      sicCodes: text("sicCodes"),
      // JSON array of SIC codes
      naicsCodes: text("naicsCodes"),
      // JSON array of NAICS codes
      sliceMetadata: text("sliceMetadata"),
      // JSON object: { employeeBand, industry, keywordSet, matchedKeywords }
      sourceCountryCode: varchar("sourceCountryCode", { length: 8 }),
      // ISO-2 country code from conference scraper (e.g. "NL", "DE")
      urgencyScore: int("urgencyScore"),
      // 0-100 urgency score from Grok analysis
      fitScore: int("fitScore"),
      // 0-100 fit score from Grok ICP analysis
      fitScoreData: text("fitScoreData"),
      // JSON-stringified FitScoreResult (breakdown + rationale)
      briefData: text("briefData"),
      // JSON-stringified SalesIntelligenceBrief (Deep Research)
      briefGeneratedAt: timestamp("briefGeneratedAt"),
      // When the brief was generated
      salesApproachData: text("salesApproachData"),
      // JSON-stringified SalesApproach (email, LinkedIn, call script)
      salesApproachGeneratedAt: timestamp("salesApproachGeneratedAt"),
      // When the sales approach was generated
      callReadinessSummary: text("callReadinessSummary"),
      // LLM-generated 1-sentence pre-call briefing
      productImages: text("productImages"),
      // JSON array of { imageUrl, thumbnailUrl, title, source } from Serper Images API
      urgencyImages: text("urgencyImages"),
      // JSON array of editorial/news images from Serper for the Urgency tab
      salesRepProfile: text("salesRepProfile"),
      // LLM-generated ideal sales rep profile for this company
      salesRepProfileGeneratedAt: timestamp("salesRepProfileGeneratedAt"),
      // When the rep profile was generated
      signalOpeners: text("signalOpeners"),
      // JSON array of pre-generated per-signal openers [{signalIndex, opener}]
      signalOpenersGeneratedAt: timestamp("signalOpenersGeneratedAt"),
      // When signal openers were batch-generated
      enrichmentStatus: mysqlEnum("enrichmentStatus", ["pending", "enriched", "failed"]).default("pending").notNull(),
      // Brain traceability — which brain was used for the latest generation pass
      generatedWithBrainId: int("generatedWithBrainId"),
      // FK to offering_brain.id — stamped on every generation
      generatedWithBrainName: varchar("generatedWithBrainName", { length: 255 }),
      // Denormalised for fast display without JOIN
      // Niche cluster assignment (set during Phase 1 seed clustering or Phase 2 proximity assignment)
      // Note: FK constraint added via SQL migration to avoid circular reference in schema definition
      nicheId: int("nicheId"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    salesPackages = mysqlTable("salesPackages", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      userId: int("userId").notNull().references(() => users.id),
      packageData: text("packageData").notNull(),
      // JSON-stringified SalesIntelligencePackage
      markdownContent: text("markdownContent").notNull(),
      status: mysqlEnum("status", ["generating", "completed", "failed"]).default("generating").notNull(),
      errorMessage: text("errorMessage"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    companyDecisions = mysqlTable("companyDecisions", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
      userId: int("userId").notNull().references(() => users.id),
      decision: mysqlEnum("decision", ["call_today", "park", "not_relevant"]).notNull(),
      reasonCode: varchar("reasonCode", { length: 50 }),
      // 'wrong_industry', 'too_small', 'wrong_geo', 'competitor', 'other'
      reasonNotes: text("reasonNotes"),
      decidedAt: timestamp("decidedAt").defaultNow().notNull()
    });
    excludedCodes = mysqlTable("excludedCodes", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id),
      codeType: mysqlEnum("codeType", ["sic", "naics"]).notNull(),
      code: varchar("code", { length: 16 }).notNull(),
      codeDescription: text("codeDescription"),
      rejectionCount: int("rejectionCount").default(1).notNull(),
      // How many times companies with this code were rejected
      lastRejectedAt: timestamp("lastRejectedAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    codeDescriptions = mysqlTable("code_descriptions", {
      code: varchar("code", { length: 10 }).primaryKey(),
      codeType: mysqlEnum("code_type", ["SIC", "NAICS"]).notNull(),
      description: text("description"),
      fetchedAt: timestamp("fetched_at").defaultNow().notNull()
    });
    contacts = mysqlTable("contacts", {
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
      searchedTitle: varchar("searchedTitle", { length: 256 }),
      // The job title user searched for
      phonePending: tinyint("phonePending").default(0),
      // 1 while waiting for Apollo webhook callback
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    offeringBrain = mysqlTable("offering_brain", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id),
      brainName: varchar("brainName", { length: 255 }).notNull(),
      companyName: varchar("companyName", { length: 256 }).notNull(),
      companyWebsite: varchar("companyWebsite", { length: 512 }).notNull(),
      // Core offering intelligence
      offeringSummary: text("offeringSummary"),
      // What the company does in 2-3 sentences
      coreCapabilities: text("coreCapabilities"),
      // JSON array of key capabilities
      valuePropositions: text("valuePropositions"),
      // JSON array of value props with target audience
      competitiveAdvantages: text("competitiveAdvantages"),
      // What makes them unique
      // Ideal Customer Profile
      icpIndustries: text("icpIndustries"),
      // JSON array of ideal industries
      icpCompanySize: text("icpCompanySize"),
      // Ideal company size range
      icpGeography: text("icpGeography"),
      // Target geographies
      icpPainPoints: text("icpPainPoints"),
      // JSON array of pain points the offering solves
      icpBuyingSignals: text("icpBuyingSignals"),
      // JSON array of signals indicating readiness to buy
      // Fit & Urgency Scoring Criteria
      fitCriteria: text("fitCriteria"),
      // JSON: structured criteria for scoring prospect fit
      urgencyTriggers: text("urgencyTriggers"),
      // JSON: events/signals that indicate urgency
      // Industry Classification
      sicCodes: text("sicCodes"),
      // JSON array of SIC codes with explanations
      naceCodes: text("naceCodes"),
      // JSON array of NACE codes with explanations
      // Metadata
      rawResearchData: text("rawResearchData"),
      // Full LLM research output for reference
      status: mysqlEnum("status", ["researching", "completed", "failed"]).default("researching").notNull(),
      isActive: int("isActive").default(1).notNull(),
      // 1 = active brain, 0 = archived
      isShared: int("isShared").default(0).notNull(),
      // 1 = visible to all users, 0 = owner only
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    callOutcomes = mysqlTable("callOutcomes", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      userId: int("userId").notNull().references(() => users.id),
      outcome: mysqlEnum("outcome", ["reached", "voicemail", "no_answer", "meeting_booked", "not_interested"]).notNull(),
      notes: text("notes"),
      followUpDate: varchar("followUpDate", { length: 16 }),
      // ISO date string YYYY-MM-DD
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    niches = mysqlTable("niches", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id),
      searchId: int("searchId").references(() => searches.id, { onDelete: "cascade" }),
      brainId: int("brainId").references(() => offeringBrain.id, { onDelete: "set null" }),
      // Cluster identity
      name: varchar("name", { length: 255 }).notNull(),
      // e.g. "Export + Manufacturing + Trade"
      description: text("description"),
      // LLM-generated 2-3 sentence plain-English summary
      companyCount: int("companyCount").default(0).notNull(),
      topKeywords: text("topKeywords"),
      // JSON array of top keywords (max 10)
      sampleCompanies: text("sampleCompanies"),
      // JSON array of first 5 company names
      companyIds: text("companyIds"),
      // JSON array of company IDs in this cluster
      centroid: text("centroid"),
      // JSON array of floats (mean embedding vector)
      rationale: text("rationale"),
      // Human-readable grouping rationale
      // Dynamic fit scoring (Brain-driven, LLM-inferred components)
      fitScore: int("fitScore"),
      // 0-100 overall fit score
      fitReasoning: text("fitReasoning"),
      // One paragraph overall fit assessment
      scoreBreakdown: text("scoreBreakdown"),
      // JSON array of { dimension, score, maxScore, weight, reasoning }
      scoredAt: timestamp("scoredAt"),
      // When the fit score was last computed
      scoredWithBrainId: int("scoredWithBrainId"),
      // Which brain version was used for scoring
      // Hierarchy: sub-clustering
      parentNicheId: int("parentNicheId"),
      // null = top-level segment; set = child niche of a parent segment
      // Metadata
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    batchJobs = mysqlTable("batch_jobs", {
      id: varchar("id", { length: 36 }).primaryKey(),
      // UUID job ID
      searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
      userId: int("userId").notNull().references(() => users.id),
      status: mysqlEnum("status", ["running", "completed", "failed", "cancelled"]).default("running").notNull(),
      jobType: mysqlEnum("jobType", ["do10", "doAll"]).default("do10").notNull(),
      // do10 = limited batch, doAll = full niche
      progress: int("progress").default(0).notNull(),
      // 0-100 percentage
      currentCompany: varchar("currentCompany", { length: 512 }),
      // Name of company currently processing
      totalCompanies: int("totalCompanies").default(0).notNull(),
      // Total companies in this job's queue
      enriched: int("enriched").default(0).notNull(),
      researched: int("researched").default(0).notNull(),
      approached: int("approached").default(0).notNull(),
      failed: int("failed").default(0).notNull(),
      remaining: int("remaining").default(0).notNull(),
      // Companies still needing work after this job
      errorMessage: text("errorMessage"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    prototypeRequests = mysqlTable("prototype_requests", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id),
      // Images (up to 3 S3 URLs)
      imageUrls: text("imageUrls").notNull(),
      // JSON array of S3 image URLs
      productUrl: varchar("productUrl", { length: 1024 }),
      // Optional: URL to competing product page
      // LLM Vision Extraction
      productTypeGuess: text("productTypeGuess"),
      // e.g. "Lithium battery module with integrated BMS"
      keyFeatureGuess: text("keyFeatureGuess"),
      // JSON array of extracted features
      whatWeStillNeed: text("whatWeStillNeed"),
      // JSON array of questions to ask customer
      extractionRaw: text("extractionRaw"),
      // Full LLM response for reference
      // Customer-entered info
      annualUnits: varchar("annualUnits", { length: 128 }),
      // EAU - Expected Annual Units
      expectedSop: varchar("expectedSop", { length: 128 }),
      // SOP - Start of Production date
      region: mysqlEnum("region", ["EU", "US", "APAC", "Other"]),
      designIntent: mysqlEnum("designIntent", ["equivalent", "modified"]),
      // 1:1 equivalent or modified design
      hasBom: tinyint("hasBom").default(0),
      // Customer has BOM / dimensions / extra pictures
      customerNotes: text("customerNotes"),
      // Free text notes from customer
      customerName: varchar("customerName", { length: 256 }),
      // Name of the requesting person
      customerEmail: varchar("customerEmail", { length: 320 }),
      // Email for follow-up
      customerCompany: varchar("customerCompany", { length: 256 }),
      // Company name
      // Internal workflow
      status: mysqlEnum("status", ["draft", "analyzing", "pending_info", "submitted", "more_info_requested", "sample_requested", "costing", "completed"]).default("draft").notNull(),
      internalNotes: text("internalNotes"),
      // Notes from the internal team
      assignedTo: varchar("assignedTo", { length: 256 }),
      // Internal team member
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    bomItems = mysqlTable("bom_items", {
      id: int("id").autoincrement().primaryKey(),
      prototypeRequestId: int("prototypeRequestId").notNull(),
      component: varchar("component", { length: 256 }).notNull(),
      // Component / material name
      qty: int("qty").notNull().default(1),
      // Quantity
      unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull(),
      // Cost per unit
      currency: varchar("currency", { length: 8 }).notNull().default("EUR"),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    bomCalculations = mysqlTable("bom_calculations", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull(),
      // FK → companies.id
      userId: varchar("userId", { length: 256 }).notNull(),
      // user openId
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    campaignQueue = mysqlTable("campaign_queue", {
      id: int("id").autoincrement().primaryKey(),
      searchId: int("searchId").notNull().references(() => searches.id, { onDelete: "cascade" }),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      userId: int("userId").notNull().references(() => users.id),
      companyName: varchar("companyName", { length: 512 }).notNull(),
      jobType: mysqlEnum("jobType", ["full", "brief_only"]).default("full").notNull(),
      status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
      errorMessage: text("errorMessage"),
      startedAt: timestamp("startedAt"),
      completedAt: timestamp("completedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    leadinfoVisits = mysqlTable("leadinfo_visits", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id),
      searchId: int("searchId").references(() => searches.id, { onDelete: "cascade" }),
      // Campaign this was matched against
      companyId: int("companyId").references(() => companies.id, { onDelete: "cascade" }),
      // Matched company (null if unmatched)
      // Leadinfo company data
      companyName: varchar("companyName", { length: 512 }).notNull(),
      domain: varchar("domain", { length: 256 }).notNull(),
      // Normalised root domain from Leadinfo URL
      rawUrl: varchar("rawUrl", { length: 1024 }),
      // Original URL from Leadinfo
      city: varchar("city", { length: 128 }),
      country: varchar("country", { length: 8 }),
      // ISO-2 country code
      salesRegion: varchar("salesRegion", { length: 64 }),
      employees: int("employees"),
      branch: varchar("branch", { length: 256 }),
      // Industry/branch from Leadinfo
      linkedinUrl: varchar("linkedinUrl", { length: 512 }),
      salesVolume: varchar("salesVolume", { length: 128 }),
      // Raw sales volume string from Leadinfo
      // Engagement metrics
      totalPages: int("totalPages").default(0),
      totalSessions: int("totalSessions").default(0),
      totalDuration: int("totalDuration").default(0),
      // Total seconds across all sessions
      engagementScore: int("engagementScore").default(0),
      // Computed: sessions * log(duration+1) * pageDepthMultiplier
      // Visitor intent signals
      pagesViewed: text("pagesViewed"),
      // JSON array of { url, title, duration, visitedAt }
      topPages: text("topPages"),
      // JSON array of top 5 most-viewed page titles
      intentSignals: text("intentSignals"),
      // JSON array of detected intent signals (e.g. "Viewed services page", "Visited contact page")
      // Persona data (from Leadinfo page views sheet)
      personas: text("personas"),
      // JSON array of { firstName, lastName, email, jobTitle }
      // Import metadata
      importBatchId: varchar("importBatchId", { length: 36 }),
      // UUID grouping one Excel upload
      importedAt: timestamp("importedAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    apolloWebhookLogs = mysqlTable("apolloWebhookLogs", {
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
      receivedAt: timestamp("receivedAt").defaultNow().notNull()
    });
    companyBrainOutputs = mysqlTable("company_brain_outputs", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      brainId: int("brainId").notNull().references(() => offeringBrain.id, { onDelete: "cascade" }),
      urgencyScore: int("urgencyScore"),
      fitScore: int("fitScore"),
      fitScoreData: text("fitScoreData"),
      // JSON FitScoreResult
      briefData: text("briefData"),
      // JSON SalesIntelligenceBrief
      briefGeneratedAt: timestamp("briefGeneratedAt"),
      salesApproachData: text("salesApproachData"),
      // JSON SalesApproach
      salesApproachGeneratedAt: timestamp("salesApproachGeneratedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      serperApiKey: process.env.SERPER_API_KEY ?? "",
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
      telegramChatId: process.env.TELEGRAM_CHAT_ID ?? ""
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addExcludedCode: () => addExcludedCode,
  archiveSearch: () => archiveSearch,
  countCompaniesByNicheId: () => countCompaniesByNicheId,
  countCompaniesBySearchId: () => countCompaniesBySearchId,
  countWebhookLogs: () => countWebhookLogs,
  createBatchJob: () => createBatchJob,
  createCompanies: () => createCompanies,
  createCompanyDecision: () => createCompanyDecision,
  createContact: () => createContact,
  createNiche: () => createNiche,
  createOfferingBrain: () => createOfferingBrain,
  createSalesPackage: () => createSalesPackage,
  createSearch: () => createSearch,
  deleteBomCalculation: () => deleteBomCalculation,
  deleteNichesByParentId: () => deleteNichesByParentId,
  deleteNichesBySearchId: () => deleteNichesBySearchId,
  deleteOfferingBrain: () => deleteOfferingBrain,
  getActiveBrain: () => getActiveBrain,
  getAllBrainOutputsForCompany: () => getAllBrainOutputsForCompany,
  getBatchJob: () => getBatchJob,
  getBomCalculationsByCompany: () => getBomCalculationsByCompany,
  getBrainHistory: () => getBrainHistory,
  getCallTodayCompanies: () => getCallTodayCompanies,
  getCompaniesByNicheId: () => getCompaniesByNicheId,
  getCompaniesBySearchId: () => getCompaniesBySearchId,
  getCompaniesBySearchIdPaged: () => getCompaniesBySearchIdPaged,
  getCompanyBrainOutput: () => getCompanyBrainOutput,
  getCompanyBrainOutputsForSearch: () => getCompanyBrainOutputsForSearch,
  getCompanyById: () => getCompanyById,
  getCompanyDecision: () => getCompanyDecision,
  getContactByApolloPersonId: () => getContactByApolloPersonId,
  getContactByCompanyId: () => getContactByCompanyId,
  getContactById: () => getContactById,
  getContactsByCompanyId: () => getContactsByCompanyId,
  getDb: () => getDb,
  getDecisionsBySearch: () => getDecisionsBySearch,
  getExcludedCodes: () => getExcludedCodes,
  getLatestBatchJobForSearch: () => getLatestBatchJobForSearch,
  getLatestBomCalculation: () => getLatestBomCalculation,
  getNicheById: () => getNicheById,
  getNichesByParentId: () => getNichesByParentId,
  getNichesBySearchId: () => getNichesBySearchId,
  getNichesByUserId: () => getNichesByUserId,
  getOfferingBrainById: () => getOfferingBrainById,
  getPendingCompaniesBySearchId: () => getPendingCompaniesBySearchId,
  getPreviousOffering: () => getPreviousOffering,
  getSalesPackageByCompanyId: () => getSalesPackageByCompanyId,
  getSearchById: () => getSearchById,
  getUserByOpenId: () => getUserByOpenId,
  getUserSearches: () => getUserSearches,
  getWebhookLogs: () => getWebhookLogs,
  insertWebhookLog: () => insertWebhookLog,
  removeExcludedCode: () => removeExcludedCode,
  saveBomCalculation: () => saveBomCalculation,
  setContactPhonePending: () => setContactPhonePending,
  setOfferingBrainActive: () => setOfferingBrainActive,
  toggleShareSearch: () => toggleShareSearch,
  updateBatchJob: () => updateBatchJob,
  updateBomCalculation: () => updateBomCalculation,
  updateCompany: () => updateCompany,
  updateContactPhone: () => updateContactPhone,
  updateNiche: () => updateNiche,
  updateOfferingBrain: () => updateOfferingBrain,
  updateSalesPackage: () => updateSalesPackage,
  updateSearch: () => updateSearch,
  upsertCompanyBrainOutput: () => upsertCompanyBrainOutput,
  upsertUser: () => upsertUser
});
import { eq, and, or, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createSearch(search) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(searches).values(search);
  return result[0].insertId;
}
async function updateSearch(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(searches).set(updates).where(eq(searches.id, id));
}
async function getSearchById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(searches).where(eq(searches.id, id)).limit(1);
  return result[0];
}
async function getUserSearches(userId, showArchived = false) {
  const db = await getDb();
  if (!db) return [];
  const baseCondition = or(
    eq(searches.userId, userId),
    eq(searches.sharedWithTeam, 1)
  );
  const archiveCondition = showArchived ? void 0 : eq(searches.isArchived, 0);
  const whereClause = archiveCondition ? and(baseCondition, archiveCondition) : baseCondition;
  const rows = await db.select({ search: searches, brainName: offeringBrain.brainName, userName: users.name, userEmail: users.email }).from(searches).leftJoin(offeringBrain, eq(searches.brainId, offeringBrain.id)).leftJoin(users, eq(searches.userId, users.id)).where(whereClause).orderBy(desc(searches.createdAt));
  return rows.map((r) => ({ ...r.search, brainName: r.brainName ?? null, userName: r.userName ?? null, userEmail: r.userEmail ?? null }));
}
async function archiveSearch(searchId, userId, archive) {
  const db = await getDb();
  if (!db) return;
  await db.update(searches).set({ isArchived: archive ? 1 : 0 }).where(eq(searches.id, searchId));
}
async function toggleShareSearch(searchId, ownerId, shared) {
  const db = await getDb();
  if (!db) return;
  await db.update(searches).set({ sharedWithTeam: shared ? 1 : 0 }).where(and(eq(searches.id, searchId), eq(searches.userId, ownerId)));
}
async function getPreviousOffering(userId, websiteUrl) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(searches).where(and(
    eq(searches.userId, userId),
    eq(searches.companyWebsite, websiteUrl)
  )).orderBy(desc(searches.createdAt)).limit(1);
  return result[0];
}
async function createCompanies(companyList) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (companyList.length === 0) return;
  await db.insert(companies).values(companyList);
}
async function getCompaniesBySearchId(searchId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(eq(companies.searchId, searchId));
}
async function getCompaniesBySearchIdPaged(searchId, limit = 100, offset = 0) {
  const { desc: desc4 } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
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
    sliceMetadata: companies.sliceMetadata
    // Presence flags — kept as small booleans would be ideal but the
    // existing frontend code reads these fields directly; keeping them
    // in the list query avoids a cascade of frontend changes.
    // briefData and salesApproachData are intentionally excluded from the list
    // query to keep the payload small (~200KB vs 8MB). The quick-view modal
    // and company detail pages fetch them on demand via getCompany.
  }).from(companies).where(eq(companies.searchId, searchId)).orderBy(desc4(companies.fitScore), desc4(companies.urgencyScore)).limit(limit).offset(offset);
}
async function countCompaniesBySearchId(searchId) {
  const { count: count2 } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count2() }).from(companies).where(eq(companies.searchId, searchId));
  return result[0]?.total ?? 0;
}
async function getCompaniesByNicheId(nicheId, limit = 500, offset = 0) {
  const { and: and10 } = await import("drizzle-orm");
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
    createdAt: companies.createdAt
  }).from(companies).where(eq(companies.nicheId, nicheId)).limit(limit).offset(offset);
}
async function countCompaniesByNicheId(nicheId) {
  const { count: count2 } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count2() }).from(companies).where(eq(companies.nicheId, nicheId));
  return result[0]?.total ?? 0;
}
async function getCompanyById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}
async function updateCompany(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set(updates).where(eq(companies.id, id));
}
async function getPendingCompaniesBySearchId(searchId) {
  const { and: and10 } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(
    and10(eq(companies.searchId, searchId), eq(companies.enrichmentStatus, "pending"))
  );
}
async function createSalesPackage(pkg) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(salesPackages).values(pkg);
  return result[0].insertId;
}
async function getSalesPackageByCompanyId(companyId) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(salesPackages).where(eq(salesPackages.companyId, companyId)).limit(1);
  return results.length > 0 ? results[0] : null;
}
async function updateSalesPackage(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(salesPackages).set(updates).where(eq(salesPackages.id, id));
}
async function createCompanyDecision(decision) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companyDecisions).values(decision);
  return result[0].insertId;
}
async function getCompanyDecision(companyId, userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(companyDecisions).where(and(
    eq(companyDecisions.companyId, companyId),
    eq(companyDecisions.userId, userId)
  )).orderBy(desc(companyDecisions.decidedAt)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getDecisionsBySearch(searchId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companyDecisions).where(eq(companyDecisions.searchId, searchId)).orderBy(desc(companyDecisions.decidedAt));
}
async function addExcludedCode(code) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(excludedCodes).where(and(
    eq(excludedCodes.userId, code.userId),
    eq(excludedCodes.codeType, code.codeType),
    eq(excludedCodes.code, code.code)
  )).limit(1);
  if (existing.length > 0) {
    await db.update(excludedCodes).set({
      rejectionCount: existing[0].rejectionCount + 1,
      lastRejectedAt: /* @__PURE__ */ new Date()
    }).where(eq(excludedCodes.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(excludedCodes).values(code);
    return result[0].insertId;
  }
}
async function getExcludedCodes(userId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(excludedCodes).where(eq(excludedCodes.userId, userId)).orderBy(desc(excludedCodes.rejectionCount));
}
async function removeExcludedCode(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(excludedCodes).where(and(
    eq(excludedCodes.id, id),
    eq(excludedCodes.userId, userId)
  ));
}
async function createContact(contact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(contacts).values(contact);
  const [created] = await db.select().from(contacts).where(eq(contacts.id, inserted.insertId));
  return created;
}
async function getContactByCompanyId(companyId) {
  const db = await getDb();
  if (!db) return null;
  const [contact] = await db.select().from(contacts).where(eq(contacts.companyId, companyId)).orderBy(desc(contacts.createdAt)).limit(1);
  return contact || null;
}
async function getCallTodayCompanies(userId) {
  const db = await getDb();
  if (!db) return [];
  const decisions = await db.select({
    company: companies,
    decision: companyDecisions
  }).from(companyDecisions).innerJoin(companies, eq(companyDecisions.companyId, companies.id)).where(and(
    eq(companyDecisions.userId, userId),
    eq(companyDecisions.decision, "call_today")
  )).orderBy(desc(companyDecisions.decidedAt));
  const uniqueCompanies = /* @__PURE__ */ new Map();
  for (const row of decisions) {
    if (!uniqueCompanies.has(row.company.id)) {
      uniqueCompanies.set(row.company.id, row);
    }
  }
  return Array.from(uniqueCompanies.values());
}
async function createOfferingBrain(brain) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(offeringBrain).set({ isActive: 0 }).where(and(
    eq(offeringBrain.userId, brain.userId),
    eq(offeringBrain.isActive, 1)
  ));
  const [inserted] = await db.insert(offeringBrain).values(brain);
  return inserted.insertId;
}
async function getActiveBrain(userId) {
  const db = await getDb();
  if (!db) return null;
  const activeBrains = await db.select().from(offeringBrain).where(and(
    or(
      eq(offeringBrain.userId, userId),
      eq(offeringBrain.isShared, 1)
    ),
    eq(offeringBrain.isActive, 1)
  )).orderBy(desc(offeringBrain.updatedAt));
  if (activeBrains.length === 0) return null;
  if (activeBrains.length > 1) {
    const keepId = activeBrains[0].id;
    await db.update(offeringBrain).set({ isActive: 0 }).where(and(eq(offeringBrain.userId, userId), eq(offeringBrain.isActive, 1)));
    await db.update(offeringBrain).set({ isActive: 1 }).where(eq(offeringBrain.id, keepId));
    console.warn(`[Brain] Self-healing: found ${activeBrains.length} active brains for user ${userId}. Kept brain ${keepId}, deactivated the rest.`);
  }
  return activeBrains[0];
}
async function updateOfferingBrain(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(offeringBrain).set(updates).where(eq(offeringBrain.id, id));
}
async function getBrainHistory(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(offeringBrain).where(or(
    eq(offeringBrain.userId, userId),
    eq(offeringBrain.isShared, 1)
  )).orderBy(desc(offeringBrain.createdAt));
}
async function setOfferingBrainActive(brainId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [brain] = await db.select().from(offeringBrain).where(and(
    eq(offeringBrain.id, brainId),
    or(
      eq(offeringBrain.userId, userId),
      eq(offeringBrain.isShared, 1)
    )
  )).limit(1);
  if (!brain) {
    throw new Error("Brain not found or access denied");
  }
  await db.update(offeringBrain).set({ isActive: 0 }).where(eq(offeringBrain.userId, userId));
  await db.update(offeringBrain).set({ isActive: 1 }).where(eq(offeringBrain.id, brainId));
}
async function deleteOfferingBrain(brainId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [brain] = await db.select().from(offeringBrain).where(and(
    eq(offeringBrain.id, brainId),
    eq(offeringBrain.userId, userId)
  )).limit(1);
  if (!brain) {
    throw new Error("Brain not found or does not belong to user");
  }
  if (brain.isActive === 1) {
    throw new Error("Cannot delete active brain. Please activate another brain first.");
  }
  await db.delete(offeringBrain).where(eq(offeringBrain.id, brainId));
}
async function getOfferingBrainById(brainId, userId) {
  const db = await getDb();
  if (!db) return null;
  const [brain] = await db.select().from(offeringBrain).where(and(
    eq(offeringBrain.id, brainId),
    or(
      eq(offeringBrain.userId, userId),
      eq(offeringBrain.isShared, 1)
    )
  )).limit(1);
  return brain || null;
}
async function getContactsByCompanyId(companyId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.companyId, companyId)).orderBy(desc(contacts.createdAt));
}
async function getContactById(contactId) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  return results[0] ?? null;
}
async function getContactByApolloPersonId(apolloPersonId) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(contacts).where(eq(contacts.apolloPersonId, apolloPersonId)).limit(1);
  return results[0] ?? null;
}
async function updateContactPhone(contactId, phone) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set({ phone, phonePending: 0 }).where(eq(contacts.id, contactId));
}
async function setContactPhonePending(contactId, pending) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set({ phonePending: pending ? 1 : 0 }).where(eq(contacts.id, contactId));
}
async function createNiche(niche) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(niches).values(niche);
  return result[0].insertId;
}
async function getNichesBySearchId(searchId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(niches).where(eq(niches.searchId, searchId)).orderBy(desc(niches.fitScore));
}
async function getNichesByUserId(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(niches).where(eq(niches.userId, userId)).orderBy(desc(niches.fitScore));
}
async function getNicheById(id) {
  const db = await getDb();
  if (!db) return null;
  const [niche] = await db.select().from(niches).where(eq(niches.id, id)).limit(1);
  return niche || null;
}
async function updateNiche(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(niches).set(updates).where(eq(niches.id, id));
}
async function deleteNichesBySearchId(searchId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(niches).where(eq(niches.searchId, searchId));
}
async function getNichesByParentId(parentNicheId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(niches).where(eq(niches.parentNicheId, parentNicheId)).orderBy(desc(niches.fitScore));
}
async function deleteNichesByParentId(parentNicheId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(niches).where(eq(niches.parentNicheId, parentNicheId));
}
async function createBatchJob(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(batchJobs).values(data);
  const [job] = await db.select().from(batchJobs).where(eq(batchJobs.id, data.id)).limit(1);
  return job;
}
async function getBatchJob(id) {
  const db = await getDb();
  if (!db) return null;
  const [job] = await db.select().from(batchJobs).where(eq(batchJobs.id, id)).limit(1);
  return job ?? null;
}
async function updateBatchJob(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(batchJobs).set(updates).where(eq(batchJobs.id, id));
}
async function getLatestBatchJobForSearch(searchId) {
  const db = await getDb();
  if (!db) return null;
  const [job] = await db.select().from(batchJobs).where(eq(batchJobs.searchId, searchId)).orderBy(desc(batchJobs.createdAt)).limit(1);
  return job ?? null;
}
async function saveBomCalculation(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bomCalculations).values(data);
  return result[0].insertId;
}
async function updateBomCalculation(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bomCalculations).set(updates).where(eq(bomCalculations.id, id));
}
async function getBomCalculationsByCompany(companyId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bomCalculations).where(eq(bomCalculations.companyId, companyId)).orderBy(desc(bomCalculations.createdAt));
}
async function getLatestBomCalculation(companyId) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(bomCalculations).where(eq(bomCalculations.companyId, companyId)).orderBy(desc(bomCalculations.createdAt)).limit(1);
  return row ?? null;
}
async function deleteBomCalculation(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bomCalculations).where(and(eq(bomCalculations.id, id), eq(bomCalculations.userId, userId)));
}
async function insertWebhookLog(entry) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(apolloWebhookLogs).values(entry);
  } catch (err) {
    console.error("[WebhookLog] Failed to insert audit row:", err);
  }
}
async function getWebhookLogs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apolloWebhookLogs).orderBy(desc(apolloWebhookLogs.receivedAt)).limit(limit).offset(offset);
}
async function countWebhookLogs() {
  const { count: count2 } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: count2() }).from(apolloWebhookLogs);
  return result[0]?.total ?? 0;
}
async function upsertCompanyBrainOutput(companyId, brainId, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(companyBrainOutputs).values({ companyId, brainId, ...updates }).onDuplicateKeyUpdate({ set: updates });
}
async function getCompanyBrainOutput(companyId, brainId) {
  const db = await getDb();
  if (!db) return null;
  const { and: and10 } = await import("drizzle-orm");
  const rows = await db.select().from(companyBrainOutputs).where(and10(eq(companyBrainOutputs.companyId, companyId), eq(companyBrainOutputs.brainId, brainId))).limit(1);
  return rows[0] ?? null;
}
async function getCompanyBrainOutputsForSearch(companyIds, brainId) {
  const db = await getDb();
  const map = /* @__PURE__ */ new Map();
  if (!db || companyIds.length === 0) return map;
  const { inArray: inArray9, and: and10 } = await import("drizzle-orm");
  const rows = await db.select().from(companyBrainOutputs).where(and10(inArray9(companyBrainOutputs.companyId, companyIds), eq(companyBrainOutputs.brainId, brainId)));
  for (const row of rows) map.set(row.companyId, row);
  return map;
}
async function getAllBrainOutputsForCompany(companyId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
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
    brainName: offeringBrain.brainName
  }).from(companyBrainOutputs).leftJoin(offeringBrain, eq(companyBrainOutputs.brainId, offeringBrain.id)).where(eq(companyBrainOutputs.companyId, companyId));
  return rows;
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
  }
});

// server/apolloPeopleSearch.ts
var apolloPeopleSearch_exports = {};
__export(apolloPeopleSearch_exports, {
  SENIORITY_TIERS: () => SENIORITY_TIERS,
  enrichPerson: () => enrichPerson,
  getAllPersonnel: () => getAllPersonnel,
  searchApolloContacts: () => searchApolloContacts,
  trickleDownSearch: () => trickleDownSearch
});
import axios2 from "axios";
async function searchPeopleAtCompany(apiKey, companyDomain, jobTitle, limit = 3) {
  const cleanDomain = companyDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase().trim();
  console.log(`[Apollo People Search] Step 1: Searching for "${jobTitle}" at domain "${cleanDomain}"`);
  const requestBody = {
    page: 1,
    per_page: limit,
    // CRITICAL: correct parameter name with array notation
    q_organization_domains_list: [cleanDomain],
    person_titles: [jobTitle]
  };
  console.log(`[Apollo People Search] Request body:`, JSON.stringify(requestBody, null, 2));
  const response = await axios2.post(
    "https://api.apollo.io/api/v1/mixed_people/search",
    requestBody,
    {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json"
      },
      timeout: 15e3
    }
  );
  const people = response.data.people || [];
  const totalEntries = response.data.total_entries || 0;
  console.log(`[Apollo People Search] Found ${people.length} people (total_entries: ${totalEntries})`);
  if (people.length > 0) {
    console.log(`[Apollo People Search] First result:`, JSON.stringify({
      name: people[0].name,
      title: people[0].title,
      organization: people[0].organization?.name,
      linkedin_url: people[0].linkedin_url,
      email: people[0].email
      // Should be null from api_search
    }, null, 2));
  }
  return people.map((person) => ({
    id: person.id || "",
    firstName: person.first_name || "",
    lastName: person.last_name || "",
    name: person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim(),
    title: person.title || jobTitle,
    linkedinUrl: person.linkedin_url || void 0,
    organizationName: person.organization?.name || void 0
  }));
}
async function enrichPerson(firstName, lastName, companyDomain, includePhone = false, webhookUrl) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }
  const cleanDomain = companyDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase().trim();
  console.log(`[Apollo People Enrich] Step 2: Enriching ${firstName} ${lastName} at ${cleanDomain}`);
  try {
    const requestBody = {
      first_name: firstName,
      last_name: lastName,
      domain: cleanDomain,
      reveal_personal_emails: true
    };
    if (includePhone) {
      requestBody.reveal_phone_number = true;
      console.log(`[Apollo People Enrich] \u26A0\uFE0F  WARNING: Phone enrichment enabled (8 credits per net-new phone)`);
      const effectiveWebhookUrl = webhookUrl || process.env.APP_URL && `${process.env.APP_URL}/api/apollo-webhook`;
      if (effectiveWebhookUrl) {
        requestBody.webhook_url = effectiveWebhookUrl;
        console.log(`[Apollo People Enrich] Phone webhook URL: ${effectiveWebhookUrl}`);
      } else {
        console.warn(`[Apollo People Enrich] No webhook URL available \u2014 phone enrichment may fail. Set APP_URL env var.`);
      }
    }
    console.log(`[Apollo People Enrich] Request body:`, JSON.stringify(requestBody, null, 2));
    const response = await axios2.post(
      "https://api.apollo.io/api/v1/people/match",
      requestBody,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 15e3
      }
    );
    const person = response.data.person;
    if (!person) {
      console.log(`[Apollo People Enrich] No enrichment data returned`);
      return {};
    }
    const phoneNow = person.sanitized_phone || person.phone || void 0;
    const phonePending = includePhone && !phoneNow;
    if (phonePending) {
      console.log(`[Apollo People Enrich] Phone pending \u2014 will be delivered via webhook for person ${person.id}`);
    }
    console.log(`[Apollo People Enrich] Enriched result:`, JSON.stringify({
      name: person.name,
      email: person.email,
      phone: person.sanitized_phone,
      linkedin_url: person.linkedin_url,
      organization: person.organization?.name
    }, null, 2));
    return {
      email: person.email || void 0,
      phone: phoneNow,
      linkedinUrl: person.linkedin_url || void 0,
      phonePending,
      apolloPersonId: person.id || void 0
    };
  } catch (error) {
    if (axios2.isAxiosError(error)) {
      console.error("[Apollo People Enrich Error] Status:", error.response?.status);
      console.error("[Apollo People Enrich Error] Response:", JSON.stringify(error.response?.data, null, 2));
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo People Enrich error: ${errorMsg}`);
    }
    throw error;
  }
}
async function searchPeopleBySeniority(apiKey, companyDomain, seniorities, limit = 5) {
  const cleanDomain = companyDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase().trim();
  console.log(`[Apollo Seniority Search] Searching seniorities [${seniorities.join(", ")}] at domain "${cleanDomain}"`);
  const requestBody = {
    page: 1,
    per_page: limit,
    q_organization_domains_list: [cleanDomain],
    person_seniorities: [...seniorities]
  };
  const response = await axios2.post(
    "https://api.apollo.io/api/v1/mixed_people/search",
    requestBody,
    {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json"
      },
      timeout: 15e3
    }
  );
  const people = response.data.people || [];
  const totalEntries = response.data.total_entries || 0;
  console.log(`[Apollo Seniority Search] Found ${people.length} people (total_entries: ${totalEntries})`);
  return people.map((person) => ({
    id: person.id || "",
    firstName: person.first_name || "",
    lastName: person.last_name || "",
    name: person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim(),
    title: person.title || "",
    seniority: person.seniority || void 0,
    linkedinUrl: person.linkedin_url || void 0,
    organizationName: person.organization?.name || void 0
  }));
}
async function getAllPersonnel(companyDomain, companyName, maxResults = 500, seniorities, department) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }
  const cleanDomain = companyDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase().trim();
  console.log(`[Apollo All Personnel] Searching for all people at domain "${cleanDomain}" (max: ${maxResults})`);
  const allPeople = [];
  let currentPage = 1;
  const perPage = 100;
  let totalEntries = 0;
  while (allPeople.length < maxResults) {
    const requestBody = {
      page: currentPage,
      per_page: perPage,
      q_organization_domains_list: [cleanDomain],
      ...seniorities && seniorities.length > 0 ? { person_seniorities: seniorities } : {},
      ...department && department !== "any" ? { person_departments: [department] } : {}
    };
    console.log(`[Apollo All Personnel] Fetching page ${currentPage}...`);
    const response = await axios2.post(
      "https://api.apollo.io/api/v1/mixed_people/search",
      requestBody,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 15e3
      }
    );
    const people = response.data.people || [];
    totalEntries = response.data.total_entries || 0;
    if (people.length === 0) {
      console.log(`[Apollo All Personnel] No more results on page ${currentPage}`);
      break;
    }
    allPeople.push(...people);
    console.log(`[Apollo All Personnel] Page ${currentPage}: ${people.length} people (total so far: ${allPeople.length})`);
    if (allPeople.length >= maxResults) {
      console.log(`[Apollo All Personnel] Reached maxResults limit of ${maxResults}`);
      break;
    }
    if (people.length < perPage) {
      console.log(`[Apollo All Personnel] Received partial page (${people.length}/${perPage}), no more results available`);
      break;
    }
    currentPage++;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.log(`[Apollo All Personnel] Completed: ${allPeople.length} people fetched (total available: ${totalEntries})`);
  const basicContacts = allPeople.slice(0, maxResults).map((person) => ({
    id: person.id || "",
    firstName: person.first_name || "",
    lastName: person.last_name || "",
    name: person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim(),
    title: person.title || "",
    linkedinUrl: person.linkedin_url || void 0,
    companyName: person.organization?.name || companyName
    // email and phone are undefined - will be enriched separately if needed
  }));
  return {
    contacts: basicContacts,
    totalFound: totalEntries
  };
}
async function trickleDownSearch(companyDomain, companyName, maxContactsPerTier = 5, includePhone = false, startTier = 1) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }
  const tiersSearched = [];
  for (const tier of SENIORITY_TIERS) {
    if (tier.level < startTier) continue;
    try {
      const searchResults = await searchPeopleBySeniority(
        apiKey,
        companyDomain,
        tier.seniorities,
        maxContactsPerTier
      );
      tiersSearched.push({ level: tier.level, label: tier.label, count: searchResults.length });
      if (searchResults.length > 0) {
        console.log(`[Trickle-Down] \u2713 Found ${searchResults.length} contacts at Tier ${tier.level} (${tier.label})`);
        const enrichedContacts = [];
        for (const person of searchResults) {
          const contact = {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            name: person.name,
            title: person.title,
            linkedinUrl: person.linkedinUrl,
            companyName: person.organizationName
          };
          if (contact.firstName && contact.lastName) {
            try {
              const enriched = await enrichPerson(
                contact.firstName,
                contact.lastName,
                companyDomain,
                includePhone
              );
              if (enriched.email) contact.email = enriched.email;
              if (enriched.phone) contact.phone = enriched.phone;
              if (enriched.linkedinUrl && !contact.linkedinUrl) {
                contact.linkedinUrl = enriched.linkedinUrl;
              }
            } catch (enrichError) {
              console.error(`[Trickle-Down] Enrichment failed for ${contact.name}:`, enrichError.message);
            }
          }
          enrichedContacts.push(contact);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        return {
          contacts: enrichedContacts,
          tierFound: tier.level,
          tierLabel: tier.label,
          tiersSearched
        };
      }
      console.log(`[Trickle-Down] \u2717 No contacts at Tier ${tier.level} (${tier.label}), trying next tier...`);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`[Trickle-Down] Error at Tier ${tier.level}:`, error.message);
      tiersSearched.push({ level: tier.level, label: tier.label, count: 0 });
    }
  }
  return {
    contacts: [],
    tierFound: 0,
    tierLabel: "None",
    tiersSearched
  };
}
async function searchApolloContacts(params) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }
  const { companyDomain, companyName, jobTitle, limit = 3, includePhone = false } = params;
  try {
    const searchResults = await searchPeopleAtCompany(apiKey, companyDomain, jobTitle, limit);
    if (searchResults.length === 0) {
      console.log(`[Apollo People Search] No contacts found for "${jobTitle}" at ${companyDomain}`);
      return null;
    }
    const bestMatch = searchResults[0];
    if (bestMatch.organizationName && companyName) {
      console.log(`[Apollo People Search] Verifying company match: "${bestMatch.organizationName}" vs "${companyName}"`);
    }
    const contact = {
      id: bestMatch.id,
      firstName: bestMatch.firstName,
      lastName: bestMatch.lastName,
      name: bestMatch.name,
      title: bestMatch.title,
      linkedinUrl: bestMatch.linkedinUrl,
      companyName: bestMatch.organizationName
    };
    if (contact.firstName && contact.lastName) {
      console.log(`[Apollo People Search] Proceeding to enrichment for ${contact.name}...`);
      try {
        const enriched = await enrichPerson(contact.firstName, contact.lastName, companyDomain, includePhone);
        if (enriched.email) {
          contact.email = enriched.email;
          console.log(`[Apollo People Search] \u2713 Email unlocked: ${contact.email}`);
        } else {
          console.log(`[Apollo People Search] \u26A0 Enrichment returned no email`);
        }
        if (enriched.phone) {
          contact.phone = enriched.phone;
          console.log(`[Apollo People Search] \u2713 Phone found: ${contact.phone}`);
        }
        if (enriched.linkedinUrl && !contact.linkedinUrl) {
          contact.linkedinUrl = enriched.linkedinUrl;
        }
      } catch (enrichError) {
        console.error(`[Apollo People Search] Enrichment failed:`, enrichError.message);
      }
    } else {
      console.log(`[Apollo People Search] \u26A0 Cannot enrich - missing first/last name`);
    }
    console.log(`[Apollo People Search] Final contact:`, JSON.stringify(contact, null, 2));
    return contact;
  } catch (error) {
    if (axios2.isAxiosError(error)) {
      console.error("[Apollo People Search Error] Status:", error.response?.status);
      console.error("[Apollo People Search Error] Response:", JSON.stringify(error.response?.data, null, 2));
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo People Search error: ${errorMsg}`);
    }
    throw error;
  }
}
var SENIORITY_TIERS;
var init_apolloPeopleSearch = __esm({
  "server/apolloPeopleSearch.ts"() {
    "use strict";
    SENIORITY_TIERS = [
      { level: 1, label: "C-Suite / Owner", seniorities: ["owner", "founder", "c_suite", "partner"] },
      { level: 2, label: "VP / Head", seniorities: ["vp", "head"] },
      { level: 3, label: "Director", seniorities: ["director"] },
      { level: 4, label: "Manager", seniorities: ["manager"] },
      { level: 5, label: "Senior / Entry", seniorities: ["senior", "entry"] }
    ];
  }
});

// server/_core/llm.ts
var llm_exports = {};
__export(llm_exports, {
  invokeLLM: () => invokeLLM
});
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/apolloSearch.ts
var apolloSearch_exports = {};
__export(apolloSearch_exports, {
  enrichCompanyDetails: () => enrichCompanyDetails,
  searchApolloCompanies: () => searchApolloCompanies
});
import axios3 from "axios";
function parseTargetMarket(targetMarket) {
  const lower = targetMarket.toLowerCase();
  if (lower.includes("fortune") || lower.includes("global")) {
    return [{ min: 10001, max: null }];
  }
  if (lower.includes("large") || lower.includes("enterprise")) {
    return [
      { min: 501, max: 1e3 },
      { min: 1001, max: 5e3 },
      { min: 5001, max: 1e4 }
    ];
  }
  if (lower.includes("mid-market") || lower.includes("medium") || lower.includes("mid-sized")) {
    return [
      { min: 51, max: 200 },
      { min: 201, max: 500 },
      { min: 501, max: 1e3 }
    ];
  }
  if (lower.includes("smb") || lower.includes("small")) {
    return [
      { min: 11, max: 50 },
      { min: 51, max: 200 }
    ];
  }
  return [
    { min: 51, max: 200 },
    { min: 201, max: 500 },
    { min: 501, max: 1e3 },
    { min: 1001, max: 5e3 },
    { min: 5001, max: 1e4 }
  ];
}
function normalizeLocation(location) {
  const trimmed = location.trim();
  const stateMap = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia"
  };
  const cityStateMatch = trimmed.match(/^[A-Za-z\s]+,\s*([A-Z]{2})$/);
  if (cityStateMatch) {
    const stateAbbr = cityStateMatch[1];
    const stateName = stateMap[stateAbbr];
    if (stateName) {
      console.log(`[Location Parser] "${trimmed}" \u2192 "${stateName}, USA" (state-wide)`);
      return `${stateName}, USA`;
    }
  }
  if (/^[A-Z]{2}$/.test(trimmed)) {
    const stateName = stateMap[trimmed];
    if (stateName) {
      console.log(`[Location Parser] "${trimmed}" \u2192 "${stateName}, USA" (state-wide)`);
      return `${stateName}, USA`;
    }
  }
  const stateNames = Object.values(stateMap).map((s) => s.toLowerCase());
  if (stateNames.includes(trimmed.toLowerCase())) {
    const properStateName = Object.values(stateMap).find((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (properStateName) {
      console.log(`[Location Parser] "${trimmed}" \u2192 "${properStateName}, USA" (state-wide)`);
      return `${properStateName}, USA`;
    }
  }
  console.log(`[Location Parser] "${trimmed}" \u2192 "${trimmed}" (as-is)`);
  return trimmed;
}
async function searchApolloCompanies(params) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }
  const { targetMarketKeywordTags, targetMarket, location, limit = 100, employeeRanges: customEmployeeRanges } = params;
  const normalizedLocation = normalizeLocation(location);
  const employeeRanges = customEmployeeRanges || parseTargetMarket(targetMarket);
  const keywordTags = targetMarketKeywordTags.slice(0, 10);
  console.log(`[Apollo Search] Location: ${normalizedLocation}`);
  console.log(`[Apollo Search] Keyword tags: ${JSON.stringify(keywordTags)}`);
  console.log(`[Apollo Search] Employee ranges: ${JSON.stringify(employeeRanges)}`);
  console.log(`[Apollo Search] Target limit: ${limit}`);
  try {
    const companies2 = [];
    let page = 1;
    const perPage = 100;
    let totalFound = 0;
    while (companies2.length < limit) {
      const requestBody = {
        page,
        per_page: perPage,
        organization_locations: [normalizedLocation],
        q_organization_keyword_tags: keywordTags,
        organization_num_employees_ranges: employeeRanges.map(
          (range) => range.max ? `${range.min},${range.max}` : `${range.min},`
        )
      };
      console.log(`[Apollo Search] Page ${page} request...`);
      const response = await axios3.post(
        "https://api.apollo.io/api/v1/mixed_companies/search",
        requestBody,
        {
          headers: {
            "X-Api-Key": apiKey,
            "Content-Type": "application/json"
          },
          timeout: 3e4
        }
      );
      totalFound = response.data.pagination?.total_entries || 0;
      const results = response.data.organizations || [];
      if (results.length === 0) {
        break;
      }
      for (const company of results) {
        const mapped = {
          id: company.id,
          name: company.name,
          website_url: company.website_url,
          primary_domain: company.primary_domain,
          linkedin_url: company.linkedin_url,
          phone: company.phone || company.primary_phone?.number,
          founded_year: company.founded_year,
          organization_revenue_printed: company.organization_revenue_printed,
          organization_revenue: company.organization_revenue,
          organization_headcount_six_month_growth: company.organization_headcount_six_month_growth,
          organization_headcount_twelve_month_growth: company.organization_headcount_twelve_month_growth,
          sic_codes: company.sic_codes || [],
          naics_codes: company.naics_codes || []
          // No location data yet - that comes from enrichment
        };
        companies2.push(mapped);
      }
      console.log(`[Apollo Search] Page ${page}: got ${results.length} results, total collected: ${companies2.length}/${totalFound}`);
      if (companies2.length >= limit || companies2.length >= totalFound) {
        break;
      }
      page++;
    }
    console.log(`[Apollo Search] Done. Collected ${companies2.length} companies out of ${totalFound} total.`);
    return {
      companies: companies2.slice(0, limit),
      keywordTagsUsed: keywordTags,
      totalFound
    };
  } catch (error) {
    if (axios3.isAxiosError(error)) {
      console.error("[Apollo API Error] Status:", error.response?.status);
      console.error("[Apollo API Error] Response:", JSON.stringify(error.response?.data, null, 2));
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo API error: ${errorMsg}`);
    }
    throw error;
  }
}
async function enrichCompanyDetails(apolloId) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }
  try {
    const response = await axios3.get(
      `https://api.apollo.io/api/v1/organizations/${apolloId}`,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 1e4
      }
    );
    const org = response.data.organization || {};
    return {
      city: org.city || void 0,
      state: org.state || void 0,
      country: org.country || void 0,
      street_address: org.street_address || void 0,
      raw_address: org.raw_address || void 0
    };
  } catch (error) {
    console.warn(`[Apollo] Failed to enrich company ${apolloId}:`, error instanceof Error ? error.message : error);
    throw error;
  }
}
var init_apolloSearch = __esm({
  "server/apolloSearch.ts"() {
    "use strict";
  }
});

// server/prompts/selectIndustryCodes.ts
function buildCodeSelectionPrompt(offering) {
  return `You are an industry classification expert helping identify potential customers for a B2B offering.

**OFFERING ANALYSIS**

Offering Name: ${offering.offeringName}

Description: ${offering.offeringDescription}

Target Market: ${offering.targetMarket}

Value Proposition: ${offering.valueProposition}

---

**YOUR TASK**

Identify which SIC and NAICS codes represent companies that would be **potential customers** for this offering.

**CRITICAL: USE HIERARCHICAL NAICS REASONING**

NAICS is a hierarchical economic behavior map. Each extra digit narrows how a company operates:

\`\`\`
XX      = Sector (macro economy role)        \u2192 e.g., "31-33" = Manufacturing
XXX     = Subsector (business function type)  \u2192 e.g., "333" = Machinery Manufacturing
XXXX    = Industry group (production style)   \u2192 e.g., "3332" = Industrial Machinery
XXXXX   = Industry (market niche)             \u2192 e.g., "33324" = Industrial Machinery Mfg
XXXXXX  = National specialization             \u2192 e.g., "333249" = Other Industrial Machinery
\`\`\`

The 20 NAICS sectors (modern economy map):

| Sector | Official Name                              | What it really represents |
|--------|-------------------------------------------|--------------------------|
| 11     | Agriculture, Forestry, Fishing & Hunting  | Resource extraction & cultivation |
| 21     | Mining, Quarrying & Oil/Gas Extraction    | Raw materials |
| 22     | Utilities                                  | Infrastructure utilities |
| 23     | Construction                               | Built environment |
| 31-33  | Manufacturing                              | Physical production |
| 42     | Wholesale Trade                            | B2B distribution |
| 44-45  | Retail Trade                               | Consumer trade |
| 48-49  | Transportation & Warehousing              | Logistics |
| 51     | Information                                | Data/media/software |
| 52     | Finance & Insurance                        | Money & risk |
| 53     | Real Estate & Rental/Leasing              | Assets |
| 54     | Professional, Scientific & Technical      | Knowledge work |
| 55     | Management of Companies                    | Holding/control |
| 56     | Administrative & Support Services         | Operational services |
| 61     | Educational Services                       | Human capital |
| 62     | Health Care & Social Assistance           | Care economy |
| 71     | Arts, Entertainment & Recreation          | Experience economy |
| 72     | Accommodation & Food Services             | Hospitality |
| 81     | Other Services                             | Personal & repair |
| 92     | Public Administration                      | Government |

**YOU CAN MIX ABSTRACTION LEVELS.** Use this strategically:

- Use **2-digit sector codes** when an ENTIRE sector is relevant (e.g., "22" for all utilities)
- Use **3-digit subsector codes** for broad coverage (e.g., "333" for all machinery manufacturing)
- Use **4-6 digit codes** only when you need to be specific within a sector

This is much more powerful than listing 50 individual 6-digit codes. A single "333" covers ALL machinery manufacturing.

---

**IMPORTANT GUIDELINES:**

1. **Think from the buyer's perspective**: Which industries would NEED or BUY this offering?
   - If the offering is "PCB assembly services", select codes for companies that USE PCBs (electronics manufacturers, medical device makers, automotive electronics), NOT PCB manufacturers themselves
   - If the offering is "industrial automation software", select codes for factories and manufacturers who would IMPLEMENT automation, NOT software companies

2. **Focus on end-users and integrators**: 
   - Manufacturing companies that would integrate this into their products
   - Industries that would deploy this in their operations
   - Companies that would resell or integrate this into larger solutions

3. **Avoid selecting the offering provider's own industry**:
   - If offering is "contract manufacturing", DON'T select contract manufacturer codes
   - If offering is "supply chain software", DON'T select software publisher codes
   - Select the industries that would BUY and USE the offering

4. **Be comprehensive \u2014 use hierarchy to cast a wide net**:
   - Use sector/subsector codes (2-3 digits) for broad coverage of entire market segments
   - Add specific 4-6 digit codes for niche industries not covered by broader codes
   - For each target market segment mentioned, decide the right abstraction level
   - When in doubt, use a BROADER code (fewer digits) to capture more companies
   - Better to have too many matches than too few \u2014 we filter on the backend

5. **SIC codes follow a similar hierarchy**:
   - 2-digit = Major Group (e.g., "35" = Industrial Machinery)
   - 3-digit = Industry Group (e.g., "357" = Computer Equipment)
   - 4-digit = Industry (e.g., "3571" = Electronic Computers)
   - Use the same multi-level strategy for SIC codes

**OUTPUT FORMAT**

Respond with a JSON object in this exact structure:

{
  "sicCodes": ["35", "36", "3714", "3841", ...],
  "naicsCodes": ["333", "334", "336320", "339112", ...],
  "reasoning": "Brief explanation of why these codes were selected, organized by target market segment"
}

**EXAMPLE**

For an offering like "Industrial IoT sensors for predictive maintenance" targeting Manufacturing, Utilities, Oil & Gas, Mining:

{
  "sicCodes": ["10", "12", "13", "14", "20", "22", "24", "26", "28", "29", "30", "32", "33", "34", "35", "36", "37", "49", "1381", "1382", "1389"],
  "naicsCodes": ["21", "22", "31", "32", "33", "48", "211130", "213111", "213112", "486210", "486910", "562211"],
  "reasoning": "Used broad sector codes for maximum coverage: Manufacturing (SIC 20-37, NAICS 31-33) covers all factories with equipment needing predictive maintenance. Mining (SIC 10-14, NAICS 21) and Utilities (SIC 49, NAICS 22) are heavy equipment sectors. Added specific codes for oil/gas services (1381-1389, 213111-213112) and pipeline transport (486) as niche segments. Logistics (NAICS 48) included for fleet/equipment monitoring."
}

Notice how mixing 2-digit broad codes with specific 4-6 digit codes gives comprehensive coverage with far fewer codes to manage.

Now analyze the offering above and return your code selection.`;
}
var init_selectIndustryCodes = __esm({
  "server/prompts/selectIndustryCodes.ts"() {
    "use strict";
  }
});

// server/codeSelectionService.ts
async function selectIndustryCodes(offering) {
  console.log(`[Code Selection] Analyzing offering: ${offering.offeringName}`);
  const prompt = buildCodeSelectionPrompt(offering);
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an industry classification expert. Always respond with valid JSON matching the requested schema."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "industry_code_selection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sicCodes: {
                type: "array",
                items: { type: "string" },
                description: "Array of 4-digit SIC codes representing potential customer industries"
              },
              naicsCodes: {
                type: "array",
                items: { type: "string" },
                description: "Array of 6-digit NAICS codes representing potential customer industries"
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of why these codes were selected"
              }
            },
            required: ["sicCodes", "naicsCodes", "reasoning"],
            additionalProperties: false
          }
        }
      }
    });
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);
    const selection = {
      sicCodes: Array.from(new Set(parsed.sicCodes)),
      naicsCodes: Array.from(new Set(parsed.naicsCodes)),
      reasoning: parsed.reasoning
    };
    console.log(`[Code Selection] Selected ${selection.sicCodes.length} SIC codes and ${selection.naicsCodes.length} NAICS codes (deduped from ${parsed.sicCodes.length}/${parsed.naicsCodes.length})`);
    console.log(`[Code Selection] SIC: ${selection.sicCodes.join(", ")}`);
    console.log(`[Code Selection] NAICS: ${selection.naicsCodes.join(", ")}`);
    console.log(`[Code Selection] Reasoning: ${selection.reasoning}`);
    return selection;
  } catch (error) {
    console.error("[Code Selection] Failed:", error);
    throw new Error(`Code selection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
var init_codeSelectionService = __esm({
  "server/codeSelectionService.ts"() {
    "use strict";
    init_llm();
    init_selectIndustryCodes();
  }
});

// shared/naicsHierarchy.ts
function naicsMatchesHierarchically(companyCode, selectedCodes) {
  for (const selected of selectedCodes) {
    if (companyCode.startsWith(selected)) return true;
    if (selected.startsWith(companyCode)) return true;
  }
  return false;
}
var init_naicsHierarchy = __esm({
  "shared/naicsHierarchy.ts"() {
    "use strict";
  }
});

// server/briefGenerator.ts
var briefGenerator_exports = {};
__export(briefGenerator_exports, {
  generateSalesIntelligenceBrief: () => generateSalesIntelligenceBrief,
  scoreCompanyFit: () => scoreCompanyFit
});
async function getBrainContext(userId, brainId) {
  try {
    const brain = brainId ? await getOfferingBrainById(brainId, userId) : await getActiveBrain(userId);
    if (!brain || brain.status !== "completed") return "";
    const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
    const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
    const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
    const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
    const buyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals) : [];
    const fitCriteria = brain.fitCriteria ? JSON.parse(brain.fitCriteria) : { mustHave: [], niceToHave: [], disqualifiers: [] };
    const urgencyTriggers = brain.urgencyTriggers ? JSON.parse(brain.urgencyTriggers) : [];
    return `
**YOUR COMPANY (Seller) \u2014 Offering Brain Intelligence:**
- Company: ${brain.companyName}
- Summary: ${brain.offeringSummary}
- Core Capabilities: ${capabilities.join("; ")}
- Value Propositions: ${valueProps.map((vp) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
- Competitive Advantages: ${brain.competitiveAdvantages}
- ICP Industries: ${icpIndustries.join(", ")}
- ICP Company Size: ${brain.icpCompanySize}
- ICP Pain Points: ${painPoints.join("; ")}
- Buying Signals to Watch: ${buyingSignals.join("; ")}
- Fit Must-Haves: ${fitCriteria.mustHave?.join("; ") || "None"}
- Fit Disqualifiers: ${fitCriteria.disqualifiers?.join("; ") || "None"}
- Urgency Triggers: ${urgencyTriggers.join("; ")}
`;
  } catch (error) {
    console.warn("[Brain Context] Failed to load brain:", error);
    return "";
  }
}
function todayString() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function stripJsonFences(raw) {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}
async function callGrokWithWebSearch2(input, jsonSchema) {
  const responseFormat = jsonSchema ? { type: "json_schema", json_schema: { name: "output", strict: true, schema: jsonSchema } } : { type: "json_object" };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18e4);
  try {
    const response = await fetch(`${XAI_BASE_URL3}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY3}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        tools: [{ type: "web_search" }],
        // Explicit web_search tool
        input,
        response_format: responseFormat
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.content && Array.isArray(item.content)) {
          const textContent = item.content.find((c) => c.type === "output_text");
          if (textContent?.text) {
            return stripJsonFences(textContent.text);
          }
        }
      }
    }
    if (data.text) {
      return stripJsonFences(data.text);
    }
    throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
  } finally {
    clearTimeout(timeoutId);
  }
}
async function generateSalesIntelligenceBrief(companyId, userId, brainId) {
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  console.log(`[Brief Generator] Generating brief for ${company.name}`);
  const domain = company.primaryDomain || company.websiteUrl || "unknown.com";
  const naicsCodes = company.naicsCodes ? JSON.parse(company.naicsCodes) : [];
  const industry = inferIndustryFromNAICS(naicsCodes);
  const brainContext = userId ? await getBrainContext(userId, brainId) : "";
  if (brainContext) {
    console.log(`[Brief Generator] Brain context loaded \u2014 will inform fit/urgency evaluation`);
  }
  const URGENCY_SCHEMA = {
    type: "object",
    properties: {
      urgencyScore: { type: "number" },
      urgencyBreakdown: {
        type: "object",
        properties: {
          companyContext: { type: "number" },
          marketSignals: { type: "number" },
          recentActivity: { type: "number" }
        },
        required: ["companyContext", "marketSignals", "recentActivity"],
        additionalProperties: false
      },
      recentDevelopments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            date: { type: "string" },
            sourceUrl: { type: "string" },
            snippet: { type: "string" }
          },
          required: ["text", "date", "sourceUrl", "snippet"],
          additionalProperties: false
        }
      },
      urgencySignals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            type: { type: "string" },
            description: { type: "string" },
            weight: { type: "number" },
            sourceUrl: { type: "string" },
            snippet: { type: "string" },
            detectedAt: { type: "string" }
          },
          required: ["category", "type", "description", "weight", "sourceUrl", "snippet", "detectedAt"],
          additionalProperties: false
        }
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
            dateAccessed: { type: "string" }
          },
          required: ["url", "title", "snippet", "dateAccessed"],
          additionalProperties: false
        }
      },
      searchNotes: { type: "string" }
    },
    required: ["urgencyScore", "urgencyBreakdown", "recentDevelopments", "urgencySignals", "sources", "searchNotes"],
    additionalProperties: false
  };
  const INTELLIGENCE_SCHEMA = {
    type: "object",
    properties: {
      productsServices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            description: { type: "string" },
            sourceUrl: { type: "string" }
          },
          required: ["category", "description", "sourceUrl"],
          additionalProperties: false
        }
      },
      keyTechnologies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            sourceUrl: { type: "string" }
          },
          required: ["name", "description", "sourceUrl"],
          additionalProperties: false
        }
      },
      targetMarkets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            segment: { type: "string" },
            description: { type: "string" }
          },
          required: ["segment", "description"],
          additionalProperties: false
        }
      },
      industryKeywords: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
            dateAccessed: { type: "string" }
          },
          required: ["url", "title", "snippet", "dateAccessed"],
          additionalProperties: false
        }
      }
    },
    required: ["productsServices", "keyTechnologies", "targetMarkets", "industryKeywords", "sources"],
    additionalProperties: false
  };
  const urgencyPrompt = `You are a B2B sales intelligence analyst. Today is ${todayString()}. Your goal is to provide verifiable answers with traceable sources from the most recent content available.
${brainContext ? `${brainContext}
**Use the Offering Brain intelligence above to:**
- Assess how well this prospect fits the seller's ICP
- Identify specific buying signals that match the seller's offering
- Weight urgency higher when the prospect shows signals matching the seller's urgency triggers
- Note any disqualifiers from the fit criteria

` : ""}**Target Company:** "${company.name}" (${domain})

**Instructions:**
1. Search for the absolute latest news and developments about "${company.name}" from the past 12 months
2. Focus on: product launches, expansions, hiring, partnerships, acquisitions, funding
3. Prioritize sources from 2026 and late 2025
4. Only use verified data from your searches \u2014 do NOT hallucinate URLs or facts

**Score urgency 0-100 based on:**
- Company Context (0-40): Growth stage, financial health, industry momentum
- Market Signals (0-35): Competitive pressure, market expansion, technology shifts
- Recent Activity (0-25): Hiring, announcements, news mentions in past 12 months

**Return JSON only:**
{
  "urgencyScore": 45,
  "urgencyBreakdown": {
    "companyContext": 20,
    "marketSignals": 15,
    "recentActivity": 10
  },
  "recentDevelopments": [
    {
      "text": "Launched new product line for IoT sensors",
      "date": "2026-01-15",
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote or excerpt from the verified source page"
    }
  ],
  "urgencySignals": [
    {
      "category": "Growth",
      "type": "Product Launch",
      "description": "Launched new IoT sensor line in Q4 2025",
      "weight": 8,
      "sourceUrl": "https://working.website.com/article",
      "snippet": "Direct quote from verified source",
      "detectedAt": "2026-01-15"
    }
  ],
  "sources": [
    {
      "url": "https://working.website.com/article",
      "title": "Page title from search",
      "snippet": "Key excerpt from the page",
      "dateAccessed": "2026-02-23"
    }
  ],
  "searchNotes": "Any caveats about source availability or search limitations"
}`;
  const intelligencePrompt = `You are a B2B sales intelligence analyst. Today is ${todayString()}. Your goal is to provide verifiable company intelligence with traceable sources.
${brainContext ? `${brainContext}
**Use the Offering Brain intelligence above to:**
- Focus on products/services that overlap with the seller's capabilities
- Identify technologies that indicate the prospect needs the seller's services
- Highlight target markets where the seller can add value

` : ""}**Target Company:** "${company.name}" (${domain})

**Instructions:**
1. Research "${company.name}" to find:
   - Products & services offerings
   - Technology stack and platform
   - Target markets and customer industries
2. Visit the company website (${domain}) if possible
3. Only include facts backed by verified sources \u2014 do NOT hallucinate

**Return JSON only:**
{
  "productsServices": [
    {
      "category": "IoT Devices",
      "description": "Smart home sensors and gateways",
      "sourceUrl": "https://company.com/products"
    }
  ],
  "keyTechnologies": [
    {
      "name": "IoT",
      "description": "Internet of Things connectivity platform",
      "sourceUrl": "https://company.com/technology"
    }
  ],
  "targetMarkets": [
    {"segment": "Smart Home", "description": "Residential automation systems"},
    {"segment": "Healthcare", "description": "Medical diagnostic equipment"}
  ],
  "industryKeywords": ["IoT", "sensors", "wireless", "embedded systems", "PCB", "electronics"],
  "sources": [
    {
      "url": "https://company.com/products",
      "title": "Products page title",
      "snippet": "Key excerpt",
      "dateAccessed": "2026-02-23"
    }
  ]
}`;
  console.log(`[Brief Generator] Phase 1: Detecting urgency signals with source verification...`);
  const [urgencyRaw, intelligenceRaw] = await Promise.all([
    callGrokWithWebSearch2(urgencyPrompt, URGENCY_SCHEMA),
    callGrokWithWebSearch2(intelligencePrompt, INTELLIGENCE_SCHEMA)
  ]);
  const urgencyData = JSON.parse(urgencyRaw);
  const intelligenceData = JSON.parse(intelligenceRaw);
  console.log(`[Brief Generator] Urgency score: ${urgencyData.urgencyScore}`);
  console.log(`[Brief Generator] Sources found: ${urgencyData.sources?.length || 0}`);
  console.log(
    `[Brief Generator] Found ${intelligenceData.productsServices?.length || 0} product categories`
  );
  console.log(`[Brief Generator] Intelligence sources: ${intelligenceData.sources?.length || 0}`);
  const normalizedDevelopments = (urgencyData.recentDevelopments || []).map((dev) => {
    if (typeof dev === "string") {
      return { text: dev, date: "", sourceUrl: "", snippet: "" };
    }
    return {
      text: dev.text || dev.event || "",
      date: dev.date || "",
      sourceUrl: dev.sourceUrl || dev.url || "",
      snippet: dev.snippet || ""
    };
  });
  const normalizedSignals = (urgencyData.urgencySignals || []).map((signal) => ({
    category: signal.category || "Unknown",
    type: signal.type || "Unknown",
    description: signal.description || "",
    weight: signal.weight || 0,
    sourceUrl: signal.sourceUrl || signal.url || "",
    snippet: signal.snippet || "",
    detectedAt: signal.detectedAt || signal.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  }));
  const allSources = [
    ...urgencyData.sources || [],
    ...intelligenceData.sources || []
  ];
  const brief = {
    companyName: company.name,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    urgencyScore: urgencyData.urgencyScore || 0,
    urgencyBreakdown: urgencyData.urgencyBreakdown || {
      companyContext: 0,
      marketSignals: 0,
      recentActivity: 0
    },
    executiveSummary: {
      company: company.name,
      industry,
      employees: "Unknown",
      // Employee count not stored in schema
      revenue: company.revenue || "Unknown",
      domain,
      linkedin: company.linkedinUrl || ""
    },
    verifiedContacts: {
      website: {
        value: domain,
        source: "Apollo API",
        verified: true
      },
      linkedin: {
        value: company.linkedinUrl || "",
        source: "Apollo API",
        verified: !!company.linkedinUrl
      }
    },
    productsServices: intelligenceData.productsServices || [],
    keyTechnologies: intelligenceData.keyTechnologies || [],
    recentDevelopments: normalizedDevelopments,
    targetMarkets: intelligenceData.targetMarkets || [],
    industryKeywords: intelligenceData.industryKeywords || [],
    naicsCodes,
    urgencySignals: normalizedSignals,
    sources: allSources,
    rawGrokUrgency: urgencyRaw,
    rawGrokIntelligence: intelligenceRaw
  };
  console.log(`[Brief Generator] Brief complete for ${company.name}`);
  return brief;
}
function inferIndustryFromNAICS(naicsCodes) {
  if (!naicsCodes || naicsCodes.length === 0) return "Unknown";
  const firstCode = naicsCodes[0];
  const sector = firstCode.substring(0, 2);
  const sectorMap = {
    "11": "Agriculture",
    "21": "Mining",
    "22": "Utilities",
    "23": "Construction",
    "31": "Manufacturing",
    "32": "Manufacturing",
    "33": "Manufacturing",
    "42": "Wholesale Trade",
    "44": "Retail Trade",
    "45": "Retail Trade",
    "48": "Transportation",
    "49": "Transportation",
    "51": "Information",
    "52": "Finance",
    "53": "Real Estate",
    "54": "Professional Services",
    "55": "Management",
    "56": "Administrative Services",
    "61": "Educational Services",
    "62": "Healthcare",
    "71": "Arts & Entertainment",
    "72": "Accommodation & Food",
    "81": "Other Services",
    "92": "Public Administration"
  };
  return sectorMap[sector] || "Unknown";
}
async function scoreCompanyFit(companyId, userId) {
  const company = await getCompanyById(companyId);
  if (!company) throw new Error(`Company ${companyId} not found`);
  const brain = userId ? await getActiveBrain(userId) : null;
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Brain found \u2014 cannot score fit without ICP criteria");
  }
  const brainContext = await getBrainContext(userId);
  const fitCriteria = brain.fitCriteria ? JSON.parse(brain.fitCriteria) : { mustHave: [], niceToHave: [], disqualifiers: [] };
  const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const buyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals) : [];
  const companyProfile = `
Company: ${company.name}
Website: ${company.websiteUrl || "unknown"}
Location: ${[company.city, company.state, company.country].filter(Boolean).join(", ") || "unknown"}
Revenue: ${company.revenue || "unknown"}
Industry (NAICS): ${company.naicsCodes ? JSON.parse(company.naicsCodes).slice(0, 5).join(", ") : "unknown"}
Industry (SIC): ${company.sicCodes ? JSON.parse(company.sicCodes).slice(0, 5).join(", ") : "unknown"}
Short description: ${company.shortDescription || "not available"}
`;
  const prompt = `You are a B2B sales qualification analyst. Score the prospect company's fit against the seller's Ideal Customer Profile (ICP).

${brainContext}

**PROSPECT COMPANY:**
${companyProfile}

**SCORING TASK:**
Evaluate the prospect against the Brain's ICP criteria and return a JSON object with this exact structure:

{
  "fitScore": <integer 0-100>,
  "breakdown": {
    "industryFit": {
      "score": <0-30>,
      "max": 30,
      "rationale": "<1-2 sentences explaining the industry match>"
    },
    "sizeFit": {
      "score": <0-20>,
      "max": 20,
      "rationale": "<1-2 sentences explaining the size/revenue match>"
    },
    "mustHavesFit": {
      "score": <0-30>,
      "max": 30,
      "rationale": "<1-2 sentences>",
      "matched": ["<must-have criteria that appear to be met>"],
      "missing": ["<must-have criteria that appear to be missing>"]
    },
    "disqualifiers": {
      "triggered": <true|false>,
      "reasons": ["<any disqualifier criteria that appear to apply>"]
    },
    "buyingSignalsFit": {
      "score": <0-20>,
      "max": 20,
      "rationale": "<1-2 sentences on buying signal alignment>"
    }
  },
  "overallRationale": "<3-4 sentence executive summary of why this company is or isn't a strong fit>"
}

Scoring rules:
- industryFit (0-30): Does the company operate in the Brain's ICP industries? Full score = perfect match, 0 = complete mismatch
- sizeFit (0-20): Does the company's revenue/headcount match the Brain's ICP company size?
- mustHavesFit (0-30): How many of the Brain's must-have criteria does this company appear to meet?
- disqualifiers: If ANY disqualifier is triggered, cap fitScore at 25 regardless of other scores
- buyingSignalsFit (0-20): Does the company profile suggest any of the Brain's buying signals are present?
- fitScore = industryFit.score + sizeFit.score + mustHavesFit.score + buyingSignalsFit.score (capped at 25 if disqualifier triggered)

ICP Industries to match against: ${icpIndustries.join(", ")}
Must-haves: ${fitCriteria.mustHave?.join("; ") || "none specified"}
Disqualifiers: ${fitCriteria.disqualifiers?.join("; ") || "none specified"}
Buying signals: ${buyingSignals.join("; ")}
ICP company size: ${brain.icpCompanySize || "not specified"}

Return ONLY the JSON object, no markdown, no explanation outside the JSON.`;
  console.log(`[Fit Scorer] Scoring fit for ${company.name}...`);
  const rawGrokFit = await callGrokWithWebSearch2(prompt);
  const firstBrace = rawGrokFit.indexOf("{");
  const lastBrace = rawGrokFit.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Grok fit scoring returned no valid JSON");
  }
  const parsed = JSON.parse(rawGrokFit.slice(firstBrace, lastBrace + 1));
  let finalScore = parsed.fitScore ?? 0;
  if (parsed.breakdown?.disqualifiers?.triggered) {
    finalScore = Math.min(finalScore, 25);
  }
  finalScore = Math.max(0, Math.min(100, finalScore));
  console.log(`[Fit Scorer] ${company.name} \u2192 fitScore: ${finalScore}`);
  return {
    fitScore: finalScore,
    scoredAt: (/* @__PURE__ */ new Date()).toISOString(),
    companyName: company.name,
    brainName: brain.brainName,
    breakdown: parsed.breakdown,
    overallRationale: parsed.overallRationale,
    rawGrokFit
  };
}
var XAI_API_KEY3, XAI_BASE_URL3;
var init_briefGenerator = __esm({
  "server/briefGenerator.ts"() {
    "use strict";
    init_db();
    XAI_API_KEY3 = process.env.XAI_API_KEY;
    XAI_BASE_URL3 = "https://api.x.ai/v1";
  }
});

// server/salesApproachGenerator.ts
var salesApproachGenerator_exports = {};
__export(salesApproachGenerator_exports, {
  generateSalesApproach: () => generateSalesApproach,
  normaliseConversationStarters: () => normaliseConversationStarters
});
async function getBrainContextForApproach(userId, brainId) {
  try {
    const brain = brainId ? await getOfferingBrainById(brainId, userId) : await getActiveBrain(userId);
    if (!brain || brain.status !== "completed") return { context: "", companyName: "Your Company" };
    const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
    const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
    const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
    return {
      companyName: brain.companyName || "Your Company",
      context: `
**YOUR COMPANY (Seller) \u2014 ${brain.companyName}:**
- Summary: ${brain.offeringSummary}
- Core Capabilities: ${capabilities.join("; ")}
- Value Propositions: ${valueProps.map((vp) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
- Competitive Advantages: ${brain.competitiveAdvantages}
- Pain Points We Solve: ${painPoints.join("; ")}
`
    };
  } catch (error) {
    console.warn("[Brain Context] Failed to load brain for sales approach:", error);
    return { context: "", companyName: "Your Company" };
  }
}
function normaliseConversationStarters(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    if (typeof s === "string") return { opener: s, sourceUrl: "", basedOn: "" };
    if (s && typeof s === "object") {
      const opener = s.opener ?? s.conversationStarter ?? s.description ?? s.text ?? JSON.stringify(s);
      return {
        opener,
        sourceUrl: typeof s.sourceUrl === "string" ? s.sourceUrl : "",
        basedOn: typeof s.basedOn === "string" ? s.basedOn : typeof s.type === "string" ? s.type : ""
      };
    }
    return { opener: String(s ?? ""), sourceUrl: "", basedOn: "" };
  });
}
async function callGrokWithWebSearch3(input) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12e4);
  let response;
  try {
    response = await fetch(`${XAI_BASE_URL4}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY4}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        tools: [{ type: "web_search" }],
        // Explicit web_search tool
        input,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sales_approach",
            strict: true,
            schema: SALES_APPROACH_SCHEMA
          }
        }
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.content && Array.isArray(item.content)) {
        const textContent = item.content.find((c) => c.type === "output_text");
        if (textContent?.text) {
          return textContent.text;
        }
      }
    }
  }
  if (data.text) {
    return data.text;
  }
  throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
}
async function generateSalesApproach(companyId, userId, brainId) {
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  if (!company.briefData) {
    throw new Error(`Deep research not found for company ${companyId}. Run Deep Research first.`);
  }
  const briefData = JSON.parse(company.briefData);
  console.log(`[Sales Approach] Generating personalized outreach for ${company.name}`);
  const domain = company.primaryDomain || company.websiteUrl || "unknown.com";
  const brainInfo = userId ? await getBrainContextForApproach(userId, brainId) : { context: "", companyName: "Your Company" };
  const sellerName = brainInfo.companyName;
  const verifiedDevelopments = (briefData.recentDevelopments || []).filter((d) => d && (typeof d === "string" || d.text)).map((d) => {
    if (typeof d === "string") return `- ${d}`;
    const sourceNote = d.sourceUrl ? ` [Source: ${d.sourceUrl}]` : "";
    return `- ${d.text}${d.date ? ` (${d.date})` : ""}${sourceNote}`;
  }).join("\n");
  const verifiedSources = (briefData.sources || []).map((s) => `- ${s.title || "Source"}: ${s.url}`).join("\n");
  const todayStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const approachPrompt = `You are a B2B sales expert. Today is ${todayStr}. You are crafting a complete sales approach for ${sellerName}.
${brainInfo.context ? `${brainInfo.context}
**Use the seller intelligence above to tailor all outreach materials to the seller's specific capabilities and value propositions.**
` : ""}

**Target Company:** ${company.name} (${domain})

**Deep Research Summary (with verified sources):**
- Urgency Score: ${briefData.urgencyScore}/100
- Products/Services: ${briefData.productsServices?.map((p) => p.category).join(", ") || "Unknown"}
- Key Technologies: ${briefData.keyTechnologies?.map((t2) => t2.name).join(", ") || "Unknown"}
- Target Markets: ${briefData.targetMarkets?.map((m) => m.segment).join(", ") || "Unknown"}

**Verified Recent Developments:**
${verifiedDevelopments || "No verified developments available."}

**Verified Sources from Deep Research:**
${verifiedSources || "No verified sources available."}

**INSTRUCTIONS:**
1. Search for the absolute latest news about "${company.name}" from the past 12 months to supplement the deep research
2. Ground ALL conversation starters in specific, verified developments with working source URLs
3. The email draft should reference at least one specific, verified development
4. Only use verified data from your searches \u2014 do NOT hallucinate URLs or facts

**Generate a complete sales approach. Return JSON matching the required schema:**
- conversationStarters: 3 specific openers, each tied to a verified source URL
- engagementStrategy: why this prospect matters, recommended approach, key talking points
- emailDraft: personalized cold email with subject, body (3 paragraphs), and referenced sources
- linkedinMessage: connection request (max 200 chars) and follow-up message
- callScript: 30-second opening, 3 discovery questions, value proposition, call to action`;
  const approachRaw = await callGrokWithWebSearch3(approachPrompt);
  const approachData = JSON.parse(approachRaw);
  const salesApproach = {
    companyName: company.name,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    conversationStarters: normaliseConversationStarters(approachData.conversationStarters || []),
    engagementStrategy: approachData.engagementStrategy || {
      whyThisProspectMatters: [],
      recommendedApproach: [],
      keyTalkingPoints: []
    },
    emailDraft: approachData.emailDraft || {
      subject: "Exploring partnership opportunities",
      body: "Email generation failed. Please try again.",
      referencedSources: []
    },
    linkedinMessage: approachData.linkedinMessage || {
      connectionRequest: "Connection request generation failed.",
      followUp: "Follow-up message generation failed."
    },
    callScript: approachData.callScript || {
      opening: "Call script generation failed.",
      discoveryQuestions: [],
      valueProposition: "Value prop generation failed.",
      callToAction: "Next step generation failed."
    }
  };
  console.log(`[Sales Approach] Personalized outreach generated for ${company.name} with ${salesApproach.conversationStarters.length} source-backed conversation starters`);
  return salesApproach;
}
var XAI_API_KEY4, XAI_BASE_URL4, SALES_APPROACH_SCHEMA;
var init_salesApproachGenerator = __esm({
  "server/salesApproachGenerator.ts"() {
    "use strict";
    init_db();
    XAI_API_KEY4 = process.env.XAI_API_KEY;
    XAI_BASE_URL4 = "https://api.x.ai/v1";
    SALES_APPROACH_SCHEMA = {
      type: "object",
      properties: {
        conversationStarters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              opener: { type: "string" },
              sourceUrl: { type: "string" },
              basedOn: { type: "string" }
            },
            required: ["opener", "sourceUrl", "basedOn"],
            additionalProperties: false
          }
        },
        engagementStrategy: {
          type: "object",
          properties: {
            whyThisProspectMatters: { type: "array", items: { type: "string" } },
            recommendedApproach: { type: "array", items: { type: "string" } },
            keyTalkingPoints: { type: "array", items: { type: "string" } }
          },
          required: ["whyThisProspectMatters", "recommendedApproach", "keyTalkingPoints"],
          additionalProperties: false
        },
        emailDraft: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            referencedSources: { type: "array", items: { type: "string" } }
          },
          required: ["subject", "body", "referencedSources"],
          additionalProperties: false
        },
        linkedinMessage: {
          type: "object",
          properties: {
            connectionRequest: { type: "string" },
            followUp: { type: "string" }
          },
          required: ["connectionRequest", "followUp"],
          additionalProperties: false
        },
        callScript: {
          type: "object",
          properties: {
            opening: { type: "string" },
            discoveryQuestions: { type: "array", items: { type: "string" } },
            valueProposition: { type: "string" },
            callToAction: { type: "string" }
          },
          required: ["opening", "discoveryQuestions", "valueProposition", "callToAction"],
          additionalProperties: false
        }
      },
      required: ["conversationStarters", "engagementStrategy", "emailDraft", "linkedinMessage", "callScript"],
      additionalProperties: false
    };
  }
});

// shared/naicsExpansion.ts
function extractSectors(codes) {
  const sectors = /* @__PURE__ */ new Set();
  for (const code of codes) {
    if (code.length >= 2) {
      sectors.add(code.substring(0, 2));
    }
  }
  return Array.from(sectors).sort();
}
var init_naicsExpansion = __esm({
  "shared/naicsExpansion.ts"() {
    "use strict";
  }
});

// server/searchSlices.ts
function parseEmployeeBands(icpCompanySize) {
  if (!icpCompanySize) return DEFAULT_EMPLOYEE_BANDS;
  const rangeMatch = icpCompanySize.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = parseInt(rangeMatch[2]);
    if (min > 0 && max > min) {
      const third = Math.round((max - min) / 3);
      return [
        { min, max: min + third, label: `${min}-${min + third}` },
        { min: min + third + 1, max: min + 2 * third, label: `${min + third + 1}-${min + 2 * third}` },
        { min: min + 2 * third + 1, max, label: `${min + 2 * third + 1}-${max}` }
      ];
    }
  }
  return DEFAULT_EMPLOYEE_BANDS;
}
function buildIndustrySlices(icpIndustries) {
  if (!icpIndustries || icpIndustries.length === 0) {
    return [{ name: "General Industry", keywords: ["manufacturing", "technology", "services"] }];
  }
  return icpIndustries.map((industry) => ({
    name: industry,
    keywords: [industry.toLowerCase()]
  }));
}
function buildKeywordSets(coreCapabilities, icpPainPoints, icpBuyingSignals) {
  const sets = [];
  if (coreCapabilities.length > 0) {
    sets.push({
      name: "Core Capabilities",
      description: "Primary offering capabilities",
      keywords: coreCapabilities.map((c) => c.toLowerCase()).slice(0, 7)
    });
  }
  if (icpPainPoints.length > 0) {
    sets.push({
      name: "Pain Points",
      description: "Customer pain points the offering solves",
      keywords: icpPainPoints.map((p) => p.toLowerCase()).slice(0, 7)
    });
  }
  if (icpBuyingSignals.length > 0) {
    sets.push({
      name: "Buying Signals",
      description: "Signals indicating readiness to buy",
      keywords: icpBuyingSignals.map((s) => s.toLowerCase()).slice(0, 7)
    });
  }
  if (sets.length === 0) {
    sets.push({
      name: "General",
      description: "General search terms",
      keywords: ["manufacturing", "technology", "services", "solutions"]
    });
  }
  return sets;
}
function generateSearchSlices(brainConfig) {
  const employeeBands = brainConfig ? parseEmployeeBands(brainConfig.icpCompanySize) : DEFAULT_EMPLOYEE_BANDS;
  const industrySlices = brainConfig ? buildIndustrySlices(brainConfig.icpIndustries) : [{ name: "General Industry", keywords: ["manufacturing", "technology", "services"] }];
  const keywordSets = brainConfig ? buildKeywordSets(brainConfig.coreCapabilities, brainConfig.icpPainPoints, brainConfig.icpBuyingSignals) : [{ name: "General", description: "General search terms", keywords: ["manufacturing", "technology", "services"] }];
  const slices = [];
  for (const employeeBand of employeeBands) {
    for (const industry of industrySlices) {
      for (const keywordSet of keywordSets) {
        slices.push({
          employeeBand,
          industry,
          keywordSet,
          sliceId: `${employeeBand.label}_${industry.name.replace(/\s+/g, "-")}_${keywordSet.name.replace(/\s+/g, "-")}`
        });
      }
    }
  }
  return slices;
}
function getTotalSlices(brainConfig) {
  const employeeBands = brainConfig ? parseEmployeeBands(brainConfig.icpCompanySize) : DEFAULT_EMPLOYEE_BANDS;
  const industrySlices = brainConfig ? buildIndustrySlices(brainConfig.icpIndustries) : [{ name: "General Industry", keywords: ["manufacturing", "technology", "services"] }];
  const keywordSets = brainConfig ? buildKeywordSets(brainConfig.coreCapabilities, brainConfig.icpPainPoints, brainConfig.icpBuyingSignals) : [{ name: "General", description: "General search terms", keywords: ["manufacturing", "technology", "services"] }];
  return employeeBands.length * industrySlices.length * keywordSets.length;
}
var DEFAULT_EMPLOYEE_BANDS;
var init_searchSlices = __esm({
  "server/searchSlices.ts"() {
    "use strict";
    DEFAULT_EMPLOYEE_BANDS = [
      { min: 50, max: 200, label: "50-200" },
      { min: 201, max: 500, label: "201-500" },
      { min: 501, max: 1e3, label: "501-1000" }
    ];
  }
});

// server/multiSliceSearch.ts
async function multiSliceSearch({
  searchId,
  location,
  confirmedSectors,
  targetMarket,
  brainConfig
}) {
  const companiesMap = /* @__PURE__ */ new Map();
  const slices = generateSearchSlices(brainConfig);
  const totalSlices = getTotalSlices(brainConfig);
  console.log(`[Multi-Slice Search] Starting search with ${totalSlices} slices (brain-driven)`);
  await updateSearch(searchId, {
    status: "searching",
    codesTotal: totalSlices,
    codesSearched: 0
  });
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const { employeeBand, industry, keywordSet } = slice;
    console.log(
      `[Multi-Slice Search] Slice ${i + 1}/${totalSlices}: ${employeeBand.label} \xD7 ${industry.name} \xD7 ${keywordSet.name}`
    );
    try {
      const allKeywords = [...industry.keywords, ...keywordSet.keywords];
      const searchParams = {
        targetMarketKeywordTags: allKeywords,
        targetMarket,
        location,
        limit: 1e4,
        // Pull all available companies per slice
        employeeRanges: [employeeBand]
        // Single employee band per slice
      };
      const result = await searchApolloCompanies(searchParams);
      const companies2 = result.companies;
      console.log(
        `[Multi-Slice Search] Slice ${i + 1}: found ${companies2.length} companies before filtering`
      );
      const filteredCompanies = companies2.filter((company) => {
        const naicsCodes = company.naics_codes || [];
        if (naicsCodes.length === 0) return false;
        return naicsCodes.some(
          (code) => naicsMatchesHierarchically(code, confirmedSectors)
        );
      });
      console.log(
        `[Multi-Slice Search] Slice ${i + 1}: ${filteredCompanies.length} companies after NAICS filtering`
      );
      for (const company of filteredCompanies) {
        if (company.id) {
          if (!companiesMap.has(company.id)) {
            companiesMap.set(company.id, {
              ...company,
              sliceMetadata: {
                employeeBand: employeeBand.label,
                industry: industry.name,
                keywordSet: keywordSet.name,
                matchedKeywords: allKeywords
              }
            });
          } else {
          }
        }
      }
    } catch (error) {
      console.error(`[Multi-Slice Search] Error in slice ${i + 1}:`, error);
    }
    await updateSearch(searchId, {
      codesSearched: i + 1
    });
  }
  const uniqueCompanies = Array.from(companiesMap.values());
  console.log(
    `[Multi-Slice Search] Total unique companies after deduplication: ${uniqueCompanies.length}`
  );
  if (uniqueCompanies.length > 0) {
    await createCompanies(
      uniqueCompanies.map((company) => ({
        searchId,
        apolloId: company.id,
        name: company.name,
        websiteUrl: company.website_url,
        primaryDomain: company.primary_domain,
        phone: company.phone,
        foundedYear: company.founded_year,
        revenue: company.organization_revenue_printed || null,
        headcountGrowth: company.organization_headcount_six_month_growth ? `${company.organization_headcount_six_month_growth}% (6mo)` : null,
        linkedinUrl: company.linkedin_url,
        sicCodes: company.sic_codes ? JSON.stringify(company.sic_codes) : null,
        naicsCodes: company.naics_codes ? JSON.stringify(company.naics_codes) : null,
        enrichmentStatus: "pending",
        searchLocation: location,
        // Store slice metadata for later analysis
        sliceMetadata: company.sliceMetadata ? JSON.stringify(company.sliceMetadata) : null,
        // Location fields will be populated during enrichment
        city: null,
        state: null,
        country: null,
        postalCode: null,
        streetAddress: null
      }))
    );
  }
}
var init_multiSliceSearch = __esm({
  "server/multiSliceSearch.ts"() {
    "use strict";
    init_db();
    init_apolloSearch();
    init_naicsHierarchy();
    init_searchSlices();
  }
});

// server/confirmAndSearch.ts
var confirmAndSearch_exports = {};
__export(confirmAndSearch_exports, {
  confirmAndSearch: () => confirmAndSearch
});
async function confirmAndSearch({ searchId, location }) {
  const search = await getSearchById(searchId);
  if (!search) {
    throw new Error("Search not found");
  }
  const selectedNaicsCodes = search.selectedNaicsCodes ? JSON.parse(search.selectedNaicsCodes) : [];
  const excludedSectors = search.excludedSectors ? JSON.parse(search.excludedSectors) : [];
  const allSectors = extractSectors(selectedNaicsCodes);
  const confirmedSectors = allSectors.filter((sector) => !excludedSectors.includes(sector));
  console.log(`[Confirm & Search] All sectors: ${allSectors.join(", ")}`);
  console.log(`[Confirm & Search] Excluded sectors: ${excludedSectors.join(", ")}`);
  console.log(`[Confirm & Search] Confirmed sectors: ${confirmedSectors.join(", ")}`);
  const keywordTags = search.keywordTagsUsed ? JSON.parse(search.keywordTagsUsed) : [];
  console.log(`[Confirm & Search] Using ${keywordTags.length} Apollo search tags: ${keywordTags.join(", ")}`);
  await updateSearch(searchId, {
    status: "searching",
    codesTotal: keywordTags.length,
    codesSearched: 0
  });
  await multiSliceSearch({
    searchId,
    location,
    confirmedSectors,
    targetMarket: search.targetMarket || "mid-market"
  });
  await updateSearch(searchId, {
    status: "completed"
  });
}
var init_confirmAndSearch = __esm({
  "server/confirmAndSearch.ts"() {
    "use strict";
    init_db();
    init_naicsExpansion();
    init_multiSliceSearch();
  }
});

// server/usStates.ts
var US_STATES;
var init_usStates = __esm({
  "server/usStates.ts"() {
    "use strict";
    US_STATES = [
      "California",
      "Texas",
      "Florida",
      "New York",
      "Pennsylvania",
      "Illinois",
      "Ohio",
      "Georgia",
      "North Carolina",
      "Michigan",
      "New Jersey",
      "Virginia",
      "Washington",
      "Arizona",
      "Massachusetts",
      "Tennessee",
      "Indiana",
      "Missouri",
      "Maryland",
      "Wisconsin",
      "Colorado",
      "Minnesota",
      "South Carolina",
      "Alabama",
      "Louisiana",
      "Kentucky",
      "Oregon",
      "Oklahoma",
      "Connecticut",
      "Utah",
      "Iowa",
      "Nevada",
      "Arkansas",
      "Mississippi",
      "Kansas",
      "New Mexico",
      "Nebraska",
      "West Virginia",
      "Idaho",
      "Hawaii",
      "New Hampshire",
      "Maine",
      "Montana",
      "Rhode Island",
      "Delaware",
      "South Dakota",
      "North Dakota",
      "Alaska",
      "Vermont",
      "Wyoming"
    ];
  }
});

// server/nationalScan.ts
var nationalScan_exports = {};
__export(nationalScan_exports, {
  getNationalScanProgress: () => getNationalScanProgress,
  runNationalScan: () => runNationalScan,
  stopNationalScan: () => stopNationalScan
});
function getNationalScanProgress() {
  return { ...scanProgress };
}
function stopNationalScan() {
  if (!scanProgress.isRunning) {
    throw new Error("No scan is currently running");
  }
  scanProgress.shouldStop = true;
  console.log("[National Scan] Stop requested by user");
  return {
    success: true,
    message: "Scan will stop after completing the current state"
  };
}
async function runNationalScan(userId, testMode = false, customStates) {
  if (scanProgress.isRunning) {
    throw new Error("A national scan is already running");
  }
  const brain = await getActiveBrain(userId);
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Offering Brain found. Please create one first on the Brain page.");
  }
  const coreCapabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
  const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const valuePropositions = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
  const brainOffering = {
    name: brain.offeringSummary || brain.brainName,
    description: `${brain.companyName}: ${brain.offeringSummary || ""} ${brain.competitiveAdvantages || ""}`.trim(),
    targetMarket: icpIndustries.join(" \u2022 ") || "General B2B",
    keywords: coreCapabilities.slice(0, 10),
    targetMarketKeywordTags: [
      ...icpIndustries.map((i) => i.toLowerCase()),
      ...coreCapabilities.map((c) => c.toLowerCase())
    ].slice(0, 40)
  };
  const vpSummary = valuePropositions.map((vp) => vp.value).join("; ") || brain.competitiveAdvantages || "";
  const statesToScan = customStates ? customStates : testMode ? ["Delaware", "Rhode Island"] : US_STATES;
  scanProgress = {
    isRunning: true,
    currentState: "",
    currentStateIndex: 0,
    totalStates: statesToScan.length,
    totalCompaniesFound: 0,
    completedStates: [],
    failedStates: [],
    startedAt: /* @__PURE__ */ new Date(),
    estimatedCompletionAt: null,
    shouldStop: false
  };
  console.log(`[National Scan] Starting ${testMode ? "TEST" : "FULL"} scan for ${statesToScan.length} states`);
  console.log(`[National Scan] Using brain: ${brain.brainName} (${brain.companyName})`);
  console.log(`[National Scan] Selecting industry codes (one time)`);
  const codeSelection = await selectIndustryCodes({
    offeringName: brainOffering.name,
    offeringDescription: brainOffering.description,
    targetMarket: brainOffering.targetMarket,
    valueProposition: vpSummary
  });
  console.log(`[National Scan] Selected ${codeSelection.sicCodes.length} SIC codes and ${codeSelection.naicsCodes.length} NAICS codes`);
  for (let i = 0; i < statesToScan.length; i++) {
    if (scanProgress.shouldStop) {
      console.log(`[National Scan] Stop requested, terminating scan after ${i} states`);
      scanProgress.isRunning = false;
      scanProgress.currentState = "Stopped by user";
      scanProgress.shouldStop = false;
      return {
        success: true,
        stopped: true,
        testMode,
        totalCompanies: scanProgress.totalCompaniesFound,
        completedStates: scanProgress.completedStates.length,
        failedStates: scanProgress.failedStates.length,
        failedStatesList: scanProgress.failedStates
      };
    }
    const state = statesToScan[i];
    scanProgress.currentState = state;
    scanProgress.currentStateIndex = i + 1;
    console.log(`[National Scan] Processing state ${i + 1}/${statesToScan.length}: ${state}`);
    try {
      const searchId = await createSearch({
        userId,
        companyWebsite: brain.companyWebsite,
        location: state,
        // Just the state name
        status: "searching",
        // Skip code_targeting review
        offeringName: brainOffering.name,
        offeringDescription: brainOffering.description,
        targetMarket: brainOffering.targetMarket,
        keywords: JSON.stringify(brainOffering.keywords),
        keywordTagsUsed: JSON.stringify(brainOffering.targetMarketKeywordTags),
        selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
        selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
        codeSelectionReasoning: codeSelection.reasoning,
        excludedSectors: JSON.stringify([]),
        // No exclusions for national scan
        brainId: brain.id
      });
      console.log(`[National Scan] Created search ${searchId} for ${state}`);
      await confirmAndSearch({ searchId, location: state });
      const { getCompaniesBySearchId: getCompaniesBySearchId3 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const companies2 = await getCompaniesBySearchId3(searchId);
      const companiesFound = companies2.length;
      scanProgress.totalCompaniesFound += companiesFound;
      scanProgress.completedStates.push(state);
      console.log(`[National Scan] ${state}: Found ${companiesFound} companies (total so far: ${scanProgress.totalCompaniesFound})`);
    } catch (error) {
      console.error(`[National Scan] Failed to process ${state}:`, error.message);
      scanProgress.failedStates.push({
        state,
        error: error.message
      });
    }
    if (i > 0) {
      const elapsed = Date.now() - scanProgress.startedAt.getTime();
      const avgTimePerState = elapsed / (i + 1);
      const remainingStates = statesToScan.length - (i + 1);
      const estimatedRemainingTime = avgTimePerState * remainingStates;
      scanProgress.estimatedCompletionAt = new Date(Date.now() + estimatedRemainingTime);
    }
  }
  scanProgress.isRunning = false;
  scanProgress.currentState = testMode ? "Test Complete" : "Complete";
  console.log(`[National Scan] ${testMode ? "Test" : "Full scan"} completed! Total companies: ${scanProgress.totalCompaniesFound}`);
  console.log(`[National Scan] Successful states: ${scanProgress.completedStates.length}`);
  console.log(`[National Scan] Failed states: ${scanProgress.failedStates.length}`);
  return {
    success: true,
    testMode,
    totalCompanies: scanProgress.totalCompaniesFound,
    completedStates: scanProgress.completedStates.length,
    failedStates: scanProgress.failedStates.length,
    failedStatesList: scanProgress.failedStates
  };
}
var scanProgress;
var init_nationalScan = __esm({
  "server/nationalScan.ts"() {
    "use strict";
    init_usStates();
    init_codeSelectionService();
    init_confirmAndSearch();
    init_db();
    scanProgress = {
      isRunning: false,
      currentState: "",
      currentStateIndex: 0,
      totalStates: 50,
      totalCompaniesFound: 0,
      completedStates: [],
      failedStates: [],
      startedAt: null,
      estimatedCompletionAt: null,
      shouldStop: false
      // Flag to signal scan should stop
    };
  }
});

// server/apolloCSVParser.ts
var apolloCSVParser_exports = {};
__export(apolloCSVParser_exports, {
  mapApolloRowToCompany: () => mapApolloRowToCompany,
  parseApolloCSV: () => parseApolloCSV
});
import { parse } from "csv-parse/sync";
function parseApolloCSV(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  return records;
}
function mapApolloRowToCompany(row, searchId) {
  const employeeCount = row["# Employees"] ? parseInt(row["# Employees"]) : null;
  const sicCodes = row["SIC Codes"] ? row["SIC Codes"].split(",").map((code) => code.trim()).filter(Boolean) : [];
  const sliceMetadata = {
    employeeCount,
    industry: row["Industry"] || null,
    keywords: row["Keywords"] || null,
    description: row["Short Description"] || null,
    lists: row["Lists"] || null,
    logoUrl: row["Logo Url"] || null
  };
  let primaryDomain = null;
  if (row["Website"]) {
    try {
      const url = new URL(row["Website"].startsWith("http") ? row["Website"] : `https://${row["Website"]}`);
      primaryDomain = url.hostname.replace(/^www\./, "");
    } catch (e) {
    }
  }
  return {
    searchId,
    apolloId: row["Apollo Account Id"] || null,
    name: row["Company Name"],
    websiteUrl: row["Website"] || null,
    primaryDomain,
    linkedinUrl: row["Company Linkedin Url"] || null,
    twitterUrl: row["Twitter Url"] || null,
    facebookUrl: null,
    // Not in Apollo CSV
    phone: row["Company Phone"] || null,
    foundedYear: null,
    // Not in Apollo CSV
    revenue: row["Annual Revenue"] || null,
    headcountGrowth: null,
    // Not in Apollo CSV
    parentCompanyName: row["Subsidiary of"] || null,
    parentCompanyId: row["Subsidiary of (Organization ID)"] || null,
    searchLocation: row["Company State"] || row["Company Country"] || null,
    city: row["Company City"] || null,
    state: row["Company State"] || null,
    country: row["Company Country"] || null,
    streetAddress: row["Company Street"] || null,
    rawAddress: row["Company Address"] || null,
    sicCodes: JSON.stringify(sicCodes),
    naicsCodes: null,
    // Not in Apollo CSV
    sliceMetadata: JSON.stringify(sliceMetadata),
    urgencyScore: null,
    briefData: null,
    briefGeneratedAt: null,
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    enrichmentStatus: "pending"
  };
}
var init_apolloCSVParser = __esm({
  "server/apolloCSVParser.ts"() {
    "use strict";
  }
});

// server/conferenceScraper.ts
var conferenceScraper_exports = {};
__export(conferenceScraper_exports, {
  apolloEnrichByDomain: () => apolloEnrichByDomain,
  apolloEnrichByName: () => apolloEnrichByName,
  closePuppeteerBrowser: () => closePuppeteerBrowser,
  detectNextPageUrl: () => detectNextPageUrl,
  detectTotalPages: () => detectTotalPages,
  extractDomain: () => extractDomain,
  scrapeConferenceExhibitors: () => scrapeConferenceExhibitors
});
import axios4 from "axios";
function cleanUrl(raw) {
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "gclid",
      "msclkid",
      "fbclid",
      "cid",
      "redirectFromFleet"
    ].forEach((p) => url.searchParams.delete(p));
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function isCompanyWebsite(url, pageHost) {
  const lower = url.toLowerCase();
  const excluded = [
    "google.com",
    "maps.google",
    "goo.gl",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "tiktok.com",
    "pinterest.com",
    "xing.com",
    "policies.google.com",
    "recaptcha",
    "captcha",
    // Known conference organiser domains
    "conexpoconagg.com",
    "bauma.de",
    "ifat.de",
    "intermat.fr",
    "cemat.de",
    "hannovermesse.de",
    "messe-muenchen.de",
    "messe-frankfurt.de",
    "messe-berlin.de",
    "koelnmesse.de",
    "messe-duesseldorf.de",
    "messe-stuttgart.de",
    "messe-essen.de",
    "messe-nuernberg.de"
  ];
  if (excluded.some((d) => lower.includes(d))) return false;
  try {
    const linkHost = new URL(url).hostname.replace(/^www\./, "");
    const ph = pageHost.replace(/^www\./, "");
    if (linkHost === ph) return false;
  } catch {
    return false;
  }
  return true;
}
function normaliseName(name) {
  return name.toLowerCase().trim().replace(LEGAL_SUFFIX_RE, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function extractNextData(html) {
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i) || html.match(/<script[^>]+type=["']application\/json["'][^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!nextDataMatch) return [];
  let data;
  try {
    data = JSON.parse(nextDataMatch[1]);
  } catch {
    return [];
  }
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  function searchNode(node, depth = 0) {
    if (depth > 15 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      if (node.length >= 3 && node[0] && typeof node[0] === "object" && typeof node[0].name === "string") {
        const sample = node.slice(0, 5);
        const hasNameField = sample.every((item) => typeof item.name === "string" && item.name.length > 1);
        if (hasNameField) {
          const hasSlug = sample.some((item) => item.slug);
          const hasCountry = sample.some((item) => item.countryCode || item.country_code || item.country);
          const hasWebsite = sample.some((item) => item.website || item.websiteUrl || item.url || item.website_url);
          const hasStand = sample.some((item) => item.stands || item.stand || item.booth || item.hall);
          if (hasSlug || hasCountry || hasWebsite || hasStand) {
            for (const item of node) {
              if (!item || typeof item.name !== "string") continue;
              const name = item.name.trim();
              if (!name || name.length < 2 || name.length > 150) continue;
              if (/^(home|contact|menu|search|register|login|privacy|cookie|terms|floor plan|register your visit)$/i.test(name)) continue;
              const key = normaliseName(name);
              if (!key || seen.has(key)) continue;
              seen.add(key);
              const rawUrl = item.website || item.websiteUrl || item.url || item.website_url || null;
              const websiteUrl = rawUrl ? cleanUrl(rawUrl) : null;
              const countryCode = item.countryCode || item.country_code || item.country || null;
              results.push({ name, websiteUrl, countryCode });
            }
            if (results.length > 0) return;
          }
        }
      }
      for (const item of node) {
        searchNode(item, depth + 1);
      }
    } else {
      for (const value of Object.values(node)) {
        searchNode(value, depth + 1);
      }
    }
  }
  searchNode(data);
  return results;
}
function extractLogoLinks(html, pageHost) {
  const results = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const imgAltRegex = /<img[^>]+alt=["']([^"']{2,100})["'][^>]*>/i;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];
    const imgMatch = imgAltRegex.exec(inner);
    if (!imgMatch) continue;
    const name = imgMatch[1].trim();
    const url = cleanUrl(href);
    if (!url || !isCompanyWebsite(url, pageHost)) continue;
    if (name.length < 2 || name.length > 120) continue;
    if (/^(home|contact|menu|search|register|login|sign in|privacy|cookie|terms|logo|banner)$/i.test(name)) continue;
    results.push({ name, websiteUrl: url });
  }
  return results;
}
function extractTextLinks(html, pageHost) {
  const results = [];
  const anchorRegex = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]{2,100})<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text2 = match[2].trim().replace(/\s+/g, " ");
    const url = cleanUrl(href);
    if (!url || !isCompanyWebsite(url, pageHost)) continue;
    if (text2.length < 2 || text2.length > 100) continue;
    if (/^(home|contact|menu|search|register|login|sign in|privacy|cookie|terms|read more|click here|learn more|visit|website|more info|details|view|see more)$/i.test(text2)) continue;
    results.push({ name: text2, websiteUrl: url });
  }
  return results;
}
async function extractWithGrok(html, pageUrl) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.warn("[Conference Scraper] XAI_API_KEY not set, skipping Grok fallback");
    return [];
  }
  const truncated = html.slice(0, 3e4);
  const prompt = `You are a data extraction assistant. I will give you the HTML of a conference exhibitor list page (${pageUrl}).

Your task: extract ALL company names and their website URLs from this page.

Return ONLY a JSON array of objects with this exact schema:
[{"name": "Company Name", "websiteUrl": "https://example.com"}, ...]

Rules:
- Include every company/exhibitor listed on the page
- If a company has no website link, set websiteUrl to null
- Do NOT include the conference organizer's own website
- Do NOT include social media links (LinkedIn, Twitter, Facebook, etc.)
- Company names should be clean (no extra whitespace, no HTML entities)
- Return ONLY the JSON array, no explanation

HTML:
${truncated}`;
  try {
    const response = await axios4.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-3-fast-beta",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 8e3
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 6e4
      }
    );
    const content = response.data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item.name && typeof item.name === "string").map((item) => ({
      name: item.name.trim(),
      websiteUrl: item.websiteUrl ? cleanUrl(item.websiteUrl) : null
    }));
  } catch (error) {
    console.error("[Conference Scraper] Grok fallback failed:", error.message);
    return [];
  }
}
async function extractFromHtml(html, pageUrl) {
  const pageHost = new URL(pageUrl).hostname;
  const nextDataResults = extractNextData(html);
  if (nextDataResults.length >= 3) {
    console.log(`[Conference Scraper] __NEXT_DATA__ strategy found ${nextDataResults.length} companies`);
    return { exhibitors: nextDataResults, strategy: "next-data" };
  }
  let exhibitors = extractLogoLinks(html, pageHost);
  let strategy = "logo-link";
  if (exhibitors.length < 5) {
    const textLinks = extractTextLinks(html, pageHost);
    if (textLinks.length > exhibitors.length) {
      exhibitors = textLinks;
      strategy = "text-link";
    }
  }
  if (exhibitors.length < 5) {
    const grokResults = await extractWithGrok(html, pageUrl);
    if (grokResults.length > exhibitors.length) {
      exhibitors = grokResults;
      strategy = "grok";
    }
  }
  return { exhibitors, strategy };
}
function deduplicateExhibitors(exhibitors) {
  const seen = /* @__PURE__ */ new Set();
  return exhibitors.filter((e) => {
    const key = normaliseName(e.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function fetchWithAxios(url, attempt = 1) {
  try {
    const response = await axios4.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache"
      },
      timeout: FETCH_TIMEOUT_MS,
      maxRedirects: 10
    });
    return response.data;
  } catch (err) {
    if (attempt < RETRY_ATTEMPTS && isRetryableError(err)) {
      const delay = 1e3 * Math.pow(2, attempt - 1);
      console.warn(`[Conference Scraper] axios fetch attempt ${attempt} failed (${err.message}), retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchWithAxios(url, attempt + 1);
    }
    throw err;
  }
}
function isRetryableError(err) {
  if (!err.response) return true;
  const status = err.response.status;
  return status === 429 || status === 503 || status === 502 || status === 504;
}
async function getPuppeteerBrowser() {
  if (_puppeteerBrowser) {
    try {
      const pages = await _puppeteerBrowser.pages();
      if (pages) return _puppeteerBrowser;
    } catch {
      _puppeteerBrowser = null;
    }
  }
  const puppeteer = await import("puppeteer-core");
  _puppeteerBrowser = await puppeteer.default.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
  console.log("[Conference Scraper] Puppeteer browser launched");
  return _puppeteerBrowser;
}
async function closePuppeteerBrowser() {
  if (_puppeteerBrowser) {
    try {
      await _puppeteerBrowser.close();
    } catch {
    }
    _puppeteerBrowser = null;
    console.log("[Conference Scraper] Puppeteer browser closed");
  }
}
async function fetchWithPuppeteer(url) {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const rt = req.resourceType();
      if (["image", "font", "media", "stylesheet"].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    );
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PUPPETEER_TIMEOUT_MS
    });
    await sleep(2e3);
    const html = await page.content();
    const title = await page.title();
    return { html, title };
  } finally {
    await page.close().catch(() => {
    });
  }
}
async function fetchWithPuppeteerLoadMore(url) {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const rt = req.resourceType();
      if (["image", "font", "media"].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    );
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PUPPETEER_TIMEOUT_MS
    });
    await sleep(2e3);
    const LOAD_MORE_SELECTORS = [
      'button:contains("Load More")',
      'button:contains("Show More")',
      'button:contains("Mehr anzeigen")',
      'button:contains("Voir plus")',
      'a:contains("Load More")',
      'a:contains("Show More")',
      '[data-testid*="load-more"]',
      '[class*="load-more"]',
      '[class*="loadmore"]',
      '[class*="show-more"]',
      '[class*="showmore"]'
    ];
    let clickCount = 0;
    const MAX_CLICKS = 30;
    while (clickCount < MAX_CLICKS) {
      let clicked = false;
      for (const sel of LOAD_MORE_SELECTORS) {
        try {
          const found = await page.evaluate((text2) => {
            const buttons = Array.from(document.querySelectorAll("button, a"));
            const btn = buttons.find((b) => {
              const t2 = b.textContent?.trim().toLowerCase() || "";
              return t2 === text2.toLowerCase() || t2.startsWith(text2.toLowerCase());
            });
            if (btn && btn.offsetParent !== null) {
              btn.click();
              return true;
            }
            return false;
          }, sel.replace(/.*:contains\("(.+)"\)/, "$1"));
          if (found) {
            clicked = true;
            clickCount++;
            await sleep(1500);
            break;
          }
        } catch {
        }
      }
      if (!clicked) break;
    }
    if (clickCount > 0) {
      console.log(`[Conference Scraper] Clicked "Load More" ${clickCount} time(s)`);
      await sleep(1e3);
    }
    const html = await page.content();
    const title = await page.title();
    return { html, title };
  } finally {
    await page.close().catch(() => {
    });
  }
}
function detectNextPageUrl(html, currentUrl, currentPage) {
  const base = new URL(currentUrl);
  const baseHost = base.hostname;
  const relNextMatch = html.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i) || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']next["']/i);
  if (relNextMatch) {
    try {
      return new URL(relNextMatch[1], currentUrl).toString();
    } catch {
    }
  }
  const nextTextPatterns = [
    /href=["']([^"']+)["'][^>]*>\s*(?:next|›|»|>>|→|&rsaquo;|&raquo;|&#8250;|&#187;)\s*</i,
    />\s*(?:next|›|»|>>|→|&rsaquo;|&raquo;|&#8250;|&#187;)\s*<\/a[^>]*>.*?href=["']([^"']+)["']/i
  ];
  for (const pat of nextTextPatterns) {
    const m2 = html.match(pat);
    if (m2) {
      const href = m2[1] || m2[2];
      if (href) {
        try {
          const resolved = new URL(href, currentUrl);
          if (resolved.hostname === baseHost) return resolved.toString();
        } catch {
        }
      }
    }
  }
  const anchorRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = anchorRegex.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    if (/^(next|›|»|>>|→|next page|weiter|suivant|siguiente|volgende|nächste)$/i.test(inner)) {
      try {
        const resolved = new URL(href, currentUrl);
        if (resolved.hostname === baseHost) return resolved.toString();
      } catch {
      }
    }
  }
  const pageUrlCandidates = [];
  const queryPageRegex = /href=["']([^"']+[?&](?:page|p|pg|pagenum)=(\d+)[^"']*)["']/gi;
  while ((m = queryPageRegex.exec(html)) !== null) {
    const n = parseInt(m[2], 10);
    if (n > currentPage) {
      try {
        pageUrlCandidates.push({ page: n, url: new URL(m[1], currentUrl).toString() });
      } catch {
      }
    }
  }
  const pathPageRegex = /href=["']([^"']*\/(?:page|p)\/(\d+)[^"']*)["']/gi;
  while ((m = pathPageRegex.exec(html)) !== null) {
    const n = parseInt(m[2], 10);
    if (n > currentPage) {
      try {
        pageUrlCandidates.push({ page: n, url: new URL(m[1], currentUrl).toString() });
      } catch {
      }
    }
  }
  if (pageUrlCandidates.length > 0) {
    pageUrlCandidates.sort((a, b) => a.page - b.page);
    const next = pageUrlCandidates.find((c) => c.page === currentPage + 1) || pageUrlCandidates[0];
    return next.url;
  }
  const pageParam = base.searchParams.get("page") || base.searchParams.get("p") || base.searchParams.get("pg") || base.searchParams.get("pagenum");
  if (pageParam) {
    const n = parseInt(pageParam, 10);
    if (!isNaN(n)) {
      const next = new URL(currentUrl);
      const paramName = base.searchParams.has("page") ? "page" : base.searchParams.has("p") ? "p" : base.searchParams.has("pg") ? "pg" : "pagenum";
      next.searchParams.set(paramName, String(n + 1));
      return next.toString();
    }
  }
  const pathPageMatch = base.pathname.match(/^(.*\/(?:page|p)\/)(\d+)(\/.*)?$/);
  if (pathPageMatch) {
    const n = parseInt(pathPageMatch[2], 10);
    if (!isNaN(n)) {
      const next = new URL(currentUrl);
      next.pathname = `${pathPageMatch[1]}${n + 1}${pathPageMatch[3] || ""}`;
      return next.toString();
    }
  }
  return null;
}
function detectTotalPages(html, currentUrl) {
  let maxPage = 1;
  const queryPageRegex = /href=["'][^"']*[?&](?:page|p|pg|pagenum)=(\d+)[^"']*["']/gi;
  let m;
  while ((m = queryPageRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }
  const pathPageRegex = /href=["'][^"']*\/(?:page|p)\/(\d+)[^"']*["']/gi;
  while ((m = pathPageRegex.exec(html)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }
  const ofPagesMatch = html.match(/(?:of|\/)\s*(\d+)\s*(?:pages?|pg)/i);
  if (ofPagesMatch) {
    const n = parseInt(ofPagesMatch[1], 10);
    if (n > maxPage) maxPage = n;
  }
  return maxPage > 1 ? maxPage : null;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function scrapeConferenceExhibitors(url, onProgress, maxPages = MAX_PAGES) {
  console.log(`[Conference Scraper] Starting multi-page scrape: ${url}`);
  const allExhibitors = [];
  const visitedUrls = /* @__PURE__ */ new Set();
  let currentUrl = url;
  let pageNum = 1;
  let pagesWithContent = 0;
  let dominantStrategy = "logo-link";
  let dominantFetchMethod = "axios";
  let pageTitle = url;
  let totalPages = null;
  while (currentUrl && pageNum <= maxPages) {
    const normUrl = currentUrl.replace(/\/$/, "");
    if (visitedUrls.has(normUrl)) {
      console.log(`[Conference Scraper] Already visited ${normUrl}, stopping`);
      break;
    }
    visitedUrls.add(normUrl);
    console.log(`[Conference Scraper] Fetching page ${pageNum}: ${currentUrl}`);
    let html;
    let fetchedTitle = null;
    let fetchMethod = "axios";
    let axiosHtml = null;
    try {
      axiosHtml = await fetchWithAxios(currentUrl);
    } catch (err) {
      console.warn(`[Conference Scraper] axios failed: ${err.message}`);
    }
    if (axiosHtml) {
      const { exhibitors: quickCheck } = await extractFromHtml(axiosHtml, currentUrl);
      if (quickCheck.length >= 5) {
        html = axiosHtml;
        fetchMethod = "axios";
      } else {
        console.log(`[Conference Scraper] axios yielded only ${quickCheck.length} companies, trying Puppeteer...`);
        onProgress?.({
          page: pagesWithContent + 1,
          totalPages,
          found: allExhibitors.length,
          message: `Page ${pagesWithContent + 1}: using headless browser (JS-rendered page detected)...`,
          fetchMethod: "puppeteer"
        });
        try {
          const result = await fetchWithPuppeteer(currentUrl);
          html = result.html;
          fetchedTitle = result.title;
          fetchMethod = "puppeteer";
          const { exhibitors: puppeteerCheck } = await extractFromHtml(html, currentUrl);
          if (puppeteerCheck.length < 5) {
            console.log(`[Conference Scraper] Puppeteer yielded only ${puppeteerCheck.length}, trying Load More...`);
            onProgress?.({
              page: pagesWithContent + 1,
              totalPages,
              found: allExhibitors.length,
              message: `Page ${pagesWithContent + 1}: clicking "Load More" buttons...`,
              fetchMethod: "puppeteer-loadmore"
            });
            try {
              const lmResult = await fetchWithPuppeteerLoadMore(currentUrl);
              html = lmResult.html;
              fetchedTitle = lmResult.title;
              fetchMethod = "puppeteer-loadmore";
            } catch (lmErr) {
              console.warn(`[Conference Scraper] Load More failed: ${lmErr.message}`);
            }
          }
        } catch (puppeteerErr) {
          console.warn(`[Conference Scraper] Puppeteer failed: ${puppeteerErr.message}`);
          html = axiosHtml;
          fetchMethod = "axios";
        }
      }
    } else {
      console.log(`[Conference Scraper] axios failed entirely, trying Puppeteer...`);
      onProgress?.({
        page: pagesWithContent + 1,
        totalPages,
        found: allExhibitors.length,
        message: `Page ${pagesWithContent + 1}: using headless browser (page blocked axios)...`,
        fetchMethod: "puppeteer"
      });
      try {
        const result = await fetchWithPuppeteer(currentUrl);
        html = result.html;
        fetchedTitle = result.title;
        fetchMethod = "puppeteer";
      } catch (puppeteerErr) {
        console.error(`[Conference Scraper] All fetch methods failed for page ${pageNum}: ${puppeteerErr.message}`);
        break;
      }
    }
    if (pageNum === 1) {
      if (fetchedTitle) {
        pageTitle = fetchedTitle;
      } else {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        pageTitle = titleMatch ? titleMatch[1].trim() : url;
      }
    }
    if (pageNum === 1) {
      totalPages = detectTotalPages(html, currentUrl);
      if (totalPages) {
        console.log(`[Conference Scraper] Detected ${totalPages} total pages`);
      }
    }
    const { exhibitors, strategy } = await extractFromHtml(html, currentUrl);
    console.log(`[Conference Scraper] Page ${pageNum}: ${exhibitors.length} companies (strategy: ${strategy}, fetch: ${fetchMethod})`);
    if (pageNum === 1) {
      dominantStrategy = strategy;
      dominantFetchMethod = fetchMethod;
    }
    if (exhibitors.length === 0 && pageNum > 1) {
      console.log(`[Conference Scraper] Page ${pageNum} returned 0 companies, stopping`);
      break;
    }
    pagesWithContent++;
    allExhibitors.push(...exhibitors);
    onProgress?.({
      page: pagesWithContent,
      totalPages,
      found: allExhibitors.length,
      message: `Page ${pagesWithContent}${totalPages ? ` of ${totalPages}` : ""}: ${exhibitors.length} exhibitors found (${allExhibitors.length} total, via ${fetchMethod})`,
      fetchMethod
    });
    const nextUrl = detectNextPageUrl(html, currentUrl, pageNum);
    if (!nextUrl || nextUrl === currentUrl) {
      console.log(`[Conference Scraper] No next page detected after page ${pageNum}`);
      break;
    }
    currentUrl = nextUrl;
    pageNum++;
    await sleep(fetchMethod === "axios" ? 500 : 1e3);
  }
  if (dominantFetchMethod !== "axios") {
    await closePuppeteerBrowser();
  }
  const unique = deduplicateExhibitors(allExhibitors);
  console.log(`[Conference Scraper] Done: ${unique.length} unique companies across ${pagesWithContent} page(s) (fetch: ${dominantFetchMethod})`);
  return {
    exhibitors: unique,
    strategy: dominantStrategy,
    fetchMethod: dominantFetchMethod,
    pageTitle,
    pagesScraped: pagesWithContent
  };
}
async function apolloEnrichByName(name, countryCode) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY not set");
  try {
    const countryNameMap = {
      NL: "Netherlands",
      DE: "Germany",
      GB: "United Kingdom",
      US: "United States",
      FR: "France",
      BE: "Belgium",
      CH: "Switzerland",
      AT: "Austria",
      SE: "Sweden",
      NO: "Norway",
      DK: "Denmark",
      FI: "Finland",
      ES: "Spain",
      IT: "Italy",
      PL: "Poland",
      CZ: "Czech Republic",
      HU: "Hungary",
      RO: "Romania",
      CN: "China",
      JP: "Japan",
      KR: "South Korea",
      IN: "India",
      AU: "Australia",
      CA: "Canada",
      BR: "Brazil",
      MX: "Mexico",
      SG: "Singapore",
      AE: "United Arab Emirates"
    };
    const body = {
      q_organization_name: name,
      page: 1,
      per_page: 5
    };
    if (countryCode && countryCode.length === 2) {
      const countryName = countryNameMap[countryCode.toUpperCase()];
      if (countryName) {
        body.organization_locations = [countryName];
      }
    }
    const response = await axios4.post(
      "https://api.apollo.io/api/v1/organizations/search",
      body,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 15e3
      }
    );
    const orgs = response.data?.organizations || [];
    if (orgs.length === 0) return null;
    const normalizedInput = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const exactMatch = orgs.find((o) => {
      const normalized = (o.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalized === normalizedInput;
    });
    const org = exactMatch || orgs[0];
    if (!org) return null;
    const sixMonth = org.organization_headcount_six_month_growth;
    const twelveMonth = org.organization_headcount_twelve_month_growth;
    const growthStr = sixMonth != null || twelveMonth != null ? `6mo: ${sixMonth != null ? (sixMonth * 100).toFixed(1) + "%" : "N/A"} | 12mo: ${twelveMonth != null ? (twelveMonth * 100).toFixed(1) + "%" : "N/A"}` : null;
    return {
      apolloId: org.id,
      name: org.name,
      websiteUrl: org.website_url,
      primaryDomain: org.primary_domain,
      linkedinUrl: org.linkedin_url,
      phone: org.phone || org.primary_phone?.number,
      foundedYear: org.founded_year,
      revenue: org.organization_revenue_printed,
      headcountGrowth: growthStr || void 0,
      sicCodes: org.sic_codes || [],
      naicsCodes: org.naics_codes || [],
      city: org.city,
      state: org.state,
      country: org.country,
      streetAddress: org.street_address
    };
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 422) {
      return null;
    }
    console.warn(`[Apollo Search] Failed for name "${name}":`, error.message);
    return null;
  }
}
async function apolloEnrichByDomain(domain) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY not set");
  try {
    const response = await axios4.post(
      "https://api.apollo.io/api/v1/organizations/enrich",
      { domain },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 15e3
      }
    );
    const org = response.data.organization;
    if (!org) return null;
    const sixMonth = org.organization_headcount_six_month_growth;
    const twelveMonth = org.organization_headcount_twelve_month_growth;
    const growthStr = sixMonth != null || twelveMonth != null ? `6mo: ${sixMonth != null ? (sixMonth * 100).toFixed(1) + "%" : "N/A"} | 12mo: ${twelveMonth != null ? (twelveMonth * 100).toFixed(1) + "%" : "N/A"}` : null;
    return {
      apolloId: org.id,
      name: org.name,
      websiteUrl: org.website_url,
      primaryDomain: org.primary_domain,
      linkedinUrl: org.linkedin_url,
      phone: org.phone || org.primary_phone?.number,
      foundedYear: org.founded_year,
      revenue: org.organization_revenue_printed,
      headcountGrowth: growthStr || void 0,
      sicCodes: org.sic_codes || [],
      naicsCodes: org.naics_codes || [],
      city: org.city,
      state: org.state,
      country: org.country,
      streetAddress: org.street_address
    };
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 422) {
      return null;
    }
    console.warn(`[Apollo Enrich] Failed for domain ${domain}:`, error.message);
    return null;
  }
}
var MAX_PAGES, FETCH_TIMEOUT_MS, PUPPETEER_TIMEOUT_MS, RETRY_ATTEMPTS, LEGAL_SUFFIX_RE, _puppeteerBrowser;
var init_conferenceScraper = __esm({
  "server/conferenceScraper.ts"() {
    "use strict";
    MAX_PAGES = 20;
    FETCH_TIMEOUT_MS = 3e4;
    PUPPETEER_TIMEOUT_MS = 45e3;
    RETRY_ATTEMPTS = 3;
    LEGAL_SUFFIX_RE = /[\s,]+(?:inc\.?|llc\.?|ltd\.?|limited|corp\.?|corporation|co\.?|gmbh|b\.v\.|bv|ag|nv|sa|s\.a\.|plc|pty\.?|pvt\.?|srl|s\.r\.l\.|oy|ab|as|a\/s|kg|kgaa|ohg|gbr|se|spa|s\.p\.a\.)\.?$/i;
    _puppeteerBrowser = null;
  }
});

// server/prompts/index.ts
var prompts_exports = {};
__export(prompts_exports, {
  ALL_PROMPTS: () => ALL_PROMPTS,
  BRAIN_RESEARCH: () => BRAIN_RESEARCH,
  COMPANY_INTELLIGENCE: () => COMPANY_INTELLIGENCE,
  ICP_FIT_SCORING: () => ICP_FIT_SCORING,
  INDUSTRY_CODE_SELECTION: () => INDUSTRY_CODE_SELECTION,
  OFFERING_EXTRACTION: () => OFFERING_EXTRACTION,
  SALES_APPROACH: () => SALES_APPROACH,
  URGENCY_RESEARCH: () => URGENCY_RESEARCH,
  WHY_CALL_TODAY: () => WHY_CALL_TODAY,
  fillTemplate: () => fillTemplate
});
function fillTemplate(template, vars) {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => key in vars ? vars[key] : match
  );
}
var URGENCY_RESEARCH, COMPANY_INTELLIGENCE, ICP_FIT_SCORING, SALES_APPROACH, OFFERING_EXTRACTION, BRAIN_RESEARCH, WHY_CALL_TODAY, INDUSTRY_CODE_SELECTION, ALL_PROMPTS;
var init_prompts = __esm({
  "server/prompts/index.ts"() {
    "use strict";
    URGENCY_RESEARCH = {
      key: "urgency_research",
      name: "Urgency Research",
      description: "Detects buying signals and scores urgency (0-100) for a prospect company using live web search. Produces verified recent developments, urgency signals, and source citations.",
      category: "research",
      version: "1.2.0",
      systemPrompt: "You are a B2B sales intelligence analyst. Today is February 25, 2026. Your goal is to provide verifiable answers with traceable sources from the most recent content available.",
      userPromptTemplate: `{{context}}

**Target Company:** "{{companyName}}" ({{domain}})
**Instructions:**
1. Search for the absolute latest news and developments about "{{companyName}}" from the past 12 months
2. Focus on: product launches, expansions, hiring, partnerships, acquisitions, funding
3. Prioritize sources from 2026 and late 2025
4. Only use verified data from your searches \u2014 do NOT hallucinate URLs or facts

**Score urgency 0-100 based on:**
- Company Context (0-40): Growth stage, financial health, industry momentum
- Market Signals (0-35): Competitive pressure, market expansion, technology shifts
- Recent Activity (0-25): Hiring, announcements, news mentions in past 12 months

Return JSON only with urgencyScore, urgencyBreakdown, recentDevelopments, urgencySignals, sources, searchNotes.`,
      outputFormat: "JSON with urgencyScore (0-100), urgencyBreakdown, recentDevelopments[], urgencySignals[], sources[], searchNotes"
    };
    COMPANY_INTELLIGENCE = {
      key: "company_intelligence",
      name: "Company Intelligence",
      description: "Gathers deep company intelligence: products/services, key technologies, target markets, and competitive positioning. Used in Phase 2 of the Brief Generator.",
      category: "research",
      version: "1.2.0",
      systemPrompt: "You are a B2B sales intelligence analyst. Today is February 25, 2026. Your goal is to provide verifiable company intelligence with traceable sources.",
      userPromptTemplate: `{{context}}

**Target Company:** "{{companyName}}" ({{domain}})
**Instructions:**
1. Search for and browse the company website to extract structured intelligence
2. Focus on products/services, technologies, target markets, and competitive positioning
3. Only use verified data \u2014 do NOT hallucinate URLs or facts

Return JSON with productsServices[], keyTechnologies[], targetMarkets[], competitivePositioning, sources[].`,
      outputFormat: "JSON with productsServices[], keyTechnologies[], targetMarkets[], competitivePositioning, sources[]"
    };
    ICP_FIT_SCORING = {
      key: "icp_fit_scoring",
      name: "ICP Fit Scoring",
      description: "Scores a prospect company's fit against the seller's Ideal Customer Profile (ICP). Produces a 0-100 fit score with dimension breakdown and a human-readable rationale.",
      category: "qualification",
      version: "1.1.0",
      systemPrompt: "You are a B2B sales qualification analyst. Score the prospect company's fit against the seller's Ideal Customer Profile (ICP).",
      userPromptTemplate: `{{brainContext}}

**Prospect Company:** {{companyName}} ({{domain}})
**Brief Data Summary:**
{{briefSummary}}

Score the prospect's ICP fit 0-100. Return JSON with fitScore, fitBreakdown (industryFit, companySizeFit, technologyFit, painPointFit, geographyFit), fitRationale, keyStrengths[], keyWeaknesses[], recommendation.`,
      outputFormat: "JSON with fitScore (0-100), fitBreakdown, fitRationale, keyStrengths[], keyWeaknesses[], recommendation"
    };
    SALES_APPROACH = {
      key: "sales_approach",
      name: "Sales Approach Generator",
      description: "Generates a full personalised sales approach for a prospect: conversation starters grounded in verified sources, engagement strategy, email draft, LinkedIn message, and call script.",
      category: "outreach",
      version: "1.3.0",
      systemPrompt: "You are a B2B sales expert. Today is February 25, 2026. You are crafting a complete sales approach based on verified deep research data.",
      userPromptTemplate: `{{sellerContext}}

**Target Company:** {{companyName}} ({{domain}})
**Deep Research Summary:**
- Urgency Score: {{urgencyScore}}/100
- Products/Services: {{productsServices}}
- Key Technologies: {{keyTechnologies}}
- Target Markets: {{targetMarkets}}

**Verified Recent Developments:**
{{verifiedDevelopments}}

**Verified Sources:**
{{verifiedSources}}

Generate: conversationStarters (3, each with sourceUrl), engagementStrategy, emailDraft, linkedinMessage, callScript. Return JSON only.`,
      outputFormat: "JSON with conversationStarters[], engagementStrategy, emailDraft, linkedinMessage, callScript"
    };
    OFFERING_EXTRACTION = {
      key: "offering_extraction",
      name: "Offering Extraction",
      description: "Analyses a company website to extract what they offer and who their ideal customers are. Produces structured offering data used to seed the Offering Brain.",
      category: "extraction",
      version: "1.1.0",
      systemPrompt: "You are an expert B2B sales strategist and business analyst. Today is February 23, 2026. Your goal is to analyze a company's website with verifiable, traceable sources.",
      userPromptTemplate: `Analyze this company website and extract offering information: {{companyWebsite}}

Search for and browse the website to extract the structured data as JSON. Pay special attention to identifying who their CUSTOMERS are \u2014 what industries and company types buy from them. Verify all information through your searches.

Extract: name, description, targetMarket, valueProposition, keywords[], targetMarketKeywordTags[], crossBorderIndicators, sources[].`,
      outputFormat: "JSON with name, description, targetMarket, valueProposition, keywords[], targetMarketKeywordTags[], crossBorderIndicators, sources[]"
    };
    BRAIN_RESEARCH = {
      key: "brain_research",
      name: "Offering Brain Research",
      description: "Deeply analyses the seller's own company to build the Offering Brain: core capabilities, value propositions, ICP definition, competitive advantages, and urgency triggers.",
      category: "research",
      version: "1.0.0",
      systemPrompt: "You are a B2B sales intelligence analyst specializing in deep company analysis. Today is February 25, 2026.",
      userPromptTemplate: `**Task:** Conduct a thorough analysis of "{{companyName}}" (website: {{companyWebsite}}) to build a complete understanding of their offering, ideal customer profile, and competitive positioning.

Search for and browse the website, LinkedIn, and recent news. Extract: offeringSummary, coreCapabilities[], valuePropositions[], icpDescription, icpIndustries[], icpCompanySize, icpPainPoints[], competitiveAdvantages, urgencyTriggers[], sources[].`,
      outputFormat: "JSON with offeringSummary, coreCapabilities[], valuePropositions[], icpDescription, icpIndustries[], icpCompanySize, icpPainPoints[], competitiveAdvantages, urgencyTriggers[], sources[]"
    };
    WHY_CALL_TODAY = {
      key: "why_call_today",
      name: "Why Call Today",
      description: "Generates a single punchy sentence (max 30 words) explaining why a sales rep should call this company today, grounded in a specific trigger event, news, or signal \u2014 never generic score-based statements.",
      category: "coaching",
      version: "2.0.0",
      systemPrompt: `You are a senior B2B sales coach writing a one-sentence call motivation for a sales rep.

RULES:
1. Write EXACTLY one sentence, max 30 words.
2. The sentence MUST reference a SPECIFIC trigger \u2014 a concrete event, news item, signal, or visitor action. Examples of good triggers:
   - "just announced a new factory in Barcelona"
   - "visited your pricing page 3 times last week"
   - "hired a new VP of Operations in January"
   - "reported 40% revenue growth and is expanding into automotive"
3. NEVER mention scores, percentages, or revenue figures as the primary reason. Those are context, not triggers.
4. NEVER write generic statements like "indicates a critical need" or "shows strong alignment".
5. If a website visit (Leadinfo) exists, ALWAYS lead with that \u2014 it is the strongest buying signal.
6. Connect the trigger to the seller's offering when possible (e.g., "...they'll need EMS capacity" or "...creating demand for your inspection services").
7. Use active, urgent language: "just", "recently", "this month", "right now".
8. The sentence should make the rep think: "I need to call them before a competitor does."`,
      userPromptTemplate: `{{context}}`,
      outputFormat: "Plain text \u2014 one sentence, max 30 words, grounded in a specific trigger event"
    };
    INDUSTRY_CODE_SELECTION = {
      key: "industry_code_selection",
      name: "Industry Code Selection",
      description: "Selects the most relevant SIC and NAICS codes for a given offering using hierarchical reasoning. Used to filter Apollo company searches to the right prospect universe.",
      category: "classification",
      version: "2.0.0",
      systemPrompt: "You are an industry classification expert helping identify potential customers for a B2B offering. Return your answer as a JSON object with sicCodes[], naicsCodes[], and reasoning.",
      userPromptTemplate: `**OFFERING ANALYSIS**
Offering Name: {{offeringName}}
Description: {{offeringDescription}}
Target Market: {{targetMarket}}
Value Proposition: {{valueProposition}}

Select SIC and NAICS codes for companies that would be POTENTIAL CUSTOMERS for this offering. Use hierarchical codes (2-3 digit sector codes for broad coverage, 4-6 digit for niche segments). Return JSON with sicCodes[], naicsCodes[], reasoning.`,
      outputFormat: "JSON with sicCodes[], naicsCodes[], reasoning"
    };
    ALL_PROMPTS = [
      URGENCY_RESEARCH,
      COMPANY_INTELLIGENCE,
      ICP_FIT_SCORING,
      SALES_APPROACH,
      OFFERING_EXTRACTION,
      BRAIN_RESEARCH,
      WHY_CALL_TODAY,
      INDUSTRY_CODE_SELECTION
    ];
  }
});

// server/serperImages.ts
var serperImages_exports = {};
__export(serperImages_exports, {
  fetchSerperImages: () => fetchSerperImages
});
function isDomainBlocked(domain) {
  if (!domain) return false;
  const clean = domain.replace(/^www\./, "").toLowerCase();
  if (BLOCKED_DOMAINS.has(clean)) return true;
  const blockedList = Array.from(BLOCKED_DOMAINS);
  for (let i = 0; i < blockedList.length; i++) {
    if (clean.endsWith(`.${blockedList[i]}`)) return true;
  }
  return false;
}
async function fetchSerperImages(companyName, primaryDomain, limit = 6) {
  const apiKey = ENV.serperApiKey;
  if (!apiKey) throw new Error("SERPER_API_KEY is not configured");
  const ownDomain = primaryDomain?.replace(/^www\./, "").toLowerCase() ?? null;
  const queries = [];
  if (ownDomain) {
    queries.push(`site:${ownDomain} products technology`);
  }
  queries.push(
    `"${companyName}" products technology -site:amazon.com -site:ebay.com -site:alibaba.com -site:pinterest.com`
  );
  const allImages = [];
  const seenUrls = /* @__PURE__ */ new Set();
  for (const query of queries) {
    try {
      const response = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ q: query, num: 10 })
      });
      if (!response.ok) {
        throw new Error(`Serper Images API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      for (const img of data.images ?? []) {
        const url = img.imageUrl ?? "";
        if (!url || seenUrls.has(url)) continue;
        if (isDomainBlocked(img.domain ?? "")) continue;
        seenUrls.add(url);
        allImages.push(img);
      }
    } catch (err) {
      if (queries.indexOf(query) === queries.length - 1) throw err;
    }
  }
  const domainMatched = ownDomain ? allImages.filter((img) => img.domain?.replace(/^www\./, "").toLowerCase() === ownDomain) : [];
  const others = ownDomain ? allImages.filter((img) => img.domain?.replace(/^www\./, "").toLowerCase() !== ownDomain) : allImages;
  const ordered = [...domainMatched, ...others].slice(0, limit);
  return ordered.map((img) => ({
    imageUrl: img.imageUrl ?? "",
    thumbnailUrl: img.thumbnailUrl ?? "",
    title: img.title ?? "",
    source: img.source ?? img.domain ?? "",
    domain: img.domain ?? "",
    link: img.link ?? ""
  }));
}
var BLOCKED_DOMAINS;
var init_serperImages = __esm({
  "server/serperImages.ts"() {
    "use strict";
    init_env();
    BLOCKED_DOMAINS = /* @__PURE__ */ new Set([
      "amazon.com",
      "amazon.co.uk",
      "amazon.de",
      "amazon.fr",
      "amazon.nl",
      "amazon.es",
      "amazon.it",
      "amazon.ca",
      "amazon.com.au",
      "ebay.com",
      "ebay.co.uk",
      "ebay.de",
      "ebay.fr",
      "ebay.nl",
      "alibaba.com",
      "aliexpress.com",
      "dhgate.com",
      "made-in-china.com",
      "walmart.com",
      "target.com",
      "bestbuy.com",
      "newegg.com",
      "etsy.com",
      "wish.com",
      "temu.com",
      "shein.com",
      "pinterest.com",
      "instagram.com",
      "facebook.com",
      "twitter.com",
      "shutterstock.com",
      "gettyimages.com",
      "istockphoto.com",
      "dreamstime.com",
      "alamy.com",
      "depositphotos.com",
      "123rf.com",
      "google.com",
      "bing.com",
      "yahoo.com",
      "wikipedia.org",
      "wikimedia.org"
    ]);
  }
});

// server/supabaseSync.ts
var supabaseSync_exports = {};
__export(supabaseSync_exports, {
  getCompaniesTableSyncStats: () => getCompaniesTableSyncStats,
  pullAllBrainsFromSupabase: () => pullAllBrainsFromSupabase,
  pullSingleBrainFromSupabase: () => pullSingleBrainFromSupabase,
  pushSingleBrainToSupabase: () => pushSingleBrainToSupabase,
  syncAllCompaniesToSupabase: () => syncAllCompaniesToSupabase,
  syncBrainsToSupabase: () => syncBrainsToSupabase,
  syncCompaniesToSupabase: () => syncCompaniesToSupabase,
  syncCompanyPagesToSupabase: () => syncCompanyPagesToSupabase,
  syncContactsToSupabase: () => syncContactsToSupabase,
  syncSearchRunToSupabase: () => syncSearchRunToSupabase
});
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { eq as eq2, inArray, isNotNull } from "drizzle-orm";
function toUUID(prefix, id) {
  return uuidv5(`${prefix}-${id}`, LT_NAMESPACE);
}
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false }
  });
}
async function syncCompaniesToSupabase(companyIds) {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };
  const rows = await db.select({
    company: companies,
    search: searches
  }).from(companies).leftJoin(searches, eq2(companies.searchId, searches.id)).where(inArray(companies.id, companyIds));
  if (rows.length === 0) return { synced: 0, errors: 0, message: "No companies found" };
  const allRows = rows.map(({ company, search }) => {
    const brief = company.briefData ? JSON.parse(company.briefData) : {};
    const fitData = company.fitScoreData ? JSON.parse(company.fitScoreData) : {};
    const signals = brief.urgencySignals ?? [];
    const topSignal = signals[0];
    const urgencyLabel = (company.urgencyScore ?? 0) >= 70 ? "HIGH" : (company.urgencyScore ?? 0) >= 40 ? "MEDIUM" : "LOW";
    const slice = company.sliceMetadata ? JSON.parse(company.sliceMetadata) : {};
    const profileParts = [];
    if (brief.whyThisCompanyMatters) profileParts.push(brief.whyThisCompanyMatters);
    if (brief.recommendedApproach) profileParts.push(`Approach: ${brief.recommendedApproach}`);
    const profileText = profileParts.join(" | ") || null;
    return {
      id: toUUID("company", company.id),
      company_name: company.name,
      domain: company.websiteUrl ?? null,
      _urgencyScore: company.urgencyScore ?? 0,
      // temp field for dedup sorting
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
      has_contacts: false,
      // updated separately after contacts sync
      contact_count: 0,
      notes: null,
      niche_id: company.nicheId ?? null,
      niche_name: null,
      // populated by niche clustering — not available here
      dimension_scores: null,
      // populated by fit scoring engine — not available here
      priority: urgencyLabel,
      // mirror urgency label as a simple priority indicator
      researched_at: company.briefGeneratedAt?.toISOString() ?? null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      synced_at: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: company.createdAt?.toISOString() ?? (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  const domainMap = /* @__PURE__ */ new Map();
  const noDomainRows = [];
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
  const companyRows = [...Array.from(domainMap.values()), ...noDomainRows].map(({ _urgencyScore, ...rest }) => rest);
  let synced = 0;
  let errors = 0;
  const BATCH = 50;
  for (let i = 0; i < companyRows.length; i += BATCH) {
    const batch = companyRows.slice(i, i + BATCH);
    const { error } = await supabase.from("lt_mns_companies").upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    if (error) {
      for (const row of batch) {
        const { error: singleError } = await supabase.from("lt_mns_companies").upsert([row], { onConflict: "id", ignoreDuplicates: false });
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
  await syncSignalsForCompanies(supabase, rows.map((r) => r.company));
  return {
    synced,
    errors,
    message: `Synced ${synced} companies to Supabase${errors > 0 ? ` (${errors} errors)` : ""}`
  };
}
async function syncSignalsForCompanies(supabase, companyList) {
  const signalRows = [];
  for (const company of companyList) {
    if (!company.briefData) continue;
    const brief = JSON.parse(company.briefData);
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
        synced_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  if (signalRows.length === 0) return;
  const { error } = await supabase.from("lt_mns_prospect_signals").upsert(signalRows, { onConflict: "id" });
  if (error) {
    console.error("[SupabaseSync] Error syncing signals:", error.message);
  }
}
async function syncCompanyPagesToSupabase(appBaseUrl) {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };
  const rows = await db.select({ company: companies, search: searches }).from(companies).leftJoin(searches, eq2(companies.searchId, searches.id)).where(isNotNull(companies.briefData));
  if (rows.length === 0) return { synced: 0, errors: 0, message: "No researched companies found" };
  const pageRows = rows.map(({ company, search }) => {
    const brief = company.briefData ? JSON.parse(company.briefData) : {};
    const fitData = company.fitScoreData ? JSON.parse(company.fitScoreData) : {};
    const urgencyLabel = (company.urgencyScore ?? 0) >= 70 ? "HIGH" : (company.urgencyScore ?? 0) >= 40 ? "MEDIUM" : "LOW";
    const pageUrl = `/company/${company.id}`;
    return {
      id: toUUID("page", company.id),
      company_id: toUUID("company", company.id),
      local_id: company.id,
      company_name: company.name,
      domain: company.websiteUrl ?? null,
      campaign_id: company.searchId ?? null,
      campaign_name: search?.offeringName ?? null,
      urgency_score: company.urgencyScore ?? null,
      fit_score: company.fitScore ?? null,
      urgency_label: urgencyLabel,
      fit_label: fitData.label ?? null,
      page_url: pageUrl,
      synced_at: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: company.createdAt?.toISOString() ?? (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  const CHUNK = 500;
  let totalErrors = 0;
  for (let i = 0; i < pageRows.length; i += CHUNK) {
    const chunk = pageRows.slice(i, i + CHUNK);
    const { error } = await supabase.from("lt_mns_company_pages").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("[SupabaseSync] Error syncing company pages:", error.message);
      totalErrors += chunk.length;
    }
  }
  return {
    synced: pageRows.length - totalErrors,
    errors: totalErrors,
    message: `Synced ${pageRows.length - totalErrors} company pages to Supabase`
  };
}
async function syncContactsToSupabase(companyIds) {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };
  const rows = await db.select({
    contact: contacts,
    company: companies
  }).from(contacts).leftJoin(companies, eq2(contacts.companyId, companies.id)).where(inArray(contacts.companyId, companyIds));
  if (rows.length === 0) return { synced: 0, errors: 0, message: "No contacts found" };
  const contactRows = rows.map(({ contact, company }) => ({
    id: String(contact.id),
    company_id: String(contact.companyId),
    company_name: company?.name ?? "",
    company_domain: company?.websiteUrl ?? null,
    company_country: company?.country ?? null,
    full_name: contact.fullName ?? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
    first_name: contact.firstName ?? null,
    last_name: contact.lastName ?? null,
    job_title: contact.title ?? null,
    seniority_level: null,
    // Apollo doesn't return this in our current schema
    department: null,
    email: contact.email ?? null,
    email_confidence: null,
    linkedin_url: contact.linkedinUrl ?? null,
    phone: contact.phone ?? null,
    apollo_id: contact.apolloPersonId ?? null,
    why_contact_this_person: contact.searchedTitle ? `Identified as ${contact.searchedTitle} via Apollo trickle-down search` : null,
    synced_at: (/* @__PURE__ */ new Date()).toISOString(),
    created_at: contact.createdAt?.toISOString() ?? (/* @__PURE__ */ new Date()).toISOString()
  }));
  const { error } = await supabase.from("lt_mns_prospect_contacts").upsert(contactRows, { onConflict: "id" });
  if (error) {
    console.error("[SupabaseSync] Error syncing contacts:", error.message);
    return { synced: 0, errors: contactRows.length, message: error.message };
  }
  const countByCompany = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const cid = row.contact.companyId;
    countByCompany.set(cid, (countByCompany.get(cid) ?? 0) + 1);
  }
  for (const [companyId, count2] of Array.from(countByCompany.entries())) {
    await supabase.from("lt_mns_companies").update({ has_contacts: true, contact_count: count2, synced_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", toUUID("company", companyId));
  }
  return {
    synced: contactRows.length,
    errors: 0,
    message: `Synced ${contactRows.length} contacts to Supabase`
  };
}
function mapBrainToSupabaseRow(brain) {
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
    updated_at: brain.updatedAt?.toISOString() ?? (/* @__PURE__ */ new Date()).toISOString(),
    synced_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function syncBrainsToSupabase() {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };
  const brains = await db.select().from(offeringBrain);
  if (brains.length === 0) return { synced: 0, errors: 0, message: "No brains found" };
  const brainRows = brains.map((brain) => mapBrainToSupabaseRow(brain));
  const { error } = await supabase.from("lt_mns_offering_brains").upsert(brainRows, { onConflict: "id" });
  if (error) {
    console.error("[SupabaseSync] Error syncing brains:", error.message);
    return { synced: 0, errors: brainRows.length, message: error.message };
  }
  return {
    synced: brainRows.length,
    errors: 0,
    message: `Synced ${brainRows.length} brains to Supabase`
  };
}
async function pushSingleBrainToSupabase(brainId) {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { success: false, message: "Database not available" };
  const [brain] = await db.select().from(offeringBrain).where(eq2(offeringBrain.id, brainId));
  if (!brain) return { success: false, message: `Brain ${brainId} not found` };
  const row = mapBrainToSupabaseRow(brain);
  const { error } = await supabase.from("lt_mns_offering_brains").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("[SupabaseSync] Error pushing brain:", error.message);
    return { success: false, message: error.message };
  }
  return {
    success: true,
    message: `Pushed "${brain.brainName}" to Supabase (${Object.keys(row).length} fields)`
  };
}
async function pullSingleBrainFromSupabase(brainId) {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { success: false, message: "Database not available" };
  const { data, error } = await supabase.from("lt_mns_offering_brains").select("*").eq("id", String(brainId)).single();
  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? `Brain ${brainId} not found in Supabase`
    };
  }
  const updatedFields = [];
  const updates = {};
  const fieldMap = [
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
    { remote: "raw_research_data", local: "rawResearchData" }
  ];
  for (const { remote, local } of fieldMap) {
    if (data[remote] !== void 0 && data[remote] !== null) {
      updates[local] = data[remote];
      updatedFields.push(local);
    }
  }
  if (updatedFields.length === 0) {
    return { success: true, message: "No fields to update from Supabase", updatedFields: [] };
  }
  await db.update(offeringBrain).set(updates).where(eq2(offeringBrain.id, brainId));
  return {
    success: true,
    message: `Pulled ${updatedFields.length} fields from Supabase into "${data.brain_name}"`,
    updatedFields
  };
}
async function syncAllCompaniesToSupabase() {
  const db = await getDb();
  if (!db) return { synced: 0, errors: 0, message: "Database not available" };
  const allCompanies = await db.select({ id: companies.id }).from(companies).where(isNotNull(companies.briefData));
  if (allCompanies.length === 0) {
    return { synced: 0, errors: 0, message: "No researched companies found" };
  }
  const CHUNK = 200;
  const ids = allCompanies.map((c) => c.id);
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
    message: `Synced ${totalSynced} companies to lt_mns_companies${totalErrors > 0 ? ` (${totalErrors} errors)` : ""}`
  };
}
async function getCompaniesTableSyncStats() {
  try {
    const supabase = getSupabaseClient();
    const { count: count2, error } = await supabase.from("lt_mns_companies").select("*", { count: "exact", head: true });
    if (error) {
      console.error("[SupabaseSync] Error getting companies stats:", error.message);
      return { count: 0, lastSyncedAt: null };
    }
    const { data: lastRow } = await supabase.from("lt_mns_companies").select("synced_at").order("synced_at", { ascending: false }).limit(1).single();
    return {
      count: count2 ?? 0,
      lastSyncedAt: lastRow?.synced_at ?? null
    };
  } catch (e) {
    console.error("[SupabaseSync] Error getting companies stats:", e);
    return { count: 0, lastSyncedAt: null };
  }
}
async function syncSearchRunToSupabase(searchId) {
  const db = await getDb();
  if (!db) return { companiesSynced: 0, contactsSynced: 0, errors: 0, message: "Database not available" };
  const searchCompanies = await db.select({ id: companies.id }).from(companies).where(eq2(companies.searchId, searchId));
  if (searchCompanies.length === 0) {
    return { companiesSynced: 0, contactsSynced: 0, errors: 0, message: "No companies in search" };
  }
  const ids = searchCompanies.map((c) => c.id);
  const companyResult = await syncCompaniesToSupabase(ids);
  const contactResult = await syncContactsToSupabase(ids);
  return {
    companiesSynced: companyResult.synced,
    contactsSynced: contactResult.synced,
    errors: companyResult.errors + contactResult.errors,
    message: `Search ${searchId}: ${companyResult.synced} companies, ${contactResult.synced} contacts synced`
  };
}
async function pullAllBrainsFromSupabase(ownerUserId = 1) {
  const supabase = getSupabaseClient();
  const db = await getDb();
  if (!db) return { imported: 0, updated: 0, skipped: 0, errors: 0, message: "Database not available" };
  const { data: remoteBrains, error } = await supabase.from("lt_mns_offering_brains").select("*").order("created_at", { ascending: true });
  if (error || !remoteBrains) {
    return { imported: 0, updated: 0, skipped: 0, errors: 1, message: error?.message ?? "Failed to fetch from Supabase" };
  }
  const localBrains = await db.select().from(offeringBrain);
  const localById = new Map(localBrains.map((b) => [b.id, b]));
  const localByName = new Map(localBrains.map((b) => [b.brainName?.toLowerCase().trim(), b]));
  const fieldMap = [
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
    { remote: "raw_research_data", local: "rawResearchData" }
  ];
  let imported = 0, updated = 0, skipped = 0, errors = 0;
  for (const remote of remoteBrains) {
    try {
      const payload = {};
      for (const { remote: rk, local: lk } of fieldMap) {
        if (remote[rk] !== void 0 && remote[rk] !== null) {
          payload[lk] = typeof remote[rk] === "object" ? JSON.stringify(remote[rk]) : remote[rk];
        }
      }
      if (!payload.brainName) {
        skipped++;
        continue;
      }
      const localBrainId = remote.local_brain_id ? Number(remote.local_brain_id) : null;
      let existing;
      if (localBrainId && localById.has(localBrainId)) {
        existing = localById.get(localBrainId);
      } else {
        existing = localByName.get(payload.brainName.toLowerCase().trim());
      }
      if (existing) {
        await db.update(offeringBrain).set(payload).where(eq2(offeringBrain.id, existing.id));
        updated++;
      } else {
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
          isShared: 1
          // make visible to all users
        });
        imported++;
      }
    } catch (e) {
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
    message: `Pulled ${imported} new + ${updated} updated brains from Supabase (${skipped} skipped, ${errors} errors)`
  };
}
var LT_NAMESPACE;
var init_supabaseSync = __esm({
  "server/supabaseSync.ts"() {
    "use strict";
    init_db();
    init_schema();
    LT_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/companyFinder.ts
init_db();
init_apolloPeopleSearch();
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";
import { randomUUID } from "crypto";

// server/brainResearchService.ts
var XAI_API_KEY = process.env.XAI_API_KEY;
var XAI_BASE_URL = "https://api.x.ai/v1";
async function callGrokWithWebSearch(input) {
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable not set");
  }
  const response = await fetch(`${XAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${XAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      tools: [{ type: "web_search" }],
      input,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.content && Array.isArray(item.content)) {
        const textContent = item.content.find((c) => c.type === "output_text");
        if (textContent?.text) {
          return textContent.text;
        }
      }
    }
  }
  if (data.text) {
    return data.text;
  }
  throw new Error("Unexpected Responses API format: no output text found");
}
function stripCitationTags(text2) {
  if (!text2) return text2;
  return text2.replace(/<grok:[\s\S]*?<\/grok:[^>]*>/g, "").replace(/<[a-z]+:[^>]*\/>/g, "").trim();
}
function coerceToStringArray(arr) {
  return arr.map((item) => {
    if (typeof item === "string") return stripCitationTags(item);
    if (item && typeof item === "object") {
      const type = item.type ? stripCitationTags(String(item.type)) : "";
      const desc4 = item.description ? stripCitationTags(String(item.description)) : "";
      const starter = item.conversationStarter ? stripCitationTags(String(item.conversationStarter)) : "";
      const opener = item.opener ? stripCitationTags(String(item.opener)) : "";
      if (type && desc4) return `${type} \u2014 ${desc4}`;
      if (desc4) return desc4;
      if (starter) return starter;
      if (opener) return opener;
      if (type) return type;
      return JSON.stringify(item);
    }
    return String(item);
  }).filter((s) => s.length > 0);
}
async function researchOfferingBrain(companyWebsite, companyName) {
  const domain = companyWebsite.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const displayName = companyName || domain;
  console.log(`[Brain Research] Starting deep offering research for ${displayName} (${domain})`);
  const prompt = `You are a B2B sales intelligence analyst specializing in deep company analysis. Today is ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.

**Task:** Conduct a thorough analysis of "${displayName}" (website: ${companyWebsite}) to build a complete understanding of their offering, ideal customer profile, and competitive positioning.

**Instructions:**
1. Search the company website and any available sources for comprehensive information
2. Focus on understanding WHAT they sell, WHO they sell to, and WHY customers choose them
3. Be specific and actionable \u2014 this intelligence will be used to evaluate every prospect

**Research areas:**
- Company overview and core offering
- Specific capabilities and services
- Value propositions for different customer segments
- Competitive advantages and differentiators
- Ideal customer profile (industries, company size, geography, pain points)
- Buying signals that indicate a prospect needs this company's services
- Fit criteria: what makes a prospect a great fit vs. a poor fit
- Urgency triggers: events that create immediate need

**Return JSON only:**
{
  "companyName": "${displayName}",
  "companyWebsite": "${companyWebsite}",
  "offeringSummary": "2-3 sentence summary of what the company does and their core value",
  "coreCapabilities": [
    "Specific capability 1 (e.g., 'PCB assembly for high-reliability applications')",
    "Specific capability 2",
    "..."
  ],
  "valuePropositions": [
    {
      "proposition": "Specific value proposition",
      "targetAudience": "Who this resonates with most"
    }
  ],
  "competitiveAdvantages": "What makes this company unique vs competitors (paragraph)",
  "icpIndustries": ["Industry 1", "Industry 2", "..."],
  "icpCompanySize": "Description of ideal company size (e.g., 'Mid-market to enterprise, 100-10,000 employees')",
  "icpGeography": "Target geographies and any cross-border capabilities",
  "icpPainPoints": [
    "Specific pain point the offering solves (e.g., 'Need to reduce time-to-market for electronic products')",
    "..."
  ],
  "icpBuyingSignals": [
    "Observable signal that a company needs this (e.g., 'Company announced new product line requiring electronics manufacturing')",
    "..."
  ],
  "fitCriteria": {
    "mustHave": [
      "Criteria that must be true for a prospect to be a good fit",
      "..."
    ],
    "niceToHave": [
      "Criteria that improve fit but aren't required",
      "..."
    ],
    "disqualifiers": [
      "Red flags that indicate a prospect is NOT a fit",
      "..."
    ]
  },
  "urgencyTriggers": [
    "Event or signal that creates immediate need (e.g., 'Current supplier capacity issues')",
    "..."
  ]
}`;
  const rawResponse = await callGrokWithWebSearch(prompt);
  console.log(`[Brain Research] Received response, parsing...`);
  try {
    let jsonStr = rawResponse;
    const firstBrace = rawResponse.indexOf("{");
    const lastBrace = rawResponse.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = rawResponse.slice(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(jsonStr);
    const result = {
      companyName: stripCitationTags(parsed.companyName || displayName),
      companyWebsite: parsed.companyWebsite || companyWebsite,
      offeringSummary: stripCitationTags(parsed.offeringSummary || ""),
      coreCapabilities: coerceToStringArray(Array.isArray(parsed.coreCapabilities) ? parsed.coreCapabilities : []),
      valuePropositions: Array.isArray(parsed.valuePropositions) ? parsed.valuePropositions.map((vp) => ({
        proposition: stripCitationTags(vp.proposition || ""),
        targetAudience: stripCitationTags(vp.targetAudience || "")
      })) : [],
      competitiveAdvantages: stripCitationTags(parsed.competitiveAdvantages || ""),
      icpIndustries: coerceToStringArray(Array.isArray(parsed.icpIndustries) ? parsed.icpIndustries : []),
      icpCompanySize: stripCitationTags(parsed.icpCompanySize || ""),
      icpGeography: stripCitationTags(parsed.icpGeography || ""),
      icpPainPoints: coerceToStringArray(Array.isArray(parsed.icpPainPoints) ? parsed.icpPainPoints : []),
      icpBuyingSignals: coerceToStringArray(Array.isArray(parsed.icpBuyingSignals) ? parsed.icpBuyingSignals : []),
      fitCriteria: {
        mustHave: coerceToStringArray(Array.isArray(parsed.fitCriteria?.mustHave) ? parsed.fitCriteria.mustHave : []),
        niceToHave: coerceToStringArray(Array.isArray(parsed.fitCriteria?.niceToHave) ? parsed.fitCriteria.niceToHave : []),
        disqualifiers: coerceToStringArray(Array.isArray(parsed.fitCriteria?.disqualifiers) ? parsed.fitCriteria.disqualifiers : [])
      },
      urgencyTriggers: coerceToStringArray(Array.isArray(parsed.urgencyTriggers) ? parsed.urgencyTriggers : [])
    };
    console.log(`[Brain Research] \u2713 Successfully parsed brain for ${result.companyName}`);
    console.log(`[Brain Research]   - ${result.coreCapabilities.length} capabilities`);
    console.log(`[Brain Research]   - ${result.valuePropositions.length} value propositions`);
    console.log(`[Brain Research]   - ${result.icpIndustries.length} ICP industries`);
    console.log(`[Brain Research]   - ${result.icpPainPoints.length} pain points`);
    console.log(`[Brain Research]   - ${result.icpBuyingSignals.length} buying signals`);
    return result;
  } catch (parseError) {
    console.error(`[Brain Research] Failed to parse response:`, parseError);
    console.error(`[Brain Research] Raw response:`, rawResponse.substring(0, 500));
    throw new Error(`Failed to parse brain research response: ${parseError}`);
  }
}

// server/brainExcelService.ts
init_llm();
import * as XLSX from "xlsx";
function col(sheet, row, colIdx) {
  const addr = XLSX.utils.encode_cell({ r: row, c: colIdx });
  const cell2 = sheet[addr];
  return cell2 ? String(cell2.v ?? "").trim() : "";
}
function readColumn(sheet, colIdx, maxRows = 50) {
  const results = [];
  for (let r = 1; r < maxRows; r++) {
    const v = col(sheet, r, colIdx);
    if (v) results.push(v);
  }
  return results;
}
function overviewField(sheet, fieldName) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:C20");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const label = col(sheet, r, 0).toUpperCase();
    if (label.includes(fieldName.toUpperCase())) {
      return col(sheet, r, 1);
    }
  }
  return "";
}
function parseOfferingExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const warnings = [];
  const ws1 = wb.Sheets["Overview"];
  if (!ws1) throw new Error("Missing 'Overview' sheet \u2014 please use the official template.");
  const companyName = overviewField(ws1, "Company Name");
  const companyWebsite = overviewField(ws1, "Company Website");
  const brainName = overviewField(ws1, "Brain Name");
  const offeringSummary = overviewField(ws1, "Offering Summary");
  const competitiveAdv = overviewField(ws1, "Competitive Advantages");
  const icpCompanySize = overviewField(ws1, "ICP Company Size");
  const icpGeography = overviewField(ws1, "ICP Geography");
  if (!companyName) warnings.push("Company Name is empty \u2014 please fill in the Overview sheet.");
  if (!offeringSummary) warnings.push("Offering Summary is empty \u2014 the brain will have limited context.");
  const ws2 = wb.Sheets["Capabilities"];
  const coreCapabilities = ws2 ? readColumn(ws2, 0) : [];
  if (coreCapabilities.length === 0) warnings.push("No capabilities found in the Capabilities sheet.");
  const ws3 = wb.Sheets["Value Propositions"];
  const valuePropositions = [];
  if (ws3) {
    for (let r = 1; r < 50; r++) {
      const prop = col(ws3, r, 0);
      const audience = col(ws3, r, 1);
      if (prop) valuePropositions.push({ proposition: prop, targetAudience: audience || "" });
    }
  }
  const ws4 = wb.Sheets["ICP"];
  const icpIndustries = ws4 ? readColumn(ws4, 0) : [];
  const icpPainPoints = ws4 ? readColumn(ws4, 1) : [];
  const icpBuyingSignals = ws4 ? readColumn(ws4, 2) : [];
  const ws5 = wb.Sheets["Fit Criteria"];
  const mustHave = ws5 ? readColumn(ws5, 0) : [];
  const niceToHave = ws5 ? readColumn(ws5, 1) : [];
  const disqualifiers = ws5 ? readColumn(ws5, 2) : [];
  const ws6 = wb.Sheets["Urgency Triggers"];
  const urgencyTriggers = ws6 ? readColumn(ws6, 0) : [];
  const raw = {
    companyName: companyName || "Unknown Company",
    companyWebsite: companyWebsite || "",
    offeringSummary: offeringSummary || "",
    coreCapabilities,
    valuePropositions,
    competitiveAdvantages: competitiveAdv || "",
    icpIndustries,
    icpCompanySize: icpCompanySize || "",
    icpGeography: icpGeography || "",
    icpPainPoints,
    icpBuyingSignals,
    fitCriteria: { mustHave, niceToHave, disqualifiers },
    urgencyTriggers
  };
  return { raw, brainName: brainName || `${companyName || "Company"} Brain`, warnings };
}
async function normaliseBrainFromExcel(parsed) {
  const prompt = `You are a B2B sales intelligence analyst. A user has uploaded an Excel sheet describing their company's offering. Your task is to review the data, fill any obvious gaps with reasonable inferences, clean up phrasing, and return a complete, consistent brain profile.

Input data:
${JSON.stringify(parsed, null, 2)}

Rules:
- Keep all user-provided content \u2014 do NOT invent facts that contradict it
- If a field is empty or sparse, infer reasonable content from the other fields
- Return valid JSON matching the schema exactly
- No markdown, no explanation \u2014 JSON only

Return JSON:
{
  "companyName": string,
  "companyWebsite": string,
  "offeringSummary": string,
  "coreCapabilities": string[],
  "valuePropositions": [{ "proposition": string, "targetAudience": string }],
  "competitiveAdvantages": string,
  "icpIndustries": string[],
  "icpCompanySize": string,
  "icpGeography": string,
  "icpPainPoints": string[],
  "icpBuyingSignals": string[],
  "fitCriteria": { "mustHave": string[], "niceToHave": string[], "disqualifiers": string[] },
  "urgencyTriggers": string[]
}`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a B2B sales intelligence analyst. Return only valid JSON." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  });
  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("LLM returned empty response during brain normalisation");
  const llmResult = JSON.parse(content);
  const toStringArray = (v) => {
    if (!Array.isArray(v)) return [];
    return v.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const type = item.type ? String(item.type) : "";
        const desc4 = item.description ? String(item.description) : "";
        const starter = item.conversationStarter ? String(item.conversationStarter) : "";
        const opener = item.opener ? String(item.opener) : "";
        if (type && desc4) return `${type} \u2014 ${desc4}`;
        if (desc4) return desc4;
        if (starter) return starter;
        if (opener) return opener;
        if (type) return type;
        return JSON.stringify(item);
      }
      return String(item);
    }).filter((s) => s.length > 0);
  };
  const result = {
    companyName: llmResult.companyName ?? "",
    companyWebsite: llmResult.companyWebsite ?? "",
    offeringSummary: llmResult.offeringSummary ?? "",
    coreCapabilities: toStringArray(llmResult.coreCapabilities),
    valuePropositions: Array.isArray(llmResult.valuePropositions) ? llmResult.valuePropositions.map((vp) => ({
      proposition: vp.proposition ?? "",
      targetAudience: vp.targetAudience ?? ""
    })) : [],
    competitiveAdvantages: llmResult.competitiveAdvantages ?? "",
    icpIndustries: toStringArray(llmResult.icpIndustries),
    icpCompanySize: llmResult.icpCompanySize ?? "",
    icpGeography: llmResult.icpGeography ?? "",
    icpPainPoints: toStringArray(llmResult.icpPainPoints),
    icpBuyingSignals: toStringArray(llmResult.icpBuyingSignals),
    fitCriteria: {
      mustHave: toStringArray(llmResult.fitCriteria?.mustHave),
      niceToHave: toStringArray(llmResult.fitCriteria?.niceToHave),
      disqualifiers: toStringArray(llmResult.fitCriteria?.disqualifiers)
    },
    urgencyTriggers: toStringArray(llmResult.urgencyTriggers)
  };
  return result;
}

// server/companyFinder.ts
init_db();

// server/offeringExtractor.ts
var XAI_API_KEY2 = process.env.XAI_API_KEY;
var XAI_BASE_URL2 = "https://api.x.ai/v1";
var OFFERING_EXTRACTION_PROMPT = `You are an expert B2B sales strategist and business analyst. Today is ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Your goal is to analyze a company's website with verifiable, traceable sources.

Your job is to determine:
1. What this company offers (their product/service)
2. WHO their ideal customers are \u2014 the types of companies that would BUY from them

This is critical: we need to find POTENTIAL CUSTOMERS for this company, not companies similar to them.

**Instructions:**
1. Search for information about the company's products, services, customers, and industries served
2. Visit the company website to extract key information from homepage, products/services, about, and solutions pages
3. Only use verified data from your searches \u2014 do NOT hallucinate URLs or facts

**Extract the following fields:**

1. **name**: The main product/service name (e.g., "Electronics Manufacturing Services (EMS)")
2. **description**: A 2-3 sentence overview of what the company offers
3. **targetMarket**: Ideal customer profile \u2014 what industries, company types, and segments buy from them
4. **valueProposition**: Unique value and problems solved (2-3 sentences)
5. **keywords**: 5-10 keywords describing the company's OWN offering
6. **targetMarketKeywordTags**: THIS IS THE MOST IMPORTANT FIELD. Provide 5-15 specific industry keyword tags that describe the CUSTOMERS who would buy from this company.

   Rules for targetMarketKeywordTags:
   - Each tag should be a single industry term or market segment (1-3 words max)
   - Tags should describe the BUYER's industry, not the seller's
   - Include both broad and specific terms
   - Think: "What industries need this company's products/services?"
   
   Example: If the company makes industrial connectors, their targetMarketKeywordTags would be:
   ["industrial automation", "manufacturing", "aerospace", "defense", "medical devices", "telecommunications", "automotive", "energy", "oil and gas", "robotics"]

7. **crossBorderIndicators**: Evidence of international operations (2-3 sentences, or empty string)
8. **sources**: Array of verified source URLs used to extract this information

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "name": "...",
  "description": "...",
  "targetMarket": "...",
  "valueProposition": "...",
  "keywords": ["...", "..."],
  "targetMarketKeywordTags": ["...", "..."],
  "crossBorderIndicators": "...",
  "sources": [
    {"url": "https://company.com/about", "title": "About Page", "snippet": "Key excerpt"}
  ]
}`;
async function extractOffering(companyWebsite) {
  if (!XAI_API_KEY2) {
    throw new Error("XAI_API_KEY environment variable not set");
  }
  try {
    const response = await fetch(`${XAI_BASE_URL2}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY2}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        tools: [{ type: "web_search" }],
        // Explicit web_search tool
        input: `${OFFERING_EXTRACTION_PROMPT}

Analyze this company website and extract offering information: ${companyWebsite}

Search for and browse the website to extract the structured data as JSON. Pay special attention to identifying who their CUSTOMERS are \u2014 what industries and company types buy from them. Verify all information through your searches.`,
        response_format: { type: "json_object" }
      })
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    let assistantMessage = null;
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.content && Array.isArray(item.content)) {
          const textContent = item.content.find((c) => c.type === "output_text");
          if (textContent?.text) {
            assistantMessage = textContent.text;
            break;
          }
        }
      }
    }
    if (!assistantMessage && data.text) {
      assistantMessage = data.text;
    }
    if (!assistantMessage) {
      throw new Error("Unexpected Responses API format: no output text found in response.output[].content[]");
    }
    let jsonStr = assistantMessage.trim();
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```\n?/g, "").replace(/```\n?$/g, "");
    }
    const offering = JSON.parse(jsonStr);
    if (!offering.name || !offering.description || !offering.targetMarket || !offering.valueProposition) {
      throw new Error("Missing required fields in offering extraction");
    }
    if (!offering.keywords || offering.keywords.length === 0) {
      offering.keywords = ["business", "services"];
    }
    if (!offering.targetMarketKeywordTags || offering.targetMarketKeywordTags.length === 0) {
      offering.targetMarketKeywordTags = offering.targetMarket.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 2 && s.length < 40).slice(0, 15);
    }
    return offering;
  } catch (error) {
    console.error("Error extracting offering:", error);
    throw new Error(`Failed to extract offering: ${error.message}`);
  }
}

// server/companyFinder.ts
init_apolloSearch();

// shared/urlUtils.ts
function normalizeWebsiteUrl(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid URL input");
  }
  let normalized = input.trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, "");
  if (normalized.startsWith("http://")) {
    normalized = normalized.replace("http://", "https://");
  } else if (normalized.startsWith("https://")) {
  } else {
    normalized = `https://${normalized}`;
  }
  const urlObj = new URL(normalized);
  const hostname = urlObj.hostname;
  if (!hostname.includes(".")) {
    urlObj.hostname = `${hostname}.com`;
    normalized = urlObj.toString();
  }
  try {
    const finalUrl = new URL(normalized);
    return finalUrl.toString();
  } catch (error) {
    throw new Error(`Could not normalize URL: ${input}`);
  }
}

// server/companyFinder.ts
init_codeSelectionService();
init_naicsHierarchy();
async function assertSearchAccess(searchId, userId) {
  const search = await getSearchById(searchId);
  if (!search || search.userId !== userId && !search.sharedWithTeam) {
    throw new TRPCError3({ code: "NOT_FOUND", message: "Search not found" });
  }
  return search;
}
async function assertSearchOwner(searchId, userId) {
  const search = await getSearchById(searchId);
  if (!search || search.userId !== userId) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Only the campaign owner can perform this action" });
  }
  return search;
}
async function assertCompanyAccess(companyId, userId) {
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError3({ code: "NOT_FOUND", message: "Company not found" });
  const search = await getSearchById(company.searchId);
  if (!search || search.userId !== userId && !search.sharedWithTeam) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Access denied" });
  }
  return company;
}
async function stampBrainOnCompany(companyId, userId) {
  try {
    const brain = await getActiveBrain(userId);
    if (brain) {
      await updateCompany(companyId, {
        generatedWithBrainId: brain.id,
        generatedWithBrainName: brain.brainName
      });
    }
  } catch {
  }
}
var companyFinderRouter = router({
  // Create a new search using the active Offering Brain (brain-agnostic)
  startSearch: protectedProcedure.input(
    z2.object({
      location: z2.string().min(1)
    })
  ).mutation(async ({ ctx, input }) => {
    const brain = await getActiveBrain(ctx.user.id);
    if (!brain || brain.status !== "completed") {
      throw new TRPCError3({
        code: "PRECONDITION_FAILED",
        message: "No active Offering Brain found. Please create one first on the Brain page."
      });
    }
    const coreCapabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
    const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
    const valuePropositions = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
    const brainOffering = {
      name: brain.offeringSummary || brain.brainName,
      description: `${brain.companyName}: ${brain.offeringSummary || ""} ${brain.competitiveAdvantages || ""}`.trim(),
      targetMarket: icpIndustries.join(" \u2022 ") || "General B2B",
      keywords: coreCapabilities.slice(0, 10),
      targetMarketKeywordTags: [
        ...icpIndustries.map((i) => i.toLowerCase()),
        ...coreCapabilities.map((c) => c.toLowerCase())
      ].slice(0, 40)
    };
    const vpSummary = valuePropositions.map((vp) => vp.value).join("; ") || brain.competitiveAdvantages || "";
    console.log(`[Search] Selecting industry codes for offering: ${brainOffering.name}`);
    const codeSelection = await selectIndustryCodes({
      offeringName: brainOffering.name,
      offeringDescription: brainOffering.description,
      targetMarket: brainOffering.targetMarket,
      valueProposition: vpSummary
    });
    const searchId = await createSearch({
      userId: ctx.user.id,
      companyWebsite: brain.companyWebsite,
      location: input.location,
      status: "code_targeting",
      // STOP here for user review
      offeringName: brainOffering.name,
      offeringDescription: brainOffering.description,
      targetMarket: brainOffering.targetMarket,
      keywords: JSON.stringify(brainOffering.keywords),
      keywordTagsUsed: JSON.stringify(brainOffering.targetMarketKeywordTags),
      selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
      selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
      codeSelectionReasoning: codeSelection.reasoning,
      excludedSectors: JSON.stringify([]),
      // Empty initially, user can exclude sectors
      brainId: brain.id
    });
    return { searchId };
  }),
  // Get search status and results (paginated — default 100 per page)
  getSearch: protectedProcedure.input(z2.object({ searchId: z2.number(), page: z2.number().optional().default(0), pageSize: z2.number().optional().default(100), brainId: z2.number().optional() })).query(async ({ ctx, input }) => {
    const search = await assertSearchAccess(input.searchId, ctx.user.id);
    const offset = input.page * input.pageSize;
    const [companiesList, decisions, totalCount] = await Promise.all([
      getCompaniesBySearchIdPaged(input.searchId, input.pageSize, offset),
      getDecisionsBySearch(input.searchId),
      countCompaniesBySearchId(input.searchId)
    ]);
    let mergedCompanies = companiesList;
    if (input.brainId) {
      const enrichedIds = companiesList.filter((c) => c.enrichmentStatus === "enriched").map((c) => c.id);
      const brainOutputMap = await getCompanyBrainOutputsForSearch(enrichedIds, input.brainId);
      mergedCompanies = companiesList.map((c) => {
        const out = brainOutputMap.get(c.id);
        return {
          ...c,
          // Override display fields with brain-scoped values
          urgencyScore: out?.urgencyScore ?? c.urgencyScore,
          fitScore: out?.fitScore ?? c.fitScore,
          briefGeneratedAt: out?.briefGeneratedAt ?? null,
          salesApproachGeneratedAt: out?.salesApproachGeneratedAt ?? null,
          // Keep original values accessible under brain-prefixed keys
          brainUrgencyScore: out?.urgencyScore ?? null,
          brainFitScore: out?.fitScore ?? null,
          brainBriefGeneratedAt: out?.briefGeneratedAt ?? null,
          brainSalesApproachGeneratedAt: out?.salesApproachGeneratedAt ?? null
        };
      });
    }
    const enrichedCount = mergedCompanies.filter((c) => c.enrichmentStatus === "enriched").length;
    const pendingCount = mergedCompanies.filter((c) => c.enrichmentStatus === "pending").length;
    const nameOnlyCount = mergedCompanies.filter(
      (c) => c.enrichmentStatus === "pending" && !c.apolloId && !c.primaryDomain
    ).length;
    const outreachReadyCount = mergedCompanies.filter(
      (c) => c.enrichmentStatus === "enriched" && !!c.salesApproachGeneratedAt
    ).length;
    return {
      search,
      companies: mergedCompanies,
      decisions,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: totalCount,
        hasMore: offset + companiesList.length < totalCount
      },
      enrichmentStats: {
        total: totalCount,
        enriched: enrichedCount,
        pending: pendingCount,
        nameOnly: nameOnlyCount,
        outreachReady: outreachReadyCount
      }
    };
  }),
  // Get user's search history
  getSearchHistory: protectedProcedure.input(z2.object({ showArchived: z2.boolean().optional().default(false) })).query(async ({ ctx, input }) => {
    return getUserSearches(ctx.user.id, input.showArchived);
  }),
  // Archive / unarchive a search run
  archiveSearch: protectedProcedure.input(z2.object({ searchId: z2.number(), archive: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await archiveSearch(input.searchId, ctx.user.id, input.archive);
    return { success: true };
  }),
  // STEP 2: Batch enrich all pending companies for a search
  enrichAll: protectedProcedure.input(z2.object({ searchId: z2.number() })).mutation(async ({ ctx, input }) => {
    const search = await assertSearchOwner(input.searchId, ctx.user.id);
    const pendingCompanies = await getPendingCompaniesBySearchId(input.searchId);
    if (pendingCompanies.length === 0) {
      return { enriched: 0, failed: 0, message: "All companies already enriched" };
    }
    console.log(`[Enrich] Starting batch enrichment for ${pendingCompanies.length} companies in search ${input.searchId}`);
    let enriched = 0;
    let failed = 0;
    const batchSize = 5;
    for (let i = 0; i < pendingCompanies.length; i += batchSize) {
      const batch = pendingCompanies.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (company) => {
          if (!company.apolloId) {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
            return;
          }
          try {
            const details = await enrichCompanyDetails(company.apolloId);
            await updateCompany(company.id, {
              city: details.city || null,
              state: details.state || null,
              country: details.country || null,
              streetAddress: details.street_address || null,
              rawAddress: details.raw_address || null,
              enrichmentStatus: "enriched"
            });
            enriched++;
          } catch (error) {
            console.warn(`[Enrich] Failed for company ${company.id}:`, error instanceof Error ? error.message : error);
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
          }
        })
      );
      console.log(`[Enrich] Batch progress: ${Math.min(i + batchSize, pendingCompanies.length)}/${pendingCompanies.length}`);
    }
    console.log(`[Enrich] Done. Enriched: ${enriched}, Failed: ${failed}`);
    return { enriched, failed, message: `Enriched ${enriched} companies, ${failed} failed` };
  }),
  // ---------------------------------------------------------------------------
  // doNext10 — enrich + research + approach the next N companies in one shot
  // Priority: pending (unenriched) first, then enriched-but-no-brief, then brief-but-no-approach
  // ---------------------------------------------------------------------------
  // fire-and-forget: returns jobId immediately, runs in background.
  // Job state is persisted to batch_jobs table so it survives server restarts.
  doNext10: protectedProcedure.input(z2.object({ searchId: z2.number(), limit: z2.number().optional().default(10), brainId: z2.number().optional() })).mutation(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const jobId = randomUUID();
    await createBatchJob({
      id: jobId,
      searchId: input.searchId,
      userId: ctx.user.id,
      status: "running",
      progress: 0,
      currentCompany: null,
      totalCompanies: 0,
      enriched: 0,
      researched: 0,
      approached: 0,
      failed: 0,
      remaining: 0
    });
    (async () => {
      try {
        const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
        const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
        const all = await getCompaniesBySearchId(input.searchId);
        const limit = input.limit;
        const brain = input.brainId ? await getOfferingBrainById(input.brainId, ctx.user.id) : await getActiveBrain(ctx.user.id);
        const resolvedBrainId = brain?.id;
        let brainOutputMap = /* @__PURE__ */ new Map();
        if (resolvedBrainId) {
          const enrichedIds = all.filter((c) => c.enrichmentStatus === "enriched").map((c) => c.id);
          brainOutputMap = await getCompanyBrainOutputsForSearch(enrichedIds, resolvedBrainId);
        }
        const pending = all.filter((c) => c.enrichmentStatus === "pending" && !!c.apolloId);
        const needsBrief = all.filter((c) => {
          if (c.enrichmentStatus !== "enriched") return false;
          if (!resolvedBrainId) return !c.briefGeneratedAt;
          const out = brainOutputMap.get(c.id);
          return !out?.briefGeneratedAt;
        });
        const needsApproach = all.filter((c) => {
          if (c.enrichmentStatus !== "enriched") return false;
          if (!resolvedBrainId) return !!c.briefGeneratedAt && !c.salesApproachGeneratedAt;
          const out = brainOutputMap.get(c.id);
          return !!out?.briefGeneratedAt && !out?.salesApproachGeneratedAt;
        });
        const queue = [...pending, ...needsBrief, ...needsApproach].slice(0, limit);
        await updateBatchJob(jobId, { totalCompanies: queue.length });
        console.log(`[doNext10] jobId=${jobId} searchId=${input.searchId} brainId=${resolvedBrainId} \u2014 ${queue.length} companies queued`);
        let enriched = 0, researched = 0, approached = 0, failed = 0;
        const PER_COMPANY_TIMEOUT_MS = 4 * 60 * 1e3;
        for (let i = 0; i < queue.length; i++) {
          const company = queue[i];
          const progress2 = Math.round(i / queue.length * 100);
          await updateBatchJob(jobId, { currentCompany: company.name || null, progress: progress2, enriched, researched, approached, failed });
          try {
            const companyWork = async () => {
              if (company.enrichmentStatus === "pending") {
                const details = await enrichCompanyDetails(company.apolloId);
                await updateCompany(company.id, {
                  city: details.city || null,
                  state: details.state || null,
                  country: details.country || null,
                  streetAddress: details.street_address || null,
                  rawAddress: details.raw_address || null,
                  enrichmentStatus: "enriched"
                });
                enriched++;
                console.log(`[doNext10] \u2713 Enriched: ${company.name}`);
              }
              const existingOutput = resolvedBrainId ? await getCompanyBrainOutput(company.id, resolvedBrainId) : null;
              const hasBrief = resolvedBrainId ? !!existingOutput?.briefGeneratedAt : !!company.briefGeneratedAt;
              const hasApproach = resolvedBrainId ? !!existingOutput?.salesApproachGeneratedAt : !!company.salesApproachGeneratedAt;
              if (!hasBrief) {
                const brief = await generateSalesIntelligenceBrief2(company.id, ctx.user.id, input.brainId);
                if (resolvedBrainId) {
                  await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                    urgencyScore: brief.urgencyScore,
                    briefData: JSON.stringify(brief),
                    briefGeneratedAt: /* @__PURE__ */ new Date()
                  });
                }
                await updateCompany(company.id, {
                  urgencyScore: brief.urgencyScore,
                  briefData: JSON.stringify(brief),
                  briefGeneratedAt: /* @__PURE__ */ new Date(),
                  generatedWithBrainId: resolvedBrainId ?? null,
                  generatedWithBrainName: brain?.brainName ?? null
                });
                researched++;
                console.log(`[doNext10] \u2713 Researched: ${company.name}`);
              }
              if (!hasApproach) {
                const approach = await generateSalesApproach2(company.id, ctx.user.id, input.brainId);
                if (resolvedBrainId) {
                  await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                    salesApproachData: JSON.stringify(approach),
                    salesApproachGeneratedAt: /* @__PURE__ */ new Date()
                  });
                }
                await updateCompany(company.id, {
                  salesApproachData: JSON.stringify(approach),
                  salesApproachGeneratedAt: /* @__PURE__ */ new Date()
                });
                approached++;
                console.log(`[doNext10] \u2713 Approached: ${company.name}`);
              }
            };
            const timeoutGuard = new Promise(
              (_, reject) => setTimeout(() => reject(new Error(`Per-company timeout after ${PER_COMPANY_TIMEOUT_MS / 1e3}s`)), PER_COMPANY_TIMEOUT_MS)
            );
            await Promise.race([companyWork(), timeoutGuard]);
          } catch (err) {
            failed++;
            console.error(`[doNext10] \u2717 ${company.name}:`, err.message);
          }
        }
        const refreshed = await getCompaniesBySearchId(input.searchId);
        let remaining;
        if (resolvedBrainId) {
          const allIds = refreshed.filter((c) => c.enrichmentStatus === "enriched").map((c) => c.id);
          const refreshedMap = await getCompanyBrainOutputsForSearch(allIds, resolvedBrainId);
          remaining = refreshed.filter(
            (c) => c.enrichmentStatus === "pending" && !!c.apolloId || c.enrichmentStatus === "enriched" && !refreshedMap.get(c.id)?.salesApproachGeneratedAt
          ).length;
        } else {
          remaining = refreshed.filter(
            (c) => c.enrichmentStatus === "pending" || !c.briefGeneratedAt || !c.salesApproachGeneratedAt
          ).length;
        }
        await updateBatchJob(jobId, {
          status: "completed",
          progress: 100,
          currentCompany: null,
          enriched,
          researched,
          approached,
          failed,
          remaining
        });
        console.log(`[doNext10] Done \u2014 enriched:${enriched} researched:${researched} approached:${approached} failed:${failed} remaining:${remaining}`);
      } catch (err) {
        await updateBatchJob(jobId, { status: "failed", errorMessage: err.message }).catch(() => {
        });
        console.error(`[doNext10] Fatal:`, err.message);
      }
    })();
    return { jobId };
  }),
  // Poll job status (lightweight, called every 3s by client while job runs)
  getJobStatus: protectedProcedure.input(z2.object({ jobId: z2.string() })).query(async ({ input }) => {
    const job = await getBatchJob(input.jobId);
    if (!job) return null;
    const clientStatus = job.status === "completed" ? "done" : job.status === "failed" ? "error" : job.status === "cancelled" ? "cancelled" : "running";
    return {
      status: clientStatus,
      jobType: job.jobType,
      current: job.currentCompany ?? null,
      progress: job.progress,
      stats: {
        enriched: job.enriched,
        researched: job.researched,
        approached: job.approached,
        failed: job.failed,
        total: job.totalCompanies,
        remaining: job.remaining
      },
      error: job.errorMessage ?? null
    };
  }),
  // Returns the most recent batch job for a search so the client can resume
  // polling after a page reload without losing visibility into a running job.
  getLatestJob: protectedProcedure.input(z2.object({ searchId: z2.number() })).query(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const job = await getLatestBatchJobForSearch(input.searchId);
    if (!job) return null;
    if (job.status === "running") {
      const staleCutoff = new Date(Date.now() - 5 * 60 * 1e3);
      if (job.updatedAt < staleCutoff) {
        await updateBatchJob(job.id, { status: "failed", errorMessage: "Job interrupted \u2014 no progress for 5 minutes" });
        return null;
      }
      return { jobId: job.id };
    }
    return null;
  }),
  // ---------------------------------------------------------------------------
  // doAll — process ALL remaining companies in a search in one background job
  // Same logic as doNext10 but no limit and checks for cancellation each step.
  // ---------------------------------------------------------------------------
  doAll: protectedProcedure.input(z2.object({ searchId: z2.number(), brainId: z2.number().optional() })).mutation(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const jobId = randomUUID();
    await createBatchJob({
      id: jobId,
      searchId: input.searchId,
      userId: ctx.user.id,
      status: "running",
      jobType: "doAll",
      progress: 0,
      currentCompany: null,
      totalCompanies: 0,
      enriched: 0,
      researched: 0,
      approached: 0,
      failed: 0,
      remaining: 0
    });
    (async () => {
      try {
        const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
        const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
        const all = await getCompaniesBySearchId(input.searchId);
        const brain = input.brainId ? await getOfferingBrainById(input.brainId, ctx.user.id) : await getActiveBrain(ctx.user.id);
        const resolvedBrainId = brain?.id;
        let brainOutputMap = /* @__PURE__ */ new Map();
        if (resolvedBrainId) {
          const enrichedIds = all.filter((c) => c.enrichmentStatus === "enriched").map((c) => c.id);
          brainOutputMap = await getCompanyBrainOutputsForSearch(enrichedIds, resolvedBrainId);
        }
        const needsWork = all.filter((c) => {
          if (c.enrichmentStatus === "pending" && !!c.apolloId) return true;
          if (c.enrichmentStatus !== "enriched") return false;
          if (!resolvedBrainId) return !c.briefGeneratedAt || !c.salesApproachGeneratedAt;
          const out = brainOutputMap.get(c.id);
          return !out?.salesApproachGeneratedAt;
        });
        const queue = needsWork;
        await updateBatchJob(jobId, { totalCompanies: queue.length });
        console.log(`[doAll] jobId=${jobId} searchId=${input.searchId} brainId=${resolvedBrainId} \u2014 ${queue.length} companies queued`);
        const CONCURRENCY2 = Math.max(1, parseInt(process.env.DOALL_CONCURRENCY || "5", 10));
        const PER_COMPANY_TIMEOUT_MS = 4 * 60 * 1e3;
        let enriched = 0, researched = 0, approached = 0, failed = 0, completed = 0;
        let cancelled = false;
        const processCompany = async (company) => {
          const companyWork = async () => {
            if (company.enrichmentStatus === "pending") {
              const details = await enrichCompanyDetails(company.apolloId);
              await updateCompany(company.id, {
                city: details.city || null,
                state: details.state || null,
                country: details.country || null,
                streetAddress: details.street_address || null,
                rawAddress: details.raw_address || null,
                enrichmentStatus: "enriched"
              });
              enriched++;
              console.log(`[doAll] \u2713 Enriched: ${company.name}`);
            }
            const existingOutput = resolvedBrainId ? await getCompanyBrainOutput(company.id, resolvedBrainId) : null;
            const hasBrief = resolvedBrainId ? !!existingOutput?.briefGeneratedAt : !!company.briefGeneratedAt;
            const hasApproach = resolvedBrainId ? !!existingOutput?.salesApproachGeneratedAt : !!company.salesApproachGeneratedAt;
            if (!hasBrief) {
              const brief = await generateSalesIntelligenceBrief2(company.id, ctx.user.id, input.brainId);
              if (resolvedBrainId) {
                await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                  urgencyScore: brief.urgencyScore,
                  briefData: JSON.stringify(brief),
                  briefGeneratedAt: /* @__PURE__ */ new Date()
                });
              }
              await updateCompany(company.id, {
                urgencyScore: brief.urgencyScore,
                briefData: JSON.stringify(brief),
                briefGeneratedAt: /* @__PURE__ */ new Date(),
                generatedWithBrainId: resolvedBrainId ?? null,
                generatedWithBrainName: brain?.brainName ?? null
              });
              researched++;
              console.log(`[doAll] \u2713 Researched: ${company.name}`);
            }
            if (!hasApproach) {
              const approach = await generateSalesApproach2(company.id, ctx.user.id, input.brainId);
              if (resolvedBrainId) {
                await upsertCompanyBrainOutput(company.id, resolvedBrainId, {
                  salesApproachData: JSON.stringify(approach),
                  salesApproachGeneratedAt: /* @__PURE__ */ new Date()
                });
              }
              await updateCompany(company.id, {
                salesApproachData: JSON.stringify(approach),
                salesApproachGeneratedAt: /* @__PURE__ */ new Date()
              });
              approached++;
              console.log(`[doAll] \u2713 Approached: ${company.name}`);
            }
          };
          const timeoutGuard = new Promise(
            (_, reject) => setTimeout(() => reject(new Error(`Per-company timeout after ${PER_COMPANY_TIMEOUT_MS / 1e3}s`)), PER_COMPANY_TIMEOUT_MS)
          );
          try {
            await Promise.race([companyWork(), timeoutGuard]);
          } catch (err) {
            failed++;
            console.error(`[doAll] \u2717 ${company.name}:`, err.message);
          } finally {
            completed++;
            const progress2 = Math.round(completed / queue.length * 100);
            updateBatchJob(jobId, {
              currentCompany: company.name || null,
              progress: progress2,
              enriched,
              researched,
              approached,
              failed
            }).catch(() => {
            });
          }
        };
        for (let i = 0; i < queue.length; i += CONCURRENCY2) {
          const currentJob = await getBatchJob(jobId);
          if (currentJob?.status === "cancelled") {
            cancelled = true;
            console.log(`[doAll] Cancelled at batch starting company ${i + 1}/${queue.length}`);
            break;
          }
          const batch = queue.slice(i, i + CONCURRENCY2);
          console.log(`[doAll] Processing batch ${Math.floor(i / CONCURRENCY2) + 1}: companies ${i + 1}\u2013${i + batch.length} of ${queue.length} (${CONCURRENCY2} parallel)`);
          await Promise.allSettled(batch.map(processCompany));
        }
        if (!cancelled) {
          const refreshed = await getCompaniesBySearchId(input.searchId);
          let remaining;
          if (resolvedBrainId) {
            const allIds = refreshed.filter((c) => c.enrichmentStatus === "enriched").map((c) => c.id);
            const refreshedMap = await getCompanyBrainOutputsForSearch(allIds, resolvedBrainId);
            remaining = refreshed.filter(
              (c) => c.enrichmentStatus === "pending" && !!c.apolloId || c.enrichmentStatus === "enriched" && !refreshedMap.get(c.id)?.salesApproachGeneratedAt
            ).length;
          } else {
            remaining = refreshed.filter(
              (c) => c.enrichmentStatus === "pending" || !c.briefGeneratedAt || !c.salesApproachGeneratedAt
            ).length;
          }
          await updateBatchJob(jobId, {
            status: "completed",
            progress: 100,
            currentCompany: null,
            enriched,
            researched,
            approached,
            failed,
            remaining
          });
          console.log(`[doAll] Done \u2014 enriched:${enriched} researched:${researched} approached:${approached} failed:${failed} remaining:${remaining} (${CONCURRENCY2} workers)`);
        }
      } catch (err) {
        await updateBatchJob(jobId, { status: "failed", errorMessage: err.message }).catch(() => {
        });
        console.error(`[doAll] Fatal:`, err.message);
      }
    })();
    return { jobId };
  }),
  // Cancel a running job — sets DB status to "cancelled".
  // The doAll background loop checks this flag before each company and exits cleanly.
  cancelJob: protectedProcedure.input(z2.object({ jobId: z2.string() })).mutation(async ({ ctx, input }) => {
    const job = await getBatchJob(input.jobId);
    if (!job) throw new TRPCError3({ code: "NOT_FOUND", message: "Job not found" });
    if (job.userId !== ctx.user.id) throw new TRPCError3({ code: "FORBIDDEN", message: "Not your job" });
    if (job.status !== "running") return { cancelled: false, reason: "Job is not running" };
    await updateBatchJob(input.jobId, { status: "cancelled", errorMessage: "Cancelled by user" });
    console.log(`[cancelJob] jobId=${input.jobId} cancelled by user ${ctx.user.id}`);
    return { cancelled: true };
  }),
  // Returns prev/next company IDs for a given company within a search (server-side queue navigation)
  getAdjacentCompany: protectedProcedure.input(z2.object({ searchId: z2.number(), companyId: z2.number() })).query(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const all = await getCompaniesBySearchId(input.searchId);
    const idx = all.findIndex((c) => c.id === input.companyId);
    if (idx === -1) return null;
    return {
      position: idx + 1,
      total: all.length,
      prevId: idx > 0 ? all[idx - 1].id : null,
      nextId: idx < all.length - 1 ? all[idx + 1].id : null
    };
  }),
  // Export companies as CSV
  enrichSingle: protectedProcedure.input(z2.object({ companyId: z2.number() })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    if (!company.apolloId) {
      await updateCompany(company.id, { enrichmentStatus: "failed" });
      throw new Error("Company has no Apollo ID");
    }
    try {
      console.log(`[Enrich] Enriching single company ${company.id}`);
      const details = await enrichCompanyDetails(company.apolloId);
      await updateCompany(company.id, {
        city: details.city || null,
        state: details.state || null,
        country: details.country || null,
        streetAddress: details.street_address || null,
        rawAddress: details.raw_address || null,
        enrichmentStatus: "enriched"
      });
      return { success: true, message: "Company enriched successfully" };
    } catch (error) {
      console.warn(`[Enrich] Failed for company ${company.id}:`, error instanceof Error ? error.message : error);
      await updateCompany(company.id, { enrichmentStatus: "failed" });
      throw new Error(`Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }),
  // Export companies as CSV
  exportCsv: protectedProcedure.input(z2.object({ searchId: z2.number() })).query(async ({ ctx, input }) => {
    const search = await assertSearchAccess(input.searchId, ctx.user.id);
    const companiesList = await getCompaniesBySearchId(input.searchId);
    const headers = [
      "Name",
      "Website",
      "Domain",
      "LinkedIn",
      "Phone",
      "Founded",
      "Revenue",
      "Headcount Growth",
      "SIC Codes",
      "NAICS Codes",
      "Enrichment Status",
      "Search Location",
      "City",
      "State",
      "Country",
      "Street Address"
    ];
    const rows = companiesList.map((c) => [
      c.name,
      c.websiteUrl || "",
      c.primaryDomain || "",
      c.linkedinUrl || "",
      c.phone || "",
      c.foundedYear?.toString() || "",
      c.revenue || "",
      c.headcountGrowth || "",
      c.sicCodes || "",
      c.naicsCodes || "",
      c.enrichmentStatus || "pending",
      c.searchLocation || "",
      c.city || "",
      c.state || "",
      c.country || "",
      c.streetAddress || ""
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell2) => `"${cell2.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    return { csv: csvContent };
  }),
  // HITL: Submit decision on company relevance
  submitDecision: protectedProcedure.input(
    z2.object({
      companyId: z2.number(),
      searchId: z2.number(),
      decision: z2.enum(["call_today", "park", "not_relevant"]),
      reasonCode: z2.string().optional(),
      reasonNotes: z2.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const decisionId = await createCompanyDecision({
      companyId: input.companyId,
      searchId: input.searchId,
      userId: ctx.user.id,
      decision: input.decision,
      reasonCode: input.reasonCode || null,
      reasonNotes: input.reasonNotes || null
    });
    if (input.decision === "not_relevant" && input.reasonCode === "wrong_industry") {
      const sicCodes = company.sicCodes ? JSON.parse(company.sicCodes) : [];
      const naicsCodes = company.naicsCodes ? JSON.parse(company.naicsCodes) : [];
      for (const code of sicCodes) {
        await addExcludedCode({
          userId: ctx.user.id,
          codeType: "sic",
          code,
          codeDescription: null
        });
      }
      for (const code of naicsCodes) {
        await addExcludedCode({
          userId: ctx.user.id,
          codeType: "naics",
          code,
          codeDescription: null
        });
      }
    }
    if (input.decision === "call_today") {
      (async () => {
        try {
          if (!company.briefData) {
            console.log(`[submitDecision] Auto-triggering Deep Research for company ${input.companyId}`);
            const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
            const brief = await generateSalesIntelligenceBrief2(input.companyId, ctx.user.id);
            await updateCompany(input.companyId, {
              urgencyScore: brief.urgencyScore,
              briefData: JSON.stringify(brief),
              briefGeneratedAt: /* @__PURE__ */ new Date()
            });
            console.log(`[submitDecision] \u2713 Deep Research completed for company ${input.companyId}`);
          } else {
            console.log(`[submitDecision] Deep Research already exists for company ${input.companyId}, skipping`);
          }
          if (!company.salesApproachData) {
            console.log(`[submitDecision] Auto-triggering Sales Approach for company ${input.companyId}`);
            const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
            const salesApproach = await generateSalesApproach2(input.companyId, ctx.user.id);
            await updateCompany(input.companyId, {
              salesApproachData: JSON.stringify(salesApproach),
              salesApproachGeneratedAt: /* @__PURE__ */ new Date()
            });
            console.log(`[submitDecision] \u2713 Sales Approach completed for company ${input.companyId}`);
          } else {
            console.log(`[submitDecision] Sales Approach already exists for company ${input.companyId}, skipping`);
          }
        } catch (error) {
          console.error(`[submitDecision] Background generation error for company ${input.companyId}:`, error.message);
        }
      })();
    }
    return { decisionId, success: true };
  }),
  // HITL: Get decision for a company
  getDecision: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ ctx, input }) => {
    await assertCompanyAccess(input.companyId, ctx.user.id);
    const decision = await getCompanyDecision(input.companyId, ctx.user.id);
    return decision ?? null;
  }),
  // HITL: Get all decisions for a search
  getSearchDecisions: protectedProcedure.input(z2.object({ searchId: z2.number() })).query(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    return await getDecisionsBySearch(input.searchId);
  }),
  // HITL: Get excluded codes
  getExcludedCodes: protectedProcedure.query(async ({ ctx }) => {
    return await getExcludedCodes(ctx.user.id);
  }),
  // HITL: Remove excluded code
  removeExcludedCode: protectedProcedure.input(z2.object({ codeId: z2.number() })).mutation(async ({ ctx, input }) => {
    await removeExcludedCode(input.codeId, ctx.user.id);
    return { success: true };
  }),
  // Sector exclusion: Update excluded sectors for a search
  updateExcludedSectors: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    excludedSectors: z2.array(z2.string())
  })).mutation(async ({ ctx, input }) => {
    await assertSearchOwner(input.searchId, ctx.user.id);
    await updateSearch(input.searchId, {
      excludedSectors: JSON.stringify(input.excludedSectors)
    });
    return { success: true };
  }),
  // Two-step search: Confirm code targeting and start batched Apollo search
  confirmAndSearch: protectedProcedure.input(z2.object({
    searchId: z2.number()
  })).mutation(async ({ ctx, input }) => {
    const search = await assertSearchOwner(input.searchId, ctx.user.id);
    if (search.status !== "searching") {
      throw new Error("Search must be in searching status");
    }
    const { confirmAndSearch: confirmAndSearch2 } = await Promise.resolve().then(() => (init_confirmAndSearch(), confirmAndSearch_exports));
    confirmAndSearch2({
      searchId: input.searchId,
      location: search.location
    }).catch((error) => {
      console.error(`[confirmAndSearch] Error:`, error);
      updateSearch(input.searchId, {
        status: "failed",
        errorMessage: error.message
      });
    });
    return { success: true, message: "Batched search started" };
  }),
  // Generate sales intelligence brief for a company
  generateBrief: protectedProcedure.input(z2.object({
    companyId: z2.number(),
    force: z2.boolean().optional(),
    // If true, bypass cache and regenerate
    brainId: z2.number().optional()
    // If provided, use this brain and write to company_brain_outputs
  })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    console.log(`[generateBrief] Starting brief generation for company ${input.companyId} brainId=${input.brainId ?? "active"}`);
    if (!input.force && input.brainId) {
      const existingOutput = await getCompanyBrainOutput(input.companyId, input.brainId);
      if (existingOutput?.briefData && existingOutput.briefGeneratedAt) {
        const cacheAge = Date.now() - new Date(existingOutput.briefGeneratedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
        if (cacheAge < sevenDaysMs) {
          console.log(`[generateBrief] Using brain-scoped cached brief (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1e3))} days)`);
          return { success: true, brief: JSON.parse(existingOutput.briefData), cached: true, cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1e3)) };
        }
      }
    } else if (!input.force && company.briefData && company.briefGeneratedAt) {
      const cacheAge = Date.now() - new Date(company.briefGeneratedAt).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
      if (cacheAge < sevenDaysMs) {
        console.log(`[generateBrief] Using cached brief (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1e3))} days)`);
        const cachedBrief = JSON.parse(company.briefData);
        return { success: true, brief: cachedBrief, cached: true, cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1e3)) };
      } else {
        console.log(`[generateBrief] Cached brief expired (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1e3))} days), regenerating...`);
      }
    }
    const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
    try {
      const brief = await generateSalesIntelligenceBrief2(input.companyId, ctx.user.id, input.brainId);
      const resolvedBrainId = input.brainId ?? (await getActiveBrain(ctx.user.id))?.id;
      if (resolvedBrainId) {
        await upsertCompanyBrainOutput(input.companyId, resolvedBrainId, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: /* @__PURE__ */ new Date()
        });
      }
      await updateCompany(input.companyId, {
        urgencyScore: brief.urgencyScore,
        briefData: JSON.stringify(brief),
        briefGeneratedAt: /* @__PURE__ */ new Date()
      });
      await stampBrainOnCompany(input.companyId, ctx.user.id);
      console.log(`[generateBrief] \u2713 Brief generated with urgency score: ${brief.urgencyScore}`);
      return {
        success: true,
        brief,
        cached: false
      };
    } catch (error) {
      console.error(`[generateBrief] Error:`, error);
      throw new Error(`Failed to generate brief: ${error.message}`);
    }
  }),
  // Generate personalized sales approach for a company (requires Deep Research first)
  generateSalesApproach: protectedProcedure.input(z2.object({
    companyId: z2.number(),
    brainId: z2.number().optional()
    // If provided, use this brain and write to company_brain_outputs
  })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const brainOutput = input.brainId ? await getCompanyBrainOutput(input.companyId, input.brainId) : null;
    const hasBrief = input.brainId ? !!brainOutput?.briefData : !!company.briefData;
    if (!hasBrief) {
      throw new Error("Deep research not found for this brain. Please run Research first.");
    }
    console.log(`[generateSalesApproach] Starting sales approach generation for company ${input.companyId}`);
    if (company.salesApproachData && company.salesApproachGeneratedAt) {
      const cacheAge = Date.now() - new Date(company.salesApproachGeneratedAt).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
      if (cacheAge < sevenDaysMs) {
        console.log(`[generateSalesApproach] Using cached sales approach (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1e3))} days)`);
        const cachedApproach = JSON.parse(company.salesApproachData);
        const { normaliseConversationStarters: normaliseConversationStarters2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
        if (cachedApproach && Array.isArray(cachedApproach.conversationStarters)) {
          cachedApproach.conversationStarters = normaliseConversationStarters2(cachedApproach.conversationStarters);
        }
        return {
          success: true,
          salesApproach: cachedApproach,
          cached: true,
          cacheAge: Math.floor(cacheAge / (24 * 60 * 60 * 1e3))
          // days
        };
      } else {
        console.log(`[generateSalesApproach] Cached sales approach expired (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1e3))} days), regenerating...`);
      }
    }
    const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
    try {
      const salesApproach = await generateSalesApproach2(input.companyId, ctx.user.id, input.brainId);
      const resolvedBrainId = input.brainId ?? (await getActiveBrain(ctx.user.id))?.id;
      if (resolvedBrainId) {
        await upsertCompanyBrainOutput(input.companyId, resolvedBrainId, {
          salesApproachData: JSON.stringify(salesApproach),
          salesApproachGeneratedAt: /* @__PURE__ */ new Date()
        });
      }
      await updateCompany(input.companyId, {
        salesApproachData: JSON.stringify(salesApproach),
        salesApproachGeneratedAt: /* @__PURE__ */ new Date()
      });
      await stampBrainOnCompany(input.companyId, ctx.user.id);
      console.log(`[generateSalesApproach] \u2713 Sales approach generated for ${company.name}`);
      return {
        success: true,
        salesApproach
      };
    } catch (error) {
      console.error(`[generateSalesApproach] Error:`, error);
      throw new Error(`Failed to generate sales approach: ${error.message}`);
    }
  }),
  // Find contact at a company by job title (Apollo People Search)
  findContact: protectedProcedure.input(z2.object({
    companyId: z2.number(),
    jobTitle: z2.string().min(1),
    includePhone: z2.boolean().optional()
    // Optional: 8 credits per net-new phone
  })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const existingContact = await getContactByCompanyId(input.companyId);
    if (existingContact) {
      return {
        success: true,
        contact: existingContact,
        cached: true
      };
    }
    const domain = company.websiteUrl ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : company.primaryDomain || null;
    if (!domain) throw new TRPCError3({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable contact search." });
    console.log(`[findContact] Searching for "${input.jobTitle}" at ${company.name} (${domain})`);
    try {
      const contact = await searchApolloContacts({
        companyDomain: domain,
        jobTitle: input.jobTitle,
        limit: 1,
        includePhone: input.includePhone || false
      });
      if (!contact) {
        return {
          success: false,
          message: `No contacts found matching "${input.jobTitle}" at ${company.name}`
        };
      }
      const savedContact = await createContact({
        companyId: input.companyId,
        apolloPersonId: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.name,
        title: contact.title,
        email: contact.email || null,
        phone: contact.phone || null,
        linkedinUrl: contact.linkedinUrl || null,
        searchedTitle: input.jobTitle
      });
      console.log(`[findContact] \u2713 Found: ${contact.name} - ${contact.title}`);
      return {
        success: true,
        contact: savedContact,
        cached: false
      };
    } catch (error) {
      console.error(`[findContact] Error:`, error);
      throw new Error(`Failed to find contact: ${error.message}`);
    }
  }),
  // Get contact for a company
  getContact: protectedProcedure.input(z2.object({
    companyId: z2.number()
  })).query(async ({ ctx, input }) => {
    await assertCompanyAccess(input.companyId, ctx.user.id);
    const contact = await getContactByCompanyId(input.companyId);
    return { contact };
  }),
  // Get all companies marked as CALL TODAY for the current user
  getCallToday: protectedProcedure.query(async ({ ctx }) => {
    const results = await getCallTodayCompanies(ctx.user.id);
    return { companies: results };
  }),
  // ============================================================================
  // HITL Gate Procedures
  // ============================================================================
  // Check if user has a previous offering for this website
  checkPreviousOffering: protectedProcedure.input(z2.object({
    websiteUrl: z2.string().url()
  })).query(async ({ ctx, input }) => {
    const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
    const previousSearch = await getPreviousOffering(ctx.user.id, normalizedUrl);
    if (!previousSearch || !previousSearch.offeringName) {
      return { hasPrevious: false, previousOffering: null };
    }
    return {
      hasPrevious: true,
      previousOffering: {
        name: previousSearch.offeringName,
        description: previousSearch.offeringDescription,
        targetMarket: previousSearch.targetMarket,
        valueProposition: previousSearch.valueProposition,
        keywords: previousSearch.keywords ? JSON.parse(previousSearch.keywords) : []
      }
    };
  }),
  // Create new search and extract offering from website
  extractOffering: protectedProcedure.input(z2.object({
    websiteUrl: z2.string().url(),
    location: z2.string().min(1),
    brainId: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
    const searchId = await createSearch({
      userId: ctx.user.id,
      companyWebsite: normalizedUrl,
      location: input.location,
      status: "extracting",
      ...input.brainId ? { brainId: input.brainId } : {}
    });
    try {
      const offering = await extractOffering(normalizedUrl);
      await updateSearch(searchId, {
        offeringName: offering.name,
        offeringDescription: offering.description,
        targetMarket: offering.targetMarket,
        valueProposition: offering.valueProposition,
        keywords: JSON.stringify(offering.keywords),
        crossBorderIndicators: offering.crossBorderIndicators,
        status: "code_targeting"
      });
      return { searchId, offering };
    } catch (error) {
      await updateSearch(searchId, {
        status: "failed",
        errorMessage: error.message
      });
      throw error;
    }
  }),
  // Accept previous offering and create new search with copied data
  acceptPreviousOffering: protectedProcedure.input(z2.object({
    websiteUrl: z2.string().url(),
    location: z2.string().min(1),
    brainId: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const normalizedUrl = normalizeWebsiteUrl(input.websiteUrl);
    const previousSearch = await getPreviousOffering(ctx.user.id, normalizedUrl);
    if (!previousSearch) {
      throw new Error("No previous offering found");
    }
    const searchId = await createSearch({
      userId: ctx.user.id,
      companyWebsite: normalizedUrl,
      location: input.location,
      offeringName: previousSearch.offeringName,
      offeringDescription: previousSearch.offeringDescription,
      targetMarket: previousSearch.targetMarket,
      valueProposition: previousSearch.valueProposition,
      keywords: previousSearch.keywords,
      crossBorderIndicators: previousSearch.crossBorderIndicators,
      status: "code_targeting",
      ...input.brainId ? { brainId: input.brainId } : {}
    });
    const offering = {
      name: previousSearch.offeringName || "",
      description: previousSearch.offeringDescription || "",
      targetMarket: previousSearch.targetMarket || "",
      valueProposition: previousSearch.valueProposition || "",
      keywords: previousSearch.keywords ? JSON.parse(previousSearch.keywords) : []
    };
    return { searchId, offering };
  }),
  // Manually update offering data
  updateOffering: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    offering: z2.object({
      name: z2.string(),
      description: z2.string(),
      targetMarket: z2.string(),
      valueProposition: z2.string().optional(),
      keywords: z2.array(z2.string())
    })
  })).mutation(async ({ ctx, input }) => {
    await updateSearch(input.searchId, {
      offeringName: input.offering.name,
      offeringDescription: input.offering.description,
      targetMarket: input.offering.targetMarket,
      valueProposition: input.offering.valueProposition,
      keywords: JSON.stringify(input.offering.keywords),
      status: "code_targeting"
    });
    return { success: true };
  }),
  // Run code targeting (LLM selection of NAICS/SIC codes)
  runCodeTargeting: protectedProcedure.input(z2.object({
    searchId: z2.number()
  })).mutation(async ({ ctx, input }) => {
    const search = await assertSearchOwner(input.searchId, ctx.user.id);
    try {
      const codeSelection = await selectIndustryCodes({
        offeringName: search.offeringName || "",
        offeringDescription: search.offeringDescription || "",
        targetMarket: search.targetMarket || "",
        valueProposition: search.valueProposition || ""
      });
      await updateSearch(input.searchId, {
        selectedSicCodes: JSON.stringify(codeSelection.sicCodes),
        selectedNaicsCodes: JSON.stringify(codeSelection.naicsCodes),
        codeSelectionReasoning: codeSelection.reasoning,
        status: "searching"
      });
      return {
        success: true,
        codes: {
          sicCodes: codeSelection.sicCodes,
          naicsCodes: codeSelection.naicsCodes,
          reasoning: codeSelection.reasoning
        }
      };
    } catch (error) {
      await updateSearch(input.searchId, {
        status: "failed",
        errorMessage: error.message
      });
      throw error;
    }
  }),
  // Accept code targeting (use codes from previous search or current extraction)
  acceptCodeTargeting: protectedProcedure.input(z2.object({
    searchId: z2.number()
  })).mutation(async ({ ctx, input }) => {
    await updateSearch(input.searchId, {
      status: "searching"
    });
    return { success: true };
  }),
  // Manually expand/edit code targeting
  updateCodeTargeting: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    codes: z2.object({
      sicCodes: z2.array(z2.string()),
      naicsCodes: z2.array(z2.string())
    })
  })).mutation(async ({ ctx, input }) => {
    await updateSearch(input.searchId, {
      selectedSicCodes: JSON.stringify(input.codes.sicCodes),
      selectedNaicsCodes: JSON.stringify(input.codes.naicsCodes),
      status: "searching"
    });
    return { success: true };
  }),
  // ============================================================================
  // National Scan Procedures
  // ============================================================================
  // Start a national scan across all 50 US states
  startNationalScan: protectedProcedure.input(z2.object({ testMode: z2.boolean().optional().default(false) })).mutation(async ({ ctx, input }) => {
    const { runNationalScan: runNationalScan2 } = await Promise.resolve().then(() => (init_nationalScan(), nationalScan_exports));
    runNationalScan2(ctx.user.id, input.testMode).catch((error) => {
      console.error(`[National Scan] Fatal error:`, error);
    });
    const stateCount = input.testMode ? 2 : 50;
    const timeEstimate = input.testMode ? "3-5 minutes" : "2-4 hours";
    return {
      success: true,
      message: `${input.testMode ? "Test" : "National"} scan started for ${stateCount} states. Estimated time: ${timeEstimate}.`
    };
  }),
  // Get progress of the current national scan
  getNationalScanProgress: protectedProcedure.query(async () => {
    const { getNationalScanProgress: getNationalScanProgress2 } = await Promise.resolve().then(() => (init_nationalScan(), nationalScan_exports));
    return getNationalScanProgress2();
  }),
  // Stop the currently running national scan
  stopNationalScan: protectedProcedure.mutation(async () => {
    const { stopNationalScan: stopNationalScan2 } = await Promise.resolve().then(() => (init_nationalScan(), nationalScan_exports));
    return stopNationalScan2();
  }),
  // Import companies from Apollo CSV export
  importCampaignFromCSV: protectedProcedure.input(z2.object({
    csvContent: z2.string(),
    campaignName: z2.string().min(1),
    location: z2.string().optional()
    // Optional location override
  })).mutation(async ({ ctx, input }) => {
    const { parseApolloCSV: parseApolloCSV2, mapApolloRowToCompany: mapApolloRowToCompany2 } = await Promise.resolve().then(() => (init_apolloCSVParser(), apolloCSVParser_exports));
    console.log(`[CSV Import] Starting campaign: ${input.campaignName}`);
    const rows = parseApolloCSV2(input.csvContent);
    console.log(`[CSV Import] Parsed ${rows.length} companies from CSV`);
    if (rows.length === 0) {
      throw new Error("CSV file is empty or invalid");
    }
    const searchId = await createSearch({
      userId: ctx.user.id,
      companyWebsite: "N/A",
      // Not applicable for CSV imports
      location: input.location || "CSV Import",
      offeringName: input.campaignName,
      offeringDescription: `Campaign imported from Apollo CSV with ${rows.length} companies`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: null,
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: rows.length,
      codesTotal: rows.length,
      status: "completed"
    });
    console.log(`[CSV Import] Created search record ${searchId}`);
    const companies2 = rows.map((row) => mapApolloRowToCompany2(row, searchId));
    await createCompanies(companies2);
    console.log(`[CSV Import] \u2713 Imported ${companies2.length} companies for campaign: ${input.campaignName}`);
    return {
      searchId,
      companiesImported: companies2.length,
      campaignName: input.campaignName
    };
  }),
  // ============================================================================
  // Brain: Deep Offering Intelligence
  // ============================================================================
  // Get the active brain for the current user
  getActiveBrain: protectedProcedure.query(async ({ ctx }) => {
    const brain = await getActiveBrain(ctx.user.id);
    return { brain };
  }),
  // Get brain history for the current user
  getBrainHistory: protectedProcedure.query(async ({ ctx }) => {
    const history = await getBrainHistory(ctx.user.id);
    return { history };
  }),
  // Research a company offering to create/update the Brain
  researchBrain: protectedProcedure.input(z2.object({
    companyWebsite: z2.string().min(1),
    companyName: z2.string().optional(),
    brainName: z2.string().min(1)
    // Required: user-provided brain name
  })).mutation(async ({ ctx, input }) => {
    const normalizedUrl = normalizeWebsiteUrl(input.companyWebsite);
    const displayName = input.companyName || normalizedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    console.log(`[Brain] Starting research for ${displayName} (${normalizedUrl})`);
    const brainId = await createOfferingBrain({
      userId: ctx.user.id,
      brainName: input.brainName,
      companyName: displayName,
      companyWebsite: normalizedUrl,
      status: "researching"
    });
    try {
      const result = await researchOfferingBrain(normalizedUrl, displayName);
      await updateOfferingBrain(brainId, {
        companyName: result.companyName,
        offeringSummary: result.offeringSummary,
        coreCapabilities: JSON.stringify(result.coreCapabilities),
        valuePropositions: JSON.stringify(result.valuePropositions),
        competitiveAdvantages: result.competitiveAdvantages,
        icpIndustries: JSON.stringify(result.icpIndustries),
        icpCompanySize: result.icpCompanySize,
        icpGeography: result.icpGeography,
        icpPainPoints: JSON.stringify(result.icpPainPoints),
        icpBuyingSignals: JSON.stringify(result.icpBuyingSignals),
        fitCriteria: JSON.stringify(result.fitCriteria),
        urgencyTriggers: JSON.stringify(result.urgencyTriggers),
        rawResearchData: JSON.stringify(result),
        status: "completed"
      });
      console.log(`[Brain] \u2713 Research completed for ${displayName}`);
      const brain = await getActiveBrain(ctx.user.id);
      return { brain, isNew: true };
    } catch (error) {
      console.error(`[Brain] Research failed:`, error);
      await updateOfferingBrain(brainId, {
        status: "failed",
        rawResearchData: JSON.stringify({ error: error.message })
      });
      throw new Error(`Brain research failed: ${error.message}`);
    }
  }),
  // Create brain from uploaded Excel file
  uploadBrainExcel: protectedProcedure.input(z2.object({
    fileBase64: z2.string().min(1),
    // base64-encoded xlsx file
    brainName: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const buffer = Buffer.from(input.fileBase64, "base64");
    const { raw, brainName: parsedBrainName, warnings } = parseOfferingExcel(buffer);
    const finalBrainName = input.brainName?.trim() || parsedBrainName;
    const companyName = raw.companyName || "Unknown Company";
    const companyWebsite = raw.companyWebsite || "";
    console.log(`[Brain Excel] Parsed brain for ${companyName}, warnings: ${warnings.length}`);
    const brainId = await createOfferingBrain({
      userId: ctx.user.id,
      brainName: finalBrainName,
      companyName,
      companyWebsite,
      status: "researching"
    });
    try {
      const result = await normaliseBrainFromExcel(raw);
      await updateOfferingBrain(brainId, {
        companyName: result.companyName,
        offeringSummary: result.offeringSummary,
        coreCapabilities: JSON.stringify(result.coreCapabilities),
        valuePropositions: JSON.stringify(result.valuePropositions),
        competitiveAdvantages: result.competitiveAdvantages,
        icpIndustries: JSON.stringify(result.icpIndustries),
        icpCompanySize: result.icpCompanySize,
        icpGeography: result.icpGeography,
        icpPainPoints: JSON.stringify(result.icpPainPoints),
        icpBuyingSignals: JSON.stringify(result.icpBuyingSignals),
        fitCriteria: JSON.stringify(result.fitCriteria),
        urgencyTriggers: JSON.stringify(result.urgencyTriggers),
        rawResearchData: JSON.stringify(result),
        status: "completed"
      });
      console.log(`[Brain Excel] \u2713 Brain saved for ${companyName}`);
      const brain = await getActiveBrain(ctx.user.id);
      return { brain, isNew: true, warnings };
    } catch (error) {
      console.error(`[Brain Excel] Failed:`, error);
      await updateOfferingBrain(brainId, {
        status: "failed",
        rawResearchData: JSON.stringify({ error: error.message })
      });
      throw new Error(`Brain Excel upload failed: ${error.message}`);
    }
  }),
  // Update brain fields (HITL editing)
  updateBrain: protectedProcedure.input(z2.object({
    brainId: z2.number(),
    updates: z2.object({
      brainName: z2.string().optional(),
      offeringSummary: z2.string().optional(),
      coreCapabilities: z2.string().optional(),
      // JSON string
      valuePropositions: z2.string().optional(),
      // JSON string
      competitiveAdvantages: z2.string().optional(),
      icpIndustries: z2.string().optional(),
      // JSON string
      icpCompanySize: z2.string().optional(),
      icpGeography: z2.string().optional(),
      icpPainPoints: z2.string().optional(),
      // JSON string
      icpBuyingSignals: z2.string().optional(),
      // JSON string
      fitCriteria: z2.string().optional(),
      // JSON string
      urgencyTriggers: z2.string().optional()
      // JSON string
    })
  })).mutation(async ({ ctx, input }) => {
    const brain = await getActiveBrain(ctx.user.id);
    if (!brain || brain.id !== input.brainId) {
      throw new Error("Brain not found or access denied");
    }
    await updateOfferingBrain(input.brainId, input.updates);
    const updated = await getActiveBrain(ctx.user.id);
    return { brain: updated };
  }),
  // Set a brain as active
  setActiveBrain: protectedProcedure.input(z2.object({
    brainId: z2.number()
  })).mutation(async ({ ctx, input }) => {
    await setOfferingBrainActive(input.brainId, ctx.user.id);
    const brain = await getActiveBrain(ctx.user.id);
    return { brain };
  }),
  // Delete a brain
  deleteBrain: protectedProcedure.input(z2.object({
    brainId: z2.number()
  })).mutation(async ({ ctx, input }) => {
    await deleteOfferingBrain(input.brainId, ctx.user.id);
    return { success: true };
  }),
  // Get a specific brain by ID
  getBrainById: protectedProcedure.input(z2.object({
    brainId: z2.number()
  })).query(async ({ ctx, input }) => {
    const brain = await getOfferingBrainById(input.brainId, ctx.user.id);
    if (!brain) {
      throw new Error("Brain not found or access denied");
    }
    return { brain };
  }),
  // Toggle shared flag — owner only
  toggleBrainShared: protectedProcedure.input(z2.object({
    brainId: z2.number(),
    isShared: z2.boolean()
  })).mutation(async ({ ctx, input }) => {
    const brain = await getOfferingBrainById(input.brainId, ctx.user.id);
    if (!brain) throw new Error("Brain not found or access denied");
    if (brain.userId !== ctx.user.id) throw new TRPCError3({ code: "FORBIDDEN", message: "Only the brain owner can change sharing settings" });
    await updateOfferingBrain(input.brainId, { isShared: input.isShared ? 1 : 0 });
    return { success: true, isShared: input.isShared };
  }),
  // ============================================================================
  // Find All C-Suite: Bulk Contact Search
  // ============================================================================
  // Get single company with all data (for Company Detail page)
  getCompany: protectedProcedure.input(z2.object({ companyId: z2.number(), brainId: z2.number().optional() })).query(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const contacts3 = await getContactsByCompanyId(input.companyId);
    const decision = await getCompanyDecision(input.companyId, ctx.user.id);
    const search = await getSearchById(company.searchId);
    const allBrainOutputs = await getAllBrainOutputsForCompany(input.companyId);
    let companyWithBrainData = company;
    if (input.brainId) {
      const brainOutput = allBrainOutputs.find((o) => o.brainId === input.brainId);
      if (brainOutput) {
        companyWithBrainData = {
          ...company,
          // Override display fields with brain-scoped values
          briefData: brainOutput.briefData ?? company.briefData,
          salesApproachData: brainOutput.salesApproachData ?? company.salesApproachData,
          urgencyScore: brainOutput.urgencyScore ?? company.urgencyScore,
          briefGeneratedAt: brainOutput.briefGeneratedAt ?? company.briefGeneratedAt,
          salesApproachGeneratedAt: brainOutput.salesApproachGeneratedAt ?? company.salesApproachGeneratedAt,
          activeBrainId: input.brainId
        };
      }
    }
    return {
      company: companyWithBrainData,
      contacts: contacts3,
      decision: decision ?? null,
      search: search ?? null,
      allBrainOutputs
    };
  }),
  // Get all contacts for a company
  getCompanyContacts: protectedProcedure.input(z2.object({
    companyId: z2.number()
  })).query(async ({ ctx, input }) => {
    await assertCompanyAccess(input.companyId, ctx.user.id);
    const contacts3 = await getContactsByCompanyId(input.companyId);
    return { contacts: contacts3 };
  }),
  // Find all C-Suite contacts at a company (trickle-down approach)
  findAllCSuite: protectedProcedure.input(z2.object({
    companyId: z2.number(),
    includePhone: z2.boolean().optional(),
    maxContacts: z2.number().optional()
    // Max contacts to return per tier
  })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const domain = company.websiteUrl ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : company.primaryDomain || null;
    if (!domain) throw new TRPCError3({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable contact search." });
    console.log(`[Trickle-Down] Starting trickle-down search at ${company.name} (${domain})`);
    const existingContacts = await getContactsByCompanyId(input.companyId);
    if (existingContacts.length > 0) {
      console.log(`[Trickle-Down] Found ${existingContacts.length} existing contacts, returning cached`);
      return {
        contacts: existingContacts,
        tierFound: 0,
        tierLabel: "Cached",
        tiersSearched: [],
        cached: true
      };
    }
    const result = await trickleDownSearch(
      domain,
      company.name,
      input.maxContacts || 5,
      input.includePhone || false
    );
    const savedContacts = [];
    const seenEmails = /* @__PURE__ */ new Set();
    const seenNames = /* @__PURE__ */ new Set();
    for (const contact of result.contacts) {
      const contactEmail = contact.email?.toLowerCase();
      const contactName = contact.name?.toLowerCase();
      if (contactEmail && seenEmails.has(contactEmail) || contactName && seenNames.has(contactName)) {
        continue;
      }
      try {
        const savedContact = await createContact({
          companyId: input.companyId,
          apolloPersonId: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.name,
          title: contact.title,
          email: contact.email || null,
          phone: contact.phone || null,
          linkedinUrl: contact.linkedinUrl || null,
          searchedTitle: `Tier ${result.tierFound}: ${result.tierLabel}`
        });
        savedContacts.push(savedContact);
        if (contactEmail) seenEmails.add(contactEmail);
        if (contactName) seenNames.add(contactName);
      } catch (err) {
        console.error(`[Trickle-Down] Failed to save contact ${contact.name}:`, err.message);
      }
    }
    console.log(`[Trickle-Down] Completed: ${savedContacts.length} contacts saved from Tier ${result.tierFound} (${result.tierLabel})`);
    return {
      contacts: savedContacts,
      tierFound: result.tierFound,
      tierLabel: result.tierLabel,
      tiersSearched: result.tiersSearched,
      cached: false
    };
  }),
  // Get all personnel at a company (no seniority filtering)
  getAllPersonnel: protectedProcedure.input(z2.object({
    companyId: z2.number(),
    includePhone: z2.boolean().optional(),
    limit: z2.number().optional(),
    // Max contacts to return (default 25)
    seniorities: z2.array(z2.string()).optional(),
    // e.g. ["owner","founder","c_suite","vp","head"]
    department: z2.string().optional()
    // e.g. "engineering", "operations", "any"
  })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const domain = company.websiteUrl ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : company.primaryDomain || null;
    if (!domain) throw new TRPCError3({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable contact search." });
    console.log(`[Get All Personnel] Starting search at ${company.name} (${domain}), seniorities: ${input.seniorities?.join(",") || "all"}, dept: ${input.department || "any"}`);
    const result = await getAllPersonnel(
      domain,
      company.name,
      input.limit || 25,
      input.seniorities,
      input.department
    );
    const savedContacts = [];
    const seenEmails = /* @__PURE__ */ new Set();
    const seenNames = /* @__PURE__ */ new Set();
    for (const contact of result.contacts) {
      const contactEmail = contact.email?.toLowerCase();
      const contactName = contact.name?.toLowerCase();
      if (contactEmail && seenEmails.has(contactEmail) || contactName && seenNames.has(contactName)) {
        continue;
      }
      try {
        const savedContact = await createContact({
          companyId: input.companyId,
          apolloPersonId: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: contact.name,
          title: contact.title,
          email: contact.email || null,
          phone: contact.phone || null,
          linkedinUrl: contact.linkedinUrl || null,
          searchedTitle: "All Personnel"
        });
        savedContacts.push(savedContact);
        if (contactEmail) seenEmails.add(contactEmail);
        if (contactName) seenNames.add(contactName);
      } catch (err) {
        console.error(`[Get All Personnel] Failed to save contact ${contact.name}:`, err.message);
      }
    }
    console.log(`[Get All Personnel] Completed: ${savedContacts.length} contacts saved (total found: ${result.totalFound})`);
    return {
      contacts: savedContacts,
      totalFound: result.totalFound
    };
  }),
  // Enrich a specific contact with email/phone (selective enrichment)
  enrichContact: protectedProcedure.input(z2.object({
    contactId: z2.number(),
    includePhone: z2.boolean().optional()
  })).mutation(async ({ ctx, input }) => {
    const contact = await getContactById(input.contactId);
    if (!contact) throw new TRPCError3({ code: "NOT_FOUND", message: "Contact not found" });
    const company = await assertCompanyAccess(contact.companyId, ctx.user.id);
    const domain = company.websiteUrl ? company.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : company.primaryDomain || null;
    if (!domain) throw new TRPCError3({ code: "BAD_REQUEST", message: "This company has no website URL. Please add one to enable enrichment." });
    console.log(`[Enrich Contact] Enriching ${contact.fullName} at ${company.name}`);
    if (!contact.firstName || !contact.lastName) {
      throw new Error("Contact must have first name and last name for enrichment");
    }
    const webhookUrl = process.env.APP_URL ? `${process.env.APP_URL}/api/apollo-webhook` : `https://leadtrigger-connectgroup.com/api/apollo-webhook`;
    const enriched = await enrichPerson(
      contact.firstName,
      contact.lastName,
      domain,
      input.includePhone || false,
      webhookUrl
    );
    const db = await Promise.resolve().then(() => (init_db(), db_exports));
    const drizzleDb = await db.getDb();
    if (!drizzleDb) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const { contacts: contactsTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq14 } = await import("drizzle-orm");
    await drizzleDb.update(contactsTable).set({
      email: enriched.email || contact.email || null,
      phone: enriched.phone || contact.phone || null,
      linkedinUrl: enriched.linkedinUrl || contact.linkedinUrl || null,
      phonePending: enriched.phonePending ? 1 : 0,
      // Save Apollo person ID so webhook can match this contact when phone arrives
      ...enriched.apolloPersonId ? { apolloPersonId: enriched.apolloPersonId } : {}
    }).where(eq14(contactsTable.id, contact.id));
    const updatedContact = await getContactById(contact.id);
    if (!updatedContact) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch updated contact" });
    console.log(`[Enrich Contact] Completed: ${updatedContact.fullName} enriched. phonePending=${enriched.phonePending}`);
    return {
      contact: updatedContact,
      phonePending: enriched.phonePending || false
    };
  }),
  // Force re-research a company — clears cache and regenerates brief fresh
  reResearchCompany: protectedProcedure.input(z2.object({
    companyId: z2.number()
  })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    console.log(`[reResearch] Clearing cache and regenerating brief for ${company.name}`);
    await updateCompany(input.companyId, {
      briefData: null,
      briefGeneratedAt: null
    });
    const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
    try {
      const brief = await generateSalesIntelligenceBrief2(input.companyId, ctx.user.id);
      await updateCompany(input.companyId, {
        urgencyScore: brief.urgencyScore,
        briefData: JSON.stringify(brief),
        briefGeneratedAt: /* @__PURE__ */ new Date()
      });
      await stampBrainOnCompany(input.companyId, ctx.user.id);
      console.log(`[reResearch] \u2713 Brief regenerated for ${company.name} \u2014 urgency: ${brief.urgencyScore}`);
      return { success: true, brief };
    } catch (error) {
      console.error(`[reResearch] Error:`, error);
      throw new Error(`Failed to re-research: ${error.message}`);
    }
  }),
  // ---------------------------------------------------------------------------
  // toggleShareSearch — share/unshare a campaign with all team members
  // ---------------------------------------------------------------------------
  toggleShareSearch: protectedProcedure.input(z2.object({ searchId: z2.number(), shared: z2.boolean() })).mutation(async ({ ctx, input }) => {
    await assertSearchOwner(input.searchId, ctx.user.id);
    await toggleShareSearch(input.searchId, ctx.user.id, input.shared);
    return { success: true, shared: input.shared };
  }),
  // ---------------------------------------------------------------------------
  // nameEnrichCampaign — name-based Apollo enrichment for conference imports
  // Processes all pending companies with no apolloId/domain using organizations/search
  // ---------------------------------------------------------------------------
  nameEnrichCampaign: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    limit: z2.number().min(1).max(500).default(200),
    concurrency: z2.number().min(1).max(5).default(3)
  })).mutation(async ({ input, ctx }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const { apolloEnrichByName: apolloEnrichByName2 } = await Promise.resolve().then(() => (init_conferenceScraper(), conferenceScraper_exports));
    const pending = await getPendingCompaniesBySearchId(input.searchId);
    const toEnrich = pending.filter((c) => !c.apolloId && !c.primaryDomain).filter((c) => c.name && c.name.length > 1).filter((c) => !c.websiteUrl || !c.websiteUrl.includes("localhost")).slice(0, input.limit);
    let enriched = 0;
    let failed = 0;
    for (let i = 0; i < toEnrich.length; i += input.concurrency) {
      const batch = toEnrich.slice(i, i + input.concurrency);
      await Promise.all(
        batch.map(async (company) => {
          try {
            const countryHint = company.sourceCountryCode || company.country || null;
            const result = await apolloEnrichByName2(company.name, countryHint);
            if (result) {
              await updateCompany(company.id, {
                apolloId: result.apolloId || void 0,
                name: result.name || company.name,
                websiteUrl: result.websiteUrl || void 0,
                primaryDomain: result.primaryDomain || void 0,
                linkedinUrl: result.linkedinUrl || void 0,
                phone: result.phone || void 0,
                foundedYear: result.foundedYear || void 0,
                revenue: result.revenue || void 0,
                headcountGrowth: result.headcountGrowth || void 0,
                city: result.city || void 0,
                state: result.state || void 0,
                country: result.country || void 0,
                streetAddress: result.streetAddress || void 0,
                sicCodes: result.sicCodes?.length ? JSON.stringify(result.sicCodes) : void 0,
                naicsCodes: result.naicsCodes?.length ? JSON.stringify(result.naicsCodes) : void 0,
                enrichmentStatus: "enriched"
              });
              enriched++;
            } else {
              await updateCompany(company.id, { enrichmentStatus: "failed" });
              failed++;
            }
          } catch {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
          }
        })
      );
      if (i + input.concurrency < toEnrich.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return { success: true, total: toEnrich.length, enriched, failed };
  }),
  // ---------------------------------------------------------------------------
  // batchSalesApproach — generate sales approaches for all enriched companies in a search
  // ---------------------------------------------------------------------------
  batchSalesApproach: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    skipCached: z2.boolean().optional().default(true)
  })).mutation(async ({ ctx, input }) => {
    const { getCompaniesBySearchId: getCompaniesBySearchId3 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
    const allCompanies = await getCompaniesBySearchId3(input.searchId);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
    const toProcess = allCompanies.filter((c) => {
      if (c.enrichmentStatus !== "enriched") return false;
      if (!c.briefData) return false;
      if (!input.skipCached) return true;
      if (!c.salesApproachData || !c.salesApproachGeneratedAt) return true;
      const age = Date.now() - new Date(c.salesApproachGeneratedAt).getTime();
      return age >= sevenDaysMs;
    });
    console.log(`[batchSalesApproach] searchId=${input.searchId} \u2014 ${toProcess.length} companies to process`);
    let completed = 0;
    let failed = 0;
    const errors = [];
    for (const company of toProcess) {
      try {
        const salesApproach = await generateSalesApproach2(company.id, ctx.user.id);
        await updateCompany(company.id, {
          salesApproachData: JSON.stringify(salesApproach),
          salesApproachGeneratedAt: /* @__PURE__ */ new Date()
        });
        completed++;
        console.log(`[batchSalesApproach] \u2713 ${company.name} (${completed}/${toProcess.length})`);
      } catch (err) {
        failed++;
        errors.push(`${company.name}: ${err.message}`);
        console.error(`[batchSalesApproach] \u2717 ${company.name}:`, err.message);
      }
    }
    return {
      success: true,
      total: toProcess.length,
      completed,
      failed,
      skippedNoResearch: allCompanies.filter((c) => c.enrichmentStatus === "enriched" && !c.briefData).length,
      errors: errors.slice(0, 10)
    };
  }),
  // ---------------------------------------------------------------------------
  // batchResearchAndOutreach — run deep research THEN sales approach for all enriched companies
  // ---------------------------------------------------------------------------
  batchResearchAndOutreach: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    skipCached: z2.boolean().optional().default(true)
  })).mutation(async ({ ctx, input }) => {
    const { getCompaniesBySearchId: getCompaniesBySearchId3 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
    const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
    const allCompanies = await getCompaniesBySearchId3(input.searchId);
    const enriched = allCompanies.filter((c) => c.enrichmentStatus === "enriched");
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
    const toResearch = enriched.filter((c) => {
      if (!input.skipCached) return true;
      if (!c.briefData || !c.briefGeneratedAt) return true;
      return Date.now() - new Date(c.briefGeneratedAt).getTime() >= sevenDaysMs;
    });
    let researchCompleted = 0;
    let researchFailed = 0;
    console.log(`[batchResearchAndOutreach] Phase 1: ${toResearch.length} companies to research`);
    for (const company of toResearch) {
      try {
        const brief = await generateSalesIntelligenceBrief2(company.id, ctx.user.id);
        await updateCompany(company.id, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: /* @__PURE__ */ new Date()
        });
        researchCompleted++;
        console.log(`[batchResearchAndOutreach] \u2713 Research: ${company.name} (${researchCompleted}/${toResearch.length})`);
      } catch (err) {
        researchFailed++;
        console.error(`[batchResearchAndOutreach] \u2717 Research: ${company.name}:`, err.message);
      }
    }
    const refreshedCompanies = await getCompaniesBySearchId3(input.searchId);
    const enrichedRefreshed = refreshedCompanies.filter((c) => c.enrichmentStatus === "enriched");
    const toApproach = enrichedRefreshed.filter((c) => {
      if (!c.briefData) return false;
      if (!input.skipCached) return true;
      if (!c.salesApproachData || !c.salesApproachGeneratedAt) return true;
      return Date.now() - new Date(c.salesApproachGeneratedAt).getTime() >= sevenDaysMs;
    });
    let approachCompleted = 0;
    let approachFailed = 0;
    console.log(`[batchResearchAndOutreach] Phase 2: ${toApproach.length} companies for sales approach`);
    for (const company of toApproach) {
      try {
        const salesApproach = await generateSalesApproach2(company.id, ctx.user.id);
        await updateCompany(company.id, {
          salesApproachData: JSON.stringify(salesApproach),
          salesApproachGeneratedAt: /* @__PURE__ */ new Date()
        });
        approachCompleted++;
        console.log(`[batchResearchAndOutreach] \u2713 Approach: ${company.name} (${approachCompleted}/${toApproach.length})`);
      } catch (err) {
        approachFailed++;
        console.error(`[batchResearchAndOutreach] \u2717 Approach: ${company.name}:`, err.message);
      }
    }
    return {
      success: true,
      research: { total: toResearch.length, completed: researchCompleted, failed: researchFailed },
      approach: { total: toApproach.length, completed: approachCompleted, failed: approachFailed }
    };
  }),
  // ---------------------------------------------------------------------------
  // batchGenerateBriefs — run deep research for all enriched companies in a search
  // ---------------------------------------------------------------------------
  batchGenerateBriefs: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    skipCached: z2.boolean().optional().default(true)
    // skip companies with a brief < 7 days old
  })).mutation(async ({ ctx, input }) => {
    const { getCompaniesBySearchId: getCompaniesBySearchId3 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
    const allCompanies = await getCompaniesBySearchId3(input.searchId);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
    const toResearch = allCompanies.filter((c) => {
      if (c.enrichmentStatus !== "enriched") return false;
      if (!input.skipCached) return true;
      if (!c.briefData || !c.briefGeneratedAt) return true;
      const age = Date.now() - new Date(c.briefGeneratedAt).getTime();
      return age >= sevenDaysMs;
    });
    console.log(`[batchGenerateBriefs] searchId=${input.searchId} \u2014 ${toResearch.length} companies to research (${allCompanies.length} total)`);
    let completed = 0;
    let failed = 0;
    const errors = [];
    for (const company of toResearch) {
      try {
        const brief = await generateSalesIntelligenceBrief2(company.id, ctx.user.id);
        await updateCompany(company.id, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: /* @__PURE__ */ new Date()
        });
        completed++;
        console.log(`[batchGenerateBriefs] \u2713 ${company.name} (${completed}/${toResearch.length})`);
      } catch (err) {
        failed++;
        errors.push(`${company.name}: ${err.message}`);
        console.error(`[batchGenerateBriefs] \u2717 ${company.name}:`, err.message);
      }
    }
    return {
      success: true,
      total: toResearch.length,
      completed,
      failed,
      errors: errors.slice(0, 10)
      // cap error list
    };
  }),
  // ---------------------------------------------------------------------------
  // scoreCompanyFit — Grok-powered ICP fit scoring (0-100) with full breakdown
  // ---------------------------------------------------------------------------
  scoreCompanyFit: protectedProcedure.input(z2.object({ companyId: z2.number() })).mutation(async ({ input, ctx }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const { scoreCompanyFit: scoreCompanyFit2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
    try {
      const result = await scoreCompanyFit2(input.companyId, ctx.user.id);
      await updateCompany(input.companyId, {
        fitScore: result.fitScore,
        fitScoreData: JSON.stringify(result)
      });
      await stampBrainOnCompany(input.companyId, ctx.user.id);
      console.log(`[Fit Score] \u2713 ${company.name} \u2192 ${result.fitScore}`);
      return { success: true, result };
    } catch (error) {
      console.error(`[Fit Score] Error:`, error);
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }
  }),
  // Log a call outcome for a company
  logCallOutcome: protectedProcedure.input(z2.object({
    companyId: z2.number(),
    outcome: z2.enum(["reached", "voicemail", "no_answer", "meeting_booked", "not_interested"]),
    notes: z2.string().optional(),
    followUpDate: z2.string().optional()
    // YYYY-MM-DD
  })).mutation(async ({ ctx, input }) => {
    await assertCompanyAccess(input.companyId, ctx.user.id);
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { callOutcomes: callOutcomes2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const db = await getDb2();
    if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.insert(callOutcomes2).values({
      companyId: input.companyId,
      userId: ctx.user.id,
      outcome: input.outcome,
      notes: input.notes ?? null,
      followUpDate: input.followUpDate ?? null
    });
    return { success: true };
  }),
  // Get call outcomes for a company
  getCallOutcomes: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ ctx, input }) => {
    await assertCompanyAccess(input.companyId, ctx.user.id);
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { callOutcomes: callOutcomes2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq14, desc: desc4 } = await import("drizzle-orm");
    const db = await getDb2();
    if (!db) return { outcomes: [] };
    const outcomes = await db.select().from(callOutcomes2).where(eq14(callOutcomes2.companyId, input.companyId)).orderBy(desc4(callOutcomes2.createdAt));
    return { outcomes };
  }),
  // Get all companies with follow-up dates set (nurture list)
  getNurtureList: protectedProcedure.query(async ({ ctx }) => {
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { callOutcomes: callOutcomes2, companies: companies2, searches: searches2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq14, and: and10, isNotNull: isNotNull3, asc: asc2, desc: desc4, sql: sql7 } = await import("drizzle-orm");
    const db = await getDb2();
    if (!db) return { items: [] };
    const rows = await db.select({
      outcomeId: callOutcomes2.id,
      outcome: callOutcomes2.outcome,
      notes: callOutcomes2.notes,
      followUpDate: callOutcomes2.followUpDate,
      createdAt: callOutcomes2.createdAt,
      companyId: companies2.id,
      companyName: companies2.name,
      companyWebsite: companies2.websiteUrl,
      companyCity: companies2.city,
      companyCountry: companies2.country,
      urgencyScore: companies2.urgencyScore,
      searchId: companies2.searchId
    }).from(callOutcomes2).innerJoin(companies2, eq14(callOutcomes2.companyId, companies2.id)).where(
      and10(
        eq14(callOutcomes2.userId, ctx.user.id),
        isNotNull3(callOutcomes2.followUpDate)
      )
    ).orderBy(asc2(callOutcomes2.followUpDate));
    const seen = /* @__PURE__ */ new Set();
    const items = rows.filter((r) => {
      if (seen.has(r.companyId)) return false;
      seen.add(r.companyId);
      return true;
    });
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    return {
      items: items.map((item) => ({
        ...item,
        isOverdue: !!(item.followUpDate && item.followUpDate < today),
        isDueToday: item.followUpDate === today
      }))
    };
  }),
  // Generate a 1-sentence call readiness summary for a company
  // v2: Rich context from brief, approach, leadinfo, fit score, and brain
  generateCallReadiness: protectedProcedure.input(z2.object({ companyId: z2.number() })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const { WHY_CALL_TODAY: WHY_CALL_TODAY2 } = await Promise.resolve().then(() => (init_prompts(), prompts_exports));
    const brief = company.briefData ? (() => {
      try {
        return JSON.parse(company.briefData);
      } catch {
        return null;
      }
    })() : null;
    const approach = company.salesApproachData ? (() => {
      try {
        return JSON.parse(company.salesApproachData);
      } catch {
        return null;
      }
    })() : null;
    const fitData = company.fitScoreData ? (() => {
      try {
        return JSON.parse(company.fitScoreData);
      } catch {
        return null;
      }
    })() : null;
    const signalOpeners = company.signalOpeners ? (() => {
      try {
        return JSON.parse(company.signalOpeners);
      } catch {
        return null;
      }
    })() : null;
    let leadinfoVisit = null;
    try {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { leadinfoVisits: leadinfoVisits2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq14, sql: sql7 } = await import("drizzle-orm");
      const db = await getDb2();
      if (db) {
        const rows = await db.select().from(leadinfoVisits2).where(eq14(leadinfoVisits2.companyId, input.companyId)).orderBy(sql7`${leadinfoVisits2.importedAt} DESC`).limit(1);
        leadinfoVisit = rows[0] || null;
      }
    } catch {
    }
    let brainOffering = "";
    try {
      const brain = await getActiveBrain(ctx.user.id);
      if (brain && brain.status === "completed") {
        brainOffering = brain.offeringSummary || "";
      }
    } catch {
    }
    const contextParts = [];
    contextParts.push(`COMPANY: ${company.name}`);
    if (company.city) contextParts.push(`Location: ${company.city}, ${company.country ?? ""}`);
    if (brainOffering) {
      contextParts.push(`
SELLER'S OFFERING: ${brainOffering}`);
    }
    if (leadinfoVisit) {
      const visitParts = [`
WEBSITE VISITOR (STRONGEST SIGNAL):`];
      visitParts.push(`- This company visited your website`);
      if (leadinfoVisit.totalSessions) visitParts.push(`- Sessions: ${leadinfoVisit.totalSessions}`);
      if (leadinfoVisit.totalPages) visitParts.push(`- Pages viewed: ${leadinfoVisit.totalPages}`);
      if (leadinfoVisit.engagementScore) visitParts.push(`- Engagement score: ${leadinfoVisit.engagementScore}`);
      const intentSignals = leadinfoVisit.intentSignals ? (() => {
        try {
          return JSON.parse(leadinfoVisit.intentSignals);
        } catch {
          return [];
        }
      })() : [];
      if (intentSignals.length) visitParts.push(`- Intent signals: ${intentSignals.join(", ")}`);
      const topPages = leadinfoVisit.topPages ? (() => {
        try {
          return JSON.parse(leadinfoVisit.topPages);
        } catch {
          return [];
        }
      })() : [];
      if (topPages.length) visitParts.push(`- Top pages: ${topPages.join(", ")}`);
      contextParts.push(visitParts.join("\n"));
    }
    if (brief?.urgencySignals?.length) {
      const topSignals = brief.urgencySignals.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 3);
      contextParts.push(`
URGENCY SIGNALS (trigger events):`);
      topSignals.forEach((s) => {
        contextParts.push(`- [${s.category}/${s.type}] ${s.description}`);
      });
    }
    if (brief?.recentDevelopments?.length) {
      const topDevs = brief.recentDevelopments.slice(0, 3);
      contextParts.push(`
RECENT NEWS:`);
      topDevs.forEach((d) => {
        const text2 = d.text || d.headline || d.summary || d;
        const date = d.date ? ` (${d.date})` : "";
        contextParts.push(`- ${text2}${date}`);
      });
    }
    if (Array.isArray(signalOpeners) && signalOpeners.length > 0) {
      const best = signalOpeners[0];
      if (best?.opener) {
        contextParts.push(`
BEST SIGNAL OPENER (for reference): "${best.opener}"`);
      }
    }
    if (fitData?.overallRationale) {
      contextParts.push(`
FIT RATIONALE: ${fitData.overallRationale}`);
    }
    const context = contextParts.join("\n");
    const result = await invokeLLM2({
      messages: [
        { role: "system", content: WHY_CALL_TODAY2.systemPrompt },
        { role: "user", content: context }
      ]
    });
    const rawContent = result.choices?.[0]?.message?.content;
    const summary = typeof rawContent === "string" ? rawContent.trim().replace(/^"|"$/g, "") : "";
    await updateCompany(input.companyId, { callReadinessSummary: summary });
    await stampBrainOnCompany(input.companyId, ctx.user.id);
    return { summary };
  }),
  // Batch-refresh "Why Call Today" summaries for all companies in a campaign
  // Uses the v2 rich-context prompt for every company that has briefData
  batchRefreshCallReadiness: protectedProcedure.input(z2.object({ searchId: z2.number() })).mutation(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const allCompanies = await getCompaniesBySearchId(input.searchId);
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const { WHY_CALL_TODAY: WHY_CALL_TODAY2 } = await Promise.resolve().then(() => (init_prompts(), prompts_exports));
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { leadinfoVisits: leadinfoVisits2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq14, sql: sql7 } = await import("drizzle-orm");
    const eligible = allCompanies.filter((c) => c.briefData && c.enrichmentStatus === "enriched");
    let brainOffering = "";
    try {
      const brain = await getActiveBrain(ctx.user.id);
      if (brain && brain.status === "completed") brainOffering = brain.offeringSummary || "";
    } catch {
    }
    const db = await getDb2();
    const leadinfoMap = /* @__PURE__ */ new Map();
    if (db) {
      try {
        const allVisits = await db.select().from(leadinfoVisits2).where(eq14(leadinfoVisits2.searchId, input.searchId));
        for (const v of allVisits) {
          if (v.companyId) leadinfoMap.set(v.companyId, v);
        }
      } catch {
      }
    }
    let completed = 0;
    let failed = 0;
    for (const company of eligible) {
      try {
        const brief = JSON.parse(company.briefData);
        const fitData = company.fitScoreData ? JSON.parse(company.fitScoreData) : null;
        const signalOpeners = company.signalOpeners ? JSON.parse(company.signalOpeners) : null;
        const leadinfoVisit = leadinfoMap.get(company.id) || null;
        const contextParts = [`COMPANY: ${company.name}`];
        if (company.city) contextParts.push(`Location: ${company.city}, ${company.country ?? ""}`);
        if (brainOffering) contextParts.push(`
SELLER'S OFFERING: ${brainOffering}`);
        if (leadinfoVisit) {
          const vp = [`
WEBSITE VISITOR (STRONGEST SIGNAL):`, `- This company visited your website`];
          if (leadinfoVisit.totalSessions) vp.push(`- Sessions: ${leadinfoVisit.totalSessions}`);
          if (leadinfoVisit.totalPages) vp.push(`- Pages viewed: ${leadinfoVisit.totalPages}`);
          const intentSigs = leadinfoVisit.intentSignals ? (() => {
            try {
              return JSON.parse(leadinfoVisit.intentSignals);
            } catch {
              return [];
            }
          })() : [];
          if (intentSigs.length) vp.push(`- Intent signals: ${intentSigs.join(", ")}`);
          contextParts.push(vp.join("\n"));
        }
        if (brief?.urgencySignals?.length) {
          const topSigs = brief.urgencySignals.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 3);
          contextParts.push(`
URGENCY SIGNALS:`);
          topSigs.forEach((s) => contextParts.push(`- [${s.category}/${s.type}] ${s.description}`));
        }
        if (brief?.recentDevelopments?.length) {
          contextParts.push(`
RECENT NEWS:`);
          brief.recentDevelopments.slice(0, 3).forEach((d) => {
            const text2 = d.text || d.headline || d.summary || d;
            const date = d.date ? ` (${d.date})` : "";
            contextParts.push(`- ${text2}${date}`);
          });
        }
        if (Array.isArray(signalOpeners) && signalOpeners[0]?.opener) {
          contextParts.push(`
BEST SIGNAL OPENER: "${signalOpeners[0].opener}"`);
        }
        if (fitData?.overallRationale) {
          contextParts.push(`
FIT RATIONALE: ${fitData.overallRationale}`);
        }
        const result = await invokeLLM2({
          messages: [
            { role: "system", content: WHY_CALL_TODAY2.systemPrompt },
            { role: "user", content: contextParts.join("\n") }
          ]
        });
        const raw = result.choices?.[0]?.message?.content;
        const summary = typeof raw === "string" ? raw.trim().replace(/^"|"$/g, "") : "";
        await updateCompany(company.id, { callReadinessSummary: summary });
        completed++;
        console.log(`[BatchCallReadiness] \u2713 ${company.name}: ${summary.slice(0, 60)}...`);
      } catch (err) {
        failed++;
        console.error(`[BatchCallReadiness] \u2717 ${company.name}: ${err.message}`);
      }
    }
    return { total: eligible.length, completed, failed };
  }),
  // Fetch and cache product images for a company via Serper Images API
  fetchProductImages: protectedProcedure.input(z2.object({ companyId: z2.number() })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    if (company.productImages) {
      try {
        const cached = JSON.parse(company.productImages);
        if (Array.isArray(cached) && cached.length > 0) {
          return { images: cached, cached: true };
        }
      } catch {
      }
    }
    const { fetchSerperImages: fetchSerperImages2 } = await Promise.resolve().then(() => (init_serperImages(), serperImages_exports));
    const images = await fetchSerperImages2(company.name, company.primaryDomain, 6);
    await updateCompany(input.companyId, { productImages: JSON.stringify(images) });
    return { images, cached: false };
  }),
  // Return cached product images without re-fetching (for initial page load)
  getProductImages: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    if (!company.productImages) return { images: [] };
    try {
      const images = JSON.parse(company.productImages);
      return { images: Array.isArray(images) ? images : [] };
    } catch {
      return { images: [] };
    }
  }),
  // ---------------------------------------------------------------------------
  // fetchUrgencyImages — editorial/news images for the Urgency tab (Serper)
  // ---------------------------------------------------------------------------
  fetchUrgencyImages: protectedProcedure.input(z2.object({ companyId: z2.number(), force: z2.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    if (!input.force && company.urgencyImages) {
      try {
        const cached = JSON.parse(company.urgencyImages);
        if (Array.isArray(cached) && cached.length > 0) {
          return { images: cached, cached: true };
        }
      } catch {
      }
    }
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      console.warn("[fetchUrgencyImages] SERPER_API_KEY not configured \u2014 returning empty images");
      return { images: [], cached: false };
    }
    const query = `"${company.name}" news 2025 2026 -site:amazon.com -site:pinterest.com -site:shutterstock.com -site:gettyimages.com`;
    let data = {};
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1e4);
      let response;
      try {
        response = await fetch("https://google.serper.dev/images", {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, num: 12 }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (response.ok) {
        data = await response.json();
      } else {
        console.warn(`[fetchUrgencyImages] Serper news query returned ${response.status} \u2014 falling back to empty`);
      }
    } catch (err) {
      console.warn(`[fetchUrgencyImages] Serper news query failed: ${err.message} \u2014 falling back to empty`);
    }
    const BLOCKED = /* @__PURE__ */ new Set([
      "amazon.com",
      "ebay.com",
      "alibaba.com",
      "pinterest.com",
      "shutterstock.com",
      "gettyimages.com",
      "istockphoto.com",
      "dreamstime.com",
      "alamy.com",
      "depositphotos.com",
      "123rf.com",
      "google.com",
      "bing.com"
    ]);
    const images = (data.images ?? []).filter((img) => {
      const d = (img.domain ?? "").replace(/^www\./, "").toLowerCase();
      return img.imageUrl && !BLOCKED.has(d);
    }).slice(0, 8).map((img) => ({
      imageUrl: img.imageUrl ?? "",
      thumbnailUrl: img.thumbnailUrl ?? "",
      title: img.title ?? "",
      source: img.source ?? img.domain ?? "",
      domain: img.domain ?? "",
      link: img.link ?? ""
    }));
    if (images.length === 0) {
      const websiteUrl = company.websiteUrl || company.primaryDomain;
      if (websiteUrl) {
        try {
          const rawDomain = websiteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].split("?")[0].toLowerCase();
          if (rawDomain) {
            const wsController = new AbortController();
            const wsTimeoutId = setTimeout(() => wsController.abort(), 1e4);
            let websiteResponse = null;
            try {
              websiteResponse = await fetch("https://google.serper.dev/images", {
                method: "POST",
                headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ q: `site:${rawDomain}`, num: 12 }),
                signal: wsController.signal
              });
            } catch (wsErr) {
              console.warn(`[fetchUrgencyImages] Serper website fallback failed: ${wsErr.message}`);
            } finally {
              clearTimeout(wsTimeoutId);
            }
            if (websiteResponse?.ok) {
              const websiteData = await websiteResponse.json();
              const websiteImages = (websiteData.images ?? []).filter((img) => img.imageUrl).slice(0, 8).map((img) => ({
                imageUrl: img.imageUrl ?? "",
                thumbnailUrl: img.thumbnailUrl ?? "",
                title: img.title ?? "",
                source: img.source ?? img.domain ?? "",
                domain: img.domain ?? "",
                link: img.link ?? "",
                _fallback: "website"
              }));
              if (websiteImages.length > 0) {
                await updateCompany(input.companyId, { urgencyImages: JSON.stringify(websiteImages) });
                return { images: websiteImages, cached: false, fallback: "website" };
              }
            }
          }
        } catch {
        }
      }
    }
    await updateCompany(input.companyId, { urgencyImages: JSON.stringify(images) });
    return { images, cached: false };
  }),
  getUrgencyImages: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ ctx, input }) => {
    const company = await assertCompanyAccess(input.companyId, ctx.user.id);
    if (!company.urgencyImages) return { images: [] };
    try {
      const images = JSON.parse(company.urgencyImages);
      return { images: Array.isArray(images) ? images : [] };
    } catch {
      return { images: [] };
    }
  }),
  // ---------------------------------------------------------------------------
  // getBatchStatus — returns per-company research/approach status for a search
  // ---------------------------------------------------------------------------
  getBatchStatus: protectedProcedure.input(z2.object({ searchId: z2.number() })).query(async ({ ctx, input }) => {
    const { getCompaniesBySearchId: getCompaniesBySearchId3 } = await Promise.resolve().then(() => (init_db(), db_exports));
    await assertSearchAccess(input.searchId, ctx.user.id);
    const companies2 = await getCompaniesBySearchId3(input.searchId);
    const enriched = companies2.filter((c) => c.enrichmentStatus === "enriched");
    const hasResearch = enriched.filter((c) => c.briefData != null);
    const hasApproach = enriched.filter((c) => c.salesApproachData != null);
    const missingApproach = hasResearch.filter((c) => c.salesApproachData == null);
    return {
      total: enriched.length,
      researched: hasResearch.length,
      approached: hasApproach.length,
      missingApproach: missingApproach.length,
      missingApproachIds: missingApproach.map((c) => c.id)
    };
  }),
  // ---------------------------------------------------------------------------
  // completeMissingApproach — run sales approach ONLY for companies that have
  // research but no salesApproachData (catch-up after a partial batch run)
  // ---------------------------------------------------------------------------
  completeMissingApproach: protectedProcedure.input(z2.object({ searchId: z2.number() })).mutation(async ({ ctx, input }) => {
    const { getCompaniesBySearchId: getCompaniesBySearchId3 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
    await assertSearchAccess(input.searchId, ctx.user.id);
    const companies2 = await getCompaniesBySearchId3(input.searchId);
    const toApproach = companies2.filter(
      (c) => c.enrichmentStatus === "enriched" && c.briefData != null && c.salesApproachData == null
    );
    console.log(`[completeMissingApproach] searchId=${input.searchId} \u2014 ${toApproach.length} companies need sales approach`);
    let completed = 0;
    let failed = 0;
    const errors = [];
    for (const company of toApproach) {
      try {
        const salesApproach = await generateSalesApproach2(company.id, ctx.user.id);
        await updateCompany(company.id, {
          salesApproachData: JSON.stringify(salesApproach),
          salesApproachGeneratedAt: /* @__PURE__ */ new Date()
        });
        completed++;
        console.log(`[completeMissingApproach] \u2713 ${company.name} (${completed}/${toApproach.length})`);
      } catch (err) {
        failed++;
        errors.push(`${company.name}: ${err.message}`);
        console.error(`[completeMissingApproach] \u2717 ${company.name}:`, err.message);
      }
    }
    return { success: true, total: toApproach.length, completed, failed, errors: errors.slice(0, 10) };
  }),
  // ── Per-signal approach sub-agent ──────────────────────────────────────────
  // Takes one urgency signal + companyId, returns one targeted conversation
  // starter grounded in that specific signal. Fast (no web search), uses
  // invokeLLM with Offering Brain context injected.
  generateSalesRepProfile: protectedProcedure.input(z2.object({ companyId: z2.number() })).mutation(async ({ input, ctx }) => {
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const { getActiveBrain: getActiveBrain2, getCompanyById: getCompanyById2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const company = await getCompanyById2(input.companyId);
    if (!company) throw new TRPCError3({ code: "NOT_FOUND", message: "Company not found" });
    let brainContext = "";
    let sellerName = "Your Company";
    try {
      const brain = await getActiveBrain2(ctx.user.id);
      if (brain && brain.status === "completed") {
        sellerName = brain.companyName || sellerName;
        const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
        const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
        brainContext = `
SELLER: ${brain.companyName}
Offering: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp) => vp.proposition).join("; ")}
`;
      }
    } catch (_) {
    }
    const briefData = company.briefData ? typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData : null;
    const sliceMeta = company.sliceMetadata ? (() => {
      try {
        return JSON.parse(company.sliceMetadata);
      } catch {
        return {};
      }
    })() : {};
    const companyContext = briefData ? `
COMPANY: ${company.name}
Industry: ${sliceMeta.industry || "unknown"}
Size: ${sliceMeta.employeeBand || "unknown"}
Urgency Score: ${briefData.urgencyScore ?? "unknown"}
Key Signals: ${(briefData.urgencySignals || []).slice(0, 3).map((s) => s.description).join("; ")}
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

Be specific to this company \u2014 do NOT give generic advice. Write in plain prose, no bullet points, no headers.
Return ONLY the profile description.`;
    const response = await invokeLLM2({
      messages: [
        { role: "system", content: "You are a precise B2B sales coaching assistant. Return only the requested text, nothing else." },
        { role: "user", content: prompt }
      ]
    });
    const rawContent = response?.choices?.[0]?.message?.content;
    const profile = (typeof rawContent === "string" ? rawContent : "").trim();
    if (!profile) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty profile" });
    await updateCompany(input.companyId, {
      salesRepProfile: profile,
      salesRepProfileGeneratedAt: /* @__PURE__ */ new Date()
    });
    await stampBrainOnCompany(input.companyId, ctx.user.id);
    return { profile };
  }),
  // Load persisted sales rep profile for a company
  getSalesRepProfile: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ input }) => {
    const company = await getCompanyById(input.companyId);
    if (!company) throw new TRPCError3({ code: "NOT_FOUND", message: "Company not found" });
    return {
      profile: company.salesRepProfile ?? null,
      generatedAt: company.salesRepProfileGeneratedAt ?? null
    };
  }),
  generateSignalApproach: protectedProcedure.input(
    z2.object({
      companyId: z2.number(),
      signal: z2.object({
        category: z2.string(),
        type: z2.string().optional(),
        description: z2.string(),
        snippet: z2.string().optional(),
        sourceUrl: z2.string().optional()
      })
    })
  ).mutation(async ({ input, ctx }) => {
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const { getActiveBrain: getActiveBrain2, getCompanyById: getCompanyById2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const company = await getCompanyById2(input.companyId);
    if (!company) throw new TRPCError3({ code: "NOT_FOUND", message: "Company not found" });
    let brainContext = "";
    let sellerName = "Your Company";
    try {
      const brain = await getActiveBrain2(ctx.user.id);
      if (brain && brain.status === "completed") {
        sellerName = brain.companyName || sellerName;
        const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
        const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
        const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
        brainContext = `
YOU ARE A SALES REP FOR: ${brain.companyName}
Offering Summary: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
Pain Points We Solve: ${painPoints.join("; ")}
`;
      }
    } catch (_) {
    }
    const { signal } = input;
    const prompt = `${brainContext}
You are crafting ONE sharp, specific B2B conversation opener for a sales rep at ${sellerName}.

TARGET COMPANY: ${company.name}

URGENCY SIGNAL:
- Category: ${signal.category}${signal.type ? ` / ${signal.type}` : ""}
- What happened: ${signal.description}
${signal.snippet ? `- Quote: "${signal.snippet}"` : ""}
${signal.sourceUrl ? `- Source: ${signal.sourceUrl}` : ""}

INSTRUCTIONS:
1. Write exactly ONE conversation opener (2-3 sentences max)
2. Reference the specific signal above \u2014 do NOT be generic
3. Connect the signal to a concrete pain point or opportunity ${sellerName} can address
4. End with a soft, open question
5. Tone: peer-to-peer, not salesy

Return ONLY the opener text. No labels, no JSON, no preamble.`;
    const response = await invokeLLM2({
      messages: [
        { role: "system", content: "You are a precise B2B sales writing assistant. Return only the requested text, nothing else." },
        { role: "user", content: prompt }
      ]
    });
    const rawContent = response?.choices?.[0]?.message?.content;
    const opener = (typeof rawContent === "string" ? rawContent : "").trim();
    if (!opener) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty opener" });
    return { opener };
  }),
  // Batch find decision makers for all companies with urgency >= threshold in a search
  batchFindDecisionMakers: protectedProcedure.input(z2.object({
    searchId: z2.number(),
    minUrgencyScore: z2.number().default(50)
  })).mutation(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const jobId = randomUUID();
    await createBatchJob({
      id: jobId,
      searchId: input.searchId,
      userId: ctx.user.id,
      status: "running",
      jobType: "doAll",
      progress: 0,
      currentCompany: null,
      totalCompanies: 0,
      enriched: 0,
      researched: 0,
      approached: 0,
      failed: 0,
      remaining: 0
    });
    (async () => {
      try {
        const all = await getCompaniesBySearchId(input.searchId);
        const queue = all.filter((c) => {
          const score = c.urgencyScore ?? 0;
          const hasDomain = !!(c.primaryDomain || c.websiteUrl);
          return score >= input.minUrgencyScore && hasDomain;
        });
        await updateBatchJob(jobId, { totalCompanies: queue.length });
        console.log(`[BatchContacts] jobId=${jobId} \u2014 ${queue.length} companies with urgency>=${input.minUrgencyScore}`);
        let found = 0, skipped = 0, failed = 0;
        for (let i = 0; i < queue.length; i++) {
          const currentJob = await getBatchJob(jobId);
          if (currentJob?.status === "cancelled") {
            console.log(`[BatchContacts] Cancelled at ${i + 1}/${queue.length}`);
            return;
          }
          const company = queue[i];
          const progress2 = Math.round(i / queue.length * 100);
          await updateBatchJob(jobId, { currentCompany: company.name || null, progress: progress2, enriched: found, failed });
          try {
            const existing = await getContactsByCompanyId(company.id);
            if (existing.length > 0) {
              skipped++;
              console.log(`[BatchContacts] Skipped (cached): ${company.name}`);
              continue;
            }
            const domain = (company.primaryDomain || company.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
            if (!domain) {
              failed++;
              continue;
            }
            const result = await trickleDownSearch(domain, company.name || "", 5, false);
            const seenEmails = /* @__PURE__ */ new Set();
            const seenNames = /* @__PURE__ */ new Set();
            for (const contact of result.contacts) {
              const email = contact.email?.toLowerCase();
              const name = contact.name?.toLowerCase();
              if (email && seenEmails.has(email) || name && seenNames.has(name)) continue;
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
                  searchedTitle: `Tier ${result.tierFound}: ${result.tierLabel}`
                });
                if (email) seenEmails.add(email);
                if (name) seenNames.add(name);
              } catch {
              }
            }
            found++;
            console.log(`[BatchContacts] \u2713 ${company.name}: ${result.contacts.length} contacts (Tier ${result.tierFound})`);
          } catch (err) {
            failed++;
            console.error(`[BatchContacts] \u2717 ${company.name}:`, err.message);
          }
          await new Promise((r) => setTimeout(r, 800));
        }
        await updateBatchJob(jobId, {
          status: "completed",
          progress: 100,
          enriched: found,
          failed,
          remaining: skipped,
          currentCompany: null
        });
        console.log(`[BatchContacts] Done \u2014 ${found} found, ${skipped} skipped, ${failed} failed`);
      } catch (err) {
        await updateBatchJob(jobId, { status: "failed", errorMessage: err.message }).catch(() => {
        });
        console.error(`[BatchContacts] Fatal error:`, err);
      }
    })();
    return { jobId };
  }),
  syncToSupabase: protectedProcedure.input(z2.object({ searchId: z2.number() })).mutation(async ({ input }) => {
    const { syncSearchRunToSupabase: syncSearchRunToSupabase2, syncBrainsToSupabase: syncBrainsToSupabase2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    const [searchResult, brainResult] = await Promise.all([
      syncSearchRunToSupabase2(input.searchId),
      syncBrainsToSupabase2()
    ]);
    return {
      companiesSynced: searchResult.companiesSynced,
      contactsSynced: searchResult.contactsSynced,
      brainsSynced: brainResult.synced,
      errors: searchResult.errors + brainResult.errors,
      message: `${searchResult.message} | ${brainResult.message}`
    };
  }),
  pushBrainToSupabase: protectedProcedure.input(z2.object({ brainId: z2.number() })).mutation(async ({ input }) => {
    const { pushSingleBrainToSupabase: pushSingleBrainToSupabase2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    return pushSingleBrainToSupabase2(input.brainId);
  }),
  // ---------------------------------------------------------------------------
  // getCompanyFeedItems — fetch raw Serper feed_items from Supabase for the
  // NEWS chapter of the company detail page. Looks up the company domain and
  // queries feed_items by matching the raw_content query field.
  // ---------------------------------------------------------------------------
  getCompanyFeedItems: protectedProcedure.input(z2.object({ companyId: z2.number(), limit: z2.number().default(20) })).query(async ({ input }) => {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return { items: [] };
    const company = await getCompanyById(input.companyId);
    if (!company) return { items: [] };
    const supabase = createClient2(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("feed_items").select("id, title, link, description, author, published_at, created_at, raw_content").ilike("raw_content", `%${company.name}%`).order("created_at", { ascending: false }).limit(input.limit);
    if (error || !data) return { items: [] };
    const items = data.map((row) => {
      let kind = "web";
      let query = "";
      try {
        const rc = typeof row.raw_content === "string" ? JSON.parse(row.raw_content) : row.raw_content;
        kind = rc?.kind ?? rc?.serper_type ?? "web";
        query = rc?.query ?? "";
      } catch {
      }
      return {
        id: row.id,
        title: row.title || "",
        link: row.link || "",
        description: row.description || "",
        author: row.author || null,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        kind,
        query
      };
    });
    return { items };
  }),
  pullBrainFromSupabase: protectedProcedure.input(z2.object({ brainId: z2.number() })).mutation(async ({ input }) => {
    const { pullSingleBrainFromSupabase: pullSingleBrainFromSupabase2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    return pullSingleBrainFromSupabase2(input.brainId);
  }),
  pullAllBrainsFromSupabase: protectedProcedure.mutation(async ({ ctx }) => {
    const { pullAllBrainsFromSupabase: pullAllBrainsFromSupabase2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    return pullAllBrainsFromSupabase2(ctx.user.id);
  }),
  // ---------------------------------------------------------------------------
  // batchFetchImages — fetch product images + urgency images for all companies
  // in a campaign that are missing them. Designed for demo prep.
  // ---------------------------------------------------------------------------
  batchFetchImages: protectedProcedure.input(z2.object({ searchId: z2.number(), type: z2.enum(["product", "urgency", "both"]).default("both") })).mutation(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const allCompanies = await getCompaniesBySearchId(input.searchId);
    const enriched = allCompanies.filter((c) => c.enrichmentStatus === "enriched");
    const needProduct = input.type === "both" || input.type === "product" ? enriched.filter((c) => !c.productImages || c.productImages === "[]" || c.productImages === "null") : [];
    const needUrgency = input.type === "both" || input.type === "urgency" ? enriched.filter((c) => !c.urgencyImages || c.urgencyImages === "[]" || c.urgencyImages === "null") : [];
    console.log(`[batchFetchImages] searchId=${input.searchId} \u2014 ${needProduct.length} need product images, ${needUrgency.length} need urgency images`);
    let productDone = 0, productFailed = 0;
    let urgencyDone = 0, urgencyFailed = 0;
    if (needProduct.length > 0) {
      const { fetchSerperImages: fetchSerperImages2 } = await Promise.resolve().then(() => (init_serperImages(), serperImages_exports));
      for (const company of needProduct) {
        try {
          const images = await fetchSerperImages2(company.name, company.primaryDomain, 6);
          await updateCompany(company.id, { productImages: JSON.stringify(images) });
          productDone++;
          if (productDone % 10 === 0) console.log(`[batchFetchImages] product: ${productDone}/${needProduct.length}`);
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          productFailed++;
          console.warn(`[batchFetchImages] product \u2717 ${company.name}: ${err.message}`);
        }
      }
    }
    if (needUrgency.length > 0) {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        console.warn("[batchFetchImages] SERPER_API_KEY not configured \u2014 skipping urgency images");
      } else {
        const BLOCKED = /* @__PURE__ */ new Set([
          "amazon.com",
          "ebay.com",
          "alibaba.com",
          "pinterest.com",
          "shutterstock.com",
          "gettyimages.com",
          "istockphoto.com",
          "dreamstime.com",
          "alamy.com",
          "depositphotos.com",
          "123rf.com",
          "google.com",
          "bing.com"
        ]);
        for (const company of needUrgency) {
          try {
            const query = `"${company.name}" news 2025 2026 -site:amazon.com -site:pinterest.com -site:shutterstock.com -site:gettyimages.com`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1e4);
            let response;
            try {
              response = await fetch("https://google.serper.dev/images", {
                method: "POST",
                headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ q: query, num: 12 }),
                signal: controller.signal
              });
            } finally {
              clearTimeout(timeoutId);
            }
            let images = [];
            if (response.ok) {
              const data = await response.json();
              images = (data.images ?? []).filter((img) => {
                const d = (img.domain ?? "").replace(/^www\./, "").toLowerCase();
                return img.imageUrl && !BLOCKED.has(d);
              }).slice(0, 8).map((img) => ({
                imageUrl: img.imageUrl ?? "",
                thumbnailUrl: img.thumbnailUrl ?? "",
                title: img.title ?? "",
                source: img.source ?? img.domain ?? "",
                domain: img.domain ?? "",
                link: img.link ?? ""
              }));
            }
            if (images.length === 0) {
              const websiteUrl = company.websiteUrl || company.primaryDomain;
              if (websiteUrl) {
                const rawDomain = websiteUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
                if (rawDomain) {
                  try {
                    const wsResp = await fetch("https://google.serper.dev/images", {
                      method: "POST",
                      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
                      body: JSON.stringify({ q: `site:${rawDomain}`, num: 12 })
                    });
                    if (wsResp.ok) {
                      const wsData = await wsResp.json();
                      images = (wsData.images ?? []).filter((img) => img.imageUrl).slice(0, 8).map((img) => ({ imageUrl: img.imageUrl ?? "", thumbnailUrl: img.thumbnailUrl ?? "", title: img.title ?? "", source: img.source ?? img.domain ?? "", domain: img.domain ?? "", link: img.link ?? "", _fallback: "website" }));
                    }
                  } catch {
                  }
                }
              }
            }
            await updateCompany(company.id, { urgencyImages: JSON.stringify(images) });
            urgencyDone++;
            if (urgencyDone % 10 === 0) console.log(`[batchFetchImages] urgency: ${urgencyDone}/${needUrgency.length}`);
            await new Promise((r) => setTimeout(r, 200));
          } catch (err) {
            urgencyFailed++;
            console.warn(`[batchFetchImages] urgency \u2717 ${company.name}: ${err.message}`);
          }
        }
      }
    }
    console.log(`[batchFetchImages] DONE \u2014 product: ${productDone}/${needProduct.length} (${productFailed} failed), urgency: ${urgencyDone}/${needUrgency.length} (${urgencyFailed} failed)`);
    return {
      success: true,
      product: { total: needProduct.length, done: productDone, failed: productFailed },
      urgency: { total: needUrgency.length, done: urgencyDone, failed: urgencyFailed }
    };
  }),
  // Sales Menu — list all campaigns with stats (company count + avg fit score)
  getSalesMenuCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { searches: searches2, companies: companies2, offeringBrain: offeringBrain2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq14, and: and10, or: or2, desc: desc4, sql: sql7, inArray: inArray9 } = await import("drizzle-orm");
    const db = await getDb2();
    if (!db) return [];
    const rows = await db.select({
      search: searches2,
      brainName: offeringBrain2.brainName
    }).from(searches2).leftJoin(offeringBrain2, eq14(searches2.brainId, offeringBrain2.id)).where(
      and10(
        or2(eq14(searches2.userId, ctx.user.id), eq14(searches2.sharedWithTeam, 1)),
        eq14(searches2.isArchived, 0)
      )
    ).orderBy(desc4(searches2.createdAt));
    if (rows.length === 0) return [];
    const searchIds = rows.map((r) => r.search.id);
    const statsRows = await db.select({
      searchId: companies2.searchId,
      companyCount: sql7`COUNT(*)`,
      avgFit: sql7`ROUND(AVG(CASE WHEN ${companies2.fitScore} IS NOT NULL THEN ${companies2.fitScore} END), 0)`
    }).from(companies2).where(inArray9(companies2.searchId, searchIds)).groupBy(companies2.searchId);
    const statsMap = new Map(statsRows.map((s) => [s.searchId, s]));
    return rows.map((r) => {
      const stats = statsMap.get(r.search.id);
      return {
        id: r.search.id,
        offeringName: r.search.offeringName ?? "Untitled Campaign",
        location: r.search.location,
        brainName: r.brainName ?? null,
        status: r.search.status,
        createdAt: r.search.createdAt,
        companyCount: stats?.companyCount ?? 0,
        avgFitScore: stats?.avgFit ?? null
      };
    });
  }),
  // Sync ALL researched companies to Supabase lt_mns_companies table
  syncAllCompanies: protectedProcedure.mutation(async () => {
    const { syncAllCompaniesToSupabase: syncAllCompaniesToSupabase2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    const result = await syncAllCompaniesToSupabase2();
    return result;
  }),
  // Get sync stats for lt_mns_companies table
  getCompaniesTableSyncStats: protectedProcedure.query(async () => {
    const { getCompaniesTableSyncStats: getCompaniesTableSyncStats2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    return await getCompaniesTableSyncStats2();
  }),
  // Sync all researched company pages to Supabase lt_mns_company_pages table
  syncCompanyPages: protectedProcedure.input(z2.object({ appBaseUrl: z2.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
    const { syncCompanyPagesToSupabase: syncCompanyPagesToSupabase2 } = await Promise.resolve().then(() => (init_supabaseSync(), supabaseSync_exports));
    const result = await syncCompanyPagesToSupabase2();
    return result;
  }),
  // Get last sync stats for the company pages table
  getCompanyPagesSyncStats: protectedProcedure.query(async () => {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabase = createClient2(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    const { count: count2, error } = await supabase.from("lt_mns_company_pages").select("*", { count: "exact", head: true });
    if (error) return { count: 0, lastSyncedAt: null, error: error.message };
    const { data: latest } = await supabase.from("lt_mns_company_pages").select("synced_at").order("synced_at", { ascending: false }).limit(1).single();
    return {
      count: count2 ?? 0,
      lastSyncedAt: latest?.synced_at ?? null,
      error: null
    };
  }),
  // Query lt_mns_company_pages from Supabase with search/filter support
  getIntelligenceCompanies: protectedProcedure.input(z2.object({
    search: z2.string().optional(),
    campaignId: z2.number().optional(),
    urgencyLabel: z2.enum(["HIGH", "MEDIUM", "LOW", "ALL"]).optional(),
    minFit: z2.number().optional(),
    limit: z2.number().default(100),
    offset: z2.number().default(0)
  })).query(async ({ input }) => {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabase = createClient2(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    let query = supabase.from("lt_mns_company_pages").select("*", { count: "exact" }).order("urgency_score", { ascending: false }).range(input.offset, input.offset + input.limit - 1);
    if (input.search) {
      query = query.or(`company_name.ilike.%${input.search}%,domain.ilike.%${input.search}%,campaign_name.ilike.%${input.search}%`);
    }
    if (input.campaignId) {
      query = query.eq("campaign_id", input.campaignId);
    }
    if (input.urgencyLabel && input.urgencyLabel !== "ALL") {
      query = query.eq("urgency_label", input.urgencyLabel);
    }
    if (input.minFit) {
      query = query.gte("fit_score", input.minFit);
    }
    const { data, count: count2, error } = await query;
    if (error) throw new Error(error.message);
    return {
      companies: data ?? [],
      total: count2 ?? 0
    };
  }),
  // Get distinct campaigns from lt_mns_company_pages for the filter dropdown
  getIntelligenceCampaigns: protectedProcedure.query(async () => {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabase = createClient2(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    const { data, error } = await supabase.from("lt_mns_company_pages").select("campaign_id, campaign_name").not("campaign_id", "is", null);
    if (error) throw new Error(error.message);
    const seen = /* @__PURE__ */ new Set();
    const campaigns = [];
    for (const row of data ?? []) {
      if (!seen.has(row.campaign_id)) {
        seen.add(row.campaign_id);
        campaigns.push({ id: row.campaign_id, name: row.campaign_name ?? `Campaign ${row.campaign_id}` });
      }
    }
    return campaigns.sort((a, b) => a.name.localeCompare(b.name));
  }),
  // Resolve a Supabase UUID to a local integer company ID
  // Used when Intelligence page navigates with UUID instead of local ID
  resolveCompanyUUID: protectedProcedure.input(z2.object({ uuid: z2.string() })).query(async ({ input }) => {
    try {
      const { createClient: createClient2 } = await import("@supabase/supabase-js");
      const supabase = createClient2(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      );
      const { data, error } = await supabase.from("lt_mns_company_pages").select("local_id, page_url").eq("company_id", input.uuid).limit(1).single();
      if (error || !data) {
        const { data: data2 } = await supabase.from("lt_mns_company_pages").select("local_id, page_url").eq("id", input.uuid).limit(1).single();
        if (!data2) return { localId: null };
        const localId2 = data2.local_id ?? (data2.page_url ? parseInt(data2.page_url.split("/company/")[1]?.split("?")[0], 10) : null);
        return { localId: localId2 && !isNaN(localId2) ? localId2 : null };
      }
      const localId = data.local_id ?? (data.page_url ? parseInt(data.page_url.split("/company/")[1]?.split("?")[0], 10) : null);
      return { localId: localId && !isNaN(localId) ? localId : null };
    } catch (e) {
      console.error("[resolveCompanyUUID] Error:", e);
      return { localId: null };
    }
  }),
  // ---------------------------------------------------------------------------
  // deduplicateSearch — remove duplicate apolloId rows within a search
  // Keeps the most-enriched row (enriched > pending, then most recent brief, then lowest id)
  // ---------------------------------------------------------------------------
  deduplicateSearch: protectedProcedure.input(z2.object({ searchId: z2.number() })).mutation(async ({ ctx, input }) => {
    await assertSearchAccess(input.searchId, ctx.user.id);
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    try {
      const [dups] = await conn.execute(
        `SELECT apolloId, COUNT(*) as cnt
           FROM companies
           WHERE searchId = ? AND apolloId IS NOT NULL
           GROUP BY apolloId
           HAVING cnt > 1`,
        [input.searchId]
      );
      let totalDeleted = 0;
      for (const dup of dups) {
        const [rows] = await conn.execute(
          `SELECT id, enrichmentStatus, briefGeneratedAt
             FROM companies
             WHERE searchId = ? AND apolloId = ?
             ORDER BY
               CASE enrichmentStatus WHEN 'enriched' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END ASC,
               briefGeneratedAt DESC,
               id ASC`,
          [input.searchId, dup.apolloId]
        );
        const [, ...toDelete] = rows;
        const deleteIds = toDelete.map((r) => Number(r.id));
        if (deleteIds.length > 0) {
          const placeholders = deleteIds.map(() => "?").join(",");
          await conn.execute(`DELETE FROM company_brain_outputs WHERE companyId IN (${placeholders})`, deleteIds);
          await conn.execute(`DELETE FROM companies WHERE id IN (${placeholders})`, deleteIds);
          totalDeleted += deleteIds.length;
        }
      }
      console.log(`[deduplicateSearch] search=${input.searchId} removed ${totalDeleted} duplicates from ${dups.length} groups`);
      return { removed: totalDeleted, groups: dups.length };
    } finally {
      await conn.end();
    }
  })
});

// server/codeDescriptions.ts
import { z as z3 } from "zod";

// server/codeDescriptionDb.ts
init_db();
init_schema();
import { eq as eq3, and as and2, inArray as inArray2, sql } from "drizzle-orm";

// server/codeDescriptionLookup.ts
async function fetchSicDescription(code) {
  try {
    const url = `https://siccode.com/sic-code/${code}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    const titleMatch = html.match(/<title>SIC Code \d+ - ([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    const h1Match = html.match(/<h1[^>]*>SIC Code \d+ - ([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }
    return null;
  } catch (error) {
    console.error(`[SIC Lookup] Failed to fetch description for ${code}:`, error);
    return null;
  }
}
async function fetchNaicsDescription(code) {
  try {
    const url = `https://siccode.com/naics-code/${code}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    const titleMatch = html.match(/<title>NAICS Code \d+ - ([^<|]+)/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    const h1Match = html.match(/<h1[^>]*>NAICS Code \d+ - ([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }
    return null;
  } catch (error) {
    console.error(`[NAICS Lookup] Failed to fetch description for ${code}:`, error);
    return null;
  }
}
async function batchFetchSicDescriptions(codes) {
  const results = /* @__PURE__ */ new Map();
  const batchSize = 5;
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const promises = batch.map(async (code) => {
      const description = await fetchSicDescription(code);
      if (description) {
        results.set(code, description);
      }
    });
    await Promise.all(promises);
    if (i + batchSize < codes.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return results;
}
async function batchFetchNaicsDescriptions(codes) {
  const results = /* @__PURE__ */ new Map();
  const batchSize = 5;
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const promises = batch.map(async (code) => {
      const description = await fetchNaicsDescription(code);
      if (description) {
        results.set(code, description);
      }
    });
    await Promise.all(promises);
    if (i + batchSize < codes.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return results;
}

// server/codeDescriptionDb.ts
async function batchGetSicDescriptions(codes) {
  const db = await getDb();
  const results = /* @__PURE__ */ new Map();
  if (!db || codes.length === 0) {
    return results;
  }
  const cached = await db.select().from(codeDescriptions).where(and2(
    inArray2(codeDescriptions.code, codes),
    eq3(codeDescriptions.codeType, "SIC")
  ));
  const cachedMap = new Map(cached.map((c) => [c.code, c.description]));
  const uncachedCodes = codes.filter((code) => !cachedMap.has(code));
  if (uncachedCodes.length > 0) {
    const fetchedDescriptions = await batchFetchSicDescriptions(uncachedCodes);
    const toInsert = uncachedCodes.map((code) => ({
      code,
      codeType: "SIC",
      description: fetchedDescriptions.get(code) || null
    }));
    if (toInsert.length > 0) {
      try {
        await db.insert(codeDescriptions).values(toInsert).onDuplicateKeyUpdate({
          set: { description: sql`VALUES(description)` }
        });
      } catch (error) {
        console.error("[Code Cache] Failed to batch cache SIC codes:", error);
      }
    }
    uncachedCodes.forEach((code) => {
      results.set(code, fetchedDescriptions.get(code) || null);
    });
  }
  cachedMap.forEach((description, code) => {
    results.set(code, description);
  });
  return results;
}
async function batchGetNaicsDescriptions(codes) {
  const db = await getDb();
  const results = /* @__PURE__ */ new Map();
  if (!db || codes.length === 0) {
    return results;
  }
  const cached = await db.select().from(codeDescriptions).where(and2(
    inArray2(codeDescriptions.code, codes),
    eq3(codeDescriptions.codeType, "NAICS")
  ));
  const cachedMap = new Map(cached.map((c) => [c.code, c.description]));
  const uncachedCodes = codes.filter((code) => !cachedMap.has(code));
  if (uncachedCodes.length > 0) {
    const fetchedDescriptions = await batchFetchNaicsDescriptions(uncachedCodes);
    const toInsert = uncachedCodes.map((code) => ({
      code,
      codeType: "NAICS",
      description: fetchedDescriptions.get(code) || null
    }));
    if (toInsert.length > 0) {
      try {
        await db.insert(codeDescriptions).values(toInsert).onDuplicateKeyUpdate({
          set: { description: sql`VALUES(description)` }
        });
      } catch (error) {
        console.error("[Code Cache] Failed to batch cache NAICS codes:", error);
      }
    }
    uncachedCodes.forEach((code) => {
      results.set(code, fetchedDescriptions.get(code) || null);
    });
  }
  cachedMap.forEach((description, code) => {
    results.set(code, description);
  });
  return results;
}

// server/codeDescriptions.ts
var codeDescriptionsRouter = router({
  /**
   * Batch get SIC code descriptions
   */
  getSicDescriptions: protectedProcedure.input(z3.object({
    codes: z3.array(z3.string())
  })).query(async ({ input }) => {
    const descriptionsMap = await batchGetSicDescriptions(input.codes);
    return input.codes.map((code) => ({
      code,
      description: descriptionsMap.get(code) || null
    }));
  }),
  /**
   * Batch get NAICS code descriptions
   */
  getNaicsDescriptions: protectedProcedure.input(z3.object({
    codes: z3.array(z3.string())
  })).query(async ({ input }) => {
    const descriptionsMap = await batchGetNaicsDescriptions(input.codes);
    return input.codes.map((code) => ({
      code,
      description: descriptionsMap.get(code) || null
    }));
  })
});

// server/nicheRouter.ts
import { z as z4 } from "zod";
init_db();
import { TRPCError as TRPCError4 } from "@trpc/server";

// server/nicheFitScorer.ts
init_llm();
init_db();
async function scoreNicheFit(niche, userId) {
  const brain = await getActiveBrain(userId);
  if (!brain || brain.status !== "completed") {
    throw new Error("No active Offering Brain found \u2014 cannot score niche fit without ICP criteria");
  }
  const offeringSummary = brain.offeringSummary || "";
  const coreCapabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
  const icpIndustries = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const icpPainPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
  const icpBuyingSignals = brain.icpBuyingSignals ? JSON.parse(brain.icpBuyingSignals) : [];
  const fitCriteria = brain.fitCriteria ? JSON.parse(brain.fitCriteria) : { mustHave: [], niceToHave: [], disqualifiers: [] };
  const valuePropositions = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
  const nicheProfile = [
    `Niche Name: ${niche.name}`,
    niche.description ? `Description: ${niche.description}` : null,
    niche.rationale ? `Rationale: ${niche.rationale}` : null,
    niche.companyCount ? `Company Count: ${niche.companyCount}` : null,
    niche.topKeywords?.length ? `Top Keywords: ${niche.topKeywords.join(", ")}` : null,
    niche.sampleCompanies?.length ? `Sample Companies: ${niche.sampleCompanies.join(", ")}` : null
  ].filter(Boolean).join("\n");
  const brainContext = [
    `Offering: ${brain.companyName} \u2014 ${offeringSummary}`,
    coreCapabilities.length ? `Core Capabilities: ${coreCapabilities.join("; ")}` : null,
    valuePropositions.length ? `Value Propositions: ${valuePropositions.map((v) => `${v.value} (for ${v.audience})`).join("; ")}` : null,
    icpIndustries.length ? `ICP Industries: ${icpIndustries.join(", ")}` : null,
    brain.icpCompanySize ? `ICP Company Size: ${brain.icpCompanySize}` : null,
    brain.icpGeography ? `ICP Geography: ${brain.icpGeography}` : null,
    icpPainPoints.length ? `Pain Points Solved: ${icpPainPoints.join("; ")}` : null,
    icpBuyingSignals.length ? `Buying Signals: ${icpBuyingSignals.join("; ")}` : null,
    fitCriteria.mustHave?.length ? `Must-Have Criteria: ${fitCriteria.mustHave.join("; ")}` : null,
    fitCriteria.disqualifiers?.length ? `Disqualifiers: ${fitCriteria.disqualifiers.join("; ")}` : null
  ].filter(Boolean).join("\n");
  const prompt = `You are a B2B sales qualification analyst scoring a niche cluster of companies against a seller's Offering Brain.

## OFFERING BRAIN
${brainContext}

## NICHE CLUSTER TO SCORE
${nicheProfile}

## YOUR TASK
1. Identify 3 to 5 scoring dimensions that are MOST RELEVANT to evaluating this niche against this specific offering. Do NOT use generic or hardcoded dimensions \u2014 infer dimensions that reflect what actually matters for THIS offering's ICP.

2. Assign weights to each dimension. Weights must sum to exactly 100. Assign higher weights to dimensions that are most critical for the offering's success criteria.

3. Score each dimension from 0 to its maxScore based on how well the niche cluster aligns.

4. Compute the overall fitScore as the sum of all dimension scores (0-100).

5. If any disqualifier criteria clearly apply to this niche, cap the fitScore at 20.

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside JSON):
{
  "fitScore": <integer 0-100>,
  "fitReasoning": "<one paragraph (3-5 sentences) explaining the overall fit assessment>",
  "scoreBreakdown": [
    {
      "dimension": "<inferred dimension name>",
      "score": <integer 0 to maxScore>,
      "maxScore": <integer, this dimension's weight>,
      "weight": <same integer as maxScore>,
      "reasoning": "<1-2 sentences explaining this dimension's score>"
    }
  ]
}

Rules:
- scoreBreakdown must have 3-5 items
- All maxScore values must sum to exactly 100
- fitScore must equal the sum of all score values
- dimension names must be specific to the offering (e.g. "Manufacturing Complexity Fit", "Industrial Supply Chain Alignment") \u2014 NOT generic names like "Industry Fit" or "Size Fit"
- reasoning must reference specific keywords or signals from the niche cluster`;
  console.log(`[Niche Fit Scorer] Scoring niche "${niche.name}" against brain "${brain.brainName}"...`);
  const raw = await invokeLLM({
    messages: [
      { role: "system", content: "You are a B2B sales qualification analyst. Return only valid JSON." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "niche_fit_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            fitScore: { type: "integer" },
            fitReasoning: { type: "string" },
            scoreBreakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  score: { type: "integer" },
                  maxScore: { type: "integer" },
                  weight: { type: "integer" },
                  reasoning: { type: "string" }
                },
                required: ["dimension", "score", "maxScore", "weight", "reasoning"],
                additionalProperties: false
              }
            }
          },
          required: ["fitScore", "fitReasoning", "scoreBreakdown"],
          additionalProperties: false
        }
      }
    }
  });
  const rawContent = raw.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response for niche fit scoring");
  const contentStr = typeof rawContent === "string" ? rawContent : rawContent.map((p) => p.type === "text" ? p.text : "").join("");
  let parsed;
  try {
    parsed = JSON.parse(contentStr);
  } catch {
    const firstBrace = contentStr.indexOf("{");
    const lastBrace = contentStr.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) throw new Error("No valid JSON in LLM response");
    parsed = JSON.parse(contentStr.slice(firstBrace, lastBrace + 1));
  }
  const breakdown = (parsed.scoreBreakdown || []).map((d) => ({
    dimension: String(d.dimension || "Unknown"),
    score: Math.max(0, Math.min(d.maxScore ?? 100, Math.round(d.score ?? 0))),
    maxScore: Math.round(d.maxScore ?? 20),
    weight: Math.round(d.weight ?? d.maxScore ?? 20),
    reasoning: String(d.reasoning || "")
  }));
  const computedScore = breakdown.reduce((sum, d) => sum + d.score, 0);
  const finalScore = Math.max(0, Math.min(100, computedScore));
  console.log(`[Niche Fit Scorer] "${niche.name}" \u2192 fitScore: ${finalScore} (${breakdown.length} dimensions)`);
  return {
    fitScore: finalScore,
    fitReasoning: parsed.fitReasoning || "",
    scoreBreakdown: breakdown,
    scoredAt: (/* @__PURE__ */ new Date()).toISOString(),
    brainName: brain.brainName,
    brainId: brain.id,
    nicheName: niche.name
  };
}

// server/embeddingService.ts
import OpenAI from "openai";
var OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
var BATCH_SIZE = 50;
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
}
function buildEmbeddingText(company) {
  const parts = [];
  parts.push(`Company: ${company.name}`);
  if (company.sliceMetadata) {
    try {
      const meta = JSON.parse(company.sliceMetadata);
      if (meta.industry) parts.push(`Industry: ${meta.industry}`);
      if (meta.keywords) parts.push(`Keywords: ${meta.keywords}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
      if (meta.employeeCount) parts.push(`Employees: ${meta.employeeCount}`);
    } catch {
    }
  }
  const location = [company.city, company.country].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);
  if (company.sicCodes) {
    try {
      const codes = JSON.parse(company.sicCodes);
      if (codes.length > 0) parts.push(`SIC: ${codes.slice(0, 3).join(", ")}`);
    } catch {
    }
  }
  return parts.join(" | ");
}
async function generateEmbeddings(companies2) {
  if (companies2.length === 0) return [];
  const client = getOpenAIClient();
  const results = [];
  for (let i = 0; i < companies2.length; i += BATCH_SIZE) {
    const batch = companies2.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);
    console.log(
      `[Embeddings] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companies2.length / BATCH_SIZE)}: ${batch.length} companies`
    );
    const response = await client.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts
    });
    for (let j = 0; j < batch.length; j++) {
      results.push({
        companyId: batch[j].id,
        embedding: response.data[j].embedding,
        text: texts[j]
      });
    }
  }
  console.log(`[Embeddings] Done: ${results.length} embeddings generated`);
  return results;
}

// server/clusteringService.ts
init_llm();
var SEED_SAMPLE_SIZE = 500;
var MIN_K = 3;
var MAX_K = 12;
var MIN_COMPANIES_PER_CLUSTER = 3;
var KMEANS_MAX_ITERATIONS = 100;
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
function magnitude(v) {
  return Math.sqrt(dotProduct(v, v));
}
function cosineSimilarity(a, b) {
  const denom = magnitude(a) * magnitude(b);
  if (denom === 0) return 0;
  return dotProduct(a, b) / denom;
}
function cosineDistance(a, b) {
  return 1 - cosineSimilarity(a, b);
}
function meanVector(vectors) {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += v[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= vectors.length;
  return mean;
}
function stratifiedSample(companyEmbeddings, allCompanies, size) {
  if (companyEmbeddings.length <= size) {
    return { sample: companyEmbeddings, remainder: [] };
  }
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));
  const byIndustry = /* @__PURE__ */ new Map();
  for (const ce of companyEmbeddings) {
    const company = companyMap.get(ce.companyId);
    const meta = company?.sliceMetadata ? (() => {
      try {
        return JSON.parse(company.sliceMetadata);
      } catch {
        return {};
      }
    })() : {};
    const industry = meta.industry || "Unknown";
    if (!byIndustry.has(industry)) byIndustry.set(industry, []);
    byIndustry.get(industry).push(ce);
  }
  const total = companyEmbeddings.length;
  const sampled = [];
  const remainderSet = /* @__PURE__ */ new Set();
  for (const [, group] of Array.from(byIndustry)) {
    const quota = Math.max(1, Math.round(group.length / total * size));
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    sampled.push(...shuffled.slice(0, quota));
    shuffled.slice(quota).forEach((ce) => remainderSet.add(ce.companyId));
  }
  const finalSample = sampled.slice(0, size);
  const sampledIds = new Set(finalSample.map((ce) => ce.companyId));
  const remainder = companyEmbeddings.filter((ce) => !sampledIds.has(ce.companyId));
  console.log(
    `[Clustering] Stratified sample: ${finalSample.length} seed companies, ${remainder.length} remainder`
  );
  return { sample: finalSample, remainder };
}
function kMeansPlusPlus(embeddings, k) {
  const n = embeddings.length;
  const centroidIndices = [];
  centroidIndices.push(Math.floor(Math.random() * n));
  for (let c = 1; c < k; c++) {
    const distances = embeddings.map((emb) => {
      const minDist = Math.min(
        ...centroidIndices.map((ci) => cosineDistance(emb, embeddings[ci]))
      );
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      rand -= distances[i];
      if (rand <= 0) {
        chosen = i;
        break;
      }
    }
    centroidIndices.push(chosen);
  }
  let centroids = centroidIndices.map((i) => [...embeddings[i]]);
  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
    const newAssignments = embeddings.map((emb) => {
      let minDist = Infinity;
      let nearest = 0;
      for (let c = 0; c < k; c++) {
        const d = cosineDistance(emb, centroids[c]);
        if (d < minDist) {
          minDist = d;
          nearest = c;
        }
      }
      return nearest;
    });
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;
    for (let c = 0; c < k; c++) {
      const clusterVecs = embeddings.filter((_, i) => assignments[i] === c);
      if (clusterVecs.length > 0) {
        centroids[c] = meanVector(clusterVecs);
      }
    }
  }
  return { assignments, centroids };
}
function silhouetteScore(embeddings, assignments) {
  const n = embeddings.length;
  if (n < 2) return 0;
  let totalScore = 0;
  for (let i = 0; i < n; i++) {
    const clusterI = assignments[i];
    const sameCluster = embeddings.filter((_, j) => j !== i && assignments[j] === clusterI);
    if (sameCluster.length === 0) continue;
    const a = sameCluster.reduce((sum, v) => sum + cosineDistance(embeddings[i], v), 0) / sameCluster.length;
    const clusters = Array.from(new Set(assignments)).filter((c) => c !== clusterI);
    if (clusters.length === 0) continue;
    const b = Math.min(
      ...clusters.map((c) => {
        const otherCluster = embeddings.filter((_, j) => assignments[j] === c);
        if (otherCluster.length === 0) return Infinity;
        return otherCluster.reduce((sum, v) => sum + cosineDistance(embeddings[i], v), 0) / otherCluster.length;
      })
    );
    totalScore += (b - a) / Math.max(a, b);
  }
  return totalScore / n;
}
function selectOptimalK(embeddings, minK, maxK) {
  const effectiveMax = Math.min(maxK, Math.floor(embeddings.length / MIN_COMPANIES_PER_CLUSTER));
  const effectiveMin = Math.min(minK, effectiveMax);
  let bestK = effectiveMin;
  let bestScore = -Infinity;
  let bestResult = kMeansPlusPlus(embeddings, effectiveMin);
  for (let k = effectiveMin; k <= effectiveMax; k++) {
    let bestRunResult = kMeansPlusPlus(embeddings, k);
    let bestRunScore = silhouetteScore(embeddings, bestRunResult.assignments);
    for (let run = 1; run < 3; run++) {
      const result = kMeansPlusPlus(embeddings, k);
      const score = silhouetteScore(embeddings, result.assignments);
      if (score > bestRunScore) {
        bestRunScore = score;
        bestRunResult = result;
      }
    }
    console.log(`[Clustering] k=${k} silhouette=${bestRunScore.toFixed(4)}`);
    if (bestRunScore > bestScore) {
      bestScore = bestRunScore;
      bestK = k;
      bestResult = bestRunResult;
    }
  }
  console.log(`[Clustering] Optimal k=${bestK} (silhouette=${bestScore.toFixed(4)})`);
  return { k: bestK, ...bestResult };
}
async function nameCluster(companies2, clusterIndex) {
  const sampleNames = companies2.slice(0, 10).map((c) => {
    const meta = c.sliceMetadata ? (() => {
      try {
        return JSON.parse(c.sliceMetadata);
      } catch {
        return {};
      }
    })() : {};
    return `${c.name}${meta.industry ? ` (${meta.industry})` : ""}`;
  });
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a B2B market analyst. Given a list of companies that were grouped together by semantic similarity, identify the niche they represent."
      },
      {
        role: "user",
        content: `These companies were clustered together (cluster ${clusterIndex + 1}):
${sampleNames.join("\n")}

Return a JSON object with:
- name: a short 2-5 word niche label (e.g. "Industrial Automation Manufacturers")
- description: 2-3 sentences explaining what unites these companies and why they form a distinct niche
- topKeywords: array of 5-8 keywords that best describe this niche`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "niche_label",
        strict: true,
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            topKeywords: { type: "array", items: { type: "string" } }
          },
          required: ["name", "description", "topKeywords"],
          additionalProperties: false
        }
      }
    }
  });
  const content = typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content);
  try {
    return JSON.parse(content);
  } catch {
    return {
      name: `Cluster ${clusterIndex + 1}`,
      description: `A group of ${companies2.length} similar companies.`,
      topKeywords: []
    };
  }
}
async function clusterCompanies(companyEmbeddings, allCompanies, options) {
  if (companyEmbeddings.length < MIN_K * MIN_COMPANIES_PER_CLUSTER) {
    throw new Error(
      `Need at least ${MIN_K * MIN_COMPANIES_PER_CLUSTER} companies to cluster. Got ${companyEmbeddings.length}.`
    );
  }
  const seedSize = options?.seedSampleSize ?? SEED_SAMPLE_SIZE;
  const { sample } = stratifiedSample(companyEmbeddings, allCompanies, seedSize);
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));
  const embeddings = sample.map((e) => e.embedding);
  let resolvedK;
  if (options?.explicitK) {
    resolvedK = Math.max(MIN_K, Math.min(options.explicitK, Math.floor(embeddings.length / MIN_COMPANIES_PER_CLUSTER)));
  } else if (options?.targetGroupSize && options.targetGroupSize > 0) {
    resolvedK = Math.max(MIN_K, Math.ceil(sample.length / options.targetGroupSize));
    resolvedK = Math.min(resolvedK, Math.floor(embeddings.length / MIN_COMPANIES_PER_CLUSTER));
  }
  let k;
  let assignments;
  let centroids;
  if (resolvedK !== void 0) {
    console.log(`[Clustering] Phase 1: k-means++ on ${embeddings.length} seed companies (k=${resolvedK}, target-size-driven)`);
    const result = kMeansPlusPlus(embeddings, resolvedK);
    k = resolvedK;
    assignments = result.assignments;
    centroids = result.centroids;
  } else {
    console.log(`[Clustering] Phase 1: k-means++ on ${embeddings.length} seed companies (k=${MIN_K}\u2013${MAX_K}, auto silhouette)`);
    const result = selectOptimalK(embeddings, MIN_K, MAX_K);
    k = result.k;
    assignments = result.assignments;
    centroids = result.centroids;
  }
  const clusters = [];
  for (let c = 0; c < k; c++) {
    const clusterEmbeddings = sample.filter((_, i) => assignments[i] === c);
    const clusterCompanyIds = clusterEmbeddings.map((e) => e.companyId);
    const clusterCompanies2 = clusterCompanyIds.map((id) => companyMap.get(id)).filter((c2) => c2 !== void 0);
    if (clusterCompanies2.length < MIN_COMPANIES_PER_CLUSTER) {
      console.log(`[Clustering] Skipping cluster ${c} \u2014 only ${clusterCompanies2.length} companies (min ${MIN_COMPANIES_PER_CLUSTER})`);
      continue;
    }
    console.log(`[Clustering] Naming cluster ${c + 1}/${k} (${clusterCompanies2.length} companies)...`);
    const label = await nameCluster(clusterCompanies2, c);
    clusters.push({
      name: label.name,
      description: label.description,
      companyIds: clusterCompanyIds,
      sampleCompanies: clusterCompanies2.slice(0, 5).map((c2) => c2.name),
      topKeywords: label.topKeywords,
      centroid: centroids[c],
      clusterIndex: c
    });
  }
  console.log(`[Clustering] Phase 1 done: ${clusters.length} niches from ${sample.length} seed companies`);
  return clusters;
}
function assignToNearestCentroid(embedding, centroids) {
  let nearest = 0;
  let minDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = cosineDistance(embedding, centroids[i]);
    if (d < minDist) {
      minDist = d;
      nearest = i;
    }
  }
  return nearest;
}
async function assignRemainingByProximity(remainingEmbeddings, nicheCentroids, onProgress) {
  const assignments = /* @__PURE__ */ new Map();
  const centroids = nicheCentroids.map((n) => n.centroid);
  for (let i = 0; i < remainingEmbeddings.length; i++) {
    const ce = remainingEmbeddings[i];
    const clusterIdx = assignToNearestCentroid(ce.embedding, centroids);
    const nicheId = nicheCentroids[clusterIdx].nicheId;
    assignments.set(ce.companyId, nicheId);
    if (onProgress && (i + 1) % 100 === 0) {
      onProgress(i + 1, remainingEmbeddings.length);
    }
  }
  if (onProgress) onProgress(remainingEmbeddings.length, remainingEmbeddings.length);
  console.log(`[Clustering] Phase 2 done: ${assignments.size} companies assigned by proximity`);
  return assignments;
}
var DISCOVERY_SIMILARITY_THRESHOLD = 0.35;
var MIN_DISCOVERY_CLUSTER_SIZE = 9;
async function expandWithDiscovery(batchEmbeddings, allCompanies, nicheCentroids) {
  const assignments = /* @__PURE__ */ new Map();
  const poorFitEmbeddings = [];
  const centroids = nicheCentroids.map((n) => n.centroid);
  for (const ce of batchEmbeddings) {
    let bestSim = -Infinity;
    let bestIdx = 0;
    for (let i = 0; i < centroids.length; i++) {
      const sim = cosineSimilarity(ce.embedding, centroids[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestSim >= DISCOVERY_SIMILARITY_THRESHOLD) {
      assignments.set(ce.companyId, nicheCentroids[bestIdx].nicheId);
    } else {
      poorFitEmbeddings.push(ce);
      assignments.set(ce.companyId, nicheCentroids[bestIdx].nicheId);
    }
  }
  const newClusters = [];
  if (poorFitEmbeddings.length >= MIN_DISCOVERY_CLUSTER_SIZE) {
    console.log(
      `[Clustering] Expand: ${poorFitEmbeddings.length} poor-fit companies (sim < ${DISCOVERY_SIMILARITY_THRESHOLD}) \u2014 attempting new niche discovery`
    );
    try {
      const companyMap = new Map(allCompanies.map((c) => [c.id, c]));
      const poorFitCompanies = poorFitEmbeddings.map((ce) => companyMap.get(ce.companyId)).filter((c) => c !== void 0);
      const discoveredClusters = await clusterCompanies(poorFitEmbeddings, poorFitCompanies);
      for (const cluster of discoveredClusters) {
        newClusters.push(cluster);
        for (const companyId of cluster.companyIds) {
          assignments.set(companyId, -(cluster.clusterIndex + 1));
        }
      }
      console.log(`[Clustering] Expand: discovered ${discoveredClusters.length} new niches from poor-fit companies`);
    } catch (e) {
      console.warn("[Clustering] Expand: new niche discovery failed, falling back to proximity assignment:", e);
    }
  } else if (poorFitEmbeddings.length > 0) {
    console.log(
      `[Clustering] Expand: ${poorFitEmbeddings.length} poor-fit companies (below min ${MIN_DISCOVERY_CLUSTER_SIZE} for discovery) \u2014 assigned to nearest centroid`
    );
  }
  return { assignments, newClusters };
}

// server/companyTypeClassifier.ts
var MANUFACTURING_INDUSTRIES = /* @__PURE__ */ new Set([
  "electrical/electronic manufacturing",
  "food production",
  "building materials",
  "machinery",
  "medical devices",
  "glass, ceramics & concrete",
  "automotive",
  "semiconductors",
  "plastics",
  "textiles",
  "printing",
  "furniture",
  "mining & metals",
  "chemicals",
  "paper & forest products",
  "packaging & containers",
  "industrial automation",
  "mechanical or industrial engineering",
  "shipbuilding",
  "railroad manufacture",
  "renewables & environment",
  "oil & energy",
  "food & beverages",
  "dairy",
  "wine and spirits",
  "tobacco",
  "cosmetics",
  "sporting goods",
  "consumer goods",
  "consumer electronics",
  "computer hardware",
  "defense & space",
  "aviation & aerospace"
]);
var SERVICE_INDUSTRIES = /* @__PURE__ */ new Set([
  "information technology & services",
  "information services",
  "computer & network security",
  "computer software",
  "computer networking",
  "computer games",
  "internet",
  "wireless",
  "telecommunications",
  "management consulting",
  "outsourcing/offshoring",
  "logistics & supply chain",
  "hospital & health care",
  "medical practice",
  "health, wellness & fitness",
  "real estate",
  "construction",
  "civil engineering",
  "architecture & planning",
  "financial services",
  "banking",
  "insurance",
  "accounting",
  "legal services",
  "law practice",
  "staffing & recruiting",
  "human resources",
  "marketing & advertising",
  "public relations & communications",
  "media production",
  "broadcast media",
  "entertainment",
  "music",
  "performing arts",
  "education management",
  "higher education",
  "e-learning",
  "research",
  "think tanks",
  "government administration",
  "nonprofit organization management",
  "philanthropy",
  "religious institutions",
  "wholesale",
  "retail",
  "restaurants",
  "hospitality",
  "leisure, travel & tourism",
  "airlines/aviation",
  "transportation/trucking/railroad",
  "warehousing",
  "utilities",
  "environmental services",
  "events services",
  "design",
  "graphic design",
  "photography",
  "writing & editing",
  "translation & localization",
  "security & investigations",
  "facilities services",
  "professional training & coaching",
  "program development",
  "venture capital & private equity",
  "investment management",
  "capital markets",
  "import & export"
]);
function isMfgSicCode(sicCode) {
  const numeric = parseInt(sicCode.replace(/\D/g, ""), 10);
  if (isNaN(numeric)) return false;
  if (numeric >= 20 && numeric <= 39) return true;
  if (numeric >= 2e3 && numeric <= 3999) return true;
  return false;
}
function classifyCompanyType(company) {
  let industry = "";
  if (company.sliceMetadata) {
    try {
      const meta = JSON.parse(company.sliceMetadata);
      industry = (meta.industry || "").toLowerCase().trim();
    } catch {
    }
  }
  if (industry) {
    if (MANUFACTURING_INDUSTRIES.has(industry)) return "manufacturing";
    if (SERVICE_INDUSTRIES.has(industry)) return "service";
    const mfgTerms = ["manufactur", "production", "fabricat", "assembl", "machining", "foundry", "smelting", "refining", "processing"];
    for (const term of mfgTerms) {
      if (industry.includes(term)) return "manufacturing";
    }
  }
  if (company.sicCodes) {
    try {
      const codes = JSON.parse(company.sicCodes);
      const mfgCount = codes.filter(isMfgSicCode).length;
      if (mfgCount > codes.length / 2) return "manufacturing";
      if (mfgCount === 0 && codes.length > 0) return "service";
    } catch {
    }
  }
  return "service";
}
function splitByCompanyType(allCompanies) {
  const manufacturing = [];
  const service = [];
  for (const company of allCompanies) {
    const type = classifyCompanyType(company);
    if (type === "manufacturing") {
      manufacturing.push(company);
    } else {
      service.push(company);
    }
  }
  console.log(
    `[CompanyTypeClassifier] Split ${allCompanies.length} companies: ${manufacturing.length} manufacturing (${(manufacturing.length / allCompanies.length * 100).toFixed(1)}%), ${service.length} service (${(service.length / allCompanies.length * 100).toFixed(1)}%)`
  );
  return { manufacturing, service };
}

// server/nicheRouter.ts
init_schema();
init_db();
import { eq as eq4, inArray as inArray3 } from "drizzle-orm";
var nicheRouter = router({
  /**
   * Full pipeline: pre-split (Manufacturing vs Service) → generate embeddings → k-means clustering → save niches → score against Brain.
   * Forces a top-level split between manufacturing and service companies before
   * running independent k-means clustering within each group. This prevents
   * mixed niches where service and manufacturing companies are grouped together.
   * Called automatically after CSV import completes.
   */
  clusterAndSaveNiches: adminProcedure.input(
    z4.object({
      searchId: z4.number(),
      autoScore: z4.boolean().default(true),
      // score niches against active Brain after clustering
      targetGroupSize: z4.number().min(50).max(2e3).optional()
      // target companies per cluster (derives K)
    })
  ).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const allCompanies = await db.select().from(companies).where(eq4(companies.searchId, input.searchId));
    if (allCompanies.length < 9) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: `Need at least 9 companies to cluster. This search has ${allCompanies.length}.`
      });
    }
    console.log(`[nicheRouter] Starting clustering for search ${input.searchId}: ${allCompanies.length} companies`);
    await deleteNichesBySearchId(input.searchId);
    const { manufacturing, service } = splitByCompanyType(allCompanies);
    const companyIdSet = new Map(allCompanies.map((c) => [c.id, c]));
    const clusterAndPersistGroup = async (groupCompanies, groupLabel) => {
      if (groupCompanies.length < 9) {
        console.log(`[nicheRouter] ${groupLabel} group has only ${groupCompanies.length} companies \u2014 too few to cluster independently, will merge into other group`);
        return { clusters: [], nicheIds: [], seedCount: 0 };
      }
      console.log(`[nicheRouter] === ${groupLabel} group: ${groupCompanies.length} companies ===`);
      console.log(`[nicheRouter] [${groupLabel}] Generating embeddings...`);
      const groupEmbeddings = await generateEmbeddings(groupCompanies);
      console.log(`[nicheRouter] [${groupLabel}] Running k-means clustering (targetGroupSize=${input.targetGroupSize ?? "auto"})...`);
      const groupClusters = await clusterCompanies(groupEmbeddings, groupCompanies, {
        targetGroupSize: input.targetGroupSize
      });
      console.log(`[nicheRouter] [${groupLabel}] Saving ${groupClusters.length} niches...`);
      const groupNicheIds = [];
      const clusterIndexToNicheId = /* @__PURE__ */ new Map();
      for (const cluster of groupClusters) {
        const nicheName = `[${groupLabel}] ${cluster.name}`;
        const id = await createNiche({
          userId,
          searchId: input.searchId,
          brainId: null,
          name: nicheName,
          description: cluster.description,
          companyCount: cluster.companyIds.length,
          topKeywords: JSON.stringify(cluster.topKeywords),
          sampleCompanies: JSON.stringify(cluster.sampleCompanies),
          companyIds: JSON.stringify(cluster.companyIds),
          centroid: JSON.stringify(cluster.centroid),
          rationale: `${groupLabel} group \u2014 classified by industry/SIC before clustering.`
        });
        groupNicheIds.push(id);
        clusterIndexToNicheId.set(cluster.clusterIndex, id);
      }
      console.log(`[nicheRouter] [${groupLabel}] Assigning nicheId to seed companies...`);
      for (const cluster of groupClusters) {
        const nicheId = clusterIndexToNicheId.get(cluster.clusterIndex);
        if (!nicheId) continue;
        for (const companyId of cluster.companyIds) {
          await updateCompany(companyId, { nicheId });
        }
      }
      const seedCount = groupClusters.reduce((sum, c) => sum + c.companyIds.length, 0);
      return { clusters: groupClusters, nicheIds: groupNicheIds, seedCount };
    };
    let mfgResult = { clusters: [], nicheIds: [], seedCount: 0 };
    let svcResult = { clusters: [], nicheIds: [], seedCount: 0 };
    if (manufacturing.length < 9 && service.length < 9) {
      console.log(`[nicheRouter] Both groups too small for independent clustering \u2014 clustering all together`);
      const embeddings = await generateEmbeddings(allCompanies);
      const clusters = await clusterCompanies(embeddings, allCompanies, { targetGroupSize: input.targetGroupSize });
      const nicheIds = [];
      for (const cluster of clusters) {
        const id = await createNiche({
          userId,
          searchId: input.searchId,
          brainId: null,
          name: cluster.name,
          description: cluster.description,
          companyCount: cluster.companyIds.length,
          topKeywords: JSON.stringify(cluster.topKeywords),
          sampleCompanies: JSON.stringify(cluster.sampleCompanies),
          companyIds: JSON.stringify(cluster.companyIds),
          centroid: JSON.stringify(cluster.centroid),
          rationale: null
        });
        nicheIds.push(id);
        for (const companyId of cluster.companyIds) {
          await updateCompany(companyId, { nicheId: id });
        }
      }
      mfgResult = { clusters, nicheIds, seedCount: clusters.reduce((s, c) => s + c.companyIds.length, 0) };
    } else if (manufacturing.length < 9) {
      console.log(`[nicheRouter] Manufacturing group too small (${manufacturing.length}) \u2014 merging into Service group`);
      svcResult = await clusterAndPersistGroup([...service, ...manufacturing], "Service");
    } else if (service.length < 9) {
      console.log(`[nicheRouter] Service group too small (${service.length}) \u2014 merging into Manufacturing group`);
      mfgResult = await clusterAndPersistGroup([...manufacturing, ...service], "Manufacturing");
    } else {
      mfgResult = await clusterAndPersistGroup(manufacturing, "Manufacturing");
      svcResult = await clusterAndPersistGroup(service, "Service");
    }
    const allClusters = [...mfgResult.clusters, ...svcResult.clusters];
    const allNicheIds = [...mfgResult.nicheIds, ...svcResult.nicheIds];
    const totalSeedCount = mfgResult.seedCount + svcResult.seedCount;
    let scoredCount = 0;
    if (input.autoScore) {
      console.log(`[nicheRouter] Auto-scoring ${allNicheIds.length} niches against active Brain...`);
      const savedNiches = await getNichesBySearchId(input.searchId);
      for (const niche of savedNiches) {
        try {
          const clusterInput = {
            name: niche.name,
            description: niche.description,
            topKeywords: niche.topKeywords ? JSON.parse(niche.topKeywords) : [],
            sampleCompanies: niche.sampleCompanies ? JSON.parse(niche.sampleCompanies) : [],
            rationale: niche.rationale,
            companyCount: niche.companyCount
          };
          const result = await scoreNicheFit(clusterInput, userId);
          await updateNiche(niche.id, {
            fitScore: result.fitScore,
            fitReasoning: result.fitReasoning,
            scoreBreakdown: JSON.stringify(result.scoreBreakdown),
            scoredAt: /* @__PURE__ */ new Date(),
            scoredWithBrainId: result.brainId,
            brainId: result.brainId
          });
          scoredCount++;
        } catch (err) {
          console.error(`[nicheRouter] Failed to score niche ${niche.id}:`, err.message);
        }
      }
    }
    return {
      searchId: input.searchId,
      seedCount: totalSeedCount,
      totalCompanies: allCompanies.length,
      companiesProcessed: allCompanies.length,
      nichesCreated: allClusters.length,
      nichesScored: scoredCount,
      nicheIds: allNicheIds,
      preSplit: {
        manufacturing: manufacturing.length,
        service: service.length
      },
      clusters: allClusters.map((c) => ({
        name: c.name,
        description: c.description,
        companyCount: c.companyIds.length,
        sampleCompanies: c.sampleCompanies,
        topKeywords: c.topKeywords
      }))
    };
  }),
  /**
   * Create a niche cluster (manual entry or from import pipeline).
   * Returns the new niche ID.
   */
  create: adminProcedure.input(
    z4.object({
      searchId: z4.number().optional(),
      name: z4.string().min(1),
      description: z4.string().optional(),
      companyCount: z4.number().default(0),
      topKeywords: z4.array(z4.string()).optional(),
      sampleCompanies: z4.array(z4.string()).optional(),
      companyIds: z4.array(z4.number()).optional(),
      rationale: z4.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const id = await createNiche({
      userId,
      searchId: input.searchId ?? null,
      brainId: null,
      name: input.name,
      description: input.description ?? null,
      companyCount: input.companyCount,
      topKeywords: input.topKeywords ? JSON.stringify(input.topKeywords) : null,
      sampleCompanies: input.sampleCompanies ? JSON.stringify(input.sampleCompanies) : null,
      companyIds: input.companyIds ? JSON.stringify(input.companyIds) : null,
      rationale: input.rationale ?? null
    });
    return { id };
  }),
  /**
   * Batch score all niches for a given searchId against the active Offering Brain.
   * Skips niches that were already scored with the current brain version.
   */
  scoreNiches: adminProcedure.input(
    z4.object({
      searchId: z4.number(),
      force: z4.boolean().default(false)
      // force re-score even if already scored
    })
  ).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const allNiches = await getNichesBySearchId(input.searchId);
    if (allNiches.length === 0) {
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "No niches found for this search. Create niches first."
      });
    }
    const results = [];
    for (const niche of allNiches) {
      try {
        const clusterInput = {
          name: niche.name,
          description: niche.description,
          topKeywords: niche.topKeywords ? JSON.parse(niche.topKeywords) : [],
          sampleCompanies: niche.sampleCompanies ? JSON.parse(niche.sampleCompanies) : [],
          rationale: niche.rationale,
          companyCount: niche.companyCount
        };
        const result = await scoreNicheFit(clusterInput, userId);
        await updateNiche(niche.id, {
          fitScore: result.fitScore,
          fitReasoning: result.fitReasoning,
          scoreBreakdown: JSON.stringify(result.scoreBreakdown),
          scoredAt: /* @__PURE__ */ new Date(),
          scoredWithBrainId: result.brainId,
          brainId: result.brainId
        });
        results.push({
          nicheId: niche.id,
          nicheName: niche.name,
          fitScore: result.fitScore,
          dimensions: result.scoreBreakdown.length,
          status: "scored"
        });
      } catch (err) {
        console.error(`[nicheRouter] Failed to score niche ${niche.id}:`, err.message);
        results.push({
          nicheId: niche.id,
          nicheName: niche.name,
          fitScore: -1,
          dimensions: 0,
          status: "error",
          error: err.message
        });
      }
    }
    const scored = results.filter((r) => r.status === "scored").length;
    const failed = results.filter((r) => r.status === "error").length;
    return {
      total: allNiches.length,
      scored,
      failed,
      results
    };
  }),
  /**
   * Re-score a single niche against the active Offering Brain.
   */
  rescoreNiche: adminProcedure.input(z4.object({ nicheId: z4.number() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const niche = await getNicheById(input.nicheId);
    if (!niche || niche.userId !== userId) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Niche not found" });
    }
    const clusterInput = {
      name: niche.name,
      description: niche.description,
      topKeywords: niche.topKeywords ? JSON.parse(niche.topKeywords) : [],
      sampleCompanies: niche.sampleCompanies ? JSON.parse(niche.sampleCompanies) : [],
      rationale: niche.rationale,
      companyCount: niche.companyCount
    };
    const result = await scoreNicheFit(clusterInput, userId);
    await updateNiche(niche.id, {
      fitScore: result.fitScore,
      fitReasoning: result.fitReasoning,
      scoreBreakdown: JSON.stringify(result.scoreBreakdown),
      scoredAt: /* @__PURE__ */ new Date(),
      scoredWithBrainId: result.brainId,
      brainId: result.brainId
    });
    return {
      nicheId: niche.id,
      fitScore: result.fitScore,
      fitReasoning: result.fitReasoning,
      scoreBreakdown: result.scoreBreakdown,
      brainName: result.brainName,
      scoredAt: result.scoredAt
    };
  }),
  /**
   * Get all niches for a search, sorted by fitScore descending.
   * Parses JSON fields for the frontend.
   */
  getNiches: protectedProcedure.input(z4.object({ searchId: z4.number() })).query(async ({ ctx, input }) => {
    const niches2 = await getNichesBySearchId(input.searchId);
    return niches2.map(parseNicheFields);
  }),
  /**
   * Get all niches for the current user (across all searches).
   */
  getAllNiches: protectedProcedure.query(async ({ ctx }) => {
    const niches2 = await getNichesByUserId(ctx.user.id);
    return niches2.map(parseNicheFields);
  }),
  /**
   * Delete all niches for a search (e.g. before re-clustering).
   */
  deleteBySearch: adminProcedure.input(z4.object({ searchId: z4.number() })).mutation(async ({ ctx, input }) => {
    const niches2 = await getNichesBySearchId(input.searchId);
    if (niches2.length > 0 && niches2[0].userId !== ctx.user.id) {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Not your niches" });
    }
    await deleteNichesBySearchId(input.searchId);
    return { deleted: niches2.length };
  }),
  /**
   * Count how many companies in a search have not yet been assigned to a niche.
   * Used by the UI to show the "Assign Remaining (N)" button.
   */
  getUnassignedCount: protectedProcedure.input(z4.object({ searchId: z4.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { unassigned: 0, total: 0 };
    const allCompanies = await db.select({ id: companies.id, nicheId: companies.nicheId }).from(companies).where(eq4(companies.searchId, input.searchId));
    const total = allCompanies.length;
    const unassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === void 0).length;
    return { unassigned, total, assigned: total - unassigned };
  }),
  /**
   * Phase 2: Assign remaining unassigned companies to the nearest niche centroid.
   * Requires Phase 1 (clusterAndSaveNiches) to have been run first.
   *
   * Steps:
   *   1. Load all niches for this search (to get centroids)
   *   2. Load all companies without a nicheId
   *   3. Generate embeddings for unassigned companies
   *   4. Assign each to nearest centroid by cosine similarity
   *   5. Update companies.nicheId and niches.companyCount
   */
  assignRemainingCompanies: adminProcedure.input(z4.object({ searchId: z4.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const savedNiches = await getNichesBySearchId(input.searchId);
    if (savedNiches.length === 0) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "No niches found. Run Phase 1 clustering first."
      });
    }
    const mfgCentroids = savedNiches.filter((n) => n.centroid && n.name.startsWith("[Manufacturing]")).map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid) }));
    const svcCentroids = savedNiches.filter((n) => n.centroid && n.name.startsWith("[Service]")).map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid) }));
    const untaggedCentroids = savedNiches.filter((n) => n.centroid && !n.name.startsWith("[Manufacturing]") && !n.name.startsWith("[Service]")).map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid) }));
    const allCentroids = [...mfgCentroids, ...svcCentroids, ...untaggedCentroids];
    if (allCentroids.length === 0) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "Niches have no centroid data. Re-run Phase 1 clustering."
      });
    }
    const hasTypeSplit = mfgCentroids.length > 0 && svcCentroids.length > 0;
    const allCompanies = await db.select().from(companies).where(eq4(companies.searchId, input.searchId));
    const unassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === void 0);
    if (unassigned.length === 0) {
      return { assigned: 0, message: "All companies are already assigned to niches." };
    }
    console.log(`[nicheRouter] Phase 2: Assigning ${unassigned.length} unassigned companies to ${allCentroids.length} niches (type-split: ${hasTypeSplit})`);
    let assigned = 0;
    if (hasTypeSplit) {
      const { manufacturing: mfgCompanies, service: svcCompanies } = splitByCompanyType(unassigned);
      if (mfgCompanies.length > 0 && mfgCentroids.length > 0) {
        const mfgEmbeddings = await generateEmbeddings(mfgCompanies);
        const mfgAssignments = await assignRemainingByProximity(mfgEmbeddings, mfgCentroids);
        for (const [companyId, nicheId] of Array.from(mfgAssignments)) {
          await updateCompany(companyId, { nicheId });
          assigned++;
        }
      } else if (mfgCompanies.length > 0) {
        const mfgEmbeddings = await generateEmbeddings(mfgCompanies);
        const mfgAssignments = await assignRemainingByProximity(mfgEmbeddings, allCentroids);
        for (const [companyId, nicheId] of Array.from(mfgAssignments)) {
          await updateCompany(companyId, { nicheId });
          assigned++;
        }
      }
      if (svcCompanies.length > 0 && svcCentroids.length > 0) {
        const svcEmbeddings = await generateEmbeddings(svcCompanies);
        const svcAssignments = await assignRemainingByProximity(svcEmbeddings, svcCentroids);
        for (const [companyId, nicheId] of Array.from(svcAssignments)) {
          await updateCompany(companyId, { nicheId });
          assigned++;
        }
      } else if (svcCompanies.length > 0) {
        const svcEmbeddings = await generateEmbeddings(svcCompanies);
        const svcAssignments = await assignRemainingByProximity(svcEmbeddings, allCentroids);
        for (const [companyId, nicheId] of Array.from(svcAssignments)) {
          await updateCompany(companyId, { nicheId });
          assigned++;
        }
      }
    } else {
      const embeddings = await generateEmbeddings(unassigned);
      const assignments = await assignRemainingByProximity(embeddings, allCentroids);
      for (const [companyId, nicheId] of Array.from(assignments)) {
        await updateCompany(companyId, { nicheId });
        assigned++;
      }
    }
    const updatedCompanies = await db.select().from(companies).where(eq4(companies.searchId, input.searchId));
    const nicheCounts = /* @__PURE__ */ new Map();
    for (const company of updatedCompanies) {
      if (company.nicheId) nicheCounts.set(company.nicheId, (nicheCounts.get(company.nicheId) ?? 0) + 1);
    }
    for (const [nicheId, count2] of Array.from(nicheCounts)) {
      await updateNiche(nicheId, { companyCount: count2 });
    }
    console.log(`[nicheRouter] Phase 2 done: ${assigned} companies assigned`);
    return {
      assigned,
      total: allCompanies.length,
      nichesUpdated: nicheCounts.size,
      message: `Assigned ${assigned} companies to ${nicheCounts.size} niches.`
    };
  }),
  /**
   * Expand Sample: take the next N unassigned companies, embed them, and assign
   * each to the nearest existing centroid. This refines cluster membership without
   * re-running full k-means — useful for iterative exploration of large datasets.
   *
   * Unlike assignRemainingCompanies (which processes ALL unassigned), this processes
   * only a batch of EXPAND_BATCH_SIZE at a time so the user can inspect results
   * incrementally.
   */
  expandClusterSample: adminProcedure.input(
    z4.object({
      searchId: z4.number(),
      batchSize: z4.number().min(1).max(2e3).default(500)
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const savedNiches = await getNichesBySearchId(input.searchId);
    if (savedNiches.length === 0) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "No niches found. Run Phase 1 clustering first."
      });
    }
    const mfgCentroids = savedNiches.filter((n) => n.centroid && n.name.startsWith("[Manufacturing]")).map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid) }));
    const svcCentroids = savedNiches.filter((n) => n.centroid && n.name.startsWith("[Service]")).map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid) }));
    const untaggedCentroids = savedNiches.filter((n) => n.centroid && !n.name.startsWith("[Manufacturing]") && !n.name.startsWith("[Service]")).map((n) => ({ nicheId: n.id, centroid: JSON.parse(n.centroid) }));
    const nicheCentroids = [...mfgCentroids, ...svcCentroids, ...untaggedCentroids];
    if (nicheCentroids.length === 0) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "Niches have no centroid data. Re-run Phase 1 clustering."
      });
    }
    const hasTypeSplit = mfgCentroids.length > 0 && svcCentroids.length > 0;
    const allCompanies = await db.select().from(companies).where(eq4(companies.searchId, input.searchId));
    const unassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === void 0).slice(0, input.batchSize);
    if (unassigned.length === 0) {
      return {
        assigned: 0,
        remaining: 0,
        message: "All companies are already assigned to niches."
      };
    }
    const totalUnassigned = allCompanies.filter((c) => c.nicheId === null || c.nicheId === void 0).length;
    console.log(`[nicheRouter] Expand Sample: assigning ${unassigned.length} of ${totalUnassigned} unassigned companies (type-split: ${hasTypeSplit})`);
    let rawAssignments = /* @__PURE__ */ new Map();
    let newClusters = [];
    if (hasTypeSplit) {
      const { manufacturing: mfgBatch, service: svcBatch } = splitByCompanyType(unassigned);
      if (mfgBatch.length > 0 && mfgCentroids.length > 0) {
        const mfgEmb = await generateEmbeddings(mfgBatch);
        const mfgResult = await expandWithDiscovery(mfgEmb, allCompanies, mfgCentroids);
        for (const [k, v] of Array.from(mfgResult.assignments)) rawAssignments.set(k, v);
        newClusters.push(...mfgResult.newClusters);
      } else if (mfgBatch.length > 0) {
        const mfgEmb = await generateEmbeddings(mfgBatch);
        const mfgResult = await expandWithDiscovery(mfgEmb, allCompanies, nicheCentroids);
        for (const [k, v] of Array.from(mfgResult.assignments)) rawAssignments.set(k, v);
        newClusters.push(...mfgResult.newClusters);
      }
      if (svcBatch.length > 0 && svcCentroids.length > 0) {
        const svcEmb = await generateEmbeddings(svcBatch);
        const svcResult = await expandWithDiscovery(svcEmb, allCompanies, svcCentroids);
        for (const [k, v] of Array.from(svcResult.assignments)) rawAssignments.set(k, v);
        newClusters.push(...svcResult.newClusters);
      } else if (svcBatch.length > 0) {
        const svcEmb = await generateEmbeddings(svcBatch);
        const svcResult = await expandWithDiscovery(svcEmb, allCompanies, nicheCentroids);
        for (const [k, v] of Array.from(svcResult.assignments)) rawAssignments.set(k, v);
        newClusters.push(...svcResult.newClusters);
      }
    } else {
      const embeddings = await generateEmbeddings(unassigned);
      const result = await expandWithDiscovery(embeddings, allCompanies, nicheCentroids);
      rawAssignments = result.assignments;
      newClusters = result.newClusters;
    }
    const newClusterToNicheId = /* @__PURE__ */ new Map();
    for (const cluster of newClusters) {
      const newNicheId = await createNiche({
        userId: ctx.user.id,
        searchId: input.searchId,
        brainId: null,
        parentNicheId: null,
        name: cluster.name,
        description: cluster.description,
        companyCount: cluster.companyIds.length,
        topKeywords: JSON.stringify(cluster.topKeywords),
        sampleCompanies: JSON.stringify(cluster.sampleCompanies),
        companyIds: JSON.stringify(cluster.companyIds),
        centroid: JSON.stringify(cluster.centroid),
        rationale: null
      });
      newClusterToNicheId.set(-(cluster.clusterIndex + 1), newNicheId);
    }
    let assigned = 0;
    for (const [companyId, nicheIdOrSentinel] of Array.from(rawAssignments)) {
      const resolvedNicheId = nicheIdOrSentinel < 0 ? newClusterToNicheId.get(nicheIdOrSentinel) ?? null : nicheIdOrSentinel;
      if (resolvedNicheId !== null) {
        await updateCompany(companyId, { nicheId: resolvedNicheId });
        assigned++;
      }
    }
    const nicheCounts = /* @__PURE__ */ new Map();
    const updatedAllCompanies = await db.select().from(companies).where(eq4(companies.searchId, input.searchId));
    for (const company of updatedAllCompanies) {
      if (company.nicheId) nicheCounts.set(company.nicheId, (nicheCounts.get(company.nicheId) ?? 0) + 1);
    }
    for (const [nicheId, count2] of Array.from(nicheCounts)) {
      await updateNiche(nicheId, { companyCount: count2 });
    }
    const remainingAfter = totalUnassigned - assigned;
    console.log(`[nicheRouter] Expand Sample done: ${assigned} assigned, ${newClusters.length} new niches, ${remainingAfter} still unassigned`);
    const newNichesMsg = newClusters.length > 0 ? ` Discovered ${newClusters.length} new segment${newClusters.length > 1 ? "s" : ""}: ${newClusters.map((c) => c.name).join(", ")}.` : "";
    return {
      assigned,
      remaining: remainingAfter,
      newNichesCreated: newClusters.length,
      newNicheNames: newClusters.map((c) => c.name),
      nichesUpdated: nicheCounts.size,
      message: `Assigned ${assigned} more companies.${newNichesMsg} ${remainingAfter.toLocaleString()} still unassigned.`
    };
  }),
  /**
   * Sub-cluster a top-level segment into child niches.
   * Scoped to only the companies already assigned to the given parentNicheId.
   * Deletes any existing child niches for this parent before re-running.
   */
  subClusterNiche: adminProcedure.input(
    z4.object({
      parentNicheId: z4.number(),
      autoScore: z4.boolean().default(true),
      targetGroupSize: z4.number().min(50).max(2e3).optional()
      // target companies per sub-cluster (derives K)
    })
  ).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const parentNiche = await getNicheById(input.parentNicheId);
    if (!parentNiche) throw new TRPCError4({ code: "NOT_FOUND", message: "Parent segment not found" });
    if (parentNiche.userId !== userId) throw new TRPCError4({ code: "FORBIDDEN", message: "Not your segment" });
    const allCompanies = await db.select().from(companies).where(eq4(companies.nicheId, input.parentNicheId));
    if (allCompanies.length < 9) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: `Need at least 9 companies in this segment to sub-cluster. This segment has ${allCompanies.length}.`
      });
    }
    console.log(`[nicheRouter] Sub-clustering segment "${parentNiche.name}" (${allCompanies.length} companies)`);
    await deleteNichesByParentId(input.parentNicheId);
    const embeddings = await generateEmbeddings(allCompanies);
    const clusters = await clusterCompanies(embeddings, allCompanies, {
      targetGroupSize: input.targetGroupSize ?? 300,
      seedSampleSize: allCompanies.length
      // use ALL assigned companies, not just 500
    });
    const childNicheIds = [];
    const clusterIndexToNicheId = /* @__PURE__ */ new Map();
    for (const cluster of clusters) {
      const id = await createNiche({
        userId,
        searchId: parentNiche.searchId,
        brainId: null,
        parentNicheId: input.parentNicheId,
        name: cluster.name,
        description: cluster.description,
        companyCount: cluster.companyIds.length,
        topKeywords: JSON.stringify(cluster.topKeywords),
        sampleCompanies: JSON.stringify(cluster.sampleCompanies),
        companyIds: JSON.stringify(cluster.companyIds),
        centroid: JSON.stringify(cluster.centroid),
        rationale: null
      });
      childNicheIds.push(id);
      clusterIndexToNicheId.set(cluster.clusterIndex, id);
    }
    for (const cluster of clusters) {
      const childNicheId = clusterIndexToNicheId.get(cluster.clusterIndex);
      if (!childNicheId) continue;
      for (const companyId of cluster.companyIds) {
        await updateCompany(companyId, { nicheId: childNicheId });
      }
    }
    let scoredCount = 0;
    if (input.autoScore && parentNiche.searchId) {
      const { getActiveBrain: getActiveBrain2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const brain = await getActiveBrain2(userId);
      if (brain) {
        for (const childId of childNicheIds) {
          try {
            const childNiche = await getNicheById(childId);
            if (!childNiche) continue;
            const nicheInput = {
              name: childNiche.name,
              description: childNiche.description ?? "",
              sampleCompanies: childNiche.sampleCompanies ? JSON.parse(childNiche.sampleCompanies) : [],
              topKeywords: childNiche.topKeywords ? JSON.parse(childNiche.topKeywords) : [],
              companyCount: childNiche.companyCount
            };
            const score = await scoreNicheFit(nicheInput, userId);
            await updateNiche(childId, {
              fitScore: score.fitScore,
              fitReasoning: score.fitReasoning,
              scoreBreakdown: JSON.stringify(score.scoreBreakdown),
              scoredAt: /* @__PURE__ */ new Date(),
              scoredWithBrainId: brain.id
            });
            scoredCount++;
          } catch (e) {
            console.warn(`[nicheRouter] Sub-cluster auto-score failed for niche ${childId}:`, e);
          }
        }
      }
    }
    console.log(`[nicheRouter] Sub-cluster done: ${clusters.length} child niches from ${allCompanies.length} companies`);
    return {
      parentNicheId: input.parentNicheId,
      parentNicheName: parentNiche.name,
      companiesProcessed: allCompanies.length,
      childNichesCreated: clusters.length,
      childNichesScored: scoredCount,
      childNicheIds,
      clusters: clusters.map((c) => ({
        name: c.name,
        description: c.description,
        companyCount: c.companyIds.length,
        sampleCompanies: c.sampleCompanies,
        topKeywords: c.topKeywords
      }))
    };
  }),
  /**
   * Get child niches for a given parent niche ID.
   */
  getChildNiches: protectedProcedure.input(z4.object({ parentNicheId: z4.number() })).query(async ({ ctx, input }) => {
    const children = await getNichesByParentId(input.parentNicheId);
    return children.map(parseNicheFields);
  }),
  /**
   * Create a scoped Import Campaign from a niche cluster.
   * Copies all companies assigned to the niche into a new search record,
   * preserving all enrichment data so the full pipeline can run on the subset.
   * Only allowed when fitScore >= 40 (Moderate Fit or better).
   */
  createCampaignFromNiche: adminProcedure.input(
    z4.object({
      nicheId: z4.number()
    })
  ).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const niche = await getNicheById(input.nicheId);
    if (!niche) throw new TRPCError4({ code: "NOT_FOUND", message: "Niche not found" });
    if (niche.userId !== userId) throw new TRPCError4({ code: "FORBIDDEN", message: "Not your niche" });
    if ((niche.fitScore ?? 0) < 40) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: `Fit score must be \u2265 40 (Moderate Fit) to create a campaign. This niche scored ${niche.fitScore ?? 0}.`
      });
    }
    const parentSearch = niche.searchId ? await getSearchById(niche.searchId) : null;
    const campaignName = `[Niche] ${niche.name}`;
    const newSearchId = await createSearch({
      userId,
      companyWebsite: parentSearch?.companyWebsite ?? "",
      location: parentSearch?.location ?? "",
      offeringName: campaignName,
      offeringDescription: niche.description ?? parentSearch?.offeringDescription ?? null,
      targetMarket: parentSearch?.targetMarket ?? null,
      valueProposition: parentSearch?.valueProposition ?? null,
      keywords: parentSearch?.keywords ?? null,
      status: "completed"
    });
    let nicheCompanies = await db.select().from(companies).where(eq4(companies.nicheId, input.nicheId));
    if (nicheCompanies.length === 0 && niche.companyIds) {
      let ids = [];
      try {
        ids = JSON.parse(niche.companyIds);
      } catch {
      }
      if (ids.length > 0) {
        const CHUNK = 1e3;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const rows = await db.select().from(companies).where(inArray3(companies.id, chunk));
          nicheCompanies = nicheCompanies.concat(rows);
        }
      }
    }
    if (nicheCompanies.length === 0) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: `No companies found for niche "${niche.name}". The niche has ${niche.companyCount} companies recorded but none could be loaded. Please re-run clustering for this search.`
      });
    }
    const BATCH_SIZE2 = 100;
    let copied = 0;
    try {
      for (let i = 0; i < nicheCompanies.length; i += BATCH_SIZE2) {
        const batch = nicheCompanies.slice(i, i + BATCH_SIZE2).map((c) => {
          const { id, searchId, ...rest } = c;
          return {
            ...rest,
            searchId: newSearchId,
            nicheId: input.nicheId
            // keep niche reference on copied companies
          };
        });
        await createCompanies(batch);
        copied += batch.length;
      }
    } catch (copyErr) {
      try {
        await db.delete(searches).where(eq4(searches.id, newSearchId));
      } catch {
      }
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to copy companies into campaign: ${copyErr.message}`
      });
    }
    if (copied === 0) {
      try {
        await db.delete(searches).where(eq4(searches.id, newSearchId));
      } catch {
      }
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: `Campaign creation failed: 0 companies were copied. Please try again.`
      });
    }
    const db2 = await getDb();
    if (db2) {
      await db2.update(searches).set({ sourceNicheId: input.nicheId, sharedWithTeam: 1 }).where(eq4(searches.id, newSearchId));
    }
    console.log(`[nicheRouter] Created campaign "${campaignName}" (searchId=${newSearchId}) with ${copied} companies from niche ${input.nicheId}`);
    return {
      searchId: newSearchId,
      campaignName,
      companiesCopied: copied,
      nicheId: input.nicheId
    };
  }),
  /**
   * Get companies assigned to a specific niche (paginated).
   * Available to all logged-in users (read-only).
   */
  getCompaniesByNiche: protectedProcedure.input(
    z4.object({
      nicheId: z4.number(),
      limit: z4.number().min(1).max(500).default(200),
      offset: z4.number().min(0).default(0)
    })
  ).query(async ({ input }) => {
    const [items, total] = await Promise.all([
      getCompaniesByNicheId(input.nicheId, input.limit, input.offset),
      countCompaniesByNicheId(input.nicheId)
    ]);
    return { items, total };
  }),
  // Rename a niche in-place
  renameNiche: protectedProcedure.input(z4.object({ nicheId: z4.number(), name: z4.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
    await updateNiche(input.nicheId, { name: input.name });
    return { success: true };
  })
});
function parseNicheFields(niche) {
  return {
    ...niche,
    topKeywords: niche.topKeywords ? tryParse(niche.topKeywords, []) : [],
    sampleCompanies: niche.sampleCompanies ? tryParse(niche.sampleCompanies, []) : [],
    companyIds: niche.companyIds ? tryParse(niche.companyIds, []) : [],
    scoreBreakdown: niche.scoreBreakdown ? tryParse(niche.scoreBreakdown, []) : []
  };
}
function tryParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// server/prototypeRouter.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";

// server/storage.ts
init_env();
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

// server/prototypeService.ts
init_llm();
init_db();
init_schema();
import { eq as eq5, desc as desc2 } from "drizzle-orm";
async function extractProductFromImages(imageUrls, productUrl, brainContext) {
  console.log(`[Prototype] Analyzing ${imageUrls.length} image(s)...`);
  const content = [];
  for (const url of imageUrls) {
    content.push({
      type: "image_url",
      image_url: { url, detail: "high" }
    });
  }
  const urlContext = productUrl ? `
Product URL for additional context: ${productUrl}` : "";
  const roleContext = brainContext ? `You are a technical engineer at ${brainContext.companyName}, which provides: ${brainContext.offering}. Core capabilities: ${brainContext.capabilities.join(", ")}. A potential customer has sent you pictures of a product they want manufactured or a competing product.` : `You are a technical engineer at a contract manufacturer. A potential customer has sent you pictures of a competing product or a product they want manufactured.`;
  content.push({
    type: "text",
    text: `${roleContext}${urlContext}

Analyze the product image(s) and extract:

1. **Product Type Guess**: A single sentence describing what this product is (e.g., "Lithium battery module with integrated BMS", "Industrial IoT gateway with cellular connectivity", "LED driver module for commercial lighting").

2. **Key Feature Guess**: A list of observable technical features. Be specific about:
   - Component types visible (PCBs, connectors, cables, enclosures, displays, etc.)
   - Materials (aluminum, PC/ABS, steel, etc.)
   - Communication interfaces visible (Bluetooth, CAN, LIN, Ethernet, WiFi, etc.)
   - Power specifications if visible on labels
   - Certifications visible on labels (CE, UL, FCC, etc.)
   - Form factor and approximate dimensions
   - Any brand/model information visible

3. **What We Still Need**: The essential questions we must ask the customer before we can start quoting. Focus ONLY on:
   - Target annual units (EAU)
   - Expected Start of Production (SOP)
   - Target region (EU / US / APAC)
   - Whether they want a 1:1 equivalent or a modified design
   - Whether they have a BOM, technical drawings, or additional pictures
   - Any specific certifications or compliance requirements
   - Target cost or budget range

Return JSON only:
{
  "productTypeGuess": "single sentence",
  "keyFeatureGuess": ["feature 1", "feature 2", ...],
  "whatWeStillNeed": ["question 1", "question 2", ...]
}`
  });
  const response = await invokeLLM({
    messages: [
      { role: "user", content }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "product_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            productTypeGuess: { type: "string", description: "Single sentence product type description" },
            keyFeatureGuess: {
              type: "array",
              items: { type: "string" },
              description: "List of observed technical features"
            },
            whatWeStillNeed: {
              type: "array",
              items: { type: "string" },
              description: "Essential questions before quoting"
            }
          },
          required: ["productTypeGuess", "keyFeatureGuess", "whatWeStillNeed"],
          additionalProperties: false
        }
      }
    }
  });
  const text2 = response.choices[0]?.message?.content;
  if (!text2 || typeof text2 !== "string") {
    throw new Error("LLM returned empty response for product extraction");
  }
  const parsed = JSON.parse(text2);
  console.log(`[Prototype] Extracted: ${parsed.productTypeGuess}`);
  console.log(`[Prototype] Features: ${parsed.keyFeatureGuess.length}, Questions: ${parsed.whatWeStillNeed.length}`);
  return parsed;
}
async function createPrototypeRequest(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(prototypeRequests).values(data);
  return result[0].insertId;
}
async function getPrototypeRequestById(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(prototypeRequests).where(eq5(prototypeRequests.id, id)).limit(1);
  return rows[0] ?? null;
}
async function getPrototypeRequestsByUser(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(prototypeRequests).where(eq5(prototypeRequests.userId, userId)).orderBy(desc2(prototypeRequests.createdAt));
}
async function getAllPrototypeRequests() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(prototypeRequests).orderBy(desc2(prototypeRequests.createdAt));
}
async function updatePrototypeRequest(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(prototypeRequests).set(data).where(eq5(prototypeRequests.id, id));
}

// server/prototypeRouter.ts
init_db();
function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}
async function fetchImageAsDataUri(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12e3);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Mimic a real browser request so CDNs don't block us
          "User-Agent": "Mozilla/5.0 (compatible; BOMAnalyser/1.0)",
          "Accept": "image/*,*/*;q=0.8"
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      console.warn(`[BOM] Image fetch failed (${response.status}): ${url}`);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      console.warn(`[BOM] Non-image content-type "${contentType}" for: ${url}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType.split(";")[0].trim()};base64,${base64}`;
  } catch (err) {
    console.warn(`[BOM] Image fetch error for ${url}: ${err.message}`);
    return null;
  }
}
var prototypeRouter = router({
  /**
   * Step 1: Upload images (base64) → store in S3 → return URLs
   */
  uploadImages: protectedProcedure.input(z5.object({
    images: z5.array(z5.object({
      base64: z5.string().min(1),
      filename: z5.string().min(1),
      mimeType: z5.string().min(1)
    })).min(1).max(3)
  })).mutation(async ({ ctx, input }) => {
    const imageUrls = [];
    for (const img of input.images) {
      const buffer = Buffer.from(img.base64, "base64");
      const key = `prototype/${ctx.user.id}/${Date.now()}-${randomSuffix()}-${img.filename}`;
      const { url } = await storagePut(key, buffer, img.mimeType);
      imageUrls.push(url);
    }
    return { imageUrls };
  }),
  /**
   * Step 2: Analyze images with LLM vision → extract product intelligence
   */
  analyzeImages: protectedProcedure.input(z5.object({
    imageUrls: z5.array(z5.string().url()).min(1).max(3),
    productUrl: z5.string().optional()
  })).mutation(async ({ input }) => {
    const extraction = await extractProductFromImages(input.imageUrls, input.productUrl);
    return extraction;
  }),
  /**
   * Step 3: Create a prototype request with extraction + customer info
   */
  createRequest: protectedProcedure.input(z5.object({
    imageUrls: z5.array(z5.string()).min(1),
    productUrl: z5.string().optional(),
    productTypeGuess: z5.string(),
    keyFeatureGuess: z5.array(z5.string()),
    whatWeStillNeed: z5.array(z5.string()),
    extractionRaw: z5.string().optional(),
    // Customer info
    annualUnits: z5.string().optional(),
    expectedSop: z5.string().optional(),
    region: z5.enum(["EU", "US", "APAC", "Other"]).optional(),
    designIntent: z5.enum(["equivalent", "modified"]).optional(),
    hasBom: z5.boolean().optional(),
    customerNotes: z5.string().optional(),
    customerName: z5.string().optional(),
    customerEmail: z5.string().optional(),
    customerCompany: z5.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const id = await createPrototypeRequest({
      userId: ctx.user.id,
      imageUrls: JSON.stringify(input.imageUrls),
      productUrl: input.productUrl ?? null,
      productTypeGuess: input.productTypeGuess,
      keyFeatureGuess: JSON.stringify(input.keyFeatureGuess),
      whatWeStillNeed: JSON.stringify(input.whatWeStillNeed),
      extractionRaw: input.extractionRaw ?? null,
      annualUnits: input.annualUnits ?? null,
      expectedSop: input.expectedSop ?? null,
      region: input.region ?? null,
      designIntent: input.designIntent ?? null,
      hasBom: input.hasBom ? 1 : 0,
      customerNotes: input.customerNotes ?? null,
      customerName: input.customerName ?? null,
      customerEmail: input.customerEmail ?? null,
      customerCompany: input.customerCompany ?? null,
      status: "submitted"
    });
    return { id, message: "Thanks \u2014 we're analyzing your pictures. We'll contact you for the next steps." };
  }),
  /**
   * Get a single prototype request by ID
   */
  getById: protectedProcedure.input(z5.object({ id: z5.number() })).query(async ({ input }) => {
    const request = await getPrototypeRequestById(input.id);
    if (!request) throw new TRPCError5({ code: "NOT_FOUND", message: "Prototype request not found" });
    return request;
  }),
  /**
   * List all prototype requests for the current user
   */
  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return getPrototypeRequestsByUser(ctx.user.id);
  }),
  /**
   * List ALL prototype requests (internal/admin view)
   */
  allRequests: protectedProcedure.query(async () => {
    return getAllPrototypeRequests();
  }),
  /**
   * Internal: Update request status (Request more info / Ask for sample / Start costing)
   */
  updateStatus: protectedProcedure.input(z5.object({
    id: z5.number(),
    status: z5.enum(["more_info_requested", "sample_requested", "costing", "completed"]),
    internalNotes: z5.string().optional(),
    assignedTo: z5.string().optional()
  })).mutation(async ({ input }) => {
    await updatePrototypeRequest(input.id, {
      status: input.status,
      internalNotes: input.internalNotes ?? void 0,
      assignedTo: input.assignedTo ?? void 0
    });
    return { success: true };
  }),
  /**
   * Extract BOM components from product images — used on Company Detail page
   * Returns estimated components with rough unit cost guesses for the BOM calculator.
   * Results are AI estimates only — not quotes.
   */
  extractBomFromImages: protectedProcedure.input(z5.object({
    imageUrls: z5.array(z5.string()).min(1).max(6),
    productContext: z5.string().optional()
    // e.g. company name + product type hint
  })).mutation(async ({ input }) => {
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const dataUris = await Promise.all(
      input.imageUrls.slice(0, 6).map((url) => fetchImageAsDataUri(url))
    );
    const validDataUris = dataUris.filter((d) => d !== null);
    if (validDataUris.length === 0) {
      throw new TRPCError5({
        code: "BAD_REQUEST",
        message: "Could not load any of the selected images. The image URLs may have expired or be blocked. Please try refreshing the product images and selecting again."
      });
    }
    const imageContent = validDataUris.map((dataUri) => ({
      type: "image_url",
      image_url: { url: dataUri, detail: "low" }
    }));
    const response = await invokeLLM2({
      messages: [
        {
          role: "system",
          content: "You are an experienced electronics and mechanical engineering cost estimator. Analyse the product images and return a rough Bill of Materials (BOM) with estimated unit costs in EUR. Focus on main components visible or inferable from the product. Be honest about uncertainty \u2014 these are rough estimates only, not quotes. Return ONLY valid JSON matching the schema."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyse these product images${input.productContext ? ` for: ${input.productContext}` : ""}. Return a JSON object with: { productSummary: string, components: Array<{ component: string, qty: number, unitCostEur: number, confidence: 'high'|'medium'|'low', notes: string }> }. Include 5-15 main components. unitCostEur should be a realistic market price estimate per unit.`
            },
            ...imageContent
          ]
        }
      ],
      response_format: { type: "json_object" }
    });
    const raw = response.choices?.[0]?.message?.content ?? "{}";
    let parsed = {};
    try {
      const text2 = typeof raw === "string" ? raw : JSON.stringify(raw);
      const cleaned = text2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { productSummary: "Unable to parse AI response", components: [] };
    }
    const components = (parsed.components ?? []).map((c) => ({
      ...c,
      confidence: ["high", "medium", "low"].includes(c.confidence) ? c.confidence : "medium"
    }));
    return { productSummary: parsed.productSummary ?? "Product analysis", components };
  }),
  /**
   * Enrich BOM components with Brain-awareness.
   * Cross-references each component against the active Offering Brain's capabilities
   * and returns canSupply: 'yes' | 'partial' | 'no' with a short reason for each.
   */
  enrichBomWithBrain: protectedProcedure.input(z5.object({
    components: z5.array(z5.object({
      component: z5.string(),
      qty: z5.number(),
      unitCostEur: z5.number(),
      confidence: z5.enum(["high", "medium", "low"]),
      notes: z5.string()
    })).min(1).max(20),
    // Brain context — passed from the frontend so we avoid an extra DB round-trip
    brainContext: z5.object({
      companyName: z5.string(),
      offeringSummary: z5.string().optional(),
      coreCapabilities: z5.string().optional(),
      // JSON array string
      valuePropositions: z5.string().optional(),
      // JSON array string
      competitiveAdvantages: z5.string().optional()
    })
  })).mutation(async ({ input }) => {
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const caps = (() => {
      try {
        return JSON.parse(input.brainContext.coreCapabilities ?? "[]");
      } catch {
        return [];
      }
    })();
    const props = (() => {
      try {
        return JSON.parse(input.brainContext.valuePropositions ?? "[]");
      } catch {
        return [];
      }
    })();
    const brainProfile = [
      `Company: ${input.brainContext.companyName}`,
      input.brainContext.offeringSummary ? `Offering: ${input.brainContext.offeringSummary}` : null,
      caps.length > 0 ? `Core Capabilities: ${Array.isArray(caps) ? caps.map((c) => typeof c === "string" ? c : c.capability || c.name || JSON.stringify(c)).join("; ") : caps}` : null,
      props.length > 0 ? `Value Propositions: ${Array.isArray(props) ? props.map((p) => typeof p === "string" ? p : p.proposition || p.value || JSON.stringify(p)).join("; ") : props}` : null,
      input.brainContext.competitiveAdvantages ? `Competitive Advantages: ${input.brainContext.competitiveAdvantages}` : null
    ].filter(Boolean).join("\n");
    const componentList = input.components.map(
      (c, i) => `${i + 1}. ${c.component} (qty: ${c.qty}, ~\u20AC${c.unitCostEur}/unit) \u2014 ${c.notes}`
    ).join("\n");
    const response = await invokeLLM2({
      messages: [
        {
          role: "system",
          content: "You are a PCB and electronics manufacturing expert. Given a manufacturer's capabilities profile and a BOM component list, assess whether the manufacturer can supply each component. Return ONLY valid JSON \u2014 no markdown, no explanation outside the JSON."
        },
        {
          role: "user",
          content: `MANUFACTURER PROFILE:
${brainProfile}

BOM COMPONENTS:
${componentList}

For each component, return a JSON array with objects: { index: number (1-based), canSupply: 'yes'|'partial'|'no', reason: string (max 15 words), deliverableCategory: string (e.g. 'PCB Fabrication', 'SMT Assembly', 'Through-Hole', 'Mechanical', 'Passive Component', 'Active IC', 'Connector', 'Cable', 'Enclosure', 'Raw Material', 'Out-of-scope') }. Return: { enriched: [...] }`
        }
      ],
      response_format: { type: "json_object" }
    });
    const raw = response.choices?.[0]?.message?.content ?? "{}";
    let parsed = {};
    try {
      const text2 = typeof raw === "string" ? raw : JSON.stringify(raw);
      const cleaned = text2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { enriched: [] };
    }
    const enriched = input.components.map((c, i) => {
      const match = (parsed.enriched ?? []).find((e) => e.index === i + 1);
      return {
        ...c,
        canSupply: ["yes", "partial", "no"].includes(match?.canSupply ?? "") ? match.canSupply : "no",
        supplyReason: match?.reason ?? "",
        deliverableCategory: match?.deliverableCategory ?? "Unknown"
      };
    });
    return { enriched };
  }),
  /**
   * Generate a DOM (Deliverables of Materials) mini-report for a specific BOM component.
   * Grounds the report in the Brain's capabilities and the component's context.
   */
  generateDomReport: protectedProcedure.input(z5.object({
    component: z5.string(),
    qty: z5.number(),
    unitCostEur: z5.number(),
    notes: z5.string(),
    deliverableCategory: z5.string(),
    productContext: z5.string().optional(),
    // e.g. company name + product type
    brainContext: z5.object({
      companyName: z5.string(),
      offeringSummary: z5.string().optional(),
      coreCapabilities: z5.string().optional(),
      competitiveAdvantages: z5.string().optional()
    })
  })).mutation(async ({ input }) => {
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const caps = (() => {
      try {
        return JSON.parse(input.brainContext.coreCapabilities ?? "[]");
      } catch {
        return [];
      }
    })();
    const capsStr = Array.isArray(caps) ? caps.map((c) => typeof c === "string" ? c : c.capability || c.name || JSON.stringify(c)).join("; ") : String(caps);
    const response = await invokeLLM2({
      messages: [
        {
          role: "system",
          content: "You are a senior PCB manufacturing engineer and technical sales expert. Write a concise Deliverables of Materials (DOM) report for a specific component. Ground every claim in the manufacturer's actual capabilities. Return ONLY valid JSON \u2014 no markdown outside the JSON."
        },
        {
          role: "user",
          content: `MANUFACTURER: ${input.brainContext.companyName}
` + (input.brainContext.offeringSummary ? `OFFERING: ${input.brainContext.offeringSummary}
` : "") + (capsStr ? `CAPABILITIES: ${capsStr}
` : "") + (input.brainContext.competitiveAdvantages ? `ADVANTAGES: ${input.brainContext.competitiveAdvantages}
` : "") + `
COMPONENT: ${input.component}
QTY NEEDED: ${input.qty}
ESTIMATED UNIT COST: \u20AC${input.unitCostEur}
CATEGORY: ${input.deliverableCategory}` + (input.notes ? `
NOTES: ${input.notes}` : "") + (input.productContext ? `
PRODUCT CONTEXT: ${input.productContext}` : "") + "\n\nReturn a JSON object: { componentName: string, canDeliver: boolean, deliveryStatement: string (1-2 sentences: how we deliver this), specification: string (key technical specs, tolerances, standards), leadTimeEstimate: string (e.g. '5-7 working days for prototype'), manufacturingProcess: string (which of our processes applies), qualityStandards: string (relevant certifications/standards we meet), pricingNote: string (rough pricing context vs the estimate), whyUs: string (2-3 sentences: why our capabilities make us the right fit), limitations: string (honest caveats or out-of-scope items, if any) }"
        }
      ],
      response_format: { type: "json_object" }
    });
    const raw = response.choices?.[0]?.message?.content ?? "{}";
    let parsed = {};
    try {
      const text2 = typeof raw === "string" ? raw : JSON.stringify(raw);
      const cleaned = text2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { componentName: input.component, canDeliver: false, deliveryStatement: "Unable to generate report." };
    }
    return parsed;
  }),
  /**
   * Internal: Add/update internal notes
   */
  addNotes: protectedProcedure.input(z5.object({
    id: z5.number(),
    internalNotes: z5.string()
  })).mutation(async ({ input }) => {
    await updatePrototypeRequest(input.id, {
      internalNotes: input.internalNotes
    });
    return { success: true };
  }),
  // ── BOM Persistence ──────────────────────────────────────────────────────
  /**
   * Save (or update) a BOM calculation for a company.
   * If bomId is provided, updates the existing row; otherwise inserts a new one.
   */
  saveBom: protectedProcedure.input(z5.object({
    bomId: z5.number().optional(),
    companyId: z5.number(),
    imageUrls: z5.array(z5.string()),
    productSummary: z5.string(),
    components: z5.array(z5.object({
      component: z5.string(),
      qty: z5.number(),
      unitCostEur: z5.number(),
      confidence: z5.enum(["high", "medium", "low"]),
      notes: z5.string(),
      editedCost: z5.number().optional(),
      canSupply: z5.enum(["yes", "partial", "no"]).optional(),
      supplyReason: z5.string().optional(),
      deliverableCategory: z5.string().optional()
    })),
    isEnriched: z5.boolean().default(false),
    brainId: z5.number().optional(),
    label: z5.string().optional()
  })).mutation(async ({ input, ctx }) => {
    const totalEur = input.components.reduce((sum, c) => sum + (c.editedCost ?? c.unitCostEur) * c.qty, 0).toFixed(2);
    const payload = {
      companyId: input.companyId,
      userId: ctx.user.openId,
      imageUrls: JSON.stringify(input.imageUrls),
      productSummary: input.productSummary,
      componentsJson: JSON.stringify(input.components),
      totalEur,
      isEnriched: input.isEnriched ? 1 : 0,
      brainId: input.brainId ?? null,
      label: input.label ?? (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    };
    if (input.bomId) {
      await updateBomCalculation(input.bomId, payload);
      return { bomId: input.bomId };
    } else {
      const bomId = await saveBomCalculation(payload);
      return { bomId };
    }
  }),
  /**
   * Get all BOM calculations for a company, newest first.
   */
  getBomHistory: protectedProcedure.input(z5.object({ companyId: z5.number() })).query(async ({ input }) => {
    const rows = await getBomCalculationsByCompany(input.companyId);
    return {
      boms: rows.map((r) => ({
        id: r.id,
        label: r.label,
        totalEur: r.totalEur,
        isEnriched: r.isEnriched === 1,
        brainId: r.brainId,
        createdAt: r.createdAt,
        productSummary: r.productSummary,
        componentsJson: r.componentsJson,
        imageUrls: r.imageUrls
      }))
    };
  }),
  /**
   * Get the latest BOM calculation for a company (for auto-loading on modal open).
   */
  getLatestBom: protectedProcedure.input(z5.object({ companyId: z5.number() })).query(async ({ input }) => {
    const row = await getLatestBomCalculation(input.companyId);
    if (!row) return { bom: null };
    return {
      bom: {
        id: row.id,
        label: row.label,
        totalEur: row.totalEur,
        isEnriched: row.isEnriched === 1,
        brainId: row.brainId,
        createdAt: row.createdAt,
        productSummary: row.productSummary,
        componentsJson: row.componentsJson,
        imageUrls: row.imageUrls
      }
    };
  }),
  /**
   * Delete a BOM calculation (owner only).
   */
  deleteBom: protectedProcedure.input(z5.object({ bomId: z5.number() })).mutation(async ({ input, ctx }) => {
    await deleteBomCalculation(input.bomId, ctx.user.openId);
    return { success: true };
  })
});

// server/bomRouter.ts
import { z as z6 } from "zod";
init_db();
init_schema();
import { eq as eq6, and as and3 } from "drizzle-orm";
var bomRouter = router({
  /**
   * List all BOM items for a prototype request
   */
  list: protectedProcedure.input(z6.object({ prototypeRequestId: z6.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return db.select().from(bomItems).where(eq6(bomItems.prototypeRequestId, input.prototypeRequestId)).orderBy(bomItems.createdAt);
  }),
  /**
   * Add a BOM line item
   */
  add: protectedProcedure.input(
    z6.object({
      prototypeRequestId: z6.number().int().positive(),
      component: z6.string().min(1).max(256),
      qty: z6.number().int().positive().default(1),
      unitCost: z6.number().nonnegative(),
      currency: z6.enum(["EUR", "USD", "GBP"]).default("EUR"),
      notes: z6.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(bomItems).values({
      prototypeRequestId: input.prototypeRequestId,
      component: input.component,
      qty: input.qty,
      unitCost: String(input.unitCost),
      currency: input.currency,
      notes: input.notes ?? null
    });
    return db.select().from(bomItems).where(eq6(bomItems.prototypeRequestId, input.prototypeRequestId)).orderBy(bomItems.createdAt);
  }),
  /**
   * Update a BOM line item
   */
  update: protectedProcedure.input(
    z6.object({
      id: z6.number().int().positive(),
      prototypeRequestId: z6.number().int().positive(),
      component: z6.string().min(1).max(256).optional(),
      qty: z6.number().int().positive().optional(),
      unitCost: z6.number().nonnegative().optional(),
      currency: z6.enum(["EUR", "USD", "GBP"]).optional(),
      notes: z6.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const updates = {};
    if (input.component !== void 0) updates.component = input.component;
    if (input.qty !== void 0) updates.qty = input.qty;
    if (input.unitCost !== void 0) updates.unitCost = String(input.unitCost);
    if (input.currency !== void 0) updates.currency = input.currency;
    if (input.notes !== void 0) updates.notes = input.notes;
    if (Object.keys(updates).length > 0) {
      await db.update(bomItems).set(updates).where(
        and3(
          eq6(bomItems.id, input.id),
          eq6(bomItems.prototypeRequestId, input.prototypeRequestId)
        )
      );
    }
    return db.select().from(bomItems).where(eq6(bomItems.prototypeRequestId, input.prototypeRequestId)).orderBy(bomItems.createdAt);
  }),
  /**
   * Delete a BOM line item
   */
  remove: protectedProcedure.input(
    z6.object({
      id: z6.number().int().positive(),
      prototypeRequestId: z6.number().int().positive()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(bomItems).where(
      and3(
        eq6(bomItems.id, input.id),
        eq6(bomItems.prototypeRequestId, input.prototypeRequestId)
      )
    );
    return db.select().from(bomItems).where(eq6(bomItems.prototypeRequestId, input.prototypeRequestId)).orderBy(bomItems.createdAt);
  })
});

// server/routers.ts
init_prompts();

// server/campaignQueueRouter.ts
import { z as z7 } from "zod";
init_db();
init_schema();
import { TRPCError as TRPCError6 } from "@trpc/server";
import { eq as eq8, and as and5, inArray as inArray4, count, sql as sql3 } from "drizzle-orm";

// server/campaignQueueWorker.ts
init_schema();
import { eq as eq7, sql as sql2 } from "drizzle-orm";
var POLL_INTERVAL_MS = 2e3;
var CONCURRENCY = 5;
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;
var activeWorkers = 0;
var workerInterval = null;
async function claimNextJob() {
  const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const db = await getDb2();
  if (!db) return null;
  const result = await db.execute(
    sql2`UPDATE campaign_queue
        SET status = 'running',
            startedAt = NOW(),
            id = LAST_INSERT_ID(id)
        WHERE status = 'pending'
        ORDER BY createdAt ASC
        LIMIT 1`
  );
  const affectedRows = result?.[0]?.affectedRows ?? result?.rowsAffected ?? 0;
  if (affectedRows === 0) return null;
  const [job] = await db.select().from(campaignQueue).where(sql2`${campaignQueue.id} = LAST_INSERT_ID()`).limit(1);
  return job ?? null;
}
async function processJob() {
  const job = await claimNextJob();
  if (!job) return false;
  console.log(`[CampaignQueue] \u25B6 Worker claiming Job ${job.id} \u2014 ${job.companyName} (companyId: ${job.companyId})`);
  try {
    const { getDb: getDb2, getCompanyById: getCompanyById2, updateCompany: updateCompany2, getActiveBrain: getActiveBrain2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const db = await getDb2();
    if (!db) throw new Error("DB unavailable");
    const stampBrain = async () => {
      try {
        const brain = await getActiveBrain2(job.userId);
        if (brain) {
          await updateCompany2(job.companyId, {
            generatedWithBrainId: brain.id,
            generatedWithBrainName: brain.brainName
          });
        }
      } catch {
      }
    };
    let company = await getCompanyById2(job.companyId);
    if (!company) {
      await db.update(campaignQueue).set({
        status: "failed",
        errorMessage: "Company not found in DB",
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq7(campaignQueue.id, job.id));
      return true;
    }
    if (company.enrichmentStatus === "pending") {
      if (!company.apolloId) {
        console.warn(`[CampaignQueue] \u26A0 Company ${company.name} has no apolloId \u2014 skipping enrichment`);
        await updateCompany2(job.companyId, { enrichmentStatus: "enriched" });
      } else {
        try {
          const { enrichCompanyDetails: enrichCompanyDetails2 } = await Promise.resolve().then(() => (init_apolloSearch(), apolloSearch_exports));
          console.log(`[CampaignQueue] Step 0: Enriching ${company.name} via Apollo...`);
          const details = await enrichCompanyDetails2(company.apolloId);
          await updateCompany2(job.companyId, {
            city: details.city,
            state: details.state,
            country: details.country,
            streetAddress: details.street_address,
            rawAddress: details.raw_address,
            enrichmentStatus: "enriched"
          });
          console.log(`[CampaignQueue] \u2713 Enriched: ${company.name} (${details.city ?? "?"}, ${details.country ?? "?"})`);
        } catch (err) {
          console.warn(`[CampaignQueue] \u26A0 Enrichment failed for ${company.name}: ${err.message}`);
          await updateCompany2(job.companyId, { enrichmentStatus: "failed" });
        }
      }
      company = await getCompanyById2(job.companyId) ?? company;
    } else {
      console.log(`[CampaignQueue] \u21A9 Already enriched: ${company.name}`);
    }
    if (job.jobType === "full" && !company.fitScore) {
      try {
        const { scoreCompanyFit: scoreCompanyFit2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
        const result = await scoreCompanyFit2(job.companyId, job.userId);
        await updateCompany2(job.companyId, {
          fitScore: result.fitScore,
          fitScoreData: JSON.stringify(result)
        });
        console.log(`[CampaignQueue] \u2713 Fit score: ${company.name} \u2192 ${result.fitScore}`);
      } catch (err) {
        console.warn(`[CampaignQueue] \u26A0 Fit score failed for ${company.name}: ${err.message}`);
      }
    } else if (company.fitScore) {
      console.log(`[CampaignQueue] \u21A9 Fit score cached: ${company.name} (${company.fitScore})`);
    }
    const freshCompany = await getCompanyById2(job.companyId) ?? company;
    const needsBrief = !freshCompany.briefData || !freshCompany.briefGeneratedAt || Date.now() - new Date(freshCompany.briefGeneratedAt).getTime() >= SEVEN_DAYS_MS;
    const needsApproach = !freshCompany.salesApproachData || !freshCompany.salesApproachGeneratedAt || Date.now() - new Date(freshCompany.salesApproachGeneratedAt).getTime() >= SEVEN_DAYS_MS;
    const parallelTasks = [];
    if (needsBrief) {
      parallelTasks.push(
        (async () => {
          const { generateSalesIntelligenceBrief: generateSalesIntelligenceBrief2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
          const brief = await generateSalesIntelligenceBrief2(job.companyId, job.userId);
          await updateCompany2(job.companyId, {
            urgencyScore: brief.urgencyScore,
            briefData: JSON.stringify(brief),
            briefGeneratedAt: /* @__PURE__ */ new Date()
          });
          console.log(`[CampaignQueue] \u2713 Brief: ${company.name} (urgency: ${brief.urgencyScore})`);
        })()
      );
    } else {
      console.log(`[CampaignQueue] \u21A9 Brief cached: ${company.name}`);
    }
    if (needsApproach) {
      parallelTasks.push(
        (async () => {
          if (needsBrief) {
            return;
          }
          const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
          const salesApproach = await generateSalesApproach2(job.companyId, job.userId);
          await updateCompany2(job.companyId, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: /* @__PURE__ */ new Date()
          });
          console.log(`[CampaignQueue] \u2713 Sales approach: ${company.name}`);
        })()
      );
    } else {
      console.log(`[CampaignQueue] \u21A9 Sales approach cached: ${company.name}`);
    }
    if (parallelTasks.length > 0) {
      const results = await Promise.allSettled(parallelTasks);
      for (const r of results) {
        if (r.status === "rejected") {
          console.warn(`[CampaignQueue] \u26A0 Parallel task failed for ${company.name}: ${r.reason?.message ?? r.reason}`);
        }
      }
    }
    if (needsBrief && needsApproach) {
      try {
        const refreshedForApproach = await getCompanyById2(job.companyId);
        if (refreshedForApproach?.briefData) {
          const { generateSalesApproach: generateSalesApproach2 } = await Promise.resolve().then(() => (init_salesApproachGenerator(), salesApproachGenerator_exports));
          const salesApproach = await generateSalesApproach2(job.companyId, job.userId);
          await updateCompany2(job.companyId, {
            salesApproachData: JSON.stringify(salesApproach),
            salesApproachGeneratedAt: /* @__PURE__ */ new Date()
          });
          console.log(`[CampaignQueue] \u2713 Sales approach (after brief): ${company.name}`);
        }
      } catch (err) {
        console.warn(`[CampaignQueue] \u26A0 Sales approach failed for ${company.name}: ${err.message}`);
      }
    }
    await stampBrain();
    await db.update(campaignQueue).set({
      status: "completed",
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq7(campaignQueue.id, job.id));
    console.log(`[CampaignQueue] \u2705 Job ${job.id} complete \u2014 ${company.name}`);
    return true;
  } catch (err) {
    console.error(`[CampaignQueue] \u274C Unhandled error for Job ${job.id}:`, err.message);
    try {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db = await getDb2();
      if (db) {
        await db.update(campaignQueue).set({
          status: "failed",
          errorMessage: (err.message ?? "Unknown error").slice(0, 512),
          completedAt: /* @__PURE__ */ new Date()
        }).where(eq7(campaignQueue.id, job.id));
      }
    } catch (dbErr) {
      console.error(`[CampaignQueue] Could not mark job as failed:`, dbErr);
    }
    return true;
  }
}
async function workerLoop(workerId) {
  activeWorkers++;
  try {
    const hadWork = await processJob();
    if (hadWork) {
      setImmediate(() => workerLoop(workerId));
      return;
    }
  } catch (err) {
    console.error(`[CampaignQueue] Worker ${workerId} error:`, err.message);
  } finally {
    activeWorkers--;
  }
}
function tick() {
  const slotsAvailable = CONCURRENCY - activeWorkers;
  for (let i = 0; i < slotsAvailable; i++) {
    workerLoop(i + 1);
  }
}
function startCampaignQueueWorker() {
  if (workerInterval) return;
  console.log(`[CampaignQueue] Worker started \u2014 interval: ${POLL_INTERVAL_MS / 1e3}s, concurrency: ${CONCURRENCY} (Enrich \u2192 Score \u2192 Brief+Approach parallel)`);
  tick();
  workerInterval = setInterval(tick, POLL_INTERVAL_MS);
}
function getWorkerStatus() {
  return {
    running: workerInterval !== null,
    busy: activeWorkers > 0,
    activeWorkers,
    concurrency: CONCURRENCY
  };
}

// server/campaignQueueRouter.ts
var campaignQueueRouter = router({
  /**
   * Enqueue all unprocessed companies from a search for background deep research.
   * Idempotent — already-queued or already-completed companies are skipped.
   * Returns the number of jobs newly added.
   */
  enqueueSearch: protectedProcedure.input(z7.object({
    searchId: z7.number(),
    jobType: z7.enum(["full", "brief_only"]).default("full"),
    // If true, re-enqueue companies that already have a brief (force refresh)
    forceRefresh: z7.boolean().default(false)
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const allCompanies = await db.select({
      id: companies.id,
      name: companies.name,
      briefData: companies.briefData,
      salesApproachData: companies.salesApproachData,
      enrichmentStatus: companies.enrichmentStatus
    }).from(companies).where(and5(
      eq8(companies.searchId, input.searchId)
    ));
    const processable = allCompanies.filter(
      (c) => c.enrichmentStatus !== "failed" || c.salesApproachData
    );
    if (processable.length === 0) {
      return { enqueued: 0, skipped: 0, total: 0, message: "No processable companies found in this campaign." };
    }
    const existingJobs = await db.select({ companyId: campaignQueue.companyId }).from(campaignQueue).where(and5(
      eq8(campaignQueue.searchId, input.searchId),
      inArray4(campaignQueue.status, ["pending", "running"])
    ));
    const alreadyQueued = new Set(existingJobs.map((j) => j.companyId));
    const toEnqueue = processable.filter((c) => {
      if (alreadyQueued.has(c.id)) return false;
      if (!input.forceRefresh && c.briefData && c.salesApproachData) return false;
      return true;
    });
    if (toEnqueue.length === 0) {
      return {
        enqueued: 0,
        skipped: processable.length,
        total: processable.length,
        message: "All companies are already queued or fully processed."
      };
    }
    await db.insert(campaignQueue).values(
      toEnqueue.map((c) => ({
        searchId: input.searchId,
        companyId: c.id,
        userId: ctx.user.id,
        companyName: c.name,
        jobType: input.jobType,
        status: "pending"
      }))
    );
    return {
      enqueued: toEnqueue.length,
      skipped: processable.length - toEnqueue.length,
      total: processable.length,
      message: `${toEnqueue.length} companies queued for full pipeline (Enrich \u2192 Score \u2192 Brief \u2192 Approach).`
    };
  }),
  /**
   * Get the current queue status for a search (or global).
   */
  getQueueStatus: protectedProcedure.input(z7.object({
    searchId: z7.number().optional()
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const baseWhere = input.searchId ? and5(eq8(campaignQueue.userId, ctx.user.id), eq8(campaignQueue.searchId, input.searchId)) : eq8(campaignQueue.userId, ctx.user.id);
    const rows = await db.select({
      status: campaignQueue.status,
      cnt: count()
    }).from(campaignQueue).where(baseWhere).groupBy(campaignQueue.status);
    const statusMap = {};
    for (const row of rows) {
      statusMap[row.status] = Number(row.cnt);
    }
    const [runningJob] = await db.select({ companyName: campaignQueue.companyName, startedAt: campaignQueue.startedAt }).from(campaignQueue).where(and5(
      eq8(campaignQueue.userId, ctx.user.id),
      eq8(campaignQueue.status, "running"),
      ...input.searchId ? [eq8(campaignQueue.searchId, input.searchId)] : []
    )).limit(1);
    const worker = getWorkerStatus();
    return {
      pending: statusMap["pending"] ?? 0,
      running: statusMap["running"] ?? 0,
      completed: statusMap["completed"] ?? 0,
      failed: statusMap["failed"] ?? 0,
      currentCompany: runningJob?.companyName ?? null,
      workerRunning: worker.running,
      workerBusy: worker.busy,
      activeWorkers: worker.activeWorkers,
      concurrency: worker.concurrency,
      // Estimated minutes remaining: ~2 min per job, divided by concurrency
      estimatedMinutes: Math.ceil(((statusMap["pending"] ?? 0) + (statusMap["running"] ?? 0)) * 2 / worker.concurrency)
    };
  }),
  /**
   * Cancel all pending jobs for a search.
   */
  cancelSearch: protectedProcedure.input(z7.object({ searchId: z7.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const result = await db.update(campaignQueue).set({ status: "failed", errorMessage: "Cancelled by user", completedAt: /* @__PURE__ */ new Date() }).where(and5(
      eq8(campaignQueue.searchId, input.searchId),
      eq8(campaignQueue.userId, ctx.user.id),
      eq8(campaignQueue.status, "pending")
    ));
    return { cancelled: result.affectedRows ?? 0 };
  }),
  /**
   * Get recent job history for a search (last 50 completed/failed).
   */
  getJobHistory: protectedProcedure.input(z7.object({ searchId: z7.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const jobs = await db.select().from(campaignQueue).where(and5(
      eq8(campaignQueue.searchId, input.searchId),
      eq8(campaignQueue.userId, ctx.user.id),
      inArray4(campaignQueue.status, ["completed", "failed"])
    )).orderBy(sql3`${campaignQueue.completedAt} DESC`).limit(50);
    return jobs;
  })
});

// server/leadinfoRouter.ts
import { z as z8 } from "zod";
init_db();
init_schema();
import { eq as eq9, and as and6, sql as sql4 } from "drizzle-orm";

// server/leadinfoService.ts
import * as XLSX2 from "xlsx";
function normaliseDomain(urlOrDomain) {
  if (!urlOrDomain) return "";
  let d = urlOrDomain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/:\d+/, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  d = d.replace(/^www\./, "");
  return d;
}
var INTENT_PATTERNS = [
  { pattern: /contact/i, signal: "Visited contact page", weight: 3 },
  { pattern: /services|diensten|servicii|solutions|capabilities/i, signal: "Browsed services/capabilities", weight: 2 },
  { pattern: /product|offering|solution/i, signal: "Viewed product/offering pages", weight: 2 },
  { pattern: /case.?stud|reference|portfolio/i, signal: "Viewed case studies/references", weight: 2 },
  { pattern: /pric|tarif|cost|quote|offerte|rfq/i, signal: "Viewed pricing / requested quote", weight: 4 },
  { pattern: /demo|trial|free|sample/i, signal: "Explored demo/trial options", weight: 3 },
  { pattern: /about|over.?ons|team|company/i, signal: "Checked company info", weight: 1 },
  { pattern: /location|vestiging|locatie|office/i, signal: "Checked locations", weight: 1 },
  { pattern: /vacanc|vacatur|career|baan|job/i, signal: "Viewed careers (hiring signal)", weight: 1 },
  { pattern: /news|nieuws|stiri|blog|article/i, signal: "Read news/updates", weight: 1 },
  { pattern: /sustainab|duurzaam|esg|csr/i, signal: "Checked sustainability/ESG", weight: 1 },
  { pattern: /partner|integrat|reseller/i, signal: "Explored partnerships", weight: 2 }
];
function detectIntentSignals(pageViews) {
  const signals = /* @__PURE__ */ new Set();
  for (const pv of pageViews) {
    const text2 = `${pv.pageUrl} ${pv.pageTitle}`;
    for (const { pattern, signal } of INTENT_PATTERNS) {
      if (pattern.test(text2)) signals.add(signal);
    }
  }
  return Array.from(signals);
}
function computeEngagementScore(sessions, duration, pages) {
  const durationFactor = Math.log(duration + 1);
  const pageDepth = Math.min(pages / 3, 3);
  const raw = sessions * durationFactor * Math.max(pageDepth, 0.5);
  return Math.min(Math.round(raw), 100);
}
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    return /* @__PURE__ */ new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function parseLeadinfoExcel(buffer) {
  const wb = XLSX2.read(buffer, { type: "buffer" });
  const warnings = [];
  const companiesSheet = wb.Sheets["Companies"];
  if (!companiesSheet) {
    warnings.push("Missing 'Companies' sheet \u2014 looking for first sheet instead.");
  }
  const compSheet = companiesSheet || wb.Sheets[wb.SheetNames[0]];
  const compRows = XLSX2.utils.sheet_to_json(compSheet, { defval: "" });
  const companies2 = compRows.map((row) => {
    const url = String(row["URL"] || row["url"] || row["Website"] || "").trim();
    const employeesRaw = row["Employees"] || row["employees"];
    return {
      companyName: String(row["Company Name"] || row["company_name"] || row["Name"] || "").trim(),
      city: String(row["City"] || row["city"] || "").trim(),
      country: String(row["Country"] || row["country"] || "").trim(),
      salesRegion: String(row["SALES REGION"] || row["Sales Region"] || row["sales_region"] || "").trim(),
      employees: employeesRaw ? Math.round(Number(employeesRaw)) || null : null,
      branch: String(row["Branch"] || row["branch"] || row["Industry"] || "").trim(),
      url,
      domain: normaliseDomain(url),
      pages: Number(row["Pages"] || row["pages"] || 0),
      sessions: Number(row["Sessions"] || row["sessions"] || 0),
      duration: Number(row["Duration"] || row["duration"] || 0),
      linkedinUrl: String(row["LinkedIn"] || row["linkedin"] || "").trim(),
      salesVolume: String(row["Sales volume"] || row["sales_volume"] || "").trim()
    };
  }).filter((c) => c.companyName && c.domain);
  const pvSheet = wb.Sheets["Page views"] || wb.Sheets["Pageviews"] || wb.Sheets[wb.SheetNames[1]];
  const pageViews = [];
  if (pvSheet) {
    const pvRows = XLSX2.utils.sheet_to_json(pvSheet, { defval: "" });
    for (const row of pvRows) {
      pageViews.push({
        companyName: String(row["Name"] || row["Company Name"] || "").trim(),
        visitingTime: parseDate(row["Visiting time"] || row["visiting_time"]),
        pageUrl: String(row["Page URL"] || row["page_url"] || "").trim(),
        pageTitle: String(row["Page title"] || row["page_title"] || "").trim(),
        duration: Number(row["Duration"] || row["duration"] || 0),
        referrer: String(row["Referrer"] || row["referrer"] || "").trim(),
        term: String(row["Term"] || row["term"] || "").trim(),
        campaign: String(row["Campaign"] || row["campaign"] || "").trim(),
        adGroup: String(row["Ad group"] || row["ad_group"] || "").trim(),
        personaFirstName: String(row["Persona First name"] || row["persona_first_name"] || "").trim(),
        personaLastName: String(row["Persona Last name"] || row["persona_last_name"] || "").trim(),
        personaEmail: String(row["Persona Email address"] || row["persona_email"] || "").trim(),
        personaJobTitle: String(row["Persona Job Title"] || row["persona_job_title"] || "").trim()
      });
    }
  } else {
    warnings.push("No 'Page views' sheet found \u2014 engagement details will be limited.");
  }
  if (companies2.length === 0) {
    warnings.push("No companies found in the Excel file.");
  }
  return { companies: companies2, pageViews, warnings };
}
function enrichCompanies(companies2, pageViews) {
  const pvByCompany = /* @__PURE__ */ new Map();
  for (const pv of pageViews) {
    const key = pv.companyName.toLowerCase();
    if (!pvByCompany.has(key)) pvByCompany.set(key, []);
    pvByCompany.get(key).push(pv);
  }
  return companies2.map((c) => {
    const companyPvs = pvByCompany.get(c.companyName.toLowerCase()) || [];
    const pagesViewed = companyPvs.map((pv) => ({
      url: pv.pageUrl,
      title: pv.pageTitle,
      duration: pv.duration,
      visitedAt: pv.visitingTime ? pv.visitingTime.toISOString() : null
    }));
    const pageCounts = /* @__PURE__ */ new Map();
    for (const pv of companyPvs) {
      const title = pv.pageTitle || pv.pageUrl;
      pageCounts.set(title, (pageCounts.get(title) || 0) + 1);
    }
    const topPages = Array.from(pageCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title]) => title);
    const intentSignals = detectIntentSignals(companyPvs);
    const personaMap = /* @__PURE__ */ new Map();
    for (const pv of companyPvs) {
      if (pv.personaEmail || pv.personaFirstName) {
        const key = pv.personaEmail || `${pv.personaFirstName}_${pv.personaLastName}`;
        if (!personaMap.has(key)) {
          personaMap.set(key, {
            firstName: pv.personaFirstName,
            lastName: pv.personaLastName,
            email: pv.personaEmail,
            jobTitle: pv.personaJobTitle
          });
        }
      }
    }
    const totalDuration = companyPvs.reduce((sum, pv) => sum + pv.duration, 0) || c.duration;
    const engagementScore = computeEngagementScore(
      c.sessions || 1,
      totalDuration,
      c.pages || companyPvs.length
    );
    return {
      ...c,
      duration: totalDuration || c.duration,
      engagementScore,
      pagesViewed,
      topPages,
      intentSignals,
      personas: Array.from(personaMap.values())
    };
  });
}
function matchCompaniesToCampaign(enrichedCompanies, campaignCompanies) {
  const domainToCompany = /* @__PURE__ */ new Map();
  for (const cc of campaignCompanies) {
    const d1 = normaliseDomain(cc.primaryDomain || "");
    const d2 = normaliseDomain(cc.websiteUrl || "");
    if (d1) domainToCompany.set(d1, cc);
    if (d2 && d2 !== d1) domainToCompany.set(d2, cc);
  }
  return enrichedCompanies.map((lc) => {
    const exact = domainToCompany.get(lc.domain);
    if (exact) {
      return {
        leadinfoCompany: lc,
        matchedCompanyId: exact.id,
        matchedCompanyName: exact.name,
        matchType: "exact_domain"
      };
    }
    const baseName = lc.domain.split(".")[0];
    if (baseName.length >= 4) {
      for (const [campDomain, cc] of Array.from(domainToCompany.entries())) {
        const campBase = campDomain.split(".")[0];
        if (campBase === baseName) {
          return {
            leadinfoCompany: lc,
            matchedCompanyId: cc.id,
            matchedCompanyName: cc.name,
            matchType: "fuzzy_domain"
          };
        }
      }
    }
    return {
      leadinfoCompany: lc,
      matchedCompanyId: null,
      matchedCompanyName: null,
      matchType: "unmatched"
    };
  });
}

// server/leadinfoRouter.ts
import { randomUUID as randomUUID2 } from "crypto";
var leadinfoRouter = router({
  /**
   * Upload a Leadinfo Excel export, parse it, and match against a campaign.
   * Returns match preview before committing.
   */
  importPreview: protectedProcedure.input(
    z8.object({
      fileBase64: z8.string(),
      // Base64-encoded Excel file
      searchId: z8.number()
      // Campaign to match against
    })
  ).mutation(async ({ input, ctx }) => {
    const buffer = Buffer.from(input.fileBase64, "base64");
    const { companies: parsedCompanies, pageViews, warnings } = parseLeadinfoExcel(buffer);
    const enriched = enrichCompanies(parsedCompanies, pageViews);
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const campaignCompanies = await db.select({
      id: companies.id,
      name: companies.name,
      primaryDomain: companies.primaryDomain,
      websiteUrl: companies.websiteUrl
    }).from(companies).where(eq9(companies.searchId, input.searchId));
    const matches = matchCompaniesToCampaign(enriched, campaignCompanies);
    const matched = matches.filter((m) => m.matchType !== "unmatched");
    const unmatched = matches.filter((m) => m.matchType === "unmatched");
    return {
      totalCompanies: parsedCompanies.length,
      totalPageViews: pageViews.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      warnings,
      matches: matches.map((m) => ({
        companyName: m.leadinfoCompany.companyName,
        domain: m.leadinfoCompany.domain,
        matchedCompanyId: m.matchedCompanyId,
        matchedCompanyName: m.matchedCompanyName,
        matchType: m.matchType,
        engagementScore: m.leadinfoCompany.engagementScore,
        sessions: m.leadinfoCompany.sessions,
        pages: m.leadinfoCompany.pages,
        duration: m.leadinfoCompany.duration,
        intentSignals: m.leadinfoCompany.intentSignals,
        personas: m.leadinfoCompany.personas,
        topPages: m.leadinfoCompany.topPages
      }))
    };
  }),
  /**
   * Commit the import — save matched (and optionally unmatched) Leadinfo data to DB.
   */
  importCommit: protectedProcedure.input(
    z8.object({
      fileBase64: z8.string(),
      searchId: z8.number(),
      includeUnmatched: z8.boolean().default(false)
    })
  ).mutation(async ({ input, ctx }) => {
    const buffer = Buffer.from(input.fileBase64, "base64");
    const { companies: parsedCompanies, pageViews } = parseLeadinfoExcel(buffer);
    const enriched = enrichCompanies(parsedCompanies, pageViews);
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const campaignCompanies = await db.select({
      id: companies.id,
      name: companies.name,
      primaryDomain: companies.primaryDomain,
      websiteUrl: companies.websiteUrl
    }).from(companies).where(eq9(companies.searchId, input.searchId));
    const matches = matchCompaniesToCampaign(enriched, campaignCompanies);
    const batchId = randomUUID2();
    let savedCount = 0;
    for (const m of matches) {
      if (!input.includeUnmatched && m.matchType === "unmatched") continue;
      const lc = m.leadinfoCompany;
      await db.insert(leadinfoVisits).values({
        userId: ctx.user.id,
        searchId: input.searchId,
        companyId: m.matchedCompanyId,
        companyName: lc.companyName,
        domain: lc.domain,
        rawUrl: lc.url,
        city: lc.city || null,
        country: lc.country || null,
        salesRegion: lc.salesRegion || null,
        employees: lc.employees,
        branch: lc.branch || null,
        linkedinUrl: lc.linkedinUrl || null,
        salesVolume: lc.salesVolume || null,
        totalPages: lc.pages,
        totalSessions: lc.sessions,
        totalDuration: lc.duration,
        engagementScore: lc.engagementScore,
        pagesViewed: JSON.stringify(lc.pagesViewed),
        topPages: JSON.stringify(lc.topPages),
        intentSignals: JSON.stringify(lc.intentSignals),
        personas: JSON.stringify(lc.personas),
        importBatchId: batchId
      });
      savedCount++;
    }
    const matchedCount = matches.filter(
      (m) => m.matchType !== "unmatched"
    ).length;
    return {
      batchId,
      savedCount,
      matchedCount,
      totalParsed: enriched.length
    };
  }),
  /**
   * Get Leadinfo visit data for a specific company.
   */
  getByCompany: protectedProcedure.input(z8.object({ companyId: z8.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(leadinfoVisits).where(eq9(leadinfoVisits.companyId, input.companyId)).orderBy(sql4`${leadinfoVisits.importedAt} DESC`).limit(1);
    return rows[0] || null;
  }),
  /**
   * Get all Leadinfo visits for a campaign (search).
   */
  getByCampaign: protectedProcedure.input(z8.object({ searchId: z8.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(leadinfoVisits).where(eq9(leadinfoVisits.searchId, input.searchId)).orderBy(sql4`${leadinfoVisits.engagementScore} DESC`);
  }),
  /**
   * Get company IDs that have Leadinfo data for a given campaign.
   * Used for badge rendering on SearchResults without loading full data.
   */
  getMatchedCompanyIds: protectedProcedure.input(z8.object({ searchId: z8.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({ companyId: leadinfoVisits.companyId }).from(leadinfoVisits).where(
      and6(
        eq9(leadinfoVisits.searchId, input.searchId),
        sql4`${leadinfoVisits.companyId} IS NOT NULL`
      )
    );
    return rows.map((r) => r.companyId);
  }),
  /**
   * Get import history — list of past imports grouped by batch.
   */
  importHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      importBatchId: leadinfoVisits.importBatchId,
      searchId: leadinfoVisits.searchId,
      count: sql4`COUNT(*)`,
      matchedCount: sql4`SUM(CASE WHEN ${leadinfoVisits.companyId} IS NOT NULL THEN 1 ELSE 0 END)`,
      importedAt: sql4`MIN(${leadinfoVisits.importedAt})`
    }).from(leadinfoVisits).where(eq9(leadinfoVisits.userId, ctx.user.id)).groupBy(leadinfoVisits.importBatchId, leadinfoVisits.searchId).orderBy(sql4`MIN(${leadinfoVisits.importedAt}) DESC`);
    return rows;
  })
});

// server/telegramRouter.ts
import { z as z9 } from "zod";
init_env();
async function sendTelegramMessage(text2) {
  const token = ENV.telegramBotToken;
  const chatId = ENV.telegramChatId;
  if (!token || !chatId) {
    return { ok: false, error: "Telegram credentials not configured" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: text2,
    parse_mode: "HTML",
    disable_web_page_preview: false
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("[Telegram] sendMessage failed:", errText);
    return { ok: false, error: errText };
  }
  const json = await res.json();
  return { ok: json.ok };
}
function formatCompanyCard(params) {
  const {
    companyName,
    domain,
    urgencyScore,
    urgencyLabel,
    fitScore,
    fitLabel,
    conversationStarter,
    topSignalHeadline,
    topSignalType,
    pageUrl,
    brainName
  } = params;
  const urgencyEmoji = urgencyLabel === "HIGH" ? "\u{1F534}" : urgencyLabel === "MEDIUM" ? "\u{1F7E1}" : "\u{1F7E2}";
  const fitEmoji = fitLabel === "Strong Fit" || fitLabel === "HIGH" ? "\u2705" : fitLabel === "Moderate Fit" || fitLabel === "MEDIUM" ? "\u26A1" : "\u2796";
  const lines = [];
  lines.push(`<b>\u{1F3E2} ${escapeHtml(companyName)}</b>`);
  if (domain) lines.push(`\u{1F310} <a href="${escapeHtml(domain)}">${escapeHtml(domain)}</a>`);
  if (brainName) lines.push(`\u{1F9E0} Brain: ${escapeHtml(brainName)}`);
  lines.push("");
  lines.push(`${urgencyEmoji} <b>Urgency:</b> ${urgencyLabel ?? "\u2014"}${urgencyScore != null ? ` (${urgencyScore})` : ""}`);
  lines.push(`${fitEmoji} <b>Fit:</b> ${fitLabel ?? "\u2014"}${fitScore != null ? ` (${fitScore})` : ""}`);
  if (topSignalType && topSignalHeadline) {
    lines.push("");
    lines.push(`\u{1F4E1} <b>Signal [${escapeHtml(topSignalType)}]:</b>`);
    lines.push(escapeHtml(topSignalHeadline));
  }
  if (conversationStarter) {
    lines.push("");
    lines.push(`\u{1F4AC} <b>Conversation starter:</b>`);
    lines.push(escapeHtml(conversationStarter));
  }
  if (pageUrl) {
    let path3 = pageUrl;
    try {
      path3 = new URL(pageUrl).pathname;
    } catch {
    }
    const fullUrl = `https://leadtrigger-connectgroup.com${path3}`;
    lines.push("");
    lines.push(`\u{1F517} <a href="${fullUrl}">View full intelligence \u2192</a>`);
  }
  return lines.join("\n");
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
async function markSentInSupabase(companyId) {
  try {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabase = createClient2(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    await supabase.from("lt_mns_company_pages").update({ telegram_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("company_id", companyId);
  } catch (e) {
    console.warn("[Telegram] markSentInSupabase failed (non-fatal):", e);
  }
}
var companyCardInputSchema = z9.object({
  companyId: z9.string().optional(),
  // Supabase UUID — used to mark as sent
  companyName: z9.string(),
  domain: z9.string().nullable().optional(),
  urgencyScore: z9.number().nullable().optional(),
  urgencyLabel: z9.string().nullable().optional(),
  fitScore: z9.number().nullable().optional(),
  fitLabel: z9.string().nullable().optional(),
  conversationStarter: z9.string().nullable().optional(),
  topSignalHeadline: z9.string().nullable().optional(),
  topSignalType: z9.string().nullable().optional(),
  pageUrl: z9.string().nullable().optional(),
  brainName: z9.string().nullable().optional()
});
var telegramRouter = router({
  /**
   * Send a company intelligence card to the configured Telegram chat.
   * Also marks the row in Supabase with telegram_sent_at.
   */
  sendCompanyCard: protectedProcedure.input(companyCardInputSchema).mutation(async ({ input }) => {
    const text2 = formatCompanyCard(input);
    const result = await sendTelegramMessage(text2);
    if (!result.ok) {
      throw new Error(result.error ?? "Failed to send Telegram message");
    }
    if (input.companyId) {
      await markSentInSupabase(input.companyId);
    }
    return { success: true };
  }),
  /**
   * Send all HIGH urgency companies (from lt_mns_company_pages) to Telegram.
   * Respects optional campaignId filter. Rate-limited to 1 msg/sec to avoid Telegram flood limits.
   */
  sendAllHigh: protectedProcedure.input(z9.object({ campaignId: z9.number().optional() })).mutation(async ({ input }) => {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabase = createClient2(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    let query = supabase.from("lt_mns_company_pages").select("*").eq("urgency_label", "HIGH").order("urgency_score", { ascending: false }).limit(50);
    if (input.campaignId) {
      query = query.eq("campaign_id", input.campaignId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const companies2 = data ?? [];
    let sent = 0;
    let failed = 0;
    for (const c of companies2) {
      const text2 = formatCompanyCard({
        companyName: c.company_name,
        domain: c.domain,
        urgencyScore: c.urgency_score,
        urgencyLabel: c.urgency_label,
        fitScore: c.fit_score,
        fitLabel: c.fit_label,
        conversationStarter: c.conversation_starter,
        topSignalHeadline: c.top_signal_headline,
        topSignalType: c.top_signal_type,
        pageUrl: c.page_url,
        brainName: c.brain_name
      });
      const result = await sendTelegramMessage(text2);
      if (result.ok) {
        sent++;
        await markSentInSupabase(c.company_id);
      } else {
        failed++;
        console.error(`[Telegram] Failed to send ${c.company_name}:`, result.error);
      }
      await new Promise((r) => setTimeout(r, 1100));
    }
    return { sent, failed, total: companies2.length };
  }),
  /**
   * Send a plain text message to the configured Telegram chat.
   */
  sendMessage: protectedProcedure.input(z9.object({ text: z9.string().min(1).max(4096) })).mutation(async ({ input }) => {
    const result = await sendTelegramMessage(input.text);
    if (!result.ok) {
      throw new Error(result.error ?? "Failed to send Telegram message");
    }
    return { success: true };
  })
});

// server/webhookLogRouter.ts
import { z as z10 } from "zod";
init_db();
var webhookLogRouter = router({
  /**
   * Return paginated Apollo webhook audit log entries, newest first.
   * Only accessible to authenticated users.
   */
  list: protectedProcedure.input(
    z10.object({
      limit: z10.number().min(1).max(100).default(50),
      offset: z10.number().min(0).default(0)
    })
  ).query(async ({ input }) => {
    const [rows, total] = await Promise.all([
      getWebhookLogs(input.limit, input.offset),
      countWebhookLogs()
    ]);
    return { rows, total };
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  companyFinder: companyFinderRouter,
  codeDescriptions: codeDescriptionsRouter,
  niche: nicheRouter,
  prototype: prototypeRouter,
  bom: bomRouter,
  campaignQueue: campaignQueueRouter,
  leadinfo: leadinfoRouter,
  telegram: telegramRouter,
  webhookLog: webhookLogRouter,
  // Prompt Repository — exposes the full prompt catalogue for transparency
  prompts: router({
    list: protectedProcedure.query(() => ALL_PROMPTS)
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/routes/api.ts
init_db();
init_schema();
init_apolloCSVParser();
init_apolloSearch();
init_briefGenerator();
import { Router } from "express";
import multer from "multer";
import { eq as eq10, desc as desc3 } from "drizzle-orm";
var router2 = Router();
function apiKeyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY"
    });
  }
  const apiKey = authHeader.substring(7);
  const validApiKey = process.env.API_KEY || "your-secret-api-key-here";
  if (apiKey !== validApiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key"
    });
  }
  next();
}
router2.use(apiKeyAuth);
router2.get("/companies", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const searchId = req.query.searchId ? parseInt(req.query.searchId) : null;
    const offset = (page - 1) * limit;
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    let query = db.select().from(companies);
    if (searchId) {
      query = query.where(eq10(companies.searchId, searchId));
    }
    const results = await query.orderBy(desc3(companies.createdAt)).limit(limit).offset(offset);
    const dbInstance = await getDb();
    if (!dbInstance) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const countQuery = searchId ? dbInstance.select().from(companies).where(eq10(companies.searchId, searchId)) : dbInstance.select().from(companies);
    const total = (await countQuery).length;
    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});
router2.get("/companies/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid company ID"
      });
    }
    const result = await db.select().from(companies).where(eq10(companies.id, id)).limit(1);
    if (result.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Company not found"
      });
    }
    res.json({ data: result[0] });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});
router2.get("/searches", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const results = await db.select().from(searches).orderBy(desc3(searches.createdAt)).limit(limit).offset(offset);
    const dbInstance = await getDb();
    if (!dbInstance) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const total = (await dbInstance.select().from(searches)).length;
    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});
router2.get("/searches/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid search ID"
      });
    }
    const result = await db.select().from(searches).where(eq10(searches.id, id)).limit(1);
    if (result.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Search not found"
      });
    }
    res.json({ data: result[0] });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});
router2.get("/searches/:id/companies", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const searchId = parseInt(req.params.id);
    if (isNaN(searchId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid search ID"
      });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const results = await db.select().from(companies).where(eq10(companies.searchId, searchId)).orderBy(desc3(companies.createdAt)).limit(limit).offset(offset);
    const dbInstance = await getDb();
    if (!dbInstance) {
      return res.status(503).json({ error: "Service Unavailable", message: "Database not available" });
    }
    const total = (await dbInstance.select().from(companies).where(eq10(companies.searchId, searchId))).length;
    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
router2.post("/import-csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Bad Request", message: 'No file uploaded. Use field name "file".' });
    }
    const campaignName = (req.body.campaignName || "").trim();
    if (!campaignName) {
      return res.status(400).json({ error: "Bad Request", message: "campaignName is required." });
    }
    const location = (req.body.location || "CSV Import").trim();
    const userId = parseInt(req.body.userId || "1");
    const csvContent = req.file.buffer.toString("utf-8");
    console.log(`[CSV Import API] Parsing CSV (${(req.file.size / 1024 / 1024).toFixed(1)} MB)...`);
    const rows = parseApolloCSV(csvContent);
    console.log(`[CSV Import API] Parsed ${rows.length} rows for campaign: ${campaignName}`);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Bad Request", message: "CSV file is empty or could not be parsed." });
    }
    const searchId = await createSearch({
      userId,
      companyWebsite: "N/A",
      location,
      offeringName: campaignName,
      offeringDescription: `Campaign imported from Apollo CSV with ${rows.length} companies`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: null,
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: rows.length,
      codesTotal: rows.length,
      status: "completed"
    });
    const companyRows = rows.map((row) => mapApolloRowToCompany(row, searchId));
    const BATCH = 500;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
      console.log(`[CSV Import API] Inserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(companyRows.length / BATCH)}`);
    }
    console.log(`[CSV Import API] \u2713 Done \u2014 ${companyRows.length} companies imported, searchId=${searchId}`);
    res.json({
      success: true,
      searchId,
      companiesImported: companyRows.length,
      campaignName
    });
  } catch (error) {
    console.error("[CSV Import API] Error:", error.message);
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});
router2.post("/enrich-campaign", async (req, res) => {
  const { searchId, batchSize = 5 } = req.body || {};
  if (!searchId || isNaN(parseInt(searchId))) {
    return res.status(400).json({ error: "Bad Request", message: "searchId is required." });
  }
  const sid = parseInt(searchId);
  const bs = Math.min(20, Math.max(1, parseInt(batchSize) || 5));
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const search = await getSearchById(sid);
    if (!search) {
      send({ error: `Search ${sid} not found.` });
      return res.end();
    }
    const pending = await getPendingCompaniesBySearchId(sid);
    send({ status: "started", searchId: sid, pending: pending.length, batchSize: bs });
    if (pending.length === 0) {
      send({ status: "done", enriched: 0, failed: 0, message: "All companies already enriched." });
      return res.end();
    }
    let enriched = 0;
    let failed = 0;
    for (let i = 0; i < pending.length; i += bs) {
      const batch = pending.slice(i, i + bs);
      await Promise.all(
        batch.map(async (company) => {
          if (!company.apolloId) {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
            return;
          }
          try {
            const details = await enrichCompanyDetails(company.apolloId);
            await updateCompany(company.id, {
              city: details.city || null,
              state: details.state || null,
              country: details.country || null,
              streetAddress: details.street_address || null,
              rawAddress: details.raw_address || null,
              enrichmentStatus: "enriched"
            });
            enriched++;
          } catch (err) {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
          }
        })
      );
      const done = Math.min(i + bs, pending.length);
      send({ status: "progress", done, total: pending.length, enriched, failed });
    }
    send({ status: "done", enriched, failed, message: `Enriched ${enriched} companies, ${failed} failed.` });
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});
router2.post("/research-campaign", async (req, res) => {
  const { searchId, limit = 50, userId = 1 } = req.body || {};
  if (!searchId || isNaN(parseInt(searchId))) {
    return res.status(400).json({ error: "Bad Request", message: "searchId is required." });
  }
  const sid = parseInt(searchId);
  const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 50));
  const uid = parseInt(userId) || 1;
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const search = await getSearchById(sid);
    if (!search) {
      send({ error: `Search ${sid} not found.` });
      return res.end();
    }
    const allCompanies = await getCompaniesBySearchId(sid);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
    const toResearch = allCompanies.filter((c) => {
      if (!c.briefData || !c.briefGeneratedAt) return true;
      const age = Date.now() - new Date(c.briefGeneratedAt).getTime();
      return age >= sevenDaysMs;
    }).slice(0, maxLimit);
    send({
      status: "started",
      searchId: sid,
      total: allCompanies.length,
      toResearch: toResearch.length,
      alreadyResearched: allCompanies.length - toResearch.length,
      limit: maxLimit
    });
    if (toResearch.length === 0) {
      send({ status: "done", researched: 0, failed: 0, message: "All companies already have fresh research briefs." });
      return res.end();
    }
    let researched = 0;
    let failed = 0;
    for (let i = 0; i < toResearch.length; i++) {
      const company = toResearch[i];
      try {
        console.log(`[Research Campaign] ${i + 1}/${toResearch.length} \u2014 ${company.name}`);
        const brief = await generateSalesIntelligenceBrief(company.id, uid);
        await updateCompany(company.id, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: /* @__PURE__ */ new Date()
        });
        researched++;
        send({
          status: "progress",
          done: i + 1,
          total: toResearch.length,
          researched,
          failed,
          company: company.name,
          urgencyScore: brief.urgencyScore
        });
      } catch (err) {
        failed++;
        console.warn(`[Research Campaign] Failed for ${company.name}:`, err.message);
        send({
          status: "progress",
          done: i + 1,
          total: toResearch.length,
          researched,
          failed,
          company: company.name,
          error: err.message
        });
      }
    }
    send({
      status: "done",
      researched,
      failed,
      message: `Researched ${researched} companies, ${failed} failed.`
    });
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});
router2.post("/re-research-campaign", async (req, res) => {
  const { searchId, limit = 50 } = req.body;
  if (!searchId) {
    res.status(400).json({ error: "searchId is required" });
    return;
  }
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const companies2 = await getCompaniesBySearchId(searchId);
    const toResearch = companies2.filter((c) => c.enrichmentStatus === "enriched").slice(0, limit);
    send({ status: "started", total: toResearch.length, searchId });
    let researched = 0;
    let failed = 0;
    for (let i = 0; i < toResearch.length; i++) {
      const company = toResearch[i];
      try {
        await updateCompany(company.id, { briefData: null, briefGeneratedAt: null });
        const brief = await generateSalesIntelligenceBrief(company.id, 1);
        await updateCompany(company.id, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: /* @__PURE__ */ new Date()
        });
        try {
          const brain = await getActiveBrain(1);
          if (brain) {
            await updateCompany(company.id, {
              generatedWithBrainId: brain.id,
              generatedWithBrainName: brain.brainName
            });
          }
        } catch {
        }
        researched++;
        send({
          status: "progress",
          done: i + 1,
          total: toResearch.length,
          researched,
          failed,
          company: company.name,
          urgencyScore: brief.urgencyScore
        });
      } catch (err) {
        failed++;
        console.warn(`[Re-Research Campaign] Failed for ${company.name}:`, err.message);
        send({
          status: "progress",
          done: i + 1,
          total: toResearch.length,
          researched,
          failed,
          company: company.name,
          error: err.message
        });
      }
    }
    send({
      status: "done",
      researched,
      failed,
      message: `Re-researched ${researched} companies, ${failed} failed.`
    });
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});
router2.post("/score-campaign", async (req, res) => {
  const { searchId, limit = 100 } = req.body;
  if (!searchId) {
    res.status(400).json({ error: "searchId is required" });
    return;
  }
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const { scoreCompanyFit: scoreCompanyFit2 } = await Promise.resolve().then(() => (init_briefGenerator(), briefGenerator_exports));
    const allCompanies = await getCompaniesBySearchId(searchId);
    const toScore = allCompanies.filter((c) => c.fitScore === null || c.fitScore === void 0).slice(0, limit);
    send({ status: "started", total: toScore.length, searchId, limit });
    console.log(`[Score Campaign] Starting fit scoring for ${toScore.length} companies in search ${searchId}`);
    let scored = 0;
    let failed = 0;
    const OWNER_USER_ID = 1;
    for (let i = 0; i < toScore.length; i++) {
      const company = toScore[i];
      try {
        const result = await scoreCompanyFit2(company.id, OWNER_USER_ID);
        await updateCompany(company.id, {
          fitScore: result.fitScore,
          fitScoreData: JSON.stringify(result)
        });
        scored++;
        send({
          status: "progress",
          done: i + 1,
          total: toScore.length,
          scored,
          failed,
          company: company.name,
          fitScore: result.fitScore
        });
      } catch (err) {
        failed++;
        console.warn(`[Score Campaign] Failed for ${company.name}:`, err.message);
        send({
          status: "progress",
          done: i + 1,
          total: toScore.length,
          scored,
          failed,
          company: company.name,
          error: err.message
        });
      }
    }
    send({
      status: "done",
      scored,
      failed,
      message: `Scored ${scored} companies, ${failed} failed.`
    });
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});
router2.post("/name-enrich-campaign", async (req, res) => {
  const { searchId, limit = 100, concurrency = 3 } = req.body || {};
  if (!searchId || isNaN(parseInt(searchId))) {
    res.status(400).json({ error: "searchId is required" });
    return;
  }
  const sid = parseInt(searchId);
  const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 100));
  const concur = Math.min(5, Math.max(1, parseInt(concurrency) || 3));
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const { apolloEnrichByName: apolloEnrichByName2 } = await Promise.resolve().then(() => (init_conferenceScraper(), conferenceScraper_exports));
    const search = await getSearchById(sid);
    if (!search) {
      send({ error: `Search ${sid} not found.` });
      return res.end();
    }
    const allPending = await getPendingCompaniesBySearchId(sid);
    const toEnrich = allPending.filter((c) => !c.apolloId && !c.primaryDomain).filter((c) => c.name && c.name.length > 1).filter((c) => !c.websiteUrl || !c.websiteUrl.includes("localhost")).slice(0, maxLimit);
    send({ status: "started", searchId: sid, total: toEnrich.length, concurrency: concur });
    console.log(`[Name Enrich] Starting name-based enrichment for ${toEnrich.length} companies in search ${sid}`);
    if (toEnrich.length === 0) {
      send({ status: "done", enriched: 0, failed: 0, message: "No pending name-only companies to enrich." });
      return res.end();
    }
    let enriched = 0;
    let failed = 0;
    let done = 0;
    for (let i = 0; i < toEnrich.length; i += concur) {
      const batch = toEnrich.slice(i, i + concur);
      await Promise.all(
        batch.map(async (company) => {
          try {
            const countryHint = company.sourceCountryCode || company.country || null;
            const result = await apolloEnrichByName2(company.name, countryHint);
            if (result) {
              await updateCompany(company.id, {
                apolloId: result.apolloId || void 0,
                name: result.name || company.name,
                websiteUrl: result.websiteUrl || void 0,
                primaryDomain: result.primaryDomain || void 0,
                linkedinUrl: result.linkedinUrl || void 0,
                phone: result.phone || void 0,
                foundedYear: result.foundedYear || void 0,
                revenue: result.revenue || void 0,
                headcountGrowth: result.headcountGrowth || void 0,
                city: result.city || void 0,
                state: result.state || void 0,
                country: result.country || void 0,
                streetAddress: result.streetAddress || void 0,
                sicCodes: result.sicCodes?.length ? JSON.stringify(result.sicCodes) : void 0,
                naicsCodes: result.naicsCodes?.length ? JSON.stringify(result.naicsCodes) : void 0,
                enrichmentStatus: "enriched"
              });
              enriched++;
            } else {
              await updateCompany(company.id, { enrichmentStatus: "failed" });
              failed++;
            }
          } catch (err) {
            await updateCompany(company.id, { enrichmentStatus: "failed" });
            failed++;
            console.warn(`[Name Enrich] Failed for "${company.name}":`, err.message);
          }
          done++;
        })
      );
      send({
        status: "progress",
        done,
        total: toEnrich.length,
        enriched,
        failed,
        lastBatch: batch.map((c) => c.name)
      });
      if (i + concur < toEnrich.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    send({
      status: "done",
      enriched,
      failed,
      message: `Name-enriched ${enriched} companies, ${failed} not found in Apollo.`
    });
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});
router2.post("/research-campaign", async (req, res) => {
  const { searchId, skipCached = true, userId = 1 } = req.body || {};
  if (!searchId) {
    return res.status(400).json({ error: "Bad Request", message: "searchId is required." });
  }
  const uid = parseInt(userId) || 1;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1e3;
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const allCompanies = await getCompaniesBySearchId(searchId);
    const toResearch = allCompanies.filter((c) => {
      if (c.enrichmentStatus !== "enriched") return false;
      if (!skipCached) return true;
      if (!c.briefData || !c.briefGeneratedAt) return true;
      const age = Date.now() - new Date(c.briefGeneratedAt).getTime();
      return age >= sevenDaysMs;
    });
    send({
      status: "start",
      total: toResearch.length,
      skipped: allCompanies.length - toResearch.length,
      message: `Starting deep research for ${toResearch.length} companies (${allCompanies.length - toResearch.length} skipped \u2014 already have fresh briefs).`
    });
    let completed = 0;
    let failed = 0;
    for (const company of toResearch) {
      try {
        const brief = await generateSalesIntelligenceBrief(company.id, uid);
        await updateCompany(company.id, {
          urgencyScore: brief.urgencyScore,
          briefData: JSON.stringify(brief),
          briefGeneratedAt: /* @__PURE__ */ new Date()
        });
        completed++;
        send({
          status: "progress",
          company: company.name,
          domain: company.primaryDomain,
          urgencyScore: brief.urgencyScore,
          completed,
          total: toResearch.length
        });
      } catch (err) {
        failed++;
        send({
          status: "error",
          company: company.name,
          error: err.message,
          completed,
          failed,
          total: toResearch.length
        });
      }
    }
    send({
      status: "done",
      completed,
      failed,
      total: toResearch.length,
      message: `Deep research complete: ${completed} briefs generated, ${failed} failed.`
    });
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});
var api_default = router2;

// server/routes/conferenceImport.ts
import { Router as Router2 } from "express";
init_db();
var router3 = Router2();
router3.post("/", async (req, res) => {
  let user = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }
  const { url, campaignName } = req.body;
  if (!url?.trim()) {
    return res.status(400).json({ error: "url is required" });
  }
  if (!campaignName?.trim()) {
    return res.status(400).json({ error: "campaignName is required" });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (obj) => {
    try {
      res.write(JSON.stringify(obj) + "\n");
    } catch {
    }
  };
  try {
    const { scrapeConferenceExhibitors: scrapeConferenceExhibitors2, apolloEnrichByDomain: apolloEnrichByDomain2, apolloEnrichByName: apolloEnrichByName2 } = await Promise.resolve().then(() => (init_conferenceScraper(), conferenceScraper_exports));
    send({ status: "scraping", message: "Fetching exhibitor page..." });
    let exhibitors;
    let strategy;
    let fetchMethod;
    let pageTitle;
    let pagesScraped;
    try {
      const result = await scrapeConferenceExhibitors2(
        url.trim(),
        // Stream page-by-page progress to the client
        (progress2) => {
          send({
            status: "scraping_page",
            page: progress2.page,
            totalPages: progress2.totalPages,
            found: progress2.found,
            message: progress2.message
          });
        }
      );
      exhibitors = result.exhibitors;
      strategy = result.strategy;
      fetchMethod = result.fetchMethod;
      pageTitle = result.pageTitle;
      pagesScraped = result.pagesScraped;
    } catch (err) {
      send({ error: `Failed to fetch page: ${err.message}. Check that the URL is publicly accessible.` });
      res.end();
      return;
    }
    if (exhibitors.length === 0) {
      send({ error: "No exhibitors found on the page. The page may require JavaScript rendering or use a different structure." });
      res.end();
      return;
    }
    send({
      status: "scraped",
      total: exhibitors.length,
      pagesScraped,
      strategy,
      fetchMethod,
      pageTitle,
      message: `Found ${exhibitors.length} exhibitors across ${pagesScraped} page(s) via ${strategy}/${fetchMethod}`
    });
    const searchId = await createSearch({
      userId: user.id,
      companyWebsite: url.trim(),
      location: "Conference Import",
      offeringName: campaignName.trim(),
      offeringDescription: `Exhibitors from ${pageTitle} (${url.trim()}) \u2014 ${exhibitors.length} companies scraped across ${pagesScraped} page(s) via ${strategy}/${fetchMethod}`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: JSON.stringify(["conference-import"]),
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: 0,
      codesTotal: exhibitors.length,
      status: "searching"
    });
    send({ status: "campaign_created", searchId, message: `Campaign created (id=${searchId})` });
    let enriched = 0;
    let notFound = 0;
    let failed = 0;
    const companyRows = [];
    for (let i = 0; i < exhibitors.length; i++) {
      const exhibitor = exhibitors[i];
      try {
        let domain = null;
        if (exhibitor.websiteUrl) {
          try {
            domain = new URL(exhibitor.websiteUrl).hostname.replace(/^www\./, "");
          } catch {
          }
        }
        let apolloData = null;
        if (domain) {
          apolloData = await apolloEnrichByDomain2(domain);
        }
        if (!apolloData && !domain) {
          apolloData = await apolloEnrichByName2(exhibitor.name, exhibitor.countryCode);
        }
        if (apolloData) {
          enriched++;
          companyRows.push({
            searchId,
            apolloId: apolloData.apolloId || null,
            name: apolloData.name || exhibitor.name,
            websiteUrl: apolloData.websiteUrl || exhibitor.websiteUrl,
            primaryDomain: apolloData.primaryDomain || domain,
            linkedinUrl: apolloData.linkedinUrl || null,
            phone: apolloData.phone || null,
            foundedYear: apolloData.foundedYear || null,
            revenue: apolloData.revenue || null,
            headcountGrowth: apolloData.headcountGrowth || null,
            sicCodes: apolloData.sicCodes?.length ? JSON.stringify(apolloData.sicCodes) : null,
            naicsCodes: apolloData.naicsCodes?.length ? JSON.stringify(apolloData.naicsCodes) : null,
            city: apolloData.city || null,
            state: apolloData.state || null,
            country: apolloData.country || null,
            streetAddress: apolloData.streetAddress || null,
            searchLocation: "Conference Import",
            sourceCountryCode: exhibitor.countryCode || null,
            enrichmentStatus: "enriched"
          });
        } else {
          notFound++;
          companyRows.push({
            searchId,
            apolloId: null,
            name: exhibitor.name,
            websiteUrl: exhibitor.websiteUrl || null,
            primaryDomain: domain,
            searchLocation: "Conference Import",
            sourceCountryCode: exhibitor.countryCode || null,
            enrichmentStatus: "pending"
          });
        }
        const enrichMethod = apolloData ? domain ? "domain" : "name" : null;
        send({
          status: "progress",
          done: i + 1,
          total: exhibitors.length,
          enriched,
          notFound,
          failed,
          company: exhibitor.name,
          apolloFound: apolloData !== null,
          enrichMethod
        });
      } catch (err) {
        failed++;
        companyRows.push({
          searchId,
          apolloId: null,
          name: exhibitor.name,
          websiteUrl: exhibitor.websiteUrl || null,
          searchLocation: "Conference Import",
          sourceCountryCode: exhibitor.countryCode || null,
          enrichmentStatus: "failed"
        });
        send({
          status: "progress",
          done: i + 1,
          total: exhibitors.length,
          enriched,
          notFound,
          failed,
          company: exhibitor.name,
          apolloFound: false,
          error: err.message
        });
      }
      if (i < exhibitors.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    const BATCH = 200;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
    }
    const db = await getDb();
    if (db) {
      const { searches: searches2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq14 } = await import("drizzle-orm");
      await db.update(searches2).set({ status: "completed", codesSearched: exhibitors.length }).where(eq14(searches2.id, searchId));
    }
    send({
      status: "done",
      searchId,
      total: exhibitors.length,
      enriched,
      notFound,
      failed,
      message: `Import complete. Scraped ${pagesScraped} page(s), found ${exhibitors.length} exhibitors. ${enriched} enriched via Apollo, ${notFound} not found (basic info saved), ${failed} failed.`
    });
  } catch (err) {
    console.error("[Conference Import] Fatal error:", err.message);
    send({ error: err.message });
  }
  res.end();
});
var conferenceImport_default = router3;

// server/routes/excelImport.ts
import { Router as Router3 } from "express";
import multer2 from "multer";
import * as XLSX3 from "xlsx";
init_db();
var router4 = Router3();
var upload2 = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "text/plain"
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx, .xls, and .csv files are supported."));
    }
  }
});
var COL_MAP = {
  name: ["company name", "name", "company", "bedrijf", "exhibitor", "organisation", "organization", "naam"],
  website: ["website", "url", "web", "domain", "website url", "site", "homepage", "link"],
  industry: ["industry", "sector", "industrie"],
  employees: ["# employees", "employees", "headcount", "employee count", "aantal medewerkers"],
  city: ["company city", "city", "stad"],
  state: ["company state", "state", "provincie"],
  country: ["company country", "country", "land"],
  street: ["company street", "street", "address", "straat"],
  address: ["company address", "full address", "volledig adres"],
  keywords: ["keywords", "trefwoorden"],
  revenue: ["annual revenue", "revenue", "omzet"],
  sicCodes: ["sic codes", "sic", "sic code"],
  description: ["short description", "description", "omschrijving", "beschrijving"],
  linkedin: ["company linkedin url", "linkedin", "linkedin url"],
  twitter: ["twitter url", "twitter"],
  phone: ["company phone", "phone", "telefoon"],
  apolloId: ["apollo account id", "apollo id"],
  lists: ["lists"],
  logoUrl: ["logo url", "logo"],
  subsidiaryOf: ["subsidiary of"],
  subsidiaryId: ["subsidiary of (organization id)"]
};
function buildColIndex(headers) {
  const lower = headers.map((h) => (h || "").toString().toLowerCase().trim());
  const idx = {};
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    for (const alias of aliases) {
      const col2 = lower.indexOf(alias);
      if (col2 !== -1) {
        idx[key] = col2;
        break;
      }
    }
  }
  return idx;
}
function cell(row, col2) {
  if (col2 === void 0 || col2 < 0) return null;
  const v = row[col2];
  if (v === null || v === void 0 || v === "") return null;
  const s = v.toString().trim();
  if (s === "\u2013" || s === "-" || s === "\u2014" || s === "n/a" || s === "N/A") return null;
  return s;
}
function extractDomain2(url) {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function mapRowToCompany(row, idx, searchId) {
  const websiteRaw = cell(row, idx.website);
  const primaryDomain = websiteRaw ? extractDomain2(websiteRaw) : null;
  const sicRaw = cell(row, idx.sicCodes);
  const sicCodes = sicRaw ? sicRaw.split(",").map((c) => c.trim()).filter(Boolean) : [];
  const employeeRaw = cell(row, idx.employees);
  const employeeCount = employeeRaw ? parseInt(employeeRaw.replace(/[^0-9]/g, "")) || null : null;
  const sliceMetadata = {
    employeeCount,
    industry: cell(row, idx.industry),
    keywords: cell(row, idx.keywords),
    description: cell(row, idx.description),
    lists: cell(row, idx.lists),
    logoUrl: cell(row, idx.logoUrl)
  };
  const stateVal = cell(row, idx.state);
  const countryVal = cell(row, idx.country);
  return {
    searchId,
    apolloId: cell(row, idx.apolloId),
    name: cell(row, idx.name) || "Unknown",
    websiteUrl: websiteRaw,
    primaryDomain,
    linkedinUrl: cell(row, idx.linkedin),
    twitterUrl: cell(row, idx.twitter),
    facebookUrl: null,
    phone: cell(row, idx.phone),
    foundedYear: null,
    revenue: cell(row, idx.revenue),
    headcountGrowth: null,
    parentCompanyName: cell(row, idx.subsidiaryOf),
    parentCompanyId: cell(row, idx.subsidiaryId),
    searchLocation: stateVal || countryVal || null,
    city: cell(row, idx.city),
    state: stateVal,
    country: countryVal,
    streetAddress: cell(row, idx.street),
    rawAddress: cell(row, idx.address),
    sicCodes: JSON.stringify(sicCodes),
    naicsCodes: null,
    sliceMetadata: JSON.stringify(sliceMetadata),
    urgencyScore: null,
    briefData: null,
    briefGeneratedAt: null,
    salesApproachData: null,
    salesApproachGeneratedAt: null,
    enrichmentStatus: "pending"
  };
}
router4.post("/", upload2.single("file"), async (req, res) => {
  let user = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Send a .xlsx, .xls, or .csv file as 'file' field." });
  }
  const campaignName = (req.body?.campaignName || "").toString().trim();
  if (!campaignName) {
    return res.status(400).json({ error: "campaignName is required." });
  }
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();
  const send = (obj) => {
    try {
      res.write(JSON.stringify(obj) + "\n");
    } catch {
    }
  };
  try {
    send({ status: "parsing", message: "Parsing file..." });
    const workbook = XLSX3.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX3.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length < 2) {
      send({ error: "File appears empty or has no data rows." });
      return res.end();
    }
    const headers = rows[0];
    const idx = buildColIndex(headers);
    if (idx.name === void 0) {
      send({
        error: `Could not find a company name column. Expected one of: Company Name, Name, Company, Bedrijf. Found headers: ${headers.join(", ")}`
      });
      return res.end();
    }
    const isApolloExport = idx.apolloId !== void 0 || idx.industry !== void 0 || idx.sicCodes !== void 0;
    const companyRows = [];
    let skipped = 0;
    const searchId = await createSearch({
      userId: user.id,
      companyWebsite: "",
      location: "Excel Import",
      offeringName: campaignName,
      offeringDescription: `Direct import: ${rows.length - 1} rows from "${req.file.originalname}"`,
      targetMarket: null,
      valueProposition: null,
      keywords: null,
      crossBorderIndicators: null,
      keywordTagsUsed: JSON.stringify(["excel-import"]),
      selectedSicCodes: null,
      selectedNaicsCodes: null,
      codeSelectionReasoning: null,
      excludedSectors: null,
      codesSearched: 0,
      codesTotal: rows.length - 1,
      status: "searching"
    });
    send({ status: "campaign_created", searchId, message: `Campaign created (id=${searchId})` });
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = cell(row, idx.name);
      if (!name) {
        skipped++;
        continue;
      }
      companyRows.push(mapRowToCompany(row, idx, searchId));
    }
    send({
      status: "parsed",
      total: companyRows.length,
      skipped,
      isApolloExport,
      message: `Parsed ${companyRows.length} companies${isApolloExport ? " (Apollo export detected \u2014 direct import, no API calls)" : ""}`
    });
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < companyRows.length; i += BATCH) {
      await createCompanies(companyRows.slice(i, i + BATCH));
      inserted += Math.min(BATCH, companyRows.length - i);
      send({
        status: "progress",
        done: inserted,
        total: companyRows.length,
        message: `Saved ${inserted} / ${companyRows.length} companies...`
      });
    }
    const db = await getDb();
    if (db) {
      const { searches: searches2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq14 } = await import("drizzle-orm");
      await db.update(searches2).set({ status: "completed", codesSearched: companyRows.length }).where(eq14(searches2.id, searchId));
    }
    send({
      status: "done",
      searchId,
      total: companyRows.length,
      skipped,
      isApolloExport,
      message: `Import complete. ${companyRows.length} companies saved directly from file \u2014 no Apollo API calls used.`
    });
  } catch (err) {
    console.error("[Excel Import] Fatal error:", err.message);
    send({ error: err.message });
  }
  res.end();
});
var excelImport_default = router4;

// server/routes/exportExcel.ts
init_db();
init_schema();
import { Router as Router4 } from "express";
import * as XLSX4 from "xlsx";
import { eq as eq11, and as and8, inArray as inArray6, isNotNull as isNotNull2 } from "drizzle-orm";
var router5 = Router4();
router5.get("/", async (req, res) => {
  try {
    const { searchId, companyIds: companyIdsParam } = req.query;
    const dbInstance = await getDb();
    if (!dbInstance) {
      res.status(500).json({ error: "Database unavailable" });
      return;
    }
    let rows;
    if (companyIdsParam) {
      const ids = companyIdsParam.split(",").map(Number).filter(Boolean);
      rows = await dbInstance.select().from(companies).where(inArray6(companies.id, ids));
    } else if (searchId) {
      rows = await dbInstance.select().from(companies).where(
        and8(
          eq11(companies.searchId, Number(searchId)),
          isNotNull2(companies.urgencyScore)
        )
      ).orderBy(companies.urgencyScore);
    } else {
      res.status(400).json({ error: "Provide searchId or companyIds" });
      return;
    }
    const companyIdList = rows.map((c) => c.id);
    const allContacts = companyIdList.length > 0 ? await dbInstance.select().from(contacts).where(inArray6(contacts.companyId, companyIdList)) : [];
    const topContactMap = /* @__PURE__ */ new Map();
    for (const c of allContacts) {
      if (!topContactMap.has(c.companyId)) {
        topContactMap.set(c.companyId, c);
      }
    }
    const wsRows = [];
    for (const company of rows) {
      let signals = [];
      try {
        if (company.briefData) {
          const brief = JSON.parse(company.briefData);
          signals = (brief.urgencySignals || []).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 3);
        }
      } catch {
      }
      const sig = (i) => signals[i] ?? null;
      const contact = topContactMap.get(company.id);
      wsRows.push({
        "Company": company.name ?? "",
        "Domain": company.primaryDomain ?? company.websiteUrl ?? "",
        "Industry": (() => {
          try {
            const m = company.sliceMetadata ? JSON.parse(company.sliceMetadata) : null;
            return m?.industry ?? "";
          } catch {
            return "";
          }
        })(),
        "Revenue (USD)": company.revenue ?? "",
        "Country": company.country ?? "",
        "Urgency Score": company.urgencyScore ?? "",
        "Fit Score": company.fitScore ?? "",
        // Signal 1
        "Signal 1 \u2014 Type": sig(0) ? `${sig(0).category ?? ""} / ${sig(0).type ?? ""}`.trim().replace(/^\/|\/$/g, "").trim() : "",
        "Signal 1 \u2014 Headline": sig(0)?.description ?? "",
        "Signal 1 \u2014 Snippet": sig(0)?.snippet ?? "",
        "Signal 1 \u2014 Source URL": sig(0)?.sourceUrl ?? "",
        "Signal 1 \u2014 Date": sig(0)?.detectedAt ?? "",
        // Signal 2
        "Signal 2 \u2014 Type": sig(1) ? `${sig(1).category ?? ""} / ${sig(1).type ?? ""}`.trim().replace(/^\/|\/$/g, "").trim() : "",
        "Signal 2 \u2014 Headline": sig(1)?.description ?? "",
        "Signal 2 \u2014 Snippet": sig(1)?.snippet ?? "",
        "Signal 2 \u2014 Source URL": sig(1)?.sourceUrl ?? "",
        "Signal 2 \u2014 Date": sig(1)?.detectedAt ?? "",
        // Signal 3
        "Signal 3 \u2014 Type": sig(2) ? `${sig(2).category ?? ""} / ${sig(2).type ?? ""}`.trim().replace(/^\/|\/$/g, "").trim() : "",
        "Signal 3 \u2014 Headline": sig(2)?.description ?? "",
        "Signal 3 \u2014 Snippet": sig(2)?.snippet ?? "",
        "Signal 3 \u2014 Source URL": sig(2)?.sourceUrl ?? "",
        "Signal 3 \u2014 Date": sig(2)?.detectedAt ?? "",
        // Top contact
        "Top Contact \u2014 Name": (contact?.fullName ?? `${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`).trim(),
        "Top Contact \u2014 Title": contact?.title ?? "",
        "Top Contact \u2014 LinkedIn": contact?.linkedinUrl ?? "",
        "Top Contact \u2014 Email": contact?.email ?? ""
      });
    }
    wsRows.sort((a, b) => Number(b["Urgency Score"] || 0) - Number(a["Urgency Score"] || 0));
    const wb = XLSX4.utils.book_new();
    const ws = XLSX4.utils.json_to_sheet(wsRows);
    const colWidths = [
      { wch: 30 },
      // Company
      { wch: 28 },
      // Domain
      { wch: 22 },
      // Industry
      { wch: 18 },
      // Revenue
      { wch: 12 },
      // Country
      { wch: 14 },
      // Urgency Score
      { wch: 10 },
      // Fit Score
      // Signal 1
      { wch: 22 },
      { wch: 45 },
      { wch: 60 },
      { wch: 55 },
      { wch: 12 },
      // Signal 2
      { wch: 22 },
      { wch: 45 },
      { wch: 60 },
      { wch: 55 },
      { wch: 12 },
      // Signal 3
      { wch: 22 },
      { wch: 45 },
      { wch: 60 },
      { wch: 55 },
      { wch: 12 },
      // Contact
      { wch: 28 },
      { wch: 32 },
      { wch: 50 },
      { wch: 36 }
    ];
    ws["!cols"] = colWidths;
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX4.utils.book_append_sheet(wb, ws, "Sales Intelligence");
    const buf = XLSX4.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `sales-intelligence-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("[exportExcel] Error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});
var exportExcel_default = router5;

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/routes/apolloWebhook.ts
init_db();
import { Router as Router5 } from "express";
var apolloWebhookRouter = Router5();
apolloWebhookRouter.post("/", async (req, res) => {
  const body = req.body;
  const rawPayload = JSON.stringify(body);
  console.log("[Apollo Webhook] Received payload:", rawPayload.slice(0, 500));
  try {
    const creditsConsumed = body?.credits_consumed ?? 0;
    const people = Array.isArray(body?.people) ? body.people : [];
    if (people.length > 0) {
      const results = [];
      for (const person2 of people) {
        const apolloPersonId = person2.id ?? "";
        const sanitizedPhone = person2.phone_numbers?.[0]?.sanitized_number || person2.phone_numbers?.[0]?.raw_number;
        console.log(
          `[Apollo Webhook] Person id=${apolloPersonId}, phone=${sanitizedPhone}, status=${person2.status}`
        );
        if (!apolloPersonId) {
          await insertWebhookLog({
            apolloStatus: body?.status,
            apolloPersonId: null,
            phoneDelivered: sanitizedPhone ?? null,
            contactId: null,
            contactName: null,
            updated: 0,
            failReason: "no_id",
            peopleCount: people.length,
            creditsConsumed,
            rawPayload
          });
          results.push({ apolloPersonId: "unknown", updated: false, reason: "no_id" });
          continue;
        }
        if (!sanitizedPhone) {
          await insertWebhookLog({
            apolloStatus: person2.status ?? body?.status,
            apolloPersonId,
            phoneDelivered: null,
            contactId: null,
            contactName: null,
            updated: 0,
            failReason: "no_phone",
            peopleCount: people.length,
            creditsConsumed,
            rawPayload
          });
          results.push({ apolloPersonId, updated: false, reason: "no_phone" });
          continue;
        }
        const contact = await getContactByApolloPersonId(apolloPersonId);
        if (!contact) {
          console.warn(`[Apollo Webhook] No contact found for Apollo person ID ${apolloPersonId}`);
          await insertWebhookLog({
            apolloStatus: person2.status ?? body?.status,
            apolloPersonId,
            phoneDelivered: sanitizedPhone,
            contactId: null,
            contactName: null,
            updated: 0,
            failReason: "contact_not_found",
            peopleCount: people.length,
            creditsConsumed,
            rawPayload
          });
          results.push({ apolloPersonId, updated: false, reason: "contact_not_found" });
          continue;
        }
        await updateContactPhone(contact.id, sanitizedPhone);
        await insertWebhookLog({
          apolloStatus: person2.status ?? body?.status,
          apolloPersonId,
          phoneDelivered: sanitizedPhone,
          contactId: contact.id,
          contactName: contact.fullName ?? null,
          updated: 1,
          failReason: null,
          peopleCount: people.length,
          creditsConsumed,
          rawPayload
        });
        console.log(
          `[Apollo Webhook] \u2705 Updated contact ${contact.id} (${contact.fullName}) with phone ${sanitizedPhone}`
        );
        results.push({ apolloPersonId, updated: true });
      }
      const anyUpdated = results.some((r) => r.updated);
      return res.status(200).json({ received: true, updated: anyUpdated, results });
    }
    const person = body?.person;
    if (person?.id) {
      const sanitizedPhone = person.sanitized_phone || person.phone_numbers?.[0]?.sanitized_number || person.phone_numbers?.[0]?.raw_number;
      if (sanitizedPhone) {
        const contact = await getContactByApolloPersonId(person.id);
        if (contact) {
          await updateContactPhone(contact.id, sanitizedPhone);
          await insertWebhookLog({
            apolloStatus: body?.status,
            apolloPersonId: person.id,
            phoneDelivered: sanitizedPhone,
            contactId: contact.id,
            contactName: contact.fullName ?? null,
            updated: 1,
            failReason: null,
            peopleCount: 1,
            creditsConsumed,
            rawPayload
          });
          console.log(`[Apollo Webhook] \u2705 (legacy) Updated contact ${contact.id} with phone ${sanitizedPhone}`);
          return res.status(200).json({ received: true, updated: true, contactId: contact.id });
        }
      }
    }
    console.warn("[Apollo Webhook] No people array or person object in payload");
    await insertWebhookLog({
      apolloStatus: body?.status ?? "unknown",
      apolloPersonId: null,
      phoneDelivered: null,
      contactId: null,
      contactName: null,
      updated: 0,
      failReason: "no_people",
      peopleCount: 0,
      creditsConsumed,
      rawPayload
    });
    return res.status(200).json({ received: true, updated: false, reason: "no_people" });
  } catch (error) {
    console.error("[Apollo Webhook] Error processing callback:", error);
    try {
      await insertWebhookLog({
        apolloStatus: "error",
        apolloPersonId: null,
        phoneDelivered: null,
        contactId: null,
        contactName: null,
        updated: 0,
        failReason: "error",
        peopleCount: 0,
        creditsConsumed: 0,
        rawPayload
      });
    } catch (_) {
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});
var apolloWebhook_default = apolloWebhookRouter;

// server/batchContactsAndReps.ts
init_schema();
import { inArray as inArray7 } from "drizzle-orm";
var CONTACTS_DELAY_MS = 1e3;
var REP_DELAY_MS = 500;
var CONCURRENCY_CONTACTS = 3;
var CONCURRENCY_REPS = 5;
var progress = {
  phase: "contacts",
  total: 0,
  processed: 0,
  skipped: 0,
  failed: 0,
  currentCompany: null
};
var isRunning = false;
function getBatchProgress() {
  return { ...progress, running: isRunning };
}
async function findContactsForCompany(company) {
  const { getContactsByCompanyId: getContactsByCompanyId2, createContact: createContact2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const existing = await getContactsByCompanyId2(company.id);
  if (existing.length > 0) {
    return { found: 0, skipped: true };
  }
  const domain = (company.primaryDomain || company.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) {
    return { found: 0, skipped: false };
  }
  const { trickleDownSearch: trickleDownSearch2 } = await Promise.resolve().then(() => (init_apolloPeopleSearch(), apolloPeopleSearch_exports));
  const result = await trickleDownSearch2(domain, company.name || "", 3, false);
  const seenEmails = /* @__PURE__ */ new Set();
  const seenNames = /* @__PURE__ */ new Set();
  let saved = 0;
  for (const contact of result.contacts) {
    const email = contact.email?.toLowerCase();
    const name = contact.name?.toLowerCase();
    if (email && seenEmails.has(email) || name && seenNames.has(name)) continue;
    try {
      await createContact2({
        companyId: company.id,
        apolloPersonId: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.name,
        title: contact.title,
        email: contact.email || null,
        phone: contact.phone || null,
        linkedinUrl: contact.linkedinUrl || null,
        searchedTitle: `Tier ${result.tierFound}: ${result.tierLabel}`
      });
      if (email) seenEmails.add(email);
      if (name) seenNames.add(name);
      saved++;
    } catch {
    }
  }
  return { found: saved, skipped: false };
}
async function generateSalesRepForCompany(companyId, userId) {
  const { getCompanyById: getCompanyById2, updateCompany: updateCompany2, getActiveBrain: getActiveBrain2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
  const company = await getCompanyById2(companyId);
  if (!company) return false;
  if (company.salesRepProfile && company.salesRepProfile.trim()) {
    return false;
  }
  let brainContext = "";
  let sellerName = "Your Company";
  try {
    const brain = await getActiveBrain2(userId);
    if (brain && brain.status === "completed") {
      sellerName = brain.companyName || sellerName;
      const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
      const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
      brainContext = `
SELLER: ${brain.companyName}
Offering: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp) => vp.proposition).join("; ")}
`;
    }
  } catch (_) {
  }
  const briefData = company.briefData ? typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData : null;
  const sliceMeta = company.sliceMetadata ? (() => {
    try {
      return JSON.parse(company.sliceMetadata);
    } catch {
      return {};
    }
  })() : {};
  const companyContext = briefData ? `
COMPANY: ${company.name}
Industry: ${sliceMeta.industry || "unknown"}
Size: ${sliceMeta.employeeBand || "unknown"}
Urgency Score: ${briefData.urgencyScore ?? "unknown"}
Key Signals: ${(briefData.urgencySignals || []).slice(0, 3).map((s) => s.description).join("; ")}
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

Be specific to this company \u2014 do NOT give generic advice. Write in plain prose, no bullet points, no headers.
Return ONLY the profile description.`;
  const response = await invokeLLM2({
    messages: [
      { role: "system", content: "You are a precise B2B sales coaching assistant. Return only the requested text, nothing else." },
      { role: "user", content: prompt }
    ]
  });
  const rawContent = response?.choices?.[0]?.message?.content;
  const profile = (typeof rawContent === "string" ? rawContent : "").trim();
  if (!profile) return false;
  await updateCompany2(companyId, {
    salesRepProfile: profile,
    salesRepProfileGeneratedAt: /* @__PURE__ */ new Date()
  });
  return true;
}
async function processInParallel(items, concurrency, delayMs, processor) {
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      await processor(items[i], i);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  });
  await Promise.all(workers);
}
async function runBatchContactsAndReps(searchIds, userId = 1) {
  if (isRunning) {
    console.log("[BatchCR] Already running, skipping");
    return;
  }
  isRunning = true;
  try {
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const db = await getDb2();
    if (!db) throw new Error("DB unavailable");
    const allCompanies = await db.select({
      id: companies.id,
      name: companies.name,
      primaryDomain: companies.primaryDomain,
      websiteUrl: companies.websiteUrl,
      salesRepProfile: companies.salesRepProfile
    }).from(companies).where(inArray7(companies.searchId, searchIds));
    console.log(`[BatchCR] Starting for ${allCompanies.length} companies across searches ${searchIds.join(", ")}`);
    progress = {
      phase: "contacts",
      total: allCompanies.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      currentCompany: null
    };
    console.log(`[BatchCR] Phase 1: Finding decision makers (1-3 per company)...`);
    await processInParallel(allCompanies, CONCURRENCY_CONTACTS, CONTACTS_DELAY_MS, async (company, i) => {
      progress.currentCompany = company.name;
      try {
        const result = await findContactsForCompany(company);
        if (result.skipped) {
          progress.skipped++;
          console.log(`[BatchCR] \u21A9 Contacts cached: ${company.name}`);
        } else if (result.found > 0) {
          progress.processed++;
          console.log(`[BatchCR] \u2713 Contacts: ${company.name} \u2192 ${result.found} decision makers`);
        } else {
          progress.failed++;
          console.log(`[BatchCR] \u2717 No contacts: ${company.name}`);
        }
      } catch (err) {
        progress.failed++;
        console.error(`[BatchCR] \u2717 Contact error for ${company.name}: ${err.message}`);
      }
    });
    console.log(`[BatchCR] Phase 1 complete: ${progress.processed} found, ${progress.skipped} cached, ${progress.failed} failed`);
    progress = {
      phase: "salesRep",
      total: allCompanies.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      currentCompany: null
    };
    console.log(`[BatchCR] Phase 2: Generating sales rep profiles...`);
    await processInParallel(allCompanies, CONCURRENCY_REPS, REP_DELAY_MS, async (company, i) => {
      progress.currentCompany = company.name;
      try {
        const generated = await generateSalesRepForCompany(company.id, userId);
        if (generated) {
          progress.processed++;
          console.log(`[BatchCR] \u2713 Sales rep: ${company.name}`);
        } else {
          progress.skipped++;
        }
      } catch (err) {
        progress.failed++;
        console.error(`[BatchCR] \u2717 Sales rep error for ${company.name}: ${err.message}`);
      }
    });
    console.log(`[BatchCR] Phase 2 complete: ${progress.processed} generated, ${progress.skipped} cached, ${progress.failed} failed`);
    progress.phase = "done";
    progress.currentCompany = null;
    console.log(`[BatchCR] \u2705 All done!`);
  } catch (err) {
    console.error(`[BatchCR] Fatal error:`, err.message);
  } finally {
    isRunning = false;
  }
}

// server/batchSignalOpeners.ts
init_db();
init_schema();
init_llm();
import { eq as eq13, sql as sql6 } from "drizzle-orm";
var batchSignalProgress = {
  running: false,
  phase: "idle",
  totalCompanies: 0,
  processedCompanies: 0,
  totalSignals: 0,
  generatedOpeners: 0,
  errors: 0
};
async function generateOpener(companyName, signal, brainContext, sellerName) {
  const prompt = `${brainContext}
You are crafting ONE sharp, specific B2B conversation opener for a sales rep at ${sellerName}.

TARGET COMPANY: ${companyName}

URGENCY SIGNAL:
- Category: ${signal.category}${signal.type ? ` / ${signal.type}` : ""}
- What happened: ${signal.description}
${signal.snippet ? `- Quote: "${signal.snippet}"` : ""}
${signal.sourceUrl ? `- Source: ${signal.sourceUrl}` : ""}

INSTRUCTIONS:
1. Write exactly ONE conversation opener (2-3 sentences max)
2. Reference the specific signal above \u2014 do NOT be generic
3. Connect the signal to a concrete pain point or opportunity ${sellerName} can address
4. End with a soft, open question
5. Tone: peer-to-peer, not salesy

Return ONLY the opener text. No labels, no JSON, no preamble.`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a precise B2B sales writing assistant. Return only the requested text, nothing else." },
      { role: "user", content: prompt }
    ]
  });
  const rawContent = response?.choices?.[0]?.message?.content;
  return (typeof rawContent === "string" ? rawContent : "").trim();
}
async function runBatchSignalOpeners() {
  if (batchSignalProgress.running) {
    console.log("[BatchSignalOpeners] Already running, skipping.");
    return;
  }
  batchSignalProgress.running = true;
  batchSignalProgress.phase = "loading";
  batchSignalProgress.errors = 0;
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const { offeringBrain: offeringBrain2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const brains = await db.select().from(offeringBrain2).where(eq13(offeringBrain2.status, "completed")).limit(1);
    let brainContext = "";
    let sellerName = "Your Company";
    if (brains.length > 0) {
      const brain = brains[0];
      sellerName = brain.companyName || sellerName;
      const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
      const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
      const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
      brainContext = `
YOU ARE A SALES REP FOR: ${brain.companyName}
Offering Summary: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
Pain Points We Solve: ${painPoints.join("; ")}
`;
    }
    const allCompanies = await db.select({
      id: companies.id,
      name: companies.name,
      briefData: companies.briefData,
      signalOpeners: companies.signalOpeners,
      searchId: companies.searchId
    }).from(companies).where(
      sql6`${companies.searchId} IN (1500002, 1500003) AND ${companies.briefData} IS NOT NULL AND ${companies.signalOpeners} IS NULL`
    );
    batchSignalProgress.totalCompanies = allCompanies.length;
    batchSignalProgress.processedCompanies = 0;
    batchSignalProgress.phase = "generating";
    let totalSignals = 0;
    for (const c of allCompanies) {
      try {
        const brief = JSON.parse(c.briefData);
        totalSignals += (brief.urgencySignals || []).length;
      } catch {
      }
    }
    batchSignalProgress.totalSignals = totalSignals;
    batchSignalProgress.generatedOpeners = 0;
    console.log(`[BatchSignalOpeners] Starting: ${allCompanies.length} companies, ~${totalSignals} signals`);
    const CONCURRENCY2 = 5;
    for (let i = 0; i < allCompanies.length; i += CONCURRENCY2) {
      const batch = allCompanies.slice(i, i + CONCURRENCY2);
      await Promise.all(batch.map(async (company) => {
        try {
          const brief = JSON.parse(company.briefData);
          const signals = brief.urgencySignals || [];
          if (signals.length === 0) {
            await db.update(companies).set({
              signalOpeners: JSON.stringify([]),
              signalOpenersGeneratedAt: /* @__PURE__ */ new Date()
            }).where(eq13(companies.id, company.id));
            batchSignalProgress.processedCompanies++;
            return;
          }
          const openers = [];
          for (let si = 0; si < signals.length; si++) {
            const signal = signals[si];
            try {
              const opener = await generateOpener(
                company.name,
                {
                  category: signal.category || signal.type || "",
                  type: signal.type,
                  description: signal.description || signal.headline || "",
                  snippet: signal.snippet,
                  sourceUrl: signal.sourceUrl
                },
                brainContext,
                sellerName
              );
              openers.push({
                signalIndex: si,
                category: signal.category || signal.type || "",
                description: signal.description || signal.headline || "",
                opener
              });
              batchSignalProgress.generatedOpeners++;
            } catch (err) {
              console.error(`[BatchSignalOpeners] Error for ${company.name} signal ${si}: ${err.message}`);
              batchSignalProgress.errors++;
              openers.push({
                signalIndex: si,
                category: signal.category || "",
                description: signal.description || "",
                opener: ""
              });
            }
          }
          await db.update(companies).set({
            signalOpeners: JSON.stringify(openers),
            signalOpenersGeneratedAt: /* @__PURE__ */ new Date()
          }).where(eq13(companies.id, company.id));
          batchSignalProgress.processedCompanies++;
          console.log(`[BatchSignalOpeners] \u2713 ${company.name} (${openers.length} openers) [${batchSignalProgress.processedCompanies}/${batchSignalProgress.totalCompanies}]`);
        } catch (err) {
          console.error(`[BatchSignalOpeners] Failed for ${company.name}: ${err.message}`);
          batchSignalProgress.errors++;
          batchSignalProgress.processedCompanies++;
        }
      }));
    }
    batchSignalProgress.phase = "done";
    console.log(`[BatchSignalOpeners] \u2705 Complete: ${batchSignalProgress.generatedOpeners} openers for ${batchSignalProgress.processedCompanies} companies (${batchSignalProgress.errors} errors)`);
  } catch (err) {
    console.error(`[BatchSignalOpeners] Fatal error: ${err.message}`);
    batchSignalProgress.phase = "error";
  } finally {
    batchSignalProgress.running = false;
  }
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use("/api/v1", api_default);
  app.use("/api/conference-import", conferenceImport_default);
  app.use("/api/excel-import", excelImport_default);
  app.use("/api/export-excel", exportExcel_default);
  app.use("/api/apollo-webhook", apolloWebhook_default);
  app.post("/api/batch-contacts-reps", (req, res) => {
    const { searchIds, userId } = req.body || {};
    if (!searchIds || !Array.isArray(searchIds)) {
      return res.status(400).json({ error: "searchIds array required" });
    }
    runBatchContactsAndReps(searchIds, userId || 1);
    res.json({ started: true, searchIds });
  });
  app.get("/api/batch-contacts-reps/progress", (_req, res) => {
    res.json(getBatchProgress());
  });
  app.post("/api/batch-signal-openers", (_req, res) => {
    runBatchSignalOpeners();
    res.json({ started: true });
  });
  app.get("/api/batch-signal-openers/progress", (_req, res) => {
    res.json(batchSignalProgress);
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Allow POST for query procedures so the client methodOverride: 'POST'
      // avoids 414 Request-URI Too Large on large batches
      allowMethodOverride: true
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.timeout = 18e4;
  server.keepAliveTimeout = 185e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startCampaignQueueWorker();
  });
}
startServer().catch(console.error);
