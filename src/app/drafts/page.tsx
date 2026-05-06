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

async function getDrafts(): Promise<DraftRecord[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch drafts and all verdict_issued actions in parallel; resolve the latest
  // verdict per draft client-side. Two queries are cheaper than one row-per-draft join.
  const [draftsRes, verdictsRes] = await Promise.all([
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
  ]);

  if (draftsRes.error) throw new Error(draftsRes.error.message);
  if (verdictsRes.error) throw new Error(verdictsRes.error.message);

  // Most-recent verdict per draft (later inserts overwrite earlier ones in the map).
  const latestVerdictByDraft = new Map<string, string>();
  for (const v of (verdictsRes.data || []) as VerdictAction[]) {
    const verdict = v.payload?.verdict;
    if (verdict) latestVerdictByDraft.set(v.draft_id, verdict);
  }

  // Merge verdict onto each row so the client component holds a single
  // self-contained array — simpler to filter than a (rows + map) pair.
  const rows = (draftsRes.data || []) as unknown as DraftRow[];
  return rows.map((d) => ({
    ...d,
    verdict: latestVerdictByDraft.get(d.id) ?? null,
  }));
}

export default async function DraftsPage() {
  const drafts = await getDrafts();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-8">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SUPERVISION RECORD · SARAH CHEN, GC
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-2"
            >
              Communications
            </h1>
            <p className="text-sm text-[#374151] mt-2 max-w-2xl leading-relaxed">
              The complete supervision record — every submission, every verdict, every principal decision on file.
            </p>
            <p className="font-mono text-xs text-[#94A3B8] mt-2">
              {drafts.length} drafts in the demo organization
            </p>
          </div>

          <DraftsClient drafts={drafts} />
        </div>
      </main>
    </>
  );
}
