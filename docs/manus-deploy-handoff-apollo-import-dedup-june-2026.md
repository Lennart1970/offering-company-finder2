# Manus Deploy Handoff — Apollo Import Dedup & Campaign Linking (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `392f889` — *Dedupe Apollo imports globally and link existing companies to campaigns without duplicating rows.* |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Global Apollo import dedup** — Apollo CSV / Excel uploads no longer blindly insert duplicate `companies` rows. Match globally by `apolloId`, then `normalizedDomain`.
2. **Upsert preserves enrichment** — On match, firmographics refresh; scores, briefs, brain metadata, and CG CRM fields are **not** overwritten.
3. **Campaign linking without row duplication** — New junction table `search_company_memberships` links existing companies to a new campaign so the full import list appears in Search Results.
4. **Campaign queries include linked companies** — Search results, counts, queue enqueue, export, Leadinfo match, bulk similarity, and per-search Supabase sync all use native `searchId` **or** membership links.

**Requires MySQL migration `0068_search_company_memberships.sql`.**  
**Do not run this migration in Supabase** (PostgreSQL rejects backtick syntax).

---

## Step 1 — Sync from GitHub

Use GitHub `main` as the single source of truth. Do **not** deploy from old sandbox checkpoint commits.

```bash
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline
```

Then:

1. `npm run build` (must pass `tsc --noEmit` via `prebuild` — 0 errors)
2. Publish / deploy the Manus WebDev app
3. Confirm `client/public/__manus__/version.json` reflects the deployed commit hash

---

## Step 2 — Database migrations (MySQL / TiDB only)

### ⚠️ Run on TiDB (`DATABASE_URL`), NOT Supabase SQL editor

Supabase uses PostgreSQL. This migration uses MySQL backticks and references `companies` / `searches` on TiDB.  
Supabase already has `lt_campaign_companies` for the read replica — **no Supabase migration for this feature.**

### Verify current state

```sql
SHOW TABLES LIKE 'search_company_memberships';
```

If the table exists, **skip** migration (idempotent deploy).

### Migration to apply

| Migration file | Creates / changes | Skip if |
|----------------|-------------------|---------|
| `drizzle/0068_search_company_memberships.sql` | Junction table `search_company_memberships` (`searchId`, `companyId`, unique pair) | `SHOW TABLES` already returns the table |

**Manual SQL** (TiDB / MySQL console — omit `--> statement-breakpoint` lines):

```sql
CREATE TABLE `search_company_memberships` (
  `id` int AUTO_INCREMENT NOT NULL,
  `searchId` int NOT NULL,
  `companyId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `search_company_memberships_id` PRIMARY KEY(`id`),
  CONSTRAINT `search_company_memberships_search_company_unique` UNIQUE(`searchId`,`companyId`)
);

ALTER TABLE `search_company_memberships`
  ADD CONSTRAINT `search_company_memberships_searchId_searches_id_fk`
  FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE CASCADE;

ALTER TABLE `search_company_memberships`
  ADD CONSTRAINT `search_company_memberships_companyId_companies_id_fk`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE;
```

Confirm:

```sql
DESCRIBE search_company_memberships;
```

**Note:** `0068` is not yet in `drizzle/meta/_journal.json` — apply SQL manually on TiDB; do not rely on `db:push` until journal is updated in a follow-up commit.

---

## Step 3 — Config & env

**No new environment variables.**

| Var | Used for |
|-----|----------|
| `DATABASE_URL` | TiDB — `search_company_memberships`, import upsert |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Unchanged — embeddings / sync |

---

## Step 4 — Smoke tests (production)

### A. Apollo Excel import — new companies only

1. **Intelligence** → **Excel Import** (or `/excel-import`).
2. Upload a small Apollo CSV with companies **not** already in DB; name a new campaign.
3. **Expected:** Progress log shows `N new`; campaign opens with `N` companies in Search Results.

### B. Apollo import — re-import / overlap (critical)

1. Upload a CSV where most rows already exist (same Apollo Account Id or domain) into a **new** campaign name.
2. **Expected:** Progress shows e.g. `0 new, X linked, Y updated` (not `1000 new`).
3. Open the new campaign → **company count matches CSV row count** (linked + new).
4. Open an **old** campaign that owned those companies → companies still there; **scores and briefs unchanged**.

### C. Campaign list counts

1. Home / campaign list after import B.
2. **Expected:** New campaign `companyCount` reflects linked + inserted (not only inserted).

### D. Enrich / queue regression

1. On a campaign with linked companies, run **Enqueue** / pipeline if applicable.
2. **Expected:** Linked companies appear in queue (same as native members).

### E. Regression — Import Campaign (tRPC CSV path)

1. Legacy **Import Campaign** flow with Apollo CSV.
2. **Expected:** Toast mentions `new`, `linked`, `updated`; clustering still starts.

---

## Architecture notes (do not change unless asked)

| Concept | Store | Notes |
|---------|-------|-------|
| Canonical company row | MySQL `companies` | One row per Apollo org; `searchId` = **home** campaign |
| Extra campaign membership | MySQL `search_company_memberships` | Many-to-many without cloning rows |
| Import upsert logic | `server/importCompaniesUpsert.ts` | Used by excel import, API CSV, `importCampaignFromCSV` |
| Campaign membership query | `companyBelongsToSearch()` in `server/db.ts` | Native OR junction |
| Supabase campaign links | `lt_campaign_companies` | Separate replica schema — **not** this migration |

**Import stats fields:** `inserted`, `linked`, `updated`, `unchanged`, `dedupedInFile`.

**Known gaps (intentional):**

- Historical duplicate `companies` rows created **before** this release are not auto-cleaned; use existing **Deduplicate search** / ghost purge tools if needed.
- `drizzle/meta` journal for `0068` may lag — manual SQL on TiDB is authoritative for this deploy.

---

## What not to do

| Don't | Why |
|-------|-----|
| Run `0068_*.sql` in **Supabase** SQL editor | PostgreSQL syntax error at backticks; wrong database |
| Create duplicate `companies` rows on import | Defeats this release |
| Move `companies.searchId` on link | Would orphan home campaign; use junction only |
| Deploy from sandbox checkpoint instead of GitHub `main` | Drift / missing files |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `drizzle/0068_search_company_memberships.sql` | **New** — TiDB migration |
| `drizzle/schema.ts` | `searchCompanyMemberships` table |
| `server/importCompaniesUpsert.ts` | **New** — global dedup, upsert, link |
| `server/importCompaniesUpsert.test.ts` | **New** — unit tests |
| `server/db.ts` | `companyBelongsToSearch`, `linkCompaniesToSearch`, `getCompanyCountsBySearchIds` |
| `server/routes/excelImport.ts` | Uses upsert + link |
| `server/routes/api.ts` | API CSV import uses upsert |
| `server/companyFinder.ts` | `importCampaignFromCSV` + campaign list counts |
| `server/campaignQueueRouter.ts` | Queue includes linked companies |
| `server/leadinfoRouter.ts` | Match includes linked companies |
| `server/bulkSimilarityService.ts` | Campaign mode includes linked |
| `server/supabaseSync.ts` | `syncSearchRunToSupabase` includes linked IDs |
| `server/routes/exportExcel.ts` | Export includes linked |
| `client/src/pages/ExcelImport.tsx` | Progress UI: new / linked / updated |
| `client/src/pages/ImportCampaign.tsx` | Toast: linked count |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migration `0068` applied on **TiDB** (paste `SHOW TABLES` output)
- [ ] Confirmed **not** run on Supabase
- [ ] Smoke test A — new import
- [ ] Smoke test B — overlap / linked count
- [ ] Smoke test C — campaign list count
- [ ] `npm run build` / `tsc --noEmit`: 0 errors

Include: migration output, test campaign `searchId`, screenshot of import progress log if possible.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `syntax error at or near "\`"` | Migration run on Supabase instead of TiDB |
| New campaign shows only a few companies after big CSV | Migration missing — links not created; run `0068` on TiDB |
| `Table 'search_company_memberships' doesn't exist` | App deployed before migration |
| Import still creates thousands of duplicates | Old build without `importCompaniesUpsert.ts` |
| Companies missing from queue | Old build; `campaignQueueRouter` not using `companyBelongsToSearch` |

---

## Manus engineer quick instructions (paste-ready)

```
1. git pull origin main && git log -1 --oneline
2. npm run build (0 TS errors)
3. Publish Manus WebDev app
4. On TiDB ONLY (not Supabase): SHOW TABLES LIKE 'search_company_memberships';
   if missing, run drizzle/0068_search_company_memberships.sql (MySQL syntax)
5. Smoke test: Apollo Excel import into NEW campaign with CSV that overlaps existing DB
   → expect "linked" count + full company list in campaign
6. Reply with: commit hash, TiDB migration output, checklist from handover doc
```

---

## Related docs

- [`docs/database_mess.md`](database_mess.md) — dual-DB map
- [`references/db-architecture.md`](../references/db-architecture.md) — `lt_campaign_companies` on Supabase vs MySQL `companies`
- [`docs/manus-deploy-handoff-june-2026.md`](manus-deploy-handoff-june-2026.md) — prior handoff index
