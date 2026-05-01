/**
 * Campaign Brain Router
 * ─────────────────────
 * Provides Brain → Company vector similarity search and campaign creation.
 * Uses the Supabase `match_companies_to_embedding` RPC function to find
 * companies semantically similar to a Brain's ICP embedding.
 */
import { z } from "zod";
import { superAdminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { getDb, createSearch, createCompanies } from "./db";
import { companies, searches, offeringBrain, campaignQueue } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

// ─── Supabase client ────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Fit tier helper ────────────────────────────────────────────────────────
function getFitTier(score: number): "A" | "B" | "C" | "D" {
  if (score >= 0.65) return "A";
  if (score >= 0.55) return "B";
  if (score >= 0.45) return "C";
  return "D";
}

export const campaignBrainRouter = router({
  /**
   * Get all brains with their embedding status (for brain picker UI)
   */
  listBrains: superAdminProcedure.query(async () => {
    const sb = getSupabase();

    // Fetch brains from Supabase (source of truth for all brains)
    // Show all completed brains (regardless of is_active) since any brain with an embedding
    // can be used for vector similarity campaign targeting
    const { data: brains, error } = await sb
      .from("lt_mns_offering_brains")
      .select("id, brain_name, company_name, offering_summary, target_sectors, status, is_active, show_on_leadtrigger")
      .eq("status", "completed");

    if (error) {
      console.error("[CampaignBrain] Failed to fetch brains:", error.message);
      return [];
    }

    // Check which brains have embeddings
    const { data: embRows } = await sb
      .from("lt_mns_brain_embeddings")
      .select("brain_id");
    const embeddedBrainIds = new Set((embRows ?? []).map((r: any) => String(r.brain_id)));

    return (brains ?? []).map((b: any) => ({
      id: b.id,
      brainName: b.brain_name,
      companyName: b.company_name,
      offeringSummary: b.offering_summary,
      icpIndustries: b.target_sectors ?? [],
      status: b.status,
      isActive: b.is_active,
      hasEmbedding: embeddedBrainIds.has(String(b.id)),
    }));
  }),

  /**
   * Find companies by Brain similarity.
   * Fetches the brain's embedding from Supabase, then calls the RPC.
   */
  findByBrain: superAdminProcedure
    .input(
      z.object({
        brainId: z.string(),
        limit: z.number().min(1).max(500).default(100),
        threshold: z.number().min(0).max(1).default(0.4),
        // Optional filters
        sector: z.string().optional(),
        country: z.string().optional(),
        minEmployees: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const sb = getSupabase();

      // 1. Get the brain embedding
      const { data: brainEmb, error: embErr } = await sb
        .from("lt_mns_brain_embeddings")
        .select("embedding")
        .eq("brain_id", input.brainId)
        .single();

      if (embErr || !brainEmb) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No embedding found for brain ${input.brainId}. Run the embedding job first.`,
        });
      }

      const embedding =
        typeof brainEmb.embedding === "string"
          ? JSON.parse(brainEmb.embedding)
          : brainEmb.embedding;

      // 2. Call the vector similarity RPC
      const { data: matches, error: rpcErr } = await sb.rpc(
        "match_companies_to_embedding",
        {
          p_embedding: embedding,
          p_limit: input.limit,
          p_threshold: input.threshold,
        }
      );

      if (rpcErr) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Vector search failed: ${rpcErr.message}`,
        });
      }

      // 3. Apply optional filters
      let results = (matches ?? []) as Array<{
        company_id: string;
        company_name: string;
        domain: string;
        sector: string;
        country: string;
        employee_count: number;
        similarity_score: number;
      }>;

      if (input.sector) {
        results = results.filter(
          (r) => r.sector?.toLowerCase().includes(input.sector!.toLowerCase())
        );
      }
      if (input.country) {
        results = results.filter(
          (r) => r.country?.toLowerCase().includes(input.country!.toLowerCase())
        );
      }
      if (input.minEmployees) {
        results = results.filter(
          (r) => (r.employee_count ?? 0) >= input.minEmployees!
        );
      }

      // 4. Return with fit tiers
      return results.map((r) => ({
        companyId: r.company_id,
        companyName: r.company_name,
        domain: r.domain,
        sector: r.sector,
        country: r.country,
        employeeCount: r.employee_count,
        similarityScore: r.similarity_score,
        fitTier: getFitTier(r.similarity_score),
      }));
    }),

  /**
   * Get available filter options (sectors, countries) from the matched companies
   */
  getFilterOptions: superAdminProcedure
    .input(z.object({ brainId: z.string() }))
    .query(async ({ input }) => {
      const sb = getSupabase();

      // Get brain embedding
      const { data: brainEmb } = await sb
        .from("lt_mns_brain_embeddings")
        .select("embedding")
        .eq("brain_id", input.brainId)
        .single();

      if (!brainEmb) return { sectors: [], countries: [] };

      const embedding =
        typeof brainEmb.embedding === "string"
          ? JSON.parse(brainEmb.embedding)
          : brainEmb.embedding;

      // Get a broad set to extract filter options
      const { data: matches } = await sb.rpc("match_companies_to_embedding", {
        p_embedding: embedding,
        p_limit: 500,
        p_threshold: 0.35,
      });

      const sectors = new Map<string, number>();
      const countries = new Map<string, number>();

      for (const m of matches ?? []) {
        if (m.sector) sectors.set(m.sector, (sectors.get(m.sector) ?? 0) + 1);
        if (m.country) countries.set(m.country, (countries.get(m.country) ?? 0) + 1);
      }

      return {
        sectors: Array.from(sectors.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
        countries: Array.from(countries.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
      };
    }),

  /**
   * Create a campaign from Brain similarity results.
   * Imports matched companies from Supabase into the local DB and creates a search record.
   */
  createCampaignFromBrain: superAdminProcedure
    .input(
      z.object({
        brainId: z.string(),
        campaignName: z.string().min(1).max(255),
        companyIds: z.array(z.string()), // Supabase UUIDs
        autoEnqueue: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sb = getSupabase();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // 1. Fetch full company data from Supabase for selected companies
      const CHUNK = 50;
      let allCompanyData: any[] = [];
      for (let i = 0; i < input.companyIds.length; i += CHUNK) {
        const chunk = input.companyIds.slice(i, i + CHUNK);
        const { data, error } = await sb
          .from("lt_mns_companies")
          .select("*")
          .in("id", chunk);
        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch companies: ${error.message}`,
          });
        }
        allCompanyData = allCompanyData.concat(data ?? []);
      }

      if (allCompanyData.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No companies found for the selected IDs.",
        });
      }

      // 2. Get brain info for the search record
      const [brain] = await db
        .select()
        .from(offeringBrain)
        .where(eq(offeringBrain.id, parseInt(input.brainId, 10)))
        .limit(1);

      // 3. Create a search record (= campaign)
      const searchId = await createSearch({
        userId: ctx.user.id,
        companyWebsite: brain?.companyWebsite ?? "",
        location: "Global (Brain Similarity)",
        offeringName: input.campaignName,
        offeringDescription: brain?.offeringSummary ?? null,
        targetMarket: brain?.icpIndustries ?? null,
        valueProposition: brain?.valuePropositions ?? null,
        keywords: null,
        status: "completed",
        brainId: parseInt(input.brainId, 10),
        sharedWithTeam: 1,
      });

      // 4. Map Supabase companies to local company records
      const companyRecords = allCompanyData.map((c: any) => ({
        searchId,
        apolloId: c.apollo_id ?? null,
        name: c.company_name,
        websiteUrl: c.domain ?? null,
        primaryDomain: c.domain?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? null,
        linkedinUrl: c.linkedin_url ?? null,
        twitterUrl: c.twitter_url ?? null,
        facebookUrl: c.facebook_url ?? null,
        phone: c.phone ?? null,
        city: c.city ?? null,
        country: c.country ?? null,
        sicCodes: c.sic_codes ? JSON.stringify(c.sic_codes) : null,
        naicsCodes: c.nace_codes ? JSON.stringify(c.nace_codes) : null,
        fitScore: c.fit_score ? Math.round(c.fit_score) : null,
        enrichmentStatus: c.apollo_id ? "enriched" as const : "pending" as const,
        generatedWithBrainId: parseInt(input.brainId, 10) || null,
        generatedWithBrainName: brain?.brainName ?? null,
        searchLocation: "Global (Brain Similarity)",
      }));

      // 5. Insert companies in batches
      const BATCH = 100;
      for (let i = 0; i < companyRecords.length; i += BATCH) {
        const batch = companyRecords.slice(i, i + BATCH);
        await createCompanies(batch);
      }

      // 6. Optionally auto-enqueue for deep research
      if (input.autoEnqueue) {
        const inserted = await db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.searchId, searchId));

        if (inserted.length > 0) {
          await db.insert(campaignQueue).values(
            inserted.map((c) => ({
              searchId,
              companyId: c.id,
              userId: ctx.user.id,
              companyName: c.name ?? "Unknown",
              jobType: "full" as const,
              status: "pending" as const,
            }))
          );
        }
      }

      console.log(
        `[CampaignBrain] Created campaign "${input.campaignName}" (searchId=${searchId}) with ${allCompanyData.length} companies from Brain ${input.brainId}`
      );

      return {
        searchId,
        campaignName: input.campaignName,
        companiesImported: allCompanyData.length,
        autoEnqueued: input.autoEnqueue,
      };
    }),

  /**
   * Find companies by free text query.
   * Embeds the text using OpenAI, then runs vector similarity.
   */
  findByText: superAdminProcedure
    .input(
      z.object({
        query: z.string().min(3).max(1000),
        limit: z.number().min(1).max(500).default(50),
        threshold: z.number().min(0).max(1).default(0.4),
      })
    )
    .query(async ({ input }) => {
      // Embed the query text using OpenAI
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: input.query,
        }),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Embedding API failed: ${response.statusText}`,
        });
      }

      const embResult = await response.json();
      const embedding = embResult.data[0].embedding;

      // Call the vector similarity RPC
      const sb = getSupabase();
      const { data: matches, error: rpcErr } = await sb.rpc(
        "match_companies_to_embedding",
        {
          p_embedding: embedding,
          p_limit: input.limit,
          p_threshold: input.threshold,
        }
      );

      if (rpcErr) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Vector search failed: ${rpcErr.message}`,
        });
      }

      return ((matches ?? []) as any[]).map((r) => ({
        companyId: r.company_id,
        companyName: r.company_name,
        domain: r.domain,
        sector: r.sector,
        country: r.country,
        employeeCount: r.employee_count,
        similarityScore: r.similarity_score,
        fitTier: getFitTier(r.similarity_score),
      }));
    }),
});
