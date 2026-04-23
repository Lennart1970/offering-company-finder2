import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Download, Trash2, Upload, Loader2, Presentation, File } from "lucide-react";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string | null | undefined) {
  if (!mimeType) return <File className="h-8 w-8 text-gray-400" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <Presentation className="h-8 w-8 text-orange-500" />;
  if (mimeType.includes("pdf"))
    return <FileText className="h-8 w-8 text-red-500" />;
  return <File className="h-8 w-8 text-blue-500" />;
}

export default function SalesMaterials() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "",
  });

  const { data, isLoading } = trpc.salesMaterials.list.useQuery();

  const uploadMutation = trpc.salesMaterials.upload.useMutation({
    onSuccess: () => {
      toast.success("File uploaded successfully");
      utils.salesMaterials.list.invalidate();
      setUploadForm({ title: "", description: "", category: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploading(false);
    },
    onError: (e) => {
      toast.error(`Upload failed: ${e.message}`);
      setUploading(false);
    },
  });

  const deleteMutation = trpc.salesMaterials.delete.useMutation({
    onSuccess: () => {
      toast.success("File deleted");
      utils.salesMaterials.list.invalidate();
    },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  const handleFileUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { toast.error("Please select a file"); return; }
    if (!uploadForm.title.trim()) { toast.error("Please enter a title"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50 MB)"); return; }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        title: uploadForm.title.trim(),
        description: uploadForm.description.trim() || undefined,
        category: uploadForm.category.trim() || undefined,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const materials = data?.materials ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight mb-1">Sales Materials</h1>
        <p className="text-sm text-muted-foreground">
          Presentations, pitch decks and product sheets for the sales team. Click any file to download.
        </p>
        <div className="flex gap-3 mt-3">
          <Badge variant="outline" className="text-xs font-semibold">
            {materials.length} {materials.length === 1 ? "file" : "files"}
          </Badge>
        </div>
      </div>

      {/* Upload panel — admin only */}
      {isAdmin && (
        <div className="border rounded-lg p-5 mb-8 bg-muted/30">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload New File
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Title *
              </label>
              <input
                type="text"
                value={uploadForm.title}
                onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Connect Group Railway Solutions Pitch Deck 2026"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Category
              </label>
              <input
                type="text"
                value={uploadForm.category}
                onChange={(e) => setUploadForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Railway, Automotive, General"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Description
              </label>
              <input
                type="text"
                value={uploadForm.description}
                onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description (optional)"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                File * (max 50 MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx,.ppt,.pdf,.docx,.doc,.xlsx,.xls,.key,.odp"
                className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-black file:text-white file:text-xs file:font-black file:px-3 file:py-1 file:rounded cursor-pointer"
              />
            </div>
          </div>
          <Button
            onClick={handleFileUpload}
            disabled={uploading || uploadMutation.isPending}
            className="mt-4 bg-black text-white font-black text-xs px-5 h-9 hover:bg-gray-800"
          >
            {uploading || uploadMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-2" /> UPLOAD FILE</>
            )}
          </Button>
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">No files uploaded yet.</p>
          {isAdmin && <p className="text-xs mt-1">Use the upload panel above to add your first file.</p>}
        </div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2 bg-muted/50 gap-4">
            <span className="w-8" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">File</span>
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Actions</span>
          </div>

          {materials.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-4 gap-4 bg-white hover:bg-muted/20 transition-colors"
            >
              {/* Icon */}
              <div className="shrink-0">
                {fileIcon(m.mimeType)}
              </div>

              {/* Info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold truncate">{m.title}</span>
                  {m.category && (
                    <Badge variant="outline" className="text-[10px] font-black shrink-0">
                      {m.category}
                    </Badge>
                  )}
                </div>
                {m.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {m.fileName}
                  {m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ""}
                  {m.uploaderName ? ` · Uploaded by ${m.uploaderName}` : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <a
                  href={m.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={m.fileName}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[11px] font-black border border-black h-8 px-3 hover:bg-black hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" /> DOWNLOAD
                  </Button>
                </a>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[11px] font-black border border-red-600 text-red-600 hover:bg-red-600 hover:text-white h-8 px-3"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (confirm(`Delete "${m.title}"?`)) {
                        deleteMutation.mutate({ id: m.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
