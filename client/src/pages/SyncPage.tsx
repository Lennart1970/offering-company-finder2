import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export default function SyncPage() {
  // ── Company Pages sync state ──────────────────────────────────────────────
  const [isSyncingPages, setIsSyncingPages] = useState(false);
  const [pagesBackgroundRunning, setPagesBackgroundRunning] = useState(false);

  const { data: pagesStats, refetch: refetchPagesStats, isFetching: isFetchingPagesStats } =
    trpc.companyFinder.getCompanyPagesSyncStats.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const syncPagesMutation = trpc.companyFinder.syncCompanyPages.useMutation({
    onSuccess: (result) => {
      setIsSyncingPages(false);
      setPagesBackgroundRunning(true);
      toast.info("⏳ Sync running in background — stats will update automatically");
      // Auto-refresh every 30s for 3 minutes, then clear the "running" badge
      const intervals = [30_000, 60_000, 90_000, 120_000, 150_000, 180_000];
      intervals.forEach((ms) => setTimeout(() => refetchPagesStats(), ms));
      setTimeout(() => setPagesBackgroundRunning(false), 180_000);
    },
    onError: (err) => {
      setIsSyncingPages(false);
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  function handleSyncPages() {
    setIsSyncingPages(true);
    setPagesBackgroundRunning(false);
    syncPagesMutation.mutate({ appBaseUrl: window.location.origin });
  }

  // ── Companies sync state ──────────────────────────────────────────────────
  const [isSyncingCompanies, setIsSyncingCompanies] = useState(false);
  const [companiesBackgroundRunning, setCompaniesBackgroundRunning] = useState(false);

  const { data: companiesStats, refetch: refetchCompaniesStats, isFetching: isFetchingCompaniesStats } =
    trpc.companyFinder.getCompaniesTableSyncStats.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  const syncCompaniesMutation = trpc.companyFinder.syncAllCompanies.useMutation({
    onSuccess: (result) => {
      setIsSyncingCompanies(false);
      setCompaniesBackgroundRunning(true);
      toast.info("⏳ Sync running in background — stats will update automatically");
      // Auto-refresh every 30s for 4 minutes, then clear the "running" badge
      const intervals = [30_000, 60_000, 90_000, 120_000, 150_000, 180_000, 210_000, 240_000];
      intervals.forEach((ms) => setTimeout(() => refetchCompaniesStats(), ms));
      setTimeout(() => setCompaniesBackgroundRunning(false), 240_000);
    },
    onError: (err) => {
      setIsSyncingCompanies(false);
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  function handleSyncCompanies() {
    setIsSyncingCompanies(true);
    setCompaniesBackgroundRunning(false);
    syncCompaniesMutation.mutate();
  }

  return (
    <div className="max-w-3xl">
      {/* Page header */}
      <div className="mb-8">
        <div className="text-xs font-black text-muted-foreground mb-1">[SYNC] SUPABASE INTEGRATION</div>
        <h1 className="text-4xl font-black tracking-tight">Sync to Supabase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Push LeadTrigger intelligence data to your Supabase project for use in Slack, Telegram, InsertChat, or any external tool.
          Each table can be synced independently. Syncs run in the background — the button returns immediately and stats refresh automatically.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Sync card 1: lt_mns_companies (full company intelligence)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-black bg-white p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Table</div>
            <div className="font-mono text-sm font-bold text-blue-700">lt_mns_companies</div>
            <div className="text-xs text-muted-foreground mt-1">
              Full company intelligence — urgency, fit, signals, contacts, profile text
            </div>
          </div>
          <div className="text-right shrink-0">
            {companiesStats && (
              <>
                <div className="text-3xl font-black">{companiesStats.count.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">rows in table</div>
              </>
            )}
          </div>
        </div>

        {/* Column list */}
        <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground border border-gray-100 bg-gray-50 p-3">
          {[
            "id (uuid)",
            "company_name",
            "domain",
            "linkedin_url",
            "country / city / region",
            "employee_count / range",
            "revenue_range",
            "sector / industry",
            "urgency_score",
            "fit_score",
            "urgency_label / fit_label",
            "why_this_company_matters",
            "conversation_starter",
            "recommended_approach",
            "top_signal_type / headline",
            "brain_name / search_name",
            "pipeline_stage",
            "research_status",
            "has_contacts / contact_count",
            "profile_text",
            "sic_codes / nace_codes",
            "synced_at / created_at",
          ].map((col) => (
            <div key={col} className="flex items-center gap-1">
              <span className="text-blue-600">›</span> {col}
            </div>
          ))}
        </div>

        {/* Last sync info + Refresh button */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {companiesStats?.lastSyncedAt ? (
              <>Last synced: <span className="font-bold text-foreground">{new Date(companiesStats.lastSyncedAt).toLocaleString()}</span></>
            ) : (
              <span className="italic">Never synced</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchCompaniesStats()}
            disabled={isFetchingCompaniesStats}
            className="text-xs font-bold border-gray-300"
          >
            {isFetchingCompaniesStats ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full" />
                Refreshing…
              </span>
            ) : (
              "↻ Refresh Stats"
            )}
          </Button>
        </div>

        {/* Background running badge */}
        {companiesBackgroundRunning && (
          <div className="mb-4 border-2 border-blue-400 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 flex items-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full shrink-0" />
            Sync running in background — stats refresh automatically every 30s. This takes ~3 minutes for 4,000+ companies.
          </div>
        )}

        {/* Sync button */}
        <Button
          onClick={handleSyncCompanies}
          disabled={isSyncingCompanies}
          className="text-base px-8 py-5 font-black bg-blue-700 text-white hover:bg-blue-800 transition-colors disabled:opacity-60 w-full"
        >
          {isSyncingCompanies ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              STARTING SYNC…
            </span>
          ) : (
            "⚡ SYNC COMPANIES"
          )}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          Upserts all researched companies with full intelligence data (urgency, fit, signals, contacts). Safe to run multiple times.
          Runs in background — button returns immediately.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Sync card 2: lt_mns_company_pages (lightweight page links)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-black bg-white p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Table</div>
            <div className="font-mono text-sm font-bold text-emerald-700">lt_mns_company_pages</div>
            <div className="text-xs text-muted-foreground mt-1">
              Lightweight page links — company name, scores, and direct LeadTrigger magazine URL
            </div>
          </div>
          <div className="text-right shrink-0">
            {pagesStats && (
              <>
                <div className="text-3xl font-black">{pagesStats.count.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">rows in table</div>
              </>
            )}
          </div>
        </div>

        {/* Column list */}
        <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground border border-gray-100 bg-gray-50 p-3">
          {[
            "id (uuid)",
            "company_id (uuid)",
            "company_name",
            "domain",
            "campaign_id",
            "campaign_name",
            "urgency_score",
            "fit_score",
            "urgency_label",
            "fit_label",
            "page_url → LeadTrigger link",
            "synced_at",
          ].map((col) => (
            <div key={col} className="flex items-center gap-1">
              <span className="text-emerald-600">›</span> {col}
            </div>
          ))}
        </div>

        {/* Last sync info + Refresh button */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {pagesStats?.lastSyncedAt ? (
              <>Last synced: <span className="font-bold text-foreground">{new Date(pagesStats.lastSyncedAt).toLocaleString()}</span></>
            ) : (
              <span className="italic">Never synced</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPagesStats()}
            disabled={isFetchingPagesStats}
            className="text-xs font-bold border-gray-300"
          >
            {isFetchingPagesStats ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full" />
                Refreshing…
              </span>
            ) : (
              "↻ Refresh Stats"
            )}
          </Button>
        </div>

        {/* Background running badge */}
        {pagesBackgroundRunning && (
          <div className="mb-4 border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 flex items-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full shrink-0" />
            Sync running in background — stats refresh automatically every 30s. This takes ~2 minutes.
          </div>
        )}

        {/* Sync button */}
        <Button
          onClick={handleSyncPages}
          disabled={isSyncingPages}
          className="text-base px-8 py-5 font-black bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-60 w-full"
        >
          {isSyncingPages ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              STARTING SYNC…
            </span>
          ) : (
            "⚡ SYNC COMPANY PAGES"
          )}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          Upserts all researched companies as lightweight page links. Used by Intelligence page and external tools. Safe to run multiple times.
          Runs in background — button returns immediately.
        </p>
      </div>

      {/* Info box: how to use in Slack / Telegram */}
      <div className="border border-gray-200 bg-gray-50 p-5">
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">How to use this data</div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="font-black text-foreground shrink-0">Slack / Telegram bot</span>
            <span>Query <span className="font-mono">lt_mns_companies</span> for full intelligence or <span className="font-mono">lt_mns_company_pages</span> for quick links. Filter by <span className="font-mono">urgency_label = 'HIGH'</span> for daily hot-list digests.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-foreground shrink-0">InsertChat / AI assistant</span>
            <span>Connect InsertChat to <span className="font-mono">lt_mns_companies</span> for rich natural language queries: <em>"Show me all HIGH urgency companies in the Netherlands with fit score above 70"</em>.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-foreground shrink-0">Supabase Realtime</span>
            <span>Subscribe to INSERT events on either table to trigger notifications the moment new companies are synced.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
