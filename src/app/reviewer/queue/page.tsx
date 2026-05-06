import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";

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
 blocked: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
 escalated: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
 };
 return colors[status] || "bg-[#F0EFE9] text-[#1C1C1A]";
}

export default async function ReviewerQueuePage() {
 const queue = await getQueue();

 return (
 <>
 <SiteHeader />
 <main className="min-h-screen bg-[#F7F6F3]">
 <div className="max-w-5xl mx-auto px-6 py-12">
 <div className="mb-8">
 <Link href="/" className="text-sm text-[#6E6E68] hover:text-[#1C1C1A]">← Home</Link>
 <h1 className="text-3xl font-light tracking-tight text-[#1C1C1A] mt-2">
 Reviewer queue
 </h1>
 <p className="text-sm text-[#6E6E68] mt-1">
 {queue.length} draft{queue.length === 1 ? "" : "s"} waiting on you
 </p>
 <p className="text-sm text-[#6E6E68] mt-3 max-w-2xl">
 Drafts that hit a BLOCK or ESCALATE rule. You can override with a written reason or confirm the system&apos;s decision.
 </p>
 </div>

 {queue.length === 0 ? (
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-12 text-center">
 <p className="text-[#6E6E68]">No drafts in your queue right now.</p>
 </div>
 ) : (
 <div className="bg-white border border-[#E2E1DC] rounded-sm overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-[#F7F6F3] border-b border-[#E2E1DC]">
 <tr>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Speaker</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Channel</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Draft</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Campaign</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Status</th>
 <th className="text-right px-4 py-3 font-medium text-[#6E6E68]"></th>
 </tr>
 </thead>
 <tbody>
 {queue.map((d) => (
 <tr key={d.id} className="border-b border-[#E2E1DC] last:border-0 hover:bg-[#F7F6F3]">
 <td className="px-4 py-3">
 <div className="font-medium text-[#1C1C1A]">{d.users?.name || "—"}</div>
 <div className="text-xs text-[#6E6E68]">{d.users?.title || ""}</div>
 </td>
 <td className="px-4 py-3 text-[#6E6E68]">{d.channel}</td>
 <td className="px-4 py-3 text-[#1C1C1A] max-w-md truncate">{d.draft_text}</td>
 <td className="px-4 py-3 text-[#6E6E68]">{d.campaigns?.name || "—"}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${statusBadge(d.status)}`}>
 {d.status}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <Link href={`/reviewer/${d.id}`} className="text-sm text-[#1C1C1A] hover:underline">
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
 </>
 );
}
