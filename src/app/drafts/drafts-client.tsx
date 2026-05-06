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

// Status badge logic:
//   overridden → its own blue 'Overridden' pill regardless of who acted.
//     Avoids the BLOCK / PRINCIPAL APPROVED contradiction where the same
//     row reads as both blocked-by-system and approved-by-principal.
//   approved   → green 'Principal approved' when a reviewer_decided
//                action exists, slate 'System cleared' otherwise.
//   pending / escalated / blocked → status-coloured pill.
function statusBadge(
  status: string,
  draftId: string,
  principalApprovedIds: Set<string>,
) {
  if (status === "overridden") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded-sm border bg-[#EFF8FF] text-[#1A56DB] border-[#BAE6FD]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB]" aria-hidden />
        Overridden
      </span>
    );
  }
  if (status === "approved") {
    if (principalApprovedIds.has(draftId)) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded-sm border bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" aria-hidden />
          Principal approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded-sm border bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" aria-hidden />
        System cleared
      </span>
    );
  }
  const colors: Record<string, string> = {
    pending:   "bg-[#F1F5F9] text-[#0F172A]",
    escalated: "bg-[#FFF7ED] text-[#C2410C]",
    blocked:   "bg-[#FEF2F2] text-[#B91C1C]",
  };
  const cls = colors[status] || "bg-[#F1F5F9] text-[#0F172A]";
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

// Plain-English label for the per-row "see the record" link. Tailors to
// what the reader is actually clicking into — overridden drafts open an
// override record, blocked/escalated drafts open the review-in-progress
// view, pending drafts read as 'Pending review', etc.
function recordLinkLabel(status: string): string {
  if (status === "overridden") return "Override record →";
  if (status === "approved") return "Approval record →";
  if (status === "blocked" || status === "escalated") return "Review record →";
  if (status === "pending") return "Pending review →";
  return "Governance record →";
}

// Plain-English subtext that sits under the status badge so the row
// reads as a sentence, not a state-machine token. Whether a principal
// has acted on the draft changes the description for some statuses.
function statusDescription(
  status: string,
  hasPrincipalDecision: boolean,
): string {
  switch (status) {
    case "blocked":
      return hasPrincipalDecision
        ? "Reviewed by principal"
        : "Stopped — awaiting review";
    case "escalated":
      return hasPrincipalDecision
        ? "Escalated — decision recorded"
        : "Escalated — awaiting review";
    case "approved":
      return hasPrincipalDecision
        ? "Reviewed and approved"
        : "Passed all checks";
    case "overridden":
      return "Approved despite flag";
    case "pending":
      return "Awaiting principal review";
    default:
      return "";
  }
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

export function DraftsClient({
  drafts,
  principalApprovedIds,
}: {
  drafts: DraftRecord[];
  // Distinct draft_ids that carry a reviewer_decided action. Arrives as
  // an array to stay serialisable across the RSC boundary; we re-hydrate
  // it into a Set on mount.
  principalApprovedIds: string[];
}) {
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [speakerFilter, setSpeakerFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  const principalApprovedSet = useMemo(
    () => new Set(principalApprovedIds),
    [principalApprovedIds],
  );

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

  // Campaign list — same shape as speakers, derived from whichever
  // campaigns the dataset references via the joined campaigns row.
  const campaigns = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      const n = d.campaigns?.name?.trim();
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
      if (campaignFilter !== "all" && d.campaigns?.name !== campaignFilter) return false;
      return true;
    });
  }, [drafts, verdictFilter, statusFilter, speakerFilter, campaignFilter]);

  // Collapse identical (speaker × draft text) submissions to a single row;
  // keep the most recent and carry a duplicate_count so the cell can show
  // "×N submissions". Avoids a wall of identical rows on heavy demo days.
  const deduplicated = useMemo(() => {
    type DedupedRow = DraftRecord & { duplicate_count: number };
    const seen = new Map<string, DedupedRow>();
    for (const d of filtered) {
      const key = `${d.users?.name ?? ""}::${d.draft_text?.trim() ?? ""}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { ...d, duplicate_count: 1 });
        continue;
      }
      const newCount = existing.duplicate_count + 1;
      if (d.submitted_at > existing.submitted_at) {
        seen.set(key, { ...d, duplicate_count: newCount });
      } else {
        existing.duplicate_count = newCount;
      }
    }
    return Array.from(seen.values());
  }, [filtered]);

  const anyActive =
    verdictFilter !== "all" ||
    statusFilter !== "all" ||
    speakerFilter !== "all" ||
    campaignFilter !== "all";

  const clearFilters = () => {
    setVerdictFilter("all");
    setStatusFilter("all");
    setSpeakerFilter("all");
    setCampaignFilter("all");
  };

  // Adaptive header — eyebrow / title / subtitle change to read as the
  // CAMPAIGN RECORD or SPEAKER RECORD when those filters are active. If
  // both are active campaign wins the framing. Default eyebrow reads
  // 'COMMUNICATIONS · ERA CUE' so the page doesn't open on the
  // regulatory-only 'SUPERVISION ARCHIVE' framing.
  let headerEyebrow = "COMMUNICATIONS · ERA CUE";
  let headerTitle = "Communications";
  let headerSubtitle =
    "The complete pre-publication governance record. Every draft checked, every decision recorded, every approval on file — FINRA-defensible and campaign-ready.";
  if (campaignFilter !== "all") {
    headerEyebrow = "CAMPAIGN RECORD";
    headerTitle = campaignFilter;
    headerSubtitle =
      "All communications submitted under this campaign — with verdicts, approvals, and examiner records.";
  } else if (speakerFilter !== "all") {
    headerEyebrow = "SPEAKER RECORD";
    headerTitle = speakerFilter;
    headerSubtitle =
      "Complete communication history for this speaker — every submission, verdict, and principal decision on file.";
  }

  return (
    <>
      {/* Adaptive page header — re-keyed off filter state so the top of the
          page reads as the bespoke campaign or speaker record when one of
          those filters is selected. */}
      <div className="mb-8">
        <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
          {headerEyebrow}
        </div>
        <h1
          style={{ fontFamily: "var(--font-newsreader)" }}
          className="font-light text-3xl text-[#0F172A] mt-2"
        >
          {headerTitle}
        </h1>
        <p className="text-sm text-[#374151] mt-2 max-w-2xl leading-relaxed">
          {headerSubtitle}
        </p>
      </div>

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
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className={SELECT_CLASSES}
          aria-label="Filter by campaign"
        >
          <option value="all">All campaigns</option>
          {campaigns.map((name) => (
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
          {deduplicated.length} of {drafts.length} communications
          {filtered.length !== deduplicated.length && (
            <span className="font-mono text-[10px] text-[#94A3B8] ml-2">
              ({filtered.length - deduplicated.length} duplicate submissions collapsed)
            </span>
          )}
        </span>
      </div>

      {/* Active filter chips — visible when any filter is non-default.
          Each chip carries a small × that resets just that one filter so
          the user can peel them back without going through Clear filters. */}
      {anyActive && (
        <div className="flex items-center gap-2 -mt-3 mb-6 flex-wrap">
          <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-widest">
            Active filters:
          </span>
          {verdictFilter !== "all" && (
            <span className="inline-flex items-center gap-1 bg-[#EFF8FF] border border-[#BAE6FD] text-[#1447C0] font-mono text-[10px] px-2 py-0.5 rounded-sm">
              Verdict: {verdictFilter}
              <button
                type="button"
                onClick={() => setVerdictFilter("all")}
                className="ml-1 hover:text-[#0F172A]"
                aria-label="Clear verdict filter"
              >
                ×
              </button>
            </span>
          )}
          {statusFilter !== "all" && (
            <span className="inline-flex items-center gap-1 bg-[#EFF8FF] border border-[#BAE6FD] text-[#1447C0] font-mono text-[10px] px-2 py-0.5 rounded-sm">
              Status: {statusFilter}
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="ml-1 hover:text-[#0F172A]"
                aria-label="Clear status filter"
              >
                ×
              </button>
            </span>
          )}
          {speakerFilter !== "all" && (
            <span className="inline-flex items-center gap-1 bg-[#EFF8FF] border border-[#BAE6FD] text-[#1447C0] font-mono text-[10px] px-2 py-0.5 rounded-sm">
              Speaker: {speakerFilter}
              <button
                type="button"
                onClick={() => setSpeakerFilter("all")}
                className="ml-1 hover:text-[#0F172A]"
                aria-label="Clear speaker filter"
              >
                ×
              </button>
            </span>
          )}
          {campaignFilter !== "all" && (
            <span className="inline-flex items-center gap-1 bg-[#EFF8FF] border border-[#BAE6FD] text-[#1447C0] font-mono text-[10px] px-2 py-0.5 rounded-sm">
              Campaign: {campaignFilter}
              <button
                type="button"
                onClick={() => setCampaignFilter("all")}
                className="ml-1 hover:text-[#0F172A]"
                aria-label="Clear campaign filter"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

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

      {/* Desktop table — hidden on mobile in favour of the card list
          below. overflow-x-auto + min-w-[860px] still apply at sm and
          above so the table scrolls horizontally if the viewport is
          narrower than the column-natural width. */}
      <div className="hidden sm:block bg-white border border-[#E2E8F0] rounded-sm overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[#F8F9FB] border-b border-[#E2E8F0]">
            <tr>
              <th className="w-40 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Speaker</th>
              <th className="w-24 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Date</th>
              <th className="w-28 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Channel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Draft</th>
              <th className="w-24 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Verdict</th>
              <th className="w-28 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Status</th>
              <th className="w-44 px-4 py-3" aria-label="Examiner record link" />
            </tr>
          </thead>
          <tbody>
            {deduplicated.map((d) => (
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
                <td className="w-24 px-4 py-3 font-mono text-xs text-[#94A3B8] whitespace-nowrap">
                  {new Date(d.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-[#374151] truncate whitespace-nowrap">{formatChannel(d.channel)}</td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="flex items-start gap-2">
                    <div className="text-sm text-[#374151] line-clamp-2 leading-snug min-w-0">
                      {d.draft_text}
                    </div>
                    {d.duplicate_count > 1 && (
                      <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-sm border border-[#E2E8F0] shrink-0 whitespace-nowrap">
                        ×{d.duplicate_count} submissions
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <VerdictBadge verdict={d.verdict} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {statusBadge(d.status, d.id, principalApprovedSet)}
                  {statusDescription(d.status, principalApprovedSet.has(d.id)) && (
                    <div className="font-mono text-[10px] text-[#94A3B8] mt-1 whitespace-nowrap">
                      {statusDescription(d.status, principalApprovedSet.has(d.id))}
                    </div>
                  )}
                </td>
                <td className="w-44 px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/drafts/${d.id}/examiner`}
                    className="inline-flex items-center gap-1 font-mono text-xs font-medium text-[#1A56DB] hover:text-[#1447C0] bg-[#EFF8FF] border border-[#BAE6FD] px-2 py-1 rounded-sm transition-colors whitespace-nowrap"
                  >
                    {recordLinkLabel(d.status)}
                  </Link>
                </td>
              </tr>
            ))}
            {deduplicated.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#64748B]">
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

      {/* Mobile card list — visible below sm. Same data as the table,
          stacked into compact cards with thumb-friendly tap targets. */}
      <div className="sm:hidden space-y-2">
        {deduplicated.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center text-sm text-[#64748B]">
            No communications match the current filters.{" "}
            <button
              type="button"
              onClick={clearFilters}
              className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] ml-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          deduplicated.map((d) => (
            <div key={d.id} className="bg-white border border-[#E2E8F0] rounded-sm p-4">
              {/* Speaker + date header */}
              <div className="flex items-start justify-between mb-2 gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#0F172A] truncate">
                    {d.users?.name || "—"}
                  </div>
                  <div className="font-mono text-xs text-[#64748B] truncate">
                    {d.users?.title ? `${d.users.title} · ` : ""}
                    {new Date(d.submitted_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <div className="shrink-0">
                  <VerdictBadge verdict={d.verdict} />
                </div>
              </div>

              {/* Draft text */}
              <div className="text-sm text-[#374151] line-clamp-2 leading-snug mb-3">
                {d.draft_text}
                {d.duplicate_count > 1 && (
                  <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-sm border border-[#E2E8F0] ml-2">
                    ×{d.duplicate_count}
                  </span>
                )}
              </div>

              {/* Status badge + description + record link */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  {statusBadge(d.status, d.id, principalApprovedSet)}
                  {statusDescription(d.status, principalApprovedSet.has(d.id)) && (
                    <div className="font-mono text-[10px] text-[#94A3B8]">
                      {statusDescription(d.status, principalApprovedSet.has(d.id))}
                    </div>
                  )}
                </div>
                <Link
                  href={`/drafts/${d.id}/examiner`}
                  className="font-mono text-xs font-medium text-[#1A56DB] hover:text-[#1447C0] transition-colors min-h-[44px] inline-flex items-center"
                >
                  {recordLinkLabel(d.status)}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
