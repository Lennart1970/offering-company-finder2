import { useState } from "react";
import { NAICS_SECTORS, NAICS_SECTOR_REALITY, getCodeLevel } from "@shared/naicsHierarchy";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const LEVEL_LABELS: Record<string, string> = {
  sector: "Sector",
  subsector: "Subsector",
  industry_group: "Industry Group",
  industry: "Industry",
  national: "National",
};

const LEVEL_COLORS: Record<string, string> = {
  sector: "bg-blue-600 text-white border-blue-600",
  subsector: "bg-blue-500 text-white border-blue-500",
  industry_group: "bg-blue-100 text-blue-800 border-blue-400",
  industry: "bg-white text-blue-700 border-blue-300",
  national: "bg-white text-blue-600 border-blue-200",
};

function groupNaicsBySector(codes: string[]): Record<string, { label: string; reality: string; codes: { code: string; level: string }[] }> {
  const grouped: Record<string, { label: string; reality: string; codes: { code: string; level: string }[] }> = {};

  for (const code of codes) {
    const sector = code.substring(0, 2);
    if (!grouped[sector]) {
      grouped[sector] = {
        label: NAICS_SECTORS[sector] || "Unknown",
        reality: NAICS_SECTOR_REALITY[sector] || "Unknown",
        codes: [],
      };
    }
    grouped[sector].codes.push({ code, level: getCodeLevel(code) });
  }

  return grouped;
}

function groupSicByMajor(codes: string[]): Record<string, { codes: { code: string; level: string }[] }> {
  const grouped: Record<string, { codes: { code: string; level: string }[] }> = {};

  for (const code of codes) {
    const major = code.substring(0, 2);
    if (!grouped[major]) {
      grouped[major] = { codes: [] };
    }
    grouped[major].codes.push({ code, level: getCodeLevel(code) });
  }

  return grouped;
}

interface Props {
  sicCodes: string[];
  naicsCodes: string[];
  reasoning: string | null;
  searchId: number;
  excludedSectors: string[];
  onExcludedSectorsChange: (sectors: string[]) => void;
}

export default function SelectedCodesDisplay({ sicCodes, naicsCodes, reasoning, searchId, excludedSectors, onExcludedSectorsChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Deduplicate codes as safety net (LLM may return duplicates)
  const uniqueNaics = Array.from(new Set(naicsCodes));
  const uniqueSic = Array.from(new Set(sicCodes));
  const naicsGrouped = groupNaicsBySector(uniqueNaics);
  const sicGrouped = groupSicByMajor(uniqueSic);

  const excludedSet = new Set(excludedSectors);

  const activeSectors = Object.keys(naicsGrouped).filter(s => !excludedSet.has(s));
  const excludedSectorsList = Object.keys(naicsGrouped).filter(s => excludedSet.has(s));

  // Count active codes (excluding excluded sectors)
  const activeNaicsCount = uniqueNaics.filter(code => !excludedSet.has(code.substring(0, 2))).length;
  const activeSectorCount = activeSectors.length;

  const updateExcludedSectors = trpc.companyFinder.updateExcludedSectors.useMutation({
    onError: (error) => {
      toast.error(`Failed to update exclusions: ${error.message}`);
    },
  });

  const toggleSector = (sector: string) => {
    let newExcluded: string[];
    if (excludedSet.has(sector)) {
      newExcluded = excludedSectors.filter(s => s !== sector);
      toast.success(`Sector ${sector} — ${NAICS_SECTORS[sector] || "Unknown"} re-included`);
    } else {
      newExcluded = [...excludedSectors, sector];
      const codesInSector = naicsGrouped[sector]?.codes.length || 0;
      toast.success(`Sector ${sector} — ${NAICS_SECTORS[sector] || "Unknown"} excluded (${codesInSector} codes removed)`);
    }
    onExcludedSectorsChange(newExcluded);
    updateExcludedSectors.mutate({ searchId, excludedSectors: newExcluded });
  };

  return (
    <div className="mt-8 p-6 border-4 border-blue-600 bg-blue-50">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-sm font-black text-blue-600">
          🎯 INDUSTRY CODE TARGETING ({activeNaicsCount} NAICS across {activeSectorCount} sectors + {uniqueSic.length} SIC)
          {excludedSectorsList.length > 0 && (
            <span className="ml-2 text-red-600">
              [{excludedSectorsList.length} sector{excludedSectorsList.length > 1 ? "s" : ""} excluded]
            </span>
          )}
        </div>
        <span className="text-blue-600 font-black text-lg">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Sector summary — clickable to toggle exclusion */}
      <div className="mt-2 mb-1 text-xs text-gray-500 italic">Click a sector card to exclude/include it from filtering</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(naicsGrouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([sector, group]) => {
            const isExcluded = excludedSet.has(sector);
            return (
              <div
                key={sector}
                onClick={(e) => { e.stopPropagation(); toggleSector(sector); }}
                className={`border-2 px-3 py-2 text-xs cursor-pointer transition-all select-none ${
                  isExcluded
                    ? "border-red-400 bg-red-50 opacity-60 line-through"
                    : "border-blue-600 bg-white hover:bg-blue-100"
                }`}
              >
                <div className={`font-black ${isExcluded ? "text-red-400" : "text-blue-600"}`}>
                  {sector} — {group.label}
                  {isExcluded && <span className="ml-1 no-underline text-red-600">✕</span>}
                </div>
                <div className={`italic ${isExcluded ? "text-red-300" : "text-gray-500"}`}>{group.reality}</div>
                <div className={`mt-1 ${isExcluded ? "text-red-400" : "text-gray-600"}`}>
                  {group.codes.length} code{group.codes.length > 1 ? "s" : ""}
                </div>
              </div>
            );
          })}
      </div>

      {expanded && (
        <div className="mt-6 space-y-6">
          {/* NAICS Hierarchy */}
          <div>
            <div className="text-xs font-black mb-3">NAICS CODES — HIERARCHICAL VIEW</div>
            <div className="text-xs text-gray-500 mb-3">
              Broader codes (2-3 digits) match ALL companies in that sector/subsector. Specific codes (4-6 digits) target niche industries.
            </div>
            {Object.entries(naicsGrouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([sector, group]) => {
                const isExcluded = excludedSet.has(sector);
                return (
                  <div key={sector} className={`mb-4 ${isExcluded ? "opacity-40 line-through" : ""}`}>
                    <div className="text-xs font-black text-blue-800 mb-2">
                      {sector} — {group.label} <span className="font-normal text-gray-500">({group.reality})</span>
                      {isExcluded && <span className="ml-2 text-red-600 font-black no-underline">[EXCLUDED]</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.codes
                        .sort((a, b) => a.code.localeCompare(b.code))
                        .map((item, i) => (
                          <span
                            key={i}
                            className={`border-2 px-2 py-0.5 text-xs font-bold ${
                              isExcluded ? "bg-gray-100 text-gray-400 border-gray-300" : (LEVEL_COLORS[item.level] || LEVEL_COLORS.national)
                            }`}
                            title={`${LEVEL_LABELS[item.level] || "Code"} level`}
                          >
                            {item.code}
                            <span className="ml-1 text-[10px] opacity-60">{LEVEL_LABELS[item.level]?.charAt(0) || ""}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* SIC Codes */}
          <div>
            <div className="text-xs font-black mb-3">SIC CODES — BY MAJOR GROUP</div>
            {Object.entries(sicGrouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([major, group]) => (
                <div key={major} className="mb-3">
                  <div className="text-xs font-black text-blue-800 mb-1">Major Group {major}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.codes
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((item, i) => (
                        <span
                          key={i}
                          className={`border-2 px-2 py-0.5 text-xs font-bold ${LEVEL_COLORS[item.level] || LEVEL_COLORS.national}`}
                        >
                          {item.code}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Reasoning */}
          {reasoning && (
            <div>
              <div className="text-xs font-black mb-2">LLM REASONING</div>
              <div className="text-sm font-bold bg-white p-4 border-2 border-blue-300">{reasoning}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
