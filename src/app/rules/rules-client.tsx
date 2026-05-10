"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createRuleAction,
  deactivateRuleAction,
  deleteDraftRuleAction,
  deleteRuleAction,
  draftRuleAction,
  reactivateRuleAction,
  updateRuleAction,
} from "./actions";
import type { DraftedRule } from "./actions";

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

// Policy-reference vocabulary still consumed by the legacy
// SetupRulesPanel (no longer rendered by this client, but kept in the
// tree so its imports don't break). Re-exported here as a thin shim.
const POLICY_LABEL: Record<string, string> = {
  broker_dealer: "WSP reference",
  ria: "Compliance policy reference",
  public_company: "Disclosure policy reference",
  pr_agency: "Policy reference",
  executive_team: "Policy reference",
  investment_bank: "WSP reference",
  default: "Policy reference",
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

export function policyLabelFor(firmType: string | null | undefined): string {
  if (!firmType) return POLICY_LABEL.default;
  return POLICY_LABEL[firmType] ?? POLICY_LABEL.default;
}

export function policyPlaceholderFor(
  firmType: string | null | undefined,
): string {
  if (!firmType) return POLICY_PLACEHOLDER.default;
  return POLICY_PLACEHOLDER[firmType] ?? POLICY_PLACEHOLDER.default;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Lifecycle status — the primary status badge per R2. Computed from
// rule_status + dates + trigger count + age. DEACTIVATED renders with
// the SILENT style per spec.
type LifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SILENT"
  | "EXPIRING"
  | "DEACTIVATED";

function classifyLifecycle(r: RuleRow, now: number): LifecycleStatus {
  if (r.rule_status === "draft") return "DRAFT";
  if (r.rule_status === "deactivated") return "DEACTIVATED";

  // Expired effective_until → render as DEACTIVATED (the rule no longer
  // fires; the End-date-passed branch of the lifecycle).
  const toTime = r.effective_until ? new Date(r.effective_until).getTime() : null;
  if (toTime !== null && now > toTime) return "DEACTIVATED";

  // EXPIRING: active AND effective_until is within 60 days
  if (toTime !== null) {
    const daysUntil = Math.ceil((toTime - now) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 60 && daysUntil > 0) return "EXPIRING";
  }

  // SILENT: active AND zero triggers AND active for >= 30 days
  const fromTime = r.effective_from ? new Date(r.effective_from).getTime() : null;
  if (fromTime !== null) {
    const daysSinceFrom = Math.floor((now - fromTime) / (1000 * 60 * 60 * 24));
    if ((r.trigger_count ?? 0) === 0 && daysSinceFrom >= 30) return "SILENT";
  }

  return "ACTIVE";
}

function statusBadgeClass(status: LifecycleStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-[#0EA5E9] text-white";
    case "SILENT":
      return "bg-[#334155] text-[#94A3B8]";
    case "DEACTIVATED":
      // Per spec: "DEACTIVATED still needs to render somehow — match the SILENT style"
      return "bg-[#334155] text-[#94A3B8]";
    case "EXPIRING":
      return "bg-[#F59E0B] text-white";
    case "DRAFT":
      return "bg-[#1E293B] text-[#64748B] border border-dashed border-[#334155]";
  }
}

// C3 — derived lifecycle pill state. Maps the existing 5-state badge
// classification onto the spec's narrative lifecycle:
//   draft → (pill omitted; the DRAFT status badge already says it)
//   active + 0 triggers           → "Authorized"
//   active + ≥1 trigger           → "Firing"
//   silent (≥30d, 0 triggers)     → "Silent"
//   expiring (≤60d to expiry)     → "Expiring"
//   deactivated                   → "Deactivated"
type LifecyclePill =
  | "Authorized"
  | "Firing"
  | "Silent"
  | "Expiring"
  | "Deactivated";

function lifecyclePillFor(
  rule: RuleRow,
  status: LifecycleStatus,
): LifecyclePill | null {
  if (status === "DRAFT") return null;
  if (status === "DEACTIVATED") return "Deactivated";
  if (status === "EXPIRING") return "Expiring";
  if (status === "SILENT") return "Silent";
  // ACTIVE
  return (rule.trigger_count ?? 0) > 0 ? "Firing" : "Authorized";
}

function lifecyclePillClass(state: LifecyclePill): string {
  switch (state) {
    case "Authorized":
      return "bg-[#0EA5E9]/10 text-[#0EA5E9]";
    case "Firing":
      return "bg-green-100 text-green-700";
    case "Silent":
      return "bg-yellow-100 text-yellow-700";
    case "Expiring":
      return "bg-orange-100 text-orange-700";
    case "Deactivated":
      return "bg-[#334155] text-[#94A3B8]";
  }
}

type Props = {
  rules: RuleRow[];
  corpusCount?: number;
  firmType?: string | null;
  corpusEarliest?: string | null;
  corpusLatest?: string | null;
};

// Demo mode. NEXT_PUBLIC_* env vars are inlined at build time so this
// const evaluates to a literal in the client bundle.
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// ---------- C1 Templates -----------------------------------------------------
// Sixteen built-in templates split across two tabs in the
// TemplateModal — eight regulated-industries templates (FINRA / SEC /
// EU AI Act) and eight coordinated-campaigns templates (governance
// patterns that don't map to a single regulator). Each carries the
// severity it should land at on creation; the Modal surfaces this as
// the BLOCK / REVIEW badge on the template card and also feeds the
// post-action confirmation panel.
type TemplateTab = "regulated" | "campaigns";
type TemplateSeverity = "BLOCK" | "REVIEW";
type BuiltInTemplate = {
  id: string;
  tab: TemplateTab;
  name: string;
  basis: string; // regulatory citation for "regulated" / use case for "campaigns"
  severity: TemplateSeverity;
  keywords: string[];
  catches: string;
  // C2 — examiner-facing one-liner. Renders italic muted below the
  // catches description on regulated templates only. Optional so
  // coordinated-campaigns templates can omit it.
  regulatorAsks?: string;
};

const BUILT_IN_TEMPLATES: ReadonlyArray<BuiltInTemplate> = [
  // ─── Regulated Industries ─────────────────────────────────────────
  {
    id: "finra_3110",
    tab: "regulated",
    name: "FINRA Rule 3110 — Principal Pre-Approval",
    basis: "FINRA Rule 3110",
    severity: "BLOCK",
    keywords: [
      "review required",
      "principal approval",
      "pre-approval needed",
      "compliance review",
      "supervisory review",
    ],
    catches:
      "communications requiring named principal sign-off before publication",
    regulatorAsks:
      "Examiner asks: who reviewed this, when, and where's the record? ERA CUE answers all three.",
  },
  {
    id: "finra_2210",
    tab: "regulated",
    name: "FINRA Rule 2210 — Retail Communication",
    basis: "FINRA Rule 2210",
    severity: "REVIEW",
    keywords: [
      "guaranteed",
      "promise",
      "assure",
      "certainty",
      "risk-free",
      "no risk",
    ],
    catches:
      "performance guarantees and prohibited claims in retail communications",
    regulatorAsks:
      "Examiner asks: was this retail communication reviewed against Rule 2210 content standards before publication? ERA CUE records the review chain.",
  },
  {
    id: "sec_marketing",
    tab: "regulated",
    name: "SEC Marketing Rule 206(4)-1 — Testimonial",
    basis: "SEC Marketing Rule 206(4)-1",
    severity: "BLOCK",
    keywords: [
      "client said",
      "testimonial",
      "endorsement",
      "customer results",
      "client review",
      "as my client",
    ],
    catches: "testimonial and endorsement language requiring disclosure",
    regulatorAsks:
      "Examiner asks: was this testimonial disclosed and pre-approved? ERA CUE records both.",
  },
  {
    id: "reg_fd",
    tab: "regulated",
    name: "Reg FD — Material Information",
    basis: "Reg FD",
    severity: "BLOCK",
    keywords: [
      "material",
      "non-public",
      "inside",
      "confidential deal",
      "not yet announced",
      "embargoed",
    ],
    catches: "material non-public information in public communications",
    regulatorAsks:
      "Examiner asks: was this material information public before it was communicated? ERA CUE records the submission timestamp.",
  },
  {
    id: "off_channel",
    tab: "regulated",
    name: "Off-Channel Prevention — SEC Rule 17a-4",
    basis: "SEC Rule 17a-4",
    severity: "BLOCK",
    keywords: [
      "WhatsApp",
      "Signal",
      "text me",
      "personal email",
      "DM me",
      "off the record",
    ],
    catches: "requests to move communications to unarchived channels",
    regulatorAsks:
      "Examiner asks: are all governed communications captured and retrievable? ERA CUE records every submission against a managed channel.",
  },
  {
    id: "ia_quiet_period",
    tab: "regulated",
    name: "Investment Adviser Quiet Period",
    basis: "Investment Advisers Act of 1940",
    severity: "BLOCK",
    keywords: [
      "raising",
      "fundraising",
      "investors",
      "capital raise",
      "new fund",
      "closing our round",
    ],
    catches: "fundraising language during restricted windows",
    regulatorAsks:
      "Examiner asks: did this fundraising-period communication clear pre-publication review? ERA CUE records the rule check and the timestamp.",
  },
  {
    id: "earnings_quiet",
    tab: "regulated",
    name: "Public Company Earnings Quiet Period",
    basis: "SEC Reg FD · disclosure controls",
    severity: "BLOCK",
    keywords: [
      "revenue",
      "guidance",
      "outlook",
      "expects",
      "projects",
      "anticipates",
      "beat",
      "miss",
    ],
    catches:
      "forward guidance and earnings language during quiet periods",
    regulatorAsks:
      "Examiner asks: was forward guidance issued during the earnings quiet period? ERA CUE records each submission against the active window.",
  },
  {
    id: "eu_ai_act_50",
    tab: "regulated",
    name: "EU AI Act Article 50 — AI Origin",
    basis: "EU AI Act Article 50",
    severity: "REVIEW",
    keywords: [
      "AI wrote",
      "generated by",
      "drafted by AI",
      "created by AI",
      "ChatGPT wrote",
      "Claude wrote",
    ],
    catches: "AI-generated content requiring declared origin",
    regulatorAsks:
      "Regulator asks: was AI involvement declared and reviewed by a human? ERA CUE records both.",
  },

  // ─── Coordinated Campaigns ─────────────────────────────────────────
  {
    id: "fundraising_quiet",
    tab: "campaigns",
    name: "Fundraising Quiet Period",
    basis: "Coordinated campaign — fundraising window",
    severity: "BLOCK",
    keywords: [
      "hiring",
      "expanding",
      "growth",
      "raising",
      "investors",
      "fundraising",
      "series",
      "round",
    ],
    catches: "hiring and growth language during fundraising quiet periods",
  },
  {
    id: "product_launch_embargo",
    tab: "campaigns",
    name: "Product Launch Embargo",
    basis: "Coordinated campaign — product embargo",
    severity: "BLOCK",
    keywords: [
      "launching",
      "new product",
      "announcing",
      "release date",
      "shipping",
      "going live",
    ],
    catches:
      "premature product announcement language before embargo lift",
  },
  {
    id: "competitor_review",
    tab: "campaigns",
    name: "Competitor Mention Review",
    basis: "Coordinated campaign — competitive language",
    severity: "REVIEW",
    keywords: [
      "our competitor",
      "unlike competitors",
      "better than",
      "no competitor can",
      "outperforms",
      "competitor",
    ],
    catches: "direct competitor references requiring review",
  },
  {
    id: "pricing_review",
    tab: "campaigns",
    name: "Pricing Claim Review",
    basis: "Coordinated campaign — pricing consistency",
    severity: "REVIEW",
    keywords: [
      "lowest price",
      "best price",
      "most affordable",
      "cheapest",
      "industry-leading price",
      "unbeatable",
    ],
    catches: "pricing claims requiring consistency review",
  },
  {
    id: "exec_alignment",
    tab: "campaigns",
    name: "Executive Spokesperson Alignment",
    basis: "Coordinated campaign — message ownership",
    severity: "REVIEW",
    keywords: [
      "I decided",
      "my decision",
      "I announced",
      "I signed",
      "I approved",
      "my team",
    ],
    catches:
      "individual ownership language that may conflict with org-level messaging",
  },
  {
    id: "press_social_consistency",
    tab: "campaigns",
    name: "Press Release vs Social Consistency",
    basis: "Coordinated campaign — cross-channel consistency",
    severity: "REVIEW",
    keywords: [
      "as stated in our release",
      "per our announcement",
      "our press release says",
    ],
    catches:
      "cross-channel references that may create inconsistencies",
  },
  {
    id: "multi_speaker_alignment",
    tab: "campaigns",
    name: "Multi-Speaker Message Alignment",
    basis: "Coordinated campaign — collective claims",
    severity: "REVIEW",
    keywords: [
      "we all agree",
      "the team believes",
      "everyone on our team",
      "across our organization",
    ],
    catches:
      "collective claims requiring cross-speaker consistency check",
  },
  {
    id: "agency_brand_voice",
    tab: "campaigns",
    name: "Client Brand Voice — Agency Use",
    basis: "Coordinated campaign — agency-managed accounts",
    severity: "REVIEW",
    keywords: [
      "our brand",
      "brand voice",
      "brand guidelines",
      "on-brand",
      "off-brand",
    ],
    catches: "brand voice deviations in agency-managed accounts",
  },
];

// Stopword list for the Paste Policy keyword extractor. Conservative —
// covers the common English filler that drowns out signal words.
const STOPWORDS: ReadonlySet<string> = new Set([
  "this", "that", "these", "those", "with", "from", "into", "your", "their",
  "there", "where", "which", "what", "when", "have", "will", "would", "could",
  "should", "they", "them", "then", "than", "also", "must", "been", "such",
  "shall", "while", "after", "before", "about", "above", "below", "under",
  "between", "during", "every", "other", "some", "more", "most", "many",
  "much", "very", "only", "even", "just", "still", "first", "last", "each",
  "both", "either", "neither", "without", "within", "through", "against",
  "among", "across", "upon", "because", "however", "therefore", "though",
  "unless", "until", "since",
]);

function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k);
}

// Stub PDF/DOCX parser — we can't reliably parse these in-browser, so
// derive keywords from the filename plus a small canonical set.
function extractKeywordsFromFilename(filename: string): string[] {
  const base = filename.replace(/\.[^.]+$/, "");
  const tokens = base
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  const canonical = ["policy", "compliance", "review"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...tokens, ...canonical]) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 12);
}

export function RulesClient({
  rules,
  corpusCount = 0,
  corpusEarliest = null,
  corpusLatest = null,
}: Props) {
  // Corpus props are still on the page → component contract for
  // forward compatibility, but the rules-page UI no longer renders
  // them (Governance Memory moved to /dashboard). Reference here so
  // unused-prop lint doesn't flag them.
  void corpusCount;
  void corpusEarliest;
  void corpusLatest;
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?activated=true` is set by the /rules/confirm redirect.
  const activatedFromConfirm = searchParams.get("activated") === "true";

  const [activeTab, setActiveTab] = useState<RulesTab>("active");
  const [pending, startTransition] = useTransition();

  // R3 modal toggles — the chooser surfaces (popover + setup grid)
  // expose four entry points: template / upload / describe / suggest.
  // The legacy "paste" and "build" types are still in the union so
  // older deep-links / triggers can still mount those modals; they
  // just aren't reachable from the new chooser.
  const [openModal, setOpenModal] = useState<
    | "template"
    | "paste"
    | "upload"
    | "build"
    | "describe"
    | "suggest"
    | null
  >(null);

  // "+ Add a rule" dropdown — opens a small popover with the four
  // chooser entry-points (Template / Upload document / Describe it /
  // ERA CUE suggests). Click-outside handling lives in the dropdown
  // component below.
  const [addRuleDropdownOpen, setAddRuleDropdownOpen] = useState(false);

  // V2 — id of the rule whose inline edit panel is open (null = closed).
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  // V3 — id of the rule whose deactivate confirmation strip is open.
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<
    string | null
  >(null);

  // FIX 2 — id of the rule whose hard-delete confirmation strip is
  // open. Mirrors confirmingDeactivateId; opening one closes the
  // other (and the inline edit panel) so only one row is mid-action
  // at a time.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<
    string | null
  >(null);

  // V4 — newly created rule id; row gets a 3s teal highlight before
  // settling back to default styling.
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(
    null,
  );

  // "Review and confirm ruleset" full-screen modal. Triggered by the
  // "Review all rules →" button below the rules table. Two render
  // modes: the rules-list view (default) and the post-confirm success
  // panel. Closing always resets both — every reopen starts fresh.
  const [reviewOpen, setReviewOpen] = useState(false);

  // V4 — optimistic rule rows appended to the table when the live
  // refresh can't surface a freshly-created rule (demo mode mostly).
  // Rendered with a "Demo — session only" chip.
  const [optimisticRules, setOptimisticRules] = useState<RuleRow[]>([]);

  // V7 — bottom-right toast queue (success or error). Auto-dismisses
  // after 3s. Used by the inline edit panel, deactivate strip, and
  // reactivate flow to confirm what just happened.
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  function showToast(
    message: string,
    tone: "success" | "error" = "success",
  ): void {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3000);
  }

  // Mobile-only per-row "Show details" toggle. The desktop table
  // shows every column at once; mobile collapses to two columns
  // (name + actions) and reveals the rest inline on toggle.
  const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(
    new Set(),
  );

  // Post-authorization success state.
  const [justAuthorized, setJustAuthorized] = useState(activatedFromConfirm);

  function clearActivated() {
    setJustAuthorized(false);
    if (activatedFromConfirm) {
      router.replace("/rules");
    }
  }

  const now = Date.now();

  // V4 — merge optimistic rows into the source list so freshly-created
  // rules render immediately, even when the underlying refresh hasn't
  // surfaced them yet (demo mode, or a delayed write). Optimistic ids
  // that show up in the real `rules` payload are dropped automatically
  // so we never double-count.
  const mergedRules = useMemo(() => {
    if (optimisticRules.length === 0) return rules;
    const realIds = new Set(rules.map((r) => r.id));
    const stillPending = optimisticRules.filter((r) => !realIds.has(r.id));
    return [...rules, ...stillPending];
  }, [rules, optimisticRules]);

  const optimisticIds = useMemo(() => {
    const realIds = new Set(rules.map((r) => r.id));
    return new Set(
      optimisticRules.filter((r) => !realIds.has(r.id)).map((r) => r.id),
    );
  }, [rules, optimisticRules]);

  const classified = useMemo(() => {
    return mergedRules.map((r) => ({
      rule: r,
      status: classifyLifecycle(r, now),
    }));
  }, [mergedRules, now]);

  const counts = useMemo(() => {
    let active = 0,
      expiring = 0,
      silent = 0,
      draft = 0,
      deactivated = 0;
    for (const { status } of classified) {
      if (status === "ACTIVE") active++;
      else if (status === "EXPIRING") expiring++;
      else if (status === "SILENT") silent++;
      else if (status === "DRAFT") draft++;
      else if (status === "DEACTIVATED") deactivated++;
    }
    return {
      total: mergedRules.length,
      active,
      expiring,
      silent,
      draft,
      deactivated,
    };
  }, [classified, mergedRules.length]);

  // Demo list — every rule from the DB except DEACTIVATED/DRAFT, in
  // the query's natural (oldest-first) order so newly-created rules
  // surface at the bottom of the table.
  const demoRules = useMemo(() => {
    return classified
      .filter(({ status }) => status !== "DEACTIVATED" && status !== "DRAFT")
      .map(({ rule }) => rule);
  }, [classified]);

  const activeRules = useMemo(
    () =>
      classified.filter(({ status }) => status === "ACTIVE").map(({ rule }) => rule),
    [classified],
  );
  const expiringRules = useMemo(
    () =>
      classified
        .filter(({ status }) => status === "EXPIRING")
        .map(({ rule }) => rule),
    [classified],
  );
  const silentRules = useMemo(
    () =>
      classified
        .filter(({ status }) => status === "SILENT")
        .map(({ rule }) => rule),
    [classified],
  );

  // Every rule that's actually checking submissions right now —
  // ACTIVE + EXPIRING + SILENT. Drives the "Review all rules" modal
  // (drafts and deactivated rows are intentionally excluded from the
  // ruleset-confirmation view).
  const reviewableRules = useMemo(
    () => [...activeRules, ...expiringRules, ...silentRules],
    [activeRules, expiringRules, silentRules],
  );

  // Severity tally for the modal's summary line. Mirrors the bucket
  // logic in `ruleSeverityBadge` so the counts match what's rendered
  // on each card.
  const reviewableSeverityCounts = useMemo(() => {
    let block = 0;
    let review = 0;
    let flag = 0;
    for (const r of reviewableRules) {
      const v = (r.verdict || "").toLowerCase();
      if (v === "block") block++;
      else if (v === "review" || v === "escalate") review++;
      else flag++;
    }
    return { block, review, flag };
  }, [reviewableRules]);

  const draftRules = useMemo(
    () =>
      classified
        .filter(({ status }) => status === "DRAFT")
        .map(({ rule }) => rule),
    [classified],
  );
  const deactivatedRules = useMemo(
    () =>
      classified
        .filter(({ status }) => status === "DEACTIVATED")
        .map(({ rule }) => rule),
    [classified],
  );

  const tabRules: RuleRow[] = useMemo(() => {
    if (IS_DEMO_MODE) return demoRules;
    if (activeTab === "active") return activeRules;
    if (activeTab === "expiring") return expiringRules;
    if (activeTab === "silent") return silentRules;
    if (activeTab === "drafts") return draftRules;
    if (activeTab === "deactivated") return deactivatedRules;
    return [];
  }, [
    activeTab,
    demoRules,
    activeRules,
    expiringRules,
    silentRules,
    draftRules,
    deactivatedRules,
  ]);

  const totalActiveLike =
    counts.active + counts.expiring + counts.silent + counts.draft;

  // B7 — summary status bar values. `rulesActiveCount` mirrors the
  // page-header headline. `weeklyTriggerCount` is left at 0 since
  // weekly-resolution trigger data isn't loaded into this surface
  // (per spec: "use 0 if data unavailable"). `lastAuthorized` picks
  // the most recently authorized rule by `effective_from`.
  const rulesActiveCount =
    counts.active + counts.expiring + counts.silent;
  const weeklyTriggerCount: number = 0;
  const lastAuthorizedRule = useMemo(() => {
    let pick: RuleRow | null = null;
    let pickTs = -Infinity;
    for (const r of mergedRules) {
      if (!r.effective_from) continue;
      const ts = new Date(r.effective_from).getTime();
      if (Number.isFinite(ts) && ts > pickTs) {
        pickTs = ts;
        pick = r;
      }
    }
    return pick;
  }, [mergedRules]);

  // Most recent trigger across all rules — drives the page-header
  // subhead. Null when no rule has fired.
  const lastTriggeredOverall = useMemo(() => {
    let pick: string | null = null;
    let pickTs = -Infinity;
    for (const r of mergedRules) {
      if (!r.last_triggered) continue;
      const ts = new Date(r.last_triggered).getTime();
      if (Number.isFinite(ts) && ts > pickTs) {
        pickTs = ts;
        pick = r.last_triggered;
      }
    }
    return pick;
  }, [mergedRules]);

  // ---- mutations ----------------------------------------------------------

  // Post-action handlers (B1–B4). Each returns ok/error rather than
  // auto-closing the modal — the modal stays open and renders an
  // inline confirmation panel on success. `closeAndRefresh`, called
  // from the panel's "Back to rules" / close button, dismisses the
  // modal and refreshes the rule list.
  //
  // FIX 1 — success returns now carry `ruleName` and `keywordCount`
  // echoed from the input, mirroring the server-action shape.
  type CreateResult =
    | { ok: true; ruleId: string; ruleName: string; keywordCount: number }
    | { ok: false; error: string };

  function closeAndRefresh() {
    setOpenModal(null);
    router.refresh();
  }

  // V4 — record a freshly-created rule for the row-highlight pulse
  // and seed an optimistic row so the new rule shows up immediately
  // in the table.
  //
  // FIX 1 — `router.refresh()` fires here, not later on modal close,
  // so the live data starts loading the moment the action returns.
  // FIX 2 — the optimistic row fires for ANY successful save (real
  // or simulated), not just `demo-` prefixed ids. When the refresh
  // lands with the real row, the dedup logic in `mergedRules` drops
  // the optimistic entry by id match, so we never render duplicates.
  function recordNewRule(input: {
    ruleId: string;
    name: string;
    keywords: string[];
    verdict: "block" | "review";
    effective_from: string;
    effective_until: string | null;
  }): void {
    if (!input.ruleId) return;
    setHighlightedRuleId(input.ruleId);
    window.setTimeout(() => setHighlightedRuleId(null), 3000);
    const optimistic: RuleRow = {
      id: input.ruleId,
      name: input.name,
      description: null,
      verdict: input.verdict,
      keywords: input.keywords,
      effective_from: input.effective_from,
      effective_until: input.effective_until,
      scope: "all_speakers",
      rule_status: "active",
      deactivated_at: null,
      deactivated_reason: null,
      wsp_reference: null,
      trigger_count: 0,
      last_triggered: null,
      effectiveness_score: null,
      authorized_by: null,
    };
    setOptimisticRules((prev) => [...prev, optimistic]);
    router.refresh();
  }

  async function handleEnableTemplate(
    t: BuiltInTemplate,
  ): Promise<CreateResult> {
    const today = new Date().toISOString().slice(0, 10);
    const verdict: "block" | "review" =
      t.severity === "BLOCK" ? "block" : "review";
    const result = await createRuleAction({
      name: t.name,
      description: `Catches ${t.catches}.`,
      // C1 — verdict reflects the template's declared severity.
      // BLOCK templates fire a hard stop; REVIEW templates route to
      // principal review.
      verdict,
      keywords: [...t.keywords],
      scope: "all_speakers",
      effective_from: today,
      effective_until: null,
      regulatory_basis: t.basis,
      authorized_by: "",
      rule_status: "active",
    });
    if (result.ok) {
      recordNewRule({
        ruleId: result.ruleId,
        name: result.ruleName,
        keywords: [...t.keywords],
        verdict,
        effective_from: today,
        effective_until: null,
      });
      return {
        ok: true,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        keywordCount: result.keywordCount,
      };
    }
    return { ok: false, error: result.error };
  }

  async function handleCreateCustomRule(input: {
    name: string;
    keywords: string[];
    verdict: "block" | "review";
    effectiveFrom: string;
    effectiveUntil: string | null;
  }): Promise<CreateResult> {
    const result = await createRuleAction({
      name: input.name,
      description: "",
      verdict: input.verdict,
      keywords: input.keywords,
      scope: "all_speakers",
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil,
      regulatory_basis: "",
      authorized_by: "",
      rule_status: "active",
    });
    if (result.ok) {
      recordNewRule({
        ruleId: result.ruleId,
        name: result.ruleName,
        keywords: input.keywords,
        verdict: input.verdict,
        effective_from: input.effectiveFrom,
        effective_until: input.effectiveUntil,
      });
      return {
        ok: true,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        keywordCount: result.keywordCount,
      };
    }
    return { ok: false, error: result.error };
  }

  async function handleActivateExtractedRule(
    name: string,
    keywords: string[],
  ): Promise<CreateResult> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createRuleAction({
      name,
      description: "",
      verdict: "block",
      keywords,
      scope: "all_speakers",
      effective_from: today,
      effective_until: null,
      regulatory_basis: "",
      authorized_by: "",
      rule_status: "active",
    });
    if (result.ok) {
      recordNewRule({
        ruleId: result.ruleId,
        name: result.ruleName,
        keywords,
        verdict: "block",
        effective_from: today,
        effective_until: null,
      });
      return {
        ok: true,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        keywordCount: result.keywordCount,
      };
    }
    return { ok: false, error: result.error };
  }

  async function handleAuthorizeDraft(id: string) {
    const target = mergedRules.find((r) => r.id === id);
    const result = await updateRuleAction({
      ruleId: id,
      name: target?.name ?? "",
      description: target?.description ?? "",
      verdict: target?.verdict ?? "review",
      keywords: target?.keywords ?? [],
      scope: target?.scope ?? "all_speakers",
      effective_from:
        target?.effective_from ?? new Date().toISOString(),
      effective_until: target?.effective_until ?? null,
    });
    if ("success" in result) router.refresh();
  }

  async function handleDeleteDraft(id: string) {
    const ok = window.confirm(
      "Delete this draft rule? It has not been authorized and will be permanently removed.",
    );
    if (!ok) return;
    const result = await deleteDraftRuleAction(id);
    if (result.ok) router.refresh();
  }

  // V3 — inline deactivate confirmation. The confirmation strip lives
  // in RulesTable; this handler runs after the user clicks "Confirm
  // deactivate" inside that strip. On success the optimistic copy
  // (if any) is removed from `optimisticRules` so the row stops
  // rendering; on failure the toast surfaces the error.
  function handleDeactivate(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await deactivateRuleAction({
            ruleId: id,
            reason: "Deactivated by principal",
          });
          if (!result.ok) {
            showToast(
              `Could not deactivate rule — ${result.error}.`,
              "error",
            );
            resolve({ ok: false, error: result.error });
            return;
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          showToast(`Could not deactivate rule — ${message}.`, "error");
          resolve({ ok: false, error: message });
          return;
        }
        setOptimisticRules((prev) => prev.filter((r) => r.id !== id));
        setConfirmingDeactivateId(null);
        showToast(
          "Rule deactivated — no longer checking drafts. Record preserved.",
          "success",
        );
        router.refresh();
        resolve({ ok: true });
      });
    });
  }

  // V5 — reactivate a deactivated rule. Mirrors handleDeactivate.
  async function handleReactivate(id: string): Promise<void> {
    try {
      const result = await reactivateRuleAction({ ruleId: id });
      if (!result.ok) {
        showToast(`Could not reactivate rule — ${result.error}.`, "error");
        return;
      }
      setHighlightedRuleId(id);
      window.setTimeout(() => setHighlightedRuleId(null), 3000);
      showToast("Rule reactivated — now checking drafts.", "success");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      showToast(`Could not reactivate rule — ${message}.`, "error");
    }
  }

  // FIX 2 — hard-delete a rule that has never fired. The Delete
  // affordance only renders for trigger_count === 0, so this never
  // erases an audit chain. On success the optimistic copy (if any) is
  // dropped, the strip is closed, and a confirmation toast surfaces.
  async function handleDeleteRule(
    id: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const result = await deleteRuleAction(id);
      if (!result.ok) {
        showToast(`Could not delete rule — ${result.error}.`, "error");
        return { ok: false, error: result.error };
      }
      setOptimisticRules((prev) => prev.filter((r) => r.id !== id));
      setConfirmingDeleteId(null);
      showToast("Rule deleted — record removed.", "success");
      router.refresh();
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      showToast(`Could not delete rule — ${message}.`, "error");
      return { ok: false, error: message };
    }
  }

  // V2 — inline edit save handler. The inline panel passes the rule
  // id explicitly so this no longer depends on a sheet-level
  // `editingRule` state. On success the panel closes itself and the
  // toast confirms the update.
  async function handleSaveEdit(
    ruleId: string,
    updates: {
      name: string;
      description: string;
      verdict: string;
      keywords: string[];
      effective_from: string;
      effective_until: string | null;
    },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const target = mergedRules.find((r) => r.id === ruleId);
    const result = await updateRuleAction({
      ruleId,
      name: updates.name,
      description: updates.description,
      verdict: updates.verdict,
      keywords: updates.keywords,
      scope: target?.scope ?? "all_speakers",
      effective_from: updates.effective_from,
      effective_until: updates.effective_until,
    });
    if ("success" in result) {
      router.refresh();
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  function toggleMobileRow(id: string) {
    setExpandedMobileRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- new-user state ----------------------------------------------------
  // No active rules, no deactivated rules → fresh org. Drops the
  // tabs / status bar / MOAT bar entirely and presents the four
  // chooser paths as the primary content. Demo mode is excluded
  // because the seed always supplies rules.
  if (!IS_DEMO_MODE && totalActiveLike === 0 && counts.deactivated === 0) {
    const setupCards = ADD_RULE_CHOOSER_OPTIONS;

    return (
      <main className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-[960px] mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl md:text-4xl font-light text-[#0F172A] mb-3 leading-tight"
            >
              How do you want to add this rule?
            </h1>
            <p className="text-sm text-[#64748B] leading-relaxed max-w-2xl mx-auto">
              ERA CUE checks every draft against your active rules
              before publication. Configure once — enforced on every
              submission.
            </p>
          </div>

          {/* 2×2 chooser grid on desktop, single column on mobile.
              Each tile maps onto setOpenModal so the same chooser
              wiring drives both the new-user surface and the
              "+ Add a rule" popover above the rules table. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {setupCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setOpenModal(card.key)}
                className="bg-[#1E293B] border border-[#334155] rounded p-6 cursor-pointer hover:border-[#0EA5E9] transition-colors text-left flex flex-col min-h-[180px]"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[#F8FAFC] font-medium text-base">
                    {card.title}
                  </span>
                  {card.badge && (
                    <span className="font-mono text-[9px] uppercase tracking-widest bg-[#0EA5E9]/10 text-[#0EA5E9] border border-[#0EA5E9]/30 px-1.5 py-0.5 rounded-sm">
                      {card.badge}
                    </span>
                  )}
                </div>
                <p className="text-[#94A3B8] text-sm mt-1 leading-relaxed flex-1">
                  {card.description}
                </p>
                <div className="text-[#0EA5E9] text-right mt-3" aria-hidden>
                  →
                </div>
              </button>
            ))}
          </div>

          <p className="text-[#64748B] text-sm text-center mt-6 leading-relaxed">
            Rules you configure here are checked against every draft
            submitted by your team.
          </p>
        </div>

        {openModal === "template" && (
          <TemplateModal
            onClose={closeAndRefresh}
            onEnable={handleEnableTemplate}
          />
        )}
        {openModal === "upload" && (
          <UploadDocumentModal
            onClose={closeAndRefresh}
            onActivate={handleActivateExtractedRule}
          />
        )}
        {openModal === "describe" && (
          <DescribeRuleModal
            onClose={closeAndRefresh}
            onCreate={handleCreateCustomRule}
          />
        )}
        {openModal === "suggest" && (
          <SuggestionsModal onClose={closeAndRefresh} />
        )}
        {openModal === "paste" && (
          <PastePolicyModal
            onClose={closeAndRefresh}
            onActivate={handleActivateExtractedRule}
          />
        )}
        {openModal === "build" && (
          <BuildRuleModal
            onClose={closeAndRefresh}
            onCreate={handleCreateCustomRule}
          />
        )}
      </main>
    );
  }

  // ---- main view (returning-user, light theme, table layout) -------------
  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
        {/* CHANGE 6 — page header. Title + active count subhead on the
            left, "+ Add a rule" dropdown on the right. */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div className="min-w-0">
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl font-light text-[#0F172A] leading-tight"
            >
              Governance Rules
            </h1>
            <p className="text-sm text-[#64748B] mt-2">
              <span className="text-[#0F172A] font-medium">
                {rulesActiveCount}
              </span>{" "}
              active · Last checked:{" "}
              <span className="text-[#0F172A] font-medium">
                {lastTriggeredOverall
                  ? fmtDate(lastTriggeredOverall)
                  : "No triggers yet"}
              </span>
            </p>
          </div>
          {/* CHANGE 3 — primary "+ Add a rule" button + popover. */}
          <AddRuleDropdown
            open={addRuleDropdownOpen}
            setOpen={setAddRuleDropdownOpen}
            onSelect={(key) => {
              setOpenModal(key);
              setAddRuleDropdownOpen(false);
            }}
          />
        </div>

        {/* CHANGE 2 — status bar: three independent stat boxes. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded px-4 py-3 flex-1">
            <div className="text-[#0F172A] text-2xl font-bold">
              {rulesActiveCount}
            </div>
            <div className="text-[#64748B] text-xs uppercase tracking-widest mt-1">
              Active rules
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded px-4 py-3 flex-1">
            <div className="text-[#0F172A] text-2xl font-bold">
              {weeklyTriggerCount}
            </div>
            <div className="text-[#64748B] text-xs uppercase tracking-widest mt-1">
              Triggers this week
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded px-4 py-3 flex-1">
            <div className="text-[#0F172A] text-sm font-medium truncate">
              {lastAuthorizedRule?.name ?? "—"}
            </div>
            <div className="text-[#64748B] text-xs uppercase tracking-widest mt-1">
              Last authorized
            </div>
            {lastAuthorizedRule?.effective_from && (
              <div className="text-[#94A3B8] text-xs mt-1">
                {fmtDate(lastAuthorizedRule.effective_from)}
              </div>
            )}
          </div>
        </div>

        {/* Success banner — light-theme restyle. */}
        {!IS_DEMO_MODE && justAuthorized && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded p-5 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#0F172A] mb-1">
                  Your governance rules are live.
                </div>
                <div className="text-sm text-[#92400E]">
                  ERA CUE is now checking every draft your team submits
                  against these rules before publication.
                </div>
                <a
                  href="/check"
                  className="bg-[#0EA5E9] text-white font-mono text-sm font-medium px-4 py-2 rounded mt-4 inline-block hover:bg-[#0284C7] transition-colors"
                >
                  Check your first draft →
                </a>
              </div>
              <button
                type="button"
                onClick={clearActivated}
                aria-label="Dismiss"
                className="text-[#92400E] hover:text-[#0F172A] font-mono text-base leading-none cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Tab bar — light theme */}
        {!IS_DEMO_MODE && (
          <div className="flex gap-0 border-b border-[#E2E8F0] mb-5 overflow-x-auto">
            {(
              [
                { key: "active" as const, label: "Active", count: activeRules.length, alert: false },
                { key: "expiring" as const, label: "Expiring", count: expiringRules.length, alert: expiringRules.length > 0 },
                { key: "silent" as const, label: "Silent", count: silentRules.length, alert: false },
                { key: "drafts" as const, label: "Pending Authorization", count: draftRules.length, alert: false },
                { key: "deactivated" as const, label: "Deactivated", count: deactivatedRules.length, alert: false },
                { key: "history" as const, label: "History", count: null, alert: false },
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
                      ? "border-[#0EA5E9] text-[#0EA5E9]"
                      : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  {t.label}
                  {t.count !== null && t.count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        t.alert
                          ? "bg-[#F59E0B] text-white"
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

        {/* History tab — light theme */}
        {!IS_DEMO_MODE && activeTab === "history" && (
          <>
            {mergedRules.length === 0 ? (
              <div className="text-center py-16">
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] mb-2">
                  No history yet
                </div>
                <p className="text-sm text-[#94A3B8]">
                  Authorized rules will appear here in chronological order.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#F1F5F9]">
                  {[...mergedRules]
                    .sort((a, b) => {
                      const ta = a.effective_from ? new Date(a.effective_from).getTime() : 0;
                      const tb = b.effective_from ? new Date(b.effective_from).getTime() : 0;
                      return tb - ta;
                    })
                    .map((rule) => {
                      const status = classifyLifecycle(rule, now);
                      return (
                        <div
                          key={rule.id}
                          className="py-4 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm shrink-0 ${statusBadgeClass(status)}`}
                            >
                              {status}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#0F172A] truncate">
                                {rule.name}
                              </div>
                              <div className="font-mono text-[9px] text-[#94A3B8]">
                                {rule.effective_from ? `Authorized ${fmtDate(rule.effective_from)}` : "No authorization date"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="font-mono text-[9px] text-[#64748B] italic text-center pt-6 mt-6 border-t border-[#E2E8F0]">
                  ERA CUE records that this governance process ran. Whether
                  the communication satisfies applicable regulatory
                  requirements is a determination for qualified legal counsel.
                </div>
              </>
            )}
          </>
        )}

        {/* CHANGE 1 — Rules table. Desktop: full table; mobile (<md):
            collapsed cards with show-details toggle. */}
        {(IS_DEMO_MODE || activeTab !== "history") && (
          <RulesTable
            rules={tabRules}
            now={now}
            expandedMobileRows={expandedMobileRows}
            onToggleMobile={toggleMobileRow}
            inlineEditId={inlineEditId}
            onStartEdit={(id) => {
              setInlineEditId(id);
              setConfirmingDeactivateId(null);
              setConfirmingDeleteId(null);
            }}
            onCancelEdit={() => setInlineEditId(null)}
            onSaveEdit={handleSaveEdit}
            confirmingDeactivateId={confirmingDeactivateId}
            onStartDeactivate={(id) => {
              setConfirmingDeactivateId(id);
              setInlineEditId(null);
              setConfirmingDeleteId(null);
            }}
            onCancelDeactivate={() => setConfirmingDeactivateId(null)}
            onConfirmDeactivate={handleDeactivate}
            confirmingDeleteId={confirmingDeleteId}
            onStartDelete={(id) => {
              setConfirmingDeleteId(id);
              setInlineEditId(null);
              setConfirmingDeactivateId(null);
            }}
            onCancelDelete={() => setConfirmingDeleteId(null)}
            onConfirmDelete={handleDeleteRule}
            onReactivate={handleReactivate}
            onAuthorizeDraft={(id) => handleAuthorizeDraft(id)}
            onDeleteDraft={(id) => handleDeleteDraft(id)}
            highlightedRuleId={highlightedRuleId}
            optimisticIds={optimisticIds}
            showToast={showToast}
            onOpenModal={(key) => setOpenModal(key)}
            pending={pending}
          />
        )}
        {/* The grid of card markup that lived here was replaced by the
            <RulesTable> component above. Trigger-history expandable
            rows were removed (trigger history will live on each
            rule's detail page once that route exists). */}
        {/* Old card-grid layout was replaced by RulesTable above. */}

        {/* C3 — the standalone Rule Lifecycle section was removed.
            Each rule card now carries its own lifecycle pill (see
            lifecyclePillFor) directly below the status badge, so the
            page no longer repeats the state vocabulary in two places. */}

        {/* F1 — the standalone Message House section was removed
            from this page. It's now part of the campaign-creation
            form (E2) and surfaces a per-campaign signal on the submit
            verdict view (F2). The rules page focuses on rules. */}

        {/* AI Content Detection moved to /settings (separate page —
            doesn't belong on the rules table). Governance Memory
            moved to /dashboard (belongs with the corpus data). */}

        {/* "Review all rules →" trigger. Sits above the sticky
            BottomMoatBar so a principal can scan the full ruleset
            before signing off. Hidden when no active rules exist —
            there'd be nothing to confirm. */}
        {rulesActiveCount >= 1 && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="border border-[#0EA5E9] text-[#0EA5E9] px-4 py-2 rounded text-sm hover:bg-[#0EA5E9]/5 transition-colors cursor-pointer"
            >
              Review all rules →
            </button>
          </div>
        )}
      </div>

      <BottomMoatBar count={rulesActiveCount} />

      {/* Modals */}
      {openModal === "template" && (
        <TemplateModal
          onClose={closeAndRefresh}
          onEnable={handleEnableTemplate}
        />
      )}
      {openModal === "paste" && (
        <PastePolicyModal
          onClose={closeAndRefresh}
          onActivate={handleActivateExtractedRule}
        />
      )}
      {openModal === "upload" && (
        <UploadDocumentModal
          onClose={closeAndRefresh}
          onActivate={handleActivateExtractedRule}
        />
      )}
      {openModal === "build" && (
        <BuildRuleModal
          onClose={closeAndRefresh}
          onCreate={handleCreateCustomRule}
        />
      )}
      {openModal === "describe" && (
        <DescribeRuleModal
          onClose={closeAndRefresh}
          onCreate={handleCreateCustomRule}
        />
      )}
      {openModal === "suggest" && (
        <SuggestionsModal onClose={closeAndRefresh} />
      )}

      {/* Full-screen ruleset review + confirm flow. Independent of the
          four creation modals (template / paste / upload / build) so
          opening one doesn't conflict with the other. */}
      {reviewOpen && (
        <ReviewRulesetModal
          rules={reviewableRules}
          now={now}
          counts={reviewableSeverityCounts}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {/* V7 — Toast renderer. Sits above the BottomMoatBar (which lives
          at the bottom of the viewport at z-50); the toast offsets up
          by bottom-20 so the two never overlap. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 right-6 z-50 bg-white border rounded-lg shadow-xl px-4 py-3 max-w-sm ${
            toast.tone === "success"
              ? "border-[#BBF7D0]"
              : "border-[#FECACA]"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              aria-hidden
              className={`font-bold ${
                toast.tone === "success"
                  ? "text-[#166534]"
                  : "text-[#B91C1C]"
              }`}
            >
              {toast.tone === "success" ? "✓" : "✗"}
            </span>
            <span className="text-sm text-[#0F172A] leading-relaxed">
              {toast.message}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------- Sticky bottom info bar ----------------------------------------
//
// Persistent footer-style bar that frames what ERA CUE accumulates as
// the org's governance history grows. Renders only when the org has at
// least one active rule — the message ("calibrates over time as your
// organization builds its governance history") only resolves once
// there's a history to calibrate against.

function BottomMoatBar({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0F172A] border-t border-[#334155] px-6 py-3 flex items-center gap-3 z-50">
      <span className="font-mono text-[9px] font-bold text-[#0EA5E9] uppercase tracking-[0.14em] shrink-0">
        Governance Memory
      </span>
      <span className="text-[#94A3B8] text-sm leading-relaxed">
        Every rule authorization and trigger is recorded. ERA CUE
        calibrates over time as your organization builds its governance
        history.
      </span>
    </div>
  );
}

// ---------- CHANGE 3 — Add a rule dropdown -----------------------------------

// Chooser entries shared by the popover and the new-user setup grid.
// Single source of truth so wording and badge state can't drift
// between the two surfaces.
type AddRuleChoice = "template" | "upload" | "describe" | "suggest";

const ADD_RULE_CHOOSER_OPTIONS: ReadonlyArray<{
  key: AddRuleChoice;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    key: "template",
    title: "Template",
    description:
      "Pre-built rules cited to FINRA, SEC, EU AI Act. Fastest path.",
  },
  {
    key: "upload",
    title: "Upload document",
    description:
      "Upload your WSP, policy PDF, or compliance manual. ERA CUE extracts the rules.",
  },
  {
    key: "describe",
    title: "Describe it",
    description:
      "Type or speak what you want to block or review. ERA CUE structures it.",
  },
  {
    key: "suggest",
    title: "ERA CUE suggests",
    description:
      "Based on your submission history, these keyword clusters may need a rule.",
    badge: "0 suggestions",
  },
];

function AddRuleDropdown({
  open,
  setOpen,
  onSelect,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (key: AddRuleChoice) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside closes the popover. Pointer/keyboard hooks both
  // listen so the dropdown can be dismissed with mouse, touch, or
  // Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const options = ADD_RULE_CHOOSER_OPTIONS;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="bg-[#0EA5E9] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#0284C7] transition-colors cursor-pointer"
      >
        + Add a rule
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 w-[480px] bg-white border border-[#E2E8F0] shadow-lg rounded-lg">
          <div className="grid grid-cols-2 gap-3 p-4">
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSelect(opt.key)}
                className="bg-white border border-[#E2E8F0] rounded-lg p-4 hover:border-[#0EA5E9] hover:shadow-sm cursor-pointer text-left transition-colors"
              >
                <div className="text-[#0F172A] font-medium text-sm flex items-center justify-between gap-2">
                  <span>{opt.title}</span>
                  {opt.badge && (
                    <span className="font-mono text-[9px] uppercase tracking-widest bg-[#EFF8FF] text-[#1A56DB] border border-[#BAE6FD] px-1.5 py-0.5 rounded-sm">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <div className="text-[#64748B] text-xs mt-1 leading-relaxed">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- CHANGE 1 — Rules table ------------------------------------------
//
// Desktop (≥md): full <table> with the seven columns the spec
// defines. Mobile (<md): each rule renders as a stacked card with
// only name + status + actions visible; "Show details" expands the
// rest inline. Action availability mirrors the prior card layout —
// drafts get Authorize / Edit / Delete; active/expiring/silent get
// Edit / Deactivate; deactivated rows render no actions.

type RulesTableProps = {
  rules: ReadonlyArray<RuleRow>;
  now: number;
  expandedMobileRows: Set<string>;
  onToggleMobile: (id: string) => void;
  // V2 — inline edit panel.
  inlineEditId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    ruleId: string,
    updates: {
      name: string;
      description: string;
      verdict: string;
      keywords: string[];
      effective_from: string;
      effective_until: string | null;
    },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  // V3 — inline deactivate confirmation strip.
  confirmingDeactivateId: string | null;
  onStartDeactivate: (id: string) => void;
  onCancelDeactivate: () => void;
  onConfirmDeactivate: (
    id: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  // FIX 2 — inline hard-delete confirmation strip (zero-trigger rules only).
  confirmingDeleteId: string | null;
  onStartDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (
    id: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  // V5 — reactivate handler for deactivated rows.
  onReactivate: (id: string) => void | Promise<void>;
  onAuthorizeDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  // V4 — newly-created or freshly-reactivated row gets a 3s teal pulse.
  highlightedRuleId: string | null;
  // V4 — set of optimistic-only rule ids (rendered with a "Demo —
  // session only" chip).
  optimisticIds: Set<string>;
  // V7 — toast renderer threaded down for the inline edit panel.
  showToast: (message: string, tone?: "success" | "error") => void;
  // V8 — three-button empty state opens a creation modal.
  onOpenModal: (key: "template" | "paste" | "build") => void;
  pending: boolean;
};

// FIX 3 — soft-tinted severity badges shared by the desktop "Severity"
// column and the mobile inline-with-name badge. Three styles:
// BLOCK / REVIEW / FLAG.
function ruleSeverityBadge(verdict: string) {
  const v = (verdict || "").toLowerCase();
  if (v === "block") {
    return (
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] shrink-0">
        Block
      </span>
    );
  }
  if (v === "review" || v === "escalate") {
    return (
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] shrink-0">
        Review
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shrink-0">
      Flag
    </span>
  );
}

function lifecycleStateLabel(rule: RuleRow, now: number): {
  label: string;
  className: string;
} {
  const status = classifyLifecycle(rule, now);
  const pill = lifecyclePillFor(rule, status);
  if (pill) {
    return {
      label: pill.toUpperCase(),
      className: lifecyclePillClass(pill),
    };
  }
  // DRAFT case
  return {
    label: "DRAFT",
    className: "bg-[#1E293B] text-[#94A3B8]",
  };
}

function authorizedByLabel(rule: RuleRow): string {
  const persisted = (rule.authorized_by ?? "").trim();
  if (persisted) return persisted;
  if (IS_DEMO_MODE) return "Sarah Chen · GC";
  return "—";
}

// FIX 5 — sort state. `null` column means default order
// (effective_from ascending — oldest first per spec). Clicking a
// sortable header sets the column; clicking it again flips direction.
type SortColumn = "name" | "status" | "lastTriggered" | "triggers" | null;
type SortDir = "asc" | "desc";

function RulesTable({
  rules,
  now,
  expandedMobileRows,
  onToggleMobile,
  inlineEditId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  confirmingDeactivateId,
  onStartDeactivate,
  onCancelDeactivate,
  onConfirmDeactivate,
  confirmingDeleteId,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onReactivate,
  onAuthorizeDraft,
  onDeleteDraft,
  highlightedRuleId,
  optimisticIds,
  showToast,
  onOpenModal,
  pending,
}: RulesTableProps) {
  // FIX 5 — column sort. Default sort is effective_from ascending;
  // clicking any sortable header overrides that.
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(col: NonNullable<SortColumn>) {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  }

  function sortIndicator(col: NonNullable<SortColumn>): string {
    if (sortColumn !== col) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  // Sorted copy of `rules`. The bucket split below preserves this order
  // within each bucket (active rules sorted, deactivated rules sorted).
  const sortedRules = useMemo(() => {
    const rows = [...rules];
    if (sortColumn === null) {
      rows.sort((a, b) => {
        const at = a.effective_from
          ? new Date(a.effective_from).getTime()
          : 0;
        const bt = b.effective_from
          ? new Date(b.effective_from).getTime()
          : 0;
        return at - bt;
      });
      return rows;
    }
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "name":
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "status": {
          const al = lifecycleStateLabel(a, now).label;
          const bl = lifecycleStateLabel(b, now).label;
          cmp = al.localeCompare(bl);
          break;
        }
        case "lastTriggered": {
          const at = a.last_triggered
            ? new Date(a.last_triggered).getTime()
            : -Infinity;
          const bt = b.last_triggered
            ? new Date(b.last_triggered).getTime()
            : -Infinity;
          cmp = at === bt ? 0 : at < bt ? -1 : 1;
          break;
        }
        case "triggers":
          cmp = (a.trigger_count ?? 0) - (b.trigger_count ?? 0);
          break;
      }
      return cmp * dir;
    });
    return rows;
  }, [rules, sortColumn, sortDir, now]);

  // V6 — split active and deactivated rules so the deactivated set
  // renders as a separate, dimmed section at the bottom.
  const activeBucket: RuleRow[] = [];
  const deactivatedBucket: RuleRow[] = [];
  for (const r of sortedRules) {
    if (classifyLifecycle(r, now) === "DEACTIVATED") {
      deactivatedBucket.push(r);
    } else {
      activeBucket.push(r);
    }
  }

  // V8 — when no active rules but there are deactivated rules (or a
  // truly empty bucket), surface the three-path empty state above the
  // deactivated section. The "no active and no deactivated" case is
  // covered by the truly-empty branch below.
  const showEmptyCard = activeBucket.length === 0;

  if (rules.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded p-12 text-center text-[#64748B] text-sm">
        No rules in this view.
      </div>
    );
  }

  function highlightRowClass(id: string): string {
    return id === highlightedRuleId
      ? "bg-[#0EA5E9]/10 border-l-4 border-[#0EA5E9]"
      : "";
  }

  function emptyStateCard() {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded p-8 text-center mb-4">
        <div className="text-base font-medium text-[#0F172A]">
          No active governance rules.
        </div>
        <div className="text-sm text-[#64748B] mt-2">
          Add a rule to start checking drafts against your governance
          requirements.
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {(
            [
              { key: "template" as const, label: "From a template" },
              { key: "paste" as const, label: "From existing policy" },
              { key: "build" as const, label: "Build from scratch" },
            ]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onOpenModal(opt.key)}
              className="bg-white border border-[#E2E8F0] hover:border-[#0EA5E9] text-[#475569] font-mono text-xs font-medium px-3 py-2 rounded-sm cursor-pointer transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {showEmptyCard && emptyStateCard()}

      {/* Desktop table — hidden under md breakpoint.
          FIX 3 — Severity is the new first column.
          FIX 5 — Rule name / Status / Last triggered / Triggers headers are
          sortable buttons with ↑↓↕ indicators. */}
      {(activeBucket.length > 0 || deactivatedBucket.length > 0) && (
        <div className="hidden md:block w-full overflow-x-auto bg-white border border-[#E2E8F0] rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#F1F5F9] border-b border-[#E2E8F0]">
              <tr>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  Severity
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer flex items-center gap-1"
                    aria-label="Sort by rule name"
                  >
                    Rule name
                    <span aria-hidden className={sortColumn === "name" ? "text-[#0EA5E9]" : "text-[#CBD5E1]"}>
                      {sortIndicator("name")}
                    </span>
                  </button>
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("status")}
                    className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer flex items-center gap-1"
                    aria-label="Sort by status"
                  >
                    Status
                    <span aria-hidden className={sortColumn === "status" ? "text-[#0EA5E9]" : "text-[#CBD5E1]"}>
                      {sortIndicator("status")}
                    </span>
                  </button>
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  Keywords
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("lastTriggered")}
                    className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer flex items-center gap-1"
                    aria-label="Sort by last triggered"
                  >
                    Last triggered
                    <span aria-hidden className={sortColumn === "lastTriggered" ? "text-[#0EA5E9]" : "text-[#CBD5E1]"}>
                      {sortIndicator("lastTriggered")}
                    </span>
                  </button>
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort("triggers")}
                    className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer flex items-center gap-1"
                    aria-label="Sort by triggers"
                  >
                    Triggers
                    <span aria-hidden className={sortColumn === "triggers" ? "text-[#0EA5E9]" : "text-[#CBD5E1]"}>
                      {sortIndicator("triggers")}
                    </span>
                  </button>
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  Authorized by
                </th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#64748B] px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {activeBucket.map((r) => (
                <DesktopRuleRow
                  key={r.id}
                  rule={r}
                  now={now}
                  deactivated={false}
                  inlineEditOpen={inlineEditId === r.id}
                  confirmingDeactivate={confirmingDeactivateId === r.id}
                  confirmingDelete={confirmingDeleteId === r.id}
                  highlightClass={highlightRowClass(r.id)}
                  isOptimistic={optimisticIds.has(r.id)}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  onStartDeactivate={onStartDeactivate}
                  onCancelDeactivate={onCancelDeactivate}
                  onConfirmDeactivate={onConfirmDeactivate}
                  onStartDelete={onStartDelete}
                  onCancelDelete={onCancelDelete}
                  onConfirmDelete={onConfirmDelete}
                  onReactivate={onReactivate}
                  onAuthorizeDraft={onAuthorizeDraft}
                  onDeleteDraft={onDeleteDraft}
                  showToast={showToast}
                  pending={pending}
                />
              ))}
              {deactivatedBucket.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={8}
                      className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] py-3 px-4 border-t border-[#E2E8F0] bg-[#F8FAFC]"
                    >
                      Deactivated rules ({deactivatedBucket.length})
                    </td>
                  </tr>
                  {deactivatedBucket.map((r) => (
                    <DesktopRuleRow
                      key={r.id}
                      rule={r}
                      now={now}
                      deactivated
                      inlineEditOpen={false}
                      confirmingDeactivate={false}
                      confirmingDelete={false}
                      highlightClass={highlightRowClass(r.id)}
                      isOptimistic={optimisticIds.has(r.id)}
                      onStartEdit={onStartEdit}
                      onCancelEdit={onCancelEdit}
                      onSaveEdit={onSaveEdit}
                      onStartDeactivate={onStartDeactivate}
                      onCancelDeactivate={onCancelDeactivate}
                      onConfirmDeactivate={onConfirmDeactivate}
                      onStartDelete={onStartDelete}
                      onCancelDelete={onCancelDelete}
                      onConfirmDelete={onConfirmDelete}
                      onReactivate={onReactivate}
                      onAuthorizeDraft={onAuthorizeDraft}
                      onDeleteDraft={onDeleteDraft}
                      showToast={showToast}
                      pending={pending}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards — name + status + Actions visible; "Show
          details" toggles the rest inline. Visible only under md. */}
      <div className="md:hidden space-y-2">
        {activeBucket.map((r) => (
          <MobileRuleCard
            key={r.id}
            rule={r}
            now={now}
            deactivated={false}
            expanded={expandedMobileRows.has(r.id)}
            onToggleMobile={onToggleMobile}
            inlineEditOpen={inlineEditId === r.id}
            confirmingDeactivate={confirmingDeactivateId === r.id}
            confirmingDelete={confirmingDeleteId === r.id}
            highlightClass={highlightRowClass(r.id)}
            isOptimistic={optimisticIds.has(r.id)}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onStartDeactivate={onStartDeactivate}
            onCancelDeactivate={onCancelDeactivate}
            onConfirmDeactivate={onConfirmDeactivate}
            onStartDelete={onStartDelete}
            onCancelDelete={onCancelDelete}
            onConfirmDelete={onConfirmDelete}
            onReactivate={onReactivate}
            onAuthorizeDraft={onAuthorizeDraft}
            onDeleteDraft={onDeleteDraft}
            showToast={showToast}
            pending={pending}
          />
        ))}
        {deactivatedBucket.length > 0 && (
          <>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] py-3">
              Deactivated rules ({deactivatedBucket.length})
            </div>
            {deactivatedBucket.map((r) => (
              <MobileRuleCard
                key={r.id}
                rule={r}
                now={now}
                deactivated
                expanded={expandedMobileRows.has(r.id)}
                onToggleMobile={onToggleMobile}
                inlineEditOpen={false}
                confirmingDeactivate={false}
                confirmingDelete={false}
                highlightClass={highlightRowClass(r.id)}
                isOptimistic={optimisticIds.has(r.id)}
                onStartEdit={onStartEdit}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onStartDeactivate={onStartDeactivate}
                onCancelDeactivate={onCancelDeactivate}
                onConfirmDeactivate={onConfirmDeactivate}
                onStartDelete={onStartDelete}
                onCancelDelete={onCancelDelete}
                onConfirmDelete={onConfirmDelete}
                onReactivate={onReactivate}
                onAuthorizeDraft={onAuthorizeDraft}
                onDeleteDraft={onDeleteDraft}
                showToast={showToast}
                pending={pending}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

// ---------- Desktop row + inline edit / deactivate strips ------------------

type DesktopRowProps = {
  rule: RuleRow;
  now: number;
  deactivated: boolean;
  inlineEditOpen: boolean;
  confirmingDeactivate: boolean;
  confirmingDelete: boolean;
  highlightClass: string;
  isOptimistic: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: RulesTableProps["onSaveEdit"];
  onStartDeactivate: (id: string) => void;
  onCancelDeactivate: () => void;
  onConfirmDeactivate: RulesTableProps["onConfirmDeactivate"];
  onStartDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: RulesTableProps["onConfirmDelete"];
  onReactivate: RulesTableProps["onReactivate"];
  onAuthorizeDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  showToast: RulesTableProps["showToast"];
  pending: boolean;
};

function DesktopRuleRow({
  rule,
  now,
  deactivated,
  inlineEditOpen,
  confirmingDeactivate,
  confirmingDelete,
  highlightClass,
  isOptimistic,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDeactivate,
  onCancelDeactivate,
  onConfirmDeactivate,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onReactivate,
  onAuthorizeDraft,
  onDeleteDraft,
  showToast,
  pending,
}: DesktopRowProps) {
  const status = classifyLifecycle(rule, now);
  const isDraft = status === "DRAFT";
  const lifecycle = lifecycleStateLabel(rule, now);
  const triggers = rule.trigger_count ?? 0;
  const keywords = rule.keywords ?? [];
  const keywordCount = keywords.length;
  // FIX 4 — local click-to-expand state for the keyword cell. Resets on
  // unmount; intentional that switching tabs collapses the open list.
  const [keywordsExpanded, setKeywordsExpanded] = useState(false);
  const baseRowClass =
    "border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors";
  const dimmed = deactivated ? "opacity-50" : "";
  const nameTextClass = deactivated
    ? "text-[#94A3B8] font-medium"
    : "text-[#0F172A] font-medium";
  const muted = "text-[#64748B] text-sm";
  const numericClass = deactivated
    ? "text-[#94A3B8] font-mono"
    : "text-[#0F172A] font-mono";

  const statusPill = deactivated ? (
    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm bg-[#F1F5F9] text-[#94A3B8]">
      DEACTIVATED
    </span>
  ) : (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-sm ${lifecycle.className}`}
    >
      {lifecycle.label}
    </span>
  );

  return (
    <>
      <tr
        id={`rule-${rule.id}`}
        className={`${baseRowClass} ${dimmed} ${highlightClass}`.trim()}
      >
        {/* FIX 3 — Severity badge in its own first column on desktop. */}
        <td className="px-4 py-3">{ruleSeverityBadge(rule.verdict)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className={`${nameTextClass} truncate`}>{rule.name}</span>
            {isOptimistic && (
              <span className="font-mono text-[9px] uppercase tracking-widest bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] px-1.5 py-0.5 rounded-sm">
                Demo — session only
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">{statusPill}</td>
        {/* FIX 4 — Keyword count is now a button that expands the full
            chip list inline below the row. Disabled when there are
            zero keywords (no point expanding into an empty cell). */}
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setKeywordsExpanded((v) => !v)}
            disabled={keywordCount === 0}
            aria-expanded={keywordsExpanded}
            className={`${muted} text-left hover:text-[#0F172A] transition-colors ${
              keywordCount === 0
                ? "cursor-default"
                : "cursor-pointer hover:underline"
            }`}
          >
            {keywordCount} keyword{keywordCount !== 1 ? "s" : ""}
            {keywordCount > 0 && (
              <span aria-hidden className="ml-1 text-[#94A3B8]">
                {keywordsExpanded ? "▴" : "▾"}
              </span>
            )}
          </button>
        </td>
        <td className={`px-4 py-3 ${muted}`}>
          {rule.last_triggered ? fmtDate(rule.last_triggered) : "Never"}
        </td>
        <td className={`px-4 py-3 ${numericClass}`}>{triggers}</td>
        <td className="px-4 py-3 text-[#64748B] text-xs">
          {authorizedByLabel(rule)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {deactivated ? (
              <button
                type="button"
                onClick={() => onReactivate(rule.id)}
                className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
              >
                Reactivate
              </button>
            ) : isDraft ? (
              <>
                <button
                  type="button"
                  onClick={() => onAuthorizeDraft(rule.id)}
                  className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                >
                  Authorize
                </button>
                <button
                  type="button"
                  onClick={() =>
                    inlineEditOpen ? onCancelEdit() : onStartEdit(rule.id)
                  }
                  className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                >
                  {inlineEditOpen ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDraft(rule.id)}
                  className="text-[#94A3B8] text-xs hover:text-[#EF4444] cursor-pointer"
                >
                  Delete
                </button>
              </>
            ) : (
              // Order is Edit · Delete · Deactivate. Delete now
              // renders for every active rule regardless of trigger
              // count — the audit history concern moved to the
              // confirmation strip's "This cannot be undone." copy and
              // the visitor's choice to confirm.
              <>
                <button
                  type="button"
                  onClick={() =>
                    inlineEditOpen ? onCancelEdit() : onStartEdit(rule.id)
                  }
                  className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                >
                  {inlineEditOpen ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    confirmingDelete ? onCancelDelete() : onStartDelete(rule.id)
                  }
                  disabled={pending}
                  className="text-[#EF4444] text-xs hover:underline cursor-pointer disabled:opacity-50"
                >
                  {confirmingDelete ? "Cancel" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => onStartDeactivate(rule.id)}
                  disabled={pending}
                  className="text-[#94A3B8] text-xs hover:underline cursor-pointer disabled:opacity-50"
                >
                  Deactivate
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {/* FIX 4 — Keyword chip drawer. */}
      {keywordsExpanded && keywordCount > 0 && (
        <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="font-mono text-xs bg-white text-[#475569] border border-[#E2E8F0] px-2 py-1 rounded-sm"
                >
                  {kw}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
      {inlineEditOpen && (
        <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
          <td colSpan={8} className="px-4 py-4">
            <InlineEditPanel
              rule={rule}
              onCancel={onCancelEdit}
              onSave={onSaveEdit}
              showToast={showToast}
            />
          </td>
        </tr>
      )}
      {confirmingDeactivate && (
        <tr className="bg-[#FEF2F2] border-b border-[#F1F5F9]">
          <td colSpan={8} className="px-4 py-3">
            <DeactivateConfirmStrip
              ruleName={rule.name}
              ruleId={rule.id}
              onCancel={onCancelDeactivate}
              onConfirm={onConfirmDeactivate}
              pending={pending}
            />
          </td>
        </tr>
      )}
      {/* FIX 2 — Inline delete confirmation strip. */}
      {confirmingDelete && (
        <tr className="bg-[#FEF2F2] border-b border-[#F1F5F9]">
          <td colSpan={8} className="px-4 py-3">
            <DeleteConfirmStrip
              ruleName={rule.name}
              ruleId={rule.id}
              onCancel={onCancelDelete}
              onConfirm={onConfirmDelete}
              pending={pending}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- Mobile card ----------------------------------------------------

type MobileCardProps = {
  rule: RuleRow;
  now: number;
  deactivated: boolean;
  expanded: boolean;
  onToggleMobile: (id: string) => void;
  inlineEditOpen: boolean;
  confirmingDeactivate: boolean;
  confirmingDelete: boolean;
  highlightClass: string;
  isOptimistic: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: RulesTableProps["onSaveEdit"];
  onStartDeactivate: (id: string) => void;
  onCancelDeactivate: () => void;
  onConfirmDeactivate: RulesTableProps["onConfirmDeactivate"];
  onStartDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: RulesTableProps["onConfirmDelete"];
  onReactivate: RulesTableProps["onReactivate"];
  onAuthorizeDraft: (id: string) => void;
  // Drafts on mobile expose a Delete affordance only inside the
  // expanded details block (the collapsed top row keeps to the two
  // primary actions to fit width-constrained layouts).
  onDeleteDraft: (id: string) => void;
  showToast: RulesTableProps["showToast"];
  pending: boolean;
};

function MobileRuleCard({
  rule,
  now,
  deactivated,
  expanded,
  onToggleMobile,
  inlineEditOpen,
  confirmingDeactivate,
  confirmingDelete,
  highlightClass,
  isOptimistic,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDeactivate,
  onCancelDeactivate,
  onConfirmDeactivate,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onReactivate,
  onAuthorizeDraft,
  onDeleteDraft,
  showToast,
  pending,
}: MobileCardProps) {
  const status = classifyLifecycle(rule, now);
  const isDraft = status === "DRAFT";
  const lifecycle = lifecycleStateLabel(rule, now);
  const triggers = rule.trigger_count ?? 0;
  const keywords = rule.keywords ?? [];
  const keywordCount = keywords.length;
  const dimmed = deactivated ? "opacity-50" : "";
  const nameTextClass = deactivated ? "text-[#94A3B8]" : "text-[#0F172A]";
  return (
    <div
      id={`rule-${rule.id}-mobile`}
      className={`bg-white border border-[#E2E8F0] rounded p-3 ${dimmed} ${highlightClass}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${nameTextClass} text-sm`}>
              {rule.name}
            </span>
            {ruleSeverityBadge(rule.verdict)}
            {isOptimistic && (
              <span className="font-mono text-[9px] uppercase tracking-widest bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] px-1.5 py-0.5 rounded-sm">
                Demo — session only
              </span>
            )}
          </div>
          {deactivated ? (
            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-sm mt-1 bg-[#F1F5F9] text-[#94A3B8]">
              DEACTIVATED
            </span>
          ) : (
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-sm mt-1 ${lifecycle.className}`}
            >
              {lifecycle.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {deactivated ? (
            <button
              type="button"
              onClick={() => onReactivate(rule.id)}
              className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
            >
              Reactivate
            </button>
          ) : isDraft ? (
            <>
              <button
                type="button"
                onClick={() => onAuthorizeDraft(rule.id)}
                className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
              >
                Authorize
              </button>
              <button
                type="button"
                onClick={() =>
                  inlineEditOpen ? onCancelEdit() : onStartEdit(rule.id)
                }
                className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
              >
                {inlineEditOpen ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() => onDeleteDraft(rule.id)}
                className="text-[#94A3B8] text-xs hover:text-[#EF4444] cursor-pointer"
              >
                Delete
              </button>
            </>
          ) : (
            // Order is Edit · Delete · Deactivate (mirrors desktop).
            // Delete renders unconditionally on active rules now.
            <>
              <button
                type="button"
                onClick={() =>
                  inlineEditOpen ? onCancelEdit() : onStartEdit(rule.id)
                }
                className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
              >
                {inlineEditOpen ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmingDelete ? onCancelDelete() : onStartDelete(rule.id)
                }
                disabled={pending}
                className="text-[#EF4444] text-xs hover:underline cursor-pointer disabled:opacity-50"
              >
                {confirmingDelete ? "Cancel" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => onStartDeactivate(rule.id)}
                disabled={pending}
                className="text-[#94A3B8] text-xs hover:underline cursor-pointer disabled:opacity-50"
              >
                Deactivate
              </button>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggleMobile(rule.id)}
        className="text-[#64748B] text-xs mt-2 hover:text-[#0F172A] cursor-pointer"
        aria-expanded={expanded}
      >
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
          <dt className="text-[#64748B]">Keywords</dt>
          <dd className="text-[#0F172A]">
            {keywordCount === 0 ? (
              <span className="text-[#94A3B8]">None</span>
            ) : (
              // FIX 4 — mobile expanded details render the full chip
              // list (no need for a click-to-expand here since the
              // entire details block is already revealed on tap).
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="font-mono text-[10px] bg-white text-[#475569] border border-[#E2E8F0] px-1.5 py-0.5 rounded-sm"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </dd>
          <dt className="text-[#64748B]">Last triggered</dt>
          <dd className="text-[#0F172A]">
            {rule.last_triggered ? fmtDate(rule.last_triggered) : "Never"}
          </dd>
          <dt className="text-[#64748B]">Triggers</dt>
          <dd className="text-[#0F172A] font-mono">{triggers}</dd>
          <dt className="text-[#64748B]">Authorized by</dt>
          <dd className="text-[#0F172A]">{authorizedByLabel(rule)}</dd>
        </dl>
      )}
      {inlineEditOpen && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
          <InlineEditPanel
            rule={rule}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
            showToast={showToast}
          />
        </div>
      )}
      {confirmingDeactivate && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
          <DeactivateConfirmStrip
            ruleName={rule.name}
            ruleId={rule.id}
            onCancel={onCancelDeactivate}
            onConfirm={onConfirmDeactivate}
            pending={pending}
          />
        </div>
      )}
      {/* FIX 2 — Mobile delete confirmation strip (mirrors deactivate). */}
      {confirmingDelete && (
        <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
          <DeleteConfirmStrip
            ruleName={rule.name}
            ruleId={rule.id}
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
            pending={pending}
          />
        </div>
      )}
    </div>
  );
}

// ---------- V2 Inline edit panel -------------------------------------------
//
// Renders inside a colSpan=7 row directly below the rule the visitor
// is editing. Replaces the prior <EditRuleSheet> modal — the panel
// stays in the table flow, the row above stays visible, and the
// post-save toast confirms the update without leaving the page.

function InlineEditPanel({
  rule,
  onCancel,
  onSave,
  showToast,
}: {
  rule: RuleRow;
  onCancel: () => void;
  onSave: RulesTableProps["onSaveEdit"];
  showToast: RulesTableProps["showToast"];
}) {
  const initialName = rule.name;
  const initialKeywords = rule.keywords ?? [];
  const initialVerdict = rule.verdict ?? "review";
  const initialFrom = rule.effective_from
    ? rule.effective_from.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const initialUntil = rule.effective_until
    ? rule.effective_until.slice(0, 10)
    : "";
  const initialBasis = rule.wsp_reference ?? "";

  const [name, setName] = useState(initialName);
  const [chips, setChips] = useState<string[]>(initialKeywords);
  // The DB stores four verdicts (block / escalate / review / guide).
  // The inline panel only exposes BLOCK / REVIEW per spec; existing
  // escalate/guide rules read in as REVIEW for display purposes.
  const initialSeverity: "BLOCK" | "REVIEW" =
    initialVerdict === "block" ? "BLOCK" : "REVIEW";
  const [severity, setSeverity] = useState<"BLOCK" | "REVIEW">(
    initialSeverity,
  );
  const [from, setFrom] = useState(initialFrom);
  const [until, setUntil] = useState(initialUntil);
  const [basis, setBasis] = useState(initialBasis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const verdict = severity === "BLOCK" ? "block" : "review";
      const result = await onSave(rule.id, {
        name: name.trim(),
        description: rule.description ?? "",
        verdict,
        keywords: chips,
        effective_from: new Date(from).toISOString(),
        effective_until: until ? new Date(until).toISOString() : null,
      });
      if (result.ok) {
        showToast("Rule updated — changes are live", "success");
        onCancel();
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
        Edit rule
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
            Rule name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
            Keywords
          </label>
          <ChipInput chips={chips} onChange={setChips} />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
            Severity
          </label>
          <div className="flex gap-2">
            {(["BLOCK", "REVIEW"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`font-mono text-xs font-bold uppercase px-3 py-2 rounded-sm border transition-colors cursor-pointer ${
                  severity === s
                    ? s === "BLOCK"
                      ? "bg-[#EF4444] text-white border-[#EF4444]"
                      : "bg-[#F59E0B] text-white border-[#F59E0B]"
                    : "bg-white border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
              Activation date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] font-mono"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
              Expiry date
              <span className="normal-case ml-1 text-[#94A3B8]">
                (optional)
              </span>
            </label>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] font-mono"
            />
          </div>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
            Regulatory basis
          </label>
          <input
            type="text"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !name.trim()}
          className={`bg-[#0EA5E9] text-white font-mono text-sm font-medium px-4 py-2 rounded-sm hover:bg-[#0284C7] disabled:opacity-50 transition-colors ${
            busy ? "opacity-50 cursor-not-allowed animate-pulse" : "cursor-pointer"
          }`}
        >
          {busy ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="text-[#EF4444] text-sm mt-2">
          Save failed — {error}. Try again.
        </div>
      )}
    </div>
  );
}

// ---------- V3 Deactivate confirmation strip --------------------------------

function DeactivateConfirmStrip({
  ruleName,
  ruleId,
  onCancel,
  onConfirm,
  pending,
}: {
  ruleName: string;
  ruleId: string;
  onCancel: () => void;
  onConfirm: RulesTableProps["onConfirmDeactivate"];
  pending: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(ruleId);
      if (!result.ok) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-[#0F172A] flex-1 min-w-0">
        Deactivate{" "}
        <span className="font-semibold">&ldquo;{ruleName}&rdquo;</span>?
        This rule will stop checking drafts. The record is preserved.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || pending}
          className={`bg-[#EF4444] text-white font-mono text-xs font-medium px-3 py-2 rounded-sm hover:bg-[#DC2626] disabled:opacity-50 transition-colors ${
            busy ? "animate-pulse cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {busy ? "Deactivating..." : "Confirm deactivate"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="text-[#EF4444] text-sm w-full">
          Deactivate failed — {error}. Try again.
        </div>
      )}
    </div>
  );
}

// ---------- FIX 2 Delete confirmation strip --------------------------------
//
// Mirrors DeactivateConfirmStrip — same shape, different copy ("Delete
// … This cannot be undone.") and different button label. Surfaced
// inline below the row when the visitor clicks the red "Delete" link
// in the Actions column. Only ever rendered for trigger_count === 0
// rules, so the audit trail loses no fired-rule history.

function DeleteConfirmStrip({
  ruleName,
  ruleId,
  onCancel,
  onConfirm,
  pending,
}: {
  ruleName: string;
  ruleId: string;
  onCancel: () => void;
  onConfirm: RulesTableProps["onConfirmDelete"];
  pending: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(ruleId);
      if (!result.ok) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-[#0F172A] flex-1 min-w-0">
        Delete{" "}
        <span className="font-semibold">&ldquo;{ruleName}&rdquo;</span>?
        This cannot be undone.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || pending}
          className={`bg-[#EF4444] text-white font-mono text-xs font-medium px-3 py-2 rounded-sm hover:bg-[#DC2626] disabled:opacity-50 transition-colors ${
            busy ? "animate-pulse cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {busy ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="text-[#EF4444] text-sm w-full">
          Delete failed — {error}. Try again.
        </div>
      )}
    </div>
  );
}

// ---------- Modal shell -----------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h3
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-xl font-light text-[#0D1B2A]"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#94A3B8] hover:text-[#0D1B2A] text-xl cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------- B1–B4 Post-action confirmation panel --------------------------
//
// Replaces the modal body after a successful rule creation. Shared by
// TemplateModal, PastePolicyModal, UploadDocumentModal and
// BuildRuleModal so each entry-point lands the same shape of
// confirmation. The CTA links to /submit (Next.js navigation; clears
// the modal as a side effect of the route change). "Back to rules"
// closes the modal and refreshes the rules list.

function formatActivationDate(iso: string): string {
  // ISO YYYY-MM-DD → "May 8, 2026". Defensive against bad input.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type ConfirmationPanelProps = {
  ruleName: string;
  severity: "BLOCK" | "REVIEW";
  keywordCount: number;
  authorizedBy: string;
  activationDateIso: string;
  onBack: () => void;
};

function PostActionConfirmation({
  ruleName,
  severity,
  keywordCount,
  authorizedBy,
  activationDateIso,
  onBack,
}: ConfirmationPanelProps) {
  // FIX 3 — the "Check a draft against this rule →" CTA refreshes
  // the rules list before routing away, so a visitor who clicks it
  // (and later returns to /rules) sees the new rule already
  // present in the table — not the pre-save snapshot.
  const router = useRouter();
  const severityClass =
    severity === "BLOCK"
      ? "bg-[#EF4444] text-white"
      : "bg-[#F59E0B] text-white";
  function goCheckDraft() {
    router.refresh();
    router.push("/check");
  }
  return (
    <div className="text-center py-2">
      <div
        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] mb-4"
        aria-hidden
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#166534"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3
        style={{ fontFamily: "var(--font-newsreader)" }}
        className="text-xl font-light text-[#0D1B2A] mb-3"
      >
        {ruleName}
      </h3>
      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        <span
          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${severityClass}`}
        >
          {severity}
        </span>
        <span className="font-mono text-xs text-[#64748B]">
          {keywordCount} keyword{keywordCount !== 1 ? "s" : ""} active
        </span>
      </div>
      <div className="text-sm text-[#475569] mb-1">
        Authorized by: {authorizedBy}
      </div>
      <div className="font-mono text-xs text-[#94A3B8] mb-6">
        {formatActivationDate(activationDateIso)}
      </div>
      <button
        type="button"
        onClick={goCheckDraft}
        className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] transition-colors inline-block cursor-pointer"
      >
        Check a draft against this rule →
      </button>
      <div className="mt-3">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer"
        >
          Back to rules
        </button>
      </div>
    </div>
  );
}

// ---------- FIX 1 — Saved-rule confirmation panel --------------------------
//
// Shared by BuildRuleModal, TemplateModal, and PastePolicyModal. After
// a successful save the modal swaps its body for this panel:
//
//   • Large green ✓
//   • "Rule active" headline
//   • "<rule name> is now checking every draft submission."
//   • Confirmed keyword chips in the soft-green tint
//   • Authorized-by / date line
//   • "Add another rule →" (host modal resets its form to empty state)
//   • "Done" (host modal closes; closeAndRefresh fires router.refresh)

type SavedConfirmationProps = {
  ruleName: string;
  keywords: string[];
  activationDateIso: string;
  onAddAnother: () => void;
  onDone: () => void;
};

function SavedConfirmation({
  ruleName,
  keywords,
  activationDateIso,
  onAddAnother,
  onDone,
}: SavedConfirmationProps) {
  return (
    <div className="text-center py-2">
      <div
        className="text-[#16A34A] text-4xl leading-none mb-3"
        aria-hidden
      >
        ✓
      </div>
      <h3
        style={{ fontFamily: "var(--font-newsreader)" }}
        className="text-2xl font-light text-[#0D1B2A] mb-2"
      >
        Rule active
      </h3>
      <p className="text-sm text-[#475569] mb-4">
        <span className="font-medium text-[#0F172A]">{ruleName}</span>{" "}
        is now checking every draft submission.
      </p>
      {keywords.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-4">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="font-mono text-xs bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] px-2 py-1 rounded-sm"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-[#64748B] mb-6">
        Authorized by: Sarah Chen · GC ·{" "}
        {formatActivationDate(activationDateIso)}
      </div>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onAddAnother}
          className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] transition-colors cursor-pointer"
        >
          Add another rule →
        </button>
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-sm text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer px-3 py-2.5"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ---------- R3 Template modal ----------------------------------------------

function TemplateModal({
  onClose,
  onEnable,
}: {
  onClose: () => void;
  onEnable: (
    t: BuiltInTemplate,
  ) => Promise<
    | { ok: true; ruleName: string; keywordCount: number }
    | { ok: false; error: string }
  >;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  // FIX 1 — saved state replaces the prior PostActionConfirmation
  // panel. Keeps the keyword list so the confirmation panel can show
  // the chips, and the activation date so the panel can render
  // "Authorized by … · <date>".
  const [saved, setSaved] = useState<{
    ruleName: string;
    keywords: string[];
    activationDateIso: string;
  } | null>(null);
  // FIX 3 — inline error keyed by template id so the failed card
  // shows its own retry message rather than blocking the whole grid.
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [tab, setTab] = useState<TemplateTab>("regulated");

  function resetForm() {
    setBusy(null);
    setError(null);
    setSaved(null);
    // Tab stays as-is so the visitor keeps their browsing context.
  }

  if (saved) {
    return (
      <ModalShell title="Rule active" onClose={onClose}>
        <SavedConfirmation
          ruleName={saved.ruleName}
          keywords={saved.keywords}
          activationDateIso={saved.activationDateIso}
          onAddAnother={resetForm}
          onDone={onClose}
        />
      </ModalShell>
    );
  }

  const visible = BUILT_IN_TEMPLATES.filter((t) => t.tab === tab);

  return (
    <ModalShell title="Enable via Template" onClose={onClose} maxWidth="max-w-3xl">
      {/* C1 — two-tab template library. Regulated industries on the
          left, coordinated campaigns on the right. The visible list
          re-renders against `tab` state. */}
      <div className="flex gap-0 border-b border-[#E2E8F0] mb-4">
        {(
          [
            { key: "regulated" as const, label: "Regulated Industries" },
            { key: "campaigns" as const, label: "Coordinated Campaigns" },
          ]
        ).map((opt) => {
          const selected = tab === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTab(opt.key)}
              className={`font-mono text-xs px-4 py-2.5 border-b-2 -mb-px transition-colors cursor-pointer ${
                selected
                  ? "border-[#4F46E5] text-[#4F46E5]"
                  : "border-transparent text-[#64748B] hover:text-[#0D1B2A]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.map((t) => {
          const sevClass =
            t.severity === "BLOCK"
              ? "bg-[#EF4444] text-white"
              : "bg-[#F59E0B] text-white";
          // Keywords on the card are capped to five samples — keeps
          // the card height predictable across the full 16-template set.
          const keywordSamples = t.keywords.slice(0, 5);
          return (
            <div
              key={t.id}
              className="border border-[#E2E8F0] rounded-lg p-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-sm font-semibold text-[#0D1B2A] leading-snug min-w-0">
                  {t.name}
                </div>
                <span
                  className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm shrink-0 ${sevClass}`}
                >
                  {t.severity}
                </span>
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mb-2">
                {t.basis}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {keywordSamples.map((kw) => (
                  <span
                    key={kw}
                    className="font-mono text-[10px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <div className="text-xs text-[#475569] mb-1 leading-relaxed">
                Catches {t.catches}.
              </div>
              {t.regulatorAsks && (
                <div className="text-[#64748B] text-xs italic mb-3 leading-relaxed">
                  {t.regulatorAsks}
                </div>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(t.id);
                  setError(null);
                  try {
                    const result = await onEnable(t);
                    if (result.ok) {
                      setSaved({
                        ruleName: result.ruleName,
                        keywords: [...t.keywords],
                        activationDateIso: new Date()
                          .toISOString()
                          .slice(0, 10),
                      });
                    } else {
                      setError({ id: t.id, message: result.error });
                    }
                  } catch (e) {
                    const message =
                      e instanceof Error ? e.message : "Unknown error";
                    setError({ id: t.id, message });
                  } finally {
                    setBusy(null);
                  }
                }}
                className={`mt-auto bg-[#4F46E5] text-white font-mono text-xs font-medium px-3 py-2 rounded-sm hover:bg-[#4338CA] transition-colors ${
                  busy === t.id
                    ? "opacity-50 cursor-not-allowed animate-pulse"
                    : "cursor-pointer"
                } disabled:opacity-50`}
              >
                {busy === t.id ? "Saving..." : "Enable this template"}
              </button>
              {error && error.id === t.id && (
                <div className="text-[#EF4444] text-sm mt-2">
                  Save failed — {error.message}. Try again.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

// ---------- R3 Paste Policy modal ------------------------------------------

function PastePolicyModal({
  onClose,
  onActivate,
}: {
  onClose: () => void;
  onActivate: (
    name: string,
    keywords: string[],
  ) => Promise<
    | { ok: true; ruleName: string; keywordCount: number }
    | { ok: false; error: string }
  >;
}) {
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[] | null>(null);
  const [name, setName] = useState("Custom Policy Rule");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FIX 1 — same pattern as TemplateModal: saved state with keywords +
  // date drives the new SavedConfirmation panel.
  const [saved, setSaved] = useState<{
    ruleName: string;
    keywords: string[];
    activationDateIso: string;
  } | null>(null);

  // B2 — auto-generate the rule name from the first six words of the
  // pasted text + "— Policy Rule" suffix. Runs at extraction time so
  // the user sees the candidate name in the input before activating.
  function autoNameFromPaste(src: string): string {
    const words = src
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    if (words.length === 0) return "Custom Policy Rule";
    return `${words.join(" ")} — Policy Rule`;
  }

  function handleExtract() {
    const kws = extractKeywords(text);
    setChips(kws);
    setName(autoNameFromPaste(text));
  }

  function removeChip(kw: string) {
    if (!chips) return;
    setChips(chips.filter((c) => c !== kw));
  }

  function resetForm() {
    setText("");
    setChips(null);
    setName("Custom Policy Rule");
    setBusy(false);
    setError(null);
    setSaved(null);
  }

  async function handleActivate() {
    if (!chips || chips.length === 0) return;
    setBusy(true);
    setError(null);
    const finalName = name.trim() || "Custom Policy Rule";
    try {
      const result = await onActivate(finalName, chips);
      if (result.ok) {
        setSaved({
          ruleName: result.ruleName,
          keywords: [...chips],
          activationDateIso: new Date().toISOString().slice(0, 10),
        });
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <ModalShell title="Rule active" onClose={onClose}>
        <SavedConfirmation
          ruleName={saved.ruleName}
          keywords={saved.keywords}
          activationDateIso={saved.activationDateIso}
          onAddAnother={resetForm}
          onDone={onClose}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Paste Policy" onClose={onClose} maxWidth="max-w-2xl">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste your policy text here"
        className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none"
      />
      <div className="mt-3">
        <button
          type="button"
          onClick={handleExtract}
          disabled={!text.trim()}
          className="bg-[#0F172A] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors cursor-pointer"
        >
          Extract keywords
        </button>
      </div>
      {chips !== null && (
        <div className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Rule name
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] mb-4"
          />
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Candidate keywords
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {chips.length === 0 ? (
              <span className="text-xs text-[#94A3B8]">
                No candidate keywords found.
              </span>
            ) : (
              chips.map((kw) => (
                <span
                  key={kw}
                  className="font-mono text-xs bg-[#F1F5F9] text-[#475569] px-2 py-1 rounded-sm border border-[#E2E8F0] flex items-center gap-1.5"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeChip(kw)}
                    className="text-[#94A3B8] hover:text-[#B91C1C] cursor-pointer"
                    aria-label={`Remove ${kw}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={handleActivate}
            disabled={busy || chips.length === 0 || !name.trim()}
            className={`bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors ${
              busy
                ? "opacity-50 cursor-not-allowed animate-pulse"
                : "cursor-pointer"
            }`}
          >
            {busy ? "Saving..." : "Activate rule"}
          </button>
          {error && (
            <div className="text-[#EF4444] text-sm mt-2">
              Save failed — {error}. Try again.
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// ---------- R3 Upload Document modal ---------------------------------------

function UploadDocumentModal({
  onClose,
  onActivate,
}: {
  onClose: () => void;
  onActivate: (
    name: string,
    keywords: string[],
  ) => Promise<
    | { ok: true; ruleName: string; keywordCount: number }
    | { ok: false; error: string }
  >;
}) {
  const [filename, setFilename] = useState<string | null>(null);
  const [chips, setChips] = useState<string[] | null>(null);
  const [name, setName] = useState("Custom Policy Rule");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationPanelProps | null>(
    null,
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setChips(null);
    // B3 — rule name auto-derived from the filename (extension stripped),
    // mapped to title case and rendered as the candidate rule name.
    const base = file.name.replace(/\.[^.]+$/, "");
    const friendly = base
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    if (friendly) setName(friendly);
  }

  function handleExtract() {
    if (!filename) return;
    setChips(extractKeywordsFromFilename(filename));
  }

  function removeChip(kw: string) {
    if (!chips) return;
    setChips(chips.filter((c) => c !== kw));
  }

  async function handleActivate() {
    if (!chips || chips.length === 0) return;
    setBusy(true);
    setError(null);
    const finalName = name.trim() || "Custom Policy Rule";
    try {
      const result = await onActivate(finalName, chips);
      if (result.ok) {
        setConfirmation({
          ruleName: result.ruleName,
          severity: "BLOCK",
          keywordCount: result.keywordCount,
          authorizedBy: "Sarah Chen · GC",
          activationDateIso: new Date().toISOString().slice(0, 10),
          onBack: onClose,
        });
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <ModalShell title="Rule activated" onClose={onClose}>
        <PostActionConfirmation {...confirmation} />
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Upload Document" onClose={onClose} maxWidth="max-w-2xl">
      <input
        type="file"
        accept=".pdf,.docx"
        onChange={handleFileChange}
        className="block w-full text-sm text-[#475569] file:mr-3 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-mono file:font-medium file:bg-[#0F172A] file:text-white hover:file:bg-[#1E293B] cursor-pointer"
      />
      {filename && (
        <div className="mt-3 text-sm text-[#475569]">
          <span className="font-mono text-xs text-[#64748B]">Selected: </span>
          {filename}
        </div>
      )}
      {filename && chips === null && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleExtract}
            className="bg-[#0F172A] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            Extract keywords
          </button>
        </div>
      )}
      {chips !== null && (
        <div className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Rule name
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] mb-4"
          />
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Candidate keywords
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {chips.length === 0 ? (
              <span className="text-xs text-[#94A3B8]">
                No candidate keywords.
              </span>
            ) : (
              chips.map((kw) => (
                <span
                  key={kw}
                  className="font-mono text-xs bg-[#F1F5F9] text-[#475569] px-2 py-1 rounded-sm border border-[#E2E8F0] flex items-center gap-1.5"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeChip(kw)}
                    className="text-[#94A3B8] hover:text-[#B91C1C] cursor-pointer"
                    aria-label={`Remove ${kw}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={handleActivate}
            disabled={busy || chips.length === 0 || !name.trim()}
            className={`bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors ${
              busy
                ? "opacity-50 cursor-not-allowed animate-pulse"
                : "cursor-pointer"
            }`}
          >
            {busy ? "Saving..." : "Activate rule"}
          </button>
          {error && (
            <div className="text-[#EF4444] text-sm mt-2">
              Save failed — {error}. Try again.
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// ---------- R6 Rule Builder — Create ---------------------------------------

function ChipInput({
  chips,
  onChange,
}: {
  chips: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (chips.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...chips, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {chips.map((c) => (
          <span
            key={c}
            className="font-mono text-xs bg-[#F1F5F9] text-[#475569] px-2 py-1 rounded-sm border border-[#E2E8F0] flex items-center gap-1.5"
          >
            {c}
            <button
              type="button"
              onClick={() => onChange(chips.filter((k) => k !== c))}
              className="text-[#94A3B8] hover:text-[#B91C1C] cursor-pointer"
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="Type a keyword and press Enter"
        className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
      />
    </div>
  );
}

function BuildRuleModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    keywords: string[];
    verdict: "block" | "review";
    effectiveFrom: string;
    effectiveUntil: string | null;
  }) => Promise<
    | { ok: true; ruleName: string; keywordCount: number }
    | { ok: false; error: string }
  >;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [severity, setSeverity] = useState<"BLOCK" | "REVIEW">("BLOCK");
  const [activation, setActivation] = useState(today);
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FIX 1 — saved state replaces the prior PostActionConfirmation
  // panel. Stores keywords + date so SavedConfirmation can render the
  // chips and the authorization line.
  const [saved, setSaved] = useState<{
    ruleName: string;
    keywords: string[];
    activationDateIso: string;
  } | null>(null);

  function resetForm() {
    setName("");
    setChips([]);
    setSeverity("BLOCK");
    setActivation(today);
    setExpiry("");
    setBusy(false);
    setError(null);
    setSaved(null);
  }

  async function handleCreate() {
    if (!name.trim() || chips.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onCreate({
        name: name.trim(),
        keywords: chips,
        verdict: severity === "BLOCK" ? "block" : "review",
        effectiveFrom: activation,
        effectiveUntil: expiry ? expiry : null,
      });
      if (result.ok) {
        setSaved({
          ruleName: result.ruleName,
          keywords: [...chips],
          activationDateIso: activation,
        });
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <ModalShell title="Rule active" onClose={onClose}>
        <SavedConfirmation
          ruleName={saved.ruleName}
          keywords={saved.keywords}
          activationDateIso={saved.activationDateIso}
          onAddAnother={resetForm}
          onDone={onClose}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Build a rule from scratch" onClose={onClose}>
      <div className="space-y-4">
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
            Keywords
          </label>
          <ChipInput chips={chips} onChange={setChips} />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
            Severity
          </label>
          <div className="flex gap-2">
            {(["BLOCK", "REVIEW"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`font-mono text-xs font-bold uppercase px-3 py-2 rounded-sm border transition-colors cursor-pointer ${
                  severity === s
                    ? s === "BLOCK"
                      ? "bg-[#EF4444] text-white border-[#EF4444]"
                      : "bg-[#F59E0B] text-white border-[#F59E0B]"
                    : "bg-white border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
              Activation date
            </label>
            <input
              type="date"
              value={activation}
              onChange={(e) => setActivation(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
              Expiry date
              <span className="normal-case ml-1 text-[#94A3B8]">(optional)</span>
            </label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
            />
          </div>
        </div>
        <div className="pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !name.trim() || chips.length === 0}
              className={`bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors ${
                busy
                  ? "opacity-50 cursor-not-allowed animate-pulse"
                  : "cursor-pointer"
              }`}
            >
              {busy ? "Saving..." : "Create rule"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {error && (
            // Prominent error banner — small inline text was easy to
            // miss when the underlying Supabase error needs to be read
            // and pasted into a debug session.
            <div
              role="alert"
              className="mt-3 border border-[#EF4444] bg-[#FEF2F2] rounded-sm px-3 py-2"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#B91C1C] font-bold mb-1">
                Save failed
              </div>
              <div className="text-sm text-[#B91C1C] break-words font-mono">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- Review and confirm full ruleset --------------------------------
//
// Full-screen modal that lets a principal scan every active rule
// before signing off — severity, name, full keyword list, lifecycle
// pill, and authorized-by line per rule, plus a tally line at the
// bottom of the list.
//
// State: `confirmed === false` renders the list view with a sticky
// footer ("Edit rules" left / "Confirm ruleset" right). On confirm,
// we replace the body with a centred success panel ("Ruleset
// confirmed" + a "Check a draft →" CTA + Done) and console.log the
// confirmation payload. There's no confirmations table yet, so the
// log is the only durable side-effect — the visible audit trail is
// added once the table lands.
//
// Custom shell rather than ModalShell because we need a separate
// scroll region for the rule list with a sticky footer; ModalShell's
// single `overflow-y-auto` container can't host that pattern cleanly.

function ReviewRulesetModal({
  rules,
  now,
  counts,
  onClose,
}: {
  rules: ReadonlyArray<RuleRow>;
  now: number;
  counts: { block: number; review: number; flag: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const ruleCount = rules.length;
  // Today, ISO YYYY-MM-DD — feeds formatActivationDate so the success
  // panel renders the same "May 9, 2026" shape used everywhere else.
  const todayIso = new Date().toISOString().slice(0, 10);

  function handleConfirm() {
    // No confirmations table yet — log the payload so the
    // authorisation event is recoverable from Vercel function logs
    // until the durable record lands.
    console.log("Ruleset confirmed:", {
      ruleCount,
      authorizedBy: "Sarah Chen · GC",
      confirmedAt: new Date().toISOString(),
    });
    setConfirmed(true);
  }

  function goCheckDraft() {
    onClose();
    router.push("/check");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmed ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
            <div
              className="text-[#16A34A] text-5xl leading-none mb-4"
              aria-hidden
            >
              ✓
            </div>
            <h3
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl font-light text-[#0D1B2A] mb-3"
            >
              Ruleset confirmed
            </h3>
            <p className="text-sm text-[#475569] mb-2 max-w-md">
              <span className="font-medium text-[#0F172A]">{ruleCount}</span>{" "}
              rule{ruleCount === 1 ? "" : "s"} are now active and enforced
              on every draft submission.
            </p>
            <div className="text-xs text-[#64748B] mb-8">
              Authorized by: Sarah Chen · GC ·{" "}
              {formatActivationDate(todayIso)}
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={goCheckDraft}
                className="bg-[#0EA5E9] text-white font-mono text-sm font-medium px-5 py-2.5 rounded hover:bg-[#0284C7] transition-colors cursor-pointer"
              >
                Check a draft →
              </button>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-sm text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer px-3 py-2.5"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header (fixed) */}
            <div className="border-b border-[#E2E8F0] px-6 py-5 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    style={{ fontFamily: "var(--font-newsreader)" }}
                    className="text-2xl font-light text-[#0D1B2A]"
                  >
                    Your governance ruleset
                  </h3>
                  <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">
                    Review all{" "}
                    <span className="font-medium text-[#0F172A]">
                      {ruleCount}
                    </span>{" "}
                    active rule{ruleCount === 1 ? "" : "s"} before
                    confirming. Every draft submission will be checked
                    against these rules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-[#94A3B8] hover:text-[#0D1B2A] text-xl cursor-pointer leading-none -mt-0.5 shrink-0"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable rule list */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#F8FAFC]">
              <div className="space-y-3">
                {rules.map((rule) => {
                  const lifecycle = lifecycleStateLabel(rule, now);
                  const keywords = rule.keywords ?? [];
                  return (
                    <div
                      key={rule.id}
                      className="bg-white border border-[#E2E8F0] rounded-sm p-4"
                    >
                      <div className="flex items-start gap-3 flex-wrap">
                        {ruleSeverityBadge(rule.verdict)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-[#0F172A]">
                              {rule.name}
                            </span>
                            <span
                              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-sm ${lifecycle.className}`}
                            >
                              {lifecycle.label}
                            </span>
                          </div>
                          {keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {keywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="bg-[#F1F5F9] text-[#0F172A] text-xs px-2 py-0.5 rounded"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-[#64748B] text-xs mt-2">
                            Authorized by: {authorizedByLabel(rule)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary line — counts + authorisation. */}
              <div className="text-[#64748B] text-sm text-center mt-5 pt-4 border-t border-[#E2E8F0]">
                {ruleCount} rule{ruleCount === 1 ? "" : "s"} ·{" "}
                {counts.block} BLOCK · {counts.review} REVIEW ·{" "}
                {counts.flag} FLAG · Authorized by Sarah Chen · GC
              </div>
            </div>

            {/* Sticky footer */}
            <div className="border-t border-[#E2E8F0] px-6 py-4 shrink-0 flex items-center justify-between gap-3 flex-wrap bg-white">
              <button
                type="button"
                onClick={onClose}
                className="text-[#64748B] text-sm hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Not right? Edit rules →
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="bg-[#0EA5E9] text-white px-6 py-2 rounded font-medium text-sm hover:bg-[#0284C7] transition-colors cursor-pointer"
              >
                Confirm ruleset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Describe-it modal ---------------------------------------------
//
// Natural-language rule drafting. The visitor types (or pastes) what
// they want governed; the server-side `draftRuleAction` calls Claude
// to return a structured rule (name, verdict, keywords, basis,
// suggested end date). On preview, "Activate" calls
// `handleCreateCustomRule` (the same handler the legacy BuildRuleModal
// uses) so the durable side effects — DB row, optimistic table row,
// router refresh, post-save SavedConfirmation — stay shared with the
// other creation flows.
//
// Stages:
//   • idle   — input + Draft button
//   • drafting — disabled state while the server action is in flight
//   • preview — drafted rule rendered with Activate / Try again
//   • saving — Activate clicked, write in flight
//   • saved  — SavedConfirmation panel inside the modal

function DescribeRuleModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    keywords: string[];
    verdict: "block" | "review";
    effectiveFrom: string;
    effectiveUntil: string | null;
  }) => Promise<
    | { ok: true; ruleName: string; keywordCount: number }
    | { ok: false; error: string }
  >;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState<DraftedRule | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    ruleName: string;
    keywords: string[];
    activationDateIso: string;
  } | null>(null);

  function resetForm() {
    setDescription("");
    setDrafted(null);
    setDraftError(null);
    setSaving(false);
    setSaveError(null);
    setSaved(null);
  }

  async function handleDraft() {
    if (!description.trim()) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await draftRuleAction(description.trim());
      if (result.ok) {
        setDrafted(result.drafted);
      } else {
        setDraftError(result.error);
      }
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDrafting(false);
    }
  }

  async function handleActivate() {
    if (!drafted) return;
    // The chooser only exposes BLOCK / REVIEW severities. Map the
    // four-verdict draft output (block / escalate / review / guide)
    // onto the two-tier table verdicts: block → block, everything
    // else → review. The original draftedVerdict is preserved on
    // saveError when something goes wrong, so the visitor can see
    // what Claude returned.
    const verdict: "block" | "review" =
      drafted.verdict === "block" ? "block" : "review";
    setSaving(true);
    setSaveError(null);
    try {
      const result = await onCreate({
        name: drafted.name,
        keywords: drafted.keywords,
        verdict,
        effectiveFrom: today,
        effectiveUntil: drafted.suggested_end_date ?? null,
      });
      if (result.ok) {
        setSaved({
          ruleName: result.ruleName,
          keywords: [...drafted.keywords],
          activationDateIso: today,
        });
      } else {
        setSaveError(result.error);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <ModalShell title="Rule active" onClose={onClose}>
        <SavedConfirmation
          ruleName={saved.ruleName}
          keywords={saved.keywords}
          activationDateIso={saved.activationDateIso}
          onAddAnother={resetForm}
          onDone={onClose}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Describe the rule" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
            What should this rule catch?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="e.g. Block any mention of fundraising, valuation, or our Series B during the active quiet period."
            disabled={drafting || drafted !== null}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
            ERA CUE structures your description into a named rule with
            keywords, severity, and a regulatory basis. You review
            before it goes live.
          </p>
        </div>

        {!drafted && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDraft}
              disabled={drafting || !description.trim()}
              className={`bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors ${
                drafting
                  ? "opacity-60 cursor-not-allowed animate-pulse"
                  : "cursor-pointer"
              }`}
            >
              {drafting ? "Drafting..." : "Draft rule with ERA CUE →"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {draftError && (
          <div
            role="alert"
            className="border border-[#FECACA] bg-[#FEF2F2] rounded-sm px-3 py-2"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#B91C1C] font-bold mb-1">
              Could not draft rule
            </div>
            <div className="text-sm text-[#B91C1C] break-words font-mono">
              {draftError}
            </div>
          </div>
        )}

        {drafted && (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-4 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
              Draft preview
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ruleSeverityBadge(drafted.verdict)}
              <span className="text-sm font-medium text-[#0F172A]">
                {drafted.name}
              </span>
            </div>
            <p className="text-sm text-[#475569] leading-relaxed">
              {drafted.description}
            </p>
            {drafted.keywords.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5">
                  Keywords
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {drafted.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="font-mono text-xs bg-white text-[#475569] border border-[#E2E8F0] px-2 py-1 rounded-sm"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {drafted.regulatory_basis && (
              <div className="font-mono text-[10px] text-[#64748B]">
                Regulatory basis: {drafted.regulatory_basis}
              </div>
            )}
            {drafted.suggested_end_date && (
              <div className="font-mono text-[10px] text-[#64748B]">
                Suggested end date: {drafted.suggested_end_date}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleActivate}
                disabled={saving}
                className={`bg-[#0EA5E9] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#0284C7] disabled:opacity-50 transition-colors ${
                  saving
                    ? "opacity-60 cursor-not-allowed animate-pulse"
                    : "cursor-pointer"
                }`}
              >
                {saving ? "Activating..." : "Activate rule"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer disabled:opacity-50"
              >
                Try a different description
              </button>
            </div>
            {saveError && (
              <div
                role="alert"
                className="border border-[#EF4444] bg-[#FEF2F2] rounded-sm px-3 py-2 mt-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#B91C1C] font-bold mb-1">
                  Save failed
                </div>
                <div className="text-sm text-[#B91C1C] break-words font-mono">
                  {saveError}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ---------- ERA CUE suggests modal (stub) ---------------------------------
//
// The suggestion engine doesn't exist yet — it'd need a server-side
// pass over past drafts + rule_check actions to surface keyword
// clusters that recur in flagged content but aren't covered by an
// explicit rule. Until that lands, this modal is the placeholder
// surface so the chooser can render the card and the wiring is in
// place. When the engine is ready, swap the body for a list of
// suggested rules with one-click adopt buttons (similar to
// TemplateModal) — no chooser changes needed.

function SuggestionsModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="ERA CUE suggests" onClose={onClose} maxWidth="max-w-2xl">
      <div className="text-center py-6">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 mb-4"
          aria-hidden
        >
          <span className="text-[#0EA5E9] text-xl">✦</span>
        </div>
        <h3
          style={{ fontFamily: "var(--font-newsreader)" }}
          className="text-xl font-light text-[#0D1B2A] mb-2"
        >
          No suggestions yet
        </h3>
        <p className="text-sm text-[#475569] max-w-md mx-auto leading-relaxed mb-2">
          ERA CUE is analysing your submission history. As your team
          submits drafts, recurring keyword patterns that aren&apos;t
          covered by an existing rule will surface here as suggested
          rules.
        </p>
        <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed mb-6">
          You&apos;ll see them here once enough drafts are in the
          corpus.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="bg-[#0EA5E9] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#0284C7] transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </ModalShell>
  );
}

