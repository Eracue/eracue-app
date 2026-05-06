import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DraftLite = {
  id: string;
  status: string;
  source_origin: string;
};

type RuleRow = {
  id: string;
  name: string;
  rule_type: "block" | "escalate" | "review" | "guide";
  description: string;
  effective_from: string;
  effective_to: string | null;
};

type VerdictAction = {
  id: string;
  occurred_at: string;
  payload: {
    verdict?: string;
    primary_match?: { rule_id?: string; rule_name?: string } | null;
  };
};

type ReviewerAction = {
  id: string;
  occurred_at: string;
  draft_id: string;
  payload: {
    decision?: string;
    reason?: unknown;
    new_status?: string;
  };
  drafts: {
    id: string;
    draft_text: string;
    users: { name: string; title: string | null } | null;
  } | null;
};

type RulePerf = {
  id: string;
  name: string;
  rule_type: RuleRow["rule_type"];
  timesTriggered: number;
  lastTriggered: string | null;
  isActive: boolean;
};

async function getDashboardData() {
  const sb = getSupabaseAdmin();

  const [draftsRes, rulesRes, verdictsRes, reviewerActionsRes] = await Promise.all([
    sb
      .from("drafts")
      .select("id, status, source_origin")
      .eq("org_id", DEMO_ORG_ID),
    sb
      .from("rules")
      .select("id, name, rule_type, description, effective_from, effective_to")
      .eq("org_id", DEMO_ORG_ID)
      .order("rule_type"),
    sb
      .from("actions")
      .select("id, occurred_at, payload")
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "verdict_issued"),
    sb
      .from("actions")
      .select("id, occurred_at, draft_id, payload, drafts(id, draft_text, users:speaker_id(name, title))")
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "reviewer_decided")
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);

  if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);
  if (rulesRes.error) throw new Error("rules: " + rulesRes.error.message);
  if (verdictsRes.error) throw new Error("verdicts: " + verdictsRes.error.message);
  if (reviewerActionsRes.error) throw new Error("reviewer actions: " + reviewerActionsRes.error.message);

  const drafts = (draftsRes.data || []) as DraftLite[];
  const rules = (rulesRes.data || []) as RuleRow[];
  const verdicts = (verdictsRes.data || []) as VerdictAction[];
  const reviewerActions = (reviewerActionsRes.data || []) as unknown as ReviewerAction[];

  // Section 1 — governance health
  const draftsReviewed = drafts.length; // every draft in this app went through the verdict engine
  const blocked = drafts.filter((d) => d.status === "blocked").length;
  const blockRatePct = draftsReviewed === 0 ? 0 : Math.round((blocked / draftsReviewed) * 100);
  // Override rate: of decisions made on drafts that were ever blocked, how many were overrides?
  const overrideDecisions = reviewerActions.filter(
    (a) => (a.payload?.decision as string | undefined) === "override"
  ).length;
  const blockedDecisions = reviewerActions.filter((a) => {
    const d = a.payload?.decision as string | undefined;
    return d === "override" || d === "confirm_block";
  }).length;
  const overrideRatePct =
    blockedDecisions === 0 ? 0 : Math.round((overrideDecisions / blockedDecisions) * 100);
  // Gap exposure: schema doesn't model unreviewed posts — always 0 until ingestion is built.
  const gapExposure = drafts.filter(
    (d) =>
      // none of the current source_origin values trigger this; left here for when
      // off-channel ingestion adds a new value
      (d.source_origin as string) === "direct_post"
  ).length;

  // Section 2 — rules performance
  const now = Date.now();
  const rulesPerf: RulePerf[] = rules.map((rule) => {
    const matches = verdicts.filter((v) => v.payload?.primary_match?.rule_id === rule.id);
    const lastTriggered = matches.length === 0
      ? null
      : matches.reduce((max, m) => (m.occurred_at > max ? m.occurred_at : max), matches[0].occurred_at);
    const fromTime = new Date(rule.effective_from).getTime();
    const toTime = rule.effective_to ? new Date(rule.effective_to).getTime() : null;
    const isActive = now >= fromTime && (toTime === null || now <= toTime);
    return {
      id: rule.id,
      name: rule.name,
      rule_type: rule.rule_type,
      timesTriggered: matches.length,
      lastTriggered,
      isActive,
    };
  }).sort((a, b) => b.timesTriggered - a.timesTriggered);

  // Section 4 — compact active rules list
  const activeRules = rules.filter((r) => {
    const fromTime = new Date(r.effective_from).getTime();
    if (now < fromTime) return false;
    if (r.effective_to && now > new Date(r.effective_to).getTime()) return false;
    return true;
  });

  return {
    health: { draftsReviewed, blockRatePct, overrideRatePct, gapExposure },
    rulesPerf,
    reviewerFeed: reviewerActions,
    activeRules,
  };
}

function ruleTypeColor(t: string): string {
  if (t === "block") return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
  if (t === "escalate") return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
  if (t === "review") return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900";
  return "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900";
}

function decisionColor(d: string | undefined): string {
  if (d === "override") return "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900";
  if (d === "approve") return "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900";
  if (d === "reject" || d === "confirm_block") return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
  return "text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800";
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function basisFromReason(reason: unknown): string | null {
  if (!reason) return null;
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null && "basis" in reason) {
    const b = (reason as { basis?: unknown }).basis;
    return typeof b === "string" ? b : null;
  }
  return null;
}

export default async function DashboardPage() {
  const { health, rulesPerf, reviewerFeed, activeRules } = await getDashboardData();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* SECTION 5 — Header (with role-disambiguating subtitle + reviewer link) */}
          <div className="mb-8">
            <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">← Home</Link>
            <div className="flex items-baseline justify-between gap-4 mt-2">
              <div>
                <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-neutral-100">
                  Principal dashboard
                </h1>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1 font-medium">
                  Governance oversight — not the reviewer queue
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Sarah Chen · General Counsel
                </p>
              </div>
              <Link
                href="/reviewer/queue"
                className="text-sm text-indigo-700 dark:text-indigo-400 hover:underline shrink-0"
              >
                Go to reviewer queue →
              </Link>
            </div>
          </div>

          {/* SECTION 1 — Governance health strip */}
          <section className="mb-10">
            <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-3">
              Governance health
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
                <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Drafts reviewed</div>
                <div className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mt-1">{health.draftsReviewed}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Across all speakers and campaigns</div>
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
                <div className="text-xs text-red-700 dark:text-red-400 uppercase tracking-wide">Block rate</div>
                <div className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mt-1">{health.blockRatePct}%</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Drafts halted by hard rules</div>
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
                <div className="text-xs text-purple-700 dark:text-purple-400 uppercase tracking-wide">Override rate</div>
                <div className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mt-1">{health.overrideRatePct}%</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Of decisions on blocked drafts</div>
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
                <div className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wide">Unreviewed posts detected</div>
                <div className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mt-1">{health.gapExposure}</div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 italic">
                  Off-channel ingestion not implemented in demo schema
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 — Rules performance table */}
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Rules performance
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{rulesPerf.length} rules</span>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Rule</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Times triggered</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Last triggered</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rulesPerf.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
                        No rules configured.
                      </td>
                    </tr>
                  ) : (
                    rulesPerf.map((r) => (
                      <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                        <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100 font-medium">{r.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${ruleTypeColor(r.rule_type)}`}>
                            {r.rule_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100 font-medium">{r.timesTriggered}</td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 text-xs font-mono">
                          {r.lastTriggered ? fmtDateTime(r.lastTriggered) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={r.isActive
                            ? "text-xs text-green-700 dark:text-green-400"
                            : "text-xs text-neutral-400 dark:text-neutral-500"}>
                            {r.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 3 — Reviewer activity feed (audit-of-the-auditors) */}
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Reviewer activity
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{reviewerFeed.length} recent decisions</span>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              {reviewerFeed.length === 0 ? (
                <div className="px-4 py-6 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                  No reviewer decisions yet.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {reviewerFeed.map((a) => {
                    const speakerName = a.drafts?.users?.name || "—";
                    const speakerTitle = a.drafts?.users?.title || "";
                    const decision = a.payload?.decision;
                    const basis = basisFromReason(a.payload?.reason);
                    return (
                      <li key={a.id} className="px-4 py-3 flex items-start gap-4">
                        <div className="shrink-0">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-wide border uppercase ${decisionColor(decision)}`}>
                            {decision || "—"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-neutral-900 dark:text-neutral-100">
                            <span className="font-medium">Sarah Chen · CCO</span>
                            <span className="text-neutral-500 dark:text-neutral-400"> decided on draft from </span>
                            <span className="font-medium">{speakerName}</span>
                            {speakerTitle && (
                              <span className="text-neutral-500 dark:text-neutral-400"> ({speakerTitle})</span>
                            )}
                          </div>
                          {basis && (
                            <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                              Basis: {basis}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {fmtDateTime(a.occurred_at)}
                          </span>
                          {a.draft_id && (
                            <Link
                              href={`/drafts/${a.draft_id}`}
                              className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline"
                            >
                              View draft →
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* SECTION 4 — Compact active rules list */}
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Active rules
              </div>
              <Link href="/rules" className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline">
                Manage rules →
              </Link>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
              {activeRules.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">No rules currently active.</p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  {activeRules.map((r) => (
                    <li key={r.id} className="flex items-baseline gap-3 text-sm">
                      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${ruleTypeColor(r.rule_type)}`}>
                        {r.rule_type}
                      </span>
                      <span className="text-neutral-900 dark:text-neutral-100 truncate">{r.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
