/**
 * Apollo Webhook Route
 *
 * Apollo calls this endpoint asynchronously when phone enrichment completes
 * via reveal_phone_number=true on /api/v1/people/match.
 *
 * ACTUAL webhook payload structure (from Apollo docs):
 * {
 *   "status": "success",
 *   "total_requested_enrichments": 1,
 *   "unique_enriched_records": 1,
 *   "missing_records": 0,
 *   "credits_consumed": 1,
 *   "people": [
 *     {
 *       "id": "587cf802f65125cad923a266",
 *       "status": "success",
 *       "phone_numbers": [
 *         {
 *           "sanitized_number": "+15551234567",
 *           "raw_number": "+1 555-123-4567",
 *           "type_cd": "other"
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Apollo docs: https://docs.apollo.io/docs/retrieve-mobile-phone-numbers-for-contacts
 */
import { Router } from "express";
import { getContactByApolloPersonId, updateContactPhone } from "../db";

const apolloWebhookRouter = Router();

// Health check — visit /api/apollo-webhook in a browser to confirm the route is live
apolloWebhookRouter.get("/", (_req, res) => {
  res.json({ status: "ok", endpoint: "/api/apollo-webhook", method: "POST", message: "Apollo phone webhook is live." });
});

apolloWebhookRouter.post("/", async (req, res) => {
  try {
    const body = req.body;

    console.log("[Apollo Webhook] Received payload:", JSON.stringify(body, null, 2));

    // Apollo sends an array of people in the "people" field
    const people: Array<{ id?: string; status?: string; phone_numbers?: Array<{ sanitized_number?: string; raw_number?: string }> }> =
      body?.people ?? [];

    if (!people.length) {
      // Fallback: some older Apollo responses may wrap in "person" (singular)
      const person = body?.person;
      if (person?.id) {
        const phone =
          person.sanitized_phone ||
          person.phone_numbers?.[0]?.sanitized_number ||
          person.phone_numbers?.[0]?.raw_number;

        if (phone) {
          const contact = await getContactByApolloPersonId(person.id);
          if (contact) {
            await updateContactPhone(contact.id, phone);
            console.log(`[Apollo Webhook] ✅ (legacy) Updated contact ${contact.id} with phone ${phone}`);
            return res.status(200).json({ received: true, updated: true, contactId: contact.id });
          }
        }
      }

      console.warn("[Apollo Webhook] No people array in payload");
      return res.status(200).json({ received: true, updated: false, reason: "no_people" });
    }

    const results: Array<{ apolloPersonId: string; updated: boolean; reason?: string }> = [];

    for (const person of people) {
      const apolloPersonId = person.id;
      if (!apolloPersonId) {
        results.push({ apolloPersonId: "unknown", updated: false, reason: "no_id" });
        continue;
      }

      const sanitizedPhone =
        person.phone_numbers?.[0]?.sanitized_number ||
        person.phone_numbers?.[0]?.raw_number;

      console.log(`[Apollo Webhook] Person id=${apolloPersonId}, phone=${sanitizedPhone}, status=${person.status}`);

      if (!sanitizedPhone) {
        results.push({ apolloPersonId, updated: false, reason: "no_phone" });
        continue;
      }

      const contact = await getContactByApolloPersonId(apolloPersonId);
      if (!contact) {
        console.warn(`[Apollo Webhook] No contact found for Apollo person ID ${apolloPersonId}`);
        results.push({ apolloPersonId, updated: false, reason: "contact_not_found" });
        continue;
      }

      await updateContactPhone(contact.id, sanitizedPhone);
      console.log(`[Apollo Webhook] ✅ Updated contact ${contact.id} (${contact.fullName}) with phone ${sanitizedPhone}`);
      results.push({ apolloPersonId, updated: true });
    }

    const anyUpdated = results.some((r) => r.updated);
    return res.status(200).json({ received: true, updated: anyUpdated, results });
  } catch (error) {
    console.error("[Apollo Webhook] Error processing callback:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default apolloWebhookRouter;
