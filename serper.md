# Noise Detector Integration Plan (Serper.dev)

**Status:** Future roadmap — not yet implemented
**Priority:** High — enables cost-efficient deep research gating

---

## What the Noise Detector Does

The noise detector is a two-stage buying-signal pipeline that answers one question per company: *"Is something happening here right now?"* It uses Serper.dev to fetch up to five recent Google News snippets (last 3 months), then passes them to a fast Flash LLM (gpt-4.1-mini or gemini-2.5-flash) for triage. The triage step scores the company 0–10, classifies the signal type from a fixed taxonomy, and generates a ready-to-use conversation starter for sales outreach. The entire pipeline runs in approximately 2–3 seconds per company and costs roughly $0.001 per call on Serper's free tier (2,500 searches/month).

| Output field | Description |
|---|---|
| `noiseScore` | 0–10 integer; score ≥ 3 = "noisy" (buying signal present) |
| `signalType` | One of: expansion, hiring, funding, leadership_change, technology_change, compliance, pain_expressed, partnership, product_launch, none |
| `bestSnippet` | Title + snippet text of the most relevant news item |
| `bestSnippetUrl` | Direct link to the source article |
| `conversationStarter` | Ready-to-use opening line grounded in the news event |

---

## Where It Fits in the Pipeline

The noise detector belongs **between Apollo enrichment and deep research** — as a fast, cheap presence gate that prevents expensive Grok research from running on companies where nothing is currently happening.

```
Import (Excel / Conference / Apollo)
  → Enrich (Apollo domain-based or name-based)
    → Score Fit (Brain ICP match)
      → [NOISE CHECK] ← NEW GATE HERE
          noiseScore < 3 → skip deep research (save cost)
          noiseScore ≥ 3 → proceed
      → Deep Research (Grok — only for noisy + fit companies)
        → Sales Approach (conversation starter pre-populated from noiseConversationStarter)
```

This directly implements the stated workflow preference: **score fit first, check presence second, run deep research only when both conditions are met.**

---

## Strategic Value

For a 400-company Intertraffic campaign, running deep research on every enriched company regardless of activity means ~400 Grok calls. With the noise check as a gate (threshold: noiseScore ≥ 3), only approximately 30–50% of a typical B2B list will pass — cutting deep research cost roughly in half while improving output quality. Briefs that do get generated are for companies where something is actually happening, making the urgency score more meaningful and the sales approach more timely.

The `conversationStarter` output is directly usable in the Sales Approach generator — it provides a concrete, news-grounded opening line rather than a generic one, improving reply rates.

---

## Implementation Plan

### Phase 1 — Schema + Service

Add 8 columns to the `companies` table:

| Column | Type | Purpose |
|---|---|---|
| `noiseScore` | `int` | 0–10 score from triage |
| `noiseDetected` | `boolean` | true if noiseScore ≥ 3 |
| `noiseSignalType` | `varchar(50)` | Signal taxonomy value |
| `noiseSnippet` | `text` | Best snippet title + text |
| `noiseSource` | `varchar(20)` | Source identifier |
| `noiseConversationStarter` | `text` | Ready-to-use opening line |
| `noiseSourceUrl` | `text` | Link to source article |
| `noiseCheckedAt` | `timestamp` | For 7-day TTL cache |

Build `server/noiseDetector.ts` implementing the two-stage pipeline:
1. `POST https://google.serper.dev/news` with `{ q: "${companyName} news", num: 5, tbs: "qdr:m3" }`
2. Flash triage LLM call with the noise_triage prompt (see skill references)
3. Graceful fallback: no snippets → score 0; parse failure → use snippet count as score

Add `SERPER_API_KEY` as a project secret via `webdev_request_secrets`.

### Phase 2 — Batch Endpoint + UI

Add a `batchNoiseCheck` tRPC mutation following the same pattern as `batchGenerateBriefs`:
- Accepts `searchId` + optional `skipCached` (default true, 7-day TTL)
- Processes enriched companies only (name is sufficient — no domain required)
- Runs 5 concurrent calls (Serper is fast and rate-limit-tolerant)

UI changes to Search Results:
- Add amber **[NOISE CHECK ALL — N]** button to the toolbar
- Add `noiseScore` badge to company cards (amber dot with score)
- Add `signalType` label to company cards
- Gate the **[RESEARCH & OUTREACH]** button: show a warning if noise check has not been run yet

### Phase 3 — Conversation Starter Integration

Pass the stored `noiseConversationStarter` into the Sales Approach generator prompt as additional context:

```typescript
// In salesApproachGenerator.ts, inject into the system prompt:
const noiseContext = company.noiseConversationStarter
  ? `\n\nRECENT TRIGGER: ${company.noiseConversationStarter}\nSignal type: ${company.noiseSignalType}`
  : "";
```

This grounds the generated email/LinkedIn/call script in a real, timely event rather than generic ICP language.

---

## Dependencies

| Requirement | Notes |
|---|---|
| `SERPER_API_KEY` | Free tier: 2,500 searches/month. Sign up at serper.dev |
| `OPENAI_API_KEY` or built-in LLM | Flash triage uses the existing `invokeLLM` helper — no new key needed |

---

## Key Constants (from noise-detector skill)

```typescript
NOISE_THRESHOLD = 3   // noiseScore >= 3 → noisy
NOISE_TTL_DAYS  = 7   // Results expire after 7 days
MAX_SNIPPETS    = 5   // Serper returns up to 5 news items
```

---

*Document created: March 2026. Skill reference: `/home/ubuntu/skills/noise-detector/SKILL.md`*
