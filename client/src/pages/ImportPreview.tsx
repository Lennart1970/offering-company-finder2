import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 100;

type SortKey = "name" | "country" | "city" | "sector" | "employees";
type SortDir = "asc" | "desc";

export default function ImportPreview() {
  const params = useParams<{ searchId: string }>();
  const searchId = parseInt(params.searchId, 10);
  const [, navigate] = useLocation();
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const { data, isLoading } = trpc.companyFinder.getSearchRaw.useQuery(
    { searchId, page, pageSize: PAGE_SIZE },
    { enabled: !!searchId && !isNaN(searchId) }
  );

  const rawRows = data?.companies ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageStart = page * PAGE_SIZE;

  // Client-side sort within the current page
  const rows = sortKey ? [...rawRows].sort((a: any, b: any) => {
    let av = "", bv = "";
    if (sortKey === "name") { av = a.name ?? ""; bv = b.name ?? ""; }
    else if (sortKey === "country") { av = a.country ?? ""; bv = b.country ?? ""; }
    else if (sortKey === "city") { av = a.city ?? ""; bv = b.city ?? ""; }
    else if (sortKey === "sector" || sortKey === "employees") {
      try {
        const asm = a.sliceMetadata ? JSON.parse(a.sliceMetadata) : {};
        const bsm = b.sliceMetadata ? JSON.parse(b.sliceMetadata) : {};
        if (sortKey === "sector") { av = asm.industry ?? ""; bv = bsm.industry ?? ""; }
        else { av = String(asm.employeeCount ?? 0); bv = String(bsm.employeeCount ?? 0); }
      } catch {}
    }
    const cmp = sortKey === "employees"
      ? Number(av) - Number(bv)
      : av.localeCompare(bv, undefined, { sensitivity: "base" });
    return sortDir === "asc" ? cmp : -cmp;
  }) : rawRows;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-black text-muted-foreground mb-1">
            IMPORT PREVIEW · Run #{searchId}
          </div>
          <div className="text-2xl font-black">
            {isLoading ? "LOADING..." : `${total} COMPANIES`}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-xs font-black border-2 border-black"
            onClick={() => navigate(`/search-results/${searchId}`)}
          >
            ☰ FULL VIEW →
          </Button>
          <Button
            variant="outline"
            className="text-xs font-black border-2 border-black"
            onClick={() => navigate(`/niche-review?searchId=${searchId}`)}
          >
            ⚡ CLUSTER & SCORE →
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="border-4 border-black p-12 text-center animate-pulse">
          <div className="text-xl font-black">→ LOADING...</div>
        </div>
      ) : (
        <>
          <div className="text-xs font-mono text-gray-500 mb-2">
            Showing {pageStart + 1}–{Math.min(pageStart + rows.length, total)} of {total}
          </div>
          <div className="border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left px-3 py-2 font-black text-gray-500 w-8">#</th>
                  <th className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black" onClick={() => handleSort("name")}>COMPANY<SortArrow col="name" /></th>
                  <th className="text-left px-3 py-2 font-black text-gray-700">WEBSITE</th>
                  <th className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black" onClick={() => handleSort("country")}>COUNTRY<SortArrow col="country" /></th>
                  <th className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black" onClick={() => handleSort("city")}>CITY<SortArrow col="city" /></th>
                  <th className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black" onClick={() => handleSort("sector")}>SECTOR<SortArrow col="sector" /></th>
                  <th className="text-left px-3 py-2 font-black text-gray-700 cursor-pointer select-none hover:text-black" onClick={() => handleSort("employees")}>EMPLOYEES<SortArrow col="employees" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((company: any, idx: number) => {
                  let industry = "";
                  let employeeCount = "";
                  try {
                    const sm = company.sliceMetadata ? JSON.parse(company.sliceMetadata) : {};
                    industry = sm.industry ?? "";
                    employeeCount = sm.employeeCount ? String(sm.employeeCount) : "";
                  } catch {}
                  return (
                    <tr
                      key={company.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/company/${company.id}?from=import-preview/${searchId}`)}
                    >
                      <td className="px-3 py-2 text-gray-400 tabular-nums">{pageStart + idx + 1}</td>
                      <td className="px-3 py-2 font-bold text-gray-900 max-w-[200px] truncate">{company.name}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">
                        {company.websiteUrl?.replace(/^https?:\/\/(www\.)?/, "") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{company.country ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{company.city ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{industry || "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{employeeCount || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-xs font-black border-2 border-black px-4 py-2 disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
              >← PREV</button>
              <span className="text-xs font-mono text-gray-500">
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-xs font-black border-2 border-black px-4 py-2 disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
              >NEXT →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
