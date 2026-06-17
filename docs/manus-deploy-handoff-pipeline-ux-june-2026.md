# Manus Deploy Handoff — Pipeline UX (June 2026)

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

1. **Unified search pipeline** — Run full pipeline / Process next 10 now runs all four steps: Enrich → LLM FIT → Urgency brief → Outreach.
2. **Pipeline Progress Card** on Search Results — single primary CTA replaces confusing DO ALL + ①②③ buttons.
3. **SIM vs FIT badges** — list rows show `SIM` (embedding) vs `FIT` (LLM) honestly.
4. **Removed duplicate UI** — ① SCORE FIT / ② SCORE URGENCY / ③ CREATE OUTREACH removed from Search Results (campaign queue worker kept for in-flight jobs).
5. **Migration `0064`** — `batch_jobs.fitScored` column for progress tracking.

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

### Verify current state

```sql
SHOW COLUMNS FROM batch_jobs LIKE 'fitScored';
```

### Migrations to apply

| Migration file | Creates / changes | Skip if |
|----------------|-------------------|---------|
| `drizzle/0064_batch_jobs_fit_scored.sql` | Adds `fitScored INT NOT NULL DEFAULT 0` to `batch_jobs` | Column already exists |

```sql
ALTER TABLE `batch_jobs` ADD `fitScored` int DEFAULT 0 NOT NULL;
```

Or: `npm run db:push` (if configured for this environment).

**Note:** `0063_backfill_sector_from_slice_metadata.sql` may also be pending on production — check separately if sector backfill was not yet applied.

---

## Step 3 — Config & domains

**Env vars** — no new variables. Existing required:

- `XAI_API_KEY` — LLM FIT scoring + urgency briefs
- `DATABASE_URL` — TiDB MySQL
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — embedding similarity (SIM scores)

---

## Step 4 — Smoke tests (production)

### A. Search Results pipeline UI

1. Open `/search-results/<completed-search-id>` (e.g. a niche with embed-only SIM scores).
2. Confirm **one** pipeline card with **Run full pipeline (N)** and **Process next 10** — no ①②③ button row.
3. Confirm step strip shows Found / Enriched / FIT / Urgency / Outreach counts.
4. Start **Run full pipeline** — progress bar shows enriched · FIT · urgency · outreach counters.
5. After job completes, company rows should show blue **FIT** badges (not grey **SIM**) where scoring succeeded.

### B. Search Results list (select mode)

1. Open `/search-results/select`.
2. Confirm campaign cards have **no** SCORE FIT / SCORE URGENCY / CREATE OUTREACH buttons.

### C. Regression

1. Export to SharePoint still works.
2. Company detail page still loads brief / approach.
3. `npm run build` — 0 TypeScript errors before publish.

---

## Architecture notes (do not change unless asked)

| Flow | Notes |
|------|-------|
| `doNext10` / `doAll` | Uses `server/companyPipeline.ts` — 4-step batch job via `batch_jobs` |
| `campaign_queue` | Worker still runs for any pre-deploy queued jobs; no new UI enqueue from Search Results |
| FIT scoring | `scoreCompanyFit` in `briefGenerator.ts` — respects run `brainId` |

**Known gaps (intentional):** Campaign queue not merged into batch_jobs at DB level.

---

## What not to do

| Don't | Why |
|-------|-----|
| Re-add ①②③ buttons on Search Results | Reintroduces dual-pipeline confusion |
| Deploy from sandbox checkpoint | Use GitHub `main` as source of truth |
| Skip `0064` migration | Progress bar FIT counter stays at 0 |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/companyPipeline.ts` | New shared 4-step pipeline helper |
| `server/companyFinder.ts` | doNext10/doAll refactor, extended enrichmentStats |
| `server/briefGenerator.ts` | `scoreCompanyFit` accepts `brainId` |
| `client/src/components/PipelineProgressCard.tsx` | New primary UX |
| `client/src/components/FitScoreBadge.tsx` | SIM vs FIT badges |
| `client/src/pages/SearchResults.tsx` | Wired new card, removed queue UI |
| `drizzle/0064_batch_jobs_fit_scored.sql` | `fitScored` on batch_jobs |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migration `0064` applied (or column already existed)
- [ ] Smoke test A passed (pipeline UI + FIT badges)
- [ ] Smoke test B passed (select mode — no queue buttons)
- [ ] Build / `tsc --noEmit`: 0 errors

Include: migration output, test URL, screenshot of Pipeline Progress Card if possible.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Pipeline runs but FIT stays SIM | `XAI_API_KEY` missing or `scoreCompanyFit` error — check server logs `[doAll]` / `[doNext10]` |
| Progress FIT counter always 0 | `batch_jobs.fitScored` column missing — run migration 0064 |
| Job stuck at 0% | Stale `batch_jobs` row — refresh page; check job status in DB |
| Old ①②③ jobs still running | Pre-deploy `campaign_queue` jobs — worker will drain them |

---

## Related docs

- [`docs/database_mess.md`](database_mess.md)
- [`.cursor/skills/leadtrigger-release/handover-template.md`](../.cursor/skills/leadtrigger-release/handover-template.md)
