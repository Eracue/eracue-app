"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddRulePanel } from "./add-rule-panel";
import { deactivateRuleAction } from "./actions";
import { extractRulesFromWsp } from "./wsp-import-action";
import {
  createRulesFromImport,
  type CandidateRuleInput,
} from "./create-rules-action";
import { saveRuleUpdates, type RuleUpdates } from "./update-rule-action";

// CandidateRule is the union shape every tab feeds into the same review
// list — `source` records where the rule came from so the audit trail can
// later distinguish template-authored rules from extracted ones.
type CandidateRule = CandidateRuleInput;
type ImportMode = "templates" | "paste" | "upload" | "manual";

const TABS: ReadonlyArray<{ key: ImportMode; label: string }> = [
  { key: "templates", label: "Templates" },
  { key: "paste", label: "Paste policy" },
  { key: "manual", label: "Type rules" },
  { key: "upload", label: "Upload doc" },
];

// Six firm types the Templates tab cycles through. Each maps to a
// templatesFor() bucket via the same alias rules — `pr_agency` and
// `executive_team` fall back to the broker_dealer set since their
// starter governance overlaps heavily with retail communications.
const FIRM_TYPE_BUTTONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "broker_dealer", label: "Broker-Dealer" },
  { key: "ria", label: "RIA" },
  { key: "public_company", label: "Public Company" },
  { key: "pr_agency", label: "PR Agency" },
  { key: "executive_team", label: "Executive Team" },
  { key: "investment_bank", label: "Investment Bank / PE" },
];

// Pre-built starter rules per firm type. The Templates tab shows these
// directly (no Claude call). Keys correspond to firm_type values written
// by the onboarding firm setup form.
const TEMPLATES: Record<string, CandidateRule[]> = {
  broker_dealer: [
    {
      name: "Performance Projections",
      rule_type: "block",
      description:
        "Projected or guaranteed performance claims are prohibited in retail communications.",
      keywords: [
        "guaranteed return",
        "guaranteed yield",
        "will return",
        "no risk",
        "risk-free return",
        "assured return",
        "projected return of",
        "target return of",
      ],
      wsp_reference: "Section 4.2 — Performance Communications",
      regulatory_basis: "FINRA Rule 2210(d)(1)(F)",
      source: "template",
    },
    {
      name: "Testimonials Without Disclosure",
      rule_type: "escalate",
      description:
        "Client testimonials require specific disclosures.",
      keywords: [
        "my client said",
        "client testimonial",
        "client endorses",
        "client recommends",
        "as my client put it",
      ],
      wsp_reference: "Section 4.5 — Testimonials",
      regulatory_basis: "FINRA Rule 2210(d)(6)",
      source: "template",
    },
    {
      name: "Social Media Pre-Approval",
      rule_type: "escalate",
      description:
        "All social media posts by registered persons require principal review.",
      keywords: [],
      wsp_reference: "Section 3.1 — Social Media Supervision",
      regulatory_basis: "FINRA Rule 3110 · Rule 2210(b)",
      source: "template",
    },
  ],
  // The onboarding form writes "rIA" as the firm_type for Registered
  // Investment Advisers; alias both keys so the panel resolves either.
  ria: [
    {
      name: "Marketing Rule — Performance",
      rule_type: "block",
      description:
        "Hypothetical performance requires specific disclosures under the SEC Marketing Rule.",
      keywords: [
        "hypothetical performance",
        "back-tested",
        "would have returned",
        "simulated results",
      ],
      wsp_reference: "Section 5.1 — Marketing Compliance",
      regulatory_basis: "SEC Rule 206(4)-1",
      source: "template",
    },
    {
      name: "Testimonials and Endorsements",
      rule_type: "escalate",
      description:
        "Testimonials and endorsements require disclosure of compensation and conflicts.",
      keywords: [
        "client said",
        "testimonial",
        "endorses",
        "recommends us",
        "five stars",
        "review",
      ],
      wsp_reference: "Section 5.3 — Testimonials",
      regulatory_basis: "SEC Marketing Rule 206(4)-1(b)(1)",
      source: "template",
    },
  ],
  public_company: [
    {
      name: "Reg FD — Material Information",
      rule_type: "block",
      description:
        "Material nonpublic information cannot be selectively disclosed.",
      keywords: [
        "revenue guidance",
        "earnings guidance",
        "material announcement",
        "non-public",
        "before we announce",
      ],
      wsp_reference: "Section 6.1 — Reg FD Policy",
      regulatory_basis: "SEC Regulation FD",
      source: "template",
    },
  ],
  investment_bank: [
    {
      name: "Deal Quiet Period",
      rule_type: "block",
      description:
        "No communications about active deals during quiet periods.",
      keywords: [
        "the deal",
        "our transaction",
        "the acquisition",
        "we are acquiring",
        "we are selling",
      ],
      wsp_reference: "Section 2.1 — Deal Communications",
      regulatory_basis: "SEC Rule 10b-5 · FINRA Rule 2210",
      source: "template",
    },
  ],
};

function templatesFor(firmType: string | null | undefined): CandidateRule[] {
  if (!firmType) return TEMPLATES.broker_dealer;
  // Onboarding writes "rIA" (camelCase); accept both casings.
  const key = firmType === "rIA" ? "ria" : firmType;
  return TEMPLATES[key] ?? TEMPLATES.broker_dealer;
}

export type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  verdict: string; // aliased from rule_type in the parent select
  keywords: string[] | null;
  effective_from: string | null;
  effective_until: string | null; // aliased from effective_to
  scope: string | null;
  rule_status: string | null;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  wsp_reference: string | null;
  trigger_count?: number;
  last_triggered?: string | null;
  // (matches − overrides) / matches × 100 — null when the rule has
  // never fired. Drives the freshness signal below.
  effectiveness_score?: number | null;
};

// Governance-drift freshness for a rule. Computed locally so the
// classification stays in sync with the UI rendering:
//   • "needs_calibration" — fires often (≥3 triggers) but gets
//     overridden a lot (effectiveness < 40%)
//   • "expiring" — within 14 days of effective_to
//   • "silent" — active but never fired
//   • "healthy" — everything else with at least one trigger
type Freshness = "needs_calibration" | "expiring" | "silent" | "healthy";

function classifyFreshness(
  rule: RuleRow,
  now: number,
): { freshness: Freshness; daysUntilExpiry: number | null } {
  const triggers = rule.trigger_count ?? 0;
  const score = rule.effectiveness_score ?? null;
  const daysUntilExpiry = rule.effective_until
    ? Math.ceil(
        (new Date(rule.effective_until).getTime() - now) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  if (score !== null && score < 40 && triggers >= 3) {
    return { freshness: "needs_calibration", daysUntilExpiry };
  }
  if (daysUntilExpiry !== null && daysUntilExpiry <= 14 && daysUntilExpiry >= 0) {
    return { freshness: "expiring", daysUntilExpiry };
  }
  if (triggers === 0) {
    return { freshness: "silent", daysUntilExpiry };
  }
  return { freshness: "healthy", daysUntilExpiry };
}

type Tab = "all" | "active" | "expired" | "deactivated";

const VERDICT_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  block:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
  escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
  review:   { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
  guide:    { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function scopeLabel(scope: string | null): string {
  if (!scope || scope === "all_speakers") return "All speakers";
  return scope;
}

// Derived classification — distinguishes "expired" (date past) from "deactivated"
// (manually shut off) and "active" (effective and not deactivated).
function classifyRule(r: RuleRow, now: number): "active" | "expired" | "deactivated" {
  if (r.rule_status === "deactivated") return "deactivated";
  const fromTime = r.effective_from ? new Date(r.effective_from).getTime() : 0;
  const toTime = r.effective_until ? new Date(r.effective_until).getTime() : null;
  if (toTime !== null && now > toTime) return "expired";
  if (now < fromTime) return "active"; // future-dated rules show as active for the demo
  return "active";
}

function buildFooterText(r: RuleRow, classification: "active" | "expired" | "deactivated"): string {
  let prefix: string;
  if (classification === "deactivated") {
    prefix = `Deactivated ${fmtDate(r.deactivated_at)}`;
  } else if (classification === "expired") {
    prefix = `Expired ${fmtDate(r.effective_until)}`;
  } else if (r.effective_until) {
    prefix = `Active until ${fmtDate(r.effective_until)}`;
  } else {
    prefix = "Active — no end date";
  }
  return `${prefix} · Authorized by Sarah Chen, GC · Applies to: ${scopeLabel(r.scope)} · Rule 2210(d)`;
}

type Props = {
  rules: RuleRow[];
  corpusCount?: number;
  // Drives which Templates the import panel surfaces. Defaults to the
  // broker_dealer set when null/unknown.
  firmType?: string | null;
};

// Demo mode. NEXT_PUBLIC_* env vars are inlined at build time so this
// const evaluates to a literal in the client bundle. When on, the page
// header drops the "Sarah Chen" attribution, opens the import panel by
// default, and labels the seeded rules as examples — so a demo
// visitor sees "configure your governance" framing instead of someone
// else's authorized policy list.
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function RulesClient({ rules, corpusCount = 0, firmType = null }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [pending, startTransition] = useTransition();

  // Import panel state. In demo mode the panel opens by default so the
  // first thing a visitor sees is HOW to add rules, not someone else's
  // authorized rules. Outside demo mode it stays collapsed until the
  // principal toggles it.
  const [showImport, setShowImport] = useState<boolean>(IS_DEMO_MODE);
  const [importMode, setImportMode] = useState<ImportMode>("templates");
  const [importText, setImportText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualRules, setManualRules] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<CandidateRule[]>([]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [authorizing, setAuthorizing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Post-authorization success state. Set on the next tick after the
  // import action returns ok; powers the green success card with the
  // "Check your first draft →" CTA + "Add more rules" secondary.
  const [justAuthorized, setJustAuthorized] = useState(false);
  const [authorizedCount, setAuthorizedCount] = useState(0);
  // Templates tab now lets the user switch firm-type buckets without
  // leaving the page (defaults to whatever the org was created with).
  const [firmTypeFilter, setFirmTypeFilter] = useState<string>(
    firmType ?? "broker_dealer",
  );
  // Inline rule editing — when set, the matching rule card expands to
  // show the EditRulePanel instead of opening the side AddRulePanel.
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const templateRules = useMemo(
    () => templatesFor(firmTypeFilter),
    [firmTypeFilter],
  );

  async function handleExtract(mode: ImportMode) {
    setImportError(null);
    setCandidates([]);
    setConfirmed(new Set());

    let textToAnalyze = "";
    if (mode === "paste") textToAnalyze = importText;
    else if (mode === "manual") textToAnalyze = manualRules;
    else if (mode === "upload" && uploadedFile) {
      // FileReader.readAsText handles plain-text and most UTF-8 files
      // cleanly. Binary PDF/Word will arrive as garbled bytes — Claude
      // tolerates the noise but extraction quality drops. A future
      // enhancement could route binary uploads through a server-side
      // parser before the model call.
      try {
        textToAnalyze = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) ?? "");
          reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
          reader.readAsText(uploadedFile);
        });
      } catch (e) {
        setImportError(e instanceof Error ? e.message : "Could not read file.");
        return;
      }
    }

    if (!textToAnalyze.trim()) {
      setImportError("Nothing to analyze.");
      return;
    }

    setExtracting(true);
    try {
      const result = await extractRulesFromWsp(textToAnalyze, mode === "manual");
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      // Map the extracted rows into CandidateRule shape — every imported
      // rule carries a `source` so the user can see whether it came from
      // a paste, upload, or manual entry on the review cards.
      const sourceLabel = mode === "paste" ? "paste" : mode === "upload" ? "upload" : "manual";
      const next: CandidateRule[] = result.suggested_rules.map((r) => ({
        ...r,
        source: sourceLabel,
      }));
      setCandidates(next);
      // Auto-confirm all by default — user opts out instead of opting in.
      setConfirmed(new Set(next.map((_, i) => i)));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirmRules() {
    setImportError(null);
    const pool: CandidateRule[] = importMode === "templates" ? templateRules : candidates;
    const picks = pool.filter((_, i) => confirmed.has(i));
    if (picks.length === 0) return;
    setAuthorizing(true);
    try {
      const result = await createRulesFromImport(picks);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      // Capture the count BEFORE wiping confirmed so the success card
      // can render "N rules authorized and active" with the right N.
      const count = picks.length;
      // Reset all import state on success and close the panel.
      setCandidates([]);
      setConfirmed(new Set());
      setImportText("");
      setManualRules("");
      setUploadedFile(null);
      setShowImport(false);
      // Surface the success state — sticks until the user navigates
      // away or runs another import.
      setAuthorizedCount(count);
      setJustAuthorized(true);
      router.refresh();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Authorization failed.");
    } finally {
      setAuthorizing(false);
    }
  }

  const now = Date.now();
  const classified = useMemo(() => {
    return rules.map((r) => ({ rule: r, classification: classifyRule(r, now) }));
  }, [rules, now]);

  const counts = useMemo(() => {
    let active = 0, expired = 0, deactivated = 0, firing = 0, silent = 0;
    for (const { rule, classification } of classified) {
      if (classification === "active") active++;
      else if (classification === "expired") expired++;
      else deactivated++;
      const triggers = rule.trigger_count ?? 0;
      if (triggers > 0) firing++;
      else if (classification === "active") silent++;
    }
    return { total: rules.length, active, expired, deactivated, firing, silent };
  }, [classified, rules.length]);

  const filtered = useMemo(() => {
    if (tab === "all") return classified;
    return classified.filter((c) => c.classification === tab);
  }, [classified, tab]);

  // Governance drift roll-up. Counts rules whose freshness is
  // "needs_calibration" or "expiring" — the two states a principal
  // should actually do something about. "silent" rules don't count
  // (an active rule with zero triggers might just mean the team is
  // disciplined, not that the rule is broken).
  // Per-bucket lists for the bottom "rules need attention" panel.
  // Expiring = within 14 days of effective_to. Needs calibration =
  // ≥3 triggers and effectiveness <40%. Everything else is fine and
  // doesn't surface here.
  const expiringRules = useMemo(() => {
    return classified
      .filter(({ rule, classification }) => {
        if (classification !== "active") return false;
        return classifyFreshness(rule, now).freshness === "expiring";
      })
      .map(({ rule }) => rule);
  }, [classified, now]);

  const needsCalibration = useMemo(() => {
    return classified
      .filter(({ rule, classification }) => {
        if (classification !== "active") return false;
        return classifyFreshness(rule, now).freshness === "needs_calibration";
      })
      .map(({ rule }) => rule);
  }, [classified, now]);

  function handleDeactivate(id: string, ruleName: string) {
    // Simple confirm — no modal. The deactivate action stores a
    // canonical reason ("Deactivated by principal") since the demo
    // visitor doesn't have an audit-trail-quality justification to
    // type and we'd rather not block the action behind a free-text
    // prompt.
    const ok = window.confirm(
      `Deactivate "${ruleName}"? ERA CUE will stop enforcing this rule immediately. You can reactivate it from the Deactivated tab.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deactivateRuleAction({
        ruleId: id,
        reason: "Deactivated by principal",
      });
      if (!result.ok) {
        alert("Could not deactivate: " + result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
        {/* PAGE HEADER — copy adapts to whether any rules exist yet so
            the page reads "configure ERA CUE" on first visit and
            "<N> rules governing your team" once policies are active. */}
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Governance rules
          </div>
          <h1
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-2"
          >
            {counts.active > 0
              ? `${counts.active} rule${counts.active !== 1 ? "s" : ""} governing your team's communications.`
              : "Configure ERA CUE before checking any draft."}
          </h1>
          <p className="text-sm text-[#64748B] max-w-2xl leading-relaxed">
            {counts.active > 0
              ? "Every draft your team submits is checked against these rules before publication."
              : "Rules are ERA CUE's enforcement layer. Configure your governance policies first — then check your team's communications."}
          </p>
        </div>

        {/* ACTION BAR — Add rule + Import toggle on the left, "Check a
            draft" link on the right (only when at least one rule is
            active so the next-step nudge isn't a misdirection on a
            fresh page). */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] transition-colors flex items-center gap-1.5"
            >
              <span aria-hidden>+</span>
              Add a rule
            </button>
            <button
              type="button"
              onClick={() => setShowImport((o) => !o)}
              className={`font-mono text-xs font-medium px-4 py-2 rounded-sm border transition-colors ${
                showImport
                  ? "bg-[#EFF8FF] border-[#BAE6FD] text-[#1447C0]"
                  : "bg-white border-[#E2E8F0] text-[#374151] hover:bg-[#F8F9FB]"
              }`}
            >
              {showImport ? "× Close import" : "↑ Import policies"}
            </button>
          </div>
          {counts.active > 0 && (
            <a
              href="/submit"
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Check a draft →
            </a>
          )}
        </div>

        {/* Import existing policies — four-tab panel. The wrapper drops
            its own header (the action bar above is the toggle now), so
            the panel reads as the four tabs + their content body. */}
        {showImport && (
          <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm mb-6 overflow-hidden">
            {/* Tab bar — underline-style, mirrors the dashboard tabs */}
            <div className="flex border-b border-[#E2E8F0]">
              {TABS.map((t) => {
                const selected = importMode === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setImportMode(t.key);
                      // Reset extraction state on tab change so stale
                      // candidates from another tab don't render.
                      setCandidates([]);
                      setConfirmed(new Set());
                      setImportError(null);
                    }}
                    className={`flex-1 font-mono text-[10px] uppercase tracking-widest py-3 px-4 transition-colors border-b-2 cursor-pointer ${
                      selected
                        ? "border-[#1A56DB] text-[#1A56DB] bg-white"
                        : "border-transparent text-[#64748B] hover:text-[#0F172A] bg-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {importError && (
                <div
                  className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-mono rounded-sm px-3 py-2 mb-3"
                  role="alert"
                >
                  {importError}
                </div>
              )}

              {/* TAB: Templates — pre-built rules per firm type. */}
              {importMode === "templates" && (
                <div>
                  {/* Firm type selector — switches the templates pool
                      without leaving the page. Resets the confirmed
                      set so checks don't carry over across firm types. */}
                  <div className="mb-5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
                      My organization is a
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {FIRM_TYPE_BUTTONS.map((ft) => {
                        const selected = firmTypeFilter === ft.key;
                        return (
                          <button
                            key={ft.key}
                            type="button"
                            onClick={() => {
                              setFirmTypeFilter(ft.key);
                              setConfirmed(new Set());
                            }}
                            className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                              selected
                                ? "bg-[#EFF8FF] border-[#BAE6FD] text-[#1447C0] font-medium"
                                : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB]"
                            }`}
                          >
                            {ft.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {templateRules.map((rule, i) => (
                      <CandidateRuleCard
                        key={`${rule.name}-${i}`}
                        rule={rule}
                        index={i}
                        confirmed={confirmed}
                        setConfirmed={setConfirmed}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: Paste policy — Claude WSP extraction. */}
              {importMode === "paste" && (
                <div>
                  <div className="text-sm text-[#374151] mb-3">
                    Paste any policy text — WSP section, social media policy, email from legal, anything.
                    ERA CUE extracts the rules.
                  </div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`Paste your Written Supervisory Procedures, social media policy, or any compliance document.

Example:
"All associated persons must obtain prior written approval from a registered principal before posting on LinkedIn, Twitter, or any public social media platform. Posts containing performance claims, testimonials, forward-looking statements, or references to specific securities require CCO review and FINRA filing consideration under Rule 2210(b). All approved communications must be retained for 3 years per SEC Rule 17a-4."`}
                    className="w-full border border-[#BAE6FD] rounded-sm px-3 py-3 text-sm text-[#0F172A] bg-white h-36 resize-none focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
                  />
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-2 space-y-1">
                    <div>✓ ERA CUE reads any policy format — WSPs, social media policies, legal memos, compliance manuals</div>
                    <div>✓ Extracts specific rules with keywords and verdict types</div>
                    <div>✓ You review and authorize each rule before it goes live</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExtract("paste")}
                    disabled={!importText.trim() || extracting}
                    className="mt-3 bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm disabled:opacity-50 hover:bg-[#1447C0] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {extracting ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Extracting rules...
                      </>
                    ) : (
                      "Extract rules →"
                    )}
                  </button>
                </div>
              )}

              {/* TAB: Upload doc — file → readAsText → extract. */}
              {importMode === "upload" && (
                <div>
                  <div className="text-sm text-[#374151] mb-3">
                    Upload a PDF or Word document. ERA CUE reads it and extracts your governance rules.
                  </div>
                  <label className="block border-2 border-dashed border-[#BAE6FD] rounded-sm p-8 text-center cursor-pointer hover:bg-white/50 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setUploadedFile(f);
                      }}
                      className="hidden"
                    />
                    {uploadedFile ? (
                      <div>
                        <div className="text-sm font-medium text-[#0F172A]">{uploadedFile.name}</div>
                        <div className="font-mono text-[10px] text-[#64748B] mt-1">
                          {(uploadedFile.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-[#374151]">
                          Drop a file here or click to browse
                        </div>
                        <div className="font-mono text-[10px] text-[#64748B] mt-1">
                          PDF · Word · Text
                        </div>
                      </div>
                    )}
                  </label>
                  {uploadedFile && (
                    <button
                      type="button"
                      onClick={() => handleExtract("upload")}
                      disabled={extracting}
                      className="mt-3 bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm disabled:opacity-50 hover:bg-[#1447C0] transition-colors cursor-pointer"
                    >
                      {extracting ? "Extracting..." : "Extract rules →"}
                    </button>
                  )}
                  {/* Helper bullets — best-effort note about plain-text
                      uploads is folded into the bullet list. */}
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-3 space-y-1">
                    <div>✓ PDF, Word (.docx), or text files</div>
                    <div>✓ ERA CUE reads your document and extracts governance rules</div>
                    <div>✓ Works with WSPs, compliance manuals, policy handbooks</div>
                    <div>✓ You review every extracted rule before it becomes active</div>
                  </div>
                </div>
              )}

              {/* TAB: Type rules manually. */}
              {importMode === "manual" && (
                <div>
                  <div className="text-sm text-[#374151] mb-3">
                    Describe your rules in plain English. One rule per line. ERA CUE converts each into a structured governance rule.
                  </div>
                  <textarea
                    value={manualRules}
                    onChange={(e) => setManualRules(e.target.value)}
                    placeholder={`One rule per line. Describe what to block or flag.

Examples:
Block any mention of guaranteed returns
Escalate posts during earnings quiet periods
Flag competitor comparisons for GC review
Block forward guidance about revenue or growth
Escalate client testimonials for compliance check
Block posts mentioning specific fund performance`}
                    className="w-full border border-[#BAE6FD] rounded-sm px-3 py-3 text-sm text-[#0F172A] bg-white h-36 resize-none font-mono focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
                  />
                  <div className="font-mono text-[10px] text-[#94A3B8] mt-2 space-y-1">
                    <div>✓ Write rules in plain English</div>
                    <div>✓ ERA CUE converts each line into a structured governance rule</div>
                    <div>✓ Assigns verdict type (BLOCK / ESCALATE / REVIEW / GUIDE) based on language</div>
                  </div>

                  {/* Live verdict preview — heuristic match against the
                      same verb cues the manual-mode system prompt uses
                      ("block" / "escalate" / "review"). Lets the user
                      see how their wording will map before committing
                      to extraction. Capped at 10 rows so a long paste
                      doesn't blow up the panel. */}
                  {manualRules.trim() && (
                    <div className="mt-3 border border-[#E2E8F0] rounded-sm divide-y divide-[#F1F5F9] overflow-hidden">
                      {manualRules
                        .split("\n")
                        .map((l) => l.trim())
                        .filter((l) => l.length > 0)
                        .slice(0, 10)
                        .map((line, i) => {
                          const lower = line.toLowerCase();
                          const verdict: "block" | "escalate" | "review" =
                            lower.startsWith("block") ||
                            lower.includes("never") ||
                            lower.includes("no ") ||
                            lower.includes("prohibit")
                              ? "block"
                              : lower.startsWith("escalate") ||
                                  lower.includes("review") ||
                                  lower.includes("require cco") ||
                                  lower.includes("require legal")
                                ? "escalate"
                                : "review";
                          const colors = {
                            block: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
                            escalate: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
                            review: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
                          } as const;
                          return (
                            <div
                              key={i}
                              className="px-3 py-2.5 bg-white flex items-start gap-3"
                            >
                              <span
                                className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border shrink-0 mt-0.5 ${colors[verdict]}`}
                              >
                                {verdict}
                              </span>
                              <span className="text-xs text-[#374151] leading-relaxed">
                                {line}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleExtract("manual")}
                    disabled={!manualRules.trim() || extracting}
                    className="mt-3 bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm disabled:opacity-50 hover:bg-[#1447C0] transition-colors cursor-pointer"
                  >
                    {extracting ? "Converting..." : "Convert to rules →"}
                  </button>
                </div>
              )}

              {/* Candidate review list — paste / upload / manual. */}
              {candidates.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                  <div className="font-mono text-[10px] text-[#166534] mb-3 flex items-center gap-2">
                    <span aria-hidden>✓</span>
                    ERA CUE found {candidates.length} rule
                    {candidates.length !== 1 ? "s" : ""} in your policy text. Review each one before authorizing.
                  </div>
                  {candidates.map((rule, i) => (
                    <CandidateRuleCard
                      key={`${rule.name}-${i}`}
                      rule={rule}
                      index={i}
                      confirmed={confirmed}
                      setConfirmed={setConfirmed}
                    />
                  ))}
                </div>
              )}

              {/* Authorize button — appears whenever there's something to
                  authorize. The condition splits cleanly: candidates-driven
                  modes show it when a candidate exists; templates mode
                  shows it once at least one card is checked. */}
              {(candidates.length > 0 ||
                (importMode === "templates" && confirmed.size > 0)) && (
                <button
                  type="button"
                  onClick={handleConfirmRules}
                  disabled={confirmed.size === 0 || authorizing}
                  className="w-full mt-4 bg-[#0F172A] text-white font-mono text-sm font-medium py-3 rounded-sm disabled:opacity-40 hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  {authorizing
                    ? "Authorizing..."
                    : `Authorize ${confirmed.size} rule${confirmed.size !== 1 ? "s" : ""} →`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Post-authorization success card — sits between the import
            panel and the rest of the page. Dismissible (×) so the
            user can clear it once they've moved on; "Add more rules"
            re-opens the import panel without needing a separate path. */}
        {justAuthorized && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-5 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="text-[#166534] text-xl mt-0.5" aria-hidden>
                  ✓
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F172A] mb-1">
                    {authorizedCount} rule{authorizedCount !== 1 ? "s" : ""} authorized and active
                  </div>
                  <div className="text-sm text-[#374151]">
                    ERA CUE will now enforce these rules on every draft your team submits.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setJustAuthorized(false)}
                aria-label="Dismiss"
                className="text-[#94A3B8] hover:text-[#64748B] font-mono text-xs ml-4 shrink-0 cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <a
                href="/submit"
                className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#1447C0] transition-colors"
              >
                Check your first draft →
              </a>
              <button
                type="button"
                onClick={() => {
                  setJustAuthorized(false);
                  setShowImport(true);
                }}
                className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Add more rules
              </button>
            </div>
          </div>
        )}

        {/* Governance drift summary moved to the bottom of the page —
            see the "rules need attention" amber list below the Coming
            Soon sections. */}

        {/* Stats strip — Total dropped because it included deactivated rules
            (misleading); Active is now the primary stat. Deactivated lives at
            the end in muted slate so it reads as "not governing right now." */}
        <div className="flex gap-6 mt-6 pb-6 border-b border-[#E2E8F0] items-end flex-wrap">
          {[
            { value: counts.active,      label: "Active rules", muted: false },
            { value: counts.firing,      label: "Firing",       muted: false },
            { value: counts.silent,      label: "Silent",       muted: false },
            { value: counts.deactivated, label: "Deactivated",  muted: true  },
          ].map((s) => (
            <div key={s.label}>
              <div
                className={`font-mono text-3xl font-light ${
                  s.muted ? "text-[#94A3B8]" : "text-[#0F172A]"
                }`}
              >
                {s.value}
              </div>
              <div className="font-mono text-xs uppercase text-[#64748B] mt-1">{s.label}</div>
            </div>
          ))}
          <div className="ml-auto font-mono text-xs text-[#374151]">
            5 checks run on every draft · 2 deterministic · 3 AI-powered
            {corpusCount > 0 && (
              <span className="text-[#64748B]">
                {" "}· Consistency comparing against {corpusCount} approved statements
              </span>
            )}
          </div>
        </div>

        {/* "Rules active" prompt removed — that nudge now lives on the
            action bar at the top ("Check a draft →") + the success
            banner after authorization. Two surfaces telling the same
            story were one too many. */}

        {/* Filter tabs */}
        <div className="flex gap-1 mt-6 border-b border-[#E2E8F0]">
          {([
            { key: "all" as const,         label: `All (${counts.total})` },
            { key: "active" as const,      label: `Active (${counts.active})` },
            { key: "expired" as const,     label: `Expired (${counts.expired})` },
            { key: "deactivated" as const, label: `Deactivated (${counts.deactivated})` },
          ]).map(({ key, label }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`font-mono text-sm pb-3 px-1 border-b-2 transition ${
                  selected
                    ? "border-[#1A56DB] text-[#1A56DB]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Rule cards — inline edit panel expands below the card when
            Edit is toggled. Deactivate uses a window.confirm() prompt
            and routes through the existing deactivateRuleAction (no
            modal). The card body itself surfaces verdict badge, name,
            description, keyword chips, status footer, trigger /
            effectiveness inline, and a freshness signal. */}
        <div className="flex flex-col gap-2 mt-6">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-12 text-center text-[#64748B] text-sm">
              No rules in this view.
            </div>
          ) : (
            filtered.map(({ rule: r, classification }) => {
              const v = (r.verdict || "review").toLowerCase();
              const badge = VERDICT_BADGE[v] || VERDICT_BADGE.review;
              const triggers = r.trigger_count ?? 0;
              const drift =
                classification === "active" ? classifyFreshness(r, now) : null;
              const isEditing = editingRuleId === r.id;
              return (
                <div
                  key={r.id}
                  id={`rule-${r.id}`}
                  className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden scroll-mt-6"
                >
                  <div className="px-5 py-4">
                    {/* Top row — verdict + name on the left, action
                        buttons on the right. Always visible (Edit
                        toggles to "× Close" when expanded). */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-sm font-semibold text-[#0F172A] truncate">
                          {r.name}
                        </span>
                      </div>
                      {classification === "active" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingRuleId(isEditing ? null : r.id)
                            }
                            className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                              isEditing
                                ? "bg-[#EFF8FF] border-[#BAE6FD] text-[#1447C0]"
                                : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB]"
                            }`}
                          >
                            {isEditing ? "× Close" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(r.id, r.name)}
                            disabled={pending}
                            className="font-mono text-xs px-3 py-1.5 rounded-sm border border-[#E2E8F0] text-[#94A3B8] hover:border-[#FCA5A5] hover:text-[#B91C1C] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        </div>
                      )}
                      {classification === "expired" && (
                        <button
                          type="button"
                          onClick={() => setEditingRuleId(isEditing ? null : r.id)}
                          className="font-mono text-xs px-3 py-1.5 rounded-sm border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB] transition-colors cursor-pointer"
                        >
                          Renew
                        </button>
                      )}
                    </div>

                    {r.description && (
                      <div className="text-sm text-[#374151] mb-3 leading-relaxed">
                        {r.description}
                      </div>
                    )}

                    {r.keywords && r.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {r.keywords.slice(0, 6).map((kw) => (
                          <span
                            key={kw}
                            className="font-mono text-[10px] bg-[#F1F5F9] text-[#374151] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                          >
                            {kw}
                          </span>
                        ))}
                        {r.keywords.length > 6 && (
                          <span className="font-mono text-[10px] text-[#94A3B8]">
                            +{r.keywords.length - 6} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Status line */}
                    <div className="font-mono text-[10px] text-[#94A3B8] flex items-center gap-2 flex-wrap">
                      <span>{buildFooterText(r, classification)}</span>
                      {r.wsp_reference && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="text-[#1447C0]">WSP: {r.wsp_reference}</span>
                        </>
                      )}
                    </div>

                    {/* Trigger + freshness inline */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      {triggers > 0 && (
                        <div className="font-mono text-[10px] text-[#64748B]">
                          {triggers} trigger{triggers !== 1 ? "s" : ""}
                          {r.effectiveness_score !== null && r.effectiveness_score !== undefined && (
                            <span
                              className={`ml-1 ${
                                r.effectiveness_score < 50
                                  ? "text-[#C2410C]"
                                  : "text-[#166534]"
                              }`}
                            >
                              · {r.effectiveness_score}% effective
                            </span>
                          )}
                          {r.last_triggered && (
                            <span className="text-[#94A3B8]">
                              {" "}· last {fmtRelative(r.last_triggered)}
                            </span>
                          )}
                        </div>
                      )}
                      {drift?.freshness === "needs_calibration" && (
                        <div className="font-mono text-[10px] text-[#C2410C]">
                          ⚠ Override rate high — consider refining keywords
                        </div>
                      )}
                      {drift?.freshness === "expiring" && drift.daysUntilExpiry !== null && (
                        <div className="font-mono text-[10px] text-[#B45309]">
                          ⏱ Expires in {drift.daysUntilExpiry}{" "}
                          {drift.daysUntilExpiry === 1 ? "day" : "days"}
                        </div>
                      )}
                      {drift?.freshness === "silent" && (
                        <div className="font-mono text-[10px] text-[#94A3B8]">
                          ○ No triggers yet
                        </div>
                      )}
                      {drift?.freshness === "healthy" && triggers > 0 && (
                        <div className="font-mono text-[10px] text-[#166534]">
                          ✓ Well-calibrated
                        </div>
                      )}
                      {classification === "deactivated" && r.deactivated_reason && (
                        <div className="font-mono text-[10px] text-[#64748B]">
                          Reason: {r.deactivated_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline edit panel — expands when Edit is clicked */}
                  {isEditing && (
                    <EditRulePanel
                      rule={r}
                      onSave={async (updates) => {
                        const result = await saveRuleUpdates(r.id, updates);
                        if (!result.ok) {
                          alert("Could not save: " + result.error);
                          return;
                        }
                        setEditingRuleId(null);
                        router.refresh();
                      }}
                      onCancel={() => setEditingRuleId(null)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Rules need attention — bottom-of-page amber panel. Lists
            expiring rules first (Review →) then over-broad rules
            flagged by the calibration heuristic (Refine →). Each row
            opens the inline EditRulePanel for the matching rule. */}
        {(expiringRules.length > 0 || needsCalibration.length > 0) && (
          <div className="mt-8 border border-[#FDE68A] rounded-sm p-5 bg-[#FFFBEB]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#B45309]" aria-hidden>
                ⚠
              </span>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#B45309]">
                {expiringRules.length + needsCalibration.length} rule
                {expiringRules.length + needsCalibration.length !== 1 ? "s" : ""} need attention
              </div>
            </div>
            <div className="space-y-2">
              {expiringRules.map((r) => {
                const days = r.effective_until
                  ? Math.ceil(
                      (new Date(r.effective_until).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : 0;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2 px-3 bg-white rounded-sm border border-[#FDE68A] gap-3 flex-wrap"
                  >
                    <div>
                      <span className="text-sm font-medium text-[#0F172A]">
                        {r.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#92400E] ml-2">
                        expires in {days} day{days !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRuleId(r.id);
                        setTab("active");
                        // Scroll the rule into view after the next paint.
                        setTimeout(() => {
                          document
                            .getElementById(`rule-${r.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 50);
                      }}
                      className="font-mono text-xs text-[#B45309] hover:text-[#92400E] border border-[#FDE68A] px-3 py-1 rounded-sm hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                    >
                      Review →
                    </button>
                  </div>
                );
              })}
              {needsCalibration.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 px-3 bg-white rounded-sm border border-[#FDE68A] gap-3 flex-wrap"
                >
                  <div>
                    <span className="text-sm font-medium text-[#0F172A]">
                      {r.name}
                    </span>
                    <span className="font-mono text-[10px] text-[#92400E] ml-2">
                      high override rate — keywords may be too broad
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRuleId(r.id);
                      setTab("active");
                      setTimeout(() => {
                        document
                          .getElementById(`rule-${r.id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 50);
                    }}
                    className="font-mono text-xs text-[#B45309] hover:text-[#92400E] border border-[#FDE68A] px-3 py-1 rounded-sm hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                  >
                    Refine →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coming-soon — Message House. Sits above the AI-detection card so
            the alignment narrative reads as the lens through which the
            forthcoming Alignment Check will compare each draft. */}
        {(tab === "active" || tab === "all") && (
          <div className="mt-6 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                Message House
              </div>
              <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-2 py-0.5 rounded-sm border border-[#E2E8F0]">
                Coming soon
              </span>
            </div>
            <div className="text-sm font-medium text-[#0F172A] mb-2">
              Define your organization&apos;s messaging pillars. Enforce them on every draft.
            </div>
            <div className="text-sm text-[#374151] leading-relaxed mb-4">
              Set 3–7 positioning statements that define what your organization stands for.
              ERA CUE&apos;s Alignment Check compares every draft against your message house
              — flagging contradictions before they reach the public.
            </div>
            <div className="space-y-2">
              {[
                "We are the governance layer for AI communications",
                "We prioritize human oversight over automation",
                "Compliance is a competitive advantage",
              ].map((pillar, i) => (
                <div key={pillar} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-[#94A3B8] shrink-0 mt-0.5 w-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm text-[#94A3B8] italic">
                    &ldquo;{pillar}&rdquo;
                  </span>
                </div>
              ))}
            </div>
            <div className="font-mono text-[10px] text-[#94A3B8] mt-4">
              Alignment Check will enforce these pillars on every submission — automatically.
            </div>
          </div>
        )}

        {/* Coming-soon — AI content detection. Shown only on tabs where active
            rules are visible (Active or All). */}
        {(tab === "active" || tab === "all") && (
          <div className="mt-6 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              COMING SOON — AI CONTENT DETECTION
            </div>
            <div className="text-sm font-medium text-[#0F172A] mb-2">
              Automatic AI-generated content detection and routing
            </div>
            <p className="text-sm text-[#64748B] mb-4 leading-relaxed">
              ERA CUE will automatically detect AI-generated content and route
              it for principal review — without requiring manual declaration.
              Agent submission fingerprinting ensures every autonomous post has
              a human checkpoint.
            </p>
            <div className="space-y-2">
              {[
                "LLM-generated content detection",
                "Agent submission fingerprinting",
                "Automatic EU AI Act Article 50 disclosure flagging",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                  <span className="font-mono text-xs text-[#64748B]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddRulePanel
        isOpen={isAddOpen || editingRule !== null}
        initialRule={editingRule}
        onClose={() => {
          setIsAddOpen(false);
          setEditingRule(null);
        }}
      />
    </main>
  );
}

// ---------- CandidateRuleCard ---------------------------------------------

/**
 * Review card used by every tab in the import panel. Confirmed cards
 * flip to the green palette so the user can scan which rules will be
 * authorized at a glance. Keywords are clipped to 6 chips with a
 * "+N more" hint so a long keyword set doesn't take over the layout.
 */
function CandidateRuleCard({
  rule,
  index,
  confirmed,
  setConfirmed,
}: {
  rule: CandidateRule;
  index: number;
  confirmed: Set<number>;
  setConfirmed: (s: Set<number>) => void;
}) {
  const isConfirmed = confirmed.has(index);

  return (
    <div
      className={`border rounded-sm p-4 mb-2 transition-colors ${
        isConfirmed ? "bg-[#F0FDF4] border-[#BBF7D0]" : "bg-white border-[#E2E8F0]"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isConfirmed}
          onChange={(e) => {
            const next = new Set(confirmed);
            if (e.target.checked) next.add(index);
            else next.delete(index);
            setConfirmed(next);
          }}
          className="mt-1 w-4 h-4 accent-[#1A56DB] cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${
                rule.rule_type === "block"
                  ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                  : rule.rule_type === "escalate"
                    ? "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]"
                    : rule.rule_type === "review"
                      ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]"
                      : "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
              }`}
            >
              {rule.rule_type}
            </span>
            <span className="text-sm font-semibold text-[#0F172A]">{rule.name}</span>
          </div>
          <div className="text-sm text-[#374151] mb-2">{rule.description}</div>
          {rule.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {rule.keywords.slice(0, 6).map((kw) => (
                <span
                  key={kw}
                  className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                >
                  {kw}
                </span>
              ))}
              {rule.keywords.length > 6 && (
                <span className="font-mono text-[10px] text-[#94A3B8]">
                  +{rule.keywords.length - 6} more
                </span>
              )}
            </div>
          )}
          <div className="font-mono text-[10px] text-[#94A3B8]">
            {rule.regulatory_basis}
            {rule.regulatory_basis && rule.wsp_reference ? " · " : ""}
            {rule.wsp_reference}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- EditRulePanel -------------------------------------------------

const VERDICT_BADGE_SELECTED: Record<string, string> = {
  block: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  escalate: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
  review: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  guide: "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
};

/**
 * Inline edit panel that expands below a rule card when the user
 * clicks Edit. Fields: name, verdict, description, keywords (comma-
 * separated), expiry date. The "Test this rule" input runs the same
 * keyword match the engine uses (case-insensitive substring) so the
 * principal can verify their wording fires correctly before saving.
 */
function EditRulePanel({
  rule,
  onSave,
  onCancel,
}: {
  rule: RuleRow;
  onSave: (updates: RuleUpdates) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description ?? "");
  const initialVerdict =
    rule.verdict === "block" ||
    rule.verdict === "escalate" ||
    rule.verdict === "review" ||
    rule.verdict === "guide"
      ? rule.verdict
      : "review";
  const [ruleType, setRuleType] = useState<
    "block" | "escalate" | "review" | "guide"
  >(initialVerdict);
  const [keywordsStr, setKeywordsStr] = useState(
    (rule.keywords ?? []).join(", "),
  );
  const [effectiveTo, setEffectiveTo] = useState(
    rule.effective_until ? rule.effective_until.split("T")[0] : "",
  );
  const [saving, setSaving] = useState(false);
  const [testDraft, setTestDraft] = useState("");
  const [testResult, setTestResult] = useState<
    | { matched: true; keyword: string }
    | { matched: false }
    | null
  >(null);

  function handleTest() {
    const keywords = keywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const lower = testDraft.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        setTestResult({ matched: true, keyword: kw });
        return;
      }
    }
    setTestResult({ matched: false });
  }

  async function handleSave() {
    setSaving(true);
    const keywords = keywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    await onSave({
      name,
      description,
      rule_type: ruleType,
      keywords,
      effective_to: effectiveTo
        ? new Date(effectiveTo).toISOString()
        : null,
    });
    setSaving(false);
  }

  return (
    <div className="border-t border-[#E2E8F0] bg-[#F8F9FB] px-5 py-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-4">
        Edit rule
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
            Rule name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
            Verdict type
          </label>
          <div className="flex gap-1.5">
            {(["block", "escalate", "review", "guide"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRuleType(v)}
                className={`font-mono text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-sm border flex-1 transition-colors cursor-pointer ${
                  ruleType === v
                    ? VERDICT_BADGE_SELECTED[v]
                    : "bg-white border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] resize-none"
        />
      </div>

      <div className="mb-4">
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          Keywords
          <span className="normal-case ml-1 text-[#94A3B8]">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={keywordsStr}
          onChange={(e) => {
            setKeywordsStr(e.target.value);
            setTestResult(null);
          }}
          placeholder="keyword one, keyword two, keyword three"
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] font-mono"
        />
        {keywordsStr.trim() && (
          <div className="flex flex-wrap gap-1 mt-2">
            {keywordsStr
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
              .map((kw, i) => (
                <span
                  key={`${kw}-${i}`}
                  className="font-mono text-[10px] bg-white text-[#374151] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                >
                  {kw}
                </span>
              ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          Expires on
          <span className="normal-case ml-1 text-[#94A3B8]">
            (optional — leave blank for no expiry)
          </span>
        </label>
        <input
          type="date"
          value={effectiveTo}
          onChange={(e) => setEffectiveTo(e.target.value)}
          className="border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] font-mono"
        />
      </div>

      {/* Test this rule — uses the same case-insensitive substring
          match the engine uses, so the principal sees exactly which
          keyword would fire (or that none would). */}
      <div className="mb-5 bg-white border border-[#E2E8F0] rounded-sm p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
          Test this rule
        </div>
        <div className="text-xs text-[#64748B] mb-3">
          Paste a draft snippet to verify the keywords fire correctly.
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={testDraft}
            onChange={(e) => {
              setTestDraft(e.target.value);
              setTestResult(null);
            }}
            placeholder="Paste a sentence to test..."
            className="flex-1 border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleTest();
              }
            }}
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={!testDraft.trim()}
            className="font-mono text-xs bg-[#0F172A] text-white px-4 py-2 rounded-sm hover:bg-[#1E293B] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
          >
            Test →
          </button>
        </div>

        {testResult !== null && (
          <div
            className={`font-mono text-[10px] mt-2 flex items-center gap-1.5 ${
              testResult.matched ? "text-[#B91C1C]" : "text-[#166534]"
            }`}
          >
            {testResult.matched ? (
              <>
                <span aria-hidden>✗</span>
                <span>
                  Would trigger — matched keyword: &ldquo;{testResult.keyword}&rdquo;
                </span>
              </>
            ) : (
              <>
                <span aria-hidden>✓</span>
                <span>Would not trigger with current keywords</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </>
          ) : (
            "Save changes →"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors px-2 py-2.5 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
