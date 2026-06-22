# Manus Deploy Handoff — Share List CSV Export (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (includes share list CSV export) |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Download CSV** — new button on `/share/list/:listToken` exports a simple 4-column CSV for Excel/CRM merge: Company Name, Company Website, SharePoint URL, Shareable Page URL.
2. **Share Links (CRM) TSV** — adds **Company Website** column (6 columns total); column order updated for Vibe/Dataverse imports.
3. **Docs** — `docs/dataverse-share-links-simple.md` (Dataverse helper table guide); SharePoint/Dataverse TSV contract updates.

**No database migrations.** **No new env vars.** Frontend-only + docs.

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

**None required** for this release.

Optional sanity check (CRM badges still work for CSV SharePoint URL column):

```sql
SELECT COUNT(*) AS crm_rows FROM lt_mns_cg_leads;
```

---

## Step 3 — Config & domains

No new environment variables.

Existing share list behaviour unchanged (gated lists, filters, CRM enrichment via `lt_mns_cg_leads`).

---

## Step 4 — Smoke tests (production)

### A. Download CSV (primary)

1. Open a share list with CRM-matched companies, e.g. `/share/list/<listToken>`.
2. Click **Download CSV** (outline button, next to Download Excel).
3. Confirm filename: `{list-name}-links.csv`.
4. Open in Excel — header row exactly:

   ```text
   Company Name,Company Website,SharePoint URL,Shareable Page URL
   ```

5. Confirm CRM-matched rows have **SharePoint URL** populated (`DispForm.aspx?ID=…`).
6. Confirm every row has **Shareable Page URL** (`https://<domain>/share/<token>`).
7. Non-CRM companies: SharePoint URL column empty; share URL still present.

### B. Share Links (CRM) TSV (regression)

1. Same page → **Share Links (CRM)**.
2. Confirm header:

   ```text
   Link ID	Company	Company Website	SharePoint Item URL	LeadTrigger Share Page	Campaign
   ```

3. Tab-separated; only rows with Link ID.

### C. Download Excel / JSON (regression)

1. **Download Excel** and **Download JSON** still work; no column regressions on Excel export.

---

## Architecture notes (do not change unless asked)

| Area | Notes |
|------|-------|
| CSV export | Client-side only (`ShareListPage.tsx`); respects active filters on the page |
| CRM SharePoint URL | Resolved server-side in `resolveListToken` via `lt_mns_cg_leads` |
| Share page URL | Built from `window.location.origin` + `/share/{token}` |

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint without `git pull origin main` | May miss CSV button |
| Re-add Vibe-only import without updating TSV column order | Company Website is now column 3 |
| Add DB migration for this feature | Not needed |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `client/src/pages/ShareListPage.tsx` | `handleDownloadLinksCsv`, **Download CSV** button; TSV adds Company Website |
| `docs/dataverse-share-links-simple.md` | New — Dataverse LT Share Links guide |
| `docs/sharepoint-share-links-simple.md` | TSV column contract updated |
| `docs/manus-deploy-handoff-share-export-research-june-2026.md` | TSV header reference updated |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migrations: **N/A** (none)
- [ ] Smoke test A — Download CSV passed
- [ ] Smoke test B — Share Links (CRM) TSV passed
- [ ] Smoke test C — Excel/JSON regression passed
- [ ] Build / `tsc --noEmit`: 0 errors

Include: production share list URL used for test, screenshot of CSV opened in Excel.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| No **Download CSV** button | Old build — republish from latest `main` |
| SharePoint URL empty for known CRM company | `lt_mns_cg_leads` not imported or domain mismatch |
| CSV garbled in Excel | File is UTF-8 with BOM — open via Excel Data → From Text/CSV if double-click fails |
| Vibe import wrong columns | Update flow to 6-column TSV order (Company Website at index 2) |

---

## Related docs

- [`docs/sharepoint-share-links-simple.md`](./sharepoint-share-links-simple.md)
- [`docs/dataverse-share-links-simple.md`](./dataverse-share-links-simple.md)
- [`docs/push-share-list-to-sharepoint.md`](./push-share-list-to-sharepoint.md)
- [`docs/manus-deploy-handoff-crm-links-june-2026.md`](./manus-deploy-handoff-crm-links-june-2026.md)
