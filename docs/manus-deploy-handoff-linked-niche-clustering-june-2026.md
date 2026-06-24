# Manus Deploy Handoff — Apollo Import: Niche Clustering & FIT-SIM (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `PLACEHOLDER_COMMIT` — pull `main` and confirm with `git log -1 --oneline` |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Niche clustering includes linked companies** — `nicheRouter` now loads campaign companies via `getCompaniesBySearchId()` (native `searchId` **or** `search_company_memberships`). Fixes companies like Westfalia-Automotive GmbH that were dedup-linked on import but invisible to k-means.
2. **Procedures updated** — `clusterAndSaveNiches`, `getUnassignedCount`, `assignRemainingCompanies`, `expandClusterSample` all use the same membership-aware query.
3. **One-off backfill script** — `scripts/backfill-linked-niche-assignments.mts` assigns `nicheId` for linked companies on campaigns that were clustered **before** the niche fix (embed + nearest-centroid, same type-split as Phase 2).
4. **FIT-SIM embeddings on Apollo CSV import** — `POST /api/v1/import-csv` and tRPC `importCampaignFromCSV` now schedule background embedding persistence to Supabase `lt_mns_company_embeddings` via `scheduleSearchEmbeddingsOnImport()`. Fixes “No embedding found” on lookalike search after Apollo CSV import (Excel import already had this; CSV API/UI paths did not).

**No new MySQL migrations.** Depends on `0068_search_company_memberships` from the prior Apollo dedup release (table must already exist on TiDB).

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

## Step 2 — Database migrations (MySQL / TiDB)

**None for this release.**

Verify prerequisite from Apollo dedup release:

```sql
SHOW TABLES LIKE 'search_company_memberships';
```

If missing, apply `drizzle/0068_search_company_memberships.sql` on TiDB first (see [`manus-deploy-handoff-apollo-import-dedup-june-2026.md`](manus-deploy-handoff-apollo-import-dedup-june-2026.md)).

---

## Step 3 — Post-deploy backfill (optional but recommended)

Campaigns clustered **before** this deploy still have linked companies without `nicheId`. Run on the Manus server (or any host with `DATABASE_URL` + `OPENAI_API_KEY`):

```bash
# Preview one campaign
npx tsx scripts/backfill-linked-niche-assignments.mts --searchId <SEARCH_ID> --dry-run

# Fix one campaign
npx tsx scripts/backfill-linked-niche-assignments.mts --searchId <SEARCH_ID>

# Fix all campaigns that have niches with centroids
npx tsx scripts/backfill-linked-niche-assignments.mts --all
```

**What it does:** finds companies in the campaign (native + linked) with `nicheId` NULL or pointing at a niche from another campaign → OpenAI embed → assign to nearest existing niche centroid → refresh `niches.companyCount`.

**Does not** write Supabase FIT-SIM embeddings. For campaigns imported **before** the FIT-SIM CSV fix, use `scripts/embed-missing-companies.mjs` or bulk FIT-SIM in the UI.

---

## Step 3b — FIT-SIM after Apollo CSV import (automatic on new imports)

After deploy, new Apollo CSV imports (UI **Import Campaign** or `POST /api/v1/import-csv`) automatically run a **background** job:

1. `getCompaniesBySearchId(searchId)` — native + linked companies
2. `generateEmbeddings()` → `persistCompanyEmbeddings()` → Supabase `lt_mns_company_embeddings`

**Wait ~5–10s per 100 companies** before testing lookalikes. Check server logs for:

```
[CSV Import] ✓ Persisted N FIT-SIM embeddings to Supabase (search <id>)
```

**Does not require an active Brain** (vectors only; `similarityScore` in MySQL is still set by Excel import brain-scoring or bulk FIT-SIM separately).

**Campaigns imported before this deploy:** run `node scripts/embed-missing-companies.mjs` or re-import is not needed — embed script backfills missing Supabase rows.

---

## Step 4 — Config & env

**No new environment variables.**

| Var | Used for |
|-----|----------|
| `DATABASE_URL` | TiDB — companies, niches, `search_company_memberships` |
| `OPENAI_API_KEY` | Backfill script, k-means, **and** Apollo CSV FIT-SIM background embed |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **Required** for FIT-SIM persistence and lookalike RPC |

---

## Step 5 — Smoke tests (production)

### A. Linked company appears in Market Segments after re-cluster

1. Pick a campaign that imported overlapping Apollo rows (`X from database` / `linked` in import summary) and already has niches.
2. **Market Segments** → **Discover Niches** (re-run clustering) **or** **Assign Remaining**.
3. **Expected:** Unassigned count includes linked companies; after assign, a previously missing linked company (e.g. Westfalia-Automotive GmbH) has a `nicheId` and appears under a segment.

### B. Unassigned count matches Search Results

1. Open a campaign with both new inserts and linked existing companies.
2. Compare company count on Search Results vs Market Segments unassigned + assigned totals.
3. **Expected:** Totals align (no “ghost” companies only visible in Search Results).

### C. Backfill script (if run)

```sql
-- Replace <SEARCH_ID> and company name
SELECT c.id, c.name, c.searchId, c.nicheId, n.searchId AS niche_searchId, n.name AS niche_name
FROM companies c
LEFT JOIN search_company_memberships m ON m.companyId = c.id AND m.searchId = <SEARCH_ID>
LEFT JOIN niches n ON n.id = c.nicheId
WHERE c.name LIKE '%Westfalia%Automotive%'
  AND (c.searchId = <SEARCH_ID> OR m.searchId = <SEARCH_ID>);
```

**Expected after backfill:** `nicheId` set; `niche_searchId` = campaign `searchId`.

### D. Lookalike works after Apollo CSV import

1. **Import Campaign** (or `POST /api/v1/import-csv`) with a small Apollo CSV.
2. Wait for log line `Persisted N FIT-SIM embeddings` (or ~30s for small files).
3. Open a company in Search Results → **Find similar** (lookalike modal).
4. **Expected:** Similar companies list loads — **not** “No embedding found”.

---

## Architecture notes (do not change unless asked)

| Concept | Store | Notes |
|---------|-------|-------|
| Campaign membership | `search_company_memberships` | Many-to-many; `companies.searchId` stays **home** campaign |
| Niche clustering embeddings | In-memory OpenAI only | k-means does **not** persist to `lt_mns_company_embeddings` |
| FIT-SIM embeddings | Supabase `lt_mns_company_embeddings` | Excel import, **Apollo CSV import** (`scheduleSearchEmbeddingsOnImport`), or `embed-missing-companies.mjs` |
| `nicheId` on `companies` | Global per company row | Assigning a linked company to a campaign niche overwrites prior `nicheId` (pre-existing design) |

**Related prior release:** [`manus-deploy-handoff-apollo-import-dedup-june-2026.md`](manus-deploy-handoff-apollo-import-dedup-june-2026.md) — junction table + import dedup; this release closes the niche-router gap called out there.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint instead of GitHub `main` | Drift / missing `nicheRouter` fix |
| Expect k-means alone to create FIT-SIM scores | Clustering embeddings are ephemeral |
| Re-run `0068` on Supabase | MySQL/TiDB only |
| Move `companies.searchId` when linking | Use junction table only |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/nicheRouter.ts` | Use `getCompaniesBySearchId()` for cluster, unassigned count, assign remaining, expand sample |
| `server/supabaseEmbeddings.ts` | `embedAndPersistCompaniesForSearch`, `scheduleSearchEmbeddingsOnImport` |
| `server/routes/api.ts` | `POST /api/v1/import-csv` schedules FIT-SIM embed after upsert |
| `server/companyFinder.ts` | `importCampaignFromCSV` schedules FIT-SIM embed after upsert |
| `scripts/backfill-linked-niche-assignments.mts` | One-off niche assignment backfill for linked companies |
| `docs/manus-deploy-handoff-linked-niche-clustering-june-2026.md` | This handover |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] `search_company_memberships` verified on TiDB (`SHOW TABLES`)
- [ ] `npm run build` / `tsc --noEmit`: 0 errors
- [ ] Smoke test A — linked company clusters or assigns
- [ ] Smoke test B — counts align
- [ ] Smoke test D — lookalike after Apollo CSV import
- [ ] Backfill run (if requested): searchId(s) `________`, companies assigned `________`

Include: `git log -1 --oneline`, backfill stdout if run.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Linked company still no `nicheId` after deploy | Campaign clustered before deploy — run backfill script or **Assign Remaining** |
| Unassigned count still low vs Search Results | Old build without `getCompaniesBySearchId` in `nicheRouter` |
| Backfill fails immediately | `OPENAI_API_KEY` or `DATABASE_URL` missing on runner |
| No niches to assign to | Run **Discover Niches** first (Phase 1 clustering) |
| FIT-SIM still empty after CSV import | Background job still running, or `OPENAI_API_KEY` / Supabase env missing — check logs |
| “No embedding found” on lookalike | Old build, or import before deploy — run `embed-missing-companies.mjs` |

---

## Manus engineer quick instructions (paste-ready)

```
1. git pull origin main && git log -1 --oneline
2. npm run build (0 TS errors)
3. Publish Manus WebDev app
4. TiDB: SHOW TABLES LIKE 'search_company_memberships';  (must exist)
5. Optional niche backfill: npx tsx scripts/backfill-linked-niche-assignments.mts --all
6. Smoke: linked imports → Market Segments; Apollo CSV → Find similar (lookalike)
7. Reply with: commit hash, checklist from handover doc
```

---

## Related docs

- [`docs/manus-deploy-handoff-apollo-import-dedup-june-2026.md`](manus-deploy-handoff-apollo-import-dedup-june-2026.md) — junction table + import dedup (prerequisite)
- [`docs/database_mess.md`](database_mess.md) — dual-DB map
- [`docs/manus-deploy-handoff-june-2026.md`](manus-deploy-handoff-june-2026.md) — handoff index
