import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABELS: Record<string, string> = {
  research: "Research",
  qualification: "Qualification",
  outreach: "Outreach",
  extraction: "Extraction",
  classification: "Classification",
  coaching: "Coaching",
};

const CATEGORY_ORDER = [
  "research",
  "qualification",
  "outreach",
  "extraction",
  "classification",
  "coaching",
];

export default function PromptRepository() {
  const { data: prompts, isLoading } = trpc.prompts.list.useQuery();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const grouped = prompts
    ? CATEGORY_ORDER.reduce<Record<string, typeof prompts>>((acc, cat) => {
        const items = prompts.filter((p) => p.category === cat);
        if (items.length > 0) acc[cat] = items;
        return acc;
      }, {})
    : {};

  const filtered =
    activeCategory === "all"
      ? grouped
      : Object.fromEntries(
          Object.entries(grouped).filter(([cat]) => cat === activeCategory)
        );

  const totalCount = prompts?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Prompt Repository
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          All {totalCount} AI prompts used in this application — versioned,
          categorised, and auditable.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
            activeCategory === "all"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          All ({totalCount})
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const count = grouped[cat]?.length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                activeCategory === cat
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="text-sm text-gray-400 py-12 text-center">
          Loading prompts…
        </div>
      )}

      {/* Prompt groups */}
      {Object.entries(filtered).map(([category, items]) => (
        <div key={category} className="mb-10">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="space-y-3">
            {items.map((prompt) => {
              const isExpanded = expandedKey === prompt.key;
              return (
                <Card
                  key={prompt.key}
                  className="border border-gray-200 shadow-none rounded-lg overflow-hidden"
                >
                  <CardHeader
                    className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      setExpandedKey(isExpanded ? null : prompt.key)
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-sm font-semibold text-gray-900">
                            {prompt.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-mono text-gray-400 border-gray-200"
                          >
                            v{prompt.version}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {prompt.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <code className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {prompt.key}
                        </code>
                        <span className="text-gray-300 text-sm">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="px-5 pb-5 pt-0 border-t border-gray-100">
                      {/* System Prompt */}
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          System Prompt
                        </p>
                        <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-mono leading-relaxed">
                          {prompt.systemPrompt}
                        </pre>
                      </div>

                      {/* User Prompt Template */}
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          User Prompt Template
                        </p>
                        <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
                          {prompt.userPromptTemplate}
                        </pre>
                      </div>

                      {/* Output Format */}
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          Output Format
                        </p>
                        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded p-3">
                          {prompt.outputFormat}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
