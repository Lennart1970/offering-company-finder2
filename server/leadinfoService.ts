/**
 * Leadinfo Import Service
 *
 * Parses Leadinfo Excel exports (Companies + Page views sheets),
 * normalises domains, matches against campaign companies, computes
 * engagement scores and intent signals.
 */

import * as XLSX from "xlsx";

// ── Types ────────────────────────────────────────────────────────────────

export interface LeadinfoCompany {
  companyName: string;
  city: string;
  country: string;
  salesRegion: string;
  employees: number | null;
  branch: string;
  url: string;
  domain: string; // normalised root domain
  pages: number;
  sessions: number;
  duration: number; // seconds
  linkedinUrl: string;
  salesVolume: string;
}

export interface LeadinfoPageView {
  companyName: string;
  visitingTime: Date | null;
  pageUrl: string;
  pageTitle: string;
  duration: number; // seconds
  referrer: string;
  term: string;
  campaign: string;
  adGroup: string;
  personaFirstName: string;
  personaLastName: string;
  personaEmail: string;
  personaJobTitle: string;
}

export interface LeadinfoPersona {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
}

export interface ParsedLeadinfoData {
  companies: LeadinfoCompany[];
  pageViews: LeadinfoPageView[];
  warnings: string[];
}

export interface EnrichedLeadinfoCompany extends LeadinfoCompany {
  engagementScore: number;
  pagesViewed: Array<{ url: string; title: string; duration: number; visitedAt: string | null }>;
  topPages: string[];
  intentSignals: string[];
  personas: LeadinfoPersona[];
}

export interface MatchResult {
  leadinfoCompany: EnrichedLeadinfoCompany;
  matchedCompanyId: number | null;
  matchedCompanyName: string | null;
  matchType: "exact_domain" | "fuzzy_domain" | "unmatched";
}

// ── Domain Normalisation ─────────────────────────────────────────────────

/**
 * Strip a URL to its root domain: "https://www.example.com/page" → "example.com"
 */
export function normaliseDomain(urlOrDomain: string): string {
  if (!urlOrDomain) return "";
  let d = urlOrDomain.trim().toLowerCase();
  // Remove protocol
  d = d.replace(/^https?:\/\//, "");
  // Remove port
  d = d.replace(/:\d+/, "");
  // Remove path/query/hash
  d = d.split("/")[0].split("?")[0].split("#")[0];
  // Remove www prefix
  d = d.replace(/^www\./, "");
  return d;
}

// ── Intent Signal Detection ──────────────────────────────────────────────

// Generic intent patterns that work for any B2B offering.
// Product-specific page patterns (e.g., PCB, cable) are no longer hardcoded.
// The engagement score and page-view count already capture depth of interest.
const INTENT_PATTERNS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /contact/i, signal: "Visited contact page", weight: 3 },
  { pattern: /services|diensten|servicii|solutions|capabilities/i, signal: "Browsed services/capabilities", weight: 2 },
  { pattern: /product|offering|solution/i, signal: "Viewed product/offering pages", weight: 2 },
  { pattern: /case.?stud|reference|portfolio/i, signal: "Viewed case studies/references", weight: 2 },
  { pattern: /pric|tarif|cost|quote|offerte|rfq/i, signal: "Viewed pricing / requested quote", weight: 4 },
  { pattern: /demo|trial|free|sample/i, signal: "Explored demo/trial options", weight: 3 },
  { pattern: /about|over.?ons|team|company/i, signal: "Checked company info", weight: 1 },
  { pattern: /location|vestiging|locatie|office/i, signal: "Checked locations", weight: 1 },
  { pattern: /vacanc|vacatur|career|baan|job/i, signal: "Viewed careers (hiring signal)", weight: 1 },
  { pattern: /news|nieuws|stiri|blog|article/i, signal: "Read news/updates", weight: 1 },
  { pattern: /sustainab|duurzaam|esg|csr/i, signal: "Checked sustainability/ESG", weight: 1 },
  { pattern: /partner|integrat|reseller/i, signal: "Explored partnerships", weight: 2 },
];

function detectIntentSignals(pageViews: LeadinfoPageView[]): string[] {
  const signals = new Set<string>();
  for (const pv of pageViews) {
    const text = `${pv.pageUrl} ${pv.pageTitle}`;
    for (const { pattern, signal } of INTENT_PATTERNS) {
      if (pattern.test(text)) signals.add(signal);
    }
  }
  return Array.from(signals);
}

// ── Engagement Score ─────────────────────────────────────────────────────

/**
 * Compute engagement score: sessions × log(duration+1) × pageDepthMultiplier
 * Higher = more engaged visitor. Range roughly 0-100.
 */
function computeEngagementScore(sessions: number, duration: number, pages: number): number {
  const durationFactor = Math.log(duration + 1); // 0 for 0s, ~7 for 1000s
  const pageDepth = Math.min(pages / 3, 3); // cap at 3x for 9+ pages
  const raw = sessions * durationFactor * Math.max(pageDepth, 0.5);
  return Math.min(Math.round(raw), 100);
}

// ── Excel Parser ─────────────────────────────────────────────────────────

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  // Leadinfo format: "DD-MM-YYYY HH:MM:SS"
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function parseLeadinfoExcel(buffer: Buffer): ParsedLeadinfoData {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const warnings: string[] = [];

  // ── Companies sheet ──────────────────────────────────────────────────
  const companiesSheet = wb.Sheets["Companies"];
  if (!companiesSheet) {
    warnings.push("Missing 'Companies' sheet — looking for first sheet instead.");
  }
  const compSheet = companiesSheet || wb.Sheets[wb.SheetNames[0]];
  const compRows: any[] = XLSX.utils.sheet_to_json(compSheet, { defval: "" });

  const companies: LeadinfoCompany[] = compRows.map((row) => {
    const url = String(row["URL"] || row["url"] || row["Website"] || "").trim();
    const employeesRaw = row["Employees"] || row["employees"];
    return {
      companyName: String(row["Company Name"] || row["company_name"] || row["Name"] || "").trim(),
      city: String(row["City"] || row["city"] || "").trim(),
      country: String(row["Country"] || row["country"] || "").trim(),
      salesRegion: String(row["SALES REGION"] || row["Sales Region"] || row["sales_region"] || "").trim(),
      employees: employeesRaw ? Math.round(Number(employeesRaw)) || null : null,
      branch: String(row["Branch"] || row["branch"] || row["Industry"] || "").trim(),
      url,
      domain: normaliseDomain(url),
      pages: Number(row["Pages"] || row["pages"] || 0),
      sessions: Number(row["Sessions"] || row["sessions"] || 0),
      duration: Number(row["Duration"] || row["duration"] || 0),
      linkedinUrl: String(row["LinkedIn"] || row["linkedin"] || "").trim(),
      salesVolume: String(row["Sales volume"] || row["sales_volume"] || "").trim(),
    };
  }).filter((c) => c.companyName && c.domain);

  // ── Page views sheet ─────────────────────────────────────────────────
  const pvSheet = wb.Sheets["Page views"] || wb.Sheets["Pageviews"] || wb.Sheets[wb.SheetNames[1]];
  const pageViews: LeadinfoPageView[] = [];
  if (pvSheet) {
    const pvRows: any[] = XLSX.utils.sheet_to_json(pvSheet, { defval: "" });
    for (const row of pvRows) {
      pageViews.push({
        companyName: String(row["Name"] || row["Company Name"] || "").trim(),
        visitingTime: parseDate(row["Visiting time"] || row["visiting_time"]),
        pageUrl: String(row["Page URL"] || row["page_url"] || "").trim(),
        pageTitle: String(row["Page title"] || row["page_title"] || "").trim(),
        duration: Number(row["Duration"] || row["duration"] || 0),
        referrer: String(row["Referrer"] || row["referrer"] || "").trim(),
        term: String(row["Term"] || row["term"] || "").trim(),
        campaign: String(row["Campaign"] || row["campaign"] || "").trim(),
        adGroup: String(row["Ad group"] || row["ad_group"] || "").trim(),
        personaFirstName: String(row["Persona First name"] || row["persona_first_name"] || "").trim(),
        personaLastName: String(row["Persona Last name"] || row["persona_last_name"] || "").trim(),
        personaEmail: String(row["Persona Email address"] || row["persona_email"] || "").trim(),
        personaJobTitle: String(row["Persona Job Title"] || row["persona_job_title"] || "").trim(),
      });
    }
  } else {
    warnings.push("No 'Page views' sheet found — engagement details will be limited.");
  }

  if (companies.length === 0) {
    warnings.push("No companies found in the Excel file.");
  }

  return { companies, pageViews, warnings };
}

// ── Enrichment: merge page views into companies ──────────────────────────

export function enrichCompanies(
  companies: LeadinfoCompany[],
  pageViews: LeadinfoPageView[]
): EnrichedLeadinfoCompany[] {
  // Group page views by company name (case-insensitive)
  const pvByCompany = new Map<string, LeadinfoPageView[]>();
  for (const pv of pageViews) {
    const key = pv.companyName.toLowerCase();
    if (!pvByCompany.has(key)) pvByCompany.set(key, []);
    pvByCompany.get(key)!.push(pv);
  }

  return companies.map((c) => {
    const companyPvs = pvByCompany.get(c.companyName.toLowerCase()) || [];

    // Build pages viewed list
    const pagesViewed = companyPvs.map((pv) => ({
      url: pv.pageUrl,
      title: pv.pageTitle,
      duration: pv.duration,
      visitedAt: pv.visitingTime ? pv.visitingTime.toISOString() : null,
    }));

    // Top pages by frequency
    const pageCounts = new Map<string, number>();
    for (const pv of companyPvs) {
      const title = pv.pageTitle || pv.pageUrl;
      pageCounts.set(title, (pageCounts.get(title) || 0) + 1);
    }
    const topPages = Array.from(pageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title]) => title);

    // Intent signals
    const intentSignals = detectIntentSignals(companyPvs);

    // Personas (deduplicated by email)
    const personaMap = new Map<string, LeadinfoPersona>();
    for (const pv of companyPvs) {
      if (pv.personaEmail || pv.personaFirstName) {
        const key = pv.personaEmail || `${pv.personaFirstName}_${pv.personaLastName}`;
        if (!personaMap.has(key)) {
          personaMap.set(key, {
            firstName: pv.personaFirstName,
            lastName: pv.personaLastName,
            email: pv.personaEmail,
            jobTitle: pv.personaJobTitle,
          });
        }
      }
    }

    // Engagement score
    const totalDuration = companyPvs.reduce((sum, pv) => sum + pv.duration, 0) || c.duration;
    const engagementScore = computeEngagementScore(
      c.sessions || 1,
      totalDuration,
      c.pages || companyPvs.length
    );

    return {
      ...c,
      duration: totalDuration || c.duration,
      engagementScore,
      pagesViewed,
      topPages,
      intentSignals,
      personas: Array.from(personaMap.values()),
    };
  });
}

// ── Domain Matching ──────────────────────────────────────────────────────

interface CampaignCompany {
  id: number;
  name: string;
  primaryDomain: string | null;
  websiteUrl: string | null;
}

export function matchCompaniesToCampaign(
  enrichedCompanies: EnrichedLeadinfoCompany[],
  campaignCompanies: CampaignCompany[]
): MatchResult[] {
  // Build domain → company lookup from campaign
  const domainToCompany = new Map<string, CampaignCompany>();
  for (const cc of campaignCompanies) {
    const d1 = normaliseDomain(cc.primaryDomain || "");
    const d2 = normaliseDomain(cc.websiteUrl || "");
    if (d1) domainToCompany.set(d1, cc);
    if (d2 && d2 !== d1) domainToCompany.set(d2, cc);
  }

  return enrichedCompanies.map((lc) => {
    // Exact domain match
    const exact = domainToCompany.get(lc.domain);
    if (exact) {
      return {
        leadinfoCompany: lc,
        matchedCompanyId: exact.id,
        matchedCompanyName: exact.name,
        matchType: "exact_domain" as const,
      };
    }

    // Fuzzy: try matching without TLD (e.g. "eaton" matches "eaton.com")
    const baseName = lc.domain.split(".")[0];
    if (baseName.length >= 4) {
      for (const [campDomain, cc] of Array.from(domainToCompany.entries())) {
        const campBase = campDomain.split(".")[0];
        if (campBase === baseName) {
          return {
            leadinfoCompany: lc,
            matchedCompanyId: cc.id,
            matchedCompanyName: cc.name,
            matchType: "fuzzy_domain" as const,
          };
        }
      }
    }

    return {
      leadinfoCompany: lc,
      matchedCompanyId: null,
      matchedCompanyName: null,
      matchType: "unmatched" as const,
    };
  });
}
