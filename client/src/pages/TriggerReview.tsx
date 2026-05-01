import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Zap,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Brain,
  Newspaper,
  Target,
  ArrowRight,
  Loader2,
  BarChart3,
  Sparkles,
} from "lucide-react";

function similarityColor(sim: number): string {
  if (sim >= 0.55) return "text-green-700 font-semibold";
  if (sim >= 0.50) return "text-amber-700 font-semibold";
  return "text-orange-600 font-semibold";
}

function similarityBadge(sim: number) {
  const pct = (sim * 100).toFixed(1);
  if (sim >= 0.55)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300">
        {pct}%
      </span>
    );
  if (sim >= 0.50)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
        {pct}%
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300">
      {pct}%
    </span>
  );
}

function TriggerCard({
  item,
  onApprove,
  onDismiss,
  isUpdating,
}: {
  item: any;
  onApprove: () => void;
  onDismiss: () => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const isApproved = item.status === "approved";
  const isDismissed = item.status === "dismissed";

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isApproved
          ? "border-green-300 bg-green-50"
          : isDismissed
          ? "border-gray-200 bg-gray-50 opacity-60"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Header: News title + similarity score */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
              {item.title}
            </h3>
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 ml-6">
            {item.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {similarityBadge(item.bestSimilarity)}
          {isApproved && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
              ✓ Approved
            </span>
          )}
          {isDismissed && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-300">
              Dismissed
            </span>
          )}
        </div>
      </div>

      {/* Best matching trigger */}
      {item.bestTrigger && (
        <div className="ml-6 mt-3 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">
              Best Match: {item.bestTrigger.brainName}
            </span>
            <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
              {item.bestTrigger.signalType}
            </span>
          </div>
          <p className="text-xs text-gray-800 mb-2">
            <span className="text-gray-500 font-medium">Trigger: </span>
            {item.bestTrigger.headline}
          </p>

          {/* A → B → Brain chain */}
          {item.bestTrigger.aEvent && (
            <div className="flex items-start gap-1.5 text-xs text-gray-700 mt-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-orange-600 font-bold">A</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
              <span className="line-clamp-1">{item.bestTrigger.aEvent}</span>
            </div>
          )}
          {item.bestTrigger.bChallenge && (
            <div className="flex items-start gap-1.5 text-xs text-gray-700 mt-1">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-amber-600 font-bold">B</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
              <span className="line-clamp-1">{item.bestTrigger.bChallenge}</span>
            </div>
          )}
          {item.bestTrigger.brainConnection && (
            <div className="flex items-start gap-1.5 text-xs text-gray-700 mt-1">
              <div className="flex items-center gap-1 flex-shrink-0">
                <Brain className="w-3 h-3 text-purple-600" />
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
              <span className="line-clamp-1">{item.bestTrigger.brainConnection}</span>
            </div>
          )}
        </div>
      )}

      {/* Expandable: top 3 triggers + metadata */}
      <div className="ml-6 mt-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide details" : "Show more matches & details"}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            {/* Top 3 matches */}
            {item.top3Triggers && item.top3Triggers.length > 1 && (
              <div className="text-xs space-y-1">
                <span className="text-gray-500 font-medium">Alternative matches:</span>
                {item.top3Triggers.slice(1).map((t: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-600 pl-2">
                    <span className={similarityColor(t.similarity)}>
                      {(t.similarity * 100).toFixed(1)}%
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="truncate">{t.brainName}: {t.headline}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
              {item.source && <span>Source: {item.source}</span>}
              {item.publishedAt && <span>Date: {item.publishedAt}</span>}
              {item.newsQuery && <span>Query: {item.newsQuery}</span>}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-3 h-3" /> Source
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {item.status === "pending" && (
        <div className="flex items-center gap-2 mt-3 ml-6">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
            onClick={onApprove}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <CheckCircle className="w-3 h-3 mr-1" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-gray-600 border-gray-300 hover:bg-gray-100 h-7 text-xs"
            onClick={onDismiss}
            disabled={isUpdating}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TriggerReview() {
  const [minSimilarity, setMinSimilarity] = useState(0.45);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "dismissed">("all");
  const [brainFilter, setBrainFilter] = useState<string | undefined>(undefined);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [generatingBrainId, setGeneratingBrainId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.trigger.getStats.useQuery();

  const {
    data: matchedItems,
    isLoading,
    refetch,
  } = trpc.trigger.getMatchedFeedItems.useQuery({
    limit: 100,
    minSimilarity,
    statusFilter,
    brainFilter,
  });

  // Get brain list for the generate synthetic news dropdown
  const { data: brainHistoryData } = trpc.companyFinder.getBrainHistory.useQuery();
  const brainHistory = brainHistoryData?.history;

  const updateStatus = trpc.trigger.updateMatchStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Status updated");
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`);
    },
    onSettled: () => setUpdatingId(null),
  });

  const embedMutation = trpc.trigger.embedFeedItems.useMutation({
    onSuccess: (data) => {
      toast.success(`Embedded ${data.embedded} feed items`);
      refetch();
    },
    onError: (err) => {
      toast.error(`Embedding failed: ${err.message}`);
    },
  });

  const generateSyntheticMutation = trpc.trigger.generateSyntheticTriggers.useMutation({
    onSuccess: (data: { count: number; brainName: string }) => {
      toast.success(`Generated ${data.count} synthetic triggers for ${data.brainName}`);
      setGeneratingBrainId(null);
    },
    onError: (err: { message: string }) => {
      toast.error(`Generation failed: ${err.message}`);
      setGeneratingBrainId(null);
    },
  });

  const handleApprove = (feedItemId: string, brainId?: string) => {
    setUpdatingId(feedItemId);
    updateStatus.mutate({
      feedItemId,
      status: "approved",
      approvedBrainId: brainId,
    });
  };

  const handleDismiss = (feedItemId: string) => {
    setUpdatingId(feedItemId);
    updateStatus.mutate({
      feedItemId,
      status: "dismissed",
    });
  };

  const handleGenerateSynthetic = (brainId: string) => {
    setGeneratingBrainId(brainId);
    generateSyntheticMutation.mutate({ brainId });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          Trigger Review
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          News events matched against synthetic trigger references. Review and approve to create campaigns.
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Reference Triggers", value: stats.totalReferences, color: "text-gray-900" },
            { label: "Feed Items", value: stats.totalFeedItems || "—", color: "text-gray-900" },
            { label: "Embedded", value: stats.embeddedFeedItems || "—", color: "text-gray-900" },
            { label: "Approved", value: stats.matchStats.approved, color: "text-green-700", icon: <CheckCircle className="w-3 h-3 text-green-600" /> },
            { label: "Dismissed", value: stats.matchStats.dismissed, color: "text-gray-500", icon: <XCircle className="w-3 h-3 text-gray-400" /> },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                {s.icon}
                {s.label}
              </div>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">Min Similarity:</span>
          <Select
            value={String(minSimilarity)}
            onValueChange={(v) => setMinSimilarity(parseFloat(v))}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.40">0.40 (Broad)</SelectItem>
              <SelectItem value="0.45">0.45 (Wide)</SelectItem>
              <SelectItem value="0.50">0.50 (Standard)</SelectItem>
              <SelectItem value="0.55">0.55 (Strict)</SelectItem>
              <SelectItem value="0.60">0.60 (Very Strict)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">Status:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as any)}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Generate Synthetic Triggers dropdown */}
          {brainHistory && brainHistory.length > 0 && (
            <Select
              value=""
              onValueChange={(v) => v && handleGenerateSynthetic(v)}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100">
                <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                <SelectValue placeholder="Generate Synthetic News…" />
              </SelectTrigger>
              <SelectContent>
                {brainHistory.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {generatingBrainId === b.id ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Generating…
                      </span>
                    ) : (
                      b.brainName
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-gray-300"
            onClick={() => embedMutation.mutate({ batchSize: 100 })}
            disabled={embedMutation.isPending}
          >
            {embedMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <BarChart3 className="w-3 h-3 mr-1" />
            )}
            Embed New Items
          </Button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Matching feed items against trigger references...</span>
        </div>
      ) : matchedItems && matchedItems.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600 font-medium">
            {matchedItems.length} matches found above {(minSimilarity * 100).toFixed(0)}% similarity
          </div>
          {matchedItems.map((item: any) => (
            <TriggerCard
              key={item.feedItemId}
              item={item}
              onApprove={() => handleApprove(item.feedItemId, item.bestTrigger?.brainId?.toString())}
              onDismiss={() => handleDismiss(item.feedItemId)}
              isUpdating={updatingId === item.feedItemId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-gray-500">No matches found at this similarity threshold.</p>
          <p className="text-xs mt-1 text-gray-400">Try lowering the minimum similarity or embedding more feed items.</p>
        </div>
      )}
    </div>
  );
}
