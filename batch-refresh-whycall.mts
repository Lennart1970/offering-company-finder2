/**
 * Batch refresh "Why Call Today" statements for all companies
 * in campaigns #1500003 and #1350004 using the v2 rich-context prompt.
 * 
 * Run with: npx tsx batch-refresh-whycall.mts
 */

import { getCompaniesBySearchId, updateCompany, getActiveBrain } from "./server/db";
import { invokeLLM } from "./server/_core/llm";
import { WHY_CALL_TODAY } from "./server/prompts/index";
import dotenv from "dotenv";
dotenv.config();

// Owner user ID — needed for getActiveBrain
const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID || "";

async function refreshWhyCallToday(searchId: number, label: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${label} (searchId: ${searchId})`);
  console.log(`${"=".repeat(70)}`);

  const allCompanies = await getCompaniesBySearchId(searchId);
  const withBrief = allCompanies.filter(c => c.briefData != null);

  console.log(`  Total companies with brief: ${withBrief.length}`);

  // Get the active brain for context
  let brainContext = "";
  let brainId: number | null = null;
  let brainName: string | null = null;
  try {
    const brain = await getActiveBrain(OWNER_OPEN_ID);
    if (brain && brain.status === "completed") {
      brainId = brain.id;
      brainName = brain.brainName;
      const capabilities = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
      const valueProps = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];
      const painPoints = brain.icpPainPoints ? JSON.parse(brain.icpPainPoints) : [];
      brainContext = `
SELLER: ${brain.companyName}
Offering: ${brain.offeringSummary}
Core Capabilities: ${capabilities.join("; ")}
Value Propositions: ${valueProps.map((vp: any) => vp.proposition || vp).join("; ")}
ICP Pain Points: ${painPoints.join("; ")}
`;
      console.log(`  Active brain: ${brain.brainName} (id: ${brain.id})`);
    }
  } catch { /* use defaults */ }

  let done = 0, failed = 0;

  for (const company of withBrief) {
    try {
      // Parse existing data
      let briefData: any = {};
      try { briefData = JSON.parse(company.briefData!); } catch { /* empty */ }

      let approachData: any = {};
      try { if (company.salesApproachData) approachData = JSON.parse(company.salesApproachData); } catch { /* empty */ }

      // Build rich context sections
      const sections: string[] = [];

      // Urgency signals
      const signals = briefData.urgencySignals || briefData.urgency_signals || [];
      if (signals.length > 0) {
        sections.push("TOP URGENCY SIGNALS:");
        signals.slice(0, 5).forEach((s: any, i: number) => {
          sections.push(`  ${i + 1}. [${s.type || s.category || "signal"}] ${s.description || s.snippet || s.title || ""}`);
          if (s.sourceUrl) sections.push(`     Source: ${s.sourceUrl}`);
        });
      }

      // Recent developments
      const devs = briefData.recentDevelopments || briefData.recent_developments || [];
      if (devs.length > 0) {
        sections.push("\nRECENT DEVELOPMENTS:");
        devs.slice(0, 3).forEach((d: any, i: number) => {
          sections.push(`  ${i + 1}. ${d.title || d.headline || ""} (${d.date || "recent"})`);
          if (d.snippet || d.summary) sections.push(`     ${(d.snippet || d.summary).slice(0, 200)}`);
        });
      }

      // Fit score rationale
      if (company.fitScoreData) {
        try {
          const fitData = JSON.parse(company.fitScoreData);
          if (fitData.rationale) sections.push(`\nFIT RATIONALE: ${fitData.rationale}`);
        } catch { /* skip */ }
      }

      // Signal openers
      if (company.signalOpeners) {
        try {
          const openers = JSON.parse(company.signalOpeners);
          if (Array.isArray(openers) && openers.length > 0) {
            sections.push("\nSIGNAL-BASED CONVERSATION OPENERS:");
            openers.slice(0, 3).forEach((o: any, i: number) => {
              sections.push(`  ${i + 1}. ${typeof o === "string" ? o : o.opener || o.text || ""}`);
            });
          }
        } catch { /* skip */ }
      }

      const richContext = sections.join("\n");

      const userPrompt = WHY_CALL_TODAY.userPromptTemplate
        .replace("{{companyName}}", company.name)
        .replace("{{revenue}}", company.estimatedAnnualRevenue || "unknown")
        .replace("{{urgencyScore}}", String(company.urgencyScore ?? "N/A"))
        .replace("{{topHeadlines}}", richContext || "No specific signals available")
        .replace("{{brainContext}}", brainContext);

      const response = await invokeLLM({
        messages: [
          { role: "system", content: WHY_CALL_TODAY.systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const summary = response.choices?.[0]?.message?.content?.trim() || "";
      if (summary) {
        const updates: any = { callReadinessSummary: summary };
        if (brainId) {
          updates.generatedWithBrainId = brainId;
          updates.generatedWithBrainName = brainName;
        }
        await updateCompany(company.id, updates);
        done++;
        process.stdout.write(`\r  progress: ${done}/${withBrief.length} (${failed} failed)`);
      } else {
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (err: any) {
      failed++;
      process.stdout.write(`\r  progress: ${done}/${withBrief.length} (${failed} failed)`);
    }
  }

  console.log(`\n  ✓ Done: ${done}/${withBrief.length} (${failed} failed)`);
  return { done, failed, total: withBrief.length };
}

async function main() {
  console.log("🚀 Batch Why Call Today Refresh — Demo Prep");

  const start = Date.now();

  const r1 = await refreshWhyCallToday(1500003, "[Niche] Diverse Industrial & Manufacturing Solutions");
  const r2 = await refreshWhyCallToday(1350004, "[Niche] AI-Powered Video Surveillance & Analytics");

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  SUMMARY (${elapsed}s total)`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  #1500003: ${r1.done}/${r1.total} ok (${r1.failed} failed)`);
  console.log(`  #1350004: ${r2.done}/${r2.total} ok (${r2.failed} failed)`);
  console.log(`\nDone! 🎉`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
