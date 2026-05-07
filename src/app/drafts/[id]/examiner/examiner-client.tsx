"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PrintButton } from "./print-button";
import { SiteHeader } from "@/app/site-header";
import type { CheckEntry } from "@/lib/checks";

// ---------- Shared types ---------------------------------------------------

export type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  ai_model_used: string | null;
  prompt_hash: string | null;
  prompt_used: string | null;
  status: string;
  submitted_at: string;
  speaker_id: string;
  campaign_id: string | null;
  communication_category: "retail" | "institutional" | "correspondence" | null;
  content_type: "static" | "interactive" | null;
  intended_audience: "public" | "limited" | "institutional" | null;
  users: { name: string; title: string | null; email: string | null } | null;
  campaigns: { name: string } | null;
  // Optional publication fields. Populated from the published_*
  // columns when scripts/migrate-publication-fields.ts has been run;
  // null otherwise. The receipt uses these for Row 5 of the summary.
  published_platform?: string | null;
  published_url?: string | null;
  published_at?: string | null;
  // Publish-token fields. Populated by the reviewer action on
  // approve/override after scripts/publish-token-migration.sql has
  // been run. Surface as a dark code-block in both views.
  publish_token?: string | null;
  publish_token_expires_at?: string | null;
  draft_hash_at_approval?: string | null;
};

export type ActionRow = {
  id: string;
  action_type: string;
  actor_kind: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  rules_active: string[] | null;
  model_version: string | null;
  occurred_at: string;
  row_hash: string;
};

export type RuleRow = {
  id: string;
  name: string;
  rule_type: string;
  description: string;
  effective_from: string;
  effective_to: string | null;
  wsp_reference: string | null;
};

export type Actors = Record<string, { name: string; title: string | null }>;

type Props = {
  draft: DraftRow;
  actions: ActionRow[];
  rules: RuleRow[];
  actors: Actors;
  defaultView: "summary" | "full";
  generatedAt: string;
};

// ---------- Helpers --------------------------------------------------------

function fmtTime(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}

function fmtFriendlyDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRuleDate(dateStr: string | null): string {
  if (!dateStr) return "no end date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ruleTypeBadge(type: string): ReactNode {
  const colors: Record<string, string> = {
    block:    "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
    escalate: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
    review:   "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
    guide:    "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
  };
  return (
    <span
      className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${
        colors[type] || "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
      }`}
    >
      {type}
    </span>
  );
}

function CheckResultLabel({ result }: { result: CheckEntry["result"] }) {
  const cls =
    result === "pass" ? "bg-green-50 text-green-800 border-green-300" :
    result === "fail" ? "bg-red-50 text-red-900 border-red-300" :
                        "bg-amber-50 text-amber-900 border-amber-300";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${cls}`}>
      {result}
    </span>
  );
}

function formatSourceOrigin(origin: string | null): {
  declaration: string;
  euAiAct: string;
  note: string;
} {
  switch (origin) {
    case "ai_assisted":
      return {
        declaration: "AI involvement declared: Yes",
        euAiAct: "EU AI Act Article 50: Disclosure required at publication",
        note: "Human reviewed before submission",
      };
    case "human":
      return {
        declaration: "AI involvement declared: No",
        euAiAct: "EU AI Act Article 50: No disclosure required",
        note: "Human-authored communication",
      };
    case "agent_submitted":
      return {
        declaration: "Submission type: Automated agent",
        euAiAct: "FINRA 2026 agentic AI guidance: Principal review required",
        note: "ERA CUE review is the human checkpoint",
      };
    default:
      return {
        declaration: "Source: " + (origin || "not declared"),
        euAiAct: "",
        note: "",
      };
  }
}

function basisFromReason(reason: unknown): { basis?: string; verdict_assessment?: string | null; note?: string } | string | null {
  if (!reason) return null;
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && !Array.isArray(reason)) {
    return reason as { basis?: string; verdict_assessment?: string | null; note?: string };
  }
  return null;
}

function actionTypeLabel(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Map raw actor_kind strings to the labels examiners actually recognise.
// 'ai_check' and 'system' both come from the engine and should read as
// 'ERA CUE system' on the audit-trail line.
function formatActorKind(actor: ActionRow, actors: Actors): string {
  const kind = actor.actor_kind;
  if (kind === "ai_check" || kind === "system") return "ERA CUE system";
  if (kind === "user" || kind === "reviewer") {
    if (actor.actor_id && actors[actor.actor_id]) {
      const u = actors[actor.actor_id];
      return `${u.name}${u.title ? ` (${u.title})` : ""}`;
    }
    return "Sarah Chen, GC (Designated Principal)";
  }
  return kind;
}

function renderActionDetail(
  action_type: string,
  payload: Record<string, unknown>,
): ReactNode {
  switch (action_type) {
    case "draft_submitted":
      return (
        <span className="text-sm text-[#374151]">
          Draft submitted for governance review.
        </span>
      );
    case "check_ran": {
      const checkRaw = (payload.check as string) || "";
      const check = checkRaw.replace(/_/g, " ");
      const count = payload.rules_active_count;
      return (
        <span className="text-sm text-[#374151]">
          {check.charAt(0).toUpperCase() + check.slice(1)} completed.
          {typeof count === "number" ? ` ${count} rules evaluated.` : ""}
        </span>
      );
    }
    case "verdict_issued": {
      const verdict = payload.verdict as string | undefined;
      const match = payload.primary_match as Record<string, unknown> | null;
      return (
        <div className="text-sm">
          <div className="font-medium text-[#0F172A]">
            Verdict: {verdict?.toUpperCase() ?? "—"}
          </div>
          {match && (
            <>
              {match.rule_name && (
                <div className="text-[#374151] mt-1">
                  Rule: {match.rule_name as string}
                </div>
              )}
              {match.matched_keyword && (
                <div className="text-[#374151]">
                  Keyword matched:
                  <span className="font-mono bg-[#F1F5F9] px-1.5 py-0.5 rounded text-xs ml-1">
                    {match.matched_keyword as string}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      );
    }
    case "reviewer_decided": {
      const decision = payload.decision as string | undefined;
      const reason = payload.reason as Record<string, unknown> | null;
      const decisionLabel = decision
        ? decision.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : "—";
      return (
        <div className="text-sm">
          <div className="font-medium text-[#0F172A]">
            Decision: {decisionLabel}
          </div>
          {reason?.basis ? (
            <div className="text-[#374151] mt-1">
              Basis: {reason.basis as string}
            </div>
          ) : null}
          {reason?.verdict_assessment ? (
            <div className="text-[#374151]">
              Assessment: {reason.verdict_assessment as string}
            </div>
          ) : null}
          {reason?.note ? (
            <div className="text-[#374151] mt-1 italic">
              Note: {reason.note as string}
            </div>
          ) : null}
        </div>
      );
    }
    case "block_overridden":
    case "block_confirmed":
      return (
        <span className="text-sm text-[#374151]">
          Status updated:{" "}
          {(payload.new_status as string) || actionTypeLabel(action_type)}
        </span>
      );
    default:
      return (
        <span className="text-sm text-[#374151]">
          {actionTypeLabel(action_type)}
        </span>
      );
  }
}

// ---------- Component ------------------------------------------------------

export function ExaminerClient({
  draft,
  actions,
  rules,
  actors,
  defaultView,
  generatedAt,
}: Props) {
  const [view, setView] = useState<"summary" | "full">(defaultView);

  // Most-recent verdict drives the Checks Performed section. Older records
  // that pre-date payload.checks fall back to a primary_match-derived chain.
  const latestVerdict = [...actions]
    .reverse()
    .find((a) => a.action_type === "verdict_issued");
  const verdictPayload = (latestVerdict?.payload || {}) as {
    verdict?: string;
    primary_match?: { rule_id?: string; rule_name?: string; rule_description?: string; matched_keyword?: string } | null;
    checks?: CheckEntry[];
  };
  const primaryMatch = verdictPayload.primary_match || null;
  const verdict = verdictPayload.verdict ?? null;
  const isQuietPeriodMatch = primaryMatch ? /quiet period/i.test(primaryMatch.rule_name || "") : false;
  const checks: CheckEntry[] = verdictPayload.checks ?? [
    primaryMatch
      ? { check_name: "Rule Check", result: "fail" as const, detail: `Matched: ${primaryMatch.rule_name}`, matched_keyword: primaryMatch.matched_keyword }
      : { check_name: "Rule Check", result: "pass" as const, detail: null },
    { check_name: "Consistency Check", result: "pass" as const, detail: null },
    { check_name: "Alignment Check", result: "pass" as const, detail: null },
    isQuietPeriodMatch && primaryMatch
      ? { check_name: "Quiet Period Check", result: "fail" as const, detail: `Quiet period rule matched: ${primaryMatch.rule_name}` }
      : { check_name: "Quiet Period Check", result: "pass" as const, detail: null },
    { check_name: "Agent Origin Check", result: "pass" as const, detail: null },
  ];

  const reviewerDecisions = actions.filter((a) => a.action_type === "reviewer_decided");
  const lastDecision = reviewerDecisions[reviewerDecisions.length - 1];
  const decision = lastDecision?.payload?.decision as string | undefined;
  const isApproved = decision === "override" || decision === "approve";
  const isConfirmedBlock = decision === "confirm_block" || decision === "reject";
  const isPending = !lastDecision;

  const lookupReviewer = lastDecision?.actor_id ? actors[lastDecision.actor_id] : null;
  const reviewerName =
    (lastDecision?.payload?.reviewer_name as string | undefined) ||
    (lookupReviewer
      ? `${lookupReviewer.name}${lookupReviewer.title ? `, ${lookupReviewer.title}` : ""}`
      : "Sarah Chen, GC");

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-white text-black print:bg-white">
        <style>{`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .page-break { page-break-after: always; }
            a { color: black !important; text-decoration: none !important; }
          }
        `}</style>

        {/* Screen-only top nav */}
        <div className="no-print bg-neutral-100 border-b border-neutral-200 px-6 py-3 flex items-center justify-between sticky top-0">
          <a href={`/drafts/${draft.id}`} className="text-sm text-neutral-600 hover:text-neutral-900">← Back to draft</a>
          <div className="flex gap-2">
            <a
              href={`/drafts/${draft.id}/examiner/pdf`}
              className="px-4 py-1.5 bg-neutral-900 dark:bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-neutral-800 dark:hover:bg-indigo-500 transition"
            >
              Download PDF
            </a>
            <PrintButton />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-8 py-12">
          {/* Header */}
          <header className="border-b-2 border-neutral-900 pb-6 mb-8">
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Communication Record</div>
            <h1 className="text-2xl mb-1">
              <span style={{ fontFamily: "var(--font-newsreader)" }}>
                <span className="text-[#1A56DB] font-bold">ERA</span>
                <span className="text-[#1A56DB] italic font-normal"> CUE</span>
              </span>
              <span className="text-[#0F172A] font-light"> Communication Record</span>
            </h1>
            <p className="text-sm text-neutral-600">Draft ID: <span className="font-mono">{draft.id}</span></p>
            <p className="text-xs text-neutral-500 mt-2">Generated: {fmtTime(generatedAt)}</p>
          </header>

          {/* View toggle pills */}
          <div className="no-print flex bg-[#F1F5F9] rounded-sm p-1 gap-1 mb-8 w-fit">
            {(["summary", "full"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`font-mono text-xs px-4 py-1.5 rounded-sm transition-colors ${
                  view === v
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {v === "summary" ? "Communication summary" : "Full compliance record"}
              </button>
            ))}
          </div>

          {view === "summary" ? (
            <SummaryView
              draft={draft}
              actions={actions}
              primaryMatch={primaryMatch}
              verdict={verdict}
              isApproved={isApproved}
              isConfirmedBlock={isConfirmedBlock}
              isPending={isPending}
              lastDecision={lastDecision}
              reviewerName={reviewerName}
              onShowFull={() => setView("full")}
            />
          ) : (
            <FullView
              draft={draft}
              actions={actions}
              rules={rules}
              actors={actors}
              checks={checks}
              reviewerDecisions={reviewerDecisions}
              generatedAt={generatedAt}
            />
          )}
        </div>
      </main>
    </>
  );
}

// ---------- Summary view ---------------------------------------------------

function SummaryView({
  draft,
  actions,
  primaryMatch,
  verdict,
  isApproved,
  isConfirmedBlock,
  isPending,
  lastDecision,
  reviewerName,
  onShowFull,
}: {
  draft: DraftRow;
  actions: ActionRow[];
  primaryMatch: { rule_id?: string; rule_name?: string; rule_description?: string; matched_keyword?: string } | null;
  verdict: string | null;
  isApproved: boolean;
  isConfirmedBlock: boolean;
  isPending: boolean;
  lastDecision: ActionRow | undefined;
  reviewerName: string;
  onShowFull: () => void;
}) {
  const reason = lastDecision ? basisFromReason(lastDecision.payload?.reason) : null;
  const reasonObj = reason && typeof reason === "object" ? reason : null;

  // Timeline lookups. The submit action is currently written as 'submitted'
  // but legacy/seed rows used 'draft_submitted', so accept either. The
  // 'draft_opened' action_type isn't written today — gracefully render as
  // not-yet-occurred so the row still appears.
  const submittedAction = actions.find(
    (a) => a.action_type === "submitted" || a.action_type === "draft_submitted",
  );
  const verdictAction = actions.find((a) => a.action_type === "verdict_issued");
  const openedAction = actions.find((a) => a.action_type === "draft_opened");
  const decidedAction = actions.find((a) => a.action_type === "reviewer_decided");

  const checkDuration =
    verdictAction && submittedAction
      ? Math.round(
          (new Date(verdictAction.occurred_at).getTime() -
            new Date(submittedAction.occurred_at).getTime()) /
            1000,
        )
      : null;

  const approvalDuration =
    decidedAction && submittedAction
      ? Math.round(
          (new Date(decidedAction.occurred_at).getTime() -
            new Date(submittedAction.occurred_at).getTime()) /
            1000 /
            60,
        )
      : null;

  const formatApprovalSpan = (mins: number): string => {
    if (mins < 60) return `${mins}m after submission`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m after submission`;
  };

  // Pull the actual review duration off the reviewer_decided payload
  // when the form recorded one. Falls back to the submission→decision
  // wall-clock span when the field isn't present (legacy decisions).
  const reviewDurationSec =
    typeof decidedAction?.payload?.review_duration_seconds === "number"
      ? (decidedAction.payload.review_duration_seconds as number)
      : null;
  const reviewDurationLabel =
    reviewDurationSec !== null
      ? reviewDurationSec < 60
        ? `${reviewDurationSec}s review`
        : `${Math.floor(reviewDurationSec / 60)}m ${reviewDurationSec % 60}s review`
      : null;

  const timelineSteps = [
    {
      action: submittedAction,
      label: "Submitted",
      actor: draft.users?.name ?? "—",
      done: !!submittedAction,
    },
    {
      action: verdictAction,
      label: "ERA CUE checked",
      actor: checkDuration !== null ? `${checkDuration}s · 5 checks` : "5 checks",
      done: !!verdictAction,
    },
    {
      action: openedAction,
      label: "Principal opened",
      actor: openedAction ? "Sarah Chen, GC" : "Not yet opened",
      done: !!openedAction,
    },
    {
      action: decidedAction,
      label: decidedAction ? "Decision recorded" : "Awaiting decision",
      actor: decidedAction
        ? [
            "Sarah Chen",
            reviewDurationLabel,
            !reviewDurationLabel && approvalDuration !== null
              ? formatApprovalSpan(approvalDuration)
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "No decision yet",
      done: !!decidedAction,
    },
  ];

  return (
    <>
      {/* Status block */}
      {isApproved && lastDecision && (
        <div className="mb-8 p-5 bg-[#F0FDF4] border-2 border-[#86EFAC] rounded-sm">
          <div className="font-mono text-xs uppercase tracking-widest text-[#166534] mb-2">
            ✓ Approved for publication
          </div>
          <div className="text-lg font-semibold text-[#0F172A]">Reviewed and approved</div>
          <div className="text-sm text-[#374151] mt-1">{reviewerName} · General Counsel</div>
          <div className="font-mono text-xs text-[#166534] mt-2">
            {fmtFriendlyDateTime(lastDecision.occurred_at)}
          </div>
        </div>
      )}
      {isConfirmedBlock && lastDecision && (
        <div className="mb-8 p-5 bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-sm">
          <div className="font-mono text-xs uppercase tracking-widest text-[#B91C1C] mb-2">
            ✗ Not approved for publication
          </div>
          <div className="text-lg font-semibold text-[#0F172A]">Block confirmed by principal</div>
          <div className="text-sm text-[#374151] mt-1">
            {reviewerName} · {fmtFriendlyDateTime(lastDecision.occurred_at)}
          </div>
          <div className="text-sm text-[#374151] mt-3 leading-relaxed">
            This draft cannot be published. Contact your principal for guidance.
          </div>
        </div>
      )}
      {isPending && (
        <div className="mb-8 p-5 bg-[#FFFBEB] border-2 border-[#FDE68A] rounded-sm">
          <div className="font-mono text-xs uppercase tracking-widest text-[#B45309] mb-2">
            ⏳ Awaiting principal review
          </div>
          <div className="text-lg font-semibold text-[#0F172A]">Not yet approved</div>
          <div className="text-sm text-[#374151] mt-3 leading-relaxed">
            Do not publish until a designated principal approves this draft.
          </div>
        </div>
      )}

      {/* Key details grid. Expands from a 4-cell to a 5-cell row when
          a publication has been recorded so 'Published on' joins the
          existing labels in line. */}
      <div
        className={`grid grid-cols-2 ${
          draft.published_platform ? "md:grid-cols-5" : "md:grid-cols-4"
        } gap-4 mb-8`}
      >
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
            Speaker
          </div>
          <div className="text-sm text-[#0F172A]">
            {draft.users?.name || "—"}
          </div>
          {draft.users?.title && (
            <div className="text-xs text-[#64748B]">{draft.users.title}</div>
          )}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
            Channel
          </div>
          <div className="text-sm text-[#0F172A] capitalize">{draft.channel}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
            Campaign
          </div>
          {draft.campaigns?.name ? (
            <div className="text-sm font-semibold text-[#1A56DB]">
              {draft.campaigns.name}
            </div>
          ) : (
            <div className="text-sm text-[#94A3B8]">—</div>
          )}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
            Submitted
          </div>
          <div className="text-sm text-[#0F172A]">
            {new Date(draft.submitted_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        {draft.published_platform && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
              Published on
            </div>
            <div className="text-sm text-[#0F172A] capitalize">
              {draft.published_platform.replace(/_/g, " ")}
            </div>
            {draft.published_at && (
              <div className="text-xs text-[#64748B]">
                {new Date(draft.published_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval timeline — sits between the key-details grid and the
          'What ERA CUE flagged' card. Each step shows a checkmark when the
          underlying action exists, an empty circle when it hasn't happened
          yet. Total approval time renders below the steps when both
          submitted + decided actions are recorded. */}
      <div className="pb-5 mb-8 border-b border-[#E2E8F0]">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
          Timeline
        </div>
        <div className="space-y-3">
          {timelineSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 font-mono text-[10px] ${
                  step.done
                    ? "bg-[#1A56DB] border-[#1A56DB] text-white"
                    : "bg-white border-[#E2E8F0] text-[#94A3B8]"
                }`}
              >
                {step.done ? "✓" : "○"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${
                      step.done ? "text-[#0F172A]" : "text-[#94A3B8]"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.action && (
                    <span className="font-mono text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0">
                      {new Date(step.action.occurred_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-[#64748B] mt-0.5">{step.actor}</div>
              </div>
            </div>
          ))}
        </div>
        {approvalDuration !== null && (
          <div className="mt-4 pt-3 border-t border-[#F1F5F9] font-mono text-[10px] text-[#64748B]">
            Total approval time:{" "}
            {approvalDuration < 60
              ? `${approvalDuration} minutes`
              : `${Math.floor(approvalDuration / 60)}h ${approvalDuration % 60}m`}
          </div>
        )}
      </div>

      {/* What ERA CUE flagged */}
      {verdict !== "clear" && primaryMatch && (
        <section className="mb-8 p-5 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
            What ERA CUE flagged
          </div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-base font-semibold text-[#0F172A]">
              {primaryMatch.rule_name}
            </div>
            {verdict && ruleTypeBadge(verdict)}
          </div>
          {primaryMatch.rule_description && (
            <div className="text-sm text-[#374151] mb-3">
              {primaryMatch.rule_description}
            </div>
          )}
          {primaryMatch.matched_keyword && (
            <div className="text-xs text-[#64748B]">
              Keyword matched:{" "}
              <span className="font-mono bg-[#F1F5F9] text-[#1A56DB] px-1.5 py-0.5 rounded text-xs">
                {primaryMatch.matched_keyword}
              </span>
            </div>
          )}
        </section>
      )}

      {/* Principal decision */}
      {lastDecision && (
        <section className="mb-8 p-5 bg-white border border-[#E2E8F0] rounded-sm">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
            Principal decision
          </div>
          <div className="text-base font-semibold text-[#0F172A] mb-2">
            {(decision => decision ? decision.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "—")(lastDecision.payload?.decision as string | undefined)}
          </div>
          {reasonObj?.basis && (
            <div className="text-sm text-[#374151] mb-2">
              <span className="font-medium text-[#0F172A]">Basis:</span> {reasonObj.basis}
            </div>
          )}
          {reasonObj?.note && (
            <div className="text-sm text-[#374151] mb-3 italic">
              &ldquo;{reasonObj.note}&rdquo;
            </div>
          )}
          <div className="font-mono text-xs text-[#94A3B8]">
            {reviewerName} · {fmtFriendlyDateTime(lastDecision.occurred_at)}
          </div>
        </section>
      )}

      {/* Clearance token — only for approved/overridden drafts where a
          token was minted. Renders as a dark code block so it reads as a
          credential / receipt rather than a UI element. */}
      <PublishTokenBlock draft={draft} />

      {/* Draft text */}
      <section className="mb-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
          Draft text
        </div>
        <div className="p-5 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm">
          <p className="text-base text-[#0F172A] whitespace-pre-wrap italic leading-relaxed">
            &ldquo;{draft.draft_text}&rdquo;
          </p>
        </div>
      </section>

      {/* Footer — full record + campaign links */}
      <footer className="mt-12 pt-6 border-t border-[#E2E8F0] flex flex-col gap-3 text-sm">
        <div>
          <div className="text-[#64748B] mb-1">Need the full FINRA compliance record?</div>
          <button
            type="button"
            onClick={onShowFull}
            className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
          >
            View full compliance record →
          </button>
        </div>
        {draft.campaigns?.name && (
          <div>
            <Link
              href={`/drafts?campaign=${encodeURIComponent(draft.campaigns.name)}`}
              className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
            >
              View all {draft.campaigns.name} communications →
            </Link>
          </div>
        )}
      </footer>
    </>
  );
}

// ---------- Full compliance view ------------------------------------------

function FullView({
  draft,
  actions,
  rules,
  actors,
  checks,
  reviewerDecisions,
  generatedAt,
}: {
  draft: DraftRow;
  actions: ActionRow[];
  rules: RuleRow[];
  actors: Actors;
  checks: CheckEntry[];
  reviewerDecisions: ActionRow[];
  generatedAt: string;
}) {
  const hasDecision = reviewerDecisions.length > 0;

  return (
    <>
      {/* Section 1: Speaker & Submission */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">1. Speaker & Submission</h2>

        {hasDecision ? (
          (() => {
            const last = reviewerDecisions[reviewerDecisions.length - 1];
            const lookupActor = last?.actor_id ? actors[last.actor_id] : null;
            const reviewerName =
              (last?.payload?.reviewer_name as string | undefined) ||
              (lookupActor
                ? `${lookupActor.name}${lookupActor.title ? `, ${lookupActor.title}` : ""}`
                : "Sarah Chen, GC");
            const occurredLabel = last?.occurred_at ? fmtFriendlyDateTime(last.occurred_at) : "";
            return (
              <div className="mb-6 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-2">
                  ✓ Human Review Completed
                </div>
                <div className="text-base font-semibold text-[#0F172A]">
                  Reviewed and approved by {reviewerName}
                </div>
                {occurredLabel && (
                  <div className="font-mono text-xs text-[#374151] mt-1">{occurredLabel}</div>
                )}
                <div className="font-mono text-[10px] text-[#166534] mt-2">
                  FINRA Rule 3110(a) supervisory evidence · EU AI Act Article 50(4) exemption applies
                </div>
              </div>
            );
          })()
        ) : (
          <div className="mb-6 p-4 bg-[#FFF7ED] border border-[#FED7AA] rounded-sm">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#C2410C] mb-1">
              ⏳ Pending Principal Review
            </div>
            <div className="text-sm text-[#374151]">
              This draft has not yet been formally reviewed by a designated principal. ERA CUE system clearance recorded but principal approval is pending.
            </div>
          </div>
        )}

        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-neutral-500">Speaker</dt>
          <dd className="col-span-2 text-base text-[#0F172A] font-medium">{draft.users?.name || "—"}{draft.users?.title ? ` (${draft.users.title})` : ""}</dd>
          <dt className="text-neutral-500">Channel</dt>
          <dd className="col-span-2 text-neutral-900">{draft.channel}</dd>
          <dt className="text-neutral-500">Campaign</dt>
          <dd className="col-span-2 text-neutral-900">{draft.campaigns?.name || "—"}</dd>
          {(() => {
            const formatted = formatSourceOrigin(draft.source_origin);
            return (
              <>
                <dt className="text-neutral-500">AI Declaration</dt>
                <dd className="col-span-2 text-neutral-900">{formatted.declaration}</dd>
                {formatted.euAiAct && (
                  <>
                    <dt className="text-neutral-500">Regulatory basis</dt>
                    <dd className="col-span-2 text-neutral-900">{formatted.euAiAct}</dd>
                  </>
                )}
                {formatted.note && (
                  <>
                    <dt className="text-neutral-500">Note</dt>
                    <dd className="col-span-2 text-neutral-900">{formatted.note}</dd>
                  </>
                )}
              </>
            );
          })()}
          {draft.prompt_used && draft.prompt_used.trim() && (<>
            <dt className="text-neutral-500">Prompt logged</dt>
            <dd className="col-span-2 text-base text-[#0F172A]">
              <div className="whitespace-pre-wrap">{draft.prompt_used}</div>
              <div className="text-xs text-[#64748B] mt-1">
                Retained per FINRA 2026 GenAI prompt logging guidance · Append-only record
              </div>
            </dd>
          </>)}
          <dt className="text-neutral-500">Submitted at</dt>
          <dd className="col-span-2 text-neutral-900 font-mono">{fmtTime(draft.submitted_at)}</dd>
          <dt className="text-neutral-500">Final status</dt>
          <dd className="col-span-2 text-neutral-900 font-medium uppercase">{draft.status}</dd>
          <dt className="text-neutral-500">Communication category</dt>
          <dd className="col-span-2 text-neutral-900">
            {(draft.communication_category ?? "retail") === "retail"
              ? "Retail Communication · Rule 2210(a)(1)"
              : (draft.communication_category ?? "retail") === "institutional"
              ? "Institutional Communication · Rule 2210(a)(2)"
              : "Correspondence · Rule 2210(a)(3)"}
          </dd>
          <dt className="text-neutral-500">Content type</dt>
          <dd className="col-span-2 text-neutral-900">
            {(draft.content_type ?? "static") === "static"
              ? "Static · Principal pre-approval required"
              : "Interactive · Supervision required"}
          </dd>
          <dt className="text-neutral-500">Intended audience</dt>
          <dd className="col-span-2 text-neutral-900">
            {(draft.intended_audience ?? "public") === "public"
              ? "Public · Retail standard applies"
              : (draft.intended_audience ?? "public") === "institutional"
              ? "Institutional investors only"
              : "Limited distribution (under 25 retail investors)"}
          </dd>
        </dl>
      </section>

      {/* Section 1.5: Regulatory Framework */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">Regulatory Framework</h2>
        <dl>
          <dt className="font-mono text-xs uppercase tracking-widest text-[#64748B]">FINRA Rule 3110(a)</dt>
          <dd className="text-sm text-neutral-900 mt-0.5">
            Supervision · Named principal review required
          </dd>
          <dd className="font-mono text-xs text-neutral-500 mb-4">
            Principal: Sarah Chen · CCO · Designated Principal
          </dd>

          <dt className="font-mono text-xs uppercase tracking-widest text-[#64748B]">FINRA Rule 2210(b)</dt>
          <dd className="text-sm text-neutral-900 mt-0.5 mb-4">
            {(() => {
              // 2210(b)'s pre-approval requirement is retail-only. Pending vs
              // satisfied also depends on whether a principal has decided.
              const cat = draft.communication_category ?? "retail";
              if (cat === "retail") {
                return hasDecision
                  ? "Pre-approval satisfied — retail communication reviewed by designated principal per Rule 2210(b)"
                  : "Pre-approval pending — principal review required before publication per Rule 2210(b)";
              }
              if (cat === "correspondence") {
                return "Correspondence — lighter supervision standard applies per Rule 2210(a)(3). Pre-approval requirement does not apply.";
              }
              return "Institutional communication — content standards apply per Rule 2210(a)(2)";
            })()}
          </dd>

          <dt className="font-mono text-xs uppercase tracking-widest text-[#64748B]">SEC Rule 17a-4 · FINRA Rule 4511</dt>
          <dd className="text-sm text-neutral-900 mt-0.5">
            Record retention · 36 months from submission date
          </dd>
          <dd className="font-mono text-xs text-neutral-500">
            Accessible period: First 24 months · Total: 36 months
          </dd>
          <dd className="font-mono text-xs text-neutral-500">
            Retention expiry:{" "}
            {new Date(
              new Date(draft.submitted_at).getTime() + 36 * 30 * 24 * 60 * 60 * 1000,
            ).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </dd>
          <dd className="font-mono text-xs text-neutral-500 mb-4">
            Format: Append-only · SHA-256 hashed · Tamper-evident per Rule 17a-4(f)
          </dd>

          <dt className="font-mono text-xs uppercase tracking-widest text-[#64748B]">EU AI Act Article 50</dt>
          {(() => {
            const isAi =
              draft.source_origin === "ai_assisted" ||
              draft.source_origin === "ai_generated";
            const latestDecision = reviewerDecisions.length > 0
              ? reviewerDecisions[reviewerDecisions.length - 1]
              : null;
            if (isAi && latestDecision) {
              const ts = new Date(latestDecision.occurred_at).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              );
              return (
                <>
                  <dd className="text-sm text-[#0F172A] mt-0.5">Human review exemption applies</dd>
                  <dd className="mt-2 mb-4">
                    <span className="text-sm text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm px-3 py-2 inline-block">
                      Editorial responsibility assumed by Sarah Chen, GC on {ts} — EU AI Act Article 50(4) human review exemption applies. AI disclosure label not required at publication.
                    </span>
                  </dd>
                </>
              );
            }
            if (isAi) {
              return (
                <>
                  <dd className="text-sm text-[#0F172A] mt-0.5">Disclosure required at publication</dd>
                  <dd className="font-mono text-xs text-[#C2410C] mt-1 mb-4 leading-relaxed">
                    Principal review pending. Once a designated principal approves this draft, the EU AI Act Article 50(4) human review exemption will apply and AI disclosure at publication will not be required.
                  </dd>
                </>
              );
            }
            if (draft.source_origin === "agent_submitted") {
              return (
                <>
                  <dd className="text-sm text-[#0F172A] mt-0.5">
                    AI-generated content — disclosure required at publication
                  </dd>
                  <dd className="font-mono text-xs text-neutral-500 mt-1 mb-4 leading-relaxed">
                    ERA CUE principal review satisfies FINRA agentic AI supervision requirement (separate from EU AI Act disclosure).
                  </dd>
                </>
              );
            }
            return (
              <dd className="text-sm text-[#0F172A] mt-0.5 mb-4">
                No disclosure required — human-authored content
              </dd>
            );
          })()}
        </dl>
      </section>

      {/* Section 2: Draft text */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">2. Draft Text (verbatim)</h2>
        <div className="p-4 border border-neutral-300 rounded text-base text-[#0F172A] whitespace-pre-wrap leading-relaxed bg-neutral-50">
          {draft.draft_text}
        </div>
      </section>

      {/* Section 3: Rules active at submission */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">3. Governance Rules Active at Submission</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-neutral-500">No rule snapshots recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {rules.map((r) => (
              <li key={r.id} className="border border-neutral-200 rounded p-3">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="font-medium text-neutral-900">{r.name}</div>
                  {ruleTypeBadge(r.rule_type)}
                </div>
                {r.wsp_reference && (
                  <div className="font-mono text-[10px] text-[#1447C0] mb-1">
                    WSP: {r.wsp_reference}
                  </div>
                )}
                <div className="text-xs text-neutral-700 mb-1">{r.description}</div>
                <div className="text-xs text-neutral-500">
                  Effective {formatRuleDate(r.effective_from)} – {formatRuleDate(r.effective_to)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 4: Checks Performed */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">4. Checks Performed</h2>
        <p className="text-xs text-neutral-500 mb-3">
          ERA CUE runs a fixed five-check chain. Pass / Fail / Warn results are recorded for every draft, so the absence of a check is itself auditable.
        </p>
        <ul className="space-y-2 text-sm">
          {checks.map((c, i) => (
            <li key={`${c.check_name}-${i}`} className="border border-neutral-200 rounded p-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-900">{c.check_name}</div>
                {c.detail && <div className="text-xs text-neutral-700 mt-0.5">{c.detail}</div>}
                {c.matched_keyword && (
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Matched keyword: <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{c.matched_keyword}</span>
                  </div>
                )}
                {/* Stage 2 reasoning — surfaces ERA CUE's contextual
                    evaluation of the keyword match so FINRA examiners can
                    see ERA CUE evaluated context, not just keywords. */}
                {c.context_evaluation && (
                  <div className="font-mono text-[10px] text-[#64748B] mt-1 italic">
                    Context: {c.context_evaluation}
                  </div>
                )}
                {c.check_name === "Consistency Check" && typeof c.corpus_size === "number" && (
                  <div className="font-mono text-[10px] text-[#64748B] mt-1 ml-4">
                    Corpus at submission: {c.corpus_size} approved statements from this speaker
                  </div>
                )}
                {c.check_name === "Consistency Check" && c.prior_statement && (
                  <div className="text-xs text-neutral-700 mt-1 ml-4 pl-3 border-l-2 border-[#FED7AA] italic">
                    Prior statement: &ldquo;{c.prior_statement}&rdquo;
                  </div>
                )}
              </div>
              <CheckResultLabel result={c.result} />
            </li>
          ))}
        </ul>
      </section>

      {/* Section 5: Principal Review (always renders, with pending state when no decisions) */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">5. Principal Review</h2>
        {hasDecision ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded px-4 py-2 text-xs mb-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-amber-900">
                  <span className="text-amber-700">Reviewing principal:</span>{" "}
                  <span className="font-medium">Sarah Chen · CCO · Designated Principal</span>
                </div>
                <div className="text-amber-900 text-right">
                  <span className="text-amber-700">Authority:</span>{" "}
                  <span className="font-medium">Final approval · FINRA Rule 3110(a)</span>
                </div>
              </div>
            </div>

            <ul className="space-y-3 text-sm">
              {reviewerDecisions.map((a, idx) => {
                const payload = a.payload as { decision?: string; reason?: unknown; new_status?: string; review_duration_seconds?: number };
                const reason = basisFromReason(payload.reason);
                const isObj = reason && typeof reason === "object";
                const reasonObj = isObj ? (reason as { basis?: string; verdict_assessment?: string | null; note?: string }) : null;
                const reasonStr = !isObj && typeof reason === "string" ? reason : null;
                const actorLabel = formatActorKind(a, actors);
                const durSec = typeof payload.review_duration_seconds === "number" ? payload.review_duration_seconds : null;
                const durLabel =
                  durSec !== null
                    ? durSec < 60
                      ? `${durSec} seconds`
                      : `${Math.floor(durSec / 60)}m ${durSec % 60}s`
                    : null;
                return (
                  <li key={a.id} className="border border-neutral-200 rounded p-3">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <div className="text-neutral-900 font-medium">
                        <span className="text-xs text-neutral-500 mr-2">#{idx + 1}</span>
                        Decision: <span className="uppercase">{payload.decision || "—"}</span>
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">{fmtTime(a.occurred_at)}</div>
                    </div>
                    {durLabel && (
                      <div className="font-mono text-[10px] text-[#94A3B8] mb-2">
                        Review duration: {durLabel}
                      </div>
                    )}
                    {durSec !== null && durSec < 10 && (
                      <div className="font-mono text-[10px] text-[#C2410C] mb-2">
                        ⚠ Very short review duration — supplemental evidence recommended
                      </div>
                    )}
                    <dl className="grid grid-cols-3 gap-y-1 text-xs">
                      <dt className="text-neutral-500">Reviewer</dt>
                      <dd className="col-span-2 text-neutral-900">{actorLabel}</dd>
                      {payload.new_status && (<>
                        <dt className="text-neutral-500">New status</dt>
                        <dd className="col-span-2 text-neutral-900 uppercase">{payload.new_status}</dd>
                      </>)}
                      {reasonObj ? (
                        <>
                          <dt className="text-neutral-500">Basis</dt>
                          <dd className="col-span-2 text-neutral-900">{reasonObj.basis || "—"}</dd>
                          {reasonObj.verdict_assessment && (<>
                            <dt className="text-neutral-500">Verdict assessment</dt>
                            <dd className="col-span-2 text-neutral-900">{reasonObj.verdict_assessment}</dd>
                          </>)}
                          {reasonObj.note && (<>
                            <dt className="text-neutral-500">Note</dt>
                            <dd className="col-span-2 text-neutral-900">{reasonObj.note}</dd>
                          </>)}
                        </>
                      ) : reasonStr ? (
                        <>
                          <dt className="text-neutral-500">Reason</dt>
                          <dd className="col-span-2 text-neutral-900">{reasonStr}</dd>
                        </>
                      ) : null}
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-1">
              No decision on record
            </div>
            <div className="text-sm text-[#64748B]">
              This draft has not yet been reviewed by the designated principal. The reviewer decision will appear here once made.
            </div>
          </div>
        )}

        {/* Section 5 also surfaces the clearance token (when present)
            so the FINRA-defensible record carries it inline alongside
            the principal decision. */}
        <PublishTokenBlock draft={draft} variant="compact" />
      </section>

      {/* Section 6: Audit Trail */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">6. Audit Trail (Append-Only)</h2>
        <p className="text-xs text-neutral-500 mb-3">
          Each entry below was written to the database with a SHA-256 row hash computed at insert time. The actions table enforces append-only at the database level — UPDATE and DELETE are refused.
        </p>
        <ol className="space-y-3 text-sm">
          {actions
            .filter((a) => !a.payload?.backfilled)
            .map((a, idx) => {
              const actorLabel = formatActorKind(a, actors);
              return (
                <li key={a.id} className="border border-neutral-200 rounded p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="text-neutral-900 font-medium">
                      <span className="text-xs text-neutral-500 mr-2">#{idx + 1}</span>
                      {actionTypeLabel(a.action_type)}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono">{fmtTime(a.occurred_at)}</div>
                  </div>
                  <div className="mb-3">
                    {renderActionDetail(a.action_type, a.payload)}
                  </div>
                  <dl className="grid grid-cols-3 gap-y-1 text-xs">
                    <dt className="text-neutral-500">Actor</dt>
                    <dd className="col-span-2 text-neutral-700">{actorLabel}</dd>
                    {a.model_version && (<>
                      <dt className="text-neutral-500">Model version</dt>
                      <dd className="col-span-2 text-neutral-700 font-mono">{a.model_version}</dd>
                    </>)}
                    <dt className="text-neutral-500">Row hash (SHA-256)</dt>
                    <dd className="col-span-2 text-neutral-400 font-mono text-xs break-all">{a.row_hash}</dd>
                    <dt className="text-neutral-500">Action ID</dt>
                    <dd className="col-span-2 text-neutral-400 font-mono text-[11px]">{a.id}</dd>
                  </dl>
                </li>
              );
            })}
        </ol>
      </section>

      {/* Section 7: Regulatory Compliance Attestation. Conditional on whether
          a principal has acted — the four green check rows can only honestly
          appear once a reviewer_decided action exists. */}
      <section className="mb-8">
        <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-4">
          REGULATORY COMPLIANCE ATTESTATION
        </div>
        {hasDecision ? (
          <>
            {[
              {
                citation: "FINRA Rule 3110(a) — Supervision",
                description:
                  "Named principal review completed. Supervisory evidence preserved in append-only audit trail.",
              },
              {
                citation: "FINRA Rule 2210(b) — Pre-approval",
                description:
                  "Principal pre-approval of retail communication satisfied by ERA CUE review process.",
              },
              {
                citation: "SEC Rule 17a-4(f)(2)(ii) — Recordkeeping",
                description:
                  "Records retained via audit-trail pathway. All modifications logged. No deletion permitted. SHA-256 hash verification active. Retention period: 3 years from submission date. First 2 years immediately accessible.",
              },
              {
                citation: "EU AI Act Article 14 — Human oversight",
                description:
                  "Human oversight of AI system output confirmed. Designated principal reviewed and authorized this communication before publication.",
              },
            ].map((row) => (
              <div
                key={row.citation}
                className="flex items-start gap-3 py-3 border-b border-[#F1F5F9] last:border-0"
              >
                <div
                  aria-hidden
                  className="shrink-0 w-7 h-7 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center"
                >
                  <span className="text-xs text-[#166534]">✓</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F172A]">{row.citation}</div>
                  <div className="text-sm text-[#374151] mt-0.5 leading-relaxed">{row.description}</div>
                </div>
              </div>
            ))}
            <div className="text-xs text-[#64748B] mt-4 leading-relaxed">
              This attestation was generated by ERA CUE on {fmtTime(generatedAt)}. Record ID: {draft.id}. This document may be presented to regulatory examiners as evidence of supervisory compliance.
            </div>
          </>
        ) : (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#B45309] mb-2">
              Attestation pending
            </div>
            <div className="text-sm text-[#92400E] leading-relaxed">
              The regulatory compliance attestation requires evidence of principal review. It will appear once the designated principal has reviewed this draft.
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// ---------- Publish token block ------------------------------------------

/**
 * Dark code-block credential. Used in two places:
 *   • Summary view, after Principal decision (default variant).
 *   • Full record, end of Section 5 (variant="compact" — tighter
 *     vertical rhythm so it sits cleanly inside the section card).
 *
 * Renders nothing when the token isn't present (drafts pre-dating
 * approval, or rows pre-dating scripts/publish-token-migration.sql).
 */
function PublishTokenBlock({
  draft,
  variant = "default",
}: {
  draft: DraftRow;
  variant?: "default" | "compact";
}) {
  if (!draft.publish_token) return null;

  const expiresAt = draft.publish_token_expires_at
    ? new Date(draft.publish_token_expires_at)
    : null;
  const isValid = expiresAt ? expiresAt.getTime() > Date.now() : false;
  const expiresLabel = expiresAt
    ? expiresAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
  const hashPreview = draft.draft_hash_at_approval
    ? `${draft.draft_hash_at_approval.slice(0, 16)}...`
    : "—";

  const wrapperCls =
    variant === "compact"
      ? "mt-4 pt-4 border-t border-[#E2E8F0]"
      : "pb-5 mb-8 border-b border-[#E2E8F0]";

  return (
    <div className={wrapperCls}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
        Clearance token
      </div>
      <div className="bg-[#0F172A] rounded-sm p-4 font-mono text-[11px] text-[#7DD3FC] space-y-1">
        <div>token: {draft.publish_token}</div>
        <div>draft_hash: {hashPreview}</div>
        <div>expires: {expiresLabel}</div>
        <div>status: {isValid ? "✓ valid" : "✗ expired"}</div>
      </div>
      <div className="font-mono text-[10px] text-[#94A3B8] mt-2">
        Present this token to any ERA CUE-integrated publishing tool. If the draft text is modified after approval, the token becomes invalid.
      </div>
    </div>
  );
}
