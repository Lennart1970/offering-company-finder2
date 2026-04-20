import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import CompanyDecisionButtons from "@/components/CompanyDecisionButtons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";
import BrainBadge from "@/components/BrainBadge";
import { normaliseSalesApproach } from "@shared/normaliseStarters";

// Format revenue to human-readable string
function formatRevenue(revenue: number | string | null): string {
  if (!revenue) return "—";
  const num = typeof revenue === "string" ? parseFloat(revenue) : revenue;
  if (isNaN(num)) return String(revenue);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

// Format employee count
function formatEmployees(count: number | string | null): string {
  if (!count) return "—";
  const num = typeof count === "string" ? parseInt(count, 10) : count;
  if (isNaN(num)) return String(count);
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export default function SearchResults() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const toggleShare = trpc.companyFinder.toggleShareSearch.useMutation({
    onSuccess: (data) => {
      toast.success(data.shared ? "Campaign shared with team" : "Campaign is now private");
      utils.companyFinder.getSearchHistory.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const [location, navigate] = useLocation();
  const params = useParams<{ searchId: string }>();
  const searchIdParam = params.searchId;

  const isSelectMode = searchIdParam === "select" || !searchIdParam;
  const searchId = isSelectMode ? null : parseInt(searchIdParam, 10);

  // When navigated from Sales Menu, hide all header chrome — show only the company list
  const fromSalesMenu = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "sales-menu";

  // Active brain — used for mismatch detection in BrainBadge
  const { data: activeBrainData } = trpc.companyFinder.getActiveBrain.useQuery();
  const activeBrain = activeBrainData?.brain ?? null;
  // Brain selector — lets user pick which brain to use for DO 10 / DO ALL
  const { data: brainHistoryData } = trpc.companyFinder.getBrainHistory.useQuery();
  const availableBrains = (brainHistoryData?.history ?? []).filter((b: any) => b.status === "completed");
  const [selectedBrainId, setSelectedBrainId] = useState<number | undefined>(undefined);
  // Auto-select active brain once loaded
  useEffect(() => {
    if (activeBrain && selectedBrainId === undefined) {
      setSelectedBrainId(activeBrain.id);
    }
  }, [activeBrain?.id]);
  const selectedBrain = availableBrains.find((b: any) => b.id === selectedBrainId) ?? activeBrain;

  const [page, setPage] = useState(0);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);

  const { data: searchData, isLoading: searchLoading } = trpc.companyFinder.getSearch.useQuery(
    { searchId: searchId!, page, pageSize: 2000 },
    {
      enabled: !!searchId,
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.search.status === "completed" || data?.search.status === "failed" ? false : 5000;
      },
    }
  );

  // Accumulate companies across pages
  useEffect(() => {
    if (!searchData?.companies) return;
    if (page === 0) {
      setAllCompanies(searchData.companies as any);
    } else {
      setAllCompanies((prev) => {
        const existingIds = new Set(prev.map((c: any) => c.id));
        const newOnes = (searchData.companies as any[]).filter((c: any) => !existingIds.has(c.id));
        return [...prev, ...newOnes];
      });
    }
  }, [searchData?.companies, page]);

  // Reset accumulated companies when search changes
  useEffect(() => {
    setPage(0);
    setAllCompanies([]);
  }, [searchId]);

  const [showArchived, setShowArchived] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { data: searchHistory, refetch: refetchHistory } = trpc.companyFinder.getSearchHistory.useQuery({ showArchived });

  // Derive unique users from search history for the user filter
  const uniqueUsers = useMemo(() => {
    if (!searchHistory) return [];
    const seen = new Map<number, { id: number; name: string | null; email: string | null }>();
    for (const s of searchHistory as any[]) {
      if (!seen.has(s.userId)) {
        seen.set(s.userId, { id: s.userId, name: s.userName, email: s.userEmail });
      }
    }
    return Array.from(seen.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [searchHistory]);

  // Filtered search history based on selected user
  const filteredSearchHistory = useMemo(() => {
    if (!searchHistory) return [];
    if (selectedUserId === null) return searchHistory as any[];
    return (searchHistory as any[]).filter((s: any) => s.userId === selectedUserId);
  }, [searchHistory, selectedUserId]);
  const archiveSearchMutation = trpc.companyFinder.archiveSearch.useMutation({
    onSuccess: () => { refetchHistory(); },
    onError: (err) => toast.error(err.message),
  });

  // ── Campaign Queue ──────────────────────────────────────────────────────────
  const [queueingSearchId, setQueueingSearchId] = useState<number | null>(null);
  const enqueueSearch = trpc.campaignQueue.enqueueSearch.useMutation({
    onSuccess: (data, vars) => {
      toast.success(data.message);
      setQueueingSearchId(null);
      utils.campaignQueue.getQueueStatus.invalidate({ searchId: vars.searchId });
      utils.campaignQueue.getQueueStatus.invalidate({});
    },
    onError: (err) => { toast.error(err.message); setQueueingSearchId(null); },
  });
  const cancelQueue = trpc.campaignQueue.cancelSearch.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`${data.cancelled} jobs cancelled`);
      utils.campaignQueue.getQueueStatus.invalidate({ searchId: vars.searchId });
      utils.campaignQueue.getQueueStatus.invalidate({});
    },
    onError: (err) => toast.error(err.message),
  });
  // Global queue status — polls every 30s to update all campaign cards
  const { data: globalQueueStatus } = trpc.campaignQueue.getQueueStatus.useQuery(
    {},
    { refetchInterval: 30_000 }
  );
  const { data: excludedCodes } = trpc.companyFinder.getExcludedCodes.useQuery();

  // Leadinfo — fetch matched company IDs for this campaign
  const { data: leadinfoCompanyIds } = trpc.leadinfo.getMatchedCompanyIds.useQuery(
    { searchId: searchId! },
    { enabled: !!searchId }
  );
  const leadinfoSet = useMemo(() => new Set(leadinfoCompanyIds || []), [leadinfoCompanyIds]);

  const [excludedSectors, setExcludedSectors] = useState<string[]>([]);
  const [showCallTodayOnly, setShowCallTodayOnly] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "urgency" | "fit_urgency">("urgency");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [enrichmentFilter, setEnrichmentFilter] = useState<"all" | "enriched" | "pending" | "outreach" | "visitors">("all");
  const [urgencyCtaAdded, setUrgencyCtaAdded] = useState(false);
  const [quickViewCompanyId, setQuickViewCompanyId] = useState<number | null>(null);
  const [quickViewMode, setQuickViewMode] = useState<"research" | "approach" | null>(null);
  // Lazy-fetch full company data (including briefData/salesApproachData) when quick-view modal opens
  const { data: quickViewCompanyFull } = trpc.companyFinder.getCompany.useQuery(
    { companyId: quickViewCompanyId! },
    { enabled: !!quickViewCompanyId }
  );

  useEffect(() => {
    if (searchData?.search.excludedSectors) {
      try {
        setExcludedSectors(JSON.parse(searchData.search.excludedSectors));
      } catch {}
    }
  }, [searchData?.search.excludedSectors]);

  // Fire-and-forget doNext10: returns jobId immediately, we poll for progress
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // On page load, check if there's an actively running job for this search so
  // we can resume polling without losing visibility after a page reload.
  const latestJobQuery = trpc.companyFinder.getLatestJob.useQuery(
    { searchId: searchId! },
    { enabled: !!searchId && !activeJobId }
  );
  useEffect(() => {
    // Server-side getLatestJob already filters to running-only jobs
    // so any returned jobId is safe to resume polling
    if (latestJobQuery.data?.jobId && !activeJobId) {
      setActiveJobId(latestJobQuery.data.jobId);
    }
  }, [latestJobQuery.data?.jobId]);

  const jobStatusQuery = trpc.companyFinder.getJobStatus.useQuery(
    { jobId: activeJobId! },
    {
      enabled: !!activeJobId,
      // Keep polling at 3s while running; slow to 1s after a terminal status
      // so the useEffect always gets one more tick to clear activeJobId.
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data || data.status === "running") return 3000;
        // Terminal status — one more fast tick then the useEffect clears activeJobId
        return 1000;
      },
    }
  );

  // When job completes/cancels, show toast and refresh
  useEffect(() => {
    const job = jobStatusQuery.data;
    if (!job) return;
    const label = job.jobType === "doAll" ? "DO ALL" : "DO 10";
    if (job.status === "done") {
      const s = job.stats;
      const parts: string[] = [];
      if (s.enriched > 0) parts.push(`${s.enriched} enriched`);
      if (s.researched > 0) parts.push(`${s.researched} researched`);
      if (s.approached > 0) parts.push(`${s.approached} approached`);
      if (s.failed > 0) parts.push(`${s.failed} failed`);
      const summary = parts.length > 0 ? parts.join(" · ") : "Nothing to do";
      const remaining = s.remaining > 0 ? ` — ${s.remaining} still pending` : " — all done!";
      toast.success(`${label}: ${summary}${remaining}`);
      setActiveJobId(null);
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
    } else if (job.status === "error") {
      toast.error(`${label} failed: ${job.error ?? "Unknown error"}`);
      setActiveJobId(null);
    } else if (job.status === "cancelled") {
      toast.info(`${label} cancelled`);
      setActiveJobId(null);
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
    } else if ((job.status as string) === "failed") {
      // Job was killed by a server restart — clear state so the button re-enables
      setActiveJobId(null);
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
    }
  }, [jobStatusQuery.data?.status]);

  const selectedBrainIdForMutation = selectedBrainId ?? activeBrain?.id;
  const doNext10Mutation = trpc.companyFinder.doNext10.useMutation({
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
    },
    onError: (error) => {
      toast.error(`DO 10 failed: ${error.message}`);
    },
  });

  const doAllMutation = trpc.companyFinder.doAll.useMutation({
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast.info("DO ALL started — processing all remaining companies in the background");
    },
    onError: (error) => {
      toast.error(`DO ALL failed: ${error.message}`);
    },
  });

  const syncToSupabaseMutation = trpc.companyFinder.syncToSupabase.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ Synced to Supabase: ${data.companiesSynced} companies, ${data.contactsSynced} contacts, ${data.brainsSynced} brains`);
    },
    onError: (error) => {
      toast.error(`Supabase sync failed: ${error.message}`);
    },
  });

  const batchContactsMutation = trpc.companyFinder.batchFindDecisionMakers.useMutation({
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast.info("Finding decision makers for all companies with urgency ≥ 50 — running in background");
    },
    onError: (error) => {
      toast.error(`Batch contacts failed: ${error.message}`);
    },
  });

  const cancelJobMutation = trpc.companyFinder.cancelJob.useMutation({
    onSuccess: () => {
      // Status update handled by the polling effect above
    },
    onError: (error) => {
      toast.error(`Cancel failed: ${error.message}`);
    },
  });

  const isJobRunning = (doNext10Mutation.isPending || doAllMutation.isPending || batchContactsMutation.isPending) ||
    (!!activeJobId && jobStatusQuery.data?.status === "running");
  // Keep the old name for compatibility with existing JSX references
  const isDoNext10Running = isJobRunning;

  const submitDecisionMutation = trpc.companyFinder.submitDecision.useMutation({
    onSuccess: () => {
      utils.companyFinder.getSearch.invalidate({ searchId: searchId! });
    },
  });



  const exportCsvQuery = trpc.companyFinder.exportCsv.useQuery(
    { searchId: searchId! },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    if (!searchId) return;
    const result = await exportCsvQuery.refetch();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `companies-${searchId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    }
  };

  const handleExportSharePoint = async () => {
    if (!searchId) return;
    toast.success("Preparing SharePoint export...");
    try {
      const res = await fetch(`/api/export-excel?searchId=${searchId}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-intelligence-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("SharePoint Excel downloaded — ready to upload to your document library");
    } catch {
      toast.error("Export failed — please try again");
    }
  };

  const excludedSicSet = useMemo(() => {
    if (!excludedCodes) return new Set<string>();
    return new Set(excludedCodes.filter((c) => c.codeType === "sic").map((c) => c.code));
  }, [excludedCodes]);

  const excludedNaicsSet = useMemo(() => {
    if (!excludedCodes) return new Set<string>();
    return new Set(excludedCodes.filter((c) => c.codeType === "naics").map((c) => c.code));
  }, [excludedCodes]);

  const excludedSectorsSet = useMemo(() => new Set(excludedSectors), [excludedSectors]);

  const { filteredCompanies, excludedCompanies, callTodayCompanies } = useMemo(() => {
    if (!allCompanies.length && !searchData?.companies) return { filteredCompanies: [], excludedCompanies: [], callTodayCompanies: [] };

    const filtered: any[] = [];
    const excluded: any[] = [];

    for (const company of allCompanies) {
      let isExcluded = false;

      if (company.naicsCodes && excludedSectorsSet.size > 0) {
        try {
          const codes: string[] = JSON.parse(company.naicsCodes);
          if (codes.some((c) => excludedSectorsSet.has(c.substring(0, 2)))) {
            isExcluded = true;
          }
        } catch {}
      }

      if (!isExcluded && company.enrichmentStatus === "enriched") {
        if (company.sicCodes) {
          try {
            const codes: string[] = JSON.parse(company.sicCodes);
            if (codes.some((c) => excludedSicSet.has(c))) {
              isExcluded = true;
            }
          } catch {}
        }

        if (!isExcluded && company.naicsCodes) {
          try {
            const codes: string[] = JSON.parse(company.naicsCodes);
            if (codes.some((c) => excludedNaicsSet.has(c))) {
              isExcluded = true;
            }
          } catch {}
        }
      }

      if (isExcluded) {
        excluded.push(company);
      } else {
        filtered.push(company);
      }
    }

    const callToday = filtered.filter(c => {
      const decision = searchData?.decisions?.find((d: any) => d.companyId === c.id);
      return decision?.decision === 'call_today';
    });

    return { filteredCompanies: filtered, excludedCompanies: excluded, callTodayCompanies: callToday };
  }, [allCompanies, searchData?.decisions, excludedSicSet, excludedNaicsSet, excludedSectorsSet]);

  const enrichmentFiltered = useMemo(() => {
    if (enrichmentFilter === "enriched") return filteredCompanies.filter(c => c.enrichmentStatus === "enriched");
    if (enrichmentFilter === "pending") return filteredCompanies.filter(c => c.enrichmentStatus === "pending" || c.enrichmentStatus === "failed");
    if (enrichmentFilter === "outreach") return filteredCompanies.filter(c => !!c.salesApproachData);
    if (enrichmentFilter === "visitors") return filteredCompanies.filter(c => leadinfoSet.has(c.id));
    return filteredCompanies;
  }, [filteredCompanies, enrichmentFilter, leadinfoSet]);

  const baseDisplayed = showCallTodayOnly ? callTodayCompanies : enrichmentFiltered;

  // Site visitor boost: a company that visited your website is the hottest lead.
  // We add a massive flat bonus (50 points) to the sort score for site visitors.
  // This means even a moderate-fit site visitor outranks a high-fit non-visitor.
  const SITE_VISITOR_BONUS = 50;

  const displayedCompanies = useMemo(() => {
    const sorted = [...baseDisplayed];

    const visitorBoost = (c: any) => leadinfoSet.has(c.id) ? SITE_VISITOR_BONUS : 0;

    if (sortBy === "urgency") {
      sorted.sort((a: any, b: any) => {
        const scoreA = (a.urgencyScore || 0) + visitorBoost(a);
        const scoreB = (b.urgencyScore || 0) + visitorBoost(b);
        return scoreB - scoreA;
      });
    } else if (sortBy === "fit_urgency") {
      sorted.sort((a: any, b: any) => {
        const baseA = (a.urgencyScore || 0) * (a.fitScore || a.urgencyScore || 0);
        const baseB = (b.urgencyScore || 0) * (b.fitScore || b.urgencyScore || 0);
        // Visitor bonus: add 50% of max possible score (100*100 = 10000, so +5000)
        const scoreA = baseA + (leadinfoSet.has(a.id) ? 5000 : 0);
        const scoreB = baseB + (leadinfoSet.has(b.id) ? 5000 : 0);
        return scoreB - scoreA;
      });
    } else {
      // "default" = import order, but still float site visitors to the top
      if (leadinfoSet.size > 0) {
        sorted.sort((a: any, b: any) => {
          const va = leadinfoSet.has(a.id) ? 1 : 0;
          const vb = leadinfoSet.has(b.id) ? 1 : 0;
          return vb - va;
        });
      }
    }
    return sorted;
  }, [baseDisplayed, sortBy, leadinfoSet]);

  // High-urgency companies not yet in Call Today list
  const highUrgencyNotCalled = useMemo(() => {
    if (!allCompanies.length || !searchData?.decisions) return [];
    const callTodayIds = new Set(
      searchData.decisions
        .filter((d: any) => d.decision === "call_today")
        .map((d: any) => d.companyId)
    );
    return allCompanies
      .filter((c: any) => (c.urgencyScore || 0) >= 70 && !callTodayIds.has(c.id))
      .sort((a: any, b: any) => (b.urgencyScore || 0) - (a.urgencyScore || 0));
  }, [allCompanies, searchData?.decisions]);

  const addAllHighUrgencyToCallToday = async () => {
    if (!searchId || highUrgencyNotCalled.length === 0) return;
    for (const company of highUrgencyNotCalled) {
      await utils.companyFinder.getSearch.cancel();
      submitDecisionMutation.mutate({ companyId: company.id, searchId: searchId!, decision: "call_today" });
    }
    setUrgencyCtaAdded(true);
    toast.success(`${highUrgencyNotCalled.length} high-urgency companies added to Call Today`);
  };

  // Remaining work = pending + no-brief + no-approach (must be before early returns)
  const remainingWorkBreakdown = useMemo(() => {
    const pendingEnrich = allCompanies.filter((c: any) => c.enrichmentStatus === "pending").length;
    const needsBrief = allCompanies.filter((c: any) => c.enrichmentStatus === "enriched" && !c.briefData).length;
    const needsApproach = allCompanies.filter((c: any) => c.enrichmentStatus === "enriched" && !!c.briefData && !c.salesApproachData).length;
    const total = allCompanies.filter(
      (c: any) => c.enrichmentStatus === "pending" || !c.briefData || !c.salesApproachData
    ).length;
    return { pendingEnrich, needsBrief, needsApproach, total };
  }, [allCompanies]);
  const remainingWork = remainingWorkBreakdown.total;

  // Search selector mode
  if (isSelectMode) {
    return (
      <div className="max-w-5xl">
        <div className="mb-12">
          <div className="text-xs font-black text-muted-foreground mb-2">[03] COCKPIT</div>
          <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
            SEARCH<br />RESULTS
          </h1>
          <p className="text-lg font-bold text-muted-foreground max-w-2xl">
            Select a completed search to view and manage company results.
          </p>
        </div>

        {/* Global Queue Status Banner */}
        {globalQueueStatus && (globalQueueStatus.pending > 0 || globalQueueStatus.running > 0) && (
          <div className="mb-4 border-2 border-blue-600 bg-blue-50 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-blue-700 font-black text-sm animate-pulse">⚡ QUEUE ACTIVE</span>
              <span className="text-blue-800 text-sm font-bold">
                {globalQueueStatus.running > 0 && (
                  <span className="mr-3">▶ Processing: <strong>{globalQueueStatus.currentCompany ?? "..."}</strong></span>
                )}
                {globalQueueStatus.pending > 0 && (
                  <span>{globalQueueStatus.pending} pending — ~{globalQueueStatus.estimatedMinutes} min remaining · Enrich → Score → Brief → Approach</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-600 font-bold">✓ {globalQueueStatus.completed} done</span>
              {globalQueueStatus.failed > 0 && (
                <span className="text-xs text-red-600 font-bold">✗ {globalQueueStatus.failed} failed</span>
              )}
            </div>
          </div>
        )}

        {/* Filter bar: user filter + archived toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* User filter chips */}
          {uniqueUsers.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              <span className="text-xs font-bold text-muted-foreground mr-1">USER:</span>
              <button
                onClick={() => setSelectedUserId(null)}
                className={`text-xs font-black border px-2.5 py-0.5 transition-colors ${
                  selectedUserId === null
                    ? "border-gray-900 text-gray-900 bg-gray-100"
                    : "border-gray-300 text-gray-400 hover:border-gray-600 hover:text-gray-700"
                }`}
              >
                ALL
              </button>
              {uniqueUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                  className={`text-xs font-black border px-2.5 py-0.5 transition-colors ${
                    selectedUserId === u.id
                      ? "border-blue-600 text-blue-700 bg-blue-50"
                      : "border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600"
                  }`}
                  title={u.email ?? undefined}
                >
                  {u.name ?? u.email ?? `User #${u.id}`}
                </button>
              ))}
            </div>
          )}
          {/* Archived toggle */}
          <button
            onClick={() => setShowArchived(v => !v)}
            className={`text-xs font-black border px-3 py-1 transition-colors ml-auto ${
              showArchived
                ? "border-amber-500 text-amber-600 bg-amber-50"
                : "border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700"
            }`}
          >
            {showArchived ? "↑ HIDE ARCHIVED" : "↓ SHOW ARCHIVED"}
          </button>
        </div>

        {filteredSearchHistory && filteredSearchHistory.length > 0 ? (
          <div className="space-y-3">
            {filteredSearchHistory
              .filter((s: any) => s.status === "completed" || s.status === "searching")
              .map((search: any) => (
                <div
                  key={search.id}
                  className="border-4 border-black p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/search-results/${search.id}`)}
                    >
                      <div className="text-lg font-black">{search.offeringName || "Untitled"}</div>
                      <div className="text-sm font-bold text-muted-foreground mt-1">
                        {search.location} — {new Date(search.createdAt).toLocaleDateString()} — Run #{search.id}
                      </div>
                      {(search as any).brainName && (
                        <div className="mt-1.5">
                          <span className="text-xs font-black border-2 border-purple-600 text-purple-700 bg-purple-50 px-2 py-0.5">
                            🧠 {(search as any).brainName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Queue Research button — enqueue all unprocessed companies for background deep research */}
                      {search.userId === user?.id && search.status === "completed" && (() => {
                        const qStatus = (globalQueueStatus as any)?.[search.id];
                        const isPending = queueingSearchId === search.id;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQueueingSearchId(search.id);
                              enqueueSearch.mutate({ searchId: search.id, jobType: "full" });
                            }}
                            disabled={isPending || enqueueSearch.isPending}
                            className="text-xs font-black border-2 px-3 py-1 transition-colors border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white disabled:opacity-40"
                            title="Queue all companies for automated full pipeline: Enrich → Fit Score → Deep Research Brief → Sales Approach (1 per 5 min)"
                          >
                            {isPending ? "QUEUING..." : "⚡ FULL PIPELINE"}
                          </button>
                        );
                      })()}
                      {/* Archive button — owner or admin can archive/restore */}
                      {(search.userId === user?.id || (user as any)?.role === 'admin') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveSearchMutation.mutate({ searchId: search.id, archive: !search.isArchived });
                          }}
                          disabled={archiveSearchMutation.isPending}
                          className={`text-xs font-black border px-3 py-1 transition-colors disabled:opacity-40 ${
                            search.isArchived
                              ? "border-amber-500 text-amber-600 bg-amber-50 hover:bg-amber-100"
                              : "border-gray-300 text-gray-400 hover:border-amber-400 hover:text-amber-600"
                          }`}
                          title={search.isArchived ? "Archived — click to restore" : "Archive this run"}
                        >
                          {search.isArchived ? "↩ RESTORE" : "ARCHIVE"}
                        </button>
                      )}
                      {/* Share toggle — only owner sees it */}
                      {(search.userId === user?.id || (user as any)?.role === 'admin') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleShare.mutate({ searchId: search.id, shared: !search.sharedWithTeam });
                          }}
                          className={`text-xs font-black border-2 px-3 py-1 transition-colors ${
                            search.sharedWithTeam
                              ? "border-gray-900 text-gray-900 bg-gray-100"
                              : "border-gray-400 text-gray-400 hover:border-gray-700 hover:text-gray-700"
                          }`}
                          title={search.sharedWithTeam ? "Shared with team — click to make private" : "Private — click to share with team"}
                        >
                          {search.sharedWithTeam ? "SHARED" : "PRIVATE"}
                        </button>
                      )}
                      {/* Shared badge for non-owners viewing a shared campaign */}
                      {search.userId !== user?.id && search.sharedWithTeam && (
                        <span className="text-xs font-black border-2 px-3 py-1 border-gray-700 text-gray-700">
                          SHARED
                        </span>
                      )}
                      {/* Owner name badge — shown when viewing other users' searches */}
                      {search.userId !== user?.id && (search as any).userName && (
                        <span className="text-xs font-bold border px-2 py-0.5 border-blue-300 text-blue-600 bg-blue-50" title={(search as any).userEmail ?? undefined}>
                          {(search as any).userName}
                        </span>
                      )}
                      <span className={`text-xs font-black border-2 px-3 py-1 ${
                        search.status === "completed" ? "border-gray-900 text-gray-900" :
                        search.status === "searching" ? "border-gray-700 text-gray-700" :
                        "border-black"
                      }`}>
                        {search.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="border-4 border-black p-12 text-center">
            <div className="text-2xl font-black mb-4">NO COMPLETED SEARCHES</div>
            <div className="text-lg font-bold text-muted-foreground mb-6">
              Run a search from the Search Scenario screen first.
            </div>
            <Button
              onClick={() => navigate("/search-scenario")}
              className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white"
            >
              [GO TO SEARCH SCENARIO →]
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (searchLoading) {
    return (
      <div className="max-w-5xl">
        <div className="border-4 border-black p-12 animate-pulse">
          <div className="text-2xl font-black">→ LOADING RESULTS...</div>
        </div>
      </div>
    );
  }

  if (!searchData) {
    return (
      <div className="max-w-5xl">
        <div className="border-4 border-red-600 p-12 text-center">
          <div className="text-2xl font-black text-red-600 mb-4">SEARCH NOT FOUND</div>
          <Button onClick={() => navigate("/search-results/select")} variant="outline" className="font-black border-2 border-black">
            ← BACK TO SEARCH LIST
          </Button>
        </div>
      </div>
    );
  }

  const enrichmentStats = searchData.enrichmentStats;

  // Dynamic hero sentence — the main message for sales reps
  const sourceType = searchData.search.location || "import";
  const campaignName = searchData.search.offeringName || "this campaign";
  const totalCount = filteredCompanies.length;
  const enrichedCount = enrichmentStats?.enriched ?? 0;
  const outreachReadyCount = enrichmentStats?.outreachReady ?? 0;
  const researchedCount = allCompanies.filter((c: any) => !!c.briefData).length;



  const heroSentence = (() => {
    if (enrichmentFilter === "outreach") {
      return (
        <>
          <strong>{outreachReadyCount} companies</strong> are ready to contact — research done, outreach script written.
          {" "}Open any card below to copy your email, LinkedIn message, or call script.
        </>
      );
    }
    if (enrichmentFilter === "enriched") {
      if (researchedCount > 0) {
        return (
          <>
            <strong>{enrichedCount} companies</strong> from <strong>{campaignName}</strong> found in Apollo —{" "}
            <strong>{researchedCount}</strong> already have a research brief.
            {" "}Press <strong
              className="cursor-pointer underline decoration-dotted hover:text-gray-600 transition-colors"
              onClick={() => doNext10Mutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
            >[DO 10]</strong>{" "}
            to process the next 10 companies.
          </>
        );
      }
      return (
        <>
          <strong>{enrichedCount} companies</strong> from <strong>{campaignName}</strong> found in Apollo and ready to work.
          {" "}Press <strong
              className="cursor-pointer underline decoration-dotted hover:text-gray-600 transition-colors"
              onClick={() => doNext10Mutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
            >[DO 10]</strong>{" "}
            to research and write outreach scripts for the next 10.
        </>
      );
    }
    if (enrichmentFilter === "pending") {
      return (
        <>
          <strong>{enrichmentStats?.pending ?? 0} companies</strong> were not found in Apollo yet.
          {" "}Press <strong
              className="cursor-pointer underline decoration-dotted hover:text-gray-600 transition-colors"
              onClick={() => doNext10Mutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
            >[DO 10]</strong>{" "}
            to enrich the next 10 companies.
        </>
      );
    }
    // Default: all — smart entry point based on campaign state
    if (outreachReadyCount > 0) {
      return (
        <>
          <strong>{outreachReadyCount} of {totalCount} companies</strong> from <strong>{campaignName}</strong> are ready for outreach.
          {" "}Press <span className="cursor-pointer underline decoration-dotted hover:opacity-70 transition-opacity font-black" onClick={() => setEnrichmentFilter("outreach")}>OUTREACH READY</span> to go straight to your scripts, or press{" "}
            <strong
              className="cursor-pointer underline decoration-dotted hover:text-gray-600 transition-colors"
              onClick={() => doNext10Mutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
            >[DO 10]</strong>{" "}
            to process the next 10 remaining companies.
        </>
      );
    }
    if (enrichedCount > 0) {
      return (
        <>
          <strong>{enrichedCount} of {totalCount} companies</strong> from <strong>{campaignName}</strong> ({sourceType}) are enriched and ready.
          {" "}Press <strong>ENRICHED</strong> to see them, then hit{" "}
            <strong
              className="cursor-pointer underline decoration-dotted hover:text-gray-600 transition-colors"
              onClick={() => doNext10Mutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
            >[DO 10]</strong>{" "}
            to research and write outreach scripts for the next 10.
        </>
      );
    }
    if (showCallTodayOnly) {
      return (
        <>
          You have <strong>{callTodayCompanies.length} companies</strong> to call today.
          {" "}Open each card below for your call script — good luck!
        </>
      );
    }
    return (
      <>
        You have <strong>{totalCount} matches</strong> from <strong>{campaignName}</strong> ({sourceType}).
        {" "}Press <strong>ENRICHED</strong> to see which ones were found in the Apollo database.
      </>
    );
  })();

  return (
    <div className="max-w-6xl">
      {!fromSalesMenu && <>
      {/* Page Header — minimal, secondary */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-black text-muted-foreground">
          [03] COCKPIT · Run #{searchData.search.id} · {searchData.search.location} · {new Date(searchData.search.createdAt).toLocaleDateString()}
        </div>
        <Button
          onClick={() => navigate("/search-results/select")}
          variant="outline"
          className="text-xs font-black border border-black px-3 py-1 h-auto"
        >
          ← CHANGE SEARCH
        </Button>
      </div>

      {/* Source Niche Banner — shown when campaign was created from a Market Segment */}
      {searchData.search.sourceNicheId && (
        <div className="mb-4 flex items-center gap-3 border-2 border-blue-400 bg-blue-50 px-4 py-2">
          <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest shrink-0">From Segment</span>
          <button
            onClick={() => navigate(`/niche/${searchData.search.sourceNicheId}`)}
            className="text-sm font-black text-blue-800 hover:text-blue-600 hover:underline transition-colors text-left"
          >
            {searchData.search.offeringName?.replace(/^\[Niche\] /, "") ?? "Market Segment"} →
          </button>
          <span className="text-xs text-blue-600 ml-auto">Click to view segment</span>
        </div>
      )}
      </>}

      {/* Search still in progress */}
      {searchData.search.status === "searching" && (
        <div className="border-2 border-gray-300 bg-gray-50 p-6 mb-8">
          <div className="text-xl font-black text-gray-700 animate-pulse mb-4">→ SEARCH IN PROGRESS...</div>
          {searchData.search.codesTotal && searchData.search.codesSearched !== null && (
            <div>
              <div className="text-lg font-bold text-gray-700">
                Searching keyword {(searchData.search.codesSearched ?? 0) + 1} of {searchData.search.codesTotal}
              </div>
              <div className="mt-3 w-full bg-gray-200 h-4">
                <div
                  className="bg-gray-900 h-4 transition-all duration-300"
                  style={{
                    width: `${((searchData.search.codesSearched ?? 0) / (searchData.search.codesTotal || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {(searchData.search.status === "completed" || searchData.search.status === "searching") && allCompanies.length > 0 && (
        <>
          {/* Header chrome — hidden when coming from Sales Menu */}
          {!fromSalesMenu && <>
          {/* HERO SENTENCE — the main message for sales reps */}
          <div className="mb-6 mt-4">
            <p className="text-2xl md:text-3xl font-black leading-snug text-foreground">
              {heroSentence}
            </p>
          </div>

          {/* High-Urgency CTA — secondary paragraph, same font size as hero */}
          {(highUrgencyNotCalled.length > 0 || urgencyCtaAdded || callTodayCompanies.length > 0) && (
            <div className="mb-6">
              {/* Line 1: CTA to add high-urgency companies, or confirmation once added */}
              {highUrgencyNotCalled.length > 0 && !urgencyCtaAdded ? (
                <p className="text-2xl md:text-3xl font-black text-red-700 leading-snug">
                  {highUrgencyNotCalled.slice(0, 3).map((c: any) => c.name).join(", ")}
                  {highUrgencyNotCalled.length > 3 ? ` and ${highUrgencyNotCalled.length - 3} more` : ""}
                  {" "}{highUrgencyNotCalled.length === 1 ? "has" : "have"} a high urgency score —{" "}
                  <span
                    className="cursor-pointer underline decoration-dotted hover:text-red-900 transition-colors animate-blink-cta"
                    onClick={addAllHighUrgencyToCallToday}
                  >
                    add {highUrgencyNotCalled.length === 1 ? "them" : "all " + highUrgencyNotCalled.length} to your Call Today list
                  </span>.
                </p>
              ) : callTodayCompanies.length > 0 ? (
                <p className="text-2xl md:text-3xl font-black text-red-700 leading-snug">
                  All high-urgency companies have been added to your Call Today list.
                </p>
              ) : null}
              {/* Line 2: Always visible when there are Call Today companies */}
              {callTodayCompanies.length > 0 && (
                <p className="text-2xl md:text-3xl font-black text-red-700 leading-snug mt-2">
                  {callTodayCompanies.length} {callTodayCompanies.length === 1 ? "company" : "companies"} added to your Call Today list —{" "}
                  <span
                    className="cursor-pointer underline decoration-dotted hover:text-red-900 transition-colors"
                    onClick={() => navigate(`/call-today/${searchId}`)}
                  >
                    start your outreach
                  </span>.
                </p>
              )}
            </div>
          )}
          {/* Stats Bar — supporting detail */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-black">
                [{displayedCompanies.length}{enrichmentFilter !== "all" ? ` / ${filteredCompanies.length}` : ""} MATCHES]
                {enrichmentFilter !== "all" && (
                  <button
                    onClick={() => setEnrichmentFilter("all")}
                    className="ml-2 text-sm font-black text-muted-foreground hover:text-black"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEnrichmentFilter(enrichmentFilter === "enriched" ? "all" : "enriched")}
                  className={`text-xs font-black border-2 px-3 py-1 cursor-pointer transition-colors ${
                    enrichmentFilter === "enriched"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-400 text-gray-600 hover:border-gray-700"
                  }`}
                >
                  {enrichmentStats?.enriched || 0} ENRICHED
                </button>
                <button
                  onClick={() => setEnrichmentFilter(enrichmentFilter === "pending" ? "all" : "pending")}
                  className={`text-xs font-black border-2 px-3 py-1 cursor-pointer transition-colors ${
                    enrichmentFilter === "pending"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  {enrichmentStats?.pending || 0} PENDING
                </button>
                {(enrichmentStats?.outreachReady ?? 0) > 0 && (
                  <button
                    onClick={() => setEnrichmentFilter(enrichmentFilter === "outreach" ? "all" : "outreach")}
                    className={`text-xs font-black border-2 px-3 py-1 cursor-pointer transition-colors ${
                      enrichmentFilter === "outreach"
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-400 text-gray-600 hover:border-gray-700"
                    }`}
                  >
                    {enrichmentStats?.outreachReady || 0} OUTREACH READY
                  </button>
                )}
                {leadinfoSet.size > 0 && (
                  <button
                    onClick={() => setEnrichmentFilter(enrichmentFilter === "visitors" ? "all" : "visitors")}
                    className={`text-xs font-black border-2 px-3 py-1 cursor-pointer transition-colors ${
                      enrichmentFilter === "visitors"
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-emerald-600 text-emerald-700 hover:border-emerald-800"
                    }`}
                  >
                    🌐 {leadinfoSet.size} SITE VISITORS
                  </button>
                )}
                {excludedCompanies.length > 0 && (
                  <button
                    onClick={() => setShowExcluded(!showExcluded)}
                    className="text-xs font-black border-2 border-gray-400 text-gray-600 px-3 py-1 cursor-pointer hover:border-gray-700"
                  >
                    {excludedCompanies.length} EXCLUDED {showExcluded ? "▲" : "▼"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Brain selector — shown whenever there are brains to choose from */}
              {availableBrains.length > 1 && (
                <div className="flex items-center gap-2 w-full mb-1">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">BRAIN:</span>
                  <select
                    value={selectedBrainId ?? ""}
                    onChange={(e) => setSelectedBrainId(e.target.value ? Number(e.target.value) : undefined)}
                    className="text-sm font-bold border-2 border-black px-2 py-1 bg-white cursor-pointer flex-1 max-w-xs"
                  >
                    {availableBrains.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.brainName}{b.id === activeBrain?.id ? " ★ active" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedBrainId && selectedBrainId !== activeBrain?.id && (
                    <span className="text-xs font-bold text-amber-600 border border-amber-400 px-2 py-0.5 bg-amber-50">
                      ⚠ NOT ACTIVE BRAIN
                    </span>
                  )}
                </div>
              )}
              {remainingWork > 0 && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => doNext10Mutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
                          disabled={isJobRunning}
                          className="text-lg px-6 py-4 font-black border-2 border-black bg-black text-white"
                        >
                          {doNext10Mutation.isPending
                            ? "[WORKING...]"
                            : `[DO 10 — ${remainingWork} LEFT]`}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-sm">
                        Processes the next 10 companies: enrich → deep research → sales approach.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => doAllMutation.mutate({ searchId: searchId!, brainId: selectedBrainIdForMutation })}
                          disabled={isJobRunning}
                          className="text-lg px-6 py-4 font-black border-2 border-black bg-black text-white"
                        >
                          {doAllMutation.isPending
                            ? "[STARTING...]"
                            : `[DO ALL — ${remainingWork}]`}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm text-sm">
                        <p className="font-bold mb-1">Processes {remainingWork} companies in the background:</p>
                        <ul className="space-y-0.5 text-xs">
                          {remainingWorkBreakdown.pendingEnrich > 0 && <li>• <strong>{remainingWorkBreakdown.pendingEnrich}</strong> pending enrichment (fetch address, SIC, size from Apollo)</li>}
                          {remainingWorkBreakdown.needsBrief > 0 && <li>• <strong>{remainingWorkBreakdown.needsBrief}</strong> need deep research brief (urgency score + conversation starter)</li>}
                          {remainingWorkBreakdown.needsApproach > 0 && <li>• <strong>{remainingWorkBreakdown.needsApproach}</strong> need sales approach (personalised outreach script)</li>}
                        </ul>
                        <p className="mt-1 text-xs text-muted-foreground">You can navigate away — the job continues and resumes on page reload.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Cancel button — only shown while a job is actively running */}
                  {isJobRunning && activeJobId && (
                    <Button
                      onClick={() => cancelJobMutation.mutate({ jobId: activeJobId })}
                      disabled={cancelJobMutation.isPending}
                      variant="outline"
                      className="text-lg px-4 py-4 font-black border-2 border-red-600 text-red-600 hover:bg-red-50"
                    >
                      {cancelJobMutation.isPending ? "CANCELLING..." : "[CANCEL]"}
                    </Button>
                  )}
                </>
              )}
              <Button
                onClick={() => syncToSupabaseMutation.mutate({ searchId: searchId! })}
                disabled={syncToSupabaseMutation.isPending}
                className="text-lg px-6 py-4 font-black bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {syncToSupabaseMutation.isPending ? "⏳ SYNCING..." : "⚡ SYNC TO SUPABASE"}
              </Button>
              <Button
                onClick={handleExportCsv}
                variant="outline"
                className="text-lg px-6 py-4 font-black border-2 border-black"
              >
                EXPORT CSV
              </Button>
              <Button
                onClick={handleExportSharePoint}
                variant="outline"
                className="text-lg px-6 py-4 font-black border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
              >
                📊 EXPORT TO SHAREPOINT
              </Button>
            </div>
          </div>

          {/* Background Job Progress Bar */}
          {isJobRunning && (
            <div className="border-2 border-gray-300 bg-gray-50 p-6 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xl font-black text-gray-700">
                  {batchContactsMutation.isPending
                    ? "→ FINDING DECISION MAKERS..."
                    : jobStatusQuery.data?.jobType === "doAll"
                    ? `→ DO ALL RUNNING — ${jobStatusQuery.data?.stats?.total ?? "?"} COMPANIES (5 ⚡ PARALLEL)`
                    : "→ DO 10 RUNNING..."}
                </div>
                {jobStatusQuery.data?.stats && (
                  <div className="text-xs font-bold text-gray-500 text-right">
                    {jobStatusQuery.data.stats.enriched > 0 && <span>{jobStatusQuery.data.stats.enriched} contacts found · </span>}
                    {jobStatusQuery.data.stats.researched} researched · {jobStatusQuery.data.stats.approached} approached
                    {jobStatusQuery.data.stats.failed > 0 && (
                      <span className="text-red-500 ml-1">· {jobStatusQuery.data.stats.failed} failed</span>
                    )}
                  </div>
                )}
              </div>
              {jobStatusQuery.data?.current && (
                <div className="text-sm font-bold mt-1 text-gray-600">
                  Last completed: <span className="text-black">{jobStatusQuery.data.current}</span>
                  {jobStatusQuery.data.stats.total > 0 && (
                    <span className="ml-2 text-gray-400">
                      ({Math.round((jobStatusQuery.data.progress ?? 0))}% — {jobStatusQuery.data.stats.enriched + jobStatusQuery.data.stats.researched + jobStatusQuery.data.stats.approached} steps done — 5 workers running in parallel)
                    </span>
                  )}
                </div>
              )}
              <div className="mt-3 h-2 bg-gray-200 rounded">
                <div
                  className="h-2 bg-black rounded transition-all duration-500"
                  style={{ width: `${jobStatusQuery.data?.progress ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Excluded Companies */}
          {showExcluded && excludedCompanies.length > 0 && (
            <div className="mb-6 border-4 border-red-600 bg-red-50 p-6">
              <div className="text-lg font-black text-red-600 mb-4">
                EXCLUDED COMPANIES [{excludedCompanies.length}]
              </div>
              <div className="space-y-2">
                {excludedCompanies.map((company) => (
                  <div key={company.id} className="flex items-center justify-between py-2 border-b border-red-200 last:border-0">
                    <div>
                      <span className="font-black text-sm">{company.name}</span>
                      <span className="text-xs font-bold opacity-60 ml-3">
                        SIC: {company.sicCodes ? JSON.parse(company.sicCodes).join(", ") : "—"} |
                        NAICS: {company.naicsCodes ? JSON.parse(company.naicsCodes).join(", ") : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Buttons */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              onClick={() => setShowCallTodayOnly(false)}
              variant="outline"
              className={`text-sm px-4 py-3 font-black border-2 border-black ${
                !showCallTodayOnly ? 'bg-black text-white' : ''
              }`}
            >
              ALL ({filteredCompanies.length})
            </Button>
            <Button
              onClick={() => setShowCallTodayOnly(true)}
              variant="outline"
              className={`text-sm px-4 py-3 font-black border-2 border-black ${
                showCallTodayOnly ? 'bg-black text-white' : ''
              }`}
            >
              CALL TODAY ({callTodayCompanies?.length || 0})
            </Button>
          </div>

          {/* Sort Controls + View Toggle */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-muted-foreground">SORT:</span>
            {([
              { value: "default", label: "IMPORT ORDER" },
              { value: "urgency", label: "URGENCY ▼" },
              { value: "fit_urgency", label: "FIT × URGENCY ▼" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`border-2 px-3 py-1 text-xs font-black transition-colors ${
                  sortBy === opt.value
                    ? "border-black bg-black text-white"
                    : "border-gray-300 hover:border-black"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="mb-3 flex items-center gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={`border-2 px-3 py-1 text-xs font-black transition-colors ${
                viewMode === "list" ? "border-black bg-black text-white" : "border-gray-300 hover:border-black"
              }`}
            >☰ LIST</button>
            <button
              onClick={() => setViewMode("card")}
              className={`border-2 px-3 py-1 text-xs font-black transition-colors ${
                viewMode === "card" ? "border-black bg-black text-white" : "border-gray-300 hover:border-black"
              }`}
            >▦ CARDS</button>
          </div>

          </>}
          {/* Company Cards / List */}
          {viewMode === "list" ? (
            <div className="border border-gray-200 divide-y divide-gray-100">
              {displayedCompanies?.map((company, index) => (
                <CompanyListRow
                  key={company.id}
                  company={company}
                  index={index}
                  searchId={searchId!}
                  isWebsiteVisitor={leadinfoSet.has(company.id)}
                  activeBrainId={activeBrain?.id}
                  activeBrainName={activeBrain?.brainName}
                />
              ))}
            </div>
          ) : (
          <div className="space-y-4">
            {displayedCompanies?.map((company, index) => (
              <CompanyCard
                key={company.id}
                company={company}
                index={index}
                searchId={searchId!}
                isWebsiteVisitor={leadinfoSet.has(company.id)}
                activeBrainId={activeBrain?.id}
                activeBrainName={activeBrain?.brainName}
                onViewResearch={(id) => { setQuickViewCompanyId(id); setQuickViewMode("research"); }}
                onViewApproach={(id) => { setQuickViewCompanyId(id); setQuickViewMode("approach"); }}
              />
            ))}
          </div>
          )}

          {/* Load More button */}
            {searchData?.pagination?.hasMore && (
              <div className="pt-6 pb-2 text-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="border-4 border-black px-8 py-3 text-sm font-black hover:bg-black hover:text-white transition-colors"
                >
                  LOAD MORE — showing {allCompanies.length} of {searchData.pagination.total}
                </button>
              </div>
            )}

            {/* Quick-View Modal for Research/Approach header cards */}
            {quickViewCompanyId && quickViewMode && (() => {
              const qc = allCompanies?.find((c: any) => c.id === quickViewCompanyId);
              if (!qc) return null;
              const briefData = qc.briefData ? (typeof qc.briefData === 'string' ? JSON.parse(qc.briefData) : qc.briefData) : null;
              const salesApproach = normaliseSalesApproach(qc.salesApproachData ? (typeof qc.salesApproachData === 'string' ? JSON.parse(qc.salesApproachData) : qc.salesApproachData) : null);
              const copyText = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };
              return (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setQuickViewCompanyId(null); setQuickViewMode(null); }}>
                  <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto border-4 border-black" onClick={(e) => e.stopPropagation()}>
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 border-b-4 border-black bg-black text-white">
                      <div>
                        <div className="text-xs font-black opacity-60">{quickViewMode === 'research' ? 'DEEP RESEARCH' : 'SALES APPROACH'}</div>
                        <div className="text-xl font-black">{qc.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {qc.briefData && (
                            <button onClick={() => setQuickViewMode('research')} className={`text-xs font-black px-3 py-1.5 border-2 cursor-pointer ${ quickViewMode === 'research' ? 'border-white bg-white text-black' : 'border-gray-500 text-gray-300 hover:border-white'}`}>RESEARCH</button>
                        )}
                        {qc.salesApproachData && (
                            <button onClick={() => setQuickViewMode('approach')} className={`text-xs font-black px-3 py-1.5 border-2 cursor-pointer ${ quickViewMode === 'approach' ? 'border-white bg-white text-black' : 'border-gray-500 text-gray-300 hover:border-white'}`}>APPROACH</button>
                        )}
                        <button onClick={() => { setQuickViewCompanyId(null); setQuickViewMode(null); }} className="text-2xl font-black hover:opacity-60 ml-2">×</button>
                      </div>
                    </div>
                    {/* Research Content */}
                    {quickViewMode === 'research' && briefData && (
                      <div className="p-6">
                        <div className="mb-6 p-4 bg-gray-50 border-l-4 border-gray-900">
                          <div className="text-3xl font-black text-gray-900 mb-2">Urgency Score: {briefData.urgencyScore}/100</div>
                          {briefData.urgencyBreakdown && (
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div><div className="font-bold">Company Context</div><div>{briefData.urgencyBreakdown.companyContext}/40</div></div>
                              <div><div className="font-bold">Market Signals</div><div>{briefData.urgencyBreakdown.marketSignals}/35</div></div>
                              <div><div className="font-bold">Recent Activity</div><div>{briefData.urgencyBreakdown.recentActivity}/25</div></div>
                            </div>
                          )}
                        </div>
                        {briefData.companyOverview && <div className="mb-4"><h3 className="text-lg font-black mb-2">Company Overview</h3><p className="text-sm">{briefData.companyOverview}</p></div>}
                        {briefData.whyNow && <div className="mb-4"><h3 className="text-lg font-black mb-2">Why Now</h3><p className="text-sm">{briefData.whyNow}</p></div>}
                        {briefData.engagementStrategy && <div className="mb-4"><h3 className="text-lg font-black mb-2">Engagement Strategy</h3><p className="text-sm">{briefData.engagementStrategy}</p></div>}
                        {briefData.urgencySignals?.length > 0 && (
                          <div className="mb-4">
                            <h3 className="text-lg font-black mb-2">Urgency Signals</h3>
                            <div className="space-y-2">
                              {briefData.urgencySignals.map((s: any, i: number) => (
                                <div key={i} className="p-3 bg-white border border-gray-200">
                                  <span className="font-bold text-sm">{s.category} — {s.type}</span>
                                  <div className="text-sm mt-1">{s.description}</div>
                                  {s.snippet && <div className="text-xs text-gray-600 italic mt-1 border-l-2 border-gray-400 pl-2">"{s.snippet}"</div>}
                                  {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline mt-1 inline-block">Source</a>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Approach Content */}
                    {quickViewMode === 'approach' && salesApproach && (
                      <div className="p-6">
                        {salesApproach.conversationStarters?.length > 0 && (
                            <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
                            <h3 className="text-xl font-black text-gray-900 mb-2">Conversation Starters</h3>
                            <div className="space-y-3">
                              {salesApproach.conversationStarters.map((s: any, i: number) => (
                                <div key={i} className="p-2 bg-white border border-gray-200">
                  <div className="text-sm font-medium">{typeof s === 'string' ? s : s.opener ?? s.conversationStarter ?? s.description ?? ''}</div>
                                   {typeof s !== 'string' && s.basedOn && <div className="text-xs text-gray-500 mt-1">Based on: {s.basedOn}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {salesApproach.emailDraft && (
                          <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-xl font-black text-gray-900">Email Draft</h3>
                              <button onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, 'Email')} className="text-xs font-black border-2 border-gray-900 text-gray-900 px-3 py-1 cursor-pointer hover:bg-gray-100">COPY</button>
                            </div>
                            <div className="mb-2"><span className="font-bold">Subject:</span> {salesApproach.emailDraft.subject}</div>
                            <div className="whitespace-pre-wrap text-sm">{salesApproach.emailDraft.body}</div>
                          </div>
                        )}
                        {salesApproach.linkedinMessage && (
                          <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
                              <h3 className="text-xl font-black text-gray-900 mb-2">LinkedIn Message</h3>
                            <div className="mb-3">
                              <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">Connection Request:</span><button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, 'Connection Request')} className="text-xs font-black border border-gray-400 text-gray-700 px-2 py-0.5 cursor-pointer hover:bg-gray-100">COPY</button></div>
                              <div className="text-sm bg-white border border-gray-200 p-2">{salesApproach.linkedinMessage.connectionRequest}</div>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">Follow-up:</span><button onClick={() => copyText(salesApproach.linkedinMessage.followUp, 'Follow-up')} className="text-xs font-black border border-gray-400 text-gray-700 px-2 py-0.5 cursor-pointer hover:bg-gray-100">COPY</button></div>
                              <div className="text-sm bg-white border border-gray-200 p-2">{salesApproach.linkedinMessage.followUp}</div>
                            </div>
                          </div>
                        )}
                        {salesApproach.callScript && (
                          <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-xl font-black text-gray-900">Call Script</h3>
                              <button onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening, 'Call Script')} className="text-xs font-black border-2 border-gray-900 text-gray-900 px-3 py-1 cursor-pointer hover:bg-gray-100">COPY</button>
                            </div>
                            {salesApproach.callScript.opening && <div className="mb-3"><div className="font-bold text-sm mb-1">Opening:</div><div className="text-sm bg-white border border-gray-200 p-2">{salesApproach.callScript.opening}</div></div>}
                            {salesApproach.callScript.fullScript && <div className="whitespace-pre-wrap text-sm">{salesApproach.callScript.fullScript}</div>}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-4 border-t-2 border-black">
                      <button onClick={() => { setQuickViewCompanyId(null); setQuickViewMode(null); }} className="w-full font-black border-2 border-black py-2 hover:bg-black hover:text-white transition-colors cursor-pointer">CLOSE</button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </>
      )}

      {searchData.search.status === "completed" && allCompanies.length === 0 && (
        <div className="border-4 border-black p-12 text-center">
          <div className="text-3xl font-black mb-4">NO MATCHES FOUND</div>
          <div className="text-lg font-bold text-muted-foreground">Try a different location or offering</div>
        </div>
      )}

      {searchData.search.status === "failed" && (
        <div className="border-4 border-red-600 bg-red-50 p-8">
          <div className="text-xl font-black text-red-600">SEARCH FAILED</div>
          <div className="text-sm font-bold mt-2">{searchData.search.errorMessage}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Company List Row — Ultra-compact magazine list view
// ============================================================================
function CompanyListRow({ company, index, searchId, isWebsiteVisitor, activeBrainId, activeBrainName }: {
  company: any;
  index: number;
  searchId: number;
  isWebsiteVisitor?: boolean;
  activeBrainId?: number | null;
  activeBrainName?: string | null;
}) {
  const [, navigate] = useLocation();
  const url = `/company/${company.id}?from=search/${searchId}`;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors group"
      onClick={() => navigate(url)}
    >
      {/* Position */}
      <span className="text-[11px] font-medium text-gray-400 w-6 shrink-0 tabular-nums">[{String(index + 1).padStart(2, "0")}]</span>

      {/* Urgency badge */}
      {company.urgencyScore > 0 ? (
        <span className={`text-[10px] font-black px-2 py-0.5 shrink-0 ${
          company.urgencyScore >= 70 ? "bg-red-600 text-white" :
          company.urgencyScore >= 50 ? "bg-amber-500 text-white" :
          "bg-gray-200 text-gray-600"
        }`}>⚡ {company.urgencyScore}</span>
      ) : (
        <span className="w-10 shrink-0" />
      )}

      {/* Brain badge */}
      <BrainBadge
        generatedWithBrainId={company.generatedWithBrainId}
        generatedWithBrainName={company.generatedWithBrainName}
        activeBrainId={activeBrainId}
        activeBrainName={activeBrainName}
        compact
      />

      {/* Site visitor dot */}
      {isWebsiteVisitor && (
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Website visitor" />
      )}

      {/* Company name + domain */}
      <div className="flex-1 min-w-0">
        <span className="font-bold text-sm text-gray-900 truncate block">{company.name}</span>
        {company.websiteUrl && (
          <span className="text-[11px] text-gray-400 truncate block">
            {company.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
          </span>
        )}
      </div>

      {/* Fit score (if available) */}
      {company.fitScore != null && (
        <span className="text-[10px] font-black text-blue-600 shrink-0">FIT {company.fitScore}</span>
      )}

      {/* Arrow */}
      <span className="text-gray-300 group-hover:text-gray-700 transition-colors shrink-0 text-sm font-bold">→</span>
    </div>
  );
}

// ============================================================================
// Company Card — Compact Layout
// ============================================================================
function CompanyCard({ company, index, searchId, onViewResearch, onViewApproach, isWebsiteVisitor, activeBrainId, activeBrainName }: {
  company: any;
  index: number;
  searchId: number;
  onViewResearch?: (companyId: number) => void;
  onViewApproach?: (companyId: number) => void;
  isWebsiteVisitor?: boolean;
  activeBrainId?: number | null;
  activeBrainName?: string | null;
}) {
  const [, navigate] = useLocation();
  // Build a URL to this company's detail page, optionally with a chapter and the full queue for PREV/NEXT nav
  const buildCompanyUrl = (chapter?: string) => {
    let url = `/company/${company.id}?from=search/${searchId}`;
    if (chapter) url += `&chapter=${chapter}`;
    return url;
  };
  const hasSicCodes = !!(company.sicCodes && JSON.parse(company.sicCodes).length > 0);
  const hasNaicsCodes = !!(company.naicsCodes && JSON.parse(company.naicsCodes).length > 0);

  const location = company.enrichmentStatus === "enriched" && (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : company.searchLocation || "—";

  return (
    <div id={`company-${company.id}`} className="border border-gray-200 bg-white hover:border-gray-400 transition-colors">
      {/* Header Row: Index + Badges + Name + Website */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-gray-400">[{String(index + 1).padStart(2, "0")}]</span>
              {company.enrichmentStatus === "failed" && (
                <span className="text-[10px] font-medium border border-red-300 text-red-500 px-1.5 py-0.5">FAILED</span>
              )}
              {company.enrichmentStatus === "pending" && (
                <span className="text-[10px] font-medium text-gray-400 px-1.5 py-0.5">PENDING</span>
              )}
              {isWebsiteVisitor && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  SITE VISITOR
                </span>
              )}
              {company.urgencyScore > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(buildCompanyUrl("urgency")); }}
                  className={`text-[10px] font-bold px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity rounded-sm ${
                    company.urgencyScore >= 70 ? "bg-red-600 text-white" :
                    company.urgencyScore >= 50 ? "bg-amber-500 text-white" :
                    "bg-gray-200 text-gray-600"
                  }`}
                >
                  ⚡ {company.urgencyScore}
                </button>
              )}
              <BrainBadge
                generatedWithBrainId={company.generatedWithBrainId}
                generatedWithBrainName={company.generatedWithBrainName}
                activeBrainId={activeBrainId}
                activeBrainName={activeBrainName}
                compact
              />
            </div>
            <h4 className="text-lg md:text-xl font-bold leading-tight truncate text-gray-900">{company.name}</h4>
            {company.websiteUrl && (
              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600 truncate block mt-0.5">
                {company.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
            {/* Company Overview snippet — first sentence from briefData */}
            {company.briefData && (() => {
              try {
                const bd = typeof company.briefData === 'string' ? JSON.parse(company.briefData) : company.briefData;
                const overview = bd?.companyOverview as string | undefined;
                if (!overview) return null;
                const firstSentence = overview.split(/(?<=[.!?])\s+/)[0] ?? overview;
                return (
                  <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
                    {firstSentence}
                  </p>
                );
              } catch { return null; }
            })()}
          </div>
          {/* SALES BRIEF — prominent right-side CTA */}
          <div className="shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(buildCompanyUrl()); }}
              className="flex flex-col items-center justify-center gap-0.5 border-2 border-gray-900 bg-gray-900 text-white hover:bg-gray-700 transition-colors px-4 py-3 min-w-[90px]"
            >
              <span className="text-[10px] font-medium tracking-widest uppercase text-gray-300">Sales</span>
              <span className="text-sm font-bold leading-tight">Brief →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Grid — Compact */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm border-t border-gray-200 pt-3">
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Location</div>
            <div className="font-medium text-sm text-gray-700 truncate">{location}</div>
          </div>
          {company.revenue && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Revenue</div>
              <div className="font-medium text-sm text-gray-700">{formatRevenue(company.revenue)}</div>
            </div>
          )}
          {company.employeeCount && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Employees</div>
              <div className="font-medium text-sm text-gray-700">{formatEmployees(company.employeeCount)}</div>
            </div>
          )}
          {company.linkedinUrl && (
            <div className="col-span-2">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">LinkedIn</div>
              <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-gray-700 hover:underline truncate block">
                {company.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
          )}
        </div>

        {/* Research / Approach Quick-Access Cards — only when data exists */}
        {(company.briefData || company.salesApproachData) && (
          <div className="flex gap-3 mt-3">
            {company.briefData && (() => {
              let bd: any = null;
              try { bd = typeof company.briefData === 'string' ? JSON.parse(company.briefData) : company.briefData; } catch {}
              const sections = [
                bd?.recentDevelopments?.length > 0 && 'Recent Developments',
                bd?.productsServices?.length > 0 && 'Products & Services',
                bd?.keyTechnologies?.length > 0 && 'Key Technologies',
                bd?.targetMarkets?.length > 0 && 'Target Markets',
                bd?.sources?.length > 0 && `Sources (${bd.sources.length})`,
              ].filter(Boolean) as string[];
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(buildCompanyUrl("research")); }}
                  className="flex-1 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors p-3 text-left cursor-pointer"
                >
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Research</div>
                  <div className="text-sm font-semibold text-gray-800 leading-tight">View Research Brief →</div>
                  {company.urgencyScore > 0 && (
                    <div className="text-xs font-medium text-gray-500 mt-1">Urgency: {company.urgencyScore}/100</div>
                  )}
                  {sections.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {sections.map((s) => (
                        <li key={s} className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })()}
            {company.salesApproachData && (() => {
              let sa: any = null;
              try { sa = normaliseSalesApproach(typeof company.salesApproachData === 'string' ? JSON.parse(company.salesApproachData) : company.salesApproachData); } catch {}
              const approachSections = [
                sa?.conversationStarters?.length > 0 && `Conversation Starters (${sa.conversationStarters.length})`,
                sa?.emailDraft && 'Email Draft',
                sa?.linkedinMessage && 'LinkedIn Message',
                sa?.callScript && 'Call Script',
              ].filter(Boolean) as string[];
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(buildCompanyUrl("approach")); }}
                  className="flex-1 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors p-3 text-left cursor-pointer"
                >
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Approach</div>
                  <div className="text-sm font-semibold text-gray-800 leading-tight">View Approach →</div>
                  {approachSections.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {approachSections.map((s) => (
                    <li key={s} className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Decision + Action Buttons — Compact Footer */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Decision Buttons */}
          <CompanyDecisionButtons
            companyId={company.id}
            searchId={searchId}
            companyName={company.name}
            hasSicCodes={hasSicCodes}
            hasNaicsCodes={hasNaicsCodes}
          />

          {/* Right: Action Buttons — Compact Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {company.enrichmentStatus === "pending" && (
              <EnrichButton companyId={company.id} companyName={company.name} />
            )}
            {company.enrichmentStatus === "enriched" && (
              <>
                <DeepResearchButton companyId={company.id} companyName={company.name} hasResearch={!!company.briefGeneratedAt} />
                {company.briefGeneratedAt && (
                  <CreateSalesApproachButton companyId={company.id} companyName={company.name} hasSalesApproach={!!company.salesApproachGeneratedAt} />
                )}
                <FindAllCSuiteButton companyId={company.id} companyName={company.name} />
                <GetAllPersonnelButton companyId={company.id} companyName={company.name} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Enrich Button — Compact
// ============================================================================
function EnrichButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const utils = trpc.useUtils();
  const enrichMutation = trpc.companyFinder.enrichSingle.useMutation({
    onSuccess: () => {
      toast.success(`${companyName} enriched successfully`);
      utils.companyFinder.getSearch.invalidate();
    },
    onError: (error) => {
      toast.error(`Enrichment failed: ${error.message}`);
    },
  });

  return (
    <Button
      onClick={(e) => { e.stopPropagation(); enrichMutation.mutate({ companyId }); }}
      disabled={enrichMutation.isPending}
      size="sm"
      variant="outline"
      className="text-xs font-black border-2 border-black h-8 px-3 cursor-pointer"
    >
      {enrichMutation.isPending ? "..." : "ENRICH"}
    </Button>
  );
}

// ============================================================================
// Deep Research Button — Compact with Modal
// ============================================================================
function DeepResearchButton({ companyId, companyName, hasResearch }: { companyId: number; companyName: string; hasResearch: boolean }) {
  const [briefData, setBriefData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const utils = trpc.useUtils();

  const generateBriefMutation = trpc.companyFinder.generateBrief.useMutation({
    onSuccess: (data) => {
      setBriefData(data.brief);
      setIsGenerating(false);
      setShowBrief(true);
      if (data.cached) {
        toast.success(`Using cached research (${data.cacheAge} days old) - Urgency: ${data.brief.urgencyScore}`);
      } else {
        toast.success(`Research completed - Urgency score: ${data.brief.urgencyScore}`);
      }
      utils.companyFinder.getSearch.invalidate();
    },
    onError: (error) => {
      toast.error(`Research failed: ${error.message}`);
      setIsGenerating(false);
    },
  });

  return (
    <>
      <Button
        onClick={(e) => { e.stopPropagation(); setIsGenerating(true); generateBriefMutation.mutate({ companyId }); }}
        disabled={isGenerating}
        size="sm"
        variant="outline"
        className={`text-xs font-black border-2 h-8 px-3 cursor-pointer ${
          hasResearch ? "border-gray-900 text-gray-900 bg-gray-100" : "border-gray-700 text-gray-700"
        }`}
      >
        {isGenerating ? "..." : hasResearch ? "VIEW RESEARCH" : "RESEARCH"}
      </Button>

      {showBrief && briefData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBrief(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black">{companyName} - Deep Research</h2>
              <button onClick={() => setShowBrief(false)} className="text-2xl font-black hover:opacity-60">×</button>
            </div>

            {/* Urgency Score */}
            <div className="mb-6 p-4 bg-gray-50 border-l-4 border-gray-900">
              <div className="text-3xl font-black text-gray-900 mb-2">Urgency Score: {briefData.urgencyScore}/100</div>
              {briefData.urgencyBreakdown && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><div className="font-bold">Company Context</div><div>{briefData.urgencyBreakdown.companyContext}/40</div></div>
                  <div><div className="font-bold">Market Signals</div><div>{briefData.urgencyBreakdown.marketSignals}/35</div></div>
                  <div><div className="font-bold">Recent Activity</div><div>{briefData.urgencyBreakdown.recentActivity}/25</div></div>
                </div>
              )}
            </div>

            {/* Recent Developments */}
            {briefData.recentDevelopments?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Recent Developments</h3>
                <ul className="list-disc pl-5 space-y-3">
                  {briefData.recentDevelopments.map((dev: any, i: number) => (
                    <li key={i}>
                      <div>{typeof dev === 'string' ? dev : dev.text}</div>
                      {typeof dev !== 'string' && dev.date && <div className="text-xs text-gray-500 mt-1">{dev.date}</div>}
                      {typeof dev !== 'string' && dev.snippet && <div className="text-xs text-gray-600 italic mt-1 border-l-2 border-gray-300 pl-2">"{dev.snippet}"</div>}
                      {typeof dev !== 'string' && dev.sourceUrl && <a href={dev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline mt-1 inline-block">Source</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Conversation Starters */}
            {briefData.conversationStarters?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Conversation Starters</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {briefData.conversationStarters.map((starter: any, i: number) => {
                    const text = typeof starter === 'string' ? starter : starter.opener ?? starter.conversationStarter ?? starter.description ?? '';
                    return <li key={i} className="text-gray-800">{text}</li>;
                  })}
                </ul>
              </div>
            )}

            {/* Products & Services */}
            {briefData.productsServices?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Products & Services</h3>
                {briefData.productsServices.map((ps: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="font-bold">{ps.category}{ps.sourceUrl && <a href={ps.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline ml-2 font-normal">Source</a>}</div>
                    <div className="text-sm">{ps.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Key Technologies */}
            {briefData.keyTechnologies?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Key Technologies</h3>
                {briefData.keyTechnologies.map((tech: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="font-bold">{tech.name}{tech.sourceUrl && <a href={tech.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline ml-2 font-normal">Source</a>}</div>
                    <div className="text-sm">{tech.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Target Markets */}
            {briefData.targetMarkets?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Target Markets</h3>
                {briefData.targetMarkets.map((market: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="font-bold">{market.segment}</div>
                    <div className="text-sm">{market.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Engagement Strategy */}
            {briefData.engagementStrategy && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Engagement Strategy</h3>
                {briefData.engagementStrategy.whyThisProspectMatters?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-1">Why This Prospect Matters:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {briefData.engagementStrategy.whyThisProspectMatters.map((reason: string, i: number) => <li key={i}>{reason}</li>)}
                    </ul>
                  </div>
                )}
                {briefData.engagementStrategy.recommendedApproach?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-1">Recommended Approach:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {briefData.engagementStrategy.recommendedApproach.map((step: string, i: number) => <li key={i}>{step}</li>)}
                    </ul>
                  </div>
                )}
                {briefData.engagementStrategy.keyTalkingPoints?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-1">Key Talking Points:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {briefData.engagementStrategy.keyTalkingPoints.map((point: string, i: number) => <li key={i}>{point}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Urgency Signals */}
            {briefData.urgencySignals?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Urgency Signals</h3>
                <div className="space-y-2">
                  {briefData.urgencySignals.map((signal: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-sm">{signal.category} — {signal.type}</span>
                          <div className="text-sm mt-1">{signal.description}</div>
                          {signal.snippet && <div className="text-xs text-gray-600 italic mt-1 border-l-2 border-gray-400 pl-2">"{signal.snippet}"</div>}
                          {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline mt-1 inline-block">Source</a>}
                        </div>
                        <span className="text-sm font-black text-gray-700 ml-4">+{signal.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Sources */}
            {briefData.sources?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Verified Sources ({briefData.sources.length})</h3>
                <div className="space-y-2">
                  {briefData.sources.map((source: any, i: number) => (
                    <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-gray-900 underline font-bold">{source.title || source.url}</a>
                      {source.snippet && <div className="text-xs text-gray-600 mt-1">{source.snippet}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => setShowBrief(false)} className="w-full font-black">CLOSE</Button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Sales Approach Button — Compact with Modal
// ============================================================================
function CreateSalesApproachButton({ companyId, companyName, hasSalesApproach }: { companyId: number; companyName: string; hasSalesApproach: boolean }) {
  const [salesApproach, setSalesApproach] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApproach, setShowApproach] = useState(false);

  const generateApproachMutation = trpc.companyFinder.generateSalesApproach.useMutation({
    onSuccess: (data) => {
      setSalesApproach(data.salesApproach);
      setIsGenerating(false);
      setShowApproach(true);
      toast.success(data.cached ? "Using cached sales approach" : "Sales approach generated!");
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <>
      <Button
        onClick={(e) => { e.stopPropagation(); setIsGenerating(true); generateApproachMutation.mutate({ companyId }); }}
        disabled={isGenerating}
        size="sm"
        variant="outline"
        className={`text-xs font-black border-2 h-8 px-3 cursor-pointer ${
          hasSalesApproach ? "border-gray-900 text-gray-900 bg-gray-100" : "border-gray-700 text-gray-700"
        }`}
      >
        {isGenerating ? "..." : hasSalesApproach ? "VIEW APPROACH" : "SALES APPROACH"}
      </Button>

      {showApproach && salesApproach && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApproach(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black">{companyName} - Sales Approach</h2>
              <button onClick={() => setShowApproach(false)} className="text-2xl font-black hover:opacity-60">×</button>
            </div>

            {/* Conversation Starters */}
            {salesApproach.conversationStarters?.length > 0 && (
              <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
                <h3 className="text-xl font-black text-gray-900 mb-2">Conversation Starters</h3>
                <div className="space-y-3">
                  {salesApproach.conversationStarters.map((starter: any, i: number) => (
                    <div key={i} className="p-2 bg-white border border-gray-200">
                      <div className="text-sm font-medium">{typeof starter === 'string' ? starter : starter.opener ?? starter.conversationStarter ?? starter.description ?? ''}</div>
                      {typeof starter !== 'string' && starter.basedOn && <div className="text-xs text-gray-500 mt-1">Based on: {starter.basedOn}</div>}
                      {typeof starter !== 'string' && starter.sourceUrl && <a href={starter.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline mt-1 inline-block">Source</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Draft */}
                          <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-xl font-black text-gray-900">Email Draft</h3>
                <Button onClick={() => copyToClipboard(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")} variant="outline" size="sm" className="font-black">COPY</Button>
              </div>
              <div className="mb-2"><span className="font-bold">Subject:</span> {salesApproach.emailDraft.subject}</div>
              <div className="whitespace-pre-wrap text-sm">{salesApproach.emailDraft.body}</div>
              {salesApproach.emailDraft.referencedSources?.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500">Referenced sources:</div>
                  {salesApproach.emailDraft.referencedSources.map((src: string, i: number) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 underline block">{src}</a>
                  ))}
                </div>
              )}
            </div>

            {/* LinkedIn Message */}
            <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
              <h3 className="text-xl font-black text-gray-900 mb-2">LinkedIn Message</h3>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Connection Request:</span>
                  <Button onClick={() => copyToClipboard(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} variant="outline" size="sm" className="font-black border-gray-400">COPY</Button>
                </div>
                <div className="text-sm bg-white border border-gray-200 p-2">{salesApproach.linkedinMessage.connectionRequest}</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Follow-up:</span>
                  <Button onClick={() => copyToClipboard(salesApproach.linkedinMessage.followUp, "Follow-up")} variant="outline" size="sm" className="font-black border-gray-400">COPY</Button>
                </div>
                <div className="text-sm bg-white border border-gray-200 p-2">{salesApproach.linkedinMessage.followUp}</div>
              </div>
            </div>

            {/* Call Script */}
            <div className="mb-6 p-4 border-l-4 border-gray-900 bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-gray-900">Call Script</h3>
                <Button onClick={() => copyToClipboard(`OPENING:\n${salesApproach.callScript.opening}\n\nDISCOVERY QUESTIONS:\n${salesApproach.callScript.discoveryQuestions.join("\n")}\n\nVALUE PROPOSITION:\n${salesApproach.callScript.valueProposition}\n\nCALL TO ACTION:\n${salesApproach.callScript.callToAction}`, "Call Script")} variant="outline" size="sm" className="font-black">COPY</Button>
              </div>
              <div className="mb-3"><span className="font-bold">Opening:</span><div className="text-sm mt-1">{salesApproach.callScript.opening}</div></div>
              <div className="mb-3"><span className="font-bold">Discovery Questions:</span><ul className="list-disc pl-5 text-sm mt-1">{salesApproach.callScript.discoveryQuestions.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul></div>
              <div className="mb-3"><span className="font-bold">Value Proposition:</span><div className="text-sm mt-1">{salesApproach.callScript.valueProposition}</div></div>
              <div><span className="font-bold">Call to Action:</span><div className="text-sm mt-1">{salesApproach.callScript.callToAction}</div></div>
            </div>

            <Button onClick={() => setShowApproach(false)} className="w-full font-black">CLOSE</Button>
          </div>
        </div>
      )}
    </>
  );
}


// ============================================================================
// Find Decision-Makers Button — Trickle-Down Seniority Search
// ============================================================================
// Seniority options — mirrors SENIORITY_OPTIONS in DeepResearchDashboard
const SR_SENIORITY_OPTIONS = [
  { label: "C-Suite / Owner", values: ["owner", "founder", "c_suite", "partner"], defaultOn: true },
  { label: "VP / Head",       values: ["vp", "head"],                             defaultOn: true },
  { label: "Director",        values: ["director"],                               defaultOn: false },
  { label: "Manager",         values: ["manager"],                                defaultOn: false },
  { label: "Senior / Entry",  values: ["senior", "entry"],                        defaultOn: false },
] as const;

const SR_DEPARTMENT_OPTIONS = [
  { label: "Any department",         value: "any" },
  { label: "Engineering",            value: "engineering" },
  { label: "Operations",             value: "operations" },
  { label: "Finance",                value: "finance" },
  { label: "Sales",                  value: "sales" },
  { label: "Marketing",              value: "marketing" },
  { label: "Human Resources",        value: "human_resources" },
  { label: "Information Technology", value: "information_technology" },
  { label: "Product Management",     value: "product_management" },
] as const;

function GetAllPersonnelButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fetchLimit, setFetchLimit] = useState(25);
  const [checkedSeniorities, setCheckedSeniorities] = useState<boolean[]>(
    SR_SENIORITY_OPTIONS.map((o) => o.defaultOn)
  );
  const [department, setDepartment] = useState("any");

  const { data: existingContacts } = trpc.companyFinder.getCompanyContacts.useQuery({ companyId });

  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => {
      setResults({ contacts: data.contacts, totalFound: data.totalFound });
      setShowSelectionModal(false);
      setShowResultsModal(true);
      toast.success(`Found ${data.contacts.length} personnel at ${companyName}`);
    },
    onError: (error) => {
      toast.error(`Personnel search failed: ${error.message}`);
      setShowSelectionModal(false);
    },
  });

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSelectionModal(true);
  };

  const toggleSeniority = (idx: number) => {
    setCheckedSeniorities((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const handleFetch = () => {
    const selectedSeniorities = SR_SENIORITY_OPTIONS
      .filter((_, i) => checkedSeniorities[i])
      .flatMap((o) => [...o.values]);
    getAllPersonnelMutation.mutate({
      companyId,
      limit: fetchLimit,
      seniorities: selectedSeniorities.length > 0 ? selectedSeniorities : undefined,
      department: department !== "any" ? department : undefined,
    });
  };

  const anyChecked = checkedSeniorities.some(Boolean);
  const contactCount = existingContacts?.contacts?.length || 0;

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={getAllPersonnelMutation.isPending}
        size="sm"
        variant="outline"
        className="text-xs font-black border-2 border-gray-700 text-gray-700 h-8 px-3 cursor-pointer"
      >
        GET ALL PERSONNEL
      </Button>

      {/* Selection Modal */}
      {showSelectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSelectionModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b-2 border-gray-200">
              <h3 className="text-xl font-black">FETCH PERSONNEL</h3>
              <p className="text-sm text-muted-foreground mt-1">{companyName}</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Seniority checkboxes */}
              <div>
                <label className="block text-sm font-black mb-2 uppercase tracking-wide">Seniority</label>
                <div className="space-y-2">
                  {SR_SENIORITY_OPTIONS.map((opt, idx) => (
                    <label key={opt.label} className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checkedSeniorities[idx]}
                        onChange={() => toggleSeniority(idx)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className={`text-sm font-bold ${checkedSeniorities[idx] ? "text-gray-900" : "text-gray-400"}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
                {!anyChecked && (
                  <p className="text-xs text-gray-500 font-bold mt-2">⚠ No seniority selected — will fetch all levels</p>
                )}
              </div>

              {/* Department dropdown */}
              <div>
                <label className="block text-sm font-black mb-2 uppercase tracking-wide">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border-2 border-gray-300 px-3 py-2 text-sm font-bold cursor-pointer focus:border-gray-700 outline-none"
                >
                  {SR_DEPARTMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Max results */}
              <div>
                <label className="block text-sm font-black mb-2 uppercase tracking-wide">Max results</label>
                <select
                  value={fetchLimit}
                  onChange={(e) => setFetchLimit(Number(e.target.value))}
                  className="w-full border-2 border-gray-300 px-3 py-2 text-sm font-bold cursor-pointer focus:border-gray-700 outline-none"
                >
                  <option value={10}>10 people</option>
                  <option value={25}>25 people</option>
                  <option value={50}>50 people</option>
                  <option value={100}>100 people</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Cost: 1 credit total (no email enrichment)</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t-2 border-gray-200 flex gap-3">
              <Button
                onClick={() => setShowSelectionModal(false)}
                variant="outline"
                className="font-black border-2 cursor-pointer flex-1"
              >
                CANCEL
              </Button>
              <Button
                onClick={handleFetch}
                disabled={getAllPersonnelMutation.isPending}
                className="font-black bg-gray-900 text-white cursor-pointer flex-1"
              >
                {getAllPersonnelMutation.isPending ? "FETCHING..." : "FETCH"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && (
        <CSuiteContactsModal
          companyName={companyName}
          companyId={companyId}
          results={results}
          isPending={getAllPersonnelMutation.isPending}
          onRefresh={handleFetch}
          onClose={() => setShowResultsModal(false)}
          fetchLimit={fetchLimit}
          onFetchLimitChange={setFetchLimit}
        />
      )}
    </>
  );
}

function FindAllCSuiteButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<any>(null);

  const { data: existingContacts } = trpc.companyFinder.getCompanyContacts.useQuery({ companyId });

  const findCSuiteMutation = trpc.companyFinder.findAllCSuite.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setShowModal(true);
      if (data.cached) {
        toast.success(`${data.contacts.length} cached decision-makers at ${companyName}`);
      } else if (data.contacts.length > 0) {
        toast.success(`Found ${data.contacts.length} decision-makers at ${companyName} (${data.tierLabel})`);
      } else {
        toast.error(`No decision-makers found at ${companyName} across all seniority tiers`);
      }
    },
    onError: (error) => {
      toast.error(`Decision-maker search failed: ${error.message}`);
    },
  });

  const handleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    findCSuiteMutation.mutate({ companyId });
  };

  const contactCount = existingContacts?.contacts?.length || 0;

  return (
    <>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          if (contactCount > 0) {
            setResults({ contacts: existingContacts?.contacts, tierFound: 0, tierLabel: "Cached", tiersSearched: [], cached: true });
            setShowModal(true);
          } else {
            handleSearch(e);
          }
        }}
        disabled={findCSuiteMutation.isPending}
        size="sm"
        variant="outline"
        className={`text-xs font-black border-2 h-8 px-3 cursor-pointer ${
          contactCount > 0
            ? "border-gray-900 text-gray-900 bg-gray-100"
            : "border-gray-700 text-gray-700"
        }`}
      >
        {findCSuiteMutation.isPending
          ? "SEARCHING..."
          : contactCount > 0
            ? `${contactCount} CONTACTS`
            : "FIND DECISION-MAKERS"}
      </Button>
      {showModal && (
        <CSuiteContactsModal
          companyName={companyName}
          companyId={companyId}
          results={results}
          isPending={findCSuiteMutation.isPending}
          onRefresh={() => findCSuiteMutation.mutate({ companyId })}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// Decision-Makers Modal — Shows Trickle-Down Search Results
// ============================================================================
function CSuiteContactsModal({
  companyName,
  companyId,
  results,
  isPending,
  onRefresh,
  onClose,
  fetchLimit,
  onFetchLimitChange,
}: {
  companyName: string;
  companyId: number;
  results: any;
  isPending: boolean;
  onRefresh: () => void;
  onClose: () => void;
  fetchLimit?: number;
  onFetchLimitChange?: (limit: number) => void;
}) {
  const [enrichingContactId, setEnrichingContactId] = useState<number | null>(null);

  const enrichContactMutation = trpc.companyFinder.enrichContact.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`Contact enriched successfully!`);
      setEnrichingContactId(null);
      // Refresh the contact list
      onRefresh();
    },
    onError: (error) => {
      toast.error(`Enrichment failed: ${error.message}`);
      setEnrichingContactId(null);
    },
  });

  const handleEnrich = (contactId: number) => {
    setEnrichingContactId(contactId);
    enrichContactMutation.mutate({ contactId, includePhone: false });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const contacts = results?.contacts || [];
  const tierFound = results?.tierFound || 0;
  const tierLabel = results?.tierLabel || "";
  const tiersSearched = results?.tiersSearched || [];
  const isCached = results?.cached || false;

  // Tier color mapping
  const tierColors: Record<number, string> = {
    1: "bg-gray-900",
    2: "bg-gray-700",
    3: "bg-gray-600",
    4: "bg-gray-500",
    5: "bg-gray-400",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white max-w-2xl w-full shadow-2xl border-2 border-gray-900 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 text-white px-5 py-3 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-black">Decision-Makers at {companyName}</h2>
            <div className="text-xs opacity-80 flex items-center gap-2">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""} found
              {tierFound > 0 && !isCached && (
                <span className={`inline-block px-2 py-0.5 rounded text-white text-[10px] font-black ${tierColors[tierFound] || "bg-gray-500"}`}>
                  {tierLabel}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white text-xl font-black hover:opacity-60">×</button>
        </div>

        {/* Trickle-Down Tier Progress */}
        {tiersSearched.length > 0 && !isCached && (
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
            <div className="text-[10px] font-black text-muted-foreground mb-1.5">SENIORITY TIERS SEARCHED</div>
            <div className="flex gap-1">
              {[
                { level: 1, label: "C-Suite" },
                { level: 2, label: "VP/Head" },
                { level: 3, label: "Director" },
                { level: 4, label: "Manager" },
                { level: 5, label: "Senior/Entry" },
              ].map((tier) => {
                const searched = tiersSearched.find((t: any) => t.level === tier.level);
                const isFoundTier = tier.level === tierFound;
                const wasSearched = !!searched;
                const count = searched?.count || 0;

                return (
                  <div
                    key={tier.level}
                    className={`flex-1 text-center py-1 text-[9px] font-black border ${
                      isFoundTier
                        ? "border-gray-900 bg-gray-100 text-gray-900 font-black"
                        : wasSearched
                          ? "border-gray-300 bg-white text-gray-400"
                          : "border-gray-200 bg-white text-gray-300"
                    }`}
                  >
                    {isFoundTier ? `✓ ${tier.label} (${count})` : wasSearched ? `✕ ${tier.label}` : tier.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-bold">
              No contacts found across all seniority tiers.
            </div>
          ) : (
            contacts.map((contact: any, idx: number) => (
              <div key={contact.id || idx} className="border border-gray-200 p-3 hover:border-gray-500 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-base">
                      {contact.fullName || `${contact.firstName} ${contact.lastName}`}
                    </div>
                    {contact.title && (
                      <div className="text-sm font-bold text-muted-foreground">{contact.title}</div>
                    )}
                  </div>
                  {contact.searchedTitle && (
                    <span className="text-[10px] font-black border border-gray-300 text-gray-600 px-2 py-0.5 shrink-0">
                      {contact.searchedTitle}
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {!contact.email && (
                    <div className="flex items-center gap-2 col-span-full">
                      <span className="text-xs font-bold text-muted-foreground">No email yet</span>
                      <Button
                        onClick={() => handleEnrich(contact.id)}
                        disabled={enrichingContactId === contact.id}
                        variant="outline"
                        size="sm"
                        className="font-black border-2 border-gray-700 text-gray-700 h-6 px-2 text-[10px] shrink-0 cursor-pointer"
                      >
                        {enrichingContactId === contact.id ? "ENRICHING..." : "ENRICH EMAIL (1 credit)"}
                      </Button>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate flex-1">{contact.email}</span>
                      <Button
                        onClick={() => copyToClipboard(contact.email, "Email")}
                        variant="outline"
                        size="sm"
                        className="font-black border border-black h-6 px-2 text-[10px] shrink-0 cursor-pointer"
                      >
                        COPY
                      </Button>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{contact.phone}</span>
                      <Button
                        onClick={() => copyToClipboard(contact.phone, "Phone")}
                        variant="outline"
                        size="sm"
                        className="font-black border border-black h-6 px-2 text-[10px] shrink-0 cursor-pointer"
                      >
                        COPY
                      </Button>
                    </div>
                  )}
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold underline text-gray-700 truncate"
                    >
                      LinkedIn Profile
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-gray-200 shrink-0">
          {/* Fetch Limit Selector (only for getAllPersonnel) */}
          {fetchLimit !== undefined && onFetchLimitChange && (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-sm font-bold">Fetch Limit:</label>
              <select
                value={fetchLimit}
                onChange={(e) => onFetchLimitChange(Number(e.target.value))}
                className="border-2 border-gray-300 rounded px-2 py-1 text-sm font-bold cursor-pointer"
              >
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
              <span className="text-xs text-muted-foreground">Maximum employees to fetch</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={onRefresh}
              disabled={isPending}
              variant="outline"
              className="font-black border-2 border-gray-700 text-gray-700 cursor-pointer flex-1"
            >
              {isPending ? "SEARCHING..." : "SEARCH AGAIN"}
            </Button>
            <Button onClick={onClose} className="font-black bg-black text-white cursor-pointer flex-1">
              CLOSE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
