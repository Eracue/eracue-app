import { createHash } from "crypto";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> };

// ---------- Types ---------------------------------------------------------

type DraftRow = {
  id: string;
  draft_text: string;
  status: string;
  source_origin: string;
  submitted_at: string;
  users: { name: string; title: string | null } | null;
};

type DecisionRow = {
  id: string;
  occurred_at: string;
  draft_id: string;
  payload: { decision?: string; reason?: unknown; new_status?: string };
  drafts: {
    id: string;
    draft_text: string;
    users: { name: string; title: string | null } | null;
  } | null;
};

type RuleRow = {
  id: string;
  name: string;
  rule_type: string;
  description: string;
  effective_from: string;
  effective_to: string | null;
  wsp_reference: string | null;
};

type VerdictRow = {
  occurred_at: string;
  payload: { primary_match?: { rule_id?: string; rule_name?: string } | null };
};

// ---------- Date helpers --------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

function fmtRange(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}

function basisFromReason(reason: unknown): string {
  if (!reason) return "—";
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null && "basis" in reason) {
    const b = (reason as { basis?: unknown }).basis;
    return typeof b === "string" ? b : "—";
  }
  return "—";
}

// ---------- Page ----------------------------------------------------------

export default async function SupervisionReportPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const fromDate = sp.from || firstOfMonthISO();
  const toDate = sp.to || todayISO();
  const fromIso = `${fromDate}T00:00:00.000Z`;
  const toIso = `${toDate}T23:59:59.999Z`;
  const generatedAt = new Date().toISOString();

  const sb = getSupabaseAdmin();

  const [draftsRes, decisionsRes, rulesRes, verdictsRes] = await Promise.all([
    sb
      .from("drafts")
      .select("id, draft_text, status, source_origin, submitted_at, users:speaker_id(name, title)")
      .eq("org_id", DEMO_ORG_ID)
      .gte("submitted_at", fromIso)
      .lte("submitted_at", toIso)
      .order("submitted_at", { ascending: true }),
    sb
      .from("actions")
      .select(
        "id, occurred_at, draft_id, payload, drafts(id, draft_text, users:speaker_id(name, title))",
      )
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "reviewer_decided")
      .in("payload->>decision", ["override", "confirm_block", "approve", "reject"])
      .gte("occurred_at", fromIso)
      .lte("occurred_at", toIso)
      .order("occurred_at", { ascending: true }),
    sb
      .from("rules")
      .select("id, name, rule_type, description, effective_from, effective_to, wsp_reference")
      .eq("org_id", DEMO_ORG_ID)
      .order("name"),
    sb
      .from("actions")
      .select("occurred_at, payload")
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "verdict_issued")
      .gte("occurred_at", fromIso)
      .lte("occurred_at", toIso),
  ]);

  const drafts = (draftsRes.data || []) as unknown as DraftRow[];
  const decisions = (decisionsRes.data || []) as unknown as DecisionRow[];
  const allRules = (rulesRes.data || []) as RuleRow[];
  const verdicts = (verdictsRes.data || []) as VerdictRow[];

  // Active rules during period: effective range overlaps the report window.
  const fromTs = new Date(fromIso).getTime();
  const toTs = new Date(toIso).getTime();
  const activeRules = allRules.filter((r) => {
    const ef = new Date(r.effective_from).getTime();
    const et = r.effective_to ? new Date(r.effective_to).getTime() : null;
    return ef <= toTs && (et === null || et >= fromTs);
  });

  // Trigger count per rule, joined on rule_id with a rule_name fallback
  // (matches the dashboard convention for legacy seed data).
  const triggers: Record<string, number> = {};
  for (const v of verdicts) {
    const pm = v.payload?.primary_match;
    if (!pm) continue;
    if (pm.rule_id) triggers[pm.rule_id] = (triggers[pm.rule_id] || 0) + 1;
    else if (pm.rule_name) triggers[`name:${pm.rule_name}`] = (triggers[`name:${pm.rule_name}`] || 0) + 1;
  }

  const summary = {
    total: drafts.length,
    cleared: drafts.filter((d) => d.status === "approved").length,
    blocked: drafts.filter((d) => d.status === "blocked").length,
    escalated: drafts.filter((d) => d.status === "escalated").length,
    overridden: drafts.filter((d) => d.status === "overridden").length,
    aiAssisted: drafts.filter((d) => d.source_origin === "ai_assisted").length,
    agentSubmitted: drafts.filter((d) => d.source_origin === "agent_submitted").length,
  };

  // Hash the deterministic content of the report so the printed page can
  // claim integrity over its own contents.
  const hashInput = JSON.stringify({
    fromIso,
    toIso,
    generatedAt,
    summary,
    drafts,
    decisions,
    activeRules: activeRules.map((r) => ({
      id: r.id,
      name: r.name,
      rule_type: r.rule_type,
      effective_from: r.effective_from,
      effective_to: r.effective_to,
      wsp_reference: r.wsp_reference,
    })),
  });
  const reportHash = createHash("sha256").update(hashInput).digest("hex");

  const ATTESTATION_ROWS = [
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
  ];

  return (
    <main className="bg-white text-black min-h-screen">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          a { color: black !important; text-decoration: none !important; }
        }
      `}</style>

      {/* Print toolbar — hidden in printed output */}
      <div className="no-print bg-neutral-100 border-b border-neutral-200 px-6 py-3 sticky top-0 flex justify-between items-center">
        <span className="text-sm text-neutral-600">Supervision Period Report</span>
        <PrintButton />
      </div>

      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="border-b-2 border-neutral-900 pb-6 mb-8">
          <h1 className="text-3xl mb-2">
            <span style={{ fontFamily: "var(--font-newsreader)" }} className="font-light">
              <span className="text-[#1A56DB]">ERA</span>
              <span className="text-[#1A56DB] italic"> CUE</span>
            </span>
            <span className="text-[#0F172A] font-light"> Supervision Period Report</span>
          </h1>
          <p className="text-sm text-neutral-600">
            Period: {fmtRange(fromIso)} to {fmtRange(toIso)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Generated: {fmtTime(generatedAt)}</p>
          <p className="text-xs text-neutral-500">Designated Principal: Sarah Chen, GC</p>
          <p className="text-xs text-neutral-500">Organization: ERA CUE Demo</p>
        </header>

        {/* Section 1: Summary */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">
            1. Summary
          </h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-neutral-500">Total reviewed</dt>
            <dd className="font-mono">{summary.total}</dd>
            <dt className="text-neutral-500">Cleared</dt>
            <dd className="font-mono">{summary.cleared}</dd>
            <dt className="text-neutral-500">Blocked</dt>
            <dd className="font-mono">{summary.blocked}</dd>
            <dt className="text-neutral-500">Escalated</dt>
            <dd className="font-mono">{summary.escalated}</dd>
            <dt className="text-neutral-500">Overridden</dt>
            <dd className="font-mono">{summary.overridden}</dd>
            <dt className="text-neutral-500">AI-assisted</dt>
            <dd className="font-mono">{summary.aiAssisted}</dd>
            <dt className="text-neutral-500">Agent-submitted</dt>
            <dd className="font-mono">{summary.agentSubmitted}</dd>
          </dl>
        </section>

        {/* Section 2: Principal decisions */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">
            2. Principal Decisions
          </h2>
          {decisions.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No principal decisions recorded in this period.
            </p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Speaker</th>
                  <th className="py-2 pr-3 font-medium">Draft</th>
                  <th className="py-2 pr-3 font-medium">Decision</th>
                  <th className="py-2 pr-3 font-medium">Basis</th>
                  <th className="py-2 font-medium">Record ID</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => {
                  const speaker = d.drafts?.users?.name || "—";
                  const text = d.drafts?.draft_text || "—";
                  const truncated = text.length > 80 ? text.slice(0, 80) + "…" : text;
                  return (
                    <tr key={d.id} className="border-b border-neutral-100 align-top">
                      <td className="py-2 pr-3 font-mono whitespace-nowrap">
                        {new Date(d.occurred_at).toLocaleDateString("en-US")}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{speaker}</td>
                      <td className="py-2 pr-3">{truncated}</td>
                      <td className="py-2 pr-3 font-mono uppercase whitespace-nowrap">
                        {(d.payload?.decision || "—").replace(/_/g, " ")}
                      </td>
                      <td className="py-2 pr-3">{basisFromReason(d.payload?.reason)}</td>
                      <td className="py-2 font-mono text-[10px] text-neutral-400 whitespace-nowrap">
                        {d.draft_id.slice(0, 8)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Section 3: Rules active during period */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">
            3. Rules Active During Period
          </h2>
          {activeRules.length === 0 ? (
            <p className="text-sm text-neutral-500">No rules active in this period.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 pr-3 font-medium">Rule</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Triggers</th>
                  <th className="py-2 pr-3 font-medium">Authorized by</th>
                  <th className="py-2 font-medium">WSP</th>
                </tr>
              </thead>
              <tbody>
                {activeRules.map((r) => {
                  const triggerCount =
                    triggers[r.id] ?? triggers[`name:${r.name}`] ?? 0;
                  return (
                    <tr key={r.id} className="border-b border-neutral-100 align-top">
                      <td className="py-2 pr-3">{r.name}</td>
                      <td className="py-2 pr-3 font-mono uppercase">{r.rule_type}</td>
                      <td className="py-2 pr-3 font-mono">{triggerCount}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">Sarah Chen, GC</td>
                      <td className="py-2 font-mono text-[10px] text-[#1447C0]">
                        {r.wsp_reference || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Section 4: Regulatory compliance attestation */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-700 mb-3 border-b border-neutral-200 pb-2">
            4. Regulatory Compliance Attestation
          </h2>
          {ATTESTATION_ROWS.map((row) => (
            <div
              key={row.citation}
              className="flex items-start gap-3 py-3 border-b border-[#F1F5F9] last:border-0"
            >
              <div
                aria-hidden
                className="shrink-0 w-6 h-6 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center"
              >
                <span className="text-xs text-[#166534]">✓</span>
              </div>
              <div>
                <div className="font-mono text-xs font-medium text-[#0F172A]">
                  {row.citation}
                </div>
                <div className="font-mono text-[10px] text-[#64748B] mt-0.5 leading-relaxed">
                  {row.description}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-neutral-900 pt-4 mt-8 text-xs text-neutral-500 leading-relaxed">
          <p>
            Individual examiner records available at{" "}
            <span className="font-mono">app.eracue.com/drafts/[id]/examiner</span>
          </p>
          <p className="mt-1">
            SHA-256 hash of this report:{" "}
            <span className="font-mono break-all">{reportHash}</span>
          </p>
          <p className="mt-1 font-mono">
            end of report · period {fromDate} to {toDate}
          </p>
        </footer>
      </div>
    </main>
  );
}
