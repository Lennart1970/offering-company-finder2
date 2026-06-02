import { useState, useMemo, useEffect, useRef } from "react";
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
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  Database,
  FileText,
  MessageSquare,
  Phone,
  Tag,
  Brain,
} from "lucide-react";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortBy =
  | "name"
  | "country"
  | "city"
  | "fitScore"
  | "urgencyScore"
  | "createdAt"
  | "searchId"
  | "briefGeneratedAt"
  | "salesApproachGeneratedAt"
  | "brainName";
type SortDir = "asc" | "desc";
type ArticleFilter = "any" | "brief" | "approach" | "both" | "none";

// ── Region Map ───────────────────────────────────────────────────────────────
// Maps macro-region labels to the list of country strings stored in the DB.
// Aligns with the geography multipliers used in fit scoring.

const REGION_MAP: Record<string, string[]> = {
  "Europe": [
    "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
    "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Czechia", "Denmark", "Estonia",
    "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy",
    "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova",
    "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland",
    "Portugal", "Romania", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain",
    "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City",
  ],
  "USA / Canada": [
    "United States", "Canada",
  ],
  "China": [
    "China",
  ],
  "APAC": [
    "Australia", "Bangladesh", "Brunei", "Cambodia", "Fiji", "Hong Kong", "India",
    "Indonesia", "Japan", "Laos", "Macau", "Malaysia", "Maldives", "Mongolia",
    "Myanmar", "Nepal", "New Zealand", "North Korea", "Pakistan", "Papua New Guinea",
    "Philippines", "Singapore", "South Korea", "Sri Lanka", "Taiwan", "Thailand",
    "Timor-Leste", "Vietnam",
  ],
  "LATAM": [
    "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Costa Rica", "Cuba",
    "Dominican Republic", "Ecuador", "El Salvador", "Guatemala", "Haiti", "Honduras",
    "Jamaica", "Mexico", "Nicaragua", "Panama", "Paraguay", "Peru", "Puerto Rico",
    "Trinidad and Tobago", "Uruguay", "Venezuela",
  ],
  "MEA": [
    "Algeria", "Angola", "Bahrain", "Benin", "Botswana", "Burkina Faso", "Burundi",
    "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
    "Congo", "Democratic Republic of the Congo", "Djibouti", "Egypt", "Equatorial Guinea",
    "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
    "Guinea-Bissau", "Iran", "Iraq", "Israel", "Ivory Coast", "Jordan", "Kenya",
    "Kuwait", "Lebanon", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi",
    "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger",
    "Nigeria", "Oman", "Palestine", "Qatar", "Rwanda", "Saudi Arabia", "Senegal",
    "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Syria",
    "Tanzania", "Togo", "Tunisia", "Turkey", "Türkiye", "Uganda", "United Arab Emirates",
    "Yemen", "Zambia", "Zimbabwe",
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fitBadge(score: number | null | undefined) {
  if (score == null) return <span className="text-xs text-gray-300">—</span>;
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
  if (score == null) return <span className="text-xs text-gray-300">—</span>;
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

function ArticleDots({
  hasBrief,
  hasApproach,
  hasCallSummary,
  briefDate,
  approachDate,
}: {
  hasBrief: boolean;
  hasApproach: boolean;
  hasCallSummary: boolean;
  briefDate?: Date | null;
  approachDate?: Date | null;
}) {
  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) : null;

  return (
    <div className="flex items-center gap-1.5">
      {/* Brief / Deep Research */}
      <span
        title={hasBrief ? `Brief generated ${fmt(briefDate)}` : "No brief yet"}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${
          hasBrief
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-gray-50 text-gray-300 border-gray-200"
        }`}
      >
        <FileText className="w-3 h-3" />
        {hasBrief ? <span className="hidden sm:inline">Brief</span> : null}
      </span>

      {/* Sales Approach */}
      <span
        title={hasApproach ? `Approach generated ${fmt(approachDate)}` : "No sales approach yet"}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${
          hasApproach
            ? "bg-purple-50 text-purple-700 border-purple-200"
            : "bg-gray-50 text-gray-300 border-gray-200"
        }`}
      >
        <MessageSquare className="w-3 h-3" />
        {hasApproach ? <span className="hidden sm:inline">Approach</span> : null}
      </span>

      {/* Call readiness */}
      {hasCallSummary && (
        <span
          title="Call readiness summary available"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border bg-teal-50 text-teal-700 border-teal-200"
        >
          <Phone className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (col !== sortBy) return <ChevronsUpDown className="w-3 h-3 ml-1 text-gray-400 inline" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3 h-3 ml-1 text-gray-700 inline" />
  ) : (
    <ChevronDown className="w-3 h-3 ml-1 text-gray-700 inline" />
  );
}

// ── Lead Class Badge ─────────────────────────────────────────────────────────

function LeadClassBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls =
    v === "hot"
      ? "bg-red-100 text-red-700 border-red-200"
      : v === "warm"
      ? "bg-orange-100 text-orange-700 border-orange-200"
      : v === "cold"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {value}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompanyDatabase() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("fitScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSearchId, setSelectedSearchId] = useState<number | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>(undefined);
  const [selectedSector, setSelectedSector] = useState<string | undefined>(undefined);
  const [selectedBrainId, setSelectedBrainId] = useState<number | undefined>(undefined);
  const [selectedCgBu, setSelectedCgBu] = useState<string | undefined>(undefined);
  const [selectedCgLeadClass, setSelectedCgLeadClass] = useState<string | undefined>(undefined);
  const [selectedCgLeadOrigin, setSelectedCgLeadOrigin] = useState<string | undefined>(undefined);
  const [minFitScore, setMinFitScore] = useState<number | undefined>(undefined);
  const [hasFitScoreOnly, setHasFitScoreOnly] = useState(false);
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>("any");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(rawSearch);
      setPage(0);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawSearch]);

  const PAGE_SIZE = 100;

  const { data: meta } = trpc.companyFinder.getCompanyDbMeta.useQuery();

  const { data, isFetching } = trpc.companyFinder.getCompanyDb.useQuery({
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDir,
    search: debouncedSearch || undefined,
    searchId: selectedSearchId,
    country: selectedCountry || undefined,
    countries: selectedRegion ? REGION_MAP[selectedRegion] : undefined,
    sector: selectedSector || undefined,
    brainId: selectedBrainId,
    cgBusinessUnit: selectedCgBu || undefined,
    cgLeadClass: selectedCgLeadClass || undefined,
    cgLeadOrigin: selectedCgLeadOrigin || undefined,
    minFitScore,
    hasFitScore: hasFitScoreOnly || undefined,
    articleFilter: articleFilter === "any" ? undefined : articleFilter,
  });

  const rows = data?.companies ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const campaignMap = useMemo(() => {
    const m = new Map<number, string>();
    (meta?.searches ?? []).forEach((s) => {
      // Prefer offeringName (e.g. "Industrial Sensing & Automation"), fall back to Run #id
      const label = (s as any).offeringName || s.location || `Run #${s.id}`;
      m.set(s.id, label);
    });
    return m;
  }, [meta]);

  // Article stats from current page
  const articleStats = useMemo(() => {
    const withBrief = rows.filter((r) => r.briefGeneratedAt).length;
    const withApproach = rows.filter((r) => r.salesApproachGeneratedAt).length;
    return { withBrief, withApproach };
  }, [rows]);

  const handleSort = (col: SortBy) => {
    if (col === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(["fitScore", "urgencyScore", "briefGeneratedAt", "salesApproachGeneratedAt"].includes(col) ? "desc" : "asc");
    }
    setPage(0);
  };

  const resetFilters = () => {
    setRawSearch("");
    setSelectedSearchId(undefined);
    setSelectedRegion(undefined);
    setSelectedCountry(undefined);
    setSelectedSector(undefined);
    setSelectedBrainId(undefined);
    setSelectedCgBu(undefined);
    setSelectedCgLeadClass(undefined);
    setSelectedCgLeadOrigin(undefined);
    setMinFitScore(undefined);
    setHasFitScoreOnly(false);
    setArticleFilter("any");
    setPage(0);
  };

  const hasFilters =
    rawSearch ||
    selectedSearchId ||
    selectedRegion ||
    selectedCountry ||
    selectedSector ||
    selectedBrainId ||
    selectedCgBu ||
    selectedCgLeadClass ||
    selectedCgLeadOrigin ||
    minFitScore !== undefined ||
    hasFitScoreOnly ||
    articleFilter !== "any";

  const Th = ({
    col,
    label,
    className = "",
  }: {
    col: SortBy;
    label: string;
    className?: string;
  }) => (
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
        <p className="text-sm text-gray-500">
          All imported companies · scored against active Brain · joined with created articles
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            className="pl-8 h-8 w-52 text-sm"
            placeholder="Search company name…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>

        {/* Campaign */}
        <Select
          value={selectedSearchId !== undefined ? String(selectedSearchId) : "all"}
          onValueChange={(v) => {
            setSelectedSearchId(v === "all" ? undefined : Number(v));
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-48 text-sm">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {(meta?.searches ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {(s as any).offeringName || s.location || `Run #${s.id}`}
                <span className="ml-1 text-gray-400 text-xs">({s.companyCount})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Region */}
        <Select
          value={selectedRegion || "all"}
          onValueChange={(v) => {
            setSelectedRegion(v === "all" ? undefined : v);
            setSelectedCountry(undefined); // clear country when region changes
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {Object.keys(REGION_MAP).map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Country */}
        <Select
          value={selectedCountry || "all"}
          onValueChange={(v) => {
            setSelectedCountry(v === "all" ? undefined : v);
            setSelectedRegion(undefined); // clear region when country is chosen
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent className="max-h-64 overflow-y-auto">
            <SelectItem value="all">All countries</SelectItem>
            {(meta?.countries ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sector */}
        <Select
          value={selectedSector || "all"}
          onValueChange={(v) => {
            setSelectedSector(v === "all" ? undefined : v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-52 text-sm">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            <SelectItem value="all">All sectors</SelectItem>
            {(meta?.sectors ?? []).map((s) => (
              <SelectItem key={s.sector} value={s.sector}>
                <span className="capitalize">{s.sector}</span>
                <span className="ml-1 text-gray-400 text-xs">({s.count.toLocaleString()})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Brain / Business Unit */}
        <Select
          value={selectedBrainId !== undefined ? String(selectedBrainId) : "all"}
          onValueChange={(v) => {
            setSelectedBrainId(v === "all" ? undefined : Number(v));
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-56 text-sm">
            <SelectValue placeholder="All brains" />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            <SelectItem value="all">All brains / BU</SelectItem>
            {(meta?.brains ?? []).map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                <span className="truncate max-w-[180px]">{b.brainName}</span>
                <span className="ml-1 text-gray-400 text-xs">({b.count.toLocaleString()})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* CG Business Unit */}
        {(meta?.cgBusinessUnits ?? []).length > 0 && (
          <Select
            value={selectedCgBu || "all"}
            onValueChange={(v) => { setSelectedCgBu(v === "all" ? undefined : v); setPage(0); }}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="All BUs" />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              <SelectItem value="all">All BUs</SelectItem>
              {(meta?.cgBusinessUnits ?? []).map((b) => (
                <SelectItem key={b.bu} value={b.bu}>
                  {b.bu}
                  <span className="ml-1 text-gray-400 text-xs">({b.count})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* CG Lead Class */}
        {(meta?.cgLeadClasses ?? []).length > 0 && (
          <Select
            value={selectedCgLeadClass || "all"}
            onValueChange={(v) => { setSelectedCgLeadClass(v === "all" ? undefined : v); setPage(0); }}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              <SelectItem value="all">All classes</SelectItem>
              {(meta?.cgLeadClasses ?? []).map((c) => (
                <SelectItem key={c.cls} value={c.cls}>
                  {c.cls}
                  <span className="ml-1 text-gray-400 text-xs">({c.count})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* CG Lead Origin */}
        {(meta?.cgLeadOrigins ?? []).length > 0 && (
          <Select
            value={selectedCgLeadOrigin || "all"}
            onValueChange={(v) => { setSelectedCgLeadOrigin(v === "all" ? undefined : v); setPage(0); }}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="All origins" />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              <SelectItem value="all">All origins</SelectItem>
              {(meta?.cgLeadOrigins ?? []).map((o) => (
                <SelectItem key={o.origin} value={o.origin}>
                  {o.origin}
                  <span className="ml-1 text-gray-400 text-xs">({o.count})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Min FIT */}
        <Select
          value={minFitScore !== undefined ? String(minFitScore) : "any"}
          onValueChange={(v) => {
            setMinFitScore(v === "any" ? undefined : Number(v));
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Min FIT" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any FIT</SelectItem>
            <SelectItem value="50">≥ 50</SelectItem>
            <SelectItem value="60">≥ 60</SelectItem>
            <SelectItem value="70">≥ 70 (high)</SelectItem>
            <SelectItem value="75">≥ 75</SelectItem>
            <SelectItem value="80">≥ 80</SelectItem>
          </SelectContent>
        </Select>

        {/* Article filter */}
        <Select
          value={articleFilter}
          onValueChange={(v) => {
            setArticleFilter(v as ArticleFilter);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Articles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All articles</SelectItem>
            <SelectItem value="brief">Has brief</SelectItem>
            <SelectItem value="approach">Has approach</SelectItem>
            <SelectItem value="both">Has both</SelectItem>
            <SelectItem value="none">No articles yet</SelectItem>
          </SelectContent>
        </Select>

        {/* Scored only toggle */}
        <button
          onClick={() => {
            setHasFitScoreOnly(!hasFitScoreOnly);
            setPage(0);
          }}
          className={`h-8 px-3 rounded text-xs font-medium border transition-colors ${
            hasFitScoreOnly
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
          }`}
        >
          Scored only
        </button>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="h-8 px-3 rounded text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Clear
          </button>
        )}

        {/* Article stats pill */}
        {rows.length > 0 && (
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-500" />
              {articleStats.withBrief} briefs
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-purple-500" />
              {articleStats.withApproach} approaches
            </span>
            <span className="text-gray-300">on this page</span>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">
                #
              </th>
              <Th col="name" label="Company" className="min-w-[200px]" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Website
              </th>
              <Th col="country" label="Country" />
              <Th col="city" label="City" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Sector
              </th>
              <Th col="fitScore" label="FIT" className="w-14 text-center" />
              <Th col="urgencyScore" label="URG" className="w-14 text-center" />
              <Th col="briefGeneratedAt" label="Articles" className="min-w-[160px]" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                Lead Class
              </th>
              <Th col="brainName" label="Brain / BU" className="min-w-[160px]" />
              <Th col="searchId" label="Campaign" className="min-w-[130px]" />
            </tr>
          </thead>
          <tbody>
            {isFetching && rows.length === 0 ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No companies found matching your filters.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const hasBrief = !!row.briefGeneratedAt;
                const hasApproach = !!row.salesApproachGeneratedAt;
                const hasCallSummary = !!row.callReadinessSummary;

                return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/company/${row.id}`)}
                  >
                    <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">
                      {page * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-[240px]">
                      <span className="truncate block" title={row.name}>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500" onClick={(e) => e.stopPropagation()}>
                      {row.websiteUrl ? (
                        <a
                          href={
                            row.websiteUrl.startsWith("http")
                              ? row.websiteUrl
                              : `https://${row.websiteUrl}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline text-xs truncate max-w-[150px]"
                        >
                          {row.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                      {row.country || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                      {row.city || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[150px]">
                      {row.sector ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs cursor-pointer hover:bg-gray-200 transition-colors"
                          title={`Filter by ${row.sector}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedSector(row.sector!); setPage(0); }}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span className="truncate capitalize max-w-[120px]">{row.sector}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{fitBadge(row.fitScore)}</td>
                    <td className="px-3 py-2 text-center">{urgencyBadge(row.urgencyScore)}</td>
                    <td className="px-3 py-2">
                      <ArticleDots
                        hasBrief={hasBrief}
                        hasApproach={hasApproach}
                        hasCallSummary={hasCallSummary}
                        briefDate={row.briefGeneratedAt}
                        approachDate={row.salesApproachGeneratedAt}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {row.cgLeadClass ? (
                        <LeadClassBadge value={row.cgLeadClass} />
                      ) : (
                        <span className="text-gray-300 italic">No lead yet</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[200px]">
                      {row.allBrainNames ? (
                        <div className="flex flex-wrap gap-1">
                          {(row.allBrainNames as string).split('||').map((name: string) => (
                            <span
                              key={name}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs cursor-pointer hover:bg-violet-100 transition-colors"
                              title={`Filter by ${name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const brain = (meta?.brains ?? []).find(b => b.brainName === name);
                                if (brain) { setSelectedBrainId(brain.id); setPage(0); }
                              }}
                            >
                              <Brain className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[160px]">
                      <span
                        className="truncate block"
                        title={campaignMap.get(row.searchId) ?? `Run #${row.searchId}`}
                      >
                        {campaignMap.get(row.searchId) ?? `Run #${row.searchId}`}
                      </span>
                    </td>
                  </tr>
                );
              })
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
