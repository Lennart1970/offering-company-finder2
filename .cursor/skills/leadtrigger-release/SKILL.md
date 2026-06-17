---
name: leadtrigger-release
description: >-
  LeadTrigger v1 release and Manus WebDev deploy workflow. Use for offering-company-finder2,
  Manus TiDB migrations, Supabase dual-DB features, share-page deploys, drizzle migrations,
  or when writing Manus engineer handover docs for this repo.
---

# LeadTrigger v1 — Release & Manus Deploy

Extends the personal **feature-release-workflow** skill with LeadTrigger-specific steps.

**Repo:** [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2)  
**Branch:** `main` (source of truth — not old Manus sandbox checkpoint commits)  
**Deploy target:** Manus WebDev (MySQL/TiDB via `DATABASE_URL` + Supabase via env vars)

For dual-DB architecture context, see `docs/database_mess.md`.

---

## Phase 4 (LeadTrigger) — GitHub consistency

After push, verify:

```bash
git fetch origin
git log --oneline -3
git status   # should be clean and up to date with origin/main
```

**Drizzle chain** — journal in `drizzle/meta/_journal.json` must match files in `drizzle/`:

| Check | Path |
|-------|------|
| Migration SQL | `drizzle/00NN_*.sql` |
| Journal entry | `drizzle/meta/_journal.json` |
| Snapshot | `drizzle/meta/00NN_snapshot.json` |
| Schema | `drizzle/schema.ts` |

Common failures from past releases:

- Duplicate table exports in `schema.ts` (e.g. two `shareFeedback` blocks)
- Journal entry for `0062` without `0062_snapshot.json`
- Competing `0061_*` migration filenames
- Local `main` diverged from `origin/main` (parallel sandbox checkpoints)

**Version stamp:** `client/public/__manus__/version.json` — commit hash for deploy tracking (updated at build/publish).

**Build gate:** `npm run build` runs `tsc --noEmit` via `prebuild` — must be 0 errors before Manus publish.

---

## Phase 5 (LeadTrigger) — Manus handover doc

### Template

Use [handover-template.md](handover-template.md) for new handoffs.

### Naming

`docs/manus-deploy-handoff-<month>-<year>.md`  
Example: `docs/manus-deploy-handoff-june-2026.md`

### LeadTrigger-specific sections (always include)

1. **MySQL migrations** — verify-then-apply pattern:

   ```sql
   SHOW TABLES LIKE 'share_feedback';
   SHOW TABLES LIKE 'share_contact_retrieval_log';
   ```

   - `0061_bitter_mariko_yashida.sql` — `share_feedback`, `lt_mns_cg_leads` (skip if exists)
   - `0062_share_contact_retrieval_log.sql` — contact audit log (**required** for share audit feature)

2. **Share allowed domains** — contact fetch requires `share_allowed_domains` rows:

   ```sql
   SELECT * FROM share_allowed_domains;
   ```

3. **Supabase env** — for lookalike/similarity (pgvector RPC):

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - RPC: `match_companies_to_embedding`

4. **Smoke tests** tailored to change type:

   | Area | Route / action |
   |------|----------------|
   | Share email gate | `/share/<token>` incognito → "Verify your identity" |
   | Contact fetch | Find Decision-Makers / Get All Personnel after gate |
   | Contact audit | Admin `/share-access-log` → Contact Retrievals tab |
   | Share feedback | `/feedback` admin; writes MySQL `share_feedback` |
   | Lookalike preview | Company Database → lookalike modal |
   | Sectors dropdown | Lookalike modal — `CompanyDbSectorSelectItems` |

5. **Do not do** table — warn engineer against:
   - Deploying from sandbox checkpoint commits instead of GitHub `main`
   - Re-pointing feedback to Supabase `lt_share_feedback`
   - Creating duplicate migration files

### Related docs to link

| Doc | When |
|-----|------|
| `docs/manus-deploy-handoff-*.md` | Latest handoff |
| `docs/share-page-email-gate-and-audit.md` | Share gate + audit detail |
| `docs/database_mess.md` | Dual-DB map / cutover |
| `docs/SharePoint CRM Lead Lookup — Implementation Guide` | `lt_mns_cg_leads` import |

---

## Manus engineer quick instructions

Paste-ready block for chat/email:

```
1. git pull origin main && git log -1 --oneline
2. npm run build (0 TS errors)
3. Publish Manus WebDev app
4. Run missing migrations (check SHOW TABLES first)
5. Smoke test share gate + any feature in release notes
6. Reply with: commit hash, migration output, checklist from handover doc
```

---

## Architecture reminders (handover only — do not refactor unless asked)

| Data | Store |
|------|-------|
| Campaign pipeline, share tokens, feedback, audit logs | MySQL/TiDB (Drizzle) |
| Embeddings, intelligence pages, trigger refs | Supabase `lt_mns_*` |
| Auth, file storage | Manus platform (OAuth, Forge) |

Cross-DB flows (embed-on-import, bulk similarity) block full Supabase-only cutover — note in handover if release touches them.

---

## Session checklist (LeadTrigger)

```
- [ ] GitHub main synced; no sandbox divergence
- [ ] Drizzle journal + snapshots match migration files
- [ ] tsc --noEmit clean
- [ ] docs/manus-deploy-handoff-*.md written/updated
- [ ] Engineer sign-off checklist included
- [ ] User given: commit hash, doc path, top 3 engineer actions
```
