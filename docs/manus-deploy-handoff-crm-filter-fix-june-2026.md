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
2. **Root cause** — Raw nested `sql` `EXISTS` fragments did not compose correctly with Drizzle `and()` in the `WHERE` clause; the query failed at runtime and the UI showed an empty list.
3. **Fix** — Rewrote CRM presence filtering with Drizzle `exists()` / `not()` and aligned match rules with `findCgLead` (SharePoint ID, domain, website host, company-name prefix).

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

**No new migration required.** This is a server-side query fix only.

### Verify CRM data still present

```sql
SHOW TABLES LIKE 'lt_mns_cg_leads';
SELECT COUNT(*) AS crm_rows FROM lt_mns_cg_leads;
```

Expected: table exists, **~2,500+ rows** (imported from `docs/link to item.csv` via `scripts/import-sharepoint-leads.mjs`).

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

**Filter match order (after fix):**

1. `companies.cgSharepointId` → `lt_mns_cg_leads.id`
2. `companies.primaryDomain` → `lt_mns_cg_leads.domain`
3. Host extracted from `companies.websiteUrl` → `lt_mns_cg_leads.domain`
4. Company name prefix (`LIKE` first 20 chars) → `lt_mns_cg_leads.company_name`

Badge `findCgLead` also does fuzzy normalized name equality in JS after prefix filter; filter may still include a few extra name-prefix matches vs badge — acceptable.

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
| `server/db.ts` | `companyCrmPresenceCondition()` using `exists()` / `not()`; `companyCrmMatchWhere()` aligned with `findCgLead` |
| `docs/manus-deploy-handoff-crm-filter-fix-june-2026.md` | This handoff |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] `lt_mns_cg_leads` row count: `________`
- [ ] Smoke test A (CRM filter In / Not in / All) passed
- [ ] Smoke test B (CRM column badges) passed
- [ ] Build / `tsc --noEmit`: 0 errors

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Both filter options still return 0 | Old build deployed — confirm `git log -1` includes CRM filter fix commit |
| **In CRM** returns 0 but green badges visible | `lt_mns_cg_leads` empty — run import script |
| **In CRM** count lower than green badge count | Name-only badge match (fuzzy normalize) not fully replicated in SQL — expected for edge cases |
| **Not in CRM** returns 0 | Filter fix not deployed, or all companies match CRM (unlikely) |

---

## Related docs

- [`docs/manus-deploy-handoff-crm-links-june-2026.md`](./manus-deploy-handoff-crm-links-june-2026.md) — Original CRM links & filter release
- [`docs/SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide)
- [`docs/database_mess.md`](./database_mess.md)
