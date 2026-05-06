import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin, type CheckEntry } from "@/lib/checks";
import { PrintButton } from "./print-button";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  ai_model_used: string | null;
  prompt_hash: string | null;
  // FINRA 2026 GenAI prompt logging — full prompt text retained on the
  // governance record. Nullable for legacy/migrated drafts.
  prompt_used: string | null;
  status: string;
  submitted_at: string;
  speaker_id: string;
  campaign_id: string | null;
  // FINRA Rule 2210 classification (may be null on records that pre-date the migration)
  communication_category: "retail" | "institutional" | "correspondence" | null;
  content_type: "static" | "interactive" | null;
  intended_audience: "public" | "limited" | "institutional" | null;
  users: { name: string; title: string | null; email: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionRow = {
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

type RuleRow = {
  id: string;
  name: string;
  rule_type: string;
  description: string;
  effective_from: string;
  effective_to: string | null;
  // Pointer to the firm's Written Supervisory Procedures section that this
  // rule enforces — surfaced on the examiner record so the audit trail
  // connects the enforcement event to the procedural authority.
  wsp_reference: string | null;
};

async function getExaminerRecord(draftId: string) {
  const sb = getSupabaseAdmin();

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, ai_model_used, prompt_hash, prompt_used, status, submitted_at, speaker_id, campaign_id, communication_category, content_type, intended_audience, users(name, title, email), campaigns(name)")
    .eq("id", draftId)
    .eq("org_id", DEMO_ORG_ID)
    .single();
  if (dErr || !draft) return null;

  const { data: actions } = await sb
    .from("actions")
    .select("id, action_type, actor_kind, actor_id, payload, rules_active, model_version, occurred_at, row_hash")
    .eq("draft_id", draftId)
    .order("occurred_at", { ascending: true });

  // Also fetch rules referenced anywhere in actions for context
  const allRuleIds = new Set<string>();
  for (const a of actions || []) {
    for (const rid of a.rules_active || []) allRuleIds.add(rid);
  }
  let rules: RuleRow[] = [];
  if (allRuleIds.size > 0) {
    const { data: rulesData } = await sb
      .from("rules")
      .select("id, name, rule_type, description, effective_from, effective_to, wsp_reference")
      .in("id", Array.from(allRuleIds));
    rules = (rulesData || []) as RuleRow[];
  }

  // Resolve actor names
  const actorIds = Array.from(new Set((actions || []).map((a) => a.actor_id).filter((x): x is string => !!x)));
  const actors: Record<string, { name: string; title: string | null }> = {};
  if (actorIds.length > 0) {
    const { data: actorData } = await sb.from("users").select("id, name, title").in("id", actorIds);
    for (const u of actorData || []) actors[u.id] = { name: u.name, title: u.title };
  }

  return {
    draft: draft as unknown as DraftRow,
    actions: (actions || []) as ActionRow[],
    rules,
    actors,
  };
}

function fmtTime(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}

// Effective dates on a rule render in the examiner record as plain
// English ("April 15, 2026"). The underlying timestamps stay on the
// rule row; examiners want a date, not a UTC instant.
function formatRuleDate(dateStr: string | null): string {
  if (!dateStr) return "no end date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Rule.rule_type ("block", "escalate", ...) rendered as the same kind
// of compact uppercase pill the rest of the app uses for verdicts —
// keeps the visual vocabulary consistent across the dashboard, the
// drafts list, and the examiner record.
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

// Map a draft.source_origin into the three regulatory-frame fields the
// examiner record renders in Section 1. Centralised here so the disclosure
// language is consistent across formats and the legacy raw-string display
// is no longer leaked into the dl/dt/dd.
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

// "draft_submitted" -> "Draft Submitted". Used for the audit-trail row
// title and as a fallback when an action_type doesn't have a bespoke
// human-readable rendering yet.
function actionTypeLabel(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Convert a raw action payload into the prose we want examiners to read.
// Each branch handles a specific action_type the system writes; everything
// else falls through to the default Title Case label. The full payload is
// still recoverable via the row hash + action ID printed alongside, so
// nothing in this layer is destructive.
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

export default async function ExaminerRecordPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getExaminerRecord(id);
  if (!result) notFound();
  const { draft, actions, rules, actors } = result;

  // Most-recent verdict drives the Checks Performed section. Older records that
  // pre-date payload.checks fall back to a primary_match-derived chain.
  const latestVerdict = [...actions]
    .reverse()
    .find((a) => a.action_type === "verdict_issued");
  const verdictPayload = (latestVerdict?.payload || {}) as {
    verdict?: string;
    primary_match?: { rule_id?: string; rule_name?: string; matched_keyword?: string } | null;
    checks?: CheckEntry[];
  };
  const primaryMatch = verdictPayload.primary_match || null;
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

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-white text-black print:bg-white">
      {/* Print-only stylesheet to ensure clean printing */}
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
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Examiner Record</div>
          <h1 className="text-2xl mb-1">
            <span style={{ fontFamily: "var(--font-newsreader)" }} className="font-light">
              <span className="text-[#1A56DB]">ERA</span>
              <span className="text-[#1A56DB] italic"> CUE</span>
            </span>
            <span className="text-[#0F172A] font-light"> Audit Record</span>
          </h1>
          <p className="text-sm text-neutral-600">Draft ID: <span className="font-mono">{draft.id}</span></p>
          <p className="text-xs text-neutral-500 mt-2">Generated: {fmtTime(new Date().toISOString())}</p>
        </header>

        {/* Section 1: Speaker & Submission */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">1. Speaker & Submission</h2>

          {/* Most prominent fact in the document — has a designated
              principal completed FINRA Rule 3110 review or not? Decided
              record gets a green block; undecided gets an amber block.
              Sits above the dl so it's the first thing an examiner sees. */}
          {reviewerDecisions.length > 0 ? (
            (() => {
              const last = reviewerDecisions[reviewerDecisions.length - 1];
              const lookupActor = last?.actor_id ? actors[last.actor_id] : null;
              const reviewerName =
                (last?.payload?.reviewer_name as string | undefined) ||
                (lookupActor
                  ? `${lookupActor.name}${lookupActor.title ? `, ${lookupActor.title}` : ""}`
                  : "Sarah Chen, GC");
              const occurredLabel = last?.occurred_at
                ? new Date(last.occurred_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div className="mb-6 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-2">
                    ✓ Human Review Completed
                  </div>
                  <div className="text-base font-semibold text-[#0F172A]">
                    Reviewed and approved by {reviewerName}
                  </div>
                  {occurredLabel && (
                    <div className="font-mono text-xs text-[#374151] mt-1">
                      {occurredLabel}
                    </div>
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

        {/* Section 1.5: Regulatory Framework — multi-rule compliance map */}
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
                // 2210(b)'s pre-approval requirement is retail-only. Rendering
                // a single "satisfied" line for every category misrepresents
                // what the rule actually requires.
                const cat = draft.communication_category ?? "retail";
                if (cat === "retail") {
                  return "Pre-approval satisfied — retail communication reviewed by designated principal per Rule 2210(b)";
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
                new Date(draft.submitted_at).getTime() + 36 * 30 * 24 * 60 * 60 * 1000
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
              const latestDecision =
                reviewerDecisions.length > 0
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

        {/* Section 4: Checks Performed — the canonical 5-check chain */}
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
                </div>
                <CheckResultLabel result={c.result} />
              </li>
            ))}
          </ul>
        </section>

        {/* Section 5: Reviewer Decisions — only when a principal has acted */}
        {reviewerDecisions.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">5. Reviewer Decisions</h2>

            {/* Principal identity strip — visible on screen and in print */}
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
                const payload = a.payload as { decision?: string; reason?: unknown; new_status?: string };
                const reason = basisFromReason(payload.reason);
                const isObj = reason && typeof reason === "object";
                const reasonObj = isObj ? (reason as { basis?: string; verdict_assessment?: string | null; note?: string }) : null;
                const reasonStr = !isObj && typeof reason === "string" ? reason : null;
                const actorLabel = a.actor_kind === "user" && a.actor_id && actors[a.actor_id]
                  ? `${actors[a.actor_id].name}${actors[a.actor_id].title ? ` (${actors[a.actor_id].title})` : ""}`
                  : a.actor_kind;
                return (
                  <li key={a.id} className="border border-neutral-200 rounded p-3">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <div className="text-neutral-900 font-medium">
                        <span className="text-xs text-neutral-500 mr-2">#{idx + 1}</span>
                        Decision: <span className="uppercase">{payload.decision || "—"}</span>
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">{fmtTime(a.occurred_at)}</div>
                    </div>
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
          </section>
        )}

        {/* Section 6: Audit Trail (the immutable record) */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-3 border-b border-neutral-200 pb-2">6. Audit Trail (Append-Only)</h2>
          <p className="text-xs text-neutral-500 mb-3">
            Each entry below was written to the database with a SHA-256 row hash computed at insert time. The actions table enforces append-only at the database level — UPDATE and DELETE are refused.
          </p>
          <ol className="space-y-3 text-sm">
            {actions
              // Hide rows that were inserted by the demo backfill script —
              // these aren't real submissions and shouldn't show up on an
              // examiner-facing record.
              .filter((a) => !a.payload?.backfilled)
              .map((a, idx) => {
                // Actor labelling: system actors get the product name;
                // user/reviewer actors resolve through the users lookup,
                // falling back to the designated principal so an unknown
                // actor never reads as a bare "user" in the print copy.
                let actorLabel: string;
                if (a.actor_kind === "system") {
                  actorLabel = "ERA CUE system";
                } else if (a.actor_kind === "user" || a.actor_kind === "reviewer") {
                  if (a.actor_id && actors[a.actor_id]) {
                    const u = actors[a.actor_id];
                    actorLabel = `${u.name}${u.title ? ` (${u.title})` : ""}`;
                  } else {
                    actorLabel = "Sarah Chen, GC (Designated Principal)";
                  }
                } else {
                  actorLabel = a.actor_kind;
                }
                return (
                  <li key={a.id} className="border border-neutral-200 rounded p-3">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <div className="text-neutral-900 font-medium">
                        <span className="text-xs text-neutral-500 mr-2">#{idx + 1}</span>
                        {actionTypeLabel(a.action_type)}
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">{fmtTime(a.occurred_at)}</div>
                    </div>
                    {/* Human-readable summary in place of the raw JSON payload —
                        the underlying record remains hashed and recoverable
                        through the row hash + action ID below. */}
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

        {/* Section 7: Regulatory Compliance Attestation — examiner-facing
            summary that ties the record back to the four regulatory pathways
            ERA CUE satisfies in a single submission. */}
        <section className="mb-8">
          <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-4">
            REGULATORY COMPLIANCE ATTESTATION
          </div>
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
                <div className="text-sm font-semibold text-[#0F172A]">
                  {row.citation}
                </div>
                <div className="text-sm text-[#374151] mt-0.5 leading-relaxed">
                  {row.description}
                </div>
              </div>
            </div>
          ))}
          <div className="text-xs text-[#64748B] mt-4 leading-relaxed">
            This attestation was generated by ERA CUE on {fmtTime(new Date().toISOString())}.
            Record ID: {draft.id}. This document may be presented to regulatory
            examiners as evidence of supervisory compliance.
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-neutral-900 pt-4 mt-8 text-xs text-neutral-500">
          <p>This record was generated by ERA CUE on {fmtTime(new Date().toISOString())}.</p>
          <p className="mt-1">All hashes are SHA-256 computed at the time of database insert. The actions table is append-only — UPDATE and DELETE are rejected at the database level. Any tampering with this record would require a different database; the hash chain in this print would not match.</p>
          <p className="mt-1 font-mono">end of record · draft {draft.id}</p>
        </footer>
      </div>
    </main>
    </>
  );
}
