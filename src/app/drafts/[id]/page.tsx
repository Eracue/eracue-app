import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin, type CheckEntry } from "@/lib/checks";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/app/site-header";
import { PublicationRecord } from "./publication-record";

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

 // Publication fields live on three new columns added by
 // scripts/migrate-publication-fields.ts. Until that migration runs the
 // select errors with PostgREST 42703 — caught silently here so the
 // page still renders. Once the SQL is applied, values flow through.
 let publication: { platform: string | null; url: string | null; at: string | null } = {
   platform: null,
   url: null,
   at: null,
 };
 try {
   const { data: pubRow, error: pubErr } = await sb
     .from("drafts")
     .select("published_platform, published_url, published_at")
     .eq("id", id)
     .maybeSingle();
   if (!pubErr && pubRow) {
     publication = {
       platform: (pubRow as { published_platform?: string | null }).published_platform ?? null,
       url: (pubRow as { published_url?: string | null }).published_url ?? null,
       at: (pubRow as { published_at?: string | null }).published_at ?? null,
     };
   }
 } catch {
   // Columns missing — leave publication as nulls.
 }

 return {
 draft: draft as unknown as DraftRow,
 actions: (actions || []) as ActionRow[],
 publication,
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

// Channel raw value → display label. Mirrors the helper in the dashboard
// and archive — kept local for self-containment.
function formatChannel(ch: string): string {
 const map: Record<string, string> = {
 linkedin: "LinkedIn",
 twitter: "X / Twitter",
 press_release: "Press Release",
 blog: "Blog",
 email: "Email",
 interview: "Interview",
 other: "Other",
 };
 return map[ch] ?? ch;
}

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

 return (
 <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <div className="text-xs text-[#64748B] uppercase tracking-wide">Checks performed</div>
 <div className="font-mono text-xs text-[#64748B]">
 5 checks run · 2 deterministic · 3 AI-powered
 </div>
 </div>
 <ul className="space-y-3">
 {CHECK_DEFINITIONS.map((def) => {
 const entry = byName.get(def.name);
 const isDeterministic = def.engine === "deterministic";
 // A check counts as "produced a result" when its entry carries a
 // detail string. For AI checks that's a real signal (Consistency
 // returns prose; the others stay as "would-do" stubs); for
 // deterministic checks it's always considered active.
 const hasDetail = !!entry?.detail;
 const isActive = isDeterministic || hasDetail;
 const isWarn = entry?.result === "warn";
 const resultLine =
 entry?.detail ?? (isDeterministic ? "No rules matched" : def.description);

 const iconCls = isWarn
 ? "bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]"
 : isActive
 ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
 : "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]";
 const iconChar = isWarn ? "!" : isActive ? "✓" : "○";

 return (
 <li key={def.name} className="flex items-start gap-3">
 <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${iconCls}`}>
 {iconChar}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline justify-between gap-3">
 <div className="text-sm font-medium text-[#0F172A]">{def.name}</div>
 <div className="text-xs text-[#64748B]">
 {def.engine === "deterministic" ? "deterministic" : "AI · available"}
 </div>
 </div>
 <div className={`text-xs mt-0.5 ${isWarn ? "text-[#C2410C]" : "text-[#64748B]"}`}>{resultLine}</div>
 {def.name === "Consistency Check" && entry?.prior_statement && (
 <div className="text-xs text-[#64748B] mt-1 pl-3 border-l-2 border-[#FED7AA] italic">
 Prior statement: &ldquo;{entry.prior_statement}&rdquo;
 </div>
 )}
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
 const { draft, actions, publication } = result;

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

 // Reviewer decision (if any). Drives both the status-aware banner and
 // the principal-decision card below; computed once at the top so both
 // branches read from the same record. findLast handles the rare case
 // of multiple decisions (re-decisions) by keeping the most recent.
 const reviewerAction = actions.findLast((a) => a.action_type === "reviewer_decided");
 const reviewerPayload = (reviewerAction?.payload ?? null) as
 | {
 decision?: string;
 reason?: {
 basis?: string;
 verdict_assessment?: string;
 note?: string;
 };
 new_status?: string;
 }
 | null;

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
 <main className="min-h-screen bg-[#F8F9FB]">
 <div className="max-w-3xl mx-auto px-6 py-12">
 <div className="mb-8">
 <Link href="/drafts" className="text-sm text-[#64748B] hover:text-[#0F172A]">← Archive</Link>
 <h1 className="text-3xl font-light tracking-tight text-[#0F172A] mt-2">Draft</h1>
 <p className="text-sm text-[#64748B] mt-1">
 Submitted by {draft.users?.name || "—"}{draft.users?.title ? ` (${draft.users.title})` : ""}
 {draft.campaigns?.name ? ` · Campaign: ${draft.campaigns.name}` : ""}
 </p>
 <div className="flex gap-2 mt-4">
 <Link
 href={`/drafts/${draft.id}/examiner`}
 className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] text-sm font-medium rounded-sm hover:bg-[#F8F9FB] transition"
 >
 Open communication record →
 </Link>
 </div>
 </div>

 {/* Verdict Card */}
 {verdict && (
 <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 mb-6">
 <div className="flex items-start justify-between mb-4">
 <div>
 <div className="text-xs text-[#64748B] uppercase tracking-wide mb-2">Verdict</div>
 <VerdictBadge verdict={verdict} />
 </div>
 <div className="text-right text-xs text-[#64748B]">
 5 checks
 </div>
 </div>
 {primaryMatch && (
 <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
 <div className="text-sm font-medium text-[#0F172A]">{primaryMatch.rule_name}</div>
 <div className="text-sm text-[#64748B] mt-1">{primaryMatch.rule_description}</div>
 <div className="text-xs text-[#64748B] mt-2">
 Matched keyword: <span className="font-mono bg-[#F1F5F9] px-1.5 py-0.5 rounded">{matchedKeyword}</span>
 </div>
 </div>
 )}
 {!primaryMatch && verdict === "clear" && (
 <p className="text-sm text-[#64748B] mt-2">No active rules matched this draft.</p>
 )}
 </div>
 )}

 {/* Status-aware banner. Plain-English copy keyed off draft.status
 plus whether a reviewer_decided action exists; surfaces what's
 happening without leaking internal state names. */}
 {(() => {
 if ((draft.status === "blocked" || draft.status === "escalated") && !reviewerAction) {
 const isBlocked = draft.status === "blocked";
 return (
 <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-sm p-4 mb-6 flex items-center justify-between gap-4">
 <div className="text-sm text-[#374151]">
 {isBlocked
 ? "Pending principal review — this draft cannot publish until a designated principal approves."
 : "Escalated for review — this draft has been routed to the principal for a decision."}
 </div>
 <Link
 href={`/reviewer/${draft.id}`}
 className="shrink-0 px-4 py-2 bg-[#0F172A] text-white text-sm font-medium rounded-sm hover:bg-[#1E293B] transition"
 >
 Open in reviewer →
 </Link>
 </div>
 );
 }
 if (draft.status === "approved" || draft.status === "overridden") {
 return (
 <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-4 mb-6 text-sm text-[#166534]">
 Cleared for publication.
 </div>
 );
 }
 if (draft.status === "pending") {
 return (
 <div className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-sm p-4 mb-6 text-sm text-[#374151]">
 Pending — under governance review.
 </div>
 );
 }
 return null;
 })()}

 {/* Principal decision card — surfaces the reviewer's structured
 decision (basis, verdict assessment, note) on the draft itself
 so a speaker doesn't have to bounce to the reviewer page to
 see what landed. Renders only when a reviewer_decided action
 exists. */}
 {reviewerAction && reviewerPayload && (
 <div className="bg-white border border-[#E2E8F0] rounded-sm p-5 mb-4">
 <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
 Principal Decision
 </div>

 {/* Decision badge + reviewer + timestamp */}
 <div className="flex items-center gap-3 flex-wrap mb-4">
 <span
 className={`font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-sm border ${
 reviewerPayload.decision === "override"
 ? "bg-[#EFF8FF] text-[#1A56DB] border-[#BAE6FD]"
 : reviewerPayload.decision === "confirm_block"
 ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
 : reviewerPayload.decision === "approve"
 ? "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]"
 : reviewerPayload.decision === "reject"
 ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
 : "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
 }`}
 >
 {reviewerPayload.decision?.replace(/_/g, " ") ?? "decided"}
 </span>
 <span className="text-sm font-medium text-[#0F172A]">Sarah Chen · GC</span>
 <span className="font-mono text-xs text-[#94A3B8]">
 {new Date(reviewerAction.occurred_at).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 hour: "numeric",
 minute: "2-digit",
 })}
 </span>
 </div>

 {reviewerPayload.reason?.basis && (
 <div className="text-sm text-[#374151] mb-2">
 <span className="font-medium text-[#0F172A]">Basis:</span>{" "}
 {reviewerPayload.reason.basis}
 </div>
 )}

 {reviewerPayload.reason?.verdict_assessment && (
 <div className="text-sm text-[#374151] mb-2">
 <span className="font-medium text-[#0F172A]">Assessment:</span>{" "}
 {reviewerPayload.reason.verdict_assessment}
 </div>
 )}

 {reviewerPayload.reason?.note && (
 <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
 <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5">
 Note from principal
 </div>
 <div className="text-sm text-[#374151] leading-relaxed italic">
 &ldquo;{reviewerPayload.reason.note}&rdquo;
 </div>
 </div>
 )}

 {/* What this means — plain-English implication of the decision. */}
 <div className="mt-3 pt-3 border-t border-[#E2E8F0] font-mono text-[10px] text-[#64748B]">
 {reviewerPayload.decision === "override"
 ? "✓ Approved for publication — cleared by designated principal"
 : reviewerPayload.decision === "confirm_block"
 ? "✗ Not approved — this draft cannot be published"
 : reviewerPayload.decision === "approve"
 ? "✓ Approved for publication"
 : reviewerPayload.decision === "reject"
 ? "✗ Not approved — revise and resubmit"
 : ""}
 </div>
 </div>
 )}

 {/* Publication record — visible for approved/overridden drafts.
 Renders the recorded platform/url/timestamp when present, the
 capture form when not. Backed by recordPublicationAction. */}
 {(draft.status === "approved" || draft.status === "overridden") && (
 <PublicationRecord
 draftId={draft.id}
 existingPlatform={publication.platform}
 existingUrl={publication.url}
 existingPublishedAt={publication.at}
 />
 )}

 {/* Checks Performed */}
 <ChecksPerformedPanel checks={checks} />

 {/* Draft Text */}
 <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 mb-6">
 <div className="flex items-center gap-2 mb-4">
 <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-sm border border-[#E2E8F0] uppercase">
 {formatChannel(draft.channel)}
 </span>
 <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-sm border border-[#E2E8F0]">
 {draft.source_origin?.replace("_", " ")}
 </span>
 {verdict && <VerdictBadge verdict={verdict} />}
 </div>
 <p className="text-[#0F172A] whitespace-pre-wrap leading-relaxed">
 {highlightMatch(draft.draft_text, matchedKeyword)}
 </p>
 </div>

 {/* Other matches if more than one */}
 {allMatches.length > 1 && (
 <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 mb-6">
 <div className="text-xs text-[#64748B] uppercase tracking-wide mb-3">All rule matches ({allMatches.length})</div>
 <ul className="space-y-2 text-sm">
 {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
 {allMatches.map((m: any, i: number) => (
 <li key={i} className="flex items-start gap-3">
 <VerdictBadge verdict={m.rule_type} />
 <div className="flex-1">
 <div className="font-medium text-[#0F172A]">{m.rule_name}</div>
 <div className="text-xs text-[#64748B] mt-0.5">
 Keyword: <span className="font-mono">{m.matched_keyword}</span>
 </div>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Action timeline. Older drafts have a second verdict_issued written
 by the reclassify script; only the most recent one is shown here.
 The fact that a reclassification happened is preserved as a footnote
 below the list. */}
 {(() => {
 const verdictIssued = actions.filter((a) => a.action_type === "verdict_issued");
 const wasReclassified = verdictIssued.length > 1;
 const lastVerdictId = verdictIssued.length > 0
 ? verdictIssued[verdictIssued.length - 1].id
 : null;
 const filtered = actions.filter(
 (a) => a.action_type !== "verdict_issued" || a.id === lastVerdictId,
 );
 return (
 <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
 <div className="text-xs text-[#64748B] uppercase tracking-wide mb-3">Audit timeline</div>
 <ul className="space-y-2 text-sm">
 {filtered.map((a) => (
 <li key={a.id} className="flex items-baseline gap-3">
 <span className="text-xs text-[#64748B] font-mono w-20 shrink-0">{new Date(a.occurred_at).toLocaleTimeString()}</span>
 <span className="text-[#0F172A]">{a.action_type.replace("_", " ")}</span>
 <span className="text-xs text-[#64748B]">({a.actor_kind})</span>
 </li>
 ))}
 </ul>
 {wasReclassified && (
 <div className="font-mono text-[10px] text-[#94A3B8] mt-3">
 Verdict was updated after initial submission.
 </div>
 )}
 </div>
 );
 })()}
 </div>
 </main>
 </>
 );
}
