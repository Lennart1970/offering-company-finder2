import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function SearchHistory() {
  const [, setLocation] = useLocation();
  const { data: searches, isLoading } = trpc.companyFinder.getSearchHistory.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl font-black animate-pulse">LOADING HISTORY...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-6xl md:text-8xl font-black leading-none">
              [SEARCH
              <br />
              HISTORY]
            </h1>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="text-xl px-8 py-6 font-black border-4 border-black hover:bg-black hover:text-white"
            >
              NEW SEARCH
            </Button>
          </div>
          <div className="h-2 bg-black w-full"></div>
        </div>

        {/* Search List */}
        {!searches || searches.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl font-black mb-4">NO SEARCHES YET</div>
            <div className="text-xl font-bold mb-8">Start your first company search</div>
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="text-xl px-8 py-6 font-black border-4 border-black"
            >
              CREATE SEARCH
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {searches.map((search) => (
              <div
                key={search.id}
                onClick={() => setLocation(`/?searchId=${search.id}`)}
                className="border-4 border-black p-8 hover:bg-black hover:text-white transition-colors cursor-pointer"
              >
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="md:col-span-2">
                    <div className="text-sm font-black mb-2">COMPANY</div>
                    <div className="text-2xl font-black break-all">{search.companyWebsite}</div>
                  </div>
                  <div>
                    <div className="text-sm font-black mb-2">LOCATION</div>
                    <div className="text-xl font-bold">{search.location}</div>
                  </div>
                  <div>
                    <div className="text-sm font-black mb-2">DATE</div>
                    <div className="text-lg font-bold">
                      {formatDistanceToNow(new Date(search.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>

                {search.offeringName && (
                  <div className="mt-6 pt-6 border-t-2 border-current">
                    <div className="text-sm font-black mb-2">OFFERING</div>
                    <div className="text-xl font-black">{search.offeringName}</div>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-black px-4 py-2 border-2 border-current ${
                        search.status === "completed"
                          ? "bg-current text-white"
                          : search.status === "failed"
                            ? "bg-destructive text-destructive-foreground"
                            : ""
                      }`}
                    >
                      {search.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-lg font-black">
                    CLICK TO VIEW →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
