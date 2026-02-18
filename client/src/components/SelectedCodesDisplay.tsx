import { useState } from "react";
import { NAICS_SECTORS, NAICS_SECTOR_REALITY, getCodeLevel } from "@shared/naicsHierarchy";

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
}

export default function SelectedCodesDisplay({ sicCodes, naicsCodes, reasoning }: Props) {
  const [expanded, setExpanded] = useState(false);
  const naicsGrouped = groupNaicsBySector(naicsCodes);
  const sicGrouped = groupSicByMajor(sicCodes);

  const sectorCount = Object.keys(naicsGrouped).length;

  return (
    <div className="mt-8 p-6 border-4 border-blue-600 bg-blue-50">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-sm font-black text-blue-600">
          🎯 INDUSTRY CODE TARGETING ({naicsCodes.length} NAICS across {sectorCount} sectors + {sicCodes.length} SIC)
        </div>
        <span className="text-blue-600 font-black text-lg">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Always show sector summary */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(naicsGrouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([sector, group]) => (
            <div
              key={sector}
              className="border-2 border-blue-600 bg-white px-3 py-2 text-xs"
            >
              <div className="font-black text-blue-600">{sector} — {group.label}</div>
              <div className="text-gray-500 italic">{group.reality}</div>
              <div className="text-gray-600 mt-1">{group.codes.length} code{group.codes.length > 1 ? "s" : ""}</div>
            </div>
          ))}
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
              .map(([sector, group]) => (
                <div key={sector} className="mb-4">
                  <div className="text-xs font-black text-blue-800 mb-2">
                    {sector} — {group.label} <span className="font-normal text-gray-500">({group.reality})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.codes
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((item, i) => (
                        <span
                          key={i}
                          className={`border-2 px-2 py-0.5 text-xs font-bold ${LEVEL_COLORS[item.level] || LEVEL_COLORS.national}`}
                          title={`${LEVEL_LABELS[item.level] || "Code"} level`}
                        >
                          {item.code}
                          <span className="ml-1 text-[10px] opacity-60">{LEVEL_LABELS[item.level]?.charAt(0) || ""}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
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
