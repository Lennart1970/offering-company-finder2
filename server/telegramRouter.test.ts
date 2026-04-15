import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV module so we can control token/chatId
vi.mock("./_core/env", () => ({
  ENV: {
    telegramBotToken: "test-token",
    telegramChatId: "123456789",
  },
}));

// ─── Unit tests for formatCompanyCard (via the router module) ────────────────

// We test the formatting logic by importing the router and calling the mutation
// with a mocked fetch. This avoids real network calls.

describe("Telegram formatCompanyCard", () => {
  let capturedBody: Record<string, unknown> | null = null;

  beforeEach(() => {
    capturedBody = null;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => "",
    });
  });

  async function callSendTelegram(input: Parameters<typeof import("./telegramRouter")["telegramRouter"]["_def"]["procedures"]["sendCompanyCard"]["_def"]["inputs"][0]["parse"]>[0]) {
    // Re-import to pick up fresh mocks
    const { telegramRouter } = await import("./telegramRouter");
    // Access the underlying mutation handler directly
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({ input, ctx: { user: { id: 1 } } });
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    if (calls.length > 0) {
      capturedBody = JSON.parse(calls[0][1].body as string);
    }
    return capturedBody;
  }

  it("sends to the correct Telegram API URL", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: { companyName: "ACME Corp", domain: "acme.com" },
      ctx: { user: { id: 1 } },
    });
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
  });

  it("includes company name in the message text", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: { companyName: "ACME Corp", domain: "acme.com" },
      ctx: { user: { id: 1 } },
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.text).toContain("ACME Corp");
  });

  it("includes urgency label when provided", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: { companyName: "HighUrgency Inc", urgencyLabel: "HIGH", urgencyScore: 85 },
      ctx: { user: { id: 1 } },
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.text).toContain("HIGH");
    expect(body.text).toContain("85");
  });

  it("includes conversation starter when provided", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: {
        companyName: "Test Co",
        conversationStarter: "Ask about their digital transformation",
      },
      ctx: { user: { id: 1 } },
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.text).toContain("Ask about their digital transformation");
  });

  it("builds full production URL from relative page_url", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: { companyName: "Test Co", pageUrl: "/company/42" },
      ctx: { user: { id: 1 } },
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.text).toContain("leadtrigger-connectgroup.com/company/42");
  });

  it("always rewrites absolute URL to production domain", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: { companyName: "Test Co", pageUrl: "https://example.com/company/99" },
      ctx: { user: { id: 1 } },
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    // Origin is always stripped and replaced with production domain
    expect(body.text).toContain("leadtrigger-connectgroup.com/company/99");
    expect(body.text).not.toContain("https://example.com/company/99");
  });

  it("uses HTML parse_mode", async () => {
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await handler({
      input: { companyName: "Test Co" },
      ctx: { user: { id: 1 } },
    });
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.parse_mode).toBe("HTML");
  });

  it("throws when Telegram API returns ok: false", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ ok: false, description: "Bad Request" }),
    });
    const { telegramRouter } = await import("./telegramRouter");
    const handler = (telegramRouter as any)._def.procedures.sendCompanyCard._def.resolver;
    await expect(
      handler({ input: { companyName: "Test Co" }, ctx: { user: { id: 1 } } })
    ).rejects.toThrow();
  });
});
