import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ImportCampaign() {
  const [campaignName, setCampaignName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setLocation] = useLocation();

  const { data: brainData } = trpc.companyFinder.getActiveBrain.useQuery();

  const importMutation = trpc.companyFinder.importCampaignFromCSV.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign "${data.campaignName}" created with ${data.companiesImported} companies! Go to Search Results to view.`);
      // Reset form
      setCampaignName("");
      setCsvFile(null);
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }
      setCsvFile(file);
      // Auto-fill campaign name from filename
      if (!campaignName) {
        const name = file.name.replace(".csv", "").replace(/[_-]/g, " ");
        setCampaignName(name);
      }
    }
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    setIsUploading(true);

    try {
      const csvContent = await csvFile.text();
      importMutation.mutate({
        csvContent,
        campaignName: campaignName.trim(),
      });
    } catch (error: any) {
      toast.error(`Failed to read file: ${error.message}`);
      setIsUploading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-black mb-2">IMPORT CAMPAIGN</h1>
        <p className="text-lg opacity-70">
          Upload an Apollo company export CSV to create a new campaign
        </p>
      </div>

      <div className="bg-white border-4 border-black p-8 space-y-6">
        {/* Active Brain Display */}
        <div className="bg-blue-50 border-2 border-blue-600 p-4 rounded">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs font-black text-blue-600 mb-1">🧠 ACTIVE BRAIN</div>
              {brainData?.brain ? (
                <>
                  <div className="font-black text-lg">{brainData.brain.brainName}</div>
                  <div className="text-sm opacity-70 mt-1">
                    {brainData.brain.companyName} • {brainData.brain.companyWebsite}
                  </div>
                  <div className="text-xs opacity-60 mt-2">
                    All companies in this campaign will be enriched using this brain's context.
                  </div>
                </>
              ) : (
                <div className="text-sm font-bold text-red-600">
                  ⚠️ No active brain found. Please create and activate a brain first.
                </div>
              )}
            </div>
            <a
              href="/brain"
              className="text-xs font-black underline text-blue-600 hover:text-blue-800"
            >
              CHANGE BRAIN →
            </a>
          </div>
        </div>

        <div>
          <label className="block text-sm font-black mb-2">CAMPAIGN NAME</label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g., Q1 2026 Manufacturing Targets"
            className="w-full px-4 py-3 border-2 border-black font-bold text-lg"
            disabled={isUploading}
          />
        </div>

        <div>
          <label className="block text-sm font-black mb-2">APOLLO CSV FILE</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-4 py-3 border-2 border-black font-bold"
            disabled={isUploading}
          />
          {csvFile && (
            <p className="mt-2 text-sm opacity-60">
              Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="bg-orange-50 border-2 border-orange-600 p-4">
          <p className="text-sm font-bold text-orange-900">
            <span className="font-black">NOTE:</span> This will create a new campaign and import all companies from the CSV.
            Each company will be marked as "pending enrichment" and ready for Deep Research.
          </p>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleImport}
            disabled={!csvFile || !campaignName.trim() || isUploading}
            className="flex-1 font-black bg-black text-white py-6 text-lg cursor-pointer"
          >
            {isUploading ? "IMPORTING..." : "IMPORT CAMPAIGN"}
          </Button>
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="font-black border-2 border-black px-8 cursor-pointer"
            disabled={isUploading}
          >
            CANCEL
          </Button>
        </div>
      </div>

      {isUploading && (
        <div className="mt-6 bg-blue-50 border-2 border-blue-600 p-4">
          <p className="font-bold text-blue-900">
            ⏳ Importing companies... This may take a few seconds.
          </p>
        </div>
      )}
    </div>
  );
}
