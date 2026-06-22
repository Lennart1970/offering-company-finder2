# Dataverse: LT Share Links from LeadTrigger TSV (low-code)

Use the **Share Links (CRM)** export from LeadTrigger to populate a Dataverse helper table **LT Share Links**, then surface **View brief** on your main lead table — same pattern as the SharePoint helper list, but native to Power Platform.

No custom code. One TSV per campaign, one Dataverse table, one Power Automate flow.

---

## What you get

| Main lead table (Dataverse) | Helper table: **LT Share Links** |
|-----------------------------|----------------------------------|
| Legacy Link ID = 42, Company = BAE… | Link ID = 42, Share Page = `https://…/share/abc…` |
| Lookup → **View brief** opens LeadTrigger | Imported from TSV |

**Match key:** TSV `Link ID` = lead row `Legacy Link ID` (same integer as the old SharePoint Leadlist `ID` column). LeadTrigger still resolves CRM via `lt_mns_cg_leads.id` on that number.

---

## Step 1 — Export from LeadTrigger (30 seconds)

1. Open your share list, e.g. `/share/list/<token>`
2. Click **Share Links (CRM)**
3. Save the `.tsv` file (UTF-8 with BOM, tab-separated)

```text
Link ID	Company	Company Website	SharePoint Item URL	LeadTrigger Share Page	Campaign
42	BAE SYSTEMS	https://www.baesystems.com	https://connectgroup0.sharepoint.com/sites/.../DispForm.aspx?ID=42	https://up.manus.space/share/abc123…	Defense Leads 5/19/2026
```

Rows without a CRM Link ID are omitted.

---

## Step 2 — Create the Dataverse table (once)

**make.powerapps.com** → your solution → **New table** → **LT Share Links**

Use your publisher prefix below (`lt_` shown; replace with e.g. `cg_` if that is your publisher).

### Important — use **Long Text** for URL / website columns

Do **not** use the Dataverse **URL** column type or **Single line of text** for **Company Website**, **CRM Record URL**, or **LeadTrigger Share Page**.

| Column type | Max length | Problem |
|-------------|------------|---------|
| **URL** | 2,048 chars | SharePoint `DispForm.aspx` links with encoded site/list paths can truncate on import; Power Automate upserts may fail silently or cut the value |
| **Single line of text** | 4,000 chars (if raised) | Still easy to misconfigure at default 100 chars; not clickable in forms |
| **Multiple lines of text → Long text** | **1,048,576 chars** | **Use this** — stores full TSV values, no truncation |

When creating each of those three columns in the maker portal:

1. Type: **Multiple lines of text**
2. Enable **Long text** (not “Text” / single-line multiline)
3. **Plain text** is fine (no rich text)

| Display name | Schema name | Type | From TSV |
|--------------|-------------|------|----------|
| **Name** | `lt_name` | Text (primary) | **Company** |
| **Link ID** | `lt_linkid` | Whole Number | **Link ID** |
| **Company Website** | `lt_companywebsite` | **Multiple lines of text (Long text)** | **Company Website** |
| **CRM Record URL** | `lt_crmrecordurl` | **Multiple lines of text (Long text)** | **SharePoint Item URL** |
| **LeadTrigger Share Page** | `lt_sharepageurl` | **Multiple lines of text (Long text)** | **LeadTrigger Share Page** |
| **Campaign** | `lt_campaign` | Text | **Campaign** |
| **Synced At** | `lt_syncedat` | Date and Time | set by flow |

> **Long text for all three URL-like fields** (`Company Website`, `CRM Record URL`, `LeadTrigger Share Page`) — do not use the Dataverse **URL** column type (2,048 char limit) or default single-line text (100 chars). CRM exports can contain long, multi-value, or newline-separated website values; SharePoint `DispForm.aspx` paths are often 120–350+ chars.

Example lengths from real exports (plan headroom):

```text
Company Website          ~20–500 chars    (single domain or messy multi-URL CRM values)
SharePoint Item URL      ~120–350 chars   (site path + encoded list name + ?ID=)
LeadTrigger Share Page   ~55–90 chars      (domain + /share/ + 32-char token)
```

Long text avoids breakage when paths grow, query strings are added, or domains change.

### Alternate key (required for upsert)

1. Table **LT Share Links** → **Keys** → **New key**
2. Add column **Link ID** + **Campaign** (one row per company per campaign)
3. Save and wait for index creation (~1–2 min)

> If you only ever keep **one** share link per lead (latest campaign overwrites), use **Link ID** alone as the alternate key.

### Optional — relationship to main lead table

On your lead table (e.g. **CG Lead**, **Lead**, or migrated **Leadlist** entity):

| Display name | Schema name | Type |
|--------------|-------------|------|
| **Legacy Link ID** | `lt_legacylinkid` | Whole Number |
| **LT Share Link** | `lt_ltsharelinkid` | Lookup → LT Share Links |

Import or map **Legacy Link ID** from the old SharePoint `ID` column when you migrate the lead list. LeadTrigger matching depends on this number.

---

## Step 3 — Import TSV with Power Automate (recommended)

Low-code, repeatable every time you publish a campaign.

### Flow: **LT Share Links — Import TSV**

| # | Action | Settings |
|---|--------|----------|
| 1 | **Trigger** | **Manually trigger a flow** — add input *File* (file content) **or** **When a file is created** in OneDrive folder `LeadTrigger/ShareLinks` |
| 2 | **Compose — Lines** | `split(replace(outputs('Get_file_content'), decodeUriComponent('%EF%BB%BF'), ''), decodeUriComponent('%0D%0A'))` — strips BOM, splits rows |
| 3 | **Apply to each** | Skip index `0` (header row) |
| 4 | **Compose — Columns** | `split(items('Apply_to_each'), decodeUriComponent('%09'))` — tab split |
| 5 | **Add a new row** (Dataverse) | Table: **LT Share Links** |
| | | **Link ID** → `int(outputs('Compose_Columns')[0])` |
| | | **Name** → `outputs('Compose_Columns')[1]` |
| | | **Company Website** → `outputs('Compose_Columns')[2]` |
| | | **CRM Record URL** → `outputs('Compose_Columns')[3]` |
| | | **LeadTrigger Share Page** → `outputs('Compose_Columns')[4]` |
| | | **Campaign** → `outputs('Compose_Columns')[5]` |
| | | **Synced At** → `utcNow()` |
| 6 | **Upsert** | In the action, enable **Choose row by alternate key** → key from Step 2 |

### Run it

1. Save flow → **Test** → upload your `.tsv`
2. Or drop the file in the OneDrive folder

### First-time bulk load (alternative)

If you prefer zero flow for the initial load:

1. Open the `.tsv` in Excel (tabs parse correctly)
2. Save as `.xlsx`
3. **Get data** → **Dataverse** → **Import** (or legacy **Import wizard** in maker portal)
4. Map columns to the table fields above

Use the Power Automate flow for every campaign refresh after that.

---

## Step 4 — Link leads to share links (one flow, optional)

SharePoint used manual lookup or Excel `XLOOKUP`. In Dataverse, automate the join on **Legacy Link ID = Link ID**.

### Flow: **LT Share Links — Link to Leads**

| # | Action | Settings |
|---|--------|----------|
| 1 | **Trigger** | **When a row is added or modified** — table **LT Share Links** |
| 2 | **List rows** | Table: **Leads** (your main entity) |
| | | Filter: `lt_legacylinkid eq @{triggerOutputs()?['body/lt_linkid']}` |
| 3 | **Apply to each** | (usually 0 or 1 row) |
| 4 | **Update a row** | Set **LT Share Link** lookup → current share link row |

Run once after import, or chain this flow at the end of the import flow.

---

## Step 5 — Show **View brief** in the UI

Long text columns are **not** auto-clickable in model-driven forms (unlike the URL column type). Add an explicit open action.

### Model-driven app — command bar button (recommended)

On the **LT Share Links** form or the lead form (related record):

1. App designer → **Edit command bar** → main form
2. **New** → **Command** → label: `View LeadTrigger brief`
3. **Action** → **Formula** (Power Fx):

```powerfx
Launch( Self.Selected.Item.'lt_sharepageurl' )
```

If the button sits on the **lead** form and you use a lookup:

```powerfx
Launch( Self.Selected.Item.'lt_ltsharelinkid.lt_sharepageurl' )
```

4. Hide the raw **LeadTrigger Share Page** field on the form (optional) — reps use the button only

### Model-driven app — subgrid

1. Add related **LT Share Links** subgrid on the lead form
2. Include **Campaign** and hide the long URL column from the subgrid (read-only blob)
3. Add the same **View LeadTrigger brief** command on the subgrid’s command bar using `Self.Selected.Item.'lt_sharepageurl'`

### Views — clickable label without opening the form

On a view column for **LeadTrigger Share Page**, use **Format column** (if available) or a view column display formatter so the cell shows **View brief** while the stored value remains the full long URL. Alternatively keep URLs off views and use only the command bar button.

### Canvas app / Teams

```powerfx
Launch(
  LookUp(
    'LT Share Links',
    lt_linkid = galLeads.Selected.lt_legacylinkid &&
    lt_campaign = "Defense Leads 5/19/2026"
  ).lt_sharepageurl
)
```

`Launch()` accepts the full long-text string — no length issue.

---

## Per-campaign behaviour

| Strategy | How |
|----------|-----|
| **One table, many campaigns** | Alternate key = Link ID + Campaign; filter views by **Campaign** |
| **Latest wins** | Alternate key = Link ID only; each import overwrites share URL |
| **Archive** | Add **Active** (Yes/No); import sets new rows Active=Yes, flow sets older same Link ID to Active=No |

---

## TSV → Dataverse field map (quick reference)

| TSV column | Dataverse column | Dataverse type |
|------------|------------------|----------------|
| Link ID | `lt_linkid` | Whole Number |
| Company | `lt_name` | Text (primary) |
| Company Website | `lt_companywebsite` | **Multiple lines of text (Long text)** |
| SharePoint Item URL | `lt_crmrecordurl` | **Multiple lines of text (Long text)** |
| LeadTrigger Share Page | `lt_sharepageurl` | **Multiple lines of text (Long text)** |
| Campaign | `lt_campaign` | Text |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Share Links (CRM)** downloads empty file | No CRM matches — import `docs/link to item.csv` into LeadTrigger first (`scripts/import-sharepoint-leads.mjs`) |
| Flow fails on row 1 | Skip header row (index 0) |
| Duplicate key errors | Check alternate key columns match your strategy (Link ID vs Link ID + Campaign) |
| Lead lookup empty | **Legacy Link ID** on lead must equal TSV **Link ID** |
| URL truncated in Dataverse | Column must be **Long text**, not URL or single-line text — re-import after fixing schema |
| Flow error “string too long” | Same fix — widen to Long text (1M chars) |
| URL not clickable in form | Expected for Long text — add command bar button with `Launch(…lt_sharepageurl)` |
| Wrong campaign shown | Filter subgrid or view by **Campaign** |

---

## Security

| Item | Recommendation |
|------|----------------|
| TSV in OneDrive | Restrict folder to sales ops / CRM admins |
| Power Automate | Run under service account with Dataverse **System Customizer** or table privileges |
| LeadTrigger share URLs | Treat as internal sales links; use gated share pages where required |

---

## Related

- [`docs/sharepoint-share-links-simple.md`](./sharepoint-share-links-simple.md) — same pattern on SharePoint lists
- [`docs/SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide) — CRM import into LeadTrigger
- [`REST_API_DOCS.md`](../REST_API_DOCS.md) — optional API sync to Dataverse via custom connector (scores, not share links)
