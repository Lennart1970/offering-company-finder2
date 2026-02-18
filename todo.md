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
