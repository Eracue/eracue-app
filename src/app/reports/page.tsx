import Link from "next/link";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";
import { SupervisionExport } from "./supervision-export";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Types ---------------------------------------------------------

type DraftLite = {
  id: string;
  status: string;
};

type ReviewerActionLite = {
  payload: { decision?: string };
};

type SpeakerJoinRow = {
  status: string;
  submitted_at: string;
  users: { id: string; name: string; title: string | null } | null;
};

type SpeakerStat = {
  id: string;
  name: string;
  title: string;
  totalDrafts: number;
  blocked: number;
  escalated: number;
  corpusCount: number;
  trend: "increasing" | "decreasing" | "stable";
  recentBlocks: number;
};

// ---------- Data fetch ----------------------------------------------------

async function getReportsData() {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  const [draftsRes, reviewerActionsRes, speakerStatsRes] = await Promise.all([
    sb.from("drafts").select("id, status").eq("org_id", orgId),
    // Real form-driven decisions only (excludes legacy seed mirror rows
    // where payload.decision == draft status).
    sb
      .from("actions")
      .select("payload")
      .eq("org_id", orgId)
      .eq("action_type", "reviewer_decided")
      .in("payload->>decision", ["override", "confirm_block", "approve", "reject"]),
    sb
      .from("drafts")
      .select("status, submitted_at, users:speaker_id(id, name, title)")
      .eq("org_id", orgId),
  ]);

  if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);
  if (reviewerActionsRes.error)
    throw new Error("decisions: " + reviewerActionsRes.error.message);
  if (speakerStatsRes.error)
    throw new Error("speaker stats: " + speakerStatsRes.error.message);

  const drafts = (draftsRes.data || []) as DraftLite[];
  const reviewerActions = (reviewerActionsRes.data ||
    []) as ReviewerActionLite[];

  // Block rate = blocked / drafts reviewed.
  const draftsReviewed = drafts.length;
  const blocked = drafts.filter((d) => d.status === "blocked").length;
  const blockRatePct =
    draftsReviewed === 0 ? 0 : Math.round((blocked / draftsReviewed) * 100);

  // Override rate = override decisions / (currently blocked + overridden).
  // Both groups were blocked at submission; the denominator is the
  // population that ever reached a principal as a hard stop.
  const overrideDecisions = reviewerActions.filter(
    (a) => a.payload?.decision === "override",
  ).length;
  const everBlocked = drafts.filter(
    (d) => d.status === "blocked" || d.status === "overridden",
  ).length;
  const overrideRatePct =
    everBlocked === 0 ? 0 : Math.round((overrideDecisions / everBlocked) * 100);

  // Speaker exposure — group drafts by speaker name.
  // Trend windows: 3-day recent vs 3–6-day prior. Demo data clusters
  // tightly; a 7-day window would lump everything together.
  const now = Date.now();
  const recentCutoff = now - 3 * 24 * 60 * 60 * 1000;
  const priorCutoff = now - 6 * 24 * 60 * 60 * 1000;
  type SpeakerAccum = SpeakerStat & { _priorBlocks: number };
  const speakerMap = new Map<string, SpeakerAccum>();
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
        trend: "stable",
        recentBlocks: 0,
        _priorBlocks: 0,
      });
    }
    const s = speakerMap.get(u.name)!;
    s.totalDrafts++;
    if (row.status === "blocked" || row.status === "overridden") s.blocked++;
    else if (row.status === "escalated") s.escalated++;
    if (row.status === "approved" || row.status === "overridden") s.corpusCount++;
    if (row.status === "blocked") {
      const submittedTs = new Date(row.submitted_at).getTime();
      if (submittedTs >= recentCutoff) {
        s.recentBlocks++;
      } else if (submittedTs >= priorCutoff) {
        s._priorBlocks++;
      }
    }
  }
  for (const s of speakerMap.values()) {
    if (s.recentBlocks > s._priorBlocks) s.trend = "increasing";
    else if (s.recentBlocks < s._priorBlocks) s.trend = "decreasing";
    else s.trend = "stable";
  }
  const speakerStats: SpeakerStat[] = Array.from(speakerMap.values())
    .map(({ _priorBlocks: _drop, ...rest }) => {
      void _drop;
      return rest;
    })
    .sort((a, b) => b.blocked - a.blocked);

  return {
    draftsReviewed,
    blockRatePct,
    overrideRatePct,
    speakerStats,
  };
}

// ---------- Page ----------------------------------------------------------

export default async function ReportsPage() {
  const { draftsReviewed, blockRatePct, overrideRatePct, speakerStats } =
    await getReportsData();
  const top = speakerStats[0]?.blocked > 0 ? speakerStats[0].name : null;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
          {/* Header */}
          <div className="mb-8">
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A]"
            >
              Reports.
            </h1>
            <p className="text-sm text-[#64748B] mt-2 max-w-xl">
              Governance health, speaker exposure, and supervision-period
              exports for your organization.
            </p>
          </div>

          {/* Stat cards: drafts reviewed, block rate, override rate */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                DRAFTS REVIEWED
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#0F172A]">
                {draftsReviewed}
              </div>
              <div className="text-sm text-[#374151] mt-1">
                Across all speakers
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#B91C1C] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                BLOCK RATE
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#B91C1C]">
                {blockRatePct}%
              </div>
              <div className="text-sm text-[#374151] mt-1">
                Drafts halted by hard rules
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#C2410C] rounded-sm p-7">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                OVERRIDE RATE
              </div>
              <div className="font-mono text-5xl font-light tracking-tight text-[#C2410C]">
                {overrideRatePct}%
              </div>
              <div className="text-sm text-[#374151] mt-1">
                Of blocked drafts overridden
              </div>
            </div>
          </section>

          {/* Speaker exposure */}
          <section className="mt-10">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SPEAKER EXPOSURE
            </div>
            <p className="text-sm text-[#64748B] mt-1 mb-4">
              Governance activity by speaker this period.
            </p>
            {speakerStats.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center text-sm text-[#64748B]">
                No speakers on record yet.
              </div>
            ) : (
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
                      <div className="text-sm text-[#374151] mt-0.5">
                        {s.title}
                      </div>
                      {s.trend === "increasing" && s.recentBlocks > 0 && (
                        <div className="font-mono text-[10px] text-[#C2410C] flex items-center gap-1 mt-1">
                          <span aria-hidden>↑</span>
                          <span>Risk increasing</span>
                        </div>
                      )}
                      {s.trend === "decreasing" && (
                        <div className="font-mono text-[10px] text-[#166534] flex items-center gap-1 mt-1">
                          <span aria-hidden>↓</span>
                          <span>Risk improving</span>
                        </div>
                      )}
                      <div className="flex gap-6 mt-4 flex-wrap">
                        <div>
                          <div className="font-mono text-3xl font-light text-[#0F172A]">
                            {s.totalDrafts}
                          </div>
                          <div className="font-mono text-xs uppercase text-[#64748B] mt-1">
                            total
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-3xl font-light text-[#0F172A]">
                            {s.blocked}
                          </div>
                          <div className="font-mono text-xs uppercase text-[#64748B] mt-1">
                            blocked
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-3xl font-light text-[#0F172A]">
                            {s.escalated}
                          </div>
                          <div className="font-mono text-xs uppercase text-[#64748B] mt-1">
                            escalated
                          </div>
                        </div>
                      </div>
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
            )}
          </section>

          {/* Supervision Period Report — date-range generator */}
          <SupervisionExport />
        </div>
      </main>
    </>
  );
}
