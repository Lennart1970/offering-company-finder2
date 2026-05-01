import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function CampaignFromBrain() {
  const [, navigate] = useLocation();
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.40);
  const [limit, setLimit] = useState(100);
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [campaignName, setCampaignName] = useState("");
  const [step, setStep] = useState<"select-brain" | "review-companies" | "creating">("select-brain");

  // Fetch brains
  const { data: brains, isLoading: brainsLoading } = trpc.campaignBrain.listBrains.useQuery();

  // Fetch companies when brain is selected
  const { data: companies, isLoading: companiesLoading, refetch } = trpc.campaignBrain.findByBrain.useQuery(
    { brainId: selectedBrainId!, limit, threshold, sector: sectorFilter || undefined, country: countryFilter || undefined },
    { enabled: !!selectedBrainId && step === "review-companies" }
  );

  // Fetch filter options
  const { data: filterOptions } = trpc.campaignBrain.getFilterOptions.useQuery(
    { brainId: selectedBrainId! },
    { enabled: !!selectedBrainId && step === "review-companies" }
  );

  // Create campaign mutation
  const createCampaign = trpc.campaignBrain.createCampaignFromBrain.useMutation({
    onSuccess: (result) => {
      toast.success(`Campaign created: ${result.companiesImported} companies imported`);
      navigate(`/search-results/${result.searchId}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("review-companies");
    },
  });

  // Tier stats
  const tierStats = useMemo(() => {
    if (!companies) return { A: 0, B: 0, C: 0, D: 0, total: 0 };
    const stats = { A: 0, B: 0, C: 0, D: 0, total: companies.length };
    for (const c of companies) {
      stats[c.fitTier as keyof typeof stats]++;
    }
    return stats;
  }, [companies]);

  // Select brain and move to review
  const handleBrainSelect = (brainId: string, brainName: string) => {
    setSelectedBrainId(brainId);
    setCampaignName(`[Brain] ${brainName}`);
    setSelectedCompanies(new Set());
    setStep("review-companies");
  };

  // Toggle company selection
  const toggleCompany = (id: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all / none
  const selectAll = () => {
    if (!companies) return;
    setSelectedCompanies(new Set(companies.map((c) => c.companyId)));
  };
  const selectNone = () => setSelectedCompanies(new Set());
  const selectTier = (tier: string) => {
    if (!companies) return;
    setSelectedCompanies(new Set(companies.filter((c) => c.fitTier === tier).map((c) => c.companyId)));
  };

  // Launch campaign
  const handleCreateCampaign = () => {
    if (!selectedBrainId || selectedCompanies.size === 0 || !campaignName.trim()) {
      toast.error("Please select companies and enter a campaign name");
      return;
    }
    setStep("creating");
    createCampaign.mutate({
      brainId: selectedBrainId,
      campaignName: campaignName.trim(),
      companyIds: Array.from(selectedCompanies),
      autoEnqueue: true,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs font-black text-gray-400 tracking-widest mb-1">SIGNAL-DRIVEN INTELLIGENCE</div>
          <h1 className="text-4xl font-black text-gray-900 leading-none">CAMPAIGN FROM BRAIN</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Select a Brain → find semantically similar companies → create a campaign for deep research.
          </p>
        </div>

        {/* Step 1: Brain Selection */}
        {step === "select-brain" && (
          <div>
            <div className="text-xs font-black text-gray-400 tracking-widest mb-4">STEP 1 — SELECT BRAIN</div>
            {brainsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !brains || brains.length === 0 ? (
              <div className="border-4 border-black p-12 text-center">
                <div className="text-2xl font-black mb-2">NO BRAINS AVAILABLE</div>
                <div className="text-sm text-gray-500">Create an Offering Brain first.</div>
              </div>
            ) : (
              <div className="grid gap-3">
                {brains.filter((b) => b.hasEmbedding).map((brain) => (
                  <div
                    key={brain.id}
                    onClick={() => handleBrainSelect(brain.id, brain.brainName)}
                    className="border border-gray-200 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-gray-900 group-hover:text-black">
                          {brain.brainName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {brain.companyName}{brain.icpIndustries ? ` · ${Array.isArray(brain.icpIndustries) ? brain.icpIndustries.slice(0, 3).join(", ") : String(brain.icpIndustries).slice(0, 80)}` : ""}
                        </div>
                      </div>
                      <div className="text-xs font-black text-gray-400 group-hover:text-black">
                        SELECT →
                      </div>
                    </div>
                  </div>
                ))}
                {brains.filter((b) => !b.hasEmbedding).length > 0 && (
                  <div className="mt-4 text-xs text-gray-400">
                    {brains.filter((b) => !b.hasEmbedding).length} brain(s) without embeddings — run the embedding job to enable them.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Companies */}
        {step === "review-companies" && (
          <div>
            {/* Back + Brain info */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => { setStep("select-brain"); setSelectedBrainId(null); }}
                className="text-xs font-black text-gray-500 hover:text-black"
              >
                ← BACK
              </button>
              <div className="text-xs font-black text-gray-900">
                Brain: {brains?.find((b) => b.id === selectedBrainId)?.brainName}
              </div>
            </div>

            {/* Controls */}
            <div className="border border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1">THRESHOLD</label>
                  <select
                    value={threshold}
                    onChange={(e) => { setThreshold(Number(e.target.value)); setSelectedCompanies(new Set()); }}
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm font-medium"
                  >
                    <option value={0.35}>0.35 (Broad)</option>
                    <option value={0.40}>0.40 (Standard)</option>
                    <option value={0.45}>0.45 (Focused)</option>
                    <option value={0.50}>0.50 (Strict)</option>
                    <option value={0.55}>0.55 (Very Strict)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1">LIMIT</label>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setSelectedCompanies(new Set()); }}
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm font-medium"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1">SECTOR</label>
                  <select
                    value={sectorFilter}
                    onChange={(e) => { setSectorFilter(e.target.value); setSelectedCompanies(new Set()); }}
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm font-medium"
                  >
                    <option value="">All Sectors</option>
                    {filterOptions?.sectors.slice(0, 20).map((s) => (
                      <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1">COUNTRY</label>
                  <select
                    value={countryFilter}
                    onChange={(e) => { setCountryFilter(e.target.value); setSelectedCompanies(new Set()); }}
                    className="w-full border border-gray-300 px-2 py-1.5 text-sm font-medium"
                  >
                    <option value="">All Countries</option>
                    {filterOptions?.countries.slice(0, 20).map((c) => (
                      <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tier summary + selection controls */}
            {companies && companies.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3">
                  <TierBadge tier="A" count={tierStats.A} onClick={() => selectTier("A")} />
                  <TierBadge tier="B" count={tierStats.B} onClick={() => selectTier("B")} />
                  <TierBadge tier="C" count={tierStats.C} onClick={() => selectTier("C")} />
                  <TierBadge tier="D" count={tierStats.D} onClick={() => selectTier("D")} />
                  <span className="text-xs text-gray-400 font-medium self-center ml-2">
                    {tierStats.total} total
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[10px] font-black text-gray-500 hover:text-black px-2 py-1 border border-gray-300">
                    SELECT ALL
                  </button>
                  <button onClick={selectNone} className="text-[10px] font-black text-gray-500 hover:text-black px-2 py-1 border border-gray-300">
                    CLEAR
                  </button>
                </div>
              </div>
            )}

            {/* Company list */}
            {companiesLoading ? (
              <div className="space-y-1">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !companies || companies.length === 0 ? (
              <div className="border-4 border-black p-12 text-center">
                <div className="text-xl font-black mb-2">NO MATCHES</div>
                <div className="text-sm text-gray-500">Try lowering the threshold or removing filters.</div>
              </div>
            ) : (
              <div className="border border-gray-200">
                {/* Table header */}
                <div className="grid grid-cols-[32px_2fr_1fr_1fr_80px_60px] gap-2 px-4 py-2 bg-gray-900 text-white text-[10px] font-black tracking-widest">
                  <div></div>
                  <div>COMPANY</div>
                  <div>SECTOR</div>
                  <div>COUNTRY</div>
                  <div className="text-right">SCORE</div>
                  <div className="text-center">TIER</div>
                </div>
                {/* Rows */}
                <div className="max-h-[500px] overflow-y-auto">
                  {companies.map((c) => (
                    <div
                      key={c.companyId}
                      onClick={() => toggleCompany(c.companyId)}
                      className={`grid grid-cols-[32px_2fr_1fr_1fr_80px_60px] gap-2 px-4 py-2.5 border-t border-gray-100 cursor-pointer transition-colors items-center ${
                        selectedCompanies.has(c.companyId) ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={selectedCompanies.has(c.companyId)}
                          onChange={() => toggleCompany(c.companyId)}
                          className="w-4 h-4"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">{c.companyName}</div>
                        <div className="text-[10px] text-gray-400 truncate">{c.domain}</div>
                      </div>
                      <div className="text-xs text-gray-600 truncate">{c.sector || "—"}</div>
                      <div className="text-xs text-gray-600 truncate">{c.country || "—"}</div>
                      <div className="text-right text-xs font-bold tabular-nums">
                        {(c.similarityScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 ${tierColor(c.fitTier)}`}>
                          {c.fitTier}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign creation bar */}
            {companies && companies.length > 0 && (
              <div className="mt-6 border-4 border-black p-5">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest block mb-1">CAMPAIGN NAME</label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full border-2 border-black px-3 py-2 text-sm font-bold"
                      placeholder="e.g. [Brain] Healthcare OEMs - Netherlands"
                    />
                  </div>
                  <button
                    onClick={handleCreateCampaign}
                    disabled={selectedCompanies.size === 0 || !campaignName.trim()}
                    className="bg-black text-white px-6 py-2.5 text-xs font-black tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  >
                    CREATE CAMPAIGN ({selectedCompanies.size})
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 mt-2 font-medium">
                  Selected companies will be imported and auto-enqueued for deep research (Enrich → Score → Brief → Approach).
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Creating */}
        {step === "creating" && (
          <div className="border-4 border-black p-12 text-center">
            <div className="text-2xl font-black mb-2 animate-pulse">CREATING CAMPAIGN...</div>
            <div className="text-sm text-gray-500 font-medium">
              Importing {selectedCompanies.size} companies and enqueuing for deep research.
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────

function TierBadge({ tier, count, onClick }: { tier: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-black px-2 py-1 border ${tierColor(tier)} hover:opacity-80 transition-opacity`}
    >
      {tier}: {count}
    </button>
  );
}

function tierColor(tier: string): string {
  switch (tier) {
    case "A": return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "B": return "bg-blue-100 text-blue-700 border-blue-300";
    case "C": return "bg-amber-100 text-amber-700 border-amber-300";
    case "D": return "bg-gray-100 text-gray-500 border-gray-300";
    default: return "bg-gray-100 text-gray-500 border-gray-300";
  }
}
