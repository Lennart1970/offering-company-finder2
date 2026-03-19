import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import CompanyCodeDisplay from "@/components/CompanyCodeDisplay";
import { Button } from "@/components/ui/button";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatRevenue(revenue: number | string | null): string {
  if (!revenue) return "—";
  const num = typeof revenue === "string" ? parseFloat(revenue) : revenue;
  if (isNaN(num)) return String(revenue);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

type Chapter = "overview" | "urgency" | "research" | "approach" | "contacts";
type ResearchSub = "recent-developments" | "products-services" | "key-technologies" | "target-markets" | "sources" | "product-images";
type ApproachSub = "conversation-starters" | "email-draft" | "linkedin-message" | "call-script";

const CHAPTERS: { id: Chapter; label: string; color: string; activeColor: string }[] = [
  { id: "overview",  label: "OVERVIEW",         color: "border-black text-black",           activeColor: "bg-black text-white border-black" },
  { id: "urgency",   label: "⚡ INTEL",          color: "border-red-600 text-red-600",        activeColor: "bg-red-600 text-white border-red-600" },
  { id: "research",  label: "🔬 RESEARCH",       color: "border-blue-600 text-blue-600",      activeColor: "bg-blue-600 text-white border-blue-600" },
  { id: "approach",  label: "💬 APPROACH",       color: "border-green-600 text-green-600",    activeColor: "bg-green-600 text-white border-green-600" },
  { id: "contacts",  label: "👤 CONTACTS",       color: "border-purple-600 text-purple-600",  activeColor: "bg-purple-600 text-white border-purple-600" },
];

const RESEARCH_SUBS: { id: ResearchSub; label: string }[] = [
  { id: "recent-developments", label: "Recent Developments" },
  { id: "products-services",   label: "Products & Services" },
  { id: "key-technologies",    label: "Key Technologies" },
  { id: "target-markets",      label: "Target Markets" },
  { id: "product-images",      label: "Product Images" },
  { id: "sources",             label: "Sources" },
];

const APPROACH_SUBS: { id: ApproachSub; label: string }[] = [
  { id: "conversation-starters", label: "Conversation Starters" },
  { id: "email-draft",           label: "Email Draft" },
  { id: "linkedin-message",      label: "LinkedIn Message" },
  { id: "call-script",           label: "Call Script" },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function CompanyDetail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ companyId: string }>();
  const companyId = parseInt(params.companyId, 10);

  // Parse ?chapter=, ?from= from URL (queue is now server-side)
  const urlParams = new URLSearchParams(window.location.search);
  const initialChapter = (urlParams.get("chapter") as Chapter) || "overview";
  const fromParam = urlParams.get("from") || "";

  // Extract searchId from fromParam (e.g. "search/1260001")
  const fromSearchId = useMemo(() => {
    const m = fromParam.match(/search\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }, [fromParam]);

  // Server-side adjacent company lookup — replaces URL queue
  const adjacentQuery = trpc.companyFinder.getAdjacentCompany.useQuery(
    { searchId: fromSearchId!, companyId },
    { enabled: !!fromSearchId && !!companyId }
  );
  const adjacent = adjacentQuery.data;

  const hasPrev = !!(adjacent?.prevId);
  const hasNext = !!(adjacent?.nextId);

  const goToAdjacent = (targetId: number | null | undefined) => {
    if (!targetId) return;
    const chParam = chapter !== "overview" ? `&chapter=${chapter}` : "";
    navigate(`/company/${targetId}?from=${fromParam}${chParam}`);
  };

  const [chapter, setChapter] = useState<Chapter>(initialChapter);
  const [researchSub, setResearchSub] = useState<ResearchSub>("recent-developments");
  const [approachSub, setApproachSub] = useState<ApproachSub>("conversation-starters");
  const [contactSeniorityFilter, setContactSeniorityFilter] = useState<string>("all");
  const [contactDeptFilter, setContactDeptFilter] = useState<string>("all");

  const { data, isLoading, refetch } = trpc.companyFinder.getCompany.useQuery(
    { companyId },
    { enabled: !!companyId && !isNaN(companyId) }
  );

  const company = data?.company ?? null;
  const rawContacts = data?.contacts ?? [];

  // Derive unique seniority and department values from contact titles
  const seniorityOptions = useMemo(() => {
    const keywords = [
      { label: "C-Suite / VP", match: /\b(ceo|cto|coo|cfo|cmo|cso|cpo|chief|president|vp|vice president)\b/i },
      { label: "Director", match: /\bdirector\b/i },
      { label: "Manager", match: /\bmanager\b/i },
      { label: "Head of", match: /\bhead of\b/i },
      { label: "Lead / Senior", match: /\b(lead|senior|sr\.)\b/i },
      { label: "Engineer / Developer", match: /\b(engineer|developer|dev)\b/i },
      { label: "Consultant", match: /\bconsultant\b/i },
      { label: "Other", match: null },
    ];
    const present = new Set<string>();
    rawContacts.forEach((c: any) => {
      const title = (c.title || c.jobTitle || "").toLowerCase();
      let matched = false;
      for (const k of keywords) {
        if (k.match && k.match.test(title)) { present.add(k.label); matched = true; break; }
      }
      if (!matched) present.add("Other");
    });
    return keywords.map(k => k.label).filter(l => present.has(l));
  }, [rawContacts]);

  const deptOptions = useMemo(() => {
    const keywords = [
      { label: "Sales & BD", match: /\b(sales|business development|bd|account)\b/i },
      { label: "Engineering", match: /\b(engineer|engineering|software|hardware|dev|developer|technical)\b/i },
      { label: "Operations", match: /\b(operations|ops|supply chain|logistics|facility|office)\b/i },
      { label: "Finance", match: /\b(finance|financial|cfo|accounting|controller)\b/i },
      { label: "Marketing", match: /\b(marketing|cmo|brand|growth|content)\b/i },
      { label: "HR / People", match: /\b(hr|human resources|people|talent|recruiting)\b/i },
      { label: "Product", match: /\b(product|cpo|ux|design|ui)\b/i },
      { label: "Strategy", match: /\b(strategy|strategic|cso|transformation|innovation)\b/i },
      { label: "Other", match: null },
    ];
    const present = new Set<string>();
    rawContacts.forEach((c: any) => {
      const title = (c.title || c.jobTitle || "").toLowerCase();
      let matched = false;
      for (const k of keywords) {
        if (k.match && k.match.test(title)) { present.add(k.label); matched = true; break; }
      }
      if (!matched) present.add("Other");
    });
    return keywords.map(k => k.label).filter(l => present.has(l));
  }, [rawContacts]);

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

  const contacts = useMemo(() => {
    return rawContacts.filter((c: any) => {
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
    });
  }, [rawContacts, contactSeniorityFilter, contactDeptFilter]);

  const briefData = useMemo(() => {
    if (!company?.briefData) return null;
    try {
      const raw = typeof company.briefData === "string" ? JSON.parse(company.briefData) : company.briefData;
      if (!raw) return null;
      // Normalise: brief generator uses productsServices, UI expects productsAndServices
      if (!raw.productsAndServices && raw.productsServices) {
        raw.productsAndServices = raw.productsServices;
      }
      // Normalise: derive companyOverview from executiveSummary if missing
      if (!raw.companyOverview && raw.executiveSummary) {
        const es = raw.executiveSummary;
        raw.companyOverview = [es.company, es.industry !== 'Unknown' ? es.industry : null, es.revenue !== 'Unknown' ? `Revenue: ${es.revenue}` : null].filter(Boolean).join(' · ');
      }
      return raw;
    }
    catch { return null; }
  }, [company?.briefData]);

  const salesApproach = useMemo(() => {
    if (!company?.salesApproachData) return null;
    try { return typeof company.salesApproachData === "string" ? JSON.parse(company.salesApproachData) : company.salesApproachData; }
    catch { return null; }
  }, [company?.salesApproachData]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // Call readiness + outcomes
  const [callReadinessLoading, setCallReadinessLoading] = useState(false);
  const [callReadinessSummary, setCallReadinessSummary] = useState<string | null>(company?.callReadinessSummary ?? null);
  const [outcomeSelected, setOutcomeSelected] = useState<string | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [outcomeSaved, setOutcomeSaved] = useState(false);

  const generateReadiness = trpc.companyFinder.generateCallReadiness.useMutation({
    onSuccess: (d) => { setCallReadinessSummary(d.summary); setCallReadinessLoading(false); },
    onError: () => { setCallReadinessLoading(false); toast.error("Could not generate summary"); },
  });

  const outcomesUtils = trpc.useUtils();

  const logOutcome = trpc.companyFinder.logCallOutcome.useMutation({
    onSuccess: () => {
      setOutcomeSaved(true);
      setOutcomeNotes("");
      setFollowUpDate("");
      setOutcomeSelected(null);
      toast.success("Outcome saved");
      outcomesUtils.companyFinder.getCallOutcomes.invalidate({ companyId });
    },
    onError: () => toast.error("Failed to save outcome"),
  });

  const { data: outcomesData } = trpc.companyFinder.getCallOutcomes.useQuery(
    { companyId },
    { enabled: !!companyId && !isNaN(companyId) }
  );
  const lastOutcome = outcomesData?.outcomes?.[0] ?? null;

  const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
    reached:         { label: "✅ Reached",         color: "bg-green-600 text-white border-green-600" },
    voicemail:       { label: "📱 Voicemail",       color: "bg-yellow-500 text-white border-yellow-500" },
    no_answer:       { label: "📵 No Answer",        color: "bg-gray-500 text-white border-gray-500" },
    meeting_booked:  { label: "📅 Meeting Booked",  color: "bg-blue-600 text-white border-blue-600" },
    not_interested:  { label: "❌ Not Interested",  color: "bg-red-600 text-white border-red-600" },
  };

  const NEXT_ACTION: Record<string, string> = {
    reached:        "Follow up with a personalised email summarising your conversation.",
    voicemail:      "Send a LinkedIn message referencing your voicemail — today.",
    no_answer:      "Try again tomorrow at a different time, then send an email.",
    meeting_booked: "Prepare a tailored demo using the Research and Approach chapters.",
    not_interested: "Park this company and revisit in 90 days with a new angle.",
  };

  // Re-research mutation (force-regenerate brief)
  const [reResearchLoading, setReResearchLoading] = useState(false);
  const reResearchUtils = trpc.useUtils();
  const reResearchMutation = trpc.companyFinder.generateBrief.useMutation({
    onSuccess: () => { setReResearchLoading(false); reResearchUtils.companyFinder.getCompany.invalidate({ companyId }); toast.success("Research refreshed"); },
    onError: () => { setReResearchLoading(false); toast.error("Re-research failed"); },
  });

  // Re-approach mutation (force-regenerate sales approach)
  const [reApproachLoading, setReApproachLoading] = useState(false);
  const reApproachUtils = trpc.useUtils();
  const reApproachMutation = trpc.companyFinder.generateSalesApproach.useMutation({
    onSuccess: () => { setReApproachLoading(false); reApproachUtils.companyFinder.getCompany.invalidate({ companyId }); toast.success("Approach refreshed"); },
    onError: () => { setReApproachLoading(false); toast.error("Re-approach failed"); },
  });

  // Product images
  const [productImagesLoading, setProductImagesLoading] = useState(false);
  const productImagesUtils = trpc.useUtils();
  const { data: productImagesData, refetch: refetchProductImages } = trpc.companyFinder.getProductImages.useQuery(
    { companyId },
    { enabled: !!companyId && !isNaN(companyId) }
  );
  const productImages: Array<{ imageUrl: string; thumbnailUrl: string; title: string; source: string; domain: string; link: string }> = productImagesData?.images ?? [];
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fetchProductImages = trpc.companyFinder.fetchProductImages.useMutation({
    onSuccess: () => {
      setProductImagesLoading(false);
      productImagesUtils.companyFinder.getProductImages.invalidate({ companyId });
    },
    onError: () => { setProductImagesLoading(false); toast.error("Could not fetch product images"); },
  });

  // Active Brain — used for BOM enrichment
  const { data: activeBrainData } = trpc.companyFinder.getActiveBrain.useQuery();
  const activeBrain = activeBrainData?.brain ?? null;

  // BOM Calculator state
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [bomLoading, setBomLoading] = useState(false);
  const [bomImageSelectionMode, setBomImageSelectionMode] = useState(false);
  const [selectedBomImages, setSelectedBomImages] = useState<Set<number>>(new Set());
  const [bomResult, setBomResult] = useState<{
    productSummary: string;
    components: Array<{
      component: string;
      qty: number;
      unitCostEur: number;
      confidence: "high" | "medium" | "low";
      notes: string;
      editedCost?: number;
      // Brain enrichment fields
      canSupply?: "yes" | "partial" | "no";
      supplyReason?: string;
      deliverableCategory?: string;
    }>;
  } | null>(null);
  const [bomEnrichLoading, setBomEnrichLoading] = useState(false);
  const [domPanelComponent, setDomPanelComponent] = useState<null | {
    component: string; qty: number; unitCostEur: number; notes: string; deliverableCategory: string;
  }>(null);
  const [domReport, setDomReport] = useState<null | {
    componentName: string; canDeliver: boolean; deliveryStatement: string;
    specification: string; leadTimeEstimate: string; manufacturingProcess: string;
    qualityStandards: string; pricingNote: string; whyUs: string; limitations: string;
  }>(null);
  const [domLoading, setDomLoading] = useState(false);

  const extractBomMutation = trpc.prototype.extractBomFromImages.useMutation({
    onSuccess: (data) => {
      setBomResult({ ...data, components: data.components.map(c => ({ ...c, editedCost: c.unitCostEur })) });
      setBomLoading(false);
    },
    onError: () => { setBomLoading(false); toast.error("BOM extraction failed"); },
  });

  const enrichBomMutation = trpc.prototype.enrichBomWithBrain.useMutation({
    onSuccess: (data) => {
      setBomResult(prev => prev ? {
        ...prev,
        components: data.enriched.map((c, i) => ({
          ...prev.components[i],
          ...c,
          editedCost: prev.components[i]?.editedCost ?? c.unitCostEur,
        }))
      } : null);
      setBomEnrichLoading(false);
    },
    onError: () => { setBomEnrichLoading(false); toast.error("Brain enrichment failed"); },
  });

  const generateDomMutation = trpc.prototype.generateDomReport.useMutation({
    onSuccess: (data) => {
      setDomReport(data);
      setDomLoading(false);
    },
    onError: () => { setDomLoading(false); toast.error("DOM report generation failed"); },
  });

  const handleEnrichBom = () => {
    if (!bomResult || !activeBrain) return;
    setBomEnrichLoading(true);
    enrichBomMutation.mutate({
      components: bomResult.components.map(c => ({
        component: c.component,
        qty: c.qty,
        unitCostEur: c.editedCost ?? c.unitCostEur,
        confidence: c.confidence,
        notes: c.notes,
      })),
      brainContext: {
        companyName: activeBrain.companyName ?? company?.name ?? "Unknown",
        offeringSummary: activeBrain.offeringSummary ?? undefined,
        coreCapabilities: activeBrain.coreCapabilities ?? undefined,
        valuePropositions: activeBrain.valuePropositions ?? undefined,
        competitiveAdvantages: activeBrain.competitiveAdvantages ?? undefined,
      },
    });
  };

  const handleGenerateDom = (c: { component: string; qty: number; unitCostEur: number; notes: string; deliverableCategory: string }) => {
    if (!activeBrain) return;
    setDomPanelComponent(c);
    setDomReport(null);
    setDomLoading(true);
    generateDomMutation.mutate({
      component: c.component,
      qty: c.qty,
      unitCostEur: c.unitCostEur,
      notes: c.notes,
      deliverableCategory: c.deliverableCategory,
      productContext: company?.name ?? undefined,
      brainContext: {
        companyName: activeBrain.companyName ?? company?.name ?? "Unknown",
        offeringSummary: activeBrain.offeringSummary ?? undefined,
        coreCapabilities: activeBrain.coreCapabilities ?? undefined,
        competitiveAdvantages: activeBrain.competitiveAdvantages ?? undefined,
      },
    });
  };

  // Urgency images (editorial/news style)
  const [urgencyImagesLoading, setUrgencyImagesLoading] = useState(false);
  const urgencyImagesUtils = trpc.useUtils();
  const { data: urgencyImagesData } = trpc.companyFinder.getUrgencyImages.useQuery(
    { companyId },
    { enabled: !!companyId && !isNaN(companyId) }
  );
  const urgencyImages: Array<{ imageUrl: string; thumbnailUrl: string; title: string; source: string; domain: string; link: string }> = urgencyImagesData?.images ?? [];

  // Three-level fallback: 1) news images, 2) product images, 3) website images (marked with _fallback)
  const urgencyImagesFetched = urgencyImagesData !== undefined; // query has resolved
  const usingWebsiteFallback = urgencyImages.length > 0 && (urgencyImages[0] as any)._fallback === "website";
  const trueNewsImages = usingWebsiteFallback ? [] : urgencyImages;
  const displayImages = trueNewsImages.length > 0
    ? trueNewsImages
    : usingWebsiteFallback
      ? urgencyImages
      : (!urgencyImagesLoading && urgencyImagesFetched ? productImages : []);
  const usingProductImageFallback = !usingWebsiteFallback && trueNewsImages.length === 0 && displayImages.length > 0 && displayImages === productImages;
  const imageFallbackType: "news" | "product" | "website" | "none" =
    usingWebsiteFallback ? "website"
    : usingProductImageFallback ? "product"
    : trueNewsImages.length > 0 ? "news"
    : "none";

  const fetchUrgencyImagesMutation = trpc.companyFinder.fetchUrgencyImages.useMutation({
    onSuccess: () => {
      setUrgencyImagesLoading(false);
      urgencyImagesUtils.companyFinder.getUrgencyImages.invalidate({ companyId });
    },
    onError: () => { setUrgencyImagesLoading(false); toast.error("Could not fetch urgency images"); },
  });

  // Auto-fetch urgency images when entering urgency tab (if not already cached)
  const urgencyImagesFetchedRef = useRef(false);
  useEffect(() => {
    if (chapter === "urgency" && briefData && !urgencyImagesLoading && urgencyImages.length === 0 && !urgencyImagesFetchedRef.current) {
      urgencyImagesFetchedRef.current = true;
      setUrgencyImagesLoading(true);
      fetchUrgencyImagesMutation.mutate({ companyId });
    }
  }, [chapter, briefData]);

  // ── Per-signal approach sub-agent ──────────────────────────────────────────
  // Map of signal index → opener string (cached in component state)
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

  // Auto-generate openers for all signals when urgency tab is active and briefData is ready
  const signalOpenersFiredRef = useRef(false);
  useEffect(() => {
    if (chapter === "urgency" && briefData?.urgencySignals?.length > 0 && !signalOpenersFiredRef.current) {
      signalOpenersFiredRef.current = true;
      briefData.urgencySignals.forEach((signal: any, index: number) => {
        generateOpenerForSignal(signal, index);
      });
    }
  }, [chapter, briefData]);

  // ── Sales Rep Profile ─────────────────────────────────────────────────────
  const [repProfile, setRepProfile] = useState<string | null>(null);
  const [repProfileLoading, setRepProfileLoading] = useState(false);

  // Load persisted rep profile from DB
  const { data: persistedRepProfile } = trpc.companyFinder.getSalesRepProfile.useQuery(
    { companyId },
    { enabled: !isNaN(companyId) }
  );

  // Populate state from DB once loaded
  useEffect(() => {
    if (persistedRepProfile?.profile && !repProfile) {
      setRepProfile(persistedRepProfile.profile);
    }
  }, [persistedRepProfile]);

  const generateRepProfileMutation = trpc.companyFinder.generateSalesRepProfile.useMutation({
    onSuccess: (data) => {
      setRepProfile(data.profile);
      setRepProfileLoading(false);
    },
    onError: () => {
      toast.error("Could not generate rep profile");
      setRepProfileLoading(false);
    },
  });

  // Top contact (first enriched contact with email, else first contact)
  const topContact = useMemo(() => {
    const withEmail = rawContacts.find((c: any) => c.email);
    return withEmail ?? rawContacts[0] ?? null;
  }, [rawContacts]);

  // Plain-English industry from NAICS description
  const industryLabel = useMemo(() => {
    if (!company) return null;
    const naics = company.naicsCodes ? (() => { try { return JSON.parse(company.naicsCodes as string); } catch { return []; } })() : [];
    if (naics.length > 0) {
      const first = Array.isArray(naics[0]) ? naics[0][1] : null;
      if (first) return first;
    }
    return null;
  }, [company]);

  // Headcount growth label
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

  const goBack = () => {
    if (fromParam === "call-today") {
      navigate("/call-today");
    } else if (fromParam.startsWith("call-today/")) {
      navigate(`/call-today/${fromParam.replace("call-today/", "")}`);
    } else if (fromParam.startsWith("search/")) {
      navigate(`/search-results/${fromParam.replace("search/", "")}`);
    } else {
      navigate(-1 as any);
    }
  };

  const location = company && company.enrichmentStatus === "enriched" && (company.city || company.state || company.country)
    ? [company.city, company.state, company.country].filter(Boolean).join(", ")
    : company?.searchLocation || "—";

  if (!user) return null;

  // ── Cache Banner helper ──────────────────────────────────────────────────────
  function CacheBanner({
    cachedAt,
    label,
    onRefresh,
    loading,
  }: {
    cachedAt: Date | string | null | undefined;
    label: string;
    onRefresh: () => void;
    loading: boolean;
  }) {
    if (!cachedAt) return null;
    const d = new Date(cachedAt);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const ageLabel =
      diffDays >= 1
        ? `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
        : diffHours >= 1
        ? `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
        : "just now";
    const isStale = diffDays >= 7;
    return (
      <div className={`flex items-center justify-between px-4 py-2.5 mb-5 border-2 ${
        isStale ? "border-orange-500 bg-orange-50" : "border-amber-400 bg-amber-50"
      }`}>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-black px-2 py-0.5 ${
            isStale ? "bg-orange-500 text-white" : "bg-amber-400 text-black"
          }`}>⚠ CACHED</span>
          <span className="text-xs font-bold text-gray-700">
            {label} cached <span className="font-black">{ageLabel}</span>
            {isStale && <span className="text-orange-600 font-black ml-2">— DATA MAY BE STALE</span>}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className={`text-[11px] font-black px-3 py-1.5 border-2 transition-colors cursor-pointer ${
            isStale
              ? "border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
              : "border-amber-500 text-amber-700 hover:bg-amber-500 hover:text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? "REFRESHING..." : "↻ REFRESH NOW"}
        </button>
      </div>
    );
  }

  if (isLoading) return (
    <div className="max-w-6xl">
      <div className="text-2xl font-black animate-pulse">Loading company...</div>
    </div>
  );

  if (!company) return (
    <div className="max-w-6xl">
      <div className="text-2xl font-black text-red-600">Company not found.</div>
      <button onClick={goBack} className="mt-4 text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer">← BACK</button>
    </div>
  );

  return (
    <div className="max-w-6xl">
      {/* ── Breadcrumb / Back + Queue Navigator ── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-xs font-black border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer">
            ← BACK
          </button>
          <span className="text-xs font-bold text-muted-foreground">
            {(fromParam === "call-today" || fromParam.startsWith("call-today/")) ? "CALL TODAY" : fromParam.startsWith("search/") ? "SEARCH RESULTS" : "BACK"} / {company.name.toUpperCase()}
          </span>
        </div>
        {/* Prev/Next queue navigator — server-side lookup, shown when arriving from a search */}
        {fromSearchId && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">
              {adjacent ? `${adjacent.position} / ${adjacent.total}` : "— / —"}
            </span>
            <button
              onClick={() => goToAdjacent(adjacent?.prevId)}
              disabled={!hasPrev}
              className="text-xs font-black border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default"
            >
              ← PREV
            </button>
            <button
              onClick={() => goToAdjacent(adjacent?.nextId)}
              disabled={!hasNext}
              className="text-xs font-black border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:cursor-default"
            >
              NEXT →
            </button>
          </div>
        )}
      </div>

      {/* ── Company Header ── */}
      <div className="border-4 border-black bg-white mb-0">
        <div className="p-5 border-b-4 border-black">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {company.enrichmentStatus === "enriched" && (
                  <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5">ENRICHED</span>
                )}
                {company.briefData && (
                  <span className="text-[10px] font-black border border-blue-600 text-blue-600 px-1.5 py-0.5">RESEARCHED</span>
                )}
                {(company.urgencyScore ?? 0) > 0 && (
                  <button
                    onClick={() => setChapter("urgency")}
                    className={`text-[10px] font-black px-1.5 py-0.5 cursor-pointer transition-opacity hover:opacity-80 ${
                      (company.urgencyScore ?? 0) >= 70 ? "bg-red-600 text-white" :
                      (company.urgencyScore ?? 0) >= 50 ? "bg-yellow-500 text-white" :
                      "bg-gray-200 text-gray-700"
                    }`}
                  >
                    ⚡ {company.urgencyScore}/100
                  </button>
                )}
                {company.salesApproachData && (
                  <span className="text-[10px] font-black border border-green-600 text-green-600 px-1.5 py-0.5">SALES READY</span>
                )}
              </div>

              {/* Name + URL */}
              <h1 className="text-3xl md:text-4xl font-black leading-tight">{company.name}</h1>
              {company.websiteUrl && (
                <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-muted-foreground underline mt-0.5 inline-block">
                  {company.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}

              {/* Overview snippet */}
              {briefData?.companyOverview && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
                  {briefData.companyOverview.split(/(?<=[.!?])\s+/)[0]}
                </p>
              )}
            </div>

            {/* Quick data */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm shrink-0">
              <div>
                <div className="text-[10px] font-black text-muted-foreground">LOCATION</div>
                <div className="font-bold">{location}</div>
              </div>
              {company.revenue && (
                <div>
                  <div className="text-[10px] font-black text-muted-foreground">REVENUE</div>
                  <div className="font-bold">{formatRevenue(company.revenue)}</div>
                </div>
              )}
              {company.linkedinUrl && (
                <div className="col-span-2">
                  <div className="text-[10px] font-black text-muted-foreground">LINKEDIN</div>
                  <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-sm truncate block">
                    {company.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Plain-English industry + growth block */}
          {(industryLabel || growthLabel || company.revenue) && (
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {industryLabel && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-muted-foreground">INDUSTRY</span>
                  <span className="font-bold">{industryLabel}</span>
                </div>
              )}
              {growthLabel && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 ${
                    growthLabel.startsWith("Growing") ? "bg-green-100 text-green-700" :
                    growthLabel.startsWith("Shrinking") ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>{growthLabel}</span>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Chapter Tab Bar ── */}
        <div className="flex overflow-x-auto border-b-4 border-black">
          {CHAPTERS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChapter(ch.id)}
              className={`shrink-0 px-5 py-3 text-xs font-black border-r-2 border-black cursor-pointer transition-colors ${
                chapter === ch.id ? ch.activeColor : `hover:bg-gray-50 ${ch.color}`
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* ── Research Sub-Nav ── */}
        {chapter === "research" && briefData && (
          <div className="flex overflow-x-auto border-b-2 border-blue-200 bg-blue-50">
            {RESEARCH_SUBS.map((sub) => {
              const hasContent =
                (sub.id === "recent-developments" && briefData.recentDevelopments?.length > 0) ||
                (sub.id === "products-services"   && briefData.productsAndServices?.length > 0) ||
                (sub.id === "key-technologies"    && briefData.keyTechnologies?.length > 0) ||
                (sub.id === "target-markets"      && briefData.targetMarkets?.length > 0) ||
                (sub.id === "product-images"      /* always show */) ||
                (sub.id === "sources"             && briefData.sources?.length > 0);
              if (!hasContent) return null;
              return (
                <button
                  key={sub.id}
                  onClick={() => setResearchSub(sub.id)}
                  className={`shrink-0 px-4 py-2 text-[11px] font-black border-r border-blue-200 cursor-pointer transition-colors ${
                    researchSub === sub.id
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {sub.label}
                  {sub.id === "sources" && briefData.sources?.length > 0 && (
                    <span className="ml-1 opacity-70">({briefData.sources.length})</span>
                  )}
                  {sub.id === "product-images" && productImages.length > 0 && (
                    <span className="ml-1 opacity-70">({productImages.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Approach Sub-Nav ── */}
        {chapter === "approach" && salesApproach && (
          <div className="flex overflow-x-auto border-b-2 border-green-200 bg-green-50">
            {APPROACH_SUBS.map((sub) => {
              const hasContent =
                (sub.id === "conversation-starters" && salesApproach.conversationStarters?.length > 0) ||
                (sub.id === "email-draft"           && !!salesApproach.emailDraft) ||
                (sub.id === "linkedin-message"      && !!salesApproach.linkedinMessage) ||
                (sub.id === "call-script"           && !!salesApproach.callScript);
              if (!hasContent) return null;
              return (
                <button
                  key={sub.id}
                  onClick={() => setApproachSub(sub.id)}
                  className={`shrink-0 px-4 py-2 text-[11px] font-black border-r border-green-200 cursor-pointer transition-colors ${
                    approachSub === sub.id
                      ? "bg-green-600 text-white"
                      : "text-green-700 hover:bg-green-100"
                  }`}
                >
                  {sub.label}
                  {sub.id === "conversation-starters" && salesApproach.conversationStarters?.length > 0 && (
                    <span className="ml-1 opacity-70">({salesApproach.conversationStarters.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Chapter Content ── */}
        <div className="min-h-[400px]">

          {/* OVERVIEW — Sales-rep pre-call dossier */}
          {chapter === "overview" && (
            <div className="p-6 space-y-6">

              {/* ── 1. CALL READINESS BAR ── */}
              <div className="border-4 border-black p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black text-muted-foreground mb-1">WHY CALL TODAY</div>
                    {callReadinessSummary ? (
                      <p className="text-base font-bold leading-snug">{callReadinessSummary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No call readiness summary yet — generate one below.</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setCallReadinessLoading(true);
                      generateReadiness.mutate({ companyId });
                    }}
                    disabled={callReadinessLoading}
                    className="shrink-0 text-xs font-black border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {callReadinessLoading ? "GENERATING..." : callReadinessSummary ? "↺ REFRESH" : "⚡ GENERATE"}
                  </button>
                </div>
              </div>

              {/* ── 2. TOP CONTACT ── */}
              <div className="border-4 border-purple-600 p-4">
                <div className="text-[10px] font-black text-purple-600 mb-2">TOP CONTACT</div>
                {topContact ? (
                  <div className="flex flex-wrap gap-6 items-start">
                    <div>
                      <div className="text-lg font-black">{topContact.fullName || [topContact.firstName, topContact.lastName].filter(Boolean).join(" ") || "—"}</div>
                      <div className="text-sm font-bold text-muted-foreground">{topContact.title || topContact.searchedTitle || "—"}</div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {topContact.email && (
                        <div>
                          <div className="text-[10px] font-black text-muted-foreground">EMAIL</div>
                          <a href={`mailto:${topContact.email}`} className="font-bold text-blue-600 underline">{topContact.email}</a>
                        </div>
                      )}
                      {topContact.phone && (
                        <div>
                          <div className="text-[10px] font-black text-muted-foreground">PHONE</div>
                          <a href={`tel:${topContact.phone}`} className="font-bold text-blue-600 underline">{topContact.phone}</a>
                        </div>
                      )}
                      {topContact.linkedinUrl && (
                        <div>
                          <div className="text-[10px] font-black text-muted-foreground">LINKEDIN</div>
                          <a href={topContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 underline">View profile →</a>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setChapter("contacts")} className="ml-auto text-xs font-black text-purple-600 underline cursor-pointer">
                      All {rawContacts.length} contacts →
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground font-bold">No contacts found yet — use FIND DECISION-MAKERS in the Contacts tab.</div>
                )}
              </div>

              {/* ── 3. NEXT BEST ACTION (based on last outcome) ── */}
              {lastOutcome && (
                <div className={`border-4 p-4 ${
                  lastOutcome.outcome === "meeting_booked" ? "border-blue-600 bg-blue-50" :
                  lastOutcome.outcome === "reached" ? "border-green-600 bg-green-50" :
                  "border-yellow-500 bg-yellow-50"
                }`}>
                  <div className="text-[10px] font-black text-muted-foreground mb-1">NEXT BEST ACTION</div>
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className={`text-xs font-black px-2 py-1 border-2 ${OUTCOME_LABELS[lastOutcome.outcome]?.color ?? ""}`}>
                      {OUTCOME_LABELS[lastOutcome.outcome]?.label ?? lastOutcome.outcome}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{NEXT_ACTION[lastOutcome.outcome]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last contact: {new Date(lastOutcome.createdAt).toLocaleDateString()}
                        {lastOutcome.followUpDate && ` · Follow-up: ${lastOutcome.followUpDate}`}
                      </p>
                      {lastOutcome.notes && (
                        <p className="text-xs italic text-gray-600 mt-1">"{lastOutcome.notes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. CALL OUTCOME LOGGER ── */}
              <div className="border-4 border-gray-300 p-4">
                <div className="text-[10px] font-black text-muted-foreground mb-3">LOG CALL OUTCOME</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(OUTCOME_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => { setOutcomeSelected(key); setOutcomeSaved(false); }}
                      className={`text-xs font-black px-3 py-1.5 border-2 cursor-pointer transition-all ${
                        outcomeSelected === key ? color : "border-gray-300 text-gray-600 hover:border-gray-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {outcomeSelected && (
                  <div className="space-y-2">
                    <textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="Notes (optional)..."
                      rows={2}
                      className="w-full text-sm border-2 border-gray-300 p-2 resize-none focus:outline-none focus:border-black"
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-muted-foreground">FOLLOW-UP DATE</label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="text-sm border-2 border-gray-300 px-2 py-1 focus:outline-none focus:border-black"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!outcomeSelected) return;
                          logOutcome.mutate({
                            companyId,
                            outcome: outcomeSelected as any,
                            notes: outcomeNotes || undefined,
                            followUpDate: followUpDate || undefined,
                          });
                        }}
                        disabled={logOutcome.isPending || outcomeSaved}
                        className="text-xs font-black border-2 border-black px-4 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {outcomeSaved ? "✓ SAVED" : logOutcome.isPending ? "SAVING..." : "SAVE OUTCOME"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── 4b. OUTCOME HISTORY LOG ── */}
              {outcomesData?.outcomes && outcomesData.outcomes.length > 0 && (
                <div className="border-2 border-black p-4">
                  <div className="text-[10px] font-black text-muted-foreground mb-3">📋 CALL HISTORY</div>
                  <div className="space-y-2">
                    {outcomesData.outcomes.map((o: any) => (
                      <div key={o.id} className="flex items-start gap-3 text-xs border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                        <span className={`shrink-0 px-2 py-0.5 font-black border text-[10px] ${
                          OUTCOME_LABELS[o.outcome]?.color ?? "bg-gray-100 border-gray-300"
                        }`}>
                          {OUTCOME_LABELS[o.outcome]?.label ?? o.outcome}
                        </span>
                        <div className="flex-1 min-w-0">
                          {o.notes && <p className="text-muted-foreground truncate">{o.notes}</p>}
                          {o.followUpDate && (
                            <p className="text-blue-700 font-bold">Follow-up: {o.followUpDate}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 5. CHAPTER NAVIGATION CARDS ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => setChapter("urgency")} disabled={!briefData}
                  className={`p-4 border-4 text-left cursor-pointer transition-colors ${
                    briefData ? "border-red-600 hover:bg-red-50" : "border-gray-200 opacity-40 cursor-default"
                  }`}>
                  <div className="text-[10px] font-black text-red-600 mb-1">⚡ INTEL</div>
                  {briefData ? (
                    <><div className="text-3xl font-black text-red-600">{briefData.urgencyScore}/100</div>
                    <div className="text-xs font-bold text-muted-foreground mt-1">Click to view breakdown →</div></>
                  ) : <div className="text-sm font-bold text-gray-400">No research yet</div>}
                </button>
                <button onClick={() => setChapter("research")} disabled={!briefData}
                  className={`p-4 border-4 text-left cursor-pointer transition-colors ${
                    briefData ? "border-blue-600 hover:bg-blue-50" : "border-gray-200 opacity-40 cursor-default"
                  }`}>
                  <div className="text-[10px] font-black text-blue-600 mb-1">🔬 RESEARCH</div>
                  {briefData ? (
                    <ul className="space-y-0.5">
                      {briefData.recentDevelopments?.length > 0 && <li className="text-xs font-bold text-blue-800">• Recent Developments</li>}
                      {briefData.productsAndServices?.length > 0 && <li className="text-xs font-bold text-blue-800">• Products & Services</li>}
                      {briefData.keyTechnologies?.length > 0 && <li className="text-xs font-bold text-blue-800">• Key Technologies</li>}
                      {briefData.targetMarkets?.length > 0 && <li className="text-xs font-bold text-blue-800">• Target Markets</li>}
                      {briefData.sources?.length > 0 && <li className="text-xs font-bold text-blue-800">• Sources ({briefData.sources.length})</li>}
                    </ul>
                  ) : <div className="text-sm font-bold text-gray-400">No research yet</div>}
                </button>
                <button onClick={() => setChapter("approach")} disabled={!salesApproach}
                  className={`p-4 border-4 text-left cursor-pointer transition-colors ${
                    salesApproach ? "border-green-600 hover:bg-green-50" : "border-gray-200 opacity-40 cursor-default"
                  }`}>
                  <div className="text-[10px] font-black text-green-600 mb-1">💬 APPROACH</div>
                  {salesApproach ? (
                    <ul className="space-y-0.5">
                      {salesApproach.conversationStarters?.length > 0 && <li className="text-xs font-bold text-green-800">• Conversation Starters ({salesApproach.conversationStarters.length})</li>}
                      {salesApproach.emailDraft && <li className="text-xs font-bold text-green-800">• Email Draft</li>}
                      {salesApproach.linkedinMessage && <li className="text-xs font-bold text-green-800">• LinkedIn Message</li>}
                      {salesApproach.callScript && <li className="text-xs font-bold text-green-800">• Call Script</li>}
                    </ul>
                  ) : <div className="text-sm font-bold text-gray-400">No approach yet</div>}
                </button>
                <button onClick={() => setChapter("contacts")}
                  className="p-4 border-4 border-purple-600 text-left cursor-pointer hover:bg-purple-50 transition-colors">
                  <div className="text-[10px] font-black text-purple-600 mb-1">👤 CONTACTS</div>
                  {rawContacts.length > 0 ? (
                    <><div className="text-3xl font-black text-purple-600">{rawContacts.length}</div>
                    <div className="text-xs font-bold text-muted-foreground mt-1">contacts found →</div></>
                  ) : <div className="text-sm font-bold text-gray-400">No contacts yet</div>}
                </button>
              </div>

              {/* Company overview text */}
              {briefData?.companyOverview && (
                <div className="p-5 border-2 border-gray-200">
                  <h3 className="text-base font-black mb-2">Company Overview</h3>
                  <p className="text-sm leading-relaxed">{briefData.companyOverview}</p>
                </div>
              )}
            </div>
          )}

          {/* URGENCY */}
          {chapter === "urgency" && (
            <div className="p-0">
              {!briefData ? (
                <div className="text-center py-16 text-muted-foreground font-bold p-6">No research data available. Run Deep Research first.</div>
              ) : (
                <>
                  {/* ── MASTHEAD: score bar — full-width newspaper header ── */}
                  <div className="border-b-4 border-black px-6 pt-4 pb-3">
                    <div className="flex items-end justify-between flex-wrap gap-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-red-600 leading-none">{briefData.urgencyScore}</span>
                        <span className="text-2xl font-black text-gray-400">/100</span>
                        <span className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Urgency Score</span>
                      </div>
                      {briefData.urgencyBreakdown && (
                        <div className="flex gap-6 text-sm">
                          <div className="text-center">
                            <div className="text-[10px] font-black text-gray-400 tracking-widest">COMPANY</div>
                            <div className="text-xl font-black">{briefData.urgencyBreakdown.companyContext}<span className="text-xs text-gray-400">/40</span></div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] font-black text-gray-400 tracking-widest">MARKET</div>
                            <div className="text-xl font-black">{briefData.urgencyBreakdown.marketSignals}<span className="text-xs text-gray-400">/35</span></div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] font-black text-gray-400 tracking-widest">ACTIVITY</div>
                            <div className="text-xl font-black">{briefData.urgencyBreakdown.recentActivity}<span className="text-xs text-gray-400">/25</span></div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <CacheBanner
                          cachedAt={company.briefGeneratedAt}
                          label="Urgency"
                          onRefresh={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId, force: true }); }}
                          loading={reResearchLoading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT SALES REP + CONTACTS ACTION BAR ── */}
                  <div className="mx-6 mt-4 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-slate-50">
                    <div className="flex items-center justify-between gap-4 px-5 py-3 flex-wrap">
                      {/* Left: Rep profile */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm">👤</div>
                        <div>
                          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-indigo-400">RIGHT SALES REP</span>
                          <div className="text-xs font-bold text-slate-700">Decision-Maker Match</div>
                        </div>
                      </div>
                      {/* Right: Buttons */}
                      <div className="flex items-center gap-2">
                        {!repProfile ? (
                          <button
                            onClick={() => { setRepProfileLoading(true); generateRepProfileMutation.mutate({ companyId }); }}
                            disabled={repProfileLoading}
                            className="flex items-center gap-2 rounded-md bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-wait"
                          >
                            {repProfileLoading ? (
                              <><span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full" /> ANALYSING...</>
                            ) : (
                              "FIND BEST SALES REP"
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setRepProfile(null); setRepProfileLoading(true); generateRepProfileMutation.mutate({ companyId }); }}
                            disabled={repProfileLoading}
                            className="text-[10px] font-bold text-indigo-400 border border-indigo-200 rounded px-2 py-1 hover:border-indigo-500 hover:text-indigo-600 transition-colors disabled:opacity-40"
                          >
                            {repProfileLoading ? "..." : "↺ REFRESH"}
                          </button>
                        )}
                        <button
                          onClick={() => setChapter("contacts")}
                          className="flex items-center gap-1.5 rounded-md border border-purple-300 bg-white text-purple-700 font-bold text-xs px-4 py-2 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                        >
                          👥 CONTACTS {rawContacts.length > 0 && <span className="bg-purple-100 text-purple-700 rounded-full px-1.5 text-[10px] font-black">{rawContacts.length}</span>}
                        </button>
                      </div>
                    </div>
                    {/* Expandable rep profile result */}
                    {(repProfile || repProfileLoading) && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="border-t border-indigo-100 pt-3">
                          {repProfileLoading && !repProfile && (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs font-bold text-slate-500">Analysing company profile and offering fit...</span>
                            </div>
                          )}
                          {repProfile && (
                            <p className="text-sm leading-relaxed text-slate-700">{repProfile}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── EDITORIAL GRID ── */}
                  <div className="px-6 pt-5">

                    {/* Section label */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black tracking-[0.2em] uppercase border-b-2 border-black pb-0.5">Company Briefing</span>
                        {urgencyImagesLoading && <span className="text-[10px] text-gray-400 font-bold animate-pulse">Loading images...</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {imageFallbackType === "product" && (
                          <span className="text-[10px] font-black text-orange-500 border border-orange-300 bg-orange-50 px-2 py-0.5">PRODUCT IMAGES</span>
                        )}
                        {imageFallbackType === "website" && (
                          <span className="text-[10px] font-black text-white border border-red-600 bg-red-600 px-2 py-0.5 tracking-widest animate-pulse">⚡ COMPANY WEBSITE</span>
                        )}
                        {(displayImages.length > 0 || urgencyImagesLoading) && (
                          <button
                            onClick={() => { setUrgencyImagesLoading(true); fetchUrgencyImagesMutation.mutate({ companyId, force: true }); }}
                            disabled={urgencyImagesLoading}
                            className="text-[10px] font-black text-gray-400 border border-gray-200 px-2 py-0.5 disabled:opacity-40"
                          >
                            {urgencyImagesLoading ? "REFRESHING..." : "↺ REFRESH IMAGES"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Main editorial grid: hero image left + signal stack right */}
                    {briefData.urgencySignals?.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-gray-200">

                        {/* HERO: first image or skeleton */}
                        <div className="lg:col-span-1 border-r border-gray-200">
                          {urgencyImagesLoading && displayImages.length === 0 ? (
                            <div className="w-full bg-gray-100 animate-pulse" style={{ height: "280px" }} />
                          ) : displayImages[0] ? (
                            <a href={displayImages[0].link || displayImages[0].imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                              <div className="overflow-hidden bg-gray-100" style={{ height: "280px" }}>
                                <img
                                  src={displayImages[0].thumbnailUrl || displayImages[0].imageUrl}
                                  alt={displayImages[0].title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.background = "#f3f4f6"; }}
                                />
                              </div>
                              <div className="p-3 border-t border-gray-200 bg-white">
                                <p className="text-[10px] font-black text-gray-400 tracking-widest mb-1">
                                  {imageFallbackType === "website" ? "FROM WEBSITE" : imageFallbackType === "product" ? "PRODUCT" : "IN THE NEWS"}
                                </p>
                                {displayImages[0].title && <p className="text-sm font-bold leading-snug line-clamp-3">{displayImages[0].title}</p>}
                                {displayImages[0].domain && <p className="text-[10px] text-gray-400 mt-1">{displayImages[0].domain}</p>}
                              </div>
                            </a>
                          ) : (
                            <div className="flex items-center justify-center h-full min-h-[200px] bg-gray-50">
                              <span className="text-xs text-gray-400 font-bold">No image available</span>
                            </div>
                          )}
                        </div>

                        {/* SIGNAL STACK: each signal + its approach wrapped as one card unit */}
                        <div className="lg:col-span-2 flex flex-col gap-0 divide-y-0">
                          {briefData.urgencySignals.map((s: any, i: number) => {
                            const img = displayImages[i + 1]; // offset by 1 (hero used index 0)

                            // ── Per-signal opener from sub-agent (no matching, no reuse) ──
                            const openerText = signalOpeners[i] ?? null;
                            const openerLoading = signalOpenerLoading[i] ?? false;
                            return (
                              // Each card is a self-contained bordered unit — signal on top, approach below
                              <div key={i} className={`flex flex-col border-b border-gray-200 ${openerText || openerLoading ? "pb-0" : ""}`}>

                                {/* ── TOP HALF: news signal ── */}
                                <div className="flex gap-0">
                                  {/* Thumbnail */}
                                  {img ? (
                                    <a href={img.link || img.imageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                      <div className="overflow-hidden bg-gray-100" style={{ width: "90px", height: "72px" }}>
                                        <img
                                          src={img.thumbnailUrl || img.imageUrl}
                                          alt={img.title}
                                          className="w-full h-full object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.background = "#f3f4f6"; }}
                                        />
                                      </div>
                                    </a>
                                  ) : (
                                    <div className="flex-shrink-0 bg-gray-50 flex items-center justify-center" style={{ width: "90px", height: "72px" }}>
                                      <span className="text-[18px]">
                                        {s.category === "Growth" ? "📈" :
                                         s.category === "Product Launch" ? "🚀" :
                                         s.category === "R&D" ? "🔬" :
                                         s.category === "Expansion" ? "🌍" :
                                         s.category === "Awards" ? "🏆" :
                                         s.category === "Funding" ? "💰" :
                                         s.category === "Partnership" ? "🤝" : "⚡"}
                                      </span>
                                    </div>
                                  )}
                                  {/* Signal text */}
                                  <div className="flex-1 p-3">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <span className="text-[10px] font-black bg-yellow-400 px-1.5 py-0.5 leading-none">{s.category}</span>
                                      <span className="text-[10px] font-bold text-gray-500">{s.type}</span>
                                    </div>
                                    <p className="text-sm font-bold leading-snug">{s.description}</p>
                                    {s.snippet && (
                                      <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-1">"{s.snippet}"</p>
                                    )}
                                    {s.sourceUrl && (
                                      <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 underline mt-1 inline-block">Source →</a>
                                    )}
                                  </div>
                                </div>

                                {/* ── BOTTOM HALF: proposed approach — per-signal sub-agent, no matching ── */}
                                {(openerLoading || openerText !== null) && (
                                  <div className="border-t border-amber-300 bg-amber-50 px-4 py-2.5 flex gap-2 items-start">
                                    <span className="text-amber-500 font-black text-[11px] mt-0.5 shrink-0">→</span>
                                    <div className="flex-1">
                                      <div className="text-[9px] font-black text-amber-600 tracking-[0.15em] uppercase mb-1">Proposed Approach</div>
                                      {openerLoading ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                          <span className="text-[11px] text-amber-600">Generating opener...</span>
                                        </div>
                                      ) : (
                                        <p className="text-[12px] font-bold leading-snug text-gray-900">{openerText}</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground font-bold py-8 text-center">No urgency signals recorded.</div>
                    )}

                    {/* SECONDARY IMAGE ROW: remaining images below the grid */}
                    {displayImages.length > 1 && (
                      <div className="mt-4">
                        <div className="text-[10px] font-black text-gray-400 tracking-widest mb-2">
                          {imageFallbackType === "website" ? "MORE FROM WEBSITE" : imageFallbackType === "product" ? "MORE PRODUCTS" : "MORE FROM THE NEWS"}
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1">
                          {displayImages.slice(1).map((img, i) => (
                            <a
                              key={i}
                              href={img.link || img.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0"
                              style={{ width: "200px" }}
                            >
                              <div className="overflow-hidden bg-gray-100" style={{ height: "160px" }}>
                                <img
                                  src={img.thumbnailUrl || img.imageUrl}
                                  alt={img.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              </div>
                              {img.title && <p className="text-[10px] text-gray-600 mt-1 leading-tight line-clamp-2">{img.title}</p>}
                              {img.domain && <p className="text-[9px] text-gray-400 mt-0.5">{img.domain}</p>}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}



                    {/* WHY NOW + ENGAGEMENT STRATEGY */}
                    {(briefData.whyNow || briefData.engagementStrategy) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5 mb-5">
                        {briefData.whyNow && (
                          <div className="p-4 border-l-4 border-red-600 bg-red-50">
                            <p className="text-[10px] font-black text-red-600 tracking-widest mb-1">WHY NOW</p>
                            <p className="text-sm leading-relaxed">{briefData.whyNow}</p>
                          </div>
                        )}
                        {briefData.engagementStrategy && (
                          <div className="p-4 border-l-4 border-orange-500 bg-orange-50">
                            <p className="text-[10px] font-black text-orange-600 tracking-widest mb-1">ENGAGEMENT STRATEGY</p>
                            <p className="text-sm leading-relaxed">{briefData.engagementStrategy}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </>
              )}
            </div>
          )}

          {/* RESEARCH */}
          {chapter === "research" && (
            <div className="p-6">
              {!briefData ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <p className="text-muted-foreground font-bold text-lg">No research data available yet.</p>
                  <Button
                    onClick={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId, force: false }); }}
                    disabled={reResearchLoading}
                    className="px-6 py-3 bg-blue-600 text-white font-black text-sm uppercase tracking-widest border-2 border-black shadow-[4px_4px_0_black] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50"
                  >
                    {reResearchLoading ? "Running Deep Research…" : "🔬 Run Deep Research"}
                  </Button>
                </div>
              ) : (
                <>
                  <CacheBanner
                    cachedAt={company.briefGeneratedAt}
                    label="Research data"
                    onRefresh={() => { setReResearchLoading(true); reResearchMutation.mutate({ companyId, force: true }); }}
                    loading={reResearchLoading}
                  />
                  {/* Recent Developments sub-chapter */}
                  {researchSub === "recent-developments" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Recent Developments</h2>
                      {briefData.recentDevelopments?.length > 0 ? (
                        <div className="flex flex-col gap-4">
                          {briefData.recentDevelopments.map((d: any, i: number) => {
                            const headline = typeof d === "string" ? d : (d.text || d.title || d.event || "");
                            const snippet = typeof d !== "string" ? (d.snippet || d.description || "") : "";
                            const date = typeof d !== "string" ? (d.date || "") : "";
                            const sourceUrl = typeof d !== "string" ? (d.sourceUrl || d.url || "") : "";
                            const sourceDomain = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return sourceUrl; } })() : "";
                            return (
                              <div key={i} className="border-2 border-gray-200 hover:border-black transition-colors p-4">
                                {/* Headline */}
                                <p className="font-black text-sm leading-snug mb-2">{headline}</p>
                                {/* Snippet / excerpt */}
                                {snippet && (
                                  <blockquote className="border-l-4 border-gray-300 pl-3 mb-3">
                                    <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-4">{snippet}</p>
                                  </blockquote>
                                )}
                                {/* Footer: source + date */}
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  {sourceUrl ? (
                                    <a
                                      href={sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black hover:underline transition-colors"
                                    >
                                      <span className="inline-block w-4 h-4 bg-gray-100 border border-gray-300 rounded-sm text-[9px] font-black text-gray-500 flex items-center justify-center overflow-hidden shrink-0">
                                        {sourceDomain.charAt(0).toUpperCase()}
                                      </span>
                                      <span className="truncate max-w-[200px]">{sourceDomain}</span>
                                      <span className="text-gray-400">↗</span>
                                    </a>
                                  ) : <span />}
                                  {date && <span className="text-[10px] font-bold text-muted-foreground shrink-0">{date}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No recent developments recorded.</div>}
                    </section>
                  )}

                  {/* Products & Services sub-chapter */}
                  {researchSub === "products-services" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Products & Services</h2>
                      {briefData.productsAndServices?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {briefData.productsAndServices.map((p: any, i: number) => (
                            <div key={i} className="p-4 border-2 border-gray-200 hover:border-black transition-colors">
                              <div className="w-full h-24 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
                                <span className="text-xs font-bold text-gray-400">+ Add Image</span>
                              </div>
                              <div className="font-black text-sm mb-1">{typeof p === "string" ? p : p.name || p.product}</div>
                              {typeof p !== "string" && p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                              {typeof p !== "string" && p.category && <div className="text-[10px] font-black text-muted-foreground mt-1 uppercase">{p.category}</div>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No products & services recorded.</div>}
                    </section>
                  )}

                  {/* Key Technologies sub-chapter */}
                  {researchSub === "key-technologies" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Key Technologies</h2>
                      {briefData.keyTechnologies?.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {briefData.keyTechnologies.map((t: any, i: number) => (
                              <span key={i} className="text-sm font-bold border-2 border-black px-3 py-1.5 bg-gray-50">
                                {typeof t === "string" ? t : t.name || t.technology}
                              </span>
                            ))}
                          </div>
                          {briefData.keyTechnologies.some((t: any) => typeof t !== "string" && t.description) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {briefData.keyTechnologies.filter((t: any) => typeof t !== "string" && t.description).map((t: any, i: number) => (
                                <div key={i} className="p-4 border-2 border-gray-200">
                                  <div className="font-black text-sm mb-1">{t.name || t.technology}</div>
                                  <p className="text-xs text-muted-foreground">{t.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No key technologies recorded.</div>}
                    </section>
                  )}

                  {/* Product Images — own tab */}
                  {researchSub === "product-images" && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black border-b-4 border-black pb-2 flex-1">Product Images</h2>
                        <button
                          onClick={() => { setProductImagesLoading(true); fetchProductImages.mutate({ companyId }); }}
                          disabled={productImagesLoading}
                          className="ml-4 text-xs font-black border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {productImagesLoading ? "FETCHING..." : productImages.length > 0 ? "↻ REFRESH" : "FETCH IMAGES"}
                        </button>
                      </div>
                      {productImages.length > 0 ? (
                        <>
                          {/* Image selection mode banner */}
                          {bomImageSelectionMode && (
                            <div className="mb-3 p-3 bg-amber-50 border-2 border-amber-400 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-black text-amber-800">🧮 SELECT IMAGES FOR BOM ANALYSIS</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                  {selectedBomImages.size === 0
                                    ? "Tick the images you want to include (max 6)"
                                    : `${selectedBomImages.size} image${selectedBomImages.size > 1 ? "s" : ""} selected`}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const allIdx = new Set(productImages.slice(0, 6).map((_, i) => i));
                                    setSelectedBomImages(allIdx);
                                  }}
                                  className="text-xs font-bold border border-amber-500 text-amber-700 px-2 py-1 hover:bg-amber-100 cursor-pointer"
                                >
                                  SELECT ALL
                                </button>
                                <button
                                  onClick={() => { setBomImageSelectionMode(false); setSelectedBomImages(new Set()); }}
                                  className="text-xs font-bold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer"
                                >
                                  CANCEL
                                </button>
                                <button
                                  disabled={selectedBomImages.size === 0}
                                  onClick={() => {
                                    const urls = Array.from(selectedBomImages).sort().map(i => productImages[i].imageUrl);
                                    setBomImageSelectionMode(false);
                                    setBomModalOpen(true);
                                    setBomResult(null);
                                    setBomLoading(true);
                                    extractBomMutation.mutate({ imageUrls: urls, productContext: company?.name ?? undefined });
                                  }}
                                  className="text-xs font-black border-2 border-amber-500 bg-amber-400 text-black px-3 py-1 hover:bg-amber-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  ANALYSE →
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {productImages.map((img, i) => (
                              <div
                                key={i}
                                className={`border-2 transition-colors overflow-hidden group relative ${
                                  bomImageSelectionMode
                                    ? selectedBomImages.has(i)
                                      ? "border-amber-500 ring-2 ring-amber-300 cursor-pointer"
                                      : "border-gray-200 hover:border-amber-300 cursor-pointer"
                                    : "border-gray-200 hover:border-black cursor-pointer"
                                }`}
                                onClick={() => {
                                  if (bomImageSelectionMode) {
                                    setSelectedBomImages(prev => {
                                      const next = new Set(prev);
                                      if (next.has(i)) { next.delete(i); } else if (next.size < 6) { next.add(i); }
                                      return next;
                                    });
                                  } else {
                                    setLightboxImage(img.imageUrl);
                                  }
                                }}
                              >
                                {/* Selection checkbox overlay */}
                                {bomImageSelectionMode && (
                                  <div className={`absolute top-2 left-2 z-10 w-5 h-5 border-2 flex items-center justify-center ${
                                    selectedBomImages.has(i) ? "bg-amber-500 border-amber-500" : "bg-white border-gray-400"
                                  }`}>
                                    {selectedBomImages.has(i) && <span className="text-white text-xs font-black">✓</span>}
                                  </div>
                                )}
                                <div className="aspect-video bg-gray-50 overflow-hidden">
                                  <img
                                    src={img.thumbnailUrl || img.imageUrl}
                                    alt={img.title}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                                <div className="px-2 py-1.5">
                                  <p className="text-xs font-bold truncate">{img.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{img.source || img.domain}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* BOM Cost Calculator button — appears once images are loaded */}
                          {!bomImageSelectionMode && (
                            <div className="mt-6 border-t-2 border-dashed border-amber-300 pt-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    // Enter selection mode — pre-select all images up to 6
                                    setBomImageSelectionMode(true);
                                    setSelectedBomImages(new Set(productImages.slice(0, 6).map((_, i) => i)));
                                  }}
                                  className="flex items-center gap-2 text-sm font-black border-2 border-amber-500 bg-amber-50 text-amber-800 px-4 py-2.5 hover:bg-amber-500 hover:text-white transition-colors cursor-pointer"
                                >
                                  🧮 CALCULATE BOM COST
                                </button>
                                {bomResult && (
                                  <button
                                    onClick={() => setBomModalOpen(true)}
                                    className="text-xs font-bold border border-amber-400 text-amber-700 px-3 py-2 hover:bg-amber-50 cursor-pointer"
                                  >
                                    VIEW LAST RESULT
                                  </button>
                                )}
                              </div>
                              <p className="mt-1.5 text-xs text-muted-foreground">Select which images to include, then AI estimates material costs. For indicative purposes only — not a quote.</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-12 text-center border-2 border-dashed border-gray-200">
                          <p className="text-sm text-muted-foreground font-bold mb-3">No product images fetched yet.</p>
                          <p className="text-xs text-muted-foreground mb-4">Images are sourced from the company's own domain and technology-related sites. E-commerce results are excluded.</p>
                          <button
                            onClick={() => { setProductImagesLoading(true); fetchProductImages.mutate({ companyId }); }}
                            disabled={productImagesLoading}
                            className="text-xs font-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {productImagesLoading ? "FETCHING..." : "FETCH PRODUCT IMAGES"}
                          </button>
                        </div>
                      )}
                    </section>
                  )}

                  {/* BOM Calculator Modal */}
                  {bomModalOpen && (
                    <div
                      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto"
                      onClick={(e) => { if (e.target === e.currentTarget) setBomModalOpen(false); }}
                    >
                      <div className="bg-white w-full max-w-3xl my-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        {/* Modal header */}
                        <div className="bg-amber-400 border-b-4 border-black px-6 py-4 flex items-center justify-between">
                          <div>
                            <h2 className="text-xl font-black">🧮 BOM COST CALCULATOR</h2>
                            <p className="text-xs font-bold text-amber-900">{company?.name ?? ""} — AI-estimated material costs</p>
                          </div>
                          <button onClick={() => setBomModalOpen(false)} className="text-2xl font-black hover:opacity-60 cursor-pointer">✕</button>
                        </div>

                        {/* Disclaimer banner */}
                        <div className="bg-red-50 border-b-2 border-red-200 px-6 py-3">
                          <p className="text-xs font-bold text-red-700">⚠️ IMPORTANT DISCLAIMER</p>
                          <p className="text-xs text-red-600 mt-0.5">
                            These are AI-generated rough estimates based on product images only. They are <strong>not quotes</strong>, <strong>not validated BOM data</strong>, and <strong>not suitable for procurement decisions</strong>.
                            Actual costs depend on volumes, suppliers, specifications, and design details. Use for indicative purposes and internal discussion only.
                          </p>
                        </div>

                        <div className="px-6 py-5">
                          {bomLoading ? (
                            <div className="py-16 text-center">
                              <div className="text-4xl mb-4">🔍</div>
                              <p className="font-black text-lg">Analysing product images...</p>
                              <p className="text-sm text-muted-foreground mt-2">AI is identifying components and estimating costs. This takes 10–20 seconds.</p>
                            </div>
                          ) : bomResult ? (
                            <>
                              <p className="text-sm font-bold mb-4 text-muted-foreground">{bomResult.productSummary}</p>

                              {/* Brain enrichment bar */}
                              {activeBrain ? (
                                <div className="mb-4 flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-200">
                                  <div className="flex-1">
                                    <p className="text-xs font-black text-blue-800">
                                      🧠 BRAIN: {activeBrain.companyName ?? "Active Brain"}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-0.5">
                                      {bomResult.components.some(c => c.canSupply)
                                        ? `${bomResult.components.filter(c => c.canSupply === "yes").length} can supply · ${bomResult.components.filter(c => c.canSupply === "partial").length} partial · ${bomResult.components.filter(c => c.canSupply === "no").length} out-of-scope`
                                        : "Cross-reference BOM against your manufacturing capabilities"}
                                    </p>
                                  </div>
                                  <button
                                    onClick={handleEnrichBom}
                                    disabled={bomEnrichLoading}
                                    className="text-xs font-black border-2 border-blue-600 bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {bomEnrichLoading ? "ANALYSING..." : bomResult.components.some(c => c.canSupply) ? "↻ RE-CHECK" : "🧠 CHECK WHAT WE CAN SUPPLY"}
                                  </button>
                                </div>
                              ) : (
                                <div className="mb-4 p-3 bg-gray-50 border border-dashed border-gray-300">
                                  <p className="text-xs text-muted-foreground">💡 Set up an Offering Brain to cross-reference which components your company can supply.</p>
                                </div>
                              )}

                              {/* BOM table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                  <thead>
                                    <tr className="bg-black text-white">
                                      <th className="text-left px-3 py-2 font-black">Component</th>
                                      <th className="text-center px-3 py-2 font-black w-16">Qty</th>
                                      <th className="text-right px-3 py-2 font-black w-28">Unit Cost (€)</th>
                                      <th className="text-right px-3 py-2 font-black w-28">Line Total</th>
                                      <th className="text-center px-3 py-2 font-black w-20">Confidence</th>
                                      {bomResult.components.some(c => c.canSupply) && (
                                        <th className="text-center px-3 py-2 font-black w-28">Can Supply</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bomResult.components.map((c, i) => (
                                      <tr key={i} className={`${
                                        c.canSupply === "yes" ? "bg-green-50" :
                                        c.canSupply === "partial" ? "bg-amber-50" :
                                        c.canSupply === "no" ? "bg-red-50" :
                                        i % 2 === 0 ? "bg-white" : "bg-gray-50"
                                      }`}>
                                        <td className="px-3 py-2">
                                          <div className="font-bold">{c.component}</div>
                                          {c.notes && <div className="text-xs text-muted-foreground">{c.notes}</div>}
                                          {c.deliverableCategory && (
                                            <div className="text-[10px] font-black text-gray-400 mt-0.5 uppercase tracking-wide">{c.deliverableCategory}</div>
                                          )}
                                        </td>
                                        <td className="text-center px-3 py-2">{c.qty}</td>
                                        <td className="text-right px-3 py-2">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={c.editedCost ?? c.unitCostEur}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setBomResult(prev => prev ? {
                                                ...prev,
                                                components: prev.components.map((comp, idx) =>
                                                  idx === i ? { ...comp, editedCost: val } : comp
                                                )
                                              } : null);
                                            }}
                                            className="w-24 text-right border-b-2 border-black bg-transparent font-mono text-sm focus:outline-none focus:border-amber-500"
                                          />
                                        </td>
                                        <td className="text-right px-3 py-2 font-mono font-bold">
                                          €{((c.editedCost ?? c.unitCostEur) * c.qty).toFixed(2)}
                                        </td>
                                        <td className="text-center px-3 py-2">
                                          <span className={`text-xs font-black px-2 py-0.5 ${
                                            c.confidence === "high" ? "bg-green-100 text-green-700" :
                                            c.confidence === "medium" ? "bg-amber-100 text-amber-700" :
                                            "bg-red-100 text-red-700"
                                          }`}>{c.confidence.toUpperCase()}</span>
                                        </td>
                                        {bomResult.components.some(comp => comp.canSupply) && (
                                          <td className="text-center px-3 py-2">
                                            {c.canSupply ? (
                                              <div className="flex flex-col items-center gap-1">
                                                <span className={`text-xs font-black px-2 py-0.5 ${
                                                  c.canSupply === "yes" ? "bg-green-600 text-white" :
                                                  c.canSupply === "partial" ? "bg-amber-500 text-white" :
                                                  "bg-red-500 text-white"
                                                }`}>
                                                  {c.canSupply === "yes" ? "✓ YES" : c.canSupply === "partial" ? "~ PARTIAL" : "✕ NO"}
                                                </span>
                                                {c.supplyReason && (
                                                  <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[100px]">{c.supplyReason}</span>
                                                )}
                                                {(c.canSupply === "yes" || c.canSupply === "partial") && activeBrain && (
                                                  <button
                                                    onClick={() => handleGenerateDom({
                                                      component: c.component,
                                                      qty: c.qty,
                                                      unitCostEur: c.editedCost ?? c.unitCostEur,
                                                      notes: c.notes,
                                                      deliverableCategory: c.deliverableCategory ?? "Unknown",
                                                    })}
                                                    className="text-[9px] font-black border border-blue-400 text-blue-600 px-1.5 py-0.5 hover:bg-blue-50 cursor-pointer mt-0.5"
                                                  >
                                                    📄 DOM
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-xs text-gray-300">—</span>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-black text-white">
                                      <td colSpan={bomResult.components.some(c => c.canSupply) ? 3 : 3} className="px-3 py-3 font-black text-right">ESTIMATED TOTAL MATERIAL COST</td>
                                      <td className="px-3 py-3 font-black font-mono text-right text-lg">
                                        €{bomResult.components.reduce((sum, c) => sum + (c.editedCost ?? c.unitCostEur) * c.qty, 0).toFixed(2)}
                                      </td>
                                      <td />
                                      {bomResult.components.some(c => c.canSupply) && <td />}
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>

                              {/* DOM Report Panel */}
                              {domPanelComponent && (
                                <div className="mt-5 border-4 border-blue-600 bg-blue-50">
                                  <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                                    <div>
                                      <h3 className="text-sm font-black text-white">📄 DOM REPORT — {domPanelComponent.component.toUpperCase()}</h3>
                                      <p className="text-xs text-blue-200">{domPanelComponent.deliverableCategory} · Qty: {domPanelComponent.qty} · Est. €{domPanelComponent.unitCostEur}/unit</p>
                                    </div>
                                    <button onClick={() => { setDomPanelComponent(null); setDomReport(null); }} className="text-white font-black text-lg hover:opacity-60 cursor-pointer">✕</button>
                                  </div>
                                  <div className="px-4 py-4">
                                    {domLoading ? (
                                      <div className="py-8 text-center">
                                        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-sm font-bold text-blue-800">Generating DOM report from Brain...</p>
                                      </div>
                                    ) : domReport ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Delivery statement — full width */}
                                        <div className="md:col-span-2 p-3 bg-white border-l-4 border-blue-600">
                                          <p className="text-[10px] font-black text-blue-600 tracking-widest mb-1">DELIVERY STATEMENT</p>
                                          <p className="text-sm font-bold">{domReport.deliveryStatement}</p>
                                        </div>
                                        {/* Spec */}
                                        <div className="p-3 bg-white border border-gray-200">
                                          <p className="text-[10px] font-black text-gray-500 tracking-widest mb-1">SPECIFICATION</p>
                                          <p className="text-xs leading-relaxed">{domReport.specification}</p>
                                        </div>
                                        {/* Process */}
                                        <div className="p-3 bg-white border border-gray-200">
                                          <p className="text-[10px] font-black text-gray-500 tracking-widest mb-1">MANUFACTURING PROCESS</p>
                                          <p className="text-xs leading-relaxed">{domReport.manufacturingProcess}</p>
                                        </div>
                                        {/* Lead time */}
                                        <div className="p-3 bg-white border border-gray-200">
                                          <p className="text-[10px] font-black text-gray-500 tracking-widest mb-1">LEAD TIME ESTIMATE</p>
                                          <p className="text-xs font-bold">{domReport.leadTimeEstimate}</p>
                                        </div>
                                        {/* Quality */}
                                        <div className="p-3 bg-white border border-gray-200">
                                          <p className="text-[10px] font-black text-gray-500 tracking-widest mb-1">QUALITY STANDARDS</p>
                                          <p className="text-xs leading-relaxed">{domReport.qualityStandards}</p>
                                        </div>
                                        {/* Pricing */}
                                        <div className="p-3 bg-white border border-gray-200">
                                          <p className="text-[10px] font-black text-gray-500 tracking-widest mb-1">PRICING NOTE</p>
                                          <p className="text-xs leading-relaxed">{domReport.pricingNote}</p>
                                        </div>
                                        {/* Why us — full width */}
                                        <div className="md:col-span-2 p-3 bg-green-50 border-l-4 border-green-600">
                                          <p className="text-[10px] font-black text-green-700 tracking-widest mb-1">WHY US FOR THIS COMPONENT</p>
                                          <p className="text-sm leading-relaxed">{domReport.whyUs}</p>
                                        </div>
                                        {/* Limitations */}
                                        {domReport.limitations && (
                                          <div className="md:col-span-2 p-3 bg-amber-50 border-l-4 border-amber-500">
                                            <p className="text-[10px] font-black text-amber-700 tracking-widest mb-1">LIMITATIONS / CAVEATS</p>
                                            <p className="text-xs leading-relaxed">{domReport.limitations}</p>
                                          </div>
                                        )}
                                        {/* Copy DOM button */}
                                        <div className="md:col-span-2 flex gap-2">
                                          <button
                                            onClick={() => {
                                              const text = [
                                                `DOM REPORT — ${domReport.componentName}`,
                                                `Category: ${domPanelComponent.deliverableCategory}`,
                                                `Qty: ${domPanelComponent.qty} | Est. €${domPanelComponent.unitCostEur}/unit`,
                                                ``,
                                                `DELIVERY STATEMENT`,
                                                domReport.deliveryStatement,
                                                ``,
                                                `SPECIFICATION`,
                                                domReport.specification,
                                                ``,
                                                `MANUFACTURING PROCESS`,
                                                domReport.manufacturingProcess,
                                                ``,
                                                `LEAD TIME`,
                                                domReport.leadTimeEstimate,
                                                ``,
                                                `QUALITY STANDARDS`,
                                                domReport.qualityStandards,
                                                ``,
                                                `PRICING NOTE`,
                                                domReport.pricingNote,
                                                ``,
                                                `WHY US`,
                                                domReport.whyUs,
                                                domReport.limitations ? `\nLIMITATIONS\n${domReport.limitations}` : "",
                                              ].join("\n");
                                              navigator.clipboard.writeText(text);
                                              toast.success("DOM report copied to clipboard");
                                            }}
                                            className="text-xs font-black border-2 border-blue-600 text-blue-700 px-3 py-1.5 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                                          >
                                            📋 COPY DOM REPORT
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              )}

                              <div className="mt-4 flex gap-3">
                                <button
                                  onClick={() => {
                                    // Close modal and enter image selection mode for re-analysis
                                    setBomModalOpen(false);
                                    setBomImageSelectionMode(true);
                                    setSelectedBomImages(new Set(productImages.slice(0, 6).map((_, idx) => idx)));
                                  }}
                                  className="text-xs font-black border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors cursor-pointer"
                                >
                                  ↻ RE-ANALYSE (CHANGE IMAGES)
                                </button>
                                <button
                                  onClick={() => {
                                    const rows = bomResult.components.map(c =>
                                      `${c.component}\t${c.qty}\t${(c.editedCost ?? c.unitCostEur).toFixed(2)}\t${((c.editedCost ?? c.unitCostEur) * c.qty).toFixed(2)}\t${c.confidence}`
                                    ).join("\n");
                                    const csv = `Component\tQty\tUnit Cost (EUR)\tLine Total\tConfidence\n${rows}\n\nTOTAL\t\t\t${bomResult.components.reduce((s, c) => s + (c.editedCost ?? c.unitCostEur) * c.qty, 0).toFixed(2)}\t`;
                                    navigator.clipboard.writeText(csv);
                                    toast.success("BOM copied to clipboard — paste into Excel");
                                  }}
                                  className="text-xs font-black border-2 border-amber-500 bg-amber-50 text-amber-800 px-3 py-1.5 hover:bg-amber-500 hover:text-white transition-colors cursor-pointer"
                                >
                                  📋 COPY FOR EXCEL
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="py-8 text-center text-muted-foreground">No data yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lightbox — rendered outside tab sections so it works from any tab */}
                  {lightboxImage && (
                    <div
                      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                      onClick={() => setLightboxImage(null)}
                    >
                      <img
                        src={lightboxImage}
                        alt="Product image"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="absolute top-4 right-4 text-white font-black text-2xl hover:text-gray-300"
                        onClick={() => setLightboxImage(null)}
                      >✕</button>
                    </div>
                  )}

                  {/* Target Markets sub-chapter */}
                  {researchSub === "target-markets" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Target Markets</h2>
                      {briefData.targetMarkets?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {briefData.targetMarkets.map((m: any, i: number) => (
                            <div key={i} className="p-4 border-2 border-gray-200">
                              <div className="font-black text-sm mb-1">{typeof m === "string" ? m : m.market || m.segment || m.name}</div>
                              {typeof m !== "string" && m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No target markets recorded.</div>}
                    </section>
                  )}

                  {/* Sources sub-chapter */}
                  {researchSub === "sources" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-black pb-2 mb-4">Sources ({briefData.sources?.length ?? 0})</h2>
                      {briefData.sources?.length > 0 ? (
                        <div className="space-y-2">
                          {briefData.sources.map((s: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 border border-gray-200 hover:border-black transition-colors">
                              <span className="text-xs font-black text-muted-foreground shrink-0">[{i + 1}]</span>
                              <div className="flex-1 min-w-0">
                                {(s.url || s.sourceUrl) ? (
                                  <a href={s.url || s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 underline truncate block">
                                    {s.title || s.url || s.sourceUrl}
                                  </a>
                                ) : (
                                  <div className="text-sm font-bold">{s.title || String(s)}</div>
                                )}
                                {s.snippet && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.snippet}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No sources recorded.</div>}
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {/* APPROACH */}
          {chapter === "approach" && (
            <div className="p-6">
              {!salesApproach ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <p className="text-sm font-bold text-muted-foreground">
                    {company.briefData ? "Deep research is ready — generate your personalised sales approach." : "Run Deep Research first, then come back to generate the sales approach."}
                  </p>
                  {company.briefData && (
                    <button
                      onClick={() => { setReApproachLoading(true); reApproachMutation.mutate({ companyId }); }}
                      disabled={reApproachLoading}
                      className="flex items-center gap-2 border-2 border-green-700 bg-green-700 text-white font-black px-6 py-3 hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      {reApproachLoading ? (
                        <>
                          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          GENERATING APPROACH...
                        </>
                      ) : (
                        "💬 CREATE SALES APPROACH"
                      )}
                    </button>
                  )}
                  {!company.briefData && (
                    <button
                      onClick={() => setChapter("research")}
                      className="border-2 border-blue-600 text-blue-600 font-black px-6 py-3 hover:bg-blue-50 transition-colors"
                    >
                      🔬 GO TO RESEARCH
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <CacheBanner
                    cachedAt={company.salesApproachGeneratedAt}
                    label="Sales approach"
                    onRefresh={() => { setReApproachLoading(true); reApproachMutation.mutate({ companyId }); }}
                    loading={reApproachLoading}
                  />
                  {/* Conversation Starters sub-chapter */}
                  {approachSub === "conversation-starters" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-amber-500 pb-2 mb-4 text-amber-700">Conversation Starters</h2>
                      {salesApproach.conversationStarters?.length > 0 ? (
                        <div className="space-y-3">
                          {salesApproach.conversationStarters.map((s: any, i: number) => (
                            <div key={i} className="p-4 bg-amber-50 border-2 border-amber-200">
                              <p className="text-sm font-medium">{typeof s === "string" ? s : s.opener}</p>
                              {typeof s !== "string" && s.basedOn && <p className="text-xs text-muted-foreground mt-1">Based on: {s.basedOn}</p>}
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No conversation starters generated.</div>}
                    </section>
                  )}

                  {/* Email Draft sub-chapter */}
                  {approachSub === "email-draft" && (
                    <section>
                      <div className="flex items-center justify-between border-b-4 border-green-600 pb-2 mb-4">
                        <h2 className="text-xl font-black text-green-700">Email Draft</h2>
                        {salesApproach.emailDraft && (
                          <button
                            onClick={() => copyText(`Subject: ${salesApproach.emailDraft.subject}\n\n${salesApproach.emailDraft.body}`, "Email")}
                            className="text-xs font-black border-2 border-green-600 text-green-600 px-3 py-1 cursor-pointer hover:bg-green-600 hover:text-white transition-colors"
                          >COPY EMAIL</button>
                        )}
                      </div>
                      {salesApproach.emailDraft ? (
                        <div className="p-5 border-4 border-green-600 bg-green-50">
                          <div className="mb-3 p-2 bg-white border border-green-200">
                            <span className="text-xs font-black text-muted-foreground">SUBJECT: </span>
                            <span className="text-sm font-bold">{salesApproach.emailDraft.subject}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm bg-white p-3 border border-green-200">{salesApproach.emailDraft.body}</div>
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No email draft generated.</div>}
                    </section>
                  )}

                  {/* LinkedIn Message sub-chapter */}
                  {approachSub === "linkedin-message" && (
                    <section>
                      <h2 className="text-xl font-black border-b-4 border-blue-600 pb-2 mb-4 text-blue-700">LinkedIn Message</h2>
                      {salesApproach.linkedinMessage ? (
                        <div className="p-5 border-4 border-blue-600 bg-blue-50 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black">CONNECTION REQUEST</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.connectionRequest, "Connection Request")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">COPY</button>
                            </div>
                            <div className="text-sm bg-white p-3 border border-blue-200">{salesApproach.linkedinMessage.connectionRequest}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black">FOLLOW-UP</span>
                              <button onClick={() => copyText(salesApproach.linkedinMessage.followUp, "Follow-up")} className="text-xs font-black border border-blue-600 text-blue-600 px-2 py-0.5 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors">COPY</button>
                            </div>
                            <div className="text-sm bg-white p-3 border border-blue-200">{salesApproach.linkedinMessage.followUp}</div>
                          </div>
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No LinkedIn message generated.</div>}
                    </section>
                  )}

                  {/* Call Script sub-chapter */}
                  {approachSub === "call-script" && (
                    <section>
                      <div className="flex items-center justify-between border-b-4 border-purple-600 pb-2 mb-4">
                        <h2 className="text-xl font-black text-purple-700">Call Script</h2>
                        {salesApproach.callScript && (
                          <button
                            onClick={() => copyText(salesApproach.callScript.fullScript || salesApproach.callScript.opening || "", "Call Script")}
                            className="text-xs font-black border-2 border-purple-600 text-purple-600 px-3 py-1 cursor-pointer hover:bg-purple-600 hover:text-white transition-colors"
                          >COPY SCRIPT</button>
                        )}
                      </div>
                      {salesApproach.callScript ? (
                        <div className="p-5 border-4 border-purple-600 bg-purple-50">
                          {salesApproach.callScript.opening && (
                            <div className="mb-4">
                              <div className="text-xs font-black mb-1">OPENING</div>
                              <div className="text-sm bg-white p-3 border border-purple-200">{salesApproach.callScript.opening}</div>
                            </div>
                          )}
                          {salesApproach.callScript.fullScript && (
                            <div>
                              <div className="text-xs font-black mb-1">FULL SCRIPT</div>
                              <div className="whitespace-pre-wrap text-sm bg-white p-4 border border-purple-200">{salesApproach.callScript.fullScript}</div>
                            </div>
                          )}
                        </div>
                      ) : <div className="text-muted-foreground font-bold py-8 text-center">No call script generated.</div>}
                    </section>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CONTACTS */}
          {chapter === "contacts" && (
            <div className="p-6">
              {/* Contacts cache indicator — show when contacts exist */}
              {rawContacts.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 mb-5 border-2 border-amber-400 bg-amber-50">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black px-2 py-0.5 bg-amber-400 text-black">⚠ CACHED</span>
                    <span className="text-xs font-bold text-gray-700">
                      {rawContacts.length} contact{rawContacts.length !== 1 ? "s" : ""} from Apollo enrichment — may not reflect latest org changes
                    </span>
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="text-[11px] font-black px-3 py-1.5 border-2 border-amber-500 text-amber-700 hover:bg-amber-500 hover:text-white transition-colors cursor-pointer"
                  >
                    ↻ RE-ENRICH
                  </button>
                </div>
              )}
              {/* Header row: title + action buttons */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-black">
                  Contacts ({contacts.length}{contacts.length !== rawContacts.length ? ` of ${rawContacts.length}` : ""})
                </h2>
                <div className="flex gap-3 flex-wrap">
                  <CompanyDetailFindDecisionMakersButton companyId={company.id} companyName={company.name} onDone={() => refetch()} />
                  <CompanyDetailGetAllPersonnelButton companyId={company.id} companyName={company.name} onDone={() => refetch()} />
                </div>
              </div>

              {/* Filter row */}
              {rawContacts.length > 0 && (
                <div className="flex items-center gap-3 mb-5 flex-wrap border-2 border-gray-200 p-3 bg-gray-50">
                  <span className="text-[10px] font-black text-muted-foreground shrink-0">FILTER:</span>
                  {/* Seniority */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black">SENIORITY</span>
                    {["all", ...seniorityOptions].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setContactSeniorityFilter(opt)}
                        className={`text-[10px] font-black px-2 py-0.5 border transition-colors cursor-pointer ${
                          contactSeniorityFilter === opt
                            ? "bg-purple-600 text-white border-purple-600"
                            : "border-gray-300 hover:border-purple-400 hover:text-purple-600"
                        }`}
                      >
                        {opt === "all" ? "ALL" : opt}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-4 bg-gray-300 shrink-0 hidden md:block" />
                  {/* Department */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black">DEPT</span>
                    {["all", ...deptOptions].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setContactDeptFilter(opt)}
                        className={`text-[10px] font-black px-2 py-0.5 border transition-colors cursor-pointer ${
                          contactDeptFilter === opt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-gray-300 hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        {opt === "all" ? "ALL" : opt}
                      </button>
                    ))}
                  </div>
                  {(contactSeniorityFilter !== "all" || contactDeptFilter !== "all") && (
                    <button
                      onClick={() => { setContactSeniorityFilter("all"); setContactDeptFilter("all"); }}
                      className="text-[10px] font-black text-red-600 border border-red-300 px-2 py-0.5 hover:bg-red-50 transition-colors cursor-pointer ml-auto shrink-0"
                    >
                      ✕ CLEAR
                    </button>
                  )}
                </div>
              )}

              {contacts.length === 0 ? (
                <div className="text-center py-16 border-4 border-dashed border-gray-300">
                  <div className="text-lg font-black text-muted-foreground mb-2">No contacts yet</div>
                  <div className="text-sm font-bold text-muted-foreground">Use the buttons above to find decision-makers or all personnel.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contacts.map((c: any, i: number) => (
                    <div key={i} className="p-4 border-2 border-gray-200 hover:border-black transition-colors">
                      <div className="font-black text-base mb-0.5">{c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}</div>
                      <div className="text-sm font-bold text-muted-foreground mb-2">{c.title || c.jobTitle || "—"}</div>
                      {c.email && <a href={`mailto:${c.email}`} className="text-sm text-blue-600 underline font-bold block">{c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="text-sm text-green-600 underline font-bold block">{c.phone}</a>}
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline block mt-1">
                          {c.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      )}
                      {!c.email && (
                        <CompanyDetailEnrichButton contactId={c.id} companyId={company.id} onDone={() => refetch()} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline action buttons for Contacts chapter ────────────────────────────────
function CompanyDetailFindDecisionMakersButton({ companyId, companyName, onDone }: { companyId: number; companyName: string; onDone: () => void }) {
  const findCSuiteMutation = trpc.companyFinder.findAllCSuite.useMutation({
    onSuccess: (data) => {
      toast.success(`Found ${data.contacts.length} decision-makers at ${companyName}`);
      onDone();
    },
    onError: (error) => toast.error(`Search failed: ${error.message}`),
  });

  return (
    <button
      onClick={() => findCSuiteMutation.mutate({ companyId })}
      disabled={findCSuiteMutation.isPending}
      className="font-black border-4 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
    >
      {findCSuiteMutation.isPending ? "SEARCHING..." : "👤 FIND DECISION-MAKERS"}
    </button>
  );
}

function CompanyDetailGetAllPersonnelButton({ companyId, companyName, onDone }: { companyId: number; companyName: string; onDone: () => void }) {
  const getAllPersonnelMutation = trpc.companyFinder.getAllPersonnel.useMutation({
    onSuccess: (data) => {
      toast.success(`Found ${data.contacts.length} personnel at ${companyName}`);
      onDone();
    },
    onError: (error) => toast.error(`Search failed: ${error.message}`),
  });

  return (
    <button
      onClick={() => getAllPersonnelMutation.mutate({ companyId, limit: 25 })}
      disabled={getAllPersonnelMutation.isPending}
      className="font-black border-4 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
    >
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
    <Button
      size="sm"
      variant="outline"
      onClick={() => enrichMutation.mutate({ contactId })}
      disabled={enrichMutation.isPending}
      className="text-xs font-black border-2 border-purple-600 text-purple-600 mt-2 cursor-pointer w-full"
    >
      {enrichMutation.isPending ? "..." : "GET EMAIL"}
    </Button>
  );
}
