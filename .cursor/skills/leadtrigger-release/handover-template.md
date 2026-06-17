# Manus Deploy Handoff — [MONTH YEAR]

Implementation guide for Manus WebDev engineer.

---

## Release summary

| Item | Value |
|------|-------|
| **Repo** | [offering-company-finder2](https://github.com/Lennart1970/offering-company-finder2) |
| **Branch** | `main` |
| **Target commit** | `[SHORT_HASH]` or latest on `main` after pull |
| **Deploy target** | Manus WebDev (TiDB MySQL + existing Supabase env) |

### What's in this release

1. [Change 1]
2. [Change 2]
3. [Change 3]

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

### Verify current state

```sql
-- Add SHOW TABLES for tables this release touches
SHOW TABLES LIKE 'example_table';
```

### Migrations to apply

| Migration file | Creates / changes | Skip if |
|----------------|-------------------|---------|
| `drizzle/00NN_tag.sql` | [description] | [table already exists] |

```bash
npm run db:push
```

Or run SQL manually from the migration file, then confirm with `DESCRIBE`.

---

## Step 3 — Config & domains

```sql
-- Example: share pages
SELECT * FROM share_allowed_domains;
```

**Env vars** (if this release needs them):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- [others]

---

## Step 4 — Smoke tests (production)

### A. [Feature area 1]

1. [Step]
2. [Expected result]

### B. [Feature area 2]

1. [Step]
2. [Expected result]

---

## Architecture notes (do not change unless asked)

| Endpoint / flow | Notes |
|-----------------|-------|
| [name] | [auth model / DB] |

**Known gaps (intentional):** [if any]

---

## What not to do

| Don't | Why |
|-------|-----|
| [anti-pattern] | [reason] |

---

## Files changed (key paths)

| File | Change |
|------|--------|
| `path/to/file` | [brief] |

---

## Sign-off checklist

Reply to product owner with:

- [ ] Git commit deployed: `________`
- [ ] Migrations applied: `________`
- [ ] Smoke test A passed
- [ ] Smoke test B passed
- [ ] Build / `tsc --noEmit`: 0 errors

Include: migration output, test URL(s), screenshot if UI change.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| [symptom] | [cause] |

---

## Related docs

- [`docs/database_mess.md`](../../docs/database_mess.md)
- [link other relevant docs]
