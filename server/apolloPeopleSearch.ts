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
 * Enrich a person's contact data using Apollo People Match API
 * This unlocks email addresses (costs 1 credit per net-new email)
 */
export async function enrichPerson(
  firstName: string,
  lastName: string,
  companyDomain: string
): Promise<{ email?: string; phone?: string; linkedinUrl?: string }> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  console.log(`[Apollo People Enrich] Enriching ${firstName} ${lastName} at ${companyDomain}`);

  try {
    const requestBody = {
      first_name: firstName,
      last_name: lastName,
      domain: companyDomain,
      reveal_personal_emails: true,
    };

    const response = await axios.post(
      "https://api.apollo.io/api/v1/people/match",
      requestBody,
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const person = response.data.person;
    if (!person) {
      console.log(`[Apollo People Enrich] No enrichment data returned`);
      return {};
    }

    console.log(`[Apollo People Enrich] Enriched data:`, JSON.stringify(person, null, 2));

    return {
      email: person.email || undefined,
      phone: person.phone || person.sanitized_phone || undefined,
      linkedinUrl: person.linkedin_url || undefined,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Apollo People Enrich Error] Status:", error.response?.status);
      console.error("[Apollo People Enrich Error] Response:", JSON.stringify(error.response?.data, null, 2));
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Apollo People Enrich error: ${errorMsg}`);
    }
    throw error;
  }
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

    console.log(`[Apollo People Search] Raw API Response:`, JSON.stringify(response.data, null, 2));

    if (results.length === 0) {
      console.log(`[Apollo People Search] No contacts found for "${jobTitle}" at ${companyDomain}`);
      return null;
    }

    const person = results[0];
    console.log(`[Apollo People Search] First person object:`, JSON.stringify(person, null, 2));
    
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

    // STEP 2: Enrich the contact to unlock email if not already present
    if (!contact.email && contact.firstName && contact.lastName) {
      console.log(`[Apollo People Search] Email not found, enriching contact...`);
      try {
        const enriched = await enrichPerson(contact.firstName, contact.lastName, companyDomain);
        if (enriched.email) {
          contact.email = enriched.email;
          console.log(`[Apollo People Search] ✓ Email unlocked via enrichment: ${contact.email}`);
        }
        if (enriched.phone && !contact.phone) {
          contact.phone = enriched.phone;
        }
        if (enriched.linkedinUrl && !contact.linkedinUrl) {
          contact.linkedinUrl = enriched.linkedinUrl;
        }
      } catch (enrichError: any) {
        console.error(`[Apollo People Search] Enrichment failed:`, enrichError.message);
        // Continue with partial data even if enrichment fails
      }
    }

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
