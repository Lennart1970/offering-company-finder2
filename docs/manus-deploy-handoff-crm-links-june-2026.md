# Manus Deploy Handoff — CRM Links & Filter (June 2026)

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

1. **SharePoint CRM link lookup** — `lt_mns_cg_leads` table powers "View in CRM" badges on company cards, search results, and company detail pages.
2. **CSV import script** — `scripts/import-sharepoint-leads.mjs` accepts semicolon CSV with `Company`, `Website`, `ID`, `LinkToItem` columns (no base URL required when `LinkToItem` is present).
3. **Company Database CRM column** — green CRM icon / grey "not in CRM" indicator per row.
4. **Company Database CRM filter** — filter dropdown: **All CRM** / **In CRM** / **Not in CRM**.
5. **Company detail header** — full "View in CRM →" badge at top of company page.
6. **Single-company share page** (`/share/:token`) — **View in CRM** badge in company header (gated share briefs).

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

**No new migration required** for this release. CRM links use the existing `lt_mns_cg_leads` table from migration `0061_bitter_mariko_yashida.sql`.

### Verify current state

```sql
SHOW TABLES LIKE 'lt_mns_cg_leads';
SELECT COUNT(*) AS crm_rows FROM lt_mns_cg_leads;
```

### Import CRM link data (required once, or to refresh)

Copy `docs/link to item.csv` to the sandbox, then:

```bash
node scripts/import-sharepoint-leads.mjs "docs/link to item.csv"
```

The CSV has full `LinkToItem` SharePoint URLs — **no** `SHAREPOINT_LEADS_BASE_URL` needed.

Verify import:

```sql
SELECT COUNT(*) FROM lt_mns_cg_leads;
SELECT id, company_name, domain, LEFT(sharepoint_url, 80) AS url FROM lt_mns_cg_leads LIMIT 5;
```

Expected: ~2,500+ rows from the Connect Group lead list export.

---

## Step 3 — Config & domains

No new env vars for this release.

Existing requirements unchanged:

- `DATABASE_URL` — MySQL/TiDB (companies + `lt_mns_cg_leads`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — only if using lookalike/similarity features

---

## Step 4 — Smoke tests (production)

### A. CRM data imported

1. Run `SELECT COUNT(*) FROM lt_mns_cg_leads;` — expect > 0.
2. Pick a known company (e.g. Thales Nederland BV, domain `thalesgroup.com`).

### B. Company Database — CRM column & filter

1. Open **Company Database**.
2. Find a company known to be in the CRM export — row should show green CRM icon.
3. Set filter **In CRM** — list should shrink; known CRM companies remain.
4. Set filter **Not in CRM** — CRM-matched companies should disappear.
5. Reset to **All CRM**.

### C. Company detail — CRM link

1. Open a company that matches the CRM list.
2. Top header should show green **View in CRM →** button.
3. Click it — opens SharePoint `DispForm.aspx?ID=…` in new tab.

### D. Search results — CRM badge

1. Open a search with CRM-matched companies.
2. Company cards / list rows show green CRM icon in badge row.

### E. Share pages — CRM link

1. Open a **share list** (`/share/list/<token>`) — matched companies show compact green CRM icon under the name.
2. Open a **single-company share** (`/share/<token>`) after email gate — header meta row shows **View in CRM** (or "Not in CRM database" when no match).
3. Click **View in CRM** — opens SharePoint lead item in a new tab.

**Prerequisite:** `lt_mns_cg_leads` imported (Step 2). No new migration for this add-on.

---

## Architecture notes (do not change unless asked)

| Data | Store |
|------|-------|
| CRM link lookup (`lt_mns_cg_leads`) | MySQL/TiDB |
| Company CRM fields (`cgSharepointId`, `cgLeadClass`, etc.) | `companies` table |
| Badge lookup API | `trpc.cgLead.lookup` — matches by SharePoint ID → domain → company name |

CRM filter uses SQL `EXISTS` against `lt_mns_cg_leads` (domain + SharePoint ID match). Same logic as the badge, but evaluated server-side for pagination.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint commits | Use GitHub `main` |
| Add CRM URLs to Supabase | CRM lookup is MySQL-only |
| Re-create `lt_mns_cg_leads` if it exists | Migration 0061 already created it; import script upserts |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `scripts/import-sharepoint-leads.mjs` | CSV + `LinkToItem` column support |
| `server/db.ts` | `findCgLead` SharePoint ID lookup; CRM filter SQL |
| `server/cgLeadRouter.ts` | `sharepointId` input on lookup |
| `server/companyFinder.ts` | `crmFilter` on `getCompanyDb` |
| `client/src/components/CgLeadBadge.tsx` | `sharepointId` prop |
| `client/src/pages/CompanyDatabase.tsx` | CRM column + filter dropdown |
| `client/src/pages/CompanyDetail.tsx` | CRM badge in header |
| `client/src/pages/SearchResults.tsx` | Pass `sharepointId` to badge |
| `client/src/pages/SharePage.tsx` | CRM badge in gated single-company share header |
| `client/src/pages/ShareListPage.tsx` | Compact CRM badge per list row (existing) |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] `lt_mns_cg_leads` row count: `________`
- [ ] CRM import run: yes / no / already populated
- [ ] Smoke test B (CRM filter) passed
- [ ] Smoke test C (detail CRM link) passed
- [ ] Smoke test E (share list + single `/share/:token` CRM link) passed
- [ ] Build / `tsc --noEmit`: 0 errors

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| All badges grey "Not in CRM" | `lt_mns_cg_leads` empty — run import script |
| CRM filter returns 0 for "In CRM" | Import not run, or company domains don't match CRM export websites |
| Badge green but filter excludes company | Rare name-only match in badge; re-import with correct domains |
| Import script fails on CSV | Ensure file path quoted; `DATABASE_URL` set in sandbox |

---

## Related docs

- [`docs/SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide)
- [`docs/database_mess.md`](./database_mess.md)
- [`docs/manus-deploy-handoff-june-2026.md`](./manus-deploy-handoff-june-2026.md)
