import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Eye } from "lucide-react";

const PAGE_SIZE = 50;

export default function WebhookLogPage() {
  const [offset, setOffset] = useState(0);
  const [selectedPayload, setSelectedPayload] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.webhookLog.list.useQuery(
    { limit: PAGE_SIZE, offset },
    { refetchInterval: 15_000 } // auto-refresh every 15s
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatDate(d: Date | string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString();
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Apollo Webhook Log</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Every Apollo phone-enrichment callback received — auto-refreshes every 15 s.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>

        {/* Summary bar */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total callbacks: <strong>{total}</strong></span>
          <span>
            Updated:{" "}
            <strong className="text-green-600">
              {rows.filter((r) => r.updated).length} / {rows.length}
            </strong>{" "}
            (this page)
          </span>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Apollo Person ID</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone Delivered</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-8">Raw</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No webhook callbacks received yet. Trigger a GET PHONE on a contact to see entries here.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, i) => (
                <TableRow key={row.id} className={row.updated ? "" : "opacity-70"}>
                  <TableCell className="text-muted-foreground text-xs">{offset + i + 1}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(row.receivedAt)}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[140px] truncate" title={row.apolloPersonId ?? ""}>
                    {row.apolloPersonId ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate" title={row.contactName ?? ""}>
                    {row.contactName ?? (row.contactId ? `#${row.contactId}` : "—")}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.phoneDelivered ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {row.creditsConsumed ?? 0}
                  </TableCell>
                  <TableCell>
                    {row.updated ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Updated
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" /> Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.failReason ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.rawPayload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedPayload(row.rawPayload)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} — {total} total entries
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Raw payload dialog */}
      <Dialog open={!!selectedPayload} onOpenChange={() => setSelectedPayload(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raw Apollo Webhook Payload</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
            {selectedPayload
              ? (() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedPayload), null, 2);
                  } catch {
                    return selectedPayload;
                  }
                })()
              : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
