import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import CompanyDecisionButtons from "@/components/CompanyDecisionButtons";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";

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
  const [, navigate] = useLocation();
  const params = useParams<{ searchId: string }>();
  const searchIdParam = params.searchId;

  const isSelectMode = searchIdParam === "select" || !searchIdParam;
  const searchId = isSelectMode ? null : parseInt(searchIdParam, 10);

  const { data: searchData, isLoading: searchLoading } = trpc.companyFinder.getSearch.useQuery(
    { searchId: searchId! },
    {
      enabled: !!searchId,
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.search.status === "completed" || data?.search.status === "failed" ? false : 2000;
      },
    }
  );

  const { data: searchHistory } = trpc.companyFinder.getSearchHistory.useQuery();
  const { data: excludedCodes } = trpc.companyFinder.getExcludedCodes.useQuery();
  const utils = trpc.useUtils();

  const [excludedSectors, setExcludedSectors] = useState<string[]>([]);
  const [showCallTodayOnly, setShowCallTodayOnly] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    if (searchData?.search.excludedSectors) {
      try {
        setExcludedSectors(JSON.parse(searchData.search.excludedSectors));
      } catch {}
    }
  }, [searchData?.search.excludedSectors]);

  const enrichAllMutation = trpc.companyFinder.enrichAll.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
    },
    onError: (error) => {
      toast.error(`Enrichment failed: ${error.message}`);
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
    if (!searchData?.companies) return { filteredCompanies: [], excludedCompanies: [], callTodayCompanies: [] };

    const filtered: typeof searchData.companies = [];
    const excluded: typeof searchData.companies = [];

    for (const company of searchData.companies) {
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
  }, [searchData?.companies, searchData?.decisions, excludedSicSet, excludedNaicsSet, excludedSectorsSet]);

  const displayedCompanies = showCallTodayOnly ? callTodayCompanies : filteredCompanies;

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

        {searchHistory && searchHistory.length > 0 ? (
          <div className="space-y-3">
            {searchHistory
              .filter((s: any) => s.status === "completed" || s.status === "searching")
              .map((search: any) => (
                <div
                  key={search.id}
                  onClick={() => navigate(`/search-results/${search.id}`)}
                  className="border-4 border-black p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-black">{search.offeringName || "Untitled"}</div>
                      <div className="text-sm font-bold text-muted-foreground mt-1">
                        {search.location} — {new Date(search.createdAt).toLocaleDateString()} — Run #{search.id}
                      </div>
                    </div>
                    <span className={`text-xs font-black border-2 px-3 py-1 ${
                      search.status === "completed" ? "border-green-600 text-green-600" :
                      search.status === "searching" ? "border-blue-600 text-blue-600" :
                      "border-black"
                    }`}>
                      {search.status?.toUpperCase()}
                    </span>
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
  const hasPendingCompanies = enrichmentStats && enrichmentStats.pending > 0;

  return (
    <div className="max-w-6xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="text-xs font-black text-muted-foreground mb-2">[03] COCKPIT</div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-black leading-none">
              RESULTS: {searchData.search.offeringName || "Search"}
            </h1>
            <div className="text-sm font-bold text-muted-foreground mt-2">
              Run #{searchData.search.id} — {searchData.search.location} — {new Date(searchData.search.createdAt).toLocaleDateString()}
            </div>
          </div>
          <Button
            onClick={() => navigate("/search-results/select")}
            variant="outline"
            className="text-sm font-black border-2 border-black"
          >
            ← CHANGE SEARCH
          </Button>
        </div>
      </div>

      {/* Search still in progress */}
      {searchData.search.status === "searching" && (
        <div className="border-4 border-blue-600 bg-blue-50 p-6 mb-8">
          <div className="text-xl font-black text-blue-600 animate-pulse mb-4">→ SEARCH IN PROGRESS...</div>
          {searchData.search.codesTotal && searchData.search.codesSearched !== null && (
            <div>
              <div className="text-lg font-bold text-gray-700">
                Searching keyword {(searchData.search.codesSearched ?? 0) + 1} of {searchData.search.codesTotal}
              </div>
              <div className="mt-3 w-full bg-gray-200 h-4">
                <div
                  className="bg-blue-600 h-4 transition-all duration-300"
                  style={{
                    width: `${((searchData.search.codesSearched ?? 0) / (searchData.search.codesTotal || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {(searchData.search.status === "completed" || searchData.search.status === "searching") && searchData.companies.length > 0 && (
        <>
          {/* Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-black">[{filteredCompanies.length} MATCHES]</div>
              <div className="flex gap-3">
                <span className="text-xs font-black border-2 border-black px-3 py-1">
                  {enrichmentStats?.enriched || 0} ENRICHED
                </span>
                <span className="text-xs font-black border-2 border-black px-3 py-1">
                  {enrichmentStats?.pending || 0} PENDING
                </span>
                {excludedCompanies.length > 0 && (
                  <button
                    onClick={() => setShowExcluded(!showExcluded)}
                    className="text-xs font-black border-2 border-red-600 text-red-600 px-3 py-1 cursor-pointer"
                  >
                    {excludedCompanies.length} EXCLUDED {showExcluded ? "▲" : "▼"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasPendingCompanies && (
                <Button
                  onClick={() => enrichAllMutation.mutate({ searchId: searchId! })}
                  disabled={enrichAllMutation.isPending}
                  className="text-lg px-6 py-4 font-black border-4 border-black bg-black text-white"
                >
                  {enrichAllMutation.isPending
                    ? "[ENRICHING...]"
                    : `[ENRICH ALL — ${enrichmentStats?.pending}]`}
                </Button>
              )}
              <Button
                onClick={handleExportCsv}
                variant="outline"
                className="text-lg px-6 py-4 font-black border-4 border-black"
              >
                EXPORT CSV
              </Button>
            </div>
          </div>

          {/* Enrichment Progress */}
          {enrichAllMutation.isPending && (
            <div className="border-4 border-black p-6 mb-6 animate-pulse">
              <div className="text-xl font-black">→ ENRICHING COMPANY DETAILS...</div>
              <div className="text-sm font-bold mt-2">
                Fetching addresses, SIC/NAICS codes for {enrichmentStats?.pending} companies.
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
              className={`text-sm px-4 py-3 font-black border-4 border-black ${
                !showCallTodayOnly ? 'bg-black text-white' : ''
              }`}
            >
              ALL ({filteredCompanies.length})
            </Button>
            <Button
              onClick={() => setShowCallTodayOnly(true)}
              variant="outline"
              className={`text-sm px-4 py-3 font-black border-4 border-black ${
                showCallTodayOnly ? 'bg-green-500 text-white' : ''
              }`}
            >
              CALL TODAY ({callTodayCompanies?.length || 0})
            </Button>
          </div>

          {/* Company Cards */}
          <div className="space-y-4">
            {displayedCompanies?.map((company, index) => (
              <CompanyCard
                key={company.id}
                company={company}
                index={index}
                searchId={searchId!}
              />
            ))}
          </div>
        </>
      )}

      {searchData.search.status === "completed" && searchData.companies.length === 0 && (
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
// Company Card — Compact Layout
// ============================================================================
function CompanyCard({ company, index, searchId }: { company: any; index: number; searchId: number }) {
  const hasSicCodes = !!(company.sicCodes && JSON.parse(company.sicCodes).length > 0);
  const hasNaicsCodes = !!(company.naicsCodes && JSON.parse(company.naicsCodes).length > 0);

  const location = company.enrichmentStatus === "enriched" && (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : company.searchLocation || "—";

  return (
    <div id={`company-${company.id}`} className="border-4 border-black bg-white">
      {/* Header Row: Index + Badges + Name + Website */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-black text-muted-foreground">[{String(index + 1).padStart(2, "0")}]</span>
              {company.enrichmentStatus === "enriched" ? (
                <span className="text-[10px] font-black border border-black px-1.5 py-0.5 bg-black text-white">ENRICHED</span>
              ) : company.enrichmentStatus === "failed" ? (
                <span className="text-[10px] font-black border border-red-600 text-red-600 px-1.5 py-0.5">FAILED</span>
              ) : (
                <span className="text-[10px] font-black border border-current px-1.5 py-0.5 opacity-40">PENDING</span>
              )}
              {company.briefData && (
                <span className="text-[10px] font-black border border-blue-600 text-blue-600 px-1.5 py-0.5">RESEARCHED</span>
              )}
              {company.salesApproachData && (
                <span className="text-[10px] font-black border border-green-600 text-green-600 px-1.5 py-0.5">SALES READY</span>
              )}
            </div>
            <h4 className="text-xl md:text-2xl font-black leading-tight truncate">{company.name}</h4>
            {company.websiteUrl && (
              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground underline truncate block mt-0.5">
                {company.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Data Grid — Compact */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm border-t border-gray-200 pt-3">
          <div>
            <div className="text-[10px] font-black text-muted-foreground">LOCATION</div>
            <div className="font-bold text-sm truncate">{location}</div>
          </div>
          {company.revenue && (
            <div>
              <div className="text-[10px] font-black text-muted-foreground">REVENUE</div>
              <div className="font-bold text-sm">{formatRevenue(company.revenue)}</div>
            </div>
          )}
          {company.employeeCount && (
            <div>
              <div className="text-[10px] font-black text-muted-foreground">EMPLOYEES</div>
              <div className="font-bold text-sm">{formatEmployees(company.employeeCount)}</div>
            </div>
          )}
          {company.phone && (
            <div>
              <div className="text-[10px] font-black text-muted-foreground">PHONE</div>
              <div className="font-bold text-sm">{company.phone}</div>
            </div>
          )}
          {company.foundedYear && (
            <div>
              <div className="text-[10px] font-black text-muted-foreground">FOUNDED</div>
              <div className="font-bold text-sm">{company.foundedYear}</div>
            </div>
          )}
          {company.linkedinUrl && (
            <div className="col-span-2">
              <div className="text-[10px] font-black text-muted-foreground">LINKEDIN</div>
              <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-sm underline truncate block">
                {company.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
          )}
        </div>

        {/* SIC/NAICS Codes — Inline */}
        <div className="mt-2">
          <CompanyCodeDisplay sicCodes={company.sicCodes} naicsCodes={company.naicsCodes} />
        </div>
      </div>

      {/* Decision + Action Buttons — Compact Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t-2 border-black">
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
                <DeepResearchButton companyId={company.id} companyName={company.name} hasResearch={!!company.briefData} />
                {company.briefData && (
                  <CreateSalesApproachButton companyId={company.id} companyName={company.name} hasSalesApproach={!!company.salesApproachData} />
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
          hasResearch ? "border-blue-600 text-blue-600 bg-blue-50" : "border-blue-600 text-blue-600"
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
            <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-600 rounded">
              <div className="text-3xl font-black text-blue-600 mb-2">Urgency Score: {briefData.urgencyScore}/100</div>
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
                      {typeof dev !== 'string' && dev.sourceUrl && <a href={dev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Source</a>}
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
                  {briefData.conversationStarters.map((starter: any, i: number) => (
                    <li key={i} className="text-blue-600">{typeof starter === 'string' ? starter : starter.opener || starter}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Products & Services */}
            {briefData.productsServices?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Products & Services</h3>
                {briefData.productsServices.map((ps: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="font-bold">{ps.category}{ps.sourceUrl && <a href={ps.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline ml-2 font-normal">Source</a>}</div>
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
                    <div className="font-bold">{tech.name}{tech.sourceUrl && <a href={tech.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline ml-2 font-normal">Source</a>}</div>
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
                    <div key={i} className="p-3 bg-yellow-50 border border-yellow-300 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-sm">{signal.category} — {signal.type}</span>
                          <div className="text-sm mt-1">{signal.description}</div>
                          {signal.snippet && <div className="text-xs text-gray-600 italic mt-1 border-l-2 border-yellow-400 pl-2">"{signal.snippet}"</div>}
                          {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Source</a>}
                        </div>
                        <span className="text-sm font-black text-yellow-700 ml-4">+{signal.weight}</span>
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
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">{source.title || source.url}</a>
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
          hasSalesApproach ? "border-green-600 text-green-600 bg-green-50" : "border-green-600 text-green-600"
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
              <div className="mb-6 p-4 border-2 border-amber-600 rounded">
                <h3 className="text-xl font-black text-amber-600 mb-2">Conversation Starters</h3>
                <div className="space-y-3">
                  {salesApproach.conversationStarters.map((starter: any, i: number) => (
                    <div key={i} className="p-2 bg-amber-50 rounded">
                      <div className="text-sm font-medium">{typeof starter === 'string' ? starter : starter.opener}</div>
                      {typeof starter !== 'string' && starter.basedOn && <div className="text-xs text-gray-500 mt-1">Based on: {starter.basedOn}</div>}
                      {typeof starter !== 'string' && starter.sourceUrl && <a href={starter.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Source</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Draft */}
            <div className="mb-6 p-4 border-2 border-green-600 rounded">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-green-600">Email Draft</h3>
                <Button onClick={() => copyToClipboard(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")} variant="outline" size="sm" className="font-black">COPY</Button>
              </div>
              <div className="mb-2"><span className="font-bold">Subject:</span> {salesApproach.emailDraft.subject}</div>
              <div className="whitespace-pre-wrap text-sm">{salesApproach.emailDraft.body}</div>
              {salesApproach.emailDraft.referencedSources?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <div className="text-xs text-gray-500">Referenced sources:</div>
                  {salesApproach.emailDraft.referencedSources.map((src: string, i: number) => (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline block">{src}</a>
                  ))}
                </div>
              )}
            </div>

            {/* LinkedIn Message */}
            <div className="mb-6 p-4 border-2 border-blue-600 rounded">
              <h3 className="text-xl font-black text-blue-600 mb-2">LinkedIn Message</h3>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Connection Request:</span>
                  <Button onClick={() => copyToClipboard(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} variant="outline" size="sm" className="font-black">COPY</Button>
                </div>
                <div className="text-sm bg-blue-50 p-2 rounded">{salesApproach.linkedinMessage.connectionRequest}</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Follow-up:</span>
                  <Button onClick={() => copyToClipboard(salesApproach.linkedinMessage.followUp, "Follow-up")} variant="outline" size="sm" className="font-black">COPY</Button>
                </div>
                <div className="text-sm bg-blue-50 p-2 rounded">{salesApproach.linkedinMessage.followUp}</div>
              </div>
            </div>

            {/* Call Script */}
            <div className="mb-6 p-4 border-2 border-purple-600 rounded">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-purple-600">Call Script</h3>
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
function GetAllPersonnelButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<any>(null);

  const { data: existingContacts } = trpc.companyFinder.getCompanyContacts.useQuery({ companyId });

  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => {
      setResults({ contacts: data.contacts, totalFound: data.totalFound });
      setShowModal(true);
      toast.success(`Found ${data.contacts.length} personnel at ${companyName} (${data.totalFound} total in database)`);
    },
    onError: (error) => {
      toast.error(`Personnel search failed: ${error.message}`);
    },
  });

  const handleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    getAllPersonnelMutation.mutate({ companyId, limit: 25 });
  };

  const contactCount = existingContacts?.contacts?.length || 0;

  return (
    <>
      <Button
        onClick={handleSearch}
        disabled={getAllPersonnelMutation.isPending}
        size="sm"
        variant="outline"
        className="text-xs font-black border-2 border-blue-600 text-blue-600 h-8 px-3 cursor-pointer"
      >
        {getAllPersonnelMutation.isPending
          ? "SEARCHING..."
          : "GET ALL PERSONNEL"}
      </Button>
      {showModal && (
        <CSuiteContactsModal
          companyName={companyName}
          companyId={companyId}
          results={results}
          isPending={getAllPersonnelMutation.isPending}
          onRefresh={() => getAllPersonnelMutation.mutate({ companyId, limit: 25 })}
          onClose={() => setShowModal(false)}
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
            ? "border-purple-600 text-purple-600 bg-purple-50"
            : "border-purple-600 text-purple-600"
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
}: {
  companyName: string;
  companyId: number;
  results: any;
  isPending: boolean;
  onRefresh: () => void;
  onClose: () => void;
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
    1: "bg-red-600",
    2: "bg-orange-500",
    3: "bg-yellow-500",
    4: "bg-blue-500",
    5: "bg-gray-500",
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white max-w-2xl w-full rounded-lg shadow-2xl border-2 border-purple-600 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-purple-600 text-white px-5 py-3 flex justify-between items-center shrink-0">
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
                        ? "border-green-500 bg-green-50 text-green-700"
                        : wasSearched
                          ? "border-red-300 bg-red-50 text-red-400"
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
              <div key={contact.id || idx} className="border-2 border-gray-200 p-3 hover:border-purple-300 transition-colors">
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
                    <span className="text-[10px] font-black border border-purple-300 text-purple-600 px-2 py-0.5 shrink-0">
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
                        className="font-black border-2 border-green-600 text-green-600 h-6 px-2 text-[10px] shrink-0 cursor-pointer"
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
                      className="text-xs font-bold underline text-blue-600 truncate"
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
        <div className="px-5 py-3 border-t-2 border-gray-200 flex gap-3 shrink-0">
          <Button
            onClick={onRefresh}
            disabled={isPending}
            variant="outline"
            className="font-black border-2 border-purple-600 text-purple-600 cursor-pointer flex-1"
          >
            {isPending ? "SEARCHING..." : "SEARCH AGAIN"}
          </Button>
          <Button onClick={onClose} className="font-black bg-black text-white cursor-pointer flex-1">
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}
