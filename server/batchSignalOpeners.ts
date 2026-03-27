/**
 * Batch pre-generate per-signal openers for all companies in campaigns 1500002 & 1500003.
 * This replaces the on-the-fly LLM calls in CompanyDetail.tsx with pre-cached openers.
 *
 * Triggered via: POST /api/batch-signal-openers
 */
import { getDb } from "./db";
import { companies } from "../drizzle/schema";
import { eq, inArray, isNull, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

interface SignalOpener {
  signalIndex: number;
  category: string;
  description: string;
  opener: string;
}

// Track progress globally so the /api/batch-signal-openers/progress endpoint can report it
export const batchSignalProgress = {
  running: false,
  phase: "idle",
  totalCompanies: 0,
  processedCompanies: 0,
  totalSignals: 0,
  generatedOpeners: 0,
  errors: 0,
};

async function generateOpener(
  companyName: string,
  signal: { category: string; type?: string; description: string; snippet?: string; sourceUrl?: string },
  brainContext: string,
  sellerName: string
): Promise<string> {
  const prompt = `${brainContext}
You are crafting ONE sharp, specific B2B conversation opener for a sales rep at ${sellerName}.

TARGET COMPANY: ${companyName}

URGENCY SIGNAL:
- Category: ${signal.category}${signal.type ? ` / ${signal.type}` : ""}
- What happened: ${signal.description}
${signal.snippet ? `- Quote: "${signal.snippet}"` : ""}
${signal.sourceUrl ? `- Source: ${signal.sourceUrl}` : ""}

INSTRUCTIONS:
1. Write exactly ONE conversation opener (2-3 sentences max)
2. Reference the specific signal above — do NOT be generic
3. Connect the signal to a concrete pain point or opportunity ${sellerName} can address
4. End with a soft, open question
5. Tone: peer-to-peer, not salesy

Return ONLY the opener text. No labels, no JSON, no preamble.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a precise B2B sales writing assistant. Return only the requested text, nothing else." },
      { role: "user", content: prompt },
    ],
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  return (typeof rawContent === "string" ? rawContent : "").trim();
}

export async function runBatchSignalOpeners() {
  if (batchSignalProgress.running) {
    console.log("[BatchSignalOpeners] Already running, skipping.");
    return;
  }

  batchSignalProgress.running = true;
  batchSignalProgress.phase = "loading";
  batchSignalProgress.errors = 0;

  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Load Offering Brain context once
    const { offeringBrain } = await import("../drizzle/schema");
    const brains = await db
      .select()
      .from(offeringBrain)
      .where(eq(offeringBrain.status, "completed"))
      .limit(1);

    let brainContext = "";
    let sellerName = "ConnectGroup";
    if (brains.length > 0) {
      const brain = brains[0];
      sellerName = brain.companyName || sellerName;
      const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
      const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
      const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
      brainContext = `
YOU ARE A SALES REP FOR: ${brain.companyName}
Offering Summary: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp: any) => `${vp.proposition} (for: ${vp.targetAudience})`).join("; ")}
Pain Points We Solve: ${painPoints.join("; ")}
`;
    }

    // Get all companies that need signal openers
    const allCompanies = await db
      .select({
        id: companies.id,
        name: companies.name,
        briefData: companies.briefData,
        signalOpeners: companies.signalOpeners,
        searchId: companies.searchId,
      })
      .from(companies)
      .where(
        sql`${companies.searchId} IN (1500002, 1500003) AND ${companies.briefData} IS NOT NULL AND ${companies.signalOpeners} IS NULL`
      );

    batchSignalProgress.totalCompanies = allCompanies.length;
    batchSignalProgress.processedCompanies = 0;
    batchSignalProgress.phase = "generating";

    // Count total signals
    let totalSignals = 0;
    for (const c of allCompanies) {
      try {
        const brief = JSON.parse(c.briefData!);
        totalSignals += (brief.urgencySignals || []).length;
      } catch { /* skip */ }
    }
    batchSignalProgress.totalSignals = totalSignals;
    batchSignalProgress.generatedOpeners = 0;

    console.log(`[BatchSignalOpeners] Starting: ${allCompanies.length} companies, ~${totalSignals} signals`);

    // Process 5 companies in parallel
    const CONCURRENCY = 5;
    for (let i = 0; i < allCompanies.length; i += CONCURRENCY) {
      const batch = allCompanies.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (company) => {
        try {
          const brief = JSON.parse(company.briefData!);
          const signals = brief.urgencySignals || [];

          if (signals.length === 0) {
            // No signals, save empty array
            await db.update(companies).set({
              signalOpeners: JSON.stringify([]),
              signalOpenersGeneratedAt: new Date(),
            }).where(eq(companies.id, company.id));
            batchSignalProgress.processedCompanies++;
            return;
          }

          const openers: SignalOpener[] = [];

          // Generate opener for each signal sequentially (to avoid rate limits)
          for (let si = 0; si < signals.length; si++) {
            const signal = signals[si];
            try {
              const opener = await generateOpener(
                company.name,
                {
                  category: signal.category || signal.type || "",
                  type: signal.type,
                  description: signal.description || signal.headline || "",
                  snippet: signal.snippet,
                  sourceUrl: signal.sourceUrl,
                },
                brainContext,
                sellerName
              );
              openers.push({
                signalIndex: si,
                category: signal.category || signal.type || "",
                description: signal.description || signal.headline || "",
                opener,
              });
              batchSignalProgress.generatedOpeners++;
            } catch (err: any) {
              console.error(`[BatchSignalOpeners] Error for ${company.name} signal ${si}: ${err.message}`);
              batchSignalProgress.errors++;
              // Still push a fallback
              openers.push({
                signalIndex: si,
                category: signal.category || "",
                description: signal.description || "",
                opener: "",
              });
            }
          }

          // Save to DB
          await db.update(companies).set({
            signalOpeners: JSON.stringify(openers),
            signalOpenersGeneratedAt: new Date(),
          }).where(eq(companies.id, company.id));

          batchSignalProgress.processedCompanies++;
          console.log(`[BatchSignalOpeners] ✓ ${company.name} (${openers.length} openers) [${batchSignalProgress.processedCompanies}/${batchSignalProgress.totalCompanies}]`);
        } catch (err: any) {
          console.error(`[BatchSignalOpeners] Failed for ${company.name}: ${err.message}`);
          batchSignalProgress.errors++;
          batchSignalProgress.processedCompanies++;
        }
      }));
    }

    batchSignalProgress.phase = "done";
    console.log(`[BatchSignalOpeners] ✅ Complete: ${batchSignalProgress.generatedOpeners} openers for ${batchSignalProgress.processedCompanies} companies (${batchSignalProgress.errors} errors)`);
  } catch (err: any) {
    console.error(`[BatchSignalOpeners] Fatal error: ${err.message}`);
    batchSignalProgress.phase = "error";
  } finally {
    batchSignalProgress.running = false;
  }
}
