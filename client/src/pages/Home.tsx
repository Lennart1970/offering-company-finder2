import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { normalizeWebsiteUrl } from "@shared/urlUtils";
import { useLocation } from "wouter";
import CompanyDecisionButtons from "@/components/CompanyDecisionButtons";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";
import SelectedCodesDisplay from "@/components/SelectedCodesDisplay";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [location, setLocation] = useState("");
  const [searchId, setSearchId] = useState<number | null>(null);

  // Check for searchId and companyId in URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearchId = params.get("searchId");
    const urlCompanyId = params.get("companyId");
    
    if (urlSearchId) {
      setSearchId(parseInt(urlSearchId, 10));
    }
    
    // Scroll to and highlight company if companyId is present
    if (urlCompanyId) {
      // Wait for DOM to render, then scroll
      setTimeout(() => {
        const companyCard = document.getElementById(`company-${urlCompanyId}`);
        if (companyCard) {
          companyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          companyCard.style.backgroundColor = '#ffeb3b';
          companyCard.style.transition = 'background-color 2s';
          setTimeout(() => {
            companyCard.style.backgroundColor = 'white';
          }, 2000);
        }
      }, 500);
    }
  }, []);

  const startSearchMutation = trpc.companyFinder.startSearch.useMutation({
    onSuccess: (data) => {
      setSearchId(data.searchId);
      toast.success("Search started");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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

  const utils = trpc.useUtils();



  const enrichAllMutation = trpc.companyFinder.enrichAll.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Refetch search data to get updated enrichment statuses
      if (searchId) {
        utils.companyFinder.getSearch.invalidate({ searchId });
      }
    },
    onError: (error) => {
      toast.error(`Enrichment failed: ${error.message}`);
    },
  });

  const confirmAndSearchMutation = trpc.companyFinder.confirmAndSearch.useMutation({
    onSuccess: () => {
      toast.success("Batched keyword search started! Progress will update automatically.");
      // Refetch search data to see progress
      if (searchId) {
        utils.companyFinder.getSearch.invalidate({ searchId });
      }
    },
    onError: (error) => {
      toast.error(`Failed to start search: ${error.message}`);
    },
  });

  const handleConfirmSearch = () => {
    if (!searchId) return;
    confirmAndSearchMutation.mutate({ searchId });
  };

  // Fetch excluded codes for filtering
  const { data: excludedCodes } = trpc.companyFinder.getExcludedCodes.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Sector-level exclusions (persisted per search)
  const [excludedSectors, setExcludedSectors] = useState<string[]>([]);
  
  // Call Today filter
  const [showCallTodayOnly, setShowCallTodayOnly] = useState(false);

  // Load excluded sectors from search data when it arrives
  useEffect(() => {
    if (searchData?.search.excludedSectors) {
      try {
        setExcludedSectors(JSON.parse(searchData.search.excludedSectors));
      } catch {}
    }
  }, [searchData?.search.excludedSectors]);

  const exportCsvQuery = trpc.companyFinder.exportCsv.useQuery(
    { searchId: searchId! },
    { enabled: false }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      toast.error("Please enter a location");
      return;
    }

    startSearchMutation.mutate({ location });
  };

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

  const handleEnrichAll = () => {
    if (!searchId) return;
    enrichAllMutation.mutate({ searchId });
  };

  const handleReset = () => {
    setSearchId(null);
    setLocation("");
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

  // Filter companies: hide those with excluded SIC/NAICS codes OR excluded sectors
  const [showExcluded, setShowExcluded] = useState(false);

  const excludedSectorsSet = useMemo(() => new Set(excludedSectors), [excludedSectors]);

  const { filteredCompanies, excludedCompanies, callTodayCompanies } = useMemo(() => {
    if (!searchData?.companies) return { filteredCompanies: [], excludedCompanies: [], callTodayCompanies: [] };

    const filtered: typeof searchData.companies = [];
    const excluded: typeof searchData.companies = [];

    for (const company of searchData.companies) {
      let isExcluded = false;

      // Check if company belongs to an excluded NAICS sector (2-digit prefix)
      if (company.naicsCodes && excludedSectorsSet.size > 0) {
        try {
          const codes: string[] = JSON.parse(company.naicsCodes);
          if (codes.some((c) => excludedSectorsSet.has(c.substring(0, 2)))) {
            isExcluded = true;
          }
        } catch {}
      }

      if (!isExcluded && company.enrichmentStatus === "enriched") {
        // Check SIC codes against individual exclusion list
        if (company.sicCodes) {
          try {
            const codes: string[] = JSON.parse(company.sicCodes);
            if (codes.some((c) => excludedSicSet.has(c))) {
              isExcluded = true;
            }
          } catch {}
        }

        // Check NAICS codes against individual exclusion list
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

    // Separate out call today companies
    const callToday = filtered.filter(c => {
      const decision = searchData?.decisions?.find((d: any) => d.companyId === c.id);
      return decision?.decision === 'call_today';
    });
    
    return { filteredCompanies: filtered, excludedCompanies: excluded, callTodayCompanies: callToday };
  }, [searchData?.companies, searchData?.decisions, excludedSicSet, excludedNaicsSet, excludedSectorsSet]);
  
  // Apply Call Today filter
  const displayedCompanies = showCallTodayOnly ? callTodayCompanies : filteredCompanies;



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl font-black">LOADING</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-12 px-4">
        <div className="max-w-4xl w-full">
          <h1 className="text-[12vw] md:text-[8rem] font-black leading-none mb-8">
            [COMPANY<br />FINDER]
          </h1>
          <div className="border-t-8 border-black pt-8">
            <p className="text-2xl md:text-3xl font-bold mb-8 max-w-2xl">
              ANALYZE TARGET BUSINESS → EXTRACT OFFERINGS → FIND SIMILAR COMPANIES
            </p>
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              className="text-2xl px-12 py-8 font-black border-4 border-black"
              variant="outline"
            >
              [LOGIN]
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Enrichment stats
  const enrichmentStats = searchData?.enrichmentStats;
  const hasEnrichedCompanies = enrichmentStats && enrichmentStats.enriched > 0;
  const hasPendingCompanies = enrichmentStats && enrichmentStats.pending > 0;

  const excludedCount = excludedCodes?.length || 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b-8 border-black p-8">
        <div className="container flex justify-between items-center">
          <h1 className="text-5xl md:text-7xl font-black leading-none">[CF]</h1>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/exclusions")}
              variant="outline"
              className="text-lg px-6 py-4 font-black border-4 border-black relative"
            >
              EXCLUSIONS
              {excludedCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-black w-6 h-6 flex items-center justify-center">
                  {excludedCount}
                </span>
              )}
            </Button>
            <Button
              onClick={() => navigate("/history")}
              variant="outline"
              className="text-lg px-6 py-4 font-black border-4 border-black"
            >
              HISTORY
            </Button>

            <div className="text-right">
              <div className="text-sm font-bold mb-2">{user?.name || user?.email}</div>
              <Button onClick={() => (window.location.href = "/")} variant="ghost" className="text-xs font-bold underline">
                RESET
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-16">
        {!searchId ? (
          /* Search Form */
          <div className="max-w-4xl">
            <div className="mb-16">
              <h2 className="text-[8vw] md:text-8xl font-black leading-none mb-4">
                INPUT
                <br />
                TARGET
              </h2>

            </div>

            {/* ConnectGroup Offering Info */}
            <div className="mb-12 p-8 border-4 border-black bg-gray-50 cursor-pointer" onClick={() => navigate("/offering")}>
              <div className="text-sm font-black mb-2 text-muted-foreground">[OFFERING]</div>
              <h3 className="text-2xl font-black mb-4">Electronics Manufacturing Services (EMS)</h3>
              <p className="text-base font-bold mb-4">
                Full-service EMS subcontractor: PCB Assembly • Cable Assembly • Module Building • Design to Product
              </p>
              <div className="text-sm font-black mb-2 text-muted-foreground">[TARGET MARKETS]</div>
              <p className="text-base font-bold">
                Railway • Healthcare/MedTech • Infrastructure • Automotive & Off-road • Defense & Avionics • Industrial Manufacturing • Electronics • Telecommunications • Energy • Automation • Instrumentation • Aerospace • Marine • Agricultural Equipment • Construction Equipment • Mining • Oil & Gas • Renewable Energy • IoT • Embedded Systems
              </p>
              <div className="mt-4 text-sm font-black text-blue-600">[CLICK TO VIEW FULL DETAILS]</div>
            </div>

            {/* Exclusion Warning */}
            {excludedCount > 0 && (
              <div className="mb-8 p-4 border-4 border-red-600 bg-red-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-red-600">ACTIVE EXCLUSION FILTER</div>
                    <div className="text-sm font-bold mt-1">
                      {excludedCount} industry code{excludedCount !== 1 ? "s" : ""} will be filtered from results after enrichment
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate("/exclusions")}
                    variant="outline"
                    className="text-xs font-black border-2 border-red-600 text-red-600"
                    size="sm"
                  >
                    VIEW LIST
                  </Button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-12">
              <div className="space-y-4">
                <Label htmlFor="location" className="text-2xl font-black">
                  [01] TARGET LOCATION
                </Label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Atlanta, GA"
                  className="text-xl py-8 px-6 border-4 border-black focus:ring-4 focus:ring-black"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={startSearchMutation.isPending}
                className="text-3xl px-16 py-10 font-black border-4 border-black bg-black text-white w-full md:w-auto"
              >
                {startSearchMutation.isPending ? "[PROCESSING...]" : "[START SEARCH]"}
              </Button>
            </form>
          </div>
        ) : (
          /* Results Display */
          <div className="space-y-16">
            {/* Status Header */}
            <div className="border-8 border-black p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-5xl md:text-7xl font-black leading-none">
                  {searchData?.search.status === "completed" ? "[RESULTS]" : "[PROCESSING]"}
                </h2>
                <Button onClick={handleReset} variant="outline" className="text-xl px-8 py-6 font-black border-4 border-black">
                  NEW SEARCH
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div>
                  <div className="text-sm font-black mb-2">TARGET</div>
                  <div className="text-xl font-bold break-all">{searchData?.search.companyWebsite}</div>
                </div>
                <div>
                  <div className="text-sm font-black mb-2">LOCATION</div>
                  <div className="text-xl font-bold">{searchData?.search.location}</div>
                </div>
              </div>

              {searchData?.search.status === "extracting" && (
                <div className="mt-8 text-2xl font-black animate-pulse">→ STEP 1: EXTRACTING OFFERING DATA...</div>
              )}
              {searchData?.search.status === "code_targeting" && (
                <div className="mt-8 p-6 border-4 border-yellow-600 bg-yellow-50">
                  <div className="text-2xl font-black text-yellow-600">⏸ STEP 2: CODE TARGETING COMPLETE</div>
                  <div className="mt-2 text-sm text-gray-600">Review the selected NAICS sectors below. Click any sector to exclude it, then click "CONFIRM & START BATCHED SEARCH" to proceed.</div>
                </div>
              )}
              {searchData?.search.status === "searching" && (
                <div className="mt-8 p-6 border-4 border-blue-600 bg-blue-50">
                  <div className="text-2xl font-black text-blue-600 animate-pulse">→ STEP 3: BATCHED KEYWORD SEARCH IN PROGRESS...</div>
                  {searchData.search.codesTotal && searchData.search.codesSearched !== null && (
                    <div className="mt-4">
                      <div className="text-lg font-bold text-gray-700">
                        Searching keyword {searchData.search.codesSearched + 1} of {searchData.search.codesTotal}
                      </div>
                      <div className="mt-2 w-full bg-gray-200 h-4">
                        <div
                          className="bg-blue-600 h-4 transition-all duration-300"
                          style={{ width: `${((searchData.search.codesSearched / searchData.search.codesTotal) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {Math.round((searchData.search.codesSearched / searchData.search.codesTotal) * 100)}% complete
                      </div>
                    </div>
                  )}
                </div>
              )}
              {searchData?.search.status === "failed" && (
                <div className="mt-8 text-2xl font-black text-destructive">✕ ERROR: {searchData.search.errorMessage}</div>
              )}
            </div>

            {/* Offering Details */}
            {searchData?.search.offeringName && (
              <div className="border-l-8 border-black pl-8 space-y-6">
                <div>
                  <div className="text-sm font-black mb-2">OFFERING</div>
                  <div className="text-3xl font-black">{searchData.search.offeringName}</div>
                </div>
                {searchData.search.offeringDescription && (
                  <div>
                    <div className="text-sm font-black mb-2">DESCRIPTION</div>
                    <div className="text-lg font-bold">{searchData.search.offeringDescription}</div>
                  </div>
                )}
                {searchData.search.targetMarket && (
                  <div>
                    <div className="text-sm font-black mb-2">TARGET MARKET</div>
                    <div className="text-lg font-bold">{searchData.search.targetMarket}</div>
                  </div>
                )}
                {searchData.search.keywords && (
                  <div>
                    <div className="text-sm font-black mb-2">OFFERING KEYWORDS</div>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(searchData.search.keywords).map((keyword: string, i: number) => (
                        <span key={i} className="border-2 border-black px-4 py-2 text-sm font-black">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {searchData.search.keywordTagsUsed && (
                  <div>
                    <div className="text-sm font-black mb-2">APOLLO SEARCH TAGS (TARGET MARKET)</div>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(searchData.search.keywordTagsUsed).map((tag: string, i: number) => (
                        <span key={i} className="border-2 border-black bg-black text-white px-4 py-2 text-sm font-black">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {searchData.search.selectedSicCodes && searchData.search.selectedNaicsCodes && (
                  <SelectedCodesDisplay
                    sicCodes={JSON.parse(searchData.search.selectedSicCodes)}
                    naicsCodes={JSON.parse(searchData.search.selectedNaicsCodes)}
                    reasoning={searchData.search.codeSelectionReasoning}
                    searchId={searchId!}
                    excludedSectors={excludedSectors}
                    onExcludedSectorsChange={setExcludedSectors}
                    searchStatus={searchData.search.status}
                    onConfirmSearch={handleConfirmSearch}
                  />
                )}
              </div>
            )}

            {/* Companies List */}
            {searchData?.search.status === "completed" && searchData.companies.length > 0 && (
              <div>
                {/* Action Bar */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                  <div>
                    <h3 className="text-4xl md:text-6xl font-black">
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
                  <div className="flex items-center gap-4">
                    {hasPendingCompanies && (
                      <Button
                        onClick={handleEnrichAll}
                        disabled={enrichAllMutation.isPending}
                        className="text-xl px-8 py-6 font-black border-4 border-black bg-black text-white"
                      >
                        {enrichAllMutation.isPending
                          ? "[ENRICHING...]"
                          : `[ENRICH ALL — ${enrichmentStats?.pending}]`}
                      </Button>
                    )}
                    <Button
                      onClick={handleExportCsv}
                      variant="outline"
                      className="text-xl px-8 py-6 font-black border-4 border-black"
                    >
                      EXPORT CSV
                    </Button>
                  </div>
                </div>

                {/* Enrichment Progress */}
                {enrichAllMutation.isPending && (
                  <div className="border-4 border-black p-6 mb-8 animate-pulse">
                    <div className="text-2xl font-black">→ ENRICHING COMPANY DETAILS...</div>
                    <div className="text-lg font-bold mt-2">
                      Fetching addresses, SIC/NAICS codes for {enrichmentStats?.pending} companies. This may take a moment.
                    </div>
                  </div>
                )}

                {/* Excluded Companies (collapsible) */}
                {showExcluded && excludedCompanies.length > 0 && (
                  <div className="mb-8 border-4 border-red-600 bg-red-50 p-6">
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
                    className={`text-lg px-6 py-4 font-black border-4 border-black ${
                      !showCallTodayOnly ? 'bg-black text-white' : ''
                    }`}
                  >
                    ALL COMPANIES ({filteredCompanies.length})
                  </Button>
                  <Button
                    onClick={() => setShowCallTodayOnly(true)}
                    variant="outline"
                    className={`text-lg px-6 py-4 font-black border-4 border-black ${
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
              </div>
            )}

            {searchData?.search.status === "completed" && searchData.companies.length === 0 && (
              <div className="border-4 border-black p-12 text-center">
                <div className="text-4xl font-black mb-4">NO MATCHES FOUND</div>
                <div className="text-xl font-bold text-muted-foreground">Try a different location or company</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Extracted company card component
function CompanyCard({
  company,
  index,
  searchId,
}: {
  company: any;
  index: number;
  searchId: number;
}) {
  const hasSicCodes = !!(company.sicCodes && JSON.parse(company.sicCodes).length > 0);
  const hasNaicsCodes = !!(company.naicsCodes && JSON.parse(company.naicsCodes).length > 0);

  return (
    <div id={`company-${company.id}`} className="border-4 border-black p-6 bg-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-black">[{String(index + 1).padStart(2, "0")}]</span>
            {/* Enrichment Status Badge */}
            {company.enrichmentStatus === "enriched" ? (
              <span className="text-xs font-black border-2 border-black px-2 py-0.5 bg-black text-white">
                ENRICHED
              </span>
            ) : company.enrichmentStatus === "failed" ? (
              <span className="text-xs font-black border-2 border-red-600 text-red-600 px-2 py-0.5">
                ENRICH FAILED
              </span>
            ) : (
              <span className="text-xs font-black border-2 border-current px-2 py-0.5 opacity-50">
                PENDING
              </span>
            )}
          </div>
          <h4 className="text-2xl md:text-3xl font-black mb-2">{company.name}</h4>
          {company.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-bold underline break-all"
            >
              {company.websiteUrl}
            </a>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 text-sm">
        {/* Location Information (only after enrichment) */}
        {company.enrichmentStatus === "enriched" && (company.city || company.state || company.country) && (
          <div className="md:col-span-3 border-t-2 border-current pt-4 mt-2">
            <div className="font-black mb-1">LOCATION</div>
            <div className="font-bold">
              {[company.city, company.state, company.country].filter(Boolean).join(", ")}
            </div>
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
            <a
              href={company.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline break-all"
            >
              {company.linkedinUrl}
            </a>
          </div>
        )}
        <CompanyCodeDisplay sicCodes={company.sicCodes} naicsCodes={company.naicsCodes} />
      </div>

      {/* HITL Decision Buttons */}
      <div className="mt-4 pt-4 border-t-2 border-current">
        <CompanyDecisionButtons
          companyId={company.id}
          searchId={searchId}
          companyName={company.name}
          hasSicCodes={hasSicCodes}
          hasNaicsCodes={hasNaicsCodes}
        />
      </div>

      {/* Enrich Button (for pending companies) */}
      {company.enrichmentStatus === "pending" && (
        <div className="mt-3">
          <EnrichButton companyId={company.id} companyName={company.name} />
        </div>
      )}

      {/* Deep Research Button (only for enriched companies) */}
      {company.enrichmentStatus === "enriched" && (
        <div className="mt-3 flex flex-col gap-2">
          <DeepResearchButton companyId={company.id} companyName={company.name} />
          {/* Create Sales Approach Button (only shows after Deep Research is complete) */}
          {company.briefData && (
            <CreateSalesApproachButton companyId={company.id} companyName={company.name} />
          )}
          {/* Find Contact Button */}
          <FindContactButton companyId={company.id} companyName={company.name} />
        </div>
      )}
    </div>
  );
}



// Component for Deep Research using Grok (4-phase intelligence gathering)
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
      // Invalidate search query to refresh company data and show Sales Approach button immediately
      utils.companyFinder.getSearch.invalidate();
    },
    onError: (error) => {
      toast.error(`Research failed: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateBriefMutation.mutate({ companyId });
  };

  return (
    <>
      <Button
        onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
        disabled={isGenerating}
        variant="outline"
        className="font-black border-2 border-blue-600 text-blue-600 bg-blue-50 w-full cursor-pointer"
      >
        {isGenerating ? "[RESEARCHING...]" : <>[DEEP RESEARCH]<span className="ml-2 text-xs font-bold opacity-60">~30s • 2 Grok calls</span></>}
      </Button>

      {/* Brief Display Modal */}
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
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-bold">Company Context</div>
                  <div>{briefData.urgencyBreakdown.companyContext}/40</div>
                </div>
                <div>
                  <div className="font-bold">Market Signals</div>
                  <div>{briefData.urgencyBreakdown.marketSignals}/35</div>
                </div>
                <div>
                  <div className="font-bold">Recent Activity</div>
                  <div>{briefData.urgencyBreakdown.recentActivity}/25</div>
                </div>
              </div>
            </div>

            {/* Recent Developments */}
            {briefData.recentDevelopments && briefData.recentDevelopments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Recent Developments (2024-2025)</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {briefData.recentDevelopments.map((dev: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex-1">
                        {typeof dev === 'string' ? dev : dev.text}
                      </span>
                      {typeof dev === 'object' && dev.source && (
                        <a
                          href={dev.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap"
                          title={dev.source}
                        >
                          [Source]
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Conversation Starters */}
            {briefData.conversationStarters && briefData.conversationStarters.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Conversation Starters</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {briefData.conversationStarters.map((starter: string, i: number) => (
                    <li key={i} className="text-blue-600">{starter}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Products & Services */}
            {briefData.productsServices && briefData.productsServices.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Products & Services</h3>
                {briefData.productsServices.map((ps: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="font-bold">{ps.category}</div>
                    <div className="text-sm">{ps.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Key Technologies */}
            {briefData.keyTechnologies && briefData.keyTechnologies.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-black mb-2">Key Technologies</h3>
                {briefData.keyTechnologies.map((tech: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="font-bold">{tech.name}</div>
                    <div className="text-sm">{tech.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Target Markets */}
            {briefData.targetMarkets && briefData.targetMarkets.length > 0 && (
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
                
                {briefData.engagementStrategy.whyThisProspectMatters && briefData.engagementStrategy.whyThisProspectMatters.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-1">Why This Prospect Matters:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {briefData.engagementStrategy.whyThisProspectMatters.map((reason: string, i: number) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {briefData.engagementStrategy.recommendedApproach && briefData.engagementStrategy.recommendedApproach.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-1">Recommended Approach:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {briefData.engagementStrategy.recommendedApproach.map((step: string, i: number) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {briefData.engagementStrategy.keyTalkingPoints && briefData.engagementStrategy.keyTalkingPoints.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold mb-1">Key Talking Points:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {briefData.engagementStrategy.keyTalkingPoints.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={() => setShowBrief(false)}
              className="w-full font-black"
            >
              CLOSE
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// Component for enriching a single company
function EnrichButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const utils = trpc.useUtils();
  const enrichMutation = trpc.companyFinder.enrichSingle.useMutation({
    onSuccess: () => {
      toast.success(`${companyName} enriched successfully`);
      // Invalidate the search query to refresh company data
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
      className="w-full text-lg px-4 py-3 font-black border-2 border-black bg-gray-100 text-black cursor-pointer"
    >
      {enrichMutation.isPending ? "[ENRICHING...]" : <>[ENRICH]<span className="ml-2 text-xs font-bold opacity-60">~5s • 1 Apollo credit</span></>}
    </Button>
  );
}


// Component for Create Sales Approach (personalized outreach generation)
function CreateSalesApproachButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [salesApproach, setSalesApproach] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApproach, setShowApproach] = useState(false);

  const generateApproachMutation = trpc.companyFinder.generateSalesApproach.useMutation({
    onSuccess: (data) => {
      setSalesApproach(data.salesApproach);
      setIsGenerating(false);
      setShowApproach(true);
      toast.success("Sales approach generated!");
    },
    onError: (error) => {
      toast.error(`Failed to generate sales approach: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateApproachMutation.mutate({ companyId });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <>
      <Button
        onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
        disabled={isGenerating}
        variant="outline"
        className="font-black border-2 border-green-600 text-green-600 bg-green-50 w-full cursor-pointer"
      >
        {isGenerating ? "[CREATING APPROACH...]" : <>[CREATE SALES APPROACH]<span className="ml-2 text-xs font-bold opacity-60">~45s • 1 Grok call</span></>}
      </Button>

      {/* Sales Approach Display Modal */}
      {showApproach && salesApproach && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApproach(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-black">{companyName} - Sales Approach</h2>
              <button onClick={() => setShowApproach(false)} className="text-2xl font-black">×</button>
            </div>

            {/* Email Draft */}
            <div className="mb-6 p-4 border-2 border-green-600 rounded">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-green-600">Email Draft</h3>
                <Button
                  onClick={() => copyToClipboard(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                  variant="outline"
                  size="sm"
                  className="font-black"
                >
                  COPY
                </Button>
              </div>
              <div className="mb-2">
                <span className="font-bold">Subject:</span> {salesApproach.emailDraft.subject}
              </div>
              <div className="whitespace-pre-wrap text-sm">{salesApproach.emailDraft.body}</div>
            </div>

            {/* LinkedIn Message */}
            <div className="mb-6 p-4 border-2 border-blue-600 rounded">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-blue-600">LinkedIn Message</h3>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Connection Request:</span>
                  <Button
                    onClick={() => copyToClipboard(salesApproach.linkedinMessage.connectionRequest, "Connection Request")}
                    variant="outline"
                    size="sm"
                    className="font-black"
                  >
                    COPY
                  </Button>
                </div>
                <div className="text-sm bg-blue-50 p-2 rounded">{salesApproach.linkedinMessage.connectionRequest}</div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">Follow-up:</span>
                  <Button
                    onClick={() => copyToClipboard(salesApproach.linkedinMessage.followUp, "Follow-up Message")}
                    variant="outline"
                    size="sm"
                    className="font-black"
                  >
                    COPY
                  </Button>
                </div>
                <div className="text-sm bg-blue-50 p-2 rounded">{salesApproach.linkedinMessage.followUp}</div>
              </div>
            </div>

            {/* Call Script */}
            <div className="mb-6 p-4 border-2 border-purple-600 rounded">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black text-purple-600">Call Script</h3>
                <Button
                  onClick={() => copyToClipboard(
                    `OPENING:\n${salesApproach.callScript.opening}\n\nDISCOVERY QUESTIONS:\n${salesApproach.callScript.discoveryQuestions.join("\n")}\n\nVALUE PROPOSITION:\n${salesApproach.callScript.valueProposition}\n\nCALL TO ACTION:\n${salesApproach.callScript.callToAction}`,
                    "Call Script"
                  )}
                  variant="outline"
                  size="sm"
                  className="font-black"
                >
                  COPY
                </Button>
              </div>

              <div className="mb-3">
                <span className="font-bold">Opening:</span>
                <div className="text-sm mt-1">{salesApproach.callScript.opening}</div>
              </div>

              <div className="mb-3">
                <span className="font-bold">Discovery Questions:</span>
                <ul className="list-disc pl-5 text-sm mt-1">
                  {salesApproach.callScript.discoveryQuestions.map((q: string, i: number) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>

              <div className="mb-3">
                <span className="font-bold">Value Proposition:</span>
                <div className="text-sm mt-1">{salesApproach.callScript.valueProposition}</div>
              </div>

              <div>
                <span className="font-bold">Call to Action:</span>
                <div className="text-sm mt-1">{salesApproach.callScript.callToAction}</div>
              </div>
            </div>

            <Button
              onClick={() => setShowApproach(false)}
              className="w-full font-black"
            >
              CLOSE
            </Button>
          </div>
        </div>
      )}
    </>
  );
}


// Component for finding a contact at a company (Apollo People Search)
function FindContactButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [jobTitle, setJobTitle] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [contactData, setContactData] = useState<any>(null);
  const [showContact, setShowContact] = useState(false);

  // Check if we already have a cached contact
  const { data: existingContact } = trpc.companyFinder.getContact.useQuery(
    { companyId },
    { enabled: true }
  );

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
    if (!jobTitle.trim()) {
      toast.error("Please enter a job title");
      return;
    }
    findContactMutation.mutate({ companyId, jobTitle: jobTitle.trim() });
  };

  // If we have a cached contact, show "View Contact" button
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
          <span className="ml-2 text-xs font-bold opacity-60">~10s • 1 Apollo credit</span>
        </Button>
      ) : (
        <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Job title (e.g. VP Operations)"
            className="flex-1 px-3 py-2 border-2 border-orange-600 font-bold text-sm bg-white text-black"
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={findContactMutation.isPending}
            className="font-black border-2 border-orange-600 bg-orange-600 text-white px-4 cursor-pointer"
          >
            {findContactMutation.isPending ? "..." : "GO"}
          </Button>
          <Button
            onClick={() => setShowInput(false)}
            variant="outline"
            className="font-black border-2 border-black px-3 cursor-pointer"
          >
            ×
          </Button>
        </div>
      )}

      {showContact && contactData && (
        <ContactModal contact={contactData} companyName={companyName} onClose={() => setShowContact(false)} />
      )}
    </>
  );
}

// Modal for displaying contact details
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
            <div>
              <div className="text-xs font-black text-orange-600 mb-1">TITLE</div>
              <div className="font-bold text-black">{contact.title}</div>
            </div>
          )}

          {contact.email && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-orange-600 mb-1">EMAIL</div>
                <div className="font-bold text-black">{contact.email}</div>
              </div>
              <Button
                onClick={() => copyToClipboard(contact.email, "Email")}
                variant="outline"
                size="sm"
                className="font-black border-2 border-black text-black cursor-pointer"
              >
                COPY
              </Button>
            </div>
          )}

          {contact.phone && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-orange-600 mb-1">PHONE</div>
                <div className="font-bold text-black">{contact.phone}</div>
              </div>
              <Button
                onClick={() => copyToClipboard(contact.phone, "Phone")}
                variant="outline"
                size="sm"
                className="font-black border-2 border-black text-black cursor-pointer"
              >
                COPY
              </Button>
            </div>
          )}

          {contact.linkedinUrl && (
            <div>
              <div className="text-xs font-black text-orange-600 mb-1">LINKEDIN</div>
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-black break-all"
              >
                {contact.linkedinUrl}
              </a>
            </div>
          )}

          {contact.searchedTitle && (
            <div>
              <div className="text-xs font-black text-orange-600 mb-1">SEARCHED FOR</div>
              <div className="font-bold text-black opacity-60">{contact.searchedTitle}</div>
            </div>
          )}
        </div>

        <Button
          onClick={onClose}
          className="w-full mt-6 font-black bg-black text-white cursor-pointer"
        >
          CLOSE
        </Button>
      </div>
    </div>
  );
}
