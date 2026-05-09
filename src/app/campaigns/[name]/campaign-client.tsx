"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Status-pill styling. Mirrors the server-rendered version on
// page.tsx but inlined here so the client list stays self-contained.
type DraftStatus =
  | "approved"
  | "overridden"
  | "blocked"
  | "escalated"
  | "pending"
  | string;

export type CampaignDraft = {
  id: string;
  draft_text: string;
  status: DraftStatus;
  submitted_at: string;
  channel: string;
  speaker_name: string;
  speaker_title: string;
  has_decision: boolean;
  // Name of the rule whose primary_match fired on this draft, if any.
  // null when the draft was never flagged by a rule (system-cleared).
  triggered_rule_name: string | null;
};

// Verdict filter buckets used by the toggle row above the list. The
// codebase uses status + decision interchangeably; this filter resolves
// each draft to one of the four buckets so the UI vocabulary stays
// consistent.
type VerdictBucket = "all" | "cleared" | "review" | "blocked";

type Props = {
  drafts: CampaignDraft[];
  // All active rule names for the org. Drives the rule-filter dropdown.
  // Empty list disables the dropdown but keeps the list visible.
  ruleNames: string[];
};

function formatChannel(ch: string): string {
  const map: Record<string, string> = {
    linkedin: "LinkedIn",
    twitter: "X / Twitter",
    press_release: "Press Release",
    blog: "Blog",
    email: "Email",
    interview: "Interview",
    internal_memo: "Internal memo",
    ai_agent_post: "AI agent post",
    other: "Other",
  };
  return map[ch] ?? ch;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Bucket assignment — single source of truth shared with the C3 toggle
// filter. Drafts that have been principal-decided land in cleared or
// blocked (depending on outcome); drafts still awaiting a decision land
// in review (matches C1's "Pending review" stat).
function bucketFor(d: CampaignDraft): Exclude<VerdictBucket, "all"> {
  if (d.status === "approved" || d.status === "overridden") return "cleared";
  if (d.status === "blocked" && d.has_decision) return "blocked";
  return "review"; // blocked-without-decision OR escalated → pending review
}

function statusPill(d: CampaignDraft) {
  const b = bucketFor(d);
  if (b === "cleared") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" aria-hidden />
        Cleared
      </span>
    );
  }
  if (b === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" aria-hidden />
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#C2410C]" aria-hidden />
      Pending review
    </span>
  );
}

// Toggle button row for C3. Single-select; default ALL. Each button
// keeps the same dimensions across states so the row doesn't reflow on
// selection.
const VERDICT_OPTIONS: ReadonlyArray<{ key: VerdictBucket; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "cleared", label: "CLEARED" },
  { key: "review", label: "REVIEW" },
  { key: "blocked", label: "BLOCKED" },
];

export function CampaignCommunications({ drafts, ruleNames }: Props) {
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [verdictFilter, setVerdictFilter] = useState<VerdictBucket>("all");

  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      if (verdictFilter !== "all" && bucketFor(d) !== verdictFilter) {
        return false;
      }
      if (ruleFilter !== "all" && d.triggered_rule_name !== ruleFilter) {
        return false;
      }
      return true;
    });
  }, [drafts, ruleFilter, verdictFilter]);

  return (
    <section className="mt-10 mb-16 print:hidden">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
            COMMUNICATIONS
          </div>
          <p className="text-sm text-[#374151] mt-1">
            Chronological record of all submissions under this campaign.
          </p>
        </div>
        <span className="font-mono text-xs text-[#64748B]">
          {filtered.length} of {drafts.length} shown
        </span>
      </div>

      {/* Filter row — rule dropdown (C2) + verdict toggle (C3). Both
          render even when drafts.length === 0; the empty-state below
          carries a clearer message than disabling the controls. */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="rule-filter"
            className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]"
          >
            Rule
          </label>
          <select
            id="rule-filter"
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-sm px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] cursor-pointer"
          >
            <option value="all">All rules</option>
            {ruleNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-sm overflow-hidden bg-white">
          {VERDICT_OPTIONS.map((opt) => {
            const selected = verdictFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setVerdictFilter(opt.key)}
                className={`font-mono text-xs px-3 py-1.5 transition-colors cursor-pointer ${
                  selected
                    ? "bg-[#0F172A] text-white"
                    : "text-[#475569] hover:bg-[#F8F9FB]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center text-sm text-[#64748B]">
          {drafts.length === 0
            ? "No drafts submitted this campaign."
            : "No drafts match the current filters."}
        </div>
      ) : (
        filtered.map((d) => (
          <div
            key={d.id}
            className="bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
          >
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-[#64748B] mb-1">
                {d.speaker_name || "—"}
                {d.speaker_title ? ` · ${d.speaker_title}` : ""}
              </div>
              <div
                className="text-sm text-[#374151] mb-1 leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {d.draft_text}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-1.5 py-0.5 rounded-sm">
                  {fmtDate(d.submitted_at)}
                </span>
                <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-1.5 py-0.5 rounded-sm">
                  {formatChannel(d.channel)}
                </span>
                {d.triggered_rule_name && (
                  <span className="font-mono text-[10px] bg-[#EFF8FF] text-[#1A56DB] border border-[#BAE6FD] px-1.5 py-0.5 rounded-sm">
                    {d.triggered_rule_name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {statusPill(d)}
              <Link
                href={`/drafts/${d.id}/examiner`}
                className="font-mono text-xs font-medium text-[#1A56DB] hover:text-[#1447C0] transition-colors whitespace-nowrap"
              >
                Communication record →
              </Link>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

// E3 — cross-speaker consistency signal. Renders a yellow indicator
// bar when the campaign shows messaging variance across speakers. Demo
// mode uses the conservative `blockedCount > 0 && approvedCount > 0`
// proxy spec'd by the user; real keyword-variance detection lives in
// a future iteration. Returns null when no signal is present so the
// page reads clean for healthy campaigns.
export function CampaignConsistencySignal({
  show,
}: {
  show: boolean;
}) {
  if (!show) return null;
  return (
    <div className="mt-6 print:hidden">
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm px-4 py-3">
        <div className="text-sm text-[#92400E] leading-relaxed">
          Consistency signal: review recommended — messaging variance
          detected across speakers.
        </div>
        <div className="text-[#64748B] text-xs mt-1 leading-relaxed">
          ERA CUE surfaces a possible consistency gap. Whether this
          affects your campaign is a judgment for your communications
          team.
        </div>
      </div>
    </div>
  );
}

// E4 — combined export surface: holds the print summary panel plus
// the "Export to PDF →" button and the optional client-name prompt.
// Wraps the breadcrumb + screen header so the screen-side button can
// sit top-right of the header while the print panel is a sibling
// outside any `print:hidden` ancestor — both reading the same
// clientName state. Lifted out of page.tsx so the panel header can
// read dynamic state (the client name flows into the printed page-1
// header verbatim).
type StatCard = { label: string; value: number };

export function CampaignHeaderAndExport({
  campaignName,
  dateRangeLabel,
  principalLabel,
  stats,
}: {
  campaignName: string;
  dateRangeLabel: string;
  principalLabel: string;
  stats: ReadonlyArray<StatCard>;
}) {
  // Three modes:
  //   "idle"      → just the button.
  //   "prompting" → input row asking for an optional client name.
  //   "exporting" → window.print() has been called; panel header
  //                 carries the client name; we flip back to idle on
  //                 the next paint after the print dialog closes.
  const [mode, setMode] = useState<"idle" | "prompting" | "exporting">("idle");
  const [clientName, setClientName] = useState("");

  function startExport() {
    setMode("exporting");
    // Wait one paint so the print panel re-renders with the client
    // name baked into its header before the print dialog opens.
    requestAnimationFrame(() => {
      window.print();
      // After print() returns synchronously the dialog is closed; reset
      // the prompt state so the next click starts fresh.
      setMode("idle");
    });
  }

  // Print-panel header — defaults to the campaign-summary eyebrow,
  // swaps to the client-prepared variant when a name is set.
  const headerEyebrow = clientName.trim()
    ? `ERA CUE · Campaign Compliance Record — prepared for ${clientName.trim()}`
    : "ERA CUE · Campaign summary";

  return (
    <>
      {/* Print-only summary block. Page 1 of the printed PDF carries
          campaign name, date range, governing principal, the four
          stat cards, and the legal disclaimer. The page-break-after
          rule pushes any subsequent screen content onto page 2 of the
          printed PDF; in practice the rest of the page is print:hidden
          so the export stops here. */}
      <div
        className="hidden print:block p-8"
        style={{ pageBreakAfter: "always" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
          {headerEyebrow}
        </div>
        <h1 className="text-2xl font-light text-[#0F172A] leading-tight">
          {campaignName}
        </h1>
        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-[#64748B]">Date range</dt>
          <dd className="text-[#0F172A]">{dateRangeLabel}</dd>
          <dt className="text-[#64748B]">Governing principal</dt>
          <dd className="text-[#0F172A]">{principalLabel}</dd>
          {clientName.trim() && (
            <>
              <dt className="text-[#64748B]">Prepared for</dt>
              <dd className="text-[#0F172A]">{clientName.trim()}</dd>
            </>
          )}
        </dl>
        <div className="mt-6 grid grid-cols-4 gap-3">
          {stats.map((card) => (
            <div
              key={card.label}
              className="border border-[#E2E8F0] rounded-sm p-4"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
                {card.label}
              </div>
              <div className="font-mono text-3xl font-light text-[#0F172A]">
                {card.value}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-[#64748B] leading-relaxed">
          ERA CUE records that governance processes ran for the
          communications included in this report. Whether these
          communications satisfy applicable regulatory requirements
          is a determination for qualified legal counsel.
        </p>
      </div>

      {/* Screen surface — breadcrumb + header + button/prompt. The
          print panel above is a sibling outside this `print:hidden`
          wrapper so it actually renders to the printed page. */}
      <div className="mb-8 print:hidden">
        <Link
          href="/drafts"
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          ← Archive
        </Link>
        <div className="flex justify-between items-end gap-4 flex-wrap mt-3">
          <div className="min-w-0">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              CAMPAIGN RECORD
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-2"
            >
              {campaignName}
            </h1>
            <p className="text-sm text-[#374151] mt-2 max-w-2xl leading-relaxed">
              Governance record for all communications under this campaign.
            </p>
            <div className="font-mono text-xs text-[#64748B] mt-2">
              {dateRangeLabel} · Governed by: {principalLabel}
            </div>
          </div>
          {mode === "prompting" ? (
            <div className="bg-white border border-[#BAE6FD] rounded-sm p-3 flex items-center gap-2 flex-wrap">
              <label
                htmlFor="export-client-name"
                className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]"
              >
                Export for client? (optional)
              </label>
              <input
                id="export-client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
                className="border border-[#E2E8F0] rounded-sm px-3 py-1.5 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={startExport}
                className="bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-1.5 rounded-sm hover:bg-[#1447C0] transition-colors cursor-pointer"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("idle");
                  setClientName("");
                }}
                className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMode("prompting")}
              className="font-mono text-xs text-[#1A56DB] border border-[#BAE6FD] bg-[#EFF8FF] px-4 py-2 rounded-sm hover:bg-[#DBEAFE] transition-colors whitespace-nowrap cursor-pointer"
            >
              Export to PDF →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
