# Manus Deploy Handoff — June 2026

Implementation guide for Manus WebDev engineer. Covers the consolidated `main` release after GitHub/sandbox reconciliation (June 2026).

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `569be50` or latest on `main` after pull |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. **Share email gate restore** — public share pages require verified work email again (`ShareGate.tsx`).
2. **Contact retrieval audit log** — new MySQL table + admin **Contact Retrievals** tab on `/share-access-log`.
3. **Share feedback on MySQL** — `share_feedback` table; Supabase dependency removed from feedback flow.
4. **Lookalike / similarity speedup** — Supabase pgvector RPC (`match_companies_to_embedding`) replaces full-table scan.
5. **TypeScript deploy fix** — `CompanyDbSectorSelectItems` fixes sectors dropdown TS2322 in lookalike modal.
6. **Drizzle metadata cleanup** — migration journal aligned at 0060 → 0061 → 0062; duplicate `shareFeedback` schema definition removed.

---

## Step 1 — Sync from GitHub

Use GitHub `main` as the single source of truth. Do **not** deploy from old sandbox checkpoint commits — local sandbox and remote had diverged; that is now merged on `main`.

```bash
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline
# Expect: 569be50 or newer
```

Then run the usual Manus publish flow:

1. `npm run build` (runs `tsc --noEmit` via `prebuild` — must pass with 0 errors)
2. Publish / deploy the WebDev app
3. After build, confirm `client/public/__manus__/version.json` reflects a recent commit hash

---

## Step 2 — Database migrations (MySQL / TiDB)

Check what is already applied, then run only what is missing.

### Verify current state

```sql
SHOW TABLES LIKE 'share_feedback';
SHOW TABLES LIKE 'lt_mns_cg_leads';
SHOW TABLES LIKE 'share_contact_retrieval_log';
```

### Migration 0061 — apply only if `share_feedback` is missing

**File:** `drizzle/0061_bitter_mariko_yashida.sql`

Creates:

- `share_feedback` — anonymous ratings on public share pages (moved off Supabase)
- `lt_mns_cg_leads` — SharePoint CRM lookup reference table

> **Note:** Sandbox checkpoint `f5c6229` may already have applied this on TiDB. **Skip if tables exist.**

### Migration 0062 — required for this release

**File:** `drizzle/0062_share_contact_retrieval_log.sql`

Creates `share_contact_retrieval_log` — audit trail when verified visitors trigger Apollo contact fetches on share pages.

From project root:

```bash
npm run db:push
```

Or run SQL manually:

```sql
CREATE TABLE `share_contact_retrieval_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `visitorEmail` varchar(320) NOT NULL,
  `domain` varchar(128) NOT NULL,
  `shareToken` varchar(64) NOT NULL,
  `companyId` int NOT NULL,
  `companyName` varchar(300),
  `actionType` enum('decision_makers','all_personnel') NOT NULL,
  `contactsReturned` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `share_contact_retrieval_log_id` PRIMARY KEY(`id`)
);

ALTER TABLE `share_contact_retrieval_log`
  ADD CONSTRAINT `share_contact_retrieval_log_companyId_companies_id_fk`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade;
```

Confirm:

```sql
SHOW TABLES LIKE 'share_contact_retrieval_log';
DESCRIBE share_contact_retrieval_log;
```

### Migration chain (do not alter)

| Idx | Tag | Contents |
|-----|-----|----------|
| 0060 | `0060_clean_nightmare` | (existing) |
| 0061 | `0061_bitter_mariko_yashida` | `share_feedback`, `lt_mns_cg_leads` |
| 0062 | `0062_share_contact_retrieval_log` | `share_contact_retrieval_log` |

Do **not** create a second `0061_*` file or rename migrations — `drizzle/meta/_journal.json` and `0062_snapshot.json` are aligned on `main`.

---

## Step 3 — Confirm share allowed domains

Contact fetch buttons only work for emails whose domain is in `share_allowed_domains`.

```sql
SELECT * FROM share_allowed_domains;
```

Add missing domains via admin UI (Share Access Log → domain management) or SQL:

```sql
INSERT INTO share_allowed_domains (domain, addedBy) VALUES ('connectgroup.com', 1);
```

---

## Step 4 — Smoke tests (production)

### A. Share email gate

1. Open a share link in **incognito**: `/share/<token>`
2. Expect **"Verify your identity"** — not the company page immediately
3. Enter an **allowed** work email → page loads
4. Refresh → gate should be skipped (`lt_share_visitor_email` in `localStorage`)
5. Try a **non-allowed** domain → expect denial message

**Affected pages (wrapped in `ShareGate`):**

- `/share/:token` — `SharePage.tsx`
- `/share/list/:listToken` — `ShareListPage.tsx`
- `/share/brain/:token` — `ShareBrainPage.tsx`
- `/share/brains` — `BrainOverviewPage.tsx`

### B. Contact retrieval on share pages

1. After passing the gate, click **Find Decision-Makers** or **Get All Personnel**
2. Buttons must be **enabled** (not greyed out)
3. Contacts load or show a clear Apollo/API error

### C. Contact retrieval audit (admin)

1. Log in → `/share-access-log`
2. **Access Log** tab — page access attempts (existing)
3. **Contact Retrievals** tab — new row with visitor email, company name, action type, contact count, timestamp

### D. Share feedback (MySQL)

1. On a share page, submit thumbs up/down feedback
2. Admin → `/feedback` — entry appears
3. Confirms `POST /api/public/share-lists/feedback` writes to MySQL `share_feedback` (not Supabase)

### E. Lookalike / similarity preview (performance)

1. Company Database → open lookalike modal → run preview
2. Should return in seconds, not minutes
3. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in env
4. Uses Supabase RPC `match_companies_to_embedding` via `server/companySimilaritySearch.ts`

### F. Sectors dropdown (TypeScript fix)

1. Company Database → lookalike modal → sectors dropdown
2. Renders without build errors (`CompanyDbSectorSelectItems.tsx`)

---

## Architecture notes (do not change unless asked)

| Endpoint | Auth model |
|----------|------------|
| `share.resolveToken` | Public — loads page data (including stored contacts) |
| `shareExt.verifyShareAccess` | Public — email domain allowlist check |
| `shareExt.findDecisionMakers` | Public + `visitorEmail` on allowlist |
| `shareExt.getAllPersonnelForShare` | Public + `visitorEmail` on allowlist |
| `shareExt.getShareContactRetrievalLog` | Admin only |
| `shareExt.getFeedback` | Admin only — reads MySQL `share_feedback` |

**Known gap (intentional):** `resolveToken` can return contacts already in DB before the client-side email gate runs. Full server-side gating of stored contacts was not part of this release.

---

## What not to do

| Don't | Why |
|-------|-----|
| Re-apply migration 0061 under a different filename | Causes journal drift |
| Re-add duplicate `shareFeedback` in `drizzle/schema.ts` | Breaks TypeScript (fixed in `e9f9be1`) |
| Point feedback reads back to Supabase `lt_share_feedback` | Feedback is MySQL-only now |
| Skip migration 0062 | Contact Retrievals tab will error |
| Deploy from an old sandbox checkpoint commit | Use GitHub `main` only |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `client/src/components/ShareGate.tsx` | Email gate restored |
| `client/src/pages/ShareAccessLogPage.tsx` | Contact Retrievals tab |
| `client/src/pages/FeedbackPage.tsx` | Reads MySQL feedback |
| `server/shareRouter.ts` | Contact retrieval logging + `getShareContactRetrievalLog` |
| `server/routes/publicShareListApi.ts` | Feedback POST → MySQL |
| `server/companySimilaritySearch.ts` | pgvector RPC similarity search |
| `client/src/components/CompanyDbSectorSelectItems.tsx` | Sectors TS2322 fix |
| `drizzle/schema.ts` | `shareContactRetrievalLog` table |
| `drizzle/0062_share_contact_retrieval_log.sql` | Migration |
| `drizzle/meta/_journal.json` | Journal entries 0061 + 0062 |
| `drizzle/meta/0062_snapshot.json` | Drizzle snapshot for 0062 |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] `share_feedback` table exists (0061)
- [ ] `share_contact_retrieval_log` table exists (0062)
- [ ] Share email gate works (incognito test)
- [ ] Contact fetch works for allowed domain
- [ ] Contact Retrievals tab shows test row
- [ ] `/feedback` shows test submission
- [ ] Lookalike preview works (fast response)
- [ ] Build / `tsc --noEmit`: 0 errors

Include: migration output, one share URL tested, screenshot of Contact Retrievals tab after a test fetch.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Contact buttons greyed out | Email gate not deployed, or visitor hasn't passed gate |
| "Access denied: email domain not on allowlist" | Domain missing from `share_allowed_domains` |
| Contact Retrievals tab empty / errors | Migration 0062 not run |
| Page loads without email prompt | Old build cached, or `ShareGate` still pass-through — redeploy |
| Feedback not in admin UI | Migration 0061 not applied, or still reading Supabase |
| Lookalike preview slow / fails | Supabase env vars missing, or RPC `match_companies_to_embedding` not deployed in Supabase |
| Build fails on sectors dropdown | Old code — pull latest `main` with `CompanyDbSectorSelectItems` |

---

## Related docs

- [`share-page-email-gate-and-audit.md`](./share-page-email-gate-and-audit.md) — detailed share-page change spec
- [`database_mess.md`](./database_mess.md) — dual-DB architecture map and cutover plan
- [`SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide) — `lt_mns_cg_leads` import
