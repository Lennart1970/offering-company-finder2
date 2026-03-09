import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";
import { Button } from "@/components/ui/button";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatRevenue(revenue: number | string | null): string {
  if (!revenue) return "—";
  const num = typeof revenue === "string" ? parseFloat(revenue) : revenue;
  if (isNaN(num)) return String(revenue);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

type Chapter = "overview" | "urgency" | "research" | "approach" | "contacts";
type ResearchSub = "recent-developments" | "products-services" | "key-technologies" | "target-markets" | "sources";
type ApproachSub = "conversation-starters" | "email-draft" | "linkedin-message" | "call-script";

const CHAPTERS: { id: Chapter; label: string; color: string; activeColor: string }[] = [
  { id: "overview",  label: "OVERVIEW",         color: "border-black text-black",           activeColor: "bg-black text-white border-black" },
  { id: "urgency",   label: "⚡ URGENCY",        color: "border-red-600 text-red-600",        activeColor: "bg-red-600 text-white border-red-600" },
  { id: "research",  label: "🔬 RESEARCH",       color: "border-blue-600 text-blue-600",      activeColor: "bg-blue-600 text-white border-blue-600" },
  { id: "approach",  label: "💬 APPROACH",       color: "border-green-600 text-green-600",    activeColor: "bg-green-600 text-white border-green-600" },
  { id: "contacts",  label: "👤 CONTACTS",       color: "border-purple-600 text-purple-600",  activeColor: "bg-purple-600 text-white border-purple-600" },
];

const RESEARCH_SUBS: { id: ResearchSub; label: string }[] = [
  { id: "recent-developments", label: "Recent Developments" },
  { id: "products-services",   label: "Products & Services" },
  { id: "key-technologies",    label: "Key Technologies" },
  { id: "target-markets",      label: "Target Markets" },
  { id: "sources",             label: "Sources" },
];

const APPROACH_SUBS: { id: ApproachSub; label: string }[] = [
  { id: "conversation-starters", label: "Conversation Starters" },
  { id: "email-draft",           label: "Email Draft" },
  { id: "linkedin-message",      label: "LinkedIn Message" },
  { id: "call-script",           label: "Call Script" },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function CompanyDetail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ companyId: string }>();
  const companyId = parseInt(params.companyId, 10);

  // Parse ?chapter= and ?from= from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialChapter = (urlParams.get("chapter") as Chapter) || "overview";
  const fromParam = urlParams.get("from") || "";

  const [chapter, setChapter] = useState<Chapter>(initialChapter);
  const [researchSub, setResearchSub] = useState<ResearchSub>("recent-developments");
  const [approachSub, setApproachSub] = useState<ApproachSub>("conversation-starters");

  const { data, isLoading, refetch } = trpc.companyFinder.getCompany.useQuery(
    { companyId },
    { enabled: !!companyId && !isNaN(companyId) }
  );

  const company = data?.company ?? null;
  const contacts = data?.contacts ?? [];

  const briefData = useMemo(() => {
    if (!company?.briefData) return null;
    try { return typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData; }
    catch { return null; }
  }, [company?.briefData]);

  const salesApproach = useMemo(() => {
    if (!company?.salesApproachData) return null;
    try { return typeof company.salesApproachData === "string" ? JSON.parse(company.salesApproachData) : company.salesApproachData; }
    catch { return null; }
  }, [company?.salesApproachData]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const goBack = () => {
    if (fromParam.startsWith("call-today/")) {
      navigate(`/call-today/${fromParam.replace("call-today/", "")}`);
    } else if (fromParam.startsWith("search/")) {
      navigate(`/search-results/${fromParam.replace("search/", "")}`);
    } else {
      navigate(-1 as any);
    }
  };

  const location = company && company.enrichmentStatus === "enriched" && (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : company?.searchLocation || "—";

  if (!user) return null;

  if (isLoading) return (
    <div className="max-w-6xl">
      <div className="text-2xl font-black animate-pulse">Loading company...</div>
    </div>
  );

  if (!company) return (
    <div className="max-w-6xl">
      <div className="text-2xl font-black text-red-600">Company not found.</div>
      <button onClick={goBack} className="mt-4 text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer">← BACK</button>
    </div>
  );

  return (
    <div className="max-w-6xl">
      {/* ── Breadcrumb / Back ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={goBack} className="text-xs font-black border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer">
          ← BACK
        </button>
        <span className="text-xs font-bold text-muted-foreground">
          {fromParam.startsWith("call-today/") ? "CALL TODAY" : fromParam.startsWith("search/") ? "SEARCH RESULTS" : "BACK"} / {company.name.toUpperCase()}
        </span>
      </div>

      {/* ── Company Header ── */}
      <div className="border-4 border-black bg-white mb-0">
        <div className="p-5 border-b-4 border-black">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {company.enrichmentStatus === "enriched" && (
                  <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5">ENRICHED</span>
                )}
                {company.briefData && (
                  <span className="text-[10px] font-black border border-blue-600 text-blue-600 px-1.5 py-0.5">RESEARCHED</span>
                )}
                {(company.urgencyScore ?? 0) > 0 && (
                  <button
                    onClick={() => setChapter("urgency")}
                    className={`text-[10px] font-black px-1.5 py-0.5 cursor-pointer transition-opacity hover:opacity-80 ${
                      (company.urgencyScore ?? 0) >= 70 ? "bg-red-600 text-white" :
                      (company.urgencyScore ?? 0) >= 50 ? "bg-yellow-500 text-white" :
                      "bg-gray-200 text-gray-700"
                    }`}
                  >
                    ⚡ {company.urgencyScore}/100
                  </button>
                )}
                {company.salesApproachData && (
                  <span className="text-[10px] font-black border border-green-600 text-green-600 px-1.5 py-0.5">SALES READY</span>
                )}
              </div>

              {/* Name + URL */}
              <h1 className="text-3xl md:text-4xl font-black leading-tight">{company.name}</h1>
              {company.websiteUrl && (
                <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground underline mt-0.5 inline-block">
                  {company.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}

              {/* Overview snippet */}
              {briefData?.companyOverview && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
                  {briefData.companyOverview.split(/(?<=[.!?])\s+/)[0]}
                </p>
              )}
            </div>

            {/* Quick data */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm shrink-0">
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
              {company.linkedinUrl && (
                <div className="col-span-2">
                  <div className="text-[10px] font-black text-muted-foreground">LINKEDIN</div>
                  <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-sm truncate block">
                    {company.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3">
            <CompanyCodeDisplay sicCodes={company.sicCodes} naicsCodes={company.naicsCodes} />
          </div>
        </div>

        {/* ── Chapter Tab Bar ── */}
        <div className="flex overflow-x-auto border-b-4 border-black">
          {CHAPTERS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChapter(ch.id)}
              className={`shrink-0 px-5 py-3 text-xs font-black border-r-2 border-black cursor-pointer transition-colors ${
                chapter === ch.id ? ch.activeColor : `hover:bg-gray-50 ${ch.color}`
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* ── Research Sub-Nav ── */}
        {chapter === "research" && briefData && (
          <div className="flex overflow-x-auto border-b-2 border-blue-200 bg-blue-50">
            {RESEARCH_SUBS.map((sub) => {
              const hasContent =
                (sub.id === "recent-developments" && briefData.recentDevelopments?.length > 0) ||
                (sub.id === "products-services"   && briefData.productsAndServices?.length > 0) ||
                (sub.id === "key-technologies"    && briefData.keyTechnologies?.length > 0) ||
                (sub.id === "target-markets"      && briefData.targetMarkets?.length > 0) ||
                (sub.id === "sources"             && briefData.sources?.length > 0);
              if (!hasContent) return null;
              return (
                <button
                  key={sub.id}
                  onClick={() => setResearchSub(sub.id)}
                  className={`shrink-0 px-4 py-2 text-[11px] font-black border-r border-blue-200 cursor-pointer transition-colors ${
                    researchSub === sub.id
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {sub.label}
                  {sub.id === "sources" && briefData.sources?.length > 0 && (
                    <span className="ml-1 opacity-70">({briefData.sources.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Approach Sub-Nav ── */}
        {chapter === "approach" && salesApproach && (
          <div className="flex overflow-x-auto border-b-2 border-green-200 bg-green-50">
            {APPROACH_SUBS.map((sub) => {
              const hasContent =
                (sub.id === "conversation-starters" && salesApproach.conversationStarters?.length > 0) ||
                (sub.id === "email-draft"           && !!salesApproach.emailDraft) ||
                (sub.id === "linkedin-message"      && !!salesApproach.linkedinMessage) ||
                (sub.id === "call-script"           && !!salesApproach.callScript);
              if (!hasContent) return null;
              return (
                <button
                  key={sub.id}
                  onClick={() => setApproachSub(sub.id)}
                  className={`shrink-0 px-4 py-2 text-[11px] font-black border-r border-green-200 cursor-pointer transition-colors ${
                    approachSub === sub.id
                      ? "bg-green-600 text-white"
                      : "text-green-700 hover:bg-green-100"
                  }`}
                >
                  {sub.label}
                  {sub.id === "conversation-starters" && salesApproach.conversationStarters?.length > 0 && (
                    <span className="ml-1 opacity-70">({salesApproach.conversationStarters.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Chapter Content ── */}
        <div className="min-h-[400px]">

          {/* OVERVIEW */}
          {chapter === "overview" && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Urgency card */}
                <button
                  onClick={() => setChapter("urgency")}
                  disabled={!briefData}
                  className={`p-4 border-4 text-left cursor-pointer transition-colors ${
                    briefData ? "border-red-600 hover:bg-red-50" : "border-gray-200 opacity-40 cursor-default"
                  }`}
                >
                  <div className="text-[10px] font-black text-red-600 mb-1">⚡ URGENCY</div>
                  {briefData ? (
                    <>
                      <div className="text-3xl font-black text-red-600">{briefData.urgencyScore}/100</div>
                      <div className="text-xs font-bold text-muted-foreground mt-1">Click to view breakdown →</div>
                    </>
                  ) : (
                    <div className="text-sm font-bold text-gray-400">No research yet</div>
                  )}
                </button>

                {/* Research card */}
                <button
                  onClick={() => setChapter("research")}
                  disabled={!briefData}
                  className={`p-4 border-4 text-left cursor-pointer transition-colors ${
                    briefData ? "border-blue-600 hover:bg-blue-50" : "border-gray-200 opacity-40 cursor-default"
                  }`}
                >
                  <div className="text-[10px] font-black text-blue-600 mb-1">🔬 RESEARCH</div>
                  {briefData ? (
                    <ul className="space-y-0.5">
                      {briefData.recentDevelopments?.length > 0 && <li className="text-xs font-bold text-blue-800">• Recent Developments ({briefData.recentDevelopments.length})</li>}
                      {briefData.productsAndServices?.length > 0 && <li className="text-xs font-bold text-blue-800">• Products & Services ({briefData.productsAndServices.length})</li>}
                      {briefData.keyTechnologies?.length > 0 && <li className="text-xs font-bold text-blue-800">• Key Technologies ({briefData.keyTechnologies.length})</li>}
                      {briefData.targetMarkets?.length > 0 && <li className="text-xs font-bold text-blue-800">• Target Markets ({briefData.targetMarkets.length})</li>}
                      {briefData.sources?.length > 0 && <li className="text-xs font-bold text-blue-800">• Sources ({briefData.sources.length})</li>}
                    </ul>
                  ) : (
                    <div className="text-sm font-bold text-gray-400">No research yet</div>
                  )}
                </button>

                {/* Approach card */}
                <button
                  onClick={() => setChapter("approach")}
                  disabled={!salesApproach}
                  className={`p-4 border-4 text-left cursor-pointer transition-colors ${
                    salesApproach ? "border-green-600 hover:bg-green-50" : "border-gray-200 opacity-40 cursor-default"
                  }`}
                >
                  <div className="text-[10px] font-black text-green-600 mb-1">💬 APPROACH</div>
                  {salesApproach ? (
                    <ul className="space-y-0.5">
                      {salesApproach.conversationStarters?.length > 0 && <li className="text-xs font-bold text-green-800">• Conversation Starters ({salesApproach.conversationStarters.length})</li>}
                      {salesApproach.emailDraft && <li className="text-xs font-bold text-green-800">• Email Draft</li>}
                      {salesApproach.linkedinMessage && <li className="text-xs font-bold text-green-800">• LinkedIn Message</li>}
                      {salesApproach.callScript && <li className="text-xs font-bold text-green-800">• Call Script</li>}
                    </ul>
                  ) : (
                    <div className="text-sm font-bold text-gray-400">No approach yet</div>
                  )}
                </button>

                {/* Contacts card */}
                <button
                  onClick={() => setChapter("contacts")}
                  className="p-4 border-4 border-purple-600 text-left cursor-pointer hover:bg-purple-50 transition-colors"
                >
                  <div className="text-[10px] font-black text-purple-600 mb-1">👤 CONTACTS</div>
                  {contacts.length > 0 ? (
                    <>
                      <div className="text-3xl font-black text-purple-600">{contacts.length}</div>
                      <div className="text-xs font-bold text-muted-foreground mt-1">contacts found →</div>
                    </>
                  ) : (
                    <div className="text-sm font-bold text-gray-400">No contacts yet</div>
                  )}
                </button>
              </div>

              {/* Full company overview text */}
              {briefData?.companyOverview && (
                <div className="mb-6 p-5 border-2 border-gray-200">
                  <h3 className="text-base font-black mb-2">Company Overview</h3>
                  <p className="text-sm leading-relaxed">{briefData.companyOverview}</p>
                </div>
              )}

              {/* Why Now teaser */}
              {briefData?.whyNow && (
                <div className="p-5 border-2 border-red-200 bg-red-50">
                  <h3 className="text-base font-black text-red-700 mb-2">Why Now</h3>
                  <p className="text-sm leading-relaxed">{briefData.whyNow}</p>
                  <button onClick={() => setChapter("urgency")} className="text-xs font-black text-red-600 underline mt-2 cursor-pointer">
                    See full urgency breakdown →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* URGENCY */}
          {chapter === "urgency" && (
            <div className="p-6">
              {!briefData ? (
                <div className="text-center py-16 text-muted-foreground font-bold">No research data available. Run Deep Research first.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Score + breakdown */}
                  <div>
                    <div className="p-5 border-4 border-red-600 mb-5">
                      <div className="text-5xl font-black text-red-600 mb-1">{briefData.urgencyScore}<span className="text-2xl">/100</span></div>
                      <div className="text-sm font-bold text-muted-foreground">Urgency Score</div>
                      {briefData.urgencyBreakdown && (
                        <div className="grid grid-cols-3 gap-4 mt-4 text-sm border-t-2 border-red-200 pt-4">
                          <div>
                            <div className="text-[10px] font-black text-muted-foreground">COMPANY CONTEXT</div>
                            <div className="text-xl font-black">{briefData.urgencyBreakdown.companyContext}<span className="text-xs font-bold text-muted-foreground">/40</span></div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-muted-foreground">MARKET SIGNALS</div>
                            <div className="text-xl font-black">{briefData.urgencyBreakdown.marketSignals}<span className="text-xs font-bold text-muted-foreground">/35</span></div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-muted-foreground">RECENT ACTIVITY</div>
                            <div className="text-xl font-black">{briefData.urgencyBreakdown.recentActivity}<span className="text-xs font-bold text-muted-foreground">/25</span></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {briefData.whyNow && (
                      <div className="p-4 border-2 border-red-200 bg-red-50 mb-5">
                        <h3 className="text-base font-black text-red-700 mb-2">Why Now</h3>
                        <p className="text-sm leading-relaxed">{briefData.whyNow}</p>
                      </div>
                    )}

                    {briefData.engagementStrategy && (
                      <div className="p-4 border-2 border-orange-200 bg-orange-50">
                        <h3 className="text-base font-black text-orange-700 mb-2">Engagement Strategy</h3>
                        <p className="text-sm leading-relaxed">{briefData.engagementStrategy}</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Urgency Signals */}
                  <div>
                    <h3 className="text-base font-black mb-3">Urgency Signals</h3>
                    {briefData.urgencySignals?.length > 0 ? (
                      <div className="space-y-3">
                        {briefData.urgencySignals.map((s: any, i: number) => (
                          <div key={i} className="p-4 bg-yellow-50 border-2 border-yellow-300">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-black bg-yellow-400 px-1.5 py-0.5">{s.category}</span>
                              <span className="text-xs font-bold text-muted-foreground">{s.type}</span>
                            </div>
                            <p className="text-sm">{s.description}</p>
                            {s.snippet && (
                              <blockquote className="text-xs text-gray-600 italic mt-2 border-l-4 border-yellow-400 pl-3">"{s.snippet}"</blockquote>
                            )}
                            {s.sourceUrl && (
                              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Source →</a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground font-bold">No urgency signals recorded.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RESEARCH */}
          {chapter === "research" && (
            <div className="p-6">
              {!briefData ? (
                <div className="text-center py-16 text-muted-foreground font-bold">No research data available. Run Deep Research first.</div>
              ) : (
                <>
                  {/* Recent Developments sub-chapter */}
                  {researchSub === "recent-developments" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Recent Developments</h2>
                      {briefData.recentDevelopments?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {briefData.recentDevelopments.map((d: any, i: number) => (
                            <div key={i} className="p-4 border-2 border-blue-200 bg-blue-50">
                              <div className="font-black text-sm mb-1">{typeof d === "string" ? d : d.title || d.event}</div>
                              {typeof d !== "string" && d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                              {typeof d !== "string" && d.date && <div className="text-[10px] font-bold text-muted-foreground mt-1">{d.date}</div>}
                              {typeof d !== "string" && d.sourceUrl && <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Source →</a>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No recent developments recorded.</div>}
                    </section>
                  )}

                  {/* Products & Services sub-chapter */}
                  {researchSub === "products-services" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Products & Services</h2>
                      {briefData.productsAndServices?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {briefData.productsAndServices.map((p: any, i: number) => (
                            <div key={i} className="p-4 border-2 border-gray-200 hover:border-black transition-colors">
                              <div className="w-full h-24 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
                                <span className="text-xs font-bold text-gray-400">+ Add Image</span>
                              </div>
                              <div className="font-black text-sm mb-1">{typeof p === "string" ? p : p.name || p.product}</div>
                              {typeof p !== "string" && p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                              {typeof p !== "string" && p.category && <div className="text-[10px] font-black text-muted-foreground mt-1 uppercase">{p.category}</div>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No products & services recorded.</div>}
                    </section>
                  )}

                  {/* Key Technologies sub-chapter */}
                  {researchSub === "key-technologies" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Key Technologies</h2>
                      {briefData.keyTechnologies?.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {briefData.keyTechnologies.map((t: any, i: number) => (
                              <span key={i} className="text-sm font-bold border-2 border-black px-3 py-1.5 bg-gray-50">
                                {typeof t === "string" ? t : t.name || t.technology}
                              </span>
                            ))}
                          </div>
                          {briefData.keyTechnologies.some((t: any) => typeof t !== "string" && t.description) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {briefData.keyTechnologies.filter((t: any) => typeof t !== "string" && t.description).map((t: any, i: number) => (
                                <div key={i} className="p-4 border-2 border-gray-200">
                                  <div className="font-black text-sm mb-1">{t.name || t.technology}</div>
                                  <p className="text-xs text-muted-foreground">{t.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No key technologies recorded.</div>}
                    </section>
                  )}

                  {/* Target Markets sub-chapter */}
                  {researchSub === "target-markets" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Target Markets</h2>
                      {briefData.targetMarkets?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {briefData.targetMarkets.map((m: any, i: number) => (
                            <div key={i} className="p-4 border-2 border-gray-200">
                              <div className="font-black text-sm mb-1">{typeof m === "string" ? m : m.market || m.segment || m.name}</div>
                              {typeof m !== "string" && m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No target markets recorded.</div>}
                    </section>
                  )}

                  {/* Sources sub-chapter */}
                  {researchSub === "sources" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Sources ({briefData.sources?.length ?? 0})</h2>
                      {briefData.sources?.length > 0 ? (
                        <div className="space-y-2">
                          {briefData.sources.map((s: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 border border-gray-200 hover:border-black transition-colors">
                              <span className="text-xs font-black text-muted-foreground shrink-0">[{i + 1}]</span>
                              <div className="flex-1 min-w-0">
                                {(s.url || s.sourceUrl) ? (
                                  <a href={s.url || s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 underline truncate block">
                                    {s.title || s.url || s.sourceUrl}
                                  </a>
                                ) : (
                                  <div className="text-sm font-bold">{s.title || String(s)}</div>
                                )}
                                {s.snippet && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.snippet}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No sources recorded.</div>}
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {/* APPROACH */}
          {chapter === "approach" && (
            <div className="p-6">
              {!salesApproach ? (
                <div className="text-center py-16 text-muted-foreground font-bold">No sales approach generated yet. Run Create Approach first.</div>
              ) : (
                <div>
                  {/* Conversation Starters sub-chapter */}
                  {approachSub === "conversation-starters" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-amber-500 pb-2 mb-4 text-amber-700">Conversation Starters</h2>
                      {salesApproach.conversationStarters?.length > 0 ? (
                        <div className="space-y-3">
                          {salesApproach.conversationStarters.map((s: any, i: number) => (
                            <div key={i} className="p-4 bg-amber-50 border-2 border-amber-200">
                              <p className="text-sm font-medium">{typeof s === "string" ? s : s.opener}</p>
                              {typeof s !== "string" && s.basedOn && <p className="text-xs text-muted-foreground mt-1">Based on: {s.basedOn}</p>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No conversation starters generated.</div>}
                    </section>
                  )}

                  {/* Email Draft sub-chapter */}
                  {approachSub === "email-draft" && (
                    <section>
                      <div className="flex items-center justify-between border-b-4 border-green-600 pb-2 mb-4">
                        <h2 className="text-xl font-black text-green-700">Email Draft</h2>
                        {salesApproach.emailDraft && (
                          <button
                            onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                            className="text-xs font-black border-2 border-green-600 text-green-600 px-3 py-1 cursor-pointer hover:bg-green-600 hover:text-white transition-colors"
                          >COPY EMAIL</button>
                        )}
                      </div>
                      {salesApproach.emailDraft ? (
                        <div className="p-5 border-4 border-green-600 bg-green-50">
                          <div className="mb-3 p-2 bg-white border border-green-200">
                            <span className="text-xs font-black text-muted-foreground">SUBJECT: </span>
                            <span className="text-sm font-bold">{salesApproach.emailDraft.subject}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm bg-white p-3 border border-green-200">{salesApproach.emailDraft.body}</div>
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No email draft generated.</div>}
                    </section>
                  )}

                  {/* LinkedIn Message sub-chapter */}
                  {approachSub === "linkedin-message" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-blue-600 pb-2 mb-4 text-blue-700">LinkedIn Message</h2>
                      {salesApproach.linkedinMessage ? (
                        <div className="p-5 border-4 border-blue-600 bg-blue-50 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black">CONNECTION REQUEST</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">COPY</button>
                            </div>
                            <div className="text-sm bg-white p-3 border border-blue-200">{salesApproach.linkedinMessage.connectionRequest}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black">FOLLOW-UP</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.followUp, "Follow-up")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">COPY</button>
                            </div>
                            <div className="text-sm bg-white p-3 border border-blue-200">{salesApproach.linkedinMessage.followUp}</div>
                          </div>
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No LinkedIn message generated.</div>}
                    </section>
                  )}

                  {/* Call Script sub-chapter */}
                  {approachSub === "call-script" && (
                    <section>
                      <div className="flex items-center justify-between border-b-4 border-purple-600 pb-2 mb-4">
                        <h2 className="text-xl font-black text-purple-700">Call Script</h2>
                        {salesApproach.callScript && (
                          <button
                            onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening || "", "Call Script")}
                            className="text-xs font-black border-2 border-purple-600 text-purple-600 px-3 py-1 cursor-pointer hover:bg-purple-600 hover:text-white transition-colors"
                          >COPY SCRIPT</button>
                        )}
                      </div>
                      {salesApproach.callScript ? (
                        <div className="p-5 border-4 border-purple-600 bg-purple-50">
                          {salesApproach.callScript.opening && (
                            <div className="mb-4">
                              <div className="text-xs font-black mb-1">OPENING</div>
                              <div className="text-sm bg-white p-3 border border-purple-200">{salesApproach.callScript.opening}</div>
                            </div>
                          )}
                          {salesApproach.callScript.fullScript && (
                            <div>
                              <div className="text-xs font-black mb-1">FULL SCRIPT</div>
                              <div className="whitespace-pre-wrap text-sm bg-white p-4 border border-purple-200">{salesApproach.callScript.fullScript}</div>
                            </div>
                          )}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No call script generated.</div>}
                    </section>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CONTACTS */}
          {chapter === "contacts" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h2 className="text-xl font-black">Contacts ({contacts.length})</h2>
                <div className="flex gap-3">
                  <CompanyDetailFindDecisionMakersButton companyId={company.id} companyName={company.name} onDone={() => refetch()} />
                  <CompanyDetailGetAllPersonnelButton companyId={company.id} companyName={company.name} onDone={() => refetch()} />
                </div>
              </div>

              {contacts.length === 0 ? (
                <div className="text-center py-16 border-4 border-dashed border-gray-300">
                  <div className="text-lg font-black text-muted-foreground mb-2">No contacts yet</div>
                  <div className="text-sm font-bold text-muted-foreground">Use the buttons above to find decision-makers or all personnel.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contacts.map((c: any, i: number) => (
                    <div key={i} className="p-4 border-2 border-gray-200 hover:border-black transition-colors">
                      <div className="font-black text-base mb-0.5">{c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}</div>
                      <div className="text-sm font-bold text-muted-foreground mb-2">{c.title || c.jobTitle || "—"}</div>
                      {c.email && <a href={`mailto:${c.email}`} className="text-sm text-blue-600 underline font-bold block">{c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="text-sm text-green-600 underline font-bold block">{c.phone}</a>}
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline block mt-1">
                          {c.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      )}
                      {!c.email && (
                        <CompanyDetailEnrichButton contactId={c.id} companyId={company.id} onDone={() => refetch()} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline action buttons for Contacts chapter ────────────────────────────────
function CompanyDetailFindDecisionMakersButton({ companyId, companyName, onDone }: { companyId: number; companyName: string; onDone: () => void }) {
  const findCSuiteMutation = trpc.companyFinder.findAllCSuite.useMutation({
    onSuccess: (data) => {
      toast.success(`Found ${data.contacts.length} decision-makers at ${companyName}`);
      onDone();
    },
    onError: (error) => toast.error(`Search failed: ${error.message}`),
  });

  return (
    <button
      onClick={() => findCSuiteMutation.mutate({ companyId })}
      disabled={findCSuiteMutation.isPending}
      className="font-black border-4 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
    >
      {findCSuiteMutation.isPending ? "SEARCHING..." : "👤 FIND DECISION-MAKERS"}
    </button>
  );
}

function CompanyDetailGetAllPersonnelButton({ companyId, companyName, onDone }: { companyId: number; companyName: string; onDone: () => void }) {
  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => {
      toast.success(`Found ${data.contacts.length} personnel at ${companyName}`);
      onDone();
    },
    onError: (error) => toast.error(`Search failed: ${error.message}`),
  });

  return (
    <button
      onClick={() => getAllPersonnelMutation.mutate({ companyId, limit: 25 })}
      disabled={getAllPersonnelMutation.isPending}
      className="font-black border-4 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
    >
      {getAllPersonnelMutation.isPending ? "FETCHING..." : "🏢 GET ALL PERSONNEL"}
    </button>
  );
}

function CompanyDetailEnrichButton({ contactId, companyId, onDone }: { contactId: number; companyId: number; onDone: () => void }) {
  const enrichMutation = trpc.companyFinder.enrichContact.useMutation({
    onSuccess: () => { toast.success("Contact enriched!"); onDone(); },
    onError: (error) => toast.error(`Enrichment failed: ${error.message}`),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => enrichMutation.mutate({ contactId })}
      disabled={enrichMutation.isPending}
      className="text-xs font-black border-2 border-purple-600 text-purple-600 mt-2 cursor-pointer w-full"
    >
      {enrichMutation.isPending ? "..." : "GET EMAIL"}
    </Button>
  );
}
