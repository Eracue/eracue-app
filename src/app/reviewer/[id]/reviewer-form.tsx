"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewerDecisionAction } from "./actions";

type Props = {
 draftId: string;
 currentStatus: string;
 verdict: string;
};

const BASIS_OPTIONS = [
 "Content reviewed and complies with applicable rules",
 "Rule triggered in error — does not apply to this communication",
 "Exception applies — documented in firm policy",
 "Legal or compliance consulted prior to decision",
 "Other — see supplemental note",
];

const VERDICT_ASSESSMENT_OPTIONS = [
 "System verdict is correct",
 "System verdict is correct but overly broad",
 "System verdict triggered in error",
];

const NOTE_MAX_LENGTH = 280;

export function ReviewerDecisionForm({ draftId, currentStatus, verdict }: Props) {
 const router = useRouter();
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [basis, setBasis] = useState("");
 const [verdictAssessment, setVerdictAssessment] = useState("");
 const [note, setNote] = useState("");

 // Determine button options based on current verdict/status
 const isBlocked = currentStatus === "blocked" || verdict === "block";
 const isEscalated = currentStatus === "escalated" || verdict === "escalate";

 // Field B (verdict assessment) only appears for block/escalate verdicts
 const showVerdictAssessment = verdict === "block" || verdict === "escalate";

 async function decide(decision: "approve" | "reject" | "override" | "confirm_block") {
 setError(null);
 if (!basis) {
 setError("Please select a basis for your decision.");
 return;
 }
 if (showVerdictAssessment && !verdictAssessment) {
 setError("Please select a system verdict assessment.");
 return;
 }
 setSubmitting(true);
 try {
 const result = await reviewerDecisionAction({
 draftId,
 decision,
 reason: {
 basis,
 verdict_assessment: showVerdictAssessment ? verdictAssessment : null,
 note: note.trim(),
 },
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

 const remaining = NOTE_MAX_LENGTH - note.length;

 return (
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-6">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide mb-3">Your decision</div>

 {/* Field A — basis (required) */}
 <div className="mb-4">
 <label htmlFor="basis" className="block text-sm font-medium text-[#1C1C1A] mb-2">
 Basis for decision <span className="text-[#6E6E68] font-normal">(required)</span>
 </label>
 <select
 id="basis"
 value={basis}
 onChange={(e) => setBasis(e.target.value)}
 className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]"
 >
 <option value="">— Select a basis —</option>
 {BASIS_OPTIONS.map((opt) => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>

 {/* Field B — verdict assessment (required when verdict is block/escalate) */}
 {showVerdictAssessment && (
 <div className="mb-4">
 <label htmlFor="verdict-assessment" className="block text-sm font-medium text-[#1C1C1A] mb-2">
 System verdict assessment <span className="text-[#6E6E68] font-normal">(required)</span>
 </label>
 <select
 id="verdict-assessment"
 value={verdictAssessment}
 onChange={(e) => setVerdictAssessment(e.target.value)}
 className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]"
 >
 <option value="">— Select an assessment —</option>
 {VERDICT_ASSESSMENT_OPTIONS.map((opt) => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 </div>
 )}

 {/* Field C — supplemental note (optional, single-line input, 280 cap) */}
 <div className="mb-4">
 <label htmlFor="note" className="block text-sm font-medium text-[#1C1C1A] mb-2">
 Supplemental note (optional)
 </label>
 <input
 id="note"
 type="text"
 value={note}
 onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
 maxLength={NOTE_MAX_LENGTH}
 placeholder="Factual context only. Do not include legal conclusions."
 className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]"
 />
 <p className="text-xs text-[#6E6E68] mt-1">
 {remaining} character{remaining === 1 ? "" : "s"} remaining
 </p>
 </div>

 {error && (
 <div className="px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-sm text-sm text-[#B91C1C] mb-4">
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
 className="px-4 py-2 bg-[#1C1C1A] text-white text-sm font-medium rounded-sm hover:bg-[#333331] transition disabled:opacity-50"
 >
 Override block
 </button>
 <button
 type="button"
 onClick={() => decide("confirm_block")}
 disabled={submitting}
 className="px-4 py-2 bg-white border border-[#FECACA] text-[#B91C1C] text-sm font-medium rounded-sm hover:bg-[#FEF2F2] transition disabled:opacity-50"
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
 className="px-4 py-2 bg-[#1C1C1A] text-white text-sm font-medium rounded-sm hover:bg-[#333331] transition disabled:opacity-50"
 >
 Approve
 </button>
 <button
 type="button"
 onClick={() => decide("reject")}
 disabled={submitting}
 className="px-4 py-2 bg-white border border-[#FECACA] text-[#B91C1C] text-sm font-medium rounded-sm hover:bg-[#FEF2F2] transition disabled:opacity-50"
 >
 Reject
 </button>
 </>
 )}
 </div>
 </div>
 );
}
