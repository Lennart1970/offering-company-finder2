/**
 * Prototype Requests — Internal Team View
 * 
 * Shows all submitted prototype requests with:
 * - Images + extracted product info
 * - Customer details
 * - Three action buttons: Request More Info / Ask for Sample / Start Costing
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Camera,
  Package,
  Cpu,
  User,
  Mail,
  Building2,
  Calendar,
  MapPin,
  Hash,
  MessageSquare,
  FlaskConical,
  Calculator,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: FileText },
  analyzing: { label: "Analyzing", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Loader2 },
  pending_info: { label: "Pending Info", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  submitted: { label: "New Request", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30", icon: AlertCircle },
  more_info_requested: { label: "More Info Requested", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: MessageSquare },
  sample_requested: { label: "Sample Requested", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: FlaskConical },
  costing: { label: "Costing", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: Calculator },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
};

export default function PrototypeRequests() {
  const { data: requests, isLoading, refetch } = trpc.prototype.allRequests.useQuery();
  const updateStatusMutation = trpc.prototype.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Status updated"); },
    onError: (err) => toast.error(err.message),
  });
  const addNotesMutation = trpc.prototype.addNotes.useMutation({
    onSuccess: () => { refetch(); toast.success("Notes saved"); },
    onError: (err) => toast.error(err.message),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Camera className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">No prototype requests yet</p>
        <p className="text-sm">Requests will appear here when customers submit them</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Prototype Requests</h1>
          <p className="text-sm text-slate-500">{requests.length} request{requests.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {requests.map((req) => {
        const isExpanded = expandedId === req.id;
        const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.draft;
        const StatusIcon = statusCfg.icon;
        const imageUrls: string[] = (() => { try { return JSON.parse(req.imageUrls || "[]"); } catch { return []; } })();
        const features: string[] = (() => { try { return JSON.parse(req.keyFeatureGuess || "[]"); } catch { return []; } })();
        const questions: string[] = (() => { try { return JSON.parse(req.whatWeStillNeed || "[]"); } catch { return []; } })();

        return (
          <Card key={req.id} className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header row — always visible */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : req.id)}
            >
              {/* Thumbnail */}
              {imageUrls[0] && (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 flex-shrink-0">
                  <img src={imageUrls[0]} alt="Product" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">#{req.id}</span>
                  <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                  {req.productTypeGuess || "Pending analysis..."}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {req.customerCompany && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{req.customerCompany}</span>}
                  {req.customerName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{req.customerName}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Expand toggle */}
              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-slate-200 dark:border-white/10">
                <div className="p-5 space-y-6">
                  {/* Images */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Product Images</h3>
                    <div className="flex gap-3">
                      {imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="w-32 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 hover:ring-2 hover:ring-indigo-500 transition-all">
                          <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* AI Extraction */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> Product Type
                      </h3>
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{req.productTypeGuess || "—"}</p>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" /> Key Features
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {features.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* What we still need */}
                  {questions.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What We Still Need</h3>
                      <ul className="space-y-1">
                        {questions.map((q, i) => (
                          <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Customer Information</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {req.customerName && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><User className="w-3 h-3" />Name</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.customerName}</p></div>
                      )}
                      {req.customerEmail && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><Mail className="w-3 h-3" />Email</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.customerEmail}</p></div>
                      )}
                      {req.customerCompany && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><Building2 className="w-3 h-3" />Company</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.customerCompany}</p></div>
                      )}
                      {req.annualUnits && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><Hash className="w-3 h-3" />EAU</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.annualUnits}</p></div>
                      )}
                      {req.expectedSop && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><Calendar className="w-3 h-3" />SOP</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.expectedSop}</p></div>
                      )}
                      {req.region && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><MapPin className="w-3 h-3" />Region</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.region}</p></div>
                      )}
                      {req.designIntent && (
                        <div><span className="text-slate-500 flex items-center gap-1 text-xs"><Package className="w-3 h-3" />Intent</span><p className="text-slate-800 dark:text-slate-200 font-medium capitalize">{req.designIntent}</p></div>
                      )}
                      <div><span className="text-slate-500 flex items-center gap-1 text-xs"><FileText className="w-3 h-3" />Has BOM</span><p className="text-slate-800 dark:text-slate-200 font-medium">{req.hasBom ? "Yes" : "No"}</p></div>
                    </div>
                    {req.customerNotes && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                        <span className="text-xs text-slate-500">Customer Notes:</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{req.customerNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Internal Notes */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Internal Notes</h3>
                    <Textarea
                      value={notesDraft[req.id] ?? req.internalNotes ?? ""}
                      onChange={e => setNotesDraft(prev => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="Add internal notes about this request..."
                      className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white min-h-[80px]"
                    />
                    {(notesDraft[req.id] !== undefined && notesDraft[req.id] !== (req.internalNotes ?? "")) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => addNotesMutation.mutate({ id: req.id, internalNotes: notesDraft[req.id] })}
                        disabled={addNotesMutation.isPending}
                      >
                        Save Notes
                      </Button>
                    )}
                  </div>

                  {/* ─── THREE ACTION BUTTONS ─── */}
                  <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                    <Button
                      variant="outline"
                      className="flex-1 border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                      onClick={() => updateStatusMutation.mutate({ id: req.id, status: "more_info_requested" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Request More Info
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                      onClick={() => updateStatusMutation.mutate({ id: req.id, status: "sample_requested" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <FlaskConical className="w-4 h-4 mr-2" />
                      Ask for Sample
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                      onClick={() => updateStatusMutation.mutate({ id: req.id, status: "costing" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Start Costing
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
