import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Step = "upload" | "clustering" | "done";

interface ImportResult {
  searchId: number;
  companiesImported: number;
  campaignName: string;
}

interface ClusterResult {
  nichesCreated: number;
  nichesScored: number;
  clusters: { name: string; companyCount: number; topKeywords: string[] }[];
}

export default function ImportCampaign() {
  const [campaignName, setCampaignName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [clusterResult, setClusterResult] = useState<ClusterResult | null>(null);
  const [clusteringStatus, setClusteringStatus] = useState("");
  const [, setLocation] = useLocation();

  const importMutation = trpc.companyFinder.importCampaignFromCSV.useMutation({
    onSuccess: async (data) => {
      setImportResult(data);
      setStep("clustering");
      toast.success(`${data.companiesImported} companies imported. Starting clustering...`);
      // Auto-trigger clustering
      clusterMutation.mutate({ searchId: data.searchId, autoScore: true });
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const clusterMutation = trpc.niche.clusterAndSaveNiches.useMutation({
    onMutate: () => {
      setClusteringStatus("Generating embeddings...");
    },
    onSuccess: (data) => {
      setClusterResult({
        nichesCreated: data.nichesCreated,
        nichesScored: data.nichesScored,
        clusters: data.clusters,
      });
      setStep("done");
      setClusteringStatus("");
      toast.success(`${data.nichesCreated} niches discovered and scored!`);
    },
    onError: (error) => {
      toast.error(`Clustering failed: ${error.message}`);
      setStep("done"); // still let user navigate to results
      setClusteringStatus("");
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
      if (!campaignName) {
        const name = file.name.replace(".csv", "").replace(/[_-]/g, " ");
        setCampaignName(name);
      }
    }
  };

  const handleImport = async () => {
    if (!csvFile || !campaignName.trim()) return;
    try {
      const csvContent = await csvFile.text();
      importMutation.mutate({ csvContent, campaignName: campaignName.trim() });
    } catch (error: any) {
      toast.error(`Failed to read file: ${error.message}`);
    }
  };

  const isLoading = importMutation.isPending || clusterMutation.isPending;

  return (
    <div className="container max-w-4xl py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black mb-2">IMPORT CAMPAIGN</h1>
        <p className="text-lg opacity-70">
          Upload an Apollo CSV → auto-cluster into niches → score against your Offering Brain
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {(["upload", "clustering", "done"] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 border-black
                ${step === s ? "bg-black text-white" : idx < ["upload", "clustering", "done"].indexOf(step) ? "bg-green-500 text-white border-green-500" : "bg-white text-black"}`}
            >
              {idx < ["upload", "clustering", "done"].indexOf(step) ? "✓" : idx + 1}
            </div>
            <span className={`ml-2 text-sm font-bold ${step === s ? "opacity-100" : "opacity-50"}`}>
              {s === "upload" ? "Upload CSV" : s === "clustering" ? "Discover Niches" : "View Results"}
            </span>
            {idx < 2 && <div className="w-12 h-0.5 bg-black mx-3 opacity-20" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-white border-4 border-black p-8 space-y-6">
          <div>
            <label className="block text-sm font-black mb-2">CAMPAIGN NAME</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Q1 2026 Manufacturing Targets"
              className="w-full px-4 py-3 border-2 border-black font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-black mb-2">APOLLO CSV FILE</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-4 py-3 border-2 border-black font-bold"
            />
            {csvFile && (
              <p className="mt-2 text-sm opacity-60">
                {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="bg-blue-50 border-2 border-blue-600 p-4">
            <p className="text-sm font-bold text-blue-900">
              <span className="font-black">WHAT HAPPENS NEXT:</span> Companies are imported, then automatically
              clustered into niches using AI embeddings + k-means. Each niche is scored against your active
              Offering Brain. The whole process takes 1–3 minutes depending on CSV size.
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleImport}
              disabled={!csvFile || !campaignName.trim() || isLoading}
              className="flex-1 font-black bg-black text-white py-6 text-lg cursor-pointer"
            >
              {importMutation.isPending ? "IMPORTING..." : "IMPORT & CLUSTER"}
            </Button>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="font-black border-2 border-black px-8 cursor-pointer"
            >
              CANCEL
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Clustering in progress */}
      {step === "clustering" && (
        <div className="bg-white border-4 border-black p-8 space-y-6">
          <div className="text-center py-8">
            <div className="text-6xl mb-4 animate-spin inline-block">⚙</div>
            <h2 className="text-2xl font-black mb-2">DISCOVERING NICHES</h2>
            <p className="text-lg opacity-70 mb-4">
              {importResult?.companiesImported} companies imported. Running AI clustering pipeline...
            </p>
            <div className="space-y-2 text-sm font-bold opacity-60">
              <p>① Generating semantic embeddings (OpenAI text-embedding-3-small)</p>
              <p>② Running k-means++ with silhouette auto-K selection</p>
              <p>③ Naming clusters with LLM</p>
              <p>④ Scoring niches against your Offering Brain</p>
            </div>
            {clusteringStatus && (
              <p className="mt-4 text-sm font-bold text-blue-700">{clusteringStatus}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && (
        <div className="space-y-6">
          <div className="bg-green-50 border-4 border-green-600 p-8">
            <h2 className="text-2xl font-black text-green-900 mb-2">
              ✓ CAMPAIGN READY
            </h2>
            <p className="text-green-800 font-bold">
              {importResult?.companiesImported} companies imported into{" "}
              <span className="font-black">"{importResult?.campaignName}"</span>
              {clusterResult && (
                <>
                  {" "}→ {clusterResult.nichesCreated} niches discovered
                  {clusterResult.nichesScored > 0 && ` → ${clusterResult.nichesScored} scored against Brain`}
                </>
              )}
            </p>
          </div>

          {/* Cluster preview */}
          {clusterResult && clusterResult.clusters.length > 0 && (
            <div className="bg-white border-4 border-black p-6">
              <h3 className="text-lg font-black mb-4">NICHES DISCOVERED</h3>
              <div className="space-y-3">
                {clusterResult.clusters.map((cluster, i) => (
                  <div key={i} className="border-2 border-black p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">{cluster.name}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {cluster.companyCount} companies
                        {cluster.topKeywords.length > 0 && ` · ${cluster.topKeywords.slice(0, 4).join(", ")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              onClick={() => setLocation("/niche-review")}
              className="flex-1 font-black bg-black text-white py-6 text-lg cursor-pointer"
            >
              VIEW MARKET SEGMENTS →
            </Button>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="font-black border-2 border-black px-8 cursor-pointer"
            >
              GO TO DASHBOARD
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
