# Manus Deploy Handoff — Company DB Share List Brain Fix (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Bug fix — CREATE SHARE LIST from Company Database** — Failed `INSERT INTO share_tokens` when `brainId` pointed to a stale or missing `offering_brain` row (e.g. `brainId=60001`). Users saw raw SQL in the toast.
2. **Brain resolution** — Prefer Brain filter → highest-fit `primaryBrainId` from `company_brain_outputs` → campaign brain → active brain → `generatedWithBrainId` only if still in the brains catalog.
3. **Re-resolve on create** — Share list creation re-computes brain per company at click time (not the ID stored when the row was checked).
4. **Friendly API error** — Server returns `Offering Brain X not found for {company}` instead of a Drizzle/SQL failure.

**No database migrations.** **No new env vars.**

---

## Step 1 — Sync from GitHub

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

**None required.**

Optional sanity:

```sql
SELECT id, brainName FROM offering_brain ORDER BY id DESC LIMIT 10;
SELECT companyId, generatedWithBrainId FROM companies WHERE generatedWithBrainId IS NOT NULL AND generatedWithBrainId NOT IN (SELECT id FROM offering_brain) LIMIT 5;
```

Second query shows orphaned `generatedWithBrainId` stamps (fix is client/server logic, not data migration).

---

## Step 3 — Config & domains

No changes.

---

## Step 4 — Smoke tests (production)

### A. Company Database — CREATE SHARE LIST (primary)

1. Open **Company Database**.
2. **Select companies** (checkbox mode) — pick rows with fit scores / brain outputs.
3. Optional: set **Brain / BU** filter to a known brain.
4. Click **CREATE SHARE LIST**.
5. Expect: Excel download + list URL copied toast — **no** `Failed query: insert into share_tokens` error.

### B. Stale brain regression

1. Select a company that previously failed (if reproducible).
2. Without Brain filter, create share list — should use `primaryBrainId` or active brain.
3. If no valid brain: toast *"No valid Offering Brain for …"* (not SQL error).

### C. Share list CSV export (regression, if prior release deployed)

1. Open created list → **Download CSV**.
2. Header: `Link ID,Company Name,Company Website,SharePoint URL,Shareable Page URL`.

---

## Architecture notes

| Area | Notes |
|------|-------|
| `share_tokens.brainId` | FK → `offering_brain.id` — must exist before insert |
| `primaryBrainId` | Correlated subquery on `getCompanyDatabase()` — best fit from `company_brain_outputs` |
| `assertValidShareBrain()` | `server/shareRouter.ts` — used by `createShareList` and `createShareListWithToken` |

---

## What not to do

| Don't | Why |
|-------|-----|
| Remove FK on `share_tokens.brainId` | Masks bad data; share pages need a real brain |
| Deploy from sandbox checkpoint | May miss `primaryBrainId` query and client fix |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `client/src/pages/CompanyDatabase.tsx` | `resolveBrainIdForRow`, `handleCreateShareList` re-resolve |
| `server/db.ts` | `primaryBrainId` subquery on company database rows |
| `server/shareRouter.ts` | `assertValidShareBrain()` before token insert |

---

## Sign-off checklist

- [ ] Git commit deployed: `________`
- [ ] Migrations: **N/A**
- [ ] Smoke test A — CREATE SHARE LIST passed
- [ ] Smoke test B — no raw SQL toast on failure
- [ ] Build / `tsc --noEmit`: 0 errors

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Offering Brain X not found` | Company has no `company_brain_outputs` row — score or pick Brain filter |
| All rows skipped on create | No active brain and no outputs — set active Offering Brain |
| Share page empty brief | Wrong brain resolved — use Brain filter when creating list |
| Still see SQL error | Old build — republish from latest `main` |

---

## Related docs

- [`docs/manus-deploy-handoff-share-csv-export-june-2026.md`](./manus-deploy-handoff-share-csv-export-june-2026.md)
- [`docs/manus-deploy-handoff-crm-links-june-2026.md`](./manus-deploy-handoff-crm-links-june-2026.md)
