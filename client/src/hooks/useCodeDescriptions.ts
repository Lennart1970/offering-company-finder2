import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Hook to fetch and format SIC/NAICS code descriptions
 */
export function useCodeDescriptions(sicCodes: string[] | null, naicsCodes: string[] | null) {
  // Fetch SIC descriptions
  const { data: sicDescriptions } = trpc.codeDescriptions.getSicDescriptions.useQuery(
    { codes: sicCodes || [] },
    { enabled: !!sicCodes && sicCodes.length > 0 }
  );

  // Fetch NAICS descriptions
  const { data: naicsDescriptions } = trpc.codeDescriptions.getNaicsDescriptions.useQuery(
    { codes: naicsCodes || [] },
    { enabled: !!naicsCodes && naicsCodes.length > 0 }
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

  return {
    getSicDescription: (code: string) => sicMap.get(code) || null,
    getNaicsDescription: (code: string) => naicsMap.get(code) || null,
    isLoading: !sicDescriptions || !naicsDescriptions,
  };
}
