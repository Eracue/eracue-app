"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SetupRulesPanel } from "./SetupRulesPanel";
import { deactivateRuleAction, deleteDraftRuleAction } from "./actions";
import { saveRuleUpdates, type RuleUpdates } from "./update-rule-action";
import {
  TEMPLATES,
  FIRM_TYPE_BUTTONS,
  templatesFor,
} from "./templates";

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

// Six-way tab state for the managing view. Active is the default
// landing tab; Expiring lights up amber when a rule sits inside
// the 60-day window; Silent flags rules that have never fired
// (drift signal); Drafts holds rules saved-but-not-authorized;
// Deactivated bucket keeps the inactive rules out of the way;
// History is the full immutable audit list of every rule.
type RulesTab =
  | "active"
  | "expiring"
  | "silent"
  | "drafts"
  | "deactivated"
  | "history";

// Policy-reference label vocabulary varies by firm type. Broker-
// dealers and investment banks use WSPs; RIAs use a compliance
// manual; public companies have a disclosure policy; PR agencies
// and exec teams just call it a policy. The constants below are
// surfaced in the rule-card status line + the EditRulePanel input
// so the field reads in the visitor's own vocabulary.
const POLICY_LABEL: Record<string, string> = {
  broker_dealer: "WSP reference",
  ria: "Compliance policy reference",
  public_company: "Disclosure policy reference",
  pr_agency: "Policy reference",
  executive_team: "Policy reference",
  investment_bank: "WSP reference",
  default: "Policy reference",
};

// Short label used inline on rule-card status lines (where space
// is tight). The longer POLICY_LABEL above goes on form labels.
const POLICY_LABEL_SHORT: Record<string, string> = {
  broker_dealer: "WSP",
  ria: "Compliance ref",
  public_company: "Disclosure ref",
  pr_agency: "Policy ref",
  executive_team: "Policy ref",
  investment_bank: "WSP",
  default: "Policy ref",
};

const POLICY_PLACEHOLDER: Record<string, string> = {
  broker_dealer: "e.g. WSP §4.3 — Social Media Supervision",
  ria: "e.g. Compliance Manual §2.1 — Marketing",
  public_company: "e.g. Disclosure Policy §3 — Quiet Periods",
  pr_agency: "e.g. Client Comms Policy — Competitor Mentions",
  executive_team: "e.g. AI Usage Policy — External Communications",
  investment_bank: "e.g. WSP §7.2 — Deal Communications",
  default: "e.g. Policy name and section (optional)",
};

// Resolve a firm-type slug to its policy-reference vocabulary.
// Falls back to the generic "Policy reference" copy when the
// firm type isn't one of the seeded buckets. Exported for the
// SetupRulesPanel form labels and the EditRulePanel input.
export function policyLabelFor(firmType: string | null | undefined): string {
  if (!firmType) return POLICY_LABEL.default;
  return POLICY_LABEL[firmType] ?? POLICY_LABEL.default;
}

function policyLabelShortFor(firmType: string | null | undefined): string {
  if (!firmType) return POLICY_LABEL_SHORT.default;
  return POLICY_LABEL_SHORT[firmType] ?? POLICY_LABEL_SHORT.default;
}

export function policyPlaceholderFor(
  firmType: string | null | undefined,
): string {
  if (!firmType) return POLICY_PLACEHOLDER.default;
  return POLICY_PLACEHOLDER[firmType] ?? POLICY_PLACEHOLDER.default;
}

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

export function RulesClient({ rules, firmType = null }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?activated=true` is set by the /rules/confirm redirect. Both the
  // initial view and the success-banner toggle key off this param so a
  // visitor lands directly on managing-with-banner instead of flashing
  // the setup view first.
  const activatedFromConfirm = searchParams.get("activated") === "true";

  const [activeTab, setActiveTab] = useState<RulesTab>("active");
  // Setup panel state — single toggle that opens SetupRulesPanel above
  // the tab bar. Replaces the old "Add a rule" + "Import policies"
  // pair with one entry point.
  const [showSetupPanel, setShowSetupPanel] = useState(false);
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

  // Setup-view confirmed-set: pre-filled with every template index so
  // the first-time-visitor's cards land already checked. Only used by
  // the setup view path; the managing view delegates to SetupRulesPanel.
  const [confirmed, setConfirmed] = useState<Set<number>>(() => {
    const defaults = templatesFor(firmType);
    return new Set(defaults.map((_, i) => i));
  });
  // Post-authorization success state. Triggered by the /rules/confirm
  // redirect when the URL carries `?activated=true`. Powers the green
  // success banner with the "Check your first draft →" CTA + "Add
  // more rules" secondary.
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
  // show the EditRulePanel instead of opening the SetupRulesPanel.
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);


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
        return days <= 60 && days > 0;
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

  // Drafts = rules with rule_status === "draft" — saved but not yet
  // authorized by a named principal. They never fire until promoted.
  const draftRules = useMemo(() => {
    return rules.filter((r) => r.rule_status === "draft");
  }, [rules]);

  // Pick the rules to render based on the active tab. Demo mode
  // pins to the four curated rules regardless of tab so the visitor
  // never lands on an empty Expiring / Silent / Deactivated view.
  const tabRules: RuleRow[] = useMemo(() => {
    if (IS_DEMO_MODE) return demoRules;
    if (activeTab === "active") return activeRules;
    if (activeTab === "expiring") return expiringRules;
    if (activeTab === "silent") return silentRules;
    if (activeTab === "drafts") return draftRules;
    if (activeTab === "deactivated") return deactivatedRules;
    return []; // history tab — content renders inline
  }, [
    activeTab,
    demoRules,
    activeRules,
    expiringRules,
    silentRules,
    draftRules,
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
    // For now opens the setup panel with a clean slate. The full
    // clone-with-prefilled-data flow is a follow-up.
    setShowSetupPanel(true);
  }

  // Drafts tab: promote a draft rule to active. Reuses
  // saveRuleUpdates so the edit happens in the same code path
  // as inline-edit re-authorization.
  async function handleAuthorizeDraft(id: string) {
    const result = await saveRuleUpdates(id, { rule_status: "active" });
    if (result.ok) router.refresh();
  }

  // Drafts tab: hard-delete an unauthorized rule. The action
  // refuses to delete anything that isn't already in draft status,
  // so authorized rules stay protected by the audit trail.
  async function handleDeleteDraft(id: string) {
    const ok = window.confirm(
      "Delete this draft rule? It has not been authorized and will be permanently removed.",
    );
    if (!ok) return;
    const result = await deleteDraftRuleAction(id);
    if (result.ok) router.refresh();
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
                setShowSetupPanel(true);
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

        <SetupRulesPanel
          isOpen={showSetupPanel || editingRule !== null}
          firmType={firmType}
          onClose={() => {
            setShowSetupPanel(false);
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
            className="text-3xl font-light text-[#0D1B2A] mb-3 leading-tight"
          >
            {IS_DEMO_MODE
              ? "Your rules. Your authority. Enforced at submission."
              : counts.active > 0
                ? `${counts.active} rule${counts.active !== 1 ? "s" : ""} governing your team's communications.`
                : "Configure your governance rules."}
          </h1>
          <p className="text-sm text-[#475569] leading-relaxed max-w-2xl">
            {IS_DEMO_MODE
              ? "ERA CUE checks every draft against these rules before publication."
              : counts.active > 0
                ? "Every draft your team submits is checked against these rules before publication."
                : "ERA CUE checks every draft against your active rules. Set up your governance policies before checking any draft."}
          </p>
        </div>

        {/* ACTION BAR — single "Set up rules" toggle on the left
            (opens SetupRulesPanel with three-path picker) and the
            "Check a draft →" link on the right when at least one
            rule is active. */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowSetupPanel((s) => !s)}
            className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] transition-colors flex items-center gap-2 cursor-pointer"
          >
            {showSetupPanel ? "× Close" : "+ Set up rules"}
          </button>

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
        <SetupRulesPanel
          isOpen={showSetupPanel || editingRule !== null}
          firmType={firmType}
          onClose={() => {
            setShowSetupPanel(false);
            setEditingRule(null);
          }}
        />


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
              ERA CUE checks every draft against your active rules
              and prior approved statements.
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
                  key: "drafts" as const,
                  label: "Drafts",
                  count: draftRules.length,
                  alert: false,
                },
                {
                  key: "deactivated" as const,
                  label: "Deactivated",
                  count: deactivatedRules.length,
                  alert: false,
                },
                {
                  key: "history" as const,
                  label: "History",
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

        {/* Drafts tab — empty state, then a custom card layout with
            Authorize / Edit / Delete buttons per row. Replaces the
            generic rule-card layout so the lifecycle CTAs read as
            the primary action on this surface. */}
        {!IS_DEMO_MODE && activeTab === "drafts" && (
          <>
            {draftRules.length === 0 ? (
              <div className="text-center py-16">
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] mb-2">
                  No draft rules
                </div>
                <p className="text-sm text-[#64748B]">
                  Rules saved without authorization appear here. Use
                  &ldquo;Set up rules&rdquo; above to create a draft.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {draftRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="border border-[#E2E8F0] border-l-[4px] border-l-[#94A3B8] rounded-lg p-5 bg-white"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-sm bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                          Draft
                        </span>
                        <span className="text-sm font-medium text-[#0D1B2A]">
                          {rule.name}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleAuthorizeDraft(rule.id)}
                          className="bg-[#4F46E5] text-white font-mono text-xs font-medium px-3 py-1.5 rounded-sm hover:bg-[#4338CA] transition-colors cursor-pointer"
                        >
                          Authorize →
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRuleId(rule.id)}
                          className="font-mono text-xs px-3 py-1.5 rounded-sm border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(rule.id)}
                          className="font-mono text-xs px-3 py-1.5 rounded-sm border border-[#E2E8F0] text-[#94A3B8] hover:text-[#B91C1C] hover:border-[#FECACA] transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-[#475569] mb-2 leading-relaxed">
                        {rule.description}
                      </p>
                    )}
                    <div className="font-mono text-[9px] text-[#94A3B8]">
                      Not active · Will not fire until authorized by a
                      named principal
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* History tab — every rule the org has authored, in
            authorization order, with status pill on the right. The
            footer note frames the list as the immutable audit trail
            backing every rule decision. */}
        {!IS_DEMO_MODE && activeTab === "history" && (
          <>
            {rules.length === 0 ? (
              <div className="text-center py-16">
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] mb-2">
                  No history yet
                </div>
                <p className="text-sm text-[#64748B]">
                  Authorized rules will appear here in chronological
                  order.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-0 divide-y divide-[#E2E8F0]">
                  {[...rules]
                    .sort((a, b) => {
                      const ta = a.effective_from
                        ? new Date(a.effective_from).getTime()
                        : 0;
                      const tb = b.effective_from
                        ? new Date(b.effective_from).getTime()
                        : 0;
                      return tb - ta;
                    })
                    .map((rule) => {
                      const v = (rule.verdict || "review").toLowerCase();
                      const badge =
                        VERDICT_BADGES[v] ?? VERDICT_BADGES.review;
                      const status = rule.rule_status ?? "active";
                      const statusClass =
                        status === "active"
                          ? "text-[#0EA5E9] bg-[#E0F2FE]"
                          : status === "draft"
                            ? "text-[#64748B] bg-[#F1F5F9]"
                            : "text-[#94A3B8] bg-[#F8FAFC]";
                      return (
                        <div
                          key={rule.id}
                          className="py-4 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
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
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#0D1B2A] truncate">
                                {rule.name}
                              </div>
                              <div className="font-mono text-[9px] text-[#94A3B8]">
                                {rule.effective_from
                                  ? new Date(
                                      rule.effective_from,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "No authorization date"}
                                {!IS_DEMO_MODE && rule.authorized_by && (
                                  <span> · {rule.authorized_by}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded-sm ${statusClass}`}
                            >
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="font-mono text-[9px] text-[#94A3B8] text-center pt-6 mt-6 border-t border-[#E2E8F0]">
                  Every rule authorization is recorded with principal
                  identity, timestamp, and SHA-256 hash. This history
                  cannot be altered.
                </div>
              </>
            )}
          </>
        )}

        {/* Demo label — single muted sentence above the rules list,
            demo mode only. Real users get a clean tab-only interface
            (no labeled separator — the tab title is the label). */}
        {IS_DEMO_MODE && (
          <div className="font-mono text-[10px] text-[#94A3B8] mb-5 pb-4 border-b border-[#E2E8F0]">
            Demo rules — live data from a sample organization.
          </div>
        )}

        {/* Rules list — tab-aware. Active uses a 2-column grid;
            Expiring / Silent / Deactivated use a single column so
            the action buttons + amber callouts have full width. The
            Templates tab renders its placeholder above and skips
            this whole block. */}
        {activeTab !== "history" && activeTab !== "drafts" && (
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
                            <span className="text-[#4F46E5]">
                              {policyLabelShortFor(firmType)}: {r.wsp_reference}
                            </span>
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

      </div>

      {/* MOAT bar — fixed-bottom strip that frames the page as a
          single node in the broader Governance Memory Graph. The
          main wrapper carries pb-16 so the bar never overlaps the
          last rule card or the History tab footer note. */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0D1B2A] border-t border-white/[0.08] px-6 py-3 flex items-center gap-3 z-20">
        <span className="font-mono text-[9px] font-bold text-[#0EA5E9] uppercase tracking-[0.14em] shrink-0">
          MOAT
        </span>
        <span className="font-mono text-[9px] text-white/[0.42] leading-relaxed">
          Governance Memory Graph · Every rule authorization is a
          node. Every trigger is an edge. Calibration compounds
          over time — competitors starting today have none.
        </span>
      </div>
    </main>
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
    <div className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
      {/* Versioning warning — saving an edit creates a new authorized
          version; the prior version stays in the audit trail. The
          banner makes that explicit so a principal doesn't think they
          can quietly tweak a live rule. */}
      <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-5 py-3 flex items-start gap-3">
        <span className="text-[#B45309] text-sm shrink-0" aria-hidden>
          ⚠
        </span>
        <div className="text-xs text-[#92400E] leading-relaxed">
          <strong>This rule is currently active.</strong> Changes
          require re-authorization. Every edit creates a versioned
          audit record — the prior version remains accessible.
        </div>
      </div>
      <div className="px-5 py-5">
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
            "Re-authorize →"
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
    </div>
  );
}
