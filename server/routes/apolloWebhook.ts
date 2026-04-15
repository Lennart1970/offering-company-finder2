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
import { getContactByApolloPersonId, updateContactPhone, insertWebhookLog } from "../db";

const apolloWebhookRouter = Router();

apolloWebhookRouter.post("/", async (req, res) => {
  const body = req.body;
  const rawPayload = JSON.stringify(body);

  console.log("[Apollo Webhook] Received payload:", rawPayload.slice(0, 500));

  try {
    const creditsConsumed: number = body?.credits_consumed ?? 0;

    // ── Handle people[] array (standard Apollo webhook format) ───────────────
    const people: Array<{
      id?: string;
      status?: string;
      phone_numbers?: Array<{ sanitized_number?: string; raw_number?: string }>;
    }> = Array.isArray(body?.people) ? body.people : [];

    if (people.length > 0) {
      const results: Array<{ apolloPersonId: string; updated: boolean; reason?: string }> = [];

      for (const person of people) {
        const apolloPersonId = person.id ?? "";
        const sanitizedPhone =
          person.phone_numbers?.[0]?.sanitized_number ||
          person.phone_numbers?.[0]?.raw_number;

        console.log(
          `[Apollo Webhook] Person id=${apolloPersonId}, phone=${sanitizedPhone}, status=${person.status}`
        );

        if (!apolloPersonId) {
          await insertWebhookLog({
            apolloStatus: body?.status,
            apolloPersonId: null,
            phoneDelivered: sanitizedPhone ?? null,
            contactId: null,
            contactName: null,
            updated: 0,
            failReason: "no_id",
            peopleCount: people.length,
            creditsConsumed,
            rawPayload,
          });
          results.push({ apolloPersonId: "unknown", updated: false, reason: "no_id" });
          continue;
        }

        if (!sanitizedPhone) {
          await insertWebhookLog({
            apolloStatus: person.status ?? body?.status,
            apolloPersonId,
            phoneDelivered: null,
            contactId: null,
            contactName: null,
            updated: 0,
            failReason: "no_phone",
            peopleCount: people.length,
            creditsConsumed,
            rawPayload,
          });
          results.push({ apolloPersonId, updated: false, reason: "no_phone" });
          continue;
        }

        const contact = await getContactByApolloPersonId(apolloPersonId);
        if (!contact) {
          console.warn(`[Apollo Webhook] No contact found for Apollo person ID ${apolloPersonId}`);
          await insertWebhookLog({
            apolloStatus: person.status ?? body?.status,
            apolloPersonId,
            phoneDelivered: sanitizedPhone,
            contactId: null,
            contactName: null,
            updated: 0,
            failReason: "contact_not_found",
            peopleCount: people.length,
            creditsConsumed,
            rawPayload,
          });
          results.push({ apolloPersonId, updated: false, reason: "contact_not_found" });
          continue;
        }

        await updateContactPhone(contact.id, sanitizedPhone);
        await insertWebhookLog({
          apolloStatus: person.status ?? body?.status,
          apolloPersonId,
          phoneDelivered: sanitizedPhone,
          contactId: contact.id,
          contactName: contact.fullName ?? null,
          updated: 1,
          failReason: null,
          peopleCount: people.length,
          creditsConsumed,
          rawPayload,
        });
        console.log(
          `[Apollo Webhook] ✅ Updated contact ${contact.id} (${contact.fullName}) with phone ${sanitizedPhone}`
        );
        results.push({ apolloPersonId, updated: true });
      }

      const anyUpdated = results.some((r) => r.updated);
      return res.status(200).json({ received: true, updated: anyUpdated, results });
    }

    // ── Fallback: legacy "person" singular format ────────────────────────────
    const person = body?.person;
    if (person?.id) {
      const sanitizedPhone =
        person.sanitized_phone ||
        person.phone_numbers?.[0]?.sanitized_number ||
        person.phone_numbers?.[0]?.raw_number;

      if (sanitizedPhone) {
        const contact = await getContactByApolloPersonId(person.id);
        if (contact) {
          await updateContactPhone(contact.id, sanitizedPhone);
          await insertWebhookLog({
            apolloStatus: body?.status,
            apolloPersonId: person.id,
            phoneDelivered: sanitizedPhone,
            contactId: contact.id,
            contactName: contact.fullName ?? null,
            updated: 1,
            failReason: null,
            peopleCount: 1,
            creditsConsumed,
            rawPayload,
          });
          console.log(`[Apollo Webhook] ✅ (legacy) Updated contact ${contact.id} with phone ${sanitizedPhone}`);
          return res.status(200).json({ received: true, updated: true, contactId: contact.id });
        }
      }
    }

    // ── No recognisable payload ──────────────────────────────────────────────
    console.warn("[Apollo Webhook] No people array or person object in payload");
    await insertWebhookLog({
      apolloStatus: body?.status ?? "unknown",
      apolloPersonId: null,
      phoneDelivered: null,
      contactId: null,
      contactName: null,
      updated: 0,
      failReason: "no_people",
      peopleCount: 0,
      creditsConsumed,
      rawPayload,
    });
    return res.status(200).json({ received: true, updated: false, reason: "no_people" });
  } catch (error) {
    console.error("[Apollo Webhook] Error processing callback:", error);
    // Best-effort audit log even on error
    try {
      await insertWebhookLog({
        apolloStatus: "error",
        apolloPersonId: null,
        phoneDelivered: null,
        contactId: null,
        contactName: null,
        updated: 0,
        failReason: "error",
        peopleCount: 0,
        creditsConsumed: 0,
        rawPayload,
      });
    } catch (_) {
      // ignore secondary failure
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default apolloWebhookRouter;
