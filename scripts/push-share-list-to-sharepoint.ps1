<#
.SYNOPSIS
  Push LeadTrigger share list JSON into an existing SharePoint CRM list (update by Link ID).

.DESCRIPTION
  Reads the JSON file from Share List → Download JSON (or fetches the public API and maps fields),
  then updates SharePoint list items matched by numeric ID. No Power Automate required.

  Prerequisites (one-time):
    Install-Module PnP.PowerShell -Scope CurrentUser
    Copy scripts/sharepoint-field-map.example.json → sharepoint-field-map.json
    Create matching columns in SharePoint (see docs/push-share-list-to-sharepoint.md)

.EXAMPLE
  .\push-share-list-to-sharepoint.ps1 -JsonPath ".\Defense-Leads-5-19-2026.json"

.EXAMPLE
  .\push-share-list-to-sharepoint.ps1 -JsonPath ".\export.json" -WhatIf

.EXAMPLE
  .\push-share-list-to-sharepoint.ps1 -ListToken "656a832105306757e1e462b3ef77b655"
#>
[CmdletBinding(DefaultParameterSetName = "Json")]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "Json")]
    [string]$JsonPath,

    [Parameter(Mandatory = $true, ParameterSetName = "Api")]
    [string]$ListToken,

    [string]$ApiBaseUrl = "https://leadtrigger-connectgroup.com",
    [string]$SiteUrl = "https://connectgroup0.sharepoint.com/sites/Connect4Sales_CG",
    [string]$ListTitle = "Leadlist Database",
    [string]$FieldMapPath = (Join-Path $PSScriptRoot "sharepoint-field-map.json"),

    [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-PnPModule {
    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        throw @"
PnP.PowerShell is not installed. Run once:
  Install-Module PnP.PowerShell -Scope CurrentUser
"@
    }
    Import-Module PnP.PowerShell -ErrorAction Stop
}

function Load-FieldMap {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Field map not found: $Path`nCopy sharepoint-field-map.example.json to sharepoint-field-map.json and edit column names."
    }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    return $raw
}

function Get-ExportRows {
    param(
        [string]$JsonPath,
        [string]$ListToken,
        [string]$ApiBaseUrl
    )

    if ($PSCmdlet.ParameterSetName -eq "Json") {
        if (-not (Test-Path -LiteralPath $JsonPath)) {
            throw "JSON file not found: $JsonPath"
        }
        $parsed = Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($parsed -is [System.Array]) {
            return @($parsed)
        }
        if ($parsed.companies) {
            # Public API shape — limited fields; prefer Download JSON for CRM Link ID
            return @($parsed.companies | ForEach-Object {
                [PSCustomObject]@{
                    "Company Name"         = $_.name
                    "Website"              = $_.websiteUrl
                    "Link ID"              = ""
                    "SharePoint Page Link" = ""
                    "Country"              = $_.country
                    "City"                 = $_.city
                    "Fit Score"            = $_.fitScore
                    "Urgency Score"        = $_.urgencyScore
                    "Brain / ICP"          = $_.brainName
                    "Contact Name"         = $_.contact.name
                    "Contact Title"        = $_.contact.title
                    "Contact Email"        = $_.contact.email
                    "Company Page"         = $_.shareUrl
                    "Campaign"             = $parsed.list.name
                }
            })
        }
        throw "Unrecognized JSON format. Use Share List → Download JSON."
    }

    $url = "$ApiBaseUrl/api/public/share-lists/$ListToken"
    Write-Host "Fetching $url ..."
    $parsed = Invoke-RestMethod -Uri $url -Method Get
    if (-not $parsed.companies) {
        throw "API returned no companies."
    }
    Write-Warning "Public API does not include Link ID — only rows with Link ID in JSON export can update CRM. Prefer -JsonPath from Download JSON."
    return @($parsed.companies | ForEach-Object {
        [PSCustomObject]@{
            "Company Name"         = $_.name
            "Website"              = $_.websiteUrl
            "Link ID"              = ""
            "SharePoint Page Link" = ""
            "Country"              = $_.country
            "City"                 = $_.city
            "Fit Score"            = $_.fitScore
            "Urgency Score"        = $_.urgencyScore
            "Brain / ICP"          = $_.brainName
            "Contact Name"         = $_.contact.name
            "Contact Title"        = $_.contact.title
            "Contact Email"        = $_.contact.email
            "Company Page"         = $_.shareUrl
            "Campaign"             = $parsed.list.name
        }
    })
}

function ConvertTo-SharePointValue {
    param(
        [string]$JsonKey,
        $Value,
        [string[]]$HyperlinkFields
    )
    if ($null -eq $Value) { return $null }
    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }

    if ($HyperlinkFields -contains $JsonKey) {
        # SharePoint URL column: "https://..., Display text"
        $label = $text
        if ($text -match "^https?://") {
            try {
                $uri = [Uri]$text
                $label = $uri.Host
            } catch { }
        }
        return "$text, $label"
    }
    return $text
}

Ensure-PnPModule
$map = Load-FieldMap -Path $FieldMapPath
$rows = Get-ExportRows -JsonPath $JsonPath -ListToken $ListToken -ApiBaseUrl $ApiBaseUrl

$linkKey = [string]$map.linkIdJsonKey
if ([string]::IsNullOrWhiteSpace($linkKey)) { $linkKey = "Link ID" }
$hyperlinkFields = @()
if ($map.hyperlinkFields) { $hyperlinkFields = @($map.hyperlinkFields) }
$fieldEntries = $map.fields.PSObject.Properties

Write-Host "Connecting to $SiteUrl (interactive login) ..."
if (-not $WhatIf) {
    Connect-PnPOnline -Url $SiteUrl -Interactive
}

$updated = 0
$skipped = 0
$failed = 0

foreach ($row in $rows) {
    $linkRaw = $row.$linkKey
    if ([string]::IsNullOrWhiteSpace([string]$linkRaw)) {
        if ($map.skipIfNoLinkId) {
            $skipped++
            continue
        }
    }

    $itemId = 0
    if (-not [int]::TryParse([string]$linkRaw, [ref]$itemId) -or $itemId -le 0) {
        Write-Warning "Skip '$($row.'Company Name')': invalid Link ID '$linkRaw'"
        $skipped++
        continue
    }

    $values = @{}
    foreach ($prop in $fieldEntries) {
        $jsonKey = $prop.Name
        $spField = [string]$prop.Value
        if ([string]::IsNullOrWhiteSpace($spField)) { continue }
        $converted = ConvertTo-SharePointValue -JsonKey $jsonKey -Value $row.$jsonKey -HyperlinkFields $hyperlinkFields
        if ($null -ne $converted) {
            $values[$spField] = $converted
        }
    }

    if ($values.Count -eq 0) {
        Write-Warning "Skip item $itemId ($($row.'Company Name')): no mapped values"
        $skipped++
        continue
    }

    $label = $row.'Company Name'
    if ($WhatIf) {
        Write-Host "[WhatIf] Would update item $itemId ($label): $($values.Keys -join ', ')"
        $updated++
        continue
    }

    try {
        Set-PnPListItem -List $ListTitle -Identity $itemId -Values $values | Out-Null
        Write-Host "Updated item $itemId — $label"
        $updated++
    } catch {
        Write-Warning "Failed item $itemId ($label): $($_.Exception.Message)"
        $failed++
    }
}

Write-Host ""
Write-Host "Done. Updated: $updated | Skipped: $skipped | Failed: $failed"
if ($WhatIf) {
    Write-Host "(Dry run — no changes written. Remove -WhatIf to apply.)"
}
