import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// --- Main Component -----------------------------------------------------------
export default function ShareListPage() {
  const { listToken } = useParams<{ listToken: string }>();

  const { data, isLoading, error } = trpc.share.resolveListToken.useQuery(
    { listToken: listToken ?? "" },
    { enabled: !!listToken }
  );

  // -- Excel download ----------------------------------------------------------
  function handleDownloadExcel() {
    if (!data) return;
    const rows = data.companies.map((c) => ({
      "Company Name": c.companyName,
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
    // Auto-width
    const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Share List");
    const listName = data.shareListName ?? "share-list";
    XLSX.writeFile(wb, `${listName.replace(/\s+/g, "-")}.xlsx`);
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
          </div>
        </div>
      </div>

      {/* -- Summary bar -- */}
      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-8 flex-wrap">
          <div>
            <div className="text-2xl font-black">{data.companies.length}</div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">Companies</div>
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

      {/* -- Company table -- */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">#</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Company</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Location</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Sector</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Employees</th>
                  <th className="text-center px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Fit</th>
                  <th className="text-center px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Urgency</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Key Signal</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">Contact</th>
                  <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest text-gray-700">ICP</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((c, idx) => (
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
                    <td className="px-4 py-4 text-gray-600 text-xs">
                      {c.employeeCount || "—"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ScorePill score={c.fitScore} color={scoreColor(c.fitScore)} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ScorePill score={c.urgencyScore} color={scoreColor(c.urgencyScore)} />
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-xs max-w-[200px]">
                      <span className="line-clamp-2">{c.keySignal || "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      {c.contactName ? (
                        <div>
                          <div className="font-semibold text-xs text-gray-900">{c.contactName}</div>
                          {c.contactTitle && <div className="text-xs text-gray-500">{c.contactTitle}</div>}
                          {c.contactEmail && (
                            <a href={`mailto:${c.contactEmail}`} className="text-xs text-blue-600 hover:underline">
                              {c.contactEmail}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
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

          {data.companies.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-medium">No companies in this list</p>
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
