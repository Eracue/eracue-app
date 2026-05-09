type Props = { count: number };

// Amber banner shown above the dashboard stat cards. Surfaces the
// system-cleared count and frames the supervisory-evidence point
// without making a determination about what constitutes a complete
// FINRA Rule 3110 record — that is a question for qualified counsel,
// not a system call. The bulk-sign-off button was removed for the
// same reason: a button that implies ERA CUE judges supervisory
// completeness reads as a legal determination.
export function ClearedDraftsBanner({ count }: Props) {
  if (count <= 0) return null;

  return (
    <div className="mb-6">
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm px-5 py-3 flex items-center gap-4">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#92400E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="min-w-0">
          <div className="text-sm text-[#92400E]">
            {count} approved {count === 1 ? "communication" : "communications"} on
            record. Principal review creates the strongest supervisory
            evidence. Consult qualified counsel on your firm&apos;s
            supervision requirements.
          </div>
        </div>
      </div>
    </div>
  );
}
