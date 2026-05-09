import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };

type Speaker = {
  id: string;
  name: string;
  title: string | null;
};

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  status: string;
  submitted_at: string;
  campaigns: { name: string } | null;
};

type DecisionRow = {
  draft_id: string;
  payload: Record<string, unknown>;
  occurred_at: string;
};

// Channel raw value → display label. Same map the rest of the app uses;
// duplicated here to keep this page module self-contained.
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

async function getSpeakerData(speakerId: string) {
  const sb = getSupabaseAdmin();

  const [speakerRes, draftsRes, decisionsRes] = await Promise.all([
    sb
      .from("users")
      .select("id, name, title")
      .eq("id", speakerId)
      .eq("org_id", DEMO_ORG_ID)
      .maybeSingle(),
    sb
      .from("drafts")
      .select("id, draft_text, channel, status, submitted_at, campaigns(name)")
      .eq("org_id", DEMO_ORG_ID)
      .eq("speaker_id", speakerId)
      .order("submitted_at", { ascending: false }),
    sb
      .from("actions")
      .select("draft_id, payload, occurred_at")
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "reviewer_decided")
      .order("occurred_at", { ascending: false }),
  ]);

  if (speakerRes.error || !speakerRes.data) return null;

  const speaker = speakerRes.data as Speaker;
  const drafts = (draftsRes.data || []) as unknown as DraftRow[];
  const decisions = (decisionsRes.data || []) as DecisionRow[];

  // Map draft_id → most-recent reviewer_decided occurred_at, used to label
  // approved drafts with the principal's signoff date instead of the
  // submission date.
  const decisionByDraftId = new Map<string, string>();
  for (const d of decisions) {
    if (!decisionByDraftId.has(d.draft_id)) {
      decisionByDraftId.set(d.draft_id, d.occurred_at);
    }
  }

  return { speaker, drafts, decisionByDraftId };
}

export default async function SpeakerProfilePage({ params }: PageProps) {
  const { id } = await params;
  const result = await getSpeakerData(id);
  if (!result) notFound();
  const { speaker, drafts, decisionByDraftId } = result;

  const totalSubmissions = drafts.length;
  // Approved + overridden both represent drafts that wound up cleared
  // for publication. Blocked drafts stand alone.
  const approvedDrafts = drafts.filter(
    (d) => d.status === "approved" || d.status === "overridden",
  );
  const approvedCount = approvedDrafts.length;
  const blockedDrafts = drafts.filter((d) => d.status === "blocked");
  const blockedCount = blockedDrafts.length;
  const overrideCount = drafts.filter((d) => d.status === "overridden").length;
  const everBlocked = blockedCount + overrideCount;
  const overrideRatePct =
    everBlocked === 0 ? 0 : Math.round((overrideCount / everBlocked) * 100);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/review"
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A]"
            >
              ← Review
            </Link>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-3"
            >
              {speaker.name}
            </h1>
            <p className="text-sm text-[#374151]">{speaker.title || ""}</p>

            <div className="flex gap-8 mt-4">
              <div>
                <div className="font-mono text-2xl font-light text-[#0F172A]">
                  {totalSubmissions}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mt-1">
                  Total submissions
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-light text-[#166534]">
                  {approvedCount}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mt-1">
                  Approved
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-light text-[#B91C1C]">
                  {blockedCount}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mt-1">
                  Blocked
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-light text-[#0F172A]">
                  {overrideRatePct}%
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mt-1">
                  Override rate
                </div>
              </div>
            </div>
          </div>

          {/* Communication record / corpus */}
          <section className="mt-10">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              APPROVED STATEMENTS · CORPUS
            </div>
            <p className="text-sm text-[#374151] mt-1 mb-4 max-w-2xl leading-relaxed">
              Every communication approved through ERA CUE — the speaker&apos;s
              compliance-grade record.
            </p>
            {approvedDrafts.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center text-sm text-[#64748B]">
                No approved statements yet.
              </div>
            ) : (
              approvedDrafts.map((d) => {
                const approvedAt = decisionByDraftId.get(d.id) || d.submitted_at;
                return (
                  <div
                    key={d.id}
                    className="bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4"
                  >
                    <div
                      className="text-sm text-[#374151]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {d.draft_text}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                        {formatChannel(d.channel)}
                      </span>
                      {d.campaigns?.name && (
                        <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                          {d.campaigns.name}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-xs text-[#94A3B8]">
                        Approved {fmtDate(approvedAt)}
                      </span>
                      <Link
                        href={`/drafts/${d.id}/examiner`}
                        className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
                      >
                        Communication record →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Blocked drafts — collapsed by default. Uses native <details>
              so the section is fully server-renderable; no client-side
              state needed. */}
          {blockedDrafts.length > 0 && (
            <section className="mt-10 mb-16">
              <details>
                <summary className="font-mono text-xs uppercase tracking-widest text-[#64748B] cursor-pointer">
                  BLOCKED DRAFTS · {blockedDrafts.length}
                </summary>
                <p className="text-xs text-[#94A3B8] mt-1 mb-4">
                  Drafts blocked by ERA CUE rules — captured before publication.
                </p>
                {blockedDrafts.map((d) => (
                  <div
                    key={d.id}
                    className="bg-white border border-[#E2E8F0] border-l-2 border-l-[#FECACA] rounded-sm mb-1 px-5 py-4"
                  >
                    <div
                      className="text-sm text-[#374151]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {d.draft_text}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                        {formatChannel(d.channel)}
                      </span>
                      <span className="ml-auto font-mono text-xs text-[#94A3B8]">
                        Submitted {fmtDate(d.submitted_at)}
                      </span>
                      <Link
                        href={`/drafts/${d.id}`}
                        className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
                      >
                        View draft →
                      </Link>
                    </div>
                  </div>
                ))}
              </details>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
