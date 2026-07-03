import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, Share2, Brain, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const BASE_URL = window.location.origin;

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Inline rename row — shown when editingId matches this list's id */
function RenameInput({
  listId,
  currentName,
  onDone,
}: {
  listId: number;
  currentName: string | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [value, setValue] = useState(currentName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const renameMutation = trpc.share.renameShareList.useMutation({
    onSuccess: () => {
      utils.share.getShareLists.invalidate();
      toast.success("List renamed");
      onDone();
    },
    onError: (e) => {
      toast.error(e.message ?? "Rename failed");
    },
  });

  function save() {
    if (value.trim() === (currentName ?? "")) { onDone(); return; }
    renameMutation.mutate({ listId, name: value.trim() });
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onDone();
        }}
        className="flex-1 min-w-0 text-sm border border-primary/40 rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        maxLength={200}
        disabled={renameMutation.isPending}
      />
      <button
        onClick={save}
        disabled={renameMutation.isPending}
        className="p-1 rounded hover:bg-green-50 text-green-600 disabled:opacity-40"
        title="Save"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onDone}
        disabled={renameMutation.isPending}
        className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-40"
        title="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ShareListsPage() {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const { data, isLoading } = trpc.share.getShareLists.useQuery();
  const [selectedBrainId, setSelectedBrainId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const lists = data?.lists ?? [];

  // Derive unique brains from the list data
  const brains = useMemo(() => {
    const seen = new Map<number, string>();
    for (const l of lists) {
      if (l.brainId && l.brainName && !seen.has(l.brainId)) {
        seen.set(l.brainId, l.brainName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [lists]);

  // Apply brain filter
  const filteredLists = useMemo(() => {
    if (selectedBrainId === null) return lists;
    return lists.filter((l) => l.brainId === selectedBrainId);
  }, [lists, selectedBrainId]);

  function copyLink(token: string, publicDomain?: string | null) {
    const domain = publicDomain || BASE_URL;
    const url = `https://${domain}/share/list/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    });
  }

  function openLink(token: string, publicDomain?: string | null) {
    const domain = publicDomain || BASE_URL;
    const url = `https://${domain}/share/list/${token}`;
    window.open(url, "_blank");
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Share2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Shared Intelligence Lists</h1>
          <p className="text-sm text-muted-foreground">
            Public overview — click any list to open it
            {isLoggedIn && (
              <span className="ml-2 text-primary/70">· click a name to rename</span>
            )}
          </p>
        </div>
      </div>

      {/* Brain filter pills — only shown when there are multiple brains */}
      {!isLoading && brains.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">
              <Brain className="w-3.5 h-3.5" />
              Brain
            </div>
            {/* "All" pill */}
            <button
              onClick={() => setSelectedBrainId(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedBrainId === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              All Business Units
            </button>
            {brains.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBrainId(selectedBrainId === b.id ? null : b.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors max-w-[240px] truncate ${
                  selectedBrainId === b.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
                title={b.name}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-muted-foreground text-sm py-12 text-center">Loading…</div>
      )}

      {!isLoading && filteredLists.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {selectedBrainId !== null ? "No lists for this business unit" : "No share lists yet"}
          </p>
        </div>
      )}

      {!isLoading && filteredLists.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_120px_96px] gap-4 px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
            <span>List name</span>
            <span className="text-center">Companies</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredLists.map((list, idx: number) => (
            <div
              key={list.id}
              className={`grid grid-cols-[1fr_80px_120px_96px] gap-4 px-4 py-3 items-center text-sm ${
                idx < filteredLists.length - 1 ? "border-b" : ""
              } hover:bg-muted/20 transition-colors group`}
            >
              {/* Name + brain tag */}
              <div className="min-w-0">
                {isLoggedIn && editingId === list.id ? (
                  <RenameInput
                    listId={list.id}
                    currentName={list.shareListName}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    className={`flex items-center gap-1.5 min-w-0 ${isLoggedIn ? "cursor-pointer" : ""}`}
                    onClick={() => isLoggedIn && setEditingId(list.id)}
                    title={isLoggedIn ? "Click to rename" : undefined}
                  >
                    <p className="font-medium truncate">
                      {list.shareListName ?? (
                        <span className="text-muted-foreground italic">Unnamed list</span>
                      )}
                    </p>
                    {isLoggedIn && (
                      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {list.listToken}
                  </p>
                  {list.brainName && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/8 text-primary border border-primary/20 shrink-0">
                      <Brain className="w-2.5 h-2.5" />
                      {list.brainName}
                    </span>
                  )}
                </div>
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
                  onClick={() => copyLink(list.listToken, list.publicDomain)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Open list"
                  onClick={() => openLink(list.listToken, list.publicDomain)}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && lists.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-right">
          {filteredLists.length === lists.length
            ? `${lists.length} list${lists.length !== 1 ? "s" : ""} total`
            : `${filteredLists.length} of ${lists.length} lists`}
        </p>
      )}
    </div>
  );
}
