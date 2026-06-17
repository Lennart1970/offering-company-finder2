/**
 * SharePoint CRM Lead Lookup — tRPC procedures for checking CRM presence.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { findCgLead } from "./db";

export const cgLeadRouter = router({
  lookup: publicProcedure
    .input(z.object({
      domain: z.string().optional(),
      companyName: z.string().optional(),
      websiteUrl: z.string().optional(),
    }))
    .query(async ({ input }) => {
      let domain = input.domain;
      if (!domain && input.websiteUrl) {
        try {
          const url = new URL(
            input.websiteUrl.startsWith("http") ? input.websiteUrl : `https://${input.websiteUrl}`
          );
          domain = url.hostname.replace(/^www\./, "");
        } catch {
          // ignore invalid URL
        }
      }
      const lead = await findCgLead({ domain, companyName: input.companyName });
      return { lead };
    }),
});
