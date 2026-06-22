# Manus Deploy Handoff — Company DB Campaign Creation (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `4a44bdd` — *Add Company Database campaign creation with Manus deploy handoff.* |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Create campaign from Company Database** — filter or select up to **100** companies; clones into a new campaign with **`[DB]`** name prefix.
2. **Preserves scores & briefs** — full company row copy + `company_brain_outputs` for chosen brain; **no** `score_only` queue jobs.
3. **Discoverability UX** — **+ New campaign** header CTA, **SELECT COMPANIES**, select-mode banner, first-visit tip; **Company Database** moved to top of **Intelligence** sidebar.
4. **Find similar** — renamed from **From DB** (same similarity-discovery flow; still re-scores).

**No new database migrations.** Uses existing `searches`, `companies`, `company_brain_outputs`, `offering_brain`.

---

## Step 1 — Sync from GitHub

Use GitHub `main` as the single source of truth. Do **not** deploy from old sandbox checkpoint commits.

```bash
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline
# Expect: 4a44bdd or newer
```

Then:

1. `npm run build` (must pass `tsc --noEmit` via `prebuild` — 0 errors)
2. Publish / deploy the Manus WebDev app
3. Confirm `client/public/__manus__/version.json` reflects the deployed commit hash

---

## Step 2 — Database migrations (MySQL / TiDB)

**None required for this release.**

No new tables or columns. Campaign creation clones rows in:

- `searches` (new campaign row)
- `companies` (cloned rows with new `searchId`)
- `company_brain_outputs` (copied for campaign `brainId`)

Do **not** run `npm run db:push` unless other pending migrations from earlier handoffs are still outstanding.

Optional sanity check:

```sql
SHOW TABLES LIKE 'company_brain_outputs';
SELECT COUNT(*) FROM searches WHERE offeringName LIKE '[DB]%' ORDER BY id DESC LIMIT 5;
```

---

## Step 3 — Config & env

**No new environment variables.**

Existing requirements (unchanged):

| Var | Used for |
|-----|----------|
| `DATABASE_URL` | MySQL/TiDB — campaign clone |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **Find similar** modal only (not required for `[DB]` campaigns) |

---

## Step 4 — Smoke tests (production)

### A. Header — filter-based campaign

1. Log in → **Intelligence** → **Company Database** (should be first nav item).
2. Confirm subtitle mentions “create a campaign (up to 100)”.
3. Apply a filter (e.g. **Germany** or **Scored only**).
4. Click **+ New campaign** (header, top-right).
5. Enter name, pick a **Brain**, submit.
6. **Expected:** Redirect to `/search-results/:id`; campaign name shows as `[DB] …`; company count ≤ 100; FIT/brief columns match source companies.

### B. Selection-based campaign

1. Click **SELECT COMPANIES**.
2. Select 2–5 companies → **CREATE CAMPAIGN** (toolbar or purple banner).
3. **Expected:** Modal shows selection count; campaign created; scores/briefs preserved.

### C. Cap at 100

1. In select mode with >100 selected (if feasible) or filter with >100 matches.
2. **Expected:** Selection button disabled / error; filter modal shows “top 100 of N”.

### D. Regression — Find similar

1. Click **Find similar** (was **From DB**).
2. **Expected:** Similarity modal opens; can still create `[SIM]` campaign with re-scoring (unchanged behavior).

### E. Regression — share list

1. **SELECT COMPANIES** → **CREATE SHARE LIST**.
2. **Expected:** Share list + Excel export still works.

---

## Architecture notes

| Flow | Store | Notes |
|------|-------|-------|
| `createCampaignFromCompanyDb` | MySQL/TiDB | `protectedProcedure`; max 100 IDs |
| Clone helper | `server/companyDbCampaign.ts` | Full row copy; no `campaignQueue` |
| Filter mode | `getCompanyDatabase()` | Same filters/sort as UI; `limit: 100` |
| Find similar | Supabase RPC | Separate path; still queues `score_only` |

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint instead of GitHub `main` | May miss this release |
| Run migrations “just in case” | No schema changes in this release |
| Expect `[DB]` campaigns to re-score | By design — scores/briefs are copied |
| Confuse **Find similar** with **New campaign** | Similar = discovery + re-score; New campaign = curated clone |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/companyDbCampaign.ts` | **New** — clone companies + brain outputs |
| `server/companyFinder.ts` | `createCampaignFromCompanyDb` mutation |
| `server/companyDbCampaign.test.ts` | **New** — unit tests |
| `client/src/components/CreateCampaignFromDbModal.tsx` | **New** — campaign modal |
| `client/src/pages/CompanyDatabase.tsx` | Header CTA, select/filter UX, renames |
| `client/src/components/DashboardLayout.tsx` | Company Database → top of Intelligence |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `4a44bdd` (or newer on main)
- [ ] Migrations: **N/A** (none)
- [ ] `npm run build` / `tsc --noEmit`: 0 errors
- [ ] Smoke test A — filter campaign: pass
- [ ] Smoke test B — selection campaign: pass
- [ ] Smoke test C — 100 cap: pass
- [ ] Smoke test D — Find similar: pass
- [ ] Smoke test E — share list: pass

Include: deployed commit hash, test URL, screenshot of **+ New campaign** header (optional).

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| “Maximum 100 companies” on create | Working as designed |
| “No brain found” / brain picker required | Filter has no brain; pick one in modal |
| Campaign empty after create | Source IDs not found; check filters |
| Brief missing on detail page | No `company_brain_outputs` row for chosen brain on source company |
| **Find similar** fails | Supabase RPC / env issue (unrelated to `[DB]` flow) |

---

## Related docs

- [`docs/manus-deploy-handoff-lookalike-modal-june-2026.md`](./manus-deploy-handoff-lookalike-modal-june-2026.md) — Find similar / lookalike UI
- [`docs/database_mess.md`](./database_mess.md) — Dual-DB architecture
- [`.cursor/skills/leadtrigger-release/handover-template.md`](../.cursor/skills/leadtrigger-release/handover-template.md)

---

## Manus engineer quick instructions

```
1. git pull origin main && git log -1 --oneline
2. npm run build (0 TS errors)
3. Publish Manus WebDev app
4. No DB migrations for this release
5. Smoke: Company Database → + New campaign (filter) + SELECT COMPANIES → CREATE CAMPAIGN
6. Reply with: commit hash, checklist above, screenshot optional
```
