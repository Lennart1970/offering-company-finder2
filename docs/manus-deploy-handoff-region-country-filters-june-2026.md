# Manus Deploy Handoff — Region + Country Filters (June 2026)

Company Database and share-list pages now support **region and country filters together** (no longer mutually exclusive).

> **Related:** [`manus-deploy-handoff-lookalike-seed-june-2026.md`](./manus-deploy-handoff-lookalike-seed-june-2026.md) — deploy that release first if not already on production.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (region + country combined filters) |
| **Deploy target** | Manus WebDev (backend + frontend) |

### What's in this release

1. **Company Database** — Region and country dropdowns work together: pick a macro-region (e.g. DACH, Europe), then optionally narrow to a single country without clearing the region.
2. **Country dropdown scoping** — When a region is selected, the country list only shows countries in that region.
3. **ISO-2 matching** — Region filters include both full country names and ISO-2 codes (e.g. `DE` and `Germany`) so filtering works regardless of how country is stored in the DB.
4. **Share list pages** — Same combined region + country behaviour on public share lists.
5. **Backend** — `getCompanyDatabase` / `countCompanyDatabase` prefer a specific `country` when set; region expands to a `countries[]` list only when no country is selected.

**No database migrations or new env vars.**

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

1. `npm run build` — must pass `tsc --noEmit` via `prebuild` (0 errors)
2. Publish / deploy the Manus WebDev app
3. Confirm `client/public/__manus__/version.json` reflects the deployed commit hash

---

## Step 2 — Database migrations (MySQL / TiDB)

**None required.** This release only changes application code.

Do not run `npm run db:push` for this deploy unless other pending migrations from earlier handoffs are still outstanding.

---

## Step 3 — Config & env

**No new or changed environment variables.**

---

## Step 4 — Smoke tests (production)

### A. Company Database — region only

1. Log in → open **Company Database**.
2. Set **All regions** → **DACH** (or Europe).
3. Leave **All countries** selected.
4. **Expected:** Company count narrows to companies in that region's countries. Country dropdown lists only countries in DACH (or Europe).

### B. Company Database — region + country

1. With **DACH** still selected, pick **Germany** (or `DE — Germany`) from the country dropdown.
2. **Expected:** Region stays on DACH; results narrow to Germany only. Total count updates accordingly.
3. Clear country back to **All countries**.
4. **Expected:** Results return to all DACH countries; region filter remains active.

### C. Company Database — country only (unchanged)

1. Clear region to **All regions**.
2. Pick a single country.
3. **Expected:** Results filter to that country only (same as before).

### D. Share list — combined filters

1. Open any share list URL (`/share/list/<token>`).
2. Set a region, then a country within that region.
3. **Expected:** Table and count update; region is not cleared when country is chosen.

---

## Architecture notes (do not change unless asked)

| Area | Notes |
|------|-------|
| Region map | `REGION_MAP` in `CompanyDatabase.tsx` — aligns with geography fit-score multipliers |
| API | `getCompanyDb` accepts `country` (single) and `countries` (region expansion); country wins when both sent |
| DB column | Filters on `companies.country` (ISO-2 or full name) |

**Known gaps (intentional):** Companies with empty `country` are excluded when a region filter is active.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint commits | Use GitHub `main` |
| Re-introduce mutual exclusion between region and country | Product requirement is combined use |
| Run migrations for this release | No schema changes |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `client/src/pages/CompanyDatabase.tsx` | Combined region + country filters; `filteredCountries`; ISO expansion |
| `client/src/pages/ShareListPage.tsx` | Same combined filter UX on share lists |
| `server/db.ts` | Geo filter precedence: country before region `countries[]` |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migrations applied: **N/A**
- [ ] Smoke test A (region only) passed
- [ ] Smoke test B (region + country) passed
- [ ] Smoke test D (share list) passed
- [ ] Build / `tsc --noEmit`: 0 errors

Include: test URL(s), screenshot of DACH + Germany filter if helpful.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Region filter returns 0 companies | Many rows have empty `country`; enrich or check ISO vs full-name storage |
| Country not in dropdown after region | Country not in `REGION_MAP` for that region, or no companies with that country in DB |
| Region clears when picking country | Old build deployed — redeploy from `main` with this release |

---

## Related docs

- [`docs/database_mess.md`](./database_mess.md) — dual-DB map
- [`docs/manus-deploy-handoff-lookalike-seed-june-2026.md`](./manus-deploy-handoff-lookalike-seed-june-2026.md) — prior release
