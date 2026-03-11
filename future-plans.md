# Future Plans — Offering Company Finder

This file captures ideas, integrations, and features discussed but not yet implemented.

---

## RSS Feed Integration — Medical / MedTech Industry Intelligence

**Context:** Enrich the INTEL tab and Search Results with live industry news from verified medical device RSS feeds.

### Confirmed Live Feeds (tested 2026-03-11)

| Feed | URL | Focus | Best for |
|---|---|---|---|
| MedTech Intelligence | `https://medtechintelligence.com/feed/` | Product launches, regulatory, manufacturing | Deep industry analysis |
| Medical Design & Outsourcing | `https://www.medicaldesignandoutsourcing.com/feed/` | Device design, OEM/contract manufacturing | EMS/manufacturing angle |
| MedTech Dive | `https://www.medtechdive.com/feeds/news/` | Business news, M&A, leadership changes | Urgency signals (hiring, funding) |
| DeviceTalks | `https://www.devicetalks.com/feed/` | Industry interviews, company strategy | Conversation starters |
| Fierce Biotech | `https://www.fiercebiotech.com/rss/xml` | Biotech/medtech crossover | R&D signals |

### Integration Options

**Option A — Per-company INTEL enrichment (high value, more complex)**
1. Scheduled background job fetches and caches all feeds daily
2. Keyword matcher links articles to companies in search results by name / domain / sector
3. New "INDUSTRY NEWS" signal card type appears in the INTEL tab alongside urgency signals
4. Gives sector-level context (e.g. "MDR compliance deadline approaching") + company-specific signals

**Option B — Market Pulse sidebar on Search Results (simpler, ambient)**
1. Fetch latest 5–10 headlines from all feeds on page load
2. Show as a collapsible "Market Pulse" panel on the right side of Search Results
3. No per-company matching needed — ambient industry context while working through the list

**Recommended starting point:** Option B (quick win), then evolve to Option A once keyword matching logic is validated.

---

## Other Future Ideas

### INTEL Tab
- Date stamp on signal cards — relative timestamp ("3 days ago") from source URL date
- Signal category filter bar — pill filters (Growth / Product Launch / R&D / Expansion)
- Full-screen reading mode — expand INTEL tab removing company header chrome
- Auto-trigger product image fetch if neither news nor product images are cached on first visit
- WHY WEBSITE? tooltip on the ⚡ badge explaining the fallback reason

### Company Card Navigation
- Keyboard shortcuts — bind ← / → arrow keys to PREV/NEXT for mouse-free triage
- Decision shortcut in queue mode — "Call Today / Park / Skip" one-click row in the PREV/NEXT bar
- Queue filter — "Researched only" toggle to skip companies without a brief

### Sales Approach
- Progress feedback during generation — status messages ("Searching for recent news… Drafting email…")
- Retry on timeout — auto-retry with lighter model (no web search) if 120s limit is hit
- Generate Approach shortcut on Overview tab green card

### Search Results
- Batch noise detection button — lightweight urgency pre-screening for all companies in a search
- Re-cluster warning dialog — confirmation before overwriting existing niches

### General UX
- Rename RESEARCH tab to DEEP DIVE or PROFILE for consistency with INTEL rename
- Product count badge on image strip header (e.g. "MORE PRODUCTS (5)")
- Lazy-load images in the wider product strip (`loading="lazy"`)
