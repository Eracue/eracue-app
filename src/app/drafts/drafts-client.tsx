"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Shape we receive from the server component. The server merges the
// most-recent verdict for each draft into a single `verdict` field so
// the client only has to hold one array.
export type DraftRecord = {
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
  verdict: string | null;
};

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
  const s = styles[verdict.toLowerCase()] || styles.clear;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

const SELECT_CLASSES =
  "border border-[#E2E8F0] rounded-sm px-3 py-1.5 text-xs font-mono text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB]";

export function DraftsClient({ drafts }: { drafts: DraftRecord[] }) {
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [speakerFilter, setSpeakerFilter] = useState<string>("all");

  // Speaker dropdown is built from whatever speakers are actually present
  // in the dataset — keeps the menu honest if a name was added/removed.
  const speakers = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      const n = d.users?.name?.trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort();
  }, [drafts]);

  // Verdict options come from the spec as uppercase (BLOCK/ESCALATE/CLEAR/REVIEW)
  // but the column is stored lowercase, so compare case-insensitively.
  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      if (verdictFilter !== "all" && (d.verdict ?? "").toLowerCase() !== verdictFilter.toLowerCase()) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (speakerFilter !== "all" && d.users?.name !== speakerFilter) return false;
      return true;
    });
  }, [drafts, verdictFilter, statusFilter, speakerFilter]);

  const anyActive =
    verdictFilter !== "all" || statusFilter !== "all" || speakerFilter !== "all";

  const clearFilters = () => {
    setVerdictFilter("all");
    setStatusFilter("all");
    setSpeakerFilter("all");
  };

  return (
    <>
      {/* Filter bar */}
      <div className="flex gap-3 items-center mb-6 flex-wrap">
        <span className="font-mono text-xs text-[#64748B] uppercase tracking-widest shrink-0">
          Filter:
        </span>
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className={SELECT_CLASSES}
          aria-label="Filter by verdict"
        >
          <option value="all">All verdicts</option>
          <option value="BLOCK">BLOCK</option>
          <option value="ESCALATE">ESCALATE</option>
          <option value="CLEAR">CLEAR</option>
          <option value="REVIEW">REVIEW</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={SELECT_CLASSES}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="blocked">Blocked</option>
          <option value="escalated">Escalated</option>
          <option value="approved">Approved</option>
          <option value="overridden">Overridden</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={speakerFilter}
          onChange={(e) => setSpeakerFilter(e.target.value)}
          className={SELECT_CLASSES}
          aria-label="Filter by speaker"
        >
          <option value="all">All speakers</option>
          {speakers.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {anyActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0]"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto font-mono text-xs text-[#64748B]">
          {filtered.length} of {drafts.length} communications
        </span>
      </div>

      {/* Supervision export — placeholder route; lives below the filter bar
          so it sits beside the table action area without competing with the
          filters themselves. */}
      <div className="flex justify-end mb-4">
        <Link
          href="/supervision-report"
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          Export supervision report →
        </Link>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-[#F8F9FB] border-b border-[#E2E8F0]">
            <tr>
              <th className="w-40 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Speaker</th>
              <th className="w-28 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Channel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Draft</th>
              <th className="w-24 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Verdict</th>
              <th className="w-28 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Status</th>
              <th className="w-36 px-4 py-3" aria-label="Examiner record link" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr
                key={d.id}
                className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8F9FB]"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/drafts/${d.id}`} className="block group">
                    <div className="text-sm font-semibold text-[#0F172A] group-hover:underline truncate">
                      {d.users?.name || "—"}
                    </div>
                    <div className="text-xs text-[#64748B] truncate">{d.users?.title || ""}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#374151] truncate whitespace-nowrap">{formatChannel(d.channel)}</td>
                <td className="px-4 py-3">
                  <div
                    className="text-sm text-[#374151] overflow-hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {d.draft_text}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <VerdictBadge verdict={d.verdict} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${statusBadge(d.status)}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/drafts/${d.id}/examiner`}
                    className="inline-flex items-center gap-1 font-mono text-xs font-medium text-[#1A56DB] hover:text-[#1447C0] bg-[#EFF8FF] border border-[#BAE6FD] px-2 py-1 rounded-sm transition-colors whitespace-nowrap"
                  >
                    Examiner record →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748B]">
                  No communications match the current filters.{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] ml-1"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
