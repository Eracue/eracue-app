import { notFound } from "next/navigation";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { PrintButton } from "./print-button";

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
    .select("id, draft_text, channel, source_origin, ai_model_used, prompt_hash, status, submitted_at, speaker_id, campaign_id, users(name, title, email), campaigns(name)")
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

export default async function ExaminerRecordPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getExaminerRecord(id);
  if (!result) notFound();
  const { draft, actions, rules, actors } = result;

  return (
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
            className="px-4 py-1.5 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition"
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
          <h1 className="text-2xl font-light text-neutral-900 mb-1">ERA CUE Audit Record</h1>
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
            <dt className="text-neutral-500">Source origin</dt>
            <dd className="col-span-2 text-neutral-900">{draft.source_origin.replace("_", " ")}</dd>
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

        {/* Section 4: Audit Trail (the immutable record) */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">4. Audit Trail (Append-Only)</h2>
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
  );
}
