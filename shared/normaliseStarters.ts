/**
 * Normalise a conversationStarters array so every item is a plain string.
 * Handles all known LLM output shapes:
 *   - plain string                          → kept as-is
 *   - {opener, sourceUrl, basedOn}          → canonical shape, use opener
 *   - {type, description, conversationStarter} → legacy Grok shape
 *   - {text, ...} or any other object       → best-effort extraction
 */
export function normaliseStartersToStrings(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    if (typeof s === "string") return s;
    if (s && typeof s === "object") {
      return (
        s.opener ??
        s.conversationStarter ??
        s.description ??
        s.text ??
        ""
      );
    }
    return String(s ?? "");
  }).filter(Boolean);
}

/**
 * Normalise the conversationStarters field of a parsed salesApproach object in-place.
 * Safe to call on any salesApproach regardless of shape.
 */
export function normaliseSalesApproach(approach: any): any {
  if (!approach || typeof approach !== "object") return approach;
  if (Array.isArray(approach.conversationStarters)) {
    approach.conversationStarters = approach.conversationStarters.map((s: any) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        return s.opener ?? s.conversationStarter ?? s.description ?? s.text ?? "";
      }
      return String(s ?? "");
    }).filter(Boolean);
  }
  return approach;
}
