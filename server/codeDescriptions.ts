import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { batchGetSicDescriptions, batchGetNaicsDescriptions } from "./codeDescriptionDb";

export const codeDescriptionsRouter = router({
  /**
   * Batch get SIC code descriptions
   */
  getSicDescriptions: protectedProcedure
    .input(z.object({
      codes: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const descriptionsMap = await batchGetSicDescriptions(input.codes);
      
      // Convert Map to array of objects for tRPC serialization
      return input.codes.map(code => ({
        code,
        description: descriptionsMap.get(code) || null,
      }));
    }),

  /**
   * Batch get NAICS code descriptions
   */
  getNaicsDescriptions: protectedProcedure
    .input(z.object({
      codes: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const descriptionsMap = await batchGetNaicsDescriptions(input.codes);
      
      // Convert Map to array of objects for tRPC serialization
      return input.codes.map(code => ({
        code,
        description: descriptionsMap.get(code) || null,
      }));
    }),
});
