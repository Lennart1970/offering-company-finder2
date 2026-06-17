# LeadTrigger v1 — Database Architecture & Cutover Map

> Generated June 2026. Maps which v1 flows require MySQL (Manus TiDB), Supabase (PostgreSQL), or both — and the recommended cutover order toward Supabase-only on Railway.

---

## Executive summary

LeadTrigger v1 uses a **deliberate dual-database architecture**:

| MySQL / TiDB (Manus) | Supabase (PostgreSQL) |
|---|---|
| Operational pipeline store | Intelligence & vector search layer |
| Enrichment, scoring, content gen | Embeddings, similarity search |
| Integer `id` | UUID `id` + `mysql_id` bridge |
| Drizzle migrations (59+) | Manual SQL / dashboard |

**Verdict:** Maintainable as a **transitional** architecture, not as a long-term end state. The team has already chosen Supabase-only + Railway in `leadtriggerv2`.

---

## Critical finding: schema drift

The architecture doc (`references/db-architecture.md`) describes the **`lt_*` schema** (`lt_companies`, `lt_campaigns`, etc.), but **no server code queries those tables**. Everything still hits **`lt_mns_*`**:

| Supabase tables actually used in code | Role |
|---|---|
| `lt_mns_company_embeddings` | Vector store for FIT-SIM |
| `lt_mns_brain_embeddings` | Brain ICP vectors |
| `lt_mns_offering_brains` | Brain registry (partial source of truth) |
| `lt_mns_companies` | Sync target / campaign-from-brain source |
| `lt_mns_company_pages` | Intelligence page, Telegram, sync |
| `lt_mns_trigger_references` | News urgency ABC matching |
| `lt_mns_angles` | Brief angle lookup |
| `lt_mns_prospect_signals` / `lt_mns_prospect_contacts` | Sync outputs |
| `lt_mns_company_brain_scores` | Excel import audit |

**MySQL-only (moved off Supabase):** `share_feedback` — public share page feedback (`shareExt.getFeedback`, `POST /api/public/share-lists/feedback`).

`getDatabaseHealth` even notes that `lt_companies` **does not exist in this project**. Cutover is not just "stop using MySQL" — it's **finish the `lt_mns_*` → `lt_*` migration in code**, then collapse to one DB.

---

## Flow classification

### Tier A — Already Supabase-only (no MySQL needed)

These can run on Railway today if you point env vars at Supabase and skip `DATABASE_URL`.

| Flow | Entry point | Supabase tables |
|---|---|---|
| Trigger reference admin | `trigger.*` | `lt_mns_trigger_references`, feed tables |
| Brain vector search (read) | `campaignBrain.findByBrain`, `getFilterOptions`, `listBrains` | embeddings + RPC `match_companies_to_embedding` |
| Intelligence list (read) | `getIntelligenceCompanies`, `getIntelligenceCampaigns`, `getIntelligenceBusinessUnits` | `lt_mns_company_pages` (brain filter optionally hits MySQL) |
| Telegram delivery | `telegram.sendAllHigh`, `sendCompanyCard` | `lt_mns_company_pages` |
| Angles lookup (inside brief gen) | `briefGenerator` | `lt_mns_angles` (read only) |

**Cutover effort:** Low — mostly env + deploy. **Caveat:** Intelligence brain filter and campaign metadata still lean on MySQL when `brainName` is used.

---

### Tier B — MySQL-only today (need data migration, not logic rewrite)

These use Drizzle/`getDb()` only. On Supabase-only, you'd **move the tables** and swap Drizzle dialect — the business logic stays similar.

| Domain | Procedures / routes | MySQL tables |
|---|---|---|
| **Auth & users** | Manus OAuth → `db.upsertUser`, `auth.me` | `users` |
| **Campaign lifecycle** | `startSearch`, `confirmAndSearch`, `doAll`, `doNext10`, `getSearch*`, `archiveSearch` | `searches`, `companies`, `batch_jobs` |
| **Company database UI** | `getCompanyDb`, `getCompanyDbMeta`, `getCompany`, `getAdjacentCompany` | `companies`, `searches` |
| **Enrichment pipeline** | `enrichAll`, `enrichSingle`, Apollo webhooks | `companies` |
| **Content generation** | `generateBrief`, `generateSalesApproach`, `batchGenerateBriefs`, etc. | `companies` (writes JSON blobs) |
| **LLM fit scoring** | `scoreCompanyFit`, campaign queue step 1 | `companies.fitScore*` |
| **Contacts** | `findContact`, `getContact`, `findAllCSuite`, `enrichContact` | `contacts` |
| **HITL / decisions** | `submitDecision`, `getDecision`, `getExcludedCodes` | `companyDecisions`, `excludedCodes` |
| **Call Today / outcomes** | `getCallToday`, `logCallOutcome`, `getNurtureList` | `companies`, `callOutcomes` |
| **Brains (CRUD)** | `researchBrain`, `updateBrain`, `getBrain*`, `deleteBrain` | `offering_brain` |
| **Share links (core)** | `share.createShareList`, `resolveToken`, `resolveListToken` | `share_tokens`, `share_lists`, `share_list_items`, `companies`, `offering_brain` |
| **Share feedback** | `shareExt.getFeedback`, `POST /api/public/share-lists/feedback` | `share_feedback` |
| **Campaign queue worker** | Background worker (steps 0, 1, 2, 3) | `campaign_queue`, `companies` |
| **Niches / segments** | `niche.*` | `niches`, `companies` |
| **Imports** | `importCampaignFromCSV`, `/api/excel-import`, conference import | `searches`, `companies` |
| **CG CRM lookup** | `cgLead.lookup` | `lt_mns_cg_leads` (in MySQL!) |
| **Misc** | BOM, prototype, leadinfo, sales materials, webhook logs, code descriptions | respective `*_` tables |

**Cutover effort:** Medium–high — bulk of row data lives here (~37k companies + all campaign state). This is the **data migration** work.

---

### Tier C — Cross-DB (hardest; refactor or gate last)

These **read one DB and write the other** in the same request/job. They block a clean Supabase-only cutover until redesigned.

| Flow | What happens | MySQL | Supabase |
|---|---|---|---|
| **Embed-on-import** | Campaign queue step 0.5 | writes `similarityScore` | upserts embedding, reads brain vector |
| **Bulk FIT-SIM** | `runSimilarityScoring` | bulk update scores | read embeddings + brain |
| **Bulk news urgency** | `runNewsUrgencyScoring` | bulk update urgency | read trigger references |
| **Excel import scoring** | `routes/excelImport.ts` | writes `similarityScore` | embeddings + brain scores |
| **Company lookalike** | `companySimilaritySearch` + create campaign | creates search/companies | scans embeddings |
| **Brain → campaign** | `campaignBrain.createCampaignFromBrain` | creates search + companies | reads `lt_mns_companies` |
| **Sync suite** | `syncToSupabase`, `syncCompanyPages`, `pushBrainToSupabase` | reads pipeline data | upserts `lt_mns_*` |
| **Set active brain** | `setActiveBrain` | `offering_brain.isActive` | `lt_mns_offering_brains.is_active` |
| **Brain pull/push** | `pushBrainToSupabase`, `pullBrainFromSupabase` | bidirectional sync | bidirectional sync |
| **Database health** | `getDatabaseHealth` | all KPIs | sync coverage stats |
| **Intelligence + brain filter** | `getIntelligenceCompanies` | resolves campaign IDs by brain | queries pages |

**Cutover effort:** High — these become **single-DB transactions** once everything lives in Postgres (embed → score → store in one place).

---

### Tier D — Manus platform lock (beyond databases)

Even with Supabase-only data, v1 still depends on Manus for:

| Concern | Where |
|---|---|
| OAuth / sessions | `server/_core/sdk.ts` (Manus WebDev auth) |
| File storage | `server/storage.ts` (Forge proxy) |
| Hosting / `DATABASE_URL` | `.project-config.json`, Manus TiDB gateway |
| Vite plugin | `vite.config.ts` |

Railway cutover needs replacements for **auth** and **storage**, not just the DB.

---

## Dependency map

```
MySQL (TiDB)                          Supabase (PostgreSQL)
─────────────────────────────         ──────────────────────────────────────
companies          ──mysql_id──►      lt_companies  (doc only — not in code yet)
  id (PK)                               lt_mns_companies (what code actually uses)
  apolloId                              lt_mns_company_embeddings
  fitScore, urgencyScore, briefData     lt_mns_company_pages
  ...all pipeline cols                  lt_mns_offering_brains
                                        lt_mns_trigger_references

share_feedback (MySQL) — share page recipient ratings; moved off Supabase June 2026

Cross-DB hot path:
  Campaign queue → embedOnImport → Supabase embed + MySQL score
  Bulk similarity / news urgency → Supabase read + MySQL write
  supabaseSync → MySQL read → Supabase upsert
  setActiveBrain → writes BOTH
```

---

## Recommended cutover order

### Phase 0 — Stabilize schema (before any DB removal)

1. Pick one Supabase schema: **`lt_*` (per arch doc) or stay on `lt_mns_*`** — code and doc currently disagree.
2. Update all `lt_mns_*` references OR finish `syncMySQLToLtCompanies()` and switch reads.
3. Fix health/sync surfaces that query dropped tables.

### Phase 1 — Portable sidecars (can run without MySQL)

Deploy on Railway **in parallel** with v1:

- `triggerRouter`
- `campaignBrain.findByBrain` / `listBrains` (read-only)
- Intelligence page reads
- Telegram sender

**Gate:** None of these are the main product loop, but they prove Supabase + Railway.

### Phase 2 — Move MySQL tables to Supabase

Migrate in dependency order:

1. `users` (+ replace Manus OAuth)
2. `offering_brain`
3. `searches` → `lt_campaigns`
4. `companies` → `lt_companies` (with `embedding` column inline — drop separate embeddings table?)
5. `contacts`, `campaign_queue`, `batch_jobs`
6. Share tables (`share_tokens`, etc.) — or consolidate with `lt_share_*`
7. Everything else (niches, decisions, CG leads, BOM, …)

### Phase 3 — Collapse cross-DB services

Rewrite as single-DB:

1. `embedOnImport` → embed + score in one upsert to `lt_companies`
2. `bulkSimilarityService` → SQL/pgvector or RPC only
3. `bulkNewsUrgencyService` → same
4. Delete `supabaseSync.ts` (no more sync layer)
5. `setActiveBrain` → one table, one write

### Phase 4 — Decommission

- Remove `DATABASE_URL` / Drizzle MySQL
- Remove Manus vite plugin + OAuth
- Point DNS from Manus → Railway

---

## Product split by importance

| Category | Share of core loop | DB today |
|---|---|---|
| Search → enrich → score → brief → share | ~80% | **MySQL primary**, Supabase for vectors |
| Intelligence / Telegram / triggers | ~10% | **Supabase primary** |
| Admin sync / health / bulk jobs | ~10% | **Both** |

**You cannot drop MySQL without migrating the campaign pipeline first.** You *can* drop MySQL for the intelligence/distribution slice much sooner.

---

## "Can we run Supabase-only tomorrow?" checklist

| Question | Answer |
|---|---|
| Can users log in? | **No** — needs MySQL `users` + Manus OAuth |
| Can they start a new search? | **No** — `searches` / `companies` in MySQL |
| Can they view SearchResults? | **No** |
| Can they run FIT-SIM on import? | **No** — cross-DB |
| Can they use Intelligence page? | **Mostly yes** — if campaigns already synced to `lt_mns_company_pages` |
| Can they send Telegram cards? | **Yes** — Supabase-only |
| Can recipients open share links? | **No** — tokens + company data in MySQL |
| Can super-admins use trigger review? | **Yes** — Supabase-only |
| Can they create campaign from brain similarity? | **No** — writes MySQL |

---

## Highest-leverage next steps

1. **Resolve schema drift** — code uses `lt_mns_*`, doc says `lt_*`; nothing queries `lt_companies` yet.
2. **Migrate `companies` + `searches` + `offering_brain` first** — unlocks 80% of the product.
3. **Inline embeddings** into `lt_companies.embedding` — kills `embedOnImport` cross-DB hop.
4. **Replace Manus auth** before calling it "Supabase-only" — DB migration alone isn't enough.
5. **Use `leadtriggerv2` as the target** for net-new work; treat v1 as the migration source.

---

## Related docs

- `references/db-architecture.md` — intended dual-DB boundary (partially stale vs live code)
- `ELON-REVIEW.md` — strategic decision for Supabase-only + Railway via leadtriggerv2
- `leadtriggerv2/RAILWAY-SUPABASE-ONLY-CUTOVER-PLAN.md` — phased migration plan (sibling repo)
