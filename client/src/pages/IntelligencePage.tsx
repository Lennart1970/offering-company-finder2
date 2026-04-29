import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ExternalLink, Zap, Target, RefreshCw, Building2, Send, CheckCircle2, Share2, Link } from "lucide-react";
import { toast } from "sonner";

type UrgencyFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

function urgencyColor(label: string | null) {
  if (label === "HIGH") return "bg-red-600 text-white";
  if (label === "MEDIUM") return "bg-amber-500 text-white";
  if (label === "LOW") return "bg-slate-400 text-white";
  return "bg-slate-200 text-slate-700";
}

function fitColor(score: number | null) {
  if (!score) return "text-slate-400";
  if (score >= 80) return "text-emerald-600 font-bold";
  if (score >= 60) return "text-amber-600 font-semibold";
  return "text-slate-500";
}

export default function IntelligencePage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sendingTelegram, setSendingTelegram] = useState<string | null>(null);

  // Track locally which company_ids have been sent this session
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const sendToTelegram = trpc.telegram.sendCompanyCard.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Sent to Telegram ✈️", { description: "Company card delivered to your Telegram." });
      setSendingTelegram(null);
      if (variables.companyId) {
        setSentIds(prev => new Set(Array.from(prev).concat(variables.companyId!)));
      }
    },
    onError: (err) => {
      toast.error("Telegram error", { description: err.message });
      setSendingTelegram(null);
    },
  });

  // Share Intelligence list
  const shareIntelligenceMutation = trpc.shareExt.shareIntelligenceList.useMutation({
    onSuccess: (result) => {
      navigator.clipboard.writeText(result.listUrl).catch(() => {});
      toast.success(`Shareable list created — ${result.count} companies`, {
        description: "Link copied to clipboard!",
        action: { label: "Open", onClick: () => window.open(result.listUrl, "_blank") },
      });
    },
    onError: (err) => toast.error("Share failed", { description: err.message }),
  });

  const [sendingAllHigh, setSendingAllHigh] = useState(false);
  const sendAllHigh = trpc.telegram.sendAllHigh.useMutation({
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} HIGH companies to Telegram`, {
        description: result.failed > 0 ? `${result.failed} failed` : "All delivered successfully.",
      });
      setSendingAllHigh(false);
    },
    onError: (err) => {
      toast.error("Batch send failed", { description: err.message });
      setSendingAllHigh(false);
    },
  });
  const [campaignId, setCampaignId] = useState<number | undefined>(undefined);
  const [urgencyLabel, setUrgencyLabel] = useState<UrgencyFilter>("ALL");
  const [minFit, setMinFit] = useState<number | undefined>(undefined);
  const [hideSent, setHideSent] = useState(false);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  // Debounced search value
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 300);
  };

  const { data: campaigns } = trpc.companyFinder.getIntelligenceCampaigns.useQuery();

  const { data, isLoading, isFetching } = trpc.companyFinder.getIntelligenceCompanies.useQuery({
    search: debouncedSearch || undefined,
    campaignId,
    urgencyLabel: urgencyLabel === "ALL" ? undefined : urgencyLabel,
    minFit,
    limit: LIMIT,
    offset: page * LIMIT,
  });

  const allCompanies = data?.companies ?? [];
  // Client-side filter: hide companies that have been sent (telegram_sent_at set OR in sentIds)
  const companies = hideSent
    ? allCompanies.filter(c => !c.telegram_sent_at && !sentIds.has(c.company_id ?? ""))
    : allCompanies;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const stats = useMemo(() => {
    const high = companies.filter(c => c.urgency_label === "HIGH").length;
    const avgFit = companies.length
      ? Math.round(companies.reduce((s, c) => s + (c.fit_score ?? 0), 0) / companies.length)
      : 0;
    return { high, avgFit };
  }, [companies]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All synced companies across campaigns — sorted by urgency
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{total} companies</span>
            {stats.high > 0 && (
              <Badge className="bg-red-600 text-white">
                {stats.high} HIGH urgency
              </Badge>
            )}
            {stats.avgFit > 0 && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                Avg fit {stats.avgFit}
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search company, domain, campaign…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Campaign filter */}
          <Select
            value={campaignId ? String(campaignId) : "all"}
            onValueChange={v => { setCampaignId(v === "all" ? undefined : Number(v)); setPage(0); }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {(campaigns ?? []).map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Urgency filter */}
          <div className="flex gap-1">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as UrgencyFilter[]).map(u => (
              <Button
                key={u}
                size="sm"
                variant={urgencyLabel === u ? "default" : "outline"}
                className={urgencyLabel === u && u === "HIGH" ? "bg-red-600 hover:bg-red-700 text-white" :
                           urgencyLabel === u && u === "MEDIUM" ? "bg-amber-500 hover:bg-amber-600 text-white" :
                           urgencyLabel === u && u === "LOW" ? "bg-slate-500 hover:bg-slate-600 text-white" : ""}
                onClick={() => { setUrgencyLabel(u); setPage(0); }}
              >
                {u}
              </Button>
            ))}
          </div>

          {/* Min fit filter */}
          <div className="flex gap-1">
            {[undefined, 60, 70, 80, 90].map(f => (
              <Button
                key={f ?? "any"}
                size="sm"
                variant={minFit === f ? "default" : "outline"}
                onClick={() => { setMinFit(f); setPage(0); }}
              >
                {f ? `FIT ${f}+` : "Any fit"}
              </Button>
            ))}
          </div>

          {/* Hide Sent toggle */}
          <Button
            size="sm"
            variant={hideSent ? "default" : "outline"}
            className={hideSent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-600 text-emerald-600 hover:bg-emerald-50"}
            onClick={() => setHideSent(v => !v)}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {hideSent ? "Showing unsent" : "Hide Sent"}
          </Button>

          {isFetching && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}

          {/* Share Intelligence button */}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto flex items-center gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50"
            disabled={shareIntelligenceMutation.isPending}
            onClick={() => shareIntelligenceMutation.mutate({ origin: window.location.origin })}
          >
            {shareIntelligenceMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            {shareIntelligenceMutation.isPending ? "Creating…" : "Share Intelligence"}
          </Button>

          {/* Send All HIGH button */}
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
            disabled={sendingAllHigh}
            onClick={() => {
              setSendingAllHigh(true);
              sendAllHigh.mutate({ campaignId });
            }}
          >
            {sendingAllHigh ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {sendingAllHigh ? "Sending…" : "Send All HIGH"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Building2 className="w-12 h-12 opacity-20" />
            <p className="text-lg font-medium">No companies found</p>
            <p className="text-sm">
              {total === 0
                ? "Run a sync from the Sync page to populate this table."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[40px_1fr_160px_80px_80px_80px_32px_32px] gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
              <span>#</span>
              <span>Company</span>
              <span>Campaign</span>
              <span className="text-center">Urgency</span>
              <span className="text-center">Fit</span>
              <span className="text-center">Synced</span>
              <span />
              <span />
            </div>

            <div className="space-y-0.5">
              {companies.map((c, idx) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[40px_1fr_160px_80px_80px_80px_32px_32px] gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() => {
                    // Use local_id (integer) for navigation; fall back to extracting from page_url
                    const localId = c.local_id ?? (c.page_url ? c.page_url.split('/company/')[1]?.split('?')[0] : null);
                    if (!localId) return;
                    navigate(`/company/${localId}?from=intelligence`);
                  }}
                >
                  {/* Position */}
                  <span className="text-xs text-muted-foreground font-mono">
                    [{String(page * LIMIT + idx + 1).padStart(2, "0")}]
                  </span>

                  {/* Company name + domain */}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                      {c.company_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.domain ?? ""}</p>
                  </div>

                  {/* Campaign */}
                  <span className="text-xs text-muted-foreground truncate">{c.campaign_name ?? "—"}</span>

                  {/* Urgency badge */}
                  <div className="flex justify-center">
                    {c.urgency_score != null ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${urgencyColor(c.urgency_label)}`}>
                        <Zap className="w-3 h-3" />
                        {c.urgency_score}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>

                  {/* Fit score */}
                  <div className="flex justify-center">
                    <span className={`text-sm ${fitColor(c.fit_score)}`}>
                      {c.fit_score != null ? `${c.fit_score}` : "—"}
                    </span>
                  </div>

                  {/* Synced at */}
                  <div className="flex justify-center">
                    <span className="text-xs text-muted-foreground">
                      {c.synced_at ? new Date(c.synced_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                  </div>

                  {/* External link icon */}
                  <div className="flex justify-center">
                    {c.company_id && (
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>

                  {/* Sent checkmark */}
                  <div className="flex justify-center">
                    {sentIds.has(c.company_id ?? "") ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : <span />}
                  </div>

                  {/* Send to Telegram */}
                  <div
                    className="flex justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      const key = c.company_id ?? c.company_name ?? String(idx);
                      setSendingTelegram(key);
                      sendToTelegram.mutate({
                        companyId: c.company_id ?? undefined,
                        companyName: c.company_name ?? "Unknown",
                        domain: c.domain,
                        urgencyScore: c.urgency_score,
                        urgencyLabel: c.urgency_label,
                        fitScore: c.fit_score,
                        fitLabel: c.fit_label,
                        conversationStarter: c.conversation_starter,
                        topSignalHeadline: c.top_signal_headline,
                        topSignalType: c.top_signal_type,
                        pageUrl: c.page_url ?? (c.local_id ? `/company/${c.local_id}` : null),
                        brainName: c.brain_name,
                      });
                    }}
                  >
                    <Send
                      className={`w-3.5 h-3.5 transition-colors ${
                        sendingTelegram === (c.company_id ?? c.company_name ?? String(idx))
                          ? "text-blue-500 animate-pulse"
                          : "text-muted-foreground group-hover:text-blue-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
