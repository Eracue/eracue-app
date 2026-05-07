import Link from "next/link";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// `fetchCache = "force-no-store"` is the third lever that stops Next from
// memoising fetch() responses. Combined with the CDN-level no-store
// header in next.config and the page-level dynamic directive, this makes
// the route fully uncacheable end-to-end.
export const fetchCache = "force-no-store";

// Live communication record id used by the OUTPUT section's "see a real
// record" link. Kept as a constant so the demo data id is changeable
// in one place.
const CCO_EXAMINER_DRAFT_ID = "afe14696-5336-4336-a0b7-c3410477ec31";

// ---------- Page ---------------------------------------------------------

// Final homepage. Three-tone palette across the section bands:
//   #0D1B2A (dark)   — nav, hero, pills, regulatory, role + campaign
//   #FFFFFF (white)  — how it works, the output
//   #F8FAFC (off-white) — built different
//   gradient        — bottom CTA
// Headlines: Newsreader serif font-light text-3xl–text-5xl, sentence
// case (never all-caps). Body: text-sm leading-relaxed, text-[#1E293B]
// on light backgrounds, white/0.62+ on dark. Eyebrows / labels are
// font-mono text-[10px] uppercase tracking-[0.15em]. Status colors
// (red / amber / green) appear only on functional verdicts; purple
// (#4F46E5) is the brand accent everywhere else; amber (#F59E0B) is
// reserved for the regulatory penalty numbers.
export default function Home() {
  return (
    <div className="bg-[#0D1B2A] min-h-screen">
      <SiteHeader />

      {/* ============================================================
          SECTION 2 — HERO (dark, seamless with nav)
          Two-column. Left: eyebrow / italic-tail h1 / single subhead /
          two CTAs. Right: a CLEAR verdict mockup so the opening visual
          shows the everyday case and ERA CUE producing the record.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
          {/* LEFT — copy + CTAs */}
          <div className="md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.32] mb-4">
              Human oversight · AI 2026
            </div>

            <h1
              className="font-light text-4xl md:text-5xl text-white leading-[1.1] mb-4"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every executive communication.
              <br />
              <em className="italic font-light text-white/[0.42]">
                Checked. Approved. On record.
              </em>
            </h1>

            <p className="text-sm text-white/[0.58] leading-relaxed mb-8 max-w-[380px]">
              AI is drafting your team&apos;s communications. Agents are
              posting without human review. Nobody has a record that a
              person approved it.
            </p>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/rules"
                className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-[#4338CA] transition-colors"
              >
                Set up your rules →
              </Link>
              <Link
                href="/submit"
                className="bg-white/[0.07] text-white/[0.65] border border-white/[0.12] font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-white/[0.12] transition-colors"
              >
                See it working →
              </Link>
            </div>
          </div>

          {/* RIGHT — CLEAR verdict mockup. Hidden on mobile so the hero
              stays compact. Mirrors the production verdict card so a
              prospect sees what they'll see at /submit. */}
          <div className="md:col-span-2 hidden md:block">
            <div className="bg-white rounded-lg p-5 border-t-[3px] border-t-[#4F46E5] shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-[#94A3B8]">
                  Communication check
                </div>
                <div className="font-mono text-[9px] text-[#94A3B8]">
                  Verdict in seconds
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-3 text-xs italic text-[#1E293B] leading-relaxed mb-3">
                &ldquo;Customer trust is everything — building for the long
                term.&rdquo;
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#4F46E5] text-white font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm">
                  Cleared
                </span>
                <span className="text-xs font-medium text-[#0D1B2A]">
                  All checks passed
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                {[
                  "Rule check",
                  "Quiet period",
                  "Consistency",
                  "Alignment",
                  "Agent origin",
                ].map((name) => (
                  <div key={name} className="flex justify-between">
                    <span className="font-mono text-[9px] text-[#94A3B8]">
                      {name}
                    </span>
                    <span className="font-mono text-[9px] font-bold text-[#4F46E5]">
                      PASS
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E2E8F0] pt-3 flex justify-between">
                <span className="font-mono text-[9px] text-[#94A3B8]">
                  Principal approved
                </span>
                <span className="font-mono text-[9px] text-[#94A3B8]">
                  SHA-256 locked
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — PILLS (dark, seamless)
          Six firm-type chips on solid coloured backgrounds. Inline
          styles because Tailwind safe-listing every pair would balloon
          the bundle for a six-element row.
         ============================================================ */}
      <section className="bg-[#0D1B2A] border-t border-white/[0.06] py-5 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.30] mr-2">
            Built for
          </span>
          {[
            { label: "Broker-dealers", bg: "#EEF2FF", text: "#4338CA" },
            { label: "RIAs", bg: "#F0FDFA", text: "#0F766E" },
            { label: "Public companies", bg: "#FFFBEB", text: "#B45309" },
            { label: "Investment banks", bg: "#F8FAFC", text: "#334155" },
            { label: "PR agencies", bg: "#FFF1F2", text: "#BE123C" },
            { label: "Executive teams", bg: "#F5F3FF", text: "#6D28D9" },
          ].map((pill) => (
            <span
              key={pill.label}
              style={{ background: pill.bg, color: pill.text }}
              className="font-mono text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap"
            >
              {pill.label}
            </span>
          ))}
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — REGULATORY REALITY (dark, white cards)
          Three named enforcement actions. Penalty numbers in amber
          (#F59E0B); ERA CUE footer in solid #4F46E5 with white text.
          Each body capped at two sentences; ERA CUE response capped
          at one sentence. Hard limits.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-16 md:py-20 px-6 md:px-12 border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.32] mb-3">
              The regulatory reality
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white mb-3 leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Three regulations. Real consequences.
            </h2>
            <p className="text-sm text-white/[0.48] leading-relaxed max-w-xl">
              Real cases from the last 18 months. No communication was
              reviewed before it was published.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                type: "Public company · SEC Reg FD",
                amount: "$200,000",
                amountLabel: "SEC penalty · 2024",
                bodyLabel: "What happened",
                body: "DraftKings’ PR firm posted on the CEO’s LinkedIn during an earnings quiet period. Revenue data reached investors before Q2 results.",
                cite: "SEC Release 34-101130 · Sep 26, 2024",
                era: "Quiet period rule fires on submission. Draft blocked before it reaches LinkedIn.",
              },
              {
                type: "Broker-dealer · FINRA 2210+3110",
                amount: "$850,000",
                amountLabel: "FINRA fine · 2024",
                bodyLabel: "What happened",
                body: "A broker-dealer paid influencers to post on its behalf. No registered principal reviewed any content. No records maintained.",
                cite: "FINRA Enforcement · Mar 18, 2024",
                era: "Every post reviewed by a named principal. The approval record satisfies Rule 3110 automatically.",
              },
              {
                type: "All organizations · EU AI Act",
                amount: "Aug 2026",
                amountLabel: "Article 50 · enforceable",
                bodyLabel: "The gap",
                body: "AI drafts content. Executives post it. No record of human review. Article 50 requires disclosure of AI origin before publication.",
                cite: "EU AI Act Art. 50 · August 2, 2026",
                era: "AI origin recorded at submission. Human review documented. Disclosure trail created automatically.",
              },
            ].map((card) => (
              <div
                key={card.amount}
                className="bg-white rounded-lg overflow-hidden border-t-[3px] border-t-[#4F46E5]"
              >
                <div className="p-5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#64748B] mb-2">
                    {card.type}
                  </div>
                  <div
                    className="font-mono text-[26px] font-bold text-[#F59E0B] leading-none mb-1"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {card.amount}
                  </div>
                  <div className="font-mono text-[9px] text-[#94A3B8]">
                    {card.amountLabel}
                  </div>
                </div>

                <div className="h-px bg-[#E2E8F0] mx-5" />

                <div className="p-5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-2">
                    {card.bodyLabel}
                  </div>
                  <p className="text-sm text-[#1E293B] leading-relaxed mb-2">
                    {card.body}
                  </p>
                  <div className="font-mono text-[9px] text-[#94A3B8]">
                    {card.cite}
                  </div>
                </div>

                <div className="bg-[#4F46E5] p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.55] mb-1.5">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-white leading-relaxed">
                    {card.era}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-6">
            <p className="font-mono text-xs text-white/[0.28] max-w-xl mx-auto leading-relaxed">
              ERA CUE produces the supervisory evidence each of these
              regulations requires — before publication.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — STEPS (white)
          Three step cards + a decision-flow diagram. Step body capped
          at two sentences each. The flow diagram makes "what BLOCKED
          vs CLEARED actually means" explicit.
         ============================================================ */}
      <section className="bg-white py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-3">
              HOW IT WORKS
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] mb-3 leading-tight"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Three steps. Every draft.
            </h2>
            <p className="text-sm text-[#475569] leading-relaxed max-w-xl">
              Configure once. Check every draft. Record who approved.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[
              {
                label: "01 — Configure",
                title: "Set your governance rules",
                body: "The CCO sets rules once — from regulatory templates, Written Supervisory Procedures (WSP), or from scratch. Authorized by a named principal.",
                tag: "WSP import · FINRA templates · AI-assisted",
              },
              {
                label: "02 — Check",
                title: "Check before you publish",
                body: "Any executive — or AI agent on their behalf — submits a draft. ERA CUE runs five checks against active rules. Verdict in seconds.",
                tag: "Five checks · Verdict in seconds · Principal review if needed",
              },
              {
                label: "03 — Record",
                title: "Record who approved",
                body: "ERA CUE creates an immutable record — named principal, structured decision, SHA-256 locked. Ready for any regulator.",
                tag: "SHA-256 locked · Append-only · FINRA Rule 3110",
              },
            ].map((step) => (
              <div
                key={step.label}
                className="bg-[#F8FAFC] border border-[#E2E8F0] border-l-[4px] border-l-[#4F46E5] rounded-lg p-6"
              >
                <div className="font-mono text-[10px] font-bold text-[#4F46E5] tracking-[0.04em] mb-4">
                  {step.label}
                </div>
                <div className="text-sm font-medium text-[#0D1B2A] mb-2 leading-snug">
                  {step.title}
                </div>
                <p className="text-sm text-[#1E293B] leading-relaxed mb-3">
                  {step.body}
                </p>
                <div className="font-mono text-[9px] text-[#64748B]">
                  {step.tag}
                </div>
              </div>
            ))}
          </div>

          {/* Decision flow — four nodes (draft → checks → verdict
              chips → record). Wraps to two rows on narrow viewports. */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-4">
              Decision flow
            </div>
            <div className="flex items-center flex-wrap md:flex-nowrap gap-0">
              <div className="flex-1 text-center min-w-[120px]">
                <div className="font-mono text-[10px] font-medium text-[#1E293B]">
                  Draft created
                </div>
                <div className="font-mono text-[9px] text-[#94A3B8] mt-1">
                  Human or agent
                </div>
              </div>
              <span
                className="text-[#CBD5E1] font-mono text-sm px-3"
                aria-hidden
              >
                →
              </span>
              <div className="flex-1 text-center min-w-[120px]">
                <div className="font-mono text-[10px] font-medium text-[#1E293B]">
                  ERA CUE checks
                </div>
                <div className="font-mono text-[9px] text-[#94A3B8] mt-1">
                  5 checks · seconds
                </div>
              </div>
              <span
                className="text-[#CBD5E1] font-mono text-sm px-3"
                aria-hidden
              >
                →
              </span>
              <div className="flex flex-col gap-1.5 flex-[1.4] min-w-[180px]">
                <div className="border border-[#FECACA] bg-[#FEE2E2] rounded-sm px-3 py-1.5 font-mono text-[10px] font-bold text-[#B91C1C]">
                  Blocked → principal review
                </div>
                <div className="border border-[#C7D7FE] bg-[#EEF2FF] rounded-sm px-3 py-1.5 font-mono text-[10px] font-bold text-[#4F46E5]">
                  Cleared → publish
                </div>
              </div>
              <span
                className="text-[#CBD5E1] font-mono text-sm px-3"
                aria-hidden
              >
                →
              </span>
              <div className="flex-1 text-center min-w-[120px]">
                <div className="font-mono text-[10px] font-medium text-[#1E293B]">
                  Record created
                </div>
                <div className="font-mono text-[9px] text-[#94A3B8] mt-1">
                  SHA-256 · permanent
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — ROLE CARDS (dark)
          Five role cards in a 2-col grid; card 5 spans both columns.
          Each card = role eyebrow + a five-words-or-less value
          statement + ONE supporting sentence. No links.
         ============================================================ */}
      <section className="bg-[#0D1B2A] py-16 md:py-20 px-6 md:px-12 border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.32] mb-3">
              Built for every role
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              From the executive drafting to the examiner reviewing.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                role: "Executive · Founder · CEO",
                title: "Know before you post.",
                body: "ERA CUE checks your draft against active rules before anyone sees it.",
                full: false,
              },
              {
                role: "CMO · VP Comms · PR Agency",
                title: "See your whole team at once.",
                body: "Every executive. Every campaign. Who approved what, when.",
                full: false,
              },
              {
                role: "CCO · General Counsel · Broker-Dealer",
                title: "The supervisory record examiners ask for.",
                body: "Named principal review. Structured decision. FINRA Rule 3110 satisfied.",
                full: false,
              },
              {
                role: "IR · GC · Public company",
                title: "Reg FD documented before publication.",
                body: "ERA CUE checks for quiet period violations before any executive communicates publicly.",
                full: false,
              },
              {
                role: "Investment bank · PE · Hedge fund",
                title: "Deal-specific quiet periods. Every person. Every platform.",
                body: "Every deal creates a window where the wrong post creates real exposure. ERA CUE applies deal-specific quiet periods across your entire team.",
                full: true,
              },
            ].map((card) => (
              <div
                key={card.role}
                className={`bg-white/[0.04] border border-white/[0.08] border-l-[3px] border-l-[#4F46E5] rounded-lg p-5 ${
                  card.full ? "md:col-span-2" : ""
                }`}
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.30] mb-2">
                  {card.role}
                </div>
                <div className="text-sm font-medium text-white mb-2 leading-snug">
                  {card.title}
                </div>
                <p className="text-xs text-white/[0.52] leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7 — CAMPAIGN VIEW (dark, seamless with role cards)
          Two-column: a campaign-record card on the left + a "who uses
          it" role list on the right. Status colors: purple-mid for
          approved, amber for pending, white-dim for blocked.
         ============================================================ */}
      <section className="bg-[#0D1B2A] border-t border-white/[0.06] pt-16 md:pt-20 pb-16 md:pb-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.32] mb-3">
              Campaign governance
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white mb-3 leading-tight max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every executive. One view.
            </h2>
            <p className="text-sm text-white/[0.48] leading-relaxed max-w-xl">
              See who approved, who&apos;s pending, how long each review
              took.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div className="bg-white/[0.05] border border-white/[0.10] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-medium text-white">
                    Q3 product launch
                  </div>
                  <div className="font-mono text-[9px] text-white/[0.28] mt-0.5">
                    Apr 1–Jun 30, 2026 · GC
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#818CF8]">
                      8
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.30]">
                      Approved
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#F59E0B]">
                      2
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.30]">
                      Pending
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-white/[0.30]">
                      1
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.30]">
                      Blocked
                    </div>
                  </div>
                </div>
              </div>

              {[
                {
                  name: "Marcus Rivera",
                  role: "CEO",
                  meta: "LinkedIn · Series B",
                  status: "Approved",
                  statusColor: "#818CF8",
                  time: "2h 14m review",
                },
                {
                  name: "Lena Brooks",
                  role: "Chief Comms",
                  meta: "Press release · Q3",
                  status: "Approved",
                  statusColor: "#818CF8",
                  time: "47m review",
                },
                {
                  name: "James Kim",
                  role: "Head of IR",
                  meta: "LinkedIn · Price claim",
                  status: "Pending",
                  statusColor: "#F59E0B",
                  time: "11:42 AM today",
                },
                {
                  name: "Priya Patel",
                  role: "CMO",
                  meta: "Twitter · Campaign",
                  status: "Approved",
                  statusColor: "#818CF8",
                  time: "1h 8m review",
                },
              ].map((row) => (
                <div
                  key={row.name}
                  className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-wrap"
                >
                  <div>
                    <div className="text-xs font-medium text-white/[0.75]">
                      {row.name}{" "}
                      <span className="font-mono text-[9px] text-white/[0.28] ml-1">
                        · {row.role}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-white/[0.28] mt-0.5">
                      {row.meta}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-mono text-[9px] font-bold"
                      style={{ color: row.statusColor }}
                    >
                      {row.status}
                    </div>
                    <div className="font-mono text-[9px] text-white/[0.22] mt-0.5">
                      {row.time}
                    </div>
                  </div>
                </div>
              ))}

              <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono text-[9px] text-white/[0.18]">
                  Every speaker. Every channel.
                </span>
                <Link
                  href="/dashboard"
                  className="font-mono text-[9px] text-[#818CF8] hover:text-white transition-colors"
                >
                  View record →
                </Link>
              </div>
            </div>

            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.28] mb-4">
                Who uses the campaign record
              </div>
              {[
                {
                  role: "PR agency",
                  use: "Client deliverable. Every approval, timing, and decision on record.",
                },
                {
                  role: "CCO",
                  use: "Supervisory evidence for the full campaign window. FINRA-ready.",
                },
                {
                  role: "Examiner",
                  use: "Named principal, timing, decision basis. Downloadable PDF.",
                },
              ].map((item) => (
                <div key={item.role} className="flex gap-4 mb-4">
                  <div className="font-mono text-xs text-[#818CF8] w-24 shrink-0 pt-0.5">
                    {item.role}
                  </div>
                  <div className="text-sm text-white/[0.48] leading-relaxed">
                    {item.use}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8 — THE OUTPUT (white)
          Two-column. Left: four colored-dot audience callouts (each
          one sentence). Right: a record mockup card with a #4F46E5
          left-border accent on the dark header.
         ============================================================ */}
      <section className="bg-white py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-3">
              The output
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] mb-3 leading-tight"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              One record. Four audiences.
            </h2>
            <p className="text-sm text-[#475569] leading-relaxed max-w-xl">
              The same record serves every stakeholder.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              {[
                {
                  who: "The executive",
                  what: "Was my draft approved? Can I publish it now?",
                },
                {
                  who: "The CCO or GC",
                  what: "Named principal review. Structured decision. SHA-256 locked.",
                },
                {
                  who: "The CMO or PR agency",
                  what: "Who approved what, when, across the campaign. Client deliverable.",
                },
                {
                  who: "The regulator or examiner",
                  what: "Every check. Every decision. Principal identity. PDF export.",
                },
              ].map((row) => (
                <div key={row.who} className="flex gap-3 mb-5">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0 mt-1.5"
                    aria-hidden
                  />
                  <div>
                    <div className="text-sm font-medium text-[#0D1B2A] mb-0.5">
                      {row.who}
                    </div>
                    <div className="text-xs text-[#475569] leading-relaxed">
                      {row.what}
                    </div>
                  </div>
                </div>
              ))}

              <Link
                href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
                className="font-mono text-sm text-[#4F46E5] mt-6 block hover:text-[#4338CA] transition-colors"
              >
                See a real communication record →
              </Link>
            </div>

            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
              <div className="bg-[#0D1B2A] px-5 py-4 border-l-[4px] border-l-[#4F46E5]">
                <div className="font-mono text-[9px] uppercase text-white/[0.30] mb-1.5 tracking-[0.12em]">
                  ERA CUE · Communication record
                </div>
                <div className="text-sm font-medium text-white mb-1">
                  ✓ Approved for publication
                </div>
                <div className="font-mono text-[9px] text-white/[0.30]">
                  Reviewed by principal · May 6, 2026 at 10:23 AM
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-3 mb-4 pb-3 border-b border-[#E2E8F0]">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-1">
                      Speaker
                    </div>
                    <div className="text-xs font-medium text-[#0D1B2A]">
                      Marcus Rivera
                    </div>
                    <div className="font-mono text-[9px] text-[#64748B] mt-0.5">
                      CEO · LinkedIn
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-1">
                      Campaign
                    </div>
                    <div className="text-xs text-[#4F46E5]">
                      Series B Announce
                    </div>
                    <div className="font-mono text-[9px] text-[#64748B] mt-0.5">
                      Apr 15–Jun 30, 2026
                    </div>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-3 text-xs italic text-[#1E293B] leading-relaxed mb-3">
                  &ldquo;Customer trust is everything — building for the
                  long term.&rdquo;
                </div>

                <div className="mb-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-2">
                    Checks
                  </div>
                  <div className="space-y-1">
                    {[
                      "Rule check",
                      "Quiet period",
                      "Consistency",
                      "Agent origin",
                    ].map((name) => (
                      <div
                        key={name}
                        className="flex justify-between"
                      >
                        <span className="font-mono text-[9px] text-[#64748B]">
                          {name}
                        </span>
                        <span className="font-mono text-[9px] font-bold text-[#4F46E5]">
                          PASS
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-3 mt-1">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-1">
                    Principal decision
                  </div>
                  <div className="text-xs text-[#1E293B] mb-1">
                    Approved · Content complies with applicable rules
                  </div>
                  <div className="font-mono text-[9px] text-[#94A3B8]">
                    SHA-256: a4f8c2e1… · Append-only · Cannot be altered
                  </div>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono text-[9px] text-[#94A3B8]">
                  FINRA Rule 3110 · SEC 17a-4 · EU AI Act Art. 50
                </span>
                <span className="font-mono text-[9px] text-[#4F46E5] cursor-pointer">
                  ↓ Download PDF
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 9 — BUILT DIFFERENT (off-white)
          Three icon cards on a #F8FAFC background. Each card body
          capped at two sentences.
         ============================================================ */}
      <section className="bg-[#F8FAFC] py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-3">
              Built different
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] leading-tight"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every claim is provable.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: "◎",
                title: "Principal-approved corpus",
                body: "Every approved communication enters a governance corpus. Every new draft is checked against it automatically.",
                tag: "Builds automatically · Principal-approved only",
              },
              {
                icon: "⬡",
                title: "SHA-256 locked audit trail",
                body: "Every decision is cryptographically hashed at creation. The database refuses UPDATE and DELETE.",
                tag: "Append-only · Database-enforced · Not a policy",
              },
              {
                icon: "◈",
                title: "Behavioral calibration",
                body: "Every reviewer decision teaches ERA CUE what this organization tolerates. False positives get flagged automatically.",
                tag: "Organization-specific · Gets smarter over time",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white border border-[#E2E8F0] border-t-[3px] border-t-[#4F46E5] rounded-lg p-6"
              >
                <div className="text-lg text-[#4F46E5] mb-3" aria-hidden>
                  {card.icon}
                </div>
                <div className="text-sm font-medium text-[#0D1B2A] mb-2">
                  {card.title}
                </div>
                <p className="text-sm text-[#1E293B] leading-relaxed mb-3">
                  {card.body}
                </p>
                <div className="font-mono text-[9px] text-[#64748B]">
                  {card.tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10 — BOTTOM CTA (gradient dark → indigo)
          Closes the page. Two CTAs + email line + small legal
          disclaimer naming the three enforcement actions.
         ============================================================ */}
      <section
        className="py-20 px-6 text-center"
        style={{
          background:
            "linear-gradient(135deg, #0D1B2A 0%, #1E1B4B 100%)",
        }}
      >
        <div className="max-w-[600px] mx-auto">
          <h2
            className="text-3xl font-light text-white mb-3 leading-tight"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            The full product. Live.
          </h2>

          <p className="text-sm text-white/[0.48] mb-10 leading-relaxed max-w-sm mx-auto">
            No login required. Set up a rule, check a draft, see the
            communication record.
          </p>

          <div className="flex justify-center gap-3 mb-4 flex-wrap">
            <Link
              href="/rules"
              className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-[#4338CA] transition-colors"
            >
              Set up your rules →
            </Link>
            <a
              href="mailto:hello@eracue.com?subject=ERA%20CUE%20Access%20Request"
              className="bg-white/[0.07] text-white/[0.65] border border-white/[0.12] font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-white/[0.12] transition-colors"
            >
              Request access →
            </a>
          </div>

          <div className="font-mono text-[10px] text-white/[0.22]">
            or email hello@eracue.com
          </div>

          <p className="font-mono text-[10px] text-white/[0.14] mt-8 max-w-2xl mx-auto leading-relaxed text-center">
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
              <span className="italic font-light"> CUE</span>
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
