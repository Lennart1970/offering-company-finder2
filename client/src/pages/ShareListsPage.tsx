import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Trash2, ExternalLink, Share2 } from "lucide-react";

const BASE_URL = window.location.origin;

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ShareListsPage() {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.share.getShareLists.useQuery();
  const deleteMutation = trpc.share.deleteShareList.useMutation({
    onSuccess: () => {
      utils.share.getShareLists.invalidate();
      toast.success("Share list deleted");
    },
    onError: (err) => {
      toast.error("Delete failed", { description: err.message });
    },
  });

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function copyLink(token: string) {
    const url = `${BASE_URL}/share/list/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    });
  }

  function openLink(token: string) {
    window.open(`${BASE_URL}/share/list/${token}`, "_blank");
  }

  const lists = data?.lists ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Share2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Shared Intelligence Lists</h1>
          <p className="text-sm text-muted-foreground">
            All share lists you have created — anyone with the link can view
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-muted-foreground text-sm py-12 text-center">Loading…</div>
      )}

      {!isLoading && lists.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No share lists yet</p>
          <p className="text-sm mt-1">
            Create one from the Intelligence page using the "Share Intelligence" button.
          </p>
        </div>
      )}

      {!isLoading && lists.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_160px_120px] gap-4 px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
            <span>List name</span>
            <span className="text-center">Companies</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {lists.map((list, idx: number) => {
            const isConfirming = confirmDelete === list.id;
            return (
              <div
                key={list.id}
                className={`grid grid-cols-[1fr_80px_160px_120px] gap-4 px-4 py-3 items-center text-sm ${
                  idx < lists.length - 1 ? "border-b" : ""
                } hover:bg-muted/20 transition-colors`}
              >
                {/* Name */}
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {list.shareListName ?? (
                      <span className="text-muted-foreground italic">Unnamed list</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {list.listToken}
                  </p>
                </div>

                {/* Company count */}
                <div className="text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {list.companyCount}
                  </span>
                </div>

                {/* Created at */}
                <div className="text-muted-foreground text-xs">{formatDate(list.createdAt)}</div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Copy link"
                    onClick={() => copyLink(list.listToken)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Open in new tab"
                    onClick={() => openLink(list.listToken)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs px-2"
                        onClick={() => {
                          deleteMutation.mutate({ listId: list.id });
                          setConfirmDelete(null);
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete list"
                      onClick={() => setConfirmDelete(list.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && lists.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-right">
          {lists.length} list{lists.length !== 1 ? "s" : ""} total
        </p>
      )}
    </div>
  );
}
