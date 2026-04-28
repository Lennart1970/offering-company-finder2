import { trpc } from "@/lib/trpc";
import { ShareGate } from "@/components/ShareGate";
import { Badge } from "@/components/ui/badge";

export default function BrainOverviewPage() {
  const { data, isLoading, error } = trpc.shareExt.listSharedBrains.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-black animate-pulse">Loading Brains...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">&#9888;&#65039;</div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const brains = data?.brains ?? [];

  return (
    <ShareGate tokenType="brain" tokenValue="overview">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">LT</span>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">LeadTrigger - Connect Group</p>
                <p className="text-xs font-bold text-gray-700">Offering Brains -- Overview</p>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-400 border border-gray-200 px-3 py-1 rounded-full">
              Read-only - Confidential
            </span>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900 mb-2">Offering Brains</h1>
            <p className="text-sm text-gray-500">
              Browse all shared Offering Brains below. Each brain represents a distinct offering profile with ICP, fit criteria, and urgency triggers.
            </p>
          </div>

          {brains.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
              <div className="text-4xl mb-4">&#129504;</div>
              <h2 className="text-lg font-black text-gray-900 mb-2">No shared brains yet</h2>
              <p className="text-sm text-gray-500">Brains will appear here once they are shared from the LeadTrigger platform.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {brains.map((brain) => (
                <a
                  key={brain.id}
                  href={`/share/brain/${brain.token}`}
                  className="block bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-black text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                          {brain.brainName}
                        </h2>
                        {brain.isActive ? (
                          <Badge className="text-[10px] bg-green-100 text-green-700 border-0 shrink-0">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        {brain.companyName && <span className="font-medium">{brain.companyName}</span>}
                        {brain.companyWebsite && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{brain.companyWebsite}</span>
                          </>
                        )}
                      </div>
                      {brain.offeringSummary && (
                        <p className="text-sm text-gray-600 line-clamp-2">{brain.offeringSummary}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors mt-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 mt-12 pb-8">
            This is a read-only confidential document generated by LeadTrigger - Connect Group.<br />
            Do not distribute without authorisation.
          </div>
        </div>
      </div>
    </ShareGate>
  );
}
