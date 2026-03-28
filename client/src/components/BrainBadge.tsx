/**
 * BrainBadge — Shows which Offering Brain was used to generate a company's outputs.
 * Displays a purple badge with the brain name.
 * If the active brain differs from the generation brain, shows an amber mismatch warning.
 *
 * Usage:
 *   <BrainBadge
 *     generatedWithBrainId={company.generatedWithBrainId}
 *     generatedWithBrainName={company.generatedWithBrainName}
 *     activeBrainId={activeBrain?.id}
 *     activeBrainName={activeBrain?.brainName}
 *   />
 */

interface BrainBadgeProps {
  generatedWithBrainId: number | null | undefined;
  generatedWithBrainName: string | null | undefined;
  activeBrainId?: number | null;
  activeBrainName?: string | null;
  /** Compact mode — smaller text, no mismatch detail */
  compact?: boolean;
}

export default function BrainBadge({
  generatedWithBrainId,
  generatedWithBrainName,
  activeBrainId,
  activeBrainName,
  compact = false,
}: BrainBadgeProps) {
  // Nothing to show if no brain was stamped
  if (!generatedWithBrainId || !generatedWithBrainName) return null;

  const isMismatch =
    activeBrainId != null &&
    generatedWithBrainId != null &&
    activeBrainId !== generatedWithBrainId;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
          isMismatch
            ? "border border-amber-400 bg-amber-50 text-amber-700"
            : "border border-purple-300 bg-purple-50 text-purple-700"
        }`}
        title={
          isMismatch
            ? `Generated with "${generatedWithBrainName}" — active brain is "${activeBrainName}"`
            : `Generated with brain: ${generatedWithBrainName}`
        }
      >
        {isMismatch && (
          <svg className="w-3 h-3 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        )}
        {generatedWithBrainName}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-0.5">
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 ${
          isMismatch
            ? "border-2 border-amber-400 bg-amber-50 text-amber-800"
            : "border-2 border-purple-400 bg-purple-50 text-purple-800"
        }`}
      >
        {isMismatch ? (
          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="text-sm">🧠</span>
        )}
        {generatedWithBrainName}
      </span>
      {isMismatch && (
        <span className="text-[10px] font-medium text-amber-600 pl-0.5">
          Active brain is now "{activeBrainName}" — outputs may be stale
        </span>
      )}
    </div>
  );
}
