import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Globe, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink } from "lucide-react";

interface ProgressEvent {
  status?: string;
  message?: string;
  error?: string;
  total?: number;
  enriched?: number;
  notFound?: number;
  failed?: number;
  done?: number;
  company?: string;
  apolloFound?: boolean;
  strategy?: string;
  pageTitle?: string;
  searchId?: number;
}

const EXAMPLE_URLS = [
  { label: "CONEXPO-CON/AGG", url: "https://www.conexpoconagg.com/exhibitor-sponsors" },
  { label: "bauma", url: "https://www.bauma.de/en/exhibitors-products/exhibitor-list.html" },
];

export default function ConferenceImport() {
  const [conferenceUrl, setConferenceUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [completedSearchId, setCompletedSearchId] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const appendEvent = (ev: ProgressEvent) => {
    setEvents(prev => {
      const next = [...prev, ev];
      setTimeout(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
      return next;
    });
  };

  const handleImport = async () => {
    const url = conferenceUrl.trim();
    const name = campaignName.trim();

    if (!url) { toast.error("Please enter a conference exhibitor page URL"); return; }
    if (!name) { toast.error("Please enter a campaign name"); return; }

    try { new URL(url); } catch {
      toast.error("Please enter a valid URL (starting with https://)");
      return;
    }

    setIsRunning(true);
    setEvents([]);
    setCompletedSearchId(null);

    try {
      const response = await fetch("/api/conference-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, campaignName: name }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(`Server error ${response.status}: ${text}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev: ProgressEvent = JSON.parse(line);
            appendEvent(ev);
            if (ev.status === "done" && ev.searchId) {
              setCompletedSearchId(ev.searchId);
            }
            if (ev.error) {
              toast.error(ev.error);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      appendEvent({ error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  const getEventIcon = (ev: ProgressEvent) => {
    if (ev.error) return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
    if (ev.status === "done") return <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />;
    if (ev.status === "progress") return ev.apolloFound
      ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      : <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />;
    return <Loader2 className="w-4 h-4 text-blue-500 shrink-0 animate-spin" />;
  };

  const getEventText = (ev: ProgressEvent): string => {
    if (ev.error) return `Error: ${ev.error}`;
    if (ev.status === "scraping") return ev.message || "Fetching page...";
    if (ev.status === "scraped") return `Found ${ev.total} exhibitors on "${ev.pageTitle}" (${ev.strategy} method)`;
    if (ev.status === "campaign_created") return `Campaign created (ID: ${ev.searchId})`;
    if (ev.status === "progress") {
      const found = ev.apolloFound ? "✓ Apollo match" : "○ Not in Apollo";
      return `[${ev.done}/${ev.total}] ${ev.company} — ${found}`;
    }
    if (ev.status === "done") {
      return `Done! ${ev.enriched} enriched via Apollo, ${ev.notFound} not found, ${ev.failed} failed`;
    }
    return ev.message || JSON.stringify(ev);
  };

  const progressEvent = [...events].reverse().find(e => e.status === "progress" && e.done && e.total);
  const progressPct = progressEvent ? Math.round((progressEvent.done! / progressEvent.total!) * 100) : 0;
  const scrapedEvent = events.find(e => e.status === "scraped");
  const doneEvent = events.find(e => e.status === "done");

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-8 h-8" />
          <h1 className="text-4xl font-black">CONFERENCE IMPORT</h1>
        </div>
        <p className="text-lg opacity-70">
          Paste an exhibitor list URL — the tool scrapes all companies, enriches them via Apollo, and creates a ready-to-research campaign.
        </p>
      </div>

      <div className="bg-white border-4 border-black p-8 space-y-6">
        {/* URL input */}
        <div className="space-y-2">
          <Label className="text-sm font-black uppercase tracking-wider">Exhibitor Page URL</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 border-2 border-black font-mono text-sm"
              placeholder="https://www.conexpoconagg.com/exhibitor-sponsors"
              value={conferenceUrl}
              onChange={e => setConferenceUrl(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-muted-foreground self-center">Examples:</span>
            {EXAMPLE_URLS.map(ex => (
              <button
                key={ex.url}
                className="text-xs font-bold underline hover:opacity-70 flex items-center gap-1"
                onClick={() => {
                  setConferenceUrl(ex.url);
                  if (!campaignName) setCampaignName(ex.label);
                }}
                disabled={isRunning}
              >
                {ex.label} <ExternalLink className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>

        {/* Campaign name */}
        <div className="space-y-2">
          <Label className="text-sm font-black uppercase tracking-wider">Campaign Name</Label>
          <Input
            className="border-2 border-black font-bold"
            placeholder="e.g. CONEXPO 2026 Exhibitors"
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
            disabled={isRunning}
          />
        </div>

        {/* How it works */}
        <div className="bg-gray-50 border-2 border-gray-200 p-4 text-sm">
          <p className="font-black text-xs uppercase tracking-wider mb-3">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex gap-2">
              <span className="font-black text-lg leading-none">1</span>
              <span>Scrapes the exhibitor page for company names + websites</span>
            </div>
            <div className="flex gap-2">
              <span className="font-black text-lg leading-none">2</span>
              <span>Looks up each company in Apollo by domain for firmographic data</span>
            </div>
            <div className="flex gap-2">
              <span className="font-black text-lg leading-none">3</span>
              <span>Creates a campaign — ready for Deep Research and fit scoring</span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <Button
          onClick={handleImport}
          disabled={isRunning || !conferenceUrl.trim() || !campaignName.trim()}
          className="w-full font-black text-lg py-6 border-4 border-black"
          size="lg"
        >
          {isRunning ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Importing...</>
          ) : (
            <><Building2 className="w-5 h-5 mr-2" /> START IMPORT</>
          )}
        </Button>
      </div>

      {/* Progress log */}
      {events.length > 0 && (
        <div className="mt-6 bg-white border-4 border-black">
          <div className="border-b-4 border-black px-6 py-3 flex items-center justify-between">
            <span className="font-black uppercase tracking-wider text-sm">Import Progress</span>
            {scrapedEvent && !doneEvent && (
              <span className="text-sm font-mono">
                {progressPct}% — {progressEvent?.done ?? 0}/{scrapedEvent.total} companies
              </span>
            )}
            {doneEvent && (
              <span className="text-sm font-black text-green-700">COMPLETE</span>
            )}
          </div>

          {/* Progress bar */}
          {scrapedEvent && (
            <div className="h-2 bg-gray-100 border-b-2 border-black">
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${doneEvent ? 100 : progressPct}%` }}
              />
            </div>
          )}

          {/* Log entries */}
          <div
            ref={logRef}
            className="p-4 space-y-1 max-h-80 overflow-y-auto font-mono text-xs"
          >
            {events.map((ev, i) => (
              <div key={i} className="flex items-start gap-2">
                {getEventIcon(ev)}
                <span className={ev.error ? "text-red-600" : ev.status === "done" ? "font-bold" : ""}>
                  {getEventText(ev)}
                </span>
              </div>
            ))}
            {isRunning && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>

          {/* Done — navigate to results */}
          {completedSearchId && (
            <div className="border-t-4 border-black p-4 bg-green-50 flex items-center justify-between">
              <div>
                <p className="font-black">Import complete!</p>
                <p className="text-sm text-muted-foreground">
                  {doneEvent?.enriched} companies enriched via Apollo. Ready for Deep Research.
                </p>
              </div>
              <Button
                onClick={() => setLocation(`/search-results/${completedSearchId}`)}
                className="font-black border-2 border-black flex items-center gap-2"
              >
                VIEW CAMPAIGN <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
