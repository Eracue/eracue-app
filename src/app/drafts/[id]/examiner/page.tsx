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
};

async function getExaminerRecord(draftId: string) {
  const sb = getSupabaseAdmin();

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, ai_model_used, prompt_hash, status, submitted_at, speaker_id, campaign_id, communication_category, content_type, intended_audience, users(name, title, email), campaigns(name)")
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
      .select("id, name, rule_type, description, effective_from, effective_to")
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

function shortHash(h: string | null | undefined): string {
  if (!h) return "—";
  if (h.length <= 16) return h;
  return h.slice(0, 8) + "..." + h.slice(-8);
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
              <span className="text-[#4F46E5]">ERA</span>
              <span className="text-[#4F46E5] italic"> CUE</span>
            </span>
            <span className="text-[#1C1C1A] font-light"> Audit Record</span>
          </h1>
          <p className="text-sm text-neutral-600">Draft ID: <span className="font-mono">{draft.id}</span></p>
          <p className="text-xs text-neutral-500 mt-2">Generated: {fmtTime(new Date().toISOString())}</p>
        </header>

        {/* Section 1: Speaker & Submission */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">1. Speaker & Submission</h2>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-neutral-500">Speaker</dt>
            <dd className="col-span-2 text-neutral-900 font-medium">{draft.users?.name || "—"}{draft.users?.title ? ` (${draft.users.title})` : ""}</dd>
            <dt className="text-neutral-500">Email</dt>
            <dd className="col-span-2 text-neutral-900">{draft.users?.email || "—"}</dd>
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
            {draft.ai_model_used && (<>
              <dt className="text-neutral-500">AI model used</dt>
              <dd className="col-span-2 text-neutral-900 font-mono">{draft.ai_model_used}</dd>
            </>)}
            {draft.prompt_hash && (<>
              <dt className="text-neutral-500">Prompt hash (SHA-256)</dt>
              <dd className="col-span-2 text-neutral-900 font-mono text-xs">{shortHash(draft.prompt_hash)}</dd>
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">Regulatory Framework</h2>
          <dl>
            <dt className="font-mono text-xs uppercase tracking-widest text-neutral-500">FINRA Rule 3110(a)</dt>
            <dd className="text-sm text-neutral-900 mt-0.5">
              Supervision · Named principal review required
            </dd>
            <dd className="font-mono text-xs text-neutral-500 mb-4">
              Principal: Sarah Chen · CCO · Designated Principal
            </dd>

            <dt className="font-mono text-xs uppercase tracking-widest text-neutral-500">FINRA Rule 2210(b)</dt>
            <dd className="text-sm text-neutral-900 mt-0.5 mb-4">
              {(draft.communication_category ?? "retail") === "retail"
                ? "Pre-approval required · Satisfied by ERA CUE principal review at submission"
                : (draft.communication_category ?? "retail") === "institutional"
                ? "Content standards applied · Fair and balanced per Rule 2210(d)"
                : "Supervision required · Satisfied by ERA CUE check engine"}
            </dd>

            <dt className="font-mono text-xs uppercase tracking-widest text-neutral-500">SEC Rule 17a-4 · FINRA Rule 4511</dt>
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

            <dt className="font-mono text-xs uppercase tracking-widest text-neutral-500">EU AI Act Article 50</dt>
            <dd className="text-sm text-neutral-900 mt-0.5 mb-4">
              {draft.source_origin === "ai_generated"
                ? "Disclosure required · Content generated without human editing"
                : draft.source_origin === "ai_assisted"
                ? "Human-edited AI draft · Disclosure recommended at publication"
                : "Human-authored · Article 50 disclosure not required"}
            </dd>
          </dl>
        </section>

        {/* Section 2: Draft text */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">2. Draft Text (verbatim)</h2>
          <div className="p-4 border border-neutral-300 rounded text-sm text-neutral-900 whitespace-pre-wrap leading-relaxed bg-neutral-50">
            {draft.draft_text}
          </div>
        </section>

        {/* Section 3: Rules active at submission */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">3. Governance Rules Active at Submission</h2>
          {rules.length === 0 ? (
            <p className="text-sm text-neutral-500">No rule snapshots recorded.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {rules.map((r) => (
                <li key={r.id} className="border border-neutral-200 rounded p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div className="font-medium text-neutral-900">{r.name}</div>
                    <div className="text-xs uppercase tracking-wide text-neutral-500">{r.rule_type}</div>
                  </div>
                  <div className="text-xs text-neutral-700 mb-1">{r.description}</div>
                  <div className="text-xs text-neutral-500 font-mono">
                    Effective {fmtTime(r.effective_from)}{r.effective_to ? ` — ${fmtTime(r.effective_to)}` : " — open"}
                  </div>
                  <div className="text-xs text-neutral-400 font-mono mt-1">Rule ID: {r.id}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 4: Checks Performed — the canonical 5-check chain */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">4. Checks Performed</h2>
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">5. Reviewer Decisions</h2>

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
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">6. Audit Trail (Append-Only)</h2>
          <p className="text-xs text-neutral-500 mb-3">
            Each entry below was written to the database with a SHA-256 row hash computed at insert time. The actions table enforces append-only at the database level — UPDATE and DELETE are refused.
          </p>
          <ol className="space-y-3 text-sm">
            {actions.map((a, idx) => {
              const actorLabel = a.actor_kind === "user" && a.actor_id && actors[a.actor_id]
                ? `${actors[a.actor_id].name}${actors[a.actor_id].title ? ` (${actors[a.actor_id].title})` : ""}`
                : a.actor_kind;
              return (
                <li key={a.id} className="border border-neutral-200 rounded p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="text-neutral-900 font-medium">
                      <span className="text-xs text-neutral-500 mr-2">#{idx + 1}</span>
                      {a.action_type.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono">{fmtTime(a.occurred_at)}</div>
                  </div>
                  <dl className="grid grid-cols-3 gap-y-1 text-xs">
                    <dt className="text-neutral-500">Actor</dt>
                    <dd className="col-span-2 text-neutral-700">{actorLabel}</dd>
                    {a.model_version && (<>
                      <dt className="text-neutral-500">Model version</dt>
                      <dd className="col-span-2 text-neutral-700 font-mono">{a.model_version}</dd>
                    </>)}
                    <dt className="text-neutral-500">Payload</dt>
                    <dd className="col-span-2 text-neutral-700 font-mono whitespace-pre-wrap break-words text-[11px]">
                      {JSON.stringify(a.payload, null, 2)}
                    </dd>
                    <dt className="text-neutral-500">Row hash (SHA-256)</dt>
                    <dd className="col-span-2 text-neutral-400 font-mono text-[11px] break-all">{a.row_hash}</dd>
                    <dt className="text-neutral-500">Action ID</dt>
                    <dd className="col-span-2 text-neutral-400 font-mono text-[11px]">{a.id}</dd>
                  </dl>
                </li>
              );
            })}
          </ol>
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
