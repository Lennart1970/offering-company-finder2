import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";

/**
 * Send a message to Telegram via the Bot API.
 * Uses MarkdownV2 formatting for rich cards.
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

export const telegramRouter = router({
  /**
   * Send a company intelligence card to the configured Telegram chat.
   */
  sendCompanyCard: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ input }) => {
      const text = formatCompanyCard(input);
      const result = await sendTelegramMessage(text);
      if (!result.ok) {
        throw new Error(result.error ?? "Failed to send Telegram message");
      }
      return { success: true };
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
