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

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [location, setLocation] = useState("");
  const [searchId, setSearchId] = useState<number | null>(null);

  // Check for searchId in URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearchId = params.get("searchId");
    if (urlSearchId) {
      setSearchId(parseInt(urlSearchId, 10));
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

  const [generatingPackages, setGeneratingPackages] = useState<Set<number>>(new Set());

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

  // Fetch excluded codes for filtering
  const { data: excludedCodes } = trpc.companyFinder.getExcludedCodes.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

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

  // Filter companies: hide those with excluded SIC/NAICS codes
  const [showExcluded, setShowExcluded] = useState(false);

  const { filteredCompanies, excludedCompanies } = useMemo(() => {
    if (!searchData?.companies) return { filteredCompanies: [], excludedCompanies: [] };

    const filtered: typeof searchData.companies = [];
    const excluded: typeof searchData.companies = [];

    for (const company of searchData.companies) {
      let isExcluded = false;

      if (company.enrichmentStatus === "enriched") {
        // Check SIC codes
        if (company.sicCodes) {
          try {
            const codes: string[] = JSON.parse(company.sicCodes);
            if (codes.some((c) => excludedSicSet.has(c))) {
              isExcluded = true;
            }
          } catch {}
        }

        // Check NAICS codes
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

    return { filteredCompanies: filtered, excludedCompanies: excluded };
  }, [searchData?.companies, excludedSicSet, excludedNaicsSet]);



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
              className="text-2xl px-12 py-8 font-black border-4 border-black hover:bg-black hover:text-white transition-colors"
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
              <div className="border-l-8 border-black pl-8">
                <p className="text-xl md:text-2xl font-bold text-muted-foreground">
                  Find potential customers for ConnectGroup's supply chain solutions
                </p>
              </div>
            </div>

            {/* ConnectGroup Offering Info */}
            <div className="mb-12 p-8 border-4 border-black bg-gray-50">
              <div className="text-sm font-black mb-2 text-muted-foreground">[OFFERING]</div>
              <h3 className="text-2xl font-black mb-4">Electronics Manufacturing Services (EMS)</h3>
              <p className="text-base font-bold mb-4">
                Full-service EMS subcontractor: PCB Assembly • Cable Assembly • Module Building • Design to Product
              </p>
              <div className="text-sm font-black mb-2 text-muted-foreground">[TARGET MARKETS]</div>
              <p className="text-base font-bold">
                Railway • Healthcare/MedTech • Infrastructure • Automotive & Off-road • Defense & Avionics • Industrial Manufacturing • Electronics • Telecommunications • Energy • Automation • Instrumentation • Aerospace • Marine • Agricultural Equipment • Construction Equipment • Mining • Oil & Gas • Renewable Energy • IoT • Embedded Systems
              </p>
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
                    className="text-xs font-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
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
                className="text-3xl px-16 py-10 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black transition-colors w-full md:w-auto"
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
              {searchData?.search.status === "searching" && (
                <div className="mt-8 text-2xl font-black animate-pulse">→ STEP 2: FAST SEARCH — FINDING COMPANIES...</div>
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
                          className="border-2 border-red-600 text-red-600 px-3 py-1 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
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
                        className="text-xl px-8 py-6 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black transition-colors"
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

                {/* Company Cards */}
                <div className="space-y-4">
                  {filteredCompanies.map((company, index) => (
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
    <div className="border-4 border-black p-6 hover:bg-black hover:text-white transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-black">[{String(index + 1).padStart(2, "0")}]</span>
            {/* Enrichment Status Badge */}
            {company.enrichmentStatus === "enriched" ? (
              <span className="text-xs font-black border-2 border-current px-2 py-0.5 bg-black text-white group-hover:bg-white group-hover:text-black">
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

      {/* Generate Package Button (only for enriched companies) */}
      {company.enrichmentStatus === "enriched" && (
        <div className="mt-3">
          <GeneratePackageButton companyId={company.id} companyName={company.name} />
        </div>
      )}
    </div>
  );
}

// Component for generating sales intelligence package
function GeneratePackageButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [packageData, setPackageData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: existingPackage } = trpc.companyFinder.getPackage.useQuery(
    { companyId },
    {
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.status === "generating" ? 2000 : false;
      },
    }
  );

  const generateMutation = trpc.companyFinder.generatePackage.useMutation({
    onSuccess: () => {
      setIsGenerating(true);
      toast.success("Generating sales package...");
    },
    onError: (error) => {
      toast.error(error.message);
      setIsGenerating(false);
    },
  });

  useEffect(() => {
    if (existingPackage) {
      if (existingPackage.status === "completed") {
        setPackageData(existingPackage);
        setIsGenerating(false);
      } else if (existingPackage.status === "generating") {
        setIsGenerating(true);
      } else if (existingPackage.status === "failed") {
        setIsGenerating(false);
        toast.error("Package generation failed");
      }
    }
  }, [existingPackage]);

  const handleGenerate = () => {
    generateMutation.mutate({ companyId });
  };

  const handleDownload = () => {
    if (!packageData?.markdownContent) return;

    const blob = new Blob([packageData.markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SALES_INTELLIGENCE_BRIEF_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Package downloaded");
  };

  if (packageData) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black border-2 border-green-600 text-green-600 px-2 py-0.5">PACKAGE READY</span>
          <Button
            onClick={handleDownload}
            variant="outline"
            className="font-black border-2 border-black hover:bg-black hover:text-white"
            size="sm"
          >
            DOWNLOAD .MD
          </Button>
        </div>
        <div className="text-xs font-bold text-muted-foreground">
          Sales Intelligence Brief • {new Date(packageData.createdAt).toLocaleDateString()}
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGenerating}
      variant="outline"
      className="font-black border-2 border-black hover:bg-black hover:text-white w-full"
    >
      {isGenerating ? "[GENERATING PACKAGE...]" : "[GENERATE SALES PACKAGE]"}
    </Button>
  );
}
