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

// CandidateRule is the union shape every tab feeds into the same review
// list — `source` records where the rule came from so the audit trail can
// later distinguish template-authored rules from extracted ones.
type CandidateRule = CandidateRuleInput;
type ImportMode = "templates" | "paste" | "upload" | "manual";

const TABS: ReadonlyArray<{ key: ImportMode; label: string }> = [
  { key: "templates", label: "Templates" },
  { key: "paste", label: "Paste policy" },
  { key: "upload", label: "Upload doc" },
  { key: "manual", label: "Type rules" },
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

const VERDICT_STRIPE: Record<string, string> = {
  block:    "bg-[#B91C1C]",
  escalate: "bg-[#C2410C]",
  review:   "bg-[#1D4ED8]",
  guide:    "bg-[#6D28D9]",
};

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
  // "Check your first draft →" CTA.
  const [justAuthorized, setJustAuthorized] = useState(false);
  const [authorizedCount, setAuthorizedCount] = useState(0);

  const templateRules = useMemo(() => templatesFor(firmType), [firmType]);

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
  const driftCount = useMemo(() => {
    return classified.filter(({ rule, classification }) => {
      if (classification !== "active") return false;
      const f = classifyFreshness(rule, now).freshness;
      return f === "needs_calibration" || f === "expiring";
    }).length;
  }, [classified, now]);

  function handleDeactivate(id: string) {
    const reason = window.prompt("Why are you deactivating this rule?");
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      const result = await deactivateRuleAction({ ruleId: id, reason: reason.trim() });
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
        {/* Header row */}
        <div className="flex justify-between items-start gap-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              {IS_DEMO_MODE
                ? "GOVERNANCE RULES"
                : "GOVERNANCE RULES · AUTHORIZED BY SARAH CHEN, GC"}
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-2"
            >
              {IS_DEMO_MODE
                ? "Configure what ERA CUE enforces before checking any drafts."
                : "Your rules govern every speaker, every draft."}
            </h1>
            {!IS_DEMO_MODE && (
              <p className="text-sm text-[#64748B] max-w-xl mt-2 leading-relaxed">
                One principal. Every speaker on your team checks against these
                policies before anything goes live. Add a rule and it takes
                effect immediately.
              </p>
            )}

            {/* Framing notice. In demo mode this reads "rules before drafts"
                — the entry point for visitors clicking through. In
                production it stays as the WSP framing so authorized
                principals see the regulatory positioning instead. */}
            {IS_DEMO_MODE ? (
              <div className="mt-4 bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm px-5 py-4 flex items-start gap-4 max-w-2xl">
                <div
                  className="shrink-0 mt-0.5 font-mono text-[#1A56DB] text-lg"
                  aria-hidden
                >
                  ←
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F172A] mb-1">
                    Start here. Rules before drafts.
                  </div>
                  <div className="text-sm text-[#374151]">
                    ERA CUE checks every draft against your active rules.
                    Configure your governance policies first — then check
                    your team&apos;s communications.
                  </div>
                  <div className="font-mono text-[10px] text-[#64748B] mt-2">
                    The example rules below show what ERA CUE can enforce.
                    Import your own policies to get started.
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm px-5 py-4 flex items-start gap-4 max-w-2xl">
                <div className="shrink-0 mt-0.5">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1A56DB"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F172A] mb-1">
                    ERA CUE enforces your Written Supervisory Procedures.
                  </div>
                  <div className="text-sm text-[#374151] leading-relaxed">
                    Each rule references the WSP section it implements. ERA CUE
                    becomes the enforcement layer of your existing supervisory
                    framework — not a replacement for it.
                  </div>
                  <div className="font-mono text-xs text-[#1A56DB] mt-2">
                    Add a WSP reference when creating or editing any rule →
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="bg-[#1A56DB] text-white text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[#1447C0] transition"
            >
              Add a rule
            </button>
            <button
              type="button"
              onClick={() => setShowImport((o) => !o)}
              className="bg-white border border-[#E2E8F0] text-[#0F172A] text-sm px-4 py-2 rounded-sm hover:bg-[#F8F9FB] transition cursor-pointer"
            >
              {showImport ? "Close import" : "Import existing policies"}
            </button>
          </div>
        </div>

        {/* Import existing policies — four-tab panel. Templates fires
            without an extraction round-trip; the other three tabs run
            text through extractRulesFromWsp before showing candidate
            cards. Sits between the header and the stats strip so the
            review surface sits above the live rule list. */}
        <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm mb-6 mt-6">
          {/* Header — always visible so the user can re-collapse without
              losing scroll position. */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#BAE6FD]">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#1A56DB] mb-0.5">
                Import existing policies
              </div>
              <div className="text-sm text-[#374151]">
                ERA CUE converts your existing compliance policies into active governance rules.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowImport((o) => !o)}
              className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors cursor-pointer"
            >
              {showImport ? "Close ×" : "Open →"}
            </button>
          </div>

          {showImport && (
            <div className="px-5 py-4">
              {/* Four tabs */}
              <div className="flex gap-1 mb-4 bg-[#DBEAFE] p-1 rounded-sm">
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
                      className={`flex-1 font-mono text-[10px] py-1.5 rounded-sm transition-colors cursor-pointer ${
                        selected
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-[#1A56DB] hover:bg-white/50"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

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
                  <div className="text-sm text-[#374151] mb-4 leading-relaxed">
                    Pre-built rules based on your firm type. Each is cited to the specific regulation it enforces. Review each rule and check the ones that apply to your organization.
                  </div>
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
                <div className="mt-4 pt-4 border-t border-[#BAE6FD]">
                  <div className="text-sm font-medium text-[#0F172A] mb-3">
                    ERA CUE found {candidates.length} rule
                    {candidates.length !== 1 ? "s" : ""}. Review and confirm which to add.
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
          )}
        </div>

        {/* Post-authorization success card — sits between the import
            panel and the rest of the page so the next-step CTA is the
            first thing the user sees after the page reloads. Persists
            until the next import run or a navigation away. */}
        {justAuthorized && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-6 mb-6 text-center">
            <div className="text-2xl mb-2" aria-hidden>
              ✓
            </div>
            <div className="text-base font-semibold text-[#0F172A] mb-1">
              {authorizedCount} rule{authorizedCount !== 1 ? "s" : ""} authorized and active
            </div>
            <div className="text-sm text-[#374151] mb-4">
              ERA CUE will now enforce these rules on every draft submitted by your team.
            </div>
            <a
              href="/submit"
              className="inline-flex items-center bg-[#1A56DB] text-white font-mono text-sm font-medium px-6 py-3 rounded-sm hover:bg-[#1447C0] transition-colors"
            >
              Check your first draft →
            </a>
          </div>
        )}

        {/* Governance drift summary — only renders when at least one
            active rule needs calibration or is within its expiry
            window. Sits above the stats strip so a principal opening
            this page sees what to act on first. */}
        {driftCount > 0 && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm p-4 mb-4 mt-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#B45309] mb-1">
              Governance drift detected
            </div>
            <div className="text-sm text-[#92400E]">
              {driftCount} rule{driftCount !== 1 ? "s" : ""} need attention — either expiring soon or showing high override rates that suggest miscalibration.
            </div>
          </div>
        )}

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
          <div className="ml-auto font-mono text-sm text-[#374151]">
            2 of 5 checks active · Rule Check + Quiet Period Check deterministic · Consistency Check comparing against {corpusCount} approved statements
          </div>
        </div>

        {/* "Rules active" next-step prompt — sits between the stats
            strip and the filter tabs so the principal sees the obvious
            next action (check a draft against these rules) without
            scrolling. Renders only when at least one rule is active. */}
        {counts.active > 0 && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm px-5 py-4 mb-6 mt-6 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[#166534] text-lg" aria-hidden>
                ✓
              </span>
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">
                  {counts.active} rule{counts.active !== 1 ? "s" : ""} active
                </div>
                <div className="font-mono text-[10px] text-[#64748B]">
                  Your governance is configured. Ready to check your first draft.
                </div>
              </div>
            </div>
            <a
              href="/submit"
              className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] transition-colors whitespace-nowrap"
            >
              Check a draft now →
            </a>
          </div>
        )}

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

        {/* Demo-only label above the rule list — frames the seeded
            rules as examples rather than the visitor's own authorized
            policy. Renders only in demo mode and only when there are
            rules to label. */}
        {IS_DEMO_MODE && rules.length > 0 && (
          <div className="flex items-center justify-between mb-4 mt-6 flex-wrap gap-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8]">
              Example rules — showing what ERA CUE can enforce
            </div>
            <div className="font-mono text-[10px] text-[#94A3B8]">
              Your rules will replace these
            </div>
          </div>
        )}

        {/* Rule cards */}
        <div className="flex flex-col gap-3 mt-6">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-12 text-center text-[#64748B] text-sm">
              No rules in this view.
            </div>
          ) : (
            filtered.map(({ rule: r, classification }) => {
              const v = (r.verdict || "review").toLowerCase();
              const stripe = VERDICT_STRIPE[v] || "bg-[#64748B]";
              const badge = VERDICT_BADGE[v] || VERDICT_BADGE.review;
              const triggers = r.trigger_count ?? 0;
              const showKeywords = r.keywords && r.keywords.length > 0 && v !== "guide";
              // Drift signal renders only on active rules — deactivated/
              // expired rules have their own footer text and adding a
              // freshness chip on top would be noisy.
              const drift =
                classification === "active" ? classifyFreshness(r, now) : null;
              return (
                <div
                  key={r.id}
                  className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden flex"
                >
                  <div className={`w-1 shrink-0 ${stripe}`} aria-hidden />
                  <div className="p-5 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-medium text-[#0F172A]">{r.name}</div>
                        {r.description && (
                          <div className="text-sm text-[#374151] mt-1">{r.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2 items-center shrink-0 ml-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-sm border font-mono text-xs font-bold tracking-wide ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                        <span className="bg-[#EFF8FF] text-[#1447C0] border border-[#BAE6FD] font-mono text-xs px-2 py-0.5 rounded-sm">
                          {scopeLabel(r.scope)}
                        </span>
                        {triggers > 0 && (
                          <span className="bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] font-mono text-xs px-2 py-0.5 rounded-sm">
                            {triggers} {triggers === 1 ? "trigger" : "triggers"}
                          </span>
                        )}
                      </div>
                    </div>

                    {showKeywords && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {(r.keywords ?? []).map((kw) => (
                          <span
                            key={kw}
                            className="bg-[#F1F5F9] text-[#64748B] font-mono text-xs px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex justify-between items-center gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-[#64748B]">
                          {buildFooterText(r, classification)}
                        </div>
                        {r.wsp_reference && (
                          <div className="font-mono text-xs text-[#1447C0] mt-0.5">
                            WSP: {r.wsp_reference}
                          </div>
                        )}
                        {triggers > 0 && r.last_triggered && (
                          <div className="font-mono text-xs text-[#94A3B8] mt-0.5">
                            Last triggered: {fmtRelative(r.last_triggered)}
                          </div>
                        )}
                        {/* Drift indicator — color and copy keyed off the
                            freshness classification so the same compact
                            line tells the principal whether the rule
                            needs attention without adding a separate
                            column. */}
                        {drift?.freshness === "needs_calibration" && (
                          <div className="font-mono text-[10px] text-[#C2410C] mt-1">
                            ⚠ Override rate high — rule may be too broad
                          </div>
                        )}
                        {drift?.freshness === "expiring" && drift.daysUntilExpiry !== null && (
                          <div className="font-mono text-[10px] text-[#B45309] mt-1">
                            ⏱ Expires in {drift.daysUntilExpiry}{" "}
                            {drift.daysUntilExpiry === 1 ? "day" : "days"} — review and renew
                          </div>
                        )}
                        {drift?.freshness === "silent" && (
                          <div className="font-mono text-[10px] text-[#94A3B8] mt-1">
                            ○ No triggers yet — rule is active but hasn&apos;t fired
                          </div>
                        )}
                        {drift?.freshness === "healthy" && (
                          <div className="font-mono text-[10px] text-[#166534] mt-1">
                            ✓ Well-calibrated
                          </div>
                        )}
                        {classification === "deactivated" && r.deactivated_reason && (
                          <div className="font-mono text-xs text-[#64748B] mt-0.5">
                            Reason: {r.deactivated_reason}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 shrink-0">
                        {classification === "active" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingRule(r)}
                              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(r.id)}
                              disabled={pending}
                              className="font-mono text-xs text-[#64748B] hover:text-[#B91C1C] transition cursor-pointer disabled:opacity-50"
                            >
                              {pending ? "Deactivating..." : "Deactivate"}
                            </button>
                          </>
                        )}
                        {classification === "expired" && (
                          <button
                            type="button"
                            onClick={() => alert("Renew coming soon")}
                            className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                          >
                            Renew
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

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
