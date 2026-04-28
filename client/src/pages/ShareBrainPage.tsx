import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { ShareGate } from "@/components/ShareGate";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

const NAV_SECTIONS = [
  { id: "offering", label: "Offering" },
  { id: "icp", label: "ICP" },
  { id: "fit", label: "Fit Criteria" },
  { id: "urgency", label: "Urgency" },
  { id: "capabilities", label: "Capabilities" },
  { id: "classification", label: "Classification" },
] as const;

export default function ShareBrainPage() {
  const { token } = useParams<{ token: string }>();
  const [activeSection, setActiveSection] = useState("offering");

  const { data, isLoading, error } = trpc.shareExt.resolveBrainToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-black animate-pulse">Loading Brain...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">&#128274;</div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Link not found</h2>
          <p className="text-gray-500 text-sm">This Brain share link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  const brain = data.brain as any;
  const fitCriteria = safeJson<any[]>(brain.fitCriteria, []);
  const urgencyTriggers = safeJson<any[]>(brain.urgencyTriggers, []);
  const icpPainPoints = safeJson<any[]>(brain.icpPainPoints, []);
  const icpBuyingSignals = safeJson<any[]>(brain.icpBuyingSignals, []);
  const coreCapabilities = safeJson<any[]>(brain.coreCapabilities, []);
  const valuePropositions = safeJson<any[]>(brain.valuePropositions, []);
  const competitiveAdvantages = safeJson<any[]>(brain.competitiveAdvantages, []);
  const sicCodes = safeJson<any[]>(brain.sicCodes, []);
  const naceCodes = safeJson<any[]>(brain.naceCodes, []);

  return (
    <ShareGate tokenType="brain" tokenValue={token ?? ""}>
      <div className="min-h-screen bg-gray-50">
        {/* -- Top header bar -- */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">LT</span>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">LeadTrigger - Connect Group</p>
                <p className="text-xs font-bold text-gray-700">Offering Brain -- Read Only</p>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-400 border border-gray-200 px-3 py-1 rounded-full">
              Read-only - Confidential
            </span>
          </div>
        </div>

        {/* -- Jump nav tabs -- */}
        <div className="bg-white border-b border-gray-100 sticky top-[52px] z-30">
          <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                  activeSection === s.id
                    ? "border-black text-black"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* -- Brain Title Card -- */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-1">{brain.brainName}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                  {brain.companyName && <span>{brain.companyName}</span>}
                  {brain.companyWebsite && (
                    <>
                      <span className="text-gray-300">|</span>
                      <a
                        href={brain.companyWebsite.startsWith("http") ? brain.companyWebsite : `https://${brain.companyWebsite}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {brain.companyWebsite}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-bold shrink-0 mt-1">
                &#129504; Offering Brain
              </Badge>
            </div>
          </div>

          {/* ====== OFFERING SECTION ====== */}
          <div id="offering" className="scroll-mt-28 space-y-6">
            {/* Offering Summary */}
            {brain.offeringSummary && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Offering Summary</h2>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{brain.offeringSummary}</p>
              </div>
            )}

            {/* Competitive Advantages */}
            {(typeof brain.competitiveAdvantages === "string" && brain.competitiveAdvantages.trim()) || competitiveAdvantages.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Competitive Advantages</h2>
                {competitiveAdvantages.length > 0 ? (
                  <div className="space-y-3">
                    {competitiveAdvantages.map((adv: any, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-yellow-500 mt-0.5 shrink-0">&#9733;</span>
                        <p className="text-sm text-gray-700">{typeof adv === "string" ? adv : adv.advantage ?? adv.name ?? JSON.stringify(adv)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{brain.competitiveAdvantages}</p>
                )}
              </div>
            ) : null}

            {/* Core Capabilities */}
            {coreCapabilities.length > 0 && (
              <div id="capabilities" className="scroll-mt-28 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Core Capabilities</h2>
                <div className="flex flex-wrap gap-2">
                  {coreCapabilities.map((cap: any, i: number) => (
                    <Badge key={i} className="text-xs bg-blue-100 text-blue-800 border-0">
                      {typeof cap === "string" ? cap : cap.capability ?? cap.name ?? JSON.stringify(cap)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Value Propositions */}
            {valuePropositions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Value Propositions</h2>
                <div className="space-y-3">
                  {valuePropositions.map((vp: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>
                      <p className="text-sm text-gray-700">{typeof vp === "string" ? vp : vp.proposition ?? vp.value ?? JSON.stringify(vp)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ====== ICP SECTION ====== */}
          <div id="icp" className="scroll-mt-28 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Ideal Customer Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {brain.icpIndustries && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Industries</p>
                  <div className="flex flex-wrap gap-2">
                    {safeJson<string[]>(brain.icpIndustries, []).map((ind: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{ind}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {brain.icpCompanySize && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Company Size</p>
                  <p className="text-sm text-gray-700">{brain.icpCompanySize}</p>
                </div>
              )}
              {brain.icpGeography && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Geography</p>
                  <p className="text-sm text-gray-700">&#128205; {brain.icpGeography}</p>
                </div>
              )}
              {icpPainPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Pain Points Solved</p>
                  <div className="flex flex-wrap gap-2">
                    {icpPainPoints.map((p: any, i: number) => (
                      <Badge key={i} className="text-xs bg-orange-100 text-orange-800 border-0">
                        {typeof p === "string" ? p : p.painPoint ?? JSON.stringify(p)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {icpBuyingSignals.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Buying Signals</p>
                  <div className="space-y-2">
                    {icpBuyingSignals.map((sig: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5 shrink-0">&#128276;</span>
                        <p className="text-sm text-gray-700">{typeof sig === "string" ? sig : sig.signal ?? sig.name ?? JSON.stringify(sig)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ====== FIT CRITERIA SECTION ====== */}
          {fitCriteria.length > 0 && (
            <div id="fit" className="scroll-mt-28 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Fit Scoring Criteria</h2>
              <div className="space-y-4">
                {fitCriteria.map((dim: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-700 font-black text-sm">{dim.weight ?? dim.maxScore ?? i + 1}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{dim.dimension ?? dim.name ?? dim.criterion ?? `Criterion ${i + 1}`}</p>
                      {dim.description && <p className="text-xs text-gray-500 mt-0.5">{dim.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ====== URGENCY TRIGGERS SECTION ====== */}
          {urgencyTriggers.length > 0 && (
            <div id="urgency" className="scroll-mt-28 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Urgency Triggers</h2>
              <div className="space-y-3">
                {urgencyTriggers.map((sig: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-red-500 mt-0.5">&#9889;</span>
                    <p className="text-sm text-gray-700">{typeof sig === "string" ? sig : sig.trigger ?? sig.signal ?? sig.description ?? JSON.stringify(sig)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ====== INDUSTRY CLASSIFICATION SECTION ====== */}
          {(sicCodes.length > 0 || naceCodes.length > 0) && (
            <div id="classification" className="scroll-mt-28 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Industry Classification</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {sicCodes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-3">SIC Codes</p>
                    <div className="space-y-2">
                      {sicCodes.map((code: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 shrink-0">
                            {typeof code === "string" ? code : code.code ?? code.sicCode ?? ""}
                          </span>
                          {typeof code !== "string" && (code.description ?? code.explanation ?? code.name) && (
                            <span className="text-gray-600 text-xs">{code.description ?? code.explanation ?? code.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {naceCodes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-3">NACE Codes</p>
                    <div className="space-y-2">
                      {naceCodes.map((code: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 shrink-0">
                            {typeof code === "string" ? code : code.code ?? code.naceCode ?? ""}
                          </span>
                          {typeof code !== "string" && (code.description ?? code.explanation ?? code.name) && (
                            <span className="text-gray-600 text-xs">{code.description ?? code.explanation ?? code.name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -- Footer -- */}
          <div className="text-center text-xs text-gray-400 pb-8">
            This is a read-only confidential document generated by LeadTrigger - Connect Group.<br />
            Do not distribute without authorisation.
          </div>
        </div>
      </div>
    </ShareGate>
  );
}
