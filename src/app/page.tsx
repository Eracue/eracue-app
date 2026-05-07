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

// Live communication record id used by the Communication Record section
// "see a real record" link. Kept as a constant so the demo data id is
// changeable in one place.
const CCO_EXAMINER_DRAFT_ID = "afe14696-5336-4336-a0b7-c3410477ec31";

// ---------- Page ----------------------------------------------------------

// Final homepage. Strict three-tone alternation (dark / white / grey)
// across seven background bands; the Hero+Badges and Campaign+Who-it's-for
// pairs share a band each, separated by a hairline border. Every headline
// uses Newsreader serif at text-3xl–text-5xl; body copy is text-sm or
// smaller; eyebrows and labels are font-mono text-[10px] uppercase. No
// section is allowed to break those rules.
export default function Home() {
  return (
    <div className="bg-white min-h-screen">
      <SiteHeader />

      {/* ============================================================
          SECTION 2 — HERO (dark)
          Two-column. Left: eyebrow / headline / two subheads / workflow
          strip / two CTAs / hint. Right: CLEAR verdict mockup so the
          opening visual mirrors the everyday case (most drafts pass).
         ============================================================ */}
      <section className="bg-[#0A0F1E] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
          {/* LEFT — copy + CTAs */}
          <div className="md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-8">
              Human oversight · AI 2026
            </div>

            <h1
              className="font-light leading-[1.1] tracking-tight text-white text-4xl md:text-5xl mb-6 max-w-2xl"
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

            <p className="text-sm text-white/70 max-w-lg mb-3 leading-relaxed">
              AI is drafting your team&apos;s communications. Agents are posting without human review. Nobody has a record that a person actually approved it.
            </p>

            <p className="font-mono text-sm text-white/40 max-w-lg mb-10 leading-relaxed">
              ERA CUE is the human checkpoint between AI and publication — where rules fire, principals decide, and records are created.
            </p>

            {/* Workflow strip — first scan answers "what's the loop?"
                without prose. Each label is the verb the role thinks
                in. */}
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
                className="bg-[#1A56DB] text-white font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-[#1447C0] transition-colors"
              >
                Set up your rules →
              </a>
              <a
                href="/submit"
                className="bg-white/8 text-white/80 border border-white/15 font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-white/15 transition-colors"
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
              the prospect sees what they'll see at /submit. CLEAR (not
              BLOCK) so the opening visual reads as "the everyday case." */}
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
          SECTION 3 — BADGES (dark, continues hero band)
          A row of firm-type chips so a prospect sees "yes, this is for
          my organization" before scrolling. No border-t — reads as a
          continuation of the hero, with extra breathing room above.
         ============================================================ */}
      <section className="bg-[#0A0F1E] pb-12 md:pb-16 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4 text-center">
            Built for
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              "Broker-Dealers",
              "RIAs",
              "Public companies",
              "Investment banks",
              "PE firms",
              "PR agencies",
            ].map((label) => (
              <span
                key={label}
                className="font-mono text-[10px] uppercase tracking-widest text-white/55 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — REGULATORY REALITY (white)
          Three named enforcement actions, each rendered as a panel
          with a header strip (badge + rule + penalty) and a body
          that splits into "what happened" / "the rule" / "with ERA
          CUE". Citations live next to the claim they support — not
          in a page-bottom footnote list.
         ============================================================ */}
      <section className="bg-white py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          {/* Section header */}
          <div className="mb-10">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              The regulatory reality
            </div>
            <h2
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl font-light text-[#0F172A] mb-3 leading-tight max-w-2xl"
            >
              Three regulations. Real consequences.
            </h2>
            <p className="text-sm text-[#64748B] max-w-xl leading-relaxed">
              Each of these enforcement actions happened in the last 18 months. Each involved communications that were not reviewed before publication.
            </p>
          </div>

          {/* Three panels — uniform structure, panel-specific palette
              on the badge / penalty / Col 3 header. */}
          <div className="space-y-3">
            {/* Panel 1 — DraftKings / Reg FD */}
            <div className="border border-[#E2E8F0] rounded-sm overflow-hidden">
              <div className="bg-[#F8F9FB] px-5 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                <div className="p-5 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    What happened
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    DraftKings&apos; PR firm posted on the CEO&apos;s personal LinkedIn and X accounts during an earnings quiet period — disclosing revenue growth data before Q2 results were released. Posts were live 30 minutes. DraftKings&apos; own social media policy required prior written approval.
                  </p>
                  <div className="font-mono text-[9px] text-[#94A3B8] mt-3">
                    SEC Release No. 34-101130 · September 26, 2024
                  </div>
                </div>

                <div className="p-5 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    The rule
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    SEC Regulation FD
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    Prohibits selective disclosure of material nonpublic information. Applies to posts by persons acting on a company&apos;s behalf — including PR firms posting on executive personal accounts.
                  </p>
                </div>

                <div className="p-5 bg-[#F0FDF4]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#166534] mb-3">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    The PR firm submits the draft. The quiet period rule fires. The draft is blocked. A named principal reviews before anything reaches LinkedIn. The record is created automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Panel 2 — FINRA / Broker-Dealer */}
            <div className="border border-[#E2E8F0] rounded-sm overflow-hidden">
              <div className="bg-[#F8F9FB] px-5 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
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
                <div className="p-5 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    What happened
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    A broker-dealer paid social media influencers to promote the firm. No registered principal reviewed or approved content before posting. No records were maintained. FINRA&apos;s first disciplinary action involving social media influencer supervision.
                  </p>
                  <div className="font-mono text-[9px] text-[#94A3B8] mt-3">
                    FINRA Enforcement · March 18, 2024
                  </div>
                </div>

                <div className="p-5 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    The rule
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    FINRA Rules 2210(b) + 3110
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    Retail communications require registered principal pre-approval. Firms must establish written supervisory procedures for social media — including third-party communications on the firm&apos;s behalf.
                  </p>
                </div>

                <div className="p-5 bg-[#F0FDF4]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#166534] mb-3">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    Every influencer or agency submits drafts through ERA CUE before posting. A registered principal reviews and approves each one. The named principal record satisfies Rule 3110 — automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Panel 3 — EU AI Act */}
            <div className="border border-[#E2E8F0] rounded-sm overflow-hidden">
              <div className="bg-[#F8F9FB] px-5 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
                    All organizations
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">
                    EU AI Act Article 50
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#7C3AED]">
                  Effective August 2026
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                <div className="p-5 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    The requirement
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    AI-generated communications must be disclosed as artificially generated. Organizations must ensure AI-drafted content is marked, traceable, and subject to human oversight before it reaches the public.
                  </p>
                  <div className="font-mono text-[9px] text-[#94A3B8] mt-3">
                    EU AI Act Art. 50 · Effective August 2, 2026
                  </div>
                </div>

                <div className="p-5 md:border-r border-[#E2E8F0]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mb-3">
                    What&apos;s missing
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    Most organizations have no record.
                  </p>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    AI drafts content. Executives post it. No disclosure. No approval trail. No evidence that a human reviewed it before publication. Article 50 requires all three.
                  </p>
                </div>

                <div className="p-5 bg-[#F0FDF4]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#166534] mb-3">
                    With ERA CUE
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    ERA CUE records AI involvement at submission, documents the human review decision, and produces the disclosure trail Article 50 requires — automatically, for every governed draft.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom line — single sentence framing the three panels
              as one shared problem ERA CUE solves. */}
          <div className="text-center mt-6">
            <p className="font-mono text-xs text-[#64748B] max-w-xl mx-auto leading-relaxed">
              ERA CUE is the pre-publication checkpoint that produces the evidence each of these regulations requires.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — HOW IT WORKS (grey)
          Three steps mapping to real product surfaces (rules / submit
          / examiner). Each step links to that surface so a curious
          prospect can jump straight to the relevant page.
         ============================================================ */}
      <section className="bg-[#F8F9FB] py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3 text-center">
            HOW IT WORKS
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-3 text-center leading-tight"
          >
            Three steps. Every draft. Every time.
          </h2>
          <p className="text-sm text-[#64748B] mb-12 max-w-xl mx-auto text-center leading-relaxed">
            Configure the governance once. Every draft your team submits afterwards routes through it.
          </p>

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
                <div className="text-base font-semibold text-[#0F172A] mb-3 leading-snug">
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
          SECTION 6 — CAMPAIGN GOVERNANCE (dark)
          Two-column. Left: a campaign-record card showing four named
          speakers with channel + topic + status + review timing. Right:
          three "who sees what" cards translating the same record into
          PR / CCO / examiner deliverables.
         ============================================================ */}
      <section className="bg-[#0A0F1E] py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-3">
            Campaign governance
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-3 leading-tight max-w-2xl"
          >
            Your whole team. Every campaign. One record.
          </h2>
          <p className="text-sm text-white/40 mb-10 max-w-xl leading-relaxed">
            ERA CUE tracks every communication across a campaign — who submitted, who approved, how long review took. The campaign record is your client deliverable.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* LEFT — campaign card */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-sm overflow-hidden">
              {/* Header — name + meta on the left, three stats on the
                  right. Stats are absolute counts for the whole campaign
                  window, not the visible four rows. */}
              <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Q3 product launch
                  </div>
                  <div className="font-mono text-[10px] text-white/25 mt-0.5">
                    Apr 1–Jun 30, 2026 · GC
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#4ADE80]">8</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
                      Approved
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#FCD34D]">2</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
                      Pending
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-[#FCA5A5]">1</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
                      Blocked
                    </div>
                  </div>
                </div>
              </div>

              {/* Speaker rows — name + role + channel + topic + status. */}
              <div className="divide-y divide-white/[0.05]">
                {[
                  {
                    name: "Marcus Rivera",
                    role: "CEO",
                    channel: "LinkedIn",
                    topic: "Series B messaging",
                    status: "Approved · 2h 14m review",
                    pending: false,
                  },
                  {
                    name: "Lena Brooks",
                    role: "Chief Comms Officer",
                    channel: "Press release",
                    topic: "Q3 launch",
                    status: "Approved · 47m review",
                    pending: false,
                  },
                  {
                    name: "James Kim",
                    role: "Head of IR",
                    channel: "LinkedIn",
                    topic: "Price claim flagged",
                    status: "Pending review · 11:42 AM",
                    pending: true,
                  },
                  {
                    name: "Priya Patel",
                    role: "CMO",
                    channel: "Twitter",
                    topic: "Campaign messaging",
                    status: "Approved · 1h 8m review",
                    pending: false,
                  },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <div className="text-sm text-white/75">
                        {s.name}{" "}
                        <span className="font-mono text-[10px] text-white/22 ml-1">
                          · {s.role}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-white/22 mt-0.5">
                        {s.channel} · {s.topic}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[10px] ${
                        s.pending ? "text-[#FCD34D]" : "text-[#4ADE80]"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
                <span className="font-mono text-[10px] text-white/30">
                  Every speaker. Every channel. One record.
                </span>
                <Link
                  href="/campaigns/Q3%20Product%20Launch"
                  className="font-mono text-xs text-[#60A5FA] hover:text-white transition-colors"
                >
                  View campaign record →
                </Link>
              </div>
            </div>

            {/* RIGHT — three "who sees what" cards. Same record, three
                audiences. The label repeats by design — each card
                names the audience and the slice of the record they
                actually need. */}
            <div className="space-y-3">
              {[
                "PR agency → client deliverable showing every approval, timing, and principal decision",
                "CCO → supervisory evidence for the full campaign window, ready for FINRA examination",
                "FINRA examiner → named principal, review timing, decision basis per communication — downloadable as PDF",
              ].map((body, i) => (
                <div
                  key={i}
                  className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-sm"
                >
                  <div className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-2">
                    Who sees what
                  </div>
                  <div className="text-sm text-white/55 leading-relaxed">
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7 — WHO IT'S FOR (dark, same band)
          Same dark band as Campaign — separated by a hairline border
          rather than a section break. Five role cards in a 2-col grid;
          card 5 spans both columns. No links inside any card.
         ============================================================ */}
      <section className="bg-[#0A0F1E] pt-16 md:pt-20 pb-16 md:pb-20 px-6 md:px-12 border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-3">
            Built for every role
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-3 leading-tight max-w-2xl"
          >
            From the executive drafting to the examiner reviewing.
          </h2>
          <p className="text-sm text-white/40 mb-10 max-w-xl leading-relaxed">
            ERA CUE serves every person in the communication governance workflow.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* CARD 01 — Executive · amber accent */}
            <div className="bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-[#D97706] rounded-sm p-5 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#FCD34D] mb-3">
                EXECUTIVE · FOUNDER · CEO
              </div>
              <div className="text-base font-semibold text-white mb-2 leading-snug">
                Know before you post.
              </div>
              <p className="text-sm text-white/60 leading-relaxed flex-1">
                ERA CUE checks your draft against your organization&apos;s active rules before anyone sees it. Know exactly what&apos;s wrong — before it reaches anyone.
              </p>
            </div>

            {/* CARD 02 — CMO / Comms / Brand · violet accent */}
            <div className="bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-[#7C3AED] rounded-sm p-5 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#C4B5FD] mb-3">
                CMO · VP COMMS · PR AGENCY
              </div>
              <div className="text-base font-semibold text-white mb-2 leading-snug">
                See your whole team at once.
              </div>
              <p className="text-sm text-white/60 leading-relaxed flex-1">
                Every executive. Every campaign. ERA CUE surfaces contradictions before they go public — and shows who approved what, when, and how long it took.
              </p>
            </div>

            {/* CARD 03 — CCO / GC / RIA / Broker-dealer · ERA CUE blue */}
            <div className="bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-[#1A56DB] rounded-sm p-5 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#93C5FD] mb-3">
                CCO · GENERAL COUNSEL · RIA · BROKER-DEALER
              </div>
              <div className="text-base font-semibold text-white mb-2 leading-snug">
                The supervisory record examiners ask for.
              </div>
              <p className="text-sm text-white/60 leading-relaxed flex-1">
                ERA CUE produces the supervisory evidence FINRA Rule 3110 and Rule 2210(b) require — named principal review, structured decision basis, immutable audit trail.
              </p>
            </div>

            {/* CARD 04 — IR / GC / Public Co · teal accent. The body
                names "a company" rather than DraftKings — the named
                case lives in Section 4. */}
            <div className="bg-white/[0.04] border border-white/[0.08] border-l-4 border-l-[#0D9488] rounded-sm p-5 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#5EEAD4] mb-3">
                IR · GC · PUBLIC COMPANY
              </div>
              <div className="text-base font-semibold text-white mb-2 leading-snug">
                Reg FD documented before publication.
              </div>
              <p className="text-sm text-white/60 leading-relaxed flex-1">
                In 2024, the SEC charged a company $200,000 after its CEO&apos;s account posted material information during a quiet period. ERA CUE checks for these violations before any executive communicates.
              </p>
            </div>

            {/* CARD 05 — Investment bank / PE / Hedge fund · slate · full width */}
            <div className="md:col-span-2 bg-white/[0.06] border border-white/[0.10] border-l-4 border-l-[#94A3B8] rounded-sm p-5 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CBD5E1] mb-3">
                INVESTMENT BANK · PRIVATE EQUITY · HEDGE FUND
              </div>
              <div className="text-base font-semibold text-white mb-2 leading-snug">
                Deal-specific quiet periods. Every person. Every platform.
              </div>
              <p className="text-sm text-white/60 leading-relaxed flex-1">
                Every deal, fundraise, and exit creates a window where the wrong post creates real exposure. ERA CUE applies deal-specific quiet periods across your team — partners, associates, portfolio companies — before anything goes out.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8 — COMMUNICATION RECORD (white)
          Two-column. Left: four audience callouts (executive / CCO /
          CMO / examiner) — each a colored dot + framing line of what
          that audience needs from the same record. Right: a CLEAR
          mockup including a principal-decision row.
         ============================================================ */}
      <section className="bg-white py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
            The output
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-3 leading-tight max-w-2xl"
          >
            One record. Four audiences.
          </h2>
          <p className="text-sm text-[#64748B] mb-10 max-w-xl leading-relaxed">
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
                className="inline-block mt-2 font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
              >
                See a real communication record →
              </a>
            </div>

            {/* RIGHT — record mockup, CLEAR verdict with principal row */}
            <div>
              <div className="bg-white border border-[#E2E8F0] rounded-sm shadow-lg shadow-black/5 overflow-hidden">
                <div className="bg-[#0A0F1E] px-5 py-3 flex items-center justify-between">
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
          SECTION 9 — BUILT DIFFERENT (grey)
          Three icon cards — corpus, audit trail, calibration. Each
          card states one structural property of the system that's
          provable in the database, not a marketing claim.
         ============================================================ */}
      <section className="bg-[#F8F9FB] py-16 md:py-20 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
            Built different
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-10 leading-tight"
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
              <p className="text-sm text-[#374151] leading-relaxed mb-3">
                Every communication approved through ERA CUE enters a governance corpus. Every new draft is checked against it — catching contradictions before they reach the public. The corpus contains only principal-approved content. No unreviewed statements enter.
              </p>
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
              <p className="text-sm text-[#374151] leading-relaxed mb-3">
                Every governance decision is cryptographically hashed at the moment it is created. The database refuses UPDATE and DELETE — not just the application. The record cannot be altered. Not by the user. Not by ERA CUE. Not by anyone.
              </p>
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
              <p className="text-sm text-[#374151] leading-relaxed mb-3">
                Every reviewer decision — override, escalation, approval — teaches ERA CUE what this organization actually tolerates. Rules that generate too many false positives get flagged for refinement. Governance improves with every decision.
              </p>
              <div className="font-mono text-[10px] text-[#94A3B8]">
                Organization-specific · Gets smarter over time · Reduces false positives
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10 — BOTTOM CTA (dark)
          Hero-mirror dark band. "Set up your rules" leads (correct
          flow); "Request access" mailto for regulated firms. Closes
          with a small legal disclaimer that cites the three
          enforcement actions named in Section 4 and disclaims legal
          advice / compliance guarantees.
         ============================================================ */}
      <section className="bg-[#0A0F1E] py-16 md:py-20 px-6 md:px-12 text-center">
        <div className="max-w-[600px] mx-auto">
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-3 leading-tight"
          >
            Try it in 60 seconds.
          </h2>

          <p className="text-sm text-white/50 mb-8 max-w-md mx-auto leading-relaxed">
            No login required. Configure a rule, check a draft, see the communication record. The full product, live, in under two minutes.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/rules"
              className="bg-[#1A56DB] text-white font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-[#1447C0] transition-colors"
            >
              Set up your rules →
            </a>
            <a
              href="mailto:hello@eracue.com?subject=ERA%20CUE%20Access%20Request"
              className="bg-white/10 text-white border border-white/20 font-mono text-xs font-medium px-6 py-3 rounded-sm hover:bg-white/20 transition-colors"
            >
              Request access →
            </a>
          </div>

          <div className="font-mono text-[10px] text-white/20 mt-3">
            or email hello@eracue.com
          </div>

          <p className="font-mono text-[9px] text-white/12 mt-8 max-w-2xl mx-auto leading-relaxed text-center">
            Enforcement actions cited: SEC v. DraftKings Inc., Release No. 34-101130 (Sept. 26, 2024) · FINRA v. M1 Finance LLC (March 18, 2024) · EU AI Act Article 50, effective August 2, 2026. ERA CUE produces supervisory records and governance evidence. ERA CUE does not provide legal advice or guarantee regulatory compliance.
          </p>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          Demo disclaimer + the "· demo · May 2026" wordmark suffix
          render only when NEXT_PUBLIC_DEMO_MODE === "true".
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
