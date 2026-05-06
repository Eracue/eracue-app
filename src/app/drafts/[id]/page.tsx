import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function getDraft(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, speaker_id, campaign_id, users(name, title), campaigns(name)")
    .eq("id", id).eq("org_id", DEMO_ORG_ID).single();
  if (error || !data) return null;
  return data;
}

export default async function DraftDetailPage({ params }: PageProps) {
  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = draft as any;
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/drafts" className="text-sm text-neutral-500 hover:text-neutral-900">← All drafts</Link>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 mt-2">Draft</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Submitted by {d.users?.name || "—"} {d.users?.title ? `(${d.users.title})` : ""}
            {d.campaigns?.name ? ` · Campaign: ${d.campaigns.name}` : ""}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-2 mb-4 text-xs text-neutral-500 uppercase tracking-wide">
            <span>{d.channel}</span><span>·</span>
            <span>{d.source_origin.replace("_", " ")}</span><span>·</span>
            <span>Status: {d.status}</span>
          </div>
          <p className="text-neutral-900 whitespace-pre-wrap leading-relaxed">{d.draft_text}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm text-amber-900">
          Verdict and check details will appear here in the next build block.
        </div>
      </div>
    </main>
  );
}
