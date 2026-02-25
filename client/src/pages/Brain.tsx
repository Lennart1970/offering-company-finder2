import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Helper to safely parse JSON fields
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function Brain() {
  const [website, setWebsite] = useState("https://www.connectgroup.com");
  const [companyName, setCompanyName] = useState("ConnectGroup");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: brainData, isLoading } = trpc.companyFinder.getActiveBrain.useQuery();
  const utils = trpc.useUtils();

  const researchMutation = trpc.companyFinder.researchBrain.useMutation({
    onSuccess: (data) => {
      toast.success(`Brain research completed for ${data.brain?.companyName}`);
      utils.companyFinder.getActiveBrain.invalidate();
    },
    onError: (error) => {
      toast.error(`Research failed: ${error.message}`);
    },
  });

  const updateMutation = trpc.companyFinder.updateBrain.useMutation({
    onSuccess: () => {
      toast.success("Brain updated");
      utils.companyFinder.getActiveBrain.invalidate();
      setEditingField(null);
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const brain = brainData?.brain;

  // Parse structured fields
  const capabilities = useMemo(() => parseJson<string[]>(brain?.coreCapabilities, []), [brain?.coreCapabilities]);
  const valueProps = useMemo(() => parseJson<Array<{ proposition: string; targetAudience: string }>>(brain?.valuePropositions, []), [brain?.valuePropositions]);
  const industries = useMemo(() => parseJson<string[]>(brain?.icpIndustries, []), [brain?.icpIndustries]);
  const painPoints = useMemo(() => parseJson<string[]>(brain?.icpPainPoints, []), [brain?.icpPainPoints]);
  const buyingSignals = useMemo(() => parseJson<string[]>(brain?.icpBuyingSignals, []), [brain?.icpBuyingSignals]);
  const fitCriteria = useMemo(() => parseJson<{ mustHave: string[]; niceToHave: string[]; disqualifiers: string[] }>(brain?.fitCriteria, { mustHave: [], niceToHave: [], disqualifiers: [] }), [brain?.fitCriteria]);
  const urgencyTriggers = useMemo(() => parseJson<string[]>(brain?.urgencyTriggers, []), [brain?.urgencyTriggers]);

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
    researchMutation.mutate({
      companyWebsite: website.trim(),
      companyName: companyName.trim() || undefined,
    });
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-black text-muted-foreground mb-2">[00] COCKPIT</div>
        <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
          OFFERING<br />BRAIN
        </h1>
        <p className="text-lg font-bold text-muted-foreground max-w-2xl">
          Deep intelligence about your company's offering. This context informs all prospect evaluation — fit scoring, urgency detection, and sales approach generation.
        </p>
      </div>

      {/* Research Trigger */}
      <div className="border-4 border-black p-6 mb-8">
        <div className="text-lg font-black mb-4">RESEARCH YOUR OFFERING</div>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-black block mb-1">COMPANY NAME</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ConnectGroup"
              className="w-full px-4 py-3 border-4 border-black font-bold text-lg"
            />
          </div>
          <div>
            <label className="text-xs font-black block mb-1">WEBSITE URL</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.connectgroup.com"
              className="w-full px-4 py-3 border-4 border-black font-bold text-lg"
            />
          </div>
        </div>
        <Button
          onClick={handleStartResearch}
          disabled={researchMutation.isPending}
          className="text-lg px-8 py-6 font-black border-4 border-black bg-black text-white w-full"
        >
          {researchMutation.isPending ? "[RESEARCHING... THIS TAKES ~30 SECONDS]" : "[RESEARCH OFFERING →]"}
        </Button>
        {researchMutation.isPending && (
          <div className="mt-4 text-sm font-bold text-muted-foreground animate-pulse">
            Grok is analyzing the website, searching for capabilities, ICP, competitive positioning...
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="border-4 border-black p-12 animate-pulse text-center">
          <div className="text-2xl font-black">LOADING BRAIN...</div>
        </div>
      )}

      {/* No Brain Yet */}
      {!isLoading && !brain && (
        <div className="border-4 border-black p-12 text-center">
          <div className="text-3xl font-black mb-4">NO BRAIN CONFIGURED</div>
          <div className="text-lg font-bold text-muted-foreground">
            Enter your company details above and click "Research Offering" to build your intelligence layer.
          </div>
        </div>
      )}

      {/* Brain Display */}
      {brain && brain.status === "completed" && (
        <div className="space-y-6">
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-black text-white px-6 py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-black">BRAIN ACTIVE</span>
              <span className="text-sm font-bold opacity-70">{brain.companyName}</span>
            </div>
            <div className="text-xs font-bold opacity-50">
              Updated: {new Date(brain.updatedAt).toLocaleDateString()}
            </div>
          </div>

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

            <div className="grid md:grid-cols-2 gap-6">
              {/* Industries */}
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
                    <span key={i} className="text-xs font-black border-2 border-blue-600 text-blue-600 px-2 py-1">{ind}</span>
                  ))}
                </div>
              </EditableSection>

              {/* Company Size */}
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

              {/* Geography */}
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

              {/* Pain Points */}
              <EditableSection
                title="PAIN POINTS SOLVED"
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
                  {painPoints.map((pp, i) => (
                    <li key={i} className="text-sm font-bold flex items-start gap-2">
                      <span className="text-blue-600 shrink-0">→</span>
                      <span>{pp}</span>
                    </li>
                  ))}
                </ul>
              </EditableSection>
            </div>
          </div>

          {/* Buying Signals */}
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
          >
            <div className="grid md:grid-cols-2 gap-2">
              {buyingSignals.map((signal, i) => (
                <div key={i} className="p-3 bg-green-50 border border-green-300 text-sm font-bold">
                  <span className="text-green-600 mr-2">⚡</span>{signal}
                </div>
              ))}
            </div>
          </EditableSection>

          {/* Fit Criteria */}
          <div className="border-4 border-black p-6">
            <div className="text-xl font-black mb-4">FIT CRITERIA</div>
            <div className="grid md:grid-cols-3 gap-6">
              <EditableSection
                title="MUST HAVE"
                field="fitCriteria"
                value={brain.fitCriteria || "{}"}
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
                  {fitCriteria.mustHave.map((item, i) => (
                    <li key={i} className="text-sm font-bold flex items-start gap-2">
                      <span className="text-green-600 shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </EditableSection>

              <div>
                <div className="text-xs font-black mb-2">NICE TO HAVE</div>
                <ul className="space-y-1">
                  {fitCriteria.niceToHave.map((item, i) => (
                    <li key={i} className="text-sm font-bold flex items-start gap-2">
                      <span className="text-yellow-600 shrink-0">○</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-black mb-2">DISQUALIFIERS</div>
                <ul className="space-y-1">
                  {fitCriteria.disqualifiers.map((item, i) => (
                    <li key={i} className="text-sm font-bold flex items-start gap-2">
                      <span className="text-red-600 shrink-0">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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
            <div className="space-y-2">
              {urgencyTriggers.map((trigger, i) => (
                <div key={i} className="p-3 bg-yellow-50 border border-yellow-300 text-sm font-bold">
                  <span className="text-yellow-700 mr-2">⏰</span>{trigger}
                </div>
              ))}
            </div>
          </EditableSection>
        </div>
      )}

      {/* Brain Researching */}
      {brain && brain.status === "researching" && (
        <div className="border-4 border-blue-600 p-12 text-center animate-pulse">
          <div className="text-3xl font-black text-blue-600 mb-4">RESEARCHING...</div>
          <div className="text-lg font-bold text-muted-foreground">
            Grok is analyzing {brain.companyName}'s website and building intelligence...
          </div>
        </div>
      )}

      {/* Brain Failed */}
      {brain && brain.status === "failed" && (
        <div className="border-4 border-red-600 p-8">
          <div className="text-xl font-black text-red-600 mb-2">RESEARCH FAILED</div>
          <div className="text-sm font-bold text-muted-foreground">
            The research for {brain.companyName} failed. Try again with a different URL or check the website is accessible.
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
        <textarea
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          className="w-full px-3 py-2 border-2 border-yellow-500 font-mono text-sm min-h-[120px] bg-yellow-50"
          placeholder="Edit value (JSON for arrays/objects, plain text for strings)"
        />
        <div className="text-[10px] font-bold text-muted-foreground mt-1">
          For arrays: use JSON format like ["item1", "item2"]. For text: just type normally.
        </div>
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
