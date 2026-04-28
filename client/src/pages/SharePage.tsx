import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { stripGrokCitations } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function ScoreBar({ score, max = 100, color = "bg-blue-500" }: { score: number | null; max?: number; color?: string }) {
  if (score === null || score === undefined) return <span className="text-gray-400 text-sm">—</span>;
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{score}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{title}</h2>
      {children}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SharePage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = trpc.share.resolveToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading company intelligence…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link not found</h1>
          <p className="text-gray-500 text-sm">This share link is invalid or has expired. Please request a new link from the LeadTrigger platform.</p>
        </div>
      </div>
    );
  }

  const { company, brain, brainOutput, contacts: contactList } = data;

  // Parse JSON fields
  const fitScoreData = safeJson<any>(brainOutput?.fitScoreData ?? company.fitScoreData, null);
  const briefData = safeJson<any>(brainOutput?.briefData ?? company.briefData, null);
  const salesApproach = safeJson<any>(brainOutput?.salesApproachData ?? company.salesApproachData, null);
  const fitScore = brainOutput?.fitScore ?? company.fitScore ?? null;
  const urgencyScore = brainOutput?.urgencyScore ?? company.urgencyScore ?? null;

  const fitColor = fitScore !== null
    ? fitScore >= 70 ? "bg-green-500" : fitScore >= 40 ? "bg-yellow-500" : "bg-red-400"
    : "bg-gray-300";
  const urgencyColor = urgencyScore !== null
    ? urgencyScore >= 70 ? "bg-orange-500" : urgencyScore >= 40 ? "bg-yellow-500" : "bg-blue-400"
    : "bg-gray-300";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">LT</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">LeadTrigger · Connect Group</p>
              {data.shareListName && (
                <p className="text-xs text-gray-500">{data.shareListName}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-gray-500">Read-only · Confidential</Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Company Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{company.name}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                {company.websiteUrl && (
                  <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline">
                    {company.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {company.country && <span>📍 {company.country}</span>}
                {company.city && <span>{company.city}</span>}
              </div>
              {brain && (
                <div className="mt-3">
                  <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                    🧠 {brain.brainName}
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex gap-4 shrink-0">
              <div className="text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${fitColor}`}>
                  {fitScore ?? "—"}
                </div>
                <p className="text-xs text-gray-400 mt-1">Fit</p>
              </div>
              <div className="text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${urgencyColor}`}>
                  {urgencyScore ?? "—"}
                </div>
                <p className="text-xs text-gray-400 mt-1">Urgency</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column — Fit + Urgency */}
          <div className="md:col-span-1 space-y-6">
            {/* Fit Score Breakdown */}
            {fitScoreData?.breakdown?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Fit Score</h2>
                <div className="space-y-3">
                  {fitScoreData.breakdown.map((dim: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{dim.dimension ?? dim.criterion}</span>
                        <span className="text-gray-400">{dim.score}/{dim.maxScore ?? 10}</span>
                      </div>
                      <ScoreBar score={dim.score} max={dim.maxScore ?? 10} color={fitColor} />
                      {dim.reasoning && (
                        <p className="text-xs text-gray-400 mt-1">{dim.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
                {fitScoreData.rationale && (
                  <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">{fitScoreData.rationale}</p>
                )}
              </div>
            )}

            {/* Contacts */}
            {contactList.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Contacts</h2>
                <div className="space-y-4">
                  {contactList.map((c) => (
                    <div key={c.id} className="text-sm">
                      <p className="font-semibold text-gray-800">{c.fullName}</p>
                      {c.title && <p className="text-gray-500 text-xs">{c.title}</p>}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-blue-600 text-xs hover:underline block mt-0.5">
                          {c.email}
                        </a>
                      )}
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 text-xs hover:underline block">
                          LinkedIn ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Brief + Approach */}
          <div className="md:col-span-2 space-y-6">
            {/* Urgency / Brief */}
            {briefData && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Urgency Signals</h2>
                {briefData.companyOverview && (
                  <p className="text-sm text-gray-700 mb-4">{briefData.companyOverview}</p>
                )}
                {briefData.urgencySignals?.length > 0 && (
                  <div className="space-y-3">
                    {briefData.urgencySignals.map((sig: any, i: number) => (
                      <div key={i} className="border-l-2 border-orange-300 pl-3">
                        <p className="text-sm font-medium text-gray-800">{sig.signal}</p>
                        {sig.evidence && <p className="text-xs text-gray-500 mt-0.5">{sig.evidence}</p>}
                        {sig.source && (
                          <a href={sig.source} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline">
                            Source ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {briefData.conversationStarter && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Conversation Starter</p>
                    <p className="text-sm text-gray-700 italic">"{briefData.conversationStarter}"</p>
                  </div>
                )}
              </div>
            )}

            {/* Sales Approach */}
            {salesApproach && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Sales Approach</h2>

                {/* Email Draft — nested structure: emailDraft.subject + emailDraft.body */}
                {(salesApproach.emailDraft?.subject || salesApproach.emailDraft?.body || salesApproach.emailSubject || salesApproach.emailBody) && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Subject: {salesApproach.emailDraft?.subject ?? salesApproach.emailSubject ?? ""}
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {stripGrokCitations(
                        typeof salesApproach.emailDraft?.body === "string" ? salesApproach.emailDraft.body
                        : typeof salesApproach.emailBody === "string" ? salesApproach.emailBody
                        : ""
                      )}
                    </p>
                  </div>
                )}

                {/* LinkedIn — nested: linkedinMessage.connectionRequest */}
                {salesApproach.linkedinMessage && (
                  <div className="mb-4 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">LinkedIn</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {stripGrokCitations(
                        typeof salesApproach.linkedinMessage === "string" ? salesApproach.linkedinMessage
                        : typeof salesApproach.linkedinMessage?.connectionRequest === "string" ? salesApproach.linkedinMessage.connectionRequest
                        : ""
                      )}
                    </p>
                    {salesApproach.linkedinMessage?.followUp && (
                      <p className="text-sm text-gray-600 whitespace-pre-line mt-2">
                        <span className="text-xs font-semibold text-gray-400 block mb-1">Follow-up</span>
                        {stripGrokCitations(typeof salesApproach.linkedinMessage.followUp === "string" ? salesApproach.linkedinMessage.followUp : "")}
                      </p>
                    )}
                  </div>
                )}

                {/* Call Script — nested: callScript.opening / callScript.fullScript */}
                {salesApproach.callScript && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Call Script</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {stripGrokCitations(
                        typeof salesApproach.callScript === "string" ? salesApproach.callScript
                        : typeof salesApproach.callScript?.fullScript === "string" ? salesApproach.callScript.fullScript
                        : typeof salesApproach.callScript?.opening === "string" ? salesApproach.callScript.opening
                        : ""
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            Generated by LeadTrigger · Connect Group · Internal use only
          </p>
        </div>
      </div>
    </div>
  );
}
