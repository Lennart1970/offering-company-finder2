import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

// Mock axios
vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn().mockReturnValue(false),
  },
}));

const mockedAxios = vi.mocked(axios);

// Set env before importing module
process.env.APOLLO_API_KEY = "test-api-key";

describe("Apollo People Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchApolloContacts", () => {
    it("should use correct API parameter q_organization_domains_list", async () => {
      const { searchApolloContacts } = await import("./apolloPeopleSearch");

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          people: [{
            id: "p1",
            first_name: "John",
            last_name: "Smith",
            name: "John Smith",
            title: "CEO",
            linkedin_url: "https://linkedin.com/in/johnsmith",
            organization: { name: "Acme Corp" },
          }],
          total_entries: 1,
        },
      });

      // Mock enrichment call
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          person: {
            name: "John Smith",
            email: "john@acme.com",
            linkedin_url: "https://linkedin.com/in/johnsmith",
          },
        },
      });

      await searchApolloContacts({
        companyDomain: "https://www.acme.com/about",
        companyName: "Acme Corp",
        jobTitle: "CEO",
      });

      // Verify Step 1: Search call uses correct parameter
      const searchCall = mockedAxios.post.mock.calls[0];
      expect(searchCall[0]).toBe("https://api.apollo.io/api/v1/mixed_people/search");
      expect(searchCall[1]).toHaveProperty("q_organization_domains_list", ["acme.com"]);
      expect(searchCall[1]).not.toHaveProperty("organization_domains");
    });

    it("should clean domain correctly (strip www, http, paths)", async () => {
      const { searchApolloContacts } = await import("./apolloPeopleSearch");

      mockedAxios.post.mockResolvedValueOnce({
        data: { people: [], total_entries: 0 },
      });

      await searchApolloContacts({
        companyDomain: "https://www.example.co.uk/products/page",
        jobTitle: "CTO",
      });

      const searchCall = mockedAxios.post.mock.calls[0];
      expect(searchCall[1].q_organization_domains_list).toEqual(["example.co.uk"]);
    });

    it("should call enrichment WITHOUT phone by default", async () => {
      const { searchApolloContacts } = await import("./apolloPeopleSearch");

      // Mock search response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          people: [{
            id: "p1",
            first_name: "Jane",
            last_name: "Doe",
            name: "Jane Doe",
            title: "VP Sales",
            organization: { name: "Test Inc" },
          }],
          total_entries: 1,
        },
      });

      // Mock enrichment response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          person: {
            name: "Jane Doe",
            email: "jane@testinc.com",
          },
        },
      });

      const result = await searchApolloContacts({
        companyDomain: "testinc.com",
        jobTitle: "VP Sales",
      });

      // Verify enrichment call does NOT include reveal_phone_number
      const enrichCall = mockedAxios.post.mock.calls[1];
      expect(enrichCall[0]).toBe("https://api.apollo.io/api/v1/people/match");
      expect(enrichCall[1]).toHaveProperty("reveal_personal_emails", true);
      expect(enrichCall[1]).not.toHaveProperty("reveal_phone_number");

      expect(result?.email).toBe("jane@testinc.com");
      expect(result?.phone).toBeUndefined();
    });

    it("should call enrichment WITH phone when includePhone=true", async () => {
      const { searchApolloContacts } = await import("./apolloPeopleSearch");

      // Mock search response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          people: [{
            id: "p1",
            first_name: "Bob",
            last_name: "Wilson",
            name: "Bob Wilson",
            title: "CEO",
            organization: { name: "Widget Co" },
          }],
          total_entries: 1,
        },
      });

      // Mock enrichment response with phone
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          person: {
            name: "Bob Wilson",
            email: "bob@widgetco.com",
            sanitized_phone: "+1-555-123-4567",
            linkedin_url: "https://linkedin.com/in/bobwilson",
          },
        },
      });

      const result = await searchApolloContacts({
        companyDomain: "widgetco.com",
        companyName: "Widget Co",
        jobTitle: "CEO",
        includePhone: true,
      });

      // Verify enrichment call INCLUDES reveal_phone_number
      const enrichCall = mockedAxios.post.mock.calls[1];
      expect(enrichCall[0]).toBe("https://api.apollo.io/api/v1/people/match");
      expect(enrichCall[1]).toHaveProperty("reveal_personal_emails", true);
      expect(enrichCall[1]).toHaveProperty("reveal_phone_number", true);

      expect(result?.email).toBe("bob@widgetco.com");
      expect(result?.phone).toBe("+1-555-123-4567");
      expect(result?.name).toBe("Bob Wilson");
    });

    it("should return null when no people found", async () => {
      const { searchApolloContacts } = await import("./apolloPeopleSearch");

      mockedAxios.post.mockResolvedValueOnce({
        data: { people: [], total_entries: 0 },
      });

      const result = await searchApolloContacts({
        companyDomain: "unknown.com",
        jobTitle: "CEO",
      });

      expect(result).toBeNull();
      // Should only make 1 call (search), no enrichment
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it("should continue with partial data if enrichment fails", async () => {
      const { searchApolloContacts } = await import("./apolloPeopleSearch");

      // Mock search response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          people: [{
            id: "p1",
            first_name: "Alice",
            last_name: "Brown",
            name: "Alice Brown",
            title: "CFO",
            linkedin_url: "https://linkedin.com/in/alicebrown",
            organization: { name: "Finance Corp" },
          }],
          total_entries: 1,
        },
      });

      // Mock enrichment failure
      mockedAxios.post.mockRejectedValueOnce(new Error("Rate limited"));

      const result = await searchApolloContacts({
        companyDomain: "financecorp.com",
        jobTitle: "CFO",
      });

      // Should still return the contact with search data
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Alice Brown");
      expect(result?.title).toBe("CFO");
      expect(result?.linkedinUrl).toBe("https://linkedin.com/in/alicebrown");
      // Email should be undefined since enrichment failed
      expect(result?.email).toBeUndefined();
    });
  });

  describe("enrichPerson", () => {
    it("should include reveal_phone_number and webhook_url when includePhone is true", async () => {
      const { enrichPerson } = await import("./apolloPeopleSearch");

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          person: {
            id: "person-123",
            email: "test@example.com",
            sanitized_phone: "+1-555-000-1234",
          },
        },
      });

      const result = await enrichPerson("John", "Doe", "example.com", true, "https://example.com/api/apollo-webhook");

      const call = mockedAxios.post.mock.calls[0];
      expect(call[1]).toHaveProperty("reveal_phone_number", true);
      expect(call[1]).toHaveProperty("webhook_url", "https://example.com/api/apollo-webhook");
      expect(call[1]).toHaveProperty("reveal_personal_emails", true);
      // Phone returned synchronously — phonePending should be false
      expect(result.phone).toBe("+1-555-000-1234");
      expect(result.phonePending).toBe(false);
    });

    it("should set phonePending=true when phone not returned synchronously", async () => {
      const { enrichPerson } = await import("./apolloPeopleSearch");

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          person: {
            id: "person-456",
            email: "test@example.com",
            // No sanitized_phone — Apollo will deliver via webhook
          },
        },
      });

      const result = await enrichPerson("Jane", "Smith", "example.com", true, "https://example.com/api/apollo-webhook");

      expect(result.phone).toBeUndefined();
      expect(result.phonePending).toBe(true);
    });

    it("should NOT include reveal_phone_number when includePhone is false", async () => {
      const { enrichPerson } = await import("./apolloPeopleSearch");

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          person: {
            email: "test@example.com",
          },
        },
      });

      await enrichPerson("John", "Doe", "example.com", false);

      const call = mockedAxios.post.mock.calls[0];
      expect(call[1]).not.toHaveProperty("reveal_phone_number");
      expect(call[1]).toHaveProperty("reveal_personal_emails", true);
    });
  });
});
