import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  reached:        { label: "✅ Reached",        color: "bg-green-600 text-white" },
  voicemail:      { label: "📱 Voicemail",      color: "bg-yellow-500 text-white" },
  no_answer:      { label: "📵 No Answer",       color: "bg-gray-500 text-white" },
  meeting_booked: { label: "📅 Meeting Booked", color: "bg-blue-600 text-white" },
  not_interested: { label: "❌ Not Interested", color: "bg-red-600 text-white" },
};

const NEXT_ACTION: Record<string, string> = {
  reached:        "Send a personalised follow-up email summarising your conversation.",
  voicemail:      "Send a LinkedIn message referencing your voicemail — today.",
  no_answer:      "Try again at a different time, then send an email.",
  meeting_booked: "Prepare a tailored demo using the Research and Approach chapters.",
  not_interested: "Park this company and revisit in 90 days with a new angle.",
};

export default function NurtureList() {
  const [, navigate] = useLocation();
  const { data, isLoading, refetch } = trpc.companyFinder.getNurtureList.useQuery();

  const today = new Date().toISOString().slice(0, 10);

  const { overdue, dueToday, upcoming } = useMemo(() => {
    const items = data?.items ?? [];
    return {
      overdue:  items.filter(i => i.isOverdue),
      dueToday: items.filter(i => i.isDueToday),
      upcoming: items.filter(i => !i.isOverdue && !i.isDueToday),
    };
  }, [data]);

  const totalCount = (data?.items ?? []).length;
  const urgentCount = (data?.items ?? []).filter(i => i.isOverdue || i.isDueToday).length;

  function formatDate(d: string | null | undefined) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function NurtureCard({ item }: { item: NonNullable<typeof data>["items"][number] }) {
    const outcomeInfo = OUTCOME_LABELS[item.outcome] ?? { label: item.outcome, color: "bg-gray-400 text-white" };
    const nextAction = NEXT_ACTION[item.outcome];
    const isUrgent = item.isOverdue || item.isDueToday;

    return (
      <div
        className={`border-2 p-4 cursor-pointer hover:shadow-md transition-shadow ${
          item.isOverdue ? "border-red-600 bg-red-50" :
          item.isDueToday ? "border-orange-500 bg-orange-50" :
          "border-black bg-white"
        }`}
        onClick={() => navigate(`/company/${item.companyId}?from=nurture`)}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {item.isOverdue && (
                <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5">🔴 OVERDUE</span>
              )}
              {item.isDueToday && (
                <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5">🟠 DUE TODAY</span>
              )}
              <span className={`text-[10px] font-black px-2 py-0.5 ${outcomeInfo.color}`}>
                {outcomeInfo.label}
              </span>
            </div>
            <h3 className="text-xl font-black mt-1 leading-tight">{item.companyName}</h3>
            {item.companyWebsite && (
              <a
                href={`https://${item.companyWebsite}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-700 hover:underline"
                onClick={e => e.stopPropagation()}
              >
                {item.companyWebsite}
              </a>
            )}
            {(item.companyCity || item.companyCountry) && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {[item.companyCity, item.companyCountry].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-black text-muted-foreground">FOLLOW-UP</div>
            <div className={`text-sm font-black ${isUrgent ? "text-red-600" : "text-black"}`}>
              {formatDate(item.followUpDate)}
            </div>
            {item.urgencyScore != null && (
              <div className="text-[10px] font-black text-red-600 mt-1">⚡ {item.urgencyScore}/100</div>
            )}
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="text-xs text-muted-foreground italic border-l-2 border-gray-300 pl-2 mb-2 line-clamp-2">
            "{item.notes}"
          </div>
        )}

        {/* Next action */}
        {nextAction && (
          <div className={`text-xs font-bold p-2 border ${
            isUrgent ? "border-red-300 bg-red-100 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"
          }`}>
            → {nextAction}
          </div>
        )}

        {/* Open link */}
        <div className="mt-2 text-right">
          <span className="text-[10px] font-black text-muted-foreground hover:text-black">
            VIEW COMPANY →
          </span>
        </div>
      </div>
    );
  }

  function Section({ title, items, accent }: { title: string; items: typeof data extends undefined ? never[] : NonNullable<typeof data>["items"]; accent: string }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <div className={`text-[10px] font-black mb-3 ${accent}`}>{title} ({items.length})</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(item => <NurtureCard key={item.outcomeId} item={item} />)}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10px] font-black text-muted-foreground mb-1">[NURTURE]</div>
            <h1 className="text-4xl font-black">NURTURE LIST</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount} companies with scheduled follow-ups
              {urgentCount > 0 && (
                <span className="ml-2 font-black text-red-600">· {urgentCount} need attention today</span>
              )}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
          >
            ↻ REFRESH
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-muted-foreground font-bold">Loading nurture list...</div>
        )}

        {!isLoading && totalCount === 0 && (
          <div className="border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <div className="text-xl font-black mb-2">No follow-ups scheduled yet</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When you log a call outcome with a follow-up date on a company page, it will appear here sorted by date.
            </p>
            <button
              onClick={() => navigate("/search-results")}
              className="mt-6 text-xs font-black border-2 border-black px-6 py-2 hover:bg-black hover:text-white transition-colors"
            >
              GO TO SEARCH RESULTS →
            </button>
          </div>
        )}

        {!isLoading && totalCount > 0 && (
          <>
            <Section title="🔴 OVERDUE" items={overdue} accent="text-red-600" />
            <Section title="🟠 DUE TODAY" items={dueToday} accent="text-orange-600" />
            <Section title="📅 UPCOMING" items={upcoming} accent="text-blue-600" />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
