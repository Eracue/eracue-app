import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Channel raw value → display label. Mirrors the helper in dashboard/page.tsx;
// the duplication is small enough to leave in place rather than route through a
// shared module. Falls back to the raw value for unknown channels.
function formatChannel(ch: string): string {
  const map: Record<string, string> = {
    linkedin:      "LinkedIn",
    twitter:       "X / Twitter",
    press_release: "Press Release",
    blog:          "Blog",
    email:         "Email",
    interview:     "Interview",
    other:         "Other",
  };
  return map[ch] ?? ch;
}

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

  return {
    drafts: (draftsRes.data || []) as unknown as DraftRow[],
    latestVerdictByDraft,
  };
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-[#F1F5F9] text-[#0F172A]",
    approved: "bg-[#F0FDF4] text-[#166534]",
    escalated: "bg-[#FFF7ED] text-[#C2410C]",
    blocked: "bg-[#FEF2F2] text-[#B91C1C]",
    overridden: "bg-[#EFF8FF] text-[#1447C0]",
  };
  return colors[status] || "bg-[#F1F5F9] text-[#0F172A]";
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) {
    return <span className="text-xs text-[#64748B]">—</span>;
  }
  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    block:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
    escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
    review:   { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
    guide:    { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
    clear:    { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
  };
  const s = styles[verdict] || styles.clear;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

// Category column — communication_category is the populated column;
// source_origin (the previous "Source" column) is mostly empty so we drop it.
// Null categories render as a muted em-dash so the row stays calm.
function CategoryBadge({ category }: { category: string | null }) {
  if (category === "retail") {
    return (
      <span className="font-mono text-[10px] bg-[#EFF8FF] text-[#1447C0] border border-[#BAE6FD] px-1.5 py-0.5 rounded-sm">
        Retail
      </span>
    );
  }
  if (category === "institutional") {
    return (
      <span className="font-mono text-[10px] bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] px-1.5 py-0.5 rounded-sm">
        Institutional
      </span>
    );
  }
  if (category === "correspondence") {
    return (
      <span className="font-mono text-[10px] bg-[#F8F9FB] text-[#475569] border border-[#E2E8F0] px-1.5 py-0.5 rounded-sm">
        Correspondence
      </span>
    );
  }
  return <span className="text-xs text-[#94A3B8]">—</span>;
}

export default async function DraftsPage() {
  const { drafts, latestVerdictByDraft } = await getDrafts();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-8">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              GOVERNANCE LOG
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-2"
            >
              Governance log
            </h1>
            <p className="text-sm text-[#64748B] mt-2 max-w-2xl leading-relaxed">
              Every communication submitted through ERA CUE — with the system
              verdict and principal decision on record.
            </p>
            <p className="font-mono text-xs text-[#94A3B8] mt-2">
              {drafts.length} drafts in the demo organization
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FB] border-b border-[#E2E8F0]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Speaker</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Channel</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Draft</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Campaign</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Verdict</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">Status</th>
                  <th className="px-4 py-3" aria-label="Examiner record link" />
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8F9FB]"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/drafts/${d.id}`} className="block group">
                        <div className="font-medium text-[#0F172A] group-hover:underline">
                          {d.users?.name || "—"}
                        </div>
                        <div className="text-xs text-[#64748B]">{d.users?.title || ""}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{formatChannel(d.channel)}</td>
                    <td className="px-4 py-3 text-[#0F172A] max-w-md truncate">{d.draft_text}</td>
                    <td className="px-4 py-3 text-[#64748B]">{d.campaigns?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={latestVerdictByDraft.get(d.id) ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={d.communication_category} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusBadge(d.status)}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/drafts/${d.id}/examiner`}
                        className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors whitespace-nowrap"
                      >
                        Record →
                      </Link>
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
