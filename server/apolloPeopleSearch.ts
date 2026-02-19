/**
 * Apollo People Search Integration
 * 
 * Finds decision-makers at companies using Apollo's People Search API
 */

import axios from "axios";

export interface ApolloContact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface PeopleSearchParams {
  companyDomain: string;
  jobTitle: string; // e.g., "VP Operations", "Director Supply Chain"
  limit?: number;
}

/**
 * Search for contacts at a company by job title
 * Returns 1 contact (MVP: user specifies title, get 1 result)
 */
export async function searchApolloContacts(
  params: PeopleSearchParams
): Promise<ApolloContact | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  const { companyDomain, jobTitle, limit = 1 } = params;

  console.log(`[Apollo People Search] Searching for "${jobTitle}" at ${companyDomain}`);

  try {
    const requestBody = {
      page: 1,
      per_page: limit,
      organization_domains: [companyDomain],
      person_titles: [jobTitle],
    };

    const response = await axios.post(
      "https://api.apollo.io/api/v1/mixed_people/search",
      requestBody,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const results = response.data.people || [];

    if (results.length === 0) {
      console.log(`[Apollo People Search] No contacts found for "${jobTitle}" at ${companyDomain}`);
      return null;
    }

    const person = results[0];
    const contact: ApolloContact = {
      id: person.id,
      firstName: person.first_name || "",
      lastName: person.last_name || "",
      name: person.name || `${person.first_name} ${person.last_name}`,
      title: person.title || jobTitle,
      email: person.email || undefined,
      phone: person.phone || person.sanitized_phone || undefined,
      linkedinUrl: person.linkedin_url || undefined,
    };

    console.log(`[Apollo People Search] Found: ${contact.name} (${contact.title})`);

    return contact;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Apollo People Search Error] Status:", error.response?.status);
      console.error("[Apollo People Search Error] Response:", JSON.stringify(error.response?.data, null, 2));
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo People Search error: ${errorMsg}`);
    }
    throw error;
  }
}
