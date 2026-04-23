import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

// ─── Data ────────────────────────────────────────────────────────────────────

interface MarketSegment {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  revenueShare: string;
  revenueBarWidth: string;
  revenueColor: string;
  certifications: string[];
  keyCapabilities: string[];
  targetCustomers: string[];
  painPoints: string[];
  brainName?: string;
  sites: string[];
  highlight?: string;
}

const SEGMENTS: MarketSegment[] = [
  {
    id: "industrial",
    name: "Industry & Automation",
    icon: "⚙️",
    tagline: "The largest segment — automation, robotics, HVAC, cranes, printing",
    description:
      "Connect Group's largest market, serving OEMs in industrial automation, robotics, HVAC, crane systems, agricultural machinery, printing and food-service equipment. High-mix, medium-to-high complexity PCBA and box-build with full DFx support.",
    revenueShare: "~40%",
    revenueBarWidth: "40%",
    revenueColor: "bg-orange-500",
    certifications: ["ISO 9001", "ISO 14001", "IPC A610 Class 2/3", "IATF 16949 (select sites)"],
    keyCapabilities: [
      "High-mix / medium-volume PCBA",
      "Box build & module integration",
      "DFx, DFM, DFA, DFT engineering",
      "Life Cycle Management (LCM)",
      "Obsolescence management",
      "Industry 4.0 traceability",
      "Cable & wire harness assemblies",
      "Conformal coating & potting",
    ],
    targetCustomers: [
      "Industrial automation OEMs",
      "Robotics manufacturers",
      "HVAC system builders",
      "Crane & lifting equipment OEMs",
      "Agricultural machinery producers",
      "Printing & food-service equipment makers",
    ],
    painPoints: [
      "Supply chain disruptions on long-lead components",
      "NPI speed-to-market pressure",
      "Cost reduction without quality compromise",
      "Obsolescence & end-of-life component management",
    ],
    brainName: "Connect Group - Industrial Electronics ICP",
    sites: ["Oradea (RO)", "San Sebastián (ES)", "Kladno (CZ)", "Ieper (BE)"],
    highlight: "49.7% of Oradea revenue",
  },
  {
    id: "infrastructure",
    name: "Infrastructure & Energy",
    icon: "⚡",
    tagline: "Smart grids, EV charging, energy management, IoT/electrification",
    description:
      "Energy transition and smart infrastructure are driving strong demand. Connect Group serves smart grid, EV charging infrastructure, energy management systems and IoT/electrification OEMs — leveraging UL508A panel certification and EN 17460 compliance.",
    revenueShare: "~20%",
    revenueBarWidth: "20%",
    revenueColor: "bg-slate-500",
    certifications: ["ISO 9001", "ISO 14001", "UL508A", "EN 17460", "IPC A610 Class 2/3"],
    keyCapabilities: [
      "High-reliability PCBA for outdoor/harsh environments",
      "UL508A industrial control panel assembly",
      "Module & cabinet building",
      "EV charging board assembly",
      "Smart meter & IoT device production",
      "Cable & wire systems for energy infrastructure",
      "Full traceability & compliance documentation",
    ],
    targetCustomers: [
      "Smart grid & metering OEMs",
      "EV charging infrastructure companies",
      "Energy management system vendors",
      "IoT & electrification platform builders",
      "Industrial control panel manufacturers",
    ],
    painPoints: [
      "Regulatory compliance complexity (UL, EN, IEC)",
      "Rapid product iteration for fast-moving energy market",
      "Scalability from pilot to volume production",
      "Global supply chain for specialized components",
    ],
    brainName: "Connect Group - Infrastructure ICP",
    sites: ["Kladno (CZ)", "Oradea (RO)", "Kampenhout (BE)"],
    highlight: "38% of Kladno revenue",
  },
  {
    id: "railway",
    name: "Railway & Mass Transit",
    icon: "🚆",
    tagline: "IRIS-certified PCBA and wire harnesses for rolling stock and signalling",
    description:
      "Railway is a core strategic segment. Connect Group holds ISO 22163 (IRIS) certification and EN 15085 welding approval, serving rolling stock OEMs, signalling system builders and traction control manufacturers across Europe with long-lifecycle, high-reliability electronics.",
    revenueShare: "~15%",
    revenueBarWidth: "15%",
    revenueColor: "bg-purple-600",
    certifications: ["ISO 22163 (IRIS)", "EN 15085-2 CL1", "ISO 9001", "ISO 14001", "IPC A610 Class 2/3"],
    keyCapabilities: [
      "IRIS-certified PCBA production",
      "EN 15085 welded assemblies",
      "Wire harness & cable loom production",
      "High-voltage test & functional validation",
      "Full part & process traceability",
      "LCM for 20–30 year product lifecycles",
      "Conformal coating for harsh environments",
      "Selective & wave soldering for THT-heavy boards",
    ],
    targetCustomers: [
      "Rolling stock OEMs (traction, HVAC, doors)",
      "Signalling & control system manufacturers",
      "Passenger information system vendors",
      "On-board power supply manufacturers",
      "Railway maintenance & retrofit companies",
    ],
    painPoints: [
      "Extremely long product lifecycles (20–30 years)",
      "Strict certification requirements (IRIS, EN 15085)",
      "Component obsolescence over long production runs",
      "Demanding quality documentation & audit trails",
    ],
    brainName: "Connect Group - Railway Solutions ICP",
    sites: ["Kladno (CZ)", "San Sebastián (ES)", "Oradea (RO)", "Ieper (BE)"],
    highlight: "39% of Kladno · 33% of San Sebastián",
  },
  {
    id: "automotive",
    name: "Automotive & Off-Road",
    icon: "🚗",
    tagline: "IATF16949 high-volume PCBA for automotive Tier 1 & 2 suppliers",
    description:
      "Connect Group operates 4 IATF 16949 certified sites across 3 continents, enabling high-volume automotive electronics production close to customer plants. Serving Tier 1 & 2 suppliers in electrification, ADAS, off-road and agricultural vehicle segments.",
    revenueShare: "~12%",
    revenueBarWidth: "12%",
    revenueColor: "bg-blue-600",
    certifications: ["IATF 16949", "ISO 9001", "ISO 14001", "IPC A610 Class 2/3"],
    keyCapabilities: [
      "IATF 16949 certified production on 4 sites",
      "High-volume SMT (up to 6 lines at Oradea)",
      "PPAP documentation & APQP support",
      "Zero-defect quality culture",
      "Automotive-grade conformal coating",
      "Cable & wire harness for EV/HEV platforms",
      "Module building for powertrain & body electronics",
      "3-continent footprint for supply chain resilience",
    ],
    targetCustomers: [
      "Automotive Tier 1 & Tier 2 suppliers",
      "EV / HEV powertrain module manufacturers",
      "ADAS & sensor system integrators",
      "Off-road & agricultural vehicle OEMs",
      "Commercial vehicle electronics suppliers",
    ],
    painPoints: [
      "Zero-defect quality expectations with PPM targets",
      "Just-in-time delivery pressure",
      "Rapid model changeovers and variant proliferation",
      "Electrification transition requiring new capabilities",
    ],
    brainName: "Connect Group - Automotive Solutions ICP",
    sites: ["Oradea (RO)", "San Sebastián (ES)", "Guadalajara (MX)", "Suzhou (CN)"],
    highlight: "4 IATF sites · 3 continents",
  },
  {
    id: "healthcare",
    name: "Healthcare & MedTech",
    icon: "🏥",
    tagline: "ISO 13485 and J-QMS compliant electronics for medical devices",
    description:
      "Connect Group produces safety-critical electronics for medical device OEMs under ISO 13485 and J-QMS (Japanese medical standard). From diagnostic equipment and patient monitoring to surgical tools and imaging systems — with full DHF traceability and cleanroom-compatible processes.",
    revenueShare: "~8%",
    revenueBarWidth: "8%",
    revenueColor: "bg-green-600",
    certifications: ["ISO 13485", "J-QMS", "ISO 9001", "ISO 14001", "IPC A610 Class 2/3"],
    keyCapabilities: [
      "ISO 13485 certified PCBA production",
      "J-QMS compliance for Japanese medical market",
      "Design History File (DHF) traceability",
      "Cleanroom-compatible assembly processes",
      "NPI & rapid prototyping for medical devices",
      "Functional test development for safety-critical systems",
      "LCM for long product registration cycles",
      "Conformal coating & potting",
    ],
    targetCustomers: [
      "Diagnostic equipment manufacturers",
      "Patient monitoring device OEMs",
      "Surgical instrument & robotics companies",
      "Medical imaging system builders",
      "In-vitro diagnostics (IVD) manufacturers",
    ],
    painPoints: [
      "Regulatory compliance (FDA, MDR, PMDA) complexity",
      "Traceability requirements at component level",
      "Long product registration & approval timelines",
      "Risk management documentation (ISO 14971)",
    ],
    brainName: "Connect Group - Healthcare & MedTech ICP",
    sites: ["Ieper (BE)", "San Sebastián (ES)", "Kladno (CZ)", "Oradea (RO)"],
    highlight: "ISO 13485 on 4 European sites",
  },
  {
    id: "defence",
    name: "Defence & Avionics",
    icon: "✈️",
    tagline: "AS9100D and IPC Class 3 electronics for defence and aerospace OEMs",
    description:
      "Connect Group's Ieper site holds AS9100D certification and produces IPC Class 3 electronics for defence and avionics OEMs. Serving NATO-aligned programmes in ruggedized electronics, secure communications, radar systems and airborne equipment.",
    revenueShare: "~5%",
    revenueBarWidth: "5%",
    revenueColor: "bg-red-600",
    certifications: ["AS9100D", "ISO 9001", "ISO 14001", "IPC A610 Class 3"],
    keyCapabilities: [
      "AS9100D certified PCBA at Ieper",
      "IPC Class 3 production standards",
      "Ruggedized electronics for harsh environments",
      "Conformal coating & potting for field-deployed systems",
      "Secure supply chain & component authentication",
      "Full traceability to MIL-spec requirements",
      "LCM for 15–25 year programme lifecycles",
      "Climatic & vibration testing",
    ],
    targetCustomers: [
      "Defence electronics OEMs (radar, comms, EW)",
      "Avionics system integrators",
      "Unmanned systems (UAV/UGV) manufacturers",
      "Naval electronics suppliers",
      "Secure communications equipment makers",
    ],
    painPoints: [
      "Stringent security & supply chain vetting requirements",
      "Long programme lifecycles with component obsolescence",
      "Export control compliance (ITAR, EAR)",
      "Qualification and first-article inspection overhead",
    ],
    brainName: "Connect Group - Defence & Avionics ICP",
    sites: ["Ieper (BE)"],
    highlight: "39% of Ieper revenue · AS9100D",
  },
];

const DIFFERENTIATORS = [
  {
    number: "1",
    title: "Strong Financial Foundation",
    body: "15% CAGR (2018–2024) vs 2.35% EU EMS market average. Ranked #20 in Europe's Top 25 EMS providers in 2025. >370M€ estimated 2025 turnover. Positive cash flow with continued reinvestment.",
    icon: "📈",
  },
  {
    number: "2",
    title: "Speed & Agility",
    body: "Large enough for global scale, agile enough for tailored solutions. 4 blocks: Europe, Americas, Asia + CTC virtual centre. Lean decision-making with local autonomy.",
    icon: "⚡",
  },
  {
    number: "3",
    title: "Truly Global, Truly Local",
    body: "8 production sites across 3 continents. 11 locations worldwide including sales offices. New US plant (Atlanta) operational Q1 2026. Proximity to customer plants in every major industrial region.",
    icon: "🌍",
  },
  {
    number: "4",
    title: "Beyond Traditional EMS",
    body: "Vertical integration: PCBA + Cable & Wire Systems + Module Building + CTC technology services. 22 SMT lines. From concept to market under one roof — design, prototyping, production, testing.",
    icon: "🔧",
  },
  {
    number: "5",
    title: "Specialized Market Expertise",
    body: "Certified in defence (AS9100D), medical (ISO 13485), automotive (IATF 16949), railway (IRIS), and infrastructure (UL508A). >180 customers, none exceeding 10% of turnover.",
    icon: "🎯",
  },
  {
    number: "6",
    title: "Efficient & Reliable Supply Chain",
    body: ">50,000 active components managed. Centralized strategic sourcing with commodity management. Local execution. Customer-oriented logistics. Expertise in both high-volume and high-mix.",
    icon: "🔗",
  },
  {
    number: "7",
    title: "Transparency & Digital Transformation",
    body: "Glass pipeline approach — complete visibility into supply chain and processes. AI, Cloud and Cybersecurity integration. Fully integrated ecosystem connecting data, suppliers, customers and machines.",
    icon: "🔍",
  },
  {
    number: "8",
    title: "Sustainability at Our Core",
    body: "Carbon neutral target 2035. 55% carbon emission reduction in 2025. 88% of manufacturing sites ISO 14001 certified. EcoVadis Top 8% overall. Aligned with UN SDGs 3, 5, 8, 12 and 13.",
    icon: "🌱",
  },
];

const KEY_FIGURES = [
  { label: "2025E Turnover", value: ">370M€" },
  { label: "CAGR 2018–2024", value: "15%" },
  { label: "Employees", value: ">2,700" },
  { label: "Production Sites", value: "8" },
  { label: "Locations Worldwide", value: "11" },
  { label: "Active Components", value: ">50,000" },
  { label: "SMT Lines", value: "22" },
  { label: "EU EMS Ranking", value: "Top 20" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConnectGroupMarket() {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">Connect Group</p>
        <h1 className="text-4xl font-black tracking-tight mb-2">Markets</h1>
        <p className="text-muted-foreground text-base max-w-2xl">
          Connect Group serves 6 regulated and industrial markets across 3 continents — combining EMS, Cable &amp; Wire Systems, Module Building and Technology Services under one roof.
        </p>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {KEY_FIGURES.map((f) => (
          <div key={f.label} className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-black">{f.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{f.label}</div>
          </div>
        ))}
      </div>

      {/* Mission quote */}
      <div className="border-l-4 border-foreground pl-5 mb-10">
        <p className="text-base italic text-muted-foreground">
          "To continuously improve the success of our customers by supplying the best Electronic Manufacturing and Technology Services."
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wide">Connect Group Mission</p>
      </div>

      {/* Market segments */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-black">Market Segments</h2>
        <span className="text-xs text-muted-foreground">Click a segment to expand</span>
      </div>

      <div className="space-y-3 mb-10">
        {SEGMENTS.map((seg) => {
          const isExpanded = activeSegment === seg.id;
          return (
            <div key={seg.id} className="border rounded-lg overflow-hidden">
              {/* Header row */}
              <button
                className="w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors"
                onClick={() => setActiveSegment(isExpanded ? null : seg.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <span className="text-3xl leading-none mt-0.5">{seg.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-black">{seg.name}</span>
                        {seg.highlight && (
                          <Badge variant="secondary" className="text-xs">
                            {seg.highlight}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{seg.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xl font-black">{seg.revenueShare}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${seg.revenueColor}`}
                          style={{ width: seg.revenueBarWidth }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">est. revenue share</span>
                    </div>
                    <span className="text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t bg-muted/20 px-6 py-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Description + Sites + Brain link */}
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Overview</div>
                        <p className="text-sm leading-relaxed">{seg.description}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Active Sites</div>
                        <div className="flex flex-wrap gap-1.5">
                          {seg.sites.map((s) => (
                            <span key={s} className="text-xs px-2 py-0.5 bg-muted border rounded font-medium">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Certifications</div>
                        <div className="flex flex-wrap gap-1.5">
                          {seg.certifications.map((c) => (
                            <span key={c} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      {seg.brainName && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">ICP Brain</div>
                          <Link href="/brain">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline cursor-pointer">
                              🧠 {seg.brainName}
                            </span>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Middle: Key capabilities */}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Capabilities</div>
                      <ul className="space-y-0.5">
                        {seg.keyCapabilities.map((c, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-muted-foreground mt-0.5">·</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Right: Target customers + Pain points */}
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Target Customers</div>
                        <ul className="space-y-0.5">
                          {seg.targetCustomers.map((c, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-muted-foreground mt-0.5">·</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Customer Pain Points</div>
                        <ul className="space-y-0.5">
                          {seg.painPoints.map((p, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-orange-500 mt-0.5">!</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Competitive differentiators toggle */}
      <div className="border rounded-lg overflow-hidden mb-8">
        <button
          className="w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors flex items-center justify-between"
          onClick={() => setShowDiff(!showDiff)}
        >
          <div>
            <div className="text-lg font-black">Why Connect Group — 8 Differentiators</div>
            <div className="text-sm text-muted-foreground">Financially strong · Agile · Transparent</div>
          </div>
          <span className="text-muted-foreground">{showDiff ? "▲" : "▼"}</span>
        </button>
        {showDiff && (
          <div className="border-t bg-muted/20 px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DIFFERENTIATORS.map((d) => (
                <div key={d.number} className="flex gap-4 p-4 border rounded-lg bg-background">
                  <div className="text-2xl leading-none mt-0.5">{d.icon}</div>
                  <div>
                    <div className="text-sm font-black mb-1">
                      {d.number}. {d.title}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{d.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sustainability footer */}
      <div className="border rounded-lg p-6 bg-green-50/50">
        <div className="flex items-start gap-4">
          <span className="text-3xl">🌱</span>
          <div>
            <div className="font-black text-base mb-1">Sustainability at Our Core</div>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Connect Group strives to be carbon neutral by 2035. In 2025, carbon emissions were reduced by more than 55%. 88% of manufacturing sites are ISO 14001 certified. EcoVadis Top 8% overall · Top 3% for Environmental Performance · Top 6% for Labour &amp; Human Rights. Aligned with UN SDGs 3, 5, 8, 12 and 13.
            </p>
            <div className="flex gap-3 mt-3 flex-wrap">
              {["ESRS", "GRI", "SASB", "EcoVadis", "UN SDGs"].map((f) => (
                <span key={f} className="text-xs px-2 py-0.5 bg-green-100 text-green-800 border border-green-200 rounded font-semibold">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
