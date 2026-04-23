/**
 * Sales Materials Router
 *
 * Admin can upload presentations / PDFs / files to S3.
 * All authenticated users can list and download them.
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const salesMaterialsRouter = router({
  /**
   * List all sales materials (all authenticated users).
   */
  list: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { materials: [] };
    const { salesMaterials, users } = await import("../drizzle/schema");
    const { asc } = await import("drizzle-orm");
    const rows = await db
      .select({
        id: salesMaterials.id,
        title: salesMaterials.title,
        description: salesMaterials.description,
        fileName: salesMaterials.fileName,
        fileUrl: salesMaterials.fileUrl,
        fileSize: salesMaterials.fileSize,
        mimeType: salesMaterials.mimeType,
        category: salesMaterials.category,
        sortOrder: salesMaterials.sortOrder,
        createdAt: salesMaterials.createdAt,
        uploaderName: users.name,
      })
      .from(salesMaterials)
      .leftJoin(users, (t) => {
        const { eq } = require("drizzle-orm");
        return eq(salesMaterials.uploadedBy, users.id);
      })
      .orderBy(asc(salesMaterials.sortOrder), asc(salesMaterials.createdAt));
    return { materials: rows };
  }),

  /**
   * Upload a file (admin only). Accepts base64-encoded file content.
   */
  upload: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        category: z.string().optional(),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        fileSize: z.number().int().positive(),
        base64: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { salesMaterials } = await import("../drizzle/schema");

      const buffer = Buffer.from(input.base64, "base64");
      const key = `sales-materials/${Date.now()}-${randomSuffix()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      await db.insert(salesMaterials).values({
        uploadedBy: ctx.user.id,
        title: input.title,
        description: input.description ?? null,
        fileName: input.fileName,
        fileKey: key,
        fileUrl: url,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        category: input.category ?? null,
        sortOrder: 0,
      });

      return { success: true, url };
    }),

  /**
   * Delete a material (admin only).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { salesMaterials } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(salesMaterials).where(eq(salesMaterials.id, input.id));
      return { success: true };
    }),

  /**
   * Update title / description / category (admin only).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { salesMaterials } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.category !== undefined) updates.category = input.category;
      await db.update(salesMaterials).set(updates).where(eq(salesMaterials.id, input.id));
      return { success: true };
    }),
});
