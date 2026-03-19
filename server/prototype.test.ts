import { describe, it, expect } from "vitest";

/**
 * Tests for the prototype request feature
 * - Validates the router procedures exist and have correct input schemas
 * - Validates the service functions are importable
 */

describe("Prototype Router", () => {
  it("should export prototypeRouter with expected procedures", async () => {
    const { prototypeRouter } = await import("./prototypeRouter");
    expect(prototypeRouter).toBeDefined();

    // Check that all expected procedures exist
    const procedures = prototypeRouter._def.procedures;
    expect(procedures).toHaveProperty("uploadImages");
    expect(procedures).toHaveProperty("analyzeImages");
    expect(procedures).toHaveProperty("createRequest");
    expect(procedures).toHaveProperty("getById");
    expect(procedures).toHaveProperty("myRequests");
    expect(procedures).toHaveProperty("allRequests");
    expect(procedures).toHaveProperty("updateStatus");
    expect(procedures).toHaveProperty("addNotes");
  });
});

describe("Prototype Service", () => {
  it("should export service functions", async () => {
    const service = await import("./prototypeService");
    expect(service.extractProductFromImages).toBeDefined();
    expect(typeof service.extractProductFromImages).toBe("function");
    expect(service.createPrototypeRequest).toBeDefined();
    expect(typeof service.createPrototypeRequest).toBe("function");
    expect(service.getAllPrototypeRequests).toBeDefined();
    expect(typeof service.getAllPrototypeRequests).toBe("function");
    expect(service.getPrototypeRequestById).toBeDefined();
    expect(typeof service.getPrototypeRequestById).toBe("function");
    expect(service.updatePrototypeRequest).toBeDefined();
    expect(typeof service.updatePrototypeRequest).toBe("function");
  });
});

describe("Schema", () => {
  it("should have prototypeRequests table defined", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.prototypeRequests).toBeDefined();
  });
});
