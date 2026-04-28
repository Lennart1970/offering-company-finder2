import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { ShareGate } from "@/components/ShareGate";
import { Badge } from "@/components/ui/badge";

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

export default function ShareBrainPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = trpc.shareExt.resolveBrainToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-black animate-pulse">Loading Brain…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Link not found</h2>
          <p className="text-gray-500 text-sm">This Brain share link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  const brain = data.brain;
  const fitCriteria = safeJson<any[]>((brain as any).fitCriteria, []);
  const urgencyTriggers = safeJson<any[]>((brain as any).urgencyTriggers, []);
  const icpPainPoints = safeJson<any[]>((brain as any).icpPainPoints, []);
  const icpBuyingSignals = safeJson<any[]>((brain as any).icpBuyingSignals, []);
  const coreCapabilities = safeJson<any[]>((brain as any).coreCapabilities, []);
  const valuePropositions = safeJson<any[]>((brain as any).valuePropositions, []);

  return (
    <ShareGate tokenType="brain" tokenValue={token ?? ""}>
      <div className="min-h-screen bg-gray-50">
        {/* -- Header -- */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">LT</span>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">LeadTrigger · Connect Group</p>
                <p className="text-xs font-bold text-gray-700">Offering Brain — Read Only</p>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-400 border border-gray-200 px-3 py-1 rounded-full">
              Read-only · Confidential
            </span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* -- Brain Title -- */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-1">{brain.brainName}</h1>
                {brain.companyName && (
                  <p className="text-sm text-gray-500 font-medium">{brain.companyName}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs font-bold shrink-0 mt-1">
                🧠 Offering Brain
              </Badge>
            </div>
          </div>

          {/* -- Offering Description -- */}
          {(brain as any).offeringSummary && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Offering Summary</h2>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{(brain as any).offeringSummary}</p>
            </div>
          )}

          {/* -- ICP Profile -- */}
          {((brain as any).icpIndustries || (brain as any).icpCompanySize || (brain as any).icpGeography) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Ideal Customer Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(brain as any).icpIndustries && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Industries</p>
                    <div className="flex flex-wrap gap-2">
                      {safeJson<string[]>((brain as any).icpIndustries, []).map((ind: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{ind}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(brain as any).icpCompanySize && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Company Size</p>
                    <p className="text-sm text-gray-700">{(brain as any).icpCompanySize}</p>
                  </div>
                )}
                {(brain as any).icpGeography && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Geography</p>
                    <p className="text-sm text-gray-700">📍 {(brain as any).icpGeography}</p>
                  </div>
                )}
                {icpPainPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Pain Points Solved</p>
                    <div className="flex flex-wrap gap-2">
                      {icpPainPoints.map((p: any, i: number) => (
                        <Badge key={i} className="text-xs bg-orange-100 text-orange-800 border-0">{typeof p === 'string' ? p : p.painPoint ?? JSON.stringify(p)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -- Fit Criteria -- */}
          {fitCriteria.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
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

          {/* -- Urgency Triggers -- */}
          {urgencyTriggers.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Urgency Triggers</h2>
              <div className="space-y-3">
                {urgencyTriggers.map((sig: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-red-500 mt-0.5">⚡</span>
                    <p className="text-sm text-gray-700">{typeof sig === "string" ? sig : sig.trigger ?? sig.signal ?? sig.description ?? JSON.stringify(sig)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -- Core Capabilities -- */}
          {coreCapabilities.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Core Capabilities</h2>
              <div className="flex flex-wrap gap-2">
                {coreCapabilities.map((cap: any, i: number) => (
                  <Badge key={i} className="text-xs bg-blue-100 text-blue-800 border-0">{typeof cap === 'string' ? cap : cap.capability ?? cap.name ?? JSON.stringify(cap)}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* -- Value Propositions -- */}
          {valuePropositions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Value Propositions</h2>
              <div className="space-y-3">
                {valuePropositions.map((vp: any, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    <p className="text-sm text-gray-700">{typeof vp === 'string' ? vp : vp.proposition ?? vp.value ?? JSON.stringify(vp)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -- Footer -- */}
          <div className="text-center text-xs text-gray-400 pb-8">
            This is a read-only confidential document generated by LeadTrigger · Connect Group.<br />
            Do not distribute without authorisation.
          </div>
        </div>
      </div>
    </ShareGate>
  );
}
