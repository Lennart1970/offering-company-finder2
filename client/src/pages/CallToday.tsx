import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  reached:        { label: "✅ Reached",        color: "bg-green-600 text-white" },
  voicemail:      { label: "📱 Voicemail",      color: "bg-yellow-500 text-white" },
  no_answer:      { label: "📵 No Answer",       color: "bg-gray-500 text-white" },
  meeting_booked: { label: "📅 Meeting Booked", color: "bg-blue-600 text-white" },
  not_interested: { label: "❌ Not Interested", color: "bg-red-600 text-white" },
};

export default function CallToday() {
  const [, navigate] = useLocation();

  // Cross-campaign: all companies marked Call Today for this user
  const { data, isLoading } = trpc.companyFinder.getCallToday.useQuery();

  const sorted = useMemo(() => {
    const companies = data?.companies ?? [];
    return [...companies].sort((a, b) => {
      const scoreA = a.company.urgencyScore ?? 0;
      const scoreB = b.company.urgencyScore ?? 0;
      return scoreB - scoreA;
    });
  }, [data?.companies]);

  function openCompany(companyId: number, index: number) {
    // Pass the ordered queue so Company Detail can show prev/next navigator
    const queue = sorted.map(c => c.company.id).join(",");
    navigate(`/company/${companyId}?from=call-today&queue=${queue}&qi=${index}`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black text-muted-foreground mb-1">[CALL TODAY]</div>
          <h1 className="text-4xl font-black">CALL TODAY</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading
              ? "Loading..."
              : `${sorted.length} ${sorted.length === 1 ? "company" : "companies"} across all campaigns · sorted by urgency`}
          </p>
        </div>
        <a
          href="https://voicedebt-rd2i5zsv.manus.space/debrief"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-2 border-2 border-black bg-amber-400 px-4 py-2 text-xs font-black hover:bg-amber-500 transition-colors shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          🎙️ VOICE DEBRIEF →
        </a>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground font-bold">Loading call queue...</div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-4">📞</div>
          <div className="text-xl font-black mb-2">No companies in your Call Today list</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Go to Search Results and mark companies as "Call Today" to build your queue.
          </p>
          <button
            onClick={() => navigate("/search-results")}
            className="mt-6 text-xs font-black border-2 border-black px-6 py-2 hover:bg-black hover:text-white transition-colors"
          >
            GO TO SEARCH RESULTS →
          </button>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((row, index) => {
            const c = row.company;
            const lastOutcome = (row as any).lastOutcome as string | undefined;
            const outcomeInfo = lastOutcome ? OUTCOME_LABELS[lastOutcome] : null;

            return (
              <button
                key={c.id}
                onClick={() => openCompany(c.id, index)}
                className="w-full text-left border-2 border-black p-4 hover:bg-gray-50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: index + company info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="text-[10px] font-black text-muted-foreground shrink-0 w-6 mt-1">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {c.urgencyScore != null && (
                          <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5">
                            ⚡ {c.urgencyScore}/100
                          </span>
                        )}
                        {c.briefData && (
                          <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5">RESEARCHED</span>
                        )}
                        {c.salesApproachData && (
                          <span className="text-[10px] font-black bg-green-600 text-white px-2 py-0.5">APPROACH READY</span>
                        )}
                        {outcomeInfo && (
                          <span className={`text-[10px] font-black px-2 py-0.5 ${outcomeInfo.color}`}>
                            {outcomeInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black leading-tight">{c.name}</div>
                      {c.websiteUrl && (
                        <div className="text-xs text-blue-700">{c.websiteUrl}</div>
                      )}
                      {c.callReadinessSummary && (
                        <div className="text-xs text-muted-foreground italic mt-1 line-clamp-1">
                          {c.callReadinessSummary}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: location + revenue + open arrow */}
                  <div className="text-right shrink-0">
                    {(c.city || c.country) && (
                      <div className="text-xs text-muted-foreground">
                        {[c.city, c.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {c.revenue && (
                      <div className="text-xs font-bold">{c.revenue}</div>
                    )}
                    <div className="text-xs font-black text-muted-foreground group-hover:text-black mt-1">
                      OPEN →
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
