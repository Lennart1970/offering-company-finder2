import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function NationalScanSection() {
  const [showDetails, setShowDetails] = useState(false);

  // Get scan progress
  const { data: progress, refetch } = trpc.companyFinder.getNationalScanProgress.useQuery(undefined, {
    refetchInterval: (query) => {
      // Poll every 5 seconds while scan is running
      return query.state.data?.isRunning ? 5000 : false;
    },
  });

  // Start national scan mutation
  const startScanMutation = trpc.companyFinder.startNationalScan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowDetails(true);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to start scan: ${error.message}`);
    },
  });

  // Auto-expand details when scan is running
  useEffect(() => {
    if (progress?.isRunning) {
      setShowDetails(true);
    }
  }, [progress?.isRunning]);

  const isRunning = progress?.isRunning || false;
  const currentState = progress?.currentState || "";
  const currentStateIndex = progress?.currentStateIndex || 0;
  const totalStates = progress?.totalStates || 50;
  const totalCompaniesFound = progress?.totalCompaniesFound || 0;
  const completedStates = progress?.completedStates || [];
  const failedStates = progress?.failedStates || [];

  const progressPercentage = totalStates > 0 ? (currentStateIndex / totalStates) * 100 : 0;

  return (
    <div className="mb-12 border-4 border-black p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-2xl font-black">NATIONAL SCAN</div>
          <div className="text-sm font-bold text-muted-foreground mt-1">
            Automatically search all 50 US states (company retrieval only, no Deep Research)
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => startScanMutation.mutate({ testMode: true })}
            disabled={isRunning || startScanMutation.isPending}
            variant="outline"
            className="text-sm font-black border-2 border-black disabled:opacity-50"
          >
            {isRunning ? "SCAN IN PROGRESS..." : "TEST (2 STATES)"}
          </Button>
          <Button
            onClick={() => startScanMutation.mutate({ testMode: false })}
            disabled={isRunning || startScanMutation.isPending}
            className="text-sm font-black border-2 border-black bg-black text-white disabled:opacity-50"
          >
            {isRunning ? "SCAN IN PROGRESS..." : "START FULL SCAN (50 STATES) →"}
          </Button>
        </div>
      </div>

      {/* Progress Display */}
      {(isRunning || completedStates.length > 0) && (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-black">
                {isRunning ? `PROCESSING: ${currentState}` : "SCAN COMPLETE"}
              </div>
              <div className="text-sm font-black">
                {currentStateIndex} / {totalStates} STATES
              </div>
            </div>
            <div className="h-4 border-2 border-black bg-white">
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border-2 border-black p-4">
              <div className="text-xs font-black text-muted-foreground">COMPANIES FOUND</div>
              <div className="text-3xl font-black mt-1">{totalCompaniesFound.toLocaleString()}</div>
            </div>
            <div className="border-2 border-black p-4">
              <div className="text-xs font-black text-muted-foreground">COMPLETED</div>
              <div className="text-3xl font-black mt-1">{completedStates.length}</div>
            </div>
            <div className="border-2 border-black p-4">
              <div className="text-xs font-black text-muted-foreground">FAILED</div>
              <div className="text-3xl font-black mt-1 text-red-600">{failedStates.length}</div>
            </div>
          </div>

          {/* Details Toggle */}
          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="outline"
            className="text-xs font-black border-2 border-black w-full"
          >
            {showDetails ? "HIDE DETAILS ▲" : "SHOW DETAILS ▼"}
          </Button>

          {/* Detailed Progress */}
          {showDetails && (
            <div className="space-y-4 border-t-2 border-black pt-4">
              {/* Completed States */}
              {completedStates.length > 0 && (
                <div>
                  <div className="text-xs font-black mb-2">COMPLETED STATES ({completedStates.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {completedStates.map((state: string) => (
                      <span key={state} className="border border-green-600 text-green-600 px-2 py-1 text-xs font-bold">
                        {state}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed States */}
              {failedStates.length > 0 && (
                <div>
                  <div className="text-xs font-black mb-2 text-red-600">FAILED STATES ({failedStates.length})</div>
                  <div className="space-y-2">
                    {failedStates.map((failed: { state: string; error: string }) => (
                      <div key={failed.state} className="border border-red-600 p-2">
                        <div className="text-xs font-black text-red-600">{failed.state}</div>
                        <div className="text-xs font-bold text-muted-foreground">{failed.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estimated Completion */}
              {isRunning && progress?.estimatedCompletionAt && (
                <div className="border-2 border-black p-4">
                  <div className="text-xs font-black mb-1">ESTIMATED COMPLETION</div>
                  <div className="text-sm font-bold">
                    {new Date(progress.estimatedCompletionAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      {!isRunning && completedStates.length === 0 && (
        <div className="border-l-4 border-black pl-4 text-sm font-bold text-muted-foreground">
          <p className="mb-2">
            <strong className="font-black">What this does:</strong> Runs the ConnectGroup offering search across all 50 US states sequentially, storing company data in your database.
          </p>
          <p className="mb-2">
            <strong className="font-black">Time estimate:</strong> 2-4 hours for all 50 states (depends on Apollo API response times)
          </p>
          <p>
            <strong className="font-black">Cost:</strong> Apollo API credits only (~$0.01 per company found). Deep Research is NOT run automatically—you can selectively enrich companies later.
          </p>
        </div>
      )}
    </div>
  );
}
