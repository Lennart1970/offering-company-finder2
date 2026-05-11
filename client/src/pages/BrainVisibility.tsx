import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function BrainVisibility() {
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const { data: brains, isLoading } = trpc.companyFinder.listAllBrainsAdmin.useQuery();

  const toggleMutation = trpc.companyFinder.toggleBrainVisibility.useMutation({
    onSuccess: (_, variables) => {
      utils.companyFinder.listAllBrainsAdmin.invalidate();
      toast.success(variables.visible ? "Brain visible" : "Brain hidden");
    },
    onError: () => {
      toast.error("Error", { description: "Could not update visibility." });
    },
  });

  const setActiveMutation = trpc.companyFinder.setActiveBrain.useMutation({
    onSuccess: () => {
      toast.success("Business Unit activated");
      utils.companyFinder.listAllBrainsAdmin.invalidate();
    },
    onError: (error) => toast.error(`Activation failed: ${error.message}`),
  });

  const brainList = (brains?.brains ?? []) as Array<{
    id: string;
    brainName: string;
    companyName: string;
    status: string;
    isActive: number;
    showOnLeadtrigger: number;
    createdAt: string | null;
    updatedAt: string | null;
  }>;

  const visibleCount = brainList.filter((b) => b.showOnLeadtrigger).length;
  const hiddenCount = brainList.filter((b) => !b.showOnLeadtrigger).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight mb-1">Business Unit Visibility</h1>
        <p className="text-sm text-muted-foreground">
          Control which brains are visible in LeadTrigger. Hidden brains are excluded from searches, fit scores and company tabs.
        </p>
        <div className="flex gap-3 mt-4">
          <Badge variant="outline" className="gap-1.5 text-xs font-semibold">
            <Eye className="h-3 w-3 text-green-600" />
            {visibleCount} visible
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs font-semibold">
            <EyeOff className="h-3 w-3 text-muted-foreground" />
            {hiddenCount} hidden
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2 bg-muted/50 gap-3">
            <span className="w-4" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Business Unit name</span>
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground w-16 text-center">Visible</span>
          </div>

          {brainList.map((brain) => (
            <div
              key={brain.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center px-4 py-3 gap-3 transition-colors ${
                brain.isActive === 1 ? "bg-green-50" : brain.showOnLeadtrigger ? "bg-white hover:bg-muted/20" : "bg-muted/30"
              }`}
            >
              {/* Active radio — click to set as active */}
              <button
                onClick={() => {
                  if (brain.isActive === 1) return;
                  setActiveMutation.mutate({ brainId: brain.id });
                }}
                title={brain.isActive === 1 ? "Active Business Unit" : "Set as active"}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  brain.isActive === 1
                    ? "border-green-600 bg-green-600 cursor-default"
                    : "border-gray-300 hover:border-black cursor-pointer"
                }`}
                disabled={brain.isActive === 1 || setActiveMutation.isPending}
              >
                {brain.isActive === 1 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>

              {/* Business Unit name + active badge */}
              <div className="flex items-center gap-2 min-w-0">
                {brain.showOnLeadtrigger ? (
                  <Eye className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={`text-sm font-semibold truncate ${
                    brain.showOnLeadtrigger ? "text-foreground" : "text-muted-foreground line-through"
                  }`}
                >
                  {brain.brainName || <span className="italic">(no name)</span>}
                </span>
                {brain.isActive === 1 && (
                  <span className="text-[10px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded shrink-0">ACTIVE</span>
                )}
              </div>

              {/* Visibility toggle */}
              <div className="w-16 flex justify-center">
                <Switch
                  checked={!!brain.showOnLeadtrigger}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ brainId: brain.id, visible: checked })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
