/**
 * NicheReview.tsx — Market Segments
 *
 * Displays niche clusters ranked by fit score against the active Offering Brain.
 * Each niche shows a dynamic breakdown of LLM-inferred scoring dimensions.
 *
 * Flow:
 *   1. User selects a search (or views all niches)
 *   2. Niches are listed ranked by fitScore descending
 *   3. Each niche card shows: name, score, dimension breakdown, reasoning
 *   4. User can trigger batch scoring or re-score individual niches
 *   5. User can create test niches manually (for development/testing)
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Network, RefreshCw, Plus, ChevronDown, ChevronUp, Loader2, Brain, Cpu, GitBranch, Layers, ChevronRight, Rocket } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreDimension {
  dimension: string;
  score: number;
  maxScore: number;
  weight: number;
  reasoning: string;
}

interface NicheItem {
  id: number;
  name: string;
  description?: string | null;
  companyCount: number;
  topKeywords: string[];
  sampleCompanies: string[];
  rationale?: string | null;
  fitScore?: number | null;
  fitReasoning?: string | null;
  scoreBreakdown: ScoreDimension[];
  scoredAt?: Date | null;
  searchId?: number | null;
  parentNicheId?: number | null;
}

// ── Score Color Helpers ───────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-700";
  if (score >= 50) return "text-yellow-700";
  if (score >= 25) return "text-orange-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 75) return "bg-green-50 border-green-300";
  if (score >= 50) return "bg-yellow-50 border-yellow-300";
  if (score >= 25) return "bg-orange-50 border-orange-300";
  return "bg-red-50 border-red-300";
}

function scoreBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 75) return "default";
  if (score >= 50) return "secondary";
  return "destructive";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong Fit";
  if (score >= 60) return "Good Fit";
  if (score >= 40) return "Moderate Fit";
  if (score >= 20) return "Weak Fit";
  return "Poor Fit";
}

// ── Dimension Bar ─────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: ScoreDimension }) {
  const pct = dim.maxScore > 0 ? Math.round((dim.score / dim.maxScore) * 100) : 0;
  const barColor =
    pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : pct >= 25 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-black uppercase tracking-wide text-foreground">{dim.dimension}</span>
        <span className="text-xs font-bold text-muted-foreground">
          {dim.score}/{dim.maxScore}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {dim.reasoning && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{dim.reasoning}</p>
      )}
    </div>
  );
}

// ── Niche Card ────────────────────────────────────────────────────────────────

function NicheCard({
  niche,
  rank,
  onRescore,
  rescoring,
  onSubCluster,
  subClustering,
  isChild,
  subClusterTargetSize,
  onSubClusterTargetSizeChange,
  onCreateCampaign,
  creatingCampaign,
}: {
  niche: NicheItem;
  rank: number;
  onRescore: (id: number) => void;
  rescoring: boolean;
  onSubCluster?: (id: number) => void;
  subClustering?: boolean;
  isChild?: boolean;
  subClusterTargetSize?: number;
  onSubClusterTargetSizeChange?: (size: number) => void;
  onCreateCampaign?: (id: number) => void;
  creatingCampaign?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasScore = niche.fitScore !== null && niche.fitScore !== undefined;
  const score = niche.fitScore ?? 0;

  return (
    <div
      className={`border-2 ${hasScore ? scoreBg(score) : "bg-white border-gray-200"} transition-all duration-200`}
    >
      {/* Header row */}
      <div className="p-4 flex items-start gap-4">
        {/* Rank */}
        <div className="text-2xl font-black text-muted-foreground w-8 shrink-0 pt-0.5">
          #{rank}
        </div>

        {/* Score circle */}
        <div className="shrink-0">
          {hasScore ? (
            <div className={`w-14 h-14 border-4 flex flex-col items-center justify-center ${score >= 75 ? "border-green-500" : score >= 50 ? "border-yellow-500" : score >= 25 ? "border-orange-500" : "border-red-500"}`}>
              <span className={`text-lg font-black leading-none ${scoreColor(score)}`}>{score}</span>
              <span className="text-[9px] font-bold text-muted-foreground">FIT</span>
            </div>
          ) : (
            <div className="w-14 h-14 border-4 border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-[9px] font-bold text-muted-foreground text-center">NOT SCORED</span>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-black text-base leading-tight">{niche.name}</h3>
              {hasScore && (
                <Badge
                  variant={scoreBadgeVariant(score)}
                  className="mt-1 text-[10px] font-black uppercase"
                >
                  {scoreLabel(score)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground font-bold">
                {niche.companyCount} co.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-bold"
                onClick={() => onRescore(niche.id)}
                disabled={rescoring}
              >
                {rescoring ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                <span className="ml-1">{hasScore ? "Re-score" : "Score"}</span>
              </Button>
              {/* Sub-cluster button — only for top-level segments */}
              {!isChild && onSubCluster && (
                <div className="flex items-center border border-purple-400 overflow-hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-none border-0 px-2"
                    onClick={() => onSubCluster(niche.id)}
                    disabled={subClustering || niche.companyCount < 9}
                    title={niche.companyCount < 9 ? "Need at least 9 assigned companies to sub-cluster" : `Will create ~${Math.ceil(niche.companyCount / (subClusterTargetSize ?? 300))} sub-niches of ~${subClusterTargetSize ?? 300} companies each`}
                  >
                    {subClustering ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Layers className="w-3 h-3" />
                    )}
                    <span className="ml-1">Sub-cluster</span>
                  </Button>
                  {onSubClusterTargetSizeChange && (
                    <div className="flex items-center gap-0.5 px-1.5 bg-purple-50 border-l border-purple-400 h-7">
                      <span className="text-[9px] font-black text-purple-500">~</span>
                      <input
                        type="number"
                        value={subClusterTargetSize ?? 300}
                        onChange={(e) => onSubClusterTargetSizeChange(Math.max(50, Math.min(2000, parseInt(e.target.value) || 300)))}
                        className="w-12 text-[10px] font-black text-center bg-transparent border-0 outline-none text-purple-700"
                        min={50}
                        max={2000}
                        step={50}
                        disabled={subClustering}
                        title="Target companies per sub-niche"
                      />
                      <span className="text-[9px] font-black text-purple-500">co</span>
                    </div>
                  )}
                </div>
              )}
              {/* Create Campaign button — only when fitScore >= 70 */}
              {onCreateCampaign && hasScore && score >= 70 && (
                <Button
                  size="sm"
                  className="h-7 text-xs font-black bg-green-700 text-white hover:bg-green-800 border-0 px-2"
                  onClick={() => onCreateCampaign(niche.id)}
                  disabled={creatingCampaign}
                  title={`Create a scoped campaign with all ${niche.companyCount} companies in this segment`}
                >
                  {creatingCampaign ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Rocket className="w-3 h-3" />
                  )}
                  <span className="ml-1">Create Campaign</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Keywords */}
          {niche.topKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {niche.topKeywords.slice(0, 6).map((kw, i) => (
                <span key={i} className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Sample companies */}
          {niche.sampleCompanies.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              e.g. {niche.sampleCompanies.slice(0, 3).join(", ")}
              {niche.sampleCompanies.length > 3 && ` +${niche.sampleCompanies.length - 3} more`}
            </p>
          )}
        </div>
      </div>

      {/* Expanded: score breakdown + reasoning */}
      {expanded && (
        <div className="border-t-2 border-current border-opacity-20 p-4 bg-white bg-opacity-60">
          {/* Fit reasoning */}
          {niche.fitReasoning && (
            <div className="mb-4 p-3 border-l-4 border-black bg-gray-50">
              <p className="text-xs font-black uppercase text-muted-foreground mb-1">Overall Assessment</p>
              <p className="text-sm leading-relaxed">{niche.fitReasoning}</p>
            </div>
          )}

          {/* Score breakdown */}
          {niche.scoreBreakdown.length > 0 ? (
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground mb-3">
                Score Breakdown ({niche.scoreBreakdown.length} dimensions)
              </p>
              {niche.scoreBreakdown.map((dim, i) => (
                <DimensionBar key={i} dim={dim} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-bold text-center py-4">
              No score breakdown yet — click Score to analyse this niche.
            </p>
          )}

          {/* Rationale */}
          {niche.rationale && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200">
              <p className="text-xs font-black uppercase text-muted-foreground mb-1">Cluster Rationale</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{niche.rationale}</p>
            </div>
          )}

          {/* Description */}
          {niche.description && (
            <div className="mt-3">
              <p className="text-xs font-black uppercase text-muted-foreground mb-1">Description</p>
              <p className="text-xs leading-relaxed">{niche.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Niche Dialog ───────────────────────────────────────────────────────

function CreateNicheDialog({
  searchId,
  onCreated,
}: {
  searchId?: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [samples, setSamples] = useState("");
  const [count, setCount] = useState("0");
  const [rationale, setRationale] = useState("");

  const createMutation = trpc.niche.create.useMutation({
    onSuccess: () => {
      toast.success("Niche created");
      setOpen(false);
      setName("");
      setDescription("");
      setKeywords("");
      setSamples("");
      setCount("0");
      setRationale("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-bold">
          <Plus className="w-4 h-4 mr-1" />
          Add Niche
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black">Create Niche Cluster</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-black uppercase mb-1 block">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Export + Manufacturing + Trade Finance"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="2-3 sentences describing this cluster..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase mb-1 block">Top Keywords</label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="export, manufacturing, ..."
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated</p>
            </div>
            <div>
              <label className="text-xs font-black uppercase mb-1 block">Company Count</label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                min="0"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase mb-1 block">Sample Companies</label>
            <Input
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              placeholder="Acme Corp, Beta Ltd, ..."
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated</p>
          </div>
          <div>
            <label className="text-xs font-black uppercase mb-1 block">Rationale</label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why these companies are grouped together..."
              rows={2}
            />
          </div>
          <Button
            className="w-full font-black"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                searchId,
                name: name.trim(),
                description: description.trim() || undefined,
                companyCount: parseInt(count) || 0,
                topKeywords: keywords
                  ? keywords.split(",").map((k) => k.trim()).filter(Boolean)
                  : undefined,
                sampleCompanies: samples
                  ? samples.split(",").map((s) => s.trim()).filter(Boolean)
                  : undefined,
                rationale: rationale.trim() || undefined,
              })
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Create Niche
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NicheReview() {
  const [location, navigate] = useLocation();
  const [selectedSearchId, setSelectedSearchId] = useState<number | null>(() => {
    // Auto-select searchId from URL param ?searchId=X
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("searchId");
    return sid ? parseInt(sid) : null;
  });
  const [rescoringId, setRescoringId] = useState<number | null>(null);
  const [scoringAll, setScoringAll] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [subClusteringId, setSubClusteringId] = useState<number | null>(null);
  // Target group size for Phase 1 clustering (derives K = ceil(seedCount / targetGroupSize))
  const [targetGroupSize, setTargetGroupSize] = useState<number>(300);
  // Per-niche target group size for sub-clustering
  const [subClusterTargetSize, setSubClusterTargetSize] = useState<number>(300);
  const [clusterResult, setClusterResult] = useState<{ nichesCreated: number; nichesScored: number; seedCount: number; totalCompanies: number } | null>(null);
  const [assignResult, setAssignResult] = useState<{ assigned: number; total: number } | null>(null);
  const [expandResult, setExpandResult] = useState<{ assigned: number; remaining: number; newNichesCreated?: number; newNicheNames?: string[] } | null>(null);
  const [subClusterResults, setSubClusterResults] = useState<Map<number, { childNichesCreated: number; companiesProcessed: number }>>(new Map());
  const [creatingCampaignId, setCreatingCampaignId] = useState<number | null>(null);

  // Fetch all searches for the selector
  const { data: searches } = trpc.companyFinder.getSearchHistory.useQuery();

  // Fetch niches — either by search or all
  const {
    data: niches,
    isLoading,
    refetch,
  } = trpc.niche.getAllNiches.useQuery(undefined, {
    enabled: !selectedSearchId,
  });

  const {
    data: searchNiches,
    isLoading: searchNichesLoading,
    refetch: refetchSearch,
  } = trpc.niche.getNiches.useQuery(
    { searchId: selectedSearchId! },
    { enabled: !!selectedSearchId }
  );

  const displayNiches: NicheItem[] = (selectedSearchId ? searchNiches : niches) ?? [];

  // Sort by fitScore descending (unscored at bottom)
  const sortedNiches = useMemo(() => {
    return [...displayNiches].sort((a, b) => {
      const sa = a.fitScore ?? -1;
      const sb = b.fitScore ?? -1;
      return sb - sa;
    });
  }, [displayNiches]);

  // Unassigned company count (for Phase 2 button)
  const { data: unassignedData, refetch: refetchUnassigned } = trpc.niche.getUnassignedCount.useQuery(
    { searchId: selectedSearchId! },
    { enabled: !!selectedSearchId }
  );

  const utils = trpc.useUtils();

  // Cluster companies into niches
  const clusterMutation = trpc.niche.clusterAndSaveNiches.useMutation({
    onSuccess: (data) => {
      setClustering(false);
      setClusterResult({
        nichesCreated: data.nichesCreated,
        nichesScored: data.nichesScored,
        seedCount: data.seedCount ?? data.companiesProcessed,
        totalCompanies: data.totalCompanies ?? data.companiesProcessed,
      });
      refetchUnassigned();
      toast.success(
        `Clustered ${data.seedCount ?? data.companiesProcessed} seed companies into ${data.nichesCreated} segments — ${data.nichesScored} scored`
      );
      if (selectedSearchId) refetchSearch();
      else refetch();
    },
    onError: (e) => {
      setClustering(false);
      toast.error(e.message);
    },
  });

  // Phase 2: Assign remaining companies
  const assignMutation = trpc.niche.assignRemainingCompanies.useMutation({
    onSuccess: (data) => {
      setAssigning(false);
      setAssignResult({ assigned: data.assigned, total: data.total ?? 0 });
      toast.success(data.message);
      refetchUnassigned();
      if (selectedSearchId) refetchSearch();
      else refetch();
    },
    onError: (e) => {
      setAssigning(false);
      toast.error(e.message);
    },
  });

  const handleCluster = () => {
    if (!selectedSearchId) {
      toast.error("Select a campaign first");
      return;
    }
    setClustering(true);
    setClusterResult(null);
    setAssignResult(null);
    clusterMutation.mutate({ searchId: selectedSearchId, autoScore: true, targetGroupSize });
  };

  const handleAssignRemaining = () => {
    if (!selectedSearchId) {
      toast.error("Select a campaign first");
      return;
    }
    setAssigning(true);
    setAssignResult(null);
    setExpandResult(null);
    assignMutation.mutate({ searchId: selectedSearchId });
  };

  // Expand Sample: assign next 500 unassigned companies (with discovery)
  const expandMutation = trpc.niche.expandClusterSample.useMutation({
    onSuccess: (data) => {
      setExpanding(false);
      setExpandResult({
        assigned: data.assigned,
        remaining: data.remaining,
        newNichesCreated: data.newNichesCreated,
        newNicheNames: data.newNicheNames,
      });
      toast.success(data.message);
      refetchUnassigned();
      if (selectedSearchId) refetchSearch();
      else refetch();
    },
    onError: (e) => {
      setExpanding(false);
      toast.error(e.message);
    },
  });

  // Sub-cluster a top-level segment
  const subClusterMutation = trpc.niche.subClusterNiche.useMutation({
    onSuccess: (data) => {
      const parentId = data.parentNicheId;
      setSubClusteringId(null);
      setSubClusterResults((prev) => {
        const next = new Map(prev);
        next.set(parentId, {
          childNichesCreated: data.childNichesCreated,
          companiesProcessed: data.companiesProcessed,
        });
        return next;
      });
      toast.success(
        `"${data.parentNicheName}" split into ${data.childNichesCreated} sub-niches from ${data.companiesProcessed.toLocaleString()} companies`
      );
      if (selectedSearchId) refetchSearch();
      else refetch();
    },
    onError: (e) => {
      setSubClusteringId(null);
      toast.error(e.message);
    },
  });

  const handleSubCluster = (parentNicheId: number) => {
    setSubClusteringId(parentNicheId);
    subClusterMutation.mutate({ parentNicheId, autoScore: true, targetGroupSize: subClusterTargetSize });
  };

  const handleExpandSample = () => {
    if (!selectedSearchId) {
      toast.error("Select a campaign first");
      return;
    }
    setExpanding(true);
    setExpandResult(null);
    expandMutation.mutate({ searchId: selectedSearchId, batchSize: 500 });
  };

  // Create Campaign from Niche
  const createCampaignMutation = trpc.niche.createCampaignFromNiche.useMutation({
    onSuccess: (data) => {
      setCreatingCampaignId(null);
      toast.success(
        `Campaign "${data.campaignName}" created with ${data.companiesCopied} companies. Opening...`,
        { duration: 4000 }
      );
      // Navigate to Search Results filtered to the new campaign
      setTimeout(() => navigate(`/search-results?searchId=${data.searchId}`), 1200);
    },
    onError: (e) => {
      setCreatingCampaignId(null);
      toast.error(e.message);
    },
  });

  const handleCreateCampaign = (nicheId: number) => {
    setCreatingCampaignId(nicheId);
    createCampaignMutation.mutate({ nicheId });
  };

  // Batch score all
  const scoreAllMutation = trpc.niche.scoreNiches.useMutation({
    onSuccess: (data) => {
      setScoringAll(false);
      toast.success(`Scored ${data.scored}/${data.total} niches${data.failed > 0 ? ` (${data.failed} failed)` : ""}`);
      if (selectedSearchId) refetchSearch();
      else refetch();
    },
    onError: (e) => {
      setScoringAll(false);
      toast.error(e.message);
    },
  });

  // Re-score single
  const rescoreMutation = trpc.niche.rescoreNiche.useMutation({
    onSuccess: (data) => {
      setRescoringId(null);
      toast.success(`${data.fitScore}/100 — scored with ${data.brainName}`);
      if (selectedSearchId) refetchSearch();
      else refetch();
    },
    onError: (e) => {
      setRescoringId(null);
      toast.error(e.message);
    },
  });

  const handleScoreAll = () => {
    if (!selectedSearchId) {
      toast.error("Select a search first to batch score its niches");
      return;
    }
    if (sortedNiches.length === 0) {
      toast.error("No niches in this search yet. Add niches manually or run the import pipeline first.");
      return;
    }
    setScoringAll(true);
    scoreAllMutation.mutate({ searchId: selectedSearchId });
  };

  const handleRescore = (nicheId: number) => {
    setRescoringId(nicheId);
    rescoreMutation.mutate({ nicheId });
  };

  const loading = isLoading || searchNichesLoading;

  // Stats
  const scoredCount = sortedNiches.filter((n) => n.fitScore !== null && n.fitScore !== undefined).length;
  const avgScore =
    scoredCount > 0
      ? Math.round(
          sortedNiches
            .filter((n) => n.fitScore !== null && n.fitScore !== undefined)
            .reduce((s, n) => s + (n.fitScore ?? 0), 0) / scoredCount
        )
      : null;
  const strongFit = sortedNiches.filter((n) => (n.fitScore ?? 0) >= 75).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-4 border-black bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-black">Market Segments</h1>
              <p className="text-xs text-muted-foreground font-bold">
                Niche clusters ranked by fit against your Offering Brain
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search selector */}
            <Select
              value={selectedSearchId ? String(selectedSearchId) : "all"}
              onValueChange={(v) => setSelectedSearchId(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-52 font-bold text-sm h-9">
                <SelectValue placeholder="All niches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All niches</SelectItem>
                {(searches as any[])?.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.offeringName || s.companyWebsite || String(s.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* PRIMARY: Cluster Companies (Phase 1) — with target group size input */}
            <div className="flex items-center border-2 border-black overflow-hidden">
              <Button
                size="sm"
                className="font-black bg-black text-white hover:bg-gray-800 border-0 rounded-none h-9"
                onClick={handleCluster}
                disabled={clustering || assigning || !selectedSearchId}
              >
                {clustering ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Cpu className="w-4 h-4 mr-2" />
                )}
                {clustering ? "Clustering..." : "Cluster Seed Sample"}
              </Button>
              <div className="flex items-center gap-1 px-2 bg-gray-100 border-l-2 border-black h-9">
                <span className="text-[10px] font-black text-gray-600 whitespace-nowrap">~</span>
                <input
                  type="number"
                  value={targetGroupSize}
                  onChange={(e) => setTargetGroupSize(Math.max(50, Math.min(2000, parseInt(e.target.value) || 300)))}
                  className="w-14 text-xs font-black text-center bg-transparent border-0 outline-none"
                  min={50}
                  max={2000}
                  step={50}
                  title="Target companies per segment (derives number of clusters automatically)"
                  disabled={clustering}
                />
                <span className="text-[10px] font-black text-gray-600 whitespace-nowrap">co/seg</span>
              </div>
            </div>

            {/* PHASE 2: Expand Sample (+500) — iterative batch assignment */}
            {selectedSearchId && sortedNiches.length > 0 && unassignedData && unassignedData.unassigned > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="font-black border-2 border-blue-600 text-blue-700 hover:bg-blue-50 bg-white"
                onClick={handleExpandSample}
                disabled={expanding || assigning || clustering}
              >
                {expanding ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <GitBranch className="w-4 h-4 mr-2" />
                )}
                {expanding ? "Expanding..." : "Expand Sample (+500)"}
              </Button>
            )}

            {/* PHASE 2: Assign Remaining — assign ALL unassigned at once */}
            {selectedSearchId && sortedNiches.length > 0 && unassignedData && unassignedData.unassigned > 0 && (
              <Button
                size="sm"
                className="font-black bg-blue-700 text-white hover:bg-blue-800 border-2 border-blue-700"
                onClick={handleAssignRemaining}
                disabled={assigning || expanding || clustering}
              >
                {assigning ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <GitBranch className="w-4 h-4 mr-2" />
                )}
                {assigning
                  ? "Assigning..."
                  : `Assign All (${unassignedData.unassigned.toLocaleString()})`}
              </Button>
            )}

            <CreateNicheDialog
              searchId={selectedSearchId ?? undefined}
              onCreated={() => {
                if (selectedSearchId) refetchSearch();
                else refetch();
              }}
            />

            <Button
              size="sm"
              variant="outline"
              className="font-black border-2 border-black"
              onClick={handleScoreAll}
              disabled={scoringAll || !selectedSearchId || sortedNiches.length === 0}
            >
              {scoringAll ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Brain className="w-4 h-4 mr-2" />
              )}
              Re-score All
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        {sortedNiches.length > 0 && (
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-200">
            <div>
              <span className="text-xs font-black text-muted-foreground">TOTAL NICHES</span>
              <div className="text-lg font-black">{sortedNiches.length}</div>
            </div>
            <div>
              <span className="text-xs font-black text-muted-foreground">SCORED</span>
              <div className="text-lg font-black">{scoredCount}</div>
            </div>
            {avgScore !== null && (
              <div>
                <span className="text-xs font-black text-muted-foreground">AVG FIT SCORE</span>
                <div className={`text-lg font-black ${scoreColor(avgScore)}`}>{avgScore}/100</div>
              </div>
            )}
            {strongFit > 0 && (
              <div>
                <span className="text-xs font-black text-muted-foreground">STRONG FIT (≥75)</span>
                <div className="text-lg font-black text-green-700">{strongFit}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Clustering progress banner */}
        {clustering && (
          <div className="mb-4 border-4 border-black bg-black text-white px-6 py-4 flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin shrink-0" />
            <div>
              <p className="font-black">Clustering in progress...</p>
              <p className="text-sm opacity-70">
                Generating embeddings → k-means clustering → naming segments → scoring against Offering Brain.
                This takes 30–120 seconds depending on company count.
              </p>
            </div>
          </div>
        )}

        {/* Cluster result summary */}
        {clusterResult && !clustering && (
          <div className="mb-4 border-4 border-green-600 bg-green-50 px-6 py-4">
            <p className="font-black text-green-800">
              Phase 1 complete — {clusterResult.seedCount.toLocaleString()} seed companies grouped into {clusterResult.nichesCreated} segments, {clusterResult.nichesScored} scored.
            </p>
            {clusterResult.totalCompanies > clusterResult.seedCount && (
              <p className="text-sm text-green-700 mt-1">
                {(clusterResult.totalCompanies - clusterResult.seedCount).toLocaleString()} of {clusterResult.totalCompanies.toLocaleString()} companies not yet assigned —
                use <strong>Assign Remaining</strong> to assign all at once, or <strong>Expand Sample (+500)</strong> to refine clusters first.
              </p>
            )}
          </div>
        )}

        {/* Expand Sample progress banner */}
        {expanding && (
          <div className="mb-4 border-4 border-blue-600 bg-blue-50 text-blue-800 px-6 py-4 flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin shrink-0" />
            <div>
              <p className="font-black">Expanding sample by 500 companies...</p>
              <p className="text-sm opacity-70">
                Generating embeddings and assigning the next batch to the nearest cluster centroid.
              </p>
            </div>
          </div>
        )}

        {/* Expand Sample result summary */}
        {expandResult && !expanding && (
          <div className="mb-4 border-4 border-blue-600 bg-blue-50 px-6 py-4">
            <p className="font-black text-blue-800">
              Expanded — {expandResult.assigned.toLocaleString()} more companies assigned.
              {(expandResult.newNichesCreated ?? 0) > 0 && (
                <span className="text-purple-700 font-black"> {expandResult.newNichesCreated} new segment{expandResult.newNichesCreated! > 1 ? "s" : ""} discovered: {expandResult.newNicheNames?.join(", ")}.</span>
              )}
            </p>
            {expandResult.remaining > 0 && (
              <p className="text-sm text-blue-700 mt-1">{expandResult.remaining.toLocaleString()} still unassigned — expand again or use Assign All.</p>
            )}
            {expandResult.remaining === 0 && (
              <p className="text-sm text-blue-700 mt-1">All companies are now assigned.</p>
            )}
          </div>
        )}

        {/* Phase 2 (Assign All) progress banner */}
        {assigning && (
          <div className="mb-4 border-4 border-blue-700 bg-blue-700 text-white px-6 py-4 flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin shrink-0" />
            <div>
              <p className="font-black">Assigning all remaining companies...</p>
              <p className="text-sm opacity-70">
                Generating embeddings and assigning each company to the nearest cluster centroid.
                This may take a few minutes for large datasets.
              </p>
            </div>
          </div>
        )}

        {/* Phase 2 result summary */}
        {assignResult && !assigning && (
          <div className="mb-4 border-4 border-blue-600 bg-blue-50 px-6 py-4">
            <p className="font-black text-blue-800">
              Done — {assignResult.assigned.toLocaleString()} companies assigned to segments.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedNiches.length === 0 && !clustering ? (
          <div className="text-center py-20 border-4 border-dashed border-gray-200">
            <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-black mb-2">No segments yet</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Select a campaign above and click <strong>Cluster Seed Sample</strong> to cluster a representative
              sample of your companies into market segments, then use <strong>Assign Remaining</strong> to
              assign the rest by proximity.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                className="font-black bg-black text-white border-2 border-black"
                onClick={handleCluster}
                disabled={!selectedSearchId || clustering}
              >
                <Cpu className="w-4 h-4 mr-2" />
                Cluster Seed Sample
              </Button>
              <CreateNicheDialog
                searchId={selectedSearchId ?? undefined}
                onCreated={() => {
                  if (selectedSearchId) refetchSearch();
                  else refetch();
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedNiches
              .filter((n) => !n.parentNicheId) // top-level only
              .map((niche, i) => {
                const subResult = subClusterResults.get(niche.id);
                const childNiches = sortedNiches.filter((n) => n.parentNicheId === niche.id);
                return (
                  <div key={niche.id}>
                    <NicheCard
                      niche={niche}
                      rank={i + 1}
                      onRescore={handleRescore}
                      rescoring={rescoringId === niche.id}
                      onSubCluster={handleSubCluster}
                      subClustering={subClusteringId === niche.id}
                      subClusterTargetSize={subClusterTargetSize}
                      onSubClusterTargetSizeChange={setSubClusterTargetSize}
                      onCreateCampaign={handleCreateCampaign}
                      creatingCampaign={creatingCampaignId === niche.id}
                    />
                    {/* Sub-cluster progress banner */}
                    {subClusteringId === niche.id && (
                      <div className="ml-6 mt-1 border-2 border-purple-400 bg-purple-50 px-4 py-3 flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-700 shrink-0" />
                        <p className="text-sm font-black text-purple-800">
                          Sub-clustering "{niche.name}"... generating embeddings and splitting into sub-niches.
                        </p>
                      </div>
                    )}
                    {/* Sub-cluster result banner */}
                    {subResult && subClusteringId !== niche.id && (
                      <div className="ml-6 mt-1 border-2 border-purple-400 bg-purple-50 px-4 py-2">
                        <p className="text-xs font-black text-purple-800">
                          Split into {subResult.childNichesCreated} sub-niches from {subResult.companiesProcessed.toLocaleString()} companies.
                        </p>
                      </div>
                    )}
                    {/* Child niches */}
                    {childNiches.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1 border-l-4 border-purple-300 pl-3">
                        <p className="text-[10px] font-black uppercase text-purple-600 mb-2 flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" />
                          {childNiches.length} sub-niches
                        </p>
                        {childNiches.map((child, ci) => (
                          <NicheCard
                            key={child.id}
                            niche={child}
                            rank={ci + 1}
                            onRescore={handleRescore}
                            rescoring={rescoringId === child.id}
                            isChild
                            onCreateCampaign={handleCreateCampaign}
                            creatingCampaign={creatingCampaignId === child.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
