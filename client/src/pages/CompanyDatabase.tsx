import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Database } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortBy = "name" | "country" | "city" | "fitScore" | "urgencyScore" | "createdAt" | "searchId";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fitBadge(score: number | null | undefined) {
  if (score == null) return <span className="text-xs text-gray-400">—</span>;
  const cls =
    score >= 70
      ? "bg-green-100 text-green-800 border-green-200"
      : score >= 50
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>
      {score}
    </span>
  );
}

function urgencyBadge(score: number | null | undefined) {
  if (score == null) return <span className="text-xs text-gray-400">—</span>;
  const cls =
    score >= 70
      ? "bg-red-100 text-red-800 border-red-200"
      : score >= 40
      ? "bg-orange-100 text-orange-800 border-orange-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>
      {score}
    </span>
  );
}

function getSector(sliceMetadata: string | null | undefined): string {
  if (!sliceMetadata) return "—";
  try {
    const m = JSON.parse(sliceMetadata);
    return m.industry || "—";
  } catch {
    return "—";
  }
}

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (col !== sortBy) return <ChevronsUpDown className="w-3 h-3 ml-1 text-gray-400 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 text-gray-700 inline" />
    : <ChevronDown className="w-3 h-3 ml-1 text-gray-700 inline" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompanyDatabase() {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("fitScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSearchId, setSelectedSearchId] = useState<number | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>(undefined);
  const [minFitScore, setMinFitScore] = useState<number | undefined>(undefined);
  const [hasFitScoreOnly, setHasFitScoreOnly] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(rawSearch);
      setPage(0);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawSearch]);

  const search = debouncedSearch;
  const PAGE_SIZE = 100;

  // Metadata: campaigns + countries for filter dropdowns
  const { data: meta } = trpc.companyFinder.getCompanyDbMeta.useQuery();

  // Main data query
  const { data, isFetching } = trpc.companyFinder.getCompanyDb.useQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDir,
      search: search || undefined,
      searchId: selectedSearchId,
      country: selectedCountry || undefined,
      minFitScore,
      hasFitScore: hasFitScoreOnly || undefined,
    },
  );

  const rows = data?.companies ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build campaign name map
  const campaignMap = useMemo(() => {
    const m = new Map<number, string>();
    (meta?.searches ?? []).forEach((s) => m.set(s.id, s.location || `Run #${s.id}`));
    return m;
  }, [meta]);

  const handleSort = useCallback(
    (col: SortBy) => {
      if (col === sortBy) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(col);
        setSortDir(col === "fitScore" || col === "urgencyScore" ? "desc" : "asc");
      }
      setPage(0);
    },
    [sortBy]
  );

  const resetFilters = () => {
    setRawSearch("");
    setSelectedSearchId(undefined);
    setSelectedCountry(undefined);
    setMinFitScore(undefined);
    setHasFitScoreOnly(false);
    setPage(0);
  };

  const hasFilters = rawSearch || selectedSearchId || selectedCountry || minFitScore !== undefined || hasFitScoreOnly;

  const Th = ({ col, label, className = "" }: { col: SortBy; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-1">
          <Database className="w-5 h-5 text-gray-500" />
          <h1 className="text-xl font-bold text-gray-900">Company Database</h1>
          <span className="text-sm text-gray-500 font-normal">
            {isFetching ? "Loading…" : `${total.toLocaleString()} companies`}
          </span>
        </div>
        <p className="text-sm text-gray-500">All imported companies scored against the active Brain</p>
      </div>

      {/* ── Filters ── */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            className="pl-8 h-8 w-56 text-sm"
            placeholder="Search company name…"
            value={rawSearch}
            onChange={(e) => { setRawSearch(e.target.value); setPage(0); }}
          />
        </div>

        {/* Campaign filter */}
        <Select
          value={selectedSearchId !== undefined ? String(selectedSearchId) : "all"}
          onValueChange={(v) => { setSelectedSearchId(v === "all" ? undefined : Number(v)); setPage(0); }}
        >
          <SelectTrigger className="h-8 w-52 text-sm">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {(meta?.searches ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.location || `Run #${s.id}`}
                <span className="ml-1 text-gray-400 text-xs">({s.companyCount})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Country filter */}
        <Select
          value={selectedCountry || "all"}
          onValueChange={(v) => { setSelectedCountry(v === "all" ? undefined : v); setPage(0); }}
        >
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent className="max-h-64 overflow-y-auto">
            <SelectItem value="all">All countries</SelectItem>
            {(meta?.countries ?? []).map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Min FIT score */}
        <Select
          value={minFitScore !== undefined ? String(minFitScore) : "any"}
          onValueChange={(v) => { setMinFitScore(v === "any" ? undefined : Number(v)); setPage(0); }}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Min FIT score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any FIT score</SelectItem>
            <SelectItem value="50">≥ 50 (medium+)</SelectItem>
            <SelectItem value="60">≥ 60</SelectItem>
            <SelectItem value="70">≥ 70 (high)</SelectItem>
            <SelectItem value="75">≥ 75</SelectItem>
            <SelectItem value="80">≥ 80</SelectItem>
          </SelectContent>
        </Select>

        {/* Scored only toggle */}
        <button
          onClick={() => { setHasFitScoreOnly(!hasFitScoreOnly); setPage(0); }}
          className={`h-8 px-3 rounded text-xs font-medium border transition-colors ${
            hasFitScoreOnly
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
          }`}
        >
          Scored only
        </button>

        {hasFilters && (
          <button onClick={resetFilters} className="h-8 px-3 rounded text-xs text-gray-500 hover:text-gray-800 underline">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
              <Th col="name" label="Company" className="min-w-[200px]" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Website</th>
              <Th col="country" label="Country" />
              <Th col="city" label="City" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sector</th>
              <Th col="fitScore" label="FIT" className="w-16 text-center" />
              <Th col="urgencyScore" label="URG" className="w-16 text-center" />
              <Th col="searchId" label="Campaign" className="min-w-[140px]" />
            </tr>
          </thead>
          <tbody>
            {isFetching && rows.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No companies found matching your filters.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">
                    {page * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[240px]">
                    <span className="truncate block" title={row.name}>{row.name}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {row.websiteUrl ? (
                      <a
                        href={row.websiteUrl.startsWith("http") ? row.websiteUrl : `https://${row.websiteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs truncate max-w-[160px]"
                      >
                        {row.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{row.country || "—"}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{row.city || "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[160px]">
                    <span className="truncate block" title={getSector(row.sliceMetadata)}>
                      {getSector(row.sliceMetadata)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">{fitBadge(row.fitScore)}</td>
                  <td className="px-3 py-2 text-center">{urgencyBadge(row.urgencyScore)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-[180px]">
                    <span className="truncate block" title={campaignMap.get(row.searchId) ?? `Run #${row.searchId}`}>
                      {campaignMap.get(row.searchId) ?? `Run #${row.searchId}`}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between text-sm text-gray-600">
        <span>
          {total > 0
            ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}`
            : "No results"}
          {isFetching && <span className="ml-2 text-gray-400 text-xs">Updating…</span>}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </Button>
          <span className="text-xs text-gray-500">
            Page {page + 1} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
