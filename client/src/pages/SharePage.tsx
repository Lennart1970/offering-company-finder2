import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { normaliseSalesApproach } from "@shared/normaliseStarters";
import { stripGrokCitations } from "@/lib/utils";
import { ShareGate } from "@/components/ShareGate";

// --- Helpers ----------------------------------------------------------------

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function safeStarterText(s: any): string {
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    return s.opener ?? s.conversationStarter ?? s.description ?? JSON.stringify(s);
  }
  return String(s ?? "");
}

function formatRevenue(revenue: number | string | null): string {
  if (!revenue) return "—";
  const num = typeof revenue === "string" ? parseFloat(revenue) : revenue;
  if (isNaN(num)) return String(revenue);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

function ScoreBadge({ score, label, color }: { score: number | null; label: string; color: string }) {
  if (score === null || score === undefined) return null;
  return (
    <div className="text-center">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg ${color}`}>
        {score}
      </div>
      <p className="text-xs text-gray-400 mt-1 font-bold">{label}</p>
    </div>
  );
}

// --- Section Header ----------------------------------------------------------
function SectionHeader({ id, emoji, title, color }: {
  id: string; emoji: string; title: string; color: string;
}) {
  return (
    <div id={id} className={`flex items-center border-b-4 ${color} pb-2 mb-6 scroll-mt-4`}>
      <h2 className={`text-xl font-black tracking-tight ${color.replace("border-", "text-")}`}>
        {emoji} {title}
      </h2>
    </div>
  );
}

// --- Contacts Panel Component -----------------------------------------------
function ContactsPanel({ token, initialContacts = [], initialFetchedAt = null }: {
  token: string;
  initialContacts?: any[];
  initialFetchedAt?: Date | null;
}) {
  const [seniority, setSeniority] = useState<"all" | "senior">("all");
  const [dept, setDept] = useState<string>("all");
  const [mutStatus, setMutStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fetchedAt, setFetchedAt] = useState<Date | null>(initialFetchedAt ?? null);
  const [allContacts, setAllContacts] = useState<any[]>(initialContacts.filter(Boolean));

  const visitorEmail = typeof window !== "undefined" ? localStorage.getItem("lt_share_visitor_email") ?? "" : "";

  const findDM = trpc.shareExt.findDecisionMakers.useMutation({
    onSuccess: (data) => {
      setAllContacts(prev => {
        const existing = new Set(prev.map((c: any) => c.email?.toLowerCase()).filter(Boolean));
        const newOnes = data.contacts.filter((c: any) => !existing.has(c.email?.toLowerCase()));
        return [...prev, ...newOnes].filter(Boolean);
      });
      setMutStatus("done");
    },
    onError: (e) => { setErrorMsg(e.message); setMutStatus("error"); },
  });

  const getAllP = trpc.shareExt.getAllPersonnelForShare.useMutation({
    onSuccess: (data) => {
      setAllContacts(data.contacts.filter(Boolean));
      setFetchedAt(data.fetchedAt ? new Date(data.fetchedAt as any) : new Date());
      setMutStatus("done");
    },
    onError: (e) => { setErrorMsg(e.message); setMutStatus("error"); },
  });

  const handleFindDM = () => {
    if (!visitorEmail) return;
    setMutStatus("loading"); setErrorMsg("");
    findDM.mutate({ token, visitorEmail });
  };

  const handleGetAll = () => {
    if (!visitorEmail) return;
    setMutStatus("loading"); setErrorMsg("");
    getAllP.mutate({ token, visitorEmail });
  };

  const DEPT_OPTIONS = [
    { value: "all", label: "ALL" },
    { value: "engineering", label: "Engineering" },
    { value: "sales", label: "Sales" },
    { value: "marketing", label: "Marketing" },
    { value: "operations", label: "Operations" },
    { value: "finance", label: "Finance" },
    { value: "hr", label: "HR / People" },
    { value: "product", label: "Product" },
  ];

  // Client-side filtering on stored contacts
  const SENIOR_TITLES = ["ceo", "cto", "coo", "cfo", "cmo", "cso", "founder", "co-founder", "president", "vp", "vice president", "director", "head of", "chief", "owner", "partner", "principal"];
  const DEPT_KEYWORDS: Record<string, string[]> = {
    engineering: ["engineer", "developer", "architect", "devops", "infrastructure", "software", "backend", "frontend", "fullstack", "data", "ml", "ai", "cloud", "security", "qa", "test"],
    sales: ["sales", "account", "business development", "revenue", "commercial", "growth"],
    marketing: ["marketing", "brand", "content", "seo", "demand", "communications", "pr ", "public relations"],
    operations: ["operations", "ops", "supply chain", "logistics", "procurement", "facilities"],
    finance: ["finance", "financial", "accounting", "controller", "treasurer", "audit", "tax", "fp&a"],
    hr: ["hr", "human resources", "people", "talent", "recruiting", "recruiter", "culture", "learning", "l&d"],
    product: ["product", "ux", "ui", "design", "user experience", "user research", "product owner", "scrum"],
  };

  const filtered = allContacts.filter((c: any) => {
    const title = (c.title ?? "").toLowerCase();
    if (seniority === "senior" && !SENIOR_TITLES.some(t => title.includes(t))) return false;
    if (dept !== "all") {
      const keywords = DEPT_KEYWORDS[dept] ?? [];
      if (!keywords.some(k => title.includes(k))) return false;
    }
    return true;
  });

  const isLoading = mutStatus === "loading";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Contacts {allContacts.length > 0 && <span className="text-gray-600">({allContacts.length})</span>}</h3>
        {fetchedAt && (
          <span className="text-[9px] text-gray-400">fetched {fetchedAt.toLocaleDateString()}</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleFindDM}
          disabled={isLoading || !visitorEmail}
          className="w-full border-2 border-purple-600 text-purple-700 text-xs font-black py-2 px-3 rounded hover:bg-purple-50 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          👤 FIND DECISION-MAKERS
        </button>
        <button
          onClick={handleGetAll}
          disabled={isLoading || !visitorEmail}
          className="w-full border-2 border-blue-600 text-blue-700 text-xs font-black py-2 px-3 rounded hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {allContacts.length > 0 ? "🔄 REFRESH PERSONNEL" : "📋 GET ALL PERSONNEL"}
        </button>
      </div>

      {/* Filters — always visible once contacts are loaded */}
      {allContacts.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase">Seniority</span>
            {(["all", "senior"] as const).map((s) => (
              <button key={s} onClick={() => setSeniority(s)}
                className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                  seniority === s ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-500 hover:border-gray-500"
                }`}>
                {s === "all" ? "ALL" : "Lead / Senior"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase">Dept</span>
            {DEPT_OPTIONS.map((d) => (
              <button key={d.value} onClick={() => setDept(d.value)}
                className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                  dept === d.value ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-500 hover:border-gray-500"
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">{filtered.length} of {allContacts.length} shown</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <span className="text-xs text-gray-500 font-bold">Searching Apollo…</span>
        </div>
      )}

      {/* Error state */}
      {mutStatus === "error" && (
        <p className="text-xs text-red-600 font-bold">{errorMsg}</p>
      )}

      {/* Empty state */}
      {!isLoading && allContacts.length === 0 && (
        <p className="text-xs text-gray-400">No contacts yet. Click a button above to search.</p>
      )}
      {allContacts.length > 0 && filtered.length === 0 && (
        <p className="text-xs text-gray-400 font-bold">No contacts match the current filters.</p>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filtered.map((c: any, i: number) => (
            <div key={i} className="text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <p className="font-black text-gray-900 text-xs leading-tight">{c.fullName || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}</p>
              {c.title && <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{c.title}</p>}
              {c.email && <a href={`mailto:${c.email}`} className="text-blue-600 text-[10px] hover:underline block mt-1 font-medium break-all">{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="text-green-600 text-[10px] hover:underline block font-medium">{c.phone}</a>}
              {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-[10px] hover:underline block">LinkedIn ↗</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Component ----------------------------------------------------------

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("urgency");

  const NAV_SECTIONS = [
    { id: "urgency",  label: "⚡ URGENCY",  activeClass: "bg-red-600 text-white",    inactiveClass: "text-red-600 hover:bg-red-50" },
    { id: "approach", label: "💬 APPROACH", activeClass: "bg-green-600 text-white",  inactiveClass: "text-green-600 hover:bg-green-50" },
    { id: "fit",      label: "🎯 FIT",      activeClass: "bg-blue-600 text-white",   inactiveClass: "text-blue-600 hover:bg-blue-50" },
    { id: "media",    label: "🖼 MEDIA",    activeClass: "bg-yellow-500 text-black", inactiveClass: "text-yellow-600 hover:bg-yellow-50" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY + 130;
      const ids = ["urgency", "approach", "fit", "media"];
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.offsetTop <= scrollY) { setActiveSection(ids[i]); break; }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { data, isLoading, error } = trpc.share.resolveToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token }
  );

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    const el = document.createElement("div");
    el.textContent = `${label} copied!`;
    el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#000;color:#fff;padding:8px 20px;font-weight:900;font-size:12px;z-index:9999;border-radius:4px;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-black animate-pulse">Loading company intelligence…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-black mb-2">Link not found</h1>
          <p className="text-muted-foreground text-sm">This share link is invalid or has expired. Please request a new link from the LeadTrigger platform.</p>
        </div>
      </div>
    );
  }

  const { company, brain, brainOutput, contacts: contactList, contactsFetchedAt, leadinfo, companyImages = [] } = data;

  // Parse JSON fields
  const rawBriefData = brainOutput?.briefData ?? company.briefData;
  const briefData = (() => {
    if (!rawBriefData) return null;
    try {
      const raw = typeof rawBriefData === "string" ? JSON.parse(rawBriefData) : rawBriefData;
      if (!raw) return null;
      if (!raw.productsAndServices && raw.productsServices) raw.productsAndServices = raw.productsServices;
      if (!raw.companyOverview && raw.executiveSummary) {
        const es = raw.executiveSummary;
        raw.companyOverview = [es.company, es.industry !== "Unknown" ? es.industry : null, es.revenue !== "Unknown" ? `Revenue: ${es.revenue}` : null].filter(Boolean).join(" · ");
      }
      return raw;
    } catch { return null; }
  })();

  const rawSalesApproach = brainOutput?.salesApproachData ?? company.salesApproachData;
  const salesApproach = (() => {
    if (!rawSalesApproach) return null;
    try { return normaliseSalesApproach(typeof rawSalesApproach === "string" ? JSON.parse(rawSalesApproach) : rawSalesApproach); }
    catch { return null; }
  })();

  const fitScoreData = safeJson<any>(brainOutput?.fitScoreData ?? company.fitScoreData, null);
  const fitScore = brainOutput?.fitScore ?? company.fitScore ?? null;
  const urgencyScore = brainOutput?.urgencyScore ?? company.urgencyScore ?? null;
  const urgency = briefData?.urgencySignals ?? [];
  const urgencyBreakdown = briefData?.urgencyBreakdown ?? null;

  const fitColor = fitScore !== null
    ? fitScore >= 70 ? "bg-green-500" : fitScore >= 40 ? "bg-yellow-500" : "bg-red-400"
    : "bg-gray-300";
  const urgencyColor = urgencyScore !== null
    ? urgencyScore >= 70 ? "bg-orange-500" : urgencyScore >= 40 ? "bg-yellow-500" : "bg-blue-400"
    : "bg-gray-300";

  const location = (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : "—";

  const sliceMeta = safeJson<any>(company.sliceMetadata as any, null);
  const employeeBand = sliceMeta?.employeeBand ?? null;

  return (
    <ShareGate tokenType="company" tokenValue={token ?? ""}>
    <div className="min-h-screen bg-gray-50">
      {/* -- Top header bar -- */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-black">LT</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LeadTrigger · Connect Group</p>
              {data.shareListName && <p className="text-xs font-bold text-gray-600">{data.shareListName}</p>}
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-black text-gray-500 border-gray-400">Read-only · Confidential</Badge>
        </div>
      </div>

      {/* -- Sticky jump nav -- */}
      <div className="bg-white border-b-2 border-black sticky top-[57px] z-30">
        <div className="max-w-6xl mx-auto px-6 flex items-center overflow-x-auto">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); setActiveSection(s.id); }}
              className={`shrink-0 px-5 py-3 text-xs font-black border-r-2 border-black transition-colors ${
                activeSection === s.id ? s.activeClass : s.inactiveClass
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* -- Company Header Card -- */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-black leading-tight mb-1">{company.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
                {company.websiteUrl && (
                  <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
                    {company.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {location !== "—" && <span>📍 {location}</span>}
                {company.revenue && <span>💰 {formatRevenue(company.revenue)}</span>}
                {employeeBand && <span>👥 {employeeBand}</span>}
              </div>
              {briefData?.companyOverview && (
                <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">{briefData.companyOverview}</p>
              )}
              {brain && (
                <div className="mt-3">
                  <span className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5">
                    🧠 {brain.brainName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-start gap-4 shrink-0">
              {/* Company image strip */}
              {companyImages.length > 0 && (
                <div className="flex gap-2">
                  {companyImages.map((url: string, i: number) => (
                    <div
                      key={i}
                      className="w-28 h-20 rounded-lg overflow-hidden border border-gray-200 cursor-pointer shrink-0"
                      onClick={() => setLightboxImage(url)}
                    >
                      <img
                        src={url}
                        alt={`${company.name} ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <ScoreBadge score={fitScore} label="Fit" color={fitColor} />
                <ScoreBadge score={urgencyScore} label="Urgency" color={urgencyColor} />
              </div>
            </div>
          </div>
        </div>

        {/* -- Two-column layout -- */}
        <div className="flex gap-6 items-start">

          {/* --- LEFT SIDEBAR (sticky) --- */}
          <div className="w-64 shrink-0 space-y-4 sticky top-[57px]">

            {/* Contacts panel */}
            <ContactsPanel
              token={token ?? ""}
              initialContacts={contactList ?? []}
              initialFetchedAt={contactsFetchedAt ? new Date(contactsFetchedAt as any) : null}
            />

{/* Website Visitors moved to main content column */}

            {/* Fit score breakdown panel */}
            {fitScoreData?.breakdown?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Fit Breakdown</h3>
                <div className="space-y-3">
                  {fitScoreData.breakdown.map((dim: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-gray-700 truncate max-w-[130px]">{dim.dimension ?? dim.criterion}</span>
                        <span className="text-gray-400 shrink-0">{dim.score}/{dim.maxScore ?? 10}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5">
                        <div className={`h-1.5 ${fitColor}`} style={{ width: `${Math.min(100, Math.round((dim.score / (dim.maxScore ?? 10)) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {fitScoreData.rationale && (
                  <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">{fitScoreData.rationale}</p>
                )}
              </div>
            )}

            {/* Quick company meta */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Company Info</h3>
              <div className="space-y-2 text-xs">
                {location !== "—" && <div><span className="font-black text-gray-400">LOCATION </span><span className="font-bold">{location}</span></div>}
                {company.revenue && <div><span className="font-black text-gray-400">REVENUE </span><span className="font-bold">{formatRevenue(company.revenue)}</span></div>}
                {employeeBand && <div><span className="font-black text-gray-400">EMPLOYEES </span><span className="font-bold">{employeeBand}</span></div>}
                {company.linkedinUrl && (
                  <div>
                    <span className="font-black text-gray-400">LINKEDIN </span>
                    <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">Profile ↗</a>
                  </div>
                )}
                {company.websiteUrl && (
                  <div>
                    <span className="font-black text-gray-400">WEBSITE </span>
                    <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">{company.websiteUrl.replace(/^https?:\/\//, "")}</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- RIGHT MAIN CONTENT --- */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* -- WEBSITE VISITORS (Leadinfo) -- */}
            {leadinfo && (
              <section>
                <div id="visitors" className="flex items-center justify-between border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-base">👁</span>
                    <h2 className="text-xs font-black uppercase tracking-widest text-green-700">Website Visitors</h2>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-green-100 text-green-700 rounded uppercase">Website Visitor</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded uppercase">Leadinfo</span>
                  </div>
                </div>
                {/* Stat row — horizontal layout matching the internal magazine view */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-gray-200 rounded-xl overflow-hidden mb-4">
                  <div className="p-4 border-r border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-tight">Engagement</p>
                    <p className="text-4xl font-black text-gray-900 leading-tight mt-1">{leadinfo.engagementScore}</p>
                  </div>
                  <div className="p-4 border-r border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-tight">Sessions</p>
                    <p className="text-4xl font-black text-gray-900 leading-tight mt-1">{leadinfo.totalSessions}</p>
                  </div>
                  <div className="p-4 border-r border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-tight">Pages Viewed</p>
                    <p className="text-4xl font-black text-gray-900 leading-tight mt-1">{leadinfo.totalPages}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-tight">Avg Pages / Session</p>
                    <p className="text-4xl font-black text-gray-900 leading-tight mt-1">{leadinfo.avgPagesPerSession}</p>
                  </div>
                </div>
                {/* Second row: time on site + intent signals + pages visited */}
                <div className="flex flex-wrap gap-6">
                  {leadinfo.totalDuration > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase leading-tight">Time on Site</p>
                      <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">
                        {leadinfo.totalDuration >= 60
                          ? `${Math.floor(leadinfo.totalDuration / 60)}m ${leadinfo.totalDuration % 60}s`
                          : `${leadinfo.totalDuration}s`}
                      </p>
                    </div>
                  )}
                  {leadinfo.intentSignals.length > 0 && (
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Intent Signals</p>
                      <div className="flex flex-wrap gap-1">
                        {leadinfo.intentSignals.map((sig: string, i: number) => (
                          <span key={i} className="text-[10px] font-medium bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded-full">{sig}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {leadinfo.topPages.length > 0 && (
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Pages Visited</p>
                      <div className="space-y-0.5">
                        {leadinfo.topPages.map((pg: string, i: number) => (
                          <p key={i} className="text-[10px] text-gray-600 truncate">{pg}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* -- URGENCY SIGNALS -- */}
            <section>
              <div id="urgency" className="flex items-center gap-3 border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                <span className="text-red-600 text-base">⚡</span>
                <h2 className="text-xs font-black uppercase tracking-widest text-red-600">Urgency</h2>
              </div>

              {/* Urgency score bar */}
              {urgencyScore !== null && (
                <div className="border-2 border-red-300 bg-red-50 rounded-lg px-6 py-4 mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-red-600 leading-none">{urgencyScore}</span>
                    <span className="text-sm font-black text-red-400">/100</span>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Urgency Score</span>
                  </div>
                  {urgencyBreakdown && (
                    <div className="flex items-center gap-6 shrink-0">
                      {urgencyBreakdown.companyContext !== undefined && (
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Company</p>
                          <p className="text-lg font-black text-gray-900">
                            {urgencyBreakdown.companyContext}<span className="text-xs text-gray-400">/40</span>
                          </p>
                        </div>
                      )}
                      {urgencyBreakdown.marketSignals !== undefined && (
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Market</p>
                          <p className="text-lg font-black text-gray-900">
                            {urgencyBreakdown.marketSignals}<span className="text-xs text-gray-400">/35</span>
                          </p>
                        </div>
                      )}
                      {urgencyBreakdown.recentActivity !== undefined && (
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activity</p>
                          <p className="text-lg font-black text-gray-900">
                            {urgencyBreakdown.recentActivity}<span className="text-xs text-gray-400">/25</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!briefData || urgency.length === 0 ? (
                <p className="text-sm text-gray-400 font-bold">No urgency signals available.</p>
              ) : (
                <div className="space-y-3">
                  {urgency.map((signal: any, i: number) => {
                    const sourceUrl = signal.sourceUrl ?? signal.source_url ?? signal.url ?? null;
                    const sourceDomain = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return sourceUrl; } })() : null;
                    return (
                      <div key={i} className="bg-white border border-gray-200 p-4 rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-700 uppercase rounded">{signal.category ?? signal.type ?? "Signal"}</span>
                          {signal.urgencyContribution && <span className="text-[10px] font-black text-gray-400">+{signal.urgencyContribution} pts</span>}
                        </div>
                        <p className="text-sm font-bold leading-snug text-gray-800">{signal.description ?? signal.headline ?? ""}</p>
                        {signal.snippet && <blockquote className="border-l-4 border-red-200 pl-3 text-xs text-gray-500 italic line-clamp-3">{signal.snippet}</blockquote>}
                        {sourceUrl && sourceDomain && (
                          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black hover:underline">
                            <span className="inline-block w-4 h-4 bg-gray-100 border border-gray-200 text-[9px] font-black text-gray-500 flex items-center justify-center rounded-sm">{sourceDomain.charAt(0).toUpperCase()}</span>
                            <span className="truncate max-w-[200px]">{sourceDomain}</span>
                            <span className="text-gray-400">↗</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {briefData?.conversationStarter && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">💬 Conversation Starter</p>
                  <p className="text-sm font-bold text-amber-900 italic">"{briefData.conversationStarter}"</p>
                </div>
              )}
            </section>

            {/* -- SALES APPROACH -- */}
            <section>
              <div id="approach" className="flex items-center border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Sales Approach</h2>
              </div>

              {!salesApproach ? (
                <p className="text-sm text-gray-400 font-bold">No sales approach available.</p>
              ) : (
                <div className="space-y-6">
                  {/* Conversation Starters */}
                  {salesApproach.conversationStarters?.length > 0 && (
                    <div className="space-y-3">
                      {salesApproach.conversationStarters.map((s: any, i: number) => (
                        <div key={i} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-medium text-amber-900">{safeStarterText(s)}</p>
                          {typeof s !== "string" && s.basedOn && <p className="text-xs text-amber-600 mt-1">Based on: {s.basedOn}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Email Draft */}
                  {salesApproach.emailDraft && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-black uppercase tracking-widest text-green-700">EMAIL</span>
                        <button onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                          className="text-xs font-black border border-green-600 text-green-600 px-3 py-1 cursor-pointer hover:bg-green-600 hover:text-white transition-colors rounded">COPY EMAIL</button>
                      </div>
                      <div className="p-5">
                        <div className="mb-3 pb-3 border-b border-gray-100">
                          <span className="text-xs font-black text-gray-400">SUBJECT: </span>
                          <span className="text-sm font-bold">{salesApproach.emailDraft.subject}</span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{stripGrokCitations(salesApproach.emailDraft.body ?? "")}</div>
                      </div>
                    </div>
                  )}

                  {/* LinkedIn Message */}
                  {salesApproach.linkedinMessage && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-black uppercase tracking-widest text-blue-700">LINKEDIN</span>
                      </div>
                      <div className="p-5 space-y-4">
                        {salesApproach.linkedinMessage.connectionRequest && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-gray-500">CONNECTION REQUEST</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} className="text-xs font-black border border-blue-500 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-500 hover:text-white transition-colors rounded">COPY</button>
                            </div>
                            <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">{stripGrokCitations(salesApproach.linkedinMessage.connectionRequest ?? "")}</div>
                          </div>
                        )}
                        {salesApproach.linkedinMessage.followUp && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-gray-500">FOLLOW-UP</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.followUp, "Follow-up")} className="text-xs font-black border border-blue-500 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-500 hover:text-white transition-colors rounded">COPY</button>
                            </div>
                            <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">{stripGrokCitations(salesApproach.linkedinMessage.followUp ?? "")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Call Script */}
                  {salesApproach.callScript && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-black uppercase tracking-widest text-purple-700">CALL SCRIPT</span>
                        <button onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening || "", "Call Script")}
                          className="text-xs font-black border border-purple-600 text-purple-600 px-3 py-1 cursor-pointer hover:bg-purple-600 hover:text-white transition-colors rounded">COPY SCRIPT</button>
                      </div>
                      <div className="p-5 space-y-3">
                        {salesApproach.callScript.opening && (
                          <div>
                            <div className="text-xs font-black text-gray-400 mb-1">OPENING</div>
                            <div className="text-sm text-gray-700 bg-purple-50 p-3 rounded border border-purple-100">{stripGrokCitations(salesApproach.callScript.opening ?? "")}</div>
                          </div>
                        )}
                        {salesApproach.callScript.valueProposition && (
                          <div>
                            <div className="text-xs font-black text-gray-400 mb-1">VALUE PROPOSITION</div>
                            <div className="text-sm text-gray-700 bg-purple-50 p-3 rounded border border-purple-100">{stripGrokCitations(salesApproach.callScript.valueProposition ?? "")}</div>
                          </div>
                        )}
                        {salesApproach.callScript.fullScript && (
                          <div>
                            <div className="text-xs font-black text-gray-400 mb-1">FULL SCRIPT</div>
                            <div className="whitespace-pre-wrap text-sm text-gray-700 bg-purple-50 p-4 rounded border border-purple-100">{stripGrokCitations(salesApproach.callScript.fullScript ?? "")}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* -- FIT ANALYSIS -- */}
            {briefData && (
              <section>
                <div id="fit" className="flex items-center border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Fit Analysis</h2>
                </div>

                <div className="space-y-5">
                  {briefData.whyThisCompanyMatters && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Why This Company Matters</p>
                      <p className="text-sm font-bold text-blue-900 leading-relaxed">{briefData.whyThisCompanyMatters}</p>
                    </div>
                  )}

                  {briefData.productsAndServices?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Products & Services</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {briefData.productsAndServices.map((p: any, i: number) => (
                          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="font-black text-sm mb-1">{typeof p === "string" ? p : p.name ?? p.product ?? ""}</div>
                            {typeof p !== "string" && p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {briefData.keyTechnologies?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Key Technologies</h3>
                      <div className="flex flex-wrap gap-2">
                        {briefData.keyTechnologies.map((t: any, i: number) => (
                          <span key={i} className="text-xs font-bold border-2 border-black px-3 py-1.5 bg-white">
                            {typeof t === "string" ? t : t.name ?? t.technology ?? ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {briefData.sources?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Sources ({briefData.sources.length})</h3>
                      <div className="space-y-2">
                        {briefData.sources.map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors">
                            <span className="text-xs font-black text-gray-400 shrink-0">[{i + 1}]</span>
                            <div className="flex-1 min-w-0">
                              {(s.url || s.sourceUrl) ? (
                                <a href={s.url || s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 underline truncate block">{s.title || s.url || s.sourceUrl}</a>
                              ) : <div className="text-sm font-bold">{s.title || String(s)}</div>}
                              {s.snippet && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.snippet}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* -- MEDIA section (full-width below two-col layout) -- */}
      {companyImages.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-10">
          <div id="media" className="flex items-center gap-3 border-b-2 border-gray-200 pb-2 mb-5 scroll-mt-4">
            <span className="text-yellow-600 text-base">🖼</span>
            <h2 className="text-xs font-black uppercase tracking-widest text-yellow-600">Media</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {companyImages.map((url: string, i: number) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden border border-gray-200 cursor-pointer bg-gray-100 aspect-video"
                onClick={() => setLightboxImage(url)}
              >
                <img
                  src={url}
                  alt={`${company.name} ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -- Lightbox -- */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Image" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white font-black text-2xl hover:text-gray-300" onClick={() => setLightboxImage(null)}>✕</button>
        </div>
      )}
    </div>
    </ShareGate>
  );
}
