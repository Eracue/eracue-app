import Link from "next/link";
import { SiteHeader } from "@/app/site-header";
import { getSupabaseAdmin } from "@/lib/checks";
import { DEMO_ORG_ID } from "@/lib/demo-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// `fetchCache = "force-no-store"` is the third lever that stops Next from
// memoising fetch() responses inside the route handler. Combined with the
// CDN-level no-store header in next.config and the page-level dynamic
// directive, this makes the route fully uncacheable end-to-end. Required
// because Vercel's ISR was serving a months-old prerender of this page.
export const fetchCache = "force-no-store";

// "See the full record →" link in Section 2 routes to a blocked Marcus
// Rivera draft. Kept as a constant so the demo data id is changeable in
// one place.
const CCO_EXAMINER_DRAFT_ID = "afe14696-5336-4336-a0b7-c3410477ec31";

// ---------- Moat data --------------------------------------------------

type MoatData = {
  corpusCount: number;
  decisionCount: number;
};

/**
 * Pull the two live numbers the "What ERA CUE records" section
 * surfaces: corpus size and total reviewer decisions. The third tile
 * (records altered) is a hardcoded 0 — that one's a database invariant,
 * not a count.
 *
 * Failures fall back to zeroes so the homepage renders cleanly even
 * when Supabase env vars aren't configured (e.g. local first-time
 * setup before .env.local is wired).
 */
async function getMoatData(): Promise<MoatData> {
  try {
    const sb = getSupabaseAdmin();
    const [corpusRes, decisionRes] = await Promise.all([
      sb
        .from("drafts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", DEMO_ORG_ID)
        .eq("status", "approved"),
      // Strict filter on payload->>decision matches the dashboard so
      // we only count real form-driven decisions, not the legacy
      // seed.ts mirror rows that duplicate draft status onto the
      // reviewer_decided action_type.
      sb
        .from("actions")
        .select("*", { count: "exact", head: true })
        .eq("org_id", DEMO_ORG_ID)
        .eq("action_type", "reviewer_decided")
        .in("payload->>decision", ["override", "confirm_block", "approve", "reject"]),
    ]);

    return {
      corpusCount: corpusRes.count ?? 0,
      decisionCount: decisionRes.count ?? 0,
    };
  } catch {
    return { corpusCount: 0, decisionCount: 0 };
  }
}

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

function KeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-sm">
      {children}
    </span>
  );
}

// ---------- Page ----------------------------------------------------------

export default async function Home() {
  const { corpusCount, decisionCount } = await getMoatData();
  return (
    <div className="bg-[#F8F9FB] min-h-screen">
      {/* v2-homepage-2026-redesign */}
      <SiteHeader />

      {/* ============================================================
          SECTION 1 — HERO (dark, two-column)
          Left col (3/5): eyebrow, headline, subhead, regulatory line,
          two CTAs, footer line.
          Right col (2/5, desktop only): white card mockup of the BLOCK
          verdict UI — a coded simulation, not an image, so it stays
          crisp at every viewport and matches the production verdict
          card pixel-for-pixel.
         ============================================================ */}
      <section className="bg-[#0F172A] py-24 md:py-32">
        <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-1 md:grid-cols-5 gap-12 items-center">
          {/* LEFT — copy + CTAs */}
          <div className="md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4">
              Pre-publication governance · AI 2026
            </div>

            <h1
              className="font-light leading-tight tracking-tight text-white text-4xl md:text-6xl mb-4"
              style={{ fontFamily: "var(--font-newsreader)" }}
            >
              The governed moment
              <br />
              between AI and publish.
            </h1>

            <p className="text-base text-white/70 max-w-lg mb-2 leading-relaxed">
              Every AI draft your team creates gets checked against your governance rules, reviewed by a named principal, and locked in an immutable record — before anyone publishes anything.
            </p>
            {/* Two-buyer framing — the same product reads differently to a
                FINRA-regulated firm (supervisory evidence) versus a brand
                governance buyer (responsible-comms record). The single
                paragraph below carries both pitches in one breath. */}
            <p className="font-mono text-sm text-white/40 max-w-lg mb-8">
              For regulated firms: FINRA-ready supervisory evidence. For everyone else: the approval record that proves your team communicated responsibly.
            </p>

            <div className="flex gap-3 flex-wrap">
              <a
                href="/submit"
                className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-6 py-3 rounded-sm hover:bg-[#1447C0] transition-colors"
              >
                Try it now →
              </a>
              <a
                href="mailto:hello@eracue.com?subject=ERA%20CUE%20Demo%20Request"
                className="bg-white/10 text-white border border-white/20 font-mono text-sm font-medium px-6 py-3 rounded-sm hover:bg-white/20 transition-colors"
              >
                Request a demo →
              </a>
            </div>

            <div className="font-mono text-[10px] text-white/20 mt-3">
              No login required to try · Regulated firms request a demo
            </div>
          </div>

          {/* RIGHT — coded BLOCK verdict mockup, hidden on mobile so the
              hero stays compact. Mirrors the live verdict card so what
              the prospect sees here matches what they'll see at /submit. */}
          <div className="md:col-span-2 hidden md:block">
            <div className="bg-white rounded-sm border border-white/10 p-5 shadow-2xl shadow-black/50">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                ERA CUE · Governance check
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-xs font-bold uppercase px-3 py-1.5 rounded-sm bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                  BLOCK
                </span>
                <span className="text-sm font-medium text-[#0F172A]">
                  Series B Quiet Period
                </span>
              </div>

              <div className="text-xs text-[#374151] italic mb-4 bg-[#F8F9FB] rounded-sm p-3 leading-relaxed">
                &ldquo;We&apos;re aggressively hiring across engineering and sales...&rdquo;
              </div>

              {/* Five checks — name + result, mono'd for ledger feel */}
              <div className="space-y-1.5 mb-4">
                {[
                  { name: "Rule Check", result: "FAIL", fail: true },
                  { name: "Quiet Period", result: "FAIL", fail: true },
                  { name: "Consistency", result: "PASS", fail: false },
                  { name: "Alignment", result: "PASS", fail: false },
                  { name: "Agent Origin", result: "PASS", fail: false },
                ].map((check) => (
                  <div key={check.name} className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {check.name}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        check.fail ? "text-[#B91C1C]" : "text-[#166534]"
                      }`}
                    >
                      {check.result}
                    </span>
                  </div>
                ))}
              </div>

              <div className="font-mono text-[10px] text-[#94A3B8] border-t border-[#E2E8F0] pt-3">
                SHA-256 locked · append-only · cannot be altered
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 1.1 — SOCIAL PROOF BAR
          Thin dark band after the hero. Establishes "who this is for"
          before the regulatory frame.
         ============================================================ */}
      <section className="bg-[#0F172A] border-t border-white/5 py-6 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">
              Built for
            </span>
            {[
              "Broker-Dealers",
              "Registered Investment Advisers",
              "Public Companies",
              "Investment Banks",
              "PR Agencies",
              "Executive Teams",
            ].map((type) => (
              <span
                key={type}
                className="font-mono text-[10px] uppercase tracking-widest text-white/40"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 1.2 — REGULATORY TRUST BADGES
          Relocated from the old hero so the new two-column hero stays
          uncluttered. Six colored pills, one regulatory family per
          color: blue = FINRA, teal = SEC RIA/Reg FD, violet = EU AI
          Act, amber = SEC Rule 17a-4 retention.
         ============================================================ */}
      <section className="bg-[#0F172A] border-t border-white/5 py-8 px-6">
        <div className="max-w-[1100px] mx-auto flex flex-wrap gap-2 justify-center">
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest bg-[#1A56DB]/20 text-[#93C5FD] border border-[#1A56DB]/40">
            FINRA Rule 3110 · Supervision
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest bg-[#1A56DB]/20 text-[#93C5FD] border border-[#1A56DB]/40">
            FINRA Rule 2210 · Communications
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest bg-[#0D9488]/20 text-[#5EEAD4] border border-[#0D9488]/40">
            SEC Reg FD · Fair Disclosure
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest bg-[#0D9488]/20 text-[#5EEAD4] border border-[#0D9488]/40">
            SEC Rule 204-2 · RIA Records
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest bg-[#7C3AED]/20 text-[#C4B5FD] border border-[#7C3AED]/40">
            EU AI Act Art. 50 · Transparency
          </span>
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest bg-[#D97706]/20 text-[#FCD34D] border border-[#D97706]/40">
            SEC Rule 17a-4 · Retention
          </span>
        </div>
      </section>

      {/* ============================================================
          SECTION 1.3 — HOW IT WORKS (three-screen workflow)
          First detailed beat after the regulatory framing. Each step
          maps to a real surface in the product (rules, submit,
          examiner) and links there directly via the demo bypass.
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
            Three steps. Under two minutes.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Configure your governance",
                desc: "The CCO or GC sets up rules — from scratch, from templates, or by importing existing WSPs. ERA CUE extracts rules automatically. Every rule is authorized by a named principal.",
                detail: "WSP import · FINRA templates · AI-assisted rule creation",
                color: "text-[#1A56DB]",
                href: "/rules",
              },
              {
                step: "02",
                title: "Check before you publish",
                desc: "Any executive pastes a draft. ERA CUE runs five governance checks in under one second — rule matching, consistency, quiet period, alignment, agent origin. Verdict: CLEAR, REVIEW, ESCALATE, or BLOCK.",
                detail: "5 checks · Under 1 second · Named principal review",
                color: "text-[#C2410C]",
                href: "/submit",
              },
              {
                step: "03",
                title: "The record that proves you checked",
                desc: "ERA CUE generates an immutable communication record — named principal, structured decision, SHA-256 locked audit trail. FINRA-ready. Downloadable as PDF.",
                detail: "SHA-256 · Append-only · FINRA Rule 3110",
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
          SECTION 2 — WHY ERA CUE EXISTS (three problem cards)
          Replaces the single CEO scenario with three short narratives —
          regulatory, brand, and agentic — each ending in a green
          "With ERA CUE" callout. Same persuasive structure as a single
          scenario card but covers three buyer modes in one section.
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Why ERA CUE exists
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-12 max-w-2xl"
          >
            Three moments where the absence of a governance record becomes a problem.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Problem 1 — Compliance risk (red top accent) */}
            <div className="border border-[#E2E8F0] rounded-sm p-6 border-t-4 border-t-[#B91C1C]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#B91C1C] mb-4">
                Compliance risk
              </div>
              <div className="text-sm text-[#374151] leading-relaxed mb-6 space-y-2">
                <p>A registered rep posts on LinkedIn without pre-approval.</p>
                <p>FINRA asks for the supervision record during examination.</p>
                <p className="font-medium text-[#0F172A]">
                  The firm has an email chain from six months ago.
                </p>
              </div>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-3">
                <div className="font-mono text-[10px] text-[#166534] uppercase tracking-widest mb-1">
                  With ERA CUE
                </div>
                <div className="text-xs text-[#374151]">
                  Named principal decision. Structured basis. SHA-256 locked. FINRA Rule 3110-ready on day one.
                </div>
              </div>
            </div>

            {/* Problem 2 — Messaging inconsistency (orange top accent) */}
            <div className="border border-[#E2E8F0] rounded-sm p-6 border-t-4 border-t-[#C2410C]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#C2410C] mb-4">
                Messaging inconsistency
              </div>
              <div className="text-sm text-[#374151] leading-relaxed mb-6 space-y-2">
                <p>VP Sales posts that pricing is &ldquo;industry-leading.&rdquo;</p>
                <p>The CEO said &ldquo;competitive&rdquo; two weeks earlier.</p>
                <p className="font-medium text-[#0F172A]">
                  An analyst notices. The story runs in the press.
                </p>
              </div>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-3">
                <div className="font-mono text-[10px] text-[#166534] uppercase tracking-widest mb-1">
                  With ERA CUE
                </div>
                <div className="text-xs text-[#374151]">
                  Consistency check catches the contradiction against the CEO&apos;s approved statement. Flagged before publication.
                </div>
              </div>
            </div>

            {/* Problem 3 — Agentic publishing (violet top accent) */}
            <div className="border border-[#E2E8F0] rounded-sm p-6 border-t-4 border-t-[#7C3AED]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#7C3AED] mb-4">
                Agentic publishing
              </div>
              <div className="text-sm text-[#374151] leading-relaxed mb-6 space-y-2">
                <p>AI agent drafts and schedules 8 posts for the week.</p>
                <p>Three contain forward guidance. No human reviews them.</p>
                <p className="font-medium text-[#0F172A]">
                  They all publish. The CCO finds out from a client.
                </p>
              </div>
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-3">
                <div className="font-mono text-[10px] text-[#166534] uppercase tracking-widest mb-1">
                  With ERA CUE
                </div>
                <div className="text-xs text-[#374151]">
                  ERA CUE is the agent gateway. Every agent-drafted post requires a clearance token. No token, no publish.
                </div>
              </div>
            </div>
          </div>

          {/* Live-product handoff — the demo bypass means /submit is
              reachable without auth, so this lands the reader directly
              on the same engine the problem narratives describe. */}
          <div className="mt-8 text-center">
            <a
              href="/submit"
              className="font-mono text-sm font-medium text-[#1A56DB] hover:text-[#1447C0] transition-colors"
            >
              See ERA CUE catch a violation in real time →
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — FIVE ROLE CARDS (dark)
          2×2 grid for cards 01–04 with card 05 spanning full width on
          its own row (signalled by a lifted bg-white/8 surface).
         ============================================================ */}
      <section className="bg-[#0F172A]">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/50 mb-2">
            BUILT FOR EVERY ROLE
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
                Check it before you post.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                Draft anything. ERA CUE checks it against your
                organization&apos;s active governance rules in under one
                second. If something&apos;s wrong, you see exactly why —
                before it reaches anyone.
              </p>
            </div>

            {/* CARD 02 — CMO / Comms / Brand · violet accent */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#7C3AED] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#C4B5FD] mb-3">
                CMO · VP COMMS · PR AGENCY
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                See everything before it goes live.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                Every executive on your team. Every campaign. Every channel.
                ERA CUE flags contradictions, catches violations, and checks
                new drafts against your team&apos;s approved statement
                history — automatically.
              </p>
            </div>

            {/* CARD 03 — CCO / GC / RIA / Broker-dealer · ERA CUE blue */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#1A56DB] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#93C5FD] mb-3">
                CCO · GENERAL COUNSEL · RIA · BROKER-DEALER
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                The supervisory record, ready for examination.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                FINRA Rule 3110
                <a href="#ref-1">
                  <sup className="font-mono text-[10px] text-white/40 ml-0.5 hover:text-[#93C5FD]">1</sup>
                </a>{" "}
                requires named principal review of communications. Rule
                2210(b)
                <a href="#ref-2">
                  <sup className="font-mono text-[10px] text-white/40 ml-0.5 hover:text-[#93C5FD]">2</sup>
                </a>{" "}
                requires pre-approval of retail communications. SEC Rule
                204-2
                <a href="#ref-5">
                  <sup className="font-mono text-[10px] text-white/40 ml-0.5 hover:text-[#93C5FD]">5</sup>
                </a>{" "}
                requires records of all advisory communications. ERA CUE
                produces all three — in one governed submission.
              </p>
            </div>

            {/* CARD 04 — IR / General Counsel / Public Co · teal accent */}
            <div className="bg-white/5 border border-white/10 border-l-4 border-l-[#0D9488] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#5EEAD4] mb-3">
                IR · GENERAL COUNSEL · PUBLIC COMPANY
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                Reg FD enforced at the moment of drafting.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                In 2024, SEC charged DraftKings
                <a href="#ref-6">
                  <sup className="font-mono text-[10px] text-white/40 ml-0.5 hover:text-[#5EEAD4]">6</sup>
                </a>{" "}
                $200K after the CEO posted material nonpublic information
                on personal LinkedIn and X accounts during a quiet period.
                ERA CUE enforces earnings quiet periods and flags Reg
                FD-sensitive language before any executive communicates
                publicly.
              </p>
            </div>

            {/* CARD 05 — Investment bank / PE / Hedge fund · slate accent · full width */}
            <div className="md:col-span-2 bg-white/[0.08] border border-white/15 border-l-4 border-l-[#94A3B8] rounded-sm p-6 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CBD5E1] mb-3">
                INVESTMENT BANK · PRIVATE EQUITY · HEDGE FUND
              </div>
              <div className="text-lg font-semibold text-white mb-2 leading-snug">
                Deal-specific quiet periods. Every partner. Every portfolio company.
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">
                Every deal, fundraise, and exit creates a communications
                minefield. ERA CUE enforces transaction-specific quiet
                periods across your entire team — partners, associates,
                and portfolio company executives. Every communication
                checked before it goes out. Every approval on record.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3.05 — COORDINATED COMMUNICATIONS (campaign view)
          Dark mini campaign-record card. Sits between the role cards
          (audience) and the feature grid (capabilities) so the team-
          coordination story lands before the surface-level feature
          enumeration. Mini stats grid (12 / 9 / 3 / 0) + four speaker
          rows. Replaces the old multi-speaker snapshot.
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-[#0F172A]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">
            Coordinated communications
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-4 max-w-2xl"
          >
            Govern an entire campaign — not just one draft.
          </div>
          <div className="text-sm text-white/50 mb-12 max-w-xl leading-relaxed">
            PR agencies, comms teams, and regulated firms use ERA CUE to govern every communication across a campaign window — tracking who said what, when, on which platform, and who approved it.
          </div>

          {/* Mini campaign record card */}
          <div className="bg-white/5 border border-white/10 rounded-sm p-6 max-w-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">
                  Campaign record
                </div>
                <div className="text-white font-semibold text-lg">Series B Announce</div>
                <div className="font-mono text-[10px] text-white/30 mt-1">
                  Apr 15 – Jun 30, 2026 · Governed by Sarah Chen, GC
                </div>
              </div>
              <Link
                href="/campaigns/Series%20B%20Announce"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#60A5FA] transition-colors whitespace-nowrap"
              >
                View full record →
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b border-white/10">
              {[
                { n: "12", l: "Total" },
                { n: "9", l: "Approved", c: "text-[#4ADE80]" },
                { n: "3", l: "Flagged", c: "text-[#FCA5A5]" },
                { n: "0", l: "Pending", c: "text-white" },
              ].map((s) => (
                <div key={s.l}>
                  <div className={`font-mono text-2xl font-light mb-1 ${s.c ?? "text-white"}`}>
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
                { name: "Marcus Rivera", role: "CEO", drafts: 4, flagged: 2 },
                { name: "Lena Brooks", role: "Chief Comms Officer", drafts: 3, flagged: 1 },
                { name: "James Kim", role: "Head of IR", drafts: 3, flagged: 0 },
                { name: "Priya Patel", role: "Chief Marketing Officer", drafts: 2, flagged: 0 },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-sm text-white/80 font-medium">{s.name}</span>
                    <span className="font-mono text-[10px] text-white/30 ml-2">{s.role}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-white/40">
                      {s.drafts} drafts
                    </span>
                    {s.flagged > 0 ? (
                      <span className="font-mono text-[10px] text-[#FCA5A5]">
                        {s.flagged} flagged
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[#4ADE80]">all clear</span>
                    )}
                  </div>
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
          SECTION 3.1 — FEATURE GRID
          Twelve features in a 4-col hairline grid (gap-px on a slate
          background gives the Bloomberg-terminal look). Sits after
          the role cards so the audience-fit narrative flows
          "who uses it → what's in it → why it gets smarter".
         ============================================================ */}
      <section className="py-16 px-6 md:px-12 bg-[#F8F9FB] border-t border-[#E2E8F0]">
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
              // Governance checks
              { name: "Rule Check", desc: "Keyword + pattern matching against active rules" },
              { name: "Consistency Check", desc: "New drafts checked against approved corpus" },
              { name: "Quiet Period Enforcement", desc: "Time-bounded communication restrictions" },
              { name: "Agent Origin Check", desc: "AI involvement declared and recorded" },

              // Workflow
              { name: "Named Principal Review", desc: "Structured decision with documented basis" },
              { name: "WSP Enforcement", desc: "Rules cite the WSP section they implement" },
              { name: "Campaign Records", desc: "All communications under one campaign view" },
              { name: "Batch Submission", desc: "Multiple drafts checked simultaneously" },

              // Records
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
          SECTION 3.25 — THE MOAT (live data)
          Three live moments pulled from the demo org via getMoatData.
          The numbers don't change between page loads in tests, but
          they're real reads from drafts + actions — not hardcoded —
          so a new approval or decision moves the dial automatically.
         ============================================================ */}
      <section className="py-16 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            What ERA CUE records
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-2xl font-light text-[#0F172A] mb-10"
          >
            Every decision. Permanently.
          </div>

          {/* gap-px + a slate background reads as a hairline grid in light
              mode, which feels closer to the "Bloomberg terminal" demo
              ethos than padded floating cards. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2E8F0] border border-[#E2E8F0] rounded-sm overflow-hidden">
            {/* Card 1 — Corpus (live count) */}
            <div className="bg-white p-6">
              <div className="font-mono text-4xl font-light text-[#1A56DB] mb-2">
                {corpusCount}
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Principal-approved statements
              </div>
              <div className="text-sm text-[#64748B] leading-relaxed">
                Every communication approved through ERA CUE enters the governance corpus — checked against every future draft from the same speaker automatically.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
                Corpus is principal-approved only. No unreviewed content enters.
              </div>
            </div>

            {/* Card 2 — Immutability. Hardcoded zero is honest: the
                actions table's append-only triggers refuse UPDATE and
                DELETE at the database level, so this number is literally
                a database invariant, not a count. */}
            <div className="bg-white p-6">
              <div className="font-mono text-4xl font-light text-[#166534] mb-2">
                0
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Records altered since launch
              </div>
              <div className="text-sm text-[#64748B] leading-relaxed">
                Every governance decision is SHA-256 locked at insert. The database refuses UPDATE and DELETE — not the application. The record is permanent by design.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
                Not a policy. A database constraint.
              </div>
            </div>

            {/* Card 3 — Decisions (live count). Top-rule footer dropped
                since it surfaced a single rule's effectiveness number
                that read random without context. The new footer makes
                the calibration claim directly. */}
            <div className="bg-white p-6">
              <div className="font-mono text-4xl font-light text-[#7C3AED] mb-2">
                {decisionCount}
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Governance decisions recorded
              </div>
              <div className="text-sm text-[#64748B] leading-relaxed">
                Every override, escalation, approval, and rejection is stored with reviewer identity, duration, basis, and timestamp — teaching ERA CUE what each organization actually tolerates.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
                Decisions train calibration. Calibration reduces false positives.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3.5 (multi-speaker snapshot) removed — replaced by
          the dark "Coordinated communications" campaign card above. */}

      {/* ============================================================
          SECTION 3.4 — API / INTEGRATIONS
          For engineering teams. Three-column flow shows ERA CUE as the
          gateway between AI generation and publishing platforms; the
          dark code snippet shows the actual API contract — input
          (POST body) plus output (BLOCK verdict + rule + null token).
         ============================================================ */}
      <section className="py-20 px-6 md:px-12 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            For engineering teams
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-4 max-w-2xl"
          >
            ERA CUE sits between AI generation and publication.
          </div>
          <div className="text-sm text-[#64748B] mb-12 max-w-xl leading-relaxed">
            Any AI tool that drafts content can submit to ERA CUE via API before publishing. ERA CUE checks the draft, routes violations to the principal, and issues a clearance token on approval. No token, no publish.
          </div>

          {/* Integration flow */}
          <div className="flex items-center gap-4 flex-wrap mb-12">
            {/* AI tools */}
            <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4 flex-1 min-w-[160px]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                AI tools
              </div>
              {["Claude", "ChatGPT", "Jasper", "Copilot"].map((tool) => (
                <div key={tool} className="font-mono text-xs text-[#374151] py-1">
                  {tool}
                </div>
              ))}
            </div>

            <div className="font-mono text-xl text-[#94A3B8] px-2" aria-hidden>
              →
            </div>

            {/* ERA CUE */}
            <div className="bg-[#0F172A] rounded-sm p-4 flex-1 min-w-[180px]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
                ERA CUE API
              </div>
              <div className="font-mono text-xs text-[#4ADE80] mb-1">
                POST /v1/check
              </div>
              <div className="font-mono text-[10px] text-white/30">
                5 checks · &lt;1s · principal review if needed
              </div>
              <div className="font-mono text-[10px] text-[#60A5FA] mt-2">
                → clearance token issued
              </div>
            </div>

            <div className="font-mono text-xl text-[#94A3B8] px-2" aria-hidden>
              →
            </div>

            {/* Publishing platforms */}
            <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4 flex-1 min-w-[160px]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
                Publishing
              </div>
              {["LinkedIn", "Twitter / X", "Press release", "Email", "CMS"].map(
                (p) => (
                  <div key={p} className="font-mono text-xs text-[#374151] py-1">
                    {p}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* API contract snippet — dangerouslySetInnerHTML mirrors the
              same trick used elsewhere in the app to bypass any
              downstream MDX/markdown processing of curly braces and
              quotes inside JSX children. Payload is a fixed literal. */}
          <pre
            style={{
              backgroundColor: "#0F172A",
              color: "#7DD3FC",
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              lineHeight: "1.6",
              padding: "16px",
              borderRadius: "4px",
              overflowX: "auto",
              maxWidth: "480px",
              whiteSpace: "pre",
              margin: "0",
            }}
            dangerouslySetInnerHTML={{
              __html: [
                "POST https://api.eracue.com/v1/check",
                "Authorization: Bearer {org_api_key}",
                "",
                "{",
                "  &quot;speaker&quot;: &quot;ceo&quot;,",
                "  &quot;draft&quot;: &quot;We are aggressively hiring...&quot;,",
                "  &quot;channel&quot;: &quot;linkedin&quot;,",
                "  &quot;campaign&quot;: &quot;series_b_announce&quot;",
                "}",
                "",
                "→ { &quot;verdict&quot;: &quot;BLOCK&quot;,",
                "    &quot;rule&quot;: &quot;Series B Quiet Period&quot;,",
                "    &quot;token&quot;: null,",
                "    &quot;review_required&quot;: true }",
              ].join("\n"),
            }}
          />

          <div className="font-mono text-xs text-[#94A3B8] mt-4">
            API access available in Professional and Enterprise plans ·{" "}
            <a
              href="mailto:hello@eracue.com?subject=ERA%20CUE%20API%20Access"
              className="text-[#1A56DB] hover:text-[#1447C0] ml-1"
            >
              Request API access →
            </a>
          </div>
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

        </div>
      </section>

      {/* ============================================================
          SECTION 6 — FOOTER
          The demo disclaimer + the "· demo · May 2026" wordmark suffix
          only render when NEXT_PUBLIC_DEMO_MODE === "true". The middle
          slot collapses cleanly because the parent flex is
          justify-between with three independent children — when the
          middle one is removed, the wordmark stays left and the nav
          links stay right.
         ============================================================ */}
      <footer className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-xs text-[#64748B] flex items-center gap-2">
            <span style={{ fontFamily: "var(--font-newsreader)" }} className="text-base tracking-tight">
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
          <div className="flex gap-4 font-mono text-xs">
            <Link href="/rules" className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              Rules
            </Link>
            <Link
              href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
              className="text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Examiner
            </Link>
          </div>
        </div>
      </footer>

      {/* SECTION 6.5 (Request Access) was here. Moved into the hero
          as "THE LIVE PRODUCT" so the primary CTA is part of the
          opening scan instead of buried at the page bottom. */}

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
                text: "SEC Rule 204-2 — Investment Advisers Act. Requires registered investment advisers to maintain records of written communications relating to recommendations and advice for a minimum of 5 years.",
                url: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204-2",
                label: "ecfr.gov — SEC Rule 204-2",
              },
              {
                num: 6,
                text: "SEC v. DraftKings Inc. (Sept. 26, 2024) — SEC charged DraftKings with Reg FD violations after CEO posted material nonpublic information on personal LinkedIn and X accounts during an earnings quiet period. $200,000 civil penalty.",
                url: "https://www.sec.gov/litigation/admin/2024/34-101107.pdf",
                label: "sec.gov — DraftKings Reg FD action",
              },
              {
                num: 7,
                text: "FINRA 2026 Annual Regulatory Oversight Report — GenAI: Continuing and Emerging Trends. Recommends human-in-the-loop oversight for agentic AI, audit trails of agent actions, and explicit human checkpoints before execution.",
                url: "https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai",
                label: "finra.org — 2026 Annual Regulatory Oversight Report",
              },
              {
                num: 8,
                text: "SEC Rule 17a-4(b) — Requires preservation of communications records for 3 years, with the first 2 years in an accessible location.",
                url: "https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4",
                label: "ecfr.gov — SEC Rule 17a-4",
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
