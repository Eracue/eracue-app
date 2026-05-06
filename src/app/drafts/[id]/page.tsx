import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  status: string;
  submitted_at: string;
  speaker_id: string;
  campaign_id: string | null;
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

async function getDraftWithActions(id: string) {
  const sb = getSupabaseAdmin();

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, speaker_id, campaign_id, users(name, title), campaigns(name)")
    .eq("id", id)
    .eq("org_id", DEMO_ORG_ID)
    .single();

  if (dErr || !draft) return null;

  const { data: actions, error: aErr } = await sb
    .from("actions")
    .select("id, action_type, payload, occurred_at, actor_kind")
    .eq("draft_id", id)
    .order("occurred_at", { ascending: true });

  if (aErr) throw new Error(aErr.message);

  return {
    draft: draft as unknown as DraftRow,
    actions: (actions || []) as ActionRow[],
  };
}

const CHECK_DEFINITIONS = [
  {
    id: "rule_check",
    displayName: "Keyword Check",
    description: "Matches draft text against keywords from active rules",
    engineType: "deterministic" as const,
    status: "active" as const,
  },
  {
    id: "timing_check",
    displayName: "Timing Check",
    description: "Verifies rule is effective at submission time",
    engineType: "deterministic" as const,
    status: "active" as const,
  },
  {
    id: "consistency_check",
    displayName: "Consistency Check",
    description: "Compares draft against prior statements (requires corpus)",
    engineType: "ai" as const,
    status: "available" as const,
  },
  {
    id: "audience_check",
    displayName: "Audience Check",
    description: "Validates tone fits channel and audience",
    engineType: "ai" as const,
    status: "available" as const,
  },
  {
    id: "alignment_check",
    displayName: "Alignment Check",
    description: "Aligns with organization's narrative profile",
    engineType: "ai" as const,
    status: "available" as const,
  },
];

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { bg: string; text: string; label: string; border: string }> = {
    block: { bg: "bg-red-50", text: "text-red-900", border: "border-red-300", label: "BLOCK" },
    escalate: { bg: "bg-amber-50", text: "text-amber-900", border: "border-amber-300", label: "ESCALATE" },
    review: { bg: "bg-blue-50", text: "text-blue-900", border: "border-blue-300", label: "REVIEW" },
    guide: { bg: "bg-purple-50", text: "text-purple-900", border: "border-purple-300", label: "GUIDE" },
    clear: { bg: "bg-green-50", text: "text-green-900", border: "border-green-300", label: "CLEAR" },
  };
  const s = styles[verdict] || styles.clear;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-wide ${s.bg} ${s.text} border ${s.border}`}>
      {s.label}
    </span>
  );
}

function ChecksPerformedPanel({ actions }: { actions: ActionRow[] }) {
  // Find which checks ran (by check name in payload)
  const checkRanActions = actions.filter((a) => a.action_type === "check_ran");
  const checksRanMap = new Map<string, ActionRow>();
  for (const a of checkRanActions) {
    const checkName = (a.payload as { check?: string })?.check;
    if (checkName) checksRanMap.set(checkName, a);
  }
  const activeCount = CHECK_DEFINITIONS.filter((c) => c.status === "active" && checksRanMap.has(c.id)).length;
  const totalCount = CHECK_DEFINITIONS.length;

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-neutral-500 uppercase tracking-wide">Checks performed</div>
        <div className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-900">{activeCount} of {totalCount}</span> active
        </div>
      </div>
      <ul className="space-y-3">
        {CHECK_DEFINITIONS.map((check) => {
          const ran = checksRanMap.get(check.id);
          const isActive = check.status === "active" && ran;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload = ran ? (ran.payload as any) : null;
          let resultLine = "";
          if (isActive && check.id === "rule_check" && payload) {
            const matchCount = payload.match_count || 0;
            if (matchCount === 0) {
              resultLine = "No rules matched";
            } else {
              const firstMatch = payload.matches?.[0];
              resultLine = `${matchCount} rule${matchCount === 1 ? "" : "s"} matched${firstMatch ? `: ${firstMatch.rule_name}` : ""}`;
            }
          } else if (isActive && check.id === "timing_check" && payload) {
            const activeRules = payload.rules_active_count || 0;
            resultLine = `${activeRules} rule${activeRules === 1 ? "" : "s"} active at submission`;
          } else if (!isActive) {
            resultLine = check.description;
          }

          return (
            <li key={check.id} className="flex items-start gap-3">
              <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-neutral-100 text-neutral-400 border border-neutral-200"
              }`}>
                {isActive ? "✓" : "○"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-medium text-neutral-900">{check.displayName}</div>
                  <div className="text-xs text-neutral-400">
                    {check.engineType === "deterministic" ? "deterministic" : "AI"}
                    {!isActive && " · available"}
                  </div>
                </div>
                <div className="text-xs text-neutral-600 mt-0.5">{resultLine}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
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
      <mark className="bg-yellow-200 px-0.5 rounded">{match}</mark>
      {after}
    </>
  );
}

export default async function DraftDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getDraftWithActions(id);
  if (!result) notFound();
  const { draft, actions } = result;

  // Find the verdict_issued action
  const verdictAction = actions.find((a) => a.action_type === "verdict_issued");
  const verdict = (verdictAction?.payload?.verdict as string) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryMatch = (verdictAction?.payload?.primary_match as any) || null;
  const matchedKeyword = primaryMatch?.matched_keyword as string | undefined;

  // Find rule_check action for the match list
  const ruleCheck = actions.find((a) => a.action_type === "check_ran" && (a.payload as { check?: string })?.check === "rule_check");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allMatches = (ruleCheck?.payload?.matches as any[]) || [];

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/drafts" className="text-sm text-neutral-500 hover:text-neutral-900">← All drafts</Link>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 mt-2">Draft</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Submitted by {draft.users?.name || "—"}{draft.users?.title ? ` (${draft.users.title})` : ""}
            {draft.campaigns?.name ? ` · Campaign: ${draft.campaigns.name}` : ""}
          </p>
          <div className="flex gap-2 mt-4">
            <Link
              href={`/drafts/${draft.id}/examiner`}
              className="px-4 py-2 bg-white border border-neutral-300 text-neutral-900 text-sm font-medium rounded-md hover:bg-neutral-50 transition"
            >
              Export examiner record →
            </Link>
          </div>
        </div>

        {/* Verdict Card */}
        {verdict && (
          <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Verdict</div>
                <VerdictBadge verdict={verdict} />
              </div>
              <div className="text-right text-xs text-neutral-500">
                {actions.filter((a) => a.action_type === "check_ran").length} checks run
              </div>
            </div>
            {primaryMatch && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="text-sm font-medium text-neutral-900">{primaryMatch.rule_name}</div>
                <div className="text-sm text-neutral-600 mt-1">{primaryMatch.rule_description}</div>
                <div className="text-xs text-neutral-500 mt-2">
                  Matched keyword: <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{matchedKeyword}</span>
                </div>
              </div>
            )}
            {!primaryMatch && verdict === "clear" && (
              <p className="text-sm text-neutral-600 mt-2">No active rules matched this draft.</p>
            )}
          </div>
        )}

        {/* Send to reviewer prompt */}
        {(draft.status === "blocked" || draft.status === "escalated") && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
            <div className="text-sm text-neutral-700">
              This draft needs reviewer attention.
            </div>
            <Link
              href={`/reviewer/${draft.id}`}
              className="shrink-0 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition"
            >
              Open in reviewer →
            </Link>
          </div>
        )}

        {/* Checks Performed */}
        <ChecksPerformedPanel actions={actions} />

        {/* Draft Text */}
        <div className="bg-white border border-neutral-200 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-2 mb-4 text-xs text-neutral-500 uppercase tracking-wide">
            <span>{draft.channel}</span>
            <span>·</span>
            <span>{draft.source_origin.replace("_", " ")}</span>
            <span>·</span>
            <span>Status: {draft.status}</span>
          </div>
          <p className="text-neutral-900 whitespace-pre-wrap leading-relaxed">
            {highlightMatch(draft.draft_text, matchedKeyword)}
          </p>
        </div>

        {/* Other matches if more than one */}
        {allMatches.length > 1 && (
          <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
            <div className="text-xs text-neutral-500 uppercase tracking-wide mb-3">All rule matches ({allMatches.length})</div>
            <ul className="space-y-2 text-sm">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {allMatches.map((m: any, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <VerdictBadge verdict={m.rule_type} />
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">{m.rule_name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      Keyword: <span className="font-mono">{m.matched_keyword}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action timeline */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-3">Audit timeline</div>
          <ul className="space-y-2 text-sm">
            {actions.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3">
                <span className="text-xs text-neutral-400 font-mono w-20 shrink-0">{new Date(a.occurred_at).toLocaleTimeString()}</span>
                <span className="text-neutral-700">{a.action_type.replace("_", " ")}</span>
                <span className="text-xs text-neutral-500">({a.actor_kind})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
