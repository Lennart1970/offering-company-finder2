import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ============================================================================
// Get All Personnel Button for Deep Research
// ============================================================================
// Seniority options matching Apollo API values and SENIORITY_TIERS
const SENIORITY_OPTIONS = [
  { label: "C-Suite / Owner", values: ["owner", "founder", "c_suite", "partner"], defaultOn: true },
  { label: "VP / Head",       values: ["vp", "head"],                             defaultOn: true },
  { label: "Director",        values: ["director"],                               defaultOn: false },
  { label: "Manager",         values: ["manager"],                                defaultOn: false },
  { label: "Senior / Entry",  values: ["senior", "entry"],                        defaultOn: false },
] as const;

const DEPARTMENT_OPTIONS = [
  { label: "Any department",        value: "any" },
  { label: "Engineering",           value: "engineering" },
  { label: "Operations",            value: "operations" },
  { label: "Finance",               value: "finance" },
  { label: "Sales",                 value: "sales" },
  { label: "Marketing",             value: "marketing" },
  { label: "Human Resources",       value: "human_resources" },
  { label: "Information Technology",value: "information_technology" },
  { label: "Product Management",    value: "product_management" },
] as const;

function GetAllPersonnelButtonDeep({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fetchLimit, setFetchLimit] = useState(25);
  const [checkedSeniorities, setCheckedSeniorities] = useState<boolean[]>(
    SENIORITY_OPTIONS.map((o) => o.defaultOn)
  );
  const [department, setDepartment] = useState("any");

  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => {
      setResults({ contacts: data.contacts, totalFound: data.totalFound });
      setShowSelectionModal(false);
      setShowResultsModal(true);
      toast.success(`Found ${data.contacts.length} personnel at ${companyName}`);
    },
    onError: (error) => {
      toast.error(`Personnel search failed: ${error.message}`);
      setShowSelectionModal(false);
    },
  });

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSelectionModal(true);
  };

  const handleFetch = () => {
    // Flatten checked seniority values into a single array
    const selectedSeniorities = SENIORITY_OPTIONS
      .filter((_, i) => checkedSeniorities[i])
      .flatMap((o) => [...o.values]);
    getAllPersonnelMutation.mutate({
      companyId,
      limit: fetchLimit,
      seniorities: selectedSeniorities.length > 0 ? selectedSeniorities : undefined,
      department: department !== "any" ? department : undefined,
    });
  };

  const toggleSeniority = (idx: number) => {
    setCheckedSeniorities((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const anyChecked = checkedSeniorities.some(Boolean);

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={getAllPersonnelMutation.isPending}
        size="sm"
        variant="outline"
        className="text-xs font-black border-2 border-blue-600 text-blue-600 h-8 px-3 cursor-pointer"
      >
        GET ALL PERSONNEL
      </Button>

      {/* Selection Modal */}
      {showSelectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSelectionModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b-2 border-gray-200">
              <h3 className="text-xl font-black">FETCH PERSONNEL</h3>
              <p className="text-sm text-muted-foreground mt-1">{companyName}</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Seniority checkboxes */}
              <div>
                <label className="block text-sm font-black mb-2 uppercase tracking-wide">Seniority</label>
                <div className="space-y-2">
                  {SENIORITY_OPTIONS.map((opt, idx) => (
                    <label key={opt.label} className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checkedSeniorities[idx]}
                        onChange={() => toggleSeniority(idx)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <span className={`text-sm font-bold ${checkedSeniorities[idx] ? "text-gray-900" : "text-gray-400"}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
                {!anyChecked && (
                  <p className="text-xs text-amber-600 font-bold mt-2">⚠ No seniority selected — will fetch all levels</p>
                )}
              </div>

              {/* Department dropdown */}
              <div>
                <label className="block text-sm font-black mb-2 uppercase tracking-wide">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded px-3 py-2 text-sm font-bold cursor-pointer focus:border-blue-600 outline-none"
                >
                  {DEPARTMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Max results */}
              <div>
                <label className="block text-sm font-black mb-2 uppercase tracking-wide">Max results</label>
                <select
                  value={fetchLimit}
                  onChange={(e) => setFetchLimit(Number(e.target.value))}
                  className="w-full border-2 border-gray-300 rounded px-3 py-2 text-sm font-bold cursor-pointer focus:border-blue-600 outline-none"
                >
                  <option value={10}>10 people</option>
                  <option value={25}>25 people</option>
                  <option value={50}>50 people</option>
                  <option value={100}>100 people</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Cost: 1 credit total (no email enrichment)</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t-2 border-gray-200 flex gap-3">
              <Button
                onClick={() => setShowSelectionModal(false)}
                variant="outline"
                className="font-black border-2 cursor-pointer flex-1"
              >
                CANCEL
              </Button>
              <Button
                onClick={handleFetch}
                disabled={getAllPersonnelMutation.isPending}
                className="font-black bg-blue-600 text-white cursor-pointer flex-1"
              >
                {getAllPersonnelMutation.isPending ? "FETCHING..." : "FETCH"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && (
        <PersonnelModal
          companyName={companyName}
          companyId={companyId}
          results={results}
          isPending={getAllPersonnelMutation.isPending}
          onRefresh={() => getAllPersonnelMutation.mutate({ companyId, limit: fetchLimit })}
          onClose={() => setShowResultsModal(false)}
          fetchLimit={fetchLimit}
          onFetchLimitChange={setFetchLimit}
        />
      )}
    </>
  );
}

// ============================================================================
// Personnel Modal — Shows All Personnel with Enrich Option
// ============================================================================
function PersonnelModal({
  companyName,
  companyId,
  results,
  isPending,
  onRefresh,
  onClose,
  fetchLimit,
  onFetchLimitChange,
}: {
  companyName: string;
  companyId: number;
  results: any;
  isPending: boolean;
  onRefresh: () => void;
  onClose: () => void;
  fetchLimit?: number;
  onFetchLimitChange?: (limit: number) => void;
}) {
  const [enrichingContactId, setEnrichingContactId] = useState<number | null>(null);

  const enrichContactMutation = trpc.companyFinder.enrichContact.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`Contact enriched successfully!`);
      setEnrichingContactId(null);
      onRefresh();
    },
    onError: (error) => {
      toast.error(`Enrichment failed: ${error.message}`);
      setEnrichingContactId(null);
    },
  });

  const handleEnrich = (contactId: number) => {
    setEnrichingContactId(contactId);
    enrichContactMutation.mutate({ contactId, includePhone: false });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const contacts = results?.contacts || [];
  const totalFound = results?.totalFound || 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white max-w-3xl w-full rounded-lg shadow-2xl border-2 border-blue-600 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white px-5 py-3 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-black">All Personnel at {companyName}</h2>
            <div className="text-xs opacity-80">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""} found (Total: {totalFound})
            </div>
          </div>
          <button onClick={onClose} className="text-white text-xl font-black hover:opacity-60">×</button>
        </div>

        {/* Contact List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-bold">
              No personnel found.
            </div>
          ) : (
            contacts.map((contact: any, idx: number) => (
              <div key={contact.id || idx} className="border-2 border-gray-200 p-3 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-base">
                      {contact.fullName || `${contact.firstName} ${contact.lastName}`}
                    </div>
                    {contact.title && (
                      <div className="text-sm font-bold text-muted-foreground">{contact.title}</div>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {!contact.email && (
                    <div className="flex items-center gap-2 col-span-full">
                      <span className="text-xs font-bold text-muted-foreground">No email yet</span>
                      <Button
                        onClick={() => handleEnrich(contact.id)}
                        disabled={enrichingContactId === contact.id}
                        variant="outline"
                        size="sm"
                        className="font-black border-2 border-green-600 text-green-600 h-6 px-2 text-[10px] shrink-0 cursor-pointer"
                      >
                        {enrichingContactId === contact.id ? "ENRICHING..." : "ENRICH EMAIL (1 credit)"}
                      </Button>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate flex-1">{contact.email}</span>
                      <Button
                        onClick={() => copyToClipboard(contact.email, "Email")}
                        variant="outline"
                        size="sm"
                        className="font-black border border-black h-6 px-2 text-[10px] shrink-0 cursor-pointer"
                      >
                        COPY
                      </Button>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{contact.phone}</span>
                      <Button
                        onClick={() => copyToClipboard(contact.phone, "Phone")}
                        variant="outline"
                        size="sm"
                        className="font-black border border-black h-6 px-2 text-[10px] shrink-0 cursor-pointer"
                      >
                        COPY
                      </Button>
                    </div>
                  )}
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold underline text-blue-600 truncate"
                    >
                      LinkedIn Profile
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-gray-200 shrink-0">
          {/* Fetch Limit Selector */}
          {fetchLimit !== undefined && onFetchLimitChange && (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-sm font-bold">Fetch Limit:</label>
              <select
                value={fetchLimit}
                onChange={(e) => onFetchLimitChange(Number(e.target.value))}
                className="border-2 border-gray-300 rounded px-2 py-1 text-sm font-bold cursor-pointer"
              >
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
              <span className="text-xs text-muted-foreground">Maximum employees to fetch</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={onRefresh}
              disabled={isPending}
              variant="outline"
              className="font-black border-2 border-blue-600 text-blue-600 cursor-pointer flex-1"
            >
              {isPending ? "SEARCHING..." : "SEARCH AGAIN"}
            </Button>
            <Button onClick={onClose} className="font-black bg-black text-white cursor-pointer flex-1">
              CLOSE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeepResearchDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedSearchId, setSelectedSearchId] = useState<number | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"urgency" | "name" | "date">("urgency");
  const [viewFilter, setViewFilter] = useState<"all" | "call_today">("all");
  const [reResearchingId, setReResearchingId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const reResearchMutation = trpc.companyFinder.reResearchCompany.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`Re-research complete — urgency: ${data.brief.urgencyScore}`);
      setReResearchingId(null);
      utils.companyFinder.getSearch.invalidate({ searchId: selectedSearchId! });
    },
    onError: (err) => {
      toast.error(`Re-research failed: ${err.message}`);
      setReResearchingId(null);
    },
  });

  // Fetch all search history
  const { data: searchHistory } = trpc.companyFinder.getSearchHistory.useQuery({ showArchived: false });

  // Fetch search data for selected search
  const { data: searchData, isLoading: searchLoading } = trpc.companyFinder.getSearch.useQuery(
    { searchId: selectedSearchId! },
    { enabled: !!selectedSearchId && viewFilter === "all" }
  );

  // Fetch call today companies (across all searches)
  const { data: callTodayData } = trpc.companyFinder.getCallToday.useQuery(
    undefined,
    { enabled: viewFilter === "call_today" }
  );

  // Filter to only deep-researched companies
  const deepResearchedCompanies = useMemo(() => {
    if (viewFilter === "call_today") {
      // Call Today view: show all call-today companies with deep research
      if (!callTodayData) return [];
      return (Array.isArray(callTodayData) ? callTodayData : [])
        .map((row: any) => row.company)
        .filter((c: any) => c.briefData);
    } else {
      // All Deep Researched view: show companies from selected search
      if (!searchData?.companies) return [];
      return searchData.companies.filter((c: any) => c.briefData);
    }
  }, [viewFilter, searchData?.companies, callTodayData]);

  // Sort companies
  const sortedCompanies = useMemo(() => {
    const sorted = [...deepResearchedCompanies];
    switch (sortBy) {
      case "urgency":
        sorted.sort((a: any, b: any) => (b.urgencyScore || 0) - (a.urgencyScore || 0));
        break;
      case "name":
        sorted.sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      case "date":
        sorted.sort((a: any, b: any) => {
          const dateA = a.briefGeneratedAt ? new Date(a.briefGeneratedAt).getTime() : 0;
          const dateB = b.briefGeneratedAt ? new Date(b.briefGeneratedAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
    }
    return sorted;
  }, [deepResearchedCompanies, sortBy]);

  // Completed searches only
  const completedSearches = useMemo(() => {
    if (!searchHistory) return [];
    return searchHistory.filter((s: any) => s.status === "completed");
  }, [searchHistory]);

  // Stats
  const totalResearched = deepResearchedCompanies.length;
  const avgUrgency = totalResearched > 0
    ? Math.round(deepResearchedCompanies.reduce((sum: number, c: any) => sum + (c.urgencyScore || 0), 0) / totalResearched)
    : 0;
  const highUrgency = deepResearchedCompanies.filter((c: any) => (c.urgencyScore || 0) >= 60).length;
  const withSalesApproach = deepResearchedCompanies.filter((c: any) => c.salesApproachData).length;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  const handleDownloadJSON = () => {
    if (sortedCompanies.length === 0) {
      toast.error("No companies to export");
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      viewFilter,
      totalCompanies: sortedCompanies.length,
      companies: sortedCompanies.map((company: any) => ({
        id: company.id,
        name: company.name,
        websiteUrl: company.websiteUrl,
        city: company.city,
        state: company.state,
        country: company.country,
        revenue: company.revenue,
        foundedYear: company.foundedYear,
        linkedinUrl: company.linkedinUrl,
        urgencyScore: company.urgencyScore,
        briefData: company.briefData ? JSON.parse(company.briefData) : null,
        salesApproachData: company.salesApproachData ? JSON.parse(company.salesApproachData) : null,
        briefGeneratedAt: company.briefGeneratedAt,
        salesApproachGeneratedAt: company.salesApproachGeneratedAt,
        decisionMakers: Array.isArray(company.contacts) ? company.contacts.map((contact: any) => ({
          id: contact.id,
          fullName: contact.fullName,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
        })) : [],
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deep-research-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sortedCompanies.length} companies`);
  };

  return (
    <div className="max-w-6xl">
      {/* Page Header */}
      <div className="mb-12 flex justify-between items-start gap-6">
        <div>
          <div className="text-xs font-black text-muted-foreground mb-2">[04] COCKPIT</div>
          <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
            DEEP RESEARCH<br />DASHBOARD
          </h1>
          <p className="text-lg font-bold text-muted-foreground max-w-2xl">
            Aggregated view of all deep-researched companies. Filter by search run or view companies marked for immediate outreach.
          </p>
        </div>
        {sortedCompanies.length > 0 && (
          <Button
            onClick={handleDownloadJSON}
            className="border-4 border-black bg-black text-white hover:bg-gray-900 font-black px-6 py-3 h-fit whitespace-nowrap"
          >
            ⬇️ DOWNLOAD JSON
          </Button>
        )}
      </div>

      {/* View Filter Tabs */}
      <div className="mb-8">
        <div className="text-sm font-black mb-3">VIEW FILTER</div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewFilter("all")}
            className={`border-4 px-6 py-3 text-sm font-black transition-colors ${
              viewFilter === "all"
                ? "border-black bg-black text-white"
                : "border-black hover:bg-gray-100"
            }`}
          >
            ALL DEEP RESEARCHED
          </button>
          <button
            onClick={() => setViewFilter("call_today")}
            className={`border-4 px-6 py-3 text-sm font-black transition-colors ${
              viewFilter === "call_today"
                ? "border-green-600 bg-green-600 text-white"
                : "border-green-600 text-green-600 hover:bg-green-50"
            }`}
          >
            CALL TODAY ({(callTodayData as any)?.length || 0})
          </button>
        </div>
      </div>

      {/* Search Selector (only for "All" view) */}
      {viewFilter === "all" && (
        <div className="mb-8">
          <div className="text-sm font-black mb-3">SELECT SEARCH RUN</div>
          <div className="flex flex-wrap gap-3">
            {completedSearches.map((search: any) => (
              <button
                key={search.id}
                onClick={() => setSelectedSearchId(search.id)}
                className={`border-4 px-5 py-3 text-sm font-black transition-colors cursor-pointer ${
                  selectedSearchId === search.id
                    ? "border-black bg-black text-white"
                    : "border-black hover:bg-gray-100"
                }`}
              >
                <div>Run #{search.id}</div>
                <div className="text-xs opacity-70">{new Date(search.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {(viewFilter === "call_today" || selectedSearchId) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border-4 border-black p-4">
            <div className="text-3xl font-black">{totalResearched}</div>
            <div className="text-sm font-bold text-muted-foreground">
              {viewFilter === "call_today" ? "Call Today" : "Researched"}
            </div>
          </div>
          <div className="border-4 border-blue-600 p-4">
            <div className="text-3xl font-black text-blue-600">{avgUrgency}</div>
            <div className="text-sm font-bold text-muted-foreground">Avg Urgency</div>
          </div>
          <div className="border-4 border-yellow-600 p-4">
            <div className="text-3xl font-black text-yellow-600">{highUrgency}</div>
            <div className="text-sm font-bold text-muted-foreground">High Urgency (60+)</div>
          </div>
          <div className="border-4 border-green-600 p-4">
            <div className="text-3xl font-black text-green-600">{withSalesApproach}</div>
            <div className="text-sm font-bold text-muted-foreground">Sales Approach</div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      {sortedCompanies.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-black mb-2">SORT BY</div>
          <div className="flex gap-2">
            {[
              { value: "urgency", label: "Urgency" },
              { value: "name", label: "Name" },
              { value: "date", label: "Date" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as any)}
                className={`border-2 px-4 py-2 text-xs font-bold ${
                  sortBy === option.value
                    ? "border-black bg-black text-white"
                    : "border-gray-300 hover:border-black"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Company List */}
      {searchLoading && <div className="text-center py-12 text-muted-foreground">Loading companies...</div>}

      {!searchLoading && sortedCompanies.length === 0 && viewFilter === "all" && !selectedSearchId && (
        <div className="border-4 border-dashed border-gray-300 p-12 text-center">
          <div className="text-xl font-black text-muted-foreground mb-2">No Search Selected</div>
          <div className="text-sm text-muted-foreground">Select a search run above to view deep-researched companies.</div>
        </div>
      )}

      {!searchLoading && sortedCompanies.length === 0 && viewFilter === "all" && selectedSearchId && (
        <div className="border-4 border-dashed border-gray-300 p-12 text-center">
          <div className="text-xl font-black text-muted-foreground mb-2">No Deep Research Found</div>
          <div className="text-sm text-muted-foreground">No companies in this search have been deep-researched yet.</div>
        </div>
      )}

      {!searchLoading && sortedCompanies.length === 0 && viewFilter === "call_today" && (
        <div className="border-4 border-dashed border-green-300 p-12 text-center">
          <div className="text-xl font-black text-green-600 mb-2">No Companies Marked Call Today</div>
          <div className="text-sm text-muted-foreground">Mark companies as "Call Today" from the Search Results page to see them here.</div>
        </div>
      )}

      {sortedCompanies.length > 0 && (
        <div className="space-y-4">
          {sortedCompanies.map((company: any) => {
            const isExpanded = expandedCompanyId === company.id;
            const briefData = company.briefData ? JSON.parse(company.briefData) : null;
            const salesApproach = company.salesApproachData ? JSON.parse(company.salesApproachData) : null;
            const urgencyScore = briefData?.urgencyScore || company.urgencyScore || 0;

            return (
              <div key={company.id} className="border-4 border-black">
                {/* Company Header (Clickable) */}
                <div
                  onClick={() => setExpandedCompanyId(isExpanded ? null : company.id)}
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Urgency Badge */}
                      <div className={`inline-block px-3 py-1 text-xs font-black mb-2 ${
                        urgencyScore >= 70 ? "bg-red-600 text-white" :
                        urgencyScore >= 50 ? "bg-yellow-600 text-white" :
                        "bg-gray-300 text-black"
                      }`}>
                        URGENCY: {urgencyScore}/100
                      </div>

                      {/* Company Name & Location */}
                      <h3 className="text-2xl font-black">{company.name}</h3>
                      <div className="text-sm font-bold text-muted-foreground mt-1">
                        {[company.city, company.state, company.country].filter(Boolean).join(", ")}
                        {company.websiteUrl && (
                          <span className="ml-3">
                            <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>
                              {company.websiteUrl}
                            </a>
                          </span>
                        )}
                      </div>

                      {/* Quick Summary */}
                      {briefData?.conversationStarters?.[0] && (
                        <div className="text-sm font-bold text-blue-600 mt-2 italic">
                          "{typeof briefData.conversationStarters[0] === 'string' 
                            ? briefData.conversationStarters[0] 
                            : briefData.conversationStarters[0].opener}"
                        </div>
                      )}
                    </div>

                    <span className="text-2xl font-black ml-4">{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <GetAllPersonnelButtonDeep companyId={company.id} companyName={company.name} />
                    <button
                      onClick={() => {
                        setReResearchingId(company.id);
                        reResearchMutation.mutate({ companyId: company.id });
                      }}
                      disabled={reResearchingId === company.id}
                      className={`border-2 px-4 py-2 text-xs font-black transition-colors ${
                        reResearchingId === company.id
                          ? "border-gray-300 text-gray-400 cursor-not-allowed"
                          : "border-orange-500 text-orange-600 hover:bg-orange-50"
                      }`}
                    >
                      {reResearchingId === company.id ? "⏳ RE-RESEARCHING..." : "🔄 RE-RESEARCH"}
                    </button>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && briefData && (
                  <div className="border-t-4 border-black p-6">
                    {/* Urgency Breakdown */}
                    {briefData.urgencyBreakdown && (
                      <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-600">
                        <div className="text-xl font-black text-blue-600 mb-3">Urgency Score: {urgencyScore}/100</div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-bold">Company Context</div>
                            <div className="text-2xl font-black">{briefData.urgencyBreakdown.companyContext}/40</div>
                          </div>
                          <div>
                            <div className="font-bold">Market Signals</div>
                            <div className="text-2xl font-black">{briefData.urgencyBreakdown.marketSignals}/35</div>
                          </div>
                          <div>
                            <div className="font-bold">Recent Activity</div>
                            <div className="text-2xl font-black">{briefData.urgencyBreakdown.recentActivity}/25</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recent Developments */}
                    {briefData.recentDevelopments?.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-lg font-black mb-2">Recent Developments</h4>
                        <ul className="space-y-2">
                          {briefData.recentDevelopments.map((dev: any, i: number) => (
                            <li key={i}>
                              <div className="text-sm">
                                {typeof dev === 'string' ? dev : dev.text || JSON.stringify(dev)}
                              </div>
                              {typeof dev !== 'string' && dev.date && <div className="text-xs text-gray-500">{dev.date}</div>}
                              {typeof dev !== 'string' && dev.snippet && <div className="text-xs text-gray-600 italic border-l-2 border-gray-300 pl-2 mt-1">"{dev.snippet}"</div>}
                              {typeof dev !== 'string' && dev.sourceUrl && <a href={dev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline inline-block mt-1">Source</a>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Urgency Signals */}
                    {briefData.urgencySignals?.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-lg font-black mb-2">Urgency Signals</h4>
                        <div className="space-y-2">
                          {briefData.urgencySignals.map((signal: any, i: number) => (
                            <div key={i} className="p-3 bg-yellow-50 border border-yellow-300">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-sm">{signal.category} — {signal.type}</span>
                                  <div className="text-sm mt-1">{signal.description}</div>
                                  {signal.snippet && <div className="text-xs text-gray-600 italic border-l-2 border-yellow-400 pl-2 mt-1">"{signal.snippet}"</div>}
                                  {signal.sourceUrl && <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline inline-block mt-1">Source</a>}
                                </div>
                                <span className="text-sm font-black text-yellow-700 ml-4">+{signal.weight}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Engagement Strategy */}
                    {briefData.engagementStrategy && (
                      <div className="mb-6">
                        <h4 className="text-lg font-black mb-2">Engagement Strategy</h4>
                        {briefData.engagementStrategy.whyThisProspectMatters?.length > 0 && (
                          <div className="mb-3">
                            <div className="font-bold text-sm mb-1">Why This Prospect Matters:</div>
                            <ul className="list-disc pl-5 space-y-1">
                              {briefData.engagementStrategy.whyThisProspectMatters.map((reason: string, i: number) => (
                                <li key={i} className="text-sm">{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {briefData.engagementStrategy.nextSteps?.length > 0 && (
                          <div>
                            <div className="font-bold text-sm mb-1">Next Steps:</div>
                            <ul className="list-disc pl-5 space-y-1">
                              {briefData.engagementStrategy.nextSteps.map((step: string, i: number) => (
                                <li key={i} className="text-sm">{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sales Approach Summary */}
                    {salesApproach && (
                      <div className="border-t-2 border-black pt-4 mt-4">
                        <h4 className="text-lg font-black text-green-600 mb-3">SALES APPROACH</h4>

                        {/* Conversation Starters */}
                        {salesApproach.conversationStarters?.length > 0 && (
                          <div className="mb-4">
                            <div className="font-bold text-sm mb-1">Conversation Starters:</div>
                            <div className="space-y-2">
                              {salesApproach.conversationStarters.map((starter: any, i: number) => (
                                <div key={i} className="text-sm p-2 bg-amber-50 border border-amber-200">
                                  {typeof starter === 'string' ? starter : starter.opener}
                                  {typeof starter !== 'string' && starter.sourceUrl && (
                                    <a href={starter.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline ml-2">Source</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Email Draft */}
                        {salesApproach.emailDraft && (
                          <div className="mb-4 p-4 border-2 border-green-600">
                            <div className="flex justify-between items-center mb-2">
                              <div className="font-black text-green-600">Email Draft</div>
                              <Button
                                onClick={() => copyToClipboard(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                                variant="outline"
                                size="sm"
                              >
                                Copy Email
                              </Button>
                            </div>
                            <div className="text-sm font-bold mb-1">Subject: {salesApproach.emailDraft.subject}</div>
                            <div className="text-sm whitespace-pre-wrap">{salesApproach.emailDraft.body}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── LIBRARY ── */}
                    <LibrarySection briefData={briefData} />

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Library Section — Sources + Raw Grok Output
// ============================================================================
function LibrarySection({ briefData }: { briefData: any }) {
  const [showUrgencyRaw, setShowUrgencyRaw] = useState(false);
  const [showIntelRaw, setShowIntelRaw] = useState(false);

  const hasSources = briefData.sources?.length > 0;
  const hasUrgencyRaw = !!briefData.rawGrokUrgency;
  const hasIntelRaw = !!briefData.rawGrokIntelligence;

  if (!hasSources && !hasUrgencyRaw && !hasIntelRaw) return null;

  return (
    <div className="mt-6 border-t-2 border-gray-300 pt-4">
      <h4 className="text-lg font-black mb-3 text-gray-500 uppercase tracking-widest">Library</h4>

      {/* Sources list */}
      {hasSources && (
        <div className="mb-4">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Sources ({briefData.sources.length})</div>
          <div className="space-y-1">
            {briefData.sources.map((source: any, i: number) => (
              <div key={i} className="text-sm">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline font-bold"
                >
                  {source.title || source.url}
                </a>
                {source.snippet && (
                  <span className="text-xs text-gray-400 ml-2">{source.snippet}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Grok — Urgency Phase */}
      {hasUrgencyRaw && (
        <div className="mb-3">
          <button
            onClick={() => setShowUrgencyRaw(!showUrgencyRaw)}
            className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"
          >
            <span>{showUrgencyRaw ? '▾' : '▸'}</span> Raw Grok Output — Urgency Phase
          </button>
          {showUrgencyRaw && (
            <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {briefData.rawGrokUrgency}
            </pre>
          )}
        </div>
      )}

      {/* Raw Grok — Intelligence Phase */}
      {hasIntelRaw && (
        <div className="mb-3">
          <button
            onClick={() => setShowIntelRaw(!showIntelRaw)}
            className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"
          >
            <span>{showIntelRaw ? '▾' : '▸'}</span> Raw Grok Output — Intelligence Phase
          </button>
          {showIntelRaw && (
            <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {briefData.rawGrokIntelligence}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
