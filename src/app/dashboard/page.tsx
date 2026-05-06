import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";
import { ClearedDraftsBanner } from "./cleared-drafts-banner";
import {
  ExaminerRecordsSection,
  type ExaminerRecord,
} from "./examiner-records-section";
import { SupervisionExport } from "./supervision-export";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Types ---------------------------------------------------------

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

type SpeakerStat = {
  id: string;
  name: string;
  title: string;
  totalDrafts: number;
  blocked: number;
  escalated: number;
  // "Corpus" = approved + overridden — the speaker's published-on-record
  // statements. Drives the consistency-check footprint on the card.
  corpusCount: number;
};

type SpeakerJoinRow = {
  status: string;
  users: { id: string; name: string; title: string | null } | null;
};

type QueueDraft = {
  id: string;
  draft_text: string;
  channel: string;
  status: string;
  submitted_at: string;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type QueueDraftDeduped = QueueDraft & { duplicate_count: number };

type QueueGroup = {
  name: string;
  title: string;
  drafts: QueueDraftDeduped[];
};

// ---------- Data fetch ----------------------------------------------------

async function getDashboardData() {
  const sb = getSupabaseAdmin();

  const [draftsRes, rulesRes, verdictsRes, reviewerActionsRes, speakerStatsRes, queueRes] = await Promise.all([
    sb.from("drafts").select("id, status, source_origin").eq("org_id", DEMO_ORG_ID),
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
      // Strict filter: only real form-driven decisions. Seed.ts also wrote
      // reviewer_decided rows where payload.decision mirrors draft status —
      // those are status mirrors, not decisions, and must not appear.
      .in("payload->>decision", ["override", "confirm_block", "approve", "reject"])
      .order("occurred_at", { ascending: false })
      .limit(10),
    sb.from("drafts").select("status, users:speaker_id(id, name, title)").eq("org_id", DEMO_ORG_ID),
    // Action queue — drafts blocked or escalated, awaiting principal decision.
    sb
      .from("drafts")
      .select("id, draft_text, channel, status, submitted_at, users(name, title), campaigns(name)")
      .eq("org_id", DEMO_ORG_ID)
      .in("status", ["blocked", "escalated"])
      .order("submitted_at", { ascending: false }),
  ]);

  if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);
  if (rulesRes.error) throw new Error("rules: " + rulesRes.error.message);
  if (verdictsRes.error) throw new Error("verdicts: " + verdictsRes.error.message);
  if (reviewerActionsRes.error) throw new Error("reviewer actions: " + reviewerActionsRes.error.message);
  if (speakerStatsRes.error) throw new Error("speaker stats: " + speakerStatsRes.error.message);
  if (queueRes.error) throw new Error("queue: " + queueRes.error.message);

  const drafts = (draftsRes.data || []) as DraftLite[];
  const rules = (rulesRes.data || []) as RuleRow[];
  const verdicts = (verdictsRes.data || []) as VerdictAction[];
  const reviewerActions = (reviewerActionsRes.data || []) as unknown as ReviewerAction[];

  // Governance health
  const draftsReviewed = drafts.length;
  const blocked = drafts.filter((d) => d.status === "blocked").length;
  const blockRatePct = draftsReviewed === 0 ? 0 : Math.round((blocked / draftsReviewed) * 100);
  const overrideDecisions = reviewerActions.filter(
    (a) => (a.payload?.decision as string | undefined) === "override"
  ).length;
  // Override rate denominator: drafts that were ever blocked (currently blocked
  // OR overridden — both groups were blocked at some point).
  const everBlocked = drafts.filter(
    (d) => d.status === "blocked" || d.status === "overridden"
  ).length;
  const overrideRatePct =
    everBlocked === 0 ? 0 : Math.round((overrideDecisions / everBlocked) * 100);
  // Gap exposure: schema has no off-channel ingestion column yet — always 0.
  const gapExposure = drafts.filter(
    (d) => (d.source_origin as string) === "direct_post"
  ).length;

  // Rules performance
  const now = Date.now();

  // Dedupe rules by name. The `rules` table has carried duplicate rows for
  // the same conceptual rule across re-seed cycles (same name, different id),
  // which then duplicates each row in this section. Keep one row per name,
  // preferring the entry with the latest `effective_from` so the kept row is
  // the most recently authored. Trigger counts stay accurate because the
  // matches filter below also falls back to `pm.rule_name`, which catches
  // verdicts whose primary_match.rule_id pointed at the dropped duplicate.
  const dedupedRulesByName = new Map<string, RuleRow>();
  for (const r of rules) {
    const prev = dedupedRulesByName.get(r.name);
    if (!prev) {
      dedupedRulesByName.set(r.name, r);
      continue;
    }
    const prevTs = new Date(prev.effective_from).getTime();
    const curTs = new Date(r.effective_from).getTime();
    if (curTs > prevTs) dedupedRulesByName.set(r.name, r);
  }
  const dedupedRules = Array.from(dedupedRulesByName.values());

  const rulesPerf: RulePerf[] = dedupedRules
    .map((rule) => {
      // Match by rule_id if present; fall back to rule_name for legacy seed rows.
      const matches = verdicts.filter((v) => {
        const pm = v.payload?.primary_match;
        if (!pm) return false;
        if (pm.rule_id && pm.rule_id === rule.id) return true;
        return pm.rule_name === rule.name;
      });
      const lastTriggered = matches.length === 0
        ? null
        : matches.reduce(
            (max, m) => (m.occurred_at > max ? m.occurred_at : max),
            matches[0].occurred_at
          );
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
    })
    .sort((a, b) => b.timesTriggered - a.timesTriggered);

  // Speaker exposure — group drafts by speaker name. blocked count includes
  // overridden drafts (they were blocked first); escalated stands alone.
  const speakerMap = new Map<string, SpeakerStat>();
  for (const row of (speakerStatsRes.data || []) as unknown as SpeakerJoinRow[]) {
    const u = row.users;
    if (!u) continue;
    if (!speakerMap.has(u.name)) {
      speakerMap.set(u.name, {
        id: u.id,
        name: u.name,
        title: u.title || "",
        totalDrafts: 0,
        blocked: 0,
        escalated: 0,
        corpusCount: 0,
      });
    }
    const s = speakerMap.get(u.name)!;
    s.totalDrafts++;
    if (row.status === "blocked" || row.status === "overridden") s.blocked++;
    else if (row.status === "escalated") s.escalated++;
    if (row.status === "approved" || row.status === "overridden") s.corpusCount++;
  }
  const speakerStats = Array.from(speakerMap.values()).sort(
    (a, b) => b.blocked - a.blocked
  );

  // Action queue — deduplicate identical (speaker × draft text) submissions,
  // keep the most recent, attach a duplicate_count so the row can show "×N"
  // instead of repeating the same draft three times.
  const queueDrafts = (queueRes.data || []) as unknown as QueueDraft[];
  const dedupKey = (d: QueueDraft) =>
    `${d.users?.name ?? "Unknown"}::${d.draft_text.trim()}`;
  const dedupMap = new Map<string, QueueDraftDeduped>();
  for (const d of queueDrafts) {
    const key = dedupKey(d);
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, { ...d, duplicate_count: 1 });
    } else if (d.submitted_at > existing.submitted_at) {
      // Newer record wins the row; the running count is preserved.
      dedupMap.set(key, { ...d, duplicate_count: existing.duplicate_count + 1 });
    } else {
      existing.duplicate_count++;
    }
  }
  const dedupedQueueDrafts = Array.from(dedupMap.values());

  const queueMap = new Map<string, QueueGroup>();
  for (const d of dedupedQueueDrafts) {
    const name = d.users?.name || "Unknown";
    if (!queueMap.has(name)) {
      queueMap.set(name, { name, title: d.users?.title || "", drafts: [] });
    }
    queueMap.get(name)!.drafts.push(d);
  }
  const queueGroups = Array.from(queueMap.values()).sort(
    (a, b) => b.drafts.length - a.drafts.length
  );
  // Real count for the stat tile and section heading. Counts each submission
  // (including duplicates) so the number reflects what's in the database,
  // not just the visible row count.
  const pendingReview = queueDrafts.length;

  // Examiner-records list — flatten reviewer-decided actions into a
  // serializable shape the client component can filter by speaker.
  const examinerRecords: ExaminerRecord[] = reviewerActions.map((a) => ({
    id: a.id,
    draftId: a.draft_id,
    speakerName: a.drafts?.users?.name || "—",
    draftSnippet: a.drafts?.draft_text || "—",
    decision: a.payload?.decision,
    occurredAt: a.occurred_at,
  }));

  // Demo flavour: every approved draft counts as "not yet formally signed off"
  // because the `principal_approved` action type isn't in the schema yet.
  // Once that action is wired up, this filter should narrow accordingly.
  const clearedWithoutSignoff = drafts.filter((d) => d.status === "approved").length;

  return {
    health: { draftsReviewed, blockRatePct, overrideRatePct, gapExposure, pendingReview },
    rulesPerf,
    reviewerFeed: reviewerActions,
    speakerStats,
    queueGroups,
    examinerRecords,
    clearedWithoutSignoff,
  };
}

// ---------- Helpers -------------------------------------------------------

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return minutes <= 0 ? "just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(iso: string): string {
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

function verdictDot(t: string): string {
  if (t === "block") return "bg-[#B91C1C]";
  if (t === "escalate") return "bg-[#C2410C]";
  if (t === "review") return "bg-[#1D4ED8]";
  return "bg-[#6D28D9]";
}

// Token-coloured pill for a rule_type (block / escalate / review / guide).
// Used in the Rules Performance row.
function ruleTypeBadgeCls(t: string): string {
  if (t === "block")    return "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]";
  if (t === "escalate") return "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]";
  if (t === "review")   return "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]";
  return "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]"; // guide
}

// Channel raw value → display label. Falls back to the raw value for unknown
// channels so the UI never shows a blank.
function formatChannel(ch: string): string {
  const map: Record<string, string> = {
    linkedin:      "LinkedIn",
    twitter:       "X / Twitter",
    press_release: "Press Release",
    blog:          "Blog",
    email:         "Email",
    interview:     "Interview",
    other:         "Other",
  };
  return map[ch] ?? ch;
}

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

// ---------- Page ----------------------------------------------------------

export default async function DashboardPage() {
  const {
    health,
    rulesPerf,
    reviewerFeed,
    speakerStats,
    queueGroups,
    examinerRecords,
    clearedWithoutSignoff,
  } = await getDashboardData();
  const top = speakerStats[0]?.blocked > 0 ? speakerStats[0].name : null;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6">
          {/* HEADER */}
          <div className="pt-10 pb-8 border-b border-[#E2E8F0]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                  REVIEW · SARAH CHEN, GC
                </div>
                <h1
                  style={{ fontFamily: "var(--font-newsreader)" }}
                  className="font-light text-3xl text-[#0F172A] mt-2"
                >
                  The complete governance record.
                </h1>
                <p className="text-sm text-[#64748B] mt-1 max-w-xl">
                  Blocked drafts, governance decisions, and the complete supervision record.
                </p>
              </div>
            </div>
          </div>

          {/* CLEARED DRAFTS BANNER — directly below header, above stat cards.
              Banner self-hides when count is zero; banner already carries its
              own mb-6 so the stat cards stay flush either way. */}
          <div className="pt-8">
            <ClearedDraftsBanner count={clearedWithoutSignoff} />
          </div>

          {/* SECTION 1 — Governance health */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                DRAFTS REVIEWED
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#0F172A]">
                {health.draftsReviewed}
              </div>
              <div className="text-sm text-[#374151] mt-1">Across all speakers</div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#B91C1C] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                BLOCK RATE
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#B91C1C]">
                {health.blockRatePct}%
              </div>
              <div className="text-sm text-[#374151] mt-1">Drafts halted by hard rules</div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#C2410C] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                OVERRIDE RATE
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#C2410C]">
                {health.overrideRatePct}%
              </div>
              <div className="text-sm text-[#374151] mt-1">Of blocked drafts overridden</div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#1A56DB] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                PENDING REVIEW
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#1A56DB]">
                {health.pendingReview}
              </div>
              <div className="text-sm text-[#374151] mt-1">Awaiting principal decision</div>
            </div>
          </section>

          {/* SECTION 2 — Action required (queue grouped by speaker) */}
          <section className="mt-10">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                  ACTION REQUIRED
                </div>
                <div className="text-xl font-semibold text-[#0F172A] mt-1">
                  {queueGroups.reduce((n, g) => n + g.drafts.length, 0)} draft
                  {queueGroups.reduce((n, g) => n + g.drafts.length, 0) === 1 ? "" : "s"} need your decision
                </div>
              </div>
              {queueGroups.length > 0 && (
                <span className="font-mono text-xs text-[#64748B]">Grouped by speaker</span>
              )}
            </div>

            {queueGroups.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center mt-4 text-sm text-[#64748B]">
                No drafts awaiting review. ERA CUE is governing your team&apos;s communications.
              </div>
            ) : (
              // `space-y-6` introduces an explicit gap between speaker groups
              // — without it the group headers butted directly against the
              // bottom of the previous group's last draft row.
              <div className="mt-4 space-y-6">
                {queueGroups.map((group) => (
                  <div key={group.name}>
                    {/* Group header */}
                    <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-t-sm px-5 py-3 mt-3 flex justify-between items-center">
                      <div className="flex items-baseline">
                        <span className="text-base font-semibold text-[#0F172A]">{group.name}</span>
                        {group.title && (
                          <span className="text-sm text-[#374151] ml-3">{group.title}</span>
                        )}
                      </div>
                      <span className="bg-white border border-[#E2E8F0] rounded-sm font-mono text-xs text-[#64748B] px-2 py-0.5">
                        {group.drafts.length} draft{group.drafts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {/* Draft rows — draft text takes its own line so the
                        chips + status + Review link can wrap underneath
                        on narrow viewports without crushing the title. */}
                    {group.drafts.map((d, idx) => {
                      const isLast = idx === group.drafts.length - 1;
                      const statusCls =
                        d.status === "blocked"
                          ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                          : "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]";
                      return (
                        <div
                          key={d.id}
                          className={`bg-white border-x border-b border-[#E2E8F0] px-5 py-4 hover:bg-[#F8F9FB] transition-colors ${
                            isLast ? "rounded-b-sm" : ""
                          }`}
                        >
                          {/* Draft text — full width, two-line clamp */}
                          <div className="flex items-start gap-2 mb-2">
                            <p className="text-sm font-medium text-[#0F172A] line-clamp-2 min-w-0 flex-1">
                              {d.draft_text}
                            </p>
                            {d.duplicate_count > 1 && (
                              <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-sm border border-[#E2E8F0] shrink-0">
                                ×{d.duplicate_count}
                              </span>
                            )}
                          </div>
                          {/* Chips + status + Review link — wraps on narrow */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                                {formatChannel(d.channel)}
                              </span>
                              {d.campaigns?.name && (
                                <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                                  {d.campaigns.name}
                                </span>
                              )}
                              <span
                                className={`inline-flex font-mono text-xs font-medium uppercase px-2 py-0.5 rounded-sm border ${statusCls}`}
                              >
                                {d.status.toUpperCase()}
                              </span>
                            </div>
                            <Link
                              href={`/reviewer/${d.id}`}
                              className="font-mono text-sm font-medium text-[#1A56DB] hover:text-[#1447C0] transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap"
                            >
                              Review →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* EXAMINER RECORDS — direct links to per-draft audit records. */}
          <ExaminerRecordsSection records={examinerRecords} />

          {/* SUPERVISION PERIOD EXPORT — date-range printable report. */}
          <SupervisionExport />

          {/* SECTION 2 — Speaker exposure */}
          <section className="mt-10">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SPEAKER EXPOSURE
            </div>
            <p className="text-sm text-[#64748B] mt-1 mb-4">
              Governance activity by speaker this period.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {speakerStats.slice(0, 4).map((s) => {
                const isTop = top !== null && s.name === top;
                return (
                  <div
                    key={s.name}
                    className={`bg-white border border-[#E2E8F0] rounded-sm p-5 ${
                      isTop ? "border-t-2 border-t-[#B91C1C]" : ""
                    }`}
                  >
                    <Link
                      href={`/speakers/${s.id}`}
                      className="text-base font-medium text-[#0F172A] hover:underline"
                    >
                      {s.name}
                    </Link>
                    <div className="text-sm text-[#374151] mt-0.5">{s.title}</div>
                    <div className="flex gap-6 mt-4 flex-wrap">
                      <div>
                        <div className="font-mono text-3xl font-light text-[#0F172A]">{s.totalDrafts}</div>
                        <div className="font-mono text-xs uppercase text-[#64748B] mt-1">total</div>
                      </div>
                      <div>
                        <div className="font-mono text-3xl font-light text-[#0F172A]">{s.blocked}</div>
                        <div className="font-mono text-xs uppercase text-[#64748B] mt-1">blocked</div>
                      </div>
                      <div>
                        <div className="font-mono text-3xl font-light text-[#0F172A]">{s.escalated}</div>
                        <div className="font-mono text-xs uppercase text-[#64748B] mt-1">escalated</div>
                      </div>
                    </div>
                    {/* Corpus footer — the speaker's approved-statement record.
                        Drives the Consistency Check; surfaced here so the
                        dashboard reads as "what we know about this speaker"
                        rather than just "what we blocked." */}
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-widest">
                        Corpus
                      </span>
                      <span className="font-mono text-xs text-[#374151]">
                        {s.corpusCount} approved statements
                      </span>
                    </div>
                    <Link
                      href={`/speakers/${s.id}`}
                      className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors mt-1 block"
                    >
                      View communication record →
                    </Link>
                    {isTop && (
                      <div className="font-mono text-[10px] text-[#B91C1C] uppercase tracking-wide mt-3 text-right">
                        Highest exposure
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 3 — Rules performance (rows, not a table) */}
          <section className="mt-10">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              RULES PERFORMANCE
            </div>
            <p className="text-sm text-[#64748B] mt-1 mb-4">
              Active governance policies and trigger counts.
            </p>
            <div>
              {rulesPerf.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center text-sm text-[#64748B]">
                  No rules configured.
                </div>
              ) : (
                rulesPerf.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${verdictDot(r.rule_type)}`} aria-hidden />
                      <span className="text-base font-medium text-[#0F172A] truncate">{r.name}</span>
                      <span
                        className={`font-mono text-xs font-medium uppercase px-2 py-0.5 rounded-sm border shrink-0 inline-flex ${ruleTypeBadgeCls(r.rule_type)}`}
                      >
                        {r.rule_type.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-8 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-xl font-light text-[#0F172A]">{r.timesTriggered}</div>
                        <div className="font-mono text-xs text-[#64748B]">triggers</div>
                      </div>
                      <div className="font-mono text-xs text-[#94A3B8] w-20 text-right">
                        {fmtRelative(r.lastTriggered)}
                      </div>
                      <span
                        className={
                          r.isActive
                            ? "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] font-mono text-xs px-2 py-0.5 rounded-sm border uppercase"
                            : "bg-[#F8F9FB] text-[#64748B] border-[#E2E8F0] font-mono text-xs px-2 py-0.5 rounded-sm border uppercase"
                        }
                      >
                        {r.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/rules"
              className="block font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-3"
            >
              Manage rules →
            </Link>
          </section>

          {/* SECTION 5 — Recent decisions */}
          <section className="mt-10 pb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              RECENT DECISIONS
            </div>
            <p className="text-sm text-[#64748B] mt-1 mb-4">
              Principal decisions on blocked and escalated drafts.
            </p>
            {reviewerFeed.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center text-sm text-[#64748B]">
                No reviewer decisions yet. Decisions appear here after a principal reviews a blocked or escalated draft.
              </div>
            ) : (
              reviewerFeed.map((a) => {
                const speakerName = a.drafts?.users?.name || "—";
                const speakerTitle = a.drafts?.users?.title || "";
                const decision = a.payload?.decision;
                const badge = decisionBadge(decision);
                const basis = basisFromReason(a.payload?.reason);
                return (
                  <div
                    key={a.id}
                    className="bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-xs font-medium uppercase ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <div className="text-sm text-[#374151] mt-2">
                        Sarah Chen decided on{" "}
                        <span className="font-medium text-[#0F172A]">{speakerName}</span>
                        {speakerTitle && <span className="text-[#64748B]"> ({speakerTitle})</span>}
                        &apos;s draft
                      </div>
                      {basis && (
                        <div className="text-xs text-[#374151] mt-1">Basis: {basis}</div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="font-mono text-xs text-[#94A3B8]">{fmtDateTime(a.occurred_at)}</span>
                      {a.draft_id && (
                        <div className="flex gap-3 items-center">
                          <Link
                            href={`/drafts/${a.draft_id}`}
                            className="font-mono text-sm text-[#64748B] hover:text-[#0F172A] transition-colors min-h-[44px] inline-flex items-center"
                          >
                            View draft →
                          </Link>
                          <Link
                            href={`/drafts/${a.draft_id}/examiner?view=full`}
                            className="font-mono text-sm text-[#1A56DB] hover:text-[#0F172A] font-medium transition-colors min-h-[44px] inline-flex items-center"
                          >
                            Communication record →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>
    </>
  );
}
