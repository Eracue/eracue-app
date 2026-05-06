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
  communication_category: "retail" | "institutional" | "correspondence" | null;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

async function getQueue() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, status, submitted_at, communication_category, users(name, title), campaigns(name)")
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
  return colors[status] || "bg-[#F0EFE9] text-[#1C1C1A] border-[#E2E1DC]";
}

function categoryBadge(category: string | null) {
  const cat = category ?? "retail";
  if (cat === "retail")
    return (
      <span className="font-mono text-[10px] bg-[#EEF2FF] text-[#3730A3] border border-[#C7D2FE] px-1.5 py-0.5 rounded-sm">
        Retail
      </span>
    );
  if (cat === "institutional")
    return (
      <span className="font-mono text-[10px] bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] px-1.5 py-0.5 rounded-sm">
        Institutional
      </span>
    );
  return (
    <span className="font-mono text-[10px] bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB] px-1.5 py-0.5 rounded-sm">
      Correspondence
    </span>
  );
}

export default async function ReviewerQueuePage() {
  const queue = await getQueue();

  // Group queue by speaker name; sort groups by draft count descending.
  const groupMap = new Map<string, { name: string; title: string; drafts: QueueRow[] }>();
  for (const d of queue) {
    const name = d.users?.name || "Unknown";
    if (!groupMap.has(name)) {
      groupMap.set(name, { name, title: d.users?.title || "", drafts: [] });
    }
    groupMap.get(name)!.drafts.push(d);
  }
  const groups = Array.from(groupMap.values()).sort(
    (a, b) => b.drafts.length - a.drafts.length
  );

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F7F6F3]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-8">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              REVIEWER QUEUE
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-2xl text-[#1C1C1A] mt-2"
            >
              {queue.length} draft{queue.length === 1 ? "" : "s"} awaiting principal review
            </h1>
            <p className="text-sm text-[#6E6E68] mt-1 max-w-xl">
              Every speaker&apos;s blocked and escalated drafts — grouped for review.
              Override with a documented reason or confirm the system&apos;s decision.
            </p>
          </div>

          {queue.length === 0 ? (
            <div className="bg-white border border-[#E2E1DC] rounded-sm p-12 text-center">
              <p className="text-[#6E6E68]">No drafts in your queue right now.</p>
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.name}>
                  {/* Group header */}
                  <div className="bg-[#F7F6F3] border border-[#E2E1DC] rounded-sm px-4 py-3 mb-1 flex justify-between items-center">
                    <div className="flex items-baseline">
                      <span className="text-sm font-medium text-[#1C1C1A]">{group.name}</span>
                      {group.title && (
                        <span className="font-mono text-xs text-[#6E6E68] ml-2">{group.title}</span>
                      )}
                    </div>
                    <span className="bg-white border border-[#E2E1DC] rounded-sm font-mono text-xs text-[#6E6E68] px-2 py-0.5">
                      {group.drafts.length} draft{group.drafts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {/* Draft rows for this speaker */}
                  {group.drafts.map((d, idx) => {
                    const isLast = idx === group.drafts.length - 1;
                    return (
                      <div
                        key={d.id}
                        className={`bg-white border border-[#E2E1DC] border-t-0 px-4 py-3 flex items-center justify-between gap-4 ${
                          isLast ? "rounded-b-sm mb-4" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#1C1C1A] max-w-md truncate">
                            {d.draft_text}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs bg-[#F7F6F3] text-[#6E6E68] border border-[#E2E1DC] px-2 py-0.5 rounded-sm">
                            {d.channel}
                          </span>
                          {d.campaigns?.name && (
                            <span className="font-mono text-xs bg-[#F7F6F3] text-[#6E6E68] border border-[#E2E1DC] px-2 py-0.5 rounded-sm">
                              {d.campaigns.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {categoryBadge(d.communication_category)}
                          <span className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium border ${statusBadge(d.status)}`}>
                            {d.status}
                          </span>
                          <Link
                            href={`/reviewer/${d.id}`}
                            className="font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] transition-colors"
                          >
                            Review →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
