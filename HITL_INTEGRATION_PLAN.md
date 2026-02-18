# HITL Training Integration Plan for ConnectGroup Company Finder

## Executive Summary

Integrate Human-in-the-Loop (HITL) training methodology to continuously improve company relevance scoring and prioritization through ConnectGroup sales team feedback. This creates a sustainable competitive advantage by training the system to match ConnectGroup's specific preferences for target customers.

---

## Current State Analysis

### What the App Does Now
1. **Hardcoded offering** - ConnectGroup EMS solutions with 32 Apollo keyword tags
2. **State-wide search** - Finds companies matching keyword tags in specified state
3. **Two-step enrichment** - Fast bulk search (100 companies) → batch enrichment (addresses, SIC/NAICS)
4. **Sales intelligence packages** - Template-based briefs with engagement strategies

### Key Decision Points (Where HITL Fits)
1. **Company relevance** - Is this company a good fit for ConnectGroup?
2. **Outreach priority** - Which companies should we call first?
3. **Package quality** - Is the sales intelligence brief useful?
4. **Keyword tag effectiveness** - Are we finding the right types of companies?

---

## Recommended HITL Methods

### Method 1: Decision Capture (Primary) ⭐
**Purpose:** Capture real sales team decisions about which companies to pursue

**Implementation:**
- Add "Call Today" / "Park for Later" / "Not Relevant" buttons to each enriched company card
- Collect reason codes for "Not Relevant" (wrong industry, too small, wrong geography, etc.)
- Track which companies get packages generated (implicit interest signal)
- Store user_id to track individual sales rep preferences

**Why this method:**
- Matches real sales workflow ("Would I call this company?")
- Captures actionable decisions with context
- Low cognitive load (3 buttons + optional reason)
- Builds training data for relevance scoring

**Database Schema:**
```sql
CREATE TABLE company_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  search_id INT NOT NULL,
  user_id INT NOT NULL,
  decision ENUM('call_today', 'park', 'not_relevant') NOT NULL,
  reason_code VARCHAR(50), -- 'wrong_industry', 'too_small', 'wrong_geo', 'competitor', 'other'
  reason_notes TEXT,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (search_id) REFERENCES searches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**UI Pattern:**
```
[Company Card with enriched data]
┌─────────────────────────────────────┐
│ Acme Industrial Systems             │
│ Atlanta, GA • 250 employees         │
│ $50M revenue • Industrial           │
│ SIC: 3823 (Process Control)        │
└─────────────────────────────────────┘

[🔥 CALL TODAY]  [⏸️ PARK]  [❌ NOT RELEVANT]

If "Not Relevant" clicked:
┌─────────────────────────────────────┐
│ Why not relevant?                   │
│ ○ Wrong industry vertical           │
│ ○ Company too small                 │
│ ○ Wrong geography                   │
│ ○ Already a customer/competitor     │
│ ○ Other (add note)                  │
└─────────────────────────────────────┘
```

---

### Method 2: Pairwise Comparison (Secondary)
**Purpose:** Train the system on relative priority when multiple companies seem relevant

**Implementation:**
- Add "Review Mode" button that shows two companies side-by-side
- User picks which one they'd call first
- Use Elo rating algorithm to compute priority scores
- Smart pair selection: pick companies with similar revenue/size but different industries

**Why this method:**
- Handles cases where absolute scoring is hard ("both seem good, but which is better?")
- Calibrates when sales reps disagree on priorities
- Builds relative ranking for outreach sequencing

**Database Schema:**
```sql
CREATE TABLE company_comparisons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  winner_id INT NOT NULL,
  loser_id INT NOT NULL,
  user_id INT NOT NULL,
  confidence ENUM('easy', 'hard') DEFAULT 'easy',
  compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (winner_id) REFERENCES companies(id),
  FOREIGN KEY (loser_id) REFERENCES companies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE company_elo_ratings (
  company_id INT PRIMARY KEY,
  elo_rating INT DEFAULT 1500,
  matches_count INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**UI Pattern:**
```
┌──────────────────┐  vs  ┌──────────────────┐
│ Company A        │      │ Company B        │
│ Details...       │      │ Details...       │
│                  │      │                  │
│ [PICK THIS ONE]  │      │ [PICK THIS ONE]  │
└──────────────────┘      └──────────────────┘

[SKIP] [BOTH GOOD] [NEITHER]
```

---

### Method 3: Ground Truth Collection (Long-term)
**Purpose:** Validate predictions by tracking actual sales outcomes

**Implementation:**
- After a company is marked "Call Today", track outcome (meeting booked, deal won, no response, etc.)
- Link back to original Apollo data and keyword tags used
- Build labeled dataset for future model retraining

**Database Schema:**
```sql
CREATE TABLE sales_outcomes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  decision_id INT NOT NULL, -- Links to company_decisions
  outcome ENUM('meeting_booked', 'deal_won', 'deal_lost', 'no_response', 'wrong_contact', 'timing_wrong') NOT NULL,
  outcome_date DATE NOT NULL,
  outcome_notes TEXT,
  revenue_amount DECIMAL(12,2), -- If deal won
  recorded_by INT NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (decision_id) REFERENCES company_decisions(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);
```

**UI Pattern:**
```
[In Search History or CRM integration]
┌─────────────────────────────────────┐
│ Acme Industrial (Called 30 days ago)│
│ Update Outcome:                     │
│ ○ Meeting Booked                    │
│ ○ Deal Won ($_____)                 │
│ ○ Deal Lost                         │
│ ○ No Response                       │
│ ○ Wrong Contact                     │
│ ○ Timing Wrong (revisit later)     │
└─────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Decision Capture (Week 1-2)
**Goal:** Start collecting basic relevance feedback

**Tasks:**
1. Add `company_decisions` table to database schema
2. Create tRPC procedures: `submitDecision`, `getDecisionStats`
3. Add decision buttons to enriched company cards
4. Add reason picker modal for "Not Relevant"
5. Show decision badges on company cards (✓ CALL TODAY, ⏸️ PARKED, ❌ REJECTED)
6. Add "My Decisions" filter to search history

**Success Metrics:**
- Sales team makes 50+ decisions in first week
- At least 20% of enriched companies get decisions
- Reason codes captured for 80%+ of "Not Relevant" decisions

---

### Phase 2: Analytics Dashboard (Week 3)
**Goal:** Surface insights from collected feedback

**Tasks:**
1. Create "Training Analytics" page (admin only)
2. Show decision distribution (call/park/reject ratios)
3. Show most common rejection reasons
4. Show which keyword tags correlate with "Call Today" decisions
5. Show which SIC/NAICS codes get highest acceptance
6. Show per-user decision stats (if multiple sales reps)

**Success Metrics:**
- Identify 3-5 keyword tags that should be removed (high rejection rate)
- Identify 2-3 new keyword tags to add (based on accepted companies' SIC/NAICS)
- Achieve 70%+ inter-rater reliability (if multiple reviewers)

---

### Phase 3: Pairwise Comparison (Week 4-5)
**Goal:** Build relative priority rankings

**Tasks:**
1. Add `company_comparisons` and `company_elo_ratings` tables
2. Create "Review Mode" page with side-by-side comparison
3. Implement Elo rating algorithm (K-factor 32, initial 1500)
4. Add smart pair selection (similar revenue, different industries)
5. Sort company results by Elo rating (highest first)
6. Show Elo rating badge on company cards (🔥 Top 10%, ⭐ Top 25%, etc.)

**Success Metrics:**
- Collect 100+ pairwise comparisons
- Elo ratings stabilize (top companies stay in top 20% after 50 comparisons)
- Sales team reports improved prioritization

---

### Phase 4: Keyword Tag Optimization (Week 6)
**Goal:** Use feedback to improve Apollo search

**Tasks:**
1. Analyze which keyword tags correlate with "Call Today" decisions
2. Remove underperforming tags (high rejection rate, low acceptance)
3. Add new tags based on accepted companies' SIC/NAICS codes
4. A/B test new keyword tag sets (split searches 50/50)
5. Track acceptance rate improvement

**Success Metrics:**
- Increase "Call Today" rate from baseline to 30%+
- Reduce "Not Relevant" rate by 20%
- Maintain or increase total companies found per search

---

### Phase 5: Ground Truth & Model Retraining (Month 2+)
**Goal:** Close the loop with actual sales outcomes

**Tasks:**
1. Add `sales_outcomes` table
2. Create outcome tracking UI (in search history or CRM integration)
3. Build labeled dataset: company features → outcome
4. Train simple ML model (logistic regression or XGBoost) to predict "Call Today" likelihood
5. Add "Predicted Fit Score" to company cards (0-100%)
6. Track model accuracy vs human decisions

**Success Metrics:**
- Collect outcomes for 50+ companies
- Model achieves 75%+ accuracy predicting "Call Today" decisions
- Model identifies patterns humans missed (e.g., specific revenue ranges, geographic clusters)

---

## UI/UX Considerations

### Mobile-First Design
- Large touch targets (min 48px) for decision buttons
- Swipe gestures for pairwise comparison (swipe right = pick left, swipe left = pick right)
- Collapsible company details to reduce cognitive load
- Progressive disclosure (show essentials first, expand for full data)

### Engagement Tactics
- Show progress: "You've reviewed 23 companies this week"
- Show impact: "Your feedback improved search quality by 15%"
- Gamification (if multiple reviewers): leaderboard, streaks, badges
- Push notifications for PWA: "5 new companies ready for review"

### Cognitive Load Reduction
- Use categorical badges (🔥 Hot / ⭐ Good / ○ Maybe) instead of numbers
- Highlight key decision factors (revenue, industry, location) in bold
- Provide suggested actions based on similar companies
- Make "Why" immediately visible (show SIC/NAICS, keyword tags used)

---

## Data Privacy & Ethics

### User Consent
- Add HITL training opt-in during onboarding
- Explain how feedback improves the system
- Allow users to view/delete their training data

### Anonymization
- Aggregate analytics across all users
- Don't expose individual reviewer decisions to others (unless leaderboard opt-in)
- Store only decision metadata, not sensitive company details

### Bias Mitigation
- Randomize company presentation order
- Track and report inter-rater reliability
- Flag cases where reviewers strongly disagree
- Allow "Skip" for uncertain cases

---

## Success Metrics (3-Month Horizon)

### Engagement Metrics
- 80%+ of enriched companies get decisions within 7 days
- Average 20+ decisions per user per week
- 50+ pairwise comparisons per user per month

### Quality Metrics
- "Call Today" rate increases from baseline to 30%+
- "Not Relevant" rate decreases by 20%
- Inter-rater reliability (if multiple reviewers) > 70%

### Business Impact
- Sales team reports 25%+ time savings (less manual filtering)
- Outreach conversion rate improves by 15%+ (better targeting)
- Model accuracy reaches 75%+ predicting "Call Today" decisions

---

## Technical Architecture

### Database Tables
1. `company_decisions` - Decision capture (call/park/reject)
2. `company_comparisons` - Pairwise comparison data
3. `company_elo_ratings` - Elo ratings for priority ranking
4. `sales_outcomes` - Ground truth outcomes
5. `training_sessions` - Session tracking for engagement analytics

### Backend (tRPC Procedures)
1. `submitDecision(companyId, decision, reasonCode, reasonNotes)`
2. `submitComparison(winnerId, loserId, confidence)`
3. `submitOutcome(companyId, outcome, outcomeDate, outcomeNotes)`
4. `getDecisionStats(searchId)` - Analytics for a search
5. `getTrainingAnalytics()` - Admin dashboard data
6. `getNextComparisonPair()` - Smart pair selection for pairwise

### Frontend Pages
1. **Company Cards (Enhanced)** - Add decision buttons, show decision badges
2. **Review Mode** - Side-by-side pairwise comparison
3. **Training Analytics** - Admin dashboard with insights
4. **My Decisions** - User's decision history and stats
5. **Outcome Tracker** - Record sales outcomes

---

## Risk Mitigation

### Risk: Low Engagement
**Mitigation:**
- Keep sessions short (5-10 decisions max)
- Show immediate impact ("Your feedback improved search quality")
- Gamify with progress bars and streaks
- Send push notifications for new companies

### Risk: Inconsistent Feedback
**Mitigation:**
- Track inter-rater reliability
- Flag cases where reviewers disagree
- Provide decision guidelines and examples
- Allow confidence ratings ("easy" vs "hard" decisions)

### Risk: Overfitting to One User
**Mitigation:**
- Aggregate feedback across all sales reps
- Weight decisions by user expertise (track accuracy)
- A/B test model changes before full rollout
- Maintain human override (don't auto-reject companies)

### Risk: Stale Training Data
**Mitigation:**
- Time-decay older decisions (weight recent feedback higher)
- Periodically re-evaluate rejected companies (market changes)
- Track model drift (accuracy degradation over time)
- Retrain monthly with new ground truth data

---

## Next Steps

1. **Review this plan** - Discuss with ConnectGroup team
2. **Prioritize methods** - Start with Decision Capture (highest ROI)
3. **Define success metrics** - What "good" looks like for ConnectGroup
4. **Pilot with 1-2 users** - Test UX before full rollout
5. **Iterate based on feedback** - Adjust UI and workflows

---

## Questions for User

1. **Who will be providing feedback?** (Single user? Sales team? How many people?)
2. **What's the primary goal?** (Better targeting? Faster prioritization? Both?)
3. **Existing workflow?** (Do you use a CRM? How do you track outreach today?)
4. **Tolerance for experimentation?** (Willing to try pairwise comparison? Or start simple with decision capture?)
5. **Timeline?** (Need this ASAP? Or can we phase it over 4-6 weeks?)
