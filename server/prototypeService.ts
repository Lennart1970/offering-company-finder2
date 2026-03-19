/**
 * Prototype Service
 * 
 * Handles LLM vision extraction from product images and
 * database operations for prototype requests.
 */
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { prototypeRequests, type InsertPrototypeRequest, type PrototypeRequest } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── LLM Vision Extraction ───────────────────────────────────────────────

export interface ProductExtraction {
  productTypeGuess: string;
  keyFeatureGuess: string[];
  whatWeStillNeed: string[];
}

/**
 * Analyze product images using LLM vision to extract:
 * - Product type guess
 * - Key features
 * - What information is still needed to quote
 */
export async function extractProductFromImages(
  imageUrls: string[],
  productUrl?: string
): Promise<ProductExtraction> {
  console.log(`[Prototype] Analyzing ${imageUrls.length} image(s)...`);

  // Build the message content with images
  const content: any[] = [];

  // Add each image
  for (const url of imageUrls) {
    content.push({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    });
  }

  // Add the analysis prompt
  const urlContext = productUrl ? `\nProduct URL for additional context: ${productUrl}` : "";
  content.push({
    type: "text" as const,
    text: `You are an electronics manufacturing engineer at a contract electronics manufacturer (EMS/PCBA company). A potential customer has sent you pictures of a competing product or a product they want manufactured.${urlContext}

Analyze the product image(s) and extract:

1. **Product Type Guess**: A single sentence describing what this product is (e.g., "Lithium battery module with integrated BMS", "Industrial IoT gateway with cellular connectivity", "LED driver module for commercial lighting").

2. **Key Feature Guess**: A list of observable technical features. Be specific about:
   - Component types visible (PCBs, connectors, cables, enclosures, displays, etc.)
   - Materials (aluminum, PC/ABS, steel, etc.)
   - Communication interfaces visible (Bluetooth, CAN, LIN, Ethernet, WiFi, etc.)
   - Power specifications if visible on labels
   - Certifications visible on labels (CE, UL, FCC, etc.)
   - Form factor and approximate dimensions
   - Any brand/model information visible

3. **What We Still Need**: The essential questions we must ask the customer before we can start quoting. Focus ONLY on:
   - Target annual units (EAU)
   - Expected Start of Production (SOP)
   - Target region (EU / US / APAC)
   - Whether they want a 1:1 equivalent or a modified design
   - Whether they have a BOM, technical drawings, or additional pictures
   - Any specific certifications or compliance requirements
   - Target cost or budget range

Return JSON only:
{
  "productTypeGuess": "single sentence",
  "keyFeatureGuess": ["feature 1", "feature 2", ...],
  "whatWeStillNeed": ["question 1", "question 2", ...]
}`,
  });

  const response = await invokeLLM({
    messages: [
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "product_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            productTypeGuess: { type: "string", description: "Single sentence product type description" },
            keyFeatureGuess: {
              type: "array",
              items: { type: "string" },
              description: "List of observed technical features",
            },
            whatWeStillNeed: {
              type: "array",
              items: { type: "string" },
              description: "Essential questions before quoting",
            },
          },
          required: ["productTypeGuess", "keyFeatureGuess", "whatWeStillNeed"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("LLM returned empty response for product extraction");
  }

  const parsed = JSON.parse(text) as ProductExtraction;
  console.log(`[Prototype] Extracted: ${parsed.productTypeGuess}`);
  console.log(`[Prototype] Features: ${parsed.keyFeatureGuess.length}, Questions: ${parsed.whatWeStillNeed.length}`);
  return parsed;
}

// ─── Database Helpers ────────────────────────────────────────────────────

export async function createPrototypeRequest(
  data: Omit<InsertPrototypeRequest, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(prototypeRequests).values(data);
  return result[0].insertId;
}

export async function getPrototypeRequestById(id: number): Promise<PrototypeRequest | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(prototypeRequests).where(eq(prototypeRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPrototypeRequestsByUser(userId: number): Promise<PrototypeRequest[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(prototypeRequests).where(eq(prototypeRequests.userId, userId)).orderBy(desc(prototypeRequests.createdAt));
}

export async function getAllPrototypeRequests(): Promise<PrototypeRequest[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(prototypeRequests).orderBy(desc(prototypeRequests.createdAt));
}

export async function updatePrototypeRequest(
  id: number,
  data: Partial<Omit<InsertPrototypeRequest, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(prototypeRequests).set(data).where(eq(prototypeRequests.id, id));
}
