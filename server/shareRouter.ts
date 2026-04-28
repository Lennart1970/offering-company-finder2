import { z } from "zod";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  shareTokens,
  shareLists,
  shareListItems,
  companies,
  offeringBrain,
  companyBrainOutputs,
  contacts,
} from "../drizzle/schema";

/** Generate a cryptographically random 32-char hex token */
function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export const shareRouter = router({
  /**
   * Create share tokens for a list of (companyId, brainId) pairs.
   * Returns the generated tokens. Protected — only logged-in users.
   */
  createShareList: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            companyId: z.number(),
            brainId: z.number(),
          })
        ),
        shareListName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;
      const results: Array<{ companyId: number; brainId: number; token: string }> = [];

      for (const item of input.items) {
        // Reuse existing token for same company+brain+user
        const existing = await db
          .select()
          .from(shareTokens)
          .where(
            and(
              eq(shareTokens.companyId, item.companyId),
              eq(shareTokens.brainId, item.brainId),
              eq(shareTokens.createdBy, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          results.push({ companyId: item.companyId, brainId: item.brainId, token: existing[0].token });
        } else {
          const token = generateToken();
          await db.insert(shareTokens).values({
            token,
            companyId: item.companyId,
            brainId: item.brainId,
            createdBy: userId,
            shareListName: input.shareListName ?? null,
          });
          results.push({ companyId: item.companyId, brainId: item.brainId, token });
        }
      }

      return results;
    }),

  /**
   * Public endpoint — resolves a share token and returns all data needed
   * to render the read-only company+brain page. No authentication required.
   */
  resolveToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const tokenRows = await db
        .select()
        .from(shareTokens)
        .where(eq(shareTokens.token, input.token))
        .limit(1);

      if (tokenRows.length === 0) throw new Error("Invalid or expired share link");
      const tokenRow = tokenRows[0];

      const companyRows = await db
        .select()
        .from(companies)
        .where(eq(companies.id, tokenRow.companyId))
        .limit(1);
      if (companyRows.length === 0) throw new Error("Company not found");
      const company = companyRows[0];

      const brainRows = await db
        .select()
        .from(offeringBrain)
        .where(eq(offeringBrain.id, tokenRow.brainId))
        .limit(1);
      const brain = brainRows[0] ?? null;

      const brainOutputRows = await db
        .select()
        .from(companyBrainOutputs)
        .where(
          and(
            eq(companyBrainOutputs.companyId, tokenRow.companyId),
            eq(companyBrainOutputs.brainId, tokenRow.brainId)
          )
        )
        .limit(1);
      const brainOutput = brainOutputRows[0] ?? null;

      const contactRows = await db
        .select()
        .from(contacts)
        .where(eq(contacts.companyId, tokenRow.companyId));

      // Fetch 2 company images via Serper image search
      let companyImages: string[] = [];
      try {
        const serperKey = process.env.SERPER_API_KEY;
        if (serperKey && company.name) {
          const searchQuery = `${company.name} company office headquarters`;
          const serperRes = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q: searchQuery, num: 5 }),
          });
          if (serperRes.ok) {
            const serperData = await serperRes.json() as { images?: Array<{ imageUrl?: string; thumbnailUrl?: string }> };
            const images = serperData.images ?? [];
            companyImages = images
              .map((img) => img.imageUrl ?? img.thumbnailUrl ?? "")
              .filter((url) => url && url.startsWith("http"))
              .slice(0, 2);
          }
        }
      } catch {
        // Image fetch is best-effort — never fail the page load
      }

      return {
        company,
        brain,
        brainOutput,
        contacts: contactRows,
        shareListName: tokenRow.shareListName,
        companyImages,
      };
    }),

  /**
   * Get export data for a share list — returns all columns for Excel export.
   * Protected — only logged-in users.
   */
  getShareListExport: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            companyId: z.number(),
            brainId: z.number(),
            token: z.string(),
          })
        ),
        baseUrl: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const rows: Array<{
        companyName: string;
        website: string;
        country: string;
        employeeCount: string;
        sector: string;
        brainName: string;
        fitScore: number | null;
        urgencyScore: number | null;
        keySignal: string;
        contactName: string;
        shareLink: string;
      }> = [];

      for (const item of input.items) {
        const companyRows = await db
          .select()
          .from(companies)
          .where(eq(companies.id, item.companyId))
          .limit(1);
        const company = companyRows[0];
        if (!company) continue;

        const brainRows = await db
          .select()
          .from(offeringBrain)
          .where(eq(offeringBrain.id, item.brainId))
          .limit(1);
        const brain = brainRows[0] ?? null;

        const brainOutputRows = await db
          .select()
          .from(companyBrainOutputs)
          .where(
            and(
              eq(companyBrainOutputs.companyId, item.companyId),
              eq(companyBrainOutputs.brainId, item.brainId)
            )
          )
          .limit(1);
        const brainOutput = brainOutputRows[0] ?? null;

        const contactRows = await db
          .select()
          .from(contacts)
          .where(eq(contacts.companyId, item.companyId))
          .limit(1);
        const firstContact = contactRows[0] ?? null;

        // Extract key signal
        let keySignal = "";
        const briefStr = brainOutput?.briefData ?? company.briefData;
        if (briefStr) {
          try {
            const brief = JSON.parse(briefStr);
            keySignal =
              brief?.urgencySignals?.[0]?.signal ??
              brief?.signals?.[0]?.signal ??
              brief?.keySignal ??
              "";
          } catch {}
        }

        // Employee count
        const empCount = (company as any).employeeCount ?? (company as any).headcount ?? "";

        // Sector from sliceMetadata
        let sector = "";
        if (company.sliceMetadata) {
          try {
            const meta = JSON.parse(company.sliceMetadata);
            sector = meta?.industry ?? "";
          } catch {}
        }

        rows.push({
          companyName: company.name,
          website: company.websiteUrl ?? "",
          country: company.country ?? "",
          employeeCount: String(empCount),
          sector,
          brainName: brain?.brainName ?? "",
          fitScore: brainOutput?.fitScore ?? company.fitScore ?? null,
          urgencyScore: brainOutput?.urgencyScore ?? company.urgencyScore ?? null,
          keySignal,
          contactName: firstContact?.fullName ?? "",
          shareLink: `${input.baseUrl}/share/${item.token}`,
        });
      }

      return rows;
    }),

  /**
   * Create a list-level share token that groups all company tokens.
   * Returns a single listToken URL for the public overview page.
   */
  createShareListWithToken: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            companyId: z.number(),
            brainId: z.number(),
          })
        ),
        shareListName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const userId = ctx.user.id;

      // 1. Upsert individual company tokens
      const tokenResults: Array<{ companyId: number; brainId: number; token: string; tokenId: number }> = [];
      for (const item of input.items) {
        const existing = await db
          .select()
          .from(shareTokens)
          .where(and(eq(shareTokens.companyId, item.companyId), eq(shareTokens.brainId, item.brainId), eq(shareTokens.createdBy, userId)))
          .limit(1);
        if (existing.length > 0) {
          tokenResults.push({ companyId: item.companyId, brainId: item.brainId, token: existing[0].token, tokenId: existing[0].id });
        } else {
          const token = generateToken();
          await db.insert(shareTokens).values({ token, companyId: item.companyId, brainId: item.brainId, createdBy: userId, shareListName: input.shareListName ?? null });
          const inserted = await db.select().from(shareTokens).where(eq(shareTokens.token, token)).limit(1);
          tokenResults.push({ companyId: item.companyId, brainId: item.brainId, token, tokenId: inserted[0].id });
        }
      }

      // 2. Create the list-level token
      const listToken = generateToken();
      await db.insert(shareLists).values({ listToken, shareListName: input.shareListName ?? null, createdBy: userId });
      const listRows = await db.select().from(shareLists).where(eq(shareLists.listToken, listToken)).limit(1);
      const shareListId = listRows[0].id;

      // 3. Link tokens to the list
      for (const t of tokenResults) {
        await db.insert(shareListItems).values({ shareListId, shareTokenId: t.tokenId });
      }

      return { listToken, tokens: tokenResults };
    }),

  /**
   * Public endpoint — resolves a list token and returns all companies with their data.
   */
  resolveListToken: publicProcedure
    .input(z.object({ listToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const listRows = await db.select().from(shareLists).where(eq(shareLists.listToken, input.listToken)).limit(1);
      if (listRows.length === 0) throw new Error("Invalid or expired share list link");
      const shareList = listRows[0];

      // Get all items in this list
      const items = await db
        .select()
        .from(shareListItems)
        .where(eq(shareListItems.shareListId, shareList.id));

      const companyRows: Array<{
        companyId: number;
        brainId: number;
        token: string;
        companyName: string;
        website: string;
        country: string;
        city: string;
        employeeCount: string;
        sector: string;
        brainName: string;
        fitScore: number | null;
        urgencyScore: number | null;
        keySignal: string;
        contactName: string;
        contactTitle: string;
        contactEmail: string;
      }> = [];

      for (const item of items) {
        const tokenRows = await db.select().from(shareTokens).where(eq(shareTokens.id, item.shareTokenId)).limit(1);
        if (tokenRows.length === 0) continue;
        const tokenRow = tokenRows[0];

        const companyData = await db.select().from(companies).where(eq(companies.id, tokenRow.companyId)).limit(1);
        if (companyData.length === 0) continue;
        const company = companyData[0];

        const brainData = await db.select().from(offeringBrain).where(eq(offeringBrain.id, tokenRow.brainId)).limit(1);
        const brain = brainData[0] ?? null;

        const outputData = await db.select().from(companyBrainOutputs).where(and(eq(companyBrainOutputs.companyId, tokenRow.companyId), eq(companyBrainOutputs.brainId, tokenRow.brainId))).limit(1);
        const brainOutput = outputData[0] ?? null;

        const contactData = await db.select().from(contacts).where(eq(contacts.companyId, tokenRow.companyId)).limit(1);
        const firstContact = contactData[0] ?? null;

        let keySignal = "";
        const briefStr = brainOutput?.briefData ?? company.briefData;
        if (briefStr) {
          try {
            const brief = JSON.parse(briefStr);
            keySignal = brief?.urgencySignals?.[0]?.signal ?? brief?.signals?.[0]?.signal ?? brief?.keySignal ?? "";
          } catch {}
        }

        let sector = "";
        if (company.sliceMetadata) {
          try { const meta = JSON.parse(company.sliceMetadata); sector = meta?.industry ?? ""; } catch {}
        }

        const empCount = (company as any).employeeCount ?? (company as any).headcount ?? "";

        companyRows.push({
          companyId: tokenRow.companyId,
          brainId: tokenRow.brainId,
          token: tokenRow.token,
          companyName: company.name,
          website: company.websiteUrl ?? "",
          country: company.country ?? "",
          city: (company as any).city ?? "",
          employeeCount: String(empCount),
          sector,
          brainName: brain?.brainName ?? "",
          fitScore: brainOutput?.fitScore ?? company.fitScore ?? null,
          urgencyScore: brainOutput?.urgencyScore ?? company.urgencyScore ?? null,
          keySignal,
          contactName: firstContact?.fullName ?? "",
          contactTitle: firstContact?.title ?? "",
          contactEmail: firstContact?.email ?? "",
        });
      }

      return {
        shareListName: shareList.shareListName,
        createdAt: shareList.createdAt,
        companies: companyRows,
      };
    }),
});
