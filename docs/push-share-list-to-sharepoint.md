# Push Share List JSON to SharePoint (no Power Automate)

Update existing rows in your corporate SharePoint **Leadlist Database** with LeadTrigger scores and links — using one PowerShell script on your PC.

## Why this exists

SharePoint lists do not import JSON directly. Power Automate is often used as a glue layer, but a local script with **PnP PowerShell** is simpler: download JSON once, run script, done.

## One-time setup (~10 minutes)

### 1. Install PnP PowerShell (your Windows PC)

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
```

### 2. Add columns to SharePoint (optional but recommended)

In **Leadlist Database**, add columns for LeadTrigger fields you want to sync, for example:

| Display name | Type | Example internal name |
|--------------|------|------------------------|
| LT Fit Score | Number | `LT_FitScore` |
| LT Urgency | Number | `LT_UrgencyScore` |
| LT Company Page | Hyperlink | `LT_CompanyPage` |
| LT Key Signal | Multiple lines text | `LT_KeySignal` |
| LT Campaign | Single line text | `LT_Campaign` |

List your real internal names:

```powershell
Connect-PnPOnline -Url "https://connectgroup0.sharepoint.com/sites/Connect4Sales_CG" -Interactive
Get-PnPField -List "Leadlist Database" | Select-Object Title, InternalName, TypeAsString | Format-Table
```

### 3. Configure field mapping

```powershell
cd "C:\path\to\Leadtrigger v1\scripts"
copy sharepoint-field-map.example.json sharepoint-field-map.json
notepad sharepoint-field-map.json
```

Edit the `fields` object: **left** = JSON key from Download JSON, **right** = SharePoint **InternalName**.

## Every time you sync

### Step A — Export from LeadTrigger

1. Open your share list, e.g. `/share/list/<listToken>`
2. Apply filters if needed
3. Click **Download JSON**
4. Save file, e.g. `Defense-Leads.json`

Only rows with a **Link ID** (already in CRM) will be updated. Rows without Link ID are skipped.

### Step B — Dry run

```powershell
cd "C:\path\to\Leadtrigger v1\scripts"
.\push-share-list-to-sharepoint.ps1 -JsonPath ".\Defense-Leads.json" -WhatIf
```

### Step C — Push for real

```powershell
.\push-share-list-to-sharepoint.ps1 -JsonPath ".\Defense-Leads.json"
```

Browser opens for Microsoft login (your corporate account). Script updates each SharePoint item by **ID** (= Link ID in JSON).

## JSON fields available (Download JSON)

| JSON key | Typical SharePoint use |
|----------|-------------------------|
| Link ID | Match key (SharePoint item ID) — not written |
| Company Name | Reference only |
| Fit Score | LT_FitScore |
| Urgency Score | LT_UrgencyScore |
| Company Page | LT_CompanyPage (hyperlink) |
| Key Signal | LT_KeySignal |
| Campaign | LT_Campaign |
| Country, Sector, Brain / ICP | Optional text columns |
| Contact Name / Title / Email | Optional text columns |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| All rows skipped | JSON missing Link ID — company not in CRM; import CRM links first |
| Field not updated | Wrong InternalName in `sharepoint-field-map.json` |
| Access denied | Ask IT for Contribute on the list |
| Invalid item id | Link ID does not exist in SharePoint list |

## Alternative: public API (no Link ID)

```powershell
.\push-share-list-to-sharepoint.ps1 -ListToken "656a832105306757e1e462b3ef77b655"
```

This fetches JSON from `/api/public/share-lists/:token` but **does not include Link ID**, so CRM update-by-ID will not work. Always prefer **Download JSON** from the share list page.

## Related

- [`docs/link to item.csv`](./link%20to%20item.csv) — CRM list export format
- [`docs/SharePoint CRM Lead Lookup — Implementation Guide`](./SharePoint%20CRM%20Lead%20Lookup%20%E2%80%94%20Implementation%20Guide)
- [`docs/manus-deploy-handoff-share-export-research-june-2026.md`](./manus-deploy-handoff-share-export-research-june-2026.md) — Link ID in JSON export
