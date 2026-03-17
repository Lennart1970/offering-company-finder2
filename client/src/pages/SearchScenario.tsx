import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import SelectedCodesDisplay from "@/components/SelectedCodesDisplay";

export default function SearchScenario() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const urlSearchId = params.get("searchId");

  const [searchId, setSearchId] = useState<number | null>(urlSearchId ? parseInt(urlSearchId, 10) : null);
  const [isEditingCodes, setIsEditingCodes] = useState(false);
  const [editedSicCodes, setEditedSicCodes] = useState("");
  const [editedNaicsCodes, setEditedNaicsCodes] = useState("");
  const [excludedSectors, setExcludedSectors] = useState<string[]>([]);

  // Fetch search data
  const { data: searchData, isLoading: searchLoading } = trpc.companyFinder.getSearch.useQuery(
    { searchId: searchId! },
    {
      enabled: !!searchId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        // Stop polling once search is completed, failed, or still in code_targeting/searching
        return data.search.status === "completed" || data.search.status === "failed" ? false : 2000;
      },
    }
  );

  // Fetch search history for the selector
  const { data: searchHistory } = trpc.companyFinder.getSearchHistory.useQuery({ showArchived: false });

  const utils = trpc.useUtils();

  // Load excluded sectors from search data
  useEffect(() => {
    if (searchData?.search.excludedSectors) {
      try {
        setExcludedSectors(JSON.parse(searchData.search.excludedSectors));
      } catch {}
    }
  }, [searchData?.search.excludedSectors]);

  // Run code targeting
  const runCodeTargetingMutation = trpc.companyFinder.runCodeTargeting.useMutation({
    onSuccess: () => {
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
      toast.success("Code targeting complete! Review the codes below.");
    },
    onError: (error) => {
      toast.error(`Code targeting failed: ${error.message}`);
    },
  });

  // Accept code targeting
  const acceptCodeTargetingMutation = trpc.companyFinder.acceptCodeTargeting.useMutation({
    onSuccess: () => {
      toast.success("Codes accepted! Starting search...");
      if (searchId) {
        confirmAndSearchMutation.mutate({ searchId });
      }
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // Update code targeting manually
  const updateCodeTargetingMutation = trpc.companyFinder.updateCodeTargeting.useMutation({
    onSuccess: () => {
      setIsEditingCodes(false);
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
      toast.success("Codes updated!");
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  // Confirm and start batched search
  const confirmAndSearchMutation = trpc.companyFinder.confirmAndSearch.useMutation({
    onSuccess: () => {
      toast.success("Batched keyword search started!");
      if (searchId) utils.companyFinder.getSearch.invalidate({ searchId });
    },
    onError: (error) => {
      toast.error(`Failed to start search: ${error.message}`);
    },
  });

  const handleRunCodeTargeting = () => {
    if (!searchId) return;
    runCodeTargetingMutation.mutate({ searchId });
  };

  const handleAcceptCodes = () => {
    if (!searchId) return;
    acceptCodeTargetingMutation.mutate({ searchId });
  };

  const handleReRunCodes = () => {
    if (!searchId) return;
    runCodeTargetingMutation.mutate({ searchId });
  };

  const handleSaveCodeEdit = () => {
    if (!searchId) return;
    updateCodeTargetingMutation.mutate({
      searchId,
      codes: {
        sicCodes: editedSicCodes.split(",").map(c => c.trim()).filter(Boolean),
        naicsCodes: editedNaicsCodes.split(",").map(c => c.trim()).filter(Boolean),
      },
    });
  };

  const handleConfirmSearch = () => {
    if (!searchId) return;
    confirmAndSearchMutation.mutate({ searchId });
  };

  const handleSelectSearch = (id: number) => {
    setSearchId(id);
    navigate(`/search-scenario?searchId=${id}`, { replace: true });
  };

  // Determine current state
  const status = searchData?.search.status;
  const hasCodes = searchData?.search.selectedSicCodes && searchData?.search.selectedNaicsCodes;
  const needsCodeTargeting = status === "extracting" || (status === "pending" && searchData?.search.offeringName);
  const isSearching = status === "searching";
  const isCompleted = status === "completed";

  return (
    <div className="max-w-5xl">
      {/* Page Header */}
      <div className="mb-12">
        <div className="text-xs font-black text-muted-foreground mb-2">[02] COCKPIT</div>
        <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
          SEARCH<br />SCENARIO
        </h1>
        <p className="text-lg font-bold text-muted-foreground max-w-2xl">
          Select a focused offering, configure industry code targeting, set location, and launch the Apollo search.
        </p>
      </div>

      {/* Search Selector */}
      {!searchId ? (
        <div>
          <h2 className="text-2xl font-black mb-6">SELECT A SEARCH TO CONFIGURE</h2>
          {searchHistory && searchHistory.length > 0 ? (
            <div className="space-y-3">
              {searchHistory.map((search: any) => (
                <div
                  key={search.id}
                  onClick={() => handleSelectSearch(search.id)}
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
                      search.status === "failed" ? "border-red-600 text-red-600" :
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
              <div className="text-2xl font-black mb-4">NO SEARCHES YET</div>
              <div className="text-lg font-bold text-muted-foreground mb-6">
                Start by creating a Focused Offering first.
              </div>
              <Button
                onClick={() => navigate("/")}
                className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white"
              >
                [GO TO FOCUSED OFFERING →]
              </Button>
            </div>
          )}
        </div>
      ) : searchLoading ? (
        <div className="border-4 border-black p-12 animate-pulse">
          <div className="text-2xl font-black">→ LOADING SEARCH DATA...</div>
        </div>
      ) : searchData ? (
        <div className="space-y-8">
          {/* Search Info Bar */}
          <div className="flex items-center justify-between border-b-4 border-black pb-4">
            <div>
              <div className="text-sm font-black text-muted-foreground">RUN #{searchData.search.id} — {new Date(searchData.search.createdAt).toLocaleDateString()}</div>
              <div className="text-2xl font-black mt-1">{searchData.search.offeringName || "Untitled"}</div>
              <div className="text-sm font-bold text-muted-foreground mt-1">Location: {searchData.search.location}</div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setSearchId(null)}
                variant="outline"
                className="text-sm font-black border-2 border-black"
              >
                ← CHANGE SEARCH
              </Button>
              {isCompleted && (
                <Button
                  onClick={() => navigate(`/search-results/${searchData.search.id}`)}
                  className="text-sm font-black border-2 border-black bg-black text-white"
                >
                  VIEW RESULTS →
                </Button>
              )}
            </div>
          </div>

          {/* Offering Summary */}
          <div className="border-l-8 border-black pl-8 space-y-4">
            <div>
              <div className="text-sm font-black mb-1">OFFERING</div>
              <div className="text-xl font-black">{searchData.search.offeringName}</div>
            </div>
            {searchData.search.offeringDescription && (
              <div>
                <div className="text-sm font-black mb-1">DESCRIPTION</div>
                <div className="text-sm font-bold">{searchData.search.offeringDescription}</div>
              </div>
            )}
            {searchData.search.targetMarket && (
              <div>
                <div className="text-sm font-black mb-1">TARGET MARKET</div>
                <div className="text-sm font-bold">{searchData.search.targetMarket}</div>
              </div>
            )}
            {searchData.search.keywords && (
              <div>
                <div className="text-sm font-black mb-1">OFFERING KEYWORDS</div>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(searchData.search.keywords).map((keyword: string, i: number) => (
                    <span key={i} className="border-2 border-black px-3 py-1 text-xs font-black">{keyword}</span>
                  ))}
                </div>
              </div>
            )}
            {searchData.search.keywordTagsUsed && (
              <div>
                <div className="text-sm font-black mb-1">APOLLO SEARCH TAGS</div>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(searchData.search.keywordTagsUsed).map((tag: string, i: number) => (
                    <span key={i} className="border-2 border-black bg-black text-white px-3 py-1 text-xs font-black">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Code Targeting Section */}
          {!hasCodes && !isSearching && !isCompleted ? (
            /* No codes yet - offer to run code targeting */
            <div className="border-4 border-yellow-600 bg-yellow-50 p-8">
              <div className="text-xl font-black text-yellow-600 mb-4">CODE TARGETING NEEDED</div>
              <p className="text-sm font-bold mb-6">
                Run AI-powered industry code selection to identify the best SIC/NAICS codes for this offering.
              </p>
              <Button
                onClick={handleRunCodeTargeting}
                disabled={runCodeTargetingMutation.isPending}
                className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white"
              >
                {runCodeTargetingMutation.isPending ? "[TARGETING CODES...]" : "[RUN CODE TARGETING]"}
              </Button>
            </div>
          ) : hasCodes && !isEditingCodes ? (
            /* Codes exist - show them with SelectedCodesDisplay */
            <div>
              <SelectedCodesDisplay
                sicCodes={JSON.parse(searchData.search.selectedSicCodes!)}
                naicsCodes={JSON.parse(searchData.search.selectedNaicsCodes!)}
                reasoning={searchData.search.codeSelectionReasoning}
                searchId={searchId}
                excludedSectors={excludedSectors}
                onExcludedSectorsChange={setExcludedSectors}
                searchStatus={searchData.search.status}
                onConfirmSearch={handleConfirmSearch}
              />

              {/* Action buttons for code review */}
              {status === "searching" && !searchData.search.codesSearched && (
                <div className="flex flex-col md:flex-row gap-4 mt-6">
                  <Button
                    onClick={handleAcceptCodes}
                    disabled={acceptCodeTargetingMutation.isPending || confirmAndSearchMutation.isPending}
                    className="text-xl px-10 py-8 font-black border-4 border-black bg-green-600 text-white flex-1"
                  >
                    {acceptCodeTargetingMutation.isPending || confirmAndSearchMutation.isPending
                      ? "[STARTING SEARCH...]"
                      : "[ACCEPT → START SEARCH]"}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditingCodes(true);
                      try {
                        const sic = JSON.parse(searchData.search.selectedSicCodes || "[]");
                        const naics = JSON.parse(searchData.search.selectedNaicsCodes || "[]");
                        setEditedSicCodes(sic.map((c: any) => typeof c === 'string' ? c : c.code).join(", "));
                        setEditedNaicsCodes(naics.map((c: any) => typeof c === 'string' ? c : c.code).join(", "));
                      } catch {}
                    }}
                    variant="outline"
                    className="text-lg px-8 py-6 font-black border-4 border-black"
                  >
                    [EDIT CODES]
                  </Button>
                  <Button
                    onClick={handleReRunCodes}
                    disabled={runCodeTargetingMutation.isPending}
                    variant="outline"
                    className="text-lg px-8 py-6 font-black border-4 border-blue-600 text-blue-600"
                  >
                    {runCodeTargetingMutation.isPending ? "[RE-RUNNING...]" : "[RE-RUN TARGETING]"}
                  </Button>
                </div>
              )}
            </div>
          ) : isEditingCodes ? (
            /* Edit Mode for Codes */
            <div className="border-4 border-blue-600 p-8">
              <div className="text-sm font-black text-blue-600 mb-4">EDITING CODES</div>
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-black">SIC CODES (comma-separated, e.g. 3672, 3679)</Label>
                  <Input
                    value={editedSicCodes}
                    onChange={(e) => setEditedSicCodes(e.target.value)}
                    className="text-lg py-4 px-4 border-2 border-black mt-2"
                  />
                </div>
                <div>
                  <Label className="text-sm font-black">NAICS CODES (comma-separated, e.g. 334412, 334418)</Label>
                  <Input
                    value={editedNaicsCodes}
                    onChange={(e) => setEditedNaicsCodes(e.target.value)}
                    className="text-lg py-4 px-4 border-2 border-black mt-2"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <Button
                  onClick={handleSaveCodeEdit}
                  disabled={updateCodeTargetingMutation.isPending}
                  className="text-xl px-10 py-8 font-black border-4 border-black bg-blue-600 text-white flex-1"
                >
                  {updateCodeTargetingMutation.isPending ? "[SAVING...]" : "[SAVE CHANGES]"}
                </Button>
                <Button
                  onClick={() => setIsEditingCodes(false)}
                  variant="outline"
                  className="text-lg px-8 py-6 font-black border-4 border-black"
                >
                  [CANCEL]
                </Button>
              </div>
            </div>
          ) : null}

          {/* Search Progress */}
          {isSearching && searchData.search.codesTotal && searchData.search.codesSearched !== null && (
            <div className="border-4 border-blue-600 bg-blue-50 p-6">
              <div className="text-xl font-black text-blue-600 animate-pulse mb-4">→ BATCHED KEYWORD SEARCH IN PROGRESS...</div>
              <div className="text-lg font-bold text-gray-700">
                Searching keyword {(searchData.search.codesSearched ?? 0) + 1} of {searchData.search.codesTotal}
              </div>
              <div className="mt-3 w-full bg-gray-200 h-4">
                <div
                  className="bg-blue-600 h-4 transition-all duration-300"
                  style={{ width: `${(((searchData.search.codesSearched ?? 0) / searchData.search.codesTotal) * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {Math.round(((searchData.search.codesSearched ?? 0) / searchData.search.codesTotal) * 100)}% complete
              </div>
            </div>
          )}

          {/* Completed - Link to Results */}
          {isCompleted && (
            <div className="border-4 border-green-600 bg-green-50 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-black text-green-600">SEARCH COMPLETED</div>
                  <div className="text-lg font-bold mt-2">
                    {searchData.companies.length} companies found — {searchData.enrichmentStats.enriched} enriched
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/search-results/${searchData.search.id}`)}
                  className="text-xl px-10 py-8 font-black border-4 border-black bg-black text-white"
                >
                  [VIEW RESULTS →]
                </Button>
              </div>
            </div>
          )}

          {/* Failed */}
          {status === "failed" && (
            <div className="border-4 border-red-600 bg-red-50 p-8">
              <div className="text-xl font-black text-red-600">SEARCH FAILED</div>
              <div className="text-sm font-bold mt-2">{searchData.search.errorMessage}</div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
