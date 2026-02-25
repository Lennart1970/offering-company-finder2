import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import CompanyDecisionButtons from "@/components/CompanyDecisionButtons";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";

export default function SearchResults() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ searchId: string }>();
  const searchIdParam = params.searchId;

  // If "select" is the param, show the search selector
  const isSelectMode = searchIdParam === "select" || !searchIdParam;
  const searchId = isSelectMode ? null : parseInt(searchIdParam, 10);

  // Fetch search data
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

  // Fetch search history for selector
  const { data: searchHistory } = trpc.companyFinder.getSearchHistory.useQuery();

  // Fetch excluded codes
  const { data: excludedCodes } = trpc.companyFinder.getExcludedCodes.useQuery();

  const utils = trpc.useUtils();

  // Sector-level exclusions
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

  // Build excluded code sets for filtering
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
                  style={{ width: `${(((searchData.search.codesSearched ?? 0) / searchData.search.codesTotal) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      {searchData.search.status === "completed" && searchData.companies.length > 0 && (
        <>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-3xl md:text-4xl font-black">
                [{filteredCompanies.length} MATCHES]
              </h3>
              <div className="flex items-center gap-4 mt-2 text-sm font-black flex-wrap">
                {enrichmentStats && (
                  <>
                    <span className="border-2 border-black px-3 py-1">
                      {enrichmentStats.enriched} ENRICHED
                    </span>
                    <span className="border-2 border-black px-3 py-1 bg-gray-100">
                      {enrichmentStats.pending} PENDING
                    </span>
                  </>
                )}
                {excludedCompanies.length > 0 && (
                  <button
                    onClick={() => setShowExcluded(!showExcluded)}
                    className="border-2 border-red-600 text-red-600 px-3 py-1 cursor-pointer"
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

// Company card component
function CompanyCard({ company, index, searchId }: { company: any; index: number; searchId: number }) {
  const hasSicCodes = !!(company.sicCodes && JSON.parse(company.sicCodes).length > 0);
  const hasNaicsCodes = !!(company.naicsCodes && JSON.parse(company.naicsCodes).length > 0);

  return (
    <div id={`company-${company.id}`} className="border-4 border-black p-6 bg-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-black">[{String(index + 1).padStart(2, "0")}]</span>
            {company.enrichmentStatus === "enriched" ? (
              <span className="text-xs font-black border-2 border-black px-2 py-0.5 bg-black text-white">ENRICHED</span>
            ) : company.enrichmentStatus === "failed" ? (
              <span className="text-xs font-black border-2 border-red-600 text-red-600 px-2 py-0.5">ENRICH FAILED</span>
            ) : (
              <span className="text-xs font-black border-2 border-current px-2 py-0.5 opacity-50">PENDING</span>
            )}
            {company.briefData && (
              <span className="text-xs font-black border-2 border-blue-600 text-blue-600 px-2 py-0.5">RESEARCHED</span>
            )}
            {company.salesApproachData && (
              <span className="text-xs font-black border-2 border-green-600 text-green-600 px-2 py-0.5">SALES READY</span>
            )}
          </div>
          <h4 className="text-2xl md:text-3xl font-black mb-2">{company.name}</h4>
          {company.websiteUrl && (
            <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-lg font-bold underline break-all">
              {company.websiteUrl}
            </a>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 text-sm">
        {company.enrichmentStatus === "enriched" && (company.city || company.state || company.country) && (
          <div className="md:col-span-3 border-t-2 border-current pt-4 mt-2">
            <div className="font-black mb-1">LOCATION</div>
            <div className="font-bold">{[company.city, company.state, company.country].filter(Boolean).join(", ")}</div>
            {company.streetAddress && <div className="font-bold text-xs mt-1">{company.streetAddress}</div>}
          </div>
        )}
        {company.searchLocation && (
          <div className={company.enrichmentStatus !== "enriched" ? "md:col-span-3" : ""}>
            <div className="font-black mb-1">SEARCH LOCATION</div>
            <div className="font-bold">{company.searchLocation}</div>
          </div>
        )}
        {company.phone && (
          <div>
            <div className="font-black mb-1">PHONE</div>
            <div className="font-bold">{company.phone}</div>
          </div>
        )}
        {company.foundedYear && (
          <div>
            <div className="font-black mb-1">FOUNDED</div>
            <div className="font-bold">{company.foundedYear}</div>
          </div>
        )}
        {company.revenue && (
          <div>
            <div className="font-black mb-1">REVENUE</div>
            <div className="font-bold">{company.revenue}</div>
          </div>
        )}
        {company.headcountGrowth && (
          <div>
            <div className="font-black mb-1">GROWTH</div>
            <div className="font-bold">{company.headcountGrowth}</div>
          </div>
        )}
        {company.linkedinUrl && (
          <div className="md:col-span-2">
            <div className="font-black mb-1">LINKEDIN</div>
            <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline break-all">
              {company.linkedinUrl}
            </a>
          </div>
        )}
        <CompanyCodeDisplay sicCodes={company.sicCodes} naicsCodes={company.naicsCodes} />
      </div>

      {/* Decision Buttons */}
      <div className="mt-4 pt-4 border-t-2 border-current">
        <CompanyDecisionButtons
          companyId={company.id}
          searchId={searchId}
          companyName={company.name}
          hasSicCodes={hasSicCodes}
          hasNaicsCodes={hasNaicsCodes}
        />
      </div>

      {/* Enrich Button */}
      {company.enrichmentStatus === "pending" && (
        <div className="mt-3">
          <EnrichButton companyId={company.id} companyName={company.name} />
        </div>
      )}

      {/* Deep Research + Sales Approach + Contact */}
      {company.enrichmentStatus === "enriched" && (
        <div className="mt-3 flex flex-col gap-2">
          <DeepResearchButton companyId={company.id} companyName={company.name} />
          {company.briefData && (
            <CreateSalesApproachButton companyId={company.id} companyName={company.name} />
          )}
          <FindContactButton companyId={company.id} companyName={company.name} />
        </div>
      )}
    </div>
  );
}

// Enrich button
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
      className="w-full text-sm px-4 py-3 font-black border-2 border-black bg-gray-100 text-black cursor-pointer"
    >
      {enrichMutation.isPending ? "[ENRICHING...]" : "[ENRICH]"}
    </Button>
  );
}

// Deep Research button with modal
function DeepResearchButton({ companyId, companyName }: { companyId: number; companyName: string }) {
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
        variant="outline"
        className="font-black border-2 border-blue-600 text-blue-600 bg-blue-50 w-full cursor-pointer"
      >
        {isGenerating ? "[RESEARCHING...]" : "[DEEP RESEARCH]"}
      </Button>

      {showBrief && briefData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBrief(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black">{companyName} - Deep Research</h2>
              <button onClick={() => setShowBrief(false)} className="text-2xl font-black">×</button>
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

// Sales Approach button with modal
function CreateSalesApproachButton({ companyId, companyName }: { companyId: number; companyName: string }) {
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
        variant="outline"
        className="font-black border-2 border-green-600 text-green-600 bg-green-50 w-full cursor-pointer"
      >
        {isGenerating ? "[CREATING APPROACH...]" : "[CREATE SALES APPROACH]"}
      </Button>

      {showApproach && salesApproach && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApproach(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black">{companyName} - Sales Approach</h2>
              <button onClick={() => setShowApproach(false)} className="text-2xl font-black">×</button>
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

// Find Contact button
function FindContactButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [jobTitle, setJobTitle] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [contactData, setContactData] = useState<any>(null);
  const [showContact, setShowContact] = useState(false);
  const [includePhone, setIncludePhone] = useState(false);

  const { data: existingContact } = trpc.companyFinder.getContact.useQuery({ companyId });

  const findContactMutation = trpc.companyFinder.findContact.useMutation({
    onSuccess: (data) => {
      if (data.success && data.contact) {
        setContactData(data.contact);
        setShowContact(true);
        setShowInput(false);
        toast.success(data.cached ? "Using cached contact" : `Found: ${data.contact.fullName || `${data.contact.firstName} ${data.contact.lastName}`}`);
      } else {
        toast.error("message" in data ? data.message : "No contact found");
      }
    },
    onError: (error) => {
      toast.error(`Contact search failed: ${error.message}`);
    },
  });

  const handleSearch = () => {
    if (!jobTitle.trim()) { toast.error("Please enter a job title"); return; }
    findContactMutation.mutate({ companyId, jobTitle: jobTitle.trim(), includePhone });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (existingContact?.contact) {
    const c = existingContact.contact;
    return (
      <>
        <Button
          onClick={(e) => { e.stopPropagation(); setContactData(c); setShowContact(true); }}
          variant="outline"
          className="font-black border-2 border-orange-600 text-orange-600 bg-orange-50 w-full cursor-pointer"
        >
          [VIEW CONTACT: {c.fullName || `${c.firstName} ${c.lastName}`}]
        </Button>
        {showContact && contactData && (
          <ContactModal contact={contactData} companyName={companyName} onClose={() => setShowContact(false)} />
        )}
      </>
    );
  }

  return (
    <>
      {!showInput ? (
        <Button
          onClick={(e) => { e.stopPropagation(); setShowInput(true); }}
          variant="outline"
          className="font-black border-2 border-orange-600 text-orange-600 bg-orange-50 w-full cursor-pointer"
        >
          [FIND CONTACT]
        </Button>
      ) : (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Job title (e.g. VP Operations)"
              className="flex-1 px-3 py-2 border-2 border-orange-600 font-bold text-sm bg-white text-black"
              autoFocus
            />
            <Button onClick={handleSearch} disabled={findContactMutation.isPending} className="font-black border-2 border-orange-600 bg-orange-600 text-white px-4 cursor-pointer">
              {findContactMutation.isPending ? "..." : "GO"}
            </Button>
            <Button onClick={() => setShowInput(false)} variant="outline" className="font-black border-2 border-black px-3 cursor-pointer">×</Button>
          </div>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={includePhone}
              onChange={(e) => setIncludePhone(e.target.checked)}
              className="accent-orange-600 w-4 h-4"
            />
            <span className="text-xs font-bold text-black">Include phone number</span>
            <span className="text-xs font-bold text-red-600">⚠ +8 credits</span>
          </label>
        </div>
      )}
      {showContact && contactData && (
        <ContactModal contact={contactData} companyName={companyName} onClose={() => setShowContact(false)} />
      )}
    </>
  );
}

// Contact modal
function ContactModal({ contact, companyName, onClose }: { contact: any; companyName: string; onClose: () => void }) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-lg w-full p-6 border-4 border-orange-600" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-black text-black">Contact at {companyName}</h2>
          <button onClick={onClose} className="text-2xl font-black text-black">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-black text-orange-600 mb-1">NAME</div>
            <div className="text-xl font-black text-black">{contact.fullName || `${contact.firstName} ${contact.lastName}`}</div>
          </div>
          {contact.title && (
            <div><div className="text-xs font-black text-orange-600 mb-1">TITLE</div><div className="font-bold text-black">{contact.title}</div></div>
          )}
          {contact.email && (
            <div className="flex items-center justify-between">
              <div><div className="text-xs font-black text-orange-600 mb-1">EMAIL</div><div className="font-bold text-black">{contact.email}</div></div>
              <Button onClick={() => copyToClipboard(contact.email, "Email")} variant="outline" size="sm" className="font-black border-2 border-black text-black cursor-pointer">COPY</Button>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center justify-between">
              <div><div className="text-xs font-black text-orange-600 mb-1">PHONE</div><div className="font-bold text-black">{contact.phone}</div></div>
              <Button onClick={() => copyToClipboard(contact.phone, "Phone")} variant="outline" size="sm" className="font-black border-2 border-black text-black cursor-pointer">COPY</Button>
            </div>
          )}
          {contact.linkedinUrl && (
            <div>
              <div className="text-xs font-black text-orange-600 mb-1">LINKEDIN</div>
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-black break-all">{contact.linkedinUrl}</a>
            </div>
          )}
          {contact.searchedTitle && (
            <div><div className="text-xs font-black text-orange-600 mb-1">SEARCHED FOR</div><div className="font-bold text-black opacity-60">{contact.searchedTitle}</div></div>
          )}
        </div>
        <Button onClick={onClose} className="w-full mt-6 font-black bg-black text-white cursor-pointer">CLOSE</Button>
      </div>
    </div>
  );
}
