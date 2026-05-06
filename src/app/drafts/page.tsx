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
 pending: "bg-[#F0EFE9] text-[#1C1C1A]",
 approved: "bg-[#F0FDF4] text-[#166534]",
 escalated: "bg-[#FFF7ED] text-[#C2410C]",
 blocked: "bg-[#FEF2F2] text-[#B91C1C]",
 overridden: "bg-[#EEF2FF] text-[#3730A3]",
 };
 return colors[status] || "bg-[#F0EFE9] text-[#1C1C1A]";
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
 if (!verdict) {
 return <span className="text-xs text-[#6E6E68]">—</span>;
 }
 const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
 block: { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
 escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
 review: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
 guide: { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
 clear: { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
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
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
 {source === "ai_generated" ? "AI generated" : "AI assisted"}
 </span>
 );
}

export default async function DraftsPage() {
 const { drafts, latestVerdictByDraft } = await getDrafts();

 return (
 <>
 <SiteHeader />
 <main className="min-h-screen bg-[#F7F6F3]">
 <div className="max-w-5xl mx-auto px-6 py-12">
 <div className="flex items-center justify-between mb-8">
 <div>
 <Link href="/" className="text-sm text-[#6E6E68] hover:text-[#1C1C1A]">
 ← Home
 </Link>
 <h1 className="text-3xl font-light tracking-tight text-[#1C1C1A] mt-2">
 Drafts
 </h1>
 <p className="text-sm text-[#6E6E68] mt-1">
 {drafts.length} drafts in the demo organization
 </p>
 <p className="text-sm text-[#6E6E68] mt-3 max-w-2xl">
 Every draft your speakers submit, with the system&apos;s verdict and the principal&apos;s decision. Click a speaker name to see the full audit record.
 </p>
 </div>
 </div>

 <div className="bg-white border border-[#E2E1DC] rounded-sm overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-[#F7F6F3] border-b border-[#E2E1DC]">
 <tr>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Speaker</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Channel</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Draft</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Campaign</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Verdict</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Source</th>
 <th className="text-left px-4 py-3 font-medium text-[#6E6E68]">Status</th>
 </tr>
 </thead>
 <tbody>
 {drafts.map((d) => (
 <tr key={d.id} className="border-b border-[#E2E1DC] last:border-0 hover:bg-[#F7F6F3]">
 <td className="px-4 py-3">
 <Link href={`/drafts/${d.id}`} className="block group">
 <div className="font-medium text-[#1C1C1A] group-hover:underline">{d.users?.name || "—"}</div>
 <div className="text-xs text-[#6E6E68]">{d.users?.title || ""}</div>
 </Link>
 </td>
 <td className="px-4 py-3 text-[#6E6E68]">{d.channel}</td>
 <td className="px-4 py-3 text-[#1C1C1A] max-w-md truncate">{d.draft_text}</td>
 <td className="px-4 py-3 text-[#6E6E68]">{d.campaigns?.name || "—"}</td>
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
