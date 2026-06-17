# Manus Deploy Handoff — Sector backfill (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (sector import + backfill) |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Apollo / Excel import** — industry from CSV now writes to `companies.sector` (not only `sliceMetadata.industry`).
2. **Data backfill migration** — `0063_backfill_sector_from_slice_metadata.sql` copies existing `sliceMetadata.industry` into `companies.sector` for rows where sector is null.
3. **Company Database** — Sector column and “All sectors” filter populate for Apollo-uploaded companies after migration runs.

**No schema change** — migration `0063` is data-only (UPDATE).

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

### Verify current state (before)

```sql
-- How many companies are missing sector but have industry in sliceMetadata?
SELECT COUNT(*) AS needs_backfill
FROM companies
WHERE sector IS NULL
  AND sliceMetadata IS NOT NULL
  AND JSON_EXTRACT(sliceMetadata, '$.industry') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(sliceMetadata, '$.industry')) NOT IN ('', 'null');
```

### Migrations to apply

| Migration file | Creates / changes | Skip if |
|----------------|-------------------|---------|
| `drizzle/0063_backfill_sector_from_slice_metadata.sql` | Backfills `companies.sector` from `sliceMetadata.industry` | N/A — safe to re-run (only updates `sector IS NULL`) |

```bash
npm run db:push
```

Or run SQL manually:

```sql
UPDATE `companies`
SET `sector` = JSON_UNQUOTE(JSON_EXTRACT(`sliceMetadata`, '$.industry'))
WHERE `sector` IS NULL
  AND `sliceMetadata` IS NOT NULL
  AND JSON_EXTRACT(`sliceMetadata`, '$.industry') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`sliceMetadata`, '$.industry')) NOT IN ('', 'null');
```

### Verify (after)

```sql
-- Should return 0 or near-0 for Apollo imports that had Industry column
SELECT COUNT(*) AS still_missing
FROM companies
WHERE sector IS NULL
  AND sliceMetadata IS NOT NULL
  AND JSON_EXTRACT(sliceMetadata, '$.industry') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(sliceMetadata, '$.industry')) NOT IN ('', 'null');

-- Spot-check sectors available for filter dropdown
SELECT sector, COUNT(*) AS cnt
FROM companies
WHERE sector IS NOT NULL
GROUP BY sector
ORDER BY cnt DESC
LIMIT 20;
```

---

## Step 3 — Config & domains

No new env vars for this release.

---

## Step 4 — Smoke tests (production)

### A. Company Database — existing Apollo upload (e.g. Run #213)

1. Open **Company Database**.
2. Filter by the Apollo import run (e.g. Run #213).
3. **Expected:** Sector column shows values (e.g. “information technology & services”) instead of `—`.
4. Open **All sectors** filter dropdown.
5. **Expected:** Sector options appear with counts.

### B. New Apollo Excel import

1. Upload a small Apollo CSV via **Excel Import** with an Industry column.
2. Open Company Database filtered to that new run.
3. **Expected:** Sector populated immediately (no backfill needed for new rows).

### C. FIT-SIM / lookalike clones

1. Filter a FIT-SIM run cloned from an Apollo upload (e.g. Run #2130002).
2. **Expected:** Sectors visible if source companies had `sliceMetadata.industry` (backfill covers clones that kept sliceMetadata).

---

## Architecture notes (do not change unless asked)

| Data | Store |
|------|-------|
| `companies.sector` | MySQL/TiDB — used by Company Database display + filter |
| `sliceMetadata.industry` | MySQL/TiDB JSON — legacy source; import still writes both |

Search Results page already fell back to `sliceMetadata.industry`; Company Database reads only `companies.sector`.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint commits | Use GitHub `main` |
| Re-run backfill expecting overwrites | Migration only updates rows where `sector IS NULL` |
| Point sector display back to sliceMetadata only | Defeats indexed filter on `companies.sector` |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/routes/excelImport.ts` | Set `sector` from Industry column on import |
| `drizzle/0063_backfill_sector_from_slice_metadata.sql` | One-time data backfill |
| `drizzle/meta/_journal.json` | Journal entry for 0063 |
| `drizzle/meta/0063_snapshot.json` | Snapshot (schema unchanged vs 0062) |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migration `0063` applied (include row count / `needs_backfill` before → `still_missing` after)
- [ ] Company Database Run #213 shows sectors
- [ ] All sectors filter populated
- [ ] Build / `tsc --noEmit`: 0 errors

Include: migration output, test URL(s), screenshot of Sector column populated.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Sector still `—` after deploy | Migration `0063` not run on production DB |
| Sector `—` for new import only | CSV missing Industry column (check Apollo export headers) |
| Filter empty but column has data | Hard refresh; confirm `getCompanyDatabaseSectors` query returns rows |
| FIT-SIM run empty sector | Clone lost `sliceMetadata`; re-import or manual sector update |

---

## Related docs

- [`docs/database_mess.md`](database_mess.md)
- [`docs/manus-deploy-handoff-lookalike-seed-june-2026.md`](manus-deploy-handoff-lookalike-seed-june-2026.md)
