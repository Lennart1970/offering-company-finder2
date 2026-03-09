import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Upload,
  X,
} from "lucide-react";

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
  enrichMethod?: string;
  hasWebsite?: number;
  nameOnly?: number;
  searchId?: number;
}

export default function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [completedSearchId, setCompletedSearchId] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const appendEvent = (ev: ProgressEvent) => {
    setEvents((prev) => {
      const next = [...prev, ev];
      setTimeout(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
      return next;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && /\.(xlsx|xls|csv)$/i.test(dropped.name)) {
      setFile(dropped);
      if (!campaignName) setCampaignName(dropped.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    } else {
      toast.error("Please drop a .xlsx, .xls, or .csv file");
    }
  }, [campaignName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      setFile(picked);
      if (!campaignName) setCampaignName(picked.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    }
  };

  const handleImport = async () => {
    if (!file) { toast.error("Please select a file"); return; }
    const name = campaignName.trim();
    if (!name) { toast.error("Please enter a campaign name"); return; }

    setIsRunning(true);
    setEvents([]);
    setCompletedSearchId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignName", name);

      const response = await fetch("/api/excel-import", {
        method: "POST",
        body: formData,
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
            if (ev.error) toast.error(ev.error);
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
    if (ev.status === "parsing") return "Parsing file...";
    if (ev.status === "parsed") {
      return `Parsed ${ev.total} companies — ${ev.hasWebsite} with website, ${ev.nameOnly} name-only`;
    }
    if (ev.status === "campaign_created") return `Campaign created (ID: ${ev.searchId})`;
    if (ev.status === "progress") {
      const method = ev.enrichMethod ? ` via ${ev.enrichMethod}` : "";
      const found = ev.apolloFound ? `✓ Apollo match${method}` : "○ Not in Apollo";
      return `[${ev.done}/${ev.total}] ${ev.company} — ${found}`;
    }
    if (ev.status === "done") {
      return `Done! ${ev.enriched} enriched via Apollo, ${ev.notFound} not found, ${ev.failed} failed`;
    }
    return ev.message || JSON.stringify(ev);
  };

  const progressEvent = [...events].reverse().find((e) => e.status === "progress" && e.done && e.total);
  const parsedEvent = events.find((e) => e.status === "parsed");
  const doneEvent = events.find((e) => e.status === "done");
  const progressPct = progressEvent && parsedEvent
    ? Math.round((progressEvent.done! / progressEvent.total!) * 100)
    : 0;

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet className="w-8 h-8" />
          <h1 className="text-4xl font-black">EXCEL IMPORT</h1>
        </div>
        <p className="text-lg opacity-70">
          Upload an Excel or CSV file with company names and websites. Each company is enriched via Apollo and added to a new campaign.
        </p>
      </div>

      <div className="bg-white border-4 border-black p-8 space-y-6">
        {/* File drop zone */}
        <div className="space-y-2">
          <Label className="text-sm font-black uppercase tracking-wider">File (.xlsx / .xls / .csv)</Label>
          <div
            className={`border-4 border-dashed transition-colors cursor-pointer rounded-none p-8 text-center ${
              isDragging ? "border-black bg-gray-50" : "border-gray-300 hover:border-black"
            } ${isRunning ? "opacity-50 pointer-events-none" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isRunning && fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-black">{file.name}</p>
                  <p className="text-sm opacity-60">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  className="ml-4 p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto opacity-40" />
                <p className="font-black text-sm">Drop your file here or click to browse</p>
                <p className="text-xs opacity-50">Supports .xlsx, .xls, .csv — max 10MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Campaign name */}
        <div className="space-y-2">
          <Label className="text-sm font-black uppercase tracking-wider">Campaign Name</Label>
          <Input
            className="border-2 border-black font-bold"
            placeholder="e.g. Beurs 2026 Exhibitors"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            disabled={isRunning}
          />
        </div>

        {/* Expected format */}
        <div className="bg-gray-50 border-2 border-gray-200 p-4 text-sm">
          <p className="font-black text-xs uppercase tracking-wider mb-3">Expected File Format</p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full max-w-sm">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-3 py-1 text-left font-black">Company Name</th>
                  <th className="px-3 py-1 text-left font-black">Website</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-1">Arcadis Nederland B.V.</td>
                  <td className="px-3 py-1 font-mono">https://www.arcadis.com</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-1">TomTom</td>
                  <td className="px-3 py-1 font-mono">https://www.tomtom.com</td>
                </tr>
                <tr>
                  <td className="px-3 py-1">Also Nederland B.V.</td>
                  <td className="px-3 py-1 opacity-50 italic">– (name-only fallback)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs opacity-60 mt-2">
            Column headers are detected automatically (case-insensitive). Website column is optional — companies without a URL are enriched by name.
          </p>
        </div>

        {/* Action button */}
        <Button
          onClick={handleImport}
          disabled={isRunning || !file || !campaignName.trim()}
          className="w-full font-black text-lg py-6 border-4 border-black"
          size="lg"
        >
          {isRunning ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Importing...</>
          ) : (
            <><FileSpreadsheet className="w-5 h-5 mr-2" /> START IMPORT</>
          )}
        </Button>
      </div>

      {/* Progress log */}
      {events.length > 0 && (
        <div className="mt-6 bg-white border-4 border-black">
          <div className="border-b-4 border-black px-6 py-3 flex items-center justify-between">
            <span className="font-black uppercase tracking-wider text-sm">Import Progress</span>
            {parsedEvent && !doneEvent && (
              <span className="text-sm font-mono">
                {progressPct}% — {progressEvent?.done ?? 0}/{parsedEvent.total} companies
              </span>
            )}
            {doneEvent && <span className="text-sm font-black text-green-700">COMPLETE</span>}
          </div>

          {/* Progress bar */}
          {parsedEvent && (
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
