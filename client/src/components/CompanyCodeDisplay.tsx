import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

interface CompanyCodeDisplayProps {
  sicCodes: string | null;
  naicsCodes: string | null;
}

export default function CompanyCodeDisplay({ sicCodes, naicsCodes }: CompanyCodeDisplayProps) {
  // Parse codes
  const parsedSicCodes = useMemo(() => {
    if (!sicCodes) return [];
    try {
      return JSON.parse(sicCodes) as string[];
    } catch {
      return [];
    }
  }, [sicCodes]);

  const parsedNaicsCodes = useMemo(() => {
    if (!naicsCodes) return [];
    try {
      return JSON.parse(naicsCodes) as string[];
    } catch {
      return [];
    }
  }, [naicsCodes]);

  // Fetch descriptions
  const { data: sicDescriptions } = trpc.codeDescriptions.getSicDescriptions.useQuery(
    { codes: parsedSicCodes },
    { enabled: parsedSicCodes.length > 0 }
  );

  const { data: naicsDescriptions } = trpc.codeDescriptions.getNaicsDescriptions.useQuery(
    { codes: parsedNaicsCodes },
    { enabled: parsedNaicsCodes.length > 0 }
  );

  // Create lookup maps
  const sicMap = useMemo(() => {
    if (!sicDescriptions) return new Map<string, string | null>();
    return new Map(sicDescriptions.map(d => [d.code, d.description]));
  }, [sicDescriptions]);

  const naicsMap = useMemo(() => {
    if (!naicsDescriptions) return new Map<string, string | null>();
    return new Map(naicsDescriptions.map(d => [d.code, d.description]));
  }, [naicsDescriptions]);

  return (
    <>
      {parsedSicCodes.length > 0 && (
        <div className="md:col-span-2">
          <div className="font-black mb-1">SIC CODES</div>
          <div className="space-y-1">
            {parsedSicCodes.map((code) => {
              const description = sicMap.get(code);
              return (
                <div key={code} className="font-bold">
                  {code}{description ? ` — ${description}` : ""}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {parsedNaicsCodes.length > 0 && (
        <div className="md:col-span-2">
          <div className="font-black mb-1">NAICS CODES</div>
          <div className="space-y-1">
            {parsedNaicsCodes.map((code) => {
              const description = naicsMap.get(code);
              return (
                <div key={code} className="font-bold">
                  {code}{description ? ` — ${description}` : ""}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
