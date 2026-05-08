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

// Regulatory section data. Five named enforcement actions in the left
// column ("five cases where the record did not exist") + three
// positive standards in the right column ("three standards ERA CUE
// operationalizes"). Failure panels carry an amber top border + a
// purple ERA CUE footer; positive panels carry a teal top border + a
// teal footer. Citations are to publicly available enforcement
// actions and statutory text.
const REGULATORY_PANELS = [
  {
    type: "failure" as const,
    badge: "Enforcement action",
    who: "Public companies · IR teams",
    name: "DraftKings Inc.",
    citation: "SEC Release No. 34-101198 · Sep 26, 2024",
    consequence: "$200,000 civil penalty",
    what: "A PR firm posted material nonpublic information on the CEO’s LinkedIn and X accounts during a quiet period — before Q2 earnings were released. The firm’s own social media policy required prior written approval. It was not obtained.",
    era: "Quiet-period rule fires at submission. The draft is blocked before it reaches any platform.",
  },
  {
    type: "failure" as const,
    badge: "Enforcement action",
    who: "Broker-dealers · Firms using third parties",
    name: "M1 Finance LLC",
    citation: "FINRA Disciplinary Proceeding · March 18, 2024",
    consequence: "$850,000 fine",
    what: "1,700 social media influencers promoted the firm without any registered principal reviewing content before it was posted. No supervisory records maintained. FINRA’s first influencer enforcement action.",
    era: "Named registered principal reviews and approves every third-party communication before it reaches the public. The approval is on record.",
  },
  {
    type: "failure" as const,
    badge: "Enforcement action",
    who: "Investment banks · PE firms · Deal teams",
    name: "Sixteen firms — off-channel communications",
    citation: "SEC Press Release No. 2024-18 · Feb 9, 2024",
    consequence: "$81M combined · 16 firms",
    what: "Firm employees communicated deal-sensitive information on personal WhatsApp, iMessage, and Signal. The firms could not produce required records during SEC investigations.",
    era: "Every governed communication creates an immutable supervisory record automatically. No off-channel gap.",
  },
  {
    type: "failure" as const,
    badge: "Enforcement action",
    who: "Registered investment advisers · Wealth managers",
    name: "Nine registered investment advisers",
    citation: "SEC Press Release No. 2024-121 · Sep 9, 2024",
    consequence: "$1,240,000 combined · 9 firms",
    what: "Advisers disseminated advertisements containing testimonials and endorsements without required disclosures. Marketing content published without adequate pre-approval or oversight.",
    era: "Testimonial and endorsement language is flagged before publication. Pre-approval is documented. The disclosure record is created automatically.",
  },
  {
    type: "failure" as const,
    badge: "Regulatory requirement",
    who: "All organizations using AI to draft content",
    name: "EU AI Act Article 50",
    citation: "Regulation (EU) 2024/1689 · August 2, 2026",
    consequence: "Up to €7.5M or 1.5% of global turnover",
    what: "AI systems generate and publish content on behalf of executives and organizations. No disclosure of AI origin. No documented human review. Article 50 requires both.",
    era: "AI origin logged at submission. Human review documented. Disclosure trail created automatically for every governed draft.",
  },
  {
    type: "positive" as const,
    badge: "What good looks like",
    who: "Broker-dealers · FINRA-regulated firms",
    name: "FINRA Rule 3110 — Supervision",
    citation: "FINRA Rule 3110(a) and 3110(b)(4)",
    consequence: "Named principal. Documented review. Written record.",
    what: "Member firms must establish, maintain, and enforce a supervisory system with written supervisory procedures reasonably designed to achieve compliance. Rule 3110(b)(4) requires review of electronic communications related to the firm’s securities business.",
    era: "Every draft submission creates the supervisory workflow evidence FINRA Rule 3110 requires — automatically, for every communication.",
  },
  {
    type: "positive" as const,
    badge: "What good looks like",
    who: "Registered investment advisers · RIAs",
    name: "SEC Marketing Rule 206(4)-1",
    citation: "Rule 206(4)-1 · Investment Advisers Act of 1940",
    consequence: "Pre-approval. Disclosure chain. Communication record.",
    what: "Advertisements containing testimonials or endorsements require clear and prominent disclosure of the relationship and any compensation, pre-publication oversight, and records maintained for five years.",
    era: "Testimonial and endorsement language is identified at submission. Pre-approval is required. The disclosure and approval record is created before content reaches any audience.",
  },
  {
    type: "positive" as const,
    badge: "Emerging governance standard",
    who: "Boards · General counsel · Risk officers · AI deployers",
    name: "Human oversight of AI-mediated communication",
    citation: "NIST AI RMF 1.0 · EU AI Act Art. 50 · Board duty of oversight",
    consequence: "Structured decision. Documented basis. Proof of human accountability.",
    what: "Boards are accountable for material operational risks — including AI systems acting on behalf of the organization. The NIST AI Risk Management Framework identifies human oversight and control as a core AI governance function. The EU AI Act requires deployers to implement appropriate human oversight before AI-generated content reaches the public.",
    era: "Every AI-assisted draft requires a structured human decision before it clears. The decision is documented with basis. The record proves a human was in the loop — before publication, every time.",
  },
] as const;

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
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.45] mb-4">
              Human oversight · AI 2026
            </div>

            <h1
              className="font-light text-4xl md:text-5xl text-white leading-[1.1] mb-4"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every executive communication.
              <br />
              <em className="italic font-light text-white/[0.62]">
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
                <span className="bg-[#0EA5E9] text-white font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm">
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
                    <span className="font-mono text-[9px] font-bold text-[#0EA5E9]">
                      PASS
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E2E8F0] pt-3 flex justify-between">
                <span className="font-mono text-[9px] text-[#94A3B8] inline-flex items-center">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-[#0EA5E9] mr-1.5"
                    aria-hidden
                  />
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
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.42] mr-2">
            Built for
          </span>
          {[
            { label: "Broker-dealers", bg: "#EEF2FF", text: "#4338CA" },
            { label: "RIAs", bg: "#E0F2FE", text: "#0369A1" },
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
          SECTION 4 — THE REGULATORY AND SUPERVISORY REALITY
          Two-column layout: five failure panels on the left ("five
          cases where the record did not exist"), three positive
          standards on the right ("three standards ERA CUE
          operationalizes"). Failure panels carry an amber top border
          + a purple ERA CUE footer; positive panels carry a teal top
          border + a teal footer. The semantic split makes the
          consequence/solution pairing legible at a glance.
         ============================================================ */}
      <section className="bg-[#0D1B2A] border-t border-white/[0.06] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10 max-w-3xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.40] mb-3">
              The regulatory and supervisory reality
            </div>
            <h2
              className="text-3xl font-light text-white leading-tight mb-4"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              The risk is no longer just bad content.
            </h2>
            <p className="text-base text-white/[0.65] leading-relaxed mb-2">
              The risk is unreviewed AI-assisted communication with no
              supervisory record.
            </p>
            <p className="text-sm text-white/[0.45] leading-relaxed">
              ERA CUE is the pre-publication control layer: rule
              checked, human reviewed, record created.
            </p>
          </div>

          {/* Two stacked rows of cards. Row 1 = five failure panels
              spanning the full width on desktop; row 2 = three
              positive panels. Each card uses flex-col + flex-1 on the
              middle section so cards in the same row land at equal
              height regardless of body length. */}
          <div className="space-y-6">
            {/* Row 1 — five failure panels */}
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.40] mb-3 pl-1">
                Five cases where the supervisory record did not exist
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {REGULATORY_PANELS.filter((p) => p.type === "failure").map(
                  (panel) => (
                    <div
                      key={panel.name}
                      className="bg-white rounded-lg overflow-hidden border-t-[3px] border-t-[#F59E0B] flex flex-col"
                    >
                      <div className="px-4 pt-4 pb-3 border-b border-[#E2E8F0]">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.5 rounded-sm inline-block mb-2">
                          {panel.badge}
                        </span>
                        <div className="text-xs font-semibold text-[#0D1B2A] mb-1 leading-snug">
                          {panel.name}
                        </div>
                        <div className="font-mono text-[9px] font-bold text-[#B91C1C] mb-1">
                          {panel.consequence}
                        </div>
                        <div className="font-mono text-[9px] text-[#94A3B8] leading-relaxed">
                          {panel.citation}
                        </div>
                      </div>

                      <div className="px-4 py-3 border-b border-[#E2E8F0] flex-1">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-1.5">
                          What happened
                        </div>
                        <p className="text-[11px] text-[#1E293B] leading-relaxed">
                          {panel.what}
                        </p>
                      </div>

                      <div className="px-4 py-3 bg-[#4F46E5]">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.62] mb-1.5">
                          With ERA CUE
                        </div>
                        <p className="text-[11px] text-white leading-relaxed">
                          {panel.era}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Row 2 — three positive panels */}
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.40] mb-3 pl-1">
                Three standards ERA CUE operationalizes
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {REGULATORY_PANELS.filter((p) => p.type === "positive").map(
                  (panel) => (
                    <div
                      key={panel.name}
                      className="bg-white rounded-lg overflow-hidden border-t-[3px] border-t-[#0EA5E9] flex flex-col"
                    >
                      <div className="px-4 pt-4 pb-3 border-b border-[#E2E8F0]">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#0369A1] bg-[#E0F2FE] border border-[#7DD3FC] px-1.5 py-0.5 rounded-sm inline-block mb-2">
                          {panel.badge}
                        </span>
                        <div className="text-xs font-semibold text-[#0D1B2A] mb-1 leading-snug">
                          {panel.name}
                        </div>
                        <div className="font-mono text-[9px] text-[#94A3B8]">
                          {panel.citation}
                        </div>
                      </div>

                      <div className="px-4 py-3 border-b border-[#E2E8F0] flex-1">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8] mb-1.5">
                          The requirement
                        </div>
                        <p className="text-[11px] text-[#1E293B] leading-relaxed">
                          {panel.what}
                        </p>
                      </div>

                      <div className="px-4 py-3 bg-[#0EA5E9]">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.62] mb-1.5">
                          ERA CUE operationalizes this
                        </div>
                        <p className="text-[11px] text-white leading-relaxed">
                          {panel.era}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Legal disclaimer */}
            <p className="font-mono text-[10px] text-white/[0.42] leading-relaxed">
              Regulatory citations are to publicly available enforcement
              actions and statutory text. ERA CUE does not provide legal
              advice. Consult qualified counsel regarding the
              applicability of these requirements to your organization.
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
            <p className="text-sm text-[#1E293B] leading-relaxed max-w-xl">
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
                <div className="border border-[#7DD3FC] bg-[#E0F2FE] rounded-sm px-3 py-1.5 font-mono text-[10px] font-bold text-[#0EA5E9]">
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
          SECTION A — WHO IT'S FOR (dark)
          Five role cards. Each card = role eyebrow + a value
          statement + a supporting sentence. The IB / PE / hedge-fund
          card spans the full width on its own row.
         ============================================================ */}
      <section className="bg-[#0D1B2A] border-t border-white/[0.06] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/[0.62] mb-3">
              Built for every role
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-white leading-tight"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              You&apos;ll know who you are
              <br />
              in three seconds.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                role: "Executive · Founder · CEO",
                value: "Know before you post.",
                detail:
                  "Paste a draft. ERA CUE tells you if it’s safe to publish — before anyone else sees it.",
                wide: false,
              },
              {
                role: "CCO · General Counsel · Broker-Dealer",
                value: "The supervisory record. Automatically.",
                detail:
                  "Named principal review. Structured decision. FINRA Rule 3110 satisfied in one submission.",
                wide: false,
              },
              {
                role: "CMO · VP Comms · PR Agency",
                value: "Every approval. One campaign view.",
                detail:
                  "See who approved what, when, and how long it took — across your entire team.",
                wide: false,
              },
              {
                role: "IR · GC · Public company",
                value: "Reg FD caught before publication.",
                detail:
                  "ERA CUE checks for quiet period violations before any executive communicates publicly.",
                wide: false,
              },
              {
                role: "Investment bank · PE · Hedge fund",
                value: "Deal quiet periods. Every person.",
                detail:
                  "Every deal creates a window where the wrong post creates real exposure. ERA CUE enforces it across your team.",
                wide: true,
              },
            ].map((card) => (
              <div
                key={card.role}
                className={`bg-white/[0.04] border border-white/[0.08] border-l-[3px] border-l-[#4F46E5] rounded-lg p-5 ${
                  card.wide ? "md:col-span-2" : ""
                }`}
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.58] mb-2">
                  {card.role}
                </div>
                <div className="text-sm font-medium text-white mb-2 leading-snug">
                  {card.value}
                </div>
                <p className="text-xs text-white/[0.62] leading-relaxed">
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION B — ONE CAMPAIGN. ONE RECORD. (white)
          Two-column. Left: a campaign-view card showing what the CCO
          sees (4 speakers, 8/2/1 stats). Right: a communication-record
          card showing what gets created for every draft. The two
          surfaces sit side-by-side so a visitor sees the input and
          the output at the same time.
         ============================================================ */}
      <section className="bg-white border-t border-[#E2E8F0] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-3">
              The output
            </div>
            <h2
              className="text-3xl md:text-4xl font-light text-[#0D1B2A] leading-tight mb-3"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              One campaign. One record.
            </h2>
            <p className="text-sm text-[#1E293B] max-w-xl leading-relaxed">
              ERA CUE tracks every communication across your team and
              produces an immutable record for every draft that passes
              through it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            {/* LEFT — campaign card */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B] mb-3">
                Campaign view — what the CCO sees
              </div>

              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="bg-[#0D1B2A] px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Q3 product launch
                    </div>
                    <div className="font-mono text-[9px] text-white/[0.58] mt-0.5">
                      Apr 1–Jun 30, 2026 · Governed by GC
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="font-mono text-base font-light text-[#0EA5E9]">
                        8
                      </div>
                      <div className="font-mono text-[9px] uppercase text-white/[0.52]">
                        Approved
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-base font-light text-[#F59E0B]">
                        2
                      </div>
                      <div className="font-mono text-[9px] uppercase text-white/[0.52]">
                        Pending
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-base font-light text-white/[0.52]">
                        1
                      </div>
                      <div className="font-mono text-[9px] uppercase text-white/[0.52]">
                        Blocked
                      </div>
                    </div>
                  </div>
                </div>

                {[
                  {
                    name: "Marcus Rivera · CEO",
                    meta: "LinkedIn · Series B",
                    status: "Approved",
                    time: "2h 14m",
                    ok: true,
                  },
                  {
                    name: "Lena Brooks · Chief Comms",
                    meta: "Press release · Q3",
                    status: "Approved",
                    time: "47m",
                    ok: true,
                  },
                  {
                    name: "James Kim · Head of IR",
                    meta: "LinkedIn · Price claim",
                    status: "Pending review",
                    time: "11:42 AM",
                    ok: false,
                  },
                  {
                    name: "Priya Patel · CMO",
                    meta: "Twitter · Campaign",
                    status: "Approved",
                    time: "1h 8m",
                    ok: true,
                  },
                ].map((row, i) => (
                  <div
                    key={row.name}
                    className={`px-5 py-3 flex items-center justify-between gap-3 flex-wrap ${
                      i < 3 ? "border-b border-[#E2E8F0]" : ""
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium text-[#0D1B2A]">
                        {row.name}
                      </div>
                      <div className="font-mono text-[9px] text-[#64748B] mt-0.5">
                        {row.meta}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-[9px] font-bold ${
                          row.ok ? "text-[#0EA5E9]" : "text-[#F59E0B]"
                        }`}
                      >
                        {row.status}
                      </div>
                      <div className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                        {row.time}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-mono text-[9px] text-[#94A3B8]">
                    Every speaker. Every channel.
                  </span>
                  <Link
                    href="/dashboard"
                    className="font-mono text-[9px] text-[#0EA5E9] hover:text-[#0369A1] transition-colors"
                  >
                    View full record →
                  </Link>
                </div>
              </div>

              <p className="text-xs text-[#1E293B] leading-relaxed mt-3">
                The CCO sees every executive, every draft, every decision
                — in one governed view. Who approved. Who&apos;s pending.
                How long it took.
              </p>
            </div>

            {/* RIGHT — communication record */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#64748B] mb-3">
                Communication record — what gets created for every draft
              </div>

              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="bg-[#0D1B2A] px-5 py-4 border-l-[4px] border-l-[#4F46E5]">
                  <div className="font-mono text-[9px] uppercase tracking-[0.11em] text-white/[0.58] mb-1.5">
                    ERA CUE · Communication record
                  </div>
                  <div className="text-sm font-medium text-white mb-1">
                    ✓ Approved for publication
                  </div>
                  <div className="font-mono text-[9px] text-white/[0.58]">
                    Reviewed by principal · May 6, 2026 at 10:23 AM
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="font-mono text-[9px] uppercase text-[#94A3B8] mb-1">
                        Speaker
                      </div>
                      <div className="text-xs font-medium text-[#0D1B2A]">
                        Marcus Rivera
                      </div>
                      <div className="font-mono text-[9px] text-[#64748B]">
                        CEO · LinkedIn
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase text-[#94A3B8] mb-1">
                        Campaign
                      </div>
                      <div className="text-xs font-medium text-[#4F46E5]">
                        Series B Announce
                      </div>
                      <div className="font-mono text-[9px] text-[#64748B]">
                        Apr 15–Jun 30, 2026
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-3 text-xs italic text-[#1E293B] leading-relaxed mb-3">
                    &ldquo;Customer trust is everything — building for the
                    long term.&rdquo;
                  </div>

                  <div className="font-mono text-[9px] uppercase text-[#94A3B8] mb-2">
                    Checks
                  </div>
                  {[
                    "Rule check",
                    "Quiet period",
                    "Consistency",
                    "Agent origin",
                  ].map((check) => (
                    <div
                      key={check}
                      className="flex justify-between py-1"
                    >
                      <span className="font-mono text-[9px] text-[#64748B]">
                        {check}
                      </span>
                      <span className="font-mono text-[9px] font-bold text-[#0EA5E9]">
                        PASS
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-[#E2E8F0] pt-3 mt-2">
                    <div className="font-mono text-[9px] uppercase text-[#94A3B8] mb-1">
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

                <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-5 py-3 flex justify-between items-center flex-wrap gap-3">
                  <span className="font-mono text-[9px] text-[#94A3B8]">
                    FINRA Rule 3110 · SEC 17a-4 · EU AI Act Art. 50
                  </span>
                  <Link
                    href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
                    className="font-mono text-[9px] text-[#0EA5E9] hover:text-[#0369A1] transition-colors"
                  >
                    ↓ PDF
                  </Link>
                </div>
              </div>

              <p className="text-xs text-[#1E293B] leading-relaxed mt-3">
                Every draft produces this record. Named principal. SHA-256
                locked. The evidence regulators, boards, and clients ask
                for.
              </p>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-[#E2E8F0]">
            <Link
              href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
              className="font-mono text-sm text-[#4F46E5] hover:text-[#4338CA] transition-colors"
            >
              See a real communication record →
            </Link>
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

          <p className="text-sm text-white/[0.65] mb-10 leading-relaxed max-w-sm mx-auto">
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
            SEC v. DraftKings Inc., Release No. 34-101198 (Sept. 26, 2024)
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
