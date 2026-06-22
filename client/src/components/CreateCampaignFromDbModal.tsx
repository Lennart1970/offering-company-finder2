import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import type { RouterInputs } from "@/lib/trpc";

const MAX = 100;

type CreateCampaignFromCompanyDbInput =
  RouterInputs["companyFinder"]["createCampaignFromCompanyDb"];

export type CampaignFromDbFilterParams = Omit<
  Extract<CreateCampaignFromCompanyDbInput["source"], { type: "filter" }>,
  "type"
>;

type BrainOption = { id: number; brainName: string; count?: number };

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "selection" | "filter";
  companyIds?: number[];
  filterParams?: CampaignFromDbFilterParams;
  companyCount: number;
  totalMatched?: number;
  defaultBrainId?: number | null;
  hasFilters?: boolean;
  onSuccess?: () => void;
};

export function CreateCampaignFromDbModal({
  open,
  onClose,
  mode,
  companyIds = [],
  filterParams,
  companyCount,
  totalMatched,
  defaultBrainId,
  hasFilters,
  onSuccess,
}: Props) {
  const [, navigate] = useLocation();
  const [campaignName, setCampaignName] = useState("");
  const [selectedBrainId, setSelectedBrainId] = useState<number | null>(defaultBrainId ?? null);

  const { data: meta } = trpc.companyFinder.getCompanyDbMeta.useQuery(undefined, {
    enabled: open,
  });
  const brains: BrainOption[] = meta?.brains ?? [];

  useEffect(() => {
    if (!open) return;
    const date = new Date().toLocaleDateString();
    setCampaignName(`Company DB — ${date}`);
    setSelectedBrainId(defaultBrainId ?? null);
  }, [open, defaultBrainId]);

  const utils = trpc.useUtils();
  const createCampaign = trpc.companyFinder.createCampaignFromCompanyDb.useMutation({
    onSuccess: (data) => {
      const cappedNote =
        data.capped && data.totalMatched
          ? ` (top ${data.companiesCopied} of ${data.totalMatched.toLocaleString()})`
          : "";
      toast.success(
        `Campaign created with ${data.companiesCopied} companies${cappedNote}`,
        {
          action: {
            label: "Open campaign",
            onClick: () => navigate(`/search-results/${data.searchId}`),
          },
        }
      );
      utils.companyFinder.getCompanyDb.invalidate();
      utils.companyFinder.getCompanyDbMeta.invalidate();
      onSuccess?.();
      onClose();
      navigate(`/search-results/${data.searchId}`);
    },
    onError: (err) => toast.error(`Failed to create campaign: ${err.message}`),
  });

  const effectiveCount =
    mode === "selection" ? companyIds.length : Math.min(companyCount, MAX);
  const filterTotal = totalMatched ?? companyCount;
  const isCapped = mode === "filter" && filterTotal > MAX;
  const overSelectionLimit = mode === "selection" && companyIds.length > MAX;
  const canSubmit =
    campaignName.trim().length > 0 &&
    selectedBrainId !== null &&
    effectiveCount > 0 &&
    !overSelectionLimit &&
    !createCampaign.isPending;

  const handleSubmit = () => {
    if (!selectedBrainId || !canSubmit) return;

    if (mode === "selection") {
      createCampaign.mutate({
        campaignName: campaignName.trim(),
        brainId: selectedBrainId,
        source: { type: "selection", companyIds },
      });
    } else if (filterParams) {
      const { sortBy, sortDir, ...rest } = filterParams;
      createCampaign.mutate({
        campaignName: campaignName.trim(),
        brainId: selectedBrainId,
        source: {
          type: "filter",
          sortBy,
          sortDir,
          ...rest,
        },
      });
    }
  };

  const sortLabel = filterParams?.sortBy ?? "fitScore";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New campaign from database</DialogTitle>
          <DialogDescription>
            Creates a new campaign with scores and briefs preserved — no re-scoring.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === "selection" ? (
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{companyIds.length}</span>{" "}
              {companyIds.length === 1 ? "company" : "companies"} selected
              {overSelectionLimit && (
                <span className="block text-red-600 mt-1">
                  Maximum {MAX} companies per campaign — deselect some first.
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              {isCapped ? (
                <>
                  <span className="font-semibold text-gray-900">{filterTotal.toLocaleString()}</span>{" "}
                  match — will use top <span className="font-semibold">{MAX}</span> sorted by{" "}
                  <span className="font-mono text-xs">{sortLabel}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900">{filterTotal.toLocaleString()}</span>{" "}
                  {filterTotal === 1 ? "company" : "companies"} will be added
                </>
              )}
              {hasFilters && (
                <span className="block text-gray-500 text-xs mt-1">Using current filters</span>
              )}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Campaign name</label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Germany Medical Devices Q2"
              maxLength={255}
            />
            <p className="text-xs text-gray-400">Saved as [DB] {campaignName || "…"}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Business Unit / Brain</label>
            <Select
              value={selectedBrainId?.toString() ?? ""}
              onValueChange={(v) => setSelectedBrainId(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a brain…" />
              </SelectTrigger>
              <SelectContent>
                {brains.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.brainName}
                    {b.count != null ? ` (${b.count})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={createCampaign.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createCampaign.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              `Create campaign (${effectiveCount})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
