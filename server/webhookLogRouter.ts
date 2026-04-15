import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getWebhookLogs, countWebhookLogs } from "./db";

export const webhookLogRouter = router({
  /**
   * Return paginated Apollo webhook audit log entries, newest first.
   * Only accessible to authenticated users.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const [rows, total] = await Promise.all([
        getWebhookLogs(input.limit, input.offset),
        countWebhookLogs(),
      ]);
      return { rows, total };
    }),
});
