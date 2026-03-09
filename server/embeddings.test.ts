/**
 * Validates that the OPENAI_API_KEY is configured and can generate embeddings.
 * This is a lightweight smoke test — it embeds a single short string.
 */
import { describe, it, expect } from "vitest";
import OpenAI from "openai";

describe("OpenAI embeddings API key", () => {
  it("should generate a 1536-dim embedding via direct OpenAI key", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("OPENAI_API_KEY prefix:", apiKey ? apiKey.substring(0, 20) + "..." : "UNDEFINED");
    expect(apiKey, "OPENAI_API_KEY must be set").toBeTruthy();

    const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: "ConnectGroup | Industry: Manufacturing | Keywords: measurement, control",
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0].embedding).toHaveLength(1536);
    expect(typeof response.data[0].embedding[0]).toBe("number");
  }, 15000);
});
