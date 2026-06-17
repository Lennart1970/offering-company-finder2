# Manus Deploy Handoff — Country backfill (June 2026)

Implementation guide for Manus WebDev engineer.

> **Related:** [`manus-deploy-handoff-sector-backfill-june-2026.md`](manus-deploy-handoff-sector-backfill-june-2026.md) (sector fix — same Apollo CSV import pattern). Deploy sector release first if not already on production.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (country import + backfill) |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Apollo / Excel import** — `Company Country` from CSV now also stored in `sliceMetadata.country` (parallel to sector in `sliceMetadata.industry`).
2. **CSV parser (`apolloCSVParser`)** — sets `sector`, `enrichmentStatus: "enriched"`, and preserves country from CSV (no API enrichment wipe).
3. **Enrichment guard** — if Apollo API enrich returns empty country, existing CSV country is kept (`details.country || company.country`).
4. **Data backfill migration** — `0065_backfill_country_from_apollo_import.sql` fills `companies.country` from `sliceMetadata.country`, `searchLocation`, or last segment of `rawAddress`.
5. **Company Database** — Country column and “All countries” filter populate for Apollo-uploaded companies after migration runs.

**No schema change** — migration `0065` is data-only (UPDATE).

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

1. `npm run build` (must pass `tsc --noEmit`)
2. Publish / deploy the WebDev app
3. Confirm `client/public/__manus__/version.json` reflects a recent commit hash

---

## Step 2 — Database migrations (MySQL / TiDB)

### Pending migrations (check journal)

| Migration file | Type | Notes |
|----------------|------|-------|
| `drizzle/0064_batch_jobs_fit_scored.sql` | Schema | Adds `batch_jobs.fitScored` — skip if column exists |
| `drizzle/0065_backfill_country_from_apollo_import.sql` | Data | Country backfill — **required for this release** |

```bash
npm run db:push
```

### Verify current state (before)

```sql
-- How many companies are missing country?
SELECT COUNT(*) AS missing_country
FROM companies
WHERE country IS NULL OR country = '';

-- Recoverable from sliceMetadata.country (after new imports; 0 for legacy until re-import)
SELECT COUNT(*) AS from_slice_metadata
FROM companies
WHERE (country IS NULL OR country = '')
  AND sliceMetadata IS NOT NULL
  AND JSON_EXTRACT(sliceMetadata, '$.country') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(sliceMetadata, '$.country')) NOT IN ('', 'null');

-- Recoverable from searchLocation (no state)
SELECT COUNT(*) AS from_search_location
FROM companies
WHERE (country IS NULL OR country = '')
  AND (state IS NULL OR state = '')
  AND searchLocation IS NOT NULL AND searchLocation != '';

-- Recoverable from rawAddress (last comma segment)
SELECT COUNT(*) AS from_raw_address
FROM companies
WHERE (country IS NULL OR country = '')
  AND rawAddress IS NOT NULL
  AND rawAddress LIKE '%,%';
```

### Apply country backfill manually (if not using db:push)

Run all three statements in `drizzle/0065_backfill_country_from_apollo_import.sql` in order.

### Verify (after)

```sql
SELECT COUNT(*) AS still_missing
FROM companies
WHERE country IS NULL OR country = '';

-- Spot-check countries for filter dropdown
SELECT country, COUNT(*) AS cnt
FROM companies
WHERE country IS NOT NULL AND country != ''
GROUP BY country
ORDER BY cnt DESC
LIMIT 20;
```

---

## Step 3 — Config & domains

No new env vars for this release.

---

## Step 4 — Smoke tests (production)

### A. Company Database — existing Apollo upload

1. Open **Company Database**.
2. Filter by an Apollo CSV import run (large upload, e.g. 50k+ companies).
3. **Expected:** Country column shows values (e.g. “United States”, “Germany”) instead of `—`.
4. Open **All countries** filter dropdown.
5. **Expected:** Country options appear.

### B. New Apollo Excel import

1. Upload a small Apollo CSV via **Excel Import** (`/excel-import`) with `Company Country` column.
2. Open Company Database filtered to that new run.
3. **Expected:** Country populated immediately (no backfill needed for new rows).

### C. Import Campaign CSV path

1. Upload via **Import Campaign** (`importCampaignFromCSV`) if used.
2. **Expected:** Country and sector both populated; companies marked `enriched` (no enrich step clearing country).

---

## Architecture notes (do not change unless asked)

| Data | Store |
|------|-------|
| `companies.country` | MySQL/TiDB — used by Company Database display + filter |
| `sliceMetadata.country` | MySQL/TiDB JSON — backup source; import writes both |
| `searchLocation` | May hold country when CSV had no state column |

Company Database reads only `companies.country` (not `sliceMetadata` fallback in UI).

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint commits | Use GitHub `main` |
| Re-run backfill expecting overwrites | Migration only updates rows where `country IS NULL` or `''` |
| Run enrich-all on CSV imports expecting country fix | CSV imports should be `enriched` already; API enrich may return empty country |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/routes/excelImport.ts` | `sliceMetadata.country`, extra country column aliases |
| `server/apolloCSVParser.ts` | `sector`, `enriched` status, `sliceMetadata.country` |
| `server/companyFinder.ts` | Preserve CSV country on enrich |
| `server/companyPipeline.ts` | Preserve CSV country on enrich |
| `server/campaignQueueWorker.ts` | Preserve CSV country on enrich |
| `server/routes/api.ts` | Preserve CSV country on enrich-campaign |
| `drizzle/0065_backfill_country_from_apollo_import.sql` | One-time data backfill |
| `drizzle/meta/_journal.json` | Journal entry for 0065 |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migration `0065` applied (`missing_country` before → `still_missing` after)
- [ ] Company Database shows countries for Apollo upload
- [ ] All countries filter populated
- [ ] Build / `tsc --noEmit`: 0 errors

Include: migration output, test URL(s), screenshot of Country column populated.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Country still `—` after deploy | Migration `0065` not run on production DB |
| Country `—` for new import only | CSV missing `Company Country` column (check Apollo export headers) |
| Filter empty but column has data | Hard refresh; confirm `getCompanyDatabaseCountries` returns rows |
| Country was populated then cleared | Old code ran API enrich with empty response — redeploy + re-run backfill |
| US companies show state in searchLocation but no country | Backfill step 3 (`rawAddress`) may apply; verify CSV had `Company Country` |

---

## Related docs

- [`docs/database_mess.md`](database_mess.md)
- [`docs/manus-deploy-handoff-sector-backfill-june-2026.md`](manus-deploy-handoff-sector-backfill-june-2026.md)
- [`docs/manus-deploy-handoff-lookalike-seed-june-2026.md`](manus-deploy-handoff-lookalike-seed-june-2026.md)
