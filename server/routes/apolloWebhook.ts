/**
 * Apollo Webhook Route
 *
 * Apollo calls this endpoint asynchronously when phone enrichment completes.
 * The payload contains the enriched person data including phone numbers.
 *
 * Apollo docs: https://apolloio.github.io/apollo-api-docs/?shell#people-enrichment
 * The webhook is triggered when reveal_phone_number=true is passed to /api/v1/people/match.
 */
import { Router } from "express";
import { getContactByApolloPersonId, updateContactPhone } from "../db";

const apolloWebhookRouter = Router();

apolloWebhookRouter.post("/", async (req, res) => {
  try {
    const body = req.body;

    // Apollo sends the enriched person object at the top level or nested under "person"
    const person = body?.person ?? body;

    if (!person) {
      console.warn("[Apollo Webhook] Received empty payload");
      return res.status(400).json({ error: "Empty payload" });
    }

    const apolloPersonId: string | undefined = person.id;
    const sanitizedPhone: string | undefined =
      person.sanitized_phone ||
      person.phone_numbers?.[0]?.sanitized_number ||
      person.phone_numbers?.[0]?.raw_number;

    console.log(`[Apollo Webhook] Received callback for person id=${apolloPersonId}, phone=${sanitizedPhone}`);

    if (!apolloPersonId) {
      console.warn("[Apollo Webhook] No person ID in payload");
      return res.status(400).json({ error: "No person ID" });
    }

    if (!sanitizedPhone) {
      console.warn(`[Apollo Webhook] No phone number in payload for person ${apolloPersonId}`);
      // Still 200 so Apollo doesn't retry
      return res.status(200).json({ received: true, updated: false, reason: "no_phone" });
    }

    // Find the contact in our database by Apollo person ID
    const contact = await getContactByApolloPersonId(apolloPersonId);
    if (!contact) {
      console.warn(`[Apollo Webhook] No contact found for Apollo person ID ${apolloPersonId}`);
      return res.status(200).json({ received: true, updated: false, reason: "contact_not_found" });
    }

    // Update the phone and clear the pending flag
    await updateContactPhone(contact.id, sanitizedPhone);
    console.log(`[Apollo Webhook] ✅ Updated contact ${contact.id} (${contact.fullName}) with phone ${sanitizedPhone}`);

    return res.status(200).json({ received: true, updated: true, contactId: contact.id });
  } catch (error) {
    console.error("[Apollo Webhook] Error processing callback:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default apolloWebhookRouter;
