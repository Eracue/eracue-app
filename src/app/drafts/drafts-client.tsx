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

// Plain-English label for the per-row "see the record" link. Tailors to
// what the reader is actually clicking into — overridden drafts open an
// override record, blocked/escalated drafts open the review-in-progress
// view, pending drafts read as 'Pending review', etc.
function recordLinkLabel(status: string): string {
  if (status === "overridden") return "Override record →";
  if (status === "approved") return "Approval record →";
  if (status === "blocked" || status === "escalated") return "Review record →";
  if (status === "pending") return "Pending review →";
  return "Communication record →";
}

// Combined status descriptor — folds the raw verdict + status + whether
// a principal has decided into one labelled badge plus a plain-English
// subtext line. Replaces the separate VerdictBadge / statusBadge /
// statusDescription helpers so the table doesn't show contradictions
// like 'BLOCK · PRINCIPAL APPROVED' on the same row.
type CombinedStatus = {
  badge: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  desc: string;
};

function combinedStatus(
  d: { id: string; status: string; verdict: string | null },
  principalApprovedIds: Set<string>,
): CombinedStatus {
  const verdict = d.verdict?.toLowerCase() ?? null;
  const status = d.status?.toLowerCase() ?? "";
  const hasPrincipal = principalApprovedIds.has(d.id);

  // Overridden — principal cleared a draft despite a block/escalate
  // verdict. Always wins so the row never reads as both flagged and
  // approved at the same time.
  if (status === "overridden") {
    return {
      badge: "OVERRIDDEN",
      bg: "bg-[#EFF8FF]",
      text: "text-[#1A56DB]",
      border: "border-[#BAE6FD]",
      dot: "bg-[#1A56DB]",
      desc: "Approved despite flag",
    };
  }

  if (verdict === "block" && status === "blocked" && !hasPrincipal) {
    return {
      badge: "BLOCKED",
      bg: "bg-[#FEF2F2]",
      text: "text-[#B91C1C]",
      border: "border-[#FECACA]",
      dot: "bg-[#B91C1C]",
      desc: "Awaiting review",
    };
  }

  if (verdict === "block" && hasPrincipal) {
    return {
      badge: "REVIEWED",
      bg: "bg-[#FEF2F2]",
      text: "text-[#B91C1C]",
      border: "border-[#FECACA]",
      dot: "bg-[#B91C1C]",
      desc: "Reviewed by principal",
    };
  }

  if (verdict === "escalate" && !hasPrincipal) {
    return {
      badge: "ESCALATED",
      bg: "bg-[#FFF7ED]",
      text: "text-[#C2410C]",
      border: "border-[#FED7AA]",
      dot: "bg-[#C2410C]",
      desc: "Awaiting review",
    };
  }

  if (verdict === "escalate" && hasPrincipal) {
    return {
      badge: "ESCALATED",
      bg: "bg-[#FFF7ED]",
      text: "text-[#C2410C]",
      border: "border-[#FED7AA]",
      dot: "bg-[#C2410C]",
      desc: "Decision recorded",
    };
  }

  if (status === "approved" && hasPrincipal) {
    return {
      badge: "APPROVED",
      bg: "bg-[#F0FDF4]",
      text: "text-[#166534]",
      border: "border-[#BBF7D0]",
      dot: "bg-[#166534]",
      desc: "Reviewed and approved",
    };
  }

  if (status === "approved" && !hasPrincipal) {
    return {
      badge: "CLEARED",
      bg: "bg-[#F1F5F9]",
      text: "text-[#64748B]",
      border: "border-[#E2E8F0]",
      dot: "bg-[#64748B]",
      desc: "Passed all checks",
    };
  }

  if (status === "pending" || verdict === "review") {
    return {
      badge: "PENDING",
      bg: "bg-[#EFF6FF]",
      text: "text-[#1D4ED8]",
      border: "border-[#BFDBFE]",
      dot: "bg-[#1D4ED8]",
      desc: "Awaiting principal review",
    };
  }

  return {
    badge: status?.toUpperCase() || "—",
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    border: "border-[#E2E8F0]",
    dot: "bg-[#64748B]",
    desc: "",
  };
}

function StatusCell({ s }: { s: CombinedStatus }) {
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${s.bg} ${s.text} ${s.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} aria-hidden />
        {s.badge}
      </span>
      {s.desc && (
        <div className="font-mono text-[10px] text-[#94A3B8] mt-0.5">
          {s.desc}
        </div>
      )}
    </div>
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

      {/* Export + discoverability row.
          - With campaignFilter active, primary export is the campaign
            record. Also surfaces a 'View full campaign record →' link
            into the dedicated /campaigns/<name> page.
          - With no filter active, expose 'View campaign records →' as a
            subtle discoverability hint (sets the campaign filter to
            the first available campaign so the user lands in a
            campaign-aware view). */}
      <div className="flex justify-end mb-4 gap-4 items-center flex-wrap">
        {campaignFilter !== "all" && (
          <Link
            href={`/campaigns/${encodeURIComponent(campaignFilter)}`}
            className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
          >
            View full campaign record →
          </Link>
        )}
        {campaignFilter === "all" && campaigns.length > 0 && (
          <button
            type="button"
            onClick={() => setCampaignFilter(campaigns[0])}
            className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            View campaign records →
          </button>
        )}
        {campaignFilter !== "all" ? (
          <Link
            href={`/supervision-report?campaign=${encodeURIComponent(campaignFilter)}`}
            className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
          >
            Export campaign governance record →
          </Link>
        ) : (
          <Link
            href="/supervision-report"
            className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            Export supervision report →
          </Link>
        )}
      </div>

      {/* Desktop table — hidden on mobile in favour of the card list
          below. overflow-x-auto + min-w-[860px] still apply at sm and
          above so the table scrolls horizontally if the viewport is
          narrower than the column-natural width. */}
      <div className="hidden sm:block bg-white border border-[#E2E8F0] rounded-sm overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-[#F8F9FB] border-b border-[#E2E8F0]">
            <tr>
              <th className="w-44 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Speaker</th>
              <th className="w-20 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Date</th>
              <th className="w-24 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Channel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Draft</th>
              <th className="w-44 text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Status</th>
              <th className="w-36 px-4 py-3" aria-label="Communication record link" />
            </tr>
          </thead>
          <tbody>
            {deduplicated.map((d) => (
              <tr
                key={d.id}
                className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8F9FB]"
              >
                <td className="w-44 px-4 py-3 whitespace-nowrap">
                  <Link href={`/drafts/${d.id}`} className="block group">
                    <div className="text-sm font-semibold text-[#0F172A] group-hover:underline truncate">
                      {d.users?.name || "—"}
                    </div>
                    <div className="text-xs text-[#64748B] truncate">{d.users?.title || ""}</div>
                  </Link>
                </td>
                <td className="w-20 px-4 py-3 font-mono text-xs text-[#94A3B8] whitespace-nowrap">
                  {new Date(d.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="w-24 px-4 py-3 text-[#374151] truncate whitespace-nowrap">{formatChannel(d.channel)}</td>
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
                <td className="w-44 px-4 py-3 whitespace-nowrap">
                  <StatusCell s={combinedStatus(d, principalApprovedSet)} />
                </td>
                <td className="w-36 px-4 py-3 text-right whitespace-nowrap">
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
              {/* Speaker + date header — verdict moved into the combined
                  status block at the bottom, so the header is just the
                  speaker context. */}
              <div className="mb-2">
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

              {/* Draft text */}
              <div className="text-sm text-[#374151] line-clamp-2 leading-snug mb-3">
                {d.draft_text}
                {d.duplicate_count > 1 && (
                  <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-sm border border-[#E2E8F0] ml-2">
                    ×{d.duplicate_count}
                  </span>
                )}
              </div>

              {/* Combined status badge + description + record link */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <StatusCell s={combinedStatus(d, principalApprovedSet)} />
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
