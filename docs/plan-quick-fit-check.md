# Plan: On-the-Fly Brain Fit Check with Conversation Starter

## What & Why

Users want to quickly test how well any offering brain fits a specific prospect company — without running a full deep research pipeline. The fit score is derived from **cosine similarity** between embeddings stored in Supabase (`lt_mns_offering_brains.embedding` and `lt_mns_companies.embedding`). A conversation starter is generated on top using existing `briefData` signals if available (fast, no web search), falling back to a live Grok web search if no brief exists yet.

**UX flow:**
Each company row/card gets a `⚡ FIT CHECK` icon button → click opens a mini modal → pick a brain → hit "Check Fit" → see fit score bar + conversation starter + copy button.

---

## Files to Change

| File | What changes |
|---|---|
| `server/companyFinder.ts` | Add `quickFitCheck` tRPC mutation |
| `client/src/pages/SearchResults.tsx` | Add icon button to `CompanyListRow` + `CompanyCard`, add `QuickFitModal` component, wire state in main component |

**No new files needed.**

---

## Existing Functions to Reuse

| Function | File | Used for |
|---|---|---|
| `getOfferingBrainById(brainId, userId)` | `server/db.ts:544` | Fetch brain from local DB |
| `getCompanyById(companyId)` | `server/db.ts` | Fetch company from local DB |
| `invokeLLM()` | `server/_core/llm.ts` | Generate starter when briefData exists (fast path) |
| Supabase dynamic import pattern | `server/telegramRouter.ts:120` | Create Supabase client inline |
| `getBrainHistory` tRPC query | `server/companyFinder.ts` | Populate brain selector dropdown |
| `Send` lucide icon (already imported) | `client/src/pages/SearchResults.tsx:12` | Existing import line — add `Zap` here |

---

## Step 1 — Backend: `server/companyFinder.ts`

Add a new `quickFitCheck` procedure inside `companyFinderRouter`:

```
Input:  { companyId: number, brainId: number }
Output: { fitScore: number | null, conversationStarter: string, sourceUrl?: string, method: "brief" | "websearch" }
```

**Logic:**

1. Fetch brain (`getOfferingBrainById`) and company (`getCompanyById`) from local DB in parallel.
2. Fetch both embeddings from Supabase in parallel:
   - `lt_mns_offering_brains` WHERE `local_brain_id = brainId` → `.embedding`
   - `lt_mns_companies` WHERE `local_id = companyId` → `.embedding`
3. Compute cosine similarity inline (4-line function — not worth importing from `clusteringService.ts` since it's not exported):
   ```
   dot(a,b) / (|a| * |b|)  →  normalize from [-1,1] to [0,100]
   ```
   If either embedding is missing → `fitScore: null` (graceful degradation).
4. Generate conversation starter:
   - **If `company.briefData` exists** → extract top 3 urgency signal descriptions → call `invokeLLM()` with brain summary + signals → 2-3 sentence starter. Fast, no web search. Tag as `method: "brief"`.
   - **If no `briefData`** → call Grok Responses API (`/v1/responses`) with `web_search` tool, same pattern as `briefGenerator.ts`. Prompt: find one recent signal about the company, write a conversation starter using the brain context. Tag as `method: "websearch"`.
5. Return result.

**Helper function** `callGrokQuickStarter(companyName, websiteUrl, brain)` added at bottom of file — reuses the same `fetch` + `XAI_API_KEY` + `web_search` tool pattern as `briefGenerator.ts`.

---

## Step 2 — Frontend: `client/src/pages/SearchResults.tsx`

### 2a. State in main `SearchResults` component
```typescript
const [quickFitCompany, setQuickFitCompany] = useState<{ id: number; name: string } | null>(null);
```

### 2b. Props on `CompanyListRow` and `CompanyCard`
Add `onQuickFitCheck: (companyId: number, companyName: string) => void` prop to both component signatures. Pass `setQuickFitCompany` down from the parent.

### 2c. Icon button in `CompanyListRow`
Add a `Zap` icon button between the Telegram icon and the `→` arrow:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); onQuickFitCheck(company.id, company.name); }}
  title="Quick fit check"
  className="shrink-0 p-1 text-gray-300 hover:text-amber-500 transition-colors"
>
  <Zap className="w-3.5 h-3.5" />
</button>
```

### 2d. Button in `CompanyCard`
Third button in the right-side stack (below TELEGRAM):
```tsx
<button onClick={(e) => { e.stopPropagation(); onQuickFitCheck(company.id, company.name); }}
  className="flex items-center gap-1.5 border border-amber-400 text-amber-600
             hover:bg-amber-500 hover:text-white ... min-w-[90px] justify-center">
  <Zap className="w-3 h-3" />
  FIT CHECK
</button>
```

### 2e. `QuickFitModal` component (add at bottom of SearchResults.tsx)

```
Props: { company: { id: number; name: string }, onClose: () => void }

Internal state:
  selectedBrainId: number | null

Queries/mutations:
  trpc.companyFinder.getBrainHistory.useQuery()   ← brain dropdown
  trpc.companyFinder.quickFitCheck.useMutation()  ← main action

UI sections:
  1. Header: "Quick Fit Check / {company.name}"  + × close button
  2. Brain selector: scrollable list of radio-style buttons (brainName or companyName)
  3. "CHECK FIT" button (disabled until brain selected or while pending)
  4. Results (shown after mutation resolves):
     a. Fit score bar — color coded: red ≥70, amber ≥50, gray <50
        "No embedding available" message if fitScore is null
     b. Conversation starter text block
        "(from stored brief)" or "(live search)" label
        COPY button
  5. Backdrop click closes modal
```

### 2f. Render modal in SearchResults JSX (near bottom, before closing `</div>`)
```tsx
{quickFitCompany && (
  <QuickFitModal
    company={quickFitCompany}
    onClose={() => setQuickFitCompany(null)}
  />
)}
```

### 2g. Import addition (line 12)
Change:
```typescript
import { Send } from "lucide-react";
```
To:
```typescript
import { Send, Zap } from "lucide-react";
```

---

## Environment Variables Required (already used elsewhere)
```
SUPABASE_URL               — already set (used by telegramRouter, supabaseSync)
SUPABASE_SERVICE_ROLE_KEY  — already set
XAI_API_KEY                — already set (used by briefGenerator, salesApproachGenerator)
```

No new environment variables needed.

---

## Verification Steps

1. `npm run dev` — confirm TypeScript compiles without errors.
2. Open Search Results for any search that has companies.
3. In **list view**: click the `⚡` Zap icon on a company row → modal opens.
4. In **card view**: click "FIT CHECK" button → same modal opens.
5. Brain selector shows all brains from history.
6. Select a brain → click "CHECK FIT".
7. Confirm:
   - Fit score bar renders with correct colour (or graceful "no embedding" message if Supabase record missing).
   - Conversation starter text renders.
   - Label shows "(from stored brief)" for companies with `briefData`, "(live search)" for those without.
   - COPY button copies starter to clipboard.
   - Modal closes on `×` click or backdrop click.
8. Check server logs for any Supabase or LLM errors.
