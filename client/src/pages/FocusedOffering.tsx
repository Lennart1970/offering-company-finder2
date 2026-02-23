import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function FocusedOffering() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [location, setLocation] = useState("");

  // HITL workflow state
  const [searchId, setSearchId] = useState<number | null>(null);
  const [currentOffering, setCurrentOffering] = useState<any>(null);
  const [isEditingOffering, setIsEditingOffering] = useState(false);
  const [editedOffering, setEditedOffering] = useState<any>(null);
  const [offeringAccepted, setOfferingAccepted] = useState(false);

  // Check for previous offering when website URL is entered
  const { data: previousOfferingData } = trpc.companyFinder.checkPreviousOffering.useQuery(
    { websiteUrl },
    { enabled: !!websiteUrl && websiteUrl.startsWith("http") }
  );

  // HITL: Extract offering from website
  const extractOfferingMutation = trpc.companyFinder.extractOffering.useMutation({
    onSuccess: (data) => {
      setSearchId(data.searchId);
      setCurrentOffering(data.offering);
      setOfferingAccepted(false);
      toast.success("Offering extracted! Please review.");
    },
    onError: (error) => {
      toast.error(`Extraction failed: ${error.message}`);
    },
  });

  // HITL: Accept previous offering
  const acceptPreviousOfferingMutation = trpc.companyFinder.acceptPreviousOffering.useMutation({
    onSuccess: (data) => {
      setSearchId(data.searchId);
      setCurrentOffering(data.offering);
      setOfferingAccepted(false);
      toast.success("Previous offering loaded! Please review.");
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // HITL: Update offering manually
  const updateOfferingMutation = trpc.companyFinder.updateOffering.useMutation({
    onSuccess: () => {
      setCurrentOffering(editedOffering);
      setIsEditingOffering(false);
      toast.success("Offering updated!");
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl) {
      toast.error("Please enter a website URL");
      return;
    }
    if (!location) {
      toast.error("Please enter a location");
      return;
    }

    if (previousOfferingData?.hasPrevious) {
      acceptPreviousOfferingMutation.mutate({ websiteUrl, location });
    } else {
      extractOfferingMutation.mutate({ websiteUrl, location });
    }
  };

  const handleReExtractOffering = () => {
    if (!websiteUrl || !location) return;
    extractOfferingMutation.mutate({ websiteUrl, location });
  };

  const handleSaveOfferingEdit = () => {
    if (!searchId || !editedOffering) return;
    updateOfferingMutation.mutate({
      searchId,
      offering: {
        name: editedOffering.offeringName,
        description: editedOffering.offeringDescription,
        targetMarket: editedOffering.targetMarket,
        keywords: editedOffering.keywords,
      },
    });
  };

  const handleAcceptOffering = () => {
    setOfferingAccepted(true);
    toast.success("Offering accepted! Proceed to Search Scenario.");
  };

  const handleProceedToSearch = () => {
    if (!searchId) return;
    navigate(`/search-scenario?searchId=${searchId}`);
  };

  const handleReset = () => {
    setSearchId(null);
    setCurrentOffering(null);
    setIsEditingOffering(false);
    setEditedOffering(null);
    setOfferingAccepted(false);
  };

  return (
    <div className="max-w-4xl">
      {/* Page Header */}
      <div className="mb-12">
        <div className="text-xs font-black text-muted-foreground mb-2">[01] COCKPIT</div>
        <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
          FOCUSED<br />OFFERING
        </h1>
        <p className="text-lg font-bold text-muted-foreground max-w-2xl">
          Extract and refine the offering from a target website. Define what you sell, who buys it, and the keywords that describe your market.
        </p>
      </div>

      {!currentOffering ? (
        /* Input Form */
        <div>
          {/* Previous Offering Indicator */}
          {previousOfferingData?.hasPrevious && (
            <div className="mb-8 p-6 border-4 border-green-600 bg-green-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-green-600">PREVIOUS OFFERING FOUND</div>
                  <div className="text-lg font-black mt-1">{previousOfferingData.previousOffering?.name}</div>
                  <div className="text-sm font-bold mt-1 opacity-70">{previousOfferingData.previousOffering?.description}</div>
                </div>
                <span className="text-xs font-black border-2 border-green-600 text-green-600 px-3 py-1">WILL REUSE</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="space-y-3">
              <Label htmlFor="websiteUrl" className="text-xl font-black">
                TARGET WEBSITE
              </Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.example.com"
                className="text-lg py-6 px-5 border-4 border-black focus:ring-4 focus:ring-black"
                required
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="location" className="text-xl font-black">
                TARGET LOCATION
              </Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Atlanta, GA"
                className="text-lg py-6 px-5 border-4 border-black focus:ring-4 focus:ring-black"
                required
              />
            </div>

            {previousOfferingData?.hasPrevious ? (
              <div className="flex flex-wrap gap-4">
                <Button
                  type="submit"
                  disabled={extractOfferingMutation.isPending || acceptPreviousOfferingMutation.isPending}
                  className="text-xl px-10 py-8 font-black border-4 border-black bg-black text-white"
                >
                  {acceptPreviousOfferingMutation.isPending
                    ? "[USING PREVIOUS...]"
                    : "[USE PREVIOUS OFFERING →]"}
                </Button>
                <Button
                  type="button"
                  onClick={handleReExtractOffering}
                  disabled={extractOfferingMutation.isPending || acceptPreviousOfferingMutation.isPending}
                  variant="outline"
                  className="text-xl px-10 py-8 font-black border-4 border-black"
                >
                  {extractOfferingMutation.isPending
                    ? "[RE-EXTRACTING...]"
                    : "[RE-EXTRACT OFFERING]"}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={extractOfferingMutation.isPending}
                className="text-xl px-10 py-8 font-black border-4 border-black bg-black text-white w-full md:w-auto"
              >
                {extractOfferingMutation.isPending
                  ? "[EXTRACTING OFFERING...]"
                  : "[EXTRACT OFFERING →]"}
              </Button>
            )}
          </form>
        </div>
      ) : (
        /* Offering Review */
        <div>
          <div className="flex items-center gap-4 mb-8">
            <Button onClick={handleReset} variant="outline" className="text-sm font-black border-2 border-black">
              ← NEW EXTRACTION
            </Button>
            {offeringAccepted && (
              <span className="text-sm font-black text-green-600 border-2 border-green-600 px-3 py-1">ACCEPTED</span>
            )}
          </div>

          {!isEditingOffering ? (
            /* Display Mode */
            <div className={`border-4 ${offeringAccepted ? 'border-green-600' : 'border-black'} p-8 mb-8`}>
              <div className="mb-6">
                <div className="text-sm font-black mb-2 text-muted-foreground">[OFFERING NAME]</div>
                <div className="text-2xl font-black">{currentOffering?.offeringName || currentOffering?.name}</div>
              </div>
              <div className="mb-6">
                <div className="text-sm font-black mb-2 text-muted-foreground">[DESCRIPTION]</div>
                <div className="text-lg font-bold">{currentOffering?.offeringDescription || currentOffering?.description}</div>
              </div>
              <div className="mb-6">
                <div className="text-sm font-black mb-2 text-muted-foreground">[TARGET MARKET]</div>
                <div className="text-lg font-bold">{currentOffering?.targetMarket}</div>
              </div>
              {currentOffering?.keywords && (
                <div className="mb-6">
                  <div className="text-sm font-black mb-2 text-muted-foreground">[KEYWORDS]</div>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(currentOffering.keywords) ? currentOffering.keywords : []).map((kw: string, i: number) => (
                      <span key={i} className="border-2 border-black px-4 py-2 text-sm font-black">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {currentOffering?.targetMarketKeywordTags && (
                <div>
                  <div className="text-sm font-black mb-2 text-muted-foreground">[SEARCH TAGS (DERIVED)]</div>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(currentOffering.targetMarketKeywordTags) ? currentOffering.targetMarketKeywordTags : []).map((tag: string, i: number) => (
                      <span key={i} className="border-2 border-black bg-black text-white px-4 py-2 text-sm font-black">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Edit Mode */
            <div className="border-4 border-blue-600 p-8 mb-8">
              <div className="text-sm font-black text-blue-600 mb-4">EDITING OFFERING</div>
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-black">OFFERING NAME</Label>
                  <Input
                    value={editedOffering?.offeringName || ""}
                    onChange={(e) => setEditedOffering({ ...editedOffering, offeringName: e.target.value })}
                    className="text-lg py-4 px-4 border-2 border-black mt-2"
                  />
                </div>
                <div>
                  <Label className="text-sm font-black">DESCRIPTION</Label>
                  <textarea
                    value={editedOffering?.offeringDescription || ""}
                    onChange={(e) => setEditedOffering({ ...editedOffering, offeringDescription: e.target.value })}
                    className="w-full text-lg py-4 px-4 border-2 border-black mt-2 min-h-[120px] font-bold"
                  />
                </div>
                <div>
                  <Label className="text-sm font-black">TARGET MARKET</Label>
                  <textarea
                    value={editedOffering?.targetMarket || ""}
                    onChange={(e) => setEditedOffering({ ...editedOffering, targetMarket: e.target.value })}
                    className="w-full text-lg py-4 px-4 border-2 border-black mt-2 min-h-[80px] font-bold"
                  />
                </div>
                <div>
                  <Label className="text-sm font-black">KEYWORDS (comma-separated)</Label>
                  <Input
                    value={editedOffering?.keywords?.join(", ") || ""}
                    onChange={(e) => setEditedOffering({ ...editedOffering, keywords: e.target.value.split(",").map((k: string) => k.trim()).filter(Boolean) })}
                    className="text-lg py-4 px-4 border-2 border-black mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4">
            {!isEditingOffering ? (
              <>
                {!offeringAccepted ? (
                  <Button
                    onClick={handleAcceptOffering}
                    className="text-xl px-10 py-8 font-black border-4 border-black bg-green-600 text-white flex-1"
                  >
                    [ACCEPT OFFERING]
                  </Button>
                ) : (
                  <Button
                    onClick={handleProceedToSearch}
                    className="text-xl px-10 py-8 font-black border-4 border-black bg-black text-white flex-1"
                  >
                    [PROCEED TO SEARCH SCENARIO →]
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setIsEditingOffering(true);
                    setEditedOffering({
                      offeringName: currentOffering?.offeringName || currentOffering?.name || "",
                      offeringDescription: currentOffering?.offeringDescription || currentOffering?.description || "",
                      targetMarket: currentOffering?.targetMarket || "",
                      keywords: currentOffering?.keywords || [],
                    });
                  }}
                  variant="outline"
                  className="text-lg px-8 py-6 font-black border-4 border-black"
                >
                  [EDIT]
                </Button>
                <Button
                  onClick={handleReExtractOffering}
                  disabled={extractOfferingMutation.isPending}
                  variant="outline"
                  className="text-lg px-8 py-6 font-black border-4 border-blue-600 text-blue-600"
                >
                  {extractOfferingMutation.isPending ? "[EXTRACTING...]" : "[RE-EXTRACT]"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSaveOfferingEdit}
                  disabled={updateOfferingMutation.isPending}
                  className="text-xl px-10 py-8 font-black border-4 border-black bg-blue-600 text-white flex-1"
                >
                  {updateOfferingMutation.isPending ? "[SAVING...]" : "[SAVE CHANGES]"}
                </Button>
                <Button
                  onClick={() => setIsEditingOffering(false)}
                  variant="outline"
                  className="text-lg px-8 py-6 font-black border-4 border-black"
                >
                  [CANCEL]
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
