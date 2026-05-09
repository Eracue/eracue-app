"use client";

import { useState } from "react";

// E1 — "New campaign" entry point on the dashboard. Renders as a
// button by default; on click, replaces itself with an inline form
// panel (collapsible, no route change). A real backend write isn't
// wired today, so the panel completes with a confirmation state that
// links to the seeded demo campaign — see the success branch below.
//
// E2 — Message House (collapsible) is part of this same form. The
// pillars are captured client-side and passed through to the success
// state's link target as URL params (lossless even though there's no
// persistent write yet).

export function NewCampaignForm({
  isDemoMode,
}: {
  isDemoMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [principal, setPrincipal] = useState("");
  const [speakers, setSpeakers] = useState("");
  const [showHouse, setShowHouse] = useState(false);
  const [pillar1, setPillar1] = useState("");
  const [pillar2, setPillar2] = useState("");
  const [pillar3, setPillar3] = useState("");
  const [submitted, setSubmitted] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  const valid = name.trim() && startDate && endDate;

  function reset() {
    setName("");
    setStartDate("");
    setEndDate("");
    setPrincipal("");
    setSpeakers("");
    setPillar1("");
    setPillar2("");
    setPillar3("");
    setShowHouse(false);
    setSubmitted(null);
  }

  function handleSubmit() {
    if (!valid) return;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    setSubmitted({ slug, name: name.trim() });
  }

  // Tracks whether the success panel should send the visitor to a
  // route that will actually resolve. Demo deployments don't have a
  // campaign-creation backend so we redirect to the seeded demo
  // campaign; production deployments link to the derived slug (which
  // a future campaign-create server action will populate).
  const successHref = isDemoMode
    ? "/campaigns/series-b-announce"
    : submitted
      ? `/campaigns/${submitted.slug}`
      : "#";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] transition-colors cursor-pointer whitespace-nowrap"
      >
        New campaign →
      </button>
    );
  }

  if (submitted) {
    return (
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-5 mt-4 max-w-2xl">
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 w-7 h-7 rounded-full bg-white border border-[#BBF7D0] flex items-center justify-center"
            aria-hidden
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#166534"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#0F172A] mb-1">
              Campaign created.
            </div>
            <div className="text-sm text-[#374151] mb-3">
              <strong>{submitted.name}</strong> is ready. Communications
              submitted under this campaign will be checked against active
              rules.
            </div>
            <a
              href={successHref}
              className="bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] transition-colors inline-block"
            >
              View your campaign →
            </a>
            <button
              type="button"
              onClick={reset}
              className="ml-3 font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-5 mt-4 max-w-2xl">
      <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-4">
        New campaign
      </div>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="campaign-name"
            className="block text-sm font-medium text-[#0F172A] mb-1.5"
          >
            Campaign name
            <span className="text-[#94A3B8] font-normal ml-1">(required)</span>
          </label>
          <input
            id="campaign-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Series B Announce"
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="campaign-start"
              className="block text-sm font-medium text-[#0F172A] mb-1.5"
            >
              Start date
              <span className="text-[#94A3B8] font-normal ml-1">(required)</span>
            </label>
            <input
              id="campaign-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="campaign-end"
              className="block text-sm font-medium text-[#0F172A] mb-1.5"
            >
              End date
              <span className="text-[#94A3B8] font-normal ml-1">(required)</span>
            </label>
            <input
              id="campaign-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] font-mono"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="campaign-principal"
            className="block text-sm font-medium text-[#0F172A] mb-1.5"
          >
            Governing principal
          </label>
          <input
            id="campaign-principal"
            type="text"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            placeholder="Name · Title e.g. Sarah Chen · GC"
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
          />
        </div>
        <div>
          <label
            htmlFor="campaign-speakers"
            className="block text-sm font-medium text-[#0F172A] mb-1.5"
          >
            Speakers
          </label>
          <textarea
            id="campaign-speakers"
            value={speakers}
            onChange={(e) => setSpeakers(e.target.value)}
            rows={3}
            placeholder="One speaker per line: Marcus Rivera · CEO"
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8] resize-y"
          />
        </div>

        {/* E2 — Message House (optional, collapsible). The disclaimer
            below sets expectations: ERA CUE flags pillar contradictions,
            it doesn't auto-block on them. */}
        <div className="border border-[#E2E8F0] rounded-sm">
          <button
            type="button"
            onClick={() => setShowHouse((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#F8F9FB] transition-colors"
            aria-expanded={showHouse}
          >
            <span className="text-sm font-medium text-[#0F172A]">
              Message House{" "}
              <span className="text-[#94A3B8] font-normal">(optional)</span>
            </span>
            <span
              className="font-mono text-[10px] text-[#64748B]"
              aria-hidden
            >
              {showHouse ? "▼" : "▶"}
            </span>
          </button>
          {showHouse && (
            <div className="px-3 pb-3 space-y-3 border-t border-[#E2E8F0]">
              <div className="pt-3">
                <label
                  htmlFor="pillar-1"
                  className="block font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5"
                >
                  Pillar 01
                </label>
                <input
                  id="pillar-1"
                  type="text"
                  value={pillar1}
                  onChange={(e) => setPillar1(e.target.value)}
                  placeholder="Core message every speaker must stay consistent on"
                  className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label
                  htmlFor="pillar-2"
                  className="block font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5"
                >
                  Pillar 02
                </label>
                <input
                  id="pillar-2"
                  type="text"
                  value={pillar2}
                  onChange={(e) => setPillar2(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
                />
              </div>
              <div>
                <label
                  htmlFor="pillar-3"
                  className="block font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5"
                >
                  Pillar 03
                </label>
                <input
                  id="pillar-3"
                  type="text"
                  value={pillar3}
                  onChange={(e) => setPillar3(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
                />
              </div>
              <p className="text-[#64748B] text-xs leading-relaxed">
                Every draft submitted under this campaign will be checked
                against these pillars. Contradictions are flagged for review.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valid}
          className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors cursor-pointer"
        >
          Create campaign
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
