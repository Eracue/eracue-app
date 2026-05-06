import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { DashboardTabs } from "./dashboard-tabs";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  status: string;
  submitted_at: string;
  speaker_id: string;
  campaign_id: string | null;
  users: { id: string; name: string; title: string | null; role: string } | null;
  campaigns: { id: string; name: string; description: string | null } | null;
};

type SpeakerSummary = {
  id: string;
  name: string;
  title: string | null;
  totalDrafts: number;
  blocked: number;
  escalated: number;
  approved: number;
  overridden: number;
  pending: number;
};

type CampaignSummary = {
  id: string;
  name: string;
  description: string | null;
  totalDrafts: number;
  blocked: number;
  escalated: number;
  speakers: {
    id: string;
    name: string;
    title: string | null;
    drafts: { id: string; draft_text: string; status: string; channel: string }[];
  }[];
};

async function getDashboardData(): Promise<{
  speakers: SpeakerSummary[];
  campaigns: CampaignSummary[];
  totals: { drafts: number; blocked: number; escalated: number; overridden: number };
}> {
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, speaker_id, campaign_id, users(id, name, title, role), campaigns(id, name, description)")
    .eq("org_id", DEMO_ORG_ID)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);

  const drafts = (data || []) as unknown as DraftRow[];

  // Aggregate by speaker
  const speakerMap = new Map<string, SpeakerSummary>();
  for (const d of drafts) {
    if (!d.users) continue;
    const sid = d.users.id;
    if (!speakerMap.has(sid)) {
      speakerMap.set(sid, {
        id: sid,
        name: d.users.name,
        title: d.users.title,
        totalDrafts: 0,
        blocked: 0,
        escalated: 0,
        approved: 0,
        overridden: 0,
        pending: 0,
      });
    }
    const s = speakerMap.get(sid)!;
    s.totalDrafts++;
    if (d.status === "blocked") s.blocked++;
    else if (d.status === "escalated") s.escalated++;
    else if (d.status === "approved") s.approved++;
    else if (d.status === "overridden") s.overridden++;
    else if (d.status === "pending") s.pending++;
  }

  // Aggregate by campaign
  const campaignMap = new Map<string, CampaignSummary>();
  for (const d of drafts) {
    if (!d.campaigns) continue;
    const cid = d.campaigns.id;
    if (!campaignMap.has(cid)) {
      campaignMap.set(cid, {
        id: cid,
        name: d.campaigns.name,
        description: d.campaigns.description,
        totalDrafts: 0,
        blocked: 0,
        escalated: 0,
        speakers: [],
      });
    }
    const c = campaignMap.get(cid)!;
    c.totalDrafts++;
    if (d.status === "blocked") c.blocked++;
    if (d.status === "escalated") c.escalated++;

    if (d.users) {
      let sp = c.speakers.find((sp) => sp.id === d.users!.id);
      if (!sp) {
        sp = { id: d.users.id, name: d.users.name, title: d.users.title, drafts: [] };
        c.speakers.push(sp);
      }
      sp.drafts.push({ id: d.id, draft_text: d.draft_text, status: d.status, channel: d.channel });
    }
  }

  // Sort: speakers by totalDrafts desc, campaigns by name
  const speakers = Array.from(speakerMap.values()).sort((a, b) => b.totalDrafts - a.totalDrafts);
  const campaigns = Array.from(campaignMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Totals
  const totals = drafts.reduce(
    (acc, d) => {
      acc.drafts++;
      if (d.status === "blocked") acc.blocked++;
      if (d.status === "escalated") acc.escalated++;
      if (d.status === "overridden") acc.overridden++;
      return acc;
    },
    { drafts: 0, blocked: 0, escalated: 0, overridden: 0 }
  );

  return { speakers, campaigns, totals };
}

export default async function DashboardPage() {
  const { speakers, campaigns, totals } = await getDashboardData();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">← Home</Link>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-neutral-100 mt-2">
            Principal dashboard
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Sarah Chen · General Counsel
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3 max-w-2xl">
            Every speaker&apos;s drafts, coordinated by campaign. Spot conflicting narratives across speakers before any of them ship.
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total drafts</div>
            <div className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mt-1">{totals.drafts}</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Blocked</div>
            <div className="text-3xl font-light text-red-700 dark:text-red-400 mt-1">{totals.blocked}</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Escalated</div>
            <div className="text-3xl font-light text-amber-700 dark:text-amber-400 mt-1">{totals.escalated}</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Overridden</div>
            <div className="text-3xl font-light text-purple-700 dark:text-purple-400 mt-1">{totals.overridden}</div>
          </div>
        </div>

        <DashboardTabs speakers={speakers} campaigns={campaigns} />
      </div>
    </main>
    </>
  );
}
