import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";
import BrainBadge from "@/components/BrainBadge";
import { Button } from "@/components/ui/button";
import { normaliseSalesApproach } from "@shared/normaliseStarters";
import { stripGrokCitations } from "@/lib/utils";
import { Send } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── Two-Zone Section Architecture ──────────────────────────────────────────────
// Zone 1: GENERAL — same data regardless of which brain is selected
const GENERAL_SECTIONS = [
  { id: "contacts", label: "👤 CONTACTS",     color: "text-purple-600 border-purple-600",activeBg: "bg-purple-600" },
  { id: "media",    label: "🖼 MEDIA",        color: "text-gray-600 border-gray-600",  activeBg: "bg-gray-700" },
];

// Zone 2: BRAIN-SPECIFIC — content changes when switching brains
const BRAIN_SECTIONS = [
  { id: "urgency",  label: "⚡ URGENCY",     color: "text-red-600 border-red-600",    activeBg: "bg-red-600" },
  { id: "fit",      label: "🎯 FIT",          color: "text-blue-600 border-blue-600",  activeBg: "bg-blue-600" },
  { id: "approach", label: "💬 APPROACH",     color: "text-green-600 border-green-600",activeBg: "bg-green-600" },
];

// Combined for scroll-spy (keep all sections tracked)
const SECTION_ANCHORS = [...GENERAL_SECTIONS, ...BRAIN_SECTIONS];

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ id, emoji, title, color, action }: {
  id: string; emoji: string; title: string; color: string; action?: React.ReactNode;
}) {
  return (
    <div id={id} className={`flex items-center justify-between border-b-4 ${color} pb-2 mb-6 scroll-mt-20`}>
      <h2 className={`text-xl font-black tracking-tight ${color.replace("border-", "text-")}`}>
        {emoji} {title}
      </h2>
      {action}
    </div>
  );
}

// ── Cache Banner ──────────────────────────────────────────────────────────────
function CacheBanner({ cachedAt, label, onRefresh, loading }: {
  cachedAt: Date | string | null | undefined; label: string; onRefresh: () => void; loading: boolean;
}) {
  if (!cachedAt) return null;
  const d = new Date(cachedAt);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const ageLabel = diffDays >= 1 ? `${diffDays}d ago` : diffHours >= 1 ? `${diffHours}h ago` : "just now";
  const isStale = diffDays >= 7;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-bold mb-4 ${isStale ? "border-orange-400 bg-orange-50 text-orange-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
      <span>⚠ {label} cached {ageLabel}{isStale ? " — STALE" : ""}</span>
      <button onClick={onRefresh} disabled={loading} className="font-black underline hover:no-underline disabled:opacity-50 cursor-pointer">
        {loading ? "..." : "↻ refresh"}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
// UUID regex: 8-4-4-4-12 hex pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CompanyDetailMagazine() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ companyId: string }>();
  const rawParam = params.companyId;
  const isUUID = UUID_RE.test(rawParam);
  const companyId = isUUID ? NaN : parseInt(rawParam, 10);

  const urlParams = new URLSearchParams(window.location.search);
  const fromParam = urlParams.get("from") || "";

  // If the URL contains a UUID instead of an integer ID, resolve it via Supabase
  const uuidResolve = trpc.companyFinder.resolveCompanyUUID.useQuery(
    { uuid: rawParam },
    { enabled: isUUID }
  );

  // Redirect to the correct integer-ID URL once resolved
  useEffect(() => {
    if (isUUID && uuidResolve.data?.localId) {
      const qp = urlParams.toString();
      navigate(`/company/${uuidResolve.data.localId}${qp ? `?${qp}` : ""}`, { replace: true });
    }
  }, [isUUID, uuidResolve.data?.localId]);

  const fromSearchId = useMemo(() => {
    const m = fromParam.match(/search\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }, [fromParam]);

  const adjacentQuery = trpc.companyFinder.getAdjacentCompany.useQuery(
    { searchId: fromSearchId!, companyId },
    { enabled: !!fromSearchId && !!companyId }
  );
  const adjacent = adjacentQuery.data;

  const goToAdjacent = (targetId: number | null | undefined) => {
    if (!targetId) return;
    navigate(`/company/${targetId}?from=${fromParam}`);
  };

  const [contactSeniorityFilter, setContactSeniorityFilter] = useState<string>("all");
  const [contactDeptFilter, setContactDeptFilter] = useState<string>("all");
  const [activeSection, setActiveSection] = useState<string>("urgency");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Brain selector — read from URL ?brainId param, default to active business unit
  const urlBrainId = useMemo(() => {
    const v = urlParams.get("brainId");
    return v ? parseInt(v, 10) : undefined;
  }, []);
  const [selectedBrainId, setSelectedBrainId] = useState<number | undefined>(urlBrainId);

  const handleBrainChange = (brainId: number) => {
    setSelectedBrainId(brainId);
    const sp = new URLSearchParams(window.location.search);
    sp.set("brainId", String(brainId));
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  };

  const { data, isLoading, refetch } = trpc.companyFinder.getCompany.useQuery(
    { companyId, brainId: selectedBrainId },
    { enabled: !!companyId && !isNaN(companyId) }
  );
  const company = data?.company ?? null;
  const niche = data?.niche ?? null;
  const rawContacts = data?.contacts ?? [];

  // Auto-poll every 5 seconds while any contact has phonePending=1
  // This ensures the UI updates as soon as Apollo delivers the phone via webhook
  const hasPendingPhone = rawContacts.some((c: any) => c.phonePending === 1 && !c.phone);
  useEffect(() => {
    if (!hasPendingPhone) return;
    const interval = setInterval(() => { refetch(); }, 5000);
    return () => clearInterval(interval);
  }, [hasPendingPhone, refetch]);

  // Track when each contact's phone request started (stored in localStorage for persistence)
  const PENDING_START_KEY = (contactId: number) => `phone_pending_start_${contactId}`;
  const [, forceElapsedUpdate] = useState(0);

  // Record start time when phonePending becomes 1
  useEffect(() => {
    rawContacts.forEach((c: any) => {
      if (c.phonePending === 1 && !c.phone) {
        const key = PENDING_START_KEY(c.id);
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, Date.now().toString());
        }
      } else {
        // Clear when resolved
        localStorage.removeItem(PENDING_START_KEY(c.id));
      }
    });
  }, [rawContacts]);

  // Tick every second to update elapsed display
  useEffect(() => {
    if (!hasPendingPhone) return;
    const tick = setInterval(() => forceElapsedUpdate(n => n + 1), 1000);
    return () => clearInterval(tick);
  }, [hasPendingPhone]);

  function getElapsedLabel(contactId: number): string {
    const key = PENDING_START_KEY(contactId);
    const startStr = localStorage.getItem(key);
    if (!startStr) return "";
    const elapsed = Math.floor((Date.now() - parseInt(startStr)) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }

  const { data: leadinfoVisit } = trpc.leadinfo.getByCompany.useQuery(
    { companyId }, { enabled: !!companyId && !isNaN(companyId) }
  );

  // ── Derived data ─────────────────────────────────────────────────────────────
  const seniorityKeywords: Record<string, RegExp> = {
    "C-Suite / VP": /\b(ceo|cto|coo|cfo|cmo|cso|cpo|chief|president|vp|vice president)\b/i,
    "Director": /\bdirector\b/i,
    "Manager": /\bmanager\b/i,
    "Head of": /\bhead of\b/i,
    "Lead / Senior": /\b(lead|senior|sr\.)\b/i,
    "Engineer / Developer": /\b(engineer|developer|dev)\b/i,
    "Consultant": /\bconsultant\b/i,
  };
  const deptKeywords: Record<string, RegExp> = {
    "Sales & BD": /\b(sales|business development|bd|account)\b/i,
    "Engineering": /\b(engineer|engineering|software|hardware|dev|developer|technical)\b/i,
    "Operations": /\b(operations|ops|supply chain|logistics|facility|office)\b/i,
    "Finance": /\b(finance|financial|cfo|accounting|controller)\b/i,
    "Marketing": /\b(marketing|cmo|brand|growth|content)\b/i,
    "HR / People": /\b(hr|human resources|people|talent|recruiting)\b/i,
    "Product": /\b(product|cpo|ux|design|ui)\b/i,
    "Strategy": /\b(strategy|strategic|cso|transformation|innovation)\b/i,
  };

  const seniorityOptions = useMemo(() => {
    const labels = Object.keys(seniorityKeywords);
    const present = new Set<string>();
    rawContacts.forEach((c: any) => {
      const title = (c.title || c.jobTitle || "");
      for (const [label, rx] of Object.entries(seniorityKeywords)) {
        if (rx.test(title)) { present.add(label); break; }
      }
    });
    return labels.filter(l => present.has(l));
  }, [rawContacts]);

  const deptOptions = useMemo(() => {
    const labels = Object.keys(deptKeywords);
    const present = new Set<string>();
    rawContacts.forEach((c: any) => {
      const title = (c.title || c.jobTitle || "");
      for (const [label, rx] of Object.entries(deptKeywords)) {
        if (rx.test(title)) { present.add(label); break; }
      }
    });
    return labels.filter(l => present.has(l));
  }, [rawContacts]);

  const contacts = useMemo(() => rawContacts.filter((c: any) => {
    const title = (c.title || c.jobTitle || "");
    const matchSeniority = contactSeniorityFilter === "all" || (() => {
      const rx = seniorityKeywords[contactSeniorityFilter];
      if (!rx) return !Object.values(seniorityKeywords).some(r => r.test(title));
      return rx.test(title);
    })();
    const matchDept = contactDeptFilter === "all" || (() => {
      const rx = deptKeywords[contactDeptFilter];
      if (!rx) return !Object.values(deptKeywords).some(r => r.test(title));
      return rx.test(title);
    })();
    return matchSeniority && matchDept;
  }), [rawContacts, contactSeniorityFilter, contactDeptFilter]);

  const briefData = useMemo(() => {
    if (!company?.briefData) return null;
    try {
      const raw = typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData;
      if (!raw) return null;
      if (!raw.productsAndServices && raw.productsServices) raw.productsAndServices = raw.productsServices;
      if (!raw.companyOverview && raw.executiveSummary) {
        const es = raw.executiveSummary;
        raw.companyOverview = [es.company, es.industry !== "Unknown" ? es.industry : null, es.revenue !== "Unknown" ? `Revenue: ${es.revenue}` : null].filter(Boolean).join(" · ");
      }
      return raw;
    } catch { return null; }
  }, [company?.briefData]);

  const salesApproach = useMemo(() => {
    if (!company?.salesApproachData) return null;
    try { return normaliseSalesApproach(typeof company.salesApproachData === "string" ? JSON.parse(company.salesApproachData) : company.salesApproachData); }
    catch { return null; }
  }, [company?.salesApproachData]);

  const location = company && company.enrichmentStatus === "enriched" && (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : company?.searchLocation || "—";

  const industryLabel = useMemo(() => {
    if (!company) return null;
    const naics = company.naicsCodes ? (() => { try { return JSON.parse(company.naicsCodes as string); } catch { return []; } })() : [];
    if (naics.length > 0) {
      const first = Array.isArray(naics[0]) ? naics[0][1] : null;
      if (first) return first;
    }
    return null;
  }, [company]);

  const growthLabel = useMemo(() => {
    if (!company?.headcountGrowth) return null;
    const g = company.headcountGrowth;
    const match12 = g.match(/12mo:\s*([+-]?[\d.]+)%/);
    if (match12) {
      const pct = parseFloat(match12[1]);
      if (pct > 15) return `Growing fast — +${pct.toFixed(0)}% headcount (12mo)`;
      if (pct > 0)  return `Stable growth — +${pct.toFixed(0)}% headcount (12mo)`;
      if (pct < 0)  return `Shrinking — ${pct.toFixed(0)}% headcount (12mo)`;
    }
    return g;
  }, [company?.headcountGrowth]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const [reResearchLoading, setReResearchLoading] = useState(false);
  const reResearchUtils = trpc.useUtils();
  const reResearchMutation = trpc.companyFinder.generateBrief.useMutation({
    onSuccess: () => { setReResearchLoading(false); reResearchUtils.companyFinder.getCompany.invalidate({ companyId }); toast.success("Research refreshed"); },
    onError: () => { setReResearchLoading(false); toast.error("Re-research failed"); },
  });

  const [reApproachLoading, setReApproachLoading] = useState(false);
  const reApproachUtils = trpc.useUtils();
  const reApproachMutation = trpc.companyFinder.generateSalesApproach.useMutation({
    onSuccess: () => { setReApproachLoading(false); reApproachUtils.companyFinder.getCompany.invalidate({ companyId }); toast.success("Approach refreshed"); },
    onError: () => { setReApproachLoading(false); toast.error("Re-approach failed"); },
  });

  // FIT score — single-company LLM scoring
  const [scoreFitLoading, setScoreFitLoading] = useState(false);
  const scoreFitUtils = trpc.useUtils();
  const scoreFitMutation = trpc.companyFinder.scoreCompanyFit.useMutation({
    onSuccess: (data: any) => {
      setScoreFitLoading(false);
      scoreFitUtils.companyFinder.getCompany.invalidate({ companyId });
      toast.success(`FIT scored: ${data?.result?.fitScore ?? '?'}/100`);
    },
    onError: (err: any) => { setScoreFitLoading(false); toast.error(`FIT scoring failed: ${err.message}`); },
  });

  // Run brain on NO OUTPUT tab
  const [runBrainLoadingId, setRunBrainLoadingId] = useState<number | null>(null);
  const runBrainUtils = trpc.useUtils();
  const runBrainBriefMutation = trpc.companyFinder.generateBrief.useMutation();
  const runBrainApproachMutation = trpc.companyFinder.generateSalesApproach.useMutation({
    onSuccess: (_, vars) => {
      setRunBrainLoadingId(null);
      runBrainUtils.companyFinder.getCompany.invalidate({ companyId });
      toast.success("Business Unit output generated!");
      handleBrainChange(vars.brainId!);
    },
    onError: () => { setRunBrainLoadingId(null); toast.error("Business Unit run failed"); },
  });
  const handleRunBrain = async (brainId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunBrainLoadingId(brainId);
    try {
      await runBrainBriefMutation.mutateAsync({ companyId, brainId, force: true });
      runBrainApproachMutation.mutate({ companyId, brainId });
    } catch {
      setRunBrainLoadingId(null);
      toast.error("Business Unit run failed");
    }
  };

  // Product images
  const [productImagesLoading, setProductImagesLoading] = useState(false);
  const productImagesUtils = trpc.useUtils();
  const { data: productImagesData } = trpc.companyFinder.getProductImages.useQuery(
    { companyId }, { enabled: !!companyId && !isNaN(companyId) }
  );
  const productImages: Array<{ imageUrl: string; thumbnailUrl: string; title: string; source: string; domain: string; link: string }> = productImagesData?.images ?? [];

  const fetchProductImages = trpc.companyFinder.fetchProductImages.useMutation({
    onSuccess: () => { setProductImagesLoading(false); productImagesUtils.companyFinder.getProductImages.invalidate({ companyId }); },
    onError: () => { setProductImagesLoading(false); toast.error("Could not fetch product images"); },
  });

  // Urgency images
  const [urgencyImagesLoading, setUrgencyImagesLoading] = useState(false);
  const urgencyImagesUtils = trpc.useUtils();
  const { data: urgencyImagesData } = trpc.companyFinder.getUrgencyImages.useQuery(
    { companyId }, { enabled: !!companyId && !isNaN(companyId) }
  );
  const urgencyImages: Array<{ imageUrl: string; thumbnailUrl: string; title: string; source: string; domain: string; link: string }> = urgencyImagesData?.images ?? [];
  const urgencyImagesFetched = urgencyImagesData !== undefined;
  const usingWebsiteFallback = urgencyImages.length > 0 && (urgencyImages[0] as any)._fallback === "website";
  const trueNewsImages = usingWebsiteFallback ? [] : urgencyImages;
  const displayImages = trueNewsImages.length > 0 ? trueNewsImages : usingWebsiteFallback ? urgencyImages : (!urgencyImagesLoading && urgencyImagesFetched ? productImages : []);

  const fetchUrgencyImagesMutation = trpc.companyFinder.fetchUrgencyImages.useMutation({
    onSuccess: () => { setUrgencyImagesLoading(false); urgencyImagesUtils.companyFinder.getUrgencyImages.invalidate({ companyId }); },
    onError: () => { setUrgencyImagesLoading(false); toast.error("Could not fetch urgency images"); },
  });

  // Auto-fetch urgency images on mount if briefData exists
  const urgencyImagesFetchedRef = useRef(false);
  useEffect(() => {
    if (briefData && !urgencyImagesLoading && urgencyImages.length === 0 && !urgencyImagesFetchedRef.current && urgencyImagesFetched) {
      urgencyImagesFetchedRef.current = true;
      setUrgencyImagesLoading(true);
      fetchUrgencyImagesMutation.mutate({ companyId });
    }
  }, [briefData, urgencyImagesFetched]);

  // Active Business Unit
  const { data: activeBrainData } = trpc.companyFinder.getActiveBrain.useQuery();
  const activeBrain = activeBrainData?.brain ?? null;

  // Rep profile
  const [repProfile, setRepProfile] = useState<string | null>(null);
  const [repProfileLoading, setRepProfileLoading] = useState(false);
  const { data: persistedRepProfile } = trpc.companyFinder.getSalesRepProfile.useQuery(
    { companyId }, { enabled: !isNaN(companyId) }
  );
  useEffect(() => {
    if (persistedRepProfile?.profile && !repProfile) setRepProfile(persistedRepProfile.profile);
  }, [persistedRepProfile]);
  const generateRepProfileMutation = trpc.companyFinder.generateSalesRepProfile.useMutation({
    onSuccess: (d) => { setRepProfile(d.profile); setRepProfileLoading(false); },
    onError: () => { toast.error("Could not generate rep profile"); setRepProfileLoading(false); },
  });

  // Feed items (NEWS section)
  const { data: feedItemsData } = trpc.companyFinder.getCompanyFeedItems.useQuery(
    { companyId, limit: 20 }, { enabled: !!companyId && !isNaN(companyId) }
  );
  const feedItems = feedItemsData?.items ?? [];

  // Signal openers
  const [signalOpeners, setSignalOpeners] = useState<Record<number, string | null>>({});
  const [signalOpenerLoading, setSignalOpenerLoading] = useState<Record<number, boolean>>({});
  const trpcClient = trpc.useUtils().client;

  const generateOpenerForSignal = async (signal: any, index: number) => {
    if (signalOpeners[index] !== undefined || signalOpenerLoading[index]) return;
    setSignalOpenerLoading(prev => ({ ...prev, [index]: true }));
    try {
      const data = await trpcClient.companyFinder.generateSignalApproach.mutate(
        { companyId, signal: { category: signal.category ?? "", type: signal.type, description: signal.description ?? "", snippet: signal.snippet, sourceUrl: signal.sourceUrl } }
      );
      setSignalOpeners(prev => ({ ...prev, [index]: data.opener }));
    } catch {
      setSignalOpeners(prev => ({ ...prev, [index]: null }));
    } finally {
      setSignalOpenerLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const signalOpenersFiredRef = useRef(false);
  useEffect(() => {
    if (briefData?.urgencySignals?.length > 0 && !signalOpenersFiredRef.current) {
      signalOpenersFiredRef.current = true;
      let cachedOpeners: Array<{ signalIndex: number; opener: string }> = [];
      try { if (company?.signalOpeners) cachedOpeners = JSON.parse(company.signalOpeners); } catch { /* ignore */ }
      briefData.urgencySignals.forEach((signal: any, index: number) => {
        const cached = cachedOpeners.find((o: any) => o.signalIndex === index);
        if (cached?.opener) setSignalOpeners(prev => ({ ...prev, [index]: cached.opener }));
        else generateOpenerForSignal(signal, index);
      });
    }
  }, [briefData]);

  // Scroll spy — update active section as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTION_ANCHORS.map(s => document.getElementById(s.id));
      const scrollY = window.scrollY + 120;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i];
        if (el && el.offsetTop <= scrollY) { setActiveSection(SECTION_ANCHORS[i].id); break; }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const copyText = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };

  const [sendingTelegram, setSendingTelegram] = useState(false);
  const sendToTelegram = trpc.telegram.sendCompanyCard.useMutation({
    onSuccess: () => {
      toast.success("Sent to Telegram ✈️", { description: `${company?.name} card delivered to your group.` });
      setSendingTelegram(false);
    },
    onError: (err) => {
      toast.error("Telegram error", { description: err.message });
      setSendingTelegram(false);
    },
  });

  const goBack = () => {
    if (fromParam === "call-today") navigate("/call-today");
    else if (fromParam.startsWith("call-today/")) navigate(`/call-today/${fromParam.replace("call-today/", "")}`);
    else if (fromParam.startsWith("search/")) navigate(`/search-results/${fromParam.replace("search/", "")}`);
    else if (fromParam === "intelligence") navigate("/intelligence");
    else if (fromParam === "sales-menu") navigate("/sales-menu");
    else navigate("/sales-menu");
  };

  if (!user) return null;

  // If UUID is being resolved, show loading state
  if (isUUID && uuidResolve.isLoading) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-2xl font-black animate-pulse">Resolving company...</div>
    </div>
  );

  // If UUID resolution failed or returned no local ID
  if (isUUID && !uuidResolve.isLoading && !uuidResolve.data?.localId) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-2xl font-black text-red-600">Could not resolve company from Intelligence link.</div>
      <p className="text-sm text-muted-foreground mt-2">The Supabase company_pages table may not have been synced yet. Try syncing from the Sync page first.</p>
      <button onClick={goBack} className="mt-4 text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer">← BACK</button>
    </div>
  );

  if (isLoading) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-2xl font-black animate-pulse">Loading company...</div>
    </div>
  );

  if (!company) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-2xl font-black text-red-600">Company not found.</div>
      <button onClick={goBack} className="mt-4 text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer">← BACK</button>
    </div>
  );

  const urgency = briefData?.urgencySignals ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 pb-24">

      {/* ── Breadcrumb / Navigation ── */}
      <div className="flex items-center justify-between gap-3 py-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-xs font-black border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer">← BACK</button>
          <a href={`/company/${companyId}/extended${window.location.search}`} className="text-xs font-black border-2 border-gray-400 text-gray-600 px-3 py-1.5 hover:bg-gray-600 hover:text-white transition-colors cursor-pointer no-underline">⚙ EXTENDED VIEW</a>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {fromParam.startsWith("search/") ? "Search Results" : fromParam === "intelligence" ? "Intelligence" : fromParam === "sales-menu" ? "Sales Menu" : fromParam === "call-today" ? "Call Today" : "Back"} / {company.name}
          </span>
        </div>
        {/* Send to Telegram */}
        {company && (
          <button
            onClick={() => {
              setSendingTelegram(true);
              const starter = briefData?.conversationStarters?.[0];
              sendToTelegram.mutate({
                companyName: company.name,
                domain: company.websiteUrl ?? undefined,
                urgencyScore: company.urgencyScore ?? undefined,
                urgencyLabel: (company.urgencyScore ?? 0) >= 70 ? "HIGH" : (company.urgencyScore ?? 0) >= 50 ? "MEDIUM" : "LOW",
                fitScore: company.fitScore ?? undefined,
                conversationStarter: starter ? safeStarterText(starter) : undefined,
                topSignalHeadline: briefData?.urgencySignals?.[0]?.headline ?? undefined,
                topSignalType: briefData?.urgencySignals?.[0]?.type ?? undefined,
                pageUrl: `/company/${companyId}`,
                brainName: company.generatedWithBrainName ?? undefined,
              });
            }}
            disabled={sendingTelegram}
            className="text-xs font-black border-2 border-blue-500 text-blue-600 px-3 py-1.5 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            {sendingTelegram ? "SENDING…" : "TELEGRAM"}
          </button>
        )}

        {fromSearchId && adjacent && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">{adjacent.position} / {adjacent.total}</span>
            <button onClick={() => goToAdjacent(adjacent?.prevId)} disabled={!adjacent?.prevId}
              className="text-xs font-black border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default">← PREV</button>
            <button onClick={() => goToAdjacent(adjacent?.nextId)} disabled={!adjacent?.nextId}
              className="text-xs font-black border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default">NEXT →</button>
          </div>
        )}
      </div>

      {/* ── COMPANY HEADER ── */}
      <div className="border-4 border-black bg-white mb-6 print:border-2">
        {/* Hero image strip */}
        {displayImages.length > 0 && (
          <div className="h-40 overflow-hidden border-b-4 border-black grid grid-cols-4 gap-0">
            {displayImages.slice(0, 4).map((img, i) => (
              <div key={i} className="relative overflow-hidden bg-gray-100 cursor-pointer" onClick={() => setLightboxImage(img.imageUrl)}>
                <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {company.enrichmentStatus === "enriched" && <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5">ENRICHED</span>}
            {company.briefData && <span className="text-[10px] font-black border border-blue-600 text-blue-600 px-1.5 py-0.5">RESEARCHED</span>}
            {(company.urgencyScore ?? 0) > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 ${(company.urgencyScore ?? 0) >= 70 ? "bg-red-600 text-white" : (company.urgencyScore ?? 0) >= 50 ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-700"}`}>
                ⚡ {company.urgencyScore}/100
              </span>
            )}
            {company.salesApproachData && <span className="text-[10px] font-black border border-green-600 text-green-600 px-1.5 py-0.5">SALES READY</span>}
            <BrainBadge generatedWithBrainId={company.generatedWithBrainId} generatedWithBrainName={company.generatedWithBrainName} activeBrainId={activeBrain?.id} activeBrainName={activeBrain?.brainName} />
          </div>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl font-black leading-tight mb-1">{company.name}</h1>
              {company.websiteUrl && (
                <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground underline">
                  {company.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
              {briefData?.companyOverview && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">{briefData.companyOverview}</p>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm shrink-0">
              <div><div className="text-[10px] font-black text-muted-foreground">LOCATION</div><div className="font-bold">{location}</div></div>
              {company.revenue && <div><div className="text-[10px] font-black text-muted-foreground">REVENUE</div><div className="font-bold">{formatRevenue(company.revenue)}</div></div>}
              {company.sliceMetadata && (() => { try { const m = JSON.parse(company.sliceMetadata as string); return m.employeeBand ? <div><div className="text-[10px] font-black text-muted-foreground">EMPLOYEES</div><div className="font-bold">{m.employeeBand}</div></div> : null; } catch { return null; } })()}
              {company.linkedinUrl && (
                <div className="col-span-2">
                  <div className="text-[10px] font-black text-muted-foreground">LINKEDIN</div>
                  <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-sm truncate block">{company.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}</a>
                </div>
              )}
            </div>
          </div>

          {/* Industry / growth tags */}
          {(industryLabel || growthLabel) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {industryLabel && <span className="bg-gray-100 px-2 py-1 font-bold">{industryLabel}</span>}
              {growthLabel && <span className={`px-2 py-1 font-bold ${growthLabel.startsWith("Growing") ? "bg-green-100 text-green-700" : growthLabel.startsWith("Shrinking") ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>{growthLabel}</span>}
            </div>
          )}

          {/* Codes */}
          {company.enrichmentStatus === "enriched" && (
            <div className="mt-3">
              <CompanyCodeDisplay sicCodes={company.sicCodes} naicsCodes={company.naicsCodes} />
            </div>
          )}
        </div>
      </div>

      {/* ── Brain Tabs ── */}
      {(() => {
        const outputBrains: any[] = data?.allBrainOutputs ?? [];
        const outputBrainIds = new Set(outputBrains.map((o: any) => o.brainId));
        const tabBrains: Array<{ brainId: number; brainName: string; fitScore: number | null; isActive: boolean }> = [
          ...outputBrains.map((o: any) => ({
            brainId: o.brainId,
            brainName: o.brainName ?? `Brain #${o.brainId}`,
            fitScore: o.fitScore ?? null,
            isActive: o.brainId === activeBrain?.id,
          })),
          ...(activeBrain && !outputBrainIds.has(activeBrain.id) ? [{
            brainId: activeBrain.id,
            brainName: activeBrain.brainName ?? activeBrain.companyName ?? `Brain #${activeBrain.id}`,
            fitScore: null,
            isActive: true,
          }] : []),
        ];
        if (tabBrains.length === 0) return null;
        return (
          <div className="flex overflow-x-auto border-b-2 border-black bg-gray-50 mb-0">
            <span className="shrink-0 flex items-center px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest border-r-2 border-black">
              BRAIN
            </span>
            {tabBrains.map((tb) => {
              const isSelected = selectedBrainId === tb.brainId;
              const hasOutput = outputBrainIds.has(tb.brainId);
              return (
                <button
                  key={tb.brainId}
                  onClick={() => handleBrainChange(tb.brainId)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-black border-r-2 border-black cursor-pointer transition-colors ${
                    isSelected ? "bg-black text-white" : "hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  <span className="truncate max-w-[140px]">{tb.brainName}</span>
                  {tb.isActive && (
                    <span className={`text-[9px] font-black px-1 py-0.5 ${
                      isSelected ? "bg-white text-black" : "bg-black text-white"
                    }`}>★</span>
                  )}
                  {hasOutput && tb.fitScore !== null && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 ${
                      isSelected ? "bg-white text-black"
                        : tb.fitScore >= 80 ? "bg-green-600 text-white"
                        : tb.fitScore >= 60 ? "bg-yellow-500 text-white"
                        : "bg-gray-400 text-white"
                    }`}>
                      FIT {tb.fitScore}
                    </span>
                  )}
                  {!hasOutput && (
                    <>
                      <span className={`text-[9px] font-black px-1 py-0.5 ${
                        isSelected ? "bg-white text-black" : "bg-gray-200 text-gray-500"
                      }`}>NO OUTPUT</span>
                      <button
                        onClick={(e) => handleRunBrain(tb.brainId, e)}
                        disabled={runBrainLoadingId === tb.brainId}
                        className={`text-[9px] font-black px-1.5 py-0.5 border transition-colors ${
                          runBrainLoadingId === tb.brainId
                            ? "border-gray-300 text-gray-400 cursor-not-allowed"
                            : isSelected
                            ? "border-white text-white hover:bg-white hover:text-black"
                            : "border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                        }`}
                      >
                        {runBrainLoadingId === tb.brainId ? "⏳" : "▶ RUN"}
                      </button>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── STICKY TWO-ZONE JUMP NAV ── */}
      <div className="sticky top-0 z-30 print:hidden">
        {/* Zone 1: BRAIN-SPECIFIC (top row — most important) */}
        <div className="bg-white border-b-4 border-black flex overflow-x-auto">
          <span className="shrink-0 flex items-center px-3 text-[9px] font-black text-red-500 uppercase tracking-widest border-r-2 border-black">
            BRAIN
          </span>
          {BRAIN_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className={`shrink-0 px-4 py-2.5 text-xs font-black border-r-2 border-black transition-colors ${activeSection === s.id ? `${s.activeBg} text-white` : `hover:bg-gray-50 ${s.color}`}`}>
              {s.label}
            </a>
          ))}
        </div>
        {/* Zone 2: GENERAL (brain-agnostic) */}
        <div className="bg-gray-50 border-b-2 border-gray-300 flex overflow-x-auto">
          <span className="shrink-0 flex items-center px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest border-r-2 border-gray-300">
            COMPANY
          </span>
          {GENERAL_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className={`shrink-0 px-4 py-2.5 text-xs font-black border-r border-gray-300 transition-colors ${activeSection === s.id ? `${s.activeBg} text-white` : `hover:bg-gray-100 ${s.color}`}`}>
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          LEADINFO WEBSITE VISITOR BLOCK (shown only when data exists)
      ════════════════════════════════════════════════════════════════════════ */}
      {leadinfoVisit && (
        <section className="mb-8">
          <div className="border-4 border-emerald-500 bg-emerald-50 p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5">WEBSITE VISITOR</span>
              <span className="text-[10px] font-black uppercase tracking-widest border border-emerald-500 text-emerald-700 px-2 py-0.5">LEADINFO</span>
            </div>
            {/* Metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ENGAGEMENT</div>
                <div className="text-3xl font-black text-emerald-600 leading-none mt-1">{leadinfoVisit.engagementScore ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">SESSIONS</div>
                <div className="text-3xl font-black leading-none mt-1">{leadinfoVisit.totalSessions ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">PAGES VIEWED</div>
                <div className="text-3xl font-black leading-none mt-1">{leadinfoVisit.totalPages ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">TIME ON SITE</div>
                <div className="text-3xl font-black leading-none mt-1">
                  {leadinfoVisit.totalDuration
                    ? leadinfoVisit.totalDuration >= 60
                      ? `${Math.floor(leadinfoVisit.totalDuration / 60)}m`
                      : `${leadinfoVisit.totalDuration}s`
                    : "—"}
                </div>
              </div>
            </div>
            {/* Intent signals */}
            {leadinfoVisit.intentSignals && (() => {
              try {
                const signals: string[] = JSON.parse(leadinfoVisit.intentSignals as string);
                if (signals.length > 0) return (
                  <div className="mb-3">
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">INTENT SIGNALS</div>
                    <div className="flex flex-wrap gap-1.5">
                      {signals.map((s, i) => (
                        <span key={i} className="text-xs font-bold border border-emerald-400 text-emerald-700 bg-white px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}
            {/* Top pages visited */}
            {leadinfoVisit.topPages && (() => {
              try {
                const pages: string[] = JSON.parse(leadinfoVisit.topPages as string);
                if (pages.length > 0) return (
                  <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">PAGES VISITED</div>
                    <div className="flex flex-wrap gap-2">
                      {pages.map((p, i) => (
                        <span key={i} className="text-xs text-gray-600 font-medium">{p}{i < pages.length - 1 ? " ·" : ""}</span>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          BRAIN-SPECIFIC SECTION 1 — URGENCY
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader id="urgency" emoji="⚡" title="URGENCY" color="border-red-600"
          action={
            <div className="flex items-center gap-2">
              {briefData && <CacheBanner cachedAt={company.briefGeneratedAt} label="Urgency" onRefresh={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId, force: true }); }} loading={reResearchLoading} />}
              {!briefData && (
                <button onClick={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId }); }} disabled={reResearchLoading}
                  className="text-xs font-black border-2 border-red-600 text-red-600 px-4 py-1.5 hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
                  {reResearchLoading ? "RESEARCHING..." : "⚡ RUN DEEP RESEARCH"}
                </button>
              )}
            </div>
          }
        />

        {!briefData ? (
          <div className="border-4 border-dashed border-gray-200 p-10 text-center">
            <p className="text-muted-foreground font-bold mb-4">No research data yet. Run Deep Research to populate this section.</p>
            <button onClick={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId }); }} disabled={reResearchLoading}
              className="text-sm font-black border-4 border-red-600 text-red-600 px-8 py-3 hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
              {reResearchLoading ? "RESEARCHING..." : "⚡ RUN DEEP RESEARCH"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score masthead */}
            <div className="border-4 border-red-600 p-6 bg-red-50">
              <div className="flex items-end justify-between flex-wrap gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-7xl font-black text-red-600 leading-none">{briefData.urgencyScore}</span>
                  <span className="text-3xl font-black text-gray-400">/100</span>
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Urgency Score</span>
                </div>
                {briefData.urgencyBreakdown && (
                  <div className="flex gap-8 text-sm">
                    <div className="text-center"><div className="text-[10px] font-black text-gray-400 tracking-widest">COMPANY</div><div className="text-2xl font-black">{briefData.urgencyBreakdown.companyContext}<span className="text-xs text-gray-400">/40</span></div></div>
                    <div className="text-center"><div className="text-[10px] font-black text-gray-400 tracking-widest">MARKET</div><div className="text-2xl font-black">{briefData.urgencyBreakdown.marketSignals}<span className="text-xs text-gray-400">/35</span></div></div>
                    <div className="text-center"><div className="text-[10px] font-black text-gray-400 tracking-widest">ACTIVITY</div><div className="text-2xl font-black">{briefData.urgencyBreakdown.recentActivity}<span className="text-xs text-gray-400">/25</span></div></div>
                  </div>
                )}
              </div>
              {briefData.urgencyLabel && (
                <div className="mt-3 text-sm font-bold text-red-700">{briefData.urgencyLabel}</div>
              )}
            </div>

            {/* Urgency signals grid */}
            {urgency.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {urgency.map((signal: any, i: number) => {
                  const sourceUrl = signal.sourceUrl ?? signal.source_url ?? signal.url ?? null;
                  const sourceDomain = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return sourceUrl; } })() : null;
                  return (
                    <div key={i} className="border-2 border-gray-200 hover:border-red-400 transition-colors p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 text-red-700 uppercase">{signal.category ?? signal.type ?? "Signal"}</span>
                        {signal.urgencyContribution && <span className="text-[10px] font-black text-muted-foreground">+{signal.urgencyContribution} pts</span>}
                      </div>
                      <p className="text-sm font-bold leading-snug">{signal.description ?? signal.headline ?? ""}</p>
                      {signal.snippet && <blockquote className="border-l-4 border-red-200 pl-3 text-xs text-muted-foreground italic line-clamp-3">{signal.snippet}</blockquote>}
                      {sourceUrl && sourceDomain && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-black hover:underline">
                          <span className="inline-block w-4 h-4 bg-gray-100 border border-gray-300 rounded-sm text-[9px] font-black text-gray-500 flex items-center justify-center">{sourceDomain.charAt(0).toUpperCase()}</span>
                          <span className="truncate max-w-[180px]">{sourceDomain}</span>
                          <span className="text-gray-400">↗</span>
                        </a>
                      )}
                      {/* Signal opener */}
                      {signalOpeners[i] !== undefined ? (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 leading-relaxed">
                          💬 {signalOpeners[i]}
                        </div>
                      ) : signalOpenerLoading[i] ? (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Generating opener...
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent developments */}
            {briefData.recentDevelopments?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Recent Developments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {briefData.recentDevelopments.map((item: any, i: number) => {
                    const headline = typeof item === "string" ? item : item.headline ?? item.title ?? item.development ?? "";
                    const snippet = typeof item !== "string" ? item.snippet ?? item.description ?? null : null;
                    const sourceUrl = typeof item !== "string" ? item.sourceUrl ?? item.url ?? null : null;
                    const date = typeof item !== "string" ? item.date ?? item.publishedAt ?? null : null;
                    const sourceDomain = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return sourceUrl; } })() : null;
                    return (
                      <div key={i} className="border-2 border-gray-200 hover:border-black transition-colors p-4">
                        <p className="font-black text-sm leading-snug mb-2">{headline}</p>
                        {snippet && <blockquote className="border-l-4 border-gray-300 pl-3 mb-3"><p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-3">{snippet}</p></blockquote>}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          {sourceUrl && sourceDomain ? (
                            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black hover:underline">
                              <span className="inline-block w-4 h-4 bg-gray-100 border border-gray-300 rounded-sm text-[9px] font-black text-gray-500 flex items-center justify-center">{sourceDomain.charAt(0).toUpperCase()}</span>
                              <span className="truncate max-w-[180px]">{sourceDomain}</span>
                              <span className="text-gray-400">↗</span>
                            </a>
                          ) : <span />}
                          {date && <span className="text-[10px] font-bold text-muted-foreground shrink-0">{date}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          BRAIN-SPECIFIC SECTION 2 — FIT
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader id="fit" emoji="🎯" title="FIT" color="border-blue-600"
          action={
            <div className="flex items-center gap-2">
              {briefData && <CacheBanner cachedAt={company?.briefGeneratedAt} label="Research" onRefresh={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId, force: true }); }} loading={reResearchLoading} />}
              <button
                onClick={() => { setScoreFitLoading(true); scoreFitMutation.mutate({ companyId }); }}
                disabled={scoreFitLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black border-2 border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Run LLM FIT scoring for this company against the active Brain"
              >
                {scoreFitLoading ? (
                  <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🎯</span>
                )}
                {company?.fitScore != null ? '↻ RESCORE FIT' : '▶ SCORE FIT'}
              </button>
            </div>
          }
        />

        {!briefData ? (
          <div className="border-4 border-dashed border-gray-200 p-10 text-center">
            <p className="text-muted-foreground font-bold">Run Deep Research first to see fit analysis.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Why this company matters */}
            {briefData.whyThisCompanyMatters && (
              <div className="border-4 border-blue-600 p-6 bg-blue-50">
                <div className="text-[10px] font-black text-blue-600 tracking-widest mb-2">WHY THIS COMPANY MATTERS</div>
                <p className="text-base font-bold leading-relaxed text-blue-900">{briefData.whyThisCompanyMatters}</p>
              </div>
            )}

            {/* Fit score + full breakdown */}
            {(company.fitScore != null || briefData.fitScore != null) && (() => {
              const displayScore = company.fitScore ?? briefData.fitScore;
              const fitData = (() => {
                try { return company.fitScoreData ? JSON.parse(company.fitScoreData as string) : null; } catch { return null; }
              })();
              const bd = fitData?.breakdown;
              const dims = bd ? [
                bd.industryFit && { label: 'INDUSTRY FIT', score: bd.industryFit.score, max: bd.industryFit.max ?? 30, rationale: bd.industryFit.rationale },
                bd.sizeFit && { label: 'SIZE / REVENUE FIT', score: bd.sizeFit.score, max: bd.sizeFit.max ?? 20, rationale: bd.sizeFit.rationale },
                bd.mustHavesFit && { label: 'MUST-HAVES FIT', score: bd.mustHavesFit.score, max: bd.mustHavesFit.max ?? 30, rationale: bd.mustHavesFit.rationale, matched: bd.mustHavesFit.matched, missing: bd.mustHavesFit.missing },
                bd.geoFit && { label: 'LOCATION FIT', score: bd.geoFit.score, max: bd.geoFit.max ?? 20, rationale: bd.geoFit.rationale, region: bd.geoFit.region, countryCode: bd.geoFit.countryCode },
                bd.buyingSignalsFit && { label: 'BUYING SIGNALS', score: bd.buyingSignalsFit.score, max: bd.buyingSignalsFit.max ?? 20, rationale: bd.buyingSignalsFit.rationale },
              ].filter(Boolean) : [];
              const geo = bd?.geographyMultiplier;
              const rawScore = fitData?.rawLlmScore;
              const nicheScore = niche?.fitScore;
              const gap = nicheScore != null && displayScore != null ? nicheScore - displayScore : null;
              return (
                <div className="border-2 border-blue-200 bg-white p-5 space-y-4">
                  {/* Header row */}
                  <div className="flex items-start gap-6">
                    <div className="shrink-0">
                      <div className="text-[10px] font-black text-muted-foreground tracking-widest">FIT SCORE</div>
                      <div className={`text-4xl font-black ${
                        displayScore >= 75 ? 'text-green-600' : displayScore >= 50 ? 'text-yellow-600' : 'text-red-500'
                      }`}>{displayScore}<span className="text-lg text-gray-400">/100</span></div>
                      {rawScore != null && rawScore !== displayScore && (
                        <div className="text-[10px] text-gray-400 mt-0.5">LLM raw: {rawScore}</div>
                      )}
                      <div className="text-[9px] text-gray-400 mt-0.5">Industry + Size + Must-haves + Location + Signals</div>
                    </div>
                    {/* FIT-SIM similarity score */}
                    {(company as any).similarityScore != null && (
                      <div className="shrink-0">
                        <div className="text-[10px] font-black text-muted-foreground tracking-widest">FIT-SIM</div>
                        <div className={`text-4xl font-black ${
                          (company as any).similarityScore >= 75 ? 'text-green-600'
                          : (company as any).similarityScore >= 50 ? 'text-yellow-600'
                          : 'text-red-500'
                        }`}>{(company as any).similarityScore}<span className="text-lg text-gray-400">/100</span></div>
                        <div className="text-[10px] text-gray-400 mt-0.5">vector similarity</div>
                      </div>
                    )}
                    {briefData.fitLabel && (
                      <div className="flex-1">
                        <div className="text-[10px] font-black text-muted-foreground tracking-widest mb-1">VERDICT</div>
                        <div className="text-sm font-bold text-blue-800">{briefData.fitLabel}</div>
                      </div>
                    )}
                    {gap != null && Math.abs(gap) >= 5 && (
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-black text-muted-foreground tracking-widest">VS NICHE</div>
                        <div className={`text-lg font-black ${gap > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                          {gap > 0 ? `−${gap}` : `+${Math.abs(gap)}`}
                        </div>
                        <div className="text-[9px] text-gray-400">{gap > 0 ? 'below niche avg' : 'above niche avg'}</div>
                      </div>
                    )}
                  </div>
                  {/* Overall rationale */}
                  {fitData?.overallRationale && (
                    <p className="text-xs text-gray-700 leading-relaxed border-l-2 border-blue-300 pl-3">{fitData.overallRationale}</p>
                  )}
                  {/* Dimension breakdown */}
                  {dims.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {dims.map((dim: any, i: number) => {
                        const pct = Math.round((dim.score / dim.max) * 100);
                        return (
                          <div key={i}>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wide text-gray-600">{dim.label}</span>
                              <span className="text-[10px] font-black text-gray-700">{dim.score}/{dim.max}</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${
                                pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                              }`} style={{ width: `${pct}%` }} />
                            </div>
                            {dim.rationale && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{dim.rationale}</p>}
                            {dim.matched?.length > 0 && (
                              <p className="text-[10px] text-green-600 mt-0.5">✓ {dim.matched.join(' · ')}</p>
                            )}
                            {dim.missing?.length > 0 && (
                              <p className="text-[10px] text-red-500 mt-0.5">✗ Missing: {dim.missing.join(', ')}</p>
                            )}
                            {dim.region && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{dim.region}{dim.countryCode ? ` (${dim.countryCode})` : ''}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Disqualifiers */}
                  {bd?.disqualifiers?.triggered && bd.disqualifiers.reasons?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 p-3">
                      <div className="text-[10px] font-black text-red-600 tracking-widest mb-1">DISQUALIFIERS TRIGGERED — SCORE CAPPED AT 25</div>
                      {bd.disqualifiers.reasons.map((r: string, i: number) => (
                        <p key={i} className="text-xs text-red-700">• {r}</p>
                      ))}
                    </div>
                  )}
                  {/* Gap analysis */}
                  {gap != null && Math.abs(gap) >= 5 && (
                    <div className="bg-orange-50 border border-orange-200 p-3">
                      <div className="text-[10px] font-black text-orange-600 tracking-widest mb-1">GAP ANALYSIS — WHY {gap > 0 ? `${gap} POINTS BELOW` : `${Math.abs(gap)} POINTS ABOVE`} NICHE AVERAGE</div>
                      <p className="text-xs text-orange-800 leading-relaxed">
                        {gap > 0
                          ? `The niche "${niche?.name}" scores ${nicheScore}/100 as a cluster, but this specific company scores ${displayScore}/100. The gap is likely driven by ${
                              bd?.disqualifiers?.triggered ? 'a triggered disqualifier' :
                              bd?.sizeFit?.score < (bd?.sizeFit?.max ?? 20) * 0.5 ? 'a size/revenue mismatch' :
                              bd?.mustHavesFit?.missing?.length > 0 ? `missing must-haves: ${bd.mustHavesFit.missing.slice(0,2).join(', ')}` :
                              bd?.geoFit?.score < (bd?.geoFit?.max ?? 20) * 0.5 ? `low location fit (${bd.geoFit.region ?? 'unknown region'}, ${bd.geoFit.score}/${bd.geoFit.max ?? 20})` :
                              'lower scores on individual dimensions compared to the niche archetype'
                            }.`
                          : `This company outperforms its niche average by ${Math.abs(gap)} points — it is an above-average representative of the "${niche?.name}" cluster.`
                        }
                      </p>
                    </div>
                  )}
                  {/* Score formula note */}
                  <div className="text-[9px] text-gray-400 border-t border-gray-100 pt-2">
                    Formula: Industry (30) + Size (20) + Must-haves (30) + Location (20) + Signals (20) = 120 max, normalised to 100
                  </div>
                </div>
              );
            })()}

            {/* Niche Context Panel */}
            {niche && niche.fitScore != null && (() => {
              let breakdown: Array<{ dimension: string; score: number; maxScore: number; reasoning: string }> = [];
              try { breakdown = JSON.parse(niche.scoreBreakdown ?? '[]'); } catch {}
              return (
                <div className="border-2 border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="shrink-0">
                      <div className="text-[10px] font-black text-muted-foreground tracking-widest">NICHE FIT</div>
                      <div className={`text-3xl font-black ${
                        niche.fitScore >= 75 ? 'text-green-600' :
                        niche.fitScore >= 50 ? 'text-yellow-600' : 'text-red-500'
                      }`}>{niche.fitScore}<span className="text-base text-gray-400">/100</span></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black text-muted-foreground tracking-widest mb-1">NICHE</div>
                      <div className="text-sm font-bold text-gray-900 leading-snug">{niche.name}</div>
                    </div>
                  </div>
                  {niche.fitReasoning && (
                    <p className="text-xs text-gray-700 leading-relaxed mb-4 border-l-2 border-gray-300 pl-3">{niche.fitReasoning}</p>
                  )}
                  {breakdown.length > 0 && (
                    <div className="space-y-3">
                      {breakdown.map((dim: any, i: number) => {
                        const pct = Math.round(((dim.score ?? 0) / (dim.maxScore ?? 1)) * 100);
                        return (
                          <div key={i}>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wide text-gray-600">{dim.dimension}</span>
                              <span className="text-[10px] font-black text-gray-700">{dim.score}/{dim.maxScore}</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {dim.reasoning && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{dim.reasoning}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Products & Services */}
            {briefData.productsAndServices?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Products & Services</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {briefData.productsAndServices.map((p: any, i: number) => (
                    <div key={i} className="p-4 border-2 border-gray-200 hover:border-blue-400 transition-colors">
                      <div className="font-black text-sm mb-1">{typeof p === "string" ? p : p.name ?? p.product ?? ""}</div>
                      {typeof p !== "string" && p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      {typeof p !== "string" && p.category && <div className="text-[10px] font-black text-muted-foreground mt-1 uppercase">{p.category}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Technologies */}
            {briefData.keyTechnologies?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Key Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {briefData.keyTechnologies.map((t: any, i: number) => (
                    <span key={i} className="text-sm font-bold border-2 border-black px-3 py-1.5 bg-gray-50">
                      {typeof t === "string" ? t : t.name ?? t.technology ?? ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Target Markets */}
            {briefData.targetMarkets?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Target Markets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {briefData.targetMarkets.map((m: any, i: number) => (
                    <div key={i} className="p-4 border-2 border-gray-200">
                      <div className="font-black text-sm mb-1">{typeof m === "string" ? m : m.market ?? m.segment ?? m.name ?? ""}</div>
                      {typeof m !== "string" && m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOM Calculator CTA */}
            <div className="border-4 border-amber-400 bg-amber-50 p-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black text-amber-700 tracking-widest mb-1">🧮 BOM + CAPABILITY STATEMENT</div>
                <p className="text-sm font-bold text-amber-900">From product images to a full bill of materials — know exactly what you can supply and quote it on the spot.</p>
              </div>
              <a
                href={`/company/${companyId}/extended${window.location.search}#bom`}
                className="shrink-0 text-xs font-black border-2 border-amber-700 text-amber-800 px-4 py-2 hover:bg-amber-700 hover:text-white transition-colors no-underline"
              >
                OPEN BOM →
              </a>
            </div>

            {/* Sources */}
            {briefData.sources?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Sources ({briefData.sources.length})</h3>
                <div className="space-y-2">
                  {briefData.sources.map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 border border-gray-200 hover:border-black transition-colors">
                      <span className="text-xs font-black text-muted-foreground shrink-0">[{i + 1}]</span>
                      <div className="flex-1 min-w-0">
                        {(s.url || s.sourceUrl) ? (
                          <a href={s.url || s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 underline truncate block">{s.title || s.url || s.sourceUrl}</a>
                        ) : <div className="text-sm font-bold">{s.title || String(s)}</div>}
                        {s.snippet && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.snippet}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          BRAIN-SPECIFIC SECTION 3 — APPROACH
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader id="approach" emoji="💬" title="APPROACH" color="border-green-600"
          action={
            <div className="flex items-center gap-2">
              {salesApproach && <CacheBanner cachedAt={company.salesApproachGeneratedAt} label="Approach" onRefresh={() => { setReApproachLoading(true); reApproachMutation.mutate({ companyId }); }} loading={reApproachLoading} />}
              {!salesApproach && company.briefData && (
                <button onClick={() => { setReApproachLoading(true); reApproachMutation.mutate({ companyId }); }} disabled={reApproachLoading}
                  className="text-xs font-black border-2 border-green-600 text-green-600 px-4 py-1.5 hover:bg-green-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
                  {reApproachLoading ? "GENERATING..." : "💬 CREATE SALES APPROACH"}
                </button>
              )}
            </div>
          }
        />

        {/* Right Sales Rep */}
        <div className="mb-6 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-slate-50 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div>
              <div className="text-[10px] font-black tracking-[0.15em] uppercase text-indigo-400">RIGHT SALES REP</div>
              <div className="text-xs font-bold text-slate-700">Decision-Maker Match</div>
            </div>
            {!repProfile ? (
              <button onClick={() => { setRepProfileLoading(true); generateRepProfileMutation.mutate({ companyId }); }} disabled={repProfileLoading}
                className="flex items-center gap-2 rounded-md bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer">
                {repProfileLoading ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full" /> ANALYSING...</> : "FIND BEST SALES REP"}
              </button>
            ) : (
              <button onClick={() => { setRepProfile(null); setRepProfileLoading(true); generateRepProfileMutation.mutate({ companyId }); }} disabled={repProfileLoading}
                className="text-[10px] font-bold text-indigo-400 border border-indigo-200 rounded px-2 py-1 hover:border-indigo-500 hover:text-indigo-600 transition-colors disabled:opacity-40 cursor-pointer">
                {repProfileLoading ? "..." : "↺ REFRESH"}
              </button>
            )}
          </div>
          {repProfileLoading && !repProfile && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Analysing company profile and offering fit...
            </div>
          )}
          {repProfile && <p className="text-sm leading-relaxed text-slate-700">{repProfile}</p>}
        </div>

        {!salesApproach ? (
          <div className="border-4 border-dashed border-gray-200 p-10 text-center">
            <p className="text-muted-foreground font-bold">
              {company.briefData ? "Research is ready — generate your personalised sales approach." : "Run Deep Research first, then generate the sales approach."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Conversation Starters */}
            {salesApproach.conversationStarters?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1">Conversation Starters</h3>
                <div className="space-y-3">
                  {salesApproach.conversationStarters.map((s: any, i: number) => (
                    <div key={i} className="p-4 bg-amber-50 border-2 border-amber-200">
                      <p className="text-sm font-medium">{safeStarterText(s)}</p>
                      {typeof s !== "string" && s.basedOn && <p className="text-xs text-muted-foreground mt-1">Based on: {s.basedOn}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Draft */}
            {salesApproach.emailDraft && (
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-green-700">Email Draft</h3>
                  <button onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                    className="text-xs font-black border-2 border-green-600 text-green-600 px-3 py-1 cursor-pointer hover:bg-green-600 hover:text-white transition-colors">COPY EMAIL</button>
                </div>
                <div className="p-5 border-4 border-green-600 bg-green-50">
                  <div className="mb-3 p-2 bg-white border border-green-200">
                    <span className="text-xs font-black text-muted-foreground">SUBJECT: </span>
                    <span className="text-sm font-bold">{salesApproach.emailDraft.subject}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm bg-white p-3 border border-green-200">{stripGrokCitations(salesApproach.emailDraft.body)}</div>
                </div>
              </div>
            )}

            {/* LinkedIn Message */}
            {salesApproach.linkedinMessage && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 border-b border-gray-200 pb-1 text-blue-700">LinkedIn Message</h3>
                <div className="p-5 border-4 border-blue-600 bg-blue-50 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black">CONNECTION REQUEST</span>
                      <button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">COPY</button>
                    </div>
                    <div className="text-sm bg-white p-3 border border-blue-200">{stripGrokCitations(salesApproach.linkedinMessage.connectionRequest)}</div>
                  </div>
                  {salesApproach.linkedinMessage.followUp && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black">FOLLOW-UP</span>
                        <button onClick={() => copyText(salesApproach.linkedinMessage.followUp, "Follow-up")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">COPY</button>
                      </div>
                      <div className="text-sm bg-white p-3 border border-blue-200">{stripGrokCitations(salesApproach.linkedinMessage.followUp)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Call Script */}
            {salesApproach.callScript && (
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-purple-700">Call Script</h3>
                  <button onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening || "", "Call Script")}
                    className="text-xs font-black border-2 border-purple-600 text-purple-600 px-3 py-1 cursor-pointer hover:bg-purple-600 hover:text-white transition-colors">COPY SCRIPT</button>
                </div>
                <div className="p-5 border-4 border-purple-600 bg-purple-50 space-y-3">
                  {salesApproach.callScript.opening && <div><div className="text-xs font-black mb-1">OPENING</div><div className="text-sm bg-white p-3 border border-purple-200">{stripGrokCitations(salesApproach.callScript.opening)}</div></div>}
                  {salesApproach.callScript.valueProposition && <div><div className="text-xs font-black mb-1">VALUE PROPOSITION</div><div className="text-sm bg-white p-3 border border-purple-200">{stripGrokCitations(salesApproach.callScript.valueProposition)}</div></div>}
                  {salesApproach.callScript.fullScript && <div><div className="text-xs font-black mb-1">FULL SCRIPT</div><div className="whitespace-pre-wrap text-sm bg-white p-4 border border-purple-200">{stripGrokCitations(salesApproach.callScript.fullScript)}</div></div>}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          ██ ZONE DIVIDER — General Company Data (brain-agnostic)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="relative my-4 print:hidden">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t-4 border-gray-300" /></div>
        <div className="relative flex justify-center">
          <span className="bg-white px-6 py-1.5 text-[11px] font-black tracking-[0.2em] text-gray-400 uppercase border-2 border-gray-300">
            🏢 COMPANY DATA — Same for all business units
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          GENERAL SECTION — CONTACTS
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader id="contacts" emoji="👤" title={`CONTACTS (${rawContacts.length})`} color="border-purple-600" />

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap mb-5">
          <CompanyDetailFindDecisionMakersButton companyId={company.id} companyName={company.name} onDone={() => refetch()} />
          <CompanyDetailGetAllPersonnelButton companyId={company.id} companyName={company.name} onDone={() => refetch()} />
        </div>

        {/* Filters */}
        {rawContacts.length > 0 && (
          <div className="flex items-center gap-3 mb-5 flex-wrap border-2 border-gray-200 p-3 bg-gray-50">
            <span className="text-[10px] font-black text-muted-foreground shrink-0">FILTER:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black">SENIORITY</span>
              {["all", ...seniorityOptions].map((opt) => (
                <button key={opt} onClick={() => setContactSeniorityFilter(opt)}
                  className={`text-[10px] font-black px-2 py-0.5 border transition-colors cursor-pointer ${contactSeniorityFilter === opt ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 hover:border-purple-400 hover:text-purple-600"}`}>
                  {opt === "all" ? "ALL" : opt}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-gray-300 shrink-0 hidden md:block" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black">DEPT</span>
              {["all", ...deptOptions].map((opt) => (
                <button key={opt} onClick={() => setContactDeptFilter(opt)}
                  className={`text-[10px] font-black px-2 py-0.5 border transition-colors cursor-pointer ${contactDeptFilter === opt ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:border-blue-400 hover:text-blue-600"}`}>
                  {opt === "all" ? "ALL" : opt}
                </button>
              ))}
            </div>
            {(contactSeniorityFilter !== "all" || contactDeptFilter !== "all") && (
              <button onClick={() => { setContactSeniorityFilter("all"); setContactDeptFilter("all"); }}
                className="text-[10px] font-black text-red-600 border border-red-300 px-2 py-0.5 hover:bg-red-50 transition-colors cursor-pointer ml-auto shrink-0">✕ CLEAR</button>
            )}
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="text-center py-16 border-4 border-dashed border-gray-300">
            <div className="text-lg font-black text-muted-foreground mb-2">No contacts yet</div>
            <div className="text-sm font-bold text-muted-foreground">Use the buttons above to find decision-makers or all personnel.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map((c: any, i: number) => (
                <div key={i} className="p-4 border-2 border-gray-200 hover:border-purple-400 transition-colors">
                  <div className="font-black text-base mb-0.5">{c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}</div>
                  <div className="text-sm font-bold text-muted-foreground mb-2">{c.title || c.jobTitle || "—"}</div>
                  {c.email && <a href={`mailto:${c.email}`} className="text-sm text-blue-600 underline font-bold block">{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="text-sm text-green-600 underline font-bold block">{c.phone}</a>}
                  {c.phonePending === 1 && !c.phone && (
                    <div className="text-xs text-amber-600 font-bold mt-1 flex items-center gap-1">
                      <span className="animate-spin inline-block">⏳</span>
                      Phone pending via webhook...
                      {getElapsedLabel(c.id) && (
                        <span className="text-amber-500 font-mono">({getElapsedLabel(c.id)})</span>
                      )}
                    </div>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline block mt-1">
                      {c.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                  {!c.email && <CompanyDetailEnrichButton contactId={c.id} companyId={company.id} onDone={() => refetch()} />}
                  {!c.phone && c.phonePending !== 1 && <CompanyDetailGetPhoneButton contactId={c.id} companyId={company.id} onDone={() => refetch()} />}
                </div>
              ))}
            </div>
            <CompanyDetailGetAllPhonesButton contacts={contacts} companyId={company.id} onDone={() => refetch()} />
          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          GENERAL SECTION — MEDIA (Product Pictures)
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionHeader id="media" emoji="🖼" title="MEDIA" color="border-gray-600"
          action={
            <button onClick={() => { setProductImagesLoading(true); fetchProductImages.mutate({ companyId }); }} disabled={productImagesLoading}
              className="text-xs font-black border-2 border-gray-600 text-gray-600 px-4 py-1.5 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
              {productImagesLoading ? "FETCHING..." : productImages.length > 0 ? "↻ REFRESH" : "FETCH IMAGES"}
            </button>
          }
        />

        {productImages.length === 0 ? (
          <div className="border-4 border-dashed border-gray-200 p-10 text-center">
            <p className="text-muted-foreground font-bold text-sm">No product images yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "FETCH IMAGES" to pull product visuals from the web.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {productImages.map((img, i) => (
              <div key={i} className="border-2 border-gray-200 hover:border-black transition-colors overflow-hidden group cursor-pointer"
                onClick={() => setLightboxImage(img.imageUrl)}>
                <div className="aspect-video bg-gray-50 overflow-hidden">
                  <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                </div>
                {img.title && <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground truncate">{img.title}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Lightbox ── */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Product image" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white font-black text-2xl hover:text-gray-300" onClick={() => setLightboxImage(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Inline action buttons ─────────────────────────────────────────────────────
function CompanyDetailFindDecisionMakersButton({ companyId, companyName, onDone }: { companyId: number; companyName: string; onDone: () => void }) {
  const findCSuiteMutation = trpc.companyFinder.findAllCSuite.useMutation({
    onSuccess: (data) => { toast.success(`Found ${data.contacts.length} decision-makers at ${companyName}`); onDone(); },
    onError: (error) => toast.error(`Search failed: ${error.message}`),
  });
  return (
    <button onClick={() => findCSuiteMutation.mutate({ companyId })} disabled={findCSuiteMutation.isPending}
      className="font-black border-4 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
      {findCSuiteMutation.isPending ? "SEARCHING..." : "👤 FIND DECISION-MAKERS"}
    </button>
  );
}

function CompanyDetailGetAllPersonnelButton({ companyId, companyName, onDone }: { companyId: number; companyName: string; onDone: () => void }) {
  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => { toast.success(`Found ${data.contacts.length} personnel at ${companyName}`); onDone(); },
    onError: (error) => toast.error(`Search failed: ${error.message}`),
  });
  return (
    <button onClick={() => getAllPersonnelMutation.mutate({ companyId, limit: 25 })} disabled={getAllPersonnelMutation.isPending}
      className="font-black border-4 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default">
      {getAllPersonnelMutation.isPending ? "FETCHING..." : "🏢 GET ALL PERSONNEL"}
    </button>
  );
}

function CompanyDetailEnrichButton({ contactId, companyId, onDone }: { contactId: number; companyId: number; onDone: () => void }) {
  const enrichMutation = trpc.companyFinder.enrichContact.useMutation({
    onSuccess: () => { toast.success("Contact enriched!"); onDone(); },
    onError: (error) => toast.error(`Enrichment failed: ${error.message}`),
  });
  return (
    <Button size="sm" variant="outline" onClick={() => enrichMutation.mutate({ contactId })} disabled={enrichMutation.isPending}
      className="text-xs font-black border-2 border-purple-600 text-purple-600 mt-2 cursor-pointer w-full">
      {enrichMutation.isPending ? "..." : "GET EMAIL"}
    </Button>
  );
}

function CompanyDetailGetPhoneButton({ contactId, companyId, onDone }: { contactId: number; companyId: number; onDone: () => void }) {
  const phoneMutation = trpc.companyFinder.enrichContact.useMutation({
    onSuccess: (data) => {
      if (data.phonePending) {
        toast.info("Phone request sent — Apollo will deliver it via webhook shortly.");
      } else {
        toast.success("Phone number retrieved!");
      }
      onDone();
    },
    onError: (error) => toast.error(`Phone lookup failed: ${error.message}`),
  });
  return (
    <Button size="sm" variant="outline" onClick={() => phoneMutation.mutate({ contactId, includePhone: true })} disabled={phoneMutation.isPending}
      className="text-xs font-black border-2 border-green-600 text-green-600 mt-2 cursor-pointer w-full">
      {phoneMutation.isPending ? "..." : "GET PHONE"}
    </Button>
  );
}

function CompanyDetailGetAllPhonesButton({ contacts, companyId, onDone }: { contacts: any[]; companyId: number; onDone: () => void }) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const enrichMutation = trpc.companyFinder.enrichContact.useMutation();

  const missing = contacts.filter((c: any) => !c.phone);
  if (missing.length === 0) return null;

  async function handleClick() {
    setProgress({ done: 0, total: missing.length });
    for (let i = 0; i < missing.length; i++) {
      try {
        await enrichMutation.mutateAsync({ contactId: missing[i].id, includePhone: true });
      } catch {
        // skip failed contacts and continue
      }
      setProgress({ done: i + 1, total: missing.length });
    }
    setProgress(null);
    toast.success(`Phone enrichment done for ${missing.length} contact${missing.length !== 1 ? "s" : ""}`);
    onDone();
  }

  return (
    <button
      onClick={handleClick}
      disabled={progress !== null}
      className="font-black border-4 border-green-600 text-green-600 hover:bg-green-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default mt-4 w-full"
    >
      {progress
        ? `📞 FETCHING PHONES... (${progress.done} / ${progress.total})`
        : `📞 GET ALL PHONES (${missing.length})`}
    </button>
  );
}
