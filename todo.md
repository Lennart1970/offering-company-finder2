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
