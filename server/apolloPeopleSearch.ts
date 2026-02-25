/**
 * Apollo People Search Integration
 * 
 * Two-step approach for finding contacts at companies:
 * 
 * Step 1: Use /mixed_people/search (1 credit per page)
 *   - Search by company domain + job title
 *   - Returns FULL name, title, LinkedIn URL, email (if available)
 *   - Correct param: q_organization_domains_list[] (NOT organization_domains)
 *   - Note: /mixed_people/api_search is free but obfuscates last names
 * 
 * Step 2: Use /people/match (1 credit per net-new email)
 *   - Enrich the found person with first_name + last_name + domain
 *   - Unlocks email address with reveal_personal_emails: true
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
  companyName?: string;
}

export interface PeopleSearchParams {
  companyDomain: string;
  companyName?: string;
  jobTitle: string; // e.g., "CEO", "VP Operations", "Director Supply Chain"
  limit?: number;
  includePhone?: boolean; // Optional: 8 credits per net-new phone
}

/**
 * Step 1: Search for people at a specific company by job title
 * 
 * Uses /mixed_people/search (1 credit per page)
 * CRITICAL: Uses q_organization_domains_list[] parameter (not organization_domains)
 * 
 * Returns full names (unlike api_search which obfuscates last names).
 * May include email if already in Apollo's database.
 * Use enrichPerson() afterwards if email is not returned.
 * 
 * Step 3 (optional): Add includePhone=true to enrichPerson() for phone numbers (8 credits)
 */
async function searchPeopleAtCompany(
  apiKey: string,
  companyDomain: string,
  jobTitle: string,
  limit: number = 3
): Promise<Array<{
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  linkedinUrl?: string;
  organizationName?: string;
}>> {
  // Clean domain - remove www., http://, etc.
  const cleanDomain = companyDomain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();

  console.log(`[Apollo People Search] Step 1: Searching for "${jobTitle}" at domain "${cleanDomain}"`);

  const requestBody = {
    page: 1,
    per_page: limit,
    // CRITICAL: correct parameter name with array notation
    q_organization_domains_list: [cleanDomain],
    person_titles: [jobTitle],
  };

  console.log(`[Apollo People Search] Request body:`, JSON.stringify(requestBody, null, 2));

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

  const people = response.data.people || [];
  const totalEntries = response.data.total_entries || 0;

  console.log(`[Apollo People Search] Found ${people.length} people (total_entries: ${totalEntries})`);

  if (people.length > 0) {
    // Log first person for debugging
    console.log(`[Apollo People Search] First result:`, JSON.stringify({
      name: people[0].name,
      title: people[0].title,
      organization: people[0].organization?.name,
      linkedin_url: people[0].linkedin_url,
      email: people[0].email, // Should be null from api_search
    }, null, 2));
  }

  return people.map((person: any) => ({
    id: person.id || "",
    firstName: person.first_name || "",
    lastName: person.last_name || "",
    name: person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim(),
    title: person.title || jobTitle,
    linkedinUrl: person.linkedin_url || undefined,
    organizationName: person.organization?.name || undefined,
  }));
}

/**
 * Step 2/3: Enrich a person's contact data using Apollo People Match API
 * 
 * Uses /people/match endpoint
 * Cost: 
 *   - 1 credit per net-new email returned
 *   - 8 credits per net-new phone number (if includePhone=true)
 * 
 * IMPORTANT: Requires first_name + last_name + domain for accurate matching
 */
export async function enrichPerson(
  firstName: string,
  lastName: string,
  companyDomain: string,
  includePhone: boolean = false
): Promise<{ email?: string; phone?: string; linkedinUrl?: string }> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  // Clean domain
  const cleanDomain = companyDomain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();

  console.log(`[Apollo People Enrich] Step 2: Enriching ${firstName} ${lastName} at ${cleanDomain}`);

  try {
    const requestBody: any = {
      first_name: firstName,
      last_name: lastName,
      domain: cleanDomain,
      reveal_personal_emails: true,
    };

    if (includePhone) {
      requestBody.reveal_phone_number = true;
      console.log(`[Apollo People Enrich] ⚠️  WARNING: Phone enrichment enabled (8 credits per net-new phone)`);
    }

    console.log(`[Apollo People Enrich] Request body:`, JSON.stringify(requestBody, null, 2));

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

    console.log(`[Apollo People Enrich] Enriched result:`, JSON.stringify({
      name: person.name,
      email: person.email,
      phone: person.sanitized_phone,
      linkedin_url: person.linkedin_url,
      organization: person.organization?.name,
    }, null, 2));

    return {
      email: person.email || undefined,
      phone: person.sanitized_phone || person.phone || undefined,
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
 * Main function: Find a contact at a company by job title
 * 
 * Combines Step 1 (search) + Step 2 (email) + Step 3 (phone) for best results:
 * 1. Search for people at the company domain with matching title (1 credit)
 * 2. Enrich the best match to unlock email address (1 credit)
 * 3. Optionally enrich for phone number (8 credits if includePhone=true)
 * 
 * Returns the first matching contact with enriched data.
 */
export async function searchApolloContacts(
  params: PeopleSearchParams
): Promise<ApolloContact | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable not set");
  }

  const { companyDomain, companyName, jobTitle, limit = 3, includePhone = false } = params;

  try {
    // STEP 1: Search for people (FREE)
    const searchResults = await searchPeopleAtCompany(apiKey, companyDomain, jobTitle, limit);

    if (searchResults.length === 0) {
      console.log(`[Apollo People Search] No contacts found for "${jobTitle}" at ${companyDomain}`);
      return null;
    }

    // Take the first (best) match
    const bestMatch = searchResults[0];

    // Verify the person is actually at the right company
    if (bestMatch.organizationName && companyName) {
      console.log(`[Apollo People Search] Verifying company match: "${bestMatch.organizationName}" vs "${companyName}"`);
    }

    const contact: ApolloContact = {
      id: bestMatch.id,
      firstName: bestMatch.firstName,
      lastName: bestMatch.lastName,
      name: bestMatch.name,
      title: bestMatch.title,
      linkedinUrl: bestMatch.linkedinUrl,
      companyName: bestMatch.organizationName,
    };

    // STEP 2: Enrich to unlock email (1 credit)
    if (contact.firstName && contact.lastName) {
      console.log(`[Apollo People Search] Proceeding to enrichment for ${contact.name}...`);
      try {
        const enriched = await enrichPerson(contact.firstName, contact.lastName, companyDomain, includePhone);
        if (enriched.email) {
          contact.email = enriched.email;
          console.log(`[Apollo People Search] ✓ Email unlocked: ${contact.email}`);
        } else {
          console.log(`[Apollo People Search] ⚠ Enrichment returned no email`);
        }
        if (enriched.phone) {
          contact.phone = enriched.phone;
          console.log(`[Apollo People Search] ✓ Phone found: ${contact.phone}`);
        }
        if (enriched.linkedinUrl && !contact.linkedinUrl) {
          contact.linkedinUrl = enriched.linkedinUrl;
        }
      } catch (enrichError: any) {
        console.error(`[Apollo People Search] Enrichment failed:`, enrichError.message);
        // Continue with partial data even if enrichment fails
      }
    } else {
      console.log(`[Apollo People Search] ⚠ Cannot enrich - missing first/last name`);
    }

    console.log(`[Apollo People Search] Final contact:`, JSON.stringify(contact, null, 2));
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
