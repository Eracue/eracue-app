"use client";

import { useState } from "react";

// Section 9 of the homepage. Replaces the static three-icon-card
// layout with a tabbed proof component: each tab is one structural
// claim about ERA CUE, paired with a synthetic but visually accurate
// artifact mockup on the right. No counts in the artifacts are
// scraped from the live database; the copy below "Grows with every
// approved draft" is the only commitment, and the calibration rules
// are pinned to the actual demo-org seed names so they don't drift
// out of sync.

type ProofKey = "immutable" | "corpus" | "calibration";

const PROOFS: ReadonlyArray<{
  key: ProofKey;
  tab: string;
  proofLabel: string;
  headline: string;
  body: string;
  tag: string;
}> = [
  {
    key: "immutable",
    tab: "Immutable record",
    proofLabel: "Proof 1 of 3",
    headline:
      "The record cannot be altered.\nNot by anyone. Not even us.",
    body: "Every governance decision is cryptographically hashed at the moment it is created. The database enforces append-only access — UPDATE and DELETE are refused at the infrastructure level. This is not a policy. It is a technical constraint.",
    tag: "Database-enforced · Not policy-enforced",
  },
  {
    key: "corpus",
    tab: "Governance corpus",
    proofLabel: "Proof 2 of 3",
    headline:
      "ERA CUE remembers every approved statement.\nEvery new draft is checked against all of them.",
    body: "Every communication approved through ERA CUE enters a governance corpus. Every new draft is checked against it for contradictions — catching messaging inconsistencies before they reach the public or a regulator.",
    tag: "Builds automatically · No manual curation",
  },
  {
    key: "calibration",
    tab: "Rule calibration",
    proofLabel: "Proof 3 of 3",
    headline:
      "ERA CUE tells you when your governance needs tuning.\nBefore it becomes a problem.",
    body: "Rules that fire too often signal over-restriction. Rules that never fire signal keyword drift — the team's language has evolved past what the rule detects. ERA CUE surfaces both, automatically.",
    tag: "Organization-specific · Gets smarter over time",
  },
];

export default function BuiltDifferent() {
  const [active, setActive] = useState<ProofKey>("immutable");

  return (
    <section className="bg-[#F8FAFC] py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-3">
            Built different
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0D1B2A] leading-tight mb-3"
          >
            Built so you never have to take our word for it.
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed max-w-xl">
            Every governance decision is cryptographically locked.
            Every rule learns from every decision. The record speaks
            for itself.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-0 border-b border-[#E2E8F0] mb-8 overflow-x-auto">
          {PROOFS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setActive(p.key)}
              className={`font-mono text-xs px-5 py-3 whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${
                active === p.key
                  ? "border-[#4F46E5] text-[#4F46E5]"
                  : "border-transparent text-[#64748B] hover:text-[#0D1B2A]"
              }`}
            >
              {p.tab}
            </button>
          ))}
        </div>

        {/* Active panel — render every proof and toggle visibility
            so the artifact components mount once. The hidden ones
            stay in the DOM but display:none, which keeps tab clicks
            instant. */}
        {PROOFS.map((p) => (
          <div
            key={p.key}
            className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-start ${
              active === p.key ? "" : "hidden"
            }`}
          >
            {/* Left — claim */}
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#94A3B8] mb-4">
                {p.proofLabel}
              </div>
              <h3 className="text-xl font-medium text-[#0D1B2A] leading-snug mb-4 whitespace-pre-line">
                {p.headline}
              </h3>
              <p className="text-sm text-[#475569] leading-relaxed mb-5">
                {p.body}
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] flex-shrink-0"
                  aria-hidden
                />
                <span className="font-mono text-[10px] text-[#4F46E5]">
                  {p.tag}
                </span>
              </div>
            </div>

            {/* Right — visual artifact */}
            {p.key === "immutable" && <ImmutableArtifact />}
            {p.key === "corpus" && <CorpusArtifact />}
            {p.key === "calibration" && <CalibrationArtifact />}
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtifactShell({
  title,
  status,
  statusColor,
  children,
}: {
  title: string;
  status: string;
  statusColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
      <div className="bg-[#0D1B2A] px-4 py-3 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.40]">
          {title}
        </span>
        <span className={`font-mono text-[9px] font-bold ${statusColor}`}>
          {status}
        </span>
      </div>
      <div className="p-5 bg-white">{children}</div>
    </div>
  );
}

function ImmutableArtifact() {
  const fields: ReadonlyArray<{ label: string; value: string; color: string }> =
    [
      {
        label: "Record ID",
        value: "afe14696-5336-4336-a0b7-c3410477ec31",
        color: "text-[#0D1B2A]",
      },
      {
        label: "SHA-256 hash",
        value:
          "a4f8c2e1d7b3f09a6c5e8d2b1f4a7c0e3d6b9f2a5c8e1d4b7a0c3f6e9d2b5a8",
        color: "text-[#4F46E5]",
      },
      {
        label: "Created",
        value: "May 6, 2026 at 10:23:41 AM UTC",
        color: "text-[#0D1B2A]",
      },
      {
        label: "Last modified",
        value: "Never",
        color: "text-[#94A3B8]",
      },
    ];

  return (
    <ArtifactShell
      title="Communication record · SHA-256"
      status="⬡ Locked"
      statusColor="text-[#0EA5E9]"
    >
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.label}>
            <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-[#94A3B8] mb-1">
              {field.label}
            </div>
            <div
              className={`font-mono text-[11px] leading-relaxed break-all ${field.color}`}
            >
              {field.value}
            </div>
          </div>
        ))}

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-3 flex items-start gap-3 mt-2">
          <span className="text-base shrink-0 mt-0.5" aria-hidden>
            🔒
          </span>
          <div>
            <div className="font-mono text-[9px] font-bold text-[#0D1B2A] mb-1 uppercase tracking-[0.1em]">
              Append-only enforced
            </div>
            <div className="font-mono text-[9px] text-[#64748B] leading-relaxed">
              This record cannot be updated, deleted, or altered. The
              database refuses write operations after creation.
            </div>
          </div>
        </div>
      </div>
    </ArtifactShell>
  );
}

function CorpusArtifact() {
  const checks: ReadonlyArray<{
    draft: string;
    result: string;
    detail: string;
    ok: boolean;
  }> = [
    {
      draft:
        "“Our pricing is the most competitive in the market.”",
      result: "⚠ Contradiction found",
      detail: "Conflicts with prior approved statement (CEO · Apr 12)",
      ok: false,
    },
    {
      draft:
        "“Customer trust is everything — building for the long term.”",
      result: "✓ Consistent",
      detail: "No conflicts with prior approved statements",
      ok: true,
    },
  ];

  return (
    <ArtifactShell
      title="Governance corpus · Consistency check"
      status="● Live"
      statusColor="text-[#0EA5E9]"
    >
      <div>
        <div className="text-center pb-4 mb-4 border-b border-[#E2E8F0]">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94A3B8] mb-2">
            Prior approved statements
          </div>
          <div className="font-mono text-3xl font-bold text-[#4F46E5] leading-none">
            —
          </div>
          <div className="font-mono text-[10px] text-[#94A3B8] mt-2">
            Grows with every approved draft
          </div>
        </div>

        <div className="space-y-4">
          {checks.map((item, i) => (
            <div
              key={i}
              className="pb-4 border-b border-[#E2E8F0] last:border-0 last:pb-0"
            >
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-2.5 mb-2 text-xs italic text-[#1E293B] leading-relaxed">
                {item.draft}
              </div>
              <div className="flex items-start gap-2">
                <span
                  className={`font-mono text-[9px] font-bold shrink-0 ${
                    item.ok ? "text-[#0EA5E9]" : "text-[#F59E0B]"
                  }`}
                >
                  {item.result}
                </span>
                <span className="font-mono text-[9px] text-[#94A3B8]">
                  · {item.detail}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* A4 — corpus-growth note. Sets expectations for a brand-new
            org: zero history at day one; the consistency check gains
            signal as approved drafts accumulate. */}
        <p className="text-[#94A3B8] text-sm mt-4 pt-4 border-t border-[#E2E8F0] leading-relaxed">
          Signal builds from approved drafts. A new organization starts
          with zero history — the corpus grows with every cleared
          communication.
        </p>
      </div>
    </ArtifactShell>
  );
}

function CalibrationArtifact() {
  // Names + counts pinned to the actual demo-org seed so the panel
  // doesn't drift out of sync with what /rules shows for a demo
  // visitor. If the seed changes, update both surfaces together.
  const rules: ReadonlyArray<{
    name: string;
    meta: string;
    badge: string;
    badgeColor: string;
    action: string | null;
  }> = [
    {
      name: "Series B Quiet Period",
      meta: "14 triggers · last today",
      badge: "Well-calibrated",
      badgeColor: "bg-[#E0F2FE] text-[#0369A1]",
      action: null,
    },
    {
      name: "Competitor Mentions",
      meta: "0 triggers · keywords may have drifted",
      badge: "Review keywords",
      badgeColor: "bg-[#FEF3C7] text-[#B45309]",
      action: "Refine →",
    },
    {
      name: "Q3 Product Launch Embargo",
      meta: "Expires Jul 1, 2026 · 2 triggers",
      badge: "Expiring soon",
      badgeColor: "bg-[#FEE2E2] text-[#B91C1C]",
      action: "Extend →",
    },
    {
      name: "Pricing Claims",
      meta: "2 triggers · last yesterday",
      badge: "Well-calibrated",
      badgeColor: "bg-[#E0F2FE] text-[#0369A1]",
      action: null,
    },
  ];

  return (
    <ArtifactShell
      title="Rule health · Calibration signals"
      status="4 rules"
      statusColor="text-white/[0.55]"
    >
      <div className="divide-y divide-[#E2E8F0]">
        {rules.map((rule) => (
          <div
            key={rule.name}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#0D1B2A] mb-0.5 truncate">
                {rule.name}
              </div>
              <div className="font-mono text-[9px] text-[#94A3B8]">
                {rule.meta}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span
                className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm ${rule.badgeColor}`}
              >
                {rule.badge}
              </span>
              {rule.action && (
                <div className="font-mono text-[9px] text-[#4F46E5] mt-1 cursor-pointer hover:text-[#4338CA]">
                  {rule.action}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ArtifactShell>
  );
}
