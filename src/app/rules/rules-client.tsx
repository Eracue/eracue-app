"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddRulePanel } from "./add-rule-panel";
import { deactivateRuleAction } from "./actions";
import { extractRulesFromWsp } from "./wsp-import-action";
import { createRulesFromImport } from "./create-rules-action";
import { saveRuleUpdates, type RuleUpdates } from "./update-rule-action";
import {
  TEMPLATES,
  FIRM_TYPE_BUTTONS,
  templatesFor,
  type CandidateRule,
} from "./templates";

type ImportMode = "templates" | "paste" | "upload" | "manual";

const TABS: ReadonlyArray<{ key: ImportMode; label: string }> = [
  { key: "templates", label: "Templates" },
  { key: "paste", label: "Paste policy" },
  { key: "manual", label: "Type rules" },
  { key: "upload", label: "Upload doc" },
];

// Two top-level rules experiences. Setup is a focused one-page picker
// for first-time visitors (or anyone explicitly setting up from
// scratch); managing is the existing full rules dashboard with stats,
// filters, and the rules list. The view switch is local React state —
// no route change — switching views never refetches the rules list.
type RulesView = "setup" | "managing";

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
  // Optional principal-of-record. Renders as "Authorized by …" on
  // the rule card outside demo mode; demo always hides this surface
  // because the seeded value would name a fictional principal.
  authorized_by?: string | null;
};

// Governance-drift freshness used to live here as a single
// `classifyFreshness` helper. After the tab-system refactor the
// expiring / silent / healthy distinctions are computed inline per
// tab, so the helper is gone — see expiringRules / silentRules /
// activeRules useMemos in the component body.

// Five-way tab state for the managing view. Active is the default
// landing tab; Expiring lights up amber when at least one rule sits
// inside the 30-day window; Silent flags rules that have never fired
// (drift signal); Deactivated bucket keeps the inactive rules out of
// the way; Templates surfaces the firm-type starter set.
type RulesTab =
  | "active"
  | "expiring"
  | "silent"
  | "deactivated"
  | "templates";

// Demo rules surfaced in the rules list. Curated to one rule per
// verdict type so a visitor sees the full spread (Block / Route to
// review / Flag / Guide) without scrolling. Names must match the
// seed data — anything missing from the seed simply doesn't render.
const DEMO_RULE_NAMES: ReadonlyArray<string> = [
  "Series B Quiet Period",
  "Earnings Quiet Period — Q2 2026",
  "Competitor Mentions",
  "Pricing Claims",
];

// Plain-English verdict labels rendered on the rule cards. Inline
// styles (instead of bg-/text-/border- Tailwind tokens) so the badge
// palette stays portable across every consumer — verdict colors
// describe state, not chrome, and shouldn't be tangled in the
// Tailwind safelist. Review uses the brand-purple pair so flagged
// rules read as the page accent rather than a third blue.
const VERDICT_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  block:    { label: "Block",            bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
  escalate: { label: "Route to review",  bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  review:   { label: "Flag",             bg: "#EEF2FF", text: "#4338CA", border: "#C7D7FE" },
  guide:    { label: "Guide",            bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
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

function statusPrefix(r: RuleRow, classification: "active" | "expired" | "deactivated"): string {
  if (classification === "deactivated") return `Deactivated ${fmtDate(r.deactivated_at)}`;
  if (classification === "expired") return `Expired ${fmtDate(r.effective_until)}`;
  if (r.effective_until) return `Active until ${fmtDate(r.effective_until)}`;
  return "Active — no end date";
}

type Props = {
  rules: RuleRow[];
  corpusCount?: number;
  // Drives which Templates the import panel surfaces. Defaults to the
  // broker_dealer set when null/unknown.
  firmType?: string | null;
};

// Demo mode. NEXT_PUBLIC_* env vars are inlined at build time so this
// const evaluates to a literal in the client bundle. When on, the
// page hides the principal-of-record attribution, the stats strip,
// the filter tabs, and the success banner; the rules list is curated
// to four representative templates; and the import panel stays
// closed by default — every signal stays focused on "configure your
// governance" rather than someone else's authorized policy list.
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function RulesClient({ rules, corpusCount = 0, firmType = null }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?activated=true` is set by the /rules/confirm redirect. Both the
  // initial view and the success-banner toggle key off this param so a
  // visitor lands directly on managing-with-banner instead of flashing
  // the setup view first.
  const activatedFromConfirm = searchParams.get("activated") === "true";

  const [activeTab, setActiveTab] = useState<RulesTab>("active");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [pending, startTransition] = useTransition();

  // Initial view — managing if the org already has live rules OR if the
  // user just activated a batch from /rules/confirm; setup otherwise.
  // Computed from the rules prop (not the useMemo counts below) because
  // it runs once at mount and doesn't need to react to subsequent count
  // changes.
  const initialActiveCount = rules.filter(
    (r) => r.rule_status !== "deactivated",
  ).length;
  const [view, setView] = useState<RulesView>(
    activatedFromConfirm || initialActiveCount > 0 ? "managing" : "setup",
  );

  // Import panel state. Always closed by default — visitors should
  // see the rules list first and toggle the import panel open when
  // they want to add policies. Demo mode is no exception.
  const [showImport, setShowImport] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<ImportMode>("templates");
  const [importText, setImportText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualRules, setManualRules] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<CandidateRule[]>([]);
  // Pre-fill confirmed with all templates for the resolved firm type so
  // the setup view's suggested-rules cards land already checked. The
  // managing-view import panel resets this to an empty Set when the user
  // switches firm types inside the Templates tab, so the auto-fill only
  // affects the first encounter.
  const [confirmed, setConfirmed] = useState<Set<number>>(() => {
    const defaults = templatesFor(firmType);
    return new Set(defaults.map((_, i) => i));
  });
  const [authorizing, setAuthorizing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Post-authorization success state. Triggered by either the in-page
  // import-panel flow (handleConfirmRules below) or the /rules/confirm
  // redirect that lands here with `?activated=true`. Both paths reach
  // the same green success banner with the "Check your first draft →"
  // CTA and the "Add more rules" secondary.
  const [justAuthorized, setJustAuthorized] = useState(activatedFromConfirm);

  // Strip the `?activated=true` query off the URL so a refresh doesn't
  // re-trigger the banner. Used by the dismiss button + the "Add more
  // rules" secondary so neither leaves stale state in the bar.
  function clearActivated() {
    setJustAuthorized(false);
    if (activatedFromConfirm) {
      router.replace("/rules");
    }
  }
  // Templates tab now lets the user switch firm-type buckets without
  // leaving the page (defaults to whatever the org was created with).
  const [firmTypeFilter, setFirmTypeFilter] = useState<string>(() => {
    const raw = firmType ?? "broker_dealer";
    return raw === "rIA" ? "ria" : raw;
  });
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
      // Reset all import state on success and close the panel.
      setCandidates([]);
      setConfirmed(new Set());
      setImportText("");
      setManualRules("");
      setUploadedFile(null);
      setShowImport(false);
      // Surface the success state — sticks until the user dismisses
      // the banner or navigates away.
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

  // Demo curated list — sorted to spec order so the four cards
  // always render Series B → Earnings → Competitor → Pricing.
  const demoRules = useMemo(() => {
    return classified
      .filter(
        ({ rule, classification }) =>
          classification === "active" &&
          DEMO_RULE_NAMES.includes(rule.name),
      )
      .sort(
        (a, b) =>
          DEMO_RULE_NAMES.indexOf(a.rule.name) -
          DEMO_RULE_NAMES.indexOf(b.rule.name),
      )
      .map(({ rule }) => rule);
  }, [classified]);

  // Tab-driven rule slices. 30-day window for "Expiring" (was 14
  // before — the longer window gives a CCO time to plan a renewal /
  // expiry decision). Silent = active + zero triggers. Deactivated =
  // self-explanatory.
  const expiringRules = useMemo(() => {
    return classified
      .filter(({ rule, classification }) => {
        if (classification !== "active") return false;
        if (!rule.effective_until) return false;
        const days = Math.ceil(
          (new Date(rule.effective_until).getTime() - now) /
            (1000 * 60 * 60 * 24),
        );
        return days <= 30 && days > 0;
      })
      .map(({ rule }) => rule);
  }, [classified, now]);

  const silentRules = useMemo(() => {
    return classified
      .filter(
        ({ rule, classification }) =>
          classification === "active" && (rule.trigger_count ?? 0) === 0,
      )
      .map(({ rule }) => rule);
  }, [classified]);

  const deactivatedRules = useMemo(() => {
    return classified
      .filter(({ classification }) => classification === "deactivated")
      .map(({ rule }) => rule);
  }, [classified]);

  // Active = active classification minus expiring (so the Expiring tab
  // is the canonical home for soon-to-expire rules and they don't
  // appear in two tabs at once).
  const activeRules = useMemo(() => {
    const expiringIds = new Set(expiringRules.map((r) => r.id));
    return classified
      .filter(({ rule, classification }) => {
        if (classification !== "active") return false;
        return !expiringIds.has(rule.id);
      })
      .map(({ rule }) => rule);
  }, [classified, expiringRules]);

  // Pick the rules to render based on the active tab. Demo mode
  // pins to the four curated rules regardless of tab so the visitor
  // never lands on an empty Expiring / Silent / Deactivated view.
  const tabRules: RuleRow[] = useMemo(() => {
    if (IS_DEMO_MODE) return demoRules;
    if (activeTab === "active") return activeRules;
    if (activeTab === "expiring") return expiringRules;
    if (activeTab === "silent") return silentRules;
    if (activeTab === "deactivated") return deactivatedRules;
    return []; // templates tab — content renders inline
  }, [
    activeTab,
    demoRules,
    activeRules,
    expiringRules,
    silentRules,
    deactivatedRules,
  ]);

  // Lightweight hooks the action buttons in the Expiring tab call
  // into. Extending nudges effective_until forward 90 days; cloning
  // for now just opens the add-rule panel (the full clone-with-
  // prefilled-data flow lives in a follow-up).
  async function handleExtendRule(id: string) {
    const target = rules.find((r) => r.id === id);
    if (!target?.effective_until) return;
    const next = new Date(target.effective_until);
    next.setDate(next.getDate() + 90);
    const result = await saveRuleUpdates(id, {
      effective_to: next.toISOString(),
    });
    if (result.ok) router.refresh();
  }

  function handleCloneRule() {
    setIsAddOpen(true);
  }

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

  // Setup view — first-time picker. The user picks a firm type, the
  // suggested templates auto-check, and clicking "Review and confirm"
  // navigates to /rules/confirm with the firm + selected indices in
  // the URL so the next page can rebuild the pending list. The
  // "Import from an existing policy" link drops the user into the
  // managing view with the import panel pre-opened on the Paste tab.
  if (view === "setup") {
    const setupTemplates =
      TEMPLATES[firmTypeFilter] ?? TEMPLATES.broker_dealer;
    const firmLabel =
      FIRM_TYPE_BUTTONS.find((f) => f.key === firmTypeFilter)?.label ??
      "your firm type";
    return (
      <main className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
              Step 1 of 2 — Set your rules
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl font-light text-[#0D1B2A] mb-3"
            >
              What should ERA CUE enforce?
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed max-w-lg">
              ERA CUE checks every draft your team submits against these
              rules before publication. Choose the rules that apply to
              your organization — you can edit or add more any time.
            </p>
          </div>

          {/* Firm type selector. Clicking a chip auto-checks every
              template for that firm type so the user never has to
              hunt for a "select all" affordance. */}
          <div className="mb-8">
            <div className="text-sm font-medium text-[#0D1B2A] mb-3">
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
                      const tpls =
                        TEMPLATES[ft.key] ?? TEMPLATES.broker_dealer;
                      setConfirmed(new Set(tpls.map((_, i) => i)));
                    }}
                    className={`px-4 py-2 rounded-sm border text-sm transition-colors cursor-pointer ${
                      selected
                        ? "bg-[#0F172A] border-[#0F172A] text-white"
                        : "bg-white border-[#E2E8F0] text-[#475569] hover:border-[#94A3B8]"
                    }`}
                  >
                    {ft.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suggested rules — same data the import panel surfaces, but
              rendered as a focused checklist with plain-English verdict
              labels ("Will block" / "Routes to review" / "Will flag")
              so a first-time visitor doesn't have to map BLOCK /
              ESCALATE / REVIEW onto behaviour. */}
          <div className="mb-6">
            <div className="text-sm font-medium text-[#0D1B2A] mb-1">
              Suggested rules for your organization
            </div>
            <div className="text-sm text-[#64748B] mb-4 leading-relaxed">
              These are based on common regulatory requirements for{" "}
              {firmLabel}. Review each one — you&apos;ll confirm and
              edit them on the next screen.
            </div>

            <div className="space-y-2">
              {setupTemplates.map((rule, i) => {
                const isChecked = confirmed.has(i);
                const verdictLabel =
                  rule.rule_type === "block"
                    ? "Will block"
                    : rule.rule_type === "escalate"
                      ? "Routes to review"
                      : "Will flag";
                const verdictClass =
                  rule.rule_type === "block"
                    ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                    : rule.rule_type === "escalate"
                      ? "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]"
                      : "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]";
                return (
                  <div
                    key={`${rule.name}-${i}`}
                    onClick={() => {
                      const next = new Set(confirmed);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setConfirmed(next);
                    }}
                    className={`border rounded-sm p-4 cursor-pointer transition-colors ${
                      isChecked
                        ? "border-[#4F46E5] bg-[#EFF8FF]"
                        : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${
                          isChecked
                            ? "bg-[#4F46E5] border-[#4F46E5]"
                            : "border-[#D1D5DB] bg-white"
                        }`}
                      >
                        {isChecked && (
                          <svg
                            className="w-3 h-3 text-white"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-[#0D1B2A]">
                            {rule.name}
                          </span>
                          <span
                            className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${verdictClass}`}
                          >
                            {verdictLabel}
                          </span>
                        </div>
                        <p className="text-sm text-[#64748B] leading-relaxed mb-2">
                          {rule.description}
                        </p>
                        <div className="font-mono text-[9px] text-[#94A3B8]">
                          {rule.regulatory_basis}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Existing-policy escape hatch. Drops the user into the
              managing view with the import panel open on the Paste tab
              so they can pull rules out of their WSP instead of
              hand-picking templates. */}
          <div className="border border-[#E2E8F0] rounded-sm p-4 mb-8 bg-[#F8F9FB]">
            <div className="text-sm font-medium text-[#0D1B2A] mb-1">
              Already have a compliance policy?
            </div>
            <div className="text-sm text-[#64748B] mb-3 leading-relaxed">
              Paste your existing Written Supervisory Procedures (WSP),
              social media policy, or any compliance document. ERA CUE
              will extract your rules automatically.
            </div>
            <button
              type="button"
              onClick={() => {
                setView("managing");
                setShowImport(true);
                setImportMode("paste");
              }}
              className="font-mono text-xs text-[#4F46E5] hover:text-[#4338CA] transition-colors cursor-pointer"
            >
              Import from an existing policy →
            </button>
          </div>

          {/* Action footer — count message on the left, primary action
              on the right. Disabled when nothing is selected so the
              user can't navigate to a confirm page with an empty list. */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0] flex-wrap gap-3">
            <div className="text-sm text-[#94A3B8]">
              {confirmed.size === 0
                ? "Select at least one rule to continue"
                : `${confirmed.size} rule${confirmed.size !== 1 ? "s" : ""} selected`}
            </div>
            <button
              type="button"
              onClick={() => {
                const ids = Array.from(confirmed)
                  .sort((a, b) => a - b)
                  .join(",");
                router.push(
                  `/rules/confirm?firm=${encodeURIComponent(firmTypeFilter)}&ids=${ids}`,
                );
              }}
              disabled={confirmed.size === 0}
              className="bg-[#0F172A] text-white font-mono text-sm font-medium px-6 py-2.5 rounded-sm hover:bg-[#1E293B] disabled:opacity-40 transition-colors cursor-pointer"
            >
              Review and confirm →
            </button>
          </div>
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

  return (
    <main className="min-h-screen bg-[#F8F9FB] pb-16">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
        {/* PAGE HEADER — demo mode is product framing ("your rules,
            your authority") so the visitor reads the page as
            something to configure; a real deployment names the
            count and frames it as live status. */}
        <div className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-2">
            Rules engine
          </div>
          <h1
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0D1B2A] mb-2 leading-tight"
          >
            {IS_DEMO_MODE
              ? "Your rules. Your authority. Enforced at submission."
              : `${counts.active} rule${counts.active !== 1 ? "s" : ""} governing your team's communications.`}
          </h1>
          <p className="text-sm text-[#475569] leading-relaxed max-w-2xl">
            {IS_DEMO_MODE
              ? "Live from app.eracue.com/rules — keyword triggers, calibration signals, FINRA citations. Configure your governance policies before checking any draft."
              : "Every draft your team submits is checked against these rules before publication."}
          </p>
        </div>

        {/* ACTION BAR — Add rule + Import toggle + Templates jump on
            the left, "Check a draft" link on the right (only when at
            least one rule is active so the nudge isn't a misdirection
            on a fresh page). */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#4338CA] transition-colors flex items-center gap-1.5"
            >
              <span aria-hidden>+</span>
              Add a rule
            </button>
            <button
              type="button"
              onClick={() => setShowImport((o) => !o)}
              className={`font-mono text-xs font-medium px-4 py-2 rounded-sm border transition-colors ${
                showImport
                  ? "bg-[#EEF2FF] border-[#C7D7FE] text-[#4338CA]"
                  : "bg-white border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
              }`}
            >
              {showImport ? "× Close" : "Import existing policy"}
            </button>
            {!IS_DEMO_MODE && (
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors px-2 py-2"
              >
                View templates
              </button>
            )}
          </div>
          {counts.active > 0 && (
            <a
              href="/submit"
              className="font-mono text-xs text-[#4F46E5] hover:text-[#4338CA] transition-colors"
            >
              Check a draft →
            </a>
          )}
        </div>

        {/* Rule Builder — renders inline directly below the action bar
            so the form appears where the visitor's eye already is
            after clicking Add a rule. The component returns null when
            isOpen is false. */}
        <AddRulePanel
          isOpen={isAddOpen || editingRule !== null}
          initialRule={editingRule}
          onClose={() => {
            setIsAddOpen(false);
            setEditingRule(null);
          }}
        />

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
                        ? "border-[#4F46E5] text-[#4F46E5] bg-white"
                        : "border-transparent text-[#64748B] hover:text-[#0D1B2A] bg-transparent"
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
                  {/* Firm type selector — FIRST. Switches the templates
                      pool without leaving the page. Resets the confirmed
                      set so checks don't carry over across firm types. */}
                  <div className="mb-4">
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
                                ? "bg-[#EFF8FF] border-[#BAE6FD] text-[#4338CA] font-medium"
                                : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB]"
                            }`}
                          >
                            {ft.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="font-mono text-[10px] text-[#94A3B8] mt-2">
                      Templates are tailored to your firm type and regulatory framework.
                    </div>
                  </div>

                  {/* Helper text — explains what the cards below are
                      and that authorizing them isn't a final commit
                      (every rule stays editable afterward). */}
                  <div className="text-sm text-[#475569] mb-3 leading-relaxed">
                    Pre-built rules based on your firm type. Each is cited to the regulation
                    it enforces. Review each one and check the ones that apply to your
                    organization. You can customize any rule after authorizing.
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
                  <div className="text-sm text-[#475569] mb-3">
                    Paste any policy text — WSP section, social media policy, email from legal, anything.
                    ERA CUE extracts the rules.
                  </div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`Paste your Written Supervisory Procedures, social media policy, or any compliance document.

Example:
"All associated persons must obtain prior written approval from a registered principal before posting on LinkedIn, Twitter, or any public social media platform. Posts containing performance claims, testimonials, forward-looking statements, or references to specific securities require CCO review and FINRA filing consideration under Rule 2210(b). All approved communications must be retained for 3 years per SEC Rule 17a-4."`}
                    className="w-full border border-[#BAE6FD] rounded-sm px-3 py-3 text-sm text-[#0D1B2A] bg-white h-36 resize-none focus:outline-none focus:ring-1 focus:ring-[#4F46E5] placeholder:text-[#94A3B8]"
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
                    className="mt-3 bg-[#4F46E5] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm disabled:opacity-50 hover:bg-[#4338CA] transition-colors flex items-center gap-2 cursor-pointer"
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
                  <div className="text-sm text-[#475569] mb-3">
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
                        <div className="text-sm font-medium text-[#0D1B2A]">{uploadedFile.name}</div>
                        <div className="font-mono text-[10px] text-[#64748B] mt-1">
                          {(uploadedFile.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-[#475569]">
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
                      className="mt-3 bg-[#4F46E5] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm disabled:opacity-50 hover:bg-[#4338CA] transition-colors cursor-pointer"
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
                  <div className="text-sm text-[#475569] mb-3">
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
                    className="w-full border border-[#BAE6FD] rounded-sm px-3 py-3 text-sm text-[#0D1B2A] bg-white h-36 resize-none font-mono focus:outline-none focus:ring-1 focus:ring-[#4F46E5] placeholder:text-[#94A3B8]"
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
                              <span className="text-xs text-[#475569] leading-relaxed">
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
                    className="mt-3 bg-[#4F46E5] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm disabled:opacity-50 hover:bg-[#4338CA] transition-colors cursor-pointer"
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

        {/* Post-authorization success banner — only renders for real
            users. In demo mode the action bar already has the
            "Check a draft →" link, so the banner would just repeat
            framing the page already carries. Dismiss strips the
            `?activated=true` query so a refresh doesn't re-show it. */}
        {!IS_DEMO_MODE && justAuthorized && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-5 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="text-[#166534] text-xl mt-0.5" aria-hidden>
                  ✓
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0D1B2A] mb-1">
                    Your governance rules are live.
                  </div>
                  <div className="text-sm text-[#475569]">
                    ERA CUE is now checking every draft your team submits
                    against these rules before publication.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearActivated}
                aria-label="Dismiss"
                className="text-[#94A3B8] hover:text-[#64748B] font-mono text-xs ml-4 shrink-0 cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <a
                href="/submit"
                className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] transition-colors"
              >
                Check your first draft →
              </a>
              <button
                type="button"
                onClick={() => {
                  clearActivated();
                  setView("setup");
                }}
                className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer"
              >
                Add more rules
              </button>
            </div>
          </div>
        )}

        {/* Stats strip — real users only. The big counts describe seed
            data in demo mode (someone else's "7 ACTIVE / 4 FIRING / 3
            SILENT"), so we hide the entire strip in demo and let the
            labeled separator below carry the framing. */}
        {!IS_DEMO_MODE && (
          <div className="flex items-center justify-between mt-6 mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-2xl font-light font-mono text-[#0D1B2A]">
                  {counts.active}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                  Active
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light font-mono text-[#C2410C]">
                  {counts.firing}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                  Firing
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light font-mono text-[#94A3B8]">
                  {counts.silent}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                  Silent
                </div>
              </div>
            </div>
            <div className="font-mono text-[10px] text-[#94A3B8]">
              5 checks · 2 deterministic · 3 AI-powered
              {corpusCount > 0 && (
                <span> · {corpusCount} approved statements in corpus</span>
              )}
            </div>
          </div>
        )}

        {/* Tab bar — real users only. Demo mode pins to the four
            curated rules so a tab system would only confuse the
            visitor. Each tab carries a count chip; the Expiring
            chip flips amber when there's at least one rule inside
            the 30-day window. Templates lives at the end of the row
            and shows a starter-set picker when selected. */}
        {!IS_DEMO_MODE && (
          <div className="flex gap-0 border-b border-[#E2E8F0] mb-5 overflow-x-auto">
            {(
              [
                {
                  key: "active" as const,
                  label: "Active",
                  count: activeRules.length,
                  alert: false,
                },
                {
                  key: "expiring" as const,
                  label: "Expiring",
                  count: expiringRules.length,
                  alert: expiringRules.length > 0,
                },
                {
                  key: "silent" as const,
                  label: "Silent",
                  count: silentRules.length,
                  alert: false,
                },
                {
                  key: "deactivated" as const,
                  label: "Deactivated",
                  count: deactivatedRules.length,
                  alert: false,
                },
                {
                  key: "templates" as const,
                  label: "Templates",
                  count: null,
                  alert: false,
                },
              ]
            ).map((t) => {
              const selected = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`font-mono text-xs px-5 py-3 whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5 cursor-pointer ${
                    selected
                      ? "border-[#4F46E5] text-[#4F46E5]"
                      : "border-transparent text-[#64748B] hover:text-[#0D1B2A]"
                  }`}
                >
                  {t.label}
                  {t.count !== null && t.count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        t.alert
                          ? "bg-[#FEF3C7] text-[#B45309]"
                          : "bg-[#F1F5F9] text-[#64748B]"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Drift alert — silent tab only. Surfaces "these rules
            never fired" so the principal sees the calibration signal
            inline rather than burying it on each card. */}
        {!IS_DEMO_MODE &&
          activeTab === "silent" &&
          silentRules.length > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm px-4 py-3 mb-4 text-xs text-[#92400E] font-mono leading-relaxed">
              <span className="font-bold">Drift alert</span>
              {" · "}
              {silentRules.length} rule
              {silentRules.length !== 1 ? "s have" : " has"} never fired.
              Review whether keywords match how your team actually writes.
            </div>
          )}

        {/* Templates tab placeholder — links the user back to the
            import panel where the firm-type starter set lives. */}
        {!IS_DEMO_MODE && activeTab === "templates" && (
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-8 text-center">
            <div className="text-sm font-medium text-[#0D1B2A] mb-2">
              FINRA-ready starter rules
            </div>
            <p className="text-sm text-[#475569] leading-relaxed max-w-md mx-auto mb-4">
              Pre-built rules per firm type — broker-dealer, RIA, public
              company, investment bank, PR agency, executive team. Each
              cited to the regulation it enforces.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowImport(true);
                setImportMode("templates");
                setActiveTab("active");
              }}
              className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#4338CA] transition-colors"
            >
              Open template picker →
            </button>
          </div>
        )}

        {/* Demo label — single muted sentence above the rules list,
            demo mode only. Real users get a clean tab-only interface
            (no labeled separator — the tab title is the label). */}
        {IS_DEMO_MODE && (
          <div className="font-mono text-[10px] text-[#94A3B8] mb-5 pb-4 border-b border-[#E2E8F0]">
            Example rules showing how ERA CUE works. Import your own
            policies above to replace these.
          </div>
        )}

        {/* Rules list — tab-aware. Active uses a 2-column grid;
            Expiring / Silent / Deactivated use a single column so
            the action buttons + amber callouts have full width. The
            Templates tab renders its placeholder above and skips
            this whole block. */}
        {activeTab !== "templates" && (
          <div
            className={
              activeTab === "active" || IS_DEMO_MODE
                ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                : "flex flex-col gap-3"
            }
          >
            {tabRules.length === 0 ? (
              <div className="md:col-span-2 bg-white border border-[#E2E8F0] rounded-sm p-12 text-center text-[#64748B] text-sm">
                No rules in this view.
              </div>
            ) : (
              tabRules.map((r) => {
                const classification = classifyRule(r, now);
                const v = (r.verdict || "review").toLowerCase();
                const badge = VERDICT_BADGES[v] ?? VERDICT_BADGES.review;
                const triggers = r.trigger_count ?? 0;
                const isEditing = editingRuleId === r.id;
                const isExpiringTab = activeTab === "expiring";
                const isSilentTab = activeTab === "silent";
                const daysUntilExpiry = r.effective_until
                  ? Math.ceil(
                      (new Date(r.effective_until).getTime() - now) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;
                return (
                  <div
                    key={r.id}
                    id={`rule-${r.id}`}
                    className={`rounded-sm overflow-hidden scroll-mt-6 ${
                      isExpiringTab
                        ? "bg-[#FFFBEB] border border-[#FDE68A] border-l-[4px] border-l-[#F59E0B]"
                        : "bg-white border border-[#E2E8F0]"
                    }`}
                  >
                    <div className="px-5 py-4">
                      {/* Row 1 — badge + name + actions */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `0.5px solid ${badge.border}`,
                            }}
                            className="font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm shrink-0"
                          >
                            {badge.label}
                          </span>
                          <span className="text-sm font-semibold text-[#0D1B2A] leading-snug">
                            {r.name}
                          </span>
                        </div>
                        {classification === "active" && !isExpiringTab && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingRuleId(isEditing ? null : r.id)
                              }
                              className="font-mono text-xs px-3 py-1 rounded-sm border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(r.id, r.name)}
                              disabled={pending}
                              className="font-mono text-xs px-3 py-1 rounded-sm border border-[#E2E8F0] text-[#94A3B8] hover:border-[#FCA5A5] hover:text-[#B91C1C] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          </div>
                        )}
                        {classification === "expired" && (
                          <button
                            type="button"
                            onClick={() => setEditingRuleId(isEditing ? null : r.id)}
                            className="font-mono text-xs px-3 py-1 rounded-sm border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                          >
                            Renew
                          </button>
                        )}
                      </div>

                      {/* Description */}
                      {r.description && (
                        <p className="text-sm text-[#475569] leading-relaxed mb-3">
                          {r.description}
                        </p>
                      )}

                      {/* Keywords */}
                      {r.keywords && r.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {r.keywords.slice(0, 6).map((kw) => (
                            <span
                              key={kw}
                              className="font-mono text-[10px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
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
                      <div className="font-mono text-[10px] text-[#94A3B8] flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{statusPrefix(r, classification)}</span>
                        {r.scope && (
                          <>
                            <span className="text-[#E5E7EB]" aria-hidden>·</span>
                            <span>{scopeLabel(r.scope)}</span>
                          </>
                        )}
                        {r.wsp_reference && (
                          <>
                            <span className="text-[#E5E7EB]" aria-hidden>·</span>
                            <span className="text-[#4F46E5]">{r.wsp_reference}</span>
                          </>
                        )}
                        {!IS_DEMO_MODE && r.authorized_by && (
                          <>
                            <span className="text-[#E5E7EB]" aria-hidden>·</span>
                            <span>Authorized by {r.authorized_by}</span>
                          </>
                        )}
                      </div>

                      {/* Expiring tab — amber timeline + advisory + actions */}
                      {isExpiringTab && r.effective_until && (
                        <>
                          <div className="font-mono text-xs text-[#B45309] mt-3 mb-1">
                            Expires{" "}
                            {new Date(r.effective_until).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                            {daysUntilExpiry !== null && (
                              <>
                                {" · "}
                                {daysUntilExpiry} day
                                {daysUntilExpiry !== 1 ? "s" : ""} remaining
                              </>
                            )}
                          </div>
                          {triggers > 0 && (
                            <div className="font-mono text-[10px] text-[#B45309] mb-3">
                              {triggers} trigger{triggers !== 1 ? "s" : ""} ·
                              actively firing
                            </div>
                          )}
                          <p className="text-xs italic text-[#92400E] mb-3 leading-relaxed">
                            {triggers > 0
                              ? "Most-fired rule. Extend if the window continues. Let expire if not — team posts will be unprotected after expiry."
                              : "No triggers recorded. Consider whether this window is still needed."}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleExtendRule(r.id)}
                              className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#4338CA] transition-colors cursor-pointer"
                            >
                              Extend window
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCloneRule()}
                              className="bg-white text-[#475569] font-mono text-xs font-medium px-4 py-2 rounded-sm border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                            >
                              Clone for next period
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(r.id, r.name)}
                              disabled={pending}
                              className="bg-white text-[#64748B] font-mono text-xs px-4 py-2 rounded-sm border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Let expire
                            </button>
                          </div>
                        </>
                      )}

                      {/* Silent tab — drift footer line */}
                      {isSilentTab && (
                        <div className="font-mono text-[10px] text-[#B45309] mt-2">
                          ⊘ Never fired · review keywords or deactivate
                        </div>
                      )}

                      {/* Default trigger / freshness footer for non-
                          expiring tabs (Active / Silent / Demo) */}
                      {!isExpiringTab && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {triggers > 0 && (
                            <div className="font-mono text-[10px] text-[#64748B]">
                              {triggers} trigger
                              {triggers !== 1 ? "s" : ""}
                              {r.effectiveness_score !== null &&
                                r.effectiveness_score !== undefined && (
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
                          {classification === "deactivated" &&
                            r.deactivated_reason &&
                            r.deactivated_reason.trim().toLowerCase() !==
                              "test" && (
                              <div className="font-mono text-[10px] text-[#64748B]">
                                Reason: {r.deactivated_reason}
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    {/* Inline edit panel */}
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
        )}

        {/* WSP callout — closes the page by reframing the rules above
            as enforcement of the firm's existing supervisory
            procedures. The icon was dropped; the title carries the
            framing on its own and the FINRA-examiner anchor lands
            harder without a glyph competing for attention. */}
        <div className="mt-6 border border-[#E2E8F0] rounded-sm p-4 bg-[#F8F9FB]">
          <div className="text-sm font-semibold text-[#0D1B2A] mb-1">
            Rules reference your existing compliance policies.
          </div>
          <div className="text-sm text-[#64748B] leading-relaxed">
            When you add or edit a rule, include the section of your Written
            Supervisory Procedures (WSP) or compliance manual that it
            enforces. This creates an auditable link between your documented
            policies and ERA CUE&apos;s enforcement — exactly what FINRA
            examiners look for.
          </div>
        </div>
      </div>

      {/* MOAT bar — fixed-bottom strip that frames the page as a
          single node in the broader Governance Memory Graph. Renders
          on every managing-view session; the main wrapper carries
          pb-16 so the bar never overlaps the WSP callout. */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0D1B2A] border-t border-white/[0.08] px-6 py-3 flex items-center gap-3 z-10">
        <span className="font-mono text-[10px] font-bold text-[#0EA5E9] uppercase tracking-[0.12em] shrink-0">
          MOAT
        </span>
        <span className="font-mono text-[10px] text-white/[0.50] leading-relaxed">
          Governance Memory Graph · Every rule authorization is a
          node. Every trigger is an edge. Calibration signals
          compound over time — competitors starting today have none.
        </span>
      </div>
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
          className="mt-1 w-4 h-4 accent-[#4F46E5] cursor-pointer shrink-0"
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
            <span className="text-sm font-semibold text-[#0D1B2A]">{rule.name}</span>
          </div>
          <div className="text-sm text-[#475569] mb-2">{rule.description}</div>
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
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
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
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none"
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
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
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
                  className="font-mono text-[10px] bg-white text-[#475569] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
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
          className="border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
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
            className="flex-1 border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#4F46E5] placeholder:text-[#94A3B8]"
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
          className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
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
          className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors px-2 py-2.5 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
