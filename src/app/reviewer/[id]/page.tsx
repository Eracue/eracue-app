import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin, type CheckEntry } from "@/lib/checks";
import { ReviewerDecisionForm } from "./reviewer-form";
import { CheckDetailPanel } from "./check-detail-panel";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  status: string;
  submitted_at: string;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionRow = {
  id: string;
  action_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor_kind: string;
};

async function getDraft(id: string) {
  const sb = getSupabaseAdmin();
  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, users(name, title), campaigns(name)")
    .eq("id", id)
    .eq("org_id", DEMO_ORG_ID)
    .single();
  if (dErr || !draft) return null;
  const { data: actions } = await sb
    .from("actions")
    .select("id, action_type, payload, occurred_at, actor_kind")
    .eq("draft_id", id)
    .order("occurred_at", { ascending: true });
  return {
    draft: draft as unknown as DraftRow,
    actions: (actions || []) as ActionRow[],
  };
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { bg: string; text: string; label: string; border: string }> = {
    block: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-900 dark:text-red-300", border: "border-red-300 dark:border-red-900", label: "BLOCK" },
    escalate: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-900 dark:text-amber-300", border: "border-amber-300 dark:border-amber-900", label: "ESCALATE" },
    review: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-900 dark:text-blue-300", border: "border-blue-300 dark:border-blue-900", label: "REVIEW" },
    guide: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-900 dark:text-purple-300", border: "border-purple-300 dark:border-purple-900", label: "GUIDE" },
    clear: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-900 dark:text-green-300", border: "border-green-300 dark:border-green-900", label: "CLEAR" },
  };
  const s = styles[verdict] || styles.clear;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-wide ${s.bg} ${s.text} border ${s.border}`}>
      {s.label}
    </span>
  );
}

function highlightMatch(text: string, keyword: string | undefined) {
  if (!keyword) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + keyword.length);
  const after = text.slice(idx + keyword.length);
  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-800/40 dark:text-yellow-100 px-0.5 rounded">{match}</mark>
      {after}
    </>
  );
}

export default async function ReviewerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getDraft(id);
  if (!result) notFound();
  const { draft, actions } = result;

  // Get verdict + match
  const verdictAction = actions.find((a) => a.action_type === "verdict_issued");
  const verdict = (verdictAction?.payload?.verdict as string) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryMatch = (verdictAction?.payload?.primary_match as any) || null;
  const matchedKeyword = primaryMatch?.matched_keyword as string | undefined;

  const reviewerDecision = actions.find((a) => a.action_type === "reviewer_decided");
  const alreadyDecided = !!reviewerDecision;

  // Build the 5-check chain. Newer verdicts store this in payload.checks.
  // Older records didn't — derive a fallback from primary_match: "Rule Check"
  // (and "Quiet Period Check" if applicable) FAIL, all others PASS.
  const storedChecks = verdictAction?.payload?.checks as CheckEntry[] | undefined;
  const isQuietPeriodMatch = primaryMatch ? /quiet period/i.test(primaryMatch.rule_name) : false;
  const checks: CheckEntry[] = storedChecks ?? [
    primaryMatch
      ? {
          check_name: "Rule Check",
          result: "fail" as const,
          detail: `Matched: ${primaryMatch.rule_name}`,
          matched_keyword: primaryMatch.matched_keyword,
        }
      : { check_name: "Rule Check", result: "pass" as const, detail: null },
    { check_name: "Consistency Check", result: "pass" as const, detail: null },
    { check_name: "Alignment Check", result: "pass" as const, detail: null },
    isQuietPeriodMatch && primaryMatch
      ? { check_name: "Quiet Period Check", result: "fail" as const, detail: `Quiet period rule matched: ${primaryMatch.rule_name}` }
      : { check_name: "Quiet Period Check", result: "pass" as const, detail: null },
    { check_name: "Agent Origin Check", result: "pass" as const, detail: null },
  ];

  // Decision payload: newer records store reason as a structured object
  // ({ basis, verdict_assessment, note }); older records stored a freeform string.
  const decisionPayload = reviewerDecision?.payload as
    | { decision?: string; reason?: unknown }
    | undefined;
  const decisionReason = decisionPayload?.reason;
  const isStructuredReason =
    !!decisionReason && typeof decisionReason === "object" && !Array.isArray(decisionReason);
  const structured = isStructuredReason
    ? (decisionReason as { basis?: string; verdict_assessment?: string | null; note?: string })
    : null;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/reviewer/queue" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">← Queue</Link>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-neutral-100 mt-2">Review draft</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            From {draft.users?.name || "—"}{draft.users?.title ? ` (${draft.users.title})` : ""}
            {draft.campaigns?.name ? ` · Campaign: ${draft.campaigns.name}` : ""}
          </p>
        </div>

        {/* Verdict */}
        {verdict && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">System verdict</div>
                <VerdictBadge verdict={verdict} />
              </div>
              <div className="text-right text-xs text-neutral-500 dark:text-neutral-400">
                Status: <span className="font-medium text-neutral-700 dark:text-neutral-300">{draft.status}</span>
              </div>
            </div>
            {primaryMatch && (
              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{primaryMatch.rule_name}</div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{primaryMatch.rule_description}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                  Matched keyword: <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{matchedKeyword}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check detail (collapsible) */}
        <CheckDetailPanel checks={checks} />

        {/* Draft */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-2 mb-4 text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            <span>{draft.channel}</span>
            <span>·</span>
            <span>{draft.source_origin.replace("_", " ")}</span>
          </div>
          <p className="text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">
            {highlightMatch(draft.draft_text, matchedKeyword)}
          </p>
        </div>

        {/* Principal identity strip — supervisory evidence, must print */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-2 text-xs mb-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="text-amber-900 dark:text-amber-200">
              <span className="text-amber-700 dark:text-amber-400">Reviewing as:</span>{" "}
              <span className="font-medium">Sarah Chen · CCO · Designated Principal</span>
            </div>
            <div className="text-amber-900 dark:text-amber-200 text-right">
              <span className="text-amber-700 dark:text-amber-400">Authority:</span>{" "}
              <span className="font-medium">Final approval · FINRA Rule 3110(a)</span>
            </div>
          </div>
          <div className="mt-1 flex justify-end">
            <span className="text-[10px] text-amber-700/70 dark:text-amber-400/70 italic">
              Demo identity — production would read from user record
            </span>
          </div>
        </div>

        {/* Decision form OR already-decided notice */}
        {alreadyDecided ? (
          <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 text-sm text-neutral-700 dark:text-neutral-300">
            <div className="font-medium mb-3">Already decided</div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 gap-x-3">
              <dt className="text-neutral-500 dark:text-neutral-400">Decision</dt>
              <dd className="text-neutral-900 dark:text-neutral-100">
                {(decisionPayload?.decision as string) || "—"}
              </dd>
              {structured ? (
                <>
                  <dt className="text-neutral-500 dark:text-neutral-400">Basis</dt>
                  <dd className="text-neutral-900 dark:text-neutral-100">{structured.basis || "—"}</dd>
                  {structured.verdict_assessment && (
                    <>
                      <dt className="text-neutral-500 dark:text-neutral-400">Verdict assessment</dt>
                      <dd className="text-neutral-900 dark:text-neutral-100">{structured.verdict_assessment}</dd>
                    </>
                  )}
                  {structured.note && (
                    <>
                      <dt className="text-neutral-500 dark:text-neutral-400">Note</dt>
                      <dd className="text-neutral-900 dark:text-neutral-100">{structured.note}</dd>
                    </>
                  )}
                </>
              ) : (
                typeof decisionReason === "string" && decisionReason && (
                  <>
                    <dt className="text-neutral-500 dark:text-neutral-400">Reason</dt>
                    <dd className="text-neutral-900 dark:text-neutral-100">{decisionReason}</dd>
                  </>
                )
              )}
            </dl>
          </div>
        ) : (
          <ReviewerDecisionForm
            draftId={draft.id}
            currentStatus={draft.status}
            verdict={verdict || "clear"}
          />
        )}

        {/* Audit timeline */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 mt-6">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">Audit timeline</div>
          <ul className="space-y-2 text-sm">
            {actions.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3">
                <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono w-20 shrink-0">{new Date(a.occurred_at).toLocaleTimeString()}</span>
                <span className="text-neutral-700 dark:text-neutral-300">{a.action_type.replace(/_/g, " ")}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">({a.actor_kind})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
    </>
  );
}
