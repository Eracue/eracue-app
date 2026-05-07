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

type TopRule = {
  name: string;
  times_triggered: number;
  effectiveness_score: number | null;
};

type MoatData = {
  corpusCount: number;
  decisionCount: number;
  topRule: TopRule | null;
};

/**
 * Pull the three live numbers the moat section surfaces: corpus size,
 * total reviewer decisions, and the most-triggered rule (with its
 * effectiveness score derived from the same draft-status join the
 * dashboard uses).
 *
 * Failures fall back to zeroes so the homepage renders cleanly even
 * when Supabase env vars aren't configured (e.g. local first-time
 * setup before .env.local is wired).
 */
async function getMoatData(): Promise<MoatData> {
  try {
    const sb = getSupabaseAdmin();
    const [corpusRes, decisionRes, draftsRes, verdictsRes] = await Promise.all([
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
      sb.from("drafts").select("id, status").eq("org_id", DEMO_ORG_ID),
      sb
        .from("actions")
        .select("draft_id, payload")
        .eq("org_id", DEMO_ORG_ID)
        .eq("action_type", "verdict_issued"),
    ]);

    const corpusCount = corpusRes.count ?? 0;
    const decisionCount = decisionRes.count ?? 0;

    // Compute trigger counts + override counts per rule_name (matched
    // through verdict_issued.payload.primary_match.rule_name). Effectiveness
    // = (matches − overrides) / matches × 100. Mirrors the dashboard
    // computation so the homepage and dashboard tell the same story.
    const draftStatusById = new Map<string, string>();
    for (const d of (draftsRes.data ?? []) as Array<{ id: string; status: string }>) {
      draftStatusById.set(d.id, d.status);
    }
    const stats = new Map<string, { matches: number; overrides: number }>();
    type VerdictRow = { draft_id: string; payload: { primary_match?: { rule_name?: string } | null } };
    for (const v of (verdictsRes.data ?? []) as VerdictRow[]) {
      const name = v.payload?.primary_match?.rule_name;
      if (!name) continue;
      const cur = stats.get(name) ?? { matches: 0, overrides: 0 };
      cur.matches++;
      if (draftStatusById.get(v.draft_id) === "overridden") cur.overrides++;
      stats.set(name, cur);
    }

    let topRule: TopRule | null = null;
    let max = 0;
    for (const [name, s] of stats.entries()) {
      if (s.matches > max) {
        max = s.matches;
        topRule = {
          name,
          times_triggered: s.matches,
          effectiveness_score:
            s.matches > 0
              ? Math.round(((s.matches - s.overrides) / s.matches) * 100)
              : null,
        };
      }
    }

    return { corpusCount, decisionCount, topRule };
  } catch {
    return { corpusCount: 0, decisionCount: 0, topRule: null };
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

export default async function Home() {
  const { corpusCount, decisionCount, topRule } = await getMoatData();
  return (
    <div className="bg-[#F8F9FB] min-h-screen">
      {/* v2-homepage-2026-redesign */}
      <SiteHeader />

      {/* ============================================================
          SECTION 1 — HERO (dark)
         ============================================================ */}
      <section className="bg-[#0F172A] min-h-[90vh] flex flex-col justify-center py-32 md:py-40">
        <div className="max-w-[1100px] mx-auto px-6 w-full">
          {/* Top badge row removed pre-launch — the six colored
              regulatory pills below the CTA carry the trust signal
              without doubling up above the headline. */}
          <h1
            className="font-light leading-tight tracking-tight text-white text-5xl md:text-7xl max-w-4xl mb-6"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            The governed moment between AI and publish.
          </h1>

          <p className="text-lg md:text-xl font-normal text-white/70 max-w-2xl leading-relaxed mb-10">
            AI drafts. Executives post. Nobody has a record that anyone
            checked — or that the messaging was consistent with last week.
            ERA CUE changes that.
          </p>

          <div className="mb-8">
            <Link
              href="/submit"
              className="inline-flex items-center bg-[#1A56DB] text-white text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#1447C0] transition"
            >
              See it working →
            </Link>

            {/* Three-word workflow strip — sits directly under the CTA so
                a visitor's first scan answers "what's the loop?" without
                them having to read further. CCO recognizes "Configure
                rules" as her job; speaker recognizes "Check every
                draft"; everyone sees "Record approved" as the outcome. */}
            <div className="flex items-center gap-6 mt-4 flex-wrap justify-center">
              {["Configure rules", "Check every draft", "Record approved"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-white/20 font-mono" aria-hidden>
                      →
                    </span>
                  )}
                  <span className="font-mono text-xs text-white/50 uppercase tracking-widest">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Six trust badges — solid colored pills, one regulatory family
              per color: blue = FINRA, teal = SEC RIA/Reg FD, violet = EU
              AI Act, amber = SEC Rule 17a-4 retention. */}
          <div className="flex flex-wrap gap-2 justify-center">
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

          {/* Explanatory paragraph removed pre-launch — the scenario card
              in Section 2 demonstrates this end-to-end, no need to
              describe it twice. */}
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

          {/* Lane 2 — brand governance / non-FINRA flavour. Different
              verdict (ESCALATE), different rule type (consistency
              against an approved statement), different speaker. Shows
              the platform handles more than just regulatory blocks. */}
          <div className="mt-4 bg-white border border-[#E2E8F0] rounded-sm p-5 border-l-4 border-l-[#7C3AED]">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              Monday, 2:14 PM · VP Sales · LinkedIn · Campaign: Q3 Launch
            </div>

            <div className="text-sm italic text-[#374151] mb-4 leading-relaxed">
              &ldquo;Our enterprise pricing is the most competitive in the market — no one comes close.&rdquo;
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-xs font-bold uppercase px-2 py-1 rounded-sm bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">
                ESCALATE
              </span>
              <span className="text-sm text-[#374151]">
                Pricing Claims · GC review required
              </span>
            </div>

            <div className="font-mono text-[10px] text-[#94A3B8]">
              Consistency Check: contradicts approved statement from Lena Brooks (May 4) — &ldquo;competitive pricing across all tiers&rdquo;
            </div>
          </div>

          <div className="text-xs font-mono text-[#64748B] mt-4">
            SHA-256 locked · append-only · record cannot be altered
          </div>

          {/* Transition into the governance flow — closes the scenario
              with the principal review + examiner record outcome and
              hands the reader off to the live record. */}
          <div className="mt-6 pt-6 border-t border-[#E2E8F0] text-sm text-[#374151] leading-relaxed">
            That verdict routes to the principal&apos;s queue. Sarah Chen
            reviews it, makes a structured decision with a documented
            basis, and ERA CUE generates an immutable examiner record —
            automatically.{" "}
            <a
              href={`/drafts/${CCO_EXAMINER_DRAFT_ID}/examiner`}
              className="text-[#1A56DB] hover:text-[#1447C0] transition-colors"
            >
              See the full record →
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
          SECTION 3.25 — THE MOAT (live data)
          Three live moments pulled from the demo org via getMoatData.
          The numbers don't change between page loads in tests, but
          they're real reads from drafts + actions — not hardcoded —
          so a new approval or decision moves the dial automatically.
         ============================================================ */}
      <section className="py-16 px-6 md:px-12 border-t border-[#E2E8F0]">
        <div className="max-w-[1100px] mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            The moat
          </div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-2xl font-light text-[#0F172A] mb-10"
          >
            ERA CUE becomes smarter with every decision your team makes.
          </div>

          {/* gap-px + a slate background reads as a hairline grid in light
              mode, which feels closer to the "Bloomberg terminal" demo
              ethos than padded floating cards. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E2E8F0] border border-[#E2E8F0] rounded-sm overflow-hidden">
            {/* Moat moment 1 — Corpus */}
            <div className="bg-white p-6">
              <div className="font-mono text-4xl font-light text-[#1A56DB] mb-2">
                {corpusCount}
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Approved statements in corpus
              </div>
              <div className="text-sm text-[#64748B] leading-relaxed">
                Every approved communication enters the governance corpus. New drafts are checked against it automatically — catching contradictions before anyone else sees them.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
                Corpus is principal-approved only. No unreviewed content enters.
              </div>
            </div>

            {/* Moat moment 2 — Immutability. Hardcoded zero is honest:
                the actions table's append-only trigger refuses UPDATE
                and DELETE at the database level, so this number is
                literally a database invariant, not a count. */}
            <div className="bg-white p-6">
              <div className="font-mono text-4xl font-light text-[#166534] mb-2">
                0
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Records altered since launch
              </div>
              <div className="text-sm text-[#64748B] leading-relaxed">
                Every governance decision is SHA-256 locked the moment it&apos;s made. The database enforces append-only — UPDATE and DELETE are refused at the database level, not just the application.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
                Not a claim. A database constraint.
              </div>
            </div>

            {/* Moat moment 3 — Calibration */}
            <div className="bg-white p-6">
              <div className="font-mono text-4xl font-light text-[#7C3AED] mb-2">
                {decisionCount}
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Decisions training governance
              </div>
              <div className="text-sm text-[#64748B] leading-relaxed">
                Every reviewer decision — override, escalation, approval — updates ERA CUE&apos;s understanding of what your organization actually tolerates. Rules get smarter. False positives decrease.
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#F1F5F9]">
                {topRule
                  ? `${topRule.name}: ${topRule.effectiveness_score ?? 0}% effective`
                  : "Calibration active"}
              </div>
            </div>
          </div>

          {/* The one-liner — sits below the grid as the takeaway. */}
          <div className="mt-8 text-center">
            <div className="font-mono text-sm text-[#64748B] italic">
              &ldquo;ERA CUE becomes the system of record for human supervision of agentic communication.&rdquo;
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
            <Link href="/dashboard" className="text-[#64748B] hover:text-[#0F172A] transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>

      {/* ============================================================
          SECTION 6.5 — REQUEST EARLY ACCESS
          Sits between the demo footer and the regulatory references
          so a reader who's read the page and wants to act has a
          single primary CTA before the legal small-print closes
          things out.
         ============================================================ */}
      <section className="bg-[#0F172A] py-20 px-6 md:px-12 text-center">
        <div className="text-center max-w-[600px] mx-auto">
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-white mb-3"
          >
            Ready to see it work?
          </div>

          <div className="text-sm text-white/60 mb-8 leading-relaxed">
            Try the live product now — no login required. Or get ERA CUE running for your team in 10 minutes.
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/submit"
              className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-6 py-3 rounded-sm hover:bg-[#1447C0] transition-colors"
            >
              Try it now →
            </a>
            <a
              href="/auth/signup"
              className="bg-white/10 text-white font-mono text-sm font-medium px-6 py-3 rounded-sm border border-white/20 hover:bg-white/20 transition-colors"
            >
              Get ERA CUE for your team →
            </a>
          </div>

          <div className="font-mono text-xs text-white/30 mt-4">
            or email hello@eracue.com
          </div>
        </div>
      </section>

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
