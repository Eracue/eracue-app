"use client";

import { useEffect, useRef, useState } from "react";
import {
  publicReviewerDecisionAction,
  type PublicDecision,
} from "./actions";

type Props = {
  token: string;
  draftText: string;
  channel: string;
  submittedAt: string;
  speakerName: string | null;
  speakerTitle: string | null;
  campaignName: string | null;
  verdict: string;
  ruleName: string | null;
  ruleDescription: string | null;
  matchedKeyword: string | null;
  alreadyDecided: boolean;
};

const BASIS_MAX = 500;

// Three-state decision row, in spec order. Colors are exactly as spec'd
// — APPROVED teal, CHANGES REQUESTED amber, ESCALATED red. The buttons
// stack on mobile (375px) and grid on >=sm so the row reads one-line on
// tablet+.
const DECISIONS: ReadonlyArray<{
  key: PublicDecision;
  label: string;
  classes: string;
}> = [
  {
    key: "approved",
    label: "APPROVED",
    classes: "bg-[#0EA5E9] text-white hover:bg-[#0284C7]",
  },
  {
    key: "changes_requested",
    label: "CHANGES REQUESTED",
    classes: "bg-[#F59E0B] text-white hover:bg-[#D97706]",
  },
  {
    key: "escalated",
    label: "ESCALATED",
    classes: "bg-[#EF4444] text-white hover:bg-[#DC2626]",
  },
];

// Plain-English verdict label rendered in the top status badge.
function verdictLabel(v: string): string {
  switch (v.toLowerCase()) {
    case "block":
      return "BLOCKED";
    case "escalate":
      return "NEEDS REVIEW";
    case "review":
      return "FLAGGED";
    case "guide":
      return "ADVISORY";
    case "clear":
      return "CLEARED";
    default:
      return v.toUpperCase();
  }
}

// Verdict badge palette. Used on the compact above-the-fold status
// strip so a reviewer reads the system verdict at a glance.
function verdictBadgeClass(v: string): string {
  switch (v.toLowerCase()) {
    case "block":
      return "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]";
    case "escalate":
      return "bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]";
    case "review":
      return "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]";
    case "guide":
      return "bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]";
    case "clear":
      return "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]";
    default:
      return "bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]";
  }
}

// Submission age timer — "Submitted 3 minutes ago" / "Submitted 2 hours
// ago". Updates every 30s while the page is open so a long-pondering
// reviewer sees the timer tick rather than a stale render-time value.
function useSubmissionAge(submittedAtIso: string): string {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  const submitted = new Date(submittedAtIso).getTime();
  const diffMs = Math.max(0, now - submitted);
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 1) return "Submitted just now";
  if (diffMin < 60) {
    return `Submitted ${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `Submitted ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `Submitted ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function ReviewForm({
  token,
  draftText,
  channel,
  submittedAt,
  speakerName,
  speakerTitle,
  campaignName,
  verdict,
  ruleName,
  ruleDescription,
  matchedKeyword,
  alreadyDecided,
}: Props) {
  const [basis, setBasis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<PublicDecision | null>(null);

  // Page-load timestamp drives the review-duration metric the action
  // writes to the examiner record. Captured once on mount so the
  // duration reflects time-on-page, not time-from-submission.
  const pageLoadTime = useRef<number>(Date.now());

  const submissionAge = useSubmissionAge(submittedAt);

  async function decide(decision: PublicDecision) {
    setError(null);
    setSubmitting(true);
    const reviewDurationSeconds = Math.round(
      (Date.now() - pageLoadTime.current) / 1000,
    );
    try {
      const result = await publicReviewerDecisionAction({
        token,
        decision,
        basis: basis.trim(),
        reviewDurationSeconds,
      });
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      setDecided(decision);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
      setSubmitting(false);
    }
  }

  // Once a decision lands — either now or already in the audit trail —
  // freeze the form into a confirmation state. Reviewers shouldn't be
  // able to overwrite a recorded governance decision from this surface.
  if (decided || alreadyDecided) {
    const recorded = decided ?? "approved"; // alreadyDecided lands without a label; show neutral confirmation
    const meta = DECISIONS.find((d) => d.key === recorded);
    return (
      <main className="min-h-screen bg-[#F8F9FB] flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-sm p-6 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-3">
            Decision recorded
          </div>
          {decided && meta && (
            <div
              className={`inline-block font-mono text-xs font-bold px-3 py-1.5 rounded-sm mb-4 ${meta.classes}`}
            >
              {meta.label}
            </div>
          )}
          {alreadyDecided && !decided && (
            <p className="text-sm text-[#64748B] mb-4">
              This draft already has a recorded reviewer decision. The
              governance record is locked.
            </p>
          )}
          <p className="text-sm text-[#64748B] leading-relaxed">
            Your decision is recorded as part of the governance record
            for this communication.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-[720px] mx-auto px-4 py-5 sm:px-6 sm:py-8">
        {/* ─── Above-the-fold strip ────────────────────────────────────
            At 375px the verdict badge + rule name must be visible
            without scrolling. Keep this block compact: small wordmark,
            verdict badge, rule name. Everything else (draft body,
            buttons, basis) lives below and may scroll on small phones. */}
        <div className="mb-4">
          <div className="font-mono text-[11px] tracking-[0.06em] text-[#0D1B2A] mb-3">
            <span className="font-bold">ERA</span>
            <span className="italic font-light"> CUE</span>
            <span className="text-[#94A3B8] ml-2">· Reviewer link</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-mono text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${verdictBadgeClass(verdict)}`}
            >
              {verdictLabel(verdict)}
            </span>
            {ruleName && (
              <span className="text-sm font-medium text-[#0F172A] leading-snug">
                {ruleName}
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-[#94A3B8] mt-1.5">
            {submissionAge}
          </div>
        </div>

        {/* ─── Draft + context ──────────────────────────────────────── */}
        <div className="bg-white border border-[#E2E8F0] rounded-sm p-4 sm:p-5 mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{channel.replace(/_/g, " ")}</span>
            {speakerName && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {speakerName}
                  {speakerTitle ? ` (${speakerTitle})` : ""}
                </span>
              </>
            )}
            {campaignName && (
              <>
                <span aria-hidden>·</span>
                <span>{campaignName}</span>
              </>
            )}
          </div>
          <p className="text-sm sm:text-base text-[#0F172A] leading-relaxed whitespace-pre-wrap">
            {draftText}
          </p>
          {(ruleDescription || matchedKeyword) && (
            <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
              {ruleDescription && (
                <div className="text-xs text-[#64748B] leading-relaxed">
                  {ruleDescription}
                </div>
              )}
              {matchedKeyword && (
                <span className="inline-block font-mono text-[10px] bg-[#F1F5F9] text-[#1A56DB] px-2 py-0.5 rounded-sm mt-2">
                  keyword: {matchedKeyword}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Decision row ───────────────────────────────────────────
            Three buttons in spec order. Stack vertically at 375px so
            each one stays full-width and tappable; grid into a single
            row at >=sm. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {DECISIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => decide(d.key)}
              disabled={submitting}
              className={`font-mono text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-sm transition-colors disabled:opacity-50 cursor-pointer ${d.classes}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* ─── Basis (optional, 500 char cap) ─────────────────────── */}
        <div className="bg-white border border-[#E2E8F0] rounded-sm p-4 sm:p-5">
          <label
            htmlFor="basis"
            className="block text-sm font-medium text-[#0F172A] mb-2"
          >
            Basis for decision{" "}
            <span className="text-[#64748B] font-normal">(optional)</span>
          </label>
          <textarea
            id="basis"
            value={basis}
            onChange={(e) => setBasis(e.target.value.slice(0, BASIS_MAX))}
            maxLength={BASIS_MAX}
            rows={4}
            placeholder="Enter your rationale for this decision."
            className="w-full px-3 py-2 border border-[#E2E8F0] rounded-sm text-sm bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] resize-y placeholder:text-[#94A3B8]"
          />
          <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
            <p className="text-[#64748B] text-xs leading-relaxed">
              Your decision is recorded as part of the governance record
              for this communication.
            </p>
            <span className="font-mono text-[10px] text-[#94A3B8] shrink-0">
              {BASIS_MAX - basis.length} / {BASIS_MAX}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-sm text-sm text-[#B91C1C]">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
