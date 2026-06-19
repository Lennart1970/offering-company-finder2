# Manus Deploy Handoff — Share Export CRM Fields & Deep Research Requests (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `93f05b2` |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Share list JSON export — CRM fields** — Download JSON on `/share/list/:listToken` now includes **Link ID** and **SharePoint Page Link** per company (from `lt_mns_cg_leads` via batch lookup).
2. **Share list Excel export — same CRM fields** — Download Excel includes the same two columns for parity with JSON.
3. **Batch CRM enrichment on list load** — `resolveListToken` enriches each company with `linkId` and `sharepointPageLink` (SharePoint ID → domain → company name). Cached for 24h in `shareCache`.
4. **Share list CRM badge optimization** — `CgLeadBadge` receives `sharepointId` when already resolved server-side.
5. **Share page deep research requests** — Visitors on `/share/:token` can request deep research + outreach (log-only; internal team processes manually). Daily quota: 10 requests per visitor email.
6. **Admin research request log** — `/share-access-log` → **Research Requests** tab; mark pending requests complete or cancelled.
7. **Migration 0067** — Creates `share_research_requests` table.

---

## Step 1 — Sync from GitHub

Use GitHub `main` as the single source of truth. Do **not** deploy from old sandbox checkpoint commits.

```bash
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline
```

Expected: `93f05b2 Add SharePoint CRM fields to share list exports and share-page research requests.`

Then:

1. `npm run build` (must pass `tsc --noEmit` via `prebuild`)
2. Publish / deploy the WebDev app
3. Confirm `client/public/__manus__/version.json` reflects commit `93f05b2` or later
4. **Restart app after publish** (or wait 24h) so share list cache picks up new CRM export fields

---

## Step 2 — Database migrations (MySQL / TiDB)

### Verify current state

```sql
SHOW TABLES LIKE 'share_research_requests';
```

If empty, apply migration **0067**.

### Migrations to apply

| Migration file | Creates / changes | Skip if |
|----------------|-------------------|---------|
| `drizzle/0067_share_research_requests.sql` | `share_research_requests` table + FKs | table already exists |

```sql
-- After apply:
DESCRIBE share_research_requests;
```

Or:

```bash
npm run db:push
```

**Drizzle note:** Journal entry `0067_share_research_requests` exists in `drizzle/meta/_journal.json`. No `0067_snapshot.json` in repo — manual SQL apply from the migration file is fine if `db:push` complains.

### CRM data prerequisite (SharePoint export fields)

SharePoint export columns require `lt_mns_cg_leads` populated. Verify:

```sql
SHOW TABLES LIKE 'lt_mns_cg_leads';
SELECT COUNT(*) AS crm_rows FROM lt_mns_cg_leads;
```

If empty or stale, import from CSV:

```bash
node scripts/import-sharepoint-leads.mjs "docs/link to item.csv"
```

---

## Step 3 — Config & domains

### Share allowed domains (required for deep research requests)

Research requests use the same allowlist as contact fetch. Verify visitor domains exist:

```sql
SELECT * FROM share_allowed_domains;
```

**No new env vars** for this release.

---

## Step 4 — Smoke tests (production)

### A. Share list JSON export — CRM fields

1. Open a share list with known CRM matches, e.g. `/share/list/<listToken>`.
2. Click **Download JSON**.
3. Open the file — each company row should include:
   - `"Link ID"` — SharePoint list item ID (empty string if not in CRM)
   - `"SharePoint Page Link"` — full `DispForm.aspx?ID=…` URL (empty if not in CRM)
4. Spot-check one row: Link ID opens the correct SharePoint item in a new tab.

### B. Share list Excel export — CRM fields

1. Same list page → **Download Excel**.
2. Confirm **Link ID** and **SharePoint Page Link** columns exist after Website.
3. Values match JSON export for sample rows.

### C. Share page deep research request

1. Incognito → `/share/<token>` → complete email gate (allowlisted domain).
2. Scroll to **Request Deep Research** box.
3. Submit with allowlisted email — expect success message and remaining quota shown.
4. Submit 11th request same day — expect daily limit error.

### D. Admin research request log

1. Log in as admin → `/share-access-log`.
2. Open **Research Requests** tab.
3. Confirm the test request appears with status `pending` (or `completed` if company already has fresh LLM fit score).
4. **Mark complete** or **Cancel** on a pending row — status updates.

### E. CRM badge still works

1. On share list table, green CRM icon on a matched company should still open SharePoint.
2. Export Link ID / SharePoint Page Link should match badge URL for same row.

---

## Architecture notes (do not change unless asked)

| Endpoint / flow | Notes |
|-----------------|-------|
| `share.resolveListToken` | Public; batch CRM lookup via `batchFindCgLeadsForCompanies`; 24h list cache |
| `shareExt.requestDeepResearch` | Public; requires allowlisted email domain; max 10/day per email |
| `shareExt.getShareResearchRequests` | Protected admin; auto-completes pending when company has LLM fit score &lt; 3 days old |
| CRM lookup priority | `cgSharepointId` → `normalizedDomain` → fuzzy company name |

**Known gaps (intentional):**

- Deep research is log-only — no automated research pipeline triggered.
- Public share list API (`/api/public/share-lists/:token`) does not include CRM fields (out of scope).
- Cached share lists may lack CRM fields until server restart or 24h TTL expiry after first deploy.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint commits | Use GitHub `main` at `93f05b2` |
| Skip migration 0067 | Research requests will 500 without `share_research_requests` |
| Re-point research log to Supabase | Table lives in MySQL/TiDB only |
| Expect CRM columns without `lt_mns_cg_leads` import | Export fields come from CRM lookup table |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/db.ts` | `batchFindCgLeadsForCompanies()` batch CRM lookup |
| `server/shareRouter.ts` | Enrich `resolveListToken`; research request tRPC endpoints |
| `client/src/pages/ShareListPage.tsx` | JSON/Excel export columns; badge `sharepointId` |
| `client/src/pages/SharePage.tsx` | `DeepResearchRequestBox` on share page |
| `client/src/pages/ShareAccessLogPage.tsx` | Research Requests admin tab |
| `drizzle/0067_share_research_requests.sql` | New table migration |
| `drizzle/schema.ts` | `shareResearchRequests` table definition |
| `server/batchFindCgLeads.test.ts` | Unit tests for batch CRM lookup |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `93f05b2`
- [ ] Migration 0067 applied (or confirmed table exists)
- [ ] Smoke test A — JSON export CRM fields
- [ ] Smoke test B — Excel export CRM fields
- [ ] Smoke test C — deep research request + quota
- [ ] Smoke test D — admin research log
- [ ] Build / `tsc --noEmit`: 0 errors
- [ ] App restarted (share list cache)

Include: migration output, test share list URL, sample JSON snippet with Link ID populated.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| JSON export missing Link ID / SharePoint columns | Old client bundle — republish; hard refresh |
| CRM fields empty for all companies | `lt_mns_cg_leads` empty — run import script |
| CRM fields empty but badge works | Stale 24h list cache — restart app |
| Research request 403 | Visitor email domain not in `share_allowed_domains` |
| Research request 500 | Migration 0067 not applied |
| Daily limit error on first request | Quota already used today for that email (10/day) |

---

## Related docs

- [`docs/manus-deploy-handoff-crm-links-june-2026.md`](./manus-deploy-handoff-crm-links-june-2026.md) — CRM import & badge setup
- [`docs/SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide)
- [`docs/share-page-email-gate-and-audit.md`](./share-page-email-gate-and-audit.md) — Share gate + allowlist
- [`docs/database_mess.md`](./database_mess.md) — Dual-DB architecture

---

## Manus engineer quick instructions

```
1. git pull origin main && git log -1 --oneline   # expect 93f05b2
2. npm run build (0 TS errors)
3. Publish Manus WebDev app + restart
4. Apply migration 0067 if share_research_requests missing
5. Verify lt_mns_cg_leads has rows (import CSV if needed)
6. Smoke test: share list JSON export + research request + admin log
7. Reply with: commit hash, migration output, checklist above
```
