import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getDrafts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, speaker_id, campaign_id, users(name, title), campaigns(name)")
    .eq("org_id", DEMO_ORG_ID)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-neutral-100 text-neutral-700",
    approved: "bg-green-100 text-green-800",
    escalated: "bg-amber-100 text-amber-800",
    blocked: "bg-red-100 text-red-800",
    overridden: "bg-purple-100 text-purple-800",
  };
  return colors[status] || "bg-neutral-100 text-neutral-700";
}

function sourceBadge(source: string) {
  if (source === "human") return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
      {source === "ai_generated" ? "AI generated" : "AI assisted"}
    </span>
  );
}

export default async function DraftsPage() {
  const drafts = await getDrafts();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
              ← Home
            </Link>
            <h1 className="text-3xl font-light tracking-tight text-neutral-900 mt-2">
              Drafts
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {drafts.length} drafts in the demo organization
            </p>
            <p className="text-sm text-neutral-600 mt-3 max-w-2xl">
              Every draft your speakers submit, with the system&apos;s verdict and the principal&apos;s decision. Click a speaker name to see the full audit record.
            </p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Speaker</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Channel</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Draft</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {drafts.map((d: any) => (
                <tr key={d.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/drafts/${d.id}`} className="block group">
                      <div className="font-medium text-neutral-900 group-hover:underline">{d.users?.name || "—"}</div>
                      <div className="text-xs text-neutral-500">{d.users?.title || ""}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{d.channel}</td>
                  <td className="px-4 py-3 text-neutral-700 max-w-md truncate">{d.draft_text}</td>
                  <td className="px-4 py-3 text-neutral-600">{d.campaigns?.name || "—"}</td>
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
