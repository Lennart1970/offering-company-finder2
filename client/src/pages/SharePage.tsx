import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { normaliseSalesApproach } from "@shared/normaliseStarters";
import { stripGrokCitations } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function safeStarterText(s: any): string {
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    return s.opener ?? s.conversationStarter ?? s.description ?? JSON.stringify(s);
  }
  return String(s ?? "");
}

function formatRevenue(revenue: number | string | null): string {
  if (!revenue) return "—";
  const num = typeof revenue === "string" ? parseFloat(revenue) : revenue;
  if (isNaN(num)) return String(revenue);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

function ScoreBadge({ score, label, color }: { score: number | null; label: string; color: string }) {
  if (score === null || score === undefined) return null;
  return (
    <div className="text-center">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg ${color}`}>
        {score}
      </div>
      <p className="text-xs text-gray-400 mt-1 font-bold">{label}</p>
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ id, emoji, title, color }: {
  id: string; emoji: string; title: string; color: string;
}) {
  return (
    <div id={id} className={`flex items-center border-b-4 ${color} pb-2 mb-6 scroll-mt-4`}>
      <h2 className={`text-xl font-black tracking-tight ${color.replace("border-", "text-")}`}>
        {emoji} {title}
      </h2>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data, isLoading, error } = trpc.share.resolveToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    const el = document.createElement("div");
    el.textContent = `${label} copied!`;
    el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#000;color:#fff;padding:8px 20px;font-weight:900;font-size:12px;z-index:9999;border-radius:4px;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-black animate-pulse">Loading company intelligence…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-black mb-2">Link not found</h1>
          <p className="text-muted-foreground text-sm">This share link is invalid or has expired. Please request a new link from the LeadTrigger platform.</p>
        </div>
      </div>
    );
  }

  const { company, brain, brainOutput, contacts: contactList } = data;

  // Parse JSON fields
  const rawBriefData = brainOutput?.briefData ?? company.briefData;
  const briefData = (() => {
    if (!rawBriefData) return null;
    try {
      const raw = typeof rawBriefData === "string" ? JSON.parse(rawBriefData) : rawBriefData;
      if (!raw) return null;
      if (!raw.productsAndServices && raw.productsServices) raw.productsAndServices = raw.productsServices;
      if (!raw.companyOverview && raw.executiveSummary) {
        const es = raw.executiveSummary;
        raw.companyOverview = [es.company, es.industry !== "Unknown" ? es.industry : null, es.revenue !== "Unknown" ? `Revenue: ${es.revenue}` : null].filter(Boolean).join(" · ");
      }
      return raw;
    } catch { return null; }
  })();

  const rawSalesApproach = brainOutput?.salesApproachData ?? company.salesApproachData;
  const salesApproach = (() => {
    if (!rawSalesApproach) return null;
    try { return normaliseSalesApproach(typeof rawSalesApproach === "string" ? JSON.parse(rawSalesApproach) : rawSalesApproach); }
    catch { return null; }
  })();

  const fitScoreData = safeJson<any>(brainOutput?.fitScoreData ?? company.fitScoreData, null);
  const fitScore = brainOutput?.fitScore ?? company.fitScore ?? null;
  const urgencyScore = brainOutput?.urgencyScore ?? company.urgencyScore ?? null;
  const urgency = briefData?.urgencySignals ?? [];

  const fitColor = fitScore !== null
    ? fitScore >= 70 ? "bg-green-500" : fitScore >= 40 ? "bg-yellow-500" : "bg-red-400"
    : "bg-gray-300";
  const urgencyColor = urgencyScore !== null
    ? urgencyScore >= 70 ? "bg-orange-500" : urgencyScore >= 40 ? "bg-yellow-500" : "bg-blue-400"
    : "bg-gray-300";

  const location = (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : "—";

  const sliceMeta = safeJson<any>(company.sliceMetadata as any, null);
  const employeeBand = sliceMeta?.employeeBand ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top header bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-black">LT</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LeadTrigger · Connect Group</p>
              {data.shareListName && <p className="text-xs font-bold text-gray-600">{data.shareListName}</p>}
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-black text-gray-500 border-gray-400">Read-only · Confidential</Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ── Company Header Card ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-black leading-tight mb-1">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
                {company.websiteUrl && (
                  <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
                    {company.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {location !== "—" && <span>📍 {location}</span>}
                {company.revenue && <span>💰 {formatRevenue(company.revenue)}</span>}
                {employeeBand && <span>👥 {employeeBand}</span>}
              </div>
              {briefData?.companyOverview && (
                <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">{briefData.companyOverview}</p>
              )}
              {brain && (
                <div className="mt-3">
                  <span className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5">
                    🧠 {brain.brainName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-5 shrink-0">
              <ScoreBadge score={fitScore} label="Fit" color={fitColor} />
              <ScoreBadge score={urgencyScore} label="Urgency" color={urgencyColor} />
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex gap-6 items-start">

          {/* ═══ LEFT SIDEBAR (sticky) ═══ */}
          <div className="w-64 shrink-0 space-y-4 sticky top-[57px]">

            {/* Contacts panel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Contacts</h3>
              {contactList.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold">No contacts available.</p>
              ) : (
                <div className="space-y-4">
                  {contactList.map((c: any, i: number) => (
                    <div key={i} className="text-sm border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <p className="font-black text-gray-900">{c.fullName || c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}</p>
                      {(c.title || c.jobTitle) && <p className="text-xs text-gray-500 mt-0.5">{c.title || c.jobTitle}</p>}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-blue-600 text-xs hover:underline block mt-1 font-medium">{c.email}</a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-green-600 text-xs hover:underline block font-medium">{c.phone}</a>
                      )}
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs hover:underline block">
                          LinkedIn ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fit score breakdown panel */}
            {fitScoreData?.breakdown?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Fit Breakdown</h3>
                <div className="space-y-3">
                  {fitScoreData.breakdown.map((dim: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-gray-700 truncate max-w-[130px]">{dim.dimension ?? dim.criterion}</span>
                        <span className="text-gray-400 shrink-0">{dim.score}/{dim.maxScore ?? 10}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5">
                        <div className={`h-1.5 ${fitColor}`} style={{ width: `${Math.min(100, Math.round((dim.score / (dim.maxScore ?? 10)) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {fitScoreData.rationale && (
                  <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">{fitScoreData.rationale}</p>
                )}
              </div>
            )}

            {/* Quick company meta */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Company Info</h3>
              <div className="space-y-2 text-xs">
                {location !== "—" && <div><span className="font-black text-gray-400">LOCATION </span><span className="font-bold">{location}</span></div>}
                {company.revenue && <div><span className="font-black text-gray-400">REVENUE </span><span className="font-bold">{formatRevenue(company.revenue)}</span></div>}
                {employeeBand && <div><span className="font-black text-gray-400">EMPLOYEES </span><span className="font-bold">{employeeBand}</span></div>}
                {company.linkedinUrl && (
                  <div>
                    <span className="font-black text-gray-400">LINKEDIN </span>
                    <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">Profile ↗</a>
                  </div>
                )}
                {company.websiteUrl && (
                  <div>
                    <span className="font-black text-gray-400">WEBSITE </span>
                    <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">{company.websiteUrl.replace(/^https?:\/\//, "")}</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT MAIN CONTENT ═══ */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* ── URGENCY SIGNALS ── */}
            <section>
              <div id="urgency" className="flex items-center border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Urgency Signals</h2>
              </div>

              {!briefData || urgency.length === 0 ? (
                <p className="text-sm text-gray-400 font-bold">No urgency signals available.</p>
              ) : (
                <div className="space-y-3">
                  {urgency.map((signal: any, i: number) => {
                    const sourceUrl = signal.sourceUrl ?? signal.source_url ?? signal.url ?? null;
                    const sourceDomain = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return sourceUrl; } })() : null;
                    return (
                      <div key={i} className="bg-white border border-gray-200 p-4 rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-700 uppercase rounded">{signal.category ?? signal.type ?? "Signal"}</span>
                          {signal.urgencyContribution && <span className="text-[10px] font-black text-gray-400">+{signal.urgencyContribution} pts</span>}
                        </div>
                        <p className="text-sm font-bold leading-snug text-gray-800">{signal.description ?? signal.headline ?? ""}</p>
                        {signal.snippet && <blockquote className="border-l-4 border-red-200 pl-3 text-xs text-gray-500 italic line-clamp-3">{signal.snippet}</blockquote>}
                        {sourceUrl && sourceDomain && (
                          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black hover:underline">
                            <span className="inline-block w-4 h-4 bg-gray-100 border border-gray-200 text-[9px] font-black text-gray-500 flex items-center justify-center rounded-sm">{sourceDomain.charAt(0).toUpperCase()}</span>
                            <span className="truncate max-w-[200px]">{sourceDomain}</span>
                            <span className="text-gray-400">↗</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {briefData?.conversationStarter && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">💬 Conversation Starter</p>
                  <p className="text-sm font-bold text-amber-900 italic">"{briefData.conversationStarter}"</p>
                </div>
              )}
            </section>

            {/* ── SALES APPROACH ── */}
            <section>
              <div id="approach" className="flex items-center border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Sales Approach</h2>
              </div>

              {!salesApproach ? (
                <p className="text-sm text-gray-400 font-bold">No sales approach available.</p>
              ) : (
                <div className="space-y-6">
                  {/* Conversation Starters */}
                  {salesApproach.conversationStarters?.length > 0 && (
                    <div className="space-y-3">
                      {salesApproach.conversationStarters.map((s: any, i: number) => (
                        <div key={i} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-medium text-amber-900">{safeStarterText(s)}</p>
                          {typeof s !== "string" && s.basedOn && <p className="text-xs text-amber-600 mt-1">Based on: {s.basedOn}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Email Draft */}
                  {salesApproach.emailDraft && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-black uppercase tracking-widest text-green-700">EMAIL</span>
                        <button onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                          className="text-xs font-black border border-green-600 text-green-600 px-3 py-1 cursor-pointer hover:bg-green-600 hover:text-white transition-colors rounded">COPY EMAIL</button>
                      </div>
                      <div className="p-5">
                        <div className="mb-3 pb-3 border-b border-gray-100">
                          <span className="text-xs font-black text-gray-400">SUBJECT: </span>
                          <span className="text-sm font-bold">{salesApproach.emailDraft.subject}</span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{stripGrokCitations(salesApproach.emailDraft.body ?? "")}</div>
                      </div>
                    </div>
                  )}

                  {/* LinkedIn Message */}
                  {salesApproach.linkedinMessage && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-black uppercase tracking-widest text-blue-700">LINKEDIN</span>
                      </div>
                      <div className="p-5 space-y-4">
                        {salesApproach.linkedinMessage.connectionRequest && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-gray-500">CONNECTION REQUEST</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} className="text-xs font-black border border-blue-500 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-500 hover:text-white transition-colors rounded">COPY</button>
                            </div>
                            <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">{stripGrokCitations(salesApproach.linkedinMessage.connectionRequest ?? "")}</div>
                          </div>
                        )}
                        {salesApproach.linkedinMessage.followUp && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-gray-500">FOLLOW-UP</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.followUp, "Follow-up")} className="text-xs font-black border border-blue-500 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-500 hover:text-white transition-colors rounded">COPY</button>
                            </div>
                            <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">{stripGrokCitations(salesApproach.linkedinMessage.followUp ?? "")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Call Script */}
                  {salesApproach.callScript && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-black uppercase tracking-widest text-purple-700">CALL SCRIPT</span>
                        <button onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening || "", "Call Script")}
                          className="text-xs font-black border border-purple-600 text-purple-600 px-3 py-1 cursor-pointer hover:bg-purple-600 hover:text-white transition-colors rounded">COPY SCRIPT</button>
                      </div>
                      <div className="p-5 space-y-3">
                        {salesApproach.callScript.opening && (
                          <div>
                            <div className="text-xs font-black text-gray-400 mb-1">OPENING</div>
                            <div className="text-sm text-gray-700 bg-purple-50 p-3 rounded border border-purple-100">{stripGrokCitations(salesApproach.callScript.opening ?? "")}</div>
                          </div>
                        )}
                        {salesApproach.callScript.valueProposition && (
                          <div>
                            <div className="text-xs font-black text-gray-400 mb-1">VALUE PROPOSITION</div>
                            <div className="text-sm text-gray-700 bg-purple-50 p-3 rounded border border-purple-100">{stripGrokCitations(salesApproach.callScript.valueProposition ?? "")}</div>
                          </div>
                        )}
                        {salesApproach.callScript.fullScript && (
                          <div>
                            <div className="text-xs font-black text-gray-400 mb-1">FULL SCRIPT</div>
                            <div className="whitespace-pre-wrap text-sm text-gray-700 bg-purple-50 p-4 rounded border border-purple-100">{stripGrokCitations(salesApproach.callScript.fullScript ?? "")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── FIT ANALYSIS ── */}
            {briefData && (
              <section>
                <div id="fit" className="flex items-center border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Fit Analysis</h2>
                </div>

                <div className="space-y-5">
                  {briefData.whyThisCompanyMatters && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Why This Company Matters</p>
                      <p className="text-sm font-bold text-blue-900 leading-relaxed">{briefData.whyThisCompanyMatters}</p>
                    </div>
                  )}

                  {briefData.productsAndServices?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Products & Services</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {briefData.productsAndServices.map((p: any, i: number) => (
                          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="font-black text-sm mb-1">{typeof p === "string" ? p : p.name ?? p.product ?? ""}</div>
                            {typeof p !== "string" && p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {briefData.keyTechnologies?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Key Technologies</h3>
                      <div className="flex flex-wrap gap-2">
                        {briefData.keyTechnologies.map((t: any, i: number) => (
                          <span key={i} className="text-xs font-bold border-2 border-black px-3 py-1.5 bg-white">
                            {typeof t === "string" ? t : t.name ?? t.technology ?? ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {briefData.sources?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Sources ({briefData.sources.length})</h3>
                      <div className="space-y-2">
                        {briefData.sources.map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors">
                            <span className="text-xs font-black text-gray-400 shrink-0">[{i + 1}]</span>
                            <div className="flex-1 min-w-0">
                              {(s.url || s.sourceUrl) ? (
                                <a href={s.url || s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 underline truncate block">{s.title || s.url || s.sourceUrl}</a>
                              ) : <div className="text-sm font-bold">{s.title || String(s)}</div>}
                              {s.snippet && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.snippet}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Image" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white font-black text-2xl hover:text-gray-300" onClick={() => setLightboxImage(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
