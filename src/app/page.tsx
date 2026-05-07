import Link from "next/link";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// `fetchCache = "force-no-store"` is the third lever that stops Next from
// memoising fetch() responses inside the route handler. Combined with the
// CDN-level no-store header in next.config and the page-level dynamic
// directive, this makes the route fully uncacheable end-to-end.
export const fetchCache = "force-no-store";

// Live communication record id used by the COMM RECORD section's
// "see a real record" link. Kept as a constant so the demo data id
// is changeable in one place.
const CCO_EXAMINER_DRAFT_ID = "afe14696-5336-4336-a0b7-c3410477ec31";

// ---------- Page ---------------------------------------------------------

// Final homepage. Fixed three-tone palette across the section bands:
//   #0D1B2A (dark)   — nav, hero, badges, regulatory, campaign + roles, CTA
//   #FAFAFA (light)  — how it works
//   #FFFFFF (white)  — communication record
//   #EDE9FF (lavender) — built different
// All headlines are Newsreader serif (font-light), text-3xl–text-5xl;
// body copy is text-sm or smaller; eyebrows / labels are font-mono
// text-[10px] uppercase; status colors (red / amber / green / lavender)
// only on functional verdicts, never on ornament.
export default function Home() {
  return (
    <div className="bg-[#0D1B2A] min-h-screen">
      <SiteHeader />

      {/* ============================================================
          SECTION 2 — HERO (dark)
          Two-column. Left: eyebrow / italic-tail headline / prose sub /
          flow strip / two CTAs. Right: a BLOCK verdict mockup so the
          opening visual reads as "ERA CUE caught something" — more
          demonstrative than a CLEAR card.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
          {/* LEFT — copy + CTAs */}
          <div className="md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#A5B4FC] mb-5">
              Human oversight · AI 2026
            </div>

            <h1
              className="font-light text-4xl md:text-5xl text-white leading-[1.1] mb-4"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every executive communication.
              <br />
              <em className="italic text-white/[0.42]">
                Checked. Approved. On record.
              </em>
            </h1>

            <p className="text-sm text-white/55 leading-relaxed mb-6 max-w-md">
              AI is drafting your team&apos;s communications. Agents are posting
              without human review. Nobody has a record that a person approved
              it.
            </p>

            <div className="flex items-center gap-2 flex-wrap mb-6">
              {[
                "01 Set rules",
                "02 Check drafts",
                "03 Record approved",
              ].map((label, i) => (
                <span key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="font-mono text-white/15" aria-hidden>
                      →
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-white/[0.28] uppercase tracking-[0.08em]">
                    {label}
                  </span>
                </span>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/rules"
                className="bg-[#1A56DB] text-white font-mono text-[11px] font-medium px-5 py-2.5 rounded-sm hover:bg-[#1447C0] hover:shadow-[0_0_0_3px_rgba(26,86,219,0.25)] transition-all"
              >
                Set up your rules →
              </Link>
              <Link
                href="/submit"
                className="bg-white/[0.07] text-white border border-white/[0.12] font-mono text-[11px] font-medium px-5 py-2.5 rounded-sm hover:bg-white/[0.12] transition-colors"
              >
                See it working →
              </Link>
            </div>
          </div>

          {/* RIGHT — BLOCK verdict mockup. Hidden on mobile so the hero
              stays compact. The body mirrors what /submit renders for a
              real BLOCK — same plain-English label, same five-check
              chain, same keyword + regulatory citation in the footer. */}
          <div className="md:col-span-2 hidden md:block">
            <div className="bg-white rounded-lg p-5 shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[9px] text-[#94A3B8] uppercase tracking-[0.12em]">
                  Communication check
                </div>
                <div className="font-mono text-[9px] text-[#94A3B8]">
                  Verdict in seconds
                </div>
              </div>

              <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded p-3 text-[11px] italic text-[#374151] mb-3 leading-relaxed">
                &ldquo;Our portfolio has generated guaranteed returns with no
                risk to principal.&rdquo;
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded">
                  Blocked
                </span>
                <span className="text-[12px] font-medium text-[#0D1B2A]">
                  Performance Projections
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {[
                  { name: "Rule check", result: "FAIL", color: "#DC2626" },
                  { name: "Quiet period", result: "PASS", color: "#16A34A" },
                  { name: "Consistency", result: "PASS", color: "#16A34A" },
                  { name: "Alignment", result: "FLAG", color: "#D97706" },
                  { name: "Agent origin", result: "PASS", color: "#16A34A" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex justify-between px-1 py-1 rounded hover:bg-[#F8FAFF] cursor-default transition-colors"
                  >
                    <span className="font-mono text-[10px] text-[#374151]">
                      {row.name}
                    </span>
                    <span
                      className="font-mono text-[10px] font-bold"
                      style={{ color: row.color }}
                    >
                      {row.result}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E5E7EB] pt-2.5 flex justify-between font-mono text-[9px] text-[#94A3B8]">
                <span>Keyword: guaranteed returns</span>
                <span>FINRA 2210(d)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — BADGES (dark, seamless)
          Single muted strip. Continues the hero band — the hairline
          border on top is the only visual break.
         ============================================================ */}
      <section className="bg-[#0D1B2A] border-t border-white/[0.06] py-3 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] text-white/[0.22] uppercase tracking-[0.1em] mr-2">
            Built for
          </span>
          {[
            "Broker-dealers",
            "RIAs",
            "Public companies",
            "Investment banks",
            "PR agencies",
            "Executive teams",
          ].map((label) => (
            <span
              key={label}
              className="font-mono text-[9px] text-white/40 px-2.5 py-1 border border-white/[0.10] rounded-sm"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — REGULATORY REALITY (dark, white cards)
          Three named enforcement actions. Each card uses indigo for
          the headline number (the fine) — red is reserved for active
          violation states only.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-16 md:py-20 px-6 md:px-12 border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#A5B4FC] mb-3">
              The regulatory reality
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white mb-3 leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Three regulations. Real consequences.
            </h2>
            <p className="text-sm text-white/50 leading-relaxed max-w-xl">
              Each of these enforcement actions happened in the last 18
              months. Each involved communications that were not reviewed
              before publication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                amount: "$200,000",
                amountLabel: "civil penalty",
                type: "Public company · September 2024",
                rule: "SEC Regulation FD",
                bodyLabel: "What happened",
                body: "DraftKings’ PR firm posted on the CEO’s LinkedIn during an earnings quiet period — disclosing revenue growth data before Q2 results were released. Posts were live 30 minutes.",
                citation: "SEC Release 34-101130",
                eraText:
                  "The quiet period rule fires on submission. The draft is blocked before it reaches LinkedIn — and the principal’s decision is on record.",
              },
              {
                amount: "$850,000",
                amountLabel: "FINRA fine",
                type: "Broker-dealer · March 2024",
                rule: "FINRA Rules 2210(b) + 3110",
                bodyLabel: "What happened",
                body: "M1 Finance paid social media influencers to promote the firm. No registered principal reviewed any post before publication. No records were maintained.",
                citation: "FINRA Enforcement",
                eraText:
                  "Every influencer or agency submits through ERA CUE before posting. A registered principal approves — and the named review record satisfies Rule 3110.",
              },
              {
                amount: "Aug 2026",
                amountLabel: "enforceable",
                type: "All organizations",
                rule: "EU AI Act Article 50",
                bodyLabel: "The gap",
                body: "AI drafts content. Executives post it. There is no record that a human reviewed it before publication — and Article 50 requires one.",
                citation: "EU AI Act Art. 50",
                eraText:
                  "ERA CUE records AI origin, documents the human review decision, and produces the disclosure trail Article 50 requires — for every governed draft.",
              },
            ].map((card) => (
              <div
                key={card.amount}
                className="bg-white rounded-lg overflow-hidden border-t-[3px] border-t-[#1A56DB] shadow-[0_2px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.28)] hover:-translate-y-[3px] transition-all duration-200"
              >
                <div className="p-5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B7280] mb-2">
                    {card.type}
                  </div>
                  <div
                    className="font-mono text-[26px] font-bold text-[#1A56DB] leading-none mb-1"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {card.amount}
                  </div>
                  <div className="font-mono text-[9px] text-[#9CA3AF]">
                    {card.amountLabel}
                  </div>
                </div>

                <div className="h-px bg-[#E5E7EB] mx-5" />

                <div className="p-5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#9CA3AF] mb-2">
                    {card.bodyLabel}
                  </div>
                  <div className="font-mono text-[9px] text-[#1A56DB] mb-2">
                    {card.rule}
                  </div>
                  <p className="text-[12px] text-[#374151] leading-relaxed mb-2">
                    {card.body}
                  </p>
                  <div className="font-mono text-[9px] text-[#9CA3AF]">
                    {card.citation}
                  </div>
                </div>

                <div className="bg-[#EDE9FF] border-t border-[#DDD6FE] p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7C6FCD] mb-1.5">
                    With ERA CUE
                  </div>
                  <p className="text-[12px] text-[#3730A3] leading-relaxed">
                    {card.eraText}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-7">
            <p className="font-mono text-[10px] text-white/30 max-w-xl mx-auto leading-relaxed">
              ERA CUE is the pre-publication checkpoint that produces the
              evidence each of these regulations requires.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — HOW IT WORKS (light)
          Three step cards + a flow diagram. The diagram makes the
          decision tree explicit so a CCO doesn't have to read prose
          to see how a draft routes.
         ============================================================ */}
      <section className="bg-[#FAFAFA] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7C6FCD] mb-3">
              HOW IT WORKS
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] mb-3 leading-tight"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Three steps. Every draft.
            </h2>
            <p className="text-sm text-[#374151] leading-relaxed max-w-xl mx-auto">
              Configure the governance once. Every draft your team submits
              afterwards routes through it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[
              {
                label: "01 — Configure",
                title: "Configure your governance",
                body: "The CCO sets governance rules once — from regulatory templates, existing WSPs, or from scratch. Authorized by a named principal before anything is governed.",
                tag: "WSP import · FINRA templates · AI-assisted creation",
              },
              {
                label: "02 — Check",
                title: "Check before you publish",
                body: "Any executive — or AI agent acting on their behalf — submits a draft. ERA CUE checks it against active rules and prior approved statements. Verdict in seconds.",
                tag: "Five checks · Verdict in seconds · Principal review if needed",
              },
              {
                label: "03 — Record",
                title: "Record who approved",
                body: "ERA CUE generates an immutable communication record — named principal, structured decision, SHA-256 locked. Ready for any regulator, board, or client.",
                tag: "SHA-256 locked · Append-only · FINRA Rule 3110",
              },
            ].map((step) => (
              <div
                key={step.label}
                className="bg-white border border-[#E5E7EB] rounded-lg p-6 border-l-[3px] border-l-[#1A56DB] hover:border-l-[#7C6FCD] hover:shadow-[0_4px_20px_rgba(124,111,205,0.12)] transition-all duration-200"
              >
                <div className="font-mono text-[10px] font-bold text-[#1A56DB] mb-3">
                  {step.label}
                </div>
                <div className="text-[14px] font-medium text-[#0D1B2A] mb-2 leading-snug">
                  {step.title}
                </div>
                <p className="text-[12px] text-[#374151] leading-[1.7] mb-3">
                  {step.body}
                </p>
                <div className="font-mono text-[9px] text-[#6B7280]">
                  {step.tag}
                </div>
              </div>
            ))}
          </div>

          {/* Decision flow diagram — three input nodes feeding three
              verdict chips. Renders the routing logic visually so a CCO
              doesn't have to read prose to see what BLOCK / ESCALATED /
              CLEARED actually mean. */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#9CA3AF] mb-4">
              Decision flow — every draft routes through this
            </div>
            <div className="flex items-center gap-0 flex-wrap">
              <div className="flex-1 text-center min-w-[120px]">
                <div className="font-mono text-[10px] font-medium text-[#374151]">
                  Draft
                </div>
                <div className="font-mono text-[9px] text-[#9CA3AF] mt-1">
                  Executive or agent
                </div>
              </div>
              <span
                className="font-mono text-[14px] text-[#D1D5DB] px-3 flex-shrink-0"
                aria-hidden
              >
                →
              </span>
              <div className="flex-1 text-center min-w-[120px]">
                <div className="font-mono text-[10px] font-medium text-[#374151]">
                  Five checks
                </div>
                <div className="font-mono text-[9px] text-[#9CA3AF] mt-1">
                  Rules + corpus + context
                </div>
              </div>
              <span
                className="font-mono text-[14px] text-[#D1D5DB] px-3 flex-shrink-0"
                aria-hidden
              >
                →
              </span>
              <div className="flex flex-col gap-1.5 flex-[1.4] min-w-[180px]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#FECACA] bg-[#FEE2E2]">
                  <span className="font-mono text-[10px] font-bold text-[#DC2626]">
                    Blocked
                  </span>
                  <span className="font-mono text-[9px] text-[#9CA3AF]">
                    rule violation
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#FDE68A] bg-[#FEF3C7]">
                  <span className="font-mono text-[10px] font-bold text-[#D97706]">
                    Escalated
                  </span>
                  <span className="font-mono text-[9px] text-[#9CA3AF]">
                    routes to review
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#BBF7D0] bg-[#DCFCE7]">
                  <span className="font-mono text-[10px] font-bold text-[#16A34A]">
                    Cleared
                  </span>
                  <span className="font-mono text-[9px] text-[#9CA3AF]">
                    publishable, recorded
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 + 7 — CAMPAIGN GOVERNANCE + ROLE CARDS (dark)
          Two-column campaign card + "who uses" list at the top, role
          cards below in the same band. The hairline border on top
          separates this from the light steps section above.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#A5B4FC] mb-3">
              Campaign governance
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white mb-3 leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every executive. One view.
            </h2>
            <p className="text-sm text-white/50 leading-relaxed max-w-xl">
              See your whole team&apos;s communications at once — who
              approved, who&apos;s pending, and how long each review took.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* LEFT — campaign card */}
            <div className="bg-white/[0.05] border border-white/[0.10] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Q3 product launch
                  </div>
                  <div className="font-mono text-[10px] text-white/[0.25] mt-0.5">
                    Apr 1–Jun 30, 2026 · GC
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#16A34A]">
                      8
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
                      Approved
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#D97706]">
                      2
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
                      Pending
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#DC2626]">
                      1
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
                      Blocked
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {[
                  {
                    name: "Marcus Rivera",
                    role: "CEO",
                    channel: "LinkedIn",
                    topic: "Series B messaging",
                    status: "Approved · 2h 14m review",
                    color: "#16A34A",
                  },
                  {
                    name: "Lena Brooks",
                    role: "Chief Comms Officer",
                    channel: "Press release",
                    topic: "Q3 launch",
                    status: "Approved · 47m review",
                    color: "#16A34A",
                  },
                  {
                    name: "James Kim",
                    role: "Head of IR",
                    channel: "LinkedIn",
                    topic: "Price claim flagged",
                    status: "Pending review · 11:42 AM",
                    color: "#D97706",
                  },
                  {
                    name: "Priya Patel",
                    role: "CMO",
                    channel: "Twitter",
                    topic: "Campaign messaging",
                    status: "Approved · 1h 8m review",
                    color: "#16A34A",
                  },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-white/[0.04] transition-colors"
                  >
                    <div>
                      <div className="text-sm text-white/75">
                        {s.name}{" "}
                        <span className="font-mono text-[10px] text-white/[0.22] ml-1">
                          · {s.role}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-white/[0.22] mt-0.5">
                        {s.channel} · {s.topic}
                      </div>
                    </div>
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: s.color }}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono text-[10px] text-white/30">
                  Every speaker. Every channel. One record.
                </span>
                <Link
                  href="/campaigns/Q3%20Product%20Launch"
                  className="font-mono text-xs text-[#A5B4FC] hover:text-white transition-colors"
                >
                  View campaign record →
                </Link>
              </div>
            </div>

            {/* RIGHT — role list. One header, three rows. */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-white/30 mb-4">
                Who uses the campaign record
              </div>
              <div className="space-y-3">
                {[
                  {
                    role: "PR agency",
                    use: "Client deliverable showing every approval, timing, and principal decision",
                  },
                  {
                    role: "CCO",
                    use: "Supervisory evidence for the full campaign window, ready for FINRA examination",
                  },
                  {
                    role: "FINRA examiner",
                    use: "Named principal, review timing, decision basis — downloadable as PDF",
                  },
                ].map((item) => (
                  <div key={item.role} className="flex gap-3">
                    <div className="font-mono text-[11px] font-medium text-[#A5B4FC] w-28 shrink-0 pt-0.5">
                      {item.role}
                    </div>
                    <div className="text-[12px] text-white/45 leading-relaxed">
                      {item.use}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROLE CARDS — same dark band, separated by a hairline border
              and a wider top margin so the two halves read as related
              but distinct. NO links inside any card. */}
          <div className="border-t border-white/[0.06] mt-12 pt-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#A5B4FC] mb-3">
              Built for every role
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white mb-3 leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              From the executive drafting to the examiner reviewing.
            </h2>
            <p className="text-sm text-white/50 leading-relaxed mb-8 max-w-xl">
              ERA CUE serves every person in the communication governance
              workflow.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                {
                  eyebrow: "EXECUTIVE · FOUNDER · CEO",
                  title: "Know before you post.",
                  body: "ERA CUE checks your draft against your organization’s active rules before anyone sees it. Know exactly what’s wrong — before it reaches anyone.",
                  full: false,
                },
                {
                  eyebrow: "CMO · VP COMMS · PR AGENCY",
                  title: "See your whole team at once.",
                  body: "Every executive. Every campaign. ERA CUE surfaces contradictions before they go public — and shows who approved what, when, and how long it took.",
                  full: false,
                },
                {
                  eyebrow: "CCO · GENERAL COUNSEL · RIA · BROKER-DEALER",
                  title: "The supervisory record examiners ask for.",
                  body: "ERA CUE produces the supervisory evidence FINRA Rule 3110 and Rule 2210(b) require — named principal review, structured decision basis, immutable audit trail.",
                  full: false,
                },
                {
                  eyebrow: "IR · GC · PUBLIC COMPANY",
                  title: "Reg FD documented before publication.",
                  body: "In 2024, the SEC charged a company $200,000 after its CEO’s account posted material information during a quiet period. ERA CUE checks for these violations before any executive communicates.",
                  full: false,
                },
                {
                  eyebrow: "INVESTMENT BANK · PRIVATE EQUITY · HEDGE FUND",
                  title: "Deal-specific quiet periods. Every person. Every platform.",
                  body: "Every deal, fundraise, and exit creates a window where the wrong post creates real exposure. ERA CUE applies deal-specific quiet periods across your team — partners, associates, portfolio companies — before anything goes out.",
                  full: true,
                },
              ].map((card) => (
                <div
                  key={card.eyebrow}
                  className={`bg-white/[0.04] border border-white/[0.08] rounded-lg p-5 border-l-[3px] hover:bg-white/[0.07] hover:border-l-[#7C6FCD] transition-all ${
                    card.full ? "md:col-span-2" : ""
                  }`}
                  style={{ borderLeftColor: "rgba(124,111,205,0.45)" }}
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/[0.28] mb-3">
                    {card.eyebrow}
                  </div>
                  <div className="text-[13px] font-medium text-white mb-2 leading-snug">
                    {card.title}
                  </div>
                  <p className="text-[12px] text-white/45 leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8 — COMMUNICATION RECORD (white)
          Two-column. Left: four colored-dot audience callouts. Right:
          a record mockup with a lavender header accent (not the dark
          slab we had before).
         ============================================================ */}
      <section className="bg-white py-16 md:py-20 px-6 md:px-12 border-t border-[#E5E7EB]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7C6FCD] mb-3">
              The output
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] mb-3 leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              One record. Four audiences.
            </h2>
            <p className="text-sm text-[#374151] leading-relaxed max-w-xl">
              ERA CUE generates a communication record for every governed
              draft. The same record serves the speaker, the CCO, the PR
              agency, and the regulator — each seeing exactly what they
              need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              {[
                {
                  dot: "#D97706",
                  who: "The executive",
                  what: "Was my draft approved? Can I publish it now?",
                },
                {
                  dot: "#1A56DB",
                  who: "The CCO or GC",
                  what: "Named principal review on record. Structured decision with basis. SHA-256 locked. FINRA-ready.",
                },
                {
                  dot: "#7C6FCD",
                  who: "The CMO or PR agency",
                  what: "Who approved what, when, across the campaign. Campaign record exportable as a client deliverable.",
                },
                {
                  dot: "#16A34A",
                  who: "The regulator or examiner",
                  what: "Complete supervisory evidence. Every check recorded. Every decision documented. Downloadable as PDF.",
                },
              ].map((row) => (
                <div key={row.who} className="flex gap-3 mb-4">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: row.dot }}
                    aria-hidden
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[#0D1B2A]">
                      {row.who}
                    </div>
                    <div className="text-[12px] text-[#374151] leading-relaxed">
                      {row.what}
                    </div>
                  </div>
                </div>
              ))}

              <Link
                href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
                className="font-mono text-[11px] text-[#1A56DB] hover:text-[#1447C0] mt-5 block transition-colors"
              >
                See a real communication record →
              </Link>
            </div>

            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="bg-[#0D1B2A] p-4 border-l-[4px] border-l-[#7C6FCD]">
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30 mb-1">
                  Communication record
                </div>
                <div className="text-[14px] font-medium text-white">
                  Q3 product launch — pricing announcement
                </div>
                <div className="font-mono text-[9px] text-white/30 mt-1">
                  Draft 7f3c… · cleared 2026-05-04
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-4 pb-3 border-b border-[#E5E7EB]">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#9CA3AF] mb-1">
                      Speaker
                    </div>
                    <div className="text-[12px] text-[#374151]">
                      Marcus Rivera, CEO
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#9CA3AF] mb-1">
                      Campaign
                    </div>
                    <div className="text-[12px] text-[#1A56DB]">
                      Q3 Product Launch
                    </div>
                  </div>
                </div>

                <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded p-3 text-[11px] italic text-[#374151] mb-4 leading-relaxed">
                  &ldquo;Our enterprise tier delivers measurable productivity
                  gains — customers report meaningful improvements within
                  the first quarter.&rdquo;
                </div>

                <div className="space-y-1.5 mb-4">
                  {[
                    "Rule check",
                    "Quiet period",
                    "Consistency",
                    "Alignment",
                    "Agent origin",
                  ].map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <span className="font-mono text-[10px] text-[#6B7280]">
                        {name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-[#16A34A]">
                        PASS
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#E5E7EB] pt-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B7280] mb-1">
                    Principal decision
                  </div>
                  <div className="text-[12px] text-[#0D1B2A] mb-1">
                    <span className="font-medium">Aiden Park</span>
                    <span className="text-[#6B7280]">
                      {" "}· General Counsel · approved
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-[#9CA3AF]">
                    Basis: aligns with approved messaging · 1m 47s review
                  </div>
                </div>
              </div>

              <div className="bg-[#FAFAFA] border-t border-[#E5E7EB] p-3 flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono text-[9px] text-[#9CA3AF]">
                  SHA-256 locked · FINRA Rule 3110 · Rule 2210(b)
                </span>
                <Link
                  href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
                  className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors"
                >
                  Download PDF →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 9 — BUILT DIFFERENT (lavender)
          Three icon cards on a lavender tint — corpus, audit trail,
          calibration. Each card states one structural property of the
          system that's provable in the database, not a marketing
          claim.
         ============================================================ */}
      <section className="bg-[#EDE9FF] py-16 md:py-20 px-6 md:px-12 border-t border-[#DDD6FE]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7C6FCD] mb-3">
              Built different
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] mb-3 leading-tight"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every claim is provable.
            </h2>
            <p className="text-sm text-[#374151] leading-relaxed max-w-xl">
              Three structural properties that come from how the database
              is built, not from a marketing statement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: "◎",
                title: "Principal-approved corpus",
                body: "Every communication approved through ERA CUE enters a governance corpus. Every new draft is checked against it — catching contradictions before they reach the public. Only principal-approved content enters.",
                tag: "Builds automatically · Principal-approved only",
              },
              {
                icon: "⬡",
                title: "SHA-256 locked audit trail",
                body: "Every governance decision is cryptographically hashed at the moment it is created. The database refuses UPDATE and DELETE — not just the application. The record cannot be altered.",
                tag: "Append-only · Database-enforced · Not a policy",
              },
              {
                icon: "◈",
                title: "Behavioral calibration",
                body: "Every reviewer decision — override, escalation, approval — teaches ERA CUE what this organization tolerates. Rules with high override rates get flagged for refinement.",
                tag: "Organization-specific · Learns over time · Reduces false positives",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white border border-[#DDD6FE] rounded-lg p-6 border-t-[3px] border-t-[#7C6FCD] hover:shadow-[0_4px_20px_rgba(124,111,205,0.15)] hover:-translate-y-[2px] transition-all duration-200"
              >
                <div className="text-[16px] text-[#7C6FCD] mb-3" aria-hidden>
                  {card.icon}
                </div>
                <div className="text-[13px] font-medium text-[#0D1B2A] mb-2 leading-snug">
                  {card.title}
                </div>
                <p className="text-[12px] text-[#374151] leading-relaxed mb-3">
                  {card.body}
                </p>
                <div className="font-mono text-[9px] text-[#7C6FCD]">
                  {card.tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10 — BOTTOM CTA (dark)
          Closes the page. Two CTAs + email line + the small legal
          disclaimer that names the three enforcement actions and
          disclaims legal advice / compliance guarantees in one
          paragraph.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-20 px-6 text-center">
        <div className="max-w-[600px] mx-auto">
          <h2
            className="text-3xl md:text-4xl font-light text-white mb-3 leading-tight"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            The full product. Live.
          </h2>

          <p className="text-[13px] text-white/45 leading-relaxed mb-8 max-w-sm mx-auto">
            No login required. Set up a rule, check a draft, see the
            communication record.
          </p>

          <div className="flex justify-center items-center gap-3 flex-wrap">
            <Link
              href="/rules"
              className="bg-[#1A56DB] text-white font-mono text-[11px] font-medium px-5 py-2.5 rounded-sm hover:bg-[#1447C0] hover:shadow-[0_0_0_3px_rgba(26,86,219,0.25)] transition-all"
            >
              Set up your rules →
            </Link>
            <a
              href="mailto:hello@eracue.com?subject=ERA%20CUE%20Access%20Request"
              className="bg-white/[0.07] text-white border border-white/[0.12] font-mono text-[11px] font-medium px-5 py-2.5 rounded-sm hover:bg-white/[0.12] transition-colors"
            >
              Request access →
            </a>
          </div>

          <div className="font-mono text-[10px] text-white/[0.18] mt-3">
            or email hello@eracue.com
          </div>

          <p className="font-mono text-[10px] text-white/15 mt-6 max-w-2xl mx-auto leading-relaxed">
            SEC v. DraftKings Inc., Release No. 34-101130 (Sept. 26, 2024)
            · FINRA v. M1 Finance LLC (March 18, 2024) · EU AI Act Art. 50,
            effective August 2, 2026. ERA CUE produces supervisory records
            and governance evidence. ERA CUE does not provide legal advice
            or guarantee regulatory compliance.
          </p>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          Demo disclaimer + the "· demo · May 2026" wordmark suffix
          render only when NEXT_PUBLIC_DEMO_MODE === "true".
         ============================================================ */}
      <footer className="bg-[#0D1B2A] border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-xs text-white/40 flex items-center gap-2">
            <span className="font-mono text-[13px] tracking-[0.06em] text-white">
              <span className="font-bold">ERA</span>
              <span className="italic font-light text-[#A5B4FC]"> CUE</span>
            </span>
            {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
              <span className="font-mono">· demo · May 2026</span>
            )}
          </div>
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <div className="text-xs text-white/40 md:text-center">
              Demo data only. No live customer information. The append-only
              audit trail and tamper-evident records shown are real database
              constraints — not simulated.
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
