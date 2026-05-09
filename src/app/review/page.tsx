import Link from "next/link";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Types ---------------------------------------------------------

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

async function getReviewQueue(): Promise<{
  queueGroups: QueueGroup[];
  pendingCount: number;
  oldestSubmittedAt: string | null;
}> {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  // The Review page has one job: surface drafts that need a principal
  // decision. Pull only what that surface needs — `blocked` and
  // `escalated` rows ordered by submission time so the oldest waiting
  // draft drives the "Oldest waiting [X hours]" subhead.
  const queueRes = await sb
    .from("drafts")
    .select(
      "id, draft_text, channel, status, submitted_at, users(name, title), campaigns(name)",
    )
    .eq("org_id", orgId)
    .in("status", ["blocked", "escalated"])
    .order("submitted_at", { ascending: false });

  if (queueRes.error) throw new Error("queue: " + queueRes.error.message);

  const queueDrafts = (queueRes.data || []) as unknown as QueueDraft[];

  // Deduplicate identical (speaker × draft text) submissions, keep the
  // most recent, attach a duplicate_count so the row can show "×N"
  // instead of repeating the same draft three times.
  const dedupKey = (d: QueueDraft) =>
    `${d.users?.name ?? "Unknown"}::${d.draft_text.trim()}`;
  const dedupMap = new Map<string, QueueDraftDeduped>();
  for (const d of queueDrafts) {
    const key = dedupKey(d);
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, { ...d, duplicate_count: 1 });
    } else if (d.submitted_at > existing.submitted_at) {
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
    (a, b) => b.drafts.length - a.drafts.length,
  );

  // Pending count reflects every submission (including duplicates) so
  // the number matches what's actually in the database, not the
  // visible row count after dedup.
  const pendingCount = queueDrafts.length;

  // Oldest pending submission — drives the subhead's "Oldest waiting
  // [X hours]" line. The queue is ordered desc, so the last entry is
  // the oldest. Returns null when the queue is empty.
  const oldestSubmittedAt =
    queueDrafts.length > 0
      ? queueDrafts[queueDrafts.length - 1].submitted_at
      : null;

  return { queueGroups, pendingCount, oldestSubmittedAt };
}

// ---------- Helpers -------------------------------------------------------

function formatChannel(ch: string): string {
  const map: Record<string, string> = {
    linkedin: "LinkedIn",
    twitter: "X / Twitter",
    press_release: "Press Release",
    blog: "Blog",
    email: "Email",
    interview: "Interview",
    internal_memo: "Internal memo",
    ai_agent_post: "AI agent post",
    other: "Other",
  };
  return map[ch] ?? ch;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// 80-char clamp on the visible draft text. Falls back to the full
// string when it's already short enough; the ellipsis sits inside the
// 80-char budget so the tooltip-style hover (title=) carries the full
// draft for context.
function truncateText(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function hoursWaiting(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffH = Math.floor((now - then) / (60 * 60 * 1000));
  return diffH < 0 ? 0 : diffH;
}

// ---------- Page ----------------------------------------------------------

export default async function ReviewPage() {
  const { queueGroups, pendingCount, oldestSubmittedAt } =
    await getReviewQueue();
  const now = Date.now();
  const oldestHours = hoursWaiting(oldestSubmittedAt, now);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
          {/* Page header */}
          <div className="mb-8">
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A]"
            >
              Drafts awaiting your decision.
            </h1>
            <p className="text-sm text-[#64748B] mt-2">
              <span className="font-medium text-[#0F172A]">{pendingCount}</span>{" "}
              draft{pendingCount !== 1 ? "s" : ""} pending
              {pendingCount > 0 && oldestHours !== null && (
                <>
                  {" "}· Oldest waiting{" "}
                  <span className="font-medium text-[#0F172A]">
                    {oldestHours} hour{oldestHours !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* ACTION REQUIRED — count badge + section header */}
          <section>
            <div className="flex justify-between items-baseline">
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                  ACTION REQUIRED
                </div>
                <div className="text-xl font-semibold text-[#0F172A] mt-1">
                  {pendingCount} draft{pendingCount !== 1 ? "s" : ""} need your
                  decision
                </div>
              </div>
              {queueGroups.length > 0 && (
                <span className="font-mono text-xs text-[#64748B]">
                  Grouped by speaker
                </span>
              )}
            </div>

            {queueGroups.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-12 text-center mt-6">
                <div className="text-[#94A3B8] text-base">
                  No drafts pending review.
                </div>
                <div className="text-[#94A3B8] text-sm mt-2">
                  Drafts that require principal approval will appear here.
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                {queueGroups.map((group) => (
                  <div key={group.name}>
                    {/* Group header */}
                    <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-t-sm px-5 py-3 mt-3 flex justify-between items-center">
                      <div className="flex items-baseline">
                        <span className="text-base font-semibold text-[#0F172A]">
                          {group.name}
                        </span>
                        {group.title && (
                          <span className="text-sm text-[#374151] ml-3">
                            {group.title}
                          </span>
                        )}
                      </div>
                      <span className="bg-white border border-[#E2E8F0] rounded-sm font-mono text-xs text-[#64748B] px-2 py-0.5">
                        {group.drafts.length} draft
                        {group.drafts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {/* Draft rows */}
                    {group.drafts.map((d, idx) => {
                      const isLast = idx === group.drafts.length - 1;
                      const truncated = truncateText(d.draft_text, 80);
                      return (
                        <div
                          key={d.id}
                          className={`bg-white border-x border-b border-[#E2E8F0] px-5 py-4 hover:bg-[#F8F9FB] transition-colors ${
                            isLast ? "rounded-b-sm" : ""
                          }`}
                        >
                          {/* Draft text — 80-char clamp; full text on hover */}
                          <div className="flex items-start gap-2 mb-2">
                            <p
                              title={d.draft_text}
                              className="text-sm font-medium text-[#0F172A] min-w-0 flex-1"
                            >
                              {truncated}
                            </p>
                            {d.duplicate_count > 1 && (
                              <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-sm border border-[#E2E8F0] shrink-0">
                                ×{d.duplicate_count}
                              </span>
                            )}
                          </div>
                          {/* Chips + timestamp + Review link */}
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
                              <span className="font-mono text-xs text-[#94A3B8]">
                                {fmtTime(d.submitted_at)}
                              </span>
                            </div>
                            <Link
                              href={`/review/${d.id}`}
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
        </div>
      </main>
    </>
  );
}
