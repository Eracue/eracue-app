import Link from "next/link";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EXAMINER_DRAFT_ID = "e71b56c1-2e30-4a9c-bb78-f0db7ee1f651";

// ---------- Small reusable pieces -----------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-[#6E6E68]">
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

function VerdictEscalateBadge() {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-sm border bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] text-xs font-mono font-bold tracking-widest">
      ESCALATE
    </span>
  );
}

function CheckRow({ name, result }: { name: string; result: "PASS" | "FAIL" }) {
  const dotColor = result === "PASS" ? "#166534" : "#B91C1C";
  return (
    <li className="flex items-center gap-2 text-xs font-mono mt-2">
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, backgroundColor: dotColor }}
      />
      <span className="text-[#1C1C1A]">{name}</span>
      <span className="text-[#6E6E68]">· {result}</span>
    </li>
  );
}

function KeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs bg-[#F0EFE9] text-[#6E6E68] px-2 py-0.5 rounded-sm">
      {children}
    </span>
  );
}

// ---------- Page ----------------------------------------------------------

export default function Home() {
  return (
    <div className="bg-[#F7F6F3] min-h-screen">
      <SiteHeader />

      {/* ============================================================
          SECTION 1 — HERO
         ============================================================ */}
      <section>
        <div className="max-w-[1100px] mx-auto px-6 pt-20 pb-16">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {/* Badge 1 — Governance Infrastructure */}
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm border bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64748B] inline-block shrink-0"></span>
              Governance Infrastructure
            </span>
            {/* Badge 2 — FINRA Rule 3110 */}
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm border bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] inline-block shrink-0"></span>
              FINRA Rule 3110
            </span>
            {/* Badge 3 — EU AI Act */}
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm border bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] inline-block shrink-0"></span>
              EU AI Act Art. 50
            </span>
          </div>

          <h1
            className="font-light leading-tight tracking-tight text-[#1C1C1A] text-5xl md:text-6xl max-w-3xl mb-6"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            The governed moment between AI and publish.
          </h1>

          <p className="text-lg text-[#6E6E68] max-w-xl leading-relaxed mb-10">
            AI agents draft. Executives post. Nobody has a record that a human
            approved it. ERA CUE is the governance layer that changes that —
            pre-publication checks, named principal approval, immutable audit
            trail.
          </p>

          <div className="mb-8">
            <Link
              href="/submit"
              className="inline-flex items-center bg-[#1C1C1A] text-white text-sm font-medium px-4 py-2 rounded-sm hover:bg-[#333331] transition"
            >
              See it catch something →
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#4338CA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] inline-block"></span>
              FINRA Rule 3110
            </span>
            <span className="text-[#E2E1DC] text-xs select-none">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#92400E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] inline-block"></span>
              EU AI Act Article 50
            </span>
            <span className="text-[#E2E1DC] text-xs select-none">·</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#475569]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64748B] inline-block"></span>
              SEC 17a-4
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — THE GOVERNED MOMENT
         ============================================================ */}
      <section className="bg-white border-y border-[#E2E1DC] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <Eyebrow>THE GOVERNED MOMENT</Eyebrow>
          <h2
            className="text-2xl font-light text-[#1C1C1A] mt-2 mb-1"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            Tuesday, 8:47 AM. The CEO posted during a quiet period.
          </h2>
          <p className="text-sm text-[#6E6E68] mb-8">
            ERA CUE caught it before it went live. Here is the complete record.
          </p>

          {/* Evidence artifact */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1 — Draft */}
              <div>
                <Eyebrow>DRAFT · CEO · LINKEDIN · AI ASSISTED</Eyebrow>
                <p
                  className="italic text-lg text-[#1C1C1A] mt-3 leading-snug"
                  style={{ fontFamily: "var(--font-newsreader)" }}
                >
                  &ldquo;We&apos;re aggressively hiring across engineering and
                  sales — exciting times ahead for the team.&rdquo;
                </p>
              </div>

              {/* Column 2 — Verdict */}
              <div>
                <Eyebrow>SYSTEM VERDICT</Eyebrow>
                <div className="mt-3">
                  <VerdictBlockBadge />
                </div>
                <div className="text-sm font-medium text-[#1C1C1A] mt-3">
                  Series B Quiet Period
                </div>
                <p className="text-xs text-[#6E6E68] mt-1 leading-relaxed">
                  No hiring, growth, or fundraising language during quiet period.
                </p>
                <div className="mt-3">
                  <span className="font-mono text-xs bg-[#F0EFE9] text-[#C9A92C] px-2 py-0.5 rounded-sm inline-block">
                    hiring
                  </span>
                </div>
              </div>

              {/* Column 3 — Five checks */}
              <div>
                <Eyebrow>CHECKS PERFORMED</Eyebrow>
                <ul>
                  <CheckRow name="Rule Check" result="FAIL" />
                  <CheckRow name="Quiet Period Check" result="FAIL" />
                  <CheckRow name="Consistency Check" result="PASS" />
                  <CheckRow name="Alignment Check" result="PASS" />
                  <CheckRow name="Agent Origin Check" result="PASS" />
                </ul>
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-[#6E6E68] mt-4">
            SHA-256 locked · append-only · record cannot be altered
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — THREE ROLES
         ============================================================ */}
      <section>
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <Eyebrow>WHO ERA CUE IS FOR</Eyebrow>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2E1DC] rounded-sm overflow-hidden">
            {/* Card 01 — Executive */}
            <div className="bg-[#F7F6F3] p-8">
              <div className="font-mono text-xs text-[#6E6E68]">01</div>
              <div className="text-sm font-medium text-[#1C1C1A] mt-3">
                Executive · Founder · CEO
              </div>
              <p className="text-sm text-[#6E6E68] mt-2 leading-relaxed">
                Draft anything. ERA CUE checks it before it leaves your hands.
                Your record is clean before you ask.
              </p>
              <Link
                href="/submit"
                className="block font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] mt-6 transition-colors"
              >
                Submit a draft →
              </Link>
            </div>

            {/* Card 02 — Comms / PR */}
            <div className="bg-[#F7F6F3] p-8">
              <div className="font-mono text-xs text-[#6E6E68]">02</div>
              <div className="text-sm font-medium text-[#1C1C1A] mt-3">
                VP Comms · PR Director · Agency
              </div>
              <p className="text-sm text-[#6E6E68] mt-2 leading-relaxed">
                See every draft your speakers submit. Every verdict, every
                override, every gap. One dashboard. No Monday morning surprises.
              </p>
              <Link
                href="/dashboard"
                className="block font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] mt-6 transition-colors"
              >
                View the dashboard →
              </Link>
            </div>

            {/* Card 03 — CCO / GC / Compliance */}
            <div className="bg-[#F7F6F3] p-8">
              <div className="font-mono text-xs text-[#6E6E68]">03</div>
              <div className="text-sm font-medium text-[#1C1C1A] mt-3">
                CCO · General Counsel · Compliance
              </div>
              <p className="text-sm text-[#6E6E68] mt-2 leading-relaxed">
                FINRA Rule 3110 requires proof a named principal reviewed
                AI-assisted communications. ERA CUE produces that record.
                Automatically.
              </p>
              <Link
                href={`/drafts/${EXAMINER_DRAFT_ID}/examiner`}
                className="block font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] mt-6 transition-colors"
              >
                See the examiner record →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3.5 — MULTI-SPEAKER CAMPAIGN SNAPSHOT
          Static demo data; no Supabase query.
         ============================================================ */}
      <section className="bg-white border-y border-[#E2E1DC] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] mb-4">
            ONE PRINCIPAL · FOUR EXECUTIVES · ONE CAMPAIGN WINDOW
          </div>
          <h2
            className="font-light text-2xl md:text-3xl text-[#1C1C1A] mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            ERA CUE governs your entire team — simultaneously.
          </h2>
          <p className="text-sm text-[#6E6E68] max-w-xl mb-10 leading-relaxed">
            One VP Comms or CCO overseeing every executive&apos;s public communications.
            Every draft checked. Every conflict surfaced. Every decision on record —
            before anything goes live.
          </p>

          {/* Campaign header strip */}
          <div className="bg-[#F7F6F3] border border-[#E2E1DC] rounded-sm px-5 py-3 flex justify-between items-center mb-1">
            <div className="flex items-baseline">
              <span className="font-mono text-xs text-[#6E6E68] uppercase tracking-widest">
                Campaign
              </span>
              <span className="text-sm font-medium text-[#1C1C1A] ml-3">
                Series B Announce
              </span>
            </div>
            <span className="font-mono text-xs text-[#6E6E68]">
              Active window · Jun 30, 2026
            </span>
          </div>

          {/* Speaker rows */}
          {[
            { name: "Marcus Rivera", role: "CEO",      drafts: 6, blocked: 4, escalated: 1, highest: true },
            { name: "Lena Brooks",   role: "VP Comms", drafts: 5, blocked: 3, escalated: 0, highest: false },
            { name: "James Kim",     role: "VP Sales", drafts: 4, blocked: 0, escalated: 2, highest: false },
            { name: "Priya Patel",   role: "CMO",      drafts: 3, blocked: 1, escalated: 1, highest: false },
          ].map((s) => (
            <div
              key={s.name}
              className="bg-white border border-[#E2E1DC] rounded-sm px-5 py-4 flex items-center justify-between mb-1"
            >
              <div>
                <div className="text-sm font-medium text-[#1C1C1A]">{s.name}</div>
                <div className="font-mono text-xs text-[#6E6E68]">{s.role}</div>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-mono text-xs text-[#6E6E68]">{s.drafts} drafts</span>
                {s.blocked > 0 ? (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm border bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]">
                    {s.blocked} blocked
                  </span>
                ) : (
                  <span className="font-mono text-xs text-[#6E6E68]">0 blocked</span>
                )}
                {s.escalated > 0 ? (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm border bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]">
                    {s.escalated} escalated
                  </span>
                ) : (
                  <span className="font-mono text-xs text-[#6E6E68]">0 escalated</span>
                )}
              </div>
              <div className="w-32 text-right">
                {s.highest && (
                  <span className="font-mono text-[10px] text-[#B91C1C] uppercase tracking-wide">
                    Highest exposure
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Governance summary strip */}
          <div className="bg-[#F7F6F3] border border-[#E2E1DC] rounded-sm px-5 py-3 mt-1 flex justify-between items-center">
            <span className="font-mono text-xs text-[#6E6E68]">
              18 drafts · 8 blocked · 3 escalated · 2 overridden
            </span>
            <span className="font-mono text-xs text-[#6E6E68]">
              Governed by: Sarah Chen · GC · Designated Principal
            </span>
          </div>

          <Link
            href="/dashboard"
            className="block font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] mt-6 transition-colors"
          >
            View live dashboard →
          </Link>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — RULES ENGINE
         ============================================================ */}
      <section className="bg-white border-y border-[#E2E1DC] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <Eyebrow>THE RULES ENGINE</Eyebrow>
          <h2
            className="text-2xl font-light text-[#1C1C1A] mt-2 mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            Your rules. Your authority. Enforced at the moment of submission.
          </h2>
          <p className="text-sm text-[#6E6E68] max-w-lg mb-10 leading-relaxed">
            ERA CUE checks every draft against rules your principal authorizes.
            Keywords, timing windows, quiet periods, competitor mentions. When
            a rule fires, the record shows exactly why.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1 — BLOCK */}
            <div className="bg-white border border-[#E2E1DC] rounded-sm p-6">
              <VerdictBlockBadge />
              <div className="text-sm font-medium text-[#1C1C1A] mt-3">
                Series B Quiet Period
              </div>
              <p className="text-xs text-[#6E6E68] mt-1 leading-relaxed">
                No hiring, growth, or fundraising language during quiet period.
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <KeywordChip>hiring</KeywordChip>
                <KeywordChip>expanding</KeywordChip>
                <KeywordChip>growth</KeywordChip>
                <KeywordChip>fundraising</KeywordChip>
                <KeywordChip>raised</KeywordChip>
              </div>
              <div className="font-mono text-xs text-[#6E6E68] mt-4 pt-4 border-t border-[#E2E1DC]">
                Active until Jun 30, 2026 · Authorized by Sarah Chen, GC
              </div>
            </div>

            {/* Rule 2 — ESCALATE */}
            <div className="bg-white border border-[#E2E1DC] rounded-sm p-6">
              <VerdictEscalateBadge />
              <div className="text-sm font-medium text-[#1C1C1A] mt-3">
                Enterprise Sales Claims
              </div>
              <p className="text-xs text-[#6E6E68] mt-1 leading-relaxed">
                Sales claims about enterprise customers must be reviewed by GC.
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <KeywordChip>fortune 500</KeywordChip>
                <KeywordChip>enterprise customer</KeywordChip>
                <KeywordChip>signed</KeywordChip>
                <KeywordChip>closed deal</KeywordChip>
              </div>
              <div className="font-mono text-xs text-[#6E6E68] mt-4 pt-4 border-t border-[#E2E1DC]">
                Active — no end date · Authorized by Sarah Chen, GC
              </div>
            </div>
          </div>

          <Link
            href="/rules"
            className="block font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] mt-6 transition-colors"
          >
            View all 6 active rules →
          </Link>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — EXAMINER RECORD
         ============================================================ */}
      <section>
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <Eyebrow>THE EXAMINER RECORD</Eyebrow>
          <h2
            className="text-2xl font-light text-[#1C1C1A] mt-2 mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            When the examiner asks — this is what you show them.
          </h2>
          <p className="text-sm text-[#6E6E68] max-w-lg mb-10 leading-relaxed">
            Every governance decision ERA CUE makes produces a printable,
            FINRA-defensible record. The check chain. The reviewer&apos;s
            structured decision. The principal&apos;s identity and authority.
            SHA-256 locked.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                num: "01",
                label: "Five-check audit chain",
                desc: "Rule, Consistency, Alignment, Quiet Period, Agent Origin. Every check recorded, pass or fail.",
              },
              {
                num: "02",
                label: "Named principal identity",
                desc: "FINRA Rule 3110(a) requires a designated principal. ERA CUE records who they are and what authority they hold.",
              },
              {
                num: "03",
                label: "Structured reviewer decision",
                desc: "No freeform notes. Basis, verdict assessment, supplemental note. Constrained fields limit liability.",
              },
              {
                num: "04",
                label: "SHA-256 immutability",
                desc: "Append-only database constraints. The record cannot be altered after the fact.",
              },
            ].map((p) => (
              <div key={p.num} className="flex gap-4 items-start">
                <div className="font-mono text-xs text-[#C9A92C] w-6 shrink-0 pt-0.5">
                  {p.num}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1C1C1A]">{p.label}</div>
                  <p className="text-xs text-[#6E6E68] mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href={`/drafts/${EXAMINER_DRAFT_ID}/examiner`}
            className="block font-mono text-xs text-[#C9A92C] hover:text-[#8A7520] mt-8 transition-colors"
          >
            See a live examiner record →
          </Link>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — FOOTER
         ============================================================ */}
      <footer className="border-t border-[#E2E1DC] bg-[#F7F6F3]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-xs text-[#6E6E68] flex items-center gap-2">
            <span style={{ fontFamily: "var(--font-newsreader)" }} className="text-base font-light tracking-tight">
              <span className="text-[#4F46E5]">ERA</span>
              <span className="text-[#4F46E5] italic"> CUE</span>
            </span>
            <span className="font-mono">· demo · May 2026</span>
          </div>
          <div className="text-xs text-[#6E6E68] md:text-center">
            Demo data only. No live customer information. Audit trail and SHA-256 constraints are real.
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <Link href="/rules" className="text-[#6E6E68] hover:text-[#1C1C1A] transition-colors">
              Rules
            </Link>
            <Link href="/dashboard" className="text-[#6E6E68] hover:text-[#1C1C1A] transition-colors">
              Dashboard
            </Link>
            <Link href="/reviewer/queue" className="text-[#6E6E68] hover:text-[#1C1C1A] transition-colors">
              Reviewer
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
