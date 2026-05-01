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
} from "lucide-react";

function similarityColor(sim: number): string {
  if (sim >= 0.55) return "text-green-400";
  if (sim >= 0.50) return "text-yellow-400";
  return "text-orange-400";
}

function similarityBadge(sim: number) {
  const pct = (sim * 100).toFixed(1);
  if (sim >= 0.55) return <Badge className="bg-green-900/50 text-green-300 border-green-700">{pct}%</Badge>;
  if (sim >= 0.50) return <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700">{pct}%</Badge>;
  return <Badge className="bg-orange-900/50 text-orange-300 border-orange-700">{pct}%</Badge>;
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

  return (
    <div className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
      {/* Header: News title + similarity score */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <h3 className="font-medium text-zinc-100 text-sm leading-tight truncate">
              {item.title}
            </h3>
          </div>
          <p className="text-xs text-zinc-400 line-clamp-2 ml-6">
            {item.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {similarityBadge(item.bestSimilarity)}
          {item.status === "approved" && (
            <Badge className="bg-green-900/30 text-green-400 border-green-800 text-xs">Approved</Badge>
          )}
          {item.status === "dismissed" && (
            <Badge className="bg-zinc-800 text-zinc-500 border-zinc-700 text-xs">Dismissed</Badge>
          )}
        </div>
      </div>

      {/* Best matching trigger */}
      {item.bestTrigger && (
        <div className="ml-6 mt-3 p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-400">Best Match: {item.bestTrigger.brainName}</span>
            <Badge variant="outline" className="text-xs ml-auto">
              {item.bestTrigger.signalType}
            </Badge>
          </div>
          <p className="text-xs text-zinc-300 mb-2">
            <span className="text-zinc-500">Trigger:</span> {item.bestTrigger.headline}
          </p>

          {/* A → B → Brain chain */}
          {item.bestTrigger.aEvent && (
            <div className="flex items-start gap-1.5 text-xs text-zinc-400 mt-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-orange-400 font-medium">A</span>
                <ArrowRight className="w-3 h-3" />
              </div>
              <span className="line-clamp-1">{item.bestTrigger.aEvent}</span>
            </div>
          )}
          {item.bestTrigger.bChallenge && (
            <div className="flex items-start gap-1.5 text-xs text-zinc-400 mt-1">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-yellow-400 font-medium">B</span>
                <ArrowRight className="w-3 h-3" />
              </div>
              <span className="line-clamp-1">{item.bestTrigger.bChallenge}</span>
            </div>
          )}
          {item.bestTrigger.brainConnection && (
            <div className="flex items-start gap-1.5 text-xs text-zinc-400 mt-1">
              <div className="flex items-center gap-1 flex-shrink-0">
                <Brain className="w-3 h-3 text-purple-400" />
                <ArrowRight className="w-3 h-3" />
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
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide details" : "Show more matches & details"}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            {/* Top 3 matches */}
            {item.top3Triggers && item.top3Triggers.length > 1 && (
              <div className="text-xs space-y-1">
                <span className="text-zinc-500 font-medium">Alternative matches:</span>
                {item.top3Triggers.slice(1).map((t: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-zinc-400 pl-2">
                    <span className={similarityColor(t.similarity)}>
                      {(t.similarity * 100).toFixed(1)}%
                    </span>
                    <span className="text-zinc-500">→</span>
                    <span className="truncate">{t.brainName}: {t.headline}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
              {item.source && <span>Source: {item.source}</span>}
              {item.publishedAt && <span>Date: {item.publishedAt}</span>}
              {item.newsQuery && <span>Query: {item.newsQuery}</span>}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
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
            variant="outline"
            className="text-green-400 border-green-800 hover:bg-green-900/30 h-7 text-xs"
            onClick={onApprove}
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-zinc-500 border-zinc-700 hover:bg-zinc-800 h-7 text-xs"
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          Trigger Review
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          News events matched against synthetic trigger references. Review and approve to create campaigns.
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Reference Triggers</div>
            <div className="text-lg font-bold text-zinc-100">{stats.totalReferences}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Feed Items</div>
            <div className="text-lg font-bold text-zinc-100">{stats.totalFeedItems || "—"}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Embedded</div>
            <div className="text-lg font-bold text-zinc-100">{stats.embeddedFeedItems || "—"}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" /> Approved
            </div>
            <div className="text-lg font-bold text-green-400">{stats.matchStats.approved}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-zinc-500" /> Dismissed
            </div>
            <div className="text-lg font-bold text-zinc-400">{stats.matchStats.dismissed}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Min Similarity:</span>
          <Select
            value={String(minSimilarity)}
            onValueChange={(v) => setMinSimilarity(parseFloat(v))}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
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
          <span className="text-xs text-zinc-500">Status:</span>
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
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
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
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-500">Matching feed items against trigger references...</span>
        </div>
      ) : matchedItems && matchedItems.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-zinc-400">
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
        <div className="text-center py-12 text-zinc-500">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No matches found at this similarity threshold.</p>
          <p className="text-xs mt-1">Try lowering the minimum similarity or embedding more feed items.</p>
        </div>
      )}
    </div>
  );
}
