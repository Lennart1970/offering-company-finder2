import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function BrainVisibility() {
  const utils = trpc.useUtils();

  const { data: brains, isLoading } = trpc.companyFinder.listAllBrainsAdmin.useQuery();

  const toggleMutation = trpc.companyFinder.toggleBrainVisibility.useMutation({
    onSuccess: (_, variables) => {
      utils.companyFinder.listAllBrainsAdmin.invalidate();
      toast.success(variables.visible ? "Brain zichtbaar" : "Brain verborgen", {
        description: variables.visible
          ? "Brain verschijnt nu in LeadTrigger."
          : "Brain is verborgen in LeadTrigger.",
      });
    },
    onError: () => {
      toast.error("Fout", { description: "Kon zichtbaarheid niet wijzigen." });
    },
  });

  const brainList = brains?.brains ?? [];
  const visibleCount = brainList.filter((b) => b.showOnLeadtrigger).length;
  const hiddenCount = brainList.filter((b) => !b.showOnLeadtrigger).length;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight mb-1">Brain Visibility</h1>
        <p className="text-sm text-muted-foreground">
          Bepaal welke brains zichtbaar zijn in LeadTrigger. Verborgen brains worden niet meegenomen in searches, fit scores of company tabs.
        </p>
        <div className="flex gap-3 mt-4">
          <Badge variant="outline" className="gap-1.5 text-xs font-semibold">
            <Eye className="h-3 w-3 text-green-600" />
            {visibleCount} zichtbaar
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs font-semibold">
            <EyeOff className="h-3 w-3 text-muted-foreground" />
            {hiddenCount} verborgen
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
          <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2 bg-muted/50">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Brain naam</span>
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground w-20 text-center">Zichtbaar</span>
          </div>

          {brainList.map((brain) => (
            <div
              key={brain.id}
              className={`grid grid-cols-[1fr_auto] items-center px-4 py-3 transition-colors ${
                brain.showOnLeadtrigger ? "bg-white" : "bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {brain.showOnLeadtrigger ? (
                  <Eye className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span
                  className={`text-sm font-semibold truncate ${
                    brain.showOnLeadtrigger ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {brain.brainName || <span className="italic text-muted-foreground">(geen naam)</span>}
                </span>
              </div>
              <div className="w-20 flex justify-center">
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
