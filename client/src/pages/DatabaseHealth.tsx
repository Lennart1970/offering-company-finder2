import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Activity, CheckCircle2, AlertCircle, Clock, Zap, FileText, Users, Globe, BrainCircuit } from "lucide-react";
import { useState } from "react";

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-gray-700">lt_mns_companies</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{fmt(supabaseSync.companiesCount)}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced: {fmtDate(supabaseSync.lastSyncedAt)}
              {supabaseSync.lastSyncedAt && (
                <span className="ml-1 text-gray-500">({fmtAgo(supabaseSync.lastSyncedAt)})</span>
              )}
            </div>
            {supabaseSync.companiesCount > 0 && totals.companies > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">
                  Coverage: {Math.round((supabaseSync.companiesCount / totals.companies) * 100)}% of MySQL companies
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(Math.round((supabaseSync.companiesCount / totals.companies) * 100), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-gray-700">lt_mns_company_pages</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{fmt(supabaseSync.pagesCount)}</div>
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
