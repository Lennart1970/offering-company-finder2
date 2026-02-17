import { describe, expect, it } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

describe("API Keys Validation", () => {
  it("validates XAI_API_KEY is set and accessible", async () => {
    expect(process.env.XAI_API_KEY).toBeDefined();
    expect(process.env.XAI_API_KEY).not.toBe("");
  }, 10000);

  it("validates APOLLO_API_KEY is set and accessible", async () => {
    expect(process.env.APOLLO_API_KEY).toBeDefined();
    expect(process.env.APOLLO_API_KEY).not.toBe("");
  }, 10000);

  it("validates Apollo API health check", async () => {
    // Test Apollo API health endpoint
    const response = await fetch("https://api.apollo.io/v1/auth/health", {
      headers: {
        "X-Api-Key": process.env.APOLLO_API_KEY || "",
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.healthy).toBe(true);
    expect(data.is_logged_in).toBe(true);
  }, 15000);
});
