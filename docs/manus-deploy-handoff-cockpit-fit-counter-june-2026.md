# Manus Deploy Handoff — Cockpit FIT Counter Fix (June 2026)

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | Latest on `main` after pull (commit message: *Fix cockpit FIT counter showing 0 when companies have scored fit data*) |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Cockpit FIT counter fix** — Search Results pipeline card no longer shows `FIT 0` when companies already have LLM or brain-scoped fit scores.
2. **List query fields** — `getCompaniesBySearchIdPaged` now returns `fitScoreSource` and `similarityScore` so pipeline stats and `FitScoreBadge` (FIT vs SIM) work on the list view.
3. **Brain-scoped merge on getSearch** — Auto-resolves brain from run `brainId`, or majority `generatedWithBrainId` on Excel imports, so cockpit stats match company detail and share pages.
4. **Business unit label** — Pipeline card shows brain name from search, active brain, or `generatedWithBrainName` fallback (fixes `—` on Excel import runs).
5. **FIT step tooltip** — Clarifies LLM FIT vs embedding SIM on hover.

**No database migrations.** App-only deploy.

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

**None required for this release.**

No schema changes. Existing columns used:

- `companies.fitScore`, `companies.fitScoreSource`, `companies.similarityScore`
- `company_brain_outputs.fitScore` (brain-scoped scores)

Optional verification on a known campaign (e.g. Excel import run #2130008):

```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN fitScoreSource = 'llm' THEN 1 ELSE 0 END) AS llm_fit,
  SUM(CASE WHEN fitScoreSource = 'embed' THEN 1 ELSE 0 END) AS sim_embed,
  SUM(CASE WHEN briefGeneratedAt IS NOT NULL THEN 1 ELSE 0 END) AS has_brief
FROM companies
WHERE searchId = <search_id>;
```

---

## Step 3 — Config & domains

**Env vars** — no new variables. Existing required:

- `XAI_API_KEY` — LLM FIT scoring
- `DATABASE_URL` — TiDB MySQL
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — embedding SIM scores

---

## Step 4 — Smoke tests (production)

### A. Cockpit FIT counter (primary)

1. Open a completed search with scored companies, e.g. `/search-results/2130008` (apollo-accounts-export Excel import).
2. Confirm pipeline step strip shows **FIT** count matching companies with LLM fit (not `0` when detail pages show FIT scores).
3. Confirm **Business unit** shows a brain name (not `—`) when companies have `generatedWithBrainName`.
4. Hover **FIT** step — tooltip mentions LLM vs SIM.

### B. List row badges

1. On the same search, list view rows should show:
   - **FIT N** (blue) for LLM-scored companies
   - **SIM N** (grey) for embed-only similarity
2. Amber badges on the **left** are **urgency** — not FIT.

### C. Consistency with detail / share

1. Open one company from the list — FIT tab/score should match list badge.
2. Create or open a share list — Fit column should align with cockpit FIT count logic.

### D. Regression

1. Run full pipeline on a small pending batch — FIT counter increments during job.
2. `npm run build` — 0 TypeScript errors before publish.

---

## Architecture notes (do not change unless asked)

| Flow | Notes |
|------|-------|
| `getSearch` | Merges `company_brain_outputs` when `input.brainId`, `search.brainId`, or inferred `generatedWithBrainId` is set |
| `computePipelineStats` | FIT step counts `fitScoreSource === 'llm'` or `brainFitScore != null` |
| Share / detail pages | May show any numeric `fitScore` as "Fit"; cockpit FIT step is LLM-specific |

**Root cause fixed:** Paged list query omitted `fitScoreSource`, so stats always treated companies as unscored.

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from sandbox checkpoint | Use GitHub `main` as source of truth |
| Expect FIT count to include SIM-only scores | Pipeline FIT = LLM step; SIM is separate |
| Add migrations for this release | No schema change |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `server/db.ts` | Add `fitScoreSource`, `similarityScore` to paged search company query |
| `server/companyFinder.ts` | Auto-resolve brain for merge; fix brief/approach fallback |
| `client/src/pages/SearchResults.tsx` | Business unit name fallback chain |
| `client/src/components/PipelineProgressCard.tsx` | FIT step tooltip |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migrations: **N/A** (none)
- [ ] Smoke test A — FIT counter not stuck at 0 on scored campaign
- [ ] Smoke test B — FIT/SIM badges on list rows
- [ ] Smoke test C — detail/share consistency
- [ ] Build / `tsc --noEmit`: 0 errors

Include: test search ID used, screenshot of pipeline card with FIT count.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| FIT still 0 | Companies only have embed/SIM scores (`fitScoreSource = 'embed'`); run full pipeline for LLM FIT |
| FIT 0 but detail shows score | Brain output exists but legacy `fitScoreSource` not `llm` — re-run pipeline or check `company_brain_outputs` |
| Business unit still `—` | No brain on search and no `generatedWithBrainName` on companies |
| List shows no FIT/SIM badge | Company has no `fitScore` or `similarityScore` |

---

## Related docs

- [`docs/manus-deploy-handoff-pipeline-ux-june-2026.md`](manus-deploy-handoff-pipeline-ux-june-2026.md) — unified pipeline UI
- [`docs/database_mess.md`](database_mess.md) — dual-DB architecture
