import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
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
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type VerdictAction = {
  draft_id: string;
  occurred_at: string;
  payload: { verdict?: string };
};

async function getDrafts() {
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
      .select("id, draft_text, channel, source_origin, status, submitted_at, speaker_id, campaign_id, users(name, title), campaigns(name)")
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

  return {
    drafts: (draftsRes.data || []) as unknown as DraftRow[],
    latestVerdictByDraft,
  };
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
    approved: "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300",
    escalated: "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
    blocked: "bg-red-100 text-red-800 dark:text-red-300",
    overridden: "bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300",
  };
  return colors[status] || "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300";
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) {
    return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
  }
  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    block:    { bg: "bg-red-50 dark:bg-red-950/30",       text: "text-red-900 dark:text-red-300",       border: "border-red-300 dark:border-red-900",       label: "BLOCK" },
    escalate: { bg: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-900 dark:text-amber-300",   border: "border-amber-300 dark:border-amber-900",   label: "ESCALATE" },
    review:   { bg: "bg-blue-50 dark:bg-blue-950/30",     text: "text-blue-900 dark:text-blue-300",     border: "border-blue-300 dark:border-blue-900",     label: "REVIEW" },
    guide:    { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-900 dark:text-purple-300", border: "border-purple-300 dark:border-purple-900", label: "GUIDE" },
    clear:    { bg: "bg-green-50 dark:bg-green-950/30",   text: "text-green-900 dark:text-green-300",   border: "border-green-300 dark:border-green-900",   label: "CLEAR" },
  };
  const s = styles[verdict] || styles.clear;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function sourceBadge(source: string) {
  if (source === "human") return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
      {source === "ai_generated" ? "AI generated" : "AI assisted"}
    </span>
  );
}

export default async function DraftsPage() {
  const { drafts, latestVerdictByDraft } = await getDrafts();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
              ← Home
            </Link>
            <h1 className="text-3xl font-light tracking-tight text-neutral-900 dark:text-neutral-100 mt-2">
              Drafts
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {drafts.length} drafts in the demo organization
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3 max-w-2xl">
              Every draft your speakers submit, with the system&apos;s verdict and the principal&apos;s decision. Click a speaker name to see the full audit record.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Speaker</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Channel</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Draft</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Verdict</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Source</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <td className="px-4 py-3">
                    <Link href={`/drafts/${d.id}`} className="block group">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:underline">{d.users?.name || "—"}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{d.users?.title || ""}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{d.channel}</td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 max-w-md truncate">{d.draft_text}</td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{d.campaigns?.name || "—"}</td>
                  <td className="px-4 py-3"><VerdictBadge verdict={latestVerdictByDraft.get(d.id) ?? null} /></td>
                  <td className="px-4 py-3">{sourceBadge(d.source_origin)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusBadge(d.status)}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
    </>
  );
}
