import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export default function OfferingDetails() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { data: brainData, isLoading: brainLoading } = trpc.companyFinder.getActiveBrain.useQuery();

  if (loading || brainLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl font-black">LOADING</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  const brain = brainData?.brain;

  if (!brain || brain.status !== "completed") {
    return (
      <div className="min-h-screen">
        <div className="border-b-8 border-black p-8">
          <div className="container flex justify-between items-center">
            <h1 className="text-5xl md:text-7xl font-black leading-none">[CF]</h1>
          </div>
        </div>
        <div className="container py-16">
          <div className="max-w-4xl">
            <h2 className="text-6xl font-black leading-none mb-8">NO BRAIN FOUND</h2>
            <p className="text-xl font-bold text-muted-foreground mb-8">
              You need to create an Offering Brain first before viewing offering details.
            </p>
            <Button
              onClick={() => navigate("/brain")}
              className="text-2xl px-12 py-8 font-black border-4 border-black bg-black text-white"
            >
              [CREATE BRAIN]
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Parse brain data
  const coreCapabilities: string[] = brain.coreCapabilities ? JSON.parse(brain.coreCapabilities) : [];
  const icpIndustries: string[] = brain.icpIndustries ? JSON.parse(brain.icpIndustries) : [];
  const valuePropositions: Array<{ audience: string; value: string }> = brain.valuePropositions ? JSON.parse(brain.valuePropositions) : [];

  // Split industries into primary (first 6) and secondary (rest)
  const primaryMarkets = icpIndustries.slice(0, 6);
  const secondaryMarkets = icpIndustries.slice(6, 12);
  const additionalMarkets = icpIndustries.slice(12);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b-8 border-black p-8">
        <div className="container flex justify-between items-center">
          <h1 className="text-5xl md:text-7xl font-black leading-none">[CF]</h1>
          <div className="text-right">
            <div className="text-sm font-bold mb-2">{user?.name || user?.email}</div>
            <Button onClick={() => (window.location.href = "/")} variant="ghost" className="text-xs font-bold underline">
              RESET
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-16">
        <div className="max-w-4xl">
          {/* Page Title */}
          <div className="mb-16">
            <h2 className="text-[8vw] md:text-8xl font-black leading-none mb-4">
              OFFERING
              <br />
              DETAILS
            </h2>
            <div className="border-l-8 border-black pl-8">
              <p className="text-xl md:text-2xl font-bold text-muted-foreground">
                Review the offering from your active brain: <strong>{brain.brainName}</strong>
              </p>
            </div>
          </div>

          {/* Offering Information */}
          <div className="space-y-12">
            {/* Offering Name & Description */}
            <div className="p-8 border-4 border-black bg-white">
              <div className="text-sm font-black mb-2 text-muted-foreground">[OFFERING]</div>
              <h3 className="text-4xl font-black mb-6">{brain.offeringSummary || brain.brainName}</h3>
              
              <div className="mb-8">
                <div className="text-sm font-black mb-2 text-muted-foreground">[COMPANY]</div>
                <p className="text-lg font-bold leading-relaxed">
                  {brain.companyName}
                </p>
              </div>

              {brain.competitiveAdvantages && (
                <div className="mb-8">
                  <div className="text-sm font-black mb-2 text-muted-foreground">[COMPETITIVE ADVANTAGES]</div>
                  <p className="text-lg font-bold leading-relaxed">
                    {brain.competitiveAdvantages}
                  </p>
                </div>
              )}

              {coreCapabilities.length > 0 && (
                <div className="mb-8">
                  <div className="text-sm font-black mb-2 text-muted-foreground">[CORE CAPABILITIES]</div>
                  <div className="flex flex-wrap gap-3">
                    {coreCapabilities.map((cap) => (
                      <div key={cap} className="px-4 py-2 border-2 border-black font-bold">
                        {cap}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Target Markets */}
            {icpIndustries.length > 0 && (
              <div className="p-8 border-4 border-black bg-gray-50">
                <div className="text-sm font-black mb-4 text-muted-foreground">[TARGET MARKETS]</div>
                <div className="grid md:grid-cols-2 gap-6">
                  {primaryMarkets.length > 0 && (
                    <div>
                      <h4 className="font-black mb-3 text-lg">PRIMARY MARKETS</h4>
                      <ul className="space-y-2">
                        {primaryMarkets.map((market) => (
                          <li key={market} className="font-bold flex items-start gap-2">
                            <span className="text-black font-black">▪</span>
                            <span>{market}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {secondaryMarkets.length > 0 && (
                    <div>
                      <h4 className="font-black mb-3 text-lg">SECONDARY MARKETS</h4>
                      <ul className="space-y-2">
                        {secondaryMarkets.map((market) => (
                          <li key={market} className="font-bold flex items-start gap-2">
                            <span className="text-black font-black">▪</span>
                            <span>{market}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {additionalMarkets.length > 0 && (
                  <div className="mt-6 pt-6 border-t-2 border-black">
                    <h4 className="font-black mb-3 text-lg">ADDITIONAL MARKETS</h4>
                    <p className="font-bold leading-relaxed">
                      {additionalMarkets.join(" • ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Value Propositions */}
            {valuePropositions.length > 0 && (
              <div className="p-8 border-4 border-black bg-white">
                <div className="text-sm font-black mb-4 text-muted-foreground">[VALUE PROPOSITIONS]</div>
                <div className="space-y-4">
                  {valuePropositions.map((vp, i) => (
                    <div key={i} className="border-l-4 border-black pl-4">
                      <div className="text-sm font-black text-muted-foreground">{vp.audience}</div>
                      <p className="font-bold">{vp.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offering Keywords */}
            {coreCapabilities.length > 0 && (
              <div className="p-8 border-4 border-black bg-white">
                <div className="text-sm font-black mb-4 text-muted-foreground">[SEARCH KEYWORDS]</div>
                <p className="text-sm font-bold mb-4 text-muted-foreground">
                  These keywords are derived from your Offering Brain and used to find matching companies
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...coreCapabilities, ...icpIndustries.slice(0, 5)].map((keyword) => (
                    <div key={keyword} className="px-3 py-1 border-2 border-black text-sm font-bold">
                      {keyword.toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-8">
              <Button
                onClick={() => navigate("/")}
                className="text-2xl px-12 py-8 font-black border-4 border-black bg-black text-white flex-1"
              >
                [PROCEED TO SEARCH]
              </Button>
              <Button
                onClick={() => (window.location.href = "/")}
                variant="outline"
                className="text-xl px-8 py-6 font-black border-4 border-black"
              >
                BACK
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
