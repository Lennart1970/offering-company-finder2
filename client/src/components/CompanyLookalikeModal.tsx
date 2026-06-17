import { useState, useCallback, useEffect } from "react";
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
import { Loader2, Zap, ExternalLink, Copy, ChevronRight } from "lucide-react";

export interface LookalikeSeed {
  id: number;
  name: string;
  websiteUrl?: string | null;
  primaryDomain?: string | null;
  country?: string | null;
  sector?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  seed: LookalikeSeed | null;
  defaultBrainId?: number | null;
}

export function CompanyLookalikeModal({ open, onClose, seed, defaultBrainId }: Props) {
  const [, navigate] = useLocation();
  const [selectedBrainId, setSelectedBrainId] = useState<number | null>(defaultBrainId ?? null);
  const [minSim, setMinSim] = useState(55);
  const [maxResults, setMaxResults] = useState(200);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterSector, setFilterSector] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewed, setPreviewed] = useState(false);

  const { data: meta } = trpc.companyFinder.getCompanyDbMeta.useQuery(undefined, {
    enabled: open,
  });

  useEffect(() => {
    if (open && seed) {
      setCampaignName(`Like ${seed.name}`);
      setPreviewed(false);
      setSelectedIds(new Set());
      setFilterCountry("");
      setFilterSector("");
    }
  }, [open, seed?.id, seed?.name]);

  useEffect(() => {
    if (defaultBrainId && !selectedBrainId) {
      setSelectedBrainId(defaultBrainId);
    }
  }, [defaultBrainId, selectedBrainId]);

  const preview = trpc.companyFinder.previewLookalikeSearch.useQuery(
    {
      seedCompanyId: seed?.id ?? 0,
      minSim,
      maxResults,
      country: filterCountry || undefined,
      sector: filterSector || undefined,
    },
    {
      enabled: false,
      retry: false,
    },
  );

  const createCampaign = trpc.companyFinder.createCampaignFromLookalike.useMutation({
    onSuccess: (data) => {
      toast.success(`Lookalike campaign created with ${data.companiesCreated} companies — FIT scoring queued`);
      onClose();
      navigate(`/search-results/${data.searchId}`);
    },
    onError: (err) => {
      toast.error(`Failed to create campaign: ${err.message}`);
    },
  });

  const handlePreview = useCallback(async () => {
    if (!seed) return;
    const result = await preview.refetch();
    setPreviewed(true);
    if (result.data?.companies) {
      setSelectedIds(new Set(result.data.companies.map((c) => c.id)));
    }
  }, [seed, preview]);

  const companies = preview.data?.companies ?? [];
  const totalMatched = preview.data?.totalMatched ?? 0;
  const brainList = meta?.brains ?? [];

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
    if (!seed || !selectedBrainId) return;
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Please select at least one company");
      return;
    }

    const similarityScores: Record<string, number> = {};
    for (const c of companies) {
      if (selectedIds.has(c.id)) {
        similarityScores[String(c.id)] = c.simScore;
      }
    }

    createCampaign.mutate({
      seedCompanyId: seed.id,
      brainId: selectedBrainId,
      campaignName: campaignName.trim(),
      companyIds: Array.from(selectedIds),
      similarityScores,
    });
  };

  if (!seed) return null;

  const seedDomain =
    seed.primaryDomain ||
    (seed.websiteUrl ? seed.websiteUrl.replace(/^https?:\/\//, "").split("/")[0] : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Copy className="w-4 h-4 text-purple-500" />
            Find companies like <span className="text-purple-700">{seed.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 mt-0.5">
            {[seedDomain, seed.country, seed.sector].filter(Boolean).join(" · ") ||
              "Vector similarity against companies in your database"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600">Brain</label>
            <Select
              value={selectedBrainId ? String(selectedBrainId) : ""}
              onValueChange={(v) => {
                setSelectedBrainId(Number(v));
                setPreviewed(false);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a brain…" />
              </SelectTrigger>
              <SelectContent>
                {brainList.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)} className="text-xs">
                    {b.brainName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Min SIM <span className="text-purple-600 font-semibold">{minSim}</span>
            </label>
            <input
              type="range"
              min={30}
              max={90}
              step={5}
              value={minSim}
              onChange={(e) => {
                setMinSim(Number(e.target.value));
                setPreviewed(false);
              }}
              className="w-28 accent-purple-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Max companies</label>
            <Select
              value={String(maxResults)}
              onValueChange={(v) => {
                setMaxResults(Number(v));
                setPreviewed(false);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 150, 200, 300, 500].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-600">Country</label>
            <Select
              value={filterCountry || "__any__"}
              onValueChange={(v) => {
                setFilterCountry(v === "__any__" ? "" : v);
                setPreviewed(false);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__" className="text-xs">
                  Any country
                </SelectItem>
                {(meta?.countries ?? []).map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-600">Sector</label>
            <Select
              value={filterSector || "__any__"}
              onValueChange={(v) => {
                setFilterSector(v === "__any__" ? "" : v);
                setPreviewed(false);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__" className="text-xs">
                  Any sector
                </SelectItem>
                {(meta?.sectors ?? []).map((s) => (
                  <SelectItem key={s.sector} value={s.sector} className="text-xs">
                    <span className="capitalize">{s.sector}</span><span className="ml-1 text-gray-400">({s.count.toLocaleString()})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 self-end"
            onClick={handlePreview}
            disabled={preview.isFetching}
          >
            {preview.isFetching ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Zap className="w-3 h-3 mr-1" />
            )}
            Preview
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {preview.isFetching && (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Scanning company embeddings…</span>
            </div>
          )}
          {preview.isError && (
            <div className="py-8 text-center text-red-500 text-sm">{preview.error?.message}</div>
          )}
          {previewed && !preview.isFetching && companies.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">
              No similar companies matched. Try lowering Min SIM or removing filters.
            </div>
          )}
          {previewed && !preview.isFetching && companies.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  Showing <strong>{companies.length}</strong> of <strong>{totalMatched}</strong> matches
                  above SIM {minSim}
                </span>
                <button onClick={toggleAll} className="text-xs text-purple-600 hover:underline">
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
                        className="accent-purple-500"
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
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedIds.has(c.id) ? "bg-purple-50/40" : ""}`}
                      onClick={() => toggleOne(c.id)}
                    >
                      <td className="py-1.5 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-purple-500"
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
                              className="text-gray-400 hover:text-purple-500 shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-gray-500">
                        {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-500 truncate max-w-[120px]">
                        {c.sector || "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <span
                          className={`font-semibold ${c.simScore >= 70 ? "text-emerald-600" : c.simScore >= 60 ? "text-purple-600" : "text-gray-500"}`}
                        >
                          {c.simScore}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        {c.fitScore != null ? (
                          <span
                            className={`font-semibold ${c.fitScore >= 75 ? "text-emerald-600" : c.fitScore >= 55 ? "text-amber-600" : "text-gray-400"}`}
                          >
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
            <span className="text-xs text-gray-400 shrink-0">{selectedIds.size} selected</span>
            <Button
              size="sm"
              className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              onClick={handleCreate}
              disabled={
                createCampaign.isPending ||
                selectedIds.size === 0 ||
                !campaignName.trim() ||
                !selectedBrainId
              }
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
