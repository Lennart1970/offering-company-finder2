import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ShareGate } from "@/components/ShareGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FilterShared = "all" | "shared" | "not-shared";
type FilterActive = "all" | "active" | "inactive";
type FilterVisible = "all" | "visible" | "hidden";

export default function BrainOverviewPage() {
  const { data, isLoading, error } = trpc.shareExt.listSharedBrains.useQuery();
  const [filterShared, setFilterShared] = useState<FilterShared>("all");
  const [filterActive, setFilterActive] = useState<FilterActive>("all");
  const [filterVisible, setFilterVisible] = useState<FilterVisible>("all");

  const brains = data?.brains ?? [];

  const filtered = useMemo(() => {
    return brains.filter((b) => {
      if (filterShared === "shared" && !b.token) return false;
      if (filterShared === "not-shared" && b.token) return false;
      if (filterActive === "active" && !b.isActive) return false;
      if (filterActive === "inactive" && b.isActive) return false;
      if (filterVisible === "visible" && !b.showOnLeadtrigger) return false;
      if (filterVisible === "hidden" && b.showOnLeadtrigger) return false;
      return true;
    });
  }, [brains, filterShared, filterActive, filterVisible]);

  const handleDownloadExcel = () => {
    // Build CSV content
    const headers = ["Business Unit Name", "Share Link"];
    const rows = filtered.map((b) => [
      b.brainName || "",
      b.token ? `${window.location.origin}/share/brain/${b.token}` : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brain-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-black animate-pulse">Loading Brains...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">&#9888;&#65039;</div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const activeCount = brains.filter((b) => b.isActive).length;
  const sharedCount = brains.filter((b) => b.token).length;
  const visibleCount = brains.filter((b) => b.showOnLeadtrigger).length;

  return (
    <ShareGate tokenType="business unit" tokenValue="overview">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">LT</span>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">LeadTrigger - Connect Group</p>
                <p className="text-xs font-bold text-gray-700">Business Units -- Overview</p>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-400 border border-gray-200 px-3 py-1 rounded-full">
              Read-only - Confidential
            </span>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Title + Download */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">Business Units</h1>
              <p className="text-sm text-gray-500">
                {brains.length} brains total &middot; {activeCount} active &middot; {sharedCount} shared &middot; {visibleCount} visible
              </p>
            </div>
            <Button
              onClick={handleDownloadExcel}
              variant="outline"
              className="text-xs font-bold gap-2 border-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              DOWNLOAD EXCEL
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-6 mb-6 pb-4 border-b border-gray-200">
            {/* Shared filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Shared:</span>
              <div className="flex gap-1">
                {(["all", "shared", "not-shared"] as FilterShared[]).map((val) => (
                  <button
                    key={val}
                    onClick={() => setFilterShared(val)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                      filterShared === val
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {val === "all" ? "All" : val === "shared" ? "Shared" : "Not Shared"}
                  </button>
                ))}
              </div>
            </div>

            {/* Visible filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visible:</span>
              <div className="flex gap-1">
                {(["all", "visible", "hidden"] as FilterVisible[]).map((val) => (
                  <button
                    key={val}
                    onClick={() => setFilterVisible(val)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                      filterVisible === val
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {val === "all" ? "All" : val === "visible" ? "Visible" : "Hidden"}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</span>
              <div className="flex gap-1">
                {(["all", "active", "inactive"] as FilterActive[]).map((val) => (
                  <button
                    key={val}
                    onClick={() => setFilterActive(val)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                      filterActive === val
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {val === "all" ? "All" : val === "active" ? "Active" : "Inactive"}
                  </button>
                ))}
              </div>
            </div>

            {/* Result count */}
            <span className="text-xs text-gray-400 ml-auto">
              Showing {filtered.length} of {brains.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
              <div className="text-4xl mb-4">&#129504;</div>
              <h2 className="text-lg font-black text-gray-900 mb-2">No brains match filters</h2>
              <p className="text-sm text-gray-500">Try adjusting the filters above to see more results.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((brain) => (
                <a
                  key={brain.id}
                  href={brain.token ? `/share/brain/${brain.token}` : undefined}
                  className={`block bg-white rounded-2xl border border-gray-100 p-6 shadow-sm transition-all group ${
                    brain.token ? "hover:shadow-md hover:border-gray-200 cursor-pointer" : "opacity-70 cursor-default"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h2 className={`text-lg font-black text-gray-900 truncate ${brain.token ? "group-hover:text-blue-700" : ""} transition-colors`}>
                          {brain.brainName}
                        </h2>
                        {brain.isActive ? (
                          <Badge className="text-[10px] bg-green-100 text-green-700 border-0 shrink-0">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Inactive</Badge>
                        )}
                        {brain.token ? (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0 shrink-0">Shared</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] shrink-0 bg-gray-50 text-gray-400">Not Shared</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        {brain.companyName && <span className="font-medium">{brain.companyName}</span>}
                        {brain.companyWebsite && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{brain.companyWebsite}</span>
                          </>
                        )}
                      </div>
                      {brain.offeringSummary && (
                        <p className="text-sm text-gray-600 line-clamp-2">{brain.offeringSummary}</p>
                      )}
                    </div>
                    {brain.token && (
                      <div className="shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors mt-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 mt-12 pb-8">
            This is a read-only confidential document generated by LeadTrigger - Connect Group.<br />
            Do not distribute without authorisation.
          </div>
        </div>
      </div>
    </ShareGate>
  );
}
