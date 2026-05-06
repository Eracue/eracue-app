"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewerDecisionAction } from "./actions";

type Props = {
  draftId: string;
  currentStatus: string;
  verdict: string;
};

export function ReviewerDecisionForm({ draftId, currentStatus, verdict }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Determine button options based on current verdict/status
  const isBlocked = currentStatus === "blocked" || verdict === "block";
  const isEscalated = currentStatus === "escalated" || verdict === "escalate";

  async function decide(decision: "approve" | "reject" | "override" | "confirm_block") {
    setError(null);
    if ((decision === "override" || decision === "reject") && !reason.trim()) {
      setError("Please provide a reason.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await reviewerDecisionAction({
        draftId,
        decision,
        reason: reason.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
      <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">Your decision</div>

      <div className="mb-4">
        <label htmlFor="reason" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Reason {(isBlocked || isEscalated) && <span className="text-neutral-400 dark:text-neutral-500 font-normal">(required for override / reject)</span>}
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Explain your reasoning..."
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-y"
        />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md text-sm text-red-800 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {isBlocked && (
          <>
            <button
              type="button"
              onClick={() => decide("override")}
              disabled={submitting}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition disabled:opacity-50"
            >
              Override block
            </button>
            <button
              type="button"
              onClick={() => decide("confirm_block")}
              disabled={submitting}
              className="px-4 py-2 bg-white dark:bg-neutral-900 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 text-sm font-medium rounded-md hover:bg-red-50 dark:hover:hover:bg-red-950/30 transition disabled:opacity-50"
            >
              Confirm block
            </button>
          </>
        )}
        {isEscalated && (
          <>
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={submitting}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => decide("reject")}
              disabled={submitting}
              className="px-4 py-2 bg-white dark:bg-neutral-900 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 text-sm font-medium rounded-md hover:bg-red-50 dark:hover:hover:bg-red-950/30 transition disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
