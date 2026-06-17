/**
 * CgLeadBadge — shows a "View in CRM" button or "Not in CRM database" badge.
 */
import { trpc } from "@/lib/trpc";
import { ExternalLink, Database } from "lucide-react";

interface CgLeadBadgeProps {
  domain?: string | null;
  websiteUrl?: string | null;
  companyName?: string | null;
  compact?: boolean;
}

export function CgLeadBadge({
  domain, websiteUrl, companyName, compact = false,
}: CgLeadBadgeProps) {
  const { data, isLoading } = trpc.cgLead.lookup.useQuery(
    {
      domain: domain ?? undefined,
      websiteUrl: websiteUrl ?? undefined,
      companyName: companyName ?? undefined,
    },
    {
      enabled: !!(domain || websiteUrl || companyName),
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  );

  if (isLoading) return null;

  if (data?.lead) {
    if (compact) {
      return (
        <a
          href={data.lead.sharepointUrl}
          target="_blank"
          rel="noreferrer"
          title="View in CRM"
          className="inline-flex items-center justify-center w-7 h-7 rounded border border-green-600 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      );
    }
    return (
      <a
        href={data.lead.sharepointUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-green-600 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink className="w-3 h-3" />
        View in CRM
      </a>
    );
  }

  if (compact) {
    return (
      <span
        title="Not in CRM database"
        className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-300 bg-gray-50 text-gray-400"
      >
        <Database className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-300 bg-gray-50 text-gray-400 text-xs font-medium">
      <Database className="w-3 h-3" />
      Not in CRM database
    </span>
  );
}
