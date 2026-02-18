import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Exclusions() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: excludedCodes, isLoading } = trpc.companyFinder.getExcludedCodes.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const utils = trpc.useUtils();

  const removeMutation = trpc.companyFinder.removeExcludedCode.useMutation({
    onSuccess: () => {
      utils.companyFinder.getExcludedCodes.invalidate();
      toast.success("Code removed from exclusion list");
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl font-black animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
        <h1 className="text-6xl font-black">[LOGIN REQUIRED]</h1>
        <Button
          onClick={() => (window.location.href = getLoginUrl())}
          className="text-2xl px-12 py-8 font-black border-4 border-black hover:bg-black hover:text-white"
          variant="outline"
        >
          [LOGIN]
        </Button>
      </div>
    );
  }

  // Separate SIC and NAICS codes
  const sicCodes = excludedCodes?.filter((c) => c.codeType === "sic") || [];
  const naicsCodes = excludedCodes?.filter((c) => c.codeType === "naics") || [];
  const totalCodes = excludedCodes?.length || 0;
  const totalRejections = excludedCodes?.reduce((sum, c) => sum + c.rejectionCount, 0) || 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b-8 border-black p-8">
        <div className="container flex justify-between items-center">
          <h1 className="text-5xl md:text-7xl font-black leading-none">[CF]</h1>
          <div className="flex items-center gap-6">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="text-lg px-6 py-4 font-black border-4 border-black"
            >
              SEARCH
            </Button>
            <Button
              onClick={() => navigate("/history")}
              variant="outline"
              className="text-lg px-6 py-4 font-black border-4 border-black"
            >
              HISTORY
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-16">
        {/* Title */}
        <div className="mb-16">
          <h2 className="text-[8vw] md:text-8xl font-black leading-none mb-4">
            EXCLUSION
            <br />
            LIST
          </h2>
          <div className="border-l-8 border-black pl-8">
            <p className="text-xl md:text-2xl font-bold text-muted-foreground">
              SIC/NAICS codes excluded from future searches based on your feedback
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="border-4 border-black p-6">
            <div className="text-sm font-black mb-1">TOTAL EXCLUDED</div>
            <div className="text-4xl font-black">{totalCodes}</div>
          </div>
          <div className="border-4 border-black p-6">
            <div className="text-sm font-black mb-1">SIC CODES</div>
            <div className="text-4xl font-black">{sicCodes.length}</div>
          </div>
          <div className="border-4 border-black p-6">
            <div className="text-sm font-black mb-1">NAICS CODES</div>
            <div className="text-4xl font-black">{naicsCodes.length}</div>
          </div>
          <div className="border-4 border-black p-6">
            <div className="text-sm font-black mb-1">TOTAL REJECTIONS</div>
            <div className="text-4xl font-black">{totalRejections}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-2xl font-black animate-pulse">LOADING EXCLUSION LIST...</div>
        ) : totalCodes === 0 ? (
          <div className="border-4 border-black p-12 text-center">
            <div className="text-4xl font-black mb-4">NO EXCLUSIONS YET</div>
            <div className="text-xl font-bold text-muted-foreground mb-8">
              Mark companies as "Not Relevant → Wrong Industry" to automatically build your exclusion list
            </div>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="text-xl px-8 py-6 font-black border-4 border-black"
            >
              START SEARCHING
            </Button>
          </div>
        ) : (
          <div className="space-y-12">
            {/* SIC Codes Section */}
            {sicCodes.length > 0 && (
              <div>
                <h3 className="text-3xl font-black mb-6 border-b-4 border-black pb-4">
                  SIC CODES [{sicCodes.length}]
                </h3>
                <div className="space-y-3">
                  {sicCodes.map((code) => (
                    <div
                      key={code.id}
                      className="border-4 border-black p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-3xl font-black min-w-[120px]">{code.code}</div>
                        <div>
                          {code.codeDescription && (
                            <div className="text-sm font-bold">{code.codeDescription}</div>
                          )}
                          <div className="flex items-center gap-4 text-xs font-bold opacity-60 mt-1">
                            <span>REJECTED {code.rejectionCount}×</span>
                            <span>
                              LAST: {formatDistanceToNow(new Date(code.lastRejectedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => removeMutation.mutate({ codeId: code.id })}
                        disabled={removeMutation.isPending}
                        variant="outline"
                        className="text-xs font-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 h-auto"
                        size="sm"
                      >
                        REMOVE
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NAICS Codes Section */}
            {naicsCodes.length > 0 && (
              <div>
                <h3 className="text-3xl font-black mb-6 border-b-4 border-black pb-4">
                  NAICS CODES [{naicsCodes.length}]
                </h3>
                <div className="space-y-3">
                  {naicsCodes.map((code) => (
                    <div
                      key={code.id}
                      className="border-4 border-black p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-3xl font-black min-w-[120px]">{code.code}</div>
                        <div>
                          {code.codeDescription && (
                            <div className="text-sm font-bold">{code.codeDescription}</div>
                          )}
                          <div className="flex items-center gap-4 text-xs font-bold opacity-60 mt-1">
                            <span>REJECTED {code.rejectionCount}×</span>
                            <span>
                              LAST: {formatDistanceToNow(new Date(code.lastRejectedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => removeMutation.mutate({ codeId: code.id })}
                        disabled={removeMutation.isPending}
                        variant="outline"
                        className="text-xs font-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 h-auto"
                        size="sm"
                      >
                        REMOVE
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="border-l-8 border-black pl-8 py-4">
              <div className="text-sm font-black mb-2">HOW IT WORKS</div>
              <p className="text-base font-bold text-muted-foreground">
                When you mark a company as "Not Relevant → Wrong Industry", its SIC and NAICS codes are
                automatically added to this exclusion list. Future searches will filter out companies
                matching these codes, improving your results over time. Remove a code if you change your mind.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
