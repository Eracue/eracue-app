import Link from "next/link";

export const dynamic = "force-dynamic";

const EXAMINER_DRAFT_ID = "e71b56c1-2e30-4a9c-bb78-f0db7ee1f651";

// ---------- Small, repeating pieces ----------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-[#E8C547]">
      {children}
    </div>
  );
}

function VerdictBlockBadge() {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-none border bg-[#E5484D]/10 text-[#E5484D] border-[#E5484D]/30 text-sm font-mono font-bold tracking-widest">
      BLOCK
    </span>
  );
}

function VerdictEscalateBadge() {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-none border bg-[#F76B15]/10 text-[#F76B15] border-[#F76B15]/30 text-sm font-mono font-bold tracking-widest">
      ESCALATE
    </span>
  );
}

function CheckRow({ name, result }: { name: string; result: "PASS" | "FAIL" }) {
  const dotColor = result === "PASS" ? "#30A46C" : "#E5484D";
  return (
    <li className="flex items-center justify-between gap-4 font-mono text-xs py-1.5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, backgroundColor: dotColor }}
        />
        <span className="text-[#F2F2F0]">{name}</span>
      </div>
      <span style={{ color: dotColor }}>{result}</span>
    </li>
  );
}

function KeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs bg-[#1E1E22] px-2 py-0.5 text-[#6B6B72] rounded-none">
      {children}
    </span>
  );
}

// ---------- Page ------------------------------------------------------------

export default function Home() {
  // Animation delays for the staggered hero fade.
  const fadeStyle = (delayMs: number): React.CSSProperties => ({
    animationDelay: `${delayMs}ms`,
  });

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F2F2F0]">
      {/* Minimal motion: only the hero block fades in. Everything else is static. */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      {/* Inline header — homepage canvas is unconditionally dark, so the shared
          SiteHeader (which has light/dark variants tied to the theme cookie) is
          replaced here with a minimal, always-dark strip. SiteHeader still
          governs every other route. */}
      <header className="print:hidden bg-[#0A0A0B] border-b border-[#1E1E22] px-6 py-4 flex justify-between items-center">
        <Link
          href="/"
          className="text-lg font-light text-[#F2F2F0]"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          ERA CUE
        </Link>
        <Link
          href="/submit"
          className="font-mono text-xs text-[#6B6B72] hover:text-[#F2F2F0] transition-colors"
        >
          Enter →
        </Link>
      </header>

      {/* ============================================================
          SECTION 1 — HERO
         ============================================================ */}
      <section className="border-b border-[#1E1E22]">
        <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-32">
          <div className="anim-fade-in-up" style={fadeStyle(0)}>
            <Eyebrow>
              GOVERNANCE INFRASTRUCTURE · FINRA RULE 3110 · EU AI ACT ARTICLE 50
            </Eyebrow>
          </div>

          <h1
            className="anim-fade-in-up font-light leading-tight tracking-tight text-[#F2F2F0] mt-6 text-5xl md:text-7xl max-w-3xl"
            style={{ fontFamily: "var(--font-newsreader)", ...fadeStyle(100) }}
          >
            The governed moment between AI and publish.
          </h1>

          <p
            className="anim-fade-in-up text-[#6B6B72] text-lg max-w-xl mt-6 leading-relaxed"
            style={fadeStyle(200)}
          >
            AI agents draft. Executives post. Nobody has a record that a human
            approved it. ERA CUE is the governance layer that changes that —
            pre-publication checks, named principal approval, immutable audit
            trail.
          </p>

          <div className="anim-fade-in-up mt-10" style={fadeStyle(300)}>
            <Link
              href="/submit"
              className="inline-flex items-center bg-[#E8C547] text-[#0A0A0B] font-medium text-sm px-6 py-3 rounded-none hover:opacity-90 transition-opacity"
            >
              See it catch something →
            </Link>
          </div>

          <div
            className="anim-fade-in-up mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-[#6B6B72]"
            style={fadeStyle(400)}
          >
            <span>✓ FINRA Rule 3110</span>
            <span>✓ EU AI Act Article 50</span>
            <span>✓ SEC 17a-4</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — THE GOVERNED MOMENT (evidence artifact)
         ============================================================ */}
      <section className="border-b border-[#1E1E22]">
        <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-32">
          <Eyebrow>THE GOVERNED MOMENT</Eyebrow>
          <h2
            className="text-2xl font-light mt-3 text-[#F2F2F0]"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            Tuesday, 8:47 AM. The CEO posted during a quiet period.
          </h2>
          <p className="text-[#6B6B72] text-sm mt-2 mb-8">
            ERA CUE caught it before it went live. Here is the complete record.
          </p>

          {/* Evidence artifact card */}
          <div className="bg-[#111113] border border-[#1E1E22] rounded-sm p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
              {/* Column 1 — the draft */}
              <div className="md:col-span-1">
                <div className="text-xs font-mono uppercase tracking-widest text-[#6B6B72]">
                  DRAFT · CEO · LINKEDIN · AI ASSISTED
                </div>
                <p
                  className="italic text-[#F2F2F0] text-lg mt-4 leading-snug"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  &ldquo;We&apos;re aggressively hiring across engineering and
                  sales — exciting times ahead for the team.&rdquo;
                </p>
              </div>

              {/* Column 2 — the verdict */}
              <div className="md:col-span-1">
                <div className="text-xs font-mono uppercase tracking-widest text-[#6B6B72]">
                  SYSTEM VERDICT
                </div>
                <div className="mt-4">
                  <VerdictBlockBadge />
                </div>
                <div className="text-[#F2F2F0] text-sm mt-3">Series B Quiet Period</div>
                <div className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                  No hiring, growth, or fundraising language during quiet period.
                </div>
                <div className="mt-3 text-xs">
                  <span className="font-mono bg-[#1E1E22] px-2 py-0.5 text-[#E8C547]">
                    hiring
                  </span>
                </div>
              </div>

              {/* Column 3 — checks performed */}
              <div className="md:col-span-1">
                <div className="text-xs font-mono uppercase tracking-widest text-[#6B6B72]">
                  CHECKS PERFORMED
                </div>
                <ul className="mt-4 divide-y divide-[#1E1E22]">
                  <CheckRow name="Rule Check" result="FAIL" />
                  <CheckRow name="Quiet Period Check" result="FAIL" />
                  <CheckRow name="Consistency Check" result="PASS" />
                  <CheckRow name="Alignment Check" result="PASS" />
                  <CheckRow name="Agent Origin Check" result="PASS" />
                </ul>
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-[#6B6B72] mt-4">
            SHA-256 locked · append-only · record cannot be altered
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — THREE ROLES
         ============================================================ */}
      <section className="border-b border-[#1E1E22]">
        <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-32">
          <Eyebrow>WHO ERA CUE IS FOR</Eyebrow>

          {/* gap-px on a #1E1E22 wrapper produces hairline dividers between cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1E1E22] border border-[#1E1E22]">
            {/* Card 01 — Executive */}
            <div className="bg-[#0A0A0B] p-8">
              <div className="font-mono text-xs text-[#6B6B72]">01</div>
              <div className="text-[#F2F2F0] text-sm font-medium mt-3">
                Executive · Founder · CEO
              </div>
              <p className="text-[#6B6B72] text-sm mt-2 leading-relaxed">
                Draft anything. ERA CUE checks it before it leaves your hands.
                Your record is clean before you ask.
              </p>
              <Link
                href="/submit"
                className="block text-xs font-mono text-[#E8C547] mt-6 hover:opacity-80 transition-opacity"
              >
                Submit a draft →
              </Link>
            </div>

            {/* Card 02 — Comms / PR */}
            <div className="bg-[#0A0A0B] p-8">
              <div className="font-mono text-xs text-[#6B6B72]">02</div>
              <div className="text-[#F2F2F0] text-sm font-medium mt-3">
                VP Comms · PR Director · Agency
              </div>
              <p className="text-[#6B6B72] text-sm mt-2 leading-relaxed">
                See every draft your speakers submit. Every verdict, every
                override, every gap. One dashboard. No Monday morning surprises.
              </p>
              <Link
                href="/dashboard"
                className="block text-xs font-mono text-[#E8C547] mt-6 hover:opacity-80 transition-opacity"
              >
                View the dashboard →
              </Link>
            </div>

            {/* Card 03 — CCO / GC / Compliance */}
            <div className="bg-[#0A0A0B] p-8">
              <div className="font-mono text-xs text-[#6B6B72]">03</div>
              <div className="text-[#F2F2F0] text-sm font-medium mt-3">
                CCO · General Counsel · Compliance
              </div>
              <p className="text-[#6B6B72] text-sm mt-2 leading-relaxed">
                FINRA Rule 3110 requires proof a named principal reviewed
                AI-assisted communications. ERA CUE produces that record.
                Automatically.
              </p>
              <Link
                href={`/drafts/${EXAMINER_DRAFT_ID}/examiner`}
                className="block text-xs font-mono text-[#E8C547] mt-6 hover:opacity-80 transition-opacity"
              >
                See the examiner record →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — RULES AS FOUNDATION
         ============================================================ */}
      <section className="border-b border-[#1E1E22]">
        <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-32">
          <Eyebrow>THE RULES ENGINE</Eyebrow>
          <h2
            className="text-2xl font-light mt-3 text-[#F2F2F0]"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            Your rules. Your authority. Enforced at the moment of submission.
          </h2>
          <p className="text-[#6B6B72] text-sm max-w-lg mt-3 mb-10 leading-relaxed">
            ERA CUE checks every draft against rules your principal authorizes.
            Keywords, timing windows, quiet periods, competitor mentions. When
            a rule fires, the record shows exactly why.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1 — BLOCK */}
            <div className="bg-[#111113] border border-[#1E1E22] p-6 rounded-sm">
              <VerdictBlockBadge />
              <div className="text-[#F2F2F0] text-sm font-medium mt-4">Series B Quiet Period</div>
              <p className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                No hiring, growth, or fundraising language during quiet period.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                <KeywordChip>hiring</KeywordChip>
                <KeywordChip>expanding</KeywordChip>
                <KeywordChip>growth</KeywordChip>
                <KeywordChip>fundraising</KeywordChip>
                <KeywordChip>raised</KeywordChip>
              </div>
              <div className="font-mono text-xs text-[#6B6B72] mt-4 pt-4 border-t border-[#1E1E22]">
                Active until Jun 30, 2026 · Authorized by Sarah Chen, GC
              </div>
            </div>

            {/* Rule 2 — ESCALATE */}
            <div className="bg-[#111113] border border-[#1E1E22] p-6 rounded-sm">
              <VerdictEscalateBadge />
              <div className="text-[#F2F2F0] text-sm font-medium mt-4">Enterprise Sales Claims</div>
              <p className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                Sales claims about enterprise customers must be reviewed by GC.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                <KeywordChip>fortune 500</KeywordChip>
                <KeywordChip>enterprise customer</KeywordChip>
                <KeywordChip>signed</KeywordChip>
                <KeywordChip>closed deal</KeywordChip>
              </div>
              <div className="font-mono text-xs text-[#6B6B72] mt-4 pt-4 border-t border-[#1E1E22]">
                Active — no end date · Authorized by Sarah Chen, GC
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/rules"
              className="text-xs font-mono text-[#E8C547] hover:opacity-80 transition-opacity"
            >
              View all 6 active rules →
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — THE RECORD
         ============================================================ */}
      <section className="border-b border-[#1E1E22]">
        <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-32">
          <Eyebrow>THE EXAMINER RECORD</Eyebrow>
          <h2
            className="text-2xl font-light mt-3 text-[#F2F2F0]"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            When the examiner asks — this is what you show them.
          </h2>
          <p className="text-[#6B6B72] text-sm max-w-lg mt-3 mb-10 leading-relaxed">
            Every governance decision ERA CUE makes produces a printable,
            FINRA-defensible record. The check chain. The reviewer&apos;s
            structured decision. The principal&apos;s identity and authority.
            SHA-256 locked.
          </p>

          {/* Four proof points — 2x2 on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="flex gap-4">
              <div className="font-mono text-xs text-[#E8C547] pt-0.5 shrink-0">01</div>
              <div>
                <div className="text-[#F2F2F0] text-sm">Five-check audit chain</div>
                <p className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                  Rule, Consistency, Alignment, Quiet Period, Agent Origin.
                  Every check recorded, pass or fail.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="font-mono text-xs text-[#E8C547] pt-0.5 shrink-0">02</div>
              <div>
                <div className="text-[#F2F2F0] text-sm">Named principal identity</div>
                <p className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                  FINRA Rule 3110(a) requires a designated principal. ERA CUE
                  records who they are and what authority they hold.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="font-mono text-xs text-[#E8C547] pt-0.5 shrink-0">03</div>
              <div>
                <div className="text-[#F2F2F0] text-sm">Structured reviewer decision</div>
                <p className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                  No freeform notes. Basis, verdict assessment, supplemental
                  note. Constrained fields limit liability.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="font-mono text-xs text-[#E8C547] pt-0.5 shrink-0">04</div>
              <div>
                <div className="text-[#F2F2F0] text-sm">SHA-256 immutability</div>
                <p className="text-[#6B6B72] text-xs mt-1 leading-relaxed">
                  Append-only database constraints. The record cannot be
                  altered after the fact.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href={`/drafts/${EXAMINER_DRAFT_ID}/examiner`}
              className="text-xs font-mono text-[#E8C547] hover:opacity-80 transition-opacity"
            >
              See a live examiner record →
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — FOOTER STRIP
         ============================================================ */}
      <footer className="border-t border-[#1E1E22]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="font-mono text-xs text-[#6B6B72]">
            ERA CUE · demo · May 2026
          </div>
          <div className="text-xs text-[#6B6B72] md:text-center">
            Demo data only. No live customer information. Audit trail and
            SHA-256 constraints are real.
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <Link href="/rules" className="text-[#6B6B72] hover:text-[#F2F2F0] transition-colors">
              Rules
            </Link>
            <Link href="/dashboard" className="text-[#6B6B72] hover:text-[#F2F2F0] transition-colors">
              Dashboard
            </Link>
            <Link href="/reviewer/queue" className="text-[#6B6B72] hover:text-[#F2F2F0] transition-colors">
              Reviewer queue
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
