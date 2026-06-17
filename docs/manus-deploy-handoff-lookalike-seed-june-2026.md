# Manus Deploy Handoff — Lookalike Seed Inclusion (June 2026)

Always include the **source company** in lookalike preview results and in campaigns created from lookalike search.

> **Related:** [`manus-deploy-handoff-lookalike-modal-june-2026.md`](./manus-deploy-handoff-lookalike-modal-june-2026.md) (wider modal UI). Deploy that release first if not already on production.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (lookalike seed inclusion) |
| **Deploy target** | Manus WebDev (backend + frontend) |

### What's in this release

1. **Preview** — source company is always row 1 in lookalike results, with SIM 100 and a **Source** badge.
2. **Campaign create** — `createCampaignFromLookalike` always clones the seed company into the new campaign, even if the user deselected it in the modal.
3. **Seed similarity score** — seed defaults to `similarityScore: 100` when cloned into a lookalike campaign.

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

Existing lookalike preview still depends on Supabase (unchanged):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- RPC: `match_companies_to_embedding`

---

## Step 4 — Smoke tests (production)

### A. Preview — source company in results

1. Log in → open **Company Database**.
2. On any company with an embedding, click **Find companies like**.
3. Select a brain, click **Preview**.
4. **Expected:**
   - First row is the source company with a **Source** badge.
   - SIM column shows **100** for the source row.
   - Peer matches appear below (unchanged behavior).
   - "Showing N of M matches" counts peers only (source is extra).

### B. Campaign create — seed always included

1. After preview, **deselect** the source company checkbox.
2. Keep at least one peer selected, enter campaign name, click **Create Campaign**.
3. **Expected:**
   - Toast mentions "(source company included)" when seed was deselected.
   - New campaign contains the source company plus selected peers.
   - Redirect to search results works as before.

### C. Campaign create — seed selected (regression)

1. Preview with source checked (default), select peers, create campaign.
2. **Expected:** Source + peers in campaign; no duplicate source row.

### D. Filters regression

1. Apply country or sector filter, preview.
2. **Expected:** Source row still appears first even if it would not pass the filter.

---

## Architecture notes (do not change unless asked)

| Flow | Notes |
|------|-------|
| `previewLookalikeSearch` | RPC still excludes seed via `excludeWatchlistIds`; seed prepended server-side with `simScore: 100` |
| `createCampaignFromLookalike` | `mergeLookalikeCampaignCompanyIds` unions `seedCompanyId` with selected IDs |
| Embeddings | Supabase `lt_mns_company_embeddings`; MySQL `companies` for clone target |

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint instead of GitHub `main` | May miss this release |
| Run `db:push` for this release alone | No schema changes |
| Remove `excludeWatchlistIds` from RPC path without dedupe | Would duplicate seed in peer list |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/companySimilaritySearch.ts` | `isSeed` on `MysqlCompanySimRow`; `prependSeedToLookalikeResults`, `mergeLookalikeCampaignCompanyIds` |
| `server/companyFinder.ts` | Prepend seed in preview; union seed on campaign create; default seed SIM 100 |
| `client/src/components/CompanyLookalikeModal.tsx` | Source badge; toast when seed deselected but included |
| `server/companyLookalike.test.ts` | Tests for prepend and merge helpers |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migrations applied: **N/A**
- [ ] Smoke test A passed (source row in preview)
- [ ] Smoke test B passed (seed in campaign when deselected)
- [ ] Build / `tsc --noEmit`: 0 errors

Include: test URL(s), screenshot of Source badge row if possible.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Source row missing from preview | Old backend not deployed; hard refresh / redeploy |
| "No embedding found" on preview | Seed company not embedded — run FIT-SIM or re-import |
| Source missing from created campaign | Old `createCampaignFromLookalike` — redeploy backend |
| Duplicate source in table | Bug — should not happen; RPC exclusion + dedupe on prepend |

---

## Related docs

- [`docs/manus-deploy-handoff-lookalike-modal-june-2026.md`](./manus-deploy-handoff-lookalike-modal-june-2026.md)
- [`docs/database_mess.md`](./database_mess.md)
