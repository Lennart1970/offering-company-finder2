# SharePoint: Link Leadlist to LeadTrigger share pages (simple)

No Power Automate. One TSV export, one helper list in SharePoint, one lookup on your existing **Leadlist Database**.

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
3. You get a tab-separated `.tsv` file with only CRM-matched rows:

```text
Link ID	Company	SharePoint Item URL	LeadTrigger Share Page	Campaign
42	BAE SYSTEMS	https://connectgroup0.sharepoint.com/sites/.../DispForm.aspx?ID=42	https://up.manus.space/share/abc123…	Defense Leads 5/19/2026
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

### Import the TSV

1. Open **LT Share Links** → **Integrate** → **Excel** → **Export to Excel** (creates workbook)
2. Paste **Link ID**, **Company**, **SharePoint Item URL**, **LeadTrigger Share Page**, **Campaign** from the TSV
3. For **LeadTrigger Share Page**, use Excel in the hyperlink column: `=HYPERLINK(D2,"View brief")` (adjust cell ref) — plain TSV paste alone may not create clickable links
4. Save workbook back to SharePoint (sync)

Or: create items in grid view and paste each URL into the hyperlink URL field manually for small lists.

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
2. Export **LT Share Links** to Excel (or use the TSV from LeadTrigger)
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

## Clickable links in SharePoint (check before you import)

### Hyperlink column (recommended)

Use column type **Hyperlink** on **LT Share Links** and **Leadlist Database**.

- **Editing one row:** paste the URL in the URL box — it becomes clickable. Add display text (e.g. `View brief`) in the description box.
- **Bulk from TSV/CSV:** SharePoint does **not** auto-convert a plain URL column on import into a proper hyperlink with friendly text. After import, URLs may appear as text only.
- **Reliable bulk method:** open the list in **Excel** (Integrate → Export to Excel), paste URLs into the **Share Page** hyperlink column using Excel’s `=HYPERLINK(url, "View brief")`, save/sync back to SharePoint.  
  Or paste `View brief# https://…` into the hyperlink field via **Access** linked table (legacy but works for bulk).

### Plain text URL column (Single line of text)

If **Share Page** is text, `=HYPERLINK(...)` in a **Calculated column does not work** in modern SharePoint Online — Microsoft blocks HTML in calculated fields, so the formula shows as text, not a clickable link.

**Use JSON column formatting instead:**

1. Column settings → **Format this column** → **Advanced mode**
2. Paste:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "a",
  "txtContent": "View brief",
  "attributes": {
    "target": "_blank",
    "href": "@currentField"
  }
}
```

3. Save — the text column renders as a clickable **View brief** link.

### Summary

| Approach | Clickable in modern SPO? |
|----------|---------------------------|
| Hyperlink column, enter URL in form | Yes |
| Hyperlink column, bulk TSV/CSV import only | Often **no** — needs Excel/Access step |
| Calculated `=HYPERLINK(...)` | **No** (renders as text) |
| Text column + JSON formatting | Yes |

---

## Per-campaign lists

Create one **LT Share Links — Defense May 2026** list per campaign, or one list with **Campaign** column and filtered views. Lookup on Leadlist stays the same; pick the row from the right campaign.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Share Links (CRM)** button downloads empty file | No CRM matches — companies need Link ID (import CRM CSV first) |
| Lookup empty | Link ID on helper list must equal Leadlist item **ID** |
| Link not clickable | TSV/CSV import into Hyperlink column often leaves plain text — use Excel `=HYPERLINK()` sync, or JSON formatting on a text column |
| Wrong company linked | Re-check Link ID matches Leadlist **ID** column |

---

## Related

- [`docs/link to item.csv`](./link%20to%20item.csv) — CRM Leadlist export (Company;Website;ID;LinkToItem)
- [`docs/manus-deploy-handoff-share-export-research-june-2026.md`](./manus-deploy-handoff-share-export-research-june-2026.md) — Link ID in exports
