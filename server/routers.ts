import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { companyFinderRouter } from "./companyFinder";
import { codeDescriptionsRouter } from "./codeDescriptions";
import { nicheRouter } from "./nicheRouter";
import { prototypeRouter } from "./prototypeRouter";
import { bomRouter } from "./bomRouter";
import { ALL_PROMPTS } from "./prompts/index";
import { campaignQueueRouter } from "./campaignQueueRouter";
import { leadinfoRouter } from "./leadinfoRouter";
import { telegramRouter } from "./telegramRouter";
import { webhookLogRouter } from "./webhookLogRouter";
import { salesMaterialsRouter } from "./salesMaterialsRouter";
import { shareRouter } from "./shareRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  companyFinder: companyFinderRouter,
  codeDescriptions: codeDescriptionsRouter,
  niche: nicheRouter,
  prototype: prototypeRouter,
  bom: bomRouter,
  campaignQueue: campaignQueueRouter,
  leadinfo: leadinfoRouter,
  telegram: telegramRouter,
  webhookLog: webhookLogRouter,
  salesMaterials: salesMaterialsRouter,
  share: shareRouter,

  // Prompt Repository — exposes the full prompt catalogue for transparency
  prompts: router({
    list: protectedProcedure.query(() => ALL_PROMPTS),
  }),
});

export type AppRouter = typeof appRouter;
