import Link from "next/link";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";
import { NewCampaignForm } from "./new-campaign-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// ---------- Types ---------------------------------------------------------

type CampaignRow = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
};

type DraftRow = {
  campaign_id: string | null;
  speaker_id: string | null;
};

// ---------- Data fetch ----------------------------------------------------

async function getProgramsData() {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  const [campaignsRes, draftsRes] = await Promise.all([
    sb
      .from("campaigns")
      .select("id, name, starts_at, ends_at")
      .eq("org_id", orgId)
      .order("starts_at", { ascending: false }),
    sb
      .from("drafts")
      .select("campaign_id, speaker_id")
      .eq("org_id", orgId),
  ]);

  if (campaignsRes.error) throw new Error("campaigns: " + campaignsRes.error.message);
  if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);

  const campaignRows = (campaignsRes.data ?? []) as CampaignRow[];
  const draftRows = (draftsRes.data ?? []) as DraftRow[];

  // Per-campaign aggregates: draft count + distinct speaker count.
  const draftCountByCampaign = new Map<string, number>();
  const speakersByCampaign = new Map<string, Set<string>>();
  for (const d of draftRows) {
    if (!d.campaign_id) continue;
    draftCountByCampaign.set(
      d.campaign_id,
      (draftCountByCampaign.get(d.campaign_id) ?? 0) + 1,
    );
    if (d.speaker_id) {
      const set = speakersByCampaign.get(d.campaign_id) ?? new Set<string>();
      set.add(d.speaker_id);
      speakersByCampaign.set(d.campaign_id, set);
    }
  }

  const programs = campaignRows.map((c) => ({
    id: c.id,
    name: c.name,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    draftCount: draftCountByCampaign.get(c.id) ?? 0,
    speakerCount: speakersByCampaign.get(c.id)?.size ?? 0,
  }));

  return programs;
}

// ---------- Helpers -------------------------------------------------------

function fmtRange(starts: string | null, ends: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (starts && ends) return `${fmt(starts)} – ${fmt(ends)}`;
  if (starts) return `From ${fmt(starts)}`;
  if (ends) return `Through ${fmt(ends)}`;
  return "—";
}

// Status derives from the date range: a program is "Active" while we
// sit between its start and end dates, "Ended" after the end date,
// "Upcoming" before the start. Programs with no dates render as "—".
function programStatus(
  starts: string | null,
  ends: string | null,
  now: number,
): { label: string; className: string } {
  const startTs = starts ? new Date(starts).getTime() : null;
  const endTs = ends ? new Date(ends).getTime() : null;
  if (!startTs && !endTs) {
    return {
      label: "—",
      className: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]",
    };
  }
  if (startTs !== null && now < startTs) {
    return {
      label: "Upcoming",
      className: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]",
    };
  }
  if (endTs !== null && now > endTs) {
    return {
      label: "Ended",
      className: "bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]",
    };
  }
  return {
    label: "Active",
    className: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
  };
}

// ---------- Page ----------------------------------------------------------

export default async function ProgramsPage() {
  const programs = await getProgramsData();
  const now = Date.now();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
          {/* Header — title + subhead on the left, "+ New program"
              button on the right. Same layout pattern as the Rules
              and Reports pages. */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
            <div className="min-w-0">
              <h1
                style={{ fontFamily: "var(--font-newsreader)" }}
                className="font-light text-3xl text-[#0F172A]"
              >
                Programs
              </h1>
              <p className="text-sm text-[#64748B] mt-2 max-w-2xl leading-relaxed">
                Time-bounded communication programs. Each program has
                speakers, a Message House, and a complete draft record.
              </p>
            </div>
            <NewCampaignForm isDemoMode={IS_DEMO_MODE} />
          </div>

          {programs.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-12 text-center">
              <div className="text-[#94A3B8] text-base">
                No programs configured.
              </div>
              <div className="text-[#94A3B8] text-sm mt-2 max-w-md mx-auto leading-relaxed">
                Create a program to coordinate communications across your
                team.
              </div>
              <div className="mt-6">
                {/* Reuses NewCampaignForm — visitor clicks "New program →"
                    in the empty state and the inline form expands. */}
                <NewCampaignForm isDemoMode={IS_DEMO_MODE} />
              </div>
            </div>
          ) : (
            <section>
              {/* Table-style header row — sets visual structure for the
                  five-column row that follows. Hidden under md so the
                  mobile rendering reads as stacked cards instead. */}
              <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-[#64748B] border-b border-[#E2E8F0]">
                <span>Program</span>
                <span>Date range</span>
                <span>Speakers</span>
                <span>Drafts</span>
                <span>Status</span>
              </div>
              {programs.map((p) => {
                const status = programStatus(p.starts_at, p.ends_at, now);
                return (
                  <Link
                    key={p.id}
                    href={`/programs/${encodeURIComponent(p.name)}`}
                    className="block bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4 hover:bg-[#F8F9FB] transition-colors md:grid md:grid-cols-[2fr_2fr_1fr_1fr_1fr] md:gap-4 md:items-center"
                  >
                    {/* Mobile: stacked card. Desktop: 5-column row. */}
                    <div className="text-base font-medium text-[#0F172A] truncate">
                      {p.name}
                    </div>
                    <div className="font-mono text-xs text-[#64748B] mt-0.5 md:mt-0">
                      {fmtRange(p.starts_at, p.ends_at)}
                    </div>
                    <div className="font-mono text-xs text-[#0F172A] mt-2 md:mt-0">
                      <span className="md:hidden font-mono text-[10px] uppercase tracking-widest text-[#64748B] mr-1">
                        Speakers:
                      </span>
                      {p.speakerCount}
                    </div>
                    <div className="font-mono text-xs text-[#0F172A] mt-1 md:mt-0">
                      <span className="md:hidden font-mono text-[10px] uppercase tracking-widest text-[#64748B] mr-1">
                        Drafts:
                      </span>
                      {p.draftCount}
                    </div>
                    <div className="mt-2 md:mt-0">
                      <span
                        className={`inline-flex font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm border ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
