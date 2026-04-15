import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// Helper to safely parse JSON fields
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Parse a JSON field that should be string[], but the LLM may have stored
 * objects like {type, description, conversationStarter} instead of plain strings.
 * Every element is coerced to a displayable string.
 */
function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        // Handle known LLM object shapes
        return item.description ?? item.conversationStarter ?? item.opener ?? item.type ?? JSON.stringify(item);
      }
      return String(item);
    });
  } catch {
    return [];
  }
}

export default function Brain() {
  const [website, setWebsite] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [brainName, setBrainName] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showEditSection, setShowEditSection] = useState(false);
  // Excel upload state
  const [createMode, setCreateMode] = useState<"website" | "excel">("website");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelBrainName, setExcelBrainName] = useState("");

  const { user } = useAuth();
  const { data: brainData, isLoading } = trpc.companyFinder.getActiveBrain.useQuery();
  const { data: historyData } = trpc.companyFinder.getBrainHistory.useQuery();
  const utils = trpc.useUtils();

  const researchMutation = trpc.companyFinder.researchBrain.useMutation({
    onSuccess: (data) => {
      toast.success(`Brain research completed for ${data.brain?.companyName}`);
      utils.companyFinder.getActiveBrain.invalidate();
      utils.companyFinder.getBrainHistory.invalidate();
      // Reset form
      setWebsite("");
      setCompanyName("");
      setBrainName("");
    },
    onError: (error) => {
      toast.error(`Research failed: ${error.message}`);
    },
  });

  const updateMutation = trpc.companyFinder.updateBrain.useMutation({
    onSuccess: () => {
      toast.success("Brain updated");
      utils.companyFinder.getActiveBrain.invalidate();
      utils.companyFinder.getBrainHistory.invalidate();
      setEditingField(null);
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const setActiveMutation = trpc.companyFinder.setActiveBrain.useMutation({
    onSuccess: () => {
      toast.success("Brain activated");
      utils.companyFinder.getActiveBrain.invalidate();
      utils.companyFinder.getBrainHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Activation failed: ${error.message}`);
    },
  });

  const deleteMutation = trpc.companyFinder.deleteBrain.useMutation({
    onSuccess: () => {
      toast.success("Brain deleted");
      utils.companyFinder.getBrainHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Deletion failed: ${error.message}`);
    },
  });

  const toggleSharedMutation = trpc.companyFinder.toggleBrainShared.useMutation({
    onSuccess: (data) => {
      toast.success(data.isShared ? "Brain is now shared with all users" : "Brain is now private");
      utils.companyFinder.getBrainHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Share toggle failed: ${error.message}`);
    },
  });

  const pushToSupabaseMutation = trpc.companyFinder.pushBrainToSupabase.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(`Push failed: ${data.message}`);
      }
    },
    onError: (error) => {
      toast.error(`Push failed: ${error.message}`);
    },
  });

  const pullFromSupabaseMutation = trpc.companyFinder.pullBrainFromSupabase.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        utils.companyFinder.getActiveBrain.invalidate();
        utils.companyFinder.getBrainHistory.invalidate();
      } else {
        toast.error(`Pull failed: ${data.message}`);
      }
    },
    onError: (error) => {
      toast.error(`Pull failed: ${error.message}`);
    },
  });

  const brain = brainData?.brain;
  const brainHistory = historyData?.history || [];

  // Parse structured fields
  const capabilities = useMemo(() => parseStringArray(brain?.coreCapabilities), [brain?.coreCapabilities]);
  const valueProps = useMemo(() => parseJson<Array<{ proposition: string; targetAudience: string }>>(brain?.valuePropositions, []), [brain?.valuePropositions]);
  const industries = useMemo(() => parseStringArray(brain?.icpIndustries), [brain?.icpIndustries]);
  const painPoints = useMemo(() => parseStringArray(brain?.icpPainPoints), [brain?.icpPainPoints]);
  const buyingSignals = useMemo(() => parseStringArray(brain?.icpBuyingSignals), [brain?.icpBuyingSignals]);
  const fitCriteria = useMemo(() => {
    const raw = parseJson<{ mustHave?: any[] | null; niceToHave?: any[] | null; disqualifiers?: any[] | null }>(brain?.fitCriteria, {});
    // Guard: LLM may have stored null sub-arrays or objects instead of strings.
    const coerce = (arr: any) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.description ?? item.conversationStarter ?? item.opener ?? item.type ?? JSON.stringify(item);
        return String(item);
      });
    };
    return {
      mustHave: coerce(raw.mustHave),
      niceToHave: coerce(raw.niceToHave),
      disqualifiers: coerce(raw.disqualifiers),
    };
  }, [brain?.fitCriteria]);
  const urgencyTriggers = useMemo(() => parseStringArray(brain?.urgencyTriggers), [brain?.urgencyTriggers]);

  const handleStartEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (field: string) => {
    if (!brain) return;
    updateMutation.mutate({
      brainId: brain.id,
      updates: { [field]: editValue },
    });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleStartResearch = () => {
    if (!website.trim()) {
      toast.error("Please enter a website URL");
      return;
    }
    if (!brainName.trim()) {
      toast.error("Please enter a brain name");
      return;
    }
    researchMutation.mutate({
      companyWebsite: website.trim(),
      companyName: companyName.trim() || undefined,
      brainName: brainName.trim(),
    });
  };

  const uploadExcelMutation = trpc.companyFinder.uploadBrainExcel.useMutation({
    onSuccess: (data) => {
      const warnings = data.warnings ?? [];
      if (warnings.length > 0) {
        toast.warning(`Brain created with ${warnings.length} warning(s): ${warnings[0]}`);
      } else {
        toast.success(`Brain created from Excel for ${data.brain?.companyName}`);
      }
      utils.companyFinder.getActiveBrain.invalidate();
      utils.companyFinder.getBrainHistory.invalidate();
      setExcelFile(null);
      setExcelBrainName("");
      setShowCreateSection(false);
    },
    onError: (error) => {
      toast.error(`Excel upload failed: ${error.message}`);
    },
  });

  const handleExcelUpload = async () => {
    if (!excelFile) {
      toast.error("Please select an Excel file");
      return;
    }
    const arrayBuffer = await excelFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    uploadExcelMutation.mutate({
      fileBase64: base64,
      brainName: excelBrainName.trim() || undefined,
    });
  };

  const handleSetActive = (brainId: number) => {
    setActiveMutation.mutate({ brainId });
  };

  const handleDelete = (brainId: number) => {
    if (confirm("Are you sure you want to delete this brain?")) {
      deleteMutation.mutate({ brainId });
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-black text-muted-foreground mb-2">[00] COCKPIT</div>
        <h1 className="text-6xl font-black tracking-tight mb-4">
          OFFERING BRAIN
        </h1>

        {/* Product Vision Block */}
        <div className="border-l-4 border-black pl-5 mb-6">
          <p className="text-base font-bold text-foreground leading-snug mb-3">
            LeadTrigger.ai turns a seller's deep understanding of their own offering into a precision-guided, AI-powered prospecting machine — so sales teams spend every minute on the right company, at the right moment, with the right reason to call.
          </p>
          <p className="text-2xl font-black tracking-tight text-black">
            Know who to call.&nbsp; Know why.&nbsp; Know when.&nbsp; Know who to ask for.&nbsp; Know what to offer.
          </p>
        </div>

        {/* Five-variable breakdown */}
        <div className="grid grid-cols-5 gap-0 border-4 border-black mb-2">
          <div className="border-r-4 border-black p-4">
            <div className="text-xs font-black text-muted-foreground mb-1">RIGHT COMPANY</div>
            <div className="text-sm font-black">Fit Score</div>
            <div className="text-xs text-muted-foreground mt-1">Offering Brain × Apollo data — only companies that match your ICP enter the funnel.</div>
          </div>
          <div className="border-r-4 border-black p-4">
            <div className="text-xs font-black text-muted-foreground mb-1">RIGHT MOMENT</div>
            <div className="text-sm font-black">Noise Detection</div>
            <div className="text-xs text-muted-foreground mt-1">Trigger events and buying signals — only companies showing urgency get deep research.</div>
          </div>
          <div className="border-r-4 border-black p-4">
            <div className="text-xs font-black text-muted-foreground mb-1">RIGHT REASON</div>
            <div className="text-sm font-black">Deep Research Brief</div>
            <div className="text-xs text-muted-foreground mt-1">Conversation starter + intelligence brief — so every call starts with a specific, credible reason.</div>
          </div>
          <div className="border-r-4 border-black p-4">
            <div className="text-xs font-black text-muted-foreground mb-1">RIGHT SALES REP</div>
            <div className="text-sm font-black">Decision-Maker Match</div>
            <div className="text-xs text-muted-foreground mt-1">Find the right contact — title, seniority, and role — so the right person makes the call.</div>
          </div>
          <div className="p-4 bg-amber-50">
            <div className="text-xs font-black text-amber-700 mb-1">RIGHT PRODUCT</div>
            <div className="text-sm font-black">BOM + Capability Statement</div>
            <div className="text-xs text-muted-foreground mt-1">From product images to a full bill of materials — know exactly what you can supply and quote it on the spot.</div>
          </div>
        </div>
      </div>

      {/* My Saved Brains */}
      {brainHistory.length > 0 && (
        <div className="border-4 border-black p-6 mb-8">
          <div className="text-lg font-black mb-4">📚 MY SAVED BRAINS</div>
          <div className="space-y-3">
            {brainHistory.map((b) => (
              <div
                key={b.id}
                className={`border-4 p-4 ${b.isActive === 1 ? "border-green-600 bg-green-50" : "border-gray-300"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <button
                        onClick={() => b.isActive !== 1 && handleSetActive(b.id)}
                        className={`w-5 h-5 rounded-full border-4 flex items-center justify-center ${
                          b.isActive === 1 ? "border-green-600 bg-green-600" : "border-gray-400 hover:border-black cursor-pointer"
                        }`}
                        disabled={b.isActive === 1}
                      >
                        {b.isActive === 1 && <div className="w-2 h-2 rounded-full bg-white" />}
                      </button>
                      <div className="font-black text-lg">{b.brainName}</div>
                      {b.isActive === 1 && (
                        <span className="text-xs font-black bg-green-600 text-white px-2 py-1">ACTIVE</span>
                      )}
                      {b.isShared === 1 && (
                        <span className="text-xs font-black bg-blue-600 text-white px-2 py-1">SHARED</span>
                      )}
                      {b.userId !== user?.id && (
                        <span className="text-xs font-bold text-blue-600 border border-blue-300 px-2 py-1">TEAM BRAIN</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-muted-foreground ml-8">
                      {b.companyName} • {b.companyWebsite}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground ml-8 mt-1">
                      Created: {new Date(b.createdAt).toLocaleDateString()}
                    </div>
                    {(b.sicCodes || b.naceCodes) && (
                      <div className="ml-8 mt-3 space-y-1">
                        {b.sicCodes && (() => {
                          try {
                            const codes = JSON.parse(b.sicCodes) as { code: string; description: string }[];
                            return (
                              <div className="text-xs">
                                <span className="font-black">SIC:</span>{" "}
                                {codes.map(c => c.code).join(" · ")}
                              </div>
                            );
                          } catch { return <div className="text-xs"><span className="font-black">SIC:</span> {b.sicCodes}</div>; }
                        })()}
                        {b.naceCodes && (() => {
                          try {
                            const codes = JSON.parse(b.naceCodes) as { code: string; description: string }[];
                            return (
                              <div className="text-xs">
                                <span className="font-black">NACE:</span>{" "}
                                {codes.map(c => c.code).join(" · ")}
                              </div>
                            );
                          } catch { return <div className="text-xs"><span className="font-black">NACE:</span> {b.naceCodes}</div>; }
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => pushToSupabaseMutation.mutate({ brainId: b.id })}
                      variant="outline"
                      size="sm"
                      className="text-xs font-black border-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
                      disabled={pushToSupabaseMutation.isPending}
                    >
                      {pushToSupabaseMutation.isPending ? "PUSHING..." : "⬆ PUSH TO SUPABASE"}
                    </Button>
                    <Button
                      onClick={() => pullFromSupabaseMutation.mutate({ brainId: b.id })}
                      variant="outline"
                      size="sm"
                      className="text-xs font-black border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                      disabled={pullFromSupabaseMutation.isPending}
                    >
                      {pullFromSupabaseMutation.isPending ? "PULLING..." : "⬇ PULL FROM SUPABASE"}
                    </Button>
                    {b.userId === user?.id && (
                      <Button
                        onClick={() => toggleSharedMutation.mutate({ brainId: b.id, isShared: b.isShared !== 1 })}
                        variant="outline"
                        size="sm"
                        className={`text-xs font-black border-2 ${
                          b.isShared === 1
                            ? "border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                            : "border-gray-400 text-gray-600 hover:bg-gray-100"
                        }`}
                        disabled={toggleSharedMutation.isPending}
                      >
                        {b.isShared === 1 ? "🔓 SHARED" : "🔒 PRIVATE"}
                      </Button>
                    )}
                    {b.isActive !== 1 && b.userId === user?.id && (
                      <>
                        <Button
                          onClick={() => handleSetActive(b.id)}
                          variant="outline"
                          size="sm"
                          className="text-xs font-black border-2 border-black"
                          disabled={setActiveMutation.isPending}
                        >
                          SET ACTIVE
                        </Button>
                        <Button
                          onClick={() => handleDelete(b.id)}
                          variant="outline"
                          size="sm"
                          className="text-xs font-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                          disabled={deleteMutation.isPending}
                        >
                          DELETE
                        </Button>
                      </>
                    )}
                    {b.isActive !== 1 && b.userId !== user?.id && (
                      <Button
                        onClick={() => handleSetActive(b.id)}
                        variant="outline"
                        size="sm"
                        className="text-xs font-black border-2 border-black"
                        disabled={setActiveMutation.isPending}
                      >
                        SET ACTIVE
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t-4 border-black">
            {brain && (
              <Button
                onClick={() => setShowEditSection(!showEditSection)}
                variant="outline"
                className="flex-1 font-black border-4 border-black text-lg py-6 hover:bg-black hover:text-white"
              >
                ✏️ VIEW / EDIT BRAIN
              </Button>
            )}
            <Button
              onClick={() => setShowCreateSection(!showCreateSection)}
              variant="outline"
              className="flex-1 font-black border-4 border-black text-lg py-6 hover:bg-black hover:text-white"
            >
              ➕ CREATE NEW BRAIN
            </Button>
          </div>
        </div>
      )}

      {/* Research Trigger */}
      {showCreateSection && (
      <div data-section="create-brain" className="border-4 border-black p-6 mb-8">
        <div className="text-lg font-black mb-4">CREATE NEW BRAIN</div>

        {/* Mode toggle */}
        <div className="flex gap-0 mb-6 border-4 border-black w-fit">
          <button
            onClick={() => setCreateMode("website")}
            className={`px-5 py-2 text-sm font-black transition-colors ${
              createMode === "website" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            🌐 WEBSITE URL
          </button>
          <button
            onClick={() => setCreateMode("excel")}
            className={`px-5 py-2 text-sm font-black transition-colors border-l-4 border-black ${
              createMode === "excel" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            📊 UPLOAD EXCEL
          </button>
        </div>

        {createMode === "website" && (
          <>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-black block mb-1">COMPANY NAME</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-3 border-4 border-black font-bold text-lg"
                />
              </div>
              <div>
                <label className="text-xs font-black block mb-1">WEBSITE URL</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                  className="w-full px-4 py-3 border-4 border-black font-bold text-lg"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs font-black block mb-1">BRAIN NAME</label>
              <input
                type="text"
                value={brainName}
                onChange={(e) => setBrainName(e.target.value)}
                placeholder="My Company Brain"
                className="w-full px-4 py-3 border-4 border-black font-bold text-lg"
              />
              <div className="text-xs font-bold text-muted-foreground mt-1">
                Give this brain a memorable name (e.g., "Acme Manufacturing Brain", "My Sales Intelligence Brain")
              </div>
            </div>
            <Button
              onClick={handleStartResearch}
              disabled={researchMutation.isPending}
              className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white w-full"
            >
              {researchMutation.isPending ? "[RESEARCHING... THIS TAKES ~30 SECONDS]" : "[RESEARCH & SAVE BRAIN →]"}
            </Button>
            {researchMutation.isPending && (
              <div className="mt-4 text-sm font-bold text-muted-foreground animate-pulse">
                Grok is analyzing the website, searching for capabilities, ICP, competitive positioning...
              </div>
            )}
          </>
        )}

        {createMode === "excel" && (
          <>
            <div className="bg-slate-50 border-2 border-slate-200 rounded p-4 mb-5">
              <div className="text-sm font-black mb-1">📥 STEP 1 — DOWNLOAD THE TEMPLATE</div>
              <div className="text-xs text-muted-foreground mb-3">
                Fill in your offering details across 6 sheets: Overview, Capabilities, Value Propositions, ICP, Fit Criteria, and Urgency Triggers.
              </div>
              <a
                href="https://d2xsxph8kpxj0f.cloudfront.net/310419663030791262/jD7AgpCX9VGnkJhgqHKmjt/offering-brain-template_5eee52bf.xlsx"
                download="offering-brain-template.xlsx"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-black hover:bg-black hover:text-white transition-colors"
              >
                ⬇ DOWNLOAD OFFERING BRAIN TEMPLATE (.xlsx)
              </a>
            </div>

            <div className="mb-4">
              <div className="text-sm font-black mb-2">📤 STEP 2 — UPLOAD YOUR FILLED TEMPLATE</div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                className="w-full px-4 py-3 border-4 border-black font-bold text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:font-black file:bg-black file:text-white cursor-pointer"
              />
              {excelFile && (
                <div className="text-xs font-bold text-green-700 mt-1">✓ {excelFile.name} selected</div>
              )}
            </div>

            <div className="mb-5">
              <label className="text-xs font-black block mb-1">BRAIN NAME (optional — overrides the name in the file)</label>
              <input
                type="text"
                value={excelBrainName}
                onChange={(e) => setExcelBrainName(e.target.value)}
                placeholder="e.g. My Company Brain Q2 2026"
                className="w-full px-4 py-3 border-4 border-black font-bold text-lg"
              />
            </div>

            <Button
              onClick={handleExcelUpload}
              disabled={uploadExcelMutation.isPending || !excelFile}
              className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white w-full"
            >
              {uploadExcelMutation.isPending ? "[PROCESSING EXCEL... ~15 SECONDS]" : "[BUILD BRAIN FROM EXCEL →]"}
            </Button>
            {uploadExcelMutation.isPending && (
              <div className="mt-4 text-sm font-bold text-muted-foreground animate-pulse">
                Parsing your Excel and running LLM normalisation to fill any gaps...
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="border-4 border-black p-12 animate-pulse text-center">
          <div className="text-2xl font-black">LOADING BRAIN...</div>
        </div>
      )}

      {/* No Brain Yet */}
      {!isLoading && !brain && (
        <div className="border-4 border-black p-12 text-center">
          <div className="text-3xl font-black mb-4">NO ACTIVE BRAIN</div>
          <div className="text-lg font-bold text-muted-foreground">
            {brainHistory.length > 0
              ? "Select a brain from the list above to activate it, or create a new one below."
              : "Enter your company details below and click \"Research & Save Brain\" to build your intelligence layer."}
          </div>
        </div>
      )}

      {/* Brain Display */}
      {brain && brain.status === "completed" && showEditSection && (
        <div className="space-y-6">
          {/* Status Bar */}
          <div data-section="edit-brain" className="flex items-center justify-between bg-black text-white px-6 py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-black">ACTIVE BRAIN: {brain.brainName}</span>
              <span className="text-sm font-bold opacity-70">{brain.companyName}</span>
            </div>
            <div className="text-xs font-bold opacity-50">
              Updated: {new Date(brain.updatedAt).toLocaleDateString()}
            </div>
          </div>

          {/* Brain Name (Editable) */}
          <EditableSection
            title="BRAIN NAME"
            field="brainName"
            value={brain.brainName || ""}
            editingField={editingField}
            editValue={editValue}
            onStartEdit={handleStartEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onEditValueChange={setEditValue}
            isPending={updateMutation.isPending}
          >
            <div className="text-2xl font-black">{brain.brainName}</div>
          </EditableSection>

          {/* Offering Summary */}
          <EditableSection
            title="OFFERING SUMMARY"
            field="offeringSummary"
            value={brain.offeringSummary || ""}
            editingField={editingField}
            editValue={editValue}
            onStartEdit={handleStartEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onEditValueChange={setEditValue}
            isPending={updateMutation.isPending}
          >
            <div className="text-lg font-bold leading-relaxed">{brain.offeringSummary}</div>
          </EditableSection>

          {/* Core Capabilities */}
          <EditableSection
            title="CORE CAPABILITIES"
            field="coreCapabilities"
            value={brain.coreCapabilities || "[]"}
            editingField={editingField}
            editValue={editValue}
            onStartEdit={handleStartEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onEditValueChange={setEditValue}
            isPending={updateMutation.isPending}
          >
            <div className="grid md:grid-cols-2 gap-2">
              {capabilities.map((cap, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-gray-50">
                  <span className="text-xs font-black text-muted-foreground mt-0.5">[{String(i + 1).padStart(2, "0")}]</span>
                  <span className="text-sm font-bold">{cap}</span>
                </div>
              ))}
            </div>
          </EditableSection>

          {/* Value Propositions */}
          <EditableSection
            title="VALUE PROPOSITIONS"
            field="valuePropositions"
            value={brain.valuePropositions || "[]"}
            editingField={editingField}
            editValue={editValue}
            onStartEdit={handleStartEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onEditValueChange={setEditValue}
            isPending={updateMutation.isPending}
          >
            <div className="space-y-3">
              {valueProps.map((vp, i) => (
                <div key={i} className="border-l-4 border-black pl-4">
                  <div className="font-bold">{vp.proposition}</div>
                  <div className="text-xs font-bold text-muted-foreground mt-1">Target: {vp.targetAudience}</div>
                </div>
              ))}
            </div>
          </EditableSection>

          {/* Competitive Advantages */}
          <EditableSection
            title="COMPETITIVE ADVANTAGES"
            field="competitiveAdvantages"
            value={brain.competitiveAdvantages || ""}
            editingField={editingField}
            editValue={editValue}
            onStartEdit={handleStartEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onEditValueChange={setEditValue}
            isPending={updateMutation.isPending}
          >
            <div className="text-sm font-bold leading-relaxed">{brain.competitiveAdvantages}</div>
          </EditableSection>

          {/* ICP Section */}
          <div className="border-4 border-blue-600 p-6">
            <div className="text-xl font-black text-blue-600 mb-4">IDEAL CUSTOMER PROFILE (ICP)</div>

            <EditableSection
              title="TARGET INDUSTRIES"
              field="icpIndustries"
              value={brain.icpIndustries || "[]"}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={handleStartEdit}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <div className="flex flex-wrap gap-2">
                {industries.map((ind, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-900 text-xs font-black">
                    {ind}
                  </span>
                ))}
              </div>
            </EditableSection>

            <EditableSection
              title="COMPANY SIZE"
              field="icpCompanySize"
              value={brain.icpCompanySize || ""}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={handleStartEdit}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <div className="text-sm font-bold">{brain.icpCompanySize}</div>
            </EditableSection>

            <EditableSection
              title="GEOGRAPHY"
              field="icpGeography"
              value={brain.icpGeography || ""}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={handleStartEdit}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <div className="text-sm font-bold">{brain.icpGeography}</div>
            </EditableSection>

            <EditableSection
              title="PAIN POINTS WE SOLVE"
              field="icpPainPoints"
              value={brain.icpPainPoints || "[]"}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={handleStartEdit}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <ul className="space-y-1">
                {painPoints.map((pain, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-600 font-black">•</span>
                    <span className="text-sm font-bold">{pain}</span>
                  </li>
                ))}
              </ul>
            </EditableSection>

            <EditableSection
              title="BUYING SIGNALS"
              field="icpBuyingSignals"
              value={brain.icpBuyingSignals || "[]"}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={handleStartEdit}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <ul className="space-y-1">
                {buyingSignals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-600 font-black">✓</span>
                    <span className="text-sm font-bold">{signal}</span>
                  </li>
                ))}
              </ul>
            </EditableSection>
          </div>

          {/* Fit Criteria */}
          <div className="border-4 border-purple-600 p-6">
            <div className="text-xl font-black text-purple-600 mb-4">FIT SCORING CRITERIA</div>

            <EditableSection
              title="MUST-HAVE CRITERIA"
              field="fitCriteria.mustHave"
              value={JSON.stringify(fitCriteria.mustHave)}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, value) => {
                setEditingField(field);
                setEditValue(value);
              }}
              onSave={(field) => {
                if (!brain) return;
                try {
                  const updatedMustHave = JSON.parse(editValue);
                  const updatedFitCriteria = { ...fitCriteria, mustHave: updatedMustHave };
                  updateMutation.mutate({
                    brainId: brain.id,
                    updates: { fitCriteria: JSON.stringify(updatedFitCriteria) },
                  });
                } catch (e) {
                  toast.error("Invalid JSON format");
                }
              }}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <ul className="space-y-1">
                {fitCriteria.mustHave.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-600 font-black">★</span>
                    <span className="text-sm font-bold">{item}</span>
                  </li>
                ))}
              </ul>
            </EditableSection>

            <EditableSection
              title="NICE-TO-HAVE"
              field="fitCriteria.niceToHave"
              value={JSON.stringify(fitCriteria.niceToHave)}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, value) => {
                setEditingField(field);
                setEditValue(value);
              }}
              onSave={(field) => {
                if (!brain) return;
                try {
                  const updatedNiceToHave = JSON.parse(editValue);
                  const updatedFitCriteria = { ...fitCriteria, niceToHave: updatedNiceToHave };
                  updateMutation.mutate({
                    brainId: brain.id,
                    updates: { fitCriteria: JSON.stringify(updatedFitCriteria) },
                  });
                } catch (e) {
                  toast.error("Invalid JSON format");
                }
              }}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <ul className="space-y-1">
                {fitCriteria.niceToHave.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-purple-600 font-black">○</span>
                    <span className="text-sm font-bold">{item}</span>
                  </li>
                ))}
              </ul>
            </EditableSection>

            <EditableSection
              title="DISQUALIFIERS"
              field="fitCriteria.disqualifiers"
              value={JSON.stringify(fitCriteria.disqualifiers)}
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, value) => {
                setEditingField(field);
                setEditValue(value);
              }}
              onSave={(field) => {
                if (!brain) return;
                try {
                  const updatedDisqualifiers = JSON.parse(editValue);
                  const updatedFitCriteria = { ...fitCriteria, disqualifiers: updatedDisqualifiers };
                  updateMutation.mutate({
                    brainId: brain.id,
                    updates: { fitCriteria: JSON.stringify(updatedFitCriteria) },
                  });
                } catch (e) {
                  toast.error("Invalid JSON format");
                }
              }}
              onCancel={handleCancelEdit}
              onEditValueChange={setEditValue}
              isPending={updateMutation.isPending}
              compact
            >
              <ul className="space-y-1">
                {fitCriteria.disqualifiers.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-600 font-black">✗</span>
                    <span className="text-sm font-bold">{item}</span>
                  </li>
                ))}
              </ul>
            </EditableSection>
          </div>

          {/* Urgency Triggers */}
          <EditableSection
            title="URGENCY TRIGGERS"
            field="urgencyTriggers"
            value={brain.urgencyTriggers || "[]"}
            editingField={editingField}
            editValue={editValue}
            onStartEdit={handleStartEdit}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            onEditValueChange={setEditValue}
            isPending={updateMutation.isPending}
          >
            <ul className="space-y-2">
              {urgencyTriggers.map((trigger, i) => (
                <li key={i} className="flex items-start gap-2 p-2 bg-orange-50 border-l-4 border-orange-600">
                  <span className="text-orange-600 font-black">⚡</span>
                  <span className="text-sm font-bold">{trigger}</span>
                </li>
              ))}
            </ul>
          </EditableSection>
        </div>
      )}

      {/* Brain Failed State */}
      {brain && brain.status === "failed" && (
        <div className="border-4 border-red-600 p-12 text-center">
          <div className="text-3xl font-black text-red-600 mb-4">RESEARCH FAILED</div>
          <div className="text-lg font-bold text-muted-foreground">
            The brain research encountered an error. Please try again with a different website or check the URL.
          </div>
        </div>
      )}

      {/* Brain Researching State */}
      {brain && brain.status === "researching" && (
        <div className="border-4 border-yellow-600 p-12 text-center animate-pulse">
          <div className="text-3xl font-black text-yellow-600 mb-4">RESEARCH IN PROGRESS...</div>
          <div className="text-lg font-bold text-muted-foreground">
            Grok is analyzing the website. This typically takes 20-30 seconds.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Editable Section Component — HITL Editing
// ============================================================================
function EditableSection({
  title,
  field,
  value,
  editingField,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
  isPending,
  compact,
  children,
}: {
  title: string;
  field: string;
  value: string;
  editingField: string | null;
  editValue: string;
  onStartEdit: (field: string, value: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  isPending: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const isEditing = editingField === field;
  const [arrayItems, setArrayItems] = useState<string[]>([]);

  // Detect if this is an array field
  const isArrayField = value.trim().startsWith('[');

  // Initialize array items when entering edit mode
  useEffect(() => {
    if (isEditing && isArrayField) {
      try {
        const parsed = JSON.parse(editValue);
        if (Array.isArray(parsed)) {
          setArrayItems(parsed.map(item => typeof item === 'string' ? item : JSON.stringify(item)));
        }
      } catch {
        setArrayItems([]);
      }
    }
  }, [isEditing, isArrayField, editValue]);

  const handleArrayItemChange = (index: number, newValue: string) => {
    const updated = [...arrayItems];
    updated[index] = newValue;
    setArrayItems(updated);
    onEditValueChange(JSON.stringify(updated));
  };

  const handleAddArrayItem = () => {
    const updated = [...arrayItems, ''];
    setArrayItems(updated);
    onEditValueChange(JSON.stringify(updated));
  };

  const handleRemoveArrayItem = (index: number) => {
    const updated = arrayItems.filter((_, i) => i !== index);
    setArrayItems(updated);
    onEditValueChange(JSON.stringify(updated));
  };

  if (isEditing) {
    return (
      <div className={compact ? "mb-4" : "border-4 border-yellow-500 p-6"}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-black text-yellow-600">EDITING: {title}</div>
          <div className="flex gap-2">
            <Button onClick={() => onSave(field)} disabled={isPending} size="sm" className="text-xs font-black bg-black text-white h-7 px-3">
              {isPending ? "..." : "SAVE"}
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm" className="text-xs font-black border-2 border-black h-7 px-3">
              CANCEL
            </Button>
          </div>
        </div>
        
        {isArrayField ? (
          <div className="space-y-2">
            {arrayItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleArrayItemChange(index, e.target.value)}
                  className="flex-1 px-3 py-2 border-2 border-yellow-500 font-bold text-sm bg-yellow-50"
                  placeholder={`Item ${index + 1}`}
                />
                <Button
                  onClick={() => handleRemoveArrayItem(index)}
                  variant="outline"
                  size="sm"
                  className="text-xs font-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white h-auto px-3"
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              onClick={handleAddArrayItem}
              variant="outline"
              size="sm"
              className="text-xs font-black border-2 border-black w-full"
            >
              + ADD ITEM
            </Button>
          </div>
        ) : (
          <>
            <textarea
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="w-full px-3 py-2 border-2 border-yellow-500 font-bold text-sm min-h-[120px] bg-yellow-50"
              placeholder="Edit value"
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? "mb-4" : "border-4 border-black p-6"}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-black">{title}</div>
        <button
          onClick={() => onStartEdit(field, value)}
          className="text-[10px] font-black text-muted-foreground underline cursor-pointer hover:text-black"
        >
          EDIT
        </button>
      </div>
      {children}
    </div>
  );
}
