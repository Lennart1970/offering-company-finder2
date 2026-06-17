# Manus Deploy Handoff — CRM Filter Fix (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (includes CRM filter fix) |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Bug fix — Company Database CRM filter** — **In CRM** and **Not in CRM** both returned zero rows after the initial CRM filter shipped in `03ae54c`.
2. **Root cause (correctness)** — Raw nested `sql` `EXISTS` fragments did not compose correctly with Drizzle `and()` in the `WHERE` clause.
3. **Performance — `normalizedDomain` column** — Pre-materialised lowercase hostname on `companies` with indexes on `companies.normalizedDomain` and `lt_mns_cg_leads.domain`. CRM filter uses index-scannable `cg.domain = companies.normalizedDomain` instead of per-row string surgery.
4. **Fix** — Drizzle `exists()` / `not()` + indexed domain equality; SharePoint ID branch retained for rows with `cgSharepointId`.

**No UI changes.** Filter dropdown and CRM column badges are unchanged.

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

**Migration required** for CRM filter performance: `0066_companies_normalized_domain.sql`

### Verify current state

```sql
SHOW COLUMNS FROM companies LIKE 'normalizedDomain';
SHOW INDEX FROM companies WHERE Key_name = 'companies_normalized_domain_idx';
SHOW INDEX FROM lt_mns_cg_leads WHERE Key_name = 'lt_mns_cg_leads_domain_idx';
SELECT COUNT(*) AS with_domain FROM companies WHERE normalizedDomain IS NOT NULL AND normalizedDomain != '';
```

### Apply migration

```bash
npm run db:push
```

Or run SQL from `drizzle/0066_companies_normalized_domain.sql` manually, then confirm:

```sql
SELECT COUNT(*) AS crm_rows FROM lt_mns_cg_leads;
SELECT COUNT(*) AS normalized FROM companies WHERE normalizedDomain IS NOT NULL;
```

Expected: `normalized` close to companies with `primaryDomain` or `websiteUrl` populated.

### CRM data (unchanged)

```sql
SHOW TABLES LIKE 'lt_mns_cg_leads';
SELECT COUNT(*) AS crm_rows FROM lt_mns_cg_leads;
```

If count is 0, re-run import before smoke-testing the filter:

```bash
node scripts/import-sharepoint-leads.mjs "docs/link to item.csv"
```

---

## Step 3 — Config & domains

No new env vars for this release.

Existing requirements unchanged:

- `DATABASE_URL` — MySQL/TiDB (`companies` + `lt_mns_cg_leads`)

---

## Step 4 — Smoke tests (production)

### A. Company Database — CRM filter (primary)

1. Open **Company Database** (`/company-database`).
2. Confirm total company count shows (e.g. ~50k) with filter set to **All CRM**.
3. Set filter to **In CRM** — list should shrink; companies with green CRM icons (e.g. SAAB, RUAG) should remain.
4. Set filter to **Not in CRM** — CRM-matched companies should disappear; count should be roughly `total − in_crm`.
5. Reset to **All CRM** — full list returns.

### B. CRM column badges (regression)

1. With **All CRM**, spot-check rows with green CRM icon — click icon, SharePoint `DispForm.aspx?ID=…` opens.
2. Grey database icon rows should still show for companies not in the CRM export.

### C. Share page CRM badge (regression, if `73ca2d4` already deployed)

1. Open a gated share brief for a CRM-matched company.
2. **View in CRM** badge still appears in header.

---

## Architecture notes (do not change unless asked)

| Data | Store |
|------|-------|
| CRM link lookup (`lt_mns_cg_leads`) | MySQL/TiDB |
| Badge lookup API | `trpc.cgLead.lookup` → `findCgLead()` |
| CRM filter API | `trpc.companyFinder.getCompanyDb` → `getCompanyDatabase()` / `countCompanyDatabase()` |

**Filter match (after fix):**

1. `companies.normalizedDomain` → `lt_mns_cg_leads.domain` (indexed — primary path)
2. `companies.cgSharepointId` → `lt_mns_cg_leads.id` (numeric SharePoint IDs only)

`normalizedDomain` is set on insert/update via `normalizeCompanyDomain()` and backfilled in migration `0066`.

Badge `findCgLead` still uses per-row API lookup (domain + fuzzy name). Filter may miss rare name-only badge matches — acceptable trade-off for speed.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint commits | Use GitHub `main` |
| Re-import `lt_mns_cg_leads` if count is already ~2,500+ | Upsert is safe but unnecessary |
| Add CRM filter logic to Supabase | CRM lookup is MySQL-only |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/db.ts` | `companyCrmPresenceCondition()` using indexed `normalizedDomain` |
| `server/normalizeCompanyDomain.ts` | Shared domain normalisation for insert/update/backfill |
| `drizzle/0066_companies_normalized_domain.sql` | Column + indexes + backfill |
| `drizzle/schema.ts` | `companies.normalizedDomain` |
| `docs/manus-deploy-handoff-crm-filter-fix-june-2026.md` | This handoff |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migration `0066` applied (`normalizedDomain` column + indexes)
- [ ] `companies.normalizedDomain` backfill count: `________`
- [ ] Smoke test A (CRM filter In / Not in / All) passed
- [ ] Smoke test B (CRM column badges) passed
- [ ] Build / `tsc --noEmit`: 0 errors

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Both filter options still return 0 | Migration `0066` not applied, or old build deployed |
| Filter very slow | `companies_normalized_domain_idx` / `lt_mns_cg_leads_domain_idx` missing — re-run migration |
| **In CRM** returns 0 but green badges visible | `lt_mns_cg_leads` empty, or `normalizedDomain` not backfilled — run migration |
| **In CRM** count lower than green badge count | Name-only badge match (fuzzy normalize) not in SQL filter — expected |

---

## Related docs

- [`docs/manus-deploy-handoff-crm-links-june-2026.md`](./manus-deploy-handoff-crm-links-june-2026.md) — Original CRM links & filter release
- [`docs/SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide)
- [`docs/database_mess.md`](./database_mess.md)
