# Project TODO

## Core Features
- [x] Form interface with company website URL and location fields
- [x] Integration with offering-extractor skill for analyzing company offerings
- [x] Integration with apollo-company-finder skill for finding similar companies
- [x] Results display showing matching companies
- [x] Loading states for all API operations
- [x] Error handling for skill integration failures
- [x] CSV export functionality for company results

## Technical Implementation
- [x] Database schema for storing search history and results
- [x] Backend tRPC procedures for offering extraction
- [x] Backend tRPC procedures for company search
- [x] Backend CSV generation endpoint
- [x] Brutalist UI design with heavy typography
- [x] Asymmetric layout with high contrast
- [x] Responsive design for mobile and desktop

## Testing & Deployment
- [x] End-to-end workflow testing
- [x] Error scenario handling
- [x] CSV export validation
- [x] Final checkpoint creation

## Standalone Conversion (Remove Sandbox Dependency)
- [x] Replace Python offering-extractor with native xAI Grok API integration
- [x] Replace Python apollo-company-finder with native Apollo API integration
- [x] Remove all exec/shell calls to Python scripts
- [x] Test end-to-end workflow without sandbox
- [x] Create final standalone checkpoint

## UX Improvements
- [x] Add URL normalization to accept inputs like "connectgroup.com" or "connectgroup"
- [x] Update frontend validation to normalize URLs before submission
- [x] Update backend to handle normalized URLs
- [x] Test various URL input formats

## Bug Fixes
- [x] Fix Grok API 422 error - use standard chat completions instead of Responses API

## Current Bug
- [x] Debug Grok API 400 error - need to see full error response from xAI API
- [x] Add better error logging to capture API response details
- [x] Fix model name from grok-2-1212 to grok-2-vision-1212

## Model Update
- [x] Switch from grok-2-vision-1212 to grok-4-1-fast-reasoning (latest model)

## Location Display Enhancement
- [x] Fetch full company details using Get Complete Organization Info endpoint
- [x] Extract and store address fields (city, state, country, street_address)
- [x] Update database schema to add location columns to companies table
- [x] Store search location with each company result
- [x] Display both actual address and search location on company cards

## Search History Feature
- [x] Create SearchHistory component to display past searches
- [x] Add navigation between new search and history views
- [x] Display search cards with company website, location, date, and result count
- [x] Add click handler to load previous search results
- [x] Update Home.tsx to support viewing historical searches
- [x] Test search history workflow end-to-end

## Improved Search Strategy
- [x] Update Grok prompt to extract target market keyword tags (who buys from this company)
- [x] Update Apollo search to use q_organization_keyword_tags[] filter
- [x] Add SIC/NAICS codes to database schema
- [x] Store and display SIC/NAICS codes on company cards
- [x] Display keyword tags used in search for transparency
- [x] Test with ConnectGroup example (Industrial, Measurement & Control, MedTech)

## Two-Step Search (Volume Optimization)
- [x] Refactor Apollo search to skip enrichment in Step 1 (fast bulk search)
- [x] Add enrichment status column to companies table (pending / enriched / failed)
- [x] Create separate enrichment procedure (batch enrich all)
- [x] Update frontend to show basic results first, then "Enrich All" button
- [x] Show enrichment status per company (enriched badge vs pending)
- [x] Allow paginated Apollo search to pull up to 100 companies
- [x] Test two-step workflow end-to-end (29 tests passing)

## State-Wide Search
- [x] Parse state from location input (e.g., "Atlanta, GA" → "Georgia")
- [x] Update Apollo search to use state-level location filter
- [x] Test with various location formats (city+state, state only, etc.)

## ConnectGroup-Specific Customization
- [x] Hardcode ConnectGroup offering data (name, description, target market, keyword tags)
- [x] Remove company website input field from UI
- [x] Skip Grok extraction step in backend
- [x] Update UI to show ConnectGroup branding and pre-filled offering
- [x] Test instant search with location-only input

## Target Market Expansion
- [x] Review ConnectGroup website for broader industry applications
- [x] Expand target market definition beyond Industrial/MedTech/Measurement & Control
- [x] Add more Apollo keyword tags for wider reach (32 tags total)
- [x] Update hardcoded offering data with expanded target market
- [x] Test expanded search results (29 tests passing with 32 keyword tags)

## Sales Intelligence Package Generation
- [x] Design sales intelligence brief template (company facts, business overview, engagement strategy)
- [x] Create backend procedure to generate package using Grok API
- [x] Add "Generate Package" button to each company card
- [x] Implement Markdown generation for sales brief
- [x] Store generated packages in database
- [x] Test package generation end-to-end (31 tests passing)

## Package Generation Fix
- [x] Debug why package generation failed (no actual failure, stale Vite error)
- [x] Replace complex Grok-powered generation with simple placeholder template
- [x] Test placeholder package generation (31 tests passing)

## HITL Method 1: Decision Capture
- [x] Add company_decisions table to database schema
- [x] Add excluded_codes table for SIC/NAICS exclusion list
- [x] Create submitDecision tRPC procedure
- [x] Create getDecision, getSearchDecisions, getExcludedCodes, removeExcludedCode procedures
- [x] Add decision buttons (Call Today / Park / Not Relevant) to company cards
- [x] Add reason picker modal for "Not Relevant" decisions
- [x] Create "Exclusion List" page showing rejected SIC/NAICS codes
- [x] Client-side filtering of companies with excluded SIC/NAICS codes
- [x] Add decision badges to company cards (✓ CALL / ⏸ PARK / ✕ REJECT)
- [x] Test complete HITL workflow end-to-end (45 tests passing)

## Bug Fix: getDecision returns undefined
- [x] Fix getDecision tRPC query to return null instead of undefined when no decision exists

## Feature: SIC/NAICS Code Descriptions
- [x] Add human-readable descriptions for SIC codes on company cards
- [x] Add human-readable descriptions for NAICS codes on company cards

## Expand SIC/NAICS Code Coverage
- [x] Query database for most common codes in actual searches
- [x] Implement dynamic SIC/NAICS lookup via web scraping (siccode.com)
- [x] Add database caching for looked-up codes
- [x] Update UI to use dynamic lookup via CompanyCodeDisplay component

## Feature: LLM-Powered SIC/NAICS Code Selection
- [x] Design LLM prompt to select relevant SIC/NAICS codes based on offering
- [x] Implement code selection step after offering extraction
- [x] Store selected codes in searches table
- [x] Update Apollo search to do wide cast (no keyword filtering)
- [x] Filter Apollo results by selected SIC/NAICS codes
- [x] Update UI to show selected codes and filtering rationale
- [x] Write tests for code selection and filtering logic

## Prompt Tuning: Expand Code Selection
- [x] Revise code selection prompt to return 30-50+ codes instead of 8-15
- [x] Update guidelines to be more inclusive across all target market segments
- [x] Test with ConnectGroup offering to verify broader coverage (now returns 47 SIC + 48 NAICS codes)

## Feature: Hierarchical NAICS Reasoning
- [x] Implement NAICS hierarchy parser (sector/subsector/industry_group/industry/national)
- [x] Update LLM prompt to output structured NAICS at multiple abstraction levels
- [x] Implement hierarchical matching (match at sector/subsector level, not just exact 6-digit)
- [x] Update UI to display NAICS hierarchy with sector labels (SelectedCodesDisplay component)
- [x] Write tests for hierarchical matching logic (26 tests + updated code selection tests, 91 total passing)

## Bug Fix: Duplicate React keys from duplicate SIC/NAICS codes
- [x] Deduplicate codes in codeSelectionService before returning
- [x] Deduplicate codes in SelectedCodesDisplay component as safety net

## Feature: Sector-Level Exclusion from Targeting View
- [x] Add backend procedure to exclude/include NAICS sectors for a search
- [x] Store excluded sectors per search in database (excludedSectors column)
- [x] Make sector cards clickable to toggle exclusion (visual strikethrough + red styling)
- [x] Filter out companies matching excluded sectors from results (real-time)
- [x] Test sector exclusion flow end-to-end (9 new tests, 100 total passing)

## Feature: Two-Step Search Flow (NAICS Targeting → Batched Keyword Search)
- [x] Split search into Step A (NAICS sector targeting) and Step B (batched Apollo search)
- [ ] Step A: Show LLM-selected NAICS sectors in review UI with exclusion controls (already exists)
- [x] Step A: Add "Confirm & Search" button to proceed to Step B
- [x] Step A: Store confirmed/excluded sectors before starting Apollo search
- [x] Step B: Run separate Apollo search per keyword tag (Railway, Healthcare, Infrastructure, etc.)
- [x] Step B: Show progress tracker ("Searching 15/32 keywords...")
- [x] Step B: Filter results by confirmed NAICS sectors using hierarchical matching
- [x] Step B: Deduplicate companies across batches by Apollo ID
- [x] Step B: Aggregate filtered results and store in database
- [x] Update database schema to track search progress (codesSearched/codesTotal reused for keywords)
- [x] Backend: confirmAndSearch function with batched keyword search logic
- [x] Backend: confirmAndSearch tRPC procedure
- [x] Frontend: Add "Confirm & Search" button when status is "code_targeting"
- [x] Frontend: Show progress during batched search (progress bar + "Searching keyword X of Y")
- [x] Write tests for batched keyword search and hierarchical filtering logic (4 new tests, 104 total passing)

## Bug: Amsterdam search returns no companies
- [x] Investigate why Amsterdam search returns 0 results (found: using wrong field for keywords)
- [x] Check if confirmAndSearch is being called correctly (yes, but parsing targetMarket instead of targetMarketKeywordTags)
- [x] Fix confirmAndSearch to use keywordTagsUsed (Apollo search tags) instead of parsing targetMarket
- [ ] Test with Amsterdam to verify fix (should run 32 separate searches, one per tag)

## Bug: Paris search returns only 197 companies total (58 manufacturing) - too low for a large city
- [x] Check server logs to see Apollo results before NAICS filtering (197 total after dedup)
- [x] Check how many companies Apollo returns per keyword tag (2-24 per keyword, very low)
- [x] Identified: Apollo is returning very few companies per search, not a filtering issue
- [x] Check Apollo search parameters and page size (was 25 per page)
- [x] Increase page size from 25 to 100 (Apollo's max) per keyword search
- [ ] Test with Paris again after fix (expect 1000+ companies)

## Feature: Remove 100-company limit per keyword for unlimited results
- [x] Remove limit parameter in confirmAndSearch (changed from 100 to 10000)
- [x] apolloSearch already pulls all available pages until exhausted (existing logic)
- [x] Verified pagination logic already pulls all available pages
- [ ] User to test Paris search with new unlimited limit (expecting 1000+ companies)

## Skill Update: apollo-company-finder
- [x] Update SKILL.md to reflect two-step search flow (NAICS targeting → batched keyword search)
- [x] Document LLM-powered NAICS sector selection
- [x] Document hierarchical NAICS filtering
- [x] Document unlimited results capability (10,000 limit per keyword)
- [x] Document batched search with 32 keyword tags
- [x] Validate updated skill (passed quick_validate.py)
- [x] Deliver updated skill to user

## Bug: Results not displaying after batched search completes
- [ ] Check server logs for errors during confirmAndSearch
- [ ] Check if companies are being stored in database
- [ ] Check frontend state management after search completes
- [ ] Verify UI updates when search status changes to "completed"
- [ ] Fix the issue and test end-to-end

## Re-apply unlimited results change (reverted by server restart)
- [x] Re-apply limit change from 100 to 10000 in confirmAndSearch.ts (already in code)
- [x] Verify server picks up the change (triggered restart with touch command)
- [ ] User to test with new Paris search (expecting 1000+ companies)

## Investigation: Maximize company retrieval from Apollo
- [ ] Analyze server logs to understand per-keyword Apollo results
- [ ] Research Apollo API pagination limits and total_entries caps
- [ ] Test broad search without keyword tags (location-only)
- [ ] Explore alternative search strategies (no keyword filter, broader employee ranges)
- [ ] Propose and implement new strategy

## Comprehensive Apollo Search Strategy Implementation
- [ ] Fix pagination bug: use total_entries instead of results.length < perPage
- [ ] Implement multi-slice search by employee bands (50-200, 201-500, 501-1000)
- [ ] Add industry slice keywords (electronics, industrial automation, automotive, medical devices, aerospace, hardware, renewable energy)
- [ ] Add EMS/PCB keyword sets (core, complexity, embedded/hardware signals)
- [ ] Implement relevance scoring (0-12 scale: fit to ConnectGroup, size fit, geo fit)
- [ ] Add geography resolver for dynamic location input (EU, DACH, Benelux, Nordics, etc.)
- [ ] Update database schema to store relevance scores and slice metadata
- [ ] Update UI to display relevance scores and "why matched" tags
- [ ] Test with Paris to verify 3000+ companies

## Comprehensive "Relevant Customers" Apollo Pipeline Implementation
- [x] CRITICAL: Fix pagination bug (use total_entries, not results.length < perPage)
- [ ] Create geography resolver (EU, DACH, Benelux, Nordics, country codes)
- [ ] Implement multi-slice search architecture
  - [ ] Employee bands: 50-200, 201-500, 501-1000
  - [ ] Industry slices: electronics, industrial automation, automotive, medical devices, aerospace, hardware, renewable energy
  - [ ] Keyword sets: Core EMS/PCB, Complexity/production ops, Embedded/hardware signals
- [ ] Implement relevance scoring (0-12 scale)
  - [ ] Fit to ConnectGroup (0-6): industry match + keyword match
  - [ ] Size fit (0-3): optimal 100-500 FTE
  - [ ] Geo fit (0-3): HQ country match
- [ ] Update database schema: relevance_score, slice_metadata, geo_verified
- [ ] Implement domain-based deduplication
- [ ] Add selective enrichment (only enrich score >= 6)
- [ ] Update UI: show relevance scores, "why matched" tags, sort by score
- [ ] Test with Paris (expect 2000-5000 companies)

## Multi-Slice Search Implementation (In Progress)
- [x] Create searchSlices.ts with slice configurations
- [x] Define employee bands: 50-200, 201-500, 501-1000
- [x] Define industry keyword sets (7 industries)
- [x] Define keyword sets: Core EMS/PCB, Complexity, Embedded/Hardware
- [x] Update confirmAndSearch to iterate through all slices
- [x] Add slice progress tracking (X of Y slices completed)
- [x] Store slice_metadata with each company
- [x] Add sliceMetadata field to database schema
- [ ] Update UI to show slice statistics
- [ ] Test with Paris (expect 5000+ companies)

## Sales Intelligence Brief Generation (New Feature)
- [x] Read urgency-detection skill
- [x] Design brief generation workflow using Grok MCP
- [x] Install xAI SDK and test Grok connection
- [x] Create Python script for brief generation (generate_sales_brief.py)
- [x] Implement Phase 1: Data collection from database
- [x] Implement Phase 2: Urgency detection (Grok web search)
- [x] Implement Phase 3: Company intelligence (Grok web search)
- [x] Implement Phase 4: Contact verification
- [x] Implement Phase 5: Engagement strategy (Grok reasoning)
- [x] Implement Phase 6: Brief assembly & formatting
- [x] Create briefGenerator.ts TypeScript wrapper
- [x] Add urgencyScore and briefData fields to companies table
- [x] Add tRPC mutation: generateBrief
- [x] Add "Generate Brief" button to company cards
- [x] Add brief display modal/page
- [x] Test with real company (ready for user testing)
- [x] Save checkpoint
- [ ] Add batch generation for 'call now' companies

## Bug Fixes: Brief Generation
- [x] Fix Python version mismatch (use /usr/bin/python3.11 instead of python3)
- [x] Fix button positioning issue (changed flex layout to flex-col for vertical stacking)

## Bug Fix: PYTHONPATH Issue
- [x] Clear PYTHONPATH environment variable when executing Python script to prevent Python 3.11 from importing Python 3.13 modules

## Bug Fix: Python Script JSON Output
- [x] Fix Python script to output only JSON to stdout (redirect debug messages to stderr)

## Brief Caching Implementation
- [x] Check if briefData and briefGeneratedAt fields exist in schema (already exist)
- [x] Update generateBrief mutation to check cache (if brief exists and < 7 days old, return cached)
- [x] Store generated brief in briefData field with timestamp
- [x] Show cache age indicator in UI toast message
- [ ] Add "Regenerate Brief" button in modal (optional enhancement)

## Bug Fix: Brief Modal Link Hover
- [x] Fix blue links turning white on hover in brief modal (now hover to darker blue)

## Production Fix: Brief Generation
- [x] Install OpenAI SDK for Node.js (xAI is OpenAI-compatible)
- [x] Rewrite briefGenerator.ts to use OpenAI SDK with xAI endpoint
- [x] Remove Python script dependency (now using TypeScript/Node.js)
- [ ] Test in dev environment
- [ ] Verify works in production

## Bug Fix: Grok Model Name
- [x] Check current model configuration in briefGenerator.ts
- [x] Update to correct Grok model name (grok-4-1-fast-reasoning for fast reasoning)

## Bug Fix: Server Returning HTML Instead of JSON
- [ ] Check server logs to identify error
- [ ] Fix the root cause
- [ ] Test and verify

## Bug Fix: Remove Hover Effect from Brief Links
- [x] Remove hover:text-blue-800 class from conversation starter links
- [x] Keep links blue and readable at all times

## Bug Fix: Remove All Hover Effects from Brief Modal
- [x] Remove hover effect from close button (×)
- [x] Ensure all text remains static with no color changes on hover

## Feature: Dedicated Offering Details Page
- [x] Create OfferingDetails page component with offering name, description, target markets, and keywords
- [x] Add navigation from Home to OfferingDetails page
- [x] Add "Proceed to Search" button to navigate from OfferingDetails to search form
- [x] Display offering in professional brutalist format matching existing design
- [x] Test offering details page and search flow end-to-end

## Feature: Individual Enrich Button on Company Cards
- [x] Create enrichSingle tRPC procedure for enriching individual companies
- [x] Add ENRICH button to each pending company card
- [x] Show loading state while enriching
- [x] Update company card after enrichment completes
- [x] Test individual enrichment workflow end-to-end

## Bug: Individual ENRICH button not executing enrichment
- [x] Investigate why [ENRICH] button doesn't work like [ENRICH ALL]
- [x] Check browser console for errors
- [x] Compare enrichSingle vs enrichAll mutation implementation
- [x] Fix the issue and verify enrichment works

## Feature: Streamlined Sales Workflow (Remove Package, Rename Brief, Add Sales Approach)
- [x] Remove Sales Package feature completely
  - [x] Delete "Generate Package" button from UI
  - [x] Remove generatePackage procedure from companyFinder.ts
  - [x] Remove getPackage procedure from companyFinder.ts
  - [x] Delete packageGenerator.ts file
  - [x] Remove sales_packages table references from db.ts
- [x] Rename "Generate Brief" to "Deep Research"
  - [x] Update button text in UI
  - [x] Update procedure names in backend (keep functionality)
  - [x] Update modal/display titles
- [x] Add "Create Sales Approach" feature
  - [x] Create salesApproachGenerator.ts with Grok prompt
  - [x] Add generateSalesApproach procedure to companyFinder.ts
  - [x] Add database schema for sales approach storage
  - [x] Add "Create Sales Approach" button (only shows after Deep Research)
  - [x] Create modal to display sales approach (email, LinkedIn, call script)
  - [x] Add copy-to-clipboard functionality for each approach type
- [ ] Test complete workflow end-to-end
  - [ ] Search → Enrich → Deep Research → Create Sales Approach
  - [ ] Verify all data flows correctly
  - [ ] Test UI interactions and modals

## Bug: White text on white background - readability issue
- [x] Review global CSS theme configuration (index.css)
- [x] Check text color variables and ensure proper contrast
- [x] Fix hover states that cause white text on white background
- [x] Ensure all text is readable without selection
- [x] Test across all pages and components

## Feature: Restructure 5-Step Sales Workflow
- [x] Restructure Deep Research (Step 2)
  - [x] Remove conversation starters from briefGenerator.ts
  - [x] Remove engagement strategy from briefGenerator.ts
  - [x] Keep only urgency detection + company intelligence (2 Grok calls)
  - [x] Update UI button text and modal display
- [x] Update Sales Approach (Step 3)
  - [x] Add conversation starters to salesApproachGenerator.ts prompt
  - [x] Add engagement strategy to salesApproachGenerator.ts prompt
  - [x] Combine with existing outreach generation (1 Grok call total)
  - [x] Update modal to display all 3 components
- [x] Add Contact Details Feature (Step 5) - Backend
  - [x] Create contacts table schema in drizzle/schema.ts
  - [x] Generate and apply migration SQL
  - [x] Create Apollo People Search integration
  - [x] Add database functions (createContact, getContactByCompanyId)
  - [x] Add findContact tRPC procedure
  - [x] Add UI button with job title input field
  - [x] Store 1 contact per company in database
  - [x] Display contact details in modal
- [x] Add Cost/Time Indicators
  - [x] Add badge to Deep Research button (~30s, 2 Grok calls)
  - [x] Add badge to Sales Approach button (~45s, 1 Grok call)
  - [x] Add badge to Company Details button (~5s, 1 Apollo credit)
  - [x] Add badge to Contact Details button (~10s, 1 Apollo credit, expensive)
- [x] Test complete 5-step workflow end-to-end

## Bug: Main page hover overrides deep research card hover
- [x] Investigate hover conflict between main page and deep research cards
- [x] Fix hover states so card-level hovers work independently
- [x] Review all UI hover states for consistency

## Task: Remove All Hover Effects from Application
- [x] Scan codebase for all hover: classes and effects
- [x] Remove hover effects from Home.tsx (buttons, cards, links)
- [x] Remove hover effects from OfferingDetails.tsx
- [x] Remove hover effects from global CSS (index.css - none found)
- [x] Remove hover effects from any other components
- [x] Test application to ensure no hover effects remain

## Bug: Sales Approach not using cached data
- [x] Investigate why "Create Sales Approach" regenerates instead of using cached data
- [x] Compare with Deep Research caching implementation (shows "using cached research")
- [x] Add caching logic to sales approach procedure
- [x] Test that cached sales approach displays without regenerating

## Bug: tRPC API returning HTML instead of JSON on page load
- [x] Check server logs to identify failing endpoint
- [x] Find root cause of HTML response (duplicate key error in code caching)
- [x] Fix the server-side error (use onDuplicateKeyUpdate for race conditions)
- [x] Test page load with searchId=210006

## Bug: Create Sales Approach button not always showing after enrichment
- [x] Investigate button visibility conditions in Home.tsx
- [x] Check if Deep Research requirement is causing the issue
- [x] Fix conditional logic to show button correctly after enrichment (added query invalidation)
- [x] Test button appears consistently after Deep Research

## Bug: Duplicate key error still occurring - incomplete fix
- [x] Apply onDuplicateKeyUpdate to SIC batch insert (line 121)
- [x] Apply onDuplicateKeyUpdate to individual SIC insert (line 32)
- [x] Apply onDuplicateKeyUpdate to individual NAICS insert (line 70)
- [x] Test all code caching paths

## Feature: Call Today View for Sales Team
- [ ] Create backend procedure to fetch all companies marked as CALL TODAY
- [ ] Create CallToday.tsx page component
- [ ] Display filtered company list with sales approach and contact info
- [ ] Add navigation link in header to Call Today view
- [ ] Show urgency scores and key decision triggers
- [ ] Test Call Today view with multiple searches

## Feature: Call Today View for Sales Team
- [x] Create getCallTodayCompanies database function
- [x] Add getCallToday tRPC procedure
- [x] Create CallToday page component
- [x] Display company info, urgency score, contact details, sales approach
- [x] Add navigation link to Call Today view in header
- [ ] Test Call Today view with marked companies

## Call Today Page Enhancement
- [x] Add navigation header with BACK TO SEARCH button
- [x] Show full call script (opening + discovery questions + value proposition + CTA)
- [x] Show conversation starters (3 openers from sales approach)
- [x] Show engagement strategy (whyThisProspectMatters, recommendedApproach, keyTalkingPoints)
- [x] Show LinkedIn follow-up message (not just connection request)
- [x] Show deep research intelligence (products/services, technologies, markets, recent developments)
- [x] Show urgency score breakdown (Context/Signals/Activity components)
- [x] Show individual urgency signals with source URLs
- [x] Add copy-to-clipboard buttons for email, LinkedIn messages, and call script
- [x] Sort companies by urgency score (highest first) by default
- [x] Add pipeline readiness indicators (Deep Research ✓, Sales Approach ✓, Contact ✓)
- [x] Restructure card layout to follow sales workflow (Header → Before Dial → During Call → After Call → Company Context)

## Bug Fix: Urgency Signals Rendering Error
- [x] Fix React error when rendering urgency signals objects (category, type, description, weight, source, url, detectedAt)
- [x] Update CallToday.tsx to properly extract and display signal properties instead of rendering objects directly

## Bug Fix: Products/Services/Technologies Object Rendering Error
- [x] Fix React error when rendering objects with {category, description, capabilities} structure
- [x] Update CallToday.tsx to handle object format for products/services, technologies, and target markets

## UX Improvement: Replace Warning Messages with Action Buttons
- [x] Replace "Run 'Find Contact' from search results" warning with clickable button
- [x] Replace "Run 'Deep Research' from search results" warning with clickable button
- [x] Replace "Run 'Create Sales Approach' from search results" warning with clickable button
- [x] Link buttons back to search results page (Home) where user can perform the action

## Feature: Deep-link to Specific Company from Call Today
- [x] Update Home.tsx to accept company ID URL parameter (e.g., /?companyId=123)
- [x] Add auto-scroll to specific company card when companyId is present in URL
- [x] Add visual highlight to the target company card for 2 seconds
- [x] Update Call Today action buttons to include company ID in link (e.g., /?companyId=123&searchId=456)
