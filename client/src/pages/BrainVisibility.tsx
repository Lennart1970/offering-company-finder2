import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      toast.success(variables.visible ? "Brain visible" : "Brain hidden", {
        description: variables.visible
          ? "Brain is now visible in LeadTrigger."
          : "Brain is now hidden in LeadTrigger.",
      });
    },
    onError: () => {
      toast.error("Error", { description: "Could not update visibility." });
    },
  });

  const pushToSupabaseMutation = trpc.companyFinder.pushBrainToSupabase.useMutation({
    onSuccess: (data) => {
      if (data.success) toast.success(data.message);
      else toast.error(`Push failed: ${data.message}`);
    },
    onError: (error) => toast.error(`Push failed: ${error.message}`),
  });

  const pullFromSupabaseMutation = trpc.companyFinder.pullBrainFromSupabase.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        utils.companyFinder.listAllBrainsAdmin.invalidate();
      } else {
        toast.error(`Pull failed: ${data.message}`);
      }
    },
    onError: (error) => toast.error(`Pull failed: ${error.message}`),
  });

  const toggleSharedMutation = trpc.companyFinder.toggleBrainShared.useMutation({
    onSuccess: (data) => {
      toast.success(data.isShared ? "Brain is now shared" : "Brain is now private");
      utils.companyFinder.listAllBrainsAdmin.invalidate();
    },
    onError: (error) => toast.error(`Share toggle failed: ${error.message}`),
  });

  const setActiveMutation = trpc.companyFinder.setActiveBrain.useMutation({
    onSuccess: () => {
      toast.success("Brain activated");
      utils.companyFinder.listAllBrainsAdmin.invalidate();
    },
    onError: (error) => toast.error(`Activation failed: ${error.message}`),
  });

  const deleteMutation = trpc.companyFinder.deleteBrain.useMutation({
    onSuccess: () => {
      toast.success("Brain deleted");
      utils.companyFinder.listAllBrainsAdmin.invalidate();
    },
    onError: (error) => toast.error(`Deletion failed: ${error.message}`),
  });

  const brainList = (brains?.brains ?? []) as Array<{
    id: string;
    localId: number | null;
    brainName: string;
    companyName: string;
    status: string;
    isActive: number;
    isShared: number;
    showOnLeadtrigger: number;
    isSupabaseOnly: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  }>;

  const visibleCount = brainList.filter((b) => b.showOnLeadtrigger).length;
  const hiddenCount = brainList.filter((b) => !b.showOnLeadtrigger).length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight mb-1">Brain Visibility</h1>
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
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-2 bg-muted/50 gap-3">
            <span className="w-4" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Brain name</span>
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Actions</span>
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground w-16 text-center">Visible</span>
          </div>

          {brainList.map((brain) => {
            // localId is the MySQL int ID — required for set-active, delete, push, pull, toggleShared
            const localId = brain.localId;
            const hasLocal = !!localId;

            return (
              <div
                key={brain.id}
                className={`grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-3 gap-3 transition-colors ${
                  brain.isActive === 1 ? "bg-green-50" : brain.showOnLeadtrigger ? "bg-white hover:bg-muted/20" : "bg-muted/30"
                }`}
              >
                {/* Active dot — only works if brain has a local MySQL record */}
                <button
                  onClick={() => {
                    if (brain.isActive === 1) return;
                    if (!hasLocal) {
                      toast.error("Pull this brain locally first to set it as active");
                      return;
                    }
                    setActiveMutation.mutate({ brainId: localId! });
                  }}
                  title={brain.isActive === 1 ? "Active brain" : hasLocal ? "Set as active" : "Pull locally first to activate"}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    brain.isActive === 1
                      ? "border-green-600 bg-green-600 cursor-default"
                      : hasLocal
                      ? "border-gray-300 hover:border-black cursor-pointer"
                      : "border-gray-200 cursor-not-allowed opacity-40"
                  }`}
                  disabled={brain.isActive === 1}
                >
                  {brain.isActive === 1 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>

                {/* Brain name + badges */}
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
                  {brain.isShared === 1 && (
                    <span className="text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded shrink-0">SHARED</span>
                  )}
                  {brain.isSupabaseOnly && (
                    <span className="text-[10px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded shrink-0">SUPABASE ONLY</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {/* Push — only if has local record */}
                  {hasLocal && (
                    <Button
                      onClick={() => pushToSupabaseMutation.mutate({ brainId: localId! })}
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-black border border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white h-7 px-2"
                      disabled={pushToSupabaseMutation.isPending}
                    >
                      ⬆ PUSH TO SUPABASE
                    </Button>
                  )}
                  {/* Pull — if has local record, pull updates it; if Supabase-only, pull creates local */}
                  {hasLocal && (
                    <Button
                      onClick={() => pullFromSupabaseMutation.mutate({ brainId: localId! })}
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-black border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white h-7 px-2"
                      disabled={pullFromSupabaseMutation.isPending}
                    >
                      ⬇ PULL FROM SUPABASE
                    </Button>
                  )}
                  {/* Toggle shared — only if has local record */}
                  {hasLocal && (
                    <Button
                      onClick={() => toggleSharedMutation.mutate({ brainId: localId!, isShared: brain.isShared !== 1 })}
                      variant="outline"
                      size="sm"
                      className={`text-[11px] font-black border h-7 px-2 ${
                        brain.isShared === 1
                          ? "border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                          : "border-gray-400 text-gray-500 hover:bg-gray-100"
                      }`}
                      disabled={toggleSharedMutation.isPending}
                    >
                      {brain.isShared === 1 ? "🔓 SHARED" : "🔒 PRIVATE"}
                    </Button>
                  )}
                  {/* Set active — only if has local record and not already active */}
                  {brain.isActive !== 1 && hasLocal && (
                    <Button
                      onClick={() => setActiveMutation.mutate({ brainId: localId! })}
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-black border border-black h-7 px-2"
                      disabled={setActiveMutation.isPending}
                    >
                      SET ACTIVE
                    </Button>
                  )}
                  {/* Delete — only if has local record and not active */}
                  {brain.isActive !== 1 && hasLocal && (
                    <Button
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this brain?")) {
                          deleteMutation.mutate({ brainId: localId! });
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-black border border-red-600 text-red-600 hover:bg-red-600 hover:text-white h-7 px-2"
                      disabled={deleteMutation.isPending}
                    >
                      DELETE
                    </Button>
                  )}
                </div>

                {/* Visibility toggle — works for all brains via Supabase */}
                <div className="w-16 flex justify-center">
                  <Switch
                    checked={!!brain.showOnLeadtrigger}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ brainId: brain.id, localId: localId ?? undefined, visible: checked })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
