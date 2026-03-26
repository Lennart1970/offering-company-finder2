import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Upload, CheckCircle2, XCircle, AlertTriangle, Users, Eye, Clock, Zap, ArrowRight, FileSpreadsheet, Loader2 } from "lucide-react";

type MatchPreview = {
  companyName: string;
  domain: string;
  matchedCompanyId: number | null;
  matchedCompanyName: string | null;
  matchType: "exact_domain" | "fuzzy_domain" | "unmatched";
  engagementScore: number;
  sessions: number;
  pages: number;
  duration: number;
  intentSignals: string[];
  personas: Array<{ firstName: string; lastName: string; email: string; jobTitle: string }>;
  topPages: string[];
};

type PreviewResult = {
  totalCompanies: number;
  totalPageViews: number;
  matchedCount: number;
  unmatchedCount: number;
  warnings: string[];
  matches: MatchPreview[];
};

export default function LeadinfoImport() {
  const [selectedSearchId, setSelectedSearchId] = useState<string>("");
  const [fileBase64, setFileBase64] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [committed, setCommitted] = useState(false);

  // Fetch campaigns for the dropdown
  const { data: searches } = trpc.companyFinder.getSearchHistory.useQuery({ showArchived: false });
  const importPreview = trpc.leadinfo.importPreview.useMutation();
  const importCommit = trpc.leadinfo.importCommit.useMutation();
  const { data: importHistory } = trpc.leadinfo.importHistory.useQuery();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }
    setFileName(file.name);
    setPreview(null);
    setCommitted(false);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!fileBase64 || !selectedSearchId) {
      toast.error("Please select a file and a campaign first");
      return;
    }
    try {
      const result = await importPreview.mutateAsync({
        fileBase64,
        searchId: parseInt(selectedSearchId),
      });
      setPreview(result);
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.warning(w));
      }
      toast.success(`Parsed ${result.totalCompanies} companies, ${result.matchedCount} matched to campaign`);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse file");
    }
  }, [fileBase64, selectedSearchId, importPreview]);

  const handleCommit = useCallback(async () => {
    if (!fileBase64 || !selectedSearchId) return;
    try {
      const result = await importCommit.mutateAsync({
        fileBase64,
        searchId: parseInt(selectedSearchId),
        includeUnmatched: showUnmatched,
      });
      setCommitted(true);
      toast.success(`Imported ${result.savedCount} companies (${result.matchedCount} matched to campaign)`);
    } catch (err: any) {
      toast.error(err.message || "Failed to import");
    }
  }, [fileBase64, selectedSearchId, showUnmatched, importCommit]);

  const matchedCompanies = useMemo(
    () => preview?.matches.filter((m) => m.matchType !== "unmatched") || [],
    [preview]
  );
  const unmatchedCompanies = useMemo(
    () => preview?.matches.filter((m) => m.matchType === "unmatched") || [],
    [preview]
  );

  const campaignOptions = useMemo(
    () =>
      (searches || [])
        .filter((s: any) => s.status === "completed")
        .map((s: any) => ({
          id: String(s.id),
          label: s.offeringName || s.companyWebsite || `Campaign #${s.id}`,
        })),
    [searches]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Globe className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leadinfo Import</h1>
          <p className="text-sm text-muted-foreground">
            Upload a Leadinfo export to match website visitors against your campaign companies
          </p>
        </div>
      </div>

      {/* Step 1: Upload + Campaign Select */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-bold">1</span>
            Upload &amp; Select Campaign
          </CardTitle>
          <CardDescription>
            Choose a Leadinfo Excel export and the campaign to match against
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* File upload */}
            <div className="flex-1">
              <label
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  {fileName ? (
                    <>
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                      <span className="text-sm font-medium text-foreground">{fileName}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8" />
                      <span className="text-sm">Drop Leadinfo Excel here or click to browse</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            {/* Campaign selector */}
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Campaign</label>
              <Select value={selectedSearchId} onValueChange={setSelectedSearchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaignOptions.map((opt: any) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handlePreview}
                disabled={!fileBase64 || !selectedSearchId || importPreview.isPending}
                className="w-full mt-2"
              >
                {importPreview.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analysing...</>
                ) : (
                  <><Eye className="w-4 h-4 mr-2" /> Preview Matches</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Match Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-bold">2</span>
              Match Preview
            </CardTitle>
            <CardDescription>
              Review which Leadinfo visitors matched to campaign companies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{preview.totalCompanies}</div>
                <div className="text-xs text-muted-foreground">Total Visitors</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">{preview.matchedCount}</div>
                <div className="text-xs text-emerald-600">Matched</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{preview.unmatchedCount}</div>
                <div className="text-xs text-amber-600">Unmatched</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{preview.totalPageViews}</div>
                <div className="text-xs text-blue-600">Page Views</div>
              </div>
            </div>

            {/* Matched companies table */}
            {matchedCompanies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Matched Companies ({matchedCompanies.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Leadinfo Visitor</th>
                        <th className="text-left p-2 font-medium">Matched To</th>
                        <th className="text-center p-2 font-medium">Engagement</th>
                        <th className="text-left p-2 font-medium">Intent Signals</th>
                        <th className="text-center p-2 font-medium">Personas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedCompanies.map((m, i) => (
                        <tr key={i} className="border-t hover:bg-muted/30">
                          <td className="p-2">
                            <div className="font-medium">{m.companyName}</div>
                            <div className="text-xs text-muted-foreground">{m.domain}</div>
                          </td>
                          <td className="p-2">
                            <div className="font-medium">{m.matchedCompanyName}</div>
                            <Badge variant="outline" className="text-[10px] mt-0.5">
                              {m.matchType === "exact_domain" ? "exact" : "fuzzy"}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                              m.engagementScore >= 30
                                ? "bg-emerald-100 text-emerald-800"
                                : m.engagementScore >= 10
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              <Zap className="w-3 h-3" />
                              {m.engagementScore}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {m.sessions}s / {m.pages}p / {m.duration}s
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {m.intentSignals.slice(0, 3).map((s, j) => (
                                <Badge key={j} variant="secondary" className="text-[10px]">
                                  {s}
                                </Badge>
                              ))}
                              {m.intentSignals.length > 3 && (
                                <Badge variant="outline" className="text-[10px]">
                                  +{m.intentSignals.length - 3}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {m.personas.length > 0 ? (
                              <Badge className="bg-purple-100 text-purple-800 text-[10px]">
                                <Users className="w-3 h-3 mr-1" />
                                {m.personas.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unmatched companies (collapsible) */}
            {unmatchedCompanies.length > 0 && (
              <div>
                <button
                  onClick={() => setShowUnmatched(!showUnmatched)}
                  className="text-sm font-semibold flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XCircle className="w-4 h-4 text-amber-500" />
                  Unmatched Visitors ({unmatchedCompanies.length})
                  <ArrowRight className={`w-3 h-3 transition-transform ${showUnmatched ? "rotate-90" : ""}`} />
                </button>
                {showUnmatched && (
                  <div className="mt-2 border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Company</th>
                          <th className="text-left p-2 font-medium">Domain</th>
                          <th className="text-left p-2 font-medium">Branch</th>
                          <th className="text-center p-2 font-medium">Engagement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedCompanies.map((m, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-medium">{m.companyName}</td>
                            <td className="p-2 text-muted-foreground">{m.domain}</td>
                            <td className="p-2 text-muted-foreground text-xs">{/* branch not in preview */}—</td>
                            <td className="p-2 text-center">
                              <span className="text-xs font-bold">{m.engagementScore}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Commit button */}
            {!committed ? (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleCommit}
                  disabled={importCommit.isPending || matchedCompanies.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {importCommit.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Import {matchedCompanies.length} Matched Companies</>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  This will enrich matched campaign companies with Leadinfo visitor data
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">
                  Import complete! Matched companies now show a "Website Visitor" badge.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      {importHistory && importHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Import History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importHistory.map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    <span>Campaign #{h.searchId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {h.matchedCount}/{h.count} matched
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {h.importedAt ? new Date(h.importedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
