import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Zap, ExternalLink, Sparkles, ChevronRight } from "lucide-react";

interface Brain {
  id: number;
  brainName: string;
  count?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  brains?: Brain[];
}

export function SimilaritySearchModal({ open, onClose, brains = [] }: Props) {
  const [, navigate] = useLocation();
  const [selectedBrainId, setSelectedBrainId] = useState<number | null>(null);
  const [minSim, setMinSim] = useState(55);
  const [maxResults, setMaxResults] = useState(200);
  const [campaignName, setCampaignName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewed, setPreviewed] = useState(false);

  // Fetch all brains (not just those with brain outputs) for the picker
  const { data: allBrains } = trpc.companyFinder.getCompanyDbMeta.useQuery(undefined, {
    select: (d) => d.brains,
  });

  const preview = trpc.companyFinder.previewSimilaritySearch.useQuery(
    { brainId: selectedBrainId!, minSim, maxResults },
    {
      enabled: false, // manual trigger only
      retry: false,
    }
  );

  const createCampaign = trpc.companyFinder.createCampaignFromSimilarity.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign created with ${data.companiesCreated} companies — FIT scoring queued`);
      onClose();
      navigate(`/search/${data.searchId}`);
    },
    onError: (err) => {
      toast.error(`Failed to create campaign: ${err.message}`);
    },
  });

  const handlePreview = useCallback(async () => {
    if (!selectedBrainId) {
      toast.error("Please select a brain first");
      return;
    }
    await preview.refetch();
    setPreviewed(true);
    // Select all by default
    if (preview.data?.companies) {
      setSelectedIds(new Set(preview.data.companies.map((c) => c.id)));
    }
  }, [selectedBrainId, preview]);

  // After refetch, update selection
  const companies = preview.data?.companies ?? [];
  const totalMatched = preview.data?.totalMatched ?? 0;

  const toggleAll = () => {
    if (selectedIds.size === companies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map((c) => c.id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleCreate = () => {
    if (!selectedBrainId) return;
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Please select at least one company");
      return;
    }
    createCampaign.mutate({
      brainId: selectedBrainId,
      campaignName: campaignName.trim(),
      companyIds: Array.from(selectedIds),
    });
  };

  const brainList = allBrains && allBrains.length > 0 ? allBrains : brains;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Create Campaign from DB Similarity
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 mt-0.5">
            Rank all enriched companies in your database by cosine similarity to a Brain — no Apollo calls needed.
          </DialogDescription>
        </DialogHeader>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-end gap-4">
          {/* Brain picker */}
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-medium text-gray-600">Brain</label>
            <Select
              value={selectedBrainId ? String(selectedBrainId) : ""}
              onValueChange={(v) => { setSelectedBrainId(Number(v)); setPreviewed(false); }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a brain…" />
              </SelectTrigger>
              <SelectContent>
                {brainList.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)} className="text-xs">
                    {b.brainName}
                    {b.count !== undefined && (
                      <span className="ml-1 text-gray-400">({b.count})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min SIM threshold */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Min SIM <span className="text-indigo-600 font-semibold">{minSim}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={30}
                max={90}
                step={5}
                value={minSim}
                onChange={(e) => { setMinSim(Number(e.target.value)); setPreviewed(false); }}
                className="w-28 accent-indigo-500"
              />
            </div>
          </div>

          {/* Max results */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Max companies</label>
            <Select
              value={String(maxResults)}
              onValueChange={(v) => { setMaxResults(Number(v)); setPreviewed(false); }}
            >
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 150, 200, 300, 500].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 self-end"
            onClick={handlePreview}
            disabled={!selectedBrainId || preview.isFetching}
          >
            {preview.isFetching ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Zap className="w-3 h-3 mr-1" />
            )}
            Preview
          </Button>
        </div>

        {/* Results table */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {preview.isFetching && (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Scanning {14424}+ company embeddings…</span>
            </div>
          )}
          {preview.isError && (
            <div className="py-8 text-center text-red-500 text-sm">
              {preview.error?.message}
            </div>
          )}
          {previewed && !preview.isFetching && companies.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">
              No companies matched the threshold. Try lowering Min SIM.
            </div>
          )}
          {previewed && !preview.isFetching && companies.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  Showing <strong>{companies.length}</strong> of <strong>{totalMatched}</strong> matches above SIM {minSim}
                </span>
                <button
                  onClick={toggleAll}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {selectedIds.size === companies.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-left">
                    <th className="py-1.5 pr-2 w-6">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === companies.length && companies.length > 0}
                        onChange={toggleAll}
                        className="accent-indigo-500"
                      />
                    </th>
                    <th className="py-1.5 pr-3">Company</th>
                    <th className="py-1.5 pr-3">Location</th>
                    <th className="py-1.5 pr-3">Sector</th>
                    <th className="py-1.5 pr-3 text-right">SIM</th>
                    <th className="py-1.5 text-right">FIT LLM</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedIds.has(c.id) ? "bg-indigo-50/40" : ""}`}
                      onClick={() => toggleOne(c.id)}
                    >
                      <td className="py-1.5 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-indigo-500"
                        />
                      </td>
                      <td className="py-1.5 pr-3 font-medium text-gray-800">
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[180px]">{c.name}</span>
                          {c.websiteUrl && (
                            <a
                              href={c.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-400 hover:text-indigo-500 shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {c.generatedWithBrainName && (
                          <div className="text-gray-400 text-[10px] truncate max-w-[180px]">{c.generatedWithBrainName}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-500">
                        {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-500 truncate max-w-[120px]">
                        {c.sector || "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <span className={`font-semibold ${c.simScore >= 70 ? "text-emerald-600" : c.simScore >= 60 ? "text-indigo-600" : "text-gray-500"}`}>
                          {c.simScore}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        {c.fitScore != null ? (
                          <span className={`font-semibold ${c.fitScore >= 75 ? "text-emerald-600" : c.fitScore >= 55 ? "text-amber-600" : "text-gray-400"}`}>
                            {c.fitScore}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer: campaign name + create */}
        {previewed && companies.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
            <div className="flex-1">
              <Input
                placeholder="Campaign name…"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              onClick={handleCreate}
              disabled={createCampaign.isPending || selectedIds.size === 0 || !campaignName.trim()}
            >
              {createCampaign.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <ChevronRight className="w-3 h-3 mr-1" />
              )}
              Create Campaign
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
