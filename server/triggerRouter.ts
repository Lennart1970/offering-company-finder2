/**
 * Trigger Router
 * ──────────────
 * Manages the trigger reference set (synthetic + human-approved triggers)
 * and matches incoming feed items against them for campaign creation.
 */
import { z } from "zod";
import { superAdminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { invokeLLM } from "./_core/llm";

// ─── Supabase client ────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Cosine similarity helper ───────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Embed text helper ──────────────────────────────────────────────────────
async function embedText(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Embedding API failed: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data[0].embedding;
}

export const triggerRouter = router({
  /**
   * Get trigger reference items (synthetic + approved) with optional brain filter
   */
  listTriggerReferences: superAdminProcedure
    .input(
      z.object({
        brainId: z.string().optional(),
        limit: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      const sb = getSupabase();

      let query = sb
        .from("lt_mns_trigger_references")
        .select("*")
        .eq("is_active", true)
        .order("quality_score", { ascending: false })
        .limit(input.limit);

      if (input.brainId) {
        query = query.eq("brain_id", input.brainId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[Trigger] Failed to fetch references:", error.message);
        return [];
      }
      return data ?? [];
    }),

  /**
   * Get recent feed items with their trigger match status.
   * Matches feed items against the trigger reference set using embeddings.
   */
  getMatchedFeedItems: superAdminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        minSimilarity: z.number().min(0).max(1).default(0.50),
        brainFilter: z.string().optional(),
        statusFilter: z.enum(["all", "pending", "approved", "dismissed"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const sb = getSupabase();

      // 1. Call pgvector RPC for fast similarity matching
      const { data: rpcMatches, error: rpcErr } = await sb.rpc(
        "match_feed_items_to_triggers_top3",
        {
          p_min_similarity: input.minSimilarity,
          p_limit: input.limit,
        }
      );

      if (rpcErr || !rpcMatches || rpcMatches.length === 0) {
        console.error("[Trigger] RPC match error:", rpcErr?.message);
        return [];
      }

      // 2. Group matches by feed_item_id
      const matchesByFeedItem = new Map<string, Array<{ triggerRefId: number; similarity: number; rank: number }>>();
      for (const m of rpcMatches) {
        const arr = matchesByFeedItem.get(m.feed_item_id) ?? [];
        arr.push({
          triggerRefId: m.trigger_ref_id,
          similarity: m.similarity_score,
          rank: m.match_rank,
        });
        matchesByFeedItem.set(m.feed_item_id, arr);
      }

      const feedItemIds = Array.from(matchesByFeedItem.keys());
      if (feedItemIds.length === 0) return [];

      // 3. Fetch feed item details
      const { data: feedItems } = await sb
        .from("feed_items")
        .select("id, title, description, link, published_at, raw_content")
        .in("id", feedItemIds);

      const feedMap = new Map<string, any>();
      for (const f of feedItems ?? []) {
        feedMap.set(f.id, f);
      }

      // 4. Fetch trigger reference details (without embeddings)
      const triggerRefIds = Array.from(new Set(rpcMatches.map((m: any) => m.trigger_ref_id)));
      const { data: triggerRefs } = await sb
        .from("lt_mns_trigger_references")
        .select("id, brain_id, brain_name, headline, signal_type, trigger_type, angle_template, a_event, b_challenge, brain_connection")
        .in("id", triggerRefIds);

      const refMap = new Map<number, any>();
      for (const r of triggerRefs ?? []) {
        refMap.set(r.id, r);
      }

      // 5. Fetch existing match statuses
      const { data: existingMatches } = await sb
        .from("lt_mns_trigger_matches")
        .select("feed_item_id, status, approved_brain_id")
        .in("feed_item_id", feedItemIds);

      const matchStatusMap = new Map<string, { status: string; approvedBrainId?: string }>();
      for (const m of existingMatches ?? []) {
        matchStatusMap.set(m.feed_item_id, { status: m.status, approvedBrainId: m.approved_brain_id });
      }

      // 6. Build results
      const results: any[] = [];

      for (const feedItemId of feedItemIds) {
        const item = feedMap.get(feedItemId);
        if (!item) continue;

        const matches = matchesByFeedItem.get(feedItemId) ?? [];
        matches.sort((a, b) => a.rank - b.rank);

        const bestMatch = matches[0];
        if (!bestMatch) continue;

        const bestRef = refMap.get(bestMatch.triggerRefId);

        // Apply brain filter
        if (input.brainFilter && bestRef?.brain_id?.toString() !== input.brainFilter) continue;

        const existingStatus = matchStatusMap.get(feedItemId);
        const status = existingStatus?.status ?? "pending";

        // Apply status filter
        if (input.statusFilter !== "all" && status !== input.statusFilter) continue;

        // Parse raw_content for extra info
        let newsQuery = "";
        let newsDate = "";
        try {
          const raw = typeof item.raw_content === "string" ? JSON.parse(item.raw_content) : item.raw_content;
          newsQuery = raw?.query ?? "";
          newsDate = raw?.item?.date ?? "";
        } catch {}

        results.push({
          feedItemId: item.id,
          title: item.title,
          description: item.description,
          link: item.link,
          source: item.source,
          publishedAt: item.published_at || newsDate,
          newsQuery,
          bestSimilarity: bestMatch.similarity,
          bestTrigger: bestRef ? {
            id: bestRef.id,
            brainId: bestRef.brain_id,
            brainName: bestRef.brain_name,
            headline: bestRef.headline,
            signalType: bestRef.signal_type,
            triggerType: bestRef.trigger_type,
            angleTemplate: bestRef.angle_template,
            aEvent: bestRef.a_event,
            bChallenge: bestRef.b_challenge,
            brainConnection: bestRef.brain_connection,
          } : null,
          top3Triggers: matches.slice(0, 3).map((m) => {
            const ref = refMap.get(m.triggerRefId);
            return {
              similarity: m.similarity,
              brainName: ref?.brain_name ?? "Unknown",
              brainId: ref?.brain_id,
              headline: ref?.headline ?? "",
              triggerType: ref?.trigger_type ?? "",
            };
          }),
          status,
        });
      }

      // Sort by best similarity descending
      results.sort((a, b) => b.bestSimilarity - a.bestSimilarity);

      return results;
    }),

  /**
   * Embed feed items that don't have embeddings yet (batch job)
   */
  embedFeedItems: superAdminProcedure
    .input(z.object({ batchSize: z.number().min(1).max(100).default(50) }))
    .mutation(async ({ input }) => {
      const sb = getSupabase();

      // Find feed items without embeddings
      const { data: feedItems } = await sb
        .from("feed_items")
        .select("id, title, description")
        .eq("feed_id", "25799a81-dfae-4476-a6c7-65974893737e")
        .order("created_at", { ascending: false })
        .limit(input.batchSize * 2);

      if (!feedItems || feedItems.length === 0) return { embedded: 0, skipped: 0 };

      // Check which already have embeddings
      const { data: existingEmbs } = await sb
        .from("lt_mns_feed_item_embeddings")
        .select("feed_item_id")
        .in("feed_item_id", feedItems.map((f: any) => f.id));

      const embeddedIds = new Set((existingEmbs ?? []).map((e: any) => e.feed_item_id));
      const toEmbed = feedItems.filter((f: any) => !embeddedIds.has(f.id)).slice(0, input.batchSize);

      if (toEmbed.length === 0) return { embedded: 0, skipped: feedItems.length };

      let embedded = 0;
      for (const item of toEmbed) {
        const text = `${item.title || ""} ${item.description || ""}`.trim();
        if (!text || text.length < 10) continue;

        try {
          const emb = await embedText(text);
          const { error } = await sb
            .from("lt_mns_feed_item_embeddings")
            .upsert({
              feed_item_id: item.id,
              content_text: text.slice(0, 1000),
              embedding: emb,
            });

          if (!error) embedded++;
        } catch (e: any) {
          console.error(`[Trigger] Failed to embed feed item ${item.id}:`, e.message);
        }
      }

      console.log(`[Trigger] Embedded ${embedded}/${toEmbed.length} feed items`);
      return { embedded, skipped: feedItems.length - toEmbed.length };
    }),

  /**
   * Update trigger match status (approve/dismiss)
   */
  updateMatchStatus: superAdminProcedure
    .input(
      z.object({
        feedItemId: z.string(),
        status: z.enum(["approved", "dismissed"]),
        approvedBrainId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sb = getSupabase();

      const { error } = await sb
        .from("lt_mns_trigger_matches")
        .upsert({
          feed_item_id: input.feedItemId,
          status: input.status,
          approved_brain_id: input.approvedBrainId ?? null,
          notes: input.notes ?? null,
          reviewed_by: ctx.user.name ?? ctx.user.openId,
          reviewed_at: new Date().toISOString(),
        }, { onConflict: "feed_item_id" });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update match status: ${error.message}`,
        });
      }

      return { success: true };
    }),

  /**
   * Get trigger stats (counts by status, by brain)
   */
  getStats: superAdminProcedure.query(async () => {
    const sb = getSupabase();

    const { data: refs } = await sb
      .from("lt_mns_trigger_references")
      .select("brain_name, source_type")
      .eq("is_active", true);

    const { count: feedCountVal } = await sb
      .from("feed_items")
      .select("id", { count: "exact", head: true })
      .eq("feed_id", "25799a81-dfae-4476-a6c7-65974893737e");

    const { count: embCountVal } = await sb
      .from("lt_mns_feed_item_embeddings")
      .select("feed_item_id", { count: "exact", head: true });

    const { data: matches } = await sb
      .from("lt_mns_trigger_matches")
      .select("status");

    const matchStats = { pending: 0, approved: 0, dismissed: 0 };
    for (const m of matches ?? []) {
      if (m.status in matchStats) matchStats[m.status as keyof typeof matchStats]++;
    }

    // Count references by brain
    const brainCounts = new Map<string, number>();
    for (const r of refs ?? []) {
      brainCounts.set(r.brain_name, (brainCounts.get(r.brain_name) ?? 0) + 1);
    }

    return {
      totalReferences: refs?.length ?? 0,
      totalFeedItems: feedCountVal ?? 0,
      embeddedFeedItems: embCountVal ?? 0,
      matchStats,
      referencesByBrain: Array.from(brainCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([brain, count]) => ({ brain, count })),
    };
  }),

  /**
   * Upload synthetic triggers to Supabase as reference set
   */
  uploadSyntheticTriggers: superAdminProcedure
    .input(
      z.object({
        triggers: z.array(
          z.object({
            brainId: z.number(),
            brainName: z.string(),
            headline: z.string(),
            snippet: z.string(),
            triggerType: z.string(),
            signalType: z.string(),
            aEvent: z.string(),
            bChallenge: z.string(),
            brainConnection: z.string(),
            angleTemplate: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const sb = getSupabase();
      let uploaded = 0;

      for (const t of input.triggers) {
        const text = `${t.headline}. ${t.snippet}`;
        try {
          const emb = await embedText(text);

          const { error } = await sb
            .from("lt_mns_trigger_references")
            .insert({
              brain_id: t.brainId,
              brain_name: t.brainName,
              headline: t.headline,
              snippet: t.snippet,
              trigger_type: t.triggerType,
              signal_type: t.signalType,
              a_event: t.aEvent,
              b_challenge: t.bChallenge,
              brain_connection: t.brainConnection,
              angle_template: t.angleTemplate,
              embedding: emb,
              source_type: "synthetic",
              quality_score: 0.7,
              is_active: true,
            });

          if (!error) uploaded++;
        } catch (e: any) {
          console.error(`[Trigger] Failed to upload trigger "${t.headline}":`, e.message);
        }
      }

      console.log(`[Trigger] Uploaded ${uploaded}/${input.triggers.length} synthetic triggers`);
      return { uploaded, total: input.triggers.length };
    }),

  /**
   * Generate synthetic news triggers for a given brain using LLM
   * Reads brain data from Supabase, generates realistic news scenarios,
   * then stores them as trigger references.
   */
  generateSyntheticTriggers: superAdminProcedure
    .input(
      z.object({
        brainId: z.string(), // Supabase brain ID (string)
        count: z.number().min(5).max(50).default(20),
      })
    )
    .mutation(async ({ input }) => {
      const sb = getSupabase();

      // 1. Fetch brain data from Supabase
      const { data: brain, error: brainErr } = await sb
        .from("lt_mns_offering_brains")
        .select("id, brain_name, company_name, offering_summary, core_capabilities, icp_description, icp_pain_points, value_propositions, urgency_triggers, strong_fit_signals, local_brain_id")
        .eq("id", input.brainId)
        .single();

      if (brainErr || !brain) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Brain not found: ${input.brainId}` });
      }

      // 2. Determine numeric brain_id for trigger references
      // Use local_brain_id if available, otherwise use a hash-based synthetic ID
      let numericBrainId: number;
      if (brain.local_brain_id) {
        numericBrainId = Number(brain.local_brain_id);
      } else {
        // Generate a stable synthetic numeric ID from the string ID
        let hash = 900000;
        for (let i = 0; i < brain.id.length; i++) {
          hash = ((hash << 5) - hash) + brain.id.charCodeAt(i);
          hash |= 0;
        }
        numericBrainId = Math.abs(hash) % 99999 + 900000;
      }

      // 3. Build the LLM prompt
      const systemPrompt = `You are a B2B sales intelligence expert. Generate synthetic news trigger references for a sales team.

A "trigger reference" is a realistic news headline + scenario that, when a prospect company experiences it, signals they urgently need the offering described below.

Each trigger must follow this exact JSON structure:
{
  "headline": "Short realistic news headline (max 15 words)",
  "snippet": "1-2 sentence news snippet expanding on the headline",
  "triggerType": "one of: product_launch | funding | expansion | leadership_change | technology_adoption | regulatory | market_shift | pain_point",
  "signalType": "one of: Product Launch | Financial | Expansion | Leadership Change | Technology | Regulatory | Market Shift",
  "aEvent": "The observable trigger event at the prospect company (1 sentence)",
  "bChallenge": "The business challenge this creates for them (1 sentence)",
  "brainConnection": "Why this makes them a hot prospect for the offering (1 sentence)",
  "angleTemplate": "Opening line for a sales email referencing this trigger (1 sentence)"
}

Return ONLY a JSON array of ${input.count} trigger objects. No markdown, no explanation.`;

      const userPrompt = `OFFERING: ${brain.offering_summary || brain.company_name}
CORE CAPABILITIES: ${brain.core_capabilities || ""}
ICP: ${brain.icp_description || ""}
ICP PAIN POINTS: ${brain.icp_pain_points || ""}
URGENCY TRIGGERS: ${brain.urgency_triggers || ""}
STRONG FIT SIGNALS: ${brain.strong_fit_signals || ""}

Generate ${input.count} diverse, realistic synthetic trigger references. Cover different signal types and industries within the ICP.`;

      // 4. Call LLM
      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawMsg = llmResponse?.choices?.[0]?.message?.content;
      const rawContent: string = typeof rawMsg === "string" ? rawMsg : "[]";
      // The LLM might return {triggers: [...]} or just [...]
      let triggers: any[];
      try {
        const parsed = JSON.parse(rawContent);
        triggers = Array.isArray(parsed) ? parsed : (parsed.triggers ?? parsed.data ?? []);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned invalid JSON" });
      }

      // 5. Store each trigger with embedding
      let uploaded = 0;
      for (const t of triggers) {
        const text = `${t.headline}. ${t.snippet}`;
        try {
          const emb = await embedText(text);
          const { error } = await sb
            .from("lt_mns_trigger_references")
            .insert({
              brain_id: numericBrainId,
              brain_name: brain.brain_name,
              headline: t.headline,
              snippet: t.snippet,
              trigger_type: t.triggerType ?? "market_shift",
              signal_type: t.signalType ?? "Market Shift",
              a_event: t.aEvent ?? "",
              b_challenge: t.bChallenge ?? "",
              brain_connection: t.brainConnection ?? "",
              angle_template: t.angleTemplate ?? "",
              embedding: emb,
              source_type: "synthetic",
              quality_score: 0.75,
              is_active: true,
            });
          if (!error) uploaded++;
          else console.error(`[GenerateTriggers] Insert error:`, error.message);
        } catch (e: any) {
          console.error(`[GenerateTriggers] Failed for "${t.headline}":`, e.message);
        }
      }

      console.log(`[GenerateTriggers] Stored ${uploaded}/${triggers.length} triggers for brain "${brain.brain_name}"`);
      return { count: uploaded, total: triggers.length, brainName: brain.brain_name };
    }),
});
