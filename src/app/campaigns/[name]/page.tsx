import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ name: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  status: string;
  submitted_at: string;
  channel: string;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionLite = {
  draft_id: string;
  action_type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

type SpeakerStat = {
  name: string;
  title: string;
  total: number;
  approved: number;
  blocked: number;
};

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Compact status pill for the campaign communications list. Mirrors the
// combinedStatus treatment from the Archive but inlined here so the
// campaign page stays self-contained.
function statusPill(status: string, hasDecision: boolean) {
  if (status === "overridden") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#EFF8FF] text-[#1A56DB] border-[#BAE6FD]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB]" aria-hidden />
        Overridden
      </span>
    );
  }
  if (status === "approved") {
    if (hasDecision) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" aria-hidden />
          Principal approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" aria-hidden />
        System cleared
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" aria-hidden />
        Blocked
      </span>
    );
  }
  if (status === "escalated") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C2410C]" aria-hidden />
        Escalated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" aria-hidden />
      {status || "—"}
    </span>
  );
}

async function getCampaignData(campaignName: string) {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  // Fetch drafts joined with users + campaigns; filter by campaign in JS
  // since PostgREST can't WHERE on a related-table column without a
  // secondary call.
  const draftsRes = await sb
    .from("drafts")
    .select(
      "id, draft_text, status, submitted_at, channel, users:speaker_id(name, title), campaigns(name)",
    )
    .eq("org_id", orgId)
    .order("submitted_at", { ascending: false });

  if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);

  const allDrafts = (draftsRes.data || []) as unknown as DraftRow[];
  const drafts = allDrafts.filter((d) => d.campaigns?.name === campaignName);
  if (drafts.length === 0) return null;

  // Fetch only the actions we need to compute timeline math for these
  // drafts. submitted/verdict_issued/reviewer_decided cover the four
  // timeline steps.
  const draftIds = drafts.map((d) => d.id);
  const actionsRes = await sb
    .from("actions")
    .select("draft_id, action_type, occurred_at, payload")
    .eq("org_id", orgId)
    .in("draft_id", draftIds)
    .in("action_type", ["submitted", "draft_submitted", "verdict_issued", "reviewer_decided"]);

  const actions = (actionsRes.data || []) as ActionLite[];
  const actionsByDraft = new Map<string, ActionLite[]>();
  for (const a of actions) {
    const list = actionsByDraft.get(a.draft_id) ?? [];
    list.push(a);
    actionsByDraft.set(a.draft_id, list);
  }

  return { drafts, actionsByDraft };
}

export default async function CampaignRecordPage({ params }: PageProps) {
  const { name } = await params;
  const campaignName = decodeURIComponent(name);
  const result = await getCampaignData(campaignName);
  if (!result) notFound();
  const { drafts, actionsByDraft } = result;

  // Stats
  const total = drafts.length;
  const approved = drafts.filter(
    (d) => d.status === "approved" || d.status === "overridden",
  ).length;
  const blocked = drafts.filter((d) => d.status === "blocked").length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Average approval time across drafts that have both submitted +
  // reviewer_decided actions.
  const approvalTimes: number[] = [];
  for (const d of drafts) {
    const acts = actionsByDraft.get(d.id) ?? [];
    const submitted = acts.find(
      (a) => a.action_type === "submitted" || a.action_type === "draft_submitted",
    );
    const decided = acts.find((a) => a.action_type === "reviewer_decided");
    if (submitted && decided) {
      const mins = Math.round(
        (new Date(decided.occurred_at).getTime() -
          new Date(submitted.occurred_at).getTime()) /
          1000 /
          60,
      );
      approvalTimes.push(mins);
    }
  }
  const avgApprovalTime =
    approvalTimes.length > 0
      ? Math.round(approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length)
      : null;

  // Speaker breakdown
  const speakerMap = new Map<string, SpeakerStat>();
  for (const d of drafts) {
    const name = d.users?.name ?? "Unknown";
    const existing = speakerMap.get(name) ?? {
      name,
      title: d.users?.title ?? "",
      total: 0,
      approved: 0,
      blocked: 0,
    };
    existing.total++;
    if (d.status === "approved" || d.status === "overridden") existing.approved++;
    if (d.status === "blocked") existing.blocked++;
    speakerMap.set(name, existing);
  }
  const speakers = Array.from(speakerMap.values()).sort((a, b) => b.total - a.total);

  // For the per-draft status pill we need to know if a reviewer_decided
  // action exists.
  const hasDecision = (draftId: string) =>
    (actionsByDraft.get(draftId) ?? []).some((a) => a.action_type === "reviewer_decided");

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/drafts"
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A]"
            >
              ← Archive
            </Link>
            <div className="flex justify-between items-end gap-4 flex-wrap mt-3">
              <div className="min-w-0">
                <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                  CAMPAIGN RECORD
                </div>
                <h1
                  style={{ fontFamily: "var(--font-newsreader)" }}
                  className="font-light text-3xl text-[#0F172A] mt-2"
                >
                  {campaignName}
                </h1>
                <p className="text-sm text-[#374151] mt-2 max-w-2xl leading-relaxed">
                  Governance record for all communications under this campaign.
                </p>
                <div className="font-mono text-xs text-[#64748B] mt-2">
                  Governed by: Sarah Chen, GC
                </div>
              </div>
              <a
                href={`/supervision-report?campaign=${encodeURIComponent(campaignName)}`}
                className="font-mono text-xs text-[#1A56DB] border border-[#BAE6FD] bg-[#EFF8FF] px-4 py-2 rounded-sm hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
              >
                Export campaign record →
              </a>
            </div>
          </div>

          {/* Governance summary — 4 stat cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Total
              </div>
              <div className="font-mono text-3xl font-light text-[#0F172A]">{total}</div>
              <div className="font-mono text-xs text-[#64748B] mt-1">communications</div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#166534] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Approved
              </div>
              <div className="font-mono text-3xl font-light text-[#166534]">
                {approved}{" "}
                <span className="font-mono text-sm text-[#166534]">
                  ({approvalRate}%)
                </span>
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Cleared for publication
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#B91C1C] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Flagged
              </div>
              <div className="font-mono text-3xl font-light text-[#B91C1C]">{blocked}</div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Stopped by governance rules
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#1A56DB] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Avg. approval time
              </div>
              <div className="font-mono text-3xl font-light text-[#1A56DB]">
                {fmtMinutes(avgApprovalTime)}
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Submission → principal decision
              </div>
            </div>
          </section>

          {/* Speaker breakdown */}
          <section className="mt-10">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SPEAKERS
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {speakers.map((s) => {
                const pct = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
                return (
                  <div
                    key={s.name}
                    className="bg-white border border-[#E2E8F0] rounded-sm p-4"
                  >
                    <div className="text-sm font-semibold text-[#0F172A]">{s.name}</div>
                    <div className="font-mono text-xs text-[#64748B]">{s.title}</div>
                    <div className="flex gap-4 mt-3 font-mono text-xs text-[#64748B]">
                      <span>{s.total} submitted</span>
                      <span className="text-[#166534]">{s.approved} approved</span>
                      <span className="text-[#B91C1C]">{s.blocked} flagged</span>
                    </div>
                    <div className="mt-2 bg-[#F1F5F9] rounded-full h-1">
                      <div
                        className="bg-[#1A56DB] h-1 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                        aria-label={`${pct}% approval rate`}
                      />
                    </div>
                    <Link
                      href={`/drafts?speaker=${encodeURIComponent(s.name)}`}
                      className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors mt-3 inline-block"
                    >
                      View all →
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Communications timeline */}
          <section className="mt-10 mb-16">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              COMMUNICATIONS
            </div>
            <p className="text-sm text-[#374151] mt-1 mb-4">
              Chronological record of all submissions under this campaign.
            </p>
            {drafts.map((d) => (
              <div
                key={d.id}
                className="bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-[#64748B] mb-1">
                    {d.users?.name ?? "—"}
                    {d.users?.title ? ` · ${d.users.title}` : ""}
                  </div>
                  <div
                    className="text-sm text-[#374151] mb-1 leading-snug"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {d.draft_text}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-1.5 py-0.5 rounded-sm">
                      {fmtDate(d.submitted_at)}
                    </span>
                    <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-1.5 py-0.5 rounded-sm">
                      {formatChannel(d.channel)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusPill(d.status, hasDecision(d.id))}
                  <Link
                    href={`/drafts/${d.id}/examiner`}
                    className="font-mono text-xs font-medium text-[#1A56DB] hover:text-[#1447C0] transition-colors whitespace-nowrap"
                  >
                    Communication record →
                  </Link>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
