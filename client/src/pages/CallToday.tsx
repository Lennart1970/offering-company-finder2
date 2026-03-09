import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";
import { Button } from "@/components/ui/button";

function formatRevenue(revenue: number | string | null): string {
  if (!revenue) return "—";
  const num = typeof revenue === "string" ? parseFloat(revenue) : revenue;
  if (isNaN(num)) return String(revenue);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

export default function CallToday() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ searchId: string }>();
  const searchId = parseInt(params.searchId, 10);

  const { data: searchData, isLoading } = trpc.companyFinder.getSearch.useQuery(
    { searchId },
    { enabled: !!searchId && !isNaN(searchId) }
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"overview" | "research" | "approach">("overview");

  const callTodayCompanies = useMemo(() => {
    if (!searchData?.companies || !searchData?.decisions) return [];
    const callTodayIds = new Set(
      searchData.decisions
        .filter((d: any) => d.decision === "call_today")
        .map((d: any) => d.companyId)
    );
    return searchData.companies.filter((c: any) => callTodayIds.has(c.id));
  }, [searchData?.companies, searchData?.decisions]);

  const company = callTodayCompanies[currentIndex] ?? null;

  const briefData = useMemo(() => {
    if (!company?.briefData) return null;
    try {
      return typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData;
    } catch { return null; }
  }, [company?.briefData]);

  const salesApproach = useMemo(() => {
    if (!company?.salesApproachData) return null;
    try {
      return typeof company.salesApproachData === "string" ? JSON.parse(company.salesApproachData) : company.salesApproachData;
    } catch { return null; }
  }, [company?.salesApproachData]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const location = company && company.enrichmentStatus === "enriched" && (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : company?.searchLocation || "—";

  if (!user) return null;

  if (isLoading) return (
    <div className="max-w-5xl">
      <div className="text-2xl font-black animate-pulse">Loading call queue...</div>
    </div>
  );

  if (!searchData || callTodayCompanies.length === 0) return (
    <div className="max-w-5xl">
      <div className="text-xs font-black text-muted-foreground mb-2">[04] CALL TODAY</div>
      <div className="text-3xl font-black mb-6">CALL TODAY</div>
      <div className="border-4 border-black p-12 text-center">
        <div className="text-2xl font-black mb-3">No companies in your Call Today list</div>
        <div className="text-base font-bold text-muted-foreground mb-6">Go back to Search Results and flag high-urgency companies.</div>
        <button
          onClick={() => navigate(`/search-results/${searchId}`)}
          className="font-black border-2 border-black px-6 py-3 hover:bg-black hover:text-white transition-colors cursor-pointer"
        >
          ← BACK TO SEARCH RESULTS
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      {/* Page Header */}
      <div className="mb-6">
        <div className="text-xs font-black text-muted-foreground mb-1">[04] CALL TODAY</div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-black leading-tight">CALL TODAY</h1>
            <div className="text-sm font-bold text-muted-foreground mt-1">
              {(searchData.search as any).offeringName || (searchData.search as any).location || "Campaign"} · {callTodayCompanies.length} {callTodayCompanies.length === 1 ? "company" : "companies"} to call
            </div>
          </div>
          <button
            onClick={() => navigate(`/search-results/${searchId}`)}
            className="text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            ← BACK TO RESULTS
          </button>
        </div>
      </div>

      {/* Queue Navigator */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {callTodayCompanies.map((c: any, i: number) => (
          <button
            key={c.id}
            onClick={() => { setCurrentIndex(i); setViewMode("overview"); }}
            className={`shrink-0 text-xs font-black px-3 py-1.5 border-2 cursor-pointer transition-colors ${
              i === currentIndex
                ? "bg-black text-white border-black"
                : "border-gray-300 hover:border-black"
            }`}
          >
            {String(i + 1).padStart(2, "0")} {c.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Main Company Panel */}
      {company && (
        <div className="border-4 border-black bg-white">
          {/* Company Header */}
          <div className="p-5 border-b-4 border-black">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-black text-muted-foreground">[{String(currentIndex + 1).padStart(2, "0")} / {callTodayCompanies.length}]</span>
                  {company.enrichmentStatus === "enriched" && (
                    <span className="text-[10px] font-black border border-black px-1.5 py-0.5 bg-black text-white">ENRICHED</span>
                  )}
                  {company.briefData && (
                    <span className="text-[10px] font-black border border-blue-600 text-blue-600 px-1.5 py-0.5">RESEARCHED</span>
                  )}
                  {(company.urgencyScore ?? 0) > 0 && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 ${
                      (company.urgencyScore ?? 0) >= 70 ? "bg-red-600 text-white" :
                      (company.urgencyScore ?? 0) >= 50 ? "bg-yellow-500 text-white" :
                      "bg-gray-200 text-gray-700"
                    }`}>
                      ⚡ {company.urgencyScore}
                    </span>
                  )}
                  {company.salesApproachData && (
                    <span className="text-[10px] font-black border border-green-600 text-green-600 px-1.5 py-0.5">SALES READY</span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black leading-tight">{company.name}</h2>
                {company.websiteUrl && (
                  <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground underline mt-0.5 inline-block">
                    {company.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              {/* Prev / Next */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setViewMode("overview"); }}
                  disabled={currentIndex === 0}
                  className="text-xs font-black border-2 border-black px-3 py-2 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default"
                >
                  ← PREV
                </button>
                <button
                  onClick={() => { setCurrentIndex(Math.min(callTodayCompanies.length - 1, currentIndex + 1)); setViewMode("overview"); }}
                  disabled={currentIndex === callTodayCompanies.length - 1}
                  className="text-xs font-black border-2 border-black px-3 py-2 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default"
                >
                  NEXT →
                </button>
              </div>
            </div>

            {/* Company Data Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-4 text-sm">
              <div>
                <div className="text-[10px] font-black text-muted-foreground">LOCATION</div>
                <div className="font-bold">{location}</div>
              </div>
              {company.revenue && (
                <div>
                  <div className="text-[10px] font-black text-muted-foreground">REVENUE</div>
                  <div className="font-bold">{formatRevenue(company.revenue)}</div>
                </div>
              )}
              {company.headcountGrowth && (
                <div>
                  <div className="text-[10px] font-black text-muted-foreground">HEADCOUNT GROWTH</div>
                  <div className="font-bold">{company.headcountGrowth}</div>
                </div>
              )}
              {company.linkedinUrl && (
                <div className="col-span-2">
                  <div className="text-[10px] font-black text-muted-foreground">LINKEDIN</div>
                  <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline truncate block">
                    {company.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </div>
              )}
            </div>
            <div className="mt-3">
              <CompanyCodeDisplay sicCodes={company.sicCodes} naicsCodes={company.naicsCodes} />
            </div>
          </div>

          {/* Research / Approach Quick-Access Cards — navigate to Company Detail chapter pages */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b-4 border-black">
            {company.briefData ? (
              <button
                onClick={() => navigate(`/company/${company.id}?chapter=research&from=call-today/${searchId}`)}
                className="p-4 text-left cursor-pointer transition-colors border-r-2 border-black bg-blue-50 hover:bg-blue-100"
              >
                <div className="text-[10px] font-black mb-0.5 text-blue-600">DEEP RESEARCH</div>
                <div className="text-base font-black text-blue-800">→ View Research Brief</div>
                {briefData?.urgencyScore > 0 && (
                  <div className="text-xs font-bold mt-1 text-blue-600">Urgency: {briefData.urgencyScore}/100</div>
                )}
                {briefData && (() => {
                  const sections = [
                    briefData.recentDevelopments?.length > 0 && 'Recent Developments',
                    briefData.productsAndServices?.length > 0 && 'Products & Services',
                    briefData.keyTechnologies?.length > 0 && 'Key Technologies',
                    briefData.targetMarkets?.length > 0 && 'Target Markets',
                    briefData.sources?.length > 0 && `Sources (${briefData.sources.length})`,
                  ].filter(Boolean) as string[];
                  return sections.length > 0 ? (
                    <ul className="mt-2 space-y-0.5">
                      {sections.map((s) => (
                        <li key={s} className="text-[10px] font-bold text-blue-700 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })()}
              </button>
            ) : (
              <div className="p-4 bg-gray-50 border-r-2 border-black opacity-40">
                <div className="text-[10px] font-black text-muted-foreground mb-0.5">DEEP RESEARCH</div>
                <div className="text-base font-black text-gray-400">No research yet</div>
              </div>
            )}
            {company.salesApproachData ? (
              <button
                onClick={() => navigate(`/company/${company.id}?chapter=approach&from=call-today/${searchId}`)}
                className="p-4 text-left cursor-pointer transition-colors bg-green-50 hover:bg-green-100"
              >
                <div className="text-[10px] font-black mb-0.5 text-green-600">SALES APPROACH</div>
                <div className="text-base font-black text-green-800">→ View Approach</div>
                {salesApproach && (() => {
                  const sections = [
                    salesApproach.conversationStarters?.length > 0 && `Conversation Starters (${salesApproach.conversationStarters.length})`,
                    salesApproach.emailDraft && 'Email Draft',
                    salesApproach.linkedinMessage && 'LinkedIn Message',
                    salesApproach.callScript && 'Call Script',
                  ].filter(Boolean) as string[];
                  return sections.length > 0 ? (
                    <ul className="mt-2 space-y-0.5">
                      {sections.map((s) => (
                        <li key={s} className="text-[10px] font-bold text-green-700 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })()}
              </button>
            ) : (
              <div className="p-4 bg-gray-50 opacity-40">
                <div className="text-[10px] font-black text-muted-foreground mb-0.5">SALES APPROACH</div>
                <div className="text-base font-black text-gray-400">No approach yet</div>
              </div>
            )}
          </div>

          {/* Expanded Research Panel */}
          {viewMode === "research" && briefData && (
            <div className="p-5 border-b-4 border-black bg-blue-50">
              <div className="mb-5 p-4 bg-white border-2 border-blue-600">
                <div className="text-3xl font-black text-blue-600 mb-2">Urgency Score: {briefData.urgencyScore}/100</div>
                {briefData.urgencyBreakdown && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><div className="font-bold">Company Context</div><div>{briefData.urgencyBreakdown.companyContext}/40</div></div>
                    <div><div className="font-bold">Market Signals</div><div>{briefData.urgencyBreakdown.marketSignals}/35</div></div>
                    <div><div className="font-bold">Recent Activity</div><div>{briefData.urgencyBreakdown.recentActivity}/25</div></div>
                  </div>
                )}
              </div>
              {briefData.companyOverview && (
                <div className="mb-4">
                  <h3 className="text-base font-black mb-1">Company Overview</h3>
                  <p className="text-sm">{briefData.companyOverview}</p>
                </div>
              )}
              {briefData.whyNow && (
                <div className="mb-4">
                  <h3 className="text-base font-black mb-1">Why Now</h3>
                  <p className="text-sm">{briefData.whyNow}</p>
                </div>
              )}
              {briefData.engagementStrategy && (
                <div className="mb-4">
                  <h3 className="text-base font-black mb-1">Engagement Strategy</h3>
                  <p className="text-sm">{briefData.engagementStrategy}</p>
                </div>
              )}
              {briefData.urgencySignals?.length > 0 && (
                <div>
                  <h3 className="text-base font-black mb-2">Urgency Signals</h3>
                  <div className="space-y-2">
                    {briefData.urgencySignals.map((s: any, i: number) => (
                      <div key={i} className="p-3 bg-yellow-50 border border-yellow-300">
                        <span className="font-bold text-sm">{s.category} — {s.type}</span>
                        <div className="text-sm mt-1">{s.description}</div>
                        {s.snippet && <div className="text-xs text-gray-600 italic mt-1 border-l-2 border-yellow-400 pl-2">"{s.snippet}"</div>}
                        {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Source</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expanded Approach Panel */}
          {viewMode === "approach" && salesApproach && (
            <div className="p-5 border-b-4 border-black bg-green-50">
              {salesApproach.conversationStarters?.length > 0 && (
                <div className="mb-5 p-4 border-2 border-amber-600 bg-white">
                  <h3 className="text-base font-black text-amber-600 mb-2">Conversation Starters</h3>
                  <div className="space-y-2">
                    {salesApproach.conversationStarters.map((s: any, i: number) => (
                      <div key={i} className="p-2 bg-amber-50">
                        <div className="text-sm font-medium">{typeof s === "string" ? s : s.opener}</div>
                        {typeof s !== "string" && s.basedOn && <div className="text-xs text-gray-500 mt-1">Based on: {s.basedOn}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {salesApproach.emailDraft && (
                <div className="mb-5 p-4 border-2 border-green-600 bg-white">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-black text-green-600">Email Draft</h3>
                    <button
                      onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                      className="text-xs font-black border-2 border-green-600 text-green-600 px-3 py-1 cursor-pointer hover:bg-green-50"
                    >
                      COPY EMAIL
                    </button>
                  </div>
                  <div className="mb-2 text-sm"><span className="font-bold">Subject:</span> {salesApproach.emailDraft.subject}</div>
                  <div className="whitespace-pre-wrap text-sm">{salesApproach.emailDraft.body}</div>
                </div>
              )}
              {salesApproach.linkedinMessage && (
                <div className="mb-5 p-4 border-2 border-blue-600 bg-white">
                  <h3 className="text-base font-black text-blue-600 mb-3">LinkedIn Message</h3>
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">Connection Request:</span>
                      <button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer">COPY</button>
                    </div>
                    <div className="text-sm bg-blue-50 p-2">{salesApproach.linkedinMessage.connectionRequest}</div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">Follow-up:</span>
                      <button onClick={() => copyText(salesApproach.linkedinMessage.followUp, "Follow-up")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer">COPY</button>
                    </div>
                    <div className="text-sm bg-blue-50 p-2">{salesApproach.linkedinMessage.followUp}</div>
                  </div>
                </div>
              )}
              {salesApproach.callScript && (
                <div className="p-4 border-2 border-purple-600 bg-white">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-black text-purple-600">Call Script</h3>
                    <button
                      onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening || "", "Call Script")}
                      className="text-xs font-black border-2 border-purple-600 text-purple-600 px-3 py-1 cursor-pointer hover:bg-purple-50"
                    >
                      COPY SCRIPT
                    </button>
                  </div>
                  {salesApproach.callScript.opening && (
                    <div className="mb-3">
                      <div className="font-bold text-sm mb-1">Opening:</div>
                      <div className="text-sm bg-purple-50 p-2">{salesApproach.callScript.opening}</div>
                    </div>
                  )}
                  {salesApproach.callScript.fullScript && (
                    <div className="whitespace-pre-wrap text-sm">{salesApproach.callScript.fullScript}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer: Action Buttons + Queue Progress */}
          <div className="px-5 py-4 bg-gray-50 border-t-4 border-black">
            {/* Prominent action buttons row */}
            <div className="flex flex-wrap gap-3 mb-4">
              <CallTodayFindDecisionMakersButton companyId={company.id} companyName={company.name} />
              <CallTodayGetAllPersonnelButton companyId={company.id} companyName={company.name} />
            </div>
            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-black text-muted-foreground">
                {currentIndex + 1} of {callTodayCompanies.length} companies
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setViewMode("overview"); }}
                  disabled={currentIndex === 0}
                  className="text-xs font-black border-2 border-black px-4 py-2 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default"
                >
                  ← PREV
                </button>
                <button
                  onClick={() => { setCurrentIndex(Math.min(callTodayCompanies.length - 1, currentIndex + 1)); setViewMode("overview"); }}
                  disabled={currentIndex === callTodayCompanies.length - 1}
                  className="text-xs font-black border-2 border-black px-4 py-2 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default"
                >
                  NEXT COMPANY →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Prominent FIND DECISION-MAKERS button for Call Today page
// ============================================================================
function CallTodayFindDecisionMakersButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<any>(null);

  const { data: existingContacts } = trpc.companyFinder.getCompanyContacts.useQuery({ companyId });

  const findCSuiteMutation = trpc.companyFinder.findAllCSuite.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setShowModal(true);
      if (data.cached) {
        toast.success(`${data.contacts.length} cached decision-makers at ${companyName}`);
      } else if (data.contacts.length > 0) {
        toast.success(`Found ${data.contacts.length} decision-makers at ${companyName}`);
      } else {
        toast.error(`No decision-makers found at ${companyName}`);
      }
    },
    onError: (error) => {
      toast.error(`Decision-maker search failed: ${error.message}`);
    },
  });

  const contactCount = existingContacts?.contacts?.length || 0;

  const handleClick = () => {
    if (contactCount > 0) {
      setResults({ contacts: existingContacts?.contacts, tierFound: 0, tierLabel: "Cached", tiersSearched: [], cached: true });
      setShowModal(true);
    } else {
      findCSuiteMutation.mutate({ companyId });
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={findCSuiteMutation.isPending}
        className={`font-black border-4 px-6 py-3 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default ${
          contactCount > 0
            ? "border-purple-600 bg-purple-600 text-white hover:bg-purple-700"
            : "border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
        }`}
      >
        {findCSuiteMutation.isPending
          ? "SEARCHING..."
          : contactCount > 0
            ? `👤 ${contactCount} CONTACTS FOUND`
            : "👤 FIND DECISION-MAKERS"}
      </button>
      {showModal && results && (
        <CallTodayContactsModal
          companyName={companyName}
          companyId={companyId}
          results={results}
          isPending={findCSuiteMutation.isPending}
          onRefresh={() => findCSuiteMutation.mutate({ companyId })}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// Prominent GET ALL PERSONNEL button for Call Today page
// ============================================================================
function CallTodayGetAllPersonnelButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fetchLimit, setFetchLimit] = useState(25);

  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => {
      setResults({ contacts: data.contacts, totalFound: data.totalFound });
      setShowModal(true);
      toast.success(`Found ${data.contacts.length} personnel at ${companyName}`);
    },
    onError: (error) => {
      toast.error(`Personnel search failed: ${error.message}`);
    },
  });

  return (
    <>
      <button
        onClick={() => getAllPersonnelMutation.mutate({ companyId, limit: fetchLimit })}
        disabled={getAllPersonnelMutation.isPending}
        className="font-black border-4 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-6 py-3 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
      >
        {getAllPersonnelMutation.isPending ? "FETCHING..." : "🏢 GET ALL PERSONNEL"}
      </button>
      {showModal && results && (
        <CallTodayContactsModal
          companyName={companyName}
          companyId={companyId}
          results={results}
          isPending={getAllPersonnelMutation.isPending}
          onRefresh={() => getAllPersonnelMutation.mutate({ companyId, limit: fetchLimit })}
          onClose={() => setShowModal(false)}
          fetchLimit={fetchLimit}
          onFetchLimitChange={setFetchLimit}
        />
      )}
    </>
  );
}

// ============================================================================
// Contacts Modal for Call Today page (inline, self-contained)
// ============================================================================
function CallTodayContactsModal({
  companyName,
  companyId,
  results,
  isPending,
  onRefresh,
  onClose,
  fetchLimit,
  onFetchLimitChange,
}: {
  companyName: string;
  companyId: number;
  results: any;
  isPending: boolean;
  onRefresh: () => void;
  onClose: () => void;
  fetchLimit?: number;
  onFetchLimitChange?: (limit: number) => void;
}) {
  const enrichContactMutation = trpc.companyFinder.enrichContact.useMutation({
    onSuccess: () => {
      toast.success("Contact enriched!");
      onRefresh();
    },
    onError: (error) => {
      toast.error(`Enrichment failed: ${error.message}`);
    },
  });

  const contacts: any[] = results?.contacts ?? [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border-4 border-black" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b-4 border-black flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-black text-muted-foreground">CONTACTS</div>
            <h3 className="text-xl font-black">{companyName}</h3>
            <div className="text-sm font-bold text-muted-foreground mt-0.5">{contacts.length} contact{contacts.length !== 1 ? "s" : ""} found</div>
          </div>
          <button onClick={onClose} className="text-2xl font-black hover:opacity-60 cursor-pointer">✕</button>
        </div>

        {/* Contact List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-bold">No contacts found</div>
          ) : contacts.map((c: any, i: number) => (
            <div key={i} className="border-2 border-gray-200 p-4 hover:border-black transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base">{c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}</div>
                  <div className="text-sm font-bold text-muted-foreground">{c.title || c.jobTitle || "—"}</div>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-sm text-blue-600 underline font-bold block mt-1">{c.email}</a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-sm text-green-600 underline font-bold block">{c.phone}</a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline block mt-1">
                      {c.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                </div>
                {!c.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => enrichContactMutation.mutate({ contactId: c.id })}
                    disabled={enrichContactMutation.isPending}
                    className="text-xs font-black border-2 border-purple-600 text-purple-600 shrink-0 cursor-pointer"
                  >
                    {enrichContactMutation.isPending ? "..." : "GET EMAIL"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-4 border-black shrink-0 flex items-center justify-between gap-4 bg-gray-50">
          {fetchLimit !== undefined && onFetchLimitChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-black">LIMIT:</label>
              <select
                value={fetchLimit}
                onChange={(e) => onFetchLimitChange(Number(e.target.value))}
                className="border-2 border-gray-300 px-2 py-1 text-sm font-bold cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onRefresh}
              disabled={isPending}
              className="text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? "REFRESHING..." : "REFRESH"}
            </button>
            <button
              onClick={onClose}
              className="text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
