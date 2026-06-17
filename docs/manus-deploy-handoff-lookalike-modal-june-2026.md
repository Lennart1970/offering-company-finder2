# Manus Deploy Handoff — Lookalike Modal UI (June 2026)

Standalone frontend release. Widen the **Find companies like** modal so users can review lookalike results without cramped columns.

> **Note:** This is separate from [`manus-deploy-handoff-june-2026.md`](./manus-deploy-handoff-june-2026.md) (share gate, audit log, similarity RPC, migrations). Deploy that release first if not already on production.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `3b0e24e` — *Widen lookalike modal for easier review of company matches.* |
| **Deploy target** | Manus WebDev (frontend publish only) |

### What's in this release

1. **Wider lookalike modal** — dialog uses ~92% viewport width (max 1400px) instead of `max-w-4xl` (~896px).
2. **Improved results table** — fixed column proportions (Company 32%, Location 18%, Sector 32%, SIM/FIT 9% each); removed tight `max-w` caps on company name and sector cells.

**No backend, database, or env changes.**

---

## Step 1 — Sync & deploy

Use GitHub `main` as the single source of truth.

```bash
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline
# Expect: 3b0e24e or newer
```

Then:

1. `npm run build` — must pass `tsc --noEmit` via `prebuild` (0 errors)
2. Publish / deploy the Manus WebDev app
3. Confirm `client/public/__manus__/version.json` reflects commit `3b0e24e` or later

---

## Step 2 — Database migrations

**None required.** This release only changes `client/src/components/CompanyLookalikeModal.tsx`.

Do not run `npm run db:push` for this deploy unless other pending migrations from the June 2026 handoff are still outstanding.

---

## Step 3 — Config & env

**No new or changed environment variables.**

Existing lookalike preview still depends on Supabase (unchanged):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- RPC: `match_companies_to_embedding`

---

## Step 4 — Smoke tests (production)

### A. Modal width

1. Log in → open **Company Database**.
2. On any company row, click **Find companies like** (copy icon / lookalike action).
3. **Expected:** Modal spans most of the screen (up to ~1400px wide), not a narrow centered box.

### B. Table readability

1. Select a brain, set filters if desired, click **Preview**.
2. **Expected:** Company and Sector columns show full text where space allows; sector names like `aviation & aerospace` are not cut to `aviation & aerosp...`.
3. SIM and FIT LLM columns remain right-aligned.

### C. Campaign creation (regression)

1. Select one or more companies, enter campaign name, click **Create Campaign**.
2. **Expected:** Campaign created; redirect to search results page as before.

---

## Files changed

| File | Change |
|------|--------|
| `client/src/components/CompanyLookalikeModal.tsx` | Wider `DialogContent`, `table-fixed` layout, column width classes |

---

## What not to do

| Don't | Why |
|-------|-----|
| Deploy from an old sandbox checkpoint instead of GitHub `main` | May miss `3b0e24e` |
| Run migrations “just in case” for this UI-only release | Unnecessary; risk of drift |
| Revert modal width without product sign-off | Users requested wider layout for review |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________` (expect `3b0e24e`)
- [ ] `npm run build` / `tsc --noEmit`: 0 errors
- [ ] Smoke test A — modal width: pass
- [ ] Smoke test B — table readability: pass
- [ ] Smoke test C — create campaign: pass

Include: deployed commit hash, test URL, screenshot of widened modal (optional).

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Modal still narrow (~900px) | Stale build; republish after `git pull` to `3b0e24e+` |
| Preview empty / error | Supabase env or RPC issue — unrelated to this UI change; see June 2026 handoff |
| Sector still truncated on very small screens | Expected below ~768px viewport; layout uses `truncate` within column width |
| `tsc` errors on build | Pull latest `main`; ensure Manus checkpoint `d9e6b4a`+ is in history (ES2020 tsconfig fix) |

---

## Related docs

- [`docs/manus-deploy-handoff-june-2026.md`](./manus-deploy-handoff-june-2026.md) — prior consolidated release (share gate, migrations, similarity RPC)
- [`docs/database_mess.md`](./database_mess.md) — dual-DB architecture (MySQL + Supabase)

---

## Manus engineer quick instructions

```
1. git pull origin main && git log -1 --oneline   # expect 3b0e24e
2. npm run build                                  # 0 TS errors
3. Publish Manus WebDev app
4. Smoke: Company Database → Find companies like → Preview → confirm wide modal
5. Reply with: commit hash, checklist above, screenshot optional
```
