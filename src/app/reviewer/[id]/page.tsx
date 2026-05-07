import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin, type CheckEntry } from "@/lib/checks";
import { ReviewerDecisionForm } from "./reviewer-form";
import { CheckDetailPanel } from "./check-detail-panel";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  status: string;
  submitted_at: string;
  communication_category: "retail" | "institutional" | "correspondence" | null;
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
  const orgId = await resolveOrgId();
  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, communication_category, users(name, title), campaigns(name)")
    .eq("id", id)
    .eq("org_id", orgId)
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
    block:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
    escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
    review:   { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
    guide:    { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
    clear:    { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
  };
  const s = styles[verdict] || styles.clear;
  return (
    <span className={`inline-flex items-center px-4 py-2 rounded-sm border font-mono text-base font-bold uppercase tracking-widest ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

// One-line plain-English explanation of each system verdict, surfaced
// just below the verdict badge so the principal sees what they're being
// asked to do without having to interpret the colour/word alone.
const verdictExplanation: Record<string, string> = {
  block:
    "This draft violated a hard-stop rule. The principal must override or confirm the block before publication.",
  escalate:
    "This draft needs principal review before publication. Approve or reject using the decision form.",
  review:
    "This draft has been flagged for consistency review. Check against prior statements before approving.",
  guide:
    "Advisory flag only. This draft can publish but consider the guidance noted.",
  clear:
    "No violations found. System cleared this draft for publication.",
};

function decisionBadge(d: string | undefined): { cls: string; label: string } {
  if (d === "override")
    return { cls: "bg-[#EFF8FF] text-[#1447C0] border-[#BAE6FD]", label: "OVERRIDE" };
  if (d === "approve")
    return { cls: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]", label: "APPROVE" };
  if (d === "confirm_block")
    return { cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]", label: "CONFIRM BLOCK" };
  if (d === "reject")
    return { cls: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]", label: "REJECT" };
  return { cls: "bg-[#F8F9FB] text-[#64748B] border-[#E2E8F0]", label: (d || "—").toUpperCase() };
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
      <mark className="bg-[#FEF3C7] px-0.5 rounded">{match}</mark>
      {after}
    </>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// Map raw actor_kind values onto the names a principal would actually
// recognise. The payload param is reserved for future per-row enrichment
// (e.g. resolving a specific reviewer's name); today every reviewer is
// Sarah Chen, GC.
function formatActor(
  actorKind: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _payload?: Record<string, unknown>,
): string {
  switch (actorKind) {
    case "system":
      return "ERA CUE system";
    case "ai_check":
      return "ERA CUE checks";
    case "reviewer":
      return "Sarah Chen, GC";
    case "user":
      return "Speaker";
    default:
      return actorKind;
  }
}

export default async function ReviewerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getDraft(id);
  if (!result) notFound();
  const { draft, actions } = result;

  // Latest verdict (re-runs append; the live state is the most recent verdict).
  const verdictAction = [...actions].reverse().find((a) => a.action_type === "verdict_issued");
  const verdict = (verdictAction?.payload?.verdict as string) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryMatch = (verdictAction?.payload?.primary_match as any) || null;
  const matchedKeyword = primaryMatch?.matched_keyword as string | undefined;

  const reviewerDecision = actions.find((a) => a.action_type === "reviewer_decided");
  const alreadyDecided = !!reviewerDecision;

  // Build the canonical 5-check chain (with fallback for legacy rows).
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

  // Decision payload (newer = structured object; older = string).
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
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          {/* Page header — full width above columns */}
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A]"
            >
              ← Dashboard
            </Link>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-3"
            >
              Review draft
            </h1>
            <p className="text-sm text-[#374151] mt-1">
              From {draft.users?.name || "—"}
              {draft.users?.title ? ` (${draft.users.title})` : ""}
              {draft.campaigns?.name ? ` · Campaign: ${draft.campaigns.name}` : ""}
            </p>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT — Draft context (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Card 1 — System verdict */}
              {verdict && (
                <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
                  <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                    SYSTEM VERDICT
                  </div>
                  <div className="mt-2">
                    <VerdictBadge verdict={verdict} />
                  </div>
                  {verdict && verdictExplanation[verdict] && (
                    <p className="text-sm text-[#374151] mt-2 leading-relaxed">
                      {verdictExplanation[verdict]}
                    </p>
                  )}
                  {primaryMatch && (
                    <>
                      <div className="text-sm font-medium text-[#0F172A] mt-3">
                        {primaryMatch.rule_name}
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        {primaryMatch.rule_description}
                      </div>
                      {matchedKeyword && (
                        <span className="font-mono text-xs bg-[#F1F5F9] text-[#1A56DB] px-2 py-0.5 rounded-sm mt-2 inline-block">
                          keyword: {matchedKeyword}
                        </span>
                      )}
                    </>
                  )}
                  <div className="mt-4 pt-4 border-t border-[#E2E8F0] font-mono text-xs text-[#64748B]">
                    Current status: <span className="text-[#0F172A]">{draft.status}</span>
                  </div>
                </div>
              )}

              {/* Card 2 — Check detail (the component renders its own card) */}
              <CheckDetailPanel checks={checks} />

              {/* Card 3 — Draft text */}
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
                <div className="flex items-center gap-2 mb-4 font-mono text-xs text-[#64748B] uppercase tracking-wide">
                  <span>{draft.channel}</span>
                  <span>·</span>
                  <span>{draft.source_origin.replace("_", " ")}</span>
                </div>
                <p className="text-[#0F172A] text-base whitespace-pre-wrap leading-relaxed">
                  {highlightMatch(draft.draft_text, matchedKeyword)}
                </p>
                <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex items-center justify-between font-mono text-xs text-[#64748B]">
                  <span>Submitted {fmtDate(draft.submitted_at)}</span>
                  <Link
                    href={`/drafts/${draft.id}/examiner`}
                    className="text-[#1A56DB] hover:text-[#1447C0]"
                  >
                    Export examiner record →
                  </Link>
                </div>
              </div>
            </div>

            {/* RIGHT — Decision workspace (2 cols) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Card 1 — Principal identity. Border softened to FEF3C7 and
                  the eyebrow shifted to a deeper amber (#B45309) so the
                  hierarchy reads: eyebrow → name → authority lines → demo
                  note in muted slate. */}
              <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-sm p-4">
                {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
                  <div className="font-mono text-[10px] text-[#94A3B8] mb-3 pb-3 border-b border-[#FEF3C7] italic">
                    In this demo, you are the designated principal — the named supervisor responsible for this communication.
                  </div>
                )}
                <div className="font-mono text-[10px] text-[#B45309] uppercase tracking-widest">
                  Reviewing as
                </div>
                <div className="text-sm font-medium text-[#0F172A] mt-1">
                  Sarah Chen · CCO
                </div>
                <div className="font-mono text-xs text-[#92400E] mt-2">
                  Designated Principal · Final approval
                </div>
                <div className="font-mono text-[10px] text-[#92400E] mt-2">
                  FINRA Rule 3110(a) + Rule 2210(b)
                </div>
                {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-3 italic">
                    Demo identity — production reads from user record
                  </div>
                )}
              </div>

              {/* Card 2 — Decision form OR already-decided panel */}
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
                {alreadyDecided ? (
                  <>
                    <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                      DECISION RECORDED
                    </div>
                    {(() => {
                      const badge = decisionBadge(decisionPayload?.decision);
                      return (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[10px] uppercase mt-2 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                    {structured ? (
                      <dl className="grid grid-cols-[7rem_1fr] gap-y-2 gap-x-3 mt-4 text-sm">
                        {structured.basis && (
                          <>
                            <dt className="font-mono text-xs text-[#64748B]">Basis</dt>
                            <dd className="text-[#0F172A]">{structured.basis}</dd>
                          </>
                        )}
                        {structured.verdict_assessment && (
                          <>
                            <dt className="font-mono text-xs text-[#64748B]">Verdict assessment</dt>
                            <dd className="text-[#0F172A]">{structured.verdict_assessment}</dd>
                          </>
                        )}
                        {structured.note && (
                          <>
                            <dt className="font-mono text-xs text-[#64748B]">Note</dt>
                            <dd className="text-[#0F172A]">{structured.note}</dd>
                          </>
                        )}
                      </dl>
                    ) : typeof decisionReason === "string" && decisionReason ? (
                      <div className="mt-4">
                        <div className="font-mono text-xs text-[#64748B]">Reason</div>
                        <div className="text-sm text-[#0F172A] mt-1">{decisionReason}</div>
                      </div>
                    ) : null}
                    {reviewerDecision && (
                      <div className="font-mono text-xs text-[#64748B] mt-4 pt-4 border-t border-[#E2E8F0]">
                        {fmtDate(reviewerDecision.occurred_at)}
                      </div>
                    )}
                  </>
                ) : (
                  <ReviewerDecisionForm
                    draftId={draft.id}
                    currentStatus={draft.status}
                    verdict={verdict || "clear"}
                  />
                )}
              </div>

              {/* Card 3 — Audit timeline */}
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
                <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-3">
                  AUDIT TIMELINE
                </div>
                <ul>
                  {actions.map((a, i) => (
                    <li
                      key={a.id}
                      className={`flex items-baseline gap-3 py-2 ${
                        i < actions.length - 1 ? "border-b border-[#F1F5F9]" : ""
                      }`}
                    >
                      <span className="font-mono text-xs text-[#64748B] w-20 shrink-0">
                        {fmtTime(a.occurred_at)}
                      </span>
                      <span className="text-sm text-[#0F172A]">
                        {capitalize(a.action_type.replace(/_/g, " "))}
                      </span>
                      <span className="font-mono text-xs text-[#64748B]">({formatActor(a.actor_kind, a.payload)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
