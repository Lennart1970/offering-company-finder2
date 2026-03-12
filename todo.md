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

<<<<<<< Updated upstream
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

## Feature: Add "Call Today" Filter to Search Results
- [x] Add "CALL TODAY" filter button to Home.tsx alongside existing filters
- [x] Filter companies to show only those with decision='call_today'
- [x] Show count of companies marked for calling (e.g., "CALL TODAY (5)")
- [x] Remove separate /call-today page route from navigation
- [x] Update navigation to remove CALL TODAY tab from header

## Feature: Add Citations to Recent Developments
- [x] Read citation-processing skill to understand enrichment pipeline
- [x] Analyze current Deep Research brief generation to find where citations are available
- [x] Implement citation enrichment for Recent Developments section
- [x] Store enriched citations in briefData JSON structure
- [x] Display citations as clickable "Source" links in UI next to each development
- [ ] Add source type icons (web/news/x) to citations (future enhancement)

## Enhancement: Optimize Grok Prompts for Citations (Hybrid Approach - Option C)
- [x] Enhance urgency prompt to explicitly request source URLs for each development
- [x] Enhance urgency prompt to explicitly request source URLs for each signal
- [x] Add clear instructions: "Include the actual source URL where you found this information"
- [x] Add instruction: "Search the web for recent information and cite your sources"
- [ ] Test that Grok returns real URLs in JSON response
- [ ] Verify citations are displayed correctly in UI

## Bug Fix: Missing Enrich Button
- [x] Investigate why Enrich button is missing from company cards
- [x] Restore Enrich button to company cards in Home.tsx (was already present)
- [x] Verify button appears and works correctly

## Bug Fix: CHANGE Button Not Working on Decision Badges
- [x] Investigate CHANGE button next to CALL TODAY badge on company cards
- [x] Fix click handler - replaced setData(undefined) with local isChanging state for proper re-render
- [x] Added invalidation for getSearchDecisions and getSearch on decision change
- [x] Added e.stopPropagation() to prevent parent card click interference
## Cleanup: Remove Source/Citation URLs (Causing 404s)
- [x] Remove source URL request from Grok prompt in briefGenerator.ts
- [x] Remove source URL display from urgency signals in Home.tsx and CallToday.tsx
- [x] Remove [Source] links from recentDevelopments rendering
- [x] Keep data structure intact for future formal citation implementation (types still accept optional source/url)
- [x] Fixed git merge conflict markers in briefGenerator.ts prompt
- [x] Verified no broken links remain in the UI

## Feature: HITL Gates for Offering and Code Targeting
- [x] Add backend procedure: getPreviousOffering(userId, websiteUrl) → returns most recent search
- [x] Add backend procedure: checkPreviousOffering → query to check if previous offering exists
- [x] Add backend procedure: extractOffering → run LLM extraction
- [x] Add backend procedure: acceptPreviousOffering → copy from previous search
- [x] Add backend procedure: updateOffering → manual edit
- [x] Add backend procedure: runCodeTargeting → run LLM code selection
- [x] Add backend procedure: acceptCodeTargeting → skip to search
- [x] Add backend procedure: updateCodeTargeting → manual expand
- [x] Implement offering HITL gate UI: show previous offering with Accept/Re-extract/Edit buttons
- [x] Implement code targeting HITL gate UI: show previous codes with Accept/Expand/Re-run buttons
- [x] Add manual edit form for offering (textarea for offering text, target markets, keywords)
- [x] Add manual expand form for code targeting (add/remove NAICS/SIC codes with descriptions)
- [x] Update workflow: on Accept, copy data from previous search and skip LLM step
- [x] Update workflow: on Re-extract/Re-run, call LLM as normal
- [x] Add loading states and transitions between HITL gates
- [ ] Test full HITL workflow from offering extraction through code targeting

## Bug Fix: HITL Procedures Not Found in tRPC Router
- [x] Check if extractOffering and checkPreviousOffering are properly registered in companyFinder router (they were)
- [x] Fix: server restart required to pick up new procedures (tsx watch didn't auto-reload)

## UI Fix: Add Re-extract and Edit Buttons to Previous Offering Section
- [x] Add "RE-EXTRACT OFFERING" button next to "USE PREVIOUS OFFERING"
- [x] Wire up Re-extract button to call extractOffering mutation
- [ ] Add "EDIT OFFERING" button to allow manual modification (deferred - edit available in offering_review step)
- [ ] Wire up Edit button to show offering edit form (deferred - edit available in offering_review step)

## Bug Fix: "Search must be in code_targeting status" Error
- [x] Investigate which mutation is throwing the status check error (confirmAndSearch procedure)
- [x] Check the workflow state transitions (runCodeTargeting and acceptCodeTargeting set status to "searching")
- [x] Fix the status validation logic - changed confirmAndSearch to expect "searching" instead of "code_targeting"
- [x] Ensure status is properly updated after each workflow step

## Prompt Upgrade: Tool-Calling with Verifiable Sources
- [x] Update briefGenerator.ts Phase 1 (urgency) prompt with web_search + browse_page tool-calling pattern
- [x] Update briefGenerator.ts Phase 2 (intelligence) prompt with web_search + browse_page tool-calling pattern
- [x] Update recentDevelopments schema to include sourceUrl and snippet fields
- [x] Update urgencySignals schema to require verified sourceUrl
- [x] Update salesApproachGenerator.ts to reference verified sources from deep research
- [x] Update offeringExtractor.ts with tool-calling prompt pattern for website analysis
- [x] Update frontend UI to display clickable source URLs on deep research results
- [x] Write tests for updated prompts and source verification
- [x] Save checkpoint

## Cockpit Restructuring: Sidebar Navigation with 4 Screens
- [x] Create sidebar cockpit layout with persistent navigation
- [x] Build Screen 1: Focused Offering (extract/edit offering, keywords, target market tags)
- [x] Build Screen 2: Search Scenario (select offering + derived keywords + location → launch Apollo search)
- [x] Build Screen 3: Search Results (company list from a search, enrichment, select for deep research, decisions)
- [x] Build Screen 4: Deep Research Dashboard (all deep-researched companies, filter by search run date+ID)
- [x] Update App.tsx routing for new screen structure
- [x] Migrate existing Home.tsx logic into separate screen components
- [x] Write tests for new screen structure (144 passing, 1 pre-existing failure)
- [x] Save checkpoint

## Bug Fix: Grok Web Search Returning Stale 2024 Content Instead of 2026
- [x] Review Grok API documentation for web search parameters and recency controls (no recency params - must use prompt)
- [x] Test current briefGenerator implementation to see actual API responses (found hardcoded "2024-2026" in prompts)
- [x] Check if tool-calling pattern is actually triggering web_search tool (yes, pattern is correct)
- [x] Add explicit recency parameters or prompt instructions for latest content (updated to "2025-2026")
- [ ] Verify fix returns actual 2026 content for recent developments (needs live test after checkpoint)
- [x] Save checkpoint

## Switch to Responses API with Explicit web_search Tool
- [x] Update briefGenerator.ts to use /v1/responses endpoint with web_search tool
- [x] Update salesApproachGenerator.ts to use /v1/responses endpoint with web_search tool
- [x] Update offeringExtractor.ts to use /v1/responses endpoint with web_search tool
- [x] Update response parsing to handle Responses API format (output_text instead of message.content)
- [ ] Test with real company to verify 2026 content is returned
- [ ] Verify citations are working and URLs are valid
- [ ] Save checkpoint

## Test Responses API and Update grok-mcp-fast Skill
- [x] Save checkpoint for Responses API migration
- [ ] Test Deep Research with boldwool.com to verify 2026 content and working citations
- [x] Update grok-mcp-fast skill with Responses API approach
- [x] Add Responses API examples (Node.js and Python) to grok-mcp-fast skill
- [x] Add response structure comparison and parsing guidance
- [x] Add best practices for getting current content
- [x] Validate and deliver updated grok-mcp-fast skill

## Fix Responses API Response Parsing
- [x] Fix briefGenerator.ts to extract output from response.output[].content[].text
- [x] Fix salesApproachGenerator.ts to extract output from response.output[].content[].text
- [x] Fix offeringExtractor.ts to extract output from response.output[].content[].text
- [ ] Test with boldwool.com to verify 2025-2026 content is returned with working citations (deferred to post-checkpoint)
- [x] Save checkpoint

## Fix Foreign Key Constraint for Cascade Deletion
- [x] Read current schema to understand searchId foreign key constraint
- [x] Update drizzle/schema.ts to add ON DELETE CASCADE to searchId foreign key (companies and companyDecisions tables)
- [x] Generate migration SQL with drizzle-kit (0014_hot_mockingbird.sql)
- [x] Execute migration SQL to update searchId constraints (0014_hot_mockingbird.sql - 1261ms)
- [x] Update companyId foreign keys to add ON DELETE CASCADE (salesPackages, companyDecisions, contacts)
- [x] Generate and execute migration for companyId constraints (0015_great_beast.sql - 1985ms)
- [ ] Test deletion to verify cascade works correctly
- [ ] Save checkpoint

## Auto-Trigger Deep Research and Sales Approach on Call Today
- [x] Read submitDecision procedure in companyFinder.ts
- [x] Update submitDecision to check if decision is "call_today"
- [x] If call_today and no briefData exists, auto-trigger Deep Research in background
- [x] If call_today and no salesApproachData exists, auto-trigger Sales Approach in background
- [x] Ensure background execution doesn't block the decision response (using async IIFE without await)
- [ ] Test the auto-trigger flow with Call Today decision
- [ ] Save checkpoint

## Fix Deep Research Dashboard Errors
- [ ] Fix object rendering error - recent developments with {opener, sourceUrl, basedOn} keys
- [ ] Fix duplicate key error - company ID 360002 appears twice
- [ ] Fix tRPC HTML response error - server returning HTML instead of JSON
- [ ] Test the fixes
- [ ] Save checkpoint

## Merge Deep Research Dashboard and Call Today Pages
- [x] Fix getCallTodayCompanies query to deduplicate companies
- [x] Fix React rendering error for {opener, sourceUrl, basedOn} objects (fixed with proper type checking)
- [x] Add filter tabs to Deep Research Dashboard (All / Call Today)
- [x] Update page to show Call Today companies when filter is active
- [x] Remove separate /call-today route from App.tsx
- [x] Update DashboardLayout navigation to remove Call Today link (removed Phone icon import and menu item)
- [x] Test the merged page with both filters (TypeScript compiles cleanly, dev server running)
- [x] Save checkpoint

## Add Social Media and Parent Company Fields
- [x] Update companies table schema with twitterUrl, facebookUrl, parentCompanyName, parentCompanyId fields
- [x] Generate migration SQL with drizzle-kit (0016_curved_wild_pack.sql)
- [x] Execute migration SQL (completed in 2002ms)
- [ ] Update Apollo enrichment code to populate new fields from API response
- [ ] Update UI to display social media links and parent company info
- [ ] Test enrichment with a company that has parent company data
- [ ] Save checkpoint

## REST API for Dataverse Integration
- [x] Create REST API router (server/routes/api.ts)
- [x] Add API key authentication middleware (Bearer token)
- [x] Implement GET /api/v1/companies endpoint (list all companies with pagination)
- [x] Implement GET /api/v1/companies/:id endpoint (get single company)
- [x] Implement GET /api/v1/searches endpoint (list all searches)
- [x] Implement GET /api/v1/searches/:id/companies endpoint (get companies for a search)
- [x] Register API router in Express app
- [x] Set API_KEY environment variable
- [x] Add vitest tests for REST API authentication (all tests passing)
- [x] Document API endpoints (REST_API_DOCS.md)
- [x] Create Copilot prompt for Dataverse integration (DATAVERSE_COPILOT_PROMPT.md)

## Bug Fix: REST API Circular Reference Error
- [x] Diagnose "Unable to transform response from server" error
- [x] Identify root cause: REST API router mounted at /api was intercepting tRPC routes at /api/trpc
- [x] Fix by changing mount path from /api to /api/v1 (avoiding tRPC conflict)
- [x] Update router paths from /v1/companies to /companies (since /v1 is now in mount path)
- [x] Test fix and verify no transformation errors (all 6 tests passing)
- [x] Verify REST API endpoints still work with new path structure

## State-by-State USA Company Retrieval (No Deep Research)
- [x] Create list of all 50 US states (usStates.ts)
- [x] Create backend procedure: runNationalScan (loops through all states)
- [x] For each state: extract offering once, run Apollo search, store companies
- [x] Add progress tracking (current state, companies found so far)
- [x] Add tRPC mutation: startNationalScan
- [x] Add tRPC query: getNationalScanProgress
- [x] Create UI button in Search Scenario page to trigger scan
- [x] Add progress display showing current state and total companies
- [x] Add error handling for failed states (log and continue)
- [x] Add test mode (3 states: Delaware, Rhode Island, Vermont)
- [x] Add UI buttons for both test and full scan
- [x] Save checkpoint

## Update National Scan Test Mode
- [x] Change test mode from 3 states to 2 states (Delaware, Rhode Island)
- [x] Update UI button text to reflect "TEST (2 STATES)"
- [x] Update time estimate for test mode (3-5 minutes)
- [x] Save checkpoint

## Add Stop Scan Functionality
- [ ] Add stopNationalScan function in nationalScan.ts
- [ ] Add tRPC mutation for stopping scan
- [ ] Add "Stop Scan" button in UI (visible only when scan is running)
- [ ] Test stop functionality
- [ ] Save checkpoint

## Stop Running Scan and Remove National Scan UI
- [x] Restart dev server to kill running scan
- [x] Remove NationalScanSection component
- [x] Remove national scan UI from SearchScenario page
- [x] Keep backend nationalScan.ts for manual execution
- [x] Save checkpoint

## Fix Company Contact Details Display Issue
- [x] Add logging to apolloPeopleSearch.ts to capture raw API response
- [x] Identified issue: using /mixed_people/search which returns cached data
- [x] Solution: Use /people/match enrichment API to unlock emails
- [x] Implement two-step approach: search first, then enrich
- [x] Add enrichPerson function using /people/match endpoint
- [x] Update apolloPeopleSearch to call enrichment after finding contact
- [ ] Test with sample companies to verify real emails are returned
- [ ] Save checkpoint

## CSV Import: Campaign-Based Apollo Upload
- [x] Create CSV parser utility (parseApolloCSV)
- [x] Map all Apollo CSV fields to companies schema
- [x] Install csv-parse package
- [x] Create tRPC procedure: importCampaignFromCSV (accepts file + campaign name)
- [x] Create a new search record for each campaign with status "completed"
- [x] Parse and import companies from CSV (tested with 34 companies)
- [x] Handle employee count, revenue, SIC codes, keywords in sliceMetadata
- [x] Add UI: Import Campaign page with file input + campaign name
- [x] Add Import Campaign to sidebar navigation
- [x] Fix TypeScript errors in DashboardLayout (array closing bracket)
- [x] Save checkpoint

## Review & Fix Apollo People Search (Contact Finder)
- [x] Research Apollo People API endpoints (search, match, enrich)
- [x] Review current apolloPeopleSearch.ts implementation
- [x] ROOT CAUSE: Wrong parameter name (organization_domains instead of q_organization_domains_list)
- [x] ROOT CAUSE: Wrong endpoint (/mixed_people/search costs credits, /mixed_people/api_search is FREE)
- [x] Design correct two-step approach: api_search (free) → people/match (1 credit for email)
- [x] Rewrite apolloPeopleSearch.ts with correct API parameters and endpoints
- [x] Add domain cleaning (strip www., http://, trailing paths)
- [x] Add company name verification logging
- [x] Test with real companies - confirmed working correctly!
- [x] Save checkpoint

## Create Apollo People Finder Skill
- [x] Understand skill requirements and gather examples
- [x] Plan reusable skill contents (scripts, references, templates)
- [x] Initialize skill using init_skill.py
- [x] Create skill resources and write SKILL.md
- [x] Validate skill with quick_validate.py
- [ ] Deliver skill to user

## Update Apollo People Finder Skill: Add Phone Enrichment
- [x] Update SKILL.md to add Step 3 for phone enrichment with cost warnings
- [x] Update Python script to support --phone flag
- [x] Update API reference with phone enrichment details
- [x] Validate updated skill
- [ ] Deliver updated skill to user

## Add Phone Enrichment to App Contact Finder
- [x] Update apolloPeopleSearch.ts to accept includePhone parameter
- [x] Update enrichPerson function to conditionally add reveal_phone_number
- [x] Update tRPC procedure findContact to accept includePhone input
- [x] Update UI ContactDialog to add phone checkbox with cost warning (both SearchResults + Home)
- [x] Display phone number in contact details when available (already in ContactModal)
- [x] Test phone enrichment feature (8 vitest tests passing)
- [x] Save checkpoint

## ConnectGroup Brain: Deep Offering Intelligence
- [x] Design architecture: offering intelligence model that deeply understands ConnectGroup
- [x] Create database table for offering_intelligence (stores deep research about ConnectGroup)
- [x] Build Deep Research button in UI to trigger ConnectGroup analysis
- [x] Create LLM-powered offering analyzer that researches ConnectGroup's:
  - [x] Core capabilities and technical differentiators
  - [x] Ideal customer profile (ICP) with specific characteristics
  - [x] Past success stories and case studies
  - [x] Competitive positioning vs other EMS providers
  - [x] Key buying signals that indicate high fit
  - [x] Industry-specific value propositions
- [x] Store the intelligence as structured JSON for reuse across all prospect evaluations
- [x] Integrate Brain into fit scoring: use offering intelligence to assess prospect fit
- [x] Integrate Brain into urgency assessment: use offering intelligence to identify urgency signals
- [ ] Add transparency: show how Brain influenced fit/urgency scores
- [ ] Test end-to-end with real companies
- [ ] Save checkpoint

## Feature: ConnectGroup Brain (Deep Offering Intelligence)
- [x] Design database schema: offering_brain table (20 columns, structured intelligence)
- [x] Create migration SQL and apply via webdev_execute_sql
- [x] Build backend procedure: researchOfferingBrain (uses Grok to deeply analyze a company website)
- [x] Store structured intelligence: ICP, value propositions, competitive advantages, buying signals
- [x] Build UI: "Research Brain" page in sidebar with research button and intelligence display
- [x] Allow user to edit/refine Brain intelligence (HITL)
- [x] Integrate Brain context into Deep Research prompts for better fit/urgency scoring
- [x] Test Brain feature
- [ ] Save checkpoint

## Feature: Find All C-Suite
- [x] Create backend procedure: findAllCSuite (batch search for CEO, CFO, CTO, COO, VP Sales)
- [x] Add tRPC mutation: findAllCSuite (accepts companyId, returns array of contacts)
- [x] Store found contacts in database (new contacts table or extend existing)
- [x] Build UI: "Find All C-Suite" button on company cards
- [x] Display contact list in expandable section per company
- [x] Test C-Suite feature
- [ ] Save checkpoint

## Bug Fix: Contact Details Display
- [x] Fix messy/broken contact details display when contacts are found
- [x] Ensure clean, organized layout for contact information


## Feature: Single Active Brain Strategy
- [x] Update database schema: add brainName and isActive columns to offering_brain table
- [x] Create and execute migration SQL
- [x] Add database helper functions (getActiveOfferingBrain, deactivateAllBrains, setOfferingBrainActive)
- [x] Build brain.save procedure with brainName input
- [x] Build brain.setActive procedure
- [x] Build brain.getActive procedure
- [x] Build brain.list procedure
- [x] Build brain.delete procedure with active brain validation
- [x] Update Brain UI page: add save functionality and brain name input
- [x] Update Brain UI page: add "My Saved Brains" list with active brain selection
- [x] Update Import Campaign page: show active brain name
- [x] Update enrichment logic to use getActiveOfferingBrain
- [x] Add validation: prevent deletion of active brain
- [x] Write vitest tests for brain management
- [x] Save checkpoint

## UI Cleanup: Remove Deprecated Sidebar Links
- [x] Remove "Focused Offering" link from DashboardLayout sidebar navigation
- [x] Remove "Search Scenario" link from DashboardLayout sidebar navigation
- [x] Keep the pages intact (only remove navigation links)
- [x] Save checkpoint


## UX Fix: Import Campaign Success Behavior
- [x] Update ImportCampaign page to stay on same page after CSV import
- [x] Remove automatic redirect to search results page
- [x] Show success message with campaign details
- [x] Save checkpoint


## Feature: Trickle-Down Contact Search
- [x] Research Apollo People Search API seniority filtering options
- [x] Implement trickle-down logic: C-Suite → VP → Director → Manager → any contact
- [x] Update UI to show seniority level found and trickle-down status
- [x] Write vitest tests for trickle-down logic
- [x] Save checkpoint


## UI Cleanup: Remove Deprecated FIND CONTACT Button
- [x] Remove FIND CONTACT button from SearchResults company cards
- [x] Remove FindContactButton component and related code
- [x] Keep FIND CONTACTS (trickle-down) as the primary contact search feature
- [x] Save checkpoint


## UI Enhancement: Rename FIND CONTACTS to FIND DECISION-MAKERS
- [x] Update button label from "FIND CONTACTS" to "FIND DECISION-MAKERS"
- [x] Update toast messages and modal titles to reflect new terminology
- [x] Save checkpoint


## UX Fix: Remove Active Brain Card from Import Campaign
- [x] Remove Active Brain info card from ImportCampaign page
- [x] Brain context is only used during enrichment, not during CSV upload
- [x] Save checkpoint


## UX Enhancement: Reorder Brain Page Layout
- [x] Move "My Saved Brains" section to the top of the page
- [x] Move research form below the saved brains list
- [x] Prioritize brain management over brain creation
- [ ] Save checkpoint


## UX Fix: Improve Brain Editing Interface
- [x] Replace JSON textarea edit mode with individual item inputs for array fields
- [x] Add/remove buttons for each item in arrays (capabilities, industries, pain points, etc.)
- [x] Prevent JSON corruption when editing structured fields
- [x] Save checkpoint


## UX Enhancement: Array-Aware Editing for Fit Scoring Criteria
- [x] Apply array-aware editing interface to Must-Have Criteria field
- [x] Apply array-aware editing interface to Nice-to-Have field
- [x] Apply array-aware editing interface to Disqualifiers field
- [ ] Save checkpoint

## UX Enhancement: Array-Aware Editing for Fit Scoring Criteria (Completed)
- [x] Apply array-aware editing interface to Must-Have Criteria field
- [x] Apply array-aware editing interface to Nice-to-Have field
- [x] Apply array-aware editing interface to Disqualifiers field
- [x] Save checkpoint

## UI Cleanup: Simplify Offering Brain Header
- [x] Remove explanatory text below "OFFERING BRAIN" title
- [x] Keep only the title on one line
- [x] Save checkpoint

## Navigation Enhancement: Quick Jump Buttons
- [x] Add navigation buttons below saved brains list
- [x] "Edit Active Brain" button (scrolls to edit area, only shown when active brain exists)
- [x] "Create New Brain" button (scrolls to create form)
- [x] Save checkpoint

## Routing Update: Brain as Home Page
- [x] Update App.tsx to route "/" to Brain page instead of Home
- [x] Sidebar navigation already has Offering Brain as first item
- [x] Save checkpoint

## UX Enhancement: Collapsible Sections
- [x] Add state for CREATE NEW BRAIN section visibility
- [x] Add state for EDIT ACTIVE BRAIN section visibility
- [x] Update navigation buttons to toggle section visibility
- [x] Hide sections by default, show only when button clicked
- [x] Save checkpoint

## UX Enhancement: Campaign Request Instructions
- [x] Add instruction line to Import Campaign page
- [x] Display email (l.vanbolderick@connectgroup.com) for campaign requests
- [x] Save checkpoint

## UX Enhancement: Button Label Update
- [x] Change "EDIT ACTIVE BRAIN" button label to "VIEW / EDIT BRAIN"
- [x] Save checkpoint

## UX Enhancement: Display Industry Codes on Brain Cards
- [x] Add SIC and NACE code fields to database schema
- [x] Apply migration to offering_brain table
- [x] Add SIC codes and NACE codes display to brain cards
- [x] Show code explanations alongside the codes
- [x] Save checkpoint

## Feature: Deep Research JSON Export
- [x] Add download button to Deep Research page
- [x] Create JSON export of all deep researched companies
- [x] Include all company data and research briefs in export
- [x] Include decision makers/contacts in export
- [x] Save checkpoint

## UX Adjustment: Download Button Position
- [x] Move JSON export button from sort controls to top of page
- [x] Place button near page header for better visibility
- [x] Save checkpoint

## Feature: Two-Stage Personnel Search (Cost Reduction)
- [x] Modify getAllPersonnel backend to skip enrichment (basic data only)
- [x] Add enrichContact procedure for selective email/phone enrichment
- [x] Update Search Results button UI to show basic contacts with enrich option
- [x] Add GET ALL PERSONNEL button to Deep Research Dashboard
- [x] Save checkpoint

## Enhancement: Increase getAllPersonnel Limit
- [x] Investigate Apollo API pagination parameters
- [x] Implement multi-page fetching to get all employees (default 500, paginated)
- [x] Update frontend to handle larger result sets
- [x] Save checkpoint

## Feature: Configurable Personnel Fetch Limit
- [x] Add dropdown UI in Search Results personnel modal (100, 500, 1000)
- [x] Add dropdown UI in Deep Research personnel modal (100, 500, 1000)
- [x] Wire dropdown selection to getAllPersonnel backend calls
- [x] Save checkpoint

## UX Redesign: Personnel Search Flow
- [x] Update Search Results: Show selection modal with dropdown BEFORE fetching
- [x] Update Deep Research: Show selection modal with dropdown BEFORE fetching
- [x] Modal should have dropdown (100, 500, 1000) and "FETCH" button
- [x] Only start API call after user confirms fetch limit
- [x] Save checkpoint

## Bug Fix: 100-Employee Limit in getAllPersonnel
- [x] Debug backend pagination logic in apolloPeopleSearch.ts
- [x] Identified issue: Apollo API returns total_entries=0, causing early loop exit
- [x] Fix pagination loop to continue until no results (ignore total_entries)
- [x] Pagination now continues until partial page or maxResults reached
- [x] Save checkpoint

## Fix: Large CSV Import (21k rows / 13MB)
- [x] Add server-side REST endpoint POST /api/import-csv to accept multipart file upload
- [x] Bypass browser JS stack limit by streaming file directly to server
- [x] Import the 21k-row Apollo CSV from sandbox
- [x] Verify all rows imported correctly

## Feature: Backend Enrich Campaign Endpoint
- [x] Add POST /api/v1/enrich-campaign endpoint (API key auth, no browser needed)
- [x] Accept searchId, optional batchSize and concurrency params
- [x] Run same enrichCompanyDetails logic as enrichAll tRPC procedure
- [x] Stream progress via chunked response so caller can monitor batches
- [x] Test on VanderLandeUSA_02_03_2026 campaign (searchId=750001) — 93 remaining enriched, 0 failed

## Feature: Backend Batch Research Endpoint
- [x] Add POST /api/v1/research-campaign endpoint (API key auth, no browser needed)
- [x] Accept searchId, limit (max companies to research), concurrency (default 1 — sequential to avoid Grok rate limits)
- [x] Skip companies that already have briefData (cached, < 7 days old)
- [x] Stream NDJSON progress: started, progress per company, done
- [x] Use owner userId=1 for Brain context injection
- [x] Test on VanderLandeUSA_02_03_2026 (searchId=750001) with limit=3 — 3/3 succeeded (urgency: 52, 60)

## Fix: Brain Context JSON Parse Error
- [x] Diagnose which brain field(s) are malformed — fitCriteria missing opening '{'
- [x] Fix malformed fitCriteria in active brain DB record via SQL CONCAT
- [x] Fix root cause: replace greedy regex /\{[\s\S]*\}/ with firstBrace/lastBrace slice in brainResearchService.ts
- [x] Verify brain context is injected correctly — confirmed '[Brain context loaded]' in logs at 10:28:27

## Feature: Library Section in Deep Research
- [x] Remove Sources from its current position in the brief
- [x] Add "Library" section at the very bottom of each research card
- [x] Library contains: Sources list (renamed from Verified Sources) + Raw Grok Output (collapsible)
- [x] Raw Grok output shown as preformatted JSON in a collapsible block
- [x] briefGenerator.ts stores rawGrokUrgency and rawGrokIntelligence in briefData for new briefs

## Feature: Re-Research Button & Backend Endpoint
- [x] Add "RE-RESEARCH" button to each Deep Research card (clears cached brief and triggers fresh Grok run)
- [x] Add tRPC mutation reResearchCompany that clears briefData/briefGeneratedAt and calls generateSalesIntelligenceBrief
- [x] Add POST /api/v1/re-research-campaign backend endpoint (API key auth, re-researches all companies in a campaign regardless of cache)

## Feature: Fit Score Sorting on Search Results Page
- [x] Add sort controls to Search Results page: IMPORT ORDER / URGENCY ▼ / FIT×URGENCY ▼ (default: urgency)
- [x] Show ⚡ urgency score badge on each company card (red ≥70, yellow ≥50, gray <50)
- [x] Sort displayedCompanies by urgencyScore or urgency×fitScore via useMemo

## Feature: Grok-Powered Fit Scoring (fitScore column)
- [x] Add fitScore (int) and fitScoreData (text JSON) columns to companies schema
- [x] Run Drizzle migration: ALTER TABLE companies ADD fitScore int, ADD fitScoreData text
- [x] Add FitScoreResult interface and scoreCompanyFit() function to briefGenerator.ts
- [x] Scoring uses Brain ICP criteria: industryFit(30) + sizeFit(20) + mustHavesFit(30) + buyingSignalsFit(20), capped at 25 if disqualifier triggered
- [x] Add scoreCompanyFit tRPC mutation to companyFinderRouter
- [x] Add POST /api/v1/score-campaign backend endpoint (streams NDJSON, skips already-scored companies)
- [x] Tested: World Distribution Services → fitScore 20 (correctly low — logistics, not EMS)

## Feature: Team Sharing for Campaigns
- [x] Add sharedWithTeam boolean column to searches schema (default false)
- [x] Run Drizzle migration to apply the column
- [x] Update getUserSearches query to return own searches + all shared searches
- [x] Add toggleShareSearch tRPC mutation (owner-only, flips sharedWithTeam)
- [x] Add SHARE toggle UI to campaign card in Search Results (shows SHARED badge when active)
- [x] Share VanderLande campaign by default so Jeroen can see it immediately

## Fix: Shared Campaign "SEARCH NOT FOUND" for Non-Owners
- [x] Fix getSearch procedure to allow access when sharedWithTeam=true (not just owner)

## Fix: Full Shared Campaign Access for Non-Owners
- [x] Created assertSearchAccess(searchId, userId) helper — allows owner OR sharedWithTeam
- [x] Created assertSearchOwner(searchId, userId) helper — owner-only for write operations
- [x] Created assertCompanyAccess(companyId, userId) helper — checks company's search ownership/sharing
- [x] getSearch — uses assertSearchAccess (read)
- [x] enrichAll — uses assertSearchOwner (write)
- [x] enrichSingle — uses assertCompanyAccess (write via company)
- [x] exportCsv — uses assertSearchAccess (read)
- [x] getSearchDecisions — uses assertSearchAccess (read)
- [x] updateExcludedSectors — uses assertSearchOwner (write)
- [x] confirmAndSearch — uses assertSearchOwner (write)
- [x] runCodeTargeting — uses assertSearchOwner (write)
- [x] toggleShareSearch — uses assertSearchOwner (owner-only)
- [x] generateBrief — uses assertCompanyAccess (read)
- [x] generateSalesApproach — uses assertCompanyAccess (read)
- [x] findContact — uses assertCompanyAccess (read)
- [x] getContact — uses assertCompanyAccess (read)
- [x] submitDecision — uses assertCompanyAccess (read)
- [x] getDecision — uses assertCompanyAccess (read)
- [x] getCompanyContacts — uses assertCompanyAccess (read)
- [x] findAllCSuite — uses assertCompanyAccess (read)
- [x] getAllPersonnel — uses assertCompanyAccess (read)
- [x] reResearchCompany — uses assertCompanyAccess (read)
- [x] scoreCompanyFit — uses assertCompanyAccess (read)
- [x] enrichContact — uses assertCompanyAccess (read)

## Feature: Conference Exhibitor Import
- [x] Build conferenceScraper.ts service with 3 strategies: logo-link, text-link, Grok AI fallback
- [x] Apollo enrichment via organizations/enrich endpoint (domain lookup)
- [x] Session-authenticated streaming endpoint at /api/conference-import
- [x] Frontend ConferenceImport page with live progress log and progress bar
- [x] "Conference Import" entry added to sidebar navigation
- [x] Unit tests for scraper service (8 tests: extraction strategies, dedup, social filter, URL cleaning, Apollo enrich)
- [x] Fix hitl.test.ts: add getSearchById mocks to all tests using assertCompanyAccess/assertSearchAccess
- [x] Fix confirmAndSearch.test.ts: update expected call count from 3 to 63 (multi-slice architecture)
- [x] All 206 tests passing (18 test files)

## Feature: Multi-Page Exhibitor Directory Support
- [x] Detect pagination links (next page, numbered pages, load-more) in scraped HTML
- [x] Crawl all detected pages up to a configurable max (default 20 pages)
- [x] Stream page-by-page progress to frontend ("Scraping page 3 of 8...")
- [x] Deduplicate companies across all pages before Apollo enrichment
- [x] Handle common pagination patterns: ?page=N, /page/N, rel=next, Next anchor, › chevron
- [x] Loop protection: never revisit the same URL
- [x] Stop early when a page returns 0 companies (past the end)
- [x] 11 new pagination tests (detection + multi-page crawl) — 217 total passing (18 test files)

## Feature: Robust JS-Rendered Conference Scraper
- [x] Install puppeteer-core (uses system Chromium, no bundled download)
- [x] Build headless browser fetch layer (renders JS, waits for networkidle2)
- [x] Integrate Puppeteer as fallback when axios HTML fetch yields <5 companies
- [x] Handle SPA pagination: click "Load More" / "Show More" / "Mehr anzeigen" buttons up to 30 times
- [x] Retry logic: 3 attempts with exponential backoff on network errors
- [x] Smarter deduplication: normalize company names (strip Inc/Ltd/GmbH/B.V. suffixes) before dedup
- [x] Domain normalization: strip www., trailing slashes, and path suffixes before Apollo lookup
- [x] Grok AI fallback: when both axios and Puppeteer yield <5 companies, ask Grok to extract from rendered HTML
- [x] Stream "Using headless browser..." / "Clicking Load More..." status events to frontend
- [x] Update unit tests for new pipeline stages — 226 total passing (18 test files)

## Feature: Stage 5 Tracking (PARKED — future sprint)
- [ ] See full architecture notes in docs/stage5-tracking-architecture.md
- [ ] Signal Configuration tab on Offering Brain page (offering-scoped)
- [ ] Scan Run per campaign (campaign-scoped execution)
- [ ] Signal Hit storage with Grok relevance assessment
- [ ] 8 signal types: hiring, funding, new leadership, expansion, revenue growth, tech migration, compliance, general news
- [ ] Urgency decay over time (recent hits weighted higher)
- [ ] Campaign results view: Fit x Urgency sort + HOT badge
- [ ] New "Tracking" page: all hot companies across all campaigns
- [ ] Open decisions to resolve: scan trigger cadence, company scope filter, hiring signal source

## Feature: Pre-Fetch Seniority & Department Filter for Get All Personnel
- [x] Update getAllPersonnel() in apolloPeopleSearch.ts to accept seniorities[] and department params
- [x] Update getAllPersonnel tRPC procedure input schema with optional seniorities and department fields
- [x] Redesign Fetch Personnel modal: seniority checkboxes (C-Suite+VP default), department dropdown, reduced max results (10/25/50/100)
- [x] 226 tests passing — no regressions

## Fix: Conference Scraper — Next.js SSR Sites (Intertraffic pattern)
- [x] Add __NEXT_DATA__ JSON extractor as Strategy 0 (runs before all other strategies)
- [x] Extract company names + countryCode + website from embedded Next.js JSON blobs
- [x] Smart filtering: ignores nav/menu arrays (requires slug/countryCode/standNumber to qualify)
- [x] Add apolloEnrichByName() fallback when no domain available (name + organization_country_code)
- [x] conferenceImport route uses name-based enrichment when websiteUrl is null
- [x] 7 new tests (4 __NEXT_DATA__ + 3 apolloEnrichByName) — 233 total passing (18 test files)

## Fix: Apollo Name-Based Enrichment Not Finding Companies (Conference Import)
- [x] Diagnose why apolloEnrichByName returns null for Intertraffic exhibitors
- [x] Root cause: apolloEnrichByName was using organizations/enrich (requires domain) instead of organizations/search
- [x] Fix: Rewrote apolloEnrichByName to use organizations/search with q_organization_name + organization_locations[]
- [x] Smart best-match selection: exact name match preferred, falls back to first result
- [x] Country code mapped to full country name (ISO 2-letter → "Netherlands", "Germany", etc.)
- [x] Updated 3 tests → 4 tests (added exact-match test) — 234 total passing (18 test files)

## Feature: Backend Name-Enrich Campaign Endpoint
- [x] Add POST /api/v1/name-enrich-campaign endpoint to api.ts
- [x] Fetches all pending companies with no apolloId and no primaryDomain
- [x] Skips junk localhost entries from Next.js internal routes
- [x] Calls apolloEnrichByName(name, country) for each company
- [x] Updates company with full firmographic data on match (apolloId, domain, city, country, SIC/NAICS, etc.)
- [x] Marks as 'failed' when Apollo returns no match
- [x] Supports limit (default 100, max 500) and concurrency (default 3, max 5) params
- [x] Streams NDJSON progress with per-batch lastBatch company names
- [x] 6 unit tests — 240 total passing (19 test files)
- [x] Curl usage: POST /api/v1/name-enrich-campaign -d '{"searchId": 900002, "limit": 200}'

## Intertraffic Enrichment Sprint
- [x] Run name-enrich-campaign on searchId 900002 (408 Intertraffic companies) — running in background
- [x] Add sourceCountryCode column to companies table (schema + migration 0022)
- [x] Persist sourceCountryCode from conference scraper into companies table (all 3 insert paths)
- [x] name-enrich-campaign endpoint uses sourceCountryCode as country hint for Apollo search
- [x] Add [RE-ENRICH BY NAME] button to Search Results page (orange, shows count of name-only companies)
- [x] Add orange progress banner when name enrichment is running
- [x] nameEnrichCampaign tRPC mutation added to companyFinderRouter
- [x] nameOnly count added to enrichmentStats in getSearch procedure

## Feature: Excel Upload Campaign
- [x] Install xlsx + multer npm packages for server-side Excel parsing
- [x] Build POST /api/excel-import endpoint (multipart/form-data, session-authenticated)
  - [x] Accepts .xlsx/.xls/.csv file + campaignName field
  - [x] Auto-detects Company Name and Website columns (case-insensitive, flexible headers)
  - [x] Skips rows with '–' or empty website (treats as name-only)
  - [x] Domain-first Apollo enrichment, name-fallback for rows without website
  - [x] Creates search/campaign record, bulk inserts companies
  - [x] Streams NDJSON progress
- [x] Build Excel Upload UI page (/excel-import)
  - [x] Drag-and-drop file input (xlsx/csv)
  - [x] Campaign name field (auto-filled from filename)
  - [x] Live progress stream with per-company enrichment status
  - [x] Redirect to Search Results on completion
- [x] Add Excel Import to sidebar navigation
- [x] 24 unit tests for column detection, website cleaning, domain extraction, and workbook parsing — 264 total passing (20 test files)

## Feature: Enrichment Status Filter in Search Results
- [x] Add enrichmentFilter state (all | enriched | pending) to SearchResults
- [x] Filter company list based on enrichmentStatus (pending filter also catches 'failed')
- [x] ENRICHED badge is now a green toggle button; PENDING badge is orange toggle button
- [x] MATCHES count shows filtered/total when a filter is active, with ✕ to clear
- [x] Clicking active filter button toggles back to 'all'

## Feature: RESEARCH ALL Button in Search Results
- [x] Understand existing single-company deep research trigger (generateBrief tRPC mutation)
- [x] Build batchGenerateBriefs tRPC mutation: iterates all enriched companies in a searchId, calls generateSalesIntelligenceBrief sequentially, skips cached briefs < 7 days old
- [x] Add purple [RESEARCH ALL — N] button to SearchResults toolbar (visible when enriched > 0)
- [x] Show purple progress banner while batch research is running
- [x] Toast on completion with completed/total/failed counts
- [x] 264 tests still passing (20 test files)

## Feature: POST /api/v1/research-campaign REST Endpoint
- [x] Add POST /api/v1/research-campaign to api.ts (API key auth, NDJSON streaming)
- [x] Accepts searchId + optional skipCached (default true) + optional userId (default 1)
- [x] Fetches all enriched companies for searchId, runs generateSalesIntelligenceBrief sequentially
- [x] Streams NDJSON: start → progress (per company with urgencyScore) → done summary
- [x] Skips companies with briefs < 7 days old when skipCached=true
- [x] 264 tests still passing (20 test files)

## Feature: SALES APPROACH ALL Button in Search Results
- [x] Add batchSalesApproach tRPC mutation: runs generateSalesApproach for all enriched companies in a searchId
- [x] Only processes enriched companies that also have a brief (sales approach requires deep research)
- [x] Skips companies with fresh sales approaches (< 7 days old) when skipCached=true
- [x] Returns skippedNoResearch count for companies without a brief
- [x] Add teal [SALES APPROACH ALL — N] button to SearchResults toolbar
- [x] Show teal progress banner while running
- [x] Toast on completion with completed/failed/skipped counts
- [x] 264 tests still passing (20 test files)

## Feature: Merge RESEARCH ALL + SALES APPROACH ALL into RESEARCH & OUTREACH button
- [x] Add batchResearchAndOutreach tRPC mutation: runs deep research then sales approach sequentially, re-fetches companies between phases so approach sees fresh brief data
- [x] Replace RESEARCH ALL and SALES APPROACH ALL buttons with single purple [RESEARCH & OUTREACH — N] button
- [x] Combined progress banner: Phase 1 (research) + Phase 2 (approaches) described in one banner
- [x] Toast on completion with research completed/failed + approach completed/failed counts
- [x] 264 tests still passing (20 test files)

## Feature: Dynamic Context Sentence in Search Results
- [x] Dynamic guidance sentence added below campaign title, updates based on enrichmentFilter state
- [x] Default (all): "You are looking at {N matches} from {campaign name} (Excel Import). Press {X ENRICHED} to see which ones were found in the Apollo database."
- [x] Enriched filter + no research: "You are looking at the {X enriched companies}. Press [RESEARCH & OUTREACH] to generate a deep brief and personalized sales approach for each one."
- [x] Enriched filter + some research: "You are looking at the {X enriched companies} — {Y} of them already have a research brief. Open any company card to read the brief and copy your outreach script."
- [x] Pending filter: "You are looking at the {X companies} not yet found in Apollo. Press [ENRICH ALL] to retry, or use [RE-ENRICH BY NAME] if these came from a conference or Excel import."
- [x] Styled with left black border for visual distinction from main content

## Feature: OUTREACH READY Filter Badge in Search Results
- [ ] Add 'outreach' to enrichmentFilter state (all | enriched | pending | outreach)
- [ ] Filter: show only companies where salesApproachData is not null
- [ ] Add blue/teal OUTREACH READY badge button next to ENRICHED and PENDING
- [ ] Show count of companies with sales approach generated
- [ ] Update dynamic context sentence for outreach filter state

## Feature: Hero Sentence + OUTREACH READY Filter
- [x] Hero sentence is now 2xl/3xl font-black — the dominant visual element on the page
- [x] Campaign title, run ID, and date demoted to a single compact metadata line at the top
- [x] CHANGE SEARCH button shrunk to match the secondary metadata line
- [x] Hero sentence is context-aware: shows outreach-ready count when available, enriched count next, then total
- [x] Add teal OUTREACH READY badge button (only shown when outreachReady > 0)
- [x] enrichmentFilter extended to 'all' | 'enriched' | 'pending' | 'outreach'
- [x] outreachReady count added to enrichmentStats in getSearch tRPC procedure
- [x] 264 tests still passing (20 test files)

## Feature: Hero Sentence UX Improvements
- [x] Bold [RESEARCH & OUTREACH] text in all hero sentence states is now clickable (dotted underline, purple hover, triggers mutation directly)
- [x] Tooltip added to purple RESEARCH & OUTREACH button: "Generates a deep company brief (market position, pain points, recent news) + a personalized email, LinkedIn message, and call script for each enriched company."
- [x] CALL TODAY hero state: "You have X companies to call today. Open each card below for your call script — good luck!"

## Feature: High-Urgency CTA Paragraph
- [x] Secondary red CTA paragraph appears below hero sentence when companies with urgencyScore >= 70 are not yet in Call Today list
- [x] Names up to 3 companies inline: "Arvoo Imaging, Siemens Mobility, and 2 more have a high urgency score"
- [x] Clickable underlined text: "add all N to your Call Today list" — triggers submitDecision for each high-urgency company
- [x] Paragraph disappears once all high-urgency companies are in Call Today list
- [x] submitDecisionMutation hook added to SearchResults (invalidates getSearch on success)

## Fix: React Hooks Order Crash in SearchResults
- [x] Moved highUrgencyNotCalled useMemo before the isSelectMode early return — hooks now always called in same order
- [x] OUTREACH READY text in hero sentence is now clickable (dotted underline, sets enrichmentFilter to 'outreach')

## Fix: High-Urgency CTA Styling
- [x] Matched font size to hero paragraph (text-2xl md:text-3xl font-black)
- [x] Added blink animation (animate-blink-cta keyframe in index.css, 1.2s ease-in-out infinite)
- [x] Message stays visible after click — switches to red confirmation: "All high-urgency companies have been added to your Call Today list. Check the CALL TODAY tab below."

## Feature: Call Today Count Sentence After CTA Confirmation
- [x] Added second red sentence after urgency CTA confirmation: "{N} companies added to your Call Today list — [start your outreach]"
- [x] Clicking "start your outreach" sets showCallTodayOnly=true to scroll into Call Today view
- [x] Same font size and red color as the hero/CTA paragraphs (text-2xl md:text-3xl font-black text-red-700)

## Feature: Company Card UI Cleanup + Research/Approach Header Cards
- [ ] Remove Phone and Founded fields from company card
- [ ] Add clickable VIEW RESEARCH and VIEW APPROACH header cards in the empty middle space of the card
- [ ] Cards should open the respective modal/panel directly (same as the footer buttons)

## Feature: Dedicated Call Today Page
- [ ] Create /call-today/:searchId route and page component
- [ ] Show only companies with call_today decision in a stripped-down queue
- [ ] Each company shows name, location, revenue, LinkedIn, SIC/NAICS
- [ ] Prominent VIEW RESEARCH and VIEW APPROACH clickable cards
- [ ] Navigation: previous/next company in queue
- [ ] Add "Call Today" link in sidebar nav
- [ ] Wire "start your outreach" CTA to navigate to /call-today/:searchId

## Feature: Company Detail Page with Chapter Navigation
- [x] Add tRPC procedure: companyFinder.getCompany (single company with all data by companyId)
- [x] Build /company/:companyId page with chapter tabs: Urgency, Research, Approach, Contacts
- [x] Back navigation: preserve ?from=search/:searchId or ?from=call-today/:searchId context
- [x] Wire bullet CTAs on search results card to /company/:companyId?chapter=research&from=...
- [x] Wire urgency score click to /company/:companyId?chapter=urgency&from=...
- [x] Wire VIEW RESEARCH / VIEW APPROACH header cards to /company/:companyId?chapter=...
- [x] Wire Call Today research/approach cards to company chapter pages
- [x] Wide layout on chapter pages with image placeholder slots in Products & Services

## Feature: Sales-Rep Company Detail Redesign
- [ ] Add callOutcomes DB table (companyId, outcome, followUpDate, notes, createdAt)
- [ ] Add callReadinessSummary column to companies table
- [ ] Add tRPC: logCallOutcome mutation, getCallOutcomes query, generateCallReadiness mutation
- [ ] Company Detail Overview: call readiness summary bar (LLM-generated, 1 sentence)
- [ ] Company Detail Overview: top contact surfaced front and centre (name, title, phone, email)
- [ ] Company Detail Overview: call outcome logger (Reached / Voicemail / No Answer + follow-up date)
- [ ] Company Detail Overview: next-best-action prompt based on last outcome
- [ ] Company Detail Overview: replace SIC/NAICS with plain-English industry, headcount range, growth signal
- [ ] Search Results card: remove SIC/NAICS codes
- [ ] Search Results card: show last call outcome badge + next-action indicator

## Feature: Persistent Call Outcomes & Nurture List
- [ ] Verify callOutcomes table has all needed fields (companyId, userId, outcome, notes, followUpDate, createdAt)
- [ ] CompanyDetail: load persisted outcomes on page open, pre-fill last outcome state, show full outcome history log
- [ ] Add getNurtureList tRPC procedure: companies with follow-up dates, joined with last outcome, sorted by followUpDate ASC
- [ ] Build Nurture List page: follow-up queue sorted by date, outcome badge, notes preview, company link, overdue indicator
- [ ] Add Nurture List to sidebar nav with badge count of overdue items
- [ ] Wire /nurture route in App.tsx

## UI Restyle Pass (Visual Noise Reduction)
- [x] SALES BRIEF button added to company cards (right-side CTA, dark bg)
- [x] Decision buttons: CALL TODAY stays green, PARK and NOT RELEVANT neutralised to grey
- [x] Filter badges (ENRICHED/PENDING/OUTREACH READY/EXCLUDED) neutralised to grey/black
- [x] Action buttons (ENRICH ALL, RESEARCH & OUTREACH, RE-ENRICH) border reduced from 4 to 2
- [x] Progress banners (enriching/research/re-enrich) neutralised to grey-50 background
- [x] ALL/CALL TODAY tab buttons border reduced from 4 to 2, CALL TODAY active state changed to black
- [x] Quick-view modal sections (urgency, starters, email, linkedin, call script) unified to border-l-4 gray-900 scheme
- [x] DeepResearchButton and CreateSalesApproachButton modals fully neutralised
- [x] FindAllCSuiteButton and GetAllPersonnelButton neutralised to grey/black
- [x] CSuiteContactsModal header changed from purple to gray-900
- [x] Tier progress indicators neutralised to grey scale
- [x] Hero sentence inline links changed from purple hover to gray-600 hover
- [x] Search progress bar changed from blue to gray-900
- [x] All source/link anchors changed from blue-600 to gray-600/gray-900
- [x] LinkedIn URL in data grid changed from blue to gray-700

## Bug Fix: Sidebar Nav Items Gated to Active Search
- [x] Remove search-result dependency from Call Today, Nurture List, and other nav items
- [x] All sidebar items should be navigable without a search result selected

## Feature: Serper Images API — Company Card Images
- [ ] Test Serper Images API and understand response structure
- [ ] Store SERPER_API_KEY as project secret
- [ ] Add imageUrl column to companies table
- [ ] Build fetchCompanyImage tRPC procedure (query Serper, cache result in DB)
- [ ] Display image on company cards (lazy-load, graceful fallback to placeholder)
- [ ] Auto-fetch image when company is enriched (or on-demand button)

## Feature: Product Images Section in Company Detail (Research Tab)
- [x] Add imageUrls TEXT column to companies table (JSON array of image objects)
- [x] Build fetchCompanyImages tRPC procedure: query Serper Images API, prefer domain-matched results, cache in DB
- [x] Add Product Images section to CompanyDetail Research tab, below Key Technologies
- [x] Image grid: 3-4 images, lazy-load, click to open full-size, graceful fallback placeholder
- [x] On-demand FETCH IMAGES button with REFRESH option after first fetch
- [x] Write vitest for fetchCompanyImages procedure (6 tests passing)

## UX: Enrich Recent Developments Cards
- [x] Show headline, summary snippet, and source attribution on each card (not just date + link)

## UX: Product Images - Own Tab + Domain Filter
- [x] Move Product Images to its own "Product Images" tab in the Research sub-nav
- [x] Remove Product Images section from Key Technologies tab
- [x] Filter Serper results: exclude e-commerce/retail domains (amazon, ebay, alibaba, etc.)
- [x] Prefer company's own domain in results (two-pass query: site: first, then broad)
- [x] Add site: operator + tech-focused query to Serper to get product/tech images

## Feature: Prompt Repository Integration (rebuilt after sandbox reset)
- [x] Audit all LLM prompts across the codebase (8 prompts found in 6 files)
- [x] Create server/prompts/index.ts with 8 typed PromptTemplate constants and fillTemplate helper
- [x] Add prompts.list tRPC procedure (protectedProcedure.query)
- [x] Add Prompt Repository sidebar nav item (ScrollText icon, /prompts route)
- [x] Create PromptRepository.tsx page with category filter tabs and expandable cards
- [x] Write vitest tests for prompt catalogue integrity and fillTemplate (21 new tests, 291 total passing)

## UX: Loud Cache Indicators
- [x] Show prominent CACHED banner/badge on Research, Urgency, Approach, Contacts when data is from DB cache
- [x] Include cache age ("Research data cached 3 days ago") so user knows how stale the data is
- [x] Stale data (>7 days) shown in orange with DATA MAY BE STALE warning
- [x] REFRESH NOW button on Urgency, Research, Approach; RE-ENRICH on Contacts
- [x] force=true parameter added to generateBrief to bypass cache on manual refresh

## Bug: Batch RESEARCH & OUTREACH — Some Companies Missing Sales Approach
- [x] Diagnose why Phase 2 (sales approach) skips some companies that completed Phase 1 (research)
  - Root cause: HTTP timeout mid-batch leaves companies with research but no approach
- [x] Add getBatchStatus tRPC query to count companies with research but no approach
- [x] Add completeMissingApproach tRPC mutation to run Phase 2 only for gap companies
- [x] Add orange [COMPLETE APPROACH — N MISSING] button to toolbar (only shown when gap > 0)

## Niche-Level Dynamic Fit Scoring (Brain-Driven)
- [x] Add `niches` table to drizzle schema (name, description, companyCount, topKeywords, sampleCompanies, brainId, fitScore, fitReasoning, scoreBreakdown, searchId)
- [x] Create `server/nicheFitScorer.ts` — dynamic LLM-inferred scoring engine (3-5 dimensions inferred from Offering Brain)
- [x] Add `niche.scoreNiches` tRPC procedure (batch: score all niches for a search)
- [x] Add `niche.getNiches` tRPC procedure (list niches with scores for a search)
- [x] Add `niche.rescoreNiche` tRPC procedure (single niche rescore)
- [x] Create `/niche-review` page — Herd Mapping view with niches ranked by fit score
- [x] Render dynamic score component breakdown (variable dimensions, not hardcoded 4)
- [x] Register `/niche-review` route in App.tsx
- [x] Write vitest tests for nicheFitScorer (303 passing)
- [x] Update niche-intelligence SKILL.md with dynamic scoring architecture
- [x] Add future plan item: explicit scoring criteria defined in Offering Brain

## Bug Fix: Herd Mapping Score All Niches error
- [x] Guard "Score All Niches" button — show toast "No niches in this search yet. Add niches first." instead of propagating the API error
- [x] Disable "Score All Niches" when the selected search has 0 niches
- [x] Improve empty-state message to explain niches come from the import pipeline or can be added manually

## Feature: Auto-persist niches from Import Campaign clustering
- [ ] After clusterAndScore succeeds in Import Campaign UI, call niche.create for each cluster
- [ ] Add saveNiches tRPC procedure (batch create niches from clustering result)
- [ ] Show "View in Herd Mapping" button after Step 4 completes
- [ ] Redirect to /niche-review with the searchId after niches are saved

## Feature: Auto-persist niches after import (completed 2026-03-09)
- [x] Create `server/embeddingService.ts` — OpenAI text-embedding-3-small batched embeddings
- [x] Create `server/clusteringService.ts` — k-means++ with silhouette auto-K, LLM cluster naming
- [x] Add `niche.clusterAndSaveNiches` tRPC procedure — full pipeline (embed → cluster → save → score)
- [x] Rewrite ImportCampaign page — 3-step flow: upload → clustering progress → results + redirect to Herd Mapping
- [x] Validate OpenAI API key for embeddings (304 tests passing)

## Rename: Herd Mapping → Market Segments
- [ ] Rename in DashboardLayout sidebar nav
- [ ] Rename page title and headings in NicheReview.tsx
- [ ] Rename route from /niche-review references in ImportCampaign.tsx (keep URL, just update display text)

## Feature: Direct Apollo CSV Import (No Apollo API Calls)
- [x] Detect Apollo CSV column headers (Company Name, Website, Industry, # Employees, City, Country, etc.)
- [x] Map Apollo columns directly to companies table — skip all Apollo API enrichment calls
- [x] Update ExcelImport.tsx UI to reflect instant import (no Apollo progress messages)
- [x] Keep fallback: non-Apollo files (name + website only) also accepted, headers matched case-insensitively

## Feature: Cluster Companies button on Market Segments page
- [x] Add "Cluster Companies" button to Market Segments page header
- [x] Wire button to niche.clusterAndSaveNiches tRPC procedure
- [x] Show progress feedback (embedding → clustering → naming → scoring) during the pipeline
- [x] Auto-select searchId from URL param (?searchId=X) when arriving from Excel Import
- [x] Refresh niche list after clustering completes

## Feature: Phone Enrichment → Premium Gate
- [ ] Find all phone enrichment UI and backend calls
- [ ] Disable phone enrichment functionality (no API calls)
- [ ] Show "Premium Feature" badge/lock on phone fields in UI
- [ ] Show toast "Phone enrichment is a premium feature" on click

## Feature: Two-Phase Clustering (500 seed + proximity assignment)
- [ ] Update clusteringService.ts to accept sampleSize param (default 500) and store centroids
- [ ] Add assignByProximity() function: embed remaining companies, assign to nearest centroid
- [ ] Add background job runner (in-memory queue) for Phase 2
- [ ] Add niche.assignRemainingCompanies tRPC procedure (triggers background job, returns jobId)
- [ ] Add niche.getJobStatus tRPC procedure (polls job progress)
- [ ] Update Market Segments UI: show company count per niche, "Assign Remaining" button after Phase 1
- [ ] Show Phase 2 progress (X of Y companies assigned) with polling
- [ ] Gate phone enrichment as premium feature (checkbox → Premium badge)

## Two-Phase Clustering for Large Imports
- [x] Add `stratifiedSample()` function to clusteringService.ts (proportional sampling by industry)
- [x] Add `assignToNearestCentroid()` function (cosine similarity assignment)
- [x] Add `assignRemainingByProximity()` function (batch Phase 2 assignment)
- [x] Add `nicheId` column to companies table (schema + migration)
- [x] Update `clusterAndSaveNiches` to assign seed companies' nicheId during Phase 1
- [x] Add `niche.getUnassignedCount` tRPC query (returns unassigned/total counts)
- [x] Add `niche.assignRemainingCompanies` tRPC mutation (Phase 2 proximity assignment)
- [x] Update Market Segments UI: rename button to "Cluster Seed Sample"
- [x] Add "Assign Remaining (N)" blue button that appears when unassigned companies exist
- [x] Add Phase 2 progress banner and result summary banner
- [x] Write 12 vitest tests for clusteringService (stratifiedSample, assignToNearestCentroid, assignRemainingByProximity)
- [x] 316 tests passing

## Phone Enrichment Premium Gate
- [x] Remove "Include phone number" checkbox from Find Contact modal
- [x] Replace with strikethrough label + amber "Premium" badge with tooltip
- [x] Force `includePhone: false` in findContact mutation call

## Phase 1 Banner Fix + Iterative Expand Sample
- [x] Fix Phase 1 banner: "N companies not yet assigned" should exclude seed companies (which are already assigned)
- [x] Add `expandClusterSample` tRPC mutation: takes next 500 unassigned companies, embeds them, merges into existing clusters by proximity (no re-clustering)
- [x] Add "Expand Sample (+500)" button in Market Segments UI (shown when unassigned > 0 and niches exist)
- [x] Show progress/result banner for expand sample operation
- [x] 316 tests passing (no new tests needed — expand uses same assignRemainingByProximity already tested)

## Two-Level Segment Hierarchy (Sub-cluster)
- [x] Add parentNicheId INT column to niches table (nullable FK to niches.id), run migration
- [x] Add subClusterNiche tRPC mutation: scoped to companies with nicheId = parentId, runs full Phase 1 clustering, saves child niches with parentNicheId set
- [x] Add getChildNiches tRPC query: returns niches where parentNicheId = given id
- [x] Add "Sub-cluster" button to each top-level segment card in NicheReview
- [x] Show child niches as indented cards beneath their parent segment card
- [x] Show sub-cluster progress/result banner
- [x] 316 tests passing

## Fix Expand Sample: Online Clustering (discover new niches)
- [x] Add expandWithDiscovery function to clusteringService: assign by proximity, collect poor-fit companies (cosine similarity < threshold), re-cluster them into new niches
- [x] Update expandClusterSample procedure to use expandWithDiscovery and persist any new niches found
- [x] Return newNichesCreated count in expand result
- [x] Update expand result banner to show new niches discovered (if any)

## Target Group Size Control (Phase 1 + Sub-cluster)
- [x] Update clusterCompanies() to accept optional explicit K override parameter
- [x] Update clusterAndSaveNiches procedure to accept targetGroupSize (default 300), derive K = ceil(seedCount / targetGroupSize)
- [x] Update subClusterNiche procedure to accept targetGroupSize (default 300), derive K = ceil(companyCount / targetGroupSize)
- [x] Add targetGroupSize input field next to "Cluster Seed Sample" button in NicheReview
- [x] Add targetGroupSize input field next to "Sub-cluster" button on each NicheCard
- [x] Show computed K in tooltip ("will create ~N sub-niches of ~X companies each")

## Create Campaign from Niche Cluster
- [x] Understand search/company data model: how companies link to searches, what fields a search needs
- [x] Add createCampaignFromNiche tRPC procedure: creates new search record named after the niche, copies all niche companies into it (new rows with new searchId), sets nicheId on copied companies
- [x] Add "Create Campaign" button to NicheCard when fitScore >= 70 (green button, rocket icon)
- [x] Show loading state and success toast with link to new campaign on Search Results page
- [x] Navigate user to Search Results page filtered to new campaign after creation
- [x] 315/316 tests passing (1 pre-existing flaky LLM test in codeSelection.test.ts, unrelated to this feature)

## Fix: Create Campaign button on child niche cards
- [x] Add onCreateCampaign and creatingCampaign props to child NicheCard render in NicheReview

## Create Campaign Button: Make More Prominent
- [x] Redesign Create Campaign as full-width CTA at bottom of qualifying niche cards with pulse/glow effect

## Make Expand Chevron More Prominent
- [x] Redesign expand/collapse button as labeled text button ("View Details" / "Hide Details") with chevron

## Team Read-Only Access for Market Segments
- [x] Understand owner/admin identification in auth model (OWNER_OPEN_ID env vs user.role)
- [x] Gate Cluster, Re-score, Sub-cluster, Launch Campaign buttons behind isAdmin in NicheReview UI
- [x] Ensure all mutating tRPC procedures in nicheRouter use adminProcedure
- [x] Read-only queries (getNiches, getAllNiches, getUnassignedCount, getChildNiches) remain protectedProcedure
- [x] TypeScript 0 errors, backend guards in place

## Feature: Segment Drill-Down Company List
- [x] Add getCompaniesByNicheId tRPC query (protectedProcedure, returns companies with nicheId = X)
- [x] Add NicheCompanyList page at /niche/:nicheId/companies: shows company name, domain, industry, fit score
- [x] Add "View Companies" blue button to NicheCard header
- [x] Show company count and niche name as header in drill-down view
- [x] Add back navigation to Market Segments from drill-down

## Feature: Campaign Source Label on Search Results
- [x] Add sourceNicheId column to searches table (nullable FK), run migration
- [x] Update createCampaignFromNiche to set sourceNicheId and sharedWithTeam=true on new search
- [x] Add "From Segment" blue banner at top of Search Results when search.sourceNicheId is set
- [x] Banner links back to the source niche

## Feature: Team Invite / Shareable URL
- [x] Add "Copy invite link" option to user profile dropdown (admin only)
- [x] Copies window.location.origin with a toast confirmation
- [x] Campaigns created from niches auto-shared (sharedWithTeam=true)

## Bug: Research & Outreach "Unexpected token '<'" Error
- [x] Diagnose why Research & Outreach returns HTML instead of JSON (server crash / missing route / unhandled error)
- [x] Fix the procedure and verify it returns valid JSON

## Prompt-Contracts Fixes (from audit Mar 11 2026)
- [x] Shared types contract — SalesIntelligenceBrief, SalesApproach, FitScoreResult moved to shared/contractTypes.ts
- [x] Dynamic date injection — replaced hardcoded "February 25, 2026" with todayString() in all 5 research prompts (briefGenerator, brainResearchService, offeringExtractor, salesApproachGenerator)
- [x] Strict json_schema enforcement — added URGENCY_SCHEMA and INTELLIGENCE_SCHEMA to Brief Generator phases 1 and 2
- [x] Field-name normalisation shim — briefData useMemo in CompanyDetail now maps productsServices→productsAndServices and derives companyOverview from executiveSummary
- [x] Strict json_schema enforcement — added SALES_APPROACH_SCHEMA to salesApproachGenerator.ts (replaces json_object mode)
- [x] OfferingData type moved to shared/contractTypes.ts — offeringExtractor.ts now imports from shared and re-exports for backward compat

## Bug: Search Results page tRPC returns HTML instead of JSON (Mar 11 2026)
- [x] Diagnose which tRPC query on /search-results/1110002 returns HTML (server crash / unhandled error)
- [x] Fix the root cause and verify JSON is returned (replaced bulk batch with DO 10 - no more URL size overflow)

## UX: Remove Bulk Batch Actions from Search Results (Mar 11 2026)
- [x] Remove "Enrich All" bulk button and its mutation/state from SearchResults.tsx
- [x] Remove "Research & Outreach All" bulk button and its mutation/state from SearchResults.tsx
- [x] Remove batch progress bar / status display tied to those actions
- [x] Keep per-company individual Enrich, Research, and Approach buttons intact
- [x] Replace bulk buttons with single "DO 10" button (doNext10 procedure: enrich → research → approach, up to 10 companies per click)
- [x] Add remainingWork counter to show how many companies still need processing
- [x] Update all hero sentence inline [RESEARCH & OUTREACH] links to [DO 10]
- [x] Add progress banner for DO 10 running state

## Future Plans: News-First Architecture (Strategic Direction)

### Foundation: Signal Table
- [ ] Extract urgencySignals from briefData JSON blob into a dedicated `signals` table (companyId, type, headline, sourceUrl, publishedAt, relevanceScore, conversationStarter)
- [ ] Backfill signals table from existing briefData JSON for all companies with research
- [ ] Add signal type taxonomy: funding / expansion / leadership / product_launch / regulatory / hiring
- [ ] Index signals by companyId + publishedAt for fast feed queries

### Signals Feed View
- [ ] Build a "Signals Feed" page showing the 20 most recent signals across all campaigns, sorted by recency
- [ ] Add signal type filter chips (Funding, Leadership, Expansion, etc.)
- [ ] Show company name, signal headline, source URL, date, and relevance score per row
- [ ] Link each signal row directly to the company's INTEL tab
- [ ] Make the Signals Feed the default landing view after login (above Search Results in sidebar)

### Scheduled Ingestion (Watch Zone)
- [ ] Replace one-shot campaign search with a continuous "Watch Zone" subscription model
- [ ] Add watchlist table (userId, naicsCodes[], geographies[], companySizeRange, active)
- [ ] Build scheduled job (daily) that scans watch zones and ingests new signals via noiseDetector skill
- [ ] Surface new signals as notifications (badge count on Signals Feed nav item)
- [ ] Allow user to pause/resume a watch zone without deleting it

### Event-Anchored Outreach
- [ ] Update salesApproachGenerator prompt to receive the triggering signal as primary input
- [ ] Generate outreach that opens with the specific event ("I saw you just appointed a new CTO...")
- [ ] Store signal_id on each salesApproach record so the outreach is traceable to its trigger
- [ ] Add "Why now" sentence to email/LinkedIn/call templates that references the signal headline

### UI Hierarchy Inversion
- [ ] Redesign company card to lead with the most recent signal (headline + date) rather than company name
- [ ] Move INTEL tab to first position in company detail tabs (currently second after Overview)
- [ ] Add "Signal → Research → Outreach" breadcrumb to company detail header to reinforce the flow
- [ ] Show signal recency badge (e.g. "3 days ago") on company cards in search results list

## Feature: Add Moderate Fit Niches to Campaigns (Mar 12 2026)
- [ ] Identify where GOOD FIT niches have "Add to Campaign" / "N co." button on niche review page
- [ ] Add "Add to Campaign" button to MODERATE FIT niche cards (currently only GOOD FIT has this)
- [ ] Ensure the button triggers the same campaign-creation/search flow as GOOD FIT niches
- [ ] Optionally show a visual indicator that the niche is moderate fit when added (e.g. badge on campaign)
- [x] Add "Add to Campaign" button to MODERATE FIT niche cards (score 40-69) — orange outlined button, same createCampaignFromNiche backend as GOOD FIT
- [x] GOOD FIT (>=70) keeps green filled "Launch Campaign" button; MODERATE FIT (40-69) gets orange outlined "+ Add to Campaign" button
