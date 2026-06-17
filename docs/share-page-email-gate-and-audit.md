# Share Page — Email Gate Restore + Contact Retrieval Audit Log

Implementation guide for Manus WebDev deploy. Maps the share-page security fix and contact-retrieval audit trail added June 2026.

---

## Context

We had a regression on public share pages (`/share/:token`, `/share/list/:listToken`, `/share/brain/:token`, `/share/brains`):

1. **Email gate was removed** — `ShareGate` became a pass-through, so anyone with a link could view pages without verifying their work email.
2. **Contact fetch buttons broke** — “Find Decision-Makers” and “Get All Personnel” still require a verified visitor email (`lt_share_visitor_email` in `localStorage`), but nothing was setting it anymore.
3. **No audit trail** for who triggered Apollo contact lookups on share pages.

Code changes are prepared in the LeadTrigger v1 repo. Deploy them to Manus and run the DB migration.

---

## What changed in code

### 1. Restore email gate

**File:** `client/src/components/ShareGate.tsx`

- Restored the “Verify your identity” screen.
- Visitor enters work email → server checks domain against `share_allowed_domains`.
- On success, email is stored in `localStorage` as `lt_share_visitor_email`.
- Returning visitors with a valid stored email are silently re-verified.
- `tokenType="business unit"` maps to `brain` for the API (UI label only).

**Affected pages (already wrapped in `ShareGate`):**

- `client/src/pages/SharePage.tsx`
- `client/src/pages/ShareListPage.tsx`
- `client/src/pages/ShareBrainPage.tsx`
- `client/src/pages/BrainOverviewPage.tsx`

### 2. Contact retrieval audit log

**Files:**

- `drizzle/schema.ts` — new table `share_contact_retrieval_log`
- `drizzle/0062_share_contact_retrieval_log.sql` — migration
- `server/shareRouter.ts` — logs on `findDecisionMakers` and `getAllPersonnelForShare`
- `client/src/pages/ShareAccessLogPage.tsx` — new **Contact Retrievals** tab

**Logged when:** a verified visitor clicks **Find Decision-Makers** or **Get All Personnel** (Apollo fetch).

**Not logged:** page views (still in `share_access_log`) or viewing contacts already in DB.

---

## Tasks

### Step 1 — Sync and deploy code

Pull latest from the repo branch with these changes and deploy to Manus as usual (build + publish WebDev app).

### Step 2 — Run MySQL migration

Apply migration `0062_share_contact_retrieval_log.sql`.

From project root:

```bash
npm run db:push
```

Or run the SQL manually in TiDB/MySQL:

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

Confirm table exists:

```sql
SHOW TABLES LIKE 'share_contact_retrieval_log';
```

### Step 3 — Confirm allowed domains

Contact fetch only works for emails whose domain is in `share_allowed_domains`.

Check:

```sql
SELECT * FROM share_allowed_domains;
```

Add missing domains via the admin UI (Share Access Log / domain management) or SQL if needed, e.g.:

```sql
INSERT INTO share_allowed_domains (domain, addedBy) VALUES ('connectgroup.com', 1);
```

### Step 4 — Smoke test (production)

**A. Email gate**

1. Open a share link in an incognito window: `/share/<token>`
2. Expect “Verify your identity” — not the company page immediately
3. Enter an **allowed** work email → page loads
4. Refresh → should skip gate (stored in `localStorage`)
5. Try a **non-allowed** domain → expect denial message

**B. Contact retrieval**

1. After passing the gate, click **Find Decision-Makers** or **Get All Personnel**
2. Buttons should be enabled (not greyed out)
3. Contacts should load (or show a clear Apollo/API error)

**C. Audit log (admin, logged in)**

1. Go to `/share-access-log`
2. **Access Log** tab — page access attempts
3. **Contact Retrievals** tab — new row with visitor email, company name, action type, contact count, timestamp

---

## Architecture notes (do not change unless asked)

| Endpoint | Auth model |
|----------|------------|
| `share.resolveToken` | Public — loads page data (including stored contacts) |
| `shareExt.verifyShareAccess` | Public — email domain allowlist check |
| `shareExt.findDecisionMakers` | Public + `visitorEmail` must be on allowlist |
| `shareExt.getAllPersonnelForShare` | Public + `visitorEmail` must be on allowlist |

**Known gap (intentional for now):** `resolveToken` can return contacts already in DB before the email gate runs on the client. Full server-side gating of stored contacts was not part of this change.

---

## Files to review

| File | Change |
|------|--------|
| `client/src/components/ShareGate.tsx` | Email gate restored |
| `server/shareRouter.ts` | `logShareContactRetrieval()` + `getShareContactRetrievalLog` |
| `drizzle/schema.ts` | `shareContactRetrievalLog` table |
| `drizzle/0062_share_contact_retrieval_log.sql` | Migration |
| `client/src/pages/ShareAccessLogPage.tsx` | Contact Retrievals tab |

---

## Done when

- [ ] Migration `0062` applied in Manus MySQL
- [ ] Share links show email gate for new visitors
- [ ] Allowed-domain users can fetch contacts on share pages
- [ ] Contact retrievals appear in `/share-access-log` → **Contact Retrievals**
- [ ] No new TypeScript/build errors on deploy

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Contact buttons greyed out | Email gate not deployed, or `lt_share_visitor_email` not set — pass gate first |
| “Access denied: email domain not on allowlist” | Domain missing from `share_allowed_domains` |
| Contact Retrievals tab empty / errors | Migration `0062` not run |
| Page loads without email prompt | Old build cached, or `ShareGate` still pass-through — redeploy |

Reply with: migration output, one share URL tested, and a screenshot of the Contact Retrievals tab after a test fetch.
