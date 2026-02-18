import { describe, it, expect } from "vitest";
import { selectIndustryCodes } from "./codeSelectionService";
import type { OfferingInput } from "./prompts/selectIndustryCodes";

describe("Code Selection Service", () => {
  it("should select relevant industry codes for EMS offering", async () => {
    const offering: OfferingInput = {
      offeringName: "Electronics Manufacturing Services (EMS)",
      offeringDescription: "Full-service EMS subcontractor providing PCB assembly, cable assembly, and module building",
      targetMarket: "Mid-market to enterprise companies in Railway, Healthcare/MedTech, Automotive, Defense, Industrial Manufacturing",
      valueProposition: "33 years experience, 9 global locations, design-to-product support",
    };

    const result = await selectIndustryCodes(offering);

    // Should return arrays of codes
    expect(result.sicCodes).toBeInstanceOf(Array);
    expect(result.naicsCodes).toBeInstanceOf(Array);
    expect(result.reasoning).toBeTruthy();

    // Should have reasonable number of codes (30-50+ as per prompt)
    expect(result.sicCodes.length).toBeGreaterThan(10); // LLM output varies, minimum reasonable count
    expect(result.sicCodes.length).toBeLessThan(100); // Upper bound for sanity
    expect(result.naicsCodes.length).toBeGreaterThan(10); // LLM output varies
    expect(result.naicsCodes.length).toBeLessThan(300); // NAICS can be more granular

    // SIC codes should be 2-4 digits (hierarchical: major group, industry group, or industry)
    result.sicCodes.forEach(code => {
      expect(code).toMatch(/^\d{2,4}$/);
    });

    // NAICS codes should be 2-6 digits (hierarchical: sector, subsector, industry group, industry, or national)
    result.naicsCodes.forEach(code => {
      expect(code).toMatch(/^\d{2,6}$/);
    });

    // Should NOT select EMS provider codes (should select customer industries)
    // Common EMS SIC codes: 3672 (Printed Circuit Boards), 3679 (Electronic Components)
    // These should NOT be in the selection as they represent the provider, not the customer
    console.log("Selected SIC codes:", result.sicCodes);
    console.log("Selected NAICS codes:", result.naicsCodes);
    console.log("Reasoning:", result.reasoning);
  }, 30000); // 30 second timeout for LLM call

  it("should select different codes for industrial automation offering", async () => {
    const offering: OfferingInput = {
      offeringName: "Industrial IoT Sensors for Predictive Maintenance",
      offeringDescription: "IoT sensor platform that monitors industrial equipment and predicts failures before they happen",
      targetMarket: "Manufacturing plants, utilities, oil & gas, mining operations with heavy equipment",
      valueProposition: "Reduce downtime by 40%, prevent costly equipment failures, real-time monitoring",
    };

    const result = await selectIndustryCodes(offering);

    expect(result.sicCodes).toBeInstanceOf(Array);
    expect(result.naicsCodes).toBeInstanceOf(Array);
    expect(result.reasoning).toBeTruthy();

    // Should select manufacturing and utilities codes
    // Expected: industrial machinery, utilities, oil & gas, mining
    console.log("Industrial IoT - SIC codes:", result.sicCodes);
    console.log("Industrial IoT - NAICS codes:", result.naicsCodes);
    console.log("Industrial IoT - Reasoning:", result.reasoning);
  }, 30000);
});
