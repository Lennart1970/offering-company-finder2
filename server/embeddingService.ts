/**
 * Embedding Service
 *
 * Generates text-embedding-3-small vectors for companies using the OpenAI API.
 * Used as the first stage of the niche clustering pipeline.
 *
 * Pipeline: generateEmbeddings → clusterCompanies → scoreNiches
 */
import OpenAI from "openai";
import type { Company } from "../drizzle/schema";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 50; // OpenAI allows up to 2048 inputs per request but 50 is safe

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
}

/**
 * Build the embedding text for a company.
 * Combines name, industry, keywords, description, location, and SIC codes
 * into a single string that captures the company's profile.
 */
export function buildEmbeddingText(company: Company): string {
  const parts: string[] = [];

  parts.push(`Company: ${company.name}`);

  // Extract fields from sliceMetadata JSON
  if (company.sliceMetadata) {
    try {
      const meta = JSON.parse(company.sliceMetadata) as {
        industry?: string;
        keywords?: string;
        description?: string;
        employeeCount?: number;
      };
      if (meta.industry) parts.push(`Industry: ${meta.industry}`);
      if (meta.keywords) parts.push(`Keywords: ${meta.keywords}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
      if (meta.employeeCount) parts.push(`Employees: ${meta.employeeCount}`);
    } catch {
      // ignore malformed JSON
    }
  }

  // Location
  const location = [company.city, company.country].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);

  // SIC codes (first 3 only to keep text compact)
  if (company.sicCodes) {
    try {
      const codes = JSON.parse(company.sicCodes) as string[];
      if (codes.length > 0) parts.push(`SIC: ${codes.slice(0, 3).join(", ")}`);
    } catch {
      // ignore
    }
  }

  return parts.join(" | ");
}

export interface CompanyEmbedding {
  companyId: number;
  embedding: number[];
  text: string;
}

/**
 * Generate embeddings for a list of companies in batches of BATCH_SIZE.
 * Returns one CompanyEmbedding per company in the same order.
 */
export async function generateEmbeddings(
  companies: Company[]
): Promise<CompanyEmbedding[]> {
  if (companies.length === 0) return [];

  const client = getOpenAIClient();
  const results: CompanyEmbedding[] = [];

  // Process in batches
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    console.log(
      `[Embeddings] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companies.length / BATCH_SIZE)}: ${batch.length} companies`
    );

    const response = await client.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
    });

    // OpenAI returns embeddings in the same order as input
    for (let j = 0; j < batch.length; j++) {
      results.push({
        companyId: batch[j].id,
        embedding: response.data[j].embedding,
        text: texts[j],
      });
    }
  }

  console.log(`[Embeddings] Done: ${results.length} embeddings generated`);
  return results;
}

export { EMBEDDING_DIMENSIONS };
