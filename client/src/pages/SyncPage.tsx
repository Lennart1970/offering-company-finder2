import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export default function SyncPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{ synced: number; errors: number; message: string } | null>(null);

  const { data: stats, refetch: refetchStats } = trpc.companyFinder.getCompanyPagesSyncStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const syncMutation = trpc.companyFinder.syncCompanyPages.useMutation({
    onSuccess: (result) => {
      setLastResult(result);
      setIsSyncing(false);
      refetchStats();
      if (result.errors > 0) {
        toast.error(`Sync completed with ${result.errors} errors. ${result.synced} pages synced.`);
      } else {
        toast.success(result.message);
      }
    },
    onError: (err) => {
      setIsSyncing(false);
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  function handleSync() {
    setIsSyncing(true);
    setLastResult(null);
    syncMutation.mutate({ appBaseUrl: window.location.origin });
  }

  return (
    <div className="max-w-3xl">
      {/* Page header */}
      <div className="mb-8">
        <div className="text-xs font-black text-muted-foreground mb-1">[SYNC] SUPABASE INTEGRATION</div>
        <h1 className="text-4xl font-black tracking-tight">Sync to Supabase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Push researched company pages to your Supabase project for use in Slack, Telegram, or any external tool.
          Each row contains the company name, domain, campaign, urgency score, fit score, and a direct link to the
          LeadTrigger magazine page.
        </p>
      </div>

      {/* Sync card: Company Pages */}
      <div className="border-2 border-black bg-white p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Table</div>
            <div className="font-mono text-sm font-bold text-emerald-700">lt_mns_company_pages</div>
            <div className="text-xs text-muted-foreground mt-1">
              Supabase project: <span className="font-mono">yeowqyeafylynavufueo.supabase.co</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            {stats && (
              <>
                <div className="text-3xl font-black">{stats.count.toLocaleString()}</div>
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

        {/* Last sync info */}
        {stats?.lastSyncedAt && (
          <div className="mb-4 text-xs text-muted-foreground">
            Last synced: <span className="font-bold text-foreground">{new Date(stats.lastSyncedAt).toLocaleString()}</span>
          </div>
        )}

        {/* Result banner */}
        {lastResult && (
          <div className={`mb-4 border-2 px-4 py-3 text-sm font-bold ${lastResult.errors > 0 ? "border-red-500 bg-red-50 text-red-700" : "border-emerald-500 bg-emerald-50 text-emerald-800"}`}>
            {lastResult.errors > 0
              ? `⚠ ${lastResult.synced} synced, ${lastResult.errors} errors`
              : `✓ ${lastResult.message}`}
          </div>
        )}

        {/* Sync button */}
        <Button
          onClick={handleSync}
          disabled={isSyncing}
          className="text-base px-8 py-5 font-black bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-60 w-full"
        >
          {isSyncing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              SYNCING COMPANY PAGES...
            </span>
          ) : (
            "⚡ SYNC COMPANY PAGES"
          )}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          Upserts all researched companies across all campaigns. Safe to run multiple times.
        </p>
      </div>

      {/* Info box: how to use in Slack / Telegram */}
      <div className="border border-gray-200 bg-gray-50 p-5">
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">How to use this data</div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="font-black text-foreground shrink-0">Slack / Telegram bot</span>
            <span>Query <span className="font-mono">lt_mns_company_pages</span> and post the <span className="font-mono">page_url</span> as a clickable link. Filter by <span className="font-mono">urgency_label = 'HIGH'</span> for daily hot-list digests.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-foreground shrink-0">InsertChat / AI assistant</span>
            <span>The table is already in your Supabase project — connect InsertChat to query it in natural language: <em>"Show me all HIGH urgency companies from the Automotive campaign"</em>.</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-foreground shrink-0">Supabase Realtime</span>
            <span>Subscribe to INSERT events on <span className="font-mono">lt_mns_company_pages</span> to trigger notifications the moment a new company is synced.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
