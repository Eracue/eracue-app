import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QueueRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  status: string;
  submitted_at: string;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

async function getQueue() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, users(name, title), campaigns(name)")
    .eq("org_id", DEMO_ORG_ID)
    .in("status", ["blocked", "escalated"])
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as unknown as QueueRow[];
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    blocked: "bg-red-50 text-red-800 border-red-200",
    escalated: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return colors[status] || "bg-neutral-100 text-neutral-700";
}

export default async function ReviewerQueuePage() {
  const queue = await getQueue();

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">← Home</Link>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 mt-2">
            Reviewer queue
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {queue.length} draft{queue.length === 1 ? "" : "s"} waiting on you
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
            <p className="text-neutral-500">No drafts in your queue right now.</p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Speaker</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Channel</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Draft</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Campaign</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-neutral-600"></th>
                </tr>
              </thead>
              <tbody>
                {queue.map((d) => (
                  <tr key={d.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{d.users?.name || "—"}</div>
                      <div className="text-xs text-neutral-500">{d.users?.title || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{d.channel}</td>
                    <td className="px-4 py-3 text-neutral-700 max-w-md truncate">{d.draft_text}</td>
                    <td className="px-4 py-3 text-neutral-600">{d.campaigns?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${statusBadge(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/reviewer/${d.id}`} className="text-sm text-neutral-900 hover:underline">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
