/**
 * Campaign Queue Worker & Router Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Worker status tests ──────────────────────────────────────────────────────

describe("campaignQueueWorker", () => {
  it("getWorkerStatus returns correct shape before start", async () => {
    const { getWorkerStatus } = await import("./campaignQueueWorker");
    const status = getWorkerStatus();
    expect(status).toHaveProperty("running");
    expect(status).toHaveProperty("busy");
    expect(typeof status.running).toBe("boolean");
    expect(typeof status.busy).toBe("boolean");
  });

  it("stopCampaignQueueWorker does not throw when worker is not running", async () => {
    const { stopCampaignQueueWorker } = await import("./campaignQueueWorker");
    expect(() => stopCampaignQueueWorker()).not.toThrow();
  });
});

// ── Queue logic unit tests ───────────────────────────────────────────────────

describe("campaign queue enqueue logic", () => {
  it("filters out companies that already have brief and salesApproach (no forceRefresh)", () => {
    const companies = [
      { id: 1, name: "A", briefData: '{"x":1}', salesApproachData: '{"y":2}', enrichmentStatus: "enriched" },
      { id: 2, name: "B", briefData: null, salesApproachData: null, enrichmentStatus: "enriched" },
      { id: 3, name: "C", briefData: '{"x":1}', salesApproachData: null, enrichmentStatus: "enriched" },
      { id: 4, name: "D", briefData: null, salesApproachData: '{"y":2}', enrichmentStatus: "enriched" },
    ];
    const alreadyQueued = new Set<number>([]);
    const forceRefresh = false;

    const toEnqueue = companies.filter((c) => {
      if (alreadyQueued.has(c.id)) return false;
      if (!forceRefresh && c.briefData && c.salesApproachData) return false;
      return true;
    });

    // Only company 1 is fully processed — the rest need work
    expect(toEnqueue.map((c) => c.id)).toEqual([2, 3, 4]);
  });

  it("includes all companies when forceRefresh is true", () => {
    const companies = [
      { id: 1, name: "A", briefData: '{"x":1}', salesApproachData: '{"y":2}', enrichmentStatus: "enriched" },
      { id: 2, name: "B", briefData: null, salesApproachData: null, enrichmentStatus: "enriched" },
    ];
    const alreadyQueued = new Set<number>([]);
    const forceRefresh = true;

    const toEnqueue = companies.filter((c) => {
      if (alreadyQueued.has(c.id)) return false;
      if (!forceRefresh && c.briefData && c.salesApproachData) return false;
      return true;
    });

    expect(toEnqueue).toHaveLength(2);
  });

  it("skips companies already in the queue (pending/running)", () => {
    const companies = [
      { id: 1, name: "A", briefData: null, salesApproachData: null, enrichmentStatus: "enriched" },
      { id: 2, name: "B", briefData: null, salesApproachData: null, enrichmentStatus: "enriched" },
      { id: 3, name: "C", briefData: null, salesApproachData: null, enrichmentStatus: "enriched" },
    ];
    const alreadyQueued = new Set<number>([1, 3]); // 1 and 3 are already queued
    const forceRefresh = false;

    const toEnqueue = companies.filter((c) => {
      if (alreadyQueued.has(c.id)) return false;
      if (!forceRefresh && c.briefData && c.salesApproachData) return false;
      return true;
    });

    expect(toEnqueue.map((c) => c.id)).toEqual([2]);
  });

  it("returns empty array when all companies are already queued", () => {
    const companies = [
      { id: 1, name: "A", briefData: null, salesApproachData: null, enrichmentStatus: "enriched" },
    ];
    const alreadyQueued = new Set<number>([1]);
    const forceRefresh = false;

    const toEnqueue = companies.filter((c) => {
      if (alreadyQueued.has(c.id)) return false;
      if (!forceRefresh && c.briefData && c.salesApproachData) return false;
      return true;
    });

    expect(toEnqueue).toHaveLength(0);
  });
});

// ── Estimated time calculation ───────────────────────────────────────────────

describe("queue estimated time", () => {
  it("calculates 5 minutes per pending + running job", () => {
    const pending = 10;
    const running = 1;
    const estimatedMinutes = (pending + running) * 5;
    expect(estimatedMinutes).toBe(55);
  });

  it("returns 0 when queue is empty", () => {
    const pending = 0;
    const running = 0;
    const estimatedMinutes = (pending + running) * 5;
    expect(estimatedMinutes).toBe(0);
  });
});

// ── Job staleness detection ──────────────────────────────────────────────────

describe("brief staleness check", () => {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  it("marks brief as stale if older than 7 days", () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    const isStale = Date.now() - new Date(oldDate).getTime() >= sevenDaysMs;
    expect(isStale).toBe(true);
  });

  it("marks brief as fresh if within 7 days", () => {
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const isStale = Date.now() - new Date(recentDate).getTime() >= sevenDaysMs;
    expect(isStale).toBe(false);
  });

  it("considers missing briefGeneratedAt as needing refresh", () => {
    const briefGeneratedAt: Date | null = null;
    const needsBrief = !briefGeneratedAt || Date.now() - new Date(briefGeneratedAt).getTime() >= sevenDaysMs;
    expect(needsBrief).toBe(true);
  });
});
