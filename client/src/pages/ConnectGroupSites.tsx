import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Site {
  id: string;
  city: string;
  country: string;
  flag: string;
  region: string;
  since: string;
  employees: number;
  area: string;
  type: string[];
  tagline: string;
  location: string;
  revenue?: { year: string; value: string }[];
  targetRevenue?: string;
  batch: string;
  mix: string;
  sectors: { name: string; pct: string; color: string }[];
  manufacturing: string[];
  engineering: string[];
  testing: string[];
  certifications: string[];
  investments: string[];
}

const SITES: Site[] = [
  {
    id: "ieper",
    city: "Ieper",
    country: "Belgium",
    flag: "🇧🇪",
    region: "Europe",
    since: "1995",
    employees: 100,
    area: "5,000 m²",
    type: ["EMS", "Box Building"],
    tagline: "High-performance products for harsh environments",
    location: "45 min from Lille airport · 1h30 from Brussels Airport",
    revenue: [
      { year: "2022", value: "28.3" },
      { year: "2023", value: "20.8" },
      { year: "2024", value: "25.1" },
      { year: "2025E", value: "24.6" },
    ],
    targetRevenue: "25M€",
    batch: "Low to Medium",
    mix: "Medium to High",
    sectors: [
      { name: "Defence & Avionics", pct: "39%", color: "bg-red-600" },
      { name: "Automotive & Off-Road", pct: "19%", color: "bg-blue-600" },
      { name: "Industrial", pct: "16%", color: "bg-orange-500" },
      { name: "Healthcare", pct: "7%", color: "bg-green-600" },
      { name: "Railway", pct: "3%", color: "bg-purple-600" },
    ],
    manufacturing: [
      "1 SMT Line",
      "LED Lighting Systems",
      "SemiAuto Through-hole Insertion and Pressfit",
      "Glueing / Conformal Coating / Potting",
      "Wash and No-Clean Solder Process",
      "Pin in Paste · Underfill",
      "Full process & part traceability",
      "PCB, Box Build, Complex integration",
      "Built to Order (BTO) / Configure to Order (CTO)",
    ],
    engineering: [
      "Industrial Prototype / NPI",
      "Production Services: DFx, DFM, DFA, DFT",
      "Component, Product, Process and Quality",
      "Life Cycle Management",
    ],
    testing: [
      "AOI, 2D/3D X-Ray, FPT, ICT, BSCan",
      "Functional and System Tests Development",
      "Vibratory Test · Climatic chambers",
    ],
    certifications: ["ISO 9001", "ISO 14001", "ISO 13485", "AS9100", "IPC A610 Class 2/3"],
    investments: [
      "New coating machine & coating area",
      "Semi auto Silicones dispensing",
      "Functional Test upgrade",
      "X-Ray components counting machine",
      "Flying Probe machine",
    ],
  },
  {
    id: "kampenhout",
    city: "Kampenhout",
    country: "Belgium",
    flag: "🇧🇪",
    region: "Europe",
    since: "—",
    employees: 150,
    area: "—",
    type: ["Cable / Harness", "Box Building", "FlexOps", "HQ"],
    tagline: "Headquarters · Fast Prototyping · FlexOps · Mechanical Workshop",
    location: "Brussels region — Group Headquarters",
    batch: "Prototype to Low",
    mix: "High Mix",
    sectors: [],
    manufacturing: [
      "Cable assembly & wire harness production",
      "FlexOps: co-engineering with minimal info & on-site measuring",
      "Mechanical workshop: modification of mechanical/plastic parts",
      "Design & produce CG own production tooling",
      "On-site finishing / assembly / product upgrade at client plants",
    ],
    engineering: [
      "Co-engineering & prototyping",
      "IPC-620 Cl2 / Cl3 Standard",
      "Flexible test solutions on request",
      "Work instructions, cutting list, lay board setup",
    ],
    testing: [
      "Electrical test on lay board",
      "Torque control 0.2 to 320 NM",
      "Crimp cross section · High voltage tester",
    ],
    certifications: ["IPC/WHMA-620 Class II & III", "ISO 9001", "ESD control"],
    investments: [
      "Dedicated FlexOps team for rapid on-site response",
      "Mechanical workshop for fast tooling & part modification",
    ],
  },
  {
    id: "san-sebastian",
    city: "San Sebastián",
    country: "Spain",
    flag: "🇪🇸",
    region: "Europe",
    since: "—",
    employees: 250,
    area: "9,000 m²",
    type: ["EMS", "Box Building", "Rapid Prototyping", "D&D"],
    tagline: "Rapid Prototyping · IATF16949 · Industrial & Railway focus",
    location: "45 min from Biarritz Airport · 1h from Bilbao airport",
    revenue: [
      { year: "2022", value: "32.3" },
      { year: "2023", value: "47.8" },
      { year: "2024", value: "44.4" },
      { year: "2025E", value: "48.5" },
    ],
    targetRevenue: "50M€",
    batch: "Low to Medium / Very High",
    mix: "Medium to High",
    sectors: [
      { name: "Industrial", pct: "55%", color: "bg-orange-500" },
      { name: "Railway", pct: "33%", color: "bg-purple-600" },
      { name: "Infrastructure", pct: "4%", color: "bg-slate-500" },
      { name: "Automotive & Off-Road", pct: "5%", color: "bg-blue-600" },
      { name: "Healthcare", pct: "3%", color: "bg-green-600" },
    ],
    manufacturing: [
      "2 SMT Lines (including 1 for Automotive)",
      "LED Lighting Systems",
      "SemiAuto Through-hole Insertion and Pressfit",
      "Glueing / Conformal Coating / Potting",
      "Wash and No-Clean Solder Process",
      "Pin in Paste · Underfill",
      "Full process & part traceability",
      "PCB, Box Build, Complex integration",
      "Built to Order (BTO) / Configure to Order (CTO)",
    ],
    engineering: [
      "Industrial Prototype / NPI",
      "Production Services: DFx, DFM, DFA, DFT",
      "Component, Product, Process and Quality",
      "Life Cycle Management",
    ],
    testing: [
      "AOI, 2D/3D X-Ray, FPT, ICT, BSCan",
      "Functional and System Tests Development",
    ],
    certifications: ["ISO 9001", "ISO 14001", "ISO 13485", "IATF16949", "IPC A610 Class 2/3"],
    investments: [
      "Building refurbishment for Solar & Energy consumption",
      "X-Ray components counting machine",
      "Intelligent vertical storage solutions",
    ],
  },
  {
    id: "kladno",
    city: "Kladno",
    country: "Czech Republic",
    flag: "🇨🇿",
    region: "Europe",
    since: "2007",
    employees: 200,
    area: "6,500 m² (→ 10,000 m²)",
    type: ["EMS", "Box Building"],
    tagline: "Railway & Infrastructure hub · IRIS certified · New building 2029",
    location: "15 min from Prague airport · 30 min from Prague city centre",
    revenue: [
      { year: "2022", value: "32.3" },
      { year: "2023", value: "44.4" },
      { year: "2024", value: "47.8" },
      { year: "2025E", value: "48.5" },
    ],
    targetRevenue: "48M€",
    batch: "Low to Medium",
    mix: "Medium to High",
    sectors: [
      { name: "Railway", pct: "39%", color: "bg-purple-600" },
      { name: "Infrastructure", pct: "38%", color: "bg-slate-500" },
      { name: "Industrial", pct: "21%", color: "bg-orange-500" },
      { name: "Healthcare", pct: "2%", color: "bg-green-600" },
    ],
    manufacturing: [
      "3 SMT Lines",
      "Through-hole Insertion and SemiAuto Pressfit",
      "Glueing / Conformal Coating / Potting",
      "2 selective + 2 wave soldering machines",
      "Full process & part traceability",
      "PCB, Box Build, Complex integration",
      "Built to Order (BTO) / Configure to Order (CTO)",
    ],
    engineering: [
      "Industrial Prototype / NPI",
      "Production Services: DFx, DFM, DFA, DFT",
      "Component, Product, Process and Quality",
      "Life Cycle Management",
    ],
    testing: [
      "AOI, 2D/3D X-Ray, FPT, ICT, BSCan",
      "Functional and System Tests Development",
      "High Voltage test",
    ],
    certifications: ["ISO 9001", "ISO 14001", "ISO 13485", "ISO 22163 (IRIS)", "IPC A610 Class 2/3"],
    investments: [
      "New washing machines",
      "New coating machine & coating area",
      "Semi- & Automatic Flying Probe Test",
      "X-Ray components counting machine",
      "New building — operational 2029",
    ],
  },
  {
    id: "oradea",
    city: "Oradea",
    country: "Romania",
    flag: "🇷🇴",
    region: "Europe",
    since: "2003",
    employees: 550,
    area: "18,000 m²",
    type: ["EMS", "CWS", "Box Building"],
    tagline: "Largest site · IATF16949 · ATEX · 128M€ target",
    location: "3h from Budapest airport · Direct rail network access",
    revenue: [
      { year: "2022", value: "58" },
      { year: "2023", value: "74.4" },
      { year: "2024", value: "76.4" },
      { year: "2025E", value: "76.5" },
    ],
    targetRevenue: "128M€",
    batch: "Medium to Very High",
    mix: "Low to Medium",
    sectors: [
      { name: "Industrial", pct: "49.7%", color: "bg-orange-500" },
      { name: "Infrastructure", pct: "23.1%", color: "bg-slate-500" },
      { name: "Automotive & Off-Road", pct: "13.7%", color: "bg-blue-600" },
      { name: "Railway", pct: "10.6%", color: "bg-purple-600" },
      { name: "Healthcare", pct: "2.8%", color: "bg-green-600" },
    ],
    manufacturing: [
      "6 SMT Lines (including 2 for Automotive)",
      "Through-hole Insertion and SemiAuto Pressfit",
      "LED Lighting Systems",
      "Glueing / Conformal Coating / Potting",
      "4 selective + 4 wave soldering machines",
      "Full process & part traceability",
      "PCB, Box Build, Complex integration",
      "Built to Order (BTO) / Configure to Order (CTO)",
    ],
    engineering: [
      "Industrial Prototype / NPI",
      "Production Services: DFx, DFM, DFA, DFT",
      "Component, Product, Process and Quality",
      "Life Cycle Management",
    ],
    testing: [
      "AOI, 2D/3D X-Ray, FPT, ICT, BSCan",
      "Functional and System Tests Development",
      "High Voltage Test",
    ],
    certifications: ["ISO 9001", "ISO 14001", "IATF16949", "UL ZPIV2-ZPIV8", "IPC A610 Class 2/3", "ATEX"],
    investments: [
      "Additional 5,000 m² automotive area with extra SMD line",
      "Intelligent vertical storage solutions",
      "X-Ray components counting machine",
    ],
  },
  {
    id: "guadalajara",
    city: "Guadalajara",
    country: "Mexico",
    flag: "🇲🇽",
    region: "Americas",
    since: "—",
    employees: 220,
    area: "10,000 m²",
    type: ["EMS"],
    tagline: "High Class Electronics · PCBA & Module Building",
    location: "Guadalajara, Mexico",
    batch: "Medium to High",
    mix: "Low to Medium",
    sectors: [],
    manufacturing: ["6 SMT Lines", "High Class Electronics", "PCBA and Module Building", "Production Center including prototyping"],
    engineering: ["NPI", "Production Services: DFx, DFM, DFA, DFT"],
    testing: ["Functional Test", "AOI"],
    certifications: ["ISO 9001"],
    investments: [],
  },
  {
    id: "suzhou",
    city: "Suzhou",
    country: "China",
    flag: "🇨🇳",
    region: "Asia",
    since: "—",
    employees: 280,
    area: "12,000 m²",
    type: ["EMS"],
    tagline: "High Class Electronics · PCBA & Module Building",
    location: "Suzhou, China",
    batch: "Medium to High",
    mix: "Low to Medium",
    sectors: [],
    manufacturing: ["3 SMT Lines", "High Class Electronics", "PCBA and Module Building", "Production Center including prototyping"],
    engineering: ["NPI", "Production Services: DFx, DFM, DFA, DFT"],
    testing: ["Functional Test", "AOI"],
    certifications: ["ISO 9001"],
    investments: [],
  },
];

const REGION_COLORS: Record<string, string> = {
  Europe: "bg-blue-100 text-blue-800",
  Americas: "bg-green-100 text-green-800",
  Asia: "bg-orange-100 text-orange-800",
};

function RevenueBar({ revenue, target }: { revenue: { year: string; value: string }[]; target?: string }) {
  if (!revenue || revenue.length === 0) return null;
  const max = Math.max(...revenue.map((r) => parseFloat(r.value)));
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Revenue (M€)</div>
      <div className="space-y-1.5">
        {revenue.map((r) => (
          <div key={r.year} className="flex items-center gap-2">
            <span className="text-xs w-12 text-muted-foreground">{r.year}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${(parseFloat(r.value) / (max * 1.1)) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold w-10 text-right">{r.value}</span>
          </div>
        ))}
      </div>
      {target && (
        <div className="mt-2 text-xs text-muted-foreground">
          Target: <span className="font-bold text-foreground">{target}</span>
        </div>
      )}
    </div>
  );
}

function SectorBreakdown({ sectors }: { sectors: Site["sectors"] }) {
  if (!sectors || sectors.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sector Mix</div>
      <div className="flex flex-wrap gap-1.5">
        {sectors.map((s) => (
          <span
            key={s.name}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium ${s.color}`}
          >
            {s.name} <span className="opacity-80">{s.pct}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CapabilityList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{title}</div>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground flex gap-2">
            <span className="text-muted-foreground mt-0.5">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ConnectGroupSites() {
  const [activeRegion, setActiveRegion] = useState<string>("All");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  const regions = ["All", "Europe", "Americas", "Asia"];
  const filtered = activeRegion === "All" ? SITES : SITES.filter((s) => s.region === activeRegion);
  const totalEmployees = SITES.reduce((sum, s) => sum + s.employees, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">Connect Group</p>
        <h1 className="text-4xl font-black tracking-tight mb-2">Production Sites</h1>
        <p className="text-muted-foreground text-base max-w-2xl">
          Truly Global · Truly Local — {SITES.length} sites across Europe, Americas and Asia, delivering EMS, Cable & Wire Systems, and Box Building for regulated and industrial markets.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Sites", value: SITES.length.toString() },
          { label: "Employees", value: totalEmployees.toLocaleString() + "+" },
          { label: "European Sites", value: SITES.filter((s) => s.region === "Europe").length.toString() },
          { label: "Continents", value: "3" },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-black">{stat.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Region filter */}
      <div className="flex gap-2 mb-6">
        {regions.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              activeRegion === r
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Site cards */}
      <div className="space-y-3">
        {filtered.map((site) => {
          const isExpanded = expandedSite === site.id;
          return (
            <div key={site.id} className="border rounded-lg overflow-hidden">
              {/* Site header row — clickable */}
              <button
                className="w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedSite(isExpanded ? null : site.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <span className="text-3xl leading-none mt-0.5">{site.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-black">{site.city}</span>
                        <span className="text-sm text-muted-foreground">{site.country}</span>
                        <Badge variant="outline" className={`text-xs ${REGION_COLORS[site.region]}`}>
                          {site.region}
                        </Badge>
                        {site.type.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{site.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <div className="text-xl font-black">{site.employees.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">employees</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{site.area}</div>
                      <div className="text-xs text-muted-foreground">floor area</div>
                    </div>
                    <span className="text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t bg-muted/20 px-6 py-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Overview + Revenue + Sectors */}
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Location</div>
                        <p className="text-sm">{site.location}</p>
                        {site.since !== "—" && (
                          <p className="text-xs text-muted-foreground mt-0.5">Operating since {site.since}</p>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Production Profile</div>
                        <p className="text-sm">Batch: <span className="font-medium">{site.batch}</span></p>
                        <p className="text-sm">Mix: <span className="font-medium">{site.mix}</span></p>
                      </div>
                      <RevenueBar revenue={site.revenue || []} target={site.targetRevenue} />
                      <SectorBreakdown sectors={site.sectors} />
                    </div>

                    {/* Middle: Manufacturing + Engineering */}
                    <div className="space-y-4">
                      <CapabilityList title="Manufacturing" items={site.manufacturing} />
                      <CapabilityList title="Engineering" items={site.engineering} />
                    </div>

                    {/* Right: Testing + Certs + Investments */}
                    <div className="space-y-4">
                      <CapabilityList title="Testing" items={site.testing} />
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Certifications</div>
                        <div className="flex flex-wrap gap-1.5">
                          {site.certifications.map((c) => (
                            <span
                              key={c}
                              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-medium"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      {site.investments.length > 0 && (
                        <CapabilityList title="Recent Investments" items={site.investments} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
