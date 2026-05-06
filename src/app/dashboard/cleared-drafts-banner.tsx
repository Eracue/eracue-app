"use client";

import { useState } from "react";

type Props = { count: number };

// Amber banner shown above the dashboard stat cards. Demo flavour: counts all
// `status='approved'` drafts as "not yet formally signed off" because the
// `principal_approved` action type doesn't exist in the schema yet. Once that
// action is wired up, the count should narrow to drafts with no such action.
export function ClearedDraftsBanner({ count }: Props) {
  const [showLearn, setShowLearn] = useState(false);

  if (count <= 0) return null;

  return (
    <div className="mb-6">
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm px-5 py-3 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
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
              {count} cleared {count === 1 ? "draft has" : "drafts have"} not been
              formally signed off by the designated principal.
            </div>
            <div className="font-mono text-[10px] text-[#92400E] mt-0.5">
              For a complete FINRA Rule 3110 supervisory record, each cleared
              draft should have an explicit principal approval.
            </div>
          </div>
        </div>
        <div className="flex gap-4 items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              alert("Bulk sign-off coming soon. Use individual draft review for now.")
            }
            className="bg-[#92400E] text-white font-mono text-xs px-4 py-1.5 rounded-sm hover:bg-[#7C3608] transition-colors"
          >
            Sign off all ({count})
          </button>
          <button
            type="button"
            onClick={() => setShowLearn((s) => !s)}
            className="font-mono text-xs text-[#92400E] cursor-pointer hover:underline"
          >
            {showLearn ? "Hide" : "Learn more"}
          </button>
        </div>
      </div>
      {showLearn && (
        <div className="mt-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-sm px-5 py-3 text-xs text-[#92400E] leading-relaxed">
          <span className="font-medium">Why this matters for FINRA Rule 3110.</span>{" "}
          Rule 3110(a) requires the designated principal to evidence supervisory
          review of every regulated communication — not just blocked or escalated
          ones. ERA CUE auto-clears drafts that pass all checks, but a defensible
          examination record needs an explicit principal sign-off on the cleared
          set as well. Bulk sign-off attaches a {`"principal_approved"`} action to
          each draft so the audit trail reads cleanly during a Rule 3110 review.
        </div>
      )}
    </div>
  );
}
