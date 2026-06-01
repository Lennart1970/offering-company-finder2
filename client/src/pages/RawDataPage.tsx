import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function RawDataPage() {
  const [, navigate] = useLocation();
  const { data: searches = [], isLoading } = trpc.companyFinder.getSearchHistory.useQuery({ showArchived: false });

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="text-xs font-black text-muted-foreground mb-1">IMPORT / SYNC</div>
        <div className="text-3xl font-black">RAW DATA</div>
        <div className="text-sm text-gray-500 mt-1">
          Click any campaign to view its raw imported companies.
        </div>
      </div>

      {isLoading ? (
        <div className="border-4 border-black p-12 animate-pulse">
          <div className="text-xl font-black">→ LOADING...</div>
        </div>
      ) : searches.length === 0 ? (
        <div className="border-4 border-black p-12 text-center">
          <div className="text-xl font-black text-gray-400">NO IMPORTS YET</div>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((s: any) => (
            <div
              key={s.id}
              className="border-2 border-black px-5 py-4 cursor-pointer hover:bg-black hover:text-white transition-colors group flex items-center justify-between"
              onClick={() => navigate(`/import-preview/${s.id}`)}
            >
              <div>
                <div className="font-black text-sm">{s.offeringName}</div>
                <div className="text-xs text-gray-500 group-hover:text-gray-300 mt-0.5">
                  Run #{s.id} ·                   {s.companyCount ?? "?"} companies ·{" "}
                  {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""}
                </div>
              </div>
              <div className="text-xs font-black opacity-40 group-hover:opacity-80">
                VIEW RAW →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
