import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

describe("Code Descriptions Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const mockContext: Context = {
      user: {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        email: "test@example.com",
        loginMethod: "google",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as any,
      res: {} as any,
    };

    caller = appRouter.createCaller(mockContext);
  });

  describe("getSicDescriptions", () => {
    it("should return descriptions for valid SIC codes", async () => {
      const result = await caller.codeDescriptions.getSicDescriptions({
        codes: ["1629", "3672"],
      });

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe("1629");
      expect(result[1].code).toBe("3672");
      
      // Descriptions should be fetched (or null if not found)
      expect(result[0].description).toBeDefined();
      expect(result[1].description).toBeDefined();
    }, 30000); // 30 second timeout for web scraping

    it("should handle empty code array", async () => {
      const result = await caller.codeDescriptions.getSicDescriptions({
        codes: [],
      });

      expect(result).toHaveLength(0);
    });

    it("should cache descriptions on subsequent calls", async () => {
      // First call - fetches from web
      const result1 = await caller.codeDescriptions.getSicDescriptions({
        codes: ["1629"],
      });

      // Second call - should use cache
      const result2 = await caller.codeDescriptions.getSicDescriptions({
        codes: ["1629"],
      });

      expect(result1).toEqual(result2);
    }, 30000);
  });

  describe("getNaicsDescriptions", () => {
    it("should return descriptions for valid NAICS codes", async () => {
      const result = await caller.codeDescriptions.getNaicsDescriptions({
        codes: ["23731", "334412"],
      });

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe("23731");
      expect(result[1].code).toBe("334412");
      
      // Descriptions should be fetched (or null if not found)
      expect(result[0].description).toBeDefined();
      expect(result[1].description).toBeDefined();
    }, 30000);

    it("should handle empty code array", async () => {
      const result = await caller.codeDescriptions.getNaicsDescriptions({
        codes: [],
      });

      expect(result).toHaveLength(0);
    });

    it("should cache descriptions on subsequent calls", async () => {
      // First call - fetches from web
      const result1 = await caller.codeDescriptions.getNaicsDescriptions({
        codes: ["23731"],
      });

      // Second call - should use cache
      const result2 = await caller.codeDescriptions.getNaicsDescriptions({
        codes: ["23731"],
      });

      expect(result1).toEqual(result2);
    }, 30000);
  });

  describe("batch processing", () => {
    it("should handle multiple SIC codes efficiently", async () => {
      const codes = ["1629", "3672", "3674", "5065"];
      const result = await caller.codeDescriptions.getSicDescriptions({
        codes,
      });

      expect(result).toHaveLength(codes.length);
      codes.forEach((code, index) => {
        expect(result[index].code).toBe(code);
      });
    }, 60000); // 60 second timeout for batch processing

    it("should handle multiple NAICS codes efficiently", async () => {
      const codes = ["23731", "334412", "334418", "423690"];
      const result = await caller.codeDescriptions.getNaicsDescriptions({
        codes,
      });

      expect(result).toHaveLength(codes.length);
      codes.forEach((code, index) => {
        expect(result[index].code).toBe(code);
      });
    }, 60000);
  });
});
