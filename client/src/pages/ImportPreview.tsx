import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 100;
type SortKey = "name" | "country" | "city" | "id" | "fitScore";
type SortDir = "asc" | "desc";

export default function ImportPreview() {
  const params = useParams<{ searchId: string }>();
  const searchId = parseInt(params.searchId, 10);
  const [, navigate] = useLocation();

  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input — 350ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Reset page on sort change
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const { data, isLoading, isFetching } = trpc.companyFinder.getSearchRaw.useQuery(
    { searchId, page, pageSize: PAGE_SIZE, sortBy: sortKey, sortDir, search: debouncedSearch || undefined },
    { enabled: !!searchId && !isNaN(searchId) }
  );

  // Fetch search name
  const { data: searchHistory } = trpc.companyFinder.getSearchHistory.useQuery({ showArchived: false });
  const searchMeta = searchHistory?.find((s: any) => s.id === searchId);

  const rows = data?.companies ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageStart = page * PAGE_SIZE;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs font-black text-muted-foreground mb-1">IMPORT PREVIEW · Run #{searchId}</div>
          <div className="text-3xl font-black">
            {isLoading ? "LOADING..." : `${total.toLocaleString()} COMPANIES`}
          </div>
          {searchMeta?.offeringName && (
            <div className="text-sm text-gray-500 mt-1">{searchMeta.offeringName}</div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-black text-xs" onClick={() => navigate(`/search-results/${searchId}`)}>
            ☰ FULL VIEW →
          </Button>
          <Button className="font-black text-xs bg-black text-white hover:bg-gray-800" onClick={() => navigate(`/niche-review?searchId=${searchId}`)}>
            ⚡ CLUSTER &amp; SCORE →
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          <Input
            className="pl-8 font-mono text-xs border-2 border-black h-9"
            placeholder="Search company name..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        {debouncedSearch && (
          <button
            className="text-xs font-black text-gray-400 hover:text-black underline"
            onClick={() => { setSearchInput(""); setDebouncedSearch(""); setPage(0); }}
          >
            CLEAR
          </button>
        )}
        {isFetching && !isLoading && (
          <span className="text-xs text-gray-400 font-black animate-pulse">LOADING...</span>
        )}
      </div>

      {/* Table */}
      <div className="mb-4 text-xs text-gray-500 font-black">
        {total === 0 && debouncedSearch
          ? `No results for "${debouncedSearch}"`
          : `Showing ${pageStart + 1}–${Math.min(pageStart + rows.length, total)} of ${total.toLocaleString()}`}
      </div>

      <div className="border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="text-left px-3 py-2 font-black text-gray-500 w-8">#</th>
              <th
                className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black"
                onClick={() => handleSort("name")}
              >
                COMPANY<SortArrow col="name" />
              </th>
              <th className="text-left px-3 py-2 font-black text-gray-700">WEBSITE</th>
              <th
                className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black"
                onClick={() => handleSort("country")}
              >
                COUNTRY<SortArrow col="country" />
              </th>
              <th
                className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black"
                onClick={() => handleSort("city")}
              >
                CITY<SortArrow col="city" />
              </th>
              <th className="text-left px-3 py-2 font-black text-gray-700">SECTOR</th>
              <th className="text-left px-3 py-2 font-black text-gray-700">EMPLOYEES</th>
              <th
                className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black"
                onClick={() => handleSort("fitScore")}
                title="Cosine similarity score against the active Brain"
              >
                FIT<SortArrow col="fitScore" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-4" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-32" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-24" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-16" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-16" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-20" /></td>
                  <td className="px-3 py-2"><div className="h-3 bg-gray-100 rounded w-8" /></td>
                </tr>
              ))
            ) : rows.map((company: any, idx: number) => {
              let industry = "";
              let employeeCount = "";
              try {
                const meta = company.sliceMetadata ? JSON.parse(company.sliceMetadata) : {};
                industry = meta.industry ?? "";
                employeeCount = meta.employeeCount != null ? String(meta.employeeCount) : "";
              } catch {}
              return (
                <tr
                  key={company.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/company/${company.id}`)}
                >
                  <td className="px-3 py-2 text-gray-400">{pageStart + idx + 1}</td>
                  <td className="px-3 py-2 font-bold">{company.name}</td>
                  <td className="px-3 py-2 text-blue-600">
                    {company.websiteUrl
                      ? <a href={company.websiteUrl.startsWith("http") ? company.websiteUrl : `https://${company.websiteUrl}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:underline">{company.websiteUrl.replace(/^https?:\/\//, "")}</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{company.country || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-gray-600">{company.city || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-gray-500">{industry || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-gray-500 text-right">{employeeCount || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right">
                    {company.fitScore != null ? (
                      <span
                        className={`inline-block font-black text-xs px-2 py-0.5 rounded ${
                          company.fitScore >= 70 ? 'bg-green-100 text-green-800' :
                          company.fitScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}
                        title={(() => {
                          try {
                            const d = JSON.parse(company.fitScoreData || '{}');
                            return d.bestBrainId ? `Brain ${d.bestBrainId} · ${d.method ?? 'cosine-similarity'}` : '';
                          } catch { return ''; }
                        })()}
                      >
                        {company.fitScore}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            className="font-black text-xs border-2 border-black"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            ← PREV
          </Button>
          <span className="text-xs font-black text-gray-500">
            PAGE {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            className="font-black text-xs border-2 border-black"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            NEXT →
          </Button>
        </div>
      )}
    </div>
  );
}
