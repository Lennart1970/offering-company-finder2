import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { ShareGate } from "@/components/ShareGate";

// --- Score badge --------------------------------------------------------------
function ScorePill({ score, color }: { score: number | null; color: string }) {
  if (score === null || score === undefined) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <span
      className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-black text-sm"
      style={{ background: color }}
    >
      {score}
    </span>
  );
}

function scoreColor(score: number | null): string {
  if (!score) return "#9ca3af";
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

type SortKey = "fitScore" | "urgencyScore" | "companyName";
type SortDir = "desc" | "asc";

// --- Sort header button -------------------------------------------------------
function SortTh({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700 cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${active ? "text-black" : "text-gray-500"}`}>
        {label}
        <span className="text-[10px]">
          {active ? (dir === "desc" ? "▼" : "▲") : "⇅"}
        </span>
      </span>
    </th>
  );
}

// --- Main Component -----------------------------------------------------------
export default function ShareListPage() {
  const { listToken } = useParams<{ listToken: string }>();

  const { data, isLoading, error } = trpc.share.resolveListToken.useQuery(
    { listToken: listToken ?? "" },
    { enabled: !!listToken }
  );

  // -- Sort & filter state -----------------------------------------------------
  const [sortKey, setSortKey] = useState<SortKey>("fitScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minFit, setMinFit] = useState<number>(0);
  const [minUrgency, setMinUrgency] = useState<number>(0);
  const [search, setSearch] = useState<string>("");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // -- Filtered + sorted companies ---------------------------------------------
  const displayCompanies = useMemo(() => {
    if (!data?.companies) return [];
    let list = [...data.companies] as any[];

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.companyName?.toLowerCase().includes(q) ||
          c.website?.toLowerCase().includes(q) ||
          c.country?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.sector?.toLowerCase().includes(q)
      );
    }

    // Score filters
    if (minFit > 0) list = list.filter((c) => (c.fitScore ?? 0) >= minFit);
    if (minUrgency > 0) list = list.filter((c) => (c.urgencyScore ?? 0) >= minUrgency);

    // Sort
    list.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === "companyName") {
        av = (a.companyName ?? "").toLowerCase();
        bv = (b.companyName ?? "").toLowerCase();
      } else {
        av = a[sortKey] ?? -1;
        bv = b[sortKey] ?? -1;
      }
      if (av < bv) return sortDir === "desc" ? 1 : -1;
      if (av > bv) return sortDir === "desc" ? -1 : 1;
      return 0;
    });

    return list;
  }, [data, search, minFit, minUrgency, sortKey, sortDir]);

  // -- Excel download ----------------------------------------------------------
  function handleDownloadExcel() {
    if (!data) return;
    const listName = data.shareListName ?? "share-list";
    const rows = displayCompanies.map((c: any) => ({
      "Company Name": c.companyName,
      "List Name": listName,
      Website: c.website,
      Country: c.country,
      City: c.city,
      "Employee Count": c.employeeCount,
      Sector: c.sector,
      "Brain / ICP": c.brainName,
      "Fit Score": c.fitScore ?? "",
      "Urgency Score": c.urgencyScore ?? "",
      "Key Signal": c.keySignal,
      "Contact Name": c.contactName,
      "Contact Title": c.contactTitle,
      "Contact Email": c.contactEmail,
      "Company Page": `${window.location.origin}/share/${c.token}`,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r: any) => String((r as Record<string, unknown>)[k] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    // Sheet tab name: max 31 chars (Excel limit), strip invalid chars
    const sheetName = listName.replace(/[\\/?*\[\]:]/g, "").substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Share List");
    XLSX.writeFile(wb, `${listName.replace(/\s+/g, "-")}.xlsx`);
  }

  // -- JSON download ----------------------------------------------------------
  function handleDownloadJson() {
    if (!data) return;
    const listName = data.shareListName ?? "share-list";
    const rows = displayCompanies.map((c: any) => ({
      "Company Name": c.companyName,
      "Campaign": listName,
      "Website": c.website ?? "",
      "Country": c.country ?? "",
      "City": c.city ?? "",
      "Employee Count": c.employeeCount ?? "",
      "Sector": c.sector ?? "",
      "Brain / ICP": c.brainName ?? "",
      "Fit Score": c.fitScore ?? "",
      "Urgency Score": c.urgencyScore ?? "",
      "Key Signal": c.keySignal ?? "",
      "Contact Name": c.contactName ?? "",
      "Contact Title": c.contactTitle ?? "",
      "Contact Email": c.contactEmail ?? "",
      "Company Page": `${window.location.origin}/share/${c.token}`,
    }));
    // Plain array of objects — no hyperlink formatting, consumer handles links
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${listName.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -- Loading / error states --------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading share list…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-black mb-2">Invalid or expired link</h2>
          <p className="text-gray-500">This share list link is no longer valid.</p>
        </div>
      </div>
    );
  }

  const createdDate = new Date(data.createdAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const totalCount = data.companies.length;
  const filteredCount = displayCompanies.length;
  const isFiltered = filteredCount !== totalCount;

  return (
    <ShareGate tokenType="list" tokenValue={listToken ?? ""}>
    <div className="min-h-screen bg-gray-50">
      {/* -- Top header -- */}
      <div className="bg-white border-b-2 border-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
              <span className="text-white font-black text-xs">LT</span>
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-widest text-gray-800">
                LEADTRIGGER · CONNECT GROUP
              </div>
              <div className="text-xs text-gray-500">
                {data.shareListName ?? "Share List"} — {createdDate}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-black text-gray-500 border-gray-400">
              Read-only · Confidential
            </Badge>
            <Button
              onClick={handleDownloadExcel}
              className="bg-black text-white hover:bg-gray-800 font-black text-xs px-4 py-2 h-auto"
            >
              ⬇ Download Excel
            </Button>
            <Button
              onClick={handleDownloadJson}
              variant="outline"
              className="border-black text-black hover:bg-gray-100 font-black text-xs px-4 py-2 h-auto"
            >
              ⬇ Download JSON
            </Button>
          </div>
        </div>
      </div>

      {/* -- Summary bar -- */}
      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-8 flex-wrap">
          <div>
            <div className="text-2xl font-black">
              {isFiltered ? (
                <span>{filteredCount} <span className="text-gray-400 text-lg">/ {totalCount}</span></span>
              ) : totalCount}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">
              {isFiltered ? "Filtered" : "Companies"}
            </div>
          </div>
          {data.shareListName && (
            <div>
              <div className="text-lg font-black">{data.shareListName}</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">List Name</div>
            </div>
          )}
          <div className="ml-auto text-xs text-gray-400">
            Created {createdDate}
          </div>
        </div>
      </div>

      {/* -- Filter & sort toolbar -- */}
      <div className="bg-white border-b border-gray-200 sticky top-[57px] z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Min Fit Score */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">
              Min Fit
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minFit}
                onChange={(e) => setMinFit(Number(e.target.value))}
                className="w-24 accent-black"
              />
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-black text-xs"
                style={{ background: scoreColor(minFit || null) }}
              >
                {minFit}
              </span>
            </div>
          </div>

          {/* Min Urgency Score */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">
              Min Urgency
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minUrgency}
                onChange={(e) => setMinUrgency(Number(e.target.value))}
                className="w-24 accent-black"
              />
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-black text-xs"
                style={{ background: scoreColor(minUrgency || null) }}
              >
                {minUrgency}
              </span>
            </div>
          </div>

          {/* Reset */}
          {(minFit > 0 || minUrgency > 0 || search) && (
            <button
              onClick={() => { setMinFit(0); setMinUrgency(0); setSearch(""); }}
              className="text-xs text-gray-500 underline hover:text-black"
            >
              Reset
            </button>
          )}

          <div className="ml-auto text-xs text-gray-400">
            {isFiltered && `Showing ${filteredCount} of ${totalCount}`}
          </div>
        </div>
      </div>

      {/* -- Company table -- */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">#</th>
                  <SortTh label="Company" sortKey="companyName" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Location</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Sector</th>
                  <SortTh label="Fit" sortKey="fitScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Urgency" sortKey="urgencyScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">ICP</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {displayCompanies.map((c: any, idx: number) => (
                  <tr
                    key={c.token}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-black text-gray-900">{c.companyName}</div>
                      {c.website && (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {c.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-xs">
                      {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-xs max-w-[140px] truncate" title={c.sector}>
                      {c.sector || "—"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ScorePill score={c.fitScore} color={scoreColor(c.fitScore)} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ScorePill score={c.urgencyScore} color={scoreColor(c.urgencyScore)} />
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-500 max-w-[120px] truncate" title={c.brainName}>
                      {c.brainName || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={`/share/${c.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-black text-white text-xs font-black px-3 py-1.5 rounded hover:bg-gray-800 transition-colors whitespace-nowrap"
                      >
                        View ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayCompanies.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">
                {isFiltered ? "No companies match the current filters" : "No companies in this list"}
              </p>
              {isFiltered && (
                <button
                  onClick={() => { setMinFit(0); setMinUrgency(0); setSearch(""); }}
                  className="mt-3 text-xs text-black underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* -- Footer -- */}
        <div className="mt-6 text-center text-xs text-gray-400">
          This is a read-only confidential document generated by LeadTrigger · Connect Group.
          Do not distribute without authorisation.
        </div>
      </div>
    </div>
    </ShareGate>
  );
}
