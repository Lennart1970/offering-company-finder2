import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Decision = "call_today" | "park" | "not_relevant";

interface CompanyDecisionButtonsProps {
  companyId: number;
  searchId: number;
  companyName: string;
  hasSicCodes: boolean;
  hasNaicsCodes: boolean;
}

const REASON_CODES = [
  { code: "wrong_industry", label: "WRONG INDUSTRY", description: "SIC/NAICS codes don't match our target market" },
  { code: "too_small", label: "TOO SMALL", description: "Company is below our minimum size threshold" },
  { code: "wrong_geo", label: "WRONG GEOGRAPHY", description: "Company is outside our serviceable area" },
  { code: "competitor", label: "COMPETITOR", description: "This company competes with ConnectGroup" },
  { code: "already_customer", label: "ALREADY CUSTOMER", description: "We already work with this company" },
  { code: "other", label: "OTHER", description: "Different reason — add notes" },
] as const;

export default function CompanyDecisionButtons({
  companyId,
  searchId,
  companyName,
  hasSicCodes,
  hasNaicsCodes,
}: CompanyDecisionButtonsProps) {
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [reasonNotes, setReasonNotes] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const utils = trpc.useUtils();

  const { data: existingDecision, isLoading: decisionLoading } = trpc.companyFinder.getDecision.useQuery(
    { companyId },
  );

  const submitMutation = trpc.companyFinder.submitDecision.useMutation({
    onSuccess: (_, variables) => {
      utils.companyFinder.getDecision.invalidate({ companyId });
      utils.companyFinder.getSearchDecisions.invalidate();
      utils.companyFinder.getSearch.invalidate();
      utils.companyFinder.getExcludedCodes.invalidate();
      setShowReasonPicker(false);
      setReasonNotes("");
      setIsChanging(false);

      const labels: Record<Decision, string> = {
        call_today: "CALL TODAY",
        park: "PARKED",
        not_relevant: "NOT RELEVANT",
      };
      toast.success(`${companyName} → ${labels[variables.decision]}`);
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleDecision = useCallback(
    (decision: Decision) => {
      if (decision === "not_relevant") {
        setShowReasonPicker(true);
        return;
      }
      submitMutation.mutate({ companyId, searchId, decision });
    },
    [companyId, searchId, submitMutation]
  );

  const handleReasonSubmit = useCallback(
    (reasonCode: string) => {
      submitMutation.mutate({
        companyId,
        searchId,
        decision: "not_relevant",
        reasonCode,
        reasonNotes: reasonNotes.trim() || undefined,
      });
    },
    [companyId, searchId, reasonNotes, submitMutation]
  );

  const handleCancelReason = useCallback(() => {
    setShowReasonPicker(false);
    setReasonNotes("");
  }, []);

  if (decisionLoading) {
    return <div className="text-xs font-black opacity-50">...</div>;
  }

  // Show existing decision badge
  if (existingDecision && !isChanging) {
    const badges: Record<string, { label: string; style: string }> = {
      call_today: {
        label: "✓ CALL TODAY",
        style: "bg-green-600 text-white border-green-600",
      },
      park: {
        label: "⏸ PARKED",
        style: "bg-yellow-500 text-black border-yellow-500",
      },
      not_relevant: {
        label: "✕ NOT RELEVANT",
        style: "bg-red-600 text-white border-red-600",
      },
    };

    const badge = badges[existingDecision.decision] || badges.park;

    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-black border-2 px-3 py-1 ${badge.style}`}>
          {badge.label}
        </span>
        {existingDecision.reasonCode && (
          <span className="text-xs font-bold opacity-70">
            [{existingDecision.reasonCode.replace(/_/g, " ").toUpperCase()}]
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsChanging(true);
            submitMutation.reset();
          }}
          className="text-xs font-bold underline opacity-50 cursor-pointer"
        >
          CHANGE
        </button>
      </div>
    );
  }

  // Reason picker modal (inline)
  if (showReasonPicker) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-black">WHY NOT RELEVANT?</div>
          <button
            onClick={handleCancelReason}
            className="text-xs font-black underline hover:opacity-70"
          >
            CANCEL
          </button>
        </div>

        {/* Reason code buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {REASON_CODES.map((reason) => {
            const isWrongIndustry = reason.code === "wrong_industry";
            const hasIndustryCodes = hasSicCodes || hasNaicsCodes;

            return (
              <button
                key={reason.code}
                onClick={() => handleReasonSubmit(reason.code)}
                disabled={submitMutation.isPending}
                className={`text-left p-3 border-2 border-black font-black text-xs transition-colors hover:bg-black hover:text-white disabled:opacity-50 ${
                  isWrongIndustry && hasIndustryCodes
                    ? "border-red-600 bg-red-50 hover:bg-red-600"
                    : ""
                }`}
                title={reason.description}
              >
                <div>{reason.label}</div>
                {isWrongIndustry && hasIndustryCodes && (
                  <div className="text-[10px] font-bold mt-1 opacity-70">
                    → ADDS TO EXCLUSION LIST
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Optional notes */}
        <div className="flex gap-2">
          <input
            type="text"
            value={reasonNotes}
            onChange={(e) => setReasonNotes(e.target.value)}
            placeholder="Optional notes..."
            className="flex-1 text-xs font-bold border-2 border-black px-3 py-2 bg-transparent placeholder:opacity-40"
          />
        </div>
      </div>
    );
  }

  // Decision buttons
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        onClick={() => handleDecision("call_today")}
        disabled={submitMutation.isPending}
        className="text-xs font-black border-2 border-green-700 bg-green-700 text-white hover:bg-green-800 px-4 py-2 h-auto"
        size="sm"
      >
        ✓ CALL TODAY
      </Button>
      <Button
        onClick={() => handleDecision("park")}
        disabled={submitMutation.isPending}
        variant="outline"
        className="text-xs font-black border-2 border-black hover:bg-yellow-400 hover:border-yellow-400 px-4 py-2 h-auto"
        size="sm"
      >
        ⏸ PARK
      </Button>
      <Button
        onClick={() => handleDecision("not_relevant")}
        disabled={submitMutation.isPending}
        variant="outline"
        className="text-xs font-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 h-auto"
        size="sm"
      >
        ✕ NOT RELEVANT
      </Button>
    </div>
  );
}
