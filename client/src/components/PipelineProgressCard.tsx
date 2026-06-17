import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type PipelineEnrichmentStats = {
  total?: number;
  enriched?: number;
  pending?: number;
  llmFitScored?: number;
  needsFit?: number;
  needsUrgency?: number;
  needsOutreach?: number;
  urgencyScored?: number;
  pipelineComplete?: number;
  remaining?: number;
  outreachReady?: number;
};

type PipelineProgressCardProps = {
  campaignName?: string | null;
  brainName?: string | null;
  stats?: PipelineEnrichmentStats | null;
  isJobRunning: boolean;
  onRunFullPipeline: () => void;
  onRunNext10: () => void;
  onCancel?: () => void;
  isStartingFull: boolean;
  isStartingNext10: boolean;
  isCancelling?: boolean;
  showCancel?: boolean;
};

function StepPill({
  label,
  count,
  active,
  title,
}: {
  label: string;
  count: number;
  active?: boolean;
  title?: string;
}) {
  return (
    <div
      className={`text-center min-w-[4.5rem] ${active ? "opacity-100" : "opacity-70"}`}
      title={title}
    >
      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</div>
      <div className="text-lg font-black text-gray-900">{count}</div>
    </div>
  );
}

export default function PipelineProgressCard({
  campaignName,
  brainName,
  stats,
  isJobRunning,
  onRunFullPipeline,
  onRunNext10,
  onCancel,
  isStartingFull,
  isStartingNext10,
  isCancelling,
  showCancel,
}: PipelineProgressCardProps) {
  const total = stats?.total ?? 0;
  const remaining = stats?.remaining ?? 0;
  const pipelineComplete = stats?.pipelineComplete ?? 0;
  const allDone = total > 0 && pipelineComplete >= total;

  const steps = [
    { label: "Found", count: total },
    { label: "Enriched", count: stats?.enriched ?? 0 },
    {
      label: "FIT",
      count: stats?.llmFitScored ?? 0,
      title: "AI fit scoring (LLM). Embedding similarity (SIM) on list rows is separate.",
    },
    { label: "Urgency", count: stats?.urgencyScored ?? 0 },
    { label: "Outreach", count: stats?.outreachReady ?? 0 },
  ];

  return (
    <div className="border-2 border-gray-200 bg-gray-50 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4 mb-4">
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Campaign</div>
          <div className="text-sm font-black text-black truncate border-2 border-gray-300 bg-white px-3 py-2">
            {campaignName || "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Business unit</div>
          <div className="text-sm font-bold text-black truncate border-2 border-gray-300 bg-gray-100 px-3 py-2">
            {brainName ?? "—"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 py-3 border-y border-gray-200">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <StepPill label={step.label} count={step.count} active={i <= 2 || step.count > 0} title={(step as { title?: string }).title} />
            {i < steps.length - 1 && <span className="text-gray-300 font-bold hidden sm:inline">→</span>}
          </div>
        ))}
      </div>

      {pipelineComplete === 0 && remaining > 0 && !isJobRunning && (
        <p className="text-xs text-muted-foreground mb-3">
          Full pipeline: enrich contact data → AI fit scoring → urgency research → personalised outreach.
          Runs in the background — you can leave this page.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {allDone ? (
          <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-300 px-3 py-2">
            Pipeline complete ✓
          </span>
        ) : remaining > 0 ? (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onRunFullPipeline}
                    disabled={isJobRunning}
                    className="text-sm px-4 py-2 font-black border-2 border-black bg-black text-white whitespace-nowrap"
                  >
                    {isStartingFull ? "STARTING..." : `Run full pipeline (${remaining})`}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm text-sm">
                  <p className="font-bold mb-1">Processes {remaining} companies:</p>
                  <ul className="space-y-0.5 text-xs">
                    {(stats?.pending ?? 0) > 0 && (
                      <li>• <strong>{stats!.pending}</strong> pending enrichment</li>
                    )}
                    {(stats?.needsFit ?? 0) > 0 && (
                      <li>• <strong>{stats!.needsFit}</strong> need AI fit scoring</li>
                    )}
                    {(stats?.needsUrgency ?? 0) > 0 && (
                      <li>• <strong>{stats!.needsUrgency}</strong> need urgency brief</li>
                    )}
                    {(stats?.needsOutreach ?? 0) > 0 && (
                      <li>• <strong>{stats!.needsOutreach}</strong> need outreach script</li>
                    )}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">Includes LLM fit scoring.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onRunNext10}
                    disabled={isJobRunning}
                    variant="outline"
                    className="text-sm px-4 py-2 font-black border-2 border-black whitespace-nowrap"
                  >
                    {isStartingNext10 ? "WORKING..." : "Process next 10"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-sm">
                  <p>Processes the next 10 companies through the full pipeline.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {showCancel && onCancel && (
              <Button
                onClick={onCancel}
                disabled={isCancelling}
                variant="outline"
                className="text-sm px-3 py-2 font-black border-2 border-red-600 text-red-600 hover:bg-red-50 whitespace-nowrap"
              >
                {isCancelling ? "CANCELLING..." : "Cancel"}
              </Button>
            )}
          </>
        ) : (
          <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-300 px-3 py-2">
            Pipeline complete ✓
          </span>
        )}
      </div>
    </div>
  );
}
