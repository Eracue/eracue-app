import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin, type CheckEntry } from "@/lib/checks";
import { notFound } from "next/navigation";
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

// Canonical 5-check taxonomy. Order matches buildChecksArray() in src/lib/checks.ts.
// `engine === "deterministic"` → wired up today; `engine === "ai"` → not yet implemented.
const CHECK_DEFINITIONS: { name: string; description: string; engine: "deterministic" | "ai" }[] = [
 { name: "Rule Check", description: "Matches draft text against keywords from active rules", engine: "deterministic" },
 { name: "Consistency Check", description: "Compares draft against prior statements (requires corpus)", engine: "ai" },
 { name: "Alignment Check", description: "Aligns with organization's narrative profile", engine: "ai" },
 { name: "Quiet Period Check", description: "Detects overlap with active quiet-period rules", engine: "deterministic" },
 { name: "Agent Origin Check", description: "Validates AI source disclosure", engine: "ai" },
];

function VerdictBadge({ verdict }: { verdict: string }) {
 const styles: Record<string, { bg: string; text: string; label: string; border: string }> = {
 block: { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
 escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
 review: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
 guide: { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
 clear: { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
 };
 const s = styles[verdict] || styles.clear;
 return (
 <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-wide ${s.bg} ${s.text} border ${s.border}`}>
 {s.label}
 </span>
 );
}

function ChecksPerformedPanel({ checks }: { checks: CheckEntry[] }) {
 const byName = new Map(checks.map((c) => [c.check_name, c]));
 const activeCount = CHECK_DEFINITIONS.filter((d) => d.engine === "deterministic" && byName.has(d.name)).length;
 const totalCount = CHECK_DEFINITIONS.length;

 return (
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide">Checks performed</div>
 <div className="text-xs text-[#6E6E68]">
 <span className="font-medium text-[#1C1C1A]">{activeCount} of {totalCount}</span> active
 </div>
 </div>
 <ul className="space-y-3">
 {CHECK_DEFINITIONS.map((def) => {
 const entry = byName.get(def.name);
 const isActive = def.engine === "deterministic";
 // For active deterministic checks: show entry detail when present
 // (e.g., "Matched: Series B Quiet Period"). For AI-available checks:
 // show the engine description as a "would-do" hint.
 const resultLine = isActive
 ? (entry?.detail ?? "No rules matched")
 : def.description;

 return (
 <li key={def.name} className="flex items-start gap-3">
 <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
 isActive
 ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
 : "bg-[#F0EFE9] text-[#6E6E68] border border-[#E2E1DC]"
 }`}>
 {isActive ? "✓" : "○"}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline justify-between gap-3">
 <div className="text-sm font-medium text-[#1C1C1A]">{def.name}</div>
 <div className="text-xs text-[#6E6E68]">
 {def.engine === "deterministic" ? "deterministic" : "AI · available"}
 </div>
 </div>
 <div className="text-xs text-[#6E6E68] mt-0.5">{resultLine}</div>
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
 <mark className="bg-[#FEF3C7] px-0.5 rounded">{match}</mark>
 {after}
 </>
 );
}

export default async function DraftDetailPage({ params }: PageProps) {
 const { id } = await params;
 const result = await getDraftWithActions(id);
 if (!result) notFound();
 const { draft, actions } = result;

 // Find the MOST RECENT verdict_issued action — older drafts have a second
 // verdict_issued written by the reclassify script. The first one is stale.
 const verdictAction = actions.findLast((a) => a.action_type === "verdict_issued");
 const verdict = (verdictAction?.payload?.verdict as string) || null;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const primaryMatch = (verdictAction?.payload?.primary_match as any) || null;
 const matchedKeyword = primaryMatch?.matched_keyword as string | undefined;

 // Find the most recent rule_check too (same reasoning).
 const ruleCheck = actions.findLast((a) => a.action_type === "check_ran" && (a.payload as { check?: string })?.check === "rule_check");
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const allMatches = (ruleCheck?.payload?.matches as any[]) || [];

 // Canonical 5-check array from verdict_issued payload (set by buildChecksArray
 // in src/lib/checks.ts). Older records pre-dating that helper don't have it —
 // synthesize a fallback from primary_match.
 const storedChecks = verdictAction?.payload?.checks as CheckEntry[] | undefined;
 const isQuietPeriodMatch = primaryMatch ? /quiet period/i.test(primaryMatch.rule_name) : false;
 const checks: CheckEntry[] = storedChecks ?? [
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

 return (
 <>
 <SiteHeader />
 <main className="min-h-screen bg-[#F7F6F3]">
 <div className="max-w-3xl mx-auto px-6 py-12">
 <div className="mb-8">
 <Link href="/drafts" className="text-sm text-[#6E6E68] hover:text-[#1C1C1A]">← All drafts</Link>
 <h1 className="text-3xl font-light tracking-tight text-[#1C1C1A] mt-2">Draft</h1>
 <p className="text-sm text-[#6E6E68] mt-1">
 Submitted by {draft.users?.name || "—"}{draft.users?.title ? ` (${draft.users.title})` : ""}
 {draft.campaigns?.name ? ` · Campaign: ${draft.campaigns.name}` : ""}
 </p>
 <div className="flex gap-2 mt-4">
 <Link
 href={`/drafts/${draft.id}/examiner`}
 className="px-4 py-2 bg-white border border-[#E2E1DC] text-[#1C1C1A] text-sm font-medium rounded-sm hover:bg-[#F7F6F3] transition"
 >
 Export examiner record →
 </Link>
 </div>
 </div>

 {/* Verdict Card */}
 {verdict && (
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-6 mb-6">
 <div className="flex items-start justify-between mb-4">
 <div>
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide mb-2">Verdict</div>
 <VerdictBadge verdict={verdict} />
 </div>
 <div className="text-right text-xs text-[#6E6E68]">
 {actions.filter((a) => a.action_type === "check_ran").length} checks run
 </div>
 </div>
 {primaryMatch && (
 <div className="mt-4 pt-4 border-t border-[#E2E1DC]">
 <div className="text-sm font-medium text-[#1C1C1A]">{primaryMatch.rule_name}</div>
 <div className="text-sm text-[#6E6E68] mt-1">{primaryMatch.rule_description}</div>
 <div className="text-xs text-[#6E6E68] mt-2">
 Matched keyword: <span className="font-mono bg-[#F0EFE9] px-1.5 py-0.5 rounded">{matchedKeyword}</span>
 </div>
 </div>
 )}
 {!primaryMatch && verdict === "clear" && (
 <p className="text-sm text-[#6E6E68] mt-2">No active rules matched this draft.</p>
 )}
 </div>
 )}

 {/* Send to reviewer prompt — only when verdict and status both indicate
 the draft genuinely needs review (avoids showing this on drafts whose
 verdict is CLEAR but status was manually set elsewhere). */}
 {(draft.status === "blocked" || draft.status === "escalated") &&
 (verdict === "block" || verdict === "escalate") && (
 <div className="bg-[#F0EFE9] border border-[#E2E1DC] rounded-sm p-4 mb-6 flex items-center justify-between gap-4">
 <div className="text-sm text-[#1C1C1A]">
 This draft needs reviewer attention.
 </div>
 <Link
 href={`/reviewer/${draft.id}`}
 className="shrink-0 px-4 py-2 bg-[#1C1C1A] text-white text-sm font-medium rounded-sm hover:bg-[#333331] transition"
 >
 Open in reviewer →
 </Link>
 </div>
 )}

 {/* Checks Performed */}
 <ChecksPerformedPanel checks={checks} />

 {/* Draft Text */}
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-8 mb-6">
 <div className="flex items-center gap-2 mb-4 text-xs text-[#6E6E68] uppercase tracking-wide">
 <span>{draft.channel}</span>
 <span>·</span>
 <span>{draft.source_origin.replace("_", " ")}</span>
 <span>·</span>
 <span>Status: {draft.status}</span>
 </div>
 <p className="text-[#1C1C1A] whitespace-pre-wrap leading-relaxed">
 {highlightMatch(draft.draft_text, matchedKeyword)}
 </p>
 </div>

 {/* Other matches if more than one */}
 {allMatches.length > 1 && (
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-6 mb-6">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide mb-3">All rule matches ({allMatches.length})</div>
 <ul className="space-y-2 text-sm">
 {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
 {allMatches.map((m: any, i: number) => (
 <li key={i} className="flex items-start gap-3">
 <VerdictBadge verdict={m.rule_type} />
 <div className="flex-1">
 <div className="font-medium text-[#1C1C1A]">{m.rule_name}</div>
 <div className="text-xs text-[#6E6E68] mt-0.5">
 Keyword: <span className="font-mono">{m.matched_keyword}</span>
 </div>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Action timeline */}
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-6">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide mb-3">Audit timeline</div>
 <ul className="space-y-2 text-sm">
 {actions.map((a) => (
 <li key={a.id} className="flex items-baseline gap-3">
 <span className="text-xs text-[#6E6E68] font-mono w-20 shrink-0">{new Date(a.occurred_at).toLocaleTimeString()}</span>
 <span className="text-[#1C1C1A]">{a.action_type.replace("_", " ")}</span>
 <span className="text-xs text-[#6E6E68]">({a.actor_kind})</span>
 </li>
 ))}
 </ul>
 </div>
 </div>
 </main>
 </>
 );
}
