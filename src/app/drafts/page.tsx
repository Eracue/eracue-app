import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { SiteHeader } from "@/app/site-header";
import { DraftsClient, type DraftRecord } from "./drafts-client";

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
  communication_category: "retail" | "institutional" | "correspondence" | null;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type VerdictAction = {
  draft_id: string;
  occurred_at: string;
  payload: { verdict?: string };
};

async function getDrafts(): Promise<{
  drafts: DraftRecord[];
  principalApprovedIds: string[];
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Three parallel queries: drafts, verdict_issued actions (to resolve the
  // most recent verdict per draft), and reviewer_decided actions (to mark
  // which drafts have a recorded principal decision — the archive renders
  // 'Principal approved' vs 'System cleared' off this signal).
  const [draftsRes, verdictsRes, decisionsRes] = await Promise.all([
    sb
      .from("drafts")
      .select(
        "id, draft_text, channel, source_origin, status, submitted_at, speaker_id, campaign_id, communication_category, users(name, title), campaigns(name)",
      )
      .eq("org_id", DEMO_ORG_ID)
      .order("submitted_at", { ascending: false }),
    sb
      .from("actions")
      .select("draft_id, occurred_at, payload")
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "verdict_issued")
      .order("occurred_at", { ascending: true }),
    sb
      .from("actions")
      .select("draft_id")
      .eq("org_id", DEMO_ORG_ID)
      .eq("action_type", "reviewer_decided"),
  ]);

  if (draftsRes.error) throw new Error(draftsRes.error.message);
  if (verdictsRes.error) throw new Error(verdictsRes.error.message);
  if (decisionsRes.error) throw new Error(decisionsRes.error.message);

  // Most-recent verdict per draft (later inserts overwrite earlier ones in the map).
  const latestVerdictByDraft = new Map<string, string>();
  for (const v of (verdictsRes.data || []) as VerdictAction[]) {
    const verdict = v.payload?.verdict;
    if (verdict) latestVerdictByDraft.set(v.draft_id, verdict);
  }

  // Distinct draft_ids carrying at least one reviewer_decided action.
  // Set conversion happens client-side so the prop stays serialisable
  // across the RSC boundary.
  const principalApprovedIds = Array.from(
    new Set(
      ((decisionsRes.data as { draft_id: string }[] | null) || [])
        .map((d) => d.draft_id)
        .filter(Boolean),
    ),
  );

  // Merge verdict onto each row so the client component holds a single
  // self-contained array — simpler to filter than a (rows + map) pair.
  const rows = (draftsRes.data || []) as unknown as DraftRow[];
  const drafts = rows.map((d) => ({
    ...d,
    verdict: latestVerdictByDraft.get(d.id) ?? null,
  }));

  return { drafts, principalApprovedIds };
}

export default async function DraftsPage() {
  const { drafts, principalApprovedIds } = await getDrafts();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          {/* Header is rendered inside DraftsClient so it can adapt to the
              active filter state (campaign / speaker views get bespoke
              titles instead of the default 'Communications' archive). */}
          <DraftsClient drafts={drafts} principalApprovedIds={principalApprovedIds} />
        </div>
      </main>
    </>
  );
}
