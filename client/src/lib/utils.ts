import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips Grok inline citation XML tags from text.
 * e.g. <grok:render type="render_inline_citation"><argument name="citation_id">1</argument></grok:render>
 * becomes an empty string (or optionally a superscript number).
 */
export function stripGrokCitations(text: string | undefined | null): string {
  if (!text) return "";
  // Remove full grok:render XML blocks
  return text
    .replace(/<grok:render[^>]*>[\s\S]*?<\/grok:render>/g, "")
    // Also strip any residual bare XML-like tags from Grok
    .replace(/<\/?grok:[^>]*>/g, "")
    .replace(/<argument[^>]*>[\s\S]*?<\/argument>/g, "")
    .trim();
}
