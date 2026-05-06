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

const EXAMINER_DRAFT_ID = "e71b56c1-2e30-4a9c-bb78-f0db7ee1f651";
// CCO role card links to a different blocked Marcus Rivera draft so the
// examiner record on that page demonstrates a different rule firing path
// than the one in the Examiner Record section below.
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

function KeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-sm">
      {children}
    </span>
  );
}

// ---------- Page ----------------------------------------------------------

export default function Home() {
  return (
    <div className="bg-[#F8F9FB] min-h-screen">
      {/* v2-homepage-2026-redesign */}
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
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm border bg-[#EFF8FF] text-[#1447C0] border-[#BAE6FD]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB] inline-block shrink-0"></span>
              FINRA Rule 3110
            </span>
            {/* Badge 3 — EU AI Act */}
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm border bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] inline-block shrink-0"></span>
              EU AI Act Art. 50
            </span>
          </div>

          <h1
            className="font-light leading-tight tracking-tight text-[#0F172A] text-4xl md:text-5xl max-w-3xl mb-6"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            The governed moment between AI and publish.
          </h1>

          <p className="text-base md:text-lg font-normal text-[#374151] max-w-xl leading-relaxed mb-10">
            AI drafts. Executives post. Nobody has a record that anyone
            checked — or that the messaging was consistent with last week.
            ERA CUE changes that.
          </p>

          <div className="mb-8">
            <Link
              href="/submit"
              className="inline-flex items-center bg-[#0F172A] text-white text-sm font-medium px-4 py-2 rounded-sm hover:bg-[#1E293B] transition"
            >
              Check a draft before it goes live →
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#1447C0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB] inline-block"></span>
              FINRA Rule 3110 · Supervision
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#1447C0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB] inline-block"></span>
              FINRA Rule 2210 · Communications
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#475569]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64748B] inline-block"></span>
              SEC Reg FD · Fair Disclosure
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#475569]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64748B] inline-block"></span>
              SEC Rule 204-2 · RIA Records
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#92400E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] inline-block"></span>
              EU AI Act Art. 50 · Transparency
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#475569]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64748B] inline-block"></span>
              SEC Rule 17a-4 · Retention
            </span>
          </div>

          <p className="text-sm text-[#374151] mt-4 max-w-md leading-relaxed">
            Paste any executive communication. ERA CUE checks it against your
            governance rules, flags violations, and routes it to your designated
            principal — before it reaches the public.
          </p>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — THE GOVERNED MOMENT
         ============================================================ */}
      <section className="bg-white border-y border-[#E2E8F0] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <Eyebrow>THE GOVERNED MOMENT</Eyebrow>
          <h2
            className="text-2xl font-light text-[#0F172A] mt-2 mb-1"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            Tuesday, 8:47 AM. The CEO posted during a quiet period.
          </h2>
          <p className="text-sm text-[#64748B] mb-8">
            ERA CUE caught it before it went live. Here is the complete record.
          </p>

          {/* Evidence artifact */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1 — Draft */}
              <div>
                <Eyebrow>DRAFT · CEO · LINKEDIN · AI ASSISTED</Eyebrow>
                <p
                  className="italic text-lg text-[#0F172A] mt-3 leading-snug"
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
                  <CheckRow name="Quiet Period Check" result="FAIL" />
                  <CheckRow name="Consistency Check" result="PASS" />
                  <CheckRow name="Alignment Check" result="PASS" />
                  <CheckRow name="Agent Origin Check" result="PASS" />
                </ul>
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-[#64748B] mt-4">
            SHA-256 locked · append-only · record cannot be altered
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — FIVE ROLE CARDS
          2×2 grid for cards 01–04 with card 05 spanning full width on
          its own row (signalled by the lighter #F8F9FB card background).
         ============================================================ */}
      <section>
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <Eyebrow>BUILT FOR EVERY ROLE</Eyebrow>
          <h2
            className="text-2xl font-light text-[#0F172A] mt-2 mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            From the executive drafting the post to the examiner reviewing the record.
          </h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARD 01 — Executive */}
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                EXECUTIVE · FOUNDER · CEO
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-2 leading-snug">
                Check it before you post.
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
                Draft anything. ERA CUE checks it against your
                organization&apos;s active governance rules in under one
                second. If something&apos;s wrong, you see exactly why —
                before it reaches anyone.
              </p>
              <Link
                href="/submit"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-auto transition-colors"
              >
                Check a draft →
              </Link>
            </div>

            {/* CARD 02 — CMO / Comms / Brand */}
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                CMO · VP COMMS · PR AGENCY
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-2 leading-snug">
                See everything before it goes live.
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
                Every executive on your team. Every campaign. Every channel.
                ERA CUE flags contradictions, catches violations, and checks
                new drafts against your team&apos;s approved statement
                history — automatically.
              </p>
              <Link
                href="/dashboard"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-auto transition-colors"
              >
                View the dashboard →
              </Link>
            </div>

            {/* CARD 03 — CCO / GC / RIA / Broker-dealer */}
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                CCO · GENERAL COUNSEL · RIA · BROKER-DEALER
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-2 leading-snug">
                The supervisory record, ready for examination.
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
                FINRA Rule 3110
                <a href="#ref-1">
                  <sup className="font-mono text-[10px] text-[#94A3B8] ml-0.5 hover:text-[#1A56DB]">1</sup>
                </a>{" "}
                requires named principal review of communications. Rule
                2210(b)
                <a href="#ref-2">
                  <sup className="font-mono text-[10px] text-[#94A3B8] ml-0.5 hover:text-[#1A56DB]">2</sup>
                </a>{" "}
                requires pre-approval of retail communications. SEC Rule
                204-2
                <a href="#ref-5">
                  <sup className="font-mono text-[10px] text-[#94A3B8] ml-0.5 hover:text-[#1A56DB]">5</sup>
                </a>{" "}
                requires records of all advisory communications. ERA CUE
                produces all three — in one governed submission.
              </p>
              <Link
                href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
                className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-auto transition-colors"
              >
                See the examiner record →
              </Link>
            </div>

            {/* CARD 04 — IR / GC / Public Co */}
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                IR · GC · PUBLIC COMPANY
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-2 leading-snug">
                Reg FD enforced at the moment of drafting.
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
                The DraftKings
                <a href="#ref-8">
                  <sup className="font-mono text-[10px] text-[#94A3B8] ml-0.5 hover:text-[#1A56DB]">8</sup>
                </a>{" "}
                CEO posted on LinkedIn during a quiet period. SEC charged
                the company $200K. ERA CUE enforces earnings quiet periods
                and flags Reg FD-sensitive language before any executive
                communicates publicly — and creates the disclosure record
                automatically.
              </p>
              <Link
                href="/rules"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-auto transition-colors"
              >
                See active rules →
              </Link>
            </div>

            {/* CARD 05 — Investment bank / PE / Hedge fund · full width */}
            <div className="md:col-span-2 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                INVESTMENT BANK · PRIVATE EQUITY · HEDGE FUND
              </div>
              <div className="text-lg font-semibold text-[#0F172A] mb-2 leading-snug">
                Deal-specific quiet periods. Portfolio company communications. Transaction announcements.
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
                Every deal, fundraise, and exit creates a communications
                minefield. ERA CUE enforces deal-specific quiet periods
                across your entire team — partners, associates, portfolio
                company executives. Every communication checked before it
                goes out. Every approval on record.
              </p>
              <Link
                href="/rules"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-auto transition-colors"
              >
                See how rules work →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3.5 — MULTI-SPEAKER CAMPAIGN SNAPSHOT
          Static demo data; no Supabase query.
         ============================================================ */}
      <section className="bg-white border-y border-[#E2E8F0] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-4">
            ONE PRINCIPAL · FOUR EXECUTIVES · ONE CAMPAIGN WINDOW
          </div>
          <h2
            className="font-light text-2xl md:text-3xl text-[#0F172A] mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            ERA CUE governs your entire team — simultaneously.
          </h2>
          <p className="text-sm text-[#64748B] max-w-xl mb-10 leading-relaxed">
            One CCO or General Counsel overseeing every executive&apos;s public
            communications — across teams, campaigns, and regulatory requirements.
            Every draft checked. Every conflict surfaced. Every decision on record —
            before anything goes live.
          </p>

          {/* Campaign header strip */}
          <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm px-5 py-3 flex justify-between items-center mb-1">
            <div className="flex items-baseline">
              <span className="font-mono text-xs text-[#64748B] uppercase tracking-widest">
                Campaign
              </span>
              <span className="text-sm font-medium text-[#0F172A] ml-3">
                Series B Announce
              </span>
            </div>
            <span className="font-mono text-xs text-[#64748B]">
              Active window · Jun 30, 2026
            </span>
          </div>

          {/* Speaker rows */}
          {[
            { name: "Marcus Rivera", role: "CEO",                            drafts: 6, blocked: 4, escalated: 1, highest: true },
            { name: "Lena Brooks",   role: "Chief Communications Officer",   drafts: 5, blocked: 3, escalated: 0, highest: false },
            { name: "James Kim",     role: "Head of Investor Relations",     drafts: 4, blocked: 1, escalated: 2, highest: false },
            { name: "Priya Patel",   role: "Chief Marketing Officer",        drafts: 3, blocked: 2, escalated: 1, highest: false },
          ].map((s) => (
            <div
              key={s.name}
              className="bg-white border border-[#E2E8F0] rounded-sm px-5 py-4 flex items-center justify-between mb-1"
            >
              <div>
                <div className="text-sm font-medium text-[#0F172A]">{s.name}</div>
                <div className="font-mono text-xs text-[#64748B]">{s.role}</div>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-mono text-xs text-[#64748B]">{s.drafts} drafts</span>
                {s.blocked > 0 ? (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm border bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]">
                    {s.blocked} blocked
                  </span>
                ) : (
                  <span className="font-mono text-xs text-[#64748B]">0 blocked</span>
                )}
                {s.escalated > 0 ? (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm border bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]">
                    {s.escalated} escalated
                  </span>
                ) : (
                  <span className="font-mono text-xs text-[#64748B]">0 escalated</span>
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
          <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm px-5 py-3 mt-1 flex justify-between items-center">
            <span className="font-mono text-xs text-[#64748B]">
              38 drafts · 14 blocked · 5 escalated · 2 overridden
            </span>
            <span className="font-mono text-xs text-[#64748B]">
              Supervised by: Sarah Chen · General Counsel · Designated Principal · FINRA Rule 3110(a)
            </span>
          </div>

          <Link
            href="/dashboard"
            className="block font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-6 transition-colors"
          >
            View live dashboard →
          </Link>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — RULES ENGINE
         ============================================================ */}
      <section className="bg-white border-y border-[#E2E8F0] py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <Eyebrow>THE RULES ENGINE</Eyebrow>
          <h2
            className="text-2xl font-light text-[#0F172A] mt-2 mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            Your rules. Your authority. Enforced at the moment of submission.
          </h2>
          <p className="text-sm text-[#64748B] max-w-lg mb-10 leading-relaxed">
            ERA CUE checks every draft against rules your principal authorizes.
            Keywords, timing windows, quiet periods, competitor mentions. When
            a rule fires, the record shows exactly why.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1 — BLOCK */}
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
              <VerdictBlockBadge />
              <div className="text-sm font-medium text-[#0F172A] mt-3">
                Series B Quiet Period
              </div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                No hiring, growth, or fundraising language during quiet period.
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <KeywordChip>hiring</KeywordChip>
                <KeywordChip>expanding</KeywordChip>
                <KeywordChip>growth</KeywordChip>
                <KeywordChip>fundraising</KeywordChip>
                <KeywordChip>raised</KeywordChip>
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-4 pt-4 border-t border-[#E2E8F0]">
                Active until Jun 30, 2026 · Authorized by Sarah Chen, GC
              </div>
            </div>

            {/* Rule 2 — ESCALATE */}
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
              <VerdictEscalateBadge />
              <div className="text-sm font-medium text-[#0F172A] mt-3">
                Enterprise Sales Claims
              </div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Sales claims about enterprise customers must be reviewed by GC.
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <KeywordChip>fortune 500</KeywordChip>
                <KeywordChip>enterprise customer</KeywordChip>
                <KeywordChip>signed</KeywordChip>
                <KeywordChip>closed deal</KeywordChip>
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-4 pt-4 border-t border-[#E2E8F0]">
                Active — no end date · Authorized by Sarah Chen, GC
              </div>
            </div>
          </div>

          <Link
            href="/rules"
            className="block font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-6 transition-colors"
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
            className="text-2xl font-light text-[#0F172A] mt-2 mb-2"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            When the examiner asks — this is what you show them.
          </h2>
          <p className="text-sm text-[#64748B] max-w-lg mb-10 leading-relaxed">
            Every governance decision ERA CUE makes produces a printable,
            FINRA-defensible record. The check chain. The reviewer&apos;s
            structured decision. The principal&apos;s identity and authority.
            SHA-256 locked.
          </p>

          {/* Multi-rule framing callout */}
          <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm px-5 py-4 mb-8">
            <div className="font-mono text-base text-[#1447C0] font-semibold">
              One submission. Four regulatory requirements. One record.
            </div>
            <div className="font-mono text-xs text-[#64748B] mt-1">
              Rule 2210 content check · Rule 2210(b) principal pre-approval · Rule 3110 supervision record · SEC 17a-4 retention
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                num: "01",
                label: "Five-check audit chain",
                desc: "Rule, Consistency, Alignment, Quiet Period, Agent Origin. Every check recorded, pass or fail.",
              },
              {
                num: "02",
                label: "Dual-rule compliance",
                desc: "Rule 3110(a) supervision + Rule 2210(b) pre-approval. ERA CUE produces the supervisory evidence both rules require in one governed submission — the only tool that does.",
              },
              {
                num: "03",
                label: "Consistency on record",
                desc: "Every approved draft builds the speaker's compliance corpus. New drafts are checked against it automatically — no contradictions, no drift, no surprises.",
              },
              {
                num: "04",
                label: "Structured reviewer decision",
                desc: "No freeform notes. Basis, verdict assessment, supplemental note. Constrained fields limit liability.",
              },
              {
                num: "05",
                label: "SHA-256 immutability",
                desc: "Append-only database constraints. The record cannot be altered after the fact.",
              },
              {
                num: "06",
                label: "36-month retention",
                desc: "SEC Rule 17a-4 + FINRA Rule 4511. Every record retained 36 months, tamper-evident, accessible within 24 hours of request.",
              },
            ].map((p) => (
              <div key={p.num} className="flex gap-4 items-start">
                <div className="font-mono text-xs text-[#1A56DB] w-6 shrink-0 pt-0.5">
                  {p.num}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#0F172A]">{p.label}</div>
                  <p className="text-sm text-[#374151] mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href={`/drafts/${EXAMINER_DRAFT_ID}/examiner`}
            className="block font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] mt-8 transition-colors"
          >
            See a live examiner record →
          </Link>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — FOOTER
         ============================================================ */}
      <footer className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-xs text-[#64748B] flex items-center gap-2">
            <span style={{ fontFamily: "var(--font-newsreader)" }} className="text-base tracking-tight">
              <span className="text-[#1A56DB] font-bold">ERA</span>
              <span className="text-[#1A56DB] italic font-normal"> CUE</span>
            </span>
            <span className="font-mono">· demo · May 2026</span>
          </div>
          <div className="text-xs text-[#64748B] md:text-center">
            Demo data only. No live customer information. The append-only audit trail and tamper-evident records shown are real database constraints — not simulated.
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <Link href="/rules" className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              Rules
            </Link>
            <Link href="/dashboard" className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>

      {/* ============================================================
          SECTION 7 — REGULATORY REFERENCES
          Sits below the demo footer so the page closes on the legal
          framing the body copy cites. Each row carries an id="ref-N"
          so the inline superscript anchors in the CCO card jump
          straight to the right reference.
         ============================================================ */}
      <section className="border-t border-[#E2E8F0] bg-[#F8F9FB] px-6 py-8 md:px-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-4">
            Regulatory references
          </div>
          <div className="space-y-2">
            {[
              {
                num: 1,
                text: "FINRA Rule 3110(b)(4) — Review of Correspondence and Internal Communications. Requires evidence of review identifying the reviewer, communication reviewed, date of review, and actions taken.",
                url: "https://www.finra.org/rules-guidance/rulebooks/finra-rules/3110",
                label: "finra.org/rules-guidance/rulebooks/finra-rules/3110",
              },
              {
                num: 2,
                text: "FINRA Rule 2210(b) — Requires principal pre-approval of retail communications with the public before first use.",
                url: "https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210",
                label: "finra.org/rules-guidance/rulebooks/finra-rules/2210",
              },
              {
                num: 3,
                text: "EU AI Act Article 50(4) — Transparency obligations for AI-generated content. Human review exemption applies when content has undergone genuine editorial review by a natural or legal person. Obligations enforceable August 2026.",
                url: "https://artificialintelligenceact.eu/article/50/",
                label: "artificialintelligenceact.eu/article/50",
              },
              {
                num: 4,
                text: "SEC Regulation FD (Fair Disclosure) — Requires simultaneous public disclosure of material information provided to any investor. 17 CFR 243.100.",
                url: "https://www.sec.gov/rules-regulations/regulations/reg-fd",
                label: "sec.gov — Regulation FD",
              },
              {
                num: 5,
                text: "SEC Rule 204-2 — Investment Advisers Act. Requires RIAs to maintain records of all written communications relating to recommendations, advice, and client transactions for 5 years.",
                url: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204-2",
                label: "ecfr.gov — SEC Rule 204-2",
              },
              {
                num: 6,
                text: "FINRA 2026 Annual Regulatory Oversight Report — GenAI: Continuing and Emerging Trends. Recommends human-in-the-loop oversight for agentic AI, audit trails of agent actions, and explicit human checkpoints before execution.",
                url: "https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai",
                label: "finra.org — 2026 Annual Regulatory Oversight Report",
              },
              {
                num: 7,
                text: "SEC Rule 17a-4(b) — Requires preservation of communications records for 3 years, with the first 2 years in an accessible location.",
                url: "https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4",
                label: "ecfr.gov — SEC Rule 17a-4",
              },
              {
                num: 8,
                text: "SEC v. DraftKings Inc. (Sept. 26, 2024) — SEC charged DraftKings with Regulation FD violations for material nonpublic information posted on the CEO's personal LinkedIn and X accounts. $200,000 civil penalty.",
                url: "https://www.sec.gov/litigation/admin/2024/34-101107.pdf",
                label: "sec.gov — DraftKings Reg FD enforcement",
              },
            ].map((ref) => (
              <div
                key={ref.num}
                id={`ref-${ref.num}`}
                className="flex items-start gap-3 scroll-mt-6"
              >
                <span className="font-mono text-[10px] text-[#94A3B8] shrink-0 w-4 pt-0.5">
                  {ref.num}
                </span>
                <div>
                  <span className="font-mono text-[10px] text-[#64748B]">
                    {ref.text}{" "}
                  </span>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors"
                  >
                    {ref.label} ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="font-mono text-[10px] text-[#94A3B8] mt-6 pt-4 border-t border-[#E2E8F0]">
            ERA CUE is governance infrastructure, not legal advice. Firms
            should consult qualified legal counsel regarding their specific
            regulatory obligations. ERA CUE does not guarantee regulatory
            compliance.
          </div>
        </div>
      </section>
    </div>
  );
}
