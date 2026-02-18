# HITL UI Implementation Notes

## Completed
- CompanyDecisionButtons component created with Call Today / Park / Not Relevant buttons
- Reason picker inline modal with 6 reason codes (wrong_industry, too_small, wrong_geo, competitor, already_customer, other)
- Decision badges shown after decision is made (green/yellow/red)
- "CHANGE" button to re-decide
- Exclusions page at /exclusions with stats, SIC/NAICS code lists, and remove buttons
- Home.tsx updated with:
  - EXCLUSIONS nav button with badge count
  - Client-side filtering of excluded companies
  - Collapsible "EXCLUDED" section showing hidden companies
  - Decision buttons on every company card
  - Exclusion warning on search form when codes are active
- App.tsx route registered for /exclusions

## Verified
- Screenshot shows EXCLUSIONS button in header nav
- No TypeScript errors
- No build errors
- Dev server running
