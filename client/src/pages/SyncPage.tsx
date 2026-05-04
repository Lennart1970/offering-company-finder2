import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export default function SyncPage() {
  // ── Company Pages sync state ──────────────────────────────────────────────
  const [isSyncingPages, setIsSyncingPages] = useState(false);
  const [pagesResult, setPagesResult] = useState<{ synced: number; errors: number; message: string } | null>(null);

  const { data: pagesStats, refetch: refetchPagesStats } = trpc.companyFinder.getCompanyPagesSyncStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const syncPagesMutation = trpc.companyFinder.syncCompanyPages.useMutation({
    onSuccess: (result) => {
      setPagesResult(result);
      setIsSyncingPages(false);
      refetchPagesStats();
      if (result.errors > 0) {
        toast.error(`Sync completed with ${result.errors} errors. ${result.synced} pages synced.`);
      } else {
        toast.success(result.message);
      }
    },
    onError: (err) => {
      setIsSyncingPages(false);
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  function handleSyncPages() {
    setIsSyncingPages(true);
    setPagesResult(null);
    syncPagesMutation.mutate({ appBaseUrl: window.location.origin });
  }

  // ── Companies sync state ──────────────────────────────────────────────────
  const [isSyncingCompanies, setIsSyncingCompanies] = useState(false);
  const [companiesResult, setCompaniesResult] = useState<{ synced: number; errors: number; message: string } | null>(null);

  const { data: companiesStats, refetch: refetchCompaniesStats } = trpc.companyFinder.getCompaniesTableSyncStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const syncCompaniesMutation = trpc.companyFinder.syncAllCompanies.useMutation({
    onSuccess: (result) => {
      setCompaniesResult(result);
      setIsSyncingCompanies(false);
      refetchCompaniesStats();
      if (result.errors > 0) {
        toast.error(`Sync completed with ${result.errors} errors. ${result.synced} companies synced.`);
      } else {
        toast.success(result.message);
      }
    },
    onError: (err) => {
      setIsSyncingCompanies(false);
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  function handleSyncCompanies() {
    setIsSyncingCompanies(true);
    setCompaniesResult(null);
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
          Each table can be synced independently.
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

        {/* Last sync info */}
        {companiesStats?.lastSyncedAt && (
          <div className="mb-4 text-xs text-muted-foreground">
            Last synced: <span className="font-bold text-foreground">{new Date(companiesStats.lastSyncedAt).toLocaleString()}</span>
          </div>
        )}

        {/* Result banner */}
        {companiesResult && (
          <div className={`mb-4 border-2 px-4 py-3 text-sm font-bold ${companiesResult.errors > 0 ? "border-red-500 bg-red-50 text-red-700" : "border-blue-500 bg-blue-50 text-blue-800"}`}>
            {companiesResult.errors > 0
              ? `\u26A0 ${companiesResult.synced} synced, ${companiesResult.errors} errors`
              : `\u2713 ${companiesResult.message}`}
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
              SYNCING COMPANIES...
            </span>
          ) : (
            "\u26A1 SYNC COMPANIES"
          )}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          Upserts all researched companies with full intelligence data (urgency, fit, signals, contacts). Safe to run multiple times.
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
            "page_url \u2192 LeadTrigger link",
            "synced_at",
          ].map((col) => (
            <div key={col} className="flex items-center gap-1">
              <span className="text-emerald-600">›</span> {col}
            </div>
          ))}
        </div>

        {/* Last sync info */}
        {pagesStats?.lastSyncedAt && (
          <div className="mb-4 text-xs text-muted-foreground">
            Last synced: <span className="font-bold text-foreground">{new Date(pagesStats.lastSyncedAt).toLocaleString()}</span>
          </div>
        )}

        {/* Result banner */}
        {pagesResult && (
          <div className={`mb-4 border-2 px-4 py-3 text-sm font-bold ${pagesResult.errors > 0 ? "border-red-500 bg-red-50 text-red-700" : "border-emerald-500 bg-emerald-50 text-emerald-800"}`}>
            {pagesResult.errors > 0
              ? `\u26A0 ${pagesResult.synced} synced, ${pagesResult.errors} errors`
              : `\u2713 ${pagesResult.message}`}
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
              SYNCING COMPANY PAGES...
            </span>
          ) : (
            "\u26A1 SYNC COMPANY PAGES"
          )}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          Upserts all researched companies as lightweight page links. Used by Intelligence page and external tools. Safe to run multiple times.
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
