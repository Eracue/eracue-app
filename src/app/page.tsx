import Link from "next/link";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// `fetchCache = "force-no-store"` is the third lever that stops Next from
// memoising fetch() responses inside the route handler. Combined with the
// CDN-level no-store header in next.config and the page-level dynamic
// directive, this makes the route fully uncacheable end-to-end. Required
// because Vercel's ISR was serving a months-old prerender of this page.
export const fetchCache = "force-no-store";

// Section 3 ("The proof") routes the reader to a real BLOCK record on
// the live demo. Kept as a constant so the demo data id is changeable
// in one place.
const CCO_EXAMINER_DRAFT_ID = "afe14696-5336-4336-a0b7-c3410477ec31";

// ---------- Small reusable pieces -----------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-[#64748B]">
      {children}
    </div>
  );
}

function VerdictBlockBadge() {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-sm border bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] text-xs font-mono font-bold tracking-widest">
      BLOCK
    </span>
  );
}

function CheckRow({ name, result }: { name: string; result: "PASS" | "FAIL" }) {
  const dotColor = result === "PASS" ? "#166534" : "#B91C1C";
  return (
    <li className="flex items-center gap-2 text-sm font-mono mt-2">
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, backgroundColor: dotColor }}
      />
      <span className="text-[#0F172A]">{name}</span>
      <span className="text-[#64748B]">· {result}</span>
    </li>
  );
}

// ---------- Page ----------------------------------------------------------

export default function Home() {
  return (
    <div className="bg-[#F8F9FB] min-h-screen">
      <SiteHeader />

      {/* ============================================================
          SECTION 1 — HERO (dark, two-column)
          Left col: eyebrow / headline / two subheads / workflow strip /
          two CTAs / hint. Right col: CLEAR verdict mockup card so the
          opening visual mirrors the everyday case (most drafts pass).
         ============================================================ */}
      <section className="bg-[#0F172A] py-24 md:py-32">
        <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
          {/* LEFT — copy + CTAs */}
          <div className="md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-8">
              Human oversight · AI 2026
            </div>

            <h1
              className="font-light leading-[1.1] tracking-tight text-white text-5xl md:text-7xl mb-6 max-w-2xl"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              Every executive
              <br />
              communication.
              <br />
              Checked. Approved.
              <br />
              On record.
            </h1>

            <p className="text-lg text-white/60 max-w-lg mb-3 leading-relaxed">
              AI is drafting your team&apos;s communications. Agents are posting without human review. Nobody has a record that a person actually approved it.
            </p>

            <p className="font-mono text-sm text-white/40 max-w-lg mb-10">
              ERA CUE is the human checkpoint between AI and publication — where rules fire, principals decide, and records are created.
            </p>

            {/* Workflow strip — first scan answers "what's the loop?"
                without prose. Every label is the verb the corresponding
                role already thinks in. */}
            <div className="flex items-center gap-4 flex-wrap mb-10">
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">
                01 Configure rules
              </span>
              <span className="text-white/15 font-mono" aria-hidden>
                →
              </span>
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">
                02 Check every draft
              </span>
              <span className="text-white/15 font-mono" aria-hidden>
                →
              </span>
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">
                03 Record who approved
              </span>
            </div>

            <div className="flex gap-3 flex-wrap">
              <a
                href="/rules"
                className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-6 py-3.5 rounded-sm hover:bg-[#1447C0] transition-colors"
              >
                Set up your rules →
              </a>
              <a
                href="/submit"
                className="bg-white/8 text-white/80 border border-white/15 font-mono text-sm font-medium px-6 py-3.5 rounded-sm hover:bg-white/15 transition-colors"
              >
                See it working →
              </a>
            </div>

            <div className="font-mono text-[10px] text-white/20 mt-4">
              Rules configure once · checks run on every draft · records are permanent
            </div>
          </div>

          {/* RIGHT — coded CLEAR verdict mockup, hidden on mobile so the
              hero stays compact. Mirrors the production verdict card so
              what the prospect sees here matches what they'll see at
              /submit. CLEAR (not BLOCK) so the opening visual reads as
              "the everyday case" — Section 3 below shows BLOCK. */}
          <div className="md:col-span-2 hidden md:block">
            <div className="bg-white rounded-sm shadow-2xl shadow-black/50 p-5 max-w-xs border border-white/5 mx-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                  Communication check
                </div>
                <div className="font-mono text-[10px] text-[#94A3B8]">
                  Verdict in seconds
                </div>
              </div>

              <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-3 text-xs italic text-[#374151] leading-relaxed mb-4">
                &ldquo;Customer trust is everything — building for the long term.&rdquo;
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-sm border">
                  CLEAR
                </span>
                <span className="text-sm text-[#374151] ml-1">All checks passed</span>
              </div>

              {/* Five checks — name + result, mono'd for ledger feel */}
              <div className="space-y-1.5 mb-4">
                {[
                  "Rule Check",
                  "Quiet Period",
                  "Consistency",
                  "Alignment",
                  "Agent Origin",
                ].map((name) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#64748B]">{name}</span>
                    <span className="font-mono text-[10px] font-bold text-[#166534]">
                      PASS
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E2E8F0] pt-3 space-y-1">
                <div className="font-mono text-[10px] text-[#64748B] flex justify-between">
                  <span>Principal approved</span>
                  <span>✓ Cleared</span>
                </div>
                <div className="font-mono text-[10px] text-[#94A3B8]">
                  SHA-256 locked · cannot be altered
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — THE REGULATORY REALITY
          Three named enforcement actions, each rendered as a panel
          with a header strip (badge + rule + penalty), and a body
          that splits into "what happened" / "the rule" / "with ERA
          CUE". Replaces an abstract three-card layout that named
          consequences without grounding them in named cases. The
          DraftKings, FINRA influencer, and EU AI Act references move
          out of the page-bottom footnotes into the section itself —
          a reader sees the citation next to the claim it supports.
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          {/* Section header */}
          <div className="mb-12">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              The regulatory reality
            </div>
            <h2
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl md:text-4xl font-light text-[#0F172A] mb-3 leading-tight max-w-2xl"
            >
              Three regulations. Three consequences. One checkpoint.
            </h2>
            <p className="text-sm text-[#64748B] max-w-xl leading-relaxed">
              Each of these enforcement actions happened in the last 18 months. Each involved communications that were not reviewed before publication.
            </p>
          </div>

          {/* Three panels */}
          <div className="space-y-4">
            {/* Panel 1 — DraftKings / Reg FD */}
            <div className="border border-[#E2E8F0] rounded-sm overflow-hidden">
              {/* Panel header */}
              <div className="bg-[#F8F9FB] px-6 py-3 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                    Public company
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">
                    SEC Regulation FD
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#B91C1C]">
                  $200,000 penalty
                </span>
              </div>

              {/* Panel body */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                {/* The case */}
                <div className="p-6 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    What happened
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-2">
                    DraftKings&apos; PR firm posted on the CEO&apos;s personal LinkedIn and X accounts during an earnings quiet period — disclosing revenue growth data before Q2 results were released.
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    The posts were live 30 minutes. DraftKings&apos; own social media policy required prior written approval. It wasn&apos;t obtained.
                  </p>
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-3">
                    SEC Release No. 34-101130 · September 26, 2024
                  </div>
                </div>

                {/* The regulation */}
                <div className="p-6 md:border-r border-[#E2E8F0] bg-white">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    The rule
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    SEC Regulation FD
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    Prohibits selective disclosure of material nonpublic information. Applies to posts by persons acting on a company&apos;s behalf — including PR firms posting on executive personal accounts.
                  </p>
                </div>

                {/* ERA CUE response */}
                <div className="p-6 bg-[#F0FDF4]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-3">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    The PR firm submits the draft to ERA CUE. The quiet period rule fires. The draft is blocked. A named principal reviews and decides. The record is created before anything reaches LinkedIn.
                  </p>
                </div>
              </div>
            </div>

            {/* Panel 2 — FINRA / Broker-Dealer */}
            <div className="border border-[#E2E8F0] rounded-sm overflow-hidden">
              <div className="bg-[#F8F9FB] px-6 py-3 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">
                    Broker-Dealer
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">
                    FINRA Rules 2210(b) + 3110
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#C2410C]">
                  $850,000 fine
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                <div className="p-6 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    What happened
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-2">
                    A broker-dealer paid social media influencers to promote the firm. No registered principal reviewed or approved content before posting. No records were maintained.
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    FINRA&apos;s first disciplinary action involving social media influencer supervision.
                  </p>
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-3">
                    FINRA Enforcement · March 18, 2024
                  </div>
                </div>

                <div className="p-6 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    The rule
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    FINRA Rules 2210(b) + 3110
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    Retail communications require registered principal pre-approval. Firms must establish written supervisory procedures for social media — including communications by third parties acting on the firm&apos;s behalf.
                  </p>
                </div>

                <div className="p-6 bg-[#F0FDF4]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-3">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    Every influencer or agency submits drafts through ERA CUE before posting. A registered principal reviews and approves each one. The record proves supervision occurred — exactly what FINRA Rule 3110 requires.
                  </p>
                </div>
              </div>
            </div>

            {/* Panel 3 — EU AI Act */}
            <div className="border border-[#E2E8F0] rounded-sm overflow-hidden">
              <div className="bg-[#F8F9FB] px-6 py-3 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
                    All organizations
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">
                    EU AI Act Article 50
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#7C3AED]">
                  Enforceable August 2026
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                <div className="p-6 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    The requirement
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-2">
                    AI-generated communications must be disclosed as artificially generated. Organizations must ensure AI-drafted content is marked and traceable.
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    The obligation applies to deployers — including organizations using AI to draft public communications on behalf of executives.
                  </p>
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-3">
                    EU AI Act Art. 50 · Effective August 2, 2026
                  </div>
                </div>

                <div className="p-6 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    What&apos;s missing
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    Most organizations have no record.
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    AI drafts content. Executives post it. No disclosure. No approval trail. No evidence that a human reviewed it before publication. Article 50 requires all three.
                  </p>
                </div>

                <div className="p-6 bg-[#F0FDF4]">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-3">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    ERA CUE records AI involvement at the moment of submission, documents the human review decision, and produces the disclosure trail Article 50 requires — automatically, for every governed draft.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom line — single sentence framing the three panels
              as one shared problem ERA CUE solves. */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#64748B] max-w-xl mx-auto leading-relaxed">
              ERA CUE is the pre-publication checkpoint that produces the supervisory evidence each of these regulations requires — in one governed submission.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — THE PROOF
          Live BLOCK scenario card — the engine catching a quiet-period
          violation in real time. Three-column grid: draft, verdict,
          checks. Closes with a transition into the principal queue +
          link to the live communication record.
         ============================================================ */}
      <section className="bg-[#F8F9FB] border-y border-[#E2E8F0] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <Eyebrow>Live product · Real check</Eyebrow>
          <h2
            className="text-2xl font-light text-[#0F172A] mt-2 mb-1"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            A quiet period violation. Caught before it published.
          </h2>
          <p className="text-sm text-[#64748B] mb-8">
            ERA CUE caught it before it went live. Here is the complete record.
          </p>

          {/* Evidence artifact — left blue rule grounds the card to the
              brand accent and visually anchors the verdict that follows. */}
          <div className="bg-white border border-[#E2E8F0] border-l-4 border-l-[#1A56DB] rounded-sm p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1 — Draft */}
              <div>
                <Eyebrow>DRAFT · CEO · LINKEDIN · AI ASSISTED</Eyebrow>
                <p
                  className="italic text-lg md:text-xl text-[#0F172A] mt-3 leading-snug"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  &ldquo;We&apos;re aggressively hiring across engineering and sales — exciting times ahead for the team.&rdquo;
                </p>
              </div>

              {/* Column 2 — Verdict */}
              <div>
                <Eyebrow>SYSTEM VERDICT</Eyebrow>
                <div className="mt-3">
                  <VerdictBlockBadge />
                </div>
                <div className="text-sm font-medium text-[#0F172A] mt-3">
                  Series B Quiet Period
                </div>
                <p className="text-sm text-[#374151] mt-1 leading-relaxed">
                  No hiring, growth, or fundraising language during quiet period.
                </p>
                <div className="mt-3">
                  <span className="font-mono text-xs bg-[#F1F5F9] text-[#1A56DB] px-2 py-0.5 rounded-sm inline-block">
                    hiring
                  </span>
                </div>
              </div>

              {/* Column 3 — Five checks */}
              <div>
                <Eyebrow>CHECKS PERFORMED</Eyebrow>
                <ul>
                  <CheckRow name="Rule Check" result="FAIL" />
                  <CheckRow name="Quiet Period" result="FAIL" />
                  <CheckRow name="Consistency" result="PASS" />
                  <CheckRow name="Alignment" result="PASS" />
                  <CheckRow name="Agent Origin" result="PASS" />
                </ul>
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-[#64748B] mt-4">
            SHA-256 locked · append-only · record cannot be altered
          </div>

          {/* Transition into the principal queue + live record link */}
          <div className="mt-6 pt-6 border-t border-[#E2E8F0] text-sm text-[#374151] leading-relaxed">
            That draft routes to the principal&apos;s queue. The principal opens it, reviews the check chain, and documents their decision. ERA CUE creates the record before the draft reaches anyone.{" "}
            <a
              href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
              className="font-mono text-sm text-[#1A56DB] hover:text-[#1447C0] transition-colors"
            >
              See the communication record →
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — HOW IT WORKS (three-step workflow)
          Each step maps to a real surface in the product (rules,
          submit, examiner) and links there directly via the demo
          bypass. Step 02 reads "Verdict in seconds" — honest about
          the actual range without overpromising sub-second timing.
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2 text-center">
            How it works
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-12 text-center"
          >
            Three steps. Every draft. Every time.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Configure your governance",
                desc: "The CCO, GC, or comms lead sets up governance rules — from regulatory templates, from existing WSPs, or from scratch. Every rule is authorized by a named principal before it applies to anything.",
                detail: "WSP import · FINRA templates · AI-assisted creation",
                color: "text-[#1A56DB]",
                href: "/rules",
              },
              {
                step: "02",
                title: "Check before you publish",
                desc: "Any executive — or any AI agent acting on their behalf — submits a draft. ERA CUE runs five checks: rule matching, consistency against prior approved statements, quiet period timing, alignment, and agent origin declaration. Verdict in seconds.",
                detail: "Five checks · Verdict in seconds · Principal review if needed",
                color: "text-[#C2410C]",
                href: "/submit",
              },
              {
                step: "03",
                title: "The record that proves someone checked",
                desc: "ERA CUE generates an immutable communication record — the principal's identity, their structured decision with documented basis, the rules active at submission, and a SHA-256 locked audit trail. Downloadable as PDF.",
                detail: "SHA-256 locked · Append-only · FINRA Rule 3110",
                color: "text-[#166534]",
                href: `/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`,
              },
            ].map((item) => (
              <div key={item.step}>
                <div className={`font-mono text-3xl font-bold mb-3 ${item.color}`}>
                  {item.step}
                </div>
                <div className="text-lg font-semibold text-[#0F172A] mb-3 leading-snug">
                  {item.title}
                </div>
                <div className="text-sm text-[#374151] leading-relaxed mb-3">
                  {item.desc}
                </div>
                <div className="font-mono text-[10px] text-[#94A3B8]">
                  {item.detail}
                </div>
                <a
                  href={item.href}
                  className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors mt-3 inline-block"
                >
                  See it →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — WHO IT'S FOR (five role cards)
          2×2 grid for cards 01–04 with card 05 spanning full width on
          its own row. All five card bodies are link-free — the
          regulatory framing now lives inside Section 2's three named
          panels, so neither the body copy nor card 04 carries an
          inline superscript anymore.
         ============================================================ */}
      <section className="bg-[#0F172A]">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/50 mb-2">
            Built for every role
          </div>
          <h2
            className="text-2xl md:text-3xl font-light text-white mt-2 mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            From the executive drafting the post to the examiner reviewing the record.
          </h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARD 01 — Executive · amber accent */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#D97706] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#FCD34D] mb-3">
                EXECUTIVE · FOUNDER · CEO
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                Know before you post.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                ERA CUE checks your draft against your organization&apos;s active rules before anyone sees it. If something&apos;s wrong, you know exactly why — and the record shows you were careful.
              </p>
            </div>

            {/* CARD 02 — CMO / Comms / Brand · violet accent */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#7C3AED] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#C4B5FD] mb-3">
                CMO · VP COMMS · PR AGENCY
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                See your whole team at once.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                Every executive. Every campaign. Every channel. ERA CUE surfaces contradictions before they reach the public — and shows who approved what, when, and how long it took.
              </p>
            </div>

            {/* CARD 03 — CCO / GC / RIA / Broker-dealer · ERA CUE blue.
                Body copy is link-free; FINRA Rule 3110 / 2210(b) framing
                lives in Section 2's broker-dealer panel. */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#1A56DB] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#93C5FD] mb-3">
                CCO · GENERAL COUNSEL · RIA · BROKER-DEALER
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                The supervisory record examiners ask for.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                ERA CUE produces the supervisory evidence FINRA Rule 3110 and Rule 2210(b) require — named principal review, structured decision basis, immutable audit trail. In one submission.
              </p>
            </div>

            {/* CARD 04 — IR / General Counsel / Public Co · teal accent */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#0D9488] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#5EEAD4] mb-3">
                IR · GC · PUBLIC COMPANY
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                Reg FD documented before publication.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                In 2024, the SEC charged a company $200,000 after its CEO posted material information on LinkedIn during a quiet period. ERA CUE checks for these violations before any executive communicates publicly.
              </p>
            </div>

            {/* CARD 05 — Investment bank / PE / Hedge fund · slate · full width */}
            <div className="md:col-span-2 bg-white/[0.08] border border-white/15 border-l-4 border-l-[#94A3B8] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CBD5E1] mb-3">
                INVESTMENT BANK · PRIVATE EQUITY · HEDGE FUND
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                Deal-specific quiet periods. Every person. Every platform.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                Every deal, fundraise, and exit creates a window where the wrong post creates real exposure. ERA CUE applies deal-specific quiet periods across your team — partners, associates, portfolio company executives — before anything goes out.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — CAMPAIGN COORDINATION
          Mini campaign-record card. Each speaker row carries timing
          (review duration or pending state) so a PR agency can show a
          client exactly how quickly each communication moved through
          governance.
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-[#0F172A]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">
            For PR agencies and communications teams
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-4 max-w-2xl"
          >
            Your whole team. Every campaign. One oversight layer.
          </div>
          <div className="text-sm text-white/50 mb-12 max-w-xl leading-relaxed">
            ERA CUE tracks every communication across a campaign — who submitted, who approved, how long review took, and where it published. The campaign record is your client deliverable.
          </div>

          {/* Mini campaign record card */}
          <div className="bg-white/5 border border-white/10 rounded-sm p-6 max-w-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">
                  Campaign record
                </div>
                <div className="text-white font-semibold text-lg">Q3 Product Launch</div>
                <div className="font-mono text-[10px] text-white/30 mt-1">
                  Active window · Governed by Sarah Chen, GC
                </div>
              </div>
              <Link
                href="/campaigns/Q3%20Product%20Launch"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#60A5FA] transition-colors whitespace-nowrap"
              >
                View full campaign record →
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b border-white/10">
              {[
                { n: "12", l: "Total" },
                { n: "8", l: "Approved", c: "text-[#4ADE80]" },
                { n: "3", l: "Flagged", c: "text-[#FCA5A5]" },
                { n: "1", l: "Pending", c: "text-white" },
              ].map((s) => (
                <div key={s.l}>
                  <div
                    className={`font-mono text-2xl font-light mb-1 ${
                      s.c ?? "text-white"
                    }`}
                  >
                    {s.n}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {[
                {
                  name: "Marcus Rivera",
                  role: "CEO",
                  channel: "LinkedIn",
                  status: "Approved · 2h 14m review time",
                  pending: false,
                },
                {
                  name: "Lena Brooks",
                  role: "Chief Comms Officer",
                  channel: "Press Release",
                  status: "Approved · 47m review time",
                  pending: false,
                },
                {
                  name: "James Kim",
                  role: "Head of IR",
                  channel: "LinkedIn",
                  status: "Pending review · submitted 11:42 AM",
                  pending: true,
                },
                {
                  name: "Priya Patel",
                  role: "CMO",
                  channel: "Twitter",
                  status: "Approved · 1h 8m review time",
                  pending: false,
                },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-3 flex-wrap"
                >
                  <div>
                    <span className="text-sm text-white/80 font-medium">{s.name}</span>
                    <span className="font-mono text-[10px] text-white/30 ml-2">
                      {s.role} · {s.channel}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] ${
                      s.pending ? "text-white/60" : "text-[#4ADE80]"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="font-mono text-xs text-white/30">
            Every communication. Every speaker. Every channel. One campaign governance record.
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7 — COMMUNICATION RECORD
          Two-column. Left: four audience callouts (executive / CCO /
          CMO / examiner) — each row is a colored dot + short framing
          line of what that audience needs from the same record. Right:
          another CLEAR mockup, this time including a principal-decision
          row so the "who approved" beat is visible.
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            The output
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-3 max-w-2xl"
          >
            One record. Four audiences.
          </h2>
          <p className="text-sm text-[#64748B] mb-12 max-w-2xl leading-relaxed">
            ERA CUE generates a communication record for every governed draft. The same record serves the speaker, the CCO, the PR agency, and the regulator — each seeing exactly what they need.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            {/* LEFT — four audience callouts */}
            <div className="space-y-6">
              {[
                {
                  dot: "bg-[#D97706]",
                  title: "The executive",
                  body: "Was my draft approved? Can I publish it now?",
                },
                {
                  dot: "bg-[#1A56DB]",
                  title: "The CCO or GC",
                  body: "Named principal review on record. Structured decision with basis. SHA-256 locked. FINRA-ready.",
                },
                {
                  dot: "bg-[#7C3AED]",
                  title: "The CMO or PR agency",
                  body: "Who approved what, when, across the campaign. Campaign record exportable as a client deliverable.",
                },
                {
                  dot: "bg-[#0D9488]",
                  title: "The regulator or examiner",
                  body: "Complete supervisory evidence. Every check recorded. Every decision documented. Downloadable as PDF.",
                },
              ].map((row) => (
                <div key={row.title} className="flex items-start gap-3">
                  <span
                    className={`shrink-0 mt-2 w-2 h-2 rounded-full ${row.dot}`}
                    aria-hidden
                  />
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A] mb-1">
                      {row.title}
                    </div>
                    <div className="text-sm text-[#374151] leading-relaxed">
                      {row.body}
                    </div>
                  </div>
                </div>
              ))}

              <a
                href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
                className="inline-block mt-2 font-mono text-sm text-[#1A56DB] hover:text-[#1447C0] transition-colors"
              >
                See a real communication record →
              </a>
            </div>

            {/* RIGHT — record mockup, CLEAR verdict with principal row */}
            <div>
              <div className="bg-white border border-[#E2E8F0] rounded-sm shadow-lg shadow-black/5 overflow-hidden">
                <div className="bg-[#0F172A] px-5 py-3 flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/50">
                    Communication record
                  </div>
                  <div className="font-mono text-[10px] text-white/30">
                    Draft 7f3c…
                  </div>
                </div>
                <div className="p-5">
                  <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-3 text-xs italic text-[#374151] leading-relaxed mb-4">
                    &ldquo;Customer trust is everything — we&apos;re building for the long term.&rdquo;
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-sm border">
                      CLEAR
                    </span>
                    <span className="text-sm text-[#374151] ml-1">All checks passed</span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {[
                      "Rule Check",
                      "Quiet Period",
                      "Consistency",
                      "Alignment",
                      "Agent Origin",
                    ].map((name) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[#64748B]">{name}</span>
                        <span className="font-mono text-[10px] font-bold text-[#166534]">
                          PASS
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Principal decision row — the bit Section 7 wants
                      visible that the hero mockup doesn't carry. */}
                  <div className="border-t border-[#E2E8F0] pt-3 mb-3">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
                      Principal decision
                    </div>
                    <div className="text-xs text-[#0F172A] mb-1">
                      <span className="font-semibold">Sarah Chen</span>
                      <span className="text-[#64748B]"> · General Counsel · approved</span>
                    </div>
                    <div className="font-mono text-[10px] text-[#94A3B8]">
                      Basis: aligns with approved messaging · 1m 47s review
                    </div>
                  </div>

                  <div className="font-mono text-[10px] text-[#94A3B8] border-t border-[#E2E8F0] pt-3">
                    SHA-256 locked · append-only · cannot be altered
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8 — WHY IT'S DEFENSIBLE (icon cards)
          Three cards with Unicode glyph icons (◎ ⬡ ◈) and no numbers.
          Replaces the old live-data moat section so the page no longer
          surfaces hardcoded counts that read random without context.
         ============================================================ */}
      <section className="py-16 px-6 md:px-12 bg-[#F8F9FB] border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Built different
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-2xl font-light text-[#0F172A] mb-10"
          >
            Every claim is provable.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
              <div className="text-3xl text-[#1A56DB] mb-3" aria-hidden>
                ◎
              </div>
              <div className="text-base font-semibold text-[#0F172A] mb-2">
                Principal-approved corpus
              </div>
              <div className="text-sm text-[#374151] leading-relaxed mb-3">
                Every communication approved through ERA CUE enters a governance corpus. Every new draft is checked against it — catching contradictions before they reach the public. The corpus contains only principal-approved content. No unreviewed statements enter.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8]">
                Builds automatically · Principal-approved only
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
              <div className="text-3xl text-[#166534] mb-3" aria-hidden>
                ⬡
              </div>
              <div className="text-base font-semibold text-[#0F172A] mb-2">
                SHA-256 locked audit trail
              </div>
              <div className="text-sm text-[#374151] leading-relaxed mb-3">
                Every governance decision is cryptographically hashed at the moment it is created. The database refuses UPDATE and DELETE — not just the application. The record cannot be altered. Not by the user. Not by ERA CUE. Not by anyone.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8]">
                Append-only · Database-enforced · Not a policy
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
              <div className="text-3xl text-[#7C3AED] mb-3" aria-hidden>
                ◈
              </div>
              <div className="text-base font-semibold text-[#0F172A] mb-2">
                Behavioral calibration
              </div>
              <div className="text-sm text-[#374151] leading-relaxed mb-3">
                Every reviewer decision — override, escalation, approval — teaches ERA CUE what this organization actually tolerates. Rules that generate too many false positives get flagged for refinement. Governance improves with every decision.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8]">
                Organization-specific · Gets smarter over time · Reduces false positives
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 9 — FEATURE GRID
          Twelve features in a 4-col hairline grid. Copy unchanged from
          previous build per spec.
         ============================================================ */}
      <section className="py-16 px-6 md:px-12 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            What ERA CUE includes
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-2xl font-light text-[#0F172A] mb-8"
          >
            Everything in one governance layer.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#E2E8F0] border border-[#E2E8F0] rounded-sm overflow-hidden">
            {[
              { name: "Rule Check", desc: "Keyword + pattern matching against active rules" },
              { name: "Consistency Check", desc: "New drafts checked against approved corpus" },
              { name: "Quiet Period Enforcement", desc: "Time-bounded communication restrictions" },
              { name: "Agent Origin Check", desc: "AI involvement declared and recorded" },
              { name: "Named Principal Review", desc: "Structured decision with documented basis" },
              { name: "WSP Enforcement", desc: "Rules cite the WSP section they implement" },
              { name: "Campaign Records", desc: "All communications under one campaign view" },
              { name: "Batch Submission", desc: "Multiple drafts checked simultaneously" },
              { name: "SHA-256 Audit Trail", desc: "Append-only, tamper-evident, database-enforced" },
              { name: "Communication Record", desc: "Plain English summary + full compliance view" },
              { name: "PDF Export", desc: "Downloadable for regulators, lawyers, boards" },
              { name: "Supervisory Memory", desc: "Corpus grows with every principal approval" },
            ].map((feature) => (
              <div key={feature.name} className="bg-white p-4">
                <div className="text-sm font-semibold text-[#0F172A] mb-1">
                  {feature.name}
                </div>
                <div className="font-mono text-[10px] text-[#64748B] leading-relaxed">
                  {feature.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10 — BOTTOM CTA
          Hero-mirror dark band. "Set up your rules" leads (correct
          flow); "Request access" mailto for regulated firms.
         ============================================================ */}
      <section className="bg-[#0F172A] py-20 px-6 md:px-12 text-center">
        <div className="max-w-[600px] mx-auto">
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-3"
          >
            Try it in 60 seconds.
          </div>

          <div className="text-sm text-white/50 mb-8 max-w-md mx-auto leading-relaxed">
            No login required. Configure a rule, check a draft, see the communication record. The full product, live, in under two minutes.
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/rules"
              className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-8 py-3.5 rounded-sm hover:bg-[#1447C0] transition-colors"
            >
              Set up your rules →
            </a>
            <a
              href="mailto:hello@eracue.com?subject=ERA%20CUE%20Access%20Request"
              className="bg-white/10 text-white border border-white/20 font-mono text-sm font-medium px-8 py-3.5 rounded-sm hover:bg-white/20 transition-colors"
            >
              Request access →
            </a>
          </div>

          <div className="font-mono text-xs text-white/20 mt-3">
            or email hello@eracue.com
          </div>

          {/* Legal disclaimer — replaces the page-bottom footnote
              section. Cites the three enforcement actions named in
              Section 2 and disclaims legal advice / compliance
              guarantees in the same breath, so the legal framing
              ends where the conversion ask ends. */}
          <p className="font-mono text-[9px] text-white/15 mt-8 max-w-2xl mx-auto leading-relaxed text-center">
            Enforcement actions cited: SEC v. DraftKings Inc., Release No. 34-101130 (Sept. 26, 2024) · FINRA v. M1 Finance LLC (March 18, 2024) · EU AI Act Article 50, effective August 2, 2026. ERA CUE produces supervisory records and governance evidence. ERA CUE does not provide legal advice or guarantee regulatory compliance.
          </p>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          The demo disclaimer + the "· demo · May 2026" wordmark suffix
          only render when NEXT_PUBLIC_DEMO_MODE === "true".
         ============================================================ */}
      <footer className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-xs text-[#64748B] flex items-center gap-2">
            <span
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-base tracking-tight"
            >
              <span className="text-[#1A56DB] font-bold">ERA</span>
              <span className="text-[#1A56DB] italic font-normal"> CUE</span>
            </span>
            {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
              <span className="font-mono">· demo · May 2026</span>
            )}
          </div>
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <div className="text-xs text-[#64748B] md:text-center">
              Demo data only. No live customer information. The append-only audit trail and tamper-evident records shown are real database constraints — not simulated.
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
