# SharePoint: Link Leadlist to LeadTrigger share pages (simple)

No Power Automate. One CSV export, one helper list in SharePoint, one lookup on your existing **Leadlist Database**.

---

## What you get

| Leadlist Database (existing) | New list: **LT Share Links** |
|------------------------------|------------------------------|
| ID = 42, Company = BAE… | Link ID = 42, Share Page = `https://…/share/abc…` |
| Lookup column → clickable **View brief** | Imported from LeadTrigger |

---

## Step 1 — Export from LeadTrigger (30 seconds)

1. Open your share list, e.g. `/share/list/<token>`
2. Click **Share Links (CRM)** (green button)
3. You get a semicolon CSV with only CRM-matched rows:

```csv
Link ID;Company;Share Page;Campaign
42;BAE SYSTEMS;https://up.manus.space/share/abc123…;Defense Leads 5/19/2026
```

Rows without a CRM Link ID are omitted (they cannot tie to Leadlist `ID`).

---

## Step 2 — Create the helper list in SharePoint (once)

Site: `Connect4Sales_CG` → **New list** → name: **LT Share Links**

| Column | Type | Notes |
|--------|------|--------|
| **Title** | Single line (default) | Company name |
| **Link ID** | Number | Same as Leadlist `ID` |
| **Share Page** | Hyperlink | LeadTrigger company brief URL |
| **Campaign** | Single line | Optional list name |

### Import the CSV

1. Open **LT Share Links** → **Integrate** → **Excel** → **Export to Excel** (creates workbook)
2. Paste your CSV rows below the header (or use **Quick edit** / grid paste)
3. For **Share Page** hyperlink column: paste URL in **URL** field, display text e.g. `View brief`
4. Save workbook back to SharePoint (sync)

Share Page is already clickable in this list (hyperlink column).

---

## Step 3 — Link from Leadlist Database (once)

On **Leadlist Database**, add a column:

- **Name:** `LT Share Page` (or `LeadTrigger brief`)
- **Type:** **Lookup**
- **Get information from:** LT Share Links
- **In this column:** Share Page (hyperlink)
- **Allow multiple values:** No

When you edit a Leadlist row, pick the matching **LT Share Links** item (same company / same Link ID).

### Optional: show a friendly label

Add a **Formula** column (classic) or use the hyperlink display text from the lookup — shows as **View brief** and opens the LeadTrigger page.

> **Note:** SharePoint lookup picks related items; it does not auto-join on Link ID = ID without Power Automate. For bulk linking, use Step 4 (Excel) once per campaign.

---

## Step 4 — Bulk link all rows (Excel, no Power Automate)

Fastest for 100+ companies:

1. Export **Leadlist Database** to Excel
2. Export **LT Share Links** to Excel (or use the CSV from LeadTrigger)
3. In Leadlist sheet, new column **LT Share Page URL**:

```excel
=XLOOKUP([@ID], LTShareLinks[Link ID], LTShareLinks[Share Page], "")
```

4. Copy column → **Paste values**
5. Import / sync back to SharePoint, or paste into a **Hyperlink** column on Leadlist

Each Leadlist row gets the correct share URL matched by **ID = Link ID**.

### Clickable link on Leadlist

Use column type **Hyperlink** with URL from XLOOKUP and description `View LeadTrigger brief`.

---

## SharePoint formula (hyperlink from plain URL text)

If Share Page is stored as **Single line text** (not Hyperlink), add a **Calculated column** (where your tenant still allows it):

```text
=HYPERLINK([Share Page], "View brief")
```

In modern lists, prefer **Hyperlink column** on import — no formula needed.

---

## Per-campaign lists

Create one **LT Share Links — Defense May 2026** list per campaign, or one list with **Campaign** column and filtered views. Lookup on Leadlist stays the same; pick the row from the right campaign.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Share Links (CRM)** button downloads empty file | No CRM matches — companies need Link ID (import CRM CSV first) |
| Lookup empty | Link ID on helper list must equal Leadlist item **ID** |
| Link not clickable | Use Hyperlink column type, not plain text |
| Wrong company linked | Re-check Link ID matches Leadlist **ID** column |

---

## Related

- [`docs/link to item.csv`](./link%20to%20item.csv) — CRM Leadlist export (Company;Website;ID;LinkToItem)
- [`docs/manus-deploy-handoff-share-export-research-june-2026.md`](./manus-deploy-handoff-share-export-research-june-2026.md) — Link ID in exports
