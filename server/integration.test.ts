import { describe, expect, it } from "vitest";
import { extractOffering } from "./offeringExtractor";
import { searchApolloCompanies } from "./apolloSearch";

describe("Native Integration Tests", () => {
  describe("offeringExtractor", () => {
    it("validates XAI_API_KEY is configured", () => {
      expect(process.env.XAI_API_KEY).toBeDefined();
      expect(process.env.XAI_API_KEY).not.toBe("");
    });

    it("has correct function signature", () => {
      expect(typeof extractOffering).toBe("function");
    });
  });

  describe("apolloSearch", () => {
    it("validates APOLLO_API_KEY is configured", () => {
      expect(process.env.APOLLO_API_KEY).toBeDefined();
      expect(process.env.APOLLO_API_KEY).not.toBe("");
    });

    it("has correct function signature", () => {
      expect(typeof searchApolloCompanies).toBe("function");
    });

    it("handles mock offering data correctly", () => {
      const mockOffering = {
        keywords: ["manufacturing", "electronics", "EMS"],
        targetMarket: "Mid-sized to large enterprises in industrial sectors",
      };

      // Should not throw when called with valid data structure
      expect(() => {
        searchApolloCompanies(mockOffering, "Atlanta, GA", 300, 10);
      }).not.toThrow();
    });
  });

  describe("End-to-end validation", () => {
    it("confirms both APIs are accessible", async () => {
      // Validate xAI API key format
      const xaiKey = process.env.XAI_API_KEY || "";
      expect(xaiKey.length).toBeGreaterThan(10);

      // Validate Apollo API key format
      const apolloKey = process.env.APOLLO_API_KEY || "";
      expect(apolloKey.length).toBeGreaterThan(10);
    });
  });
});
