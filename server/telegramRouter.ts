import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";

/**
 * Send a message to Telegram via the Bot API.
 * v2: routes to LeadTrigger_CG group (-5201172306)
 * Uses HTML formatting for rich cards.
 */
async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = ENV.telegramBotToken;
  const chatId = ENV.telegramChatId;

  if (!token || !chatId) {
    return { ok: false, error: "Telegram credentials not configured" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Telegram] sendMessage failed:", errText);
    return { ok: false, error: errText };
  }

  const json = (await res.json()) as { ok: boolean };
  return { ok: json.ok };
}

/**
 * Format a company intelligence card as an HTML Telegram message.
 */
function formatCompanyCard(params: {
  companyName: string;
  domain?: string | null;
  urgencyScore?: number | null;
  urgencyLabel?: string | null;
  fitScore?: number | null;
  fitLabel?: string | null;
  conversationStarter?: string | null;
  topSignalHeadline?: string | null;
  topSignalType?: string | null;
  pageUrl?: string | null;
  brainName?: string | null;
}): string {
  const {
    companyName,
    domain,
    urgencyScore,
    urgencyLabel,
    fitScore,
    fitLabel,
    conversationStarter,
    topSignalHeadline,
    topSignalType,
    pageUrl,
    brainName,
  } = params;

  const urgencyEmoji = urgencyLabel === "HIGH" ? "🔴" : urgencyLabel === "MEDIUM" ? "🟡" : "🟢";
  const fitEmoji = fitLabel === "Strong Fit" || fitLabel === "HIGH" ? "✅" : fitLabel === "Moderate Fit" || fitLabel === "MEDIUM" ? "⚡" : "➖";

  const lines: string[] = [];

  lines.push(`<b>🏢 ${escapeHtml(companyName)}</b>`);
  if (domain) lines.push(`🌐 <a href="${escapeHtml(domain)}">${escapeHtml(domain)}</a>`);
  if (brainName) lines.push(`🧠 Brain: ${escapeHtml(brainName)}`);

  lines.push("");
  lines.push(`${urgencyEmoji} <b>Urgency:</b> ${urgencyLabel ?? "—"}${urgencyScore != null ? ` (${urgencyScore})` : ""}`);
  lines.push(`${fitEmoji} <b>Fit:</b> ${fitLabel ?? "—"}${fitScore != null ? ` (${fitScore})` : ""}`);

  if (topSignalType && topSignalHeadline) {
    lines.push("");
    lines.push(`📡 <b>Signal [${escapeHtml(topSignalType)}]:</b>`);
    lines.push(escapeHtml(topSignalHeadline));
  }

  if (conversationStarter) {
    lines.push("");
    lines.push(`💬 <b>Conversation starter:</b>`);
    lines.push(escapeHtml(conversationStarter));
  }

  if (pageUrl) {
    const fullUrl = pageUrl.startsWith("http")
      ? pageUrl
      : `https://leadtrigger-connectgroup.com${pageUrl}`;
    lines.push("");
    lines.push(`🔗 <a href="${fullUrl}">View full intelligence →</a>`);
  }

  return lines.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Mark a company page row as sent in Supabase by setting telegram_sent_at.
 * Silently ignores errors (column may not exist yet).
 */
async function markSentInSupabase(companyId: string): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("lt_mns_company_pages") as any)
      .update({ telegram_sent_at: new Date().toISOString() })
      .eq("company_id", companyId);
  } catch (e) {
    console.warn("[Telegram] markSentInSupabase failed (non-fatal):", e);
  }
}

const companyCardInputSchema = z.object({
  companyId: z.string().optional(), // Supabase UUID — used to mark as sent
  companyName: z.string(),
  domain: z.string().nullable().optional(),
  urgencyScore: z.number().nullable().optional(),
  urgencyLabel: z.string().nullable().optional(),
  fitScore: z.number().nullable().optional(),
  fitLabel: z.string().nullable().optional(),
  conversationStarter: z.string().nullable().optional(),
  topSignalHeadline: z.string().nullable().optional(),
  topSignalType: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(),
  brainName: z.string().nullable().optional(),
});

export const telegramRouter = router({
  /**
   * Send a company intelligence card to the configured Telegram chat.
   * Also marks the row in Supabase with telegram_sent_at.
   */
  sendCompanyCard: protectedProcedure
    .input(companyCardInputSchema)
    .mutation(async ({ input }) => {
      const text = formatCompanyCard(input);
      const result = await sendTelegramMessage(text);
      if (!result.ok) {
        throw new Error(result.error ?? "Failed to send Telegram message");
      }
      // Record sent timestamp in Supabase (best-effort)
      if (input.companyId) {
        await markSentInSupabase(input.companyId);
      }
      return { success: true };
    }),

  /**
   * Send all HIGH urgency companies (from lt_mns_company_pages) to Telegram.
   * Respects optional campaignId filter. Rate-limited to 1 msg/sec to avoid Telegram flood limits.
   */
  sendAllHigh: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from("lt_mns_company_pages") as any)
        .select("*")
        .eq("urgency_label", "HIGH")
        .order("urgency_score", { ascending: false })
        .limit(50); // safety cap

      if (input.campaignId) {
        query = query.eq("campaign_id", input.campaignId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const companies = (data ?? []) as Array<{
        company_id: string;
        company_name: string;
        domain: string | null;
        urgency_score: number | null;
        urgency_label: string | null;
        fit_score: number | null;
        fit_label: string | null;
        conversation_starter: string | null;
        top_signal_headline: string | null;
        top_signal_type: string | null;
        page_url: string | null;
        brain_name: string | null;
      }>;

      let sent = 0;
      let failed = 0;

      for (const c of companies) {
        const text = formatCompanyCard({
          companyName: c.company_name,
          domain: c.domain,
          urgencyScore: c.urgency_score,
          urgencyLabel: c.urgency_label,
          fitScore: c.fit_score,
          fitLabel: c.fit_label,
          conversationStarter: c.conversation_starter,
          topSignalHeadline: c.top_signal_headline,
          topSignalType: c.top_signal_type,
          pageUrl: c.page_url,
          brainName: c.brain_name,
        });

        const result = await sendTelegramMessage(text);
        if (result.ok) {
          sent++;
          await markSentInSupabase(c.company_id);
        } else {
          failed++;
          console.error(`[Telegram] Failed to send ${c.company_name}:`, result.error);
        }

        // Rate limit: 1 message per second to avoid Telegram flood limits
        await new Promise((r) => setTimeout(r, 1100));
      }

      return { sent, failed, total: companies.length };
    }),

  /**
   * Send a plain text message to the configured Telegram chat.
   */
  sendMessage: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(4096) }))
    .mutation(async ({ input }) => {
      const result = await sendTelegramMessage(input.text);
      if (!result.ok) {
        throw new Error(result.error ?? "Failed to send Telegram message");
      }
      return { success: true };
    }),
});
