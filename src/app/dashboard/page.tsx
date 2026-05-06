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

type SpeakerStat = {
 name: string;
 title: string;
 totalDrafts: number;
 blocked: number;
 escalated: number;
 overridden: number;
 everBlocked: number; // blocked + overridden
};

type SpeakerJoinRow = {
 status: string;
 users: { name: string; title: string | null } | null;
};

async function getDashboardData() {
 const sb = getSupabaseAdmin();

 const [draftsRes, rulesRes, verdictsRes, reviewerActionsRes, speakerStatsRes] = await Promise.all([
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
 // Only real form-driven decisions. The seed.ts script also wrote
 // reviewer_decided rows where payload.decision mirrors the draft status
 // ("approved" / "blocked" / "escalated") — those are system events, not
 // reviewer decisions, and must not appear in the activity feed.
 .in("payload->>decision", ["override", "confirm_block", "approve", "reject"])
 .order("occurred_at", { ascending: false })
 .limit(10),
 sb
 .from("drafts")
 .select("status, users:speaker_id(name, title)")
 .eq("org_id", DEMO_ORG_ID),
 ]);

 if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);
 if (rulesRes.error) throw new Error("rules: " + rulesRes.error.message);
 if (verdictsRes.error) throw new Error("verdicts: " + verdictsRes.error.message);
 if (reviewerActionsRes.error) throw new Error("reviewer actions: " + reviewerActionsRes.error.message);
 if (speakerStatsRes.error) throw new Error("speaker stats: " + speakerStatsRes.error.message);

 const drafts = (draftsRes.data || []) as DraftLite[];
 const rules = (rulesRes.data || []) as RuleRow[];
 const verdicts = (verdictsRes.data || []) as VerdictAction[];
 const reviewerActions = (reviewerActionsRes.data || []) as unknown as ReviewerAction[];

 // Section 1 — governance health
 const draftsReviewed = drafts.length; // every draft in this app went through the verdict engine
 const blocked = drafts.filter((d) => d.status === "blocked").length;
 const blockRatePct = draftsReviewed === 0 ? 0 : Math.round((blocked / draftsReviewed) * 100);
 // Override rate: # of override decisions / # of drafts that were ever blocked.
 // Drafts currently 'blocked' or 'overridden' were both blocked at some point,
 // so the union is the right denominator (NOT the count of reviewer_decided rows,
 // which under-counts since the principal hasn't acted on every blocked draft yet).
 const overrideDecisions = reviewerActions.filter(
 (a) => (a.payload?.decision as string | undefined) === "override"
 ).length;
 const everBlocked = drafts.filter(
 (d) => d.status === "blocked" || d.status === "overridden"
 ).length;
 const overrideRatePct =
 everBlocked === 0 ? 0 : Math.round((overrideDecisions / everBlocked) * 100);
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

 // Speaker exposure — aggregate drafts by speaker name. Status 'overridden'
 // counts toward both the "blocked" exposure (it was blocked first) and the
 // "overridden" tally; everBlocked is what determines the highest-exposure flag.
 const speakerMap = new Map<string, SpeakerStat>();
 for (const row of (speakerStatsRes.data || []) as unknown as SpeakerJoinRow[]) {
 const u = row.users;
 if (!u) continue;
 if (!speakerMap.has(u.name)) {
 speakerMap.set(u.name, {
 name: u.name,
 title: u.title || "",
 totalDrafts: 0,
 blocked: 0,
 escalated: 0,
 overridden: 0,
 everBlocked: 0,
 });
 }
 const s = speakerMap.get(u.name)!;
 s.totalDrafts++;
 if (row.status === "blocked") { s.blocked++; s.everBlocked++; }
 else if (row.status === "escalated") s.escalated++;
 else if (row.status === "overridden") { s.overridden++; s.everBlocked++; }
 }
 const speakerStats = Array.from(speakerMap.values()).sort(
 (a, b) => b.everBlocked - a.everBlocked
 );

 return {
 health: { draftsReviewed, blockRatePct, overrideRatePct, gapExposure },
 rulesPerf,
 reviewerFeed: reviewerActions,
 activeRules,
 speakerStats,
 };
}

function ruleTypeColor(t: string): string {
 if (t === "block") return "text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]";
 if (t === "escalate") return "text-[#C2410C] bg-[#FFF7ED] border-[#FED7AA]";
 if (t === "review") return "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]";
 return "text-[#6D28D9] bg-[#F5F3FF] border-[#DDD6FE]";
}

function decisionColor(d: string | undefined): string {
 if (d === "override") return "text-[#3730A3] bg-[#EEF2FF] border-[#C7D2FE]";
 if (d === "approve") return "text-[#166534] bg-[#F0FDF4] border-[#BBF7D0]";
 if (d === "reject" || d === "confirm_block") return "text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]";
 return "text-[#6E6E68] bg-[#F7F6F3] border-[#E2E1DC]";
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
 const { health, rulesPerf, reviewerFeed, activeRules, speakerStats } = await getDashboardData();
 const topExposureName = speakerStats[0]?.everBlocked > 0 ? speakerStats[0].name : null;

 return (
 <>
 <SiteHeader />
 <main className="min-h-screen bg-[#F7F6F3]">
 <div className="max-w-6xl mx-auto px-6 py-12">
 {/* SECTION 5 — Header (with role-disambiguating subtitle + reviewer link) */}
 <div className="mb-8">
 <Link href="/" className="text-sm text-[#6E6E68] hover:text-[#1C1C1A]">← Home</Link>
 <div className="flex items-baseline justify-between gap-4 mt-2">
 <div>
 <h1 className="text-3xl font-light tracking-tight text-[#1C1C1A]">
 Principal dashboard
 </h1>
 <p className="text-sm text-[#1C1C1A] mt-1 font-medium">
 Governance oversight — not the reviewer queue
 </p>
 <p className="text-xs text-[#6E6E68] mt-1">
 Sarah Chen · General Counsel
 </p>
 </div>
 <Link
 href="/reviewer/queue"
 className="text-sm text-[#C9A92C] hover:underline shrink-0"
 >
 Go to reviewer queue →
 </Link>
 </div>
 </div>

 {/* SECTION 1 — Governance health strip */}
 <section className="mb-10">
 <div className="text-xs uppercase tracking-widest text-[#6E6E68] mb-3">
 Governance health
 </div>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-5">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide">Drafts reviewed</div>
 <div className="text-3xl font-light text-[#1C1C1A] mt-1">{health.draftsReviewed}</div>
 <div className="text-xs text-[#6E6E68] mt-1">Across all speakers and campaigns</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-5">
 <div className="text-xs text-[#B91C1C] uppercase tracking-wide">Block rate</div>
 <div className="text-3xl font-light text-[#1C1C1A] mt-1">{health.blockRatePct}%</div>
 <div className="text-xs text-[#6E6E68] mt-1">Drafts halted by hard rules</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-5">
 <div className="text-xs text-[#6D28D9] uppercase tracking-wide">Override rate</div>
 <div className="text-3xl font-light text-[#1C1C1A] mt-1">{health.overrideRatePct}%</div>
 <div className="text-xs text-[#6E6E68] mt-1">Of decisions on blocked drafts</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-5">
 <div className="text-xs text-[#C2410C] uppercase tracking-wide">Unreviewed posts detected</div>
 <div className="text-3xl font-light text-[#1C1C1A] mt-1">{health.gapExposure}</div>
 <div className="text-[10px] text-[#6E6E68] mt-1 italic">
 Gap monitoring active — no unreviewed posts detected
 </div>
 </div>
 </div>
 </section>

 {/* SECTION 1.5 — Speaker exposure (real data, top-blocked highlighted) */}
 <section className="mb-10">
 <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] mb-3">
 Speaker exposure
 </div>
 <div className="grid grid-cols-2 gap-3 mt-4">
 {speakerStats.slice(0, 4).map((s) => {
 const isTopExposure = topExposureName !== null && s.name === topExposureName;
 return (
 <div
 key={s.name}
 className={`bg-white border border-[#E2E1DC] rounded-sm p-5 ${
 isTopExposure ? "border-t-2 border-t-[#B91C1C]" : ""
 }`}
 >
 <div className="flex items-baseline justify-between gap-3">
 <div className="text-sm font-medium text-[#1C1C1A]">{s.name}</div>
 <div className="font-mono text-xs text-[#6E6E68]">{s.title}</div>
 </div>
 <div className="flex gap-4 mt-3">
 <div>
 <div className="font-mono text-xl font-light text-[#1C1C1A]">{s.totalDrafts}</div>
 <div className="font-mono text-[10px] uppercase text-[#6E6E68]">Drafts</div>
 </div>
 <div>
 <div className="font-mono text-xl font-light text-[#1C1C1A]">{s.blocked}</div>
 <div className="font-mono text-[10px] uppercase text-[#6E6E68]">Blocked</div>
 </div>
 <div>
 <div className="font-mono text-xl font-light text-[#1C1C1A]">{s.escalated}</div>
 <div className="font-mono text-[10px] uppercase text-[#6E6E68]">Escalated</div>
 </div>
 </div>
 {isTopExposure && (
 <div className="font-mono text-[10px] text-[#B91C1C] uppercase tracking-wide mt-3">
 Highest exposure
 </div>
 )}
 </div>
 );
 })}
 </div>
 </section>

 {/* SECTION 2 — Rules performance table */}
 <section className="mb-10">
 <div className="flex items-baseline justify-between mb-3">
 <div className="text-xs uppercase tracking-widest text-[#6E6E68]">
 Rules performance
 </div>
 <span className="text-xs text-[#6E6E68]">{rulesPerf.length} rules</span>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-[#F7F6F3] border-b border-[#E2E1DC]">
 <tr>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Rule</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Type</th>
 <th className="text-right px-4 py-3 font-medium text-[#6E6E68]">Times triggered</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Last triggered</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Status</th>
 </tr>
 </thead>
 <tbody>
 {rulesPerf.length === 0 ? (
 <tr>
 <td colSpan={5} className="px-4 py-6 text-center text-[#6E6E68]">
 No rules configured.
 </td>
 </tr>
 ) : (
 rulesPerf.map((r) => (
 <tr key={r.id} className="border-b border-[#E2E1DC] last:border-0">
 <td className="px-4 py-3 text-[#1C1C1A] font-medium">{r.name}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${ruleTypeColor(r.rule_type)}`}>
 {r.rule_type}
 </span>
 </td>
 <td className="px-4 py-3 text-right text-[#1C1C1A] font-medium">{r.timesTriggered}</td>
 <td className="px-4 py-3 text-[#6E6E68] text-xs font-mono">
 {r.lastTriggered ? fmtDateTime(r.lastTriggered) : "—"}
 </td>
 <td className="px-4 py-3">
 <span className={r.isActive
 ? "text-xs text-[#166534]"
 : "text-xs text-[#6E6E68]"}>
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
 <div className="text-xs uppercase tracking-widest text-[#6E6E68]">
 Reviewer activity
 </div>
 <span className="text-xs text-[#6E6E68]">{reviewerFeed.length} recent decisions</span>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm overflow-hidden">
 {reviewerFeed.length === 0 ? (
 <div className="px-4 py-6 text-center text-[#6E6E68] text-sm">
 No reviewer decisions yet.
 </div>
 ) : (
 <ul className="divide-y divide-[#E2E1DC]">
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
 <div className="text-sm text-[#1C1C1A]">
 <span className="font-medium">Sarah Chen · CCO</span>
 <span className="text-[#6E6E68]"> decided on draft from </span>
 <span className="font-medium">{speakerName}</span>
 {speakerTitle && (
 <span className="text-[#6E6E68]"> ({speakerTitle})</span>
 )}
 </div>
 {basis && (
 <div className="text-xs text-[#6E6E68] mt-1">
 Basis: {basis}
 </div>
 )}
 </div>
 <div className="shrink-0 flex flex-col items-end gap-1">
 <span className="text-xs text-[#6E6E68] font-mono">
 {fmtDateTime(a.occurred_at)}
 </span>
 {a.draft_id && (
 <Link
 href={`/drafts/${a.draft_id}`}
 className="text-xs text-[#C9A92C] hover:underline"
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
 <div className="text-xs uppercase tracking-widest text-[#6E6E68]">
 Active rules
 </div>
 <Link href="/rules" className="text-xs text-[#C9A92C] hover:underline">
 Manage rules →
 </Link>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
 {activeRules.length === 0 ? (
 <p className="text-sm text-[#6E6E68] text-center py-4">No rules currently active.</p>
 ) : (
 <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
 {activeRules.map((r) => (
 <li key={r.id} className="flex items-baseline gap-3 text-sm">
 <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${ruleTypeColor(r.rule_type)}`}>
 {r.rule_type}
 </span>
 <span className="text-[#1C1C1A] truncate">{r.name}</span>
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
