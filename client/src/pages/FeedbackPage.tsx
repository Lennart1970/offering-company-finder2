import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ThumbsUp, ThumbsDown, Minus, MessageSquare, User, Mail, ExternalLink, Search } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

function RatingBadge({ rating }: { rating: string | null }) {
  if (rating === "thumbs_up") return (
    <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
      <ThumbsUp className="w-3 h-3" /> Good fit
    </span>
  );
  if (rating === "thumbs_down") return (
    <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
      <ThumbsDown className="w-3 h-3" /> Not a fit
    </span>
  );
  if (rating === "neutral") return (
    <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
      <Minus className="w-3 h-3" /> Unsure
    </span>
  );
  return <span className="text-xs text-gray-400">—</span>;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FeedbackPage() {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<"all" | "thumbs_up" | "thumbs_down" | "neutral">("all");

  const { data, isLoading, error, refetch, isFetching } = (trpc as any).shareExt.getFeedback.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = data?.rows ?? [];

  // Summary counts
  type FRow = { id: number; shareToken: string; companyId: number | null; companyName: string | null; rating: string | null; comment: string | null; submitterName: string | null; submitterEmail: string | null; submittedAt: string };

  const counts = useMemo(() => ({
    total: rows.length,
    up: rows.filter((r: FRow) => r.rating === "thumbs_up").length,
    down: rows.filter((r: FRow) => r.rating === "thumbs_down").length,
    neutral: rows.filter((r: FRow) => r.rating === "neutral").length,
    withComment: rows.filter((r: FRow) => r.comment).length,
  }), [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    let r = rows;
    if (ratingFilter !== "all") r = r.filter((row: FRow) => row.rating === ratingFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row: FRow) =>
        (row.companyName ?? "").toLowerCase().includes(q) ||
        (row.comment ?? "").toLowerCase().includes(q) ||
        (row.submitterName ?? "").toLowerCase().includes(q) ||
        (row.submitterEmail ?? "").toLowerCase().includes(q) ||
        (row.shareToken ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, ratingFilter, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Share Page Feedback
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Responses submitted by recipients of shared company pages · stored in MySQL <code className="text-xs bg-gray-100 px-1 rounded">share_feedback</code>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-gray-900", bg: "bg-gray-50 border-gray-200" },
          { label: "👍 Good fit", value: counts.up, color: "text-green-700", bg: "bg-green-50 border-green-200" },
          { label: "👎 Not a fit", value: counts.down, color: "text-red-700", bg: "bg-red-50 border-red-200" },
          { label: "🤔 Unsure", value: counts.neutral, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
          { label: "💬 With comment", value: counts.withComment, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
        ].map((t) => (
          <div key={t.label} className={`border rounded-xl p-4 ${t.bg}`}>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{t.label}</p>
            <p className={`text-3xl font-black mt-1 ${t.color}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, comment, submitter…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "thumbs_up", "thumbs_down", "neutral"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRatingFilter(r)}
              className={`text-xs font-black px-3 py-1.5 rounded-lg border transition-colors ${
                ratingFilter === r
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {r === "all" ? "All" : r === "thumbs_up" ? "👍 Good" : r === "thumbs_down" ? "👎 Not a fit" : "🤔 Unsure"}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 font-medium">{filtered.length} row{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading feedback…</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-bold">
          Failed to load feedback: {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && rows.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-bold text-sm">No feedback submitted yet.</p>
          <p className="text-xs mt-1">Feedback appears here when recipients rate a shared company page.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-black text-gray-500 uppercase tracking-widest px-4 py-3">Company</th>
                <th className="text-left text-xs font-black text-gray-500 uppercase tracking-widest px-4 py-3">Rating</th>
                <th className="text-left text-xs font-black text-gray-500 uppercase tracking-widest px-4 py-3">Comment</th>
                <th className="text-left text-xs font-black text-gray-500 uppercase tracking-widest px-4 py-3">Submitter</th>
                <th className="text-left text-xs font-black text-gray-500 uppercase tracking-widest px-4 py-3">Share List</th>
                <th className="text-left text-xs font-black text-gray-500 uppercase tracking-widest px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row: FRow) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {/* Company */}
                  <td className="px-4 py-3">
                    <p className="font-bold text-gray-900 text-xs leading-tight">
                      {row.companyName ?? <span className="text-gray-400 font-normal">Unknown</span>}
                    </p>
                    {row.companyId && (
                      <a
                        href={`/company/${row.companyId}`}
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        View company ↗
                      </a>
                    )}
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-3">
                    <RatingBadge rating={row.rating} />
                  </td>

                  {/* Comment */}
                  <td className="px-4 py-3 max-w-xs">
                    {row.comment ? (
                      <p className="text-xs text-gray-700 leading-snug line-clamp-3">{row.comment}</p>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  {/* Submitter */}
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {row.submitterName && (
                        <div className="flex items-center gap-1 text-xs text-gray-700">
                          <User className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="font-medium">{row.submitterName}</span>
                        </div>
                      )}
                      {row.submitterEmail && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                          <a href={`mailto:${row.submitterEmail}`} className="hover:underline text-blue-500">
                            {row.submitterEmail}
                          </a>
                        </div>
                      )}
                      {!row.submitterName && !row.submitterEmail && (
                        <span className="text-xs text-gray-300">Anonymous</span>
                      )}
                    </div>
                  </td>

                  {/* Share token (links to public list page) */}
                  <td className="px-4 py-3">
                    <a
                      href={`/share/${row.shareToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-500 hover:underline"
                    >
                      {row.shareToken.slice(0, 12)}…
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.submittedAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
