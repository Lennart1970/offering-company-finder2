import { describe, expect, it } from "vitest";
import {
  getSicDescription,
  getNaicsDescription,
  getSicDescriptions,
  getNaicsDescriptions,
} from "@shared/industryCodeLookup";

describe("Industry Code Lookup", () => {
  describe("getSicDescription", () => {
    it("returns description for known SIC code", () => {
      expect(getSicDescription("3672")).toBe("Printed Circuit Boards");
      expect(getSicDescription("5812")).toBe("Eating Places");
      expect(getSicDescription("3711")).toBe("Motor Vehicles and Passenger Car Bodies");
    });

    it("returns null for unknown SIC code", () => {
      expect(getSicDescription("9999")).toBeNull();
      expect(getSicDescription("0000")).toBeNull();
    });
  });

  describe("getNaicsDescription", () => {
    it("returns description for known NAICS code", () => {
      expect(getNaicsDescription("334412")).toBe("Bare Printed Circuit Board Manufacturing");
      expect(getNaicsDescription("722511")).toBe("Full-Service Restaurants");
      expect(getNaicsDescription("336111")).toBe("Automobile Manufacturing");
    });

    it("returns null for unknown NAICS code", () => {
      expect(getNaicsDescription("999999")).toBeNull();
      expect(getNaicsDescription("000000")).toBeNull();
    });
  });

  describe("getSicDescriptions", () => {
    it("returns descriptions for multiple SIC codes", () => {
      const result = getSicDescriptions(["3672", "5812", "9999"]);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ code: "3672", description: "Printed Circuit Boards" });
      expect(result[1]).toEqual({ code: "5812", description: "Eating Places" });
      expect(result[2]).toEqual({ code: "9999", description: null });
    });

    it("handles empty array", () => {
      const result = getSicDescriptions([]);
      expect(result).toEqual([]);
    });
  });

  describe("getNaicsDescriptions", () => {
    it("returns descriptions for multiple NAICS codes", () => {
      const result = getNaicsDescriptions(["334412", "722511", "999999"]);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ code: "334412", description: "Bare Printed Circuit Board Manufacturing" });
      expect(result[1]).toEqual({ code: "722511", description: "Full-Service Restaurants" });
      expect(result[2]).toEqual({ code: "999999", description: null });
    });

    it("handles empty array", () => {
      const result = getNaicsDescriptions([]);
      expect(result).toEqual([]);
    });
  });

  describe("Coverage", () => {
    it("has descriptions for common manufacturing SIC codes", () => {
      expect(getSicDescription("3672")).not.toBeNull(); // PCB
      expect(getSicDescription("3674")).not.toBeNull(); // Semiconductors
      expect(getSicDescription("3711")).not.toBeNull(); // Automotive
      expect(getSicDescription("3721")).not.toBeNull(); // Aircraft
    });

    it("has descriptions for common manufacturing NAICS codes", () => {
      expect(getNaicsDescription("334412")).not.toBeNull(); // PCB
      expect(getNaicsDescription("334413")).not.toBeNull(); // Semiconductors
      expect(getNaicsDescription("336111")).not.toBeNull(); // Automotive
      expect(getNaicsDescription("336411")).not.toBeNull(); // Aircraft
    });
  });
});
