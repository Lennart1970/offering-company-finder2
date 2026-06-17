import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FitScoreBadgeProps = {
  fitScore?: number | null;
  fitScoreSource?: string | null;
  similarityScore?: number | null;
  compact?: boolean;
};

export default function FitScoreBadge({
  fitScore,
  fitScoreSource,
  similarityScore,
  compact,
}: FitScoreBadgeProps) {
  if (fitScoreSource === "llm" && fitScore != null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`font-black text-blue-600 shrink-0 ${compact ? "text-[10px]" : "text-xs"}`}>
              FIT {fitScore}
            </span>
          </TooltipTrigger>
          <TooltipContent>LLM ICP fit score (Grok deep analysis)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const simScore = similarityScore ?? (fitScoreSource === "embed" ? fitScore : null);
  if (simScore != null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`font-black text-gray-400 shrink-0 ${compact ? "text-[10px]" : "text-xs"}`}>
              SIM {simScore}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Embedding similarity only — run the full pipeline for AI fit scoring
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
