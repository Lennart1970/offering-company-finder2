import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function DeepResearchDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedSearchId, setSelectedSearchId] = useState<number | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"urgency" | "name" | "date">("urgency");

  // Fetch all search history
  const { data: searchHistory } = trpc.companyFinder.getSearchHistory.useQuery();

  // Fetch search data for selected search
  const { data: searchData, isLoading: searchLoading } = trpc.companyFinder.getSearch.useQuery(
    { searchId: selectedSearchId! },
    { enabled: !!selectedSearchId }
  );

  // Fetch call today companies (across all searches)
  const { data: callTodayData } = trpc.companyFinder.getCallToday.useQuery();

  // Filter to only deep-researched companies
  const deepResearchedCompanies = useMemo(() => {
    if (!searchData?.companies) return [];
    return searchData.companies.filter((c: any) => c.briefData);
  }, [searchData?.companies]);

  // Sort companies
  const sortedCompanies = useMemo(() => {
    const sorted = [...deepResearchedCompanies];
    switch (sortBy) {
      case "urgency":
        sorted.sort((a: any, b: any) => (b.urgencyScore || 0) - (a.urgencyScore || 0));
        break;
      case "name":
        sorted.sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      case "date":
        sorted.sort((a: any, b: any) => {
          const dateA = a.briefGeneratedAt ? new Date(a.briefGeneratedAt).getTime() : 0;
          const dateB = b.briefGeneratedAt ? new Date(b.briefGeneratedAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
    }
    return sorted;
  }, [deepResearchedCompanies, sortBy]);

  // Completed searches only
  const completedSearches = useMemo(() => {
    if (!searchHistory) return [];
    return searchHistory.filter((s: any) => s.status === "completed");
  }, [searchHistory]);

  // Stats
  const totalResearched = deepResearchedCompanies.length;
  const avgUrgency = totalResearched > 0
    ? Math.round(deepResearchedCompanies.reduce((sum: number, c: any) => sum + (c.urgencyScore || 0), 0) / totalResearched)
    : 0;
  const highUrgency = deepResearchedCompanies.filter((c: any) => (c.urgencyScore || 0) >= 60).length;
  const withSalesApproach = deepResearchedCompanies.filter((c: any) => c.salesApproachData).length;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="max-w-6xl">
      {/* Page Header */}
      <div className="mb-12">
        <div className="text-xs font-black text-muted-foreground mb-2">[04] COCKPIT</div>
        <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
          DEEP RESEARCH<br />DASHBOARD
        </h1>
        <p className="text-lg font-bold text-muted-foreground max-w-2xl">
          Aggregated view of all deep-researched companies. Select a search run to review intelligence, urgency scores, and sales readiness.
        </p>
      </div>

      {/* Search Selector */}
      <div className="mb-8">
        <div className="text-sm font-black mb-3">SELECT SEARCH RUN</div>
        <div className="flex flex-wrap gap-3">
          {completedSearches.map((search: any) => (
            <button
              key={search.id}
              onClick={() => setSelectedSearchId(search.id)}
              className={`border-4 px-5 py-3 text-sm font-black transition-colors cursor-pointer ${
                selectedSearchId === search.id
                  ? "border-black bg-black text-white"
                  : "border-black hover:bg-gray-100"
              }`}
            >
              <div>Run #{search.id}</div>
              <div className="text-xs font-bold opacity-70 mt-1">
                {new Date(search.createdAt).toLocaleDateString()} — {search.location}
              </div>
            </button>
          ))}
          {completedSearches.length === 0 && (
            <div className="border-4 border-black p-8 w-full text-center">
              <div className="text-xl font-black mb-2">NO COMPLETED SEARCHES</div>
              <div className="text-sm font-bold text-muted-foreground">Complete a search first to see deep research results here.</div>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {selectedSearchId && searchLoading && (
        <div className="border-4 border-black p-12 animate-pulse">
          <div className="text-2xl font-black">→ LOADING RESEARCH DATA...</div>
        </div>
      )}

      {/* Dashboard Content */}
      {selectedSearchId && searchData && (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="border-4 border-black p-4">
              <div className="text-3xl font-black">{totalResearched}</div>
              <div className="text-xs font-black text-muted-foreground">RESEARCHED</div>
            </div>
            <div className="border-4 border-black p-4">
              <div className="text-3xl font-black text-blue-600">{avgUrgency}</div>
              <div className="text-xs font-black text-muted-foreground">AVG URGENCY</div>
            </div>
            <div className="border-4 border-black p-4">
              <div className="text-3xl font-black text-red-600">{highUrgency}</div>
              <div className="text-xs font-black text-muted-foreground">HIGH URGENCY (60+)</div>
            </div>
            <div className="border-4 border-black p-4">
              <div className="text-3xl font-black text-green-600">{withSalesApproach}</div>
              <div className="text-xs font-black text-muted-foreground">SALES READY</div>
            </div>
          </div>

          {/* Sort Controls */}
          {totalResearched > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-black">SORT BY:</span>
              {(["urgency", "name", "date"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`text-sm px-4 py-2 font-black border-2 border-black cursor-pointer transition-colors ${
                    sortBy === option ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* No researched companies */}
          {totalResearched === 0 && (
            <div className="border-4 border-black p-12 text-center">
              <div className="text-2xl font-black mb-4">NO DEEP RESEARCH YET</div>
              <div className="text-lg font-bold text-muted-foreground mb-6">
                This search has {searchData.companies.length} companies but none have been deep-researched.
              </div>
              <Button
                onClick={() => navigate(`/search-results/${selectedSearchId}`)}
                className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white"
              >
                [GO TO RESULTS → RUN DEEP RESEARCH]
              </Button>
            </div>
          )}

          {/* Company Cards */}
          <div className="space-y-4">
            {sortedCompanies.map((company: any) => {
              const briefData = company.briefData ? JSON.parse(company.briefData) : null;
              const salesApproach = company.salesApproachData ? JSON.parse(company.salesApproachData) : null;
              const isExpanded = expandedCompanyId === company.id;
              const decision = searchData?.decisions?.find((d: any) => d.companyId === company.id);
              const urgencyScore = company.urgencyScore || briefData?.urgencyScore || 0;

              return (
                <div key={company.id} className="border-4 border-black bg-white">
                  {/* Company Header - Always visible */}
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedCompanyId(isExpanded ? null : company.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {/* Urgency Badge */}
                          <span className={`text-sm font-black border-2 px-3 py-1 ${
                            urgencyScore >= 60 ? "border-red-600 bg-red-600 text-white" :
                            urgencyScore >= 40 ? "border-yellow-500 bg-yellow-500 text-black" :
                            "border-gray-400 bg-gray-100 text-gray-700"
                          }`}>
                            URGENCY: {urgencyScore}
                          </span>

                          {/* Decision Badge */}
                          {decision && (
                            <span className={`text-xs font-black border-2 px-3 py-1 ${
                              decision.decision === "call_today" ? "bg-green-600 text-white border-green-600" :
                              decision.decision === "park" ? "bg-yellow-500 text-black border-yellow-500" :
                              "bg-red-600 text-white border-red-600"
                            }`}>
                              {decision.decision === "call_today" ? "CALL TODAY" :
                               decision.decision === "park" ? "PARKED" : "NOT RELEVANT"}
                            </span>
                          )}

                          {/* Sales Ready Badge */}
                          {salesApproach && (
                            <span className="text-xs font-black border-2 border-green-600 text-green-600 px-2 py-0.5">SALES READY</span>
                          )}
                        </div>

                        <h3 className="text-2xl font-black">{company.name}</h3>
                        <div className="text-sm font-bold text-muted-foreground mt-1">
                          {[company.city, company.state, company.country].filter(Boolean).join(", ")}
                          {company.websiteUrl && (
                            <span className="ml-3">
                              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>
                                {company.websiteUrl}
                              </a>
                            </span>
                          )}
                        </div>

                        {/* Quick Summary */}
                        {briefData?.conversationStarters?.[0] && (
                          <div className="text-sm font-bold text-blue-600 mt-2 italic">
                            "{typeof briefData.conversationStarters[0] === 'string' ? briefData.conversationStarters[0] : briefData.conversationStarters[0].opener}"
                          </div>
                        )}
                      </div>

                      <span className="text-2xl font-black ml-4">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && briefData && (
                    <div className="border-t-4 border-black p-6">
                      {/* Urgency Breakdown */}
                      {briefData.urgencyBreakdown && (
                        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-600">
                          <div className="text-xl font-black text-blue-600 mb-3">Urgency Score: {urgencyScore}/100</div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="font-bold">Company Context</div>
                              <div className="text-lg font-black">{briefData.urgencyBreakdown.companyContext}/40</div>
                            </div>
                            <div>
                              <div className="font-bold">Market Signals</div>
                              <div className="text-lg font-black">{briefData.urgencyBreakdown.marketSignals}/35</div>
                            </div>
                            <div>
                              <div className="font-bold">Recent Activity</div>
                              <div className="text-lg font-black">{briefData.urgencyBreakdown.recentActivity}/25</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recent Developments */}
                      {briefData.recentDevelopments?.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-black mb-2">Recent Developments</h4>
                          <ul className="list-disc pl-5 space-y-2">
                            {briefData.recentDevelopments.map((dev: any, i: number) => (
                              <li key={i}>
                                <div className="text-sm">{typeof dev === 'string' ? dev : dev.text}</div>
                                {typeof dev !== 'string' && dev.date && <div className="text-xs text-gray-500">{dev.date}</div>}
                                {typeof dev !== 'string' && dev.snippet && <div className="text-xs text-gray-600 italic border-l-2 border-gray-300 pl-2 mt-1">"{dev.snippet}"</div>}
                                {typeof dev !== 'string' && dev.sourceUrl && <a href={dev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline inline-block mt-1">Source</a>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Urgency Signals */}
                      {briefData.urgencySignals?.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-black mb-2">Urgency Signals</h4>
                          <div className="space-y-2">
                            {briefData.urgencySignals.map((signal: any, i: number) => (
                              <div key={i} className="p-3 bg-yellow-50 border border-yellow-300">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-bold text-sm">{signal.category} — {signal.type}</span>
                                    <div className="text-sm mt-1">{signal.description}</div>
                                    {signal.snippet && <div className="text-xs text-gray-600 italic border-l-2 border-yellow-400 pl-2 mt-1">"{signal.snippet}"</div>}
                                    {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline inline-block mt-1">Source</a>}
                                  </div>
                                  <span className="text-sm font-black text-yellow-700 ml-4">+{signal.weight}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Engagement Strategy */}
                      {briefData.engagementStrategy && (
                        <div className="mb-6">
                          <h4 className="text-lg font-black mb-2">Engagement Strategy</h4>
                          {briefData.engagementStrategy.whyThisProspectMatters?.length > 0 && (
                            <div className="mb-3">
                              <div className="font-bold text-sm mb-1">Why This Prospect Matters:</div>
                              <ul className="list-disc pl-5 text-sm space-y-1">
                                {briefData.engagementStrategy.whyThisProspectMatters.map((r: string, i: number) => <li key={i}>{r}</li>)}
                              </ul>
                            </div>
                          )}
                          {briefData.engagementStrategy.keyTalkingPoints?.length > 0 && (
                            <div className="mb-3">
                              <div className="font-bold text-sm mb-1">Key Talking Points:</div>
                              <ul className="list-disc pl-5 text-sm space-y-1">
                                {briefData.engagementStrategy.keyTalkingPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Verified Sources */}
                      {briefData.sources?.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-black mb-2">Verified Sources ({briefData.sources.length})</h4>
                          <div className="space-y-1">
                            {briefData.sources.map((source: any, i: number) => (
                              <div key={i} className="text-sm">
                                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">{source.title || source.url}</a>
                                {source.snippet && <span className="text-xs text-gray-500 ml-2">{source.snippet}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sales Approach Summary */}
                      {salesApproach && (
                        <div className="border-t-2 border-black pt-4 mt-4">
                          <h4 className="text-lg font-black text-green-600 mb-3">SALES APPROACH</h4>

                          {/* Conversation Starters */}
                          {salesApproach.conversationStarters?.length > 0 && (
                            <div className="mb-4">
                              <div className="font-bold text-sm mb-1">Conversation Starters:</div>
                              <div className="space-y-2">
                                {salesApproach.conversationStarters.map((starter: any, i: number) => (
                                  <div key={i} className="text-sm p-2 bg-amber-50 border border-amber-200">
                                    {typeof starter === 'string' ? starter : starter.opener}
                                    {typeof starter !== 'string' && starter.sourceUrl && (
                                      <a href={starter.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline ml-2">Source</a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Email Draft */}
                          {salesApproach.emailDraft && (
                            <div className="mb-4 p-4 border-2 border-green-600">
                              <div className="flex justify-between items-center mb-2">
                                <div className="font-black text-green-600">Email Draft</div>
                                <Button
                                  onClick={() => copyToClipboard(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                                  variant="outline"
                                  size="sm"
                                  className="font-black text-xs"
                                >
                                  COPY
                                </Button>
                              </div>
                              <div className="text-sm mb-1"><span className="font-bold">Subject:</span> {salesApproach.emailDraft.subject}</div>
                              <div className="text-sm whitespace-pre-wrap">{salesApproach.emailDraft.body}</div>
                            </div>
                          )}

                          {/* LinkedIn */}
                          {salesApproach.linkedinMessage && (
                            <div className="mb-4 p-4 border-2 border-blue-600">
                              <div className="flex justify-between items-center mb-2">
                                <div className="font-black text-blue-600">LinkedIn</div>
                                <Button
                                  onClick={() => copyToClipboard(salesApproach.linkedinMessage.connectionRequest, "Connection Request")}
                                  variant="outline"
                                  size="sm"
                                  className="font-black text-xs"
                                >
                                  COPY
                                </Button>
                              </div>
                              <div className="text-sm bg-blue-50 p-2 mb-2">{salesApproach.linkedinMessage.connectionRequest}</div>
                              <div className="text-xs font-bold text-muted-foreground">Follow-up:</div>
                              <div className="text-sm bg-blue-50 p-2">{salesApproach.linkedinMessage.followUp}</div>
                            </div>
                          )}

                          {/* Call Script */}
                          {salesApproach.callScript && (
                            <div className="p-4 border-2 border-purple-600">
                              <div className="flex justify-between items-center mb-2">
                                <div className="font-black text-purple-600">Call Script</div>
                                <Button
                                  onClick={() => copyToClipboard(
                                    `OPENING:\n${salesApproach.callScript.opening}\n\nDISCOVERY QUESTIONS:\n${salesApproach.callScript.discoveryQuestions?.join("\n") || ""}\n\nVALUE PROPOSITION:\n${salesApproach.callScript.valueProposition}\n\nCALL TO ACTION:\n${salesApproach.callScript.callToAction}`,
                                    "Call Script"
                                  )}
                                  variant="outline"
                                  size="sm"
                                  className="font-black text-xs"
                                >
                                  COPY
                                </Button>
                              </div>
                              <div className="text-sm mb-2"><span className="font-bold">Opening:</span> {salesApproach.callScript.opening}</div>
                              {salesApproach.callScript.discoveryQuestions?.length > 0 && (
                                <div className="mb-2">
                                  <span className="font-bold text-sm">Discovery Questions:</span>
                                  <ul className="list-disc pl-5 text-sm">
                                    {salesApproach.callScript.discoveryQuestions.map((q: string, i: number) => <li key={i}>{q}</li>)}
                                  </ul>
                                </div>
                              )}
                              <div className="text-sm mb-2"><span className="font-bold">Value Proposition:</span> {salesApproach.callScript.valueProposition}</div>
                              <div className="text-sm"><span className="font-bold">Call to Action:</span> {salesApproach.callScript.callToAction}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 mt-6">
                        <Button
                          onClick={() => navigate(`/search-results/${selectedSearchId}#company-${company.id}`)}
                          variant="outline"
                          className="font-black border-2 border-black"
                        >
                          VIEW IN RESULTS →
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
