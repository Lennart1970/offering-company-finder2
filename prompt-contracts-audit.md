# Prompt-Contracts Architectural Audit
## Offering Company Finder — ConnectGroup
**Date:** March 11, 2026 | **Framework:** Prompt-Contracts Skill | **Auditor:** Manus AI

---

## Executive Summary

The offering-company-finder system contains **7 active LLM-calling services** producing structured JSON outputs that flow across **4 distinct consumer layers** (database, tRPC procedures, React UI, downstream prompts). The audit identified **one confirmed contract breach** (the `productsServices` / `productsAndServices` field name mismatch that caused the "no intel" blank screen on the company card), **three high-risk contract gaps**, and **four governance recommendations**. The system has strong prompt engineering discipline in individual files but lacks a shared contract layer — the central structural risk.

---

## Architecture Overview

The system follows a five-stage pipeline. Data enters via Apollo company enrichment, passes through two LLM research phases, is scored and clustered, and finally rendered across multiple UI surfaces. Each stage produces structured JSON that the next stage consumes as a contract.

```
Apollo API → Offering Extractor → Brief Generator (2-phase) → Sales Approach Generator
                                         ↓
                              Niche Fit Scorer ← Clustering Service
                                         ↓
                              tRPC Procedures → React UI (CompanyDetail, SearchResults, NicheReview)
```

The critical observation is that **no shared type definition** governs the handoff between the Brief Generator's output and the UI consumers. Each consumer independently re-derives the expected field names, creating the conditions for silent contract drift.

---

## Prompt Inventory

The table below classifies every LLM-calling service by the prompt-contracts role taxonomy, identifies its output contract, and flags governance gaps.

| Service | File | Role | Output Contract | Schema Enforcement | Risk |
|---|---|---|---|---|---|
| Offering Extractor | `offeringExtractor.ts` | Extraction | `OfferingData` interface | `json_object` (loose) | Medium |
| Brief Generator — Urgency Phase | `briefGenerator.ts` | Evaluation | Inline JSON example | `json_object` (loose) | **High** |
| Brief Generator — Intelligence Phase | `briefGenerator.ts` | Extraction | Inline JSON example | `json_object` (loose) | **High** |
| Brief Generator — Fit Scoring | `briefGenerator.ts` | Evaluation | Inline JSON example | `json_object` (loose) | **High** |
| Sales Approach Generator | `salesApproachGenerator.ts` | Exploration | Inline JSON example | `json_object` (loose) | **High** |
| Niche Fit Scorer | `nicheFitScorer.ts` | Evaluation | `json_schema` (strict) | Enforced at call | Low |
| Clustering Service | `clusteringService.ts` | Extraction | `json_schema` (strict) | Enforced at call | Low |
| Conference Scraper | `conferenceScraper.ts` | Extraction | Inline array example | `json_object` (loose) | Medium |
| Brain Research Service | `brainResearchService.ts` | Extraction | Inline JSON example | `json_object` (loose) | Medium |

**Key finding:** The two services with the highest downstream impact — Brief Generator and Sales Approach Generator — use `json_object` (loose) enforcement, meaning the model can return any valid JSON. The two services with the lowest downstream impact — Niche Fit Scorer and Clustering Service — are the only ones using `json_schema` (strict) enforcement. This is inverted from what governance requires.

---

## Confirmed Contract Breach

### BREACH-001: `productsServices` vs `productsAndServices`

**Severity:** High — caused silent blank rendering on the company card for all researched companies.

The Brief Generator stores `productsServices` in the `SalesIntelligenceBrief` TypeScript interface and in the Grok prompt's example JSON. The UI in `CompanyDetail.tsx` and `SearchResults.tsx` consumed `briefData.productsAndServices`. Because both sides compiled without error (the field access simply returned `undefined`), this breach was invisible until a user noticed the blank screen.

**Root cause:** The `SalesIntelligenceBrief` interface in `briefGenerator.ts` is not imported by any UI file. The UI independently assumed field names, creating two divergent contracts with no compile-time bridge.

**Status:** Mitigated with a normalisation shim in `CompanyDetail.tsx` `briefData` useMemo. Full fix requires moving `SalesIntelligenceBrief` to `shared/types.ts` and importing it in both the generator and all UI consumers.

---

## High-Risk Contract Gaps

### GAP-001: `companyOverview`, `whyNow`, `engagementStrategy` — Fields That Do Not Exist

The UI in `CompanyDetail.tsx` (lines 511, 873, 1072–1083) and `SearchResults.tsx` (lines 854–856) references three fields — `briefData.companyOverview`, `briefData.whyNow`, `briefData.engagementStrategy` — that are **never generated** by the Brief Generator. The generator produces `executiveSummary` (an object) and has no `whyNow` or top-level `engagementStrategy` field.

The `engagementStrategy` field *does* exist in the Sales Approach Generator output (as a nested object with `whyThisProspectMatters`, `recommendedApproach`, `keyTalkingPoints`), but `SearchResults.tsx` line 854 treats it as a plain string, while line 1333 correctly treats it as an object. This is a **dual-interpretation breach** of the same field.

**Remediation:** Define `companyOverview` as a derived field (already done via the normalisation shim for `executiveSummary`). Add `whyNow` to the Brief Generator's urgency prompt output schema. Consolidate `engagementStrategy` access behind a single typed import.

### GAP-002: Hardcoded Date in Prompts

All five research-phase prompts contain the literal string `"Today is February 25, 2026"`. This date is now stale (current date: March 11, 2026) and will become increasingly misleading as the system ages. The model uses this date to anchor recency judgments — a stale anchor degrades urgency signal quality without any visible error.

**Remediation:** Replace all hardcoded dates with `new Date().toISOString().split('T')[0]` injected at call time. This is a one-line fix per file but requires a governance rule to prevent recurrence.

### GAP-003: Sales Approach Generator Reads `productsServices` Directly

`salesApproachGenerator.ts` line 199 reads `briefData.productsServices` (correct field name) directly from the stored brief JSON. This means the Approach Generator has a *different* field name assumption than the UI — it happens to be correct, but only because it was written by the same developer at the same time as the generator. This is accidental alignment, not governed alignment. A future refactor of the brief schema would break either the UI shim or the Approach Generator, depending on which direction the rename goes.

---

## Governance Assessment by Prompt Role

### Extraction Prompts (Offering Extractor, Conference Scraper, Intelligence Phase)

These prompts are well-scoped: they are given a URL or HTML and asked to return structured data. The main gap is the absence of `[WELL-SOURCED]` / `[INDICATIVE]` / `[SPECULATIVE]` confidence tagging on individual fields. When the model cannot find a company's revenue or employee count, it currently returns `"Unknown"` — a string that the UI must handle as a special case. A structured confidence annotation would allow the UI to render uncertainty visually (e.g., greyed-out fields) rather than hiding data.

### Evaluation Prompts (Urgency Phase, Fit Scoring)

The Niche Fit Scorer is the best-governed prompt in the system: it uses `json_schema` strict enforcement, defines dynamic scoring dimensions inferred from the Offering Brain (avoiding hardcoded criteria), and requires weights to sum to exactly 100. The Urgency Phase prompt is the weakest: it uses loose `json_object` enforcement, has no schema validation on the response, and the `urgencyScore` field is parsed with `|| 0` as a silent fallback — meaning a malformed response produces a score of 0 with no error surfaced to the user.

### Exploration Prompts (Sales Approach Generator)

The Sales Approach Generator correctly identifies itself as an exploration task (generating candidates: conversation starters, email drafts, call scripts). However, it does not declare scope boundaries. The prompt does not specify what the model is **forbidden** from doing — for example, it does not prevent the model from fabricating source URLs for conversation starters. The `referencedSources` field in the output schema is not validated against the actual sources returned by the web search tool, creating a hallucination risk in the most user-visible output.

---

## Remediation Roadmap

The following table prioritises fixes by impact and effort.

| Priority | Action | Impact | Effort | Files |
|---|---|---|---|---|
| **P0** | Move `SalesIntelligenceBrief` to `shared/types.ts`, import in all consumers | Prevents future field-name breaches | Low | `briefGenerator.ts`, `shared/types.ts`, `CompanyDetail.tsx`, `SearchResults.tsx`, `salesApproachGenerator.ts` |
| **P0** | Replace hardcoded `"February 25, 2026"` with dynamic date injection | Restores recency accuracy immediately | Low | All 5 research prompts |
| **P1** | Upgrade Brief Generator urgency and intelligence phases to `json_schema` strict | Eliminates silent parse failures | Medium | `briefGenerator.ts` |
| **P1** | Add `whyNow` and `engagementStrategy` to Brief Generator output schema | Closes GAP-001 completely | Medium | `briefGenerator.ts`, `shared/types.ts` |
| **P1** | Add source URL validation in Sales Approach Generator | Reduces hallucination risk in outreach copy | Medium | `salesApproachGenerator.ts` |
| **P2** | Add confidence annotation (`[WELL-SOURCED]` / `[INDICATIVE]` / `[SPECULATIVE]`) to all extraction prompts | Enables uncertainty-aware UI rendering | High | All extraction prompts |
| **P2** | Introduce prompt version tracking in `shared/promptVersions.ts` | Enables lifecycle management and HITL-triggered revision | Medium | New file |
| **P3** | Define HITL feedback categories for urgency signals and fit scores | Enables structured learning loop | High | New HITL review UI |

---

## Structural Recommendation: Shared Contract Layer

The single highest-leverage architectural change is the introduction of a `shared/types.ts` file that exports all inter-layer data contracts as TypeScript interfaces. This file becomes the **single source of truth** for every field name, type, and optionality across the entire pipeline.

```
shared/
  types.ts          ← SalesIntelligenceBrief, SalesApproach, NicheFitResult, OfferingData
  promptVersions.ts ← Prompt lifecycle registry with version, state, lastModified
```

Every LLM-calling service imports its output type from `shared/types.ts`. Every UI consumer imports the same type. TypeScript's compiler then enforces the contract at build time — the `productsServices` / `productsAndServices` breach would have been a compile error, not a silent blank screen.

This is a **low-effort, high-impact** structural change that eliminates the entire class of silent field-name drift failures without changing any business logic.

---

## Appendix: HITL Governance Gaps

The system currently has no structured feedback loop from human review back into prompt improvement. The urgency score HITL review (score editing in the Niche Review page) captures a corrected score but does not capture **why** the human disagreed with the model. Per the prompt-contracts framework, corrections should be tagged by category (Accuracy / Relevance / Completeness / Appropriateness) and routed to a Learning prompt that updates future scoring behavior.

This is the foundation for the three-column HITL score presentation (Grok score / Your score / Learning model score) that has been discussed as a future capability. The prerequisite is structured correction capture — which requires adding a `feedbackCategory` and `feedbackReason` field to the HITL score update mutation.
