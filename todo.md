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
- [ ] Create final standalone checkpoint
