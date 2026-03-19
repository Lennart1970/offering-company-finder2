import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { bomItems } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const bomRouter = router({
  /**
   * List all BOM items for a prototype request
   */
  list: protectedProcedure
    .input(z.object({ prototypeRequestId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db
        .select()
        .from(bomItems)
        .where(eq(bomItems.prototypeRequestId, input.prototypeRequestId))
        .orderBy(bomItems.createdAt);
    }),

  /**
   * Add a BOM line item
   */
  add: protectedProcedure
    .input(
      z.object({
        prototypeRequestId: z.number().int().positive(),
        component: z.string().min(1).max(256),
        qty: z.number().int().positive().default(1),
        unitCost: z.number().nonnegative(),
        currency: z.enum(["EUR", "USD", "GBP"]).default("EUR"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(bomItems).values({
        prototypeRequestId: input.prototypeRequestId,
        component: input.component,
        qty: input.qty,
        unitCost: String(input.unitCost),
        currency: input.currency,
        notes: input.notes ?? null,
      });
      // Return updated list
      return db
        .select()
        .from(bomItems)
        .where(eq(bomItems.prototypeRequestId, input.prototypeRequestId))
        .orderBy(bomItems.createdAt);
    }),

  /**
   * Update a BOM line item
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        prototypeRequestId: z.number().int().positive(),
        component: z.string().min(1).max(256).optional(),
        qty: z.number().int().positive().optional(),
        unitCost: z.number().nonnegative().optional(),
        currency: z.enum(["EUR", "USD", "GBP"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const updates: Record<string, unknown> = {};
      if (input.component !== undefined) updates.component = input.component;
      if (input.qty !== undefined) updates.qty = input.qty;
      if (input.unitCost !== undefined) updates.unitCost = String(input.unitCost);
      if (input.currency !== undefined) updates.currency = input.currency;
      if (input.notes !== undefined) updates.notes = input.notes;

      if (Object.keys(updates).length > 0) {
        await db
          .update(bomItems)
          .set(updates)
          .where(
            and(
              eq(bomItems.id, input.id),
              eq(bomItems.prototypeRequestId, input.prototypeRequestId)
            )
          );
      }
      return db
        .select()
        .from(bomItems)
        .where(eq(bomItems.prototypeRequestId, input.prototypeRequestId))
        .orderBy(bomItems.createdAt);
    }),

  /**
   * Delete a BOM line item
   */
  remove: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        prototypeRequestId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .delete(bomItems)
        .where(
          and(
            eq(bomItems.id, input.id),
            eq(bomItems.prototypeRequestId, input.prototypeRequestId)
          )
        );
      return db
        .select()
        .from(bomItems)
        .where(eq(bomItems.prototypeRequestId, input.prototypeRequestId))
        .orderBy(bomItems.createdAt);
    }),
});
