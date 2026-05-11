import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

export default function SalesMenu() {
  const [, navigate] = useLocation();
  const { data: campaigns, isLoading } = trpc.companyFinder.getSalesMenuCampaigns.useQuery();

  const formatDate = (d: Date | string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return null; // no badge for completed
    const map: Record<string, string> = {
      searching: "bg-amber-100 text-amber-700 border border-amber-300",
      pending: "bg-gray-100 text-gray-500 border border-gray-300",
      failed: "bg-red-100 text-red-600 border border-red-300",
    };
    return (
      <span className={`text-[10px] font-black px-2 py-0.5 ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs font-black text-gray-400 tracking-widest mb-1">SALES INTELLIGENCE</div>
          <h1 className="text-4xl font-black text-gray-900 leading-none">SALES MENU</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            All your campaigns — click any row to open the company list.
          </p>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : !campaigns || campaigns.length === 0 ? (
          <div className="border-4 border-black p-12 text-center">
            <div className="text-2xl font-black mb-2">NO CAMPAIGNS YET</div>
            <div className="text-sm text-gray-500 font-medium">
              Start a new search from the Business Unit to create your first campaign.
            </div>
          </div>
        ) : (
          <div className="border border-gray-200">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_80px_80px] gap-4 px-5 py-2 bg-gray-900 text-white text-[10px] font-black tracking-widest">
              <div>CAMPAIGN</div>
              <div>BRAIN</div>
              <div>UPLOADED</div>
              <div className="text-right">COMPANIES</div>
              <div className="text-right">AVG FIT</div>
            </div>

            {/* Rows */}
            {campaigns.map((c, i) => (
              <div
                key={c.id}
                onClick={() => navigate(`/search-results/${c.id}?from=sales-menu`)}
                className="grid grid-cols-[2fr_1fr_1fr_80px_80px] gap-4 px-5 py-3.5 border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group items-center"
              >
                {/* Campaign name + location + status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-400 tabular-nums shrink-0">
                      [{String(i + 1).padStart(2, "0")}]
                    </span>
                    <span className="font-bold text-sm text-gray-900 truncate">
                      {c.offeringName}
                    </span>
                    {statusBadge(c.status)}
                  </div>
                  {c.location && (
                    <div className="text-[11px] text-gray-400 ml-8 truncate">{c.location}</div>
                  )}
                </div>

                {/* Brain */}
                <div className="min-w-0">
                  {c.brainName ? (
                    <span className="text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 truncate block max-w-full">
                      {c.brainName}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-300">—</span>
                  )}
                </div>

                {/* Upload date */}
                <div className="text-[11px] text-gray-500 font-medium">
                  {formatDate(c.createdAt)}
                </div>

                {/* Company count */}
                <div className="text-right">
                  <span className="text-sm font-black text-gray-900">
                    {c.companyCount > 0 ? c.companyCount : <span className="text-gray-300">—</span>}
                  </span>
                </div>

                {/* Avg fit */}
                <div className="text-right">
                  {c.avgFitScore != null ? (
                    <span className={`text-sm font-black ${
                      Number(c.avgFitScore) >= 80 ? "text-emerald-600" :
                      Number(c.avgFitScore) >= 60 ? "text-amber-600" :
                      "text-gray-500"
                    }`}>
                      {c.avgFitScore}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-sm">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary footer */}
        {campaigns && campaigns.length > 0 && (
          <div className="mt-4 text-xs text-gray-400 font-medium text-right">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} ·{" "}
            {campaigns.reduce((s, c) => s + (c.companyCount ?? 0), 0).toLocaleString()} companies total
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
