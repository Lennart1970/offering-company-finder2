import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Building2, Globe } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

function fitColor(score: number | null | undefined) {
  if (!score) return "text-gray-400";
  if (score >= 75) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

function fitBadge(score: number | null | undefined) {
  if (!score) return null;
  if (score >= 75) return <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">STRONG FIT</Badge>;
  if (score >= 60) return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">GOOD FIT</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">WEAK FIT</Badge>;
}

interface NicheCompanyListProps {
  nicheId: number;
}

export default function NicheCompanyList({ nicheId }: NicheCompanyListProps) {
  const [, navigate] = useLocation();

  // Load the niche info via getAllNiches and find this one
  const { data: allNiches } = trpc.niche.getAllNiches.useQuery();
  const niche = allNiches?.find((n: { id: number }) => n.id === nicheId);

  const { data, isLoading } = (trpc.niche as any).getCompaniesByNiche.useQuery(
    { nicheId, limit: 200, offset: 0 },
    { enabled: !!nicheId }
  );

  const companies = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/niche-review")}
            className="flex items-center gap-2 font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Market Segments
          </Button>
          <div className="h-5 w-px bg-gray-300" />
          <div>
            <h1 className="text-xl font-black text-gray-900">
              {niche?.name ?? "Segment Companies"}
            </h1>
            <p className="text-sm text-gray-500">
              {total.toLocaleString()} companies assigned to this segment
            </p>
          </div>
          {niche?.fitScore != null && (
            <div className="ml-auto flex items-center gap-2">
              <div
                className={`text-2xl font-black border-2 w-14 h-14 flex flex-col items-center justify-center ${
                  niche.fitScore >= 75
                    ? "border-green-500 text-green-600"
                    : niche.fitScore >= 60
                    ? "border-amber-500 text-amber-600"
                    : "border-red-400 text-red-500"
                }`}
              >
                <span className="text-xl leading-none">{niche.fitScore}</span>
                <span className="text-[9px] font-bold text-gray-500 leading-none">FIT</span>
              </div>
              {fitBadge(niche.fitScore)}
            </div>
          )}
        </div>

        {/* Keywords */}
        {niche?.topKeywords && niche.topKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {niche.topKeywords.map((kw: string) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-black text-white text-xs font-bold uppercase tracking-wide"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Company table */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading companies…</div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-semibold">No companies assigned yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Run Phase 2 "Assign Remaining" from Market Segments to populate this cluster.
            </p>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">
              Showing {companies.length} of {total.toLocaleString()} companies
              {total > 200 && " — scroll down for more"}
            </div>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Company</th>
                    <th className="text-left px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Domain</th>
                    <th className="text-left px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Location</th>
                    <th className="text-left px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Revenue</th>
                    <th className="text-center px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Fit</th>
                    <th className="text-center px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Urgency</th>
                    <th className="text-left px-4 py-3 font-black text-gray-700 text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company: any, idx: number) => (
                    <tr
                      key={company.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 truncate max-w-[200px]">
                          {company.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {company.primaryDomain ? (
                          <a
                            href={`https://${company.primaryDomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                          >
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{company.primaryDomain}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {[company.city, company.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {company.revenue ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {company.fitScore != null ? (
                          <span className={`font-black text-sm ${fitColor(company.fitScore)}`}>
                            {company.fitScore}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {company.urgencyScore != null ? (
                          <span
                            className={`font-black text-sm ${
                              company.urgencyScore >= 70
                                ? "text-green-600"
                                : company.urgencyScore >= 40
                                ? "text-amber-600"
                                : "text-gray-400"
                            }`}
                          >
                            {company.urgencyScore}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            company.enrichmentStatus === "enriched"
                              ? "bg-green-100 text-green-700"
                              : company.enrichmentStatus === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {company.enrichmentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > 200 && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Showing first 200 of {total.toLocaleString()} — use "Launch Campaign" to work the full list in Search Results.
              </p>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
