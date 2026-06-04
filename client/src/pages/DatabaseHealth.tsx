import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Activity, CheckCircle2, AlertCircle, Clock, Zap, FileText, Users, Globe, BrainCircuit, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function fmtAgo(d: Date | string | null | undefined) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  const diff = Date.now() - dt.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-400";
  return "bg-red-400";
}

function statusBadge(pct: number) {
  if (pct >= 80) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Good</Badge>;
  if (pct >= 40) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Partial</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Low</Badge>;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiBar({ label, count, pct, lastAt, description }: {
  label: string;
  count: number;
  pct: number;
  lastAt?: Date | string | null;
  description?: string;
}) {
  const ago = fmtAgo(lastAt);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
          {description && <span className="text-xs text-gray-400 hidden sm:inline truncate">{description}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(pct)}
          <span className="text-sm font-semibold text-gray-700 w-12 text-right">{pct}%</span>
          <span className="text-xs text-gray-400 w-20 text-right">{fmt(count)}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${statusColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {ago && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Last run: {ago} ({fmtDate(lastAt)})</span>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <Icon className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function StatTile({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: "blue" | "green" | "amber" | "red" | "purple" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`rounded-lg p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{fmt(typeof value === "number" ? value : undefined) !== "—" ? fmt(typeof value === "number" ? value : undefined) : value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── campaign breakdown table ─────────────────────────────────────────────────

type CampaignRow = {
  searchId: number | null;
  name: string;
  total: number;
  enriched: number;
  enrichedPct: number;
  withSimilarity: number;
  withFit: number;
  withUrgSynth: number;
  withUrgNews: number;
  withUrgLLM: number;
  withBrief: number;
  withSales: number;
  withContacts: number;
  lastActivity: Date | null;
};

function CampaignTable({ campaigns, total }: { campaigns: CampaignRow[]; total: number }) {
  const cols = [
    { key: "enrichedPct", label: "Enrich" },
    { key: "withSimilarity", label: "Sim" },
    { key: "withFit", label: "Fit" },
    { key: "withUrgSynth", label: "Urg-S" },
    { key: "withUrgNews", label: "Urg-N" },
    { key: "withUrgLLM", label: "Urg-L" },
    { key: "withBrief", label: "Brief" },
    { key: "withSales", label: "Sales" },
    { key: "withContacts", label: "Contacts" },
  ] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 pr-4 font-semibold text-gray-500 min-w-[180px]">Campaign</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500">Total</th>
            {cols.map((c) => (
              <th key={c.key} className="text-right py-2 px-2 font-semibold text-gray-500">{c.label}</th>
            ))}
            <th className="text-right py-2 pl-2 font-semibold text-gray-500">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((row) => (
            <tr key={row.searchId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-2 pr-4 font-medium text-gray-700 max-w-[200px] truncate">{row.name}</td>
              <td className="py-2 px-2 text-right text-gray-500">{fmt(row.total)}</td>
              {cols.map((c) => {
                const rawVal = row[c.key as keyof CampaignRow];
                const n = typeof rawVal === "number" ? rawVal : 0;
                const pctVal = c.key === "enrichedPct" ? n : (row.total > 0 ? Math.round((n / row.total) * 100) : 0);
                const color = pctVal >= 80 ? "text-emerald-600" : pctVal >= 40 ? "text-amber-600" : "text-red-500";
                return (
                  <td key={c.key} className={`py-2 px-2 text-right font-medium ${color}`}>
                    {c.key === "enrichedPct" ? `${n}%` : `${pctVal}%`}
                  </td>
                );
              })}
              <td className="py-2 pl-2 text-right text-gray-400">{fmtAgo(row.lastActivity) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Country Backfill Panel ──────────────────────────────────────────────────

type BackfillRow = { id: number; name: string; websiteUrl: string | null; country: string | null; confidence: string; written: boolean; domainSignal: string | null };
type BackfillResult = { processed: number; written: number; skipped: number; errors: number; dryRun: boolean; results: BackfillRow[] };

function CountryBackfillPanel() {
  const [batchSize, setBatchSize] = useState(25);
  // "idle" → "preview" (dry-run done, showing table) → "committed" (real write done)
  const [stage, setStage] = useState<"idle" | "preview" | "committed">("idle");
  const [previewData, setPreviewData] = useState<BackfillResult | null>(null);
  const [commitData, setCommitData] = useState<BackfillResult | null>(null);

  const { data: stats, refetch: refetchStats } = trpc.companyFinder.getCountryBackfillStats.useQuery(undefined, {
    staleTime: 30_000,
  });

  const bulkMutation = trpc.companyFinder.bulkInferCountry.useMutation({
    onSuccess: (result) => {
      if (result.dryRun) {
        setPreviewData(result);
        setStage("preview");
        toast.info(`Preview ready: ${result.written} would be written, ${result.skipped} would be skipped`);
      } else {
        setCommitData(result);
        setStage("committed");
        refetchStats();
        toast.success(`Done: ${result.written} countries written, ${result.skipped} skipped, ${result.errors} errors`);
      }
    },
    onError: (err) => toast.error(`Backfill failed: ${err.message}`),
  });

  const eligible = stats?.eligible ?? 0;
  const missing = stats?.missingCountry ?? 0;
  const total = stats?.total ?? 0;
  const filled = total - missing;
  const filledPct = total > 0 ? Math.round((filled / total) * 100) : 0;

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-emerald-600 font-semibold";
    if (c === "medium") return "text-amber-600 font-semibold";
    if (c === "low") return "text-gray-400";
    return "text-red-500";
  };

  const activeData = stage === "committed" ? commitData : previewData;

  return (
    <div className="border border-gray-100 rounded-lg p-5 bg-white space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-blue-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Country Backfill (LLM)</h3>
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">AI-powered</Badge>
        {stage === "preview" && <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Preview — not written yet</Badge>}
        {stage === "committed" && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Committed</Badge>}
      </div>
      <p className="text-xs text-gray-500">
        Infers country (ISO-2) from research brief for companies where Apollo returned no location.
        <strong> Step 1: Preview</strong> runs the LLM without writing.
        <strong> Step 2: Commit</strong> writes only high/medium confidence results.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xl font-bold text-gray-900">{fmt(filled)}</div>
          <div className="text-xs text-gray-400">Have country</div>
        </div>
        <div>
          <div className="text-xl font-bold text-amber-600">{fmt(missing)}</div>
          <div className="text-xs text-gray-400">Missing country</div>
        </div>
        <div>
          <div className="text-xl font-bold text-blue-600">{fmt(eligible)}</div>
          <div className="text-xs text-gray-400">Eligible (has brief)</div>
        </div>
      </div>

      {/* Coverage bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Country coverage</span>
          <span>{filledPct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              filledPct >= 80 ? "bg-emerald-500" : filledPct >= 40 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${filledPct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Batch size:</label>
          <select
            value={batchSize}
            onChange={(e) => { setBatchSize(Number(e.target.value)); setStage("idle"); setPreviewData(null); }}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            disabled={bulkMutation.isPending}
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Step 1: Preview */}
        {stage !== "preview" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setStage("idle"); bulkMutation.mutate({ limit: batchSize, dryRun: true }); }}
            disabled={bulkMutation.isPending || eligible === 0}
            className="gap-2 text-xs"
          >
            {bulkMutation.isPending && !previewData ? (
              <><RefreshCw className="w-3 h-3 animate-spin" /> Previewing…</>
            ) : (
              <><Activity className="w-3 h-3" /> Preview ({fmt(Math.min(batchSize, eligible))} companies)</>
            )}
          </Button>
        )}

        {/* Step 2: Commit (only shown after preview) */}
        {stage === "preview" && (
          <>
            <Button
              size="sm"
              onClick={() => bulkMutation.mutate({ limit: batchSize, dryRun: false })}
              disabled={bulkMutation.isPending}
              className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkMutation.isPending ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> Writing…</>
              ) : (
                <><CheckCircle2 className="w-3 h-3" /> Commit {previewData?.written ?? 0} countries</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setStage("idle"); setPreviewData(null); }}
              disabled={bulkMutation.isPending}
              className="gap-2 text-xs text-gray-500"
            >
              Cancel
            </Button>
          </>
        )}

        {stage === "committed" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setStage("idle"); setPreviewData(null); setCommitData(null); }}
            className="gap-2 text-xs"
          >
            Run another batch
          </Button>
        )}
      </div>

      {/* Preview / result table */}
      {activeData && activeData.results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">
              {stage === "preview" ? "Preview (not yet written)" : "Committed results"}
              {" — "}{activeData.processed} companies
            </span>
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-600">{activeData.written} {stage === "preview" ? "would write" : "written"}</span>
              <span className="text-amber-500">{activeData.skipped} skipped</span>
              {activeData.errors > 0 && <span className="text-red-500">{activeData.errors} errors</span>}
            </div>
          </div>
          <div className="border border-gray-100 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Company</th>
                  <th className="text-left px-3 py-2 font-medium">Website</th>
                  <th className="text-left px-3 py-2 font-medium">Signal</th>
                  <th className="text-center px-3 py-2 font-medium">Country</th>
                  <th className="text-center px-3 py-2 font-medium">Confidence</th>
                  <th className="text-center px-3 py-2 font-medium">{stage === "preview" ? "Would write" : "Written"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeData.results.map((row) => (
                  <tr key={row.id} className={row.written ? "bg-white" : "bg-gray-50 opacity-60"}>
                    <td className="px-3 py-1.5 font-medium text-gray-800 max-w-[180px] truncate">{row.name}</td>
                    <td className="px-3 py-1.5 text-gray-400 max-w-[140px] truncate">
                      {row.websiteUrl ? row.websiteUrl.replace(/^https?:\/\/(www\.)?/, "") : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-blue-600 max-w-[160px] truncate" title={row.domainSignal ?? ""}>
                      {row.domainSignal ? "🔵 domain" : "📄 brief"}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {row.country ? (
                        <span className="font-mono font-bold text-gray-800">{row.country}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-1.5 text-center ${confidenceColor(row.confidence)}`}>{row.confidence}</td>
                    <td className="px-3 py-1.5 text-center">
                      {row.written ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-gray-300 text-xs">skip</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DatabaseHealth() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = trpc.companyFinder.getDatabaseHealth.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading database health metrics…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 flex items-center gap-3 text-red-500">
        <AlertCircle className="w-4 h-4" />
        <span>Failed to load health metrics. {error?.message}</span>
      </div>
    );
  }

  const { totals, enrichment, scoring, content, supabaseSync, campaigns } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Database Health
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pipeline completeness & sync status · Refreshed {fmtAgo(data.generatedAt) ?? "just now"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Top-level stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="Total Companies" value={totals.companies} color="blue" />
        <StatTile label="Enriched" value={enrichment.enriched} sub={`${enrichment.enrichedPct}% of total`} color="green" />
        <StatTile label="Pending" value={enrichment.pending} color="amber" />
        <StatTile label="Failed" value={enrichment.failed} color="red" />
        <StatTile label="Campaigns" value={totals.searches} sub={`${totals.completedSearches} completed`} color="purple" />
        <StatTile label="Active Brains" value={totals.activeBrains} sub={`${totals.brains} total`} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scoring KPIs */}
        <SectionCard title="Scoring Pipeline" icon={Zap}>
          <KpiBar
            label="Similarity Score (ICP)"
            count={scoring.similarityScore.count}
            pct={scoring.similarityScore.pct}
            description="Cosine vs Brain embedding"
          />
          <KpiBar
            label="Fit Score (LLM)"
            count={scoring.fitScore.count}
            pct={scoring.fitScore.pct}
            lastAt={scoring.fitScore.lastAt}
            description="Deep-analysis fit via Grok"
          />
          <KpiBar
            label="Urgency — Synth"
            count={scoring.urgencyScoreSynth.count}
            pct={scoring.urgencyScoreSynth.pct}
            lastAt={scoring.urgencyScoreSynth.lastAt}
            description="ABC scenario cosine"
          />
          <KpiBar
            label="Urgency — News"
            count={scoring.urgencyScoreNews.count}
            pct={scoring.urgencyScoreNews.pct}
            lastAt={scoring.urgencyScoreNews.lastAt}
            description="Google News snippets"
          />
          <KpiBar
            label="Urgency — LLM"
            count={scoring.urgencyScoreLLM.count}
            pct={scoring.urgencyScoreLLM.pct}
            lastAt={scoring.urgencyScoreLLM.lastAt}
            description="Grok agentic search"
          />
          <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Fit HITL overrides:</span>{" "}
              {fmt(scoring.fitScoreHITL.count)} ({scoring.fitScoreHITL.pct}%)
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Urgency HITL overrides:</span>{" "}
              {fmt(scoring.urgencyScoreHITL.count)} ({scoring.urgencyScoreHITL.pct}%)
            </div>
          </div>
        </SectionCard>

        {/* Content generation KPIs */}
        <SectionCard title="Content Generation" icon={FileText}>
          <KpiBar
            label="Sales Intelligence Brief"
            count={content.brief.count}
            pct={content.brief.pct}
            lastAt={content.brief.lastAt}
            description="Deep research brief"
          />
          <KpiBar
            label="Sales Approach"
            count={content.salesApproach.count}
            pct={content.salesApproach.pct}
            lastAt={content.salesApproach.lastAt}
            description="Email / LinkedIn / call script"
          />
          <KpiBar
            label="Contacts Fetched"
            count={content.contactsFetched.count}
            pct={content.contactsFetched.pct}
            description="Apollo personnel lookup"
          />
          <KpiBar
            label="CG CRM Imported"
            count={content.cgImported.count}
            pct={content.cgImported.pct}
            description="SharePoint lead list sync"
          />
        </SectionCard>
      </div>

      {/* Supabase Sync Status */}
      <SectionCard title="Supabase Sync" icon={Globe}>
        {/* Schema note */}
        <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <strong>Supabase is the master dataset</strong> — larger than MySQL.
          {" "}<code className="font-mono">lt_mns_companies</code> (master registry, 85K+) ·{" "}
          <code className="font-mono">lt_mns_company_embeddings</code> (vectors, 71K+) ·{" "}
          <code className="font-mono">lt_mns_company_pages</code> (enriched pages, 9K+).
          MySQL contains the operational working subset — coverage % shows MySQL vs Supabase master.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* lt_mns_companies */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-gray-700">lt_mns_companies</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{fmt(supabaseSync.companiesCount)}</div>
            <div className="text-xs text-gray-400">Master registry — all companies (Supabase)</div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated: {fmtDate(supabaseSync.lastSyncedAt)}
              {supabaseSync.lastSyncedAt && (
                <span className="ml-1 text-gray-500">({fmtAgo(supabaseSync.lastSyncedAt)})</span>
              )}
            </div>
            {supabaseSync.companiesCount > 0 && totals.companies > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">
                  MySQL has {fmt(totals.companies)} ({(supabaseSync as any).mysqlCoveragePct ?? 0}% of Supabase master)
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min((supabaseSync as any).mysqlCoveragePct ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* lt_mns_company_embeddings */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-700">lt_mns_company_embeddings</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{fmt((supabaseSync as any).embeddingsCount ?? 0)}</div>
            <div className="text-xs text-gray-400">Vector embeddings for similarity search</div>
            {supabaseSync.companiesCount > 0 && (supabaseSync as any).embeddingsCount > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">
                  {Math.round(((supabaseSync as any).embeddingsCount / supabaseSync.companiesCount) * 100)}% of master companies have embeddings
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(Math.round(((supabaseSync as any).embeddingsCount / supabaseSync.companiesCount) * 100), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* lt_mns_company_pages */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">lt_mns_company_pages</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{fmt(supabaseSync.pagesCount)}</div>
            <div className="text-xs text-gray-400">Enriched pages — fit + urgency scores per campaign</div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced: {fmtDate(supabaseSync.pagesLastSyncedAt)}
              {supabaseSync.pagesLastSyncedAt && (
                <span className="ml-1 text-gray-500">({fmtAgo(supabaseSync.pagesLastSyncedAt)})</span>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Country Backfill */}
      <SectionCard title="Data Enrichment Tools" icon={MapPin}>
        <CountryBackfillPanel />
      </SectionCard>

      {/* Per-campaign breakdown */}
      <SectionCard title="Per-Campaign KPI Breakdown (Top 20)" icon={Database}>
        <div className="text-xs text-gray-400 mb-3">
          Columns show % of companies in each campaign that have a given KPI populated.
          <span className="ml-2 text-emerald-600 font-medium">≥80% Good</span>
          <span className="mx-1 text-amber-600 font-medium">40–79% Partial</span>
          <span className="text-red-500 font-medium">&lt;40% Low</span>
        </div>
        <CampaignTable campaigns={campaigns as CampaignRow[]} total={totals.companies} />
      </SectionCard>
    </div>
  );
}
