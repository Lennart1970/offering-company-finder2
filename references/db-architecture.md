# Database Architecture Reference

> **Status:** Active — last updated June 2026  
> **Purpose:** Defines the authoritative boundary between MySQL (operational pipeline) and Supabase (intelligence & vector layer). All new features must respect this boundary.

---

## Overview

LeadTrigger uses a **dual-database architecture**. The two databases serve fundamentally different purposes and should not be treated as mirrors of each other.

| Dimension | MySQL / TiDB (Manus built-in) | Supabase (PostgreSQL) |
|---|---|---|
| **Role** | Operational pipeline store | Intelligence & vector search layer |
| **Primary key style** | Auto-increment integer `id` | UUID `id` + `mysql_id` FK bridge |
| **Writes** | All pipeline jobs (enrichment, scoring, content gen) | Sync jobs, campaign creation, vector upserts |
| **Reads** | All tRPC procedures, scoring loops, bulk jobs | Intelligence page, vector search, Telegram delivery |
| **Embedding / pgvector** | No | Yes — `lt_companies.embedding` (1536-dim) |
| **Schema management** | Drizzle ORM migrations | Manual SQL + Supabase dashboard |

---

## MySQL Tables (source of truth for pipeline)

| Table | Description |
|---|---|
| `companies` | Master company store — all enrichment, scoring, and content generation columns live here |
| `searches` | Campaign metadata (offering, brain, status, timestamps) |
| `offering_brain` | Brain definitions (ICP, scoring rubrics, embeddings) |
| `contacts` | Apollo-fetched contacts per company |
| `company_pages` | Lightweight page-link records for the company pages sync |

---

## Supabase Tables (live schema as of June 2026)

### Core tables

| Table | Rows (Jun 2026) | Description |
|---|---|---|
| `lt_companies` | ~37,000 | **Master registry.** One row per company. `mysql_id` is a FK bridge back to MySQL `companies.id`. Contains identity fields (apollo_id, domain, linkedin_url, country, embedding) but **not** scoring or content columns — those stay in MySQL. |
| `lt_campaign_companies` | ~1,530 | **Campaign enrichment layer.** Many-to-many join between `lt_campaigns` and `lt_companies`. Holds fit_score, urgency_score, brief_data, sales_approach_data, signal_openers. |
| `lt_campaigns` | ~74 | Campaign metadata synced from MySQL `searches`. `mysql_id` bridges back to MySQL. |
| `lt_brains` | — | Brain definitions synced from MySQL `offering_brain`. |
| `lt_contacts` | — | Contacts synced from MySQL `contacts`. |
| `lt_share_*` | — | Share token, list, and access log tables (Supabase-native, no MySQL equivalent). |

### Legacy tables (do not write to)

| Table | Status | Notes |
|---|---|---|
| `lt_mns_companies` | **DOES NOT EXIST** | Was dropped during the migration to the `lt_*` schema. Any code referencing this table will fail silently via the Supabase REST API returning a cached count. |
| `lt_mns_company_pages` | Still exists | Used by the company pages sync (`syncCompanyPagesToSupabase`). Not yet migrated to the `lt_*` schema. Safe to read/write until migration is complete. |

---

## Duplication Analysis (June 2026)

Ran against `lt_companies`:

| Metric | Value | Interpretation |
|---|---|---|
| Total rows | 37,008 | |
| Distinct `mysql_id` | 37,008 | **No duplicates** — every row maps to a unique MySQL company |
| Distinct `apollo_id` | 35,944 | 206 apollo_ids appear >1 time — same Apollo company imported under different MySQL IDs across campaigns. Expected, not a data integrity problem. |
| Distinct domain | 33,282 | Domain unique constraint enforced — no domain duplicates |
| Orphan companies (no campaign link) | 35,616 (96%) | Synced for vector search / embedding purposes, not active campaign targets |
| `lt_campaign_companies` rows | 1,530 | Only 1,392 distinct companies are actively linked to campaigns |

**Conclusion:** `lt_companies` is clean. The 157% coverage figure previously shown in the DB Health page was caused by the health procedure querying the non-existent `lt_mns_companies` table, which returned a stale cached count of 85,113.

---

## Deprecated Functions

The following functions in `server/supabaseSync.ts` target `lt_mns_companies` and **must not be called**:

| Function | Status | Replacement |
|---|---|---|
| `syncAllCompaniesToSupabase()` | **DEPRECATED** | No direct replacement yet. Future sync should target `lt_companies` via upsert on `mysql_id`. |
| `getCompaniesTableSyncStats()` | **REPLACED** | The tRPC procedure `getCompaniesTableSyncStats` now queries `lt_companies` directly. |

The tRPC procedure `syncAllCompanies` now returns a deprecation warning message instead of running the broken sync.

---

## Recommended Next Steps

1. **Implement `syncMySQLToLtCompanies()`** — a new sync function that upserts MySQL `companies` rows into `lt_companies` using `mysql_id` as the conflict key. This replaces the dead `syncAllCompaniesToSupabase()`.
2. **Migrate `lt_mns_company_pages`** — once the company pages pipeline is stable, migrate to an `lt_company_pages` table following the same `mysql_id` FK pattern.
3. **Add a unique constraint on `(apollo_id, mysql_id)`** in `lt_companies` to prevent the 206 cross-campaign apollo_id duplicates from accumulating further.
4. **Remove `syncAllCompaniesToSupabase` and `getCompaniesTableSyncStats` from `supabaseSync.ts`** once the SyncPage UI has been updated to reflect the new architecture.

---

## Architecture Diagram

```
MySQL (TiDB)                          Supabase (PostgreSQL)
─────────────────────────────         ──────────────────────────────────────
companies          ──mysql_id──►      lt_companies  (master registry)
  id (PK)                               id (UUID, PK)
  apolloId                              mysql_id (FK → MySQL companies.id)
  fitScore                              apollo_id
  urgencyScoreLLM                       domain
  briefGeneratedAt                      embedding (pgvector 1536-dim)
  ...all pipeline cols                  ...identity cols only

searches           ──mysql_id──►      lt_campaigns
  id (PK)                               id (UUID, PK)
  offeringName                          mysql_id (FK → MySQL searches.id)
  status                                offering_name
  ...                                   ...

offering_brain     ──mysql_id──►      lt_brains
                                        id (UUID, PK)
                                        mysql_id

                                      lt_campaign_companies  (enrichment)
                                        campaign_id → lt_campaigns.id
                                        company_id  → lt_companies.id
                                        fit_score
                                        urgency_score
                                        brief_data (JSONB)
                                        sales_approach_data (JSONB)
                                        signal_openers (JSONB)

                                      lt_mns_company_pages  (legacy, still active)
                                        synced_at
                                        ...

                                      lt_share_*  (Supabase-native, no MySQL equiv)
```
