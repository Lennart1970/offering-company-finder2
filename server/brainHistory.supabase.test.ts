import { describe, expect, it } from "vitest";

/**
 * Unit tests for the getBrainHistory Supabase merge logic.
 * Tests the normalization and deduplication logic in isolation.
 */

type BrainEntry = {
  id: string;
  brainName: string;
  companyName: string;
  status: string;
  isActive: number;
  isShared: number;
  userId: number;
  isSupabase: boolean;
  showOnLeadtrigger: number;
  createdAt: Date | null;
};

// Simulate the normalization logic from getBrainHistory
function mergeLocalAndSupabaseBrains(
  localBrains: Array<{ id: number; brainName: string; companyName: string; status: string; isActive?: number; isShared?: number; userId: number; showOnLeadtrigger?: number; createdAt?: Date | null }>,
  supabaseBrains: Array<{ id: string | number; brain_name: string; company_name: string; status: string; is_active?: boolean; is_shared?: boolean; user_id?: number; show_on_leadtrigger?: boolean; created_at?: string | null }>,
  currentUserId: number
): BrainEntry[] {
  // Normalize local brains
  const localNormalized: BrainEntry[] = localBrains.map((b) => ({
    id: String(b.id),
    brainName: b.brainName,
    companyName: b.companyName,
    status: b.status,
    isActive: b.isActive ?? 0,
    isShared: b.isShared ?? 0,
    userId: b.userId,
    isSupabase: false,
    showOnLeadtrigger: b.showOnLeadtrigger ?? 1,
    createdAt: b.createdAt ?? null,
  }));

  // Deduplicate: exclude Supabase brains already in local
  const localIds = new Set(localBrains.map((b) => String(b.id)));
  const supabaseNormalized: BrainEntry[] = supabaseBrains
    .filter((b) => !localIds.has(String(b.id)))
    .map((b) => ({
      id: String(b.id),
      brainName: b.brain_name ?? "Unnamed Brain",
      companyName: b.company_name ?? "",
      status: b.status ?? "completed",
      isActive: b.is_active ? 1 : 0,
      isShared: b.is_shared ? 1 : 0,
      userId: b.user_id ?? currentUserId,
      isSupabase: true,
      showOnLeadtrigger: b.show_on_leadtrigger ? 1 : 0,
      createdAt: b.created_at ? new Date(b.created_at) : null,
    }));

  return [...localNormalized, ...supabaseNormalized];
}

const localBrains = [
  { id: 1, brainName: "Connect Group - Industrial Electronics ICP", companyName: "Connect Group", status: "completed", isActive: 1, isShared: 1, userId: 42, showOnLeadtrigger: 1 },
  { id: 2, brainName: "Build4Performance - Race Simulators", companyName: "Build4Performance", status: "completed", isActive: 0, isShared: 0, userId: 42, showOnLeadtrigger: 1 },
];

const supabaseBrains = [
  { id: "1", brain_name: "Connect Group - Industrial Electronics ICP", company_name: "Connect Group", status: "completed", is_active: true, is_shared: true, user_id: 42, show_on_leadtrigger: true },
  { id: "insertchat-branded-ai", brain_name: "InsertChat Branded AI Assistant", company_name: "InsertChat", status: "completed", is_active: false, is_shared: true, user_id: 42, show_on_leadtrigger: true },
  { id: "210001", brain_name: "Marktlink M&A Advisory", company_name: "Marktlink", status: "completed", is_active: false, is_shared: true, user_id: 42, show_on_leadtrigger: true },
];

describe("getBrainHistory merge logic", () => {
  it("returns all local brains normalized as strings", () => {
    const result = mergeLocalAndSupabaseBrains(localBrains, [], 42);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
    expect(result.every((b) => !b.isSupabase)).toBe(true);
  });

  it("deduplicates brains already in local (by string ID comparison)", () => {
    const result = mergeLocalAndSupabaseBrains(localBrains, supabaseBrains, 42);
    // ID "1" is in both local and Supabase — should appear only once (from local)
    const id1Entries = result.filter((b) => b.id === "1");
    expect(id1Entries).toHaveLength(1);
    expect(id1Entries[0].isSupabase).toBe(false);
  });

  it("adds Supabase-only brains after local brains", () => {
    const result = mergeLocalAndSupabaseBrains(localBrains, supabaseBrains, 42);
    // Total: 2 local + 2 Supabase-only (insertchat-branded-ai, 210001)
    expect(result).toHaveLength(4);
    const supabaseOnly = result.filter((b) => b.isSupabase);
    expect(supabaseOnly).toHaveLength(2);
    expect(supabaseOnly.map((b) => b.id).sort()).toEqual(["210001", "insertchat-branded-ai"]);
  });

  it("normalizes Supabase brain fields correctly", () => {
    const result = mergeLocalAndSupabaseBrains([], supabaseBrains, 42);
    const insertChat = result.find((b) => b.id === "insertchat-branded-ai");
    expect(insertChat).toBeDefined();
    expect(insertChat!.brainName).toBe("InsertChat Branded AI Assistant");
    expect(insertChat!.isActive).toBe(0);
    expect(insertChat!.isShared).toBe(1);
    expect(insertChat!.isSupabase).toBe(true);
  });

  it("preserves local brain isActive status", () => {
    const result = mergeLocalAndSupabaseBrains(localBrains, [], 42);
    expect(result.find((b) => b.id === "1")?.isActive).toBe(1);
    expect(result.find((b) => b.id === "2")?.isActive).toBe(0);
  });

  it("handles empty local and empty Supabase gracefully", () => {
    const result = mergeLocalAndSupabaseBrains([], [], 42);
    expect(result).toHaveLength(0);
  });

  it("local brains appear before Supabase-only brains", () => {
    const result = mergeLocalAndSupabaseBrains(localBrains, supabaseBrains, 42);
    const firstSupabaseIndex = result.findIndex((b) => b.isSupabase);
    const lastLocalIndex = result.map((b) => !b.isSupabase).lastIndexOf(true);
    expect(lastLocalIndex).toBeLessThan(firstSupabaseIndex);
  });
});
