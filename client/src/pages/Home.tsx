import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { normalizeWebsiteUrl } from "@shared/urlUtils";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [companyWebsite, setCompanyWebsite] = useState("");
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
        return (data?.search.status === "completed" || data?.search.status === "failed" ? false : 2000);
      }
    }
  );

  const exportCsvQuery = trpc.companyFinder.exportCsv.useQuery(
    { searchId: searchId! },
    { enabled: false }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyWebsite || !location) {
      toast.error("Please fill in all fields");
      return;
    }
    
    // Normalize the URL input
    try {
      const normalizedUrl = normalizeWebsiteUrl(companyWebsite);
      startSearchMutation.mutate({ companyWebsite: normalizedUrl, location });
    } catch (error) {
      toast.error("Invalid website URL. Please check and try again.");
    }
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

  const handleReset = () => {
    setSearchId(null);
    setCompanyWebsite("");
    setLocation("");
  };

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
              onClick={() => window.location.href = getLoginUrl()}
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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b-8 border-black p-8">
        <div className="container flex justify-between items-center">
          <h1 className="text-5xl md:text-7xl font-black leading-none">[CF]</h1>
          <div className="flex items-center gap-6">
            <Button
              onClick={() => navigate("/history")}
              variant="outline"
              className="text-lg px-6 py-4 font-black border-4 border-black"
            >
              HISTORY
            </Button>
            <div className="text-right">
              <div className="text-sm font-bold mb-2">{user?.name || user?.email}</div>
              <Button
                onClick={() => window.location.href = "/"}
                variant="ghost"
                className="text-xs font-bold underline"
              >
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
                INPUT<br />TARGET
              </h2>
              <div className="border-l-8 border-black pl-8">
                <p className="text-xl md:text-2xl font-bold text-muted-foreground">
                  Enter a company website and location to find similar businesses
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12">
              <div className="space-y-4">
                <Label htmlFor="website" className="text-2xl font-black">
                  [01] COMPANY WEBSITE
                </Label>
                <Input
                  id="website"
                  type="text"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="connectgroup.com or just connectgroup"
                  className="text-xl py-8 px-6 border-4 border-black focus:ring-4 focus:ring-black"
                  required
                />
              </div>

              <div className="space-y-4">
                <Label htmlFor="location" className="text-2xl font-black">
                  [02] TARGET LOCATION
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
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="text-xl px-8 py-6 font-black border-4 border-black"
                >
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
                <div className="mt-8 text-2xl font-black animate-pulse">
                  → EXTRACTING OFFERING DATA...
                </div>
              )}
              {searchData?.search.status === "searching" && (
                <div className="mt-8 text-2xl font-black animate-pulse">
                  → SEARCHING APOLLO DATABASE...
                </div>
              )}
              {searchData?.search.status === "failed" && (
                <div className="mt-8 text-2xl font-black text-destructive">
                  ✕ ERROR: {searchData.search.errorMessage}
                </div>
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
                    <div className="text-sm font-black mb-2">KEYWORDS</div>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(searchData.search.keywords).map((keyword: string, i: number) => (
                        <span key={i} className="border-2 border-black px-4 py-2 text-sm font-black">
                          {keyword}
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
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-4xl md:text-6xl font-black">
                    [{searchData.companies.length} MATCHES]
                  </h3>
                  <Button
                    onClick={handleExportCsv}
                    variant="outline"
                    className="text-xl px-8 py-6 font-black border-4 border-black"
                  >
                    EXPORT CSV
                  </Button>
                </div>

                <div className="space-y-4">
                  {searchData.companies.map((company, index) => (
                    <div
                      key={company.id}
                      className="border-4 border-black p-6 hover:bg-black hover:text-white transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="text-sm font-black mb-2">[{String(index + 1).padStart(2, "0")}]</div>
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
                        {/* Location Information */}
                        {(company.city || company.state || company.country) && (
                          <div className="md:col-span-3 border-t-2 border-current pt-4 mt-2">
                            <div className="font-black mb-1">LOCATION</div>
                            <div className="font-bold">
                              {[company.city, company.state, company.country].filter(Boolean).join(", ")}
                            </div>
                            {company.streetAddress && (
                              <div className="font-bold text-xs mt-1">{company.streetAddress}</div>
                            )}
                          </div>
                        )}
                        {company.searchLocation && (
                          <div className="md:col-span-3">
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchData?.search.status === "completed" && searchData.companies.length === 0 && (
              <div className="border-4 border-black p-12 text-center">
                <div className="text-4xl font-black mb-4">NO MATCHES FOUND</div>
                <div className="text-xl font-bold text-muted-foreground">
                  Try a different location or company
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
