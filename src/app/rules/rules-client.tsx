"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createRuleAction,
  deactivateRuleAction,
  deleteDraftRuleAction,
  updateRuleAction,
} from "./actions";

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

// Demo rules surfaced in the rules list. Curated to one rule per
// verdict type so a visitor sees the full spread without scrolling.
const DEMO_RULE_NAMES: ReadonlyArray<string> = [
  "Series B Quiet Period",
  "Earnings Quiet Period — Q2 2026",
  "Competitor Mentions",
  "Pricing Claims",
];

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

  // R3 modal toggles — the four entry points sit above the rules list.
  const [openModal, setOpenModal] = useState<
    "template" | "paste" | "upload" | "build" | null
  >(null);

  // "+ Add a rule" dropdown — opens a small popover with three
  // entry-point rows (template / paste / build). Click-outside
  // handling lives in the dropdown component below.
  const [addRuleDropdownOpen, setAddRuleDropdownOpen] = useState(false);

  // Edit-rule sheet (R7-R8). Holds the rule being edited; null = closed.
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);

  // Mobile-only per-row "Show details" toggle. The desktop table
  // shows every column at once; mobile collapses to two columns
  // (name + actions) and reveals the rest inline on toggle.
  const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(
    new Set(),
  );

  // B5 — inline deactivate notice. When set, a banner renders at the
  // top of the rules-list area for 5 seconds. The underlying card
  // moves to the Deactivated tab on the same render via the data
  // refresh, but the notice stays visible on the current tab to give
  // the user feedback about what happened.
  const [deactivateNotice, setDeactivateNotice] = useState<{
    ruleName: string;
    timestamp: string;
  } | null>(null);

  // Post-authorization success state.
  const [justAuthorized, setJustAuthorized] = useState(activatedFromConfirm);

  function clearActivated() {
    setJustAuthorized(false);
    if (activatedFromConfirm) {
      router.replace("/rules");
    }
  }

  const now = Date.now();

  const classified = useMemo(() => {
    return rules.map((r) => ({ rule: r, status: classifyLifecycle(r, now) }));
  }, [rules, now]);

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
    return { total: rules.length, active, expiring, silent, draft, deactivated };
  }, [classified, rules.length]);

  // Demo curated list — sorted to spec order.
  const demoRules = useMemo(() => {
    return classified
      .filter(({ rule, status }) => {
        if (!DEMO_RULE_NAMES.includes(rule.name)) return false;
        return status !== "DEACTIVATED" && status !== "DRAFT";
      })
      .sort(
        (a, b) =>
          DEMO_RULE_NAMES.indexOf(a.rule.name) -
          DEMO_RULE_NAMES.indexOf(b.rule.name),
      )
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
    for (const r of rules) {
      if (!r.effective_from) continue;
      const ts = new Date(r.effective_from).getTime();
      if (Number.isFinite(ts) && ts > pickTs) {
        pickTs = ts;
        pick = r;
      }
    }
    return pick;
  }, [rules]);

  // Most recent trigger across all rules — drives the page-header
  // subhead. Null when no rule has fired.
  const lastTriggeredOverall = useMemo(() => {
    let pick: string | null = null;
    let pickTs = -Infinity;
    for (const r of rules) {
      if (!r.last_triggered) continue;
      const ts = new Date(r.last_triggered).getTime();
      if (Number.isFinite(ts) && ts > pickTs) {
        pickTs = ts;
        pick = r.last_triggered;
      }
    }
    return pick;
  }, [rules]);

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
    | { ok: true; ruleName: string; keywordCount: number }
    | { ok: false; error: string };

  function closeAndRefresh() {
    setOpenModal(null);
    router.refresh();
  }

  async function handleEnableTemplate(
    t: BuiltInTemplate,
  ): Promise<CreateResult> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await createRuleAction({
      name: t.name,
      description: `Catches ${t.catches}.`,
      // C1 — verdict reflects the template's declared severity.
      // BLOCK templates fire a hard stop; REVIEW templates route to
      // principal review.
      verdict: t.severity === "BLOCK" ? "block" : "review",
      keywords: t.keywords,
      scope: "all_speakers",
      effective_from: today,
      effective_until: null,
      regulatory_basis: t.basis,
      authorized_by: "",
      rule_status: "active",
    });
    return result.ok
      ? { ok: true, ruleName: result.ruleName, keywordCount: result.keywordCount }
      : { ok: false, error: result.error };
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
    return result.ok
      ? { ok: true, ruleName: result.ruleName, keywordCount: result.keywordCount }
      : { ok: false, error: result.error };
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
    return result.ok
      ? { ok: true, ruleName: result.ruleName, keywordCount: result.keywordCount }
      : { ok: false, error: result.error };
  }

  async function handleAuthorizeDraft(id: string) {
    const result = await updateRuleAction({
      ruleId: id,
      name: rules.find((r) => r.id === id)?.name ?? "",
      description: rules.find((r) => r.id === id)?.description ?? "",
      verdict: rules.find((r) => r.id === id)?.verdict ?? "review",
      keywords: rules.find((r) => r.id === id)?.keywords ?? [],
      scope: rules.find((r) => r.id === id)?.scope ?? "all_speakers",
      effective_from:
        rules.find((r) => r.id === id)?.effective_from ??
        new Date().toISOString(),
      effective_until: rules.find((r) => r.id === id)?.effective_until ?? null,
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

  function handleDeactivate(id: string, ruleName: string) {
    const ok = window.confirm(
      `Deactivate "${ruleName}"? ERA CUE will stop enforcing this rule immediately.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await deactivateRuleAction({
          ruleId: id,
          reason: "Deactivated by principal",
        });
        if (!result.ok) {
          // FIX 3 — surface the failure inline rather than via a
          // native alert dialog. Production deploys will rarely hit
          // this path (demo mode falls through with a simulated
          // success); when it does, the visitor sees the error in
          // the notice slot the success message normally uses.
          setDeactivateNotice({
            ruleName: `Could not deactivate "${ruleName}": ${result.error}`,
            timestamp: new Date().toLocaleString("en-US"),
          });
          window.setTimeout(() => setDeactivateNotice(null), 5000);
          return;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setDeactivateNotice({
          ruleName: `Could not deactivate "${ruleName}": ${message}`,
          timestamp: new Date().toLocaleString("en-US"),
        });
        window.setTimeout(() => setDeactivateNotice(null), 5000);
        return;
      }
      // B5 — set the inline notice + auto-dismiss after 5 seconds.
      // The router.refresh() that follows moves the card to the
      // Deactivated tab; the notice is local component state so it
      // persists across the refresh.
      const ts = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      setDeactivateNotice({ ruleName, timestamp: ts });
      window.setTimeout(() => setDeactivateNotice(null), 5000);
      router.refresh();
    });
  }

  async function handleSaveEdit(updates: {
    name: string;
    description: string;
    verdict: string;
    keywords: string[];
    effective_from: string;
    effective_until: string | null;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!editingRule) return { ok: false, error: "No rule selected." };
    const result = await updateRuleAction({
      ruleId: editingRule.id,
      name: updates.name,
      description: updates.description,
      verdict: updates.verdict,
      keywords: updates.keywords,
      scope: editingRule.scope ?? "all_speakers",
      effective_from: updates.effective_from,
      effective_until: updates.effective_until,
    });
    if ("success" in result) return { ok: true };
    return { ok: false, error: result.error };
  }

  // B6 — closes the edit sheet after the user clicks Done on the
  // inline confirmation footer. Refreshes the rules list so the
  // re-authorized rule (and its updated keywords) renders.
  function closeEditAndRefresh() {
    setEditingRule(null);
    router.refresh();
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
  // tabs / status bar / MOAT bar entirely and presents the three
  // setup paths as the primary content. Demo mode is excluded
  // because the seed always supplies rules.
  if (!IS_DEMO_MODE && totalActiveLike === 0 && counts.deactivated === 0) {
    const setupCards: ReadonlyArray<{
      key: "template" | "paste" | "build";
      title: string;
      description: string;
    }> = [
      {
        key: "template",
        title: "Start from a template",
        description:
          "Choose from regulated industry or campaign templates. Active in 30 seconds.",
      },
      {
        key: "paste",
        title: "Import from existing policy",
        description:
          "Paste your communications policy, WSP, or legal brief. ERA CUE extracts the rules.",
      },
      {
        key: "build",
        title: "Build from scratch",
        description:
          "Define rule name, keywords, severity, and activation date.",
      },
    ];

    return (
      <main className="min-h-screen bg-[#0F172A]">
        <div className="max-w-[960px] mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl md:text-4xl font-light text-[#F8FAFC] mb-3 leading-tight"
            >
              Set up your governance rules.
            </h1>
            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-2xl mx-auto">
              ERA CUE checks every draft against your active rules
              before publication. Configure once — enforced on every
              submission.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {setupCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setOpenModal(card.key)}
                className="bg-[#1E293B] border border-[#334155] rounded p-6 cursor-pointer hover:border-[#0EA5E9] transition-colors text-left flex flex-col min-h-[160px]"
              >
                <div className="text-[#F8FAFC] font-medium text-base">
                  {card.title}
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

          <p className="text-[#94A3B8] text-sm text-center mt-6 leading-relaxed">
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

  // ---- main view (returning-user, dark theme, table layout) ---------------
  return (
    <main className="min-h-screen bg-[#0F172A] pb-24">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
        {/* CHANGE 6 — page header. Title + active count subhead on the
            left, "+ Add a rule" dropdown on the right. */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div className="min-w-0">
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-3xl font-light text-[#F8FAFC] leading-tight"
            >
              Governance Rules
            </h1>
            <p className="text-sm text-[#94A3B8] mt-2">
              <span className="text-[#F8FAFC] font-medium">
                {rulesActiveCount}
              </span>{" "}
              active · Last checked:{" "}
              <span className="text-[#F8FAFC] font-medium">
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
          <div className="bg-[#1E293B] border border-[#334155] rounded px-4 py-3 flex-1">
            <div className="text-[#F8FAFC] text-2xl font-bold">
              {rulesActiveCount}
            </div>
            <div className="text-[#64748B] text-xs uppercase tracking-widest mt-1">
              Active rules
            </div>
          </div>
          <div className="bg-[#1E293B] border border-[#334155] rounded px-4 py-3 flex-1">
            <div className="text-[#F8FAFC] text-2xl font-bold">
              {weeklyTriggerCount}
            </div>
            <div className="text-[#64748B] text-xs uppercase tracking-widest mt-1">
              Triggers this week
            </div>
          </div>
          <div className="bg-[#1E293B] border border-[#334155] rounded px-4 py-3 flex-1">
            <div className="text-[#F8FAFC] text-sm font-medium truncate">
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

        {/* Success banner — restyled for dark theme */}
        {!IS_DEMO_MODE && justAuthorized && (
          <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/40 rounded p-5 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#F8FAFC] mb-1">
                  Your governance rules are live.
                </div>
                <div className="text-sm text-[#94A3B8]">
                  ERA CUE is now checking every draft your team submits
                  against these rules before publication.
                </div>
                <a
                  href="/submit"
                  className="bg-[#0EA5E9] text-white font-mono text-sm font-medium px-4 py-2 rounded mt-4 inline-block hover:bg-[#0284C7] transition-colors"
                >
                  Check your first draft →
                </a>
              </div>
              <button
                type="button"
                onClick={clearActivated}
                aria-label="Dismiss"
                className="text-[#94A3B8] hover:text-[#F8FAFC] font-mono text-base leading-none cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* B5 — inline deactivate notice. Restyled for dark theme. */}
        {deactivateNotice && (
          <div className="bg-[#1E293B] border border-[#F59E0B]/40 rounded px-4 py-3 mb-4 flex items-start justify-between gap-4">
            <div className="text-sm text-[#94A3B8] leading-relaxed">
              <span className="font-semibold text-[#F8FAFC]">
                {deactivateNotice.ruleName}
              </span>{" "}
              deactivated. Drafts submitted after {deactivateNotice.timestamp}{" "}
              will not be checked against this rule. The rule record and all
              prior triggers are preserved.
            </div>
            <button
              type="button"
              onClick={() => setDeactivateNotice(null)}
              aria-label="Dismiss"
              className="text-[#94A3B8] hover:text-[#F8FAFC] font-mono text-base leading-none cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab bar — dark theme */}
        {!IS_DEMO_MODE && (
          <div className="flex gap-0 border-b border-[#334155] mb-5 overflow-x-auto">
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
                      : "border-transparent text-[#94A3B8] hover:text-[#F8FAFC]"
                  }`}
                >
                  {t.label}
                  {t.count !== null && t.count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        t.alert
                          ? "bg-[#F59E0B] text-white"
                          : "bg-[#334155] text-[#94A3B8]"
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

        {/* History tab — dark theme */}
        {!IS_DEMO_MODE && activeTab === "history" && (
          <>
            {rules.length === 0 ? (
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
                <div className="divide-y divide-[#1E293B]">
                  {[...rules]
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
                              <div className="text-sm font-medium text-[#F8FAFC] truncate">
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
                <div className="font-mono text-[9px] text-[#64748B] italic text-center pt-6 mt-6 border-t border-[#334155]">
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
            onEdit={(r) => setEditingRule(r)}
            onDeactivate={(r) => handleDeactivate(r.id, r.name)}
            onAuthorizeDraft={(id) => handleAuthorizeDraft(id)}
            onDeleteDraft={(id) => handleDeleteDraft(id)}
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

      {editingRule && (
        <EditRuleSheet
          rule={editingRule}
          onClose={closeEditAndRefresh}
          onSave={handleSaveEdit}
        />
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

function AddRuleDropdown({
  open,
  setOpen,
  onSelect,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (key: "template" | "paste" | "build") => void;
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

  const options: ReadonlyArray<{
    key: "template" | "paste" | "build";
    title: string;
    description: string;
  }> = [
    {
      key: "template",
      title: "From a template",
      description: "Regulated industry or campaign templates",
    },
    {
      key: "paste",
      title: "From existing policy",
      description: "Paste your WSP, policy doc, or legal brief",
    },
    {
      key: "build",
      title: "Build from scratch",
      description: "Define keywords, severity, and dates",
    },
  ];

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
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#1E293B] border border-[#334155] rounded shadow-xl z-40">
          {options.map((opt, i) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              className={`w-full text-left px-4 py-3 hover:bg-[#0F172A] transition-colors cursor-pointer ${
                i < options.length - 1 ? "border-b border-[#334155]" : ""
              }`}
            >
              <div className="text-sm font-medium text-[#F8FAFC]">
                {opt.title}
              </div>
              <div className="text-xs text-[#94A3B8] mt-0.5">
                {opt.description}
              </div>
            </button>
          ))}
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
  onEdit: (rule: RuleRow) => void;
  onDeactivate: (rule: RuleRow) => void;
  onAuthorizeDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  pending: boolean;
};

function ruleSeverityBadge(verdict: string) {
  const v = (verdict || "").toLowerCase();
  if (v === "block") {
    return (
      <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-[#EF4444] text-white shrink-0">
        Block
      </span>
    );
  }
  if (v === "review" || v === "escalate") {
    return (
      <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-[#F59E0B] text-white shrink-0">
        Review
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-[#334155] text-[#94A3B8] shrink-0">
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

function RulesTable({
  rules,
  now,
  expandedMobileRows,
  onToggleMobile,
  onEdit,
  onDeactivate,
  onAuthorizeDraft,
  onDeleteDraft,
  pending,
}: RulesTableProps) {
  if (rules.length === 0) {
    return (
      <div className="bg-[#1E293B] border border-[#334155] rounded p-12 text-center text-[#94A3B8] text-sm">
        No rules in this view.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table — hidden under md breakpoint */}
      <div className="hidden md:block w-full overflow-x-auto bg-[#0F172A] border border-[#334155] rounded">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0F172A] border-b border-[#334155]">
            <tr>
              {[
                "Rule name",
                "Status",
                "Keywords",
                "Last triggered",
                "Triggers",
                "Authorized by",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] px-4 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const status = classifyLifecycle(r, now);
              const isDraft = status === "DRAFT";
              const lifecycle = lifecycleStateLabel(r, now);
              const triggers = r.trigger_count ?? 0;
              const keywordCount = (r.keywords ?? []).length;
              return (
                <tr
                  key={r.id}
                  id={`rule-${r.id}`}
                  className="border-b border-[#1E293B] hover:bg-[#1E293B]/60 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-[#F8FAFC] truncate">
                        {r.name}
                      </span>
                      {ruleSeverityBadge(r.verdict)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-sm ${lifecycle.className}`}
                    >
                      {lifecycle.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8] text-sm">
                    {keywordCount} keyword{keywordCount !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8] text-sm">
                    {r.last_triggered ? fmtDate(r.last_triggered) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-[#F8FAFC] font-mono">
                    {triggers}
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8] text-xs">
                    {authorizedByLabel(r)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {isDraft ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onAuthorizeDraft(r.id)}
                            className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                          >
                            Authorize
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteDraft(r.id)}
                            className="text-[#94A3B8] text-xs hover:text-[#EF4444] cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      ) : status !== "DEACTIVATED" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeactivate(r)}
                            disabled={pending}
                            className="text-[#0EA5E9] text-xs hover:underline cursor-pointer disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        </>
                      ) : (
                        <span className="text-[#64748B] text-xs">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — name + status + Actions visible; "Show
          details" toggles the rest inline. Visible only under md. */}
      <div className="md:hidden space-y-2">
        {rules.map((r) => {
          const status = classifyLifecycle(r, now);
          const isDraft = status === "DRAFT";
          const lifecycle = lifecycleStateLabel(r, now);
          const expanded = expandedMobileRows.has(r.id);
          const triggers = r.trigger_count ?? 0;
          const keywordCount = (r.keywords ?? []).length;
          return (
            <div
              key={r.id}
              id={`rule-${r.id}-mobile`}
              className="bg-[#0F172A] border border-[#334155] rounded p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[#F8FAFC] text-sm">
                      {r.name}
                    </span>
                    {ruleSeverityBadge(r.verdict)}
                  </div>
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-sm mt-1 ${lifecycle.className}`}
                  >
                    {lifecycle.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isDraft ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onAuthorizeDraft(r.id)}
                        className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                      >
                        Authorize
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </>
                  ) : status !== "DEACTIVATED" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="text-[#0EA5E9] text-xs hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeactivate(r)}
                        disabled={pending}
                        className="text-[#0EA5E9] text-xs hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleMobile(r.id)}
                className="text-[#94A3B8] text-xs mt-2 hover:text-[#F8FAFC] cursor-pointer"
                aria-expanded={expanded}
              >
                {expanded ? "Hide details" : "Show details"}
              </button>
              {expanded && (
                <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
                  <dt className="text-[#94A3B8]">Keywords</dt>
                  <dd className="text-[#F8FAFC]">
                    {keywordCount} keyword
                    {keywordCount !== 1 ? "s" : ""}
                  </dd>
                  <dt className="text-[#94A3B8]">Last triggered</dt>
                  <dd className="text-[#F8FAFC]">
                    {r.last_triggered ? fmtDate(r.last_triggered) : "Never"}
                  </dd>
                  <dt className="text-[#94A3B8]">Triggers</dt>
                  <dd className="text-[#F8FAFC] font-mono">{triggers}</dd>
                  <dt className="text-[#94A3B8]">Authorized by</dt>
                  <dd className="text-[#F8FAFC]">{authorizedByLabel(r)}</dd>
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </>
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
  const severityClass =
    severity === "BLOCK"
      ? "bg-[#EF4444] text-white"
      : "bg-[#F59E0B] text-white";
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
      <a
        href="/submit"
        className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] transition-colors inline-block"
      >
        Check a draft against this rule →
      </a>
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
  const [confirmation, setConfirmation] = useState<ConfirmationPanelProps | null>(
    null,
  );
  // FIX 3 — inline error keyed by template id so the failed card
  // shows its own retry message rather than blocking the whole grid.
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [tab, setTab] = useState<TemplateTab>("regulated");

  if (confirmation) {
    return (
      <ModalShell title="Rule activated" onClose={onClose}>
        <PostActionConfirmation {...confirmation} />
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
                      setConfirmation({
                        ruleName: result.ruleName,
                        severity: t.severity,
                        keywordCount: result.keywordCount,
                        authorizedBy: "Sarah Chen · GC",
                        activationDateIso: new Date()
                          .toISOString()
                          .slice(0, 10),
                        onBack: onClose,
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
  const [confirmation, setConfirmation] = useState<ConfirmationPanelProps | null>(
    null,
  );

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
  const [confirmation, setConfirmation] = useState<ConfirmationPanelProps | null>(
    null,
  );

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
        setConfirmation({
          ruleName: result.ruleName,
          severity,
          keywordCount: result.keywordCount,
          authorizedBy: "Sarah Chen · GC",
          activationDateIso: activation,
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
            <div className="text-[#EF4444] text-sm mt-2">
              Save failed — {error}. Try again.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ---------- R7-R8 Edit-rule sheet (two-column diff) ------------------------

function EditRuleSheet({
  rule,
  onClose,
  onSave,
}: {
  rule: RuleRow;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    description: string;
    verdict: string;
    keywords: string[];
    effective_from: string;
    effective_until: string | null;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const initialName = rule.name;
  const initialDescription = rule.description ?? "";
  const initialVerdict = rule.verdict ?? "review";
  const initialKeywords = rule.keywords ?? [];
  const initialFrom = rule.effective_from
    ? rule.effective_from.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const initialUntil = rule.effective_until
    ? rule.effective_until.slice(0, 10)
    : "";

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [verdict, setVerdict] = useState(initialVerdict);
  const [chips, setChips] = useState<string[]>(initialKeywords);
  const [from, setFrom] = useState(initialFrom);
  const [until, setUntil] = useState(initialUntil);
  const [busy, setBusy] = useState(false);
  // FIX 4 — inline error state for the re-authorize footer. Replaces
  // the prior alert() so the sheet stays open and surfaces the
  // failure where the visitor expected the success.
  const [saveError, setSaveError] = useState<string | null>(null);
  // B6 — once a re-authorize succeeds the footer flips to a static
  // confirmation row showing the version, the prior keyword count and
  // the new keyword count. The "Done" button calls onClose, which the
  // parent wires to closeEditAndRefresh. FIX 4 also auto-closes after
  // 2 seconds via a useEffect below.
  const [completed, setCompleted] = useState<{
    version: number;
    oldCount: number;
    newCount: number;
  } | null>(null);

  // FIX 4 — auto-close after 2s once `completed` lands.
  useEffect(() => {
    if (!completed) return;
    const id = window.setTimeout(() => onClose(), 2000);
    return () => window.clearTimeout(id);
  }, [completed, onClose]);

  function discard() {
    setName(initialName);
    setDescription(initialDescription);
    setVerdict(initialVerdict);
    setChips(initialKeywords);
    setFrom(initialFrom);
    setUntil(initialUntil);
  }

  async function reauthorize() {
    setBusy(true);
    setSaveError(null);
    try {
      const result = await onSave({
        name,
        description,
        verdict,
        keywords: chips,
        effective_from: new Date(from).toISOString(),
        effective_until: until ? new Date(until).toISOString() : null,
      });
      if (result.ok) {
        // Version 2 is the static post-edit value — the persisted
        // rule schema doesn't track an explicit version number, so
        // re-authorizations always read as "Version 2" relative to
        // the session's starting state.
        setCompleted({
          version: 2,
          oldCount: initialKeywords.length,
          newCount: chips.length,
        });
      } else {
        setSaveError(result.error);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const nameDiff = name !== initialName;
  const descDiff = description !== initialDescription;
  const verdictDiff = verdict !== initialVerdict;
  const fromDiff = from !== initialFrom;
  const untilDiff = until !== initialUntil;
  const keywordsDiff =
    initialKeywords.length !== chips.length ||
    initialKeywords.some((k) => !chips.includes(k)) ||
    chips.some((k) => !initialKeywords.includes(k));

  const removedKeywords = initialKeywords.filter((k) => !chips.includes(k));
  const addedKeywords = chips.filter((k) => !initialKeywords.includes(k));
  const unchangedKeywords = chips.filter((k) => initialKeywords.includes(k));

  function diffBorder(active: boolean) {
    return active ? "border-l-2 border-[#0EA5E9] pl-4" : "";
  }

  return (
    <ModalShell title="Edit rule" onClose={onClose} maxWidth="max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left — current live rule, read-only */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mb-3">
            Currently active — will remain active until you re-authorize
          </div>
          <div className="space-y-4 text-[#94A3B8]">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1.5">
                Rule name
              </label>
              <div className="text-sm">{initialName || "—"}</div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1.5">
                Description
              </label>
              <div className="text-sm whitespace-pre-wrap">
                {initialDescription || "—"}
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1.5">
                Verdict
              </label>
              <div className="text-sm font-mono uppercase">
                {initialVerdict}
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1.5">
                Keywords
              </label>
              <div className="flex flex-wrap gap-1">
                {initialKeywords.length === 0 ? (
                  <span className="text-xs">—</span>
                ) : (
                  initialKeywords.map((k) => (
                    <span
                      key={k}
                      className="font-mono text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                    >
                      {k}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest block mb-1.5">
                  Effective from
                </label>
                <div className="text-sm font-mono">
                  {initialFrom || "—"}
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest block mb-1.5">
                  Effective until
                </label>
                <div className="text-sm font-mono">{initialUntil || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right — editable */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#0EA5E9] mb-3">
            Proposed update
          </div>
          <div className="space-y-4">
            <div className={diffBorder(nameDiff)}>
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
            <div className={diffBorder(descDiff)}>
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
            <div className={diffBorder(verdictDiff)}>
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
                Verdict
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {(["block", "escalate", "review", "guide"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVerdict(v)}
                    className={`font-mono text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                      verdict === v
                        ? "bg-[#0F172A] text-white border-[#0F172A]"
                        : "bg-white border-[#E2E8F0] text-[#64748B]"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className={diffBorder(keywordsDiff)}>
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
                Keywords
              </label>
              {(removedKeywords.length > 0 || addedKeywords.length > 0 || unchangedKeywords.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {unchangedKeywords.map((k) => (
                    <span
                      key={`u-${k}`}
                      className="font-mono text-[10px] bg-white text-[#475569] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                    >
                      {k}
                    </span>
                  ))}
                  {addedKeywords.map((k) => (
                    <span
                      key={`a-${k}`}
                      className="font-mono text-[10px] bg-[#0EA5E9]/20 text-[#0EA5E9] px-2 py-0.5 rounded-sm flex items-center gap-1.5"
                    >
                      {k}
                      <button
                        type="button"
                        onClick={() => setChips(chips.filter((c) => c !== k))}
                        className="hover:opacity-70 cursor-pointer"
                        aria-label={`Remove ${k}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {removedKeywords.map((k) => (
                    <span
                      key={`r-${k}`}
                      className="font-mono text-[10px] bg-[#EF4444]/20 text-[#EF4444] px-2 py-0.5 rounded-sm line-through"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
              <ChipInput chips={chips} onChange={setChips} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={diffBorder(fromDiff)}>
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
                  Effective from
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
                />
              </div>
              <div className={diffBorder(untilDiff)}>
                <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
                  Effective until
                </label>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {completed ? (
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm px-4 py-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="text-sm text-[#0D1B2A] leading-relaxed">
              <span className="font-semibold">
                Version {completed.version} authorized.
              </span>{" "}
              Previously: {completed.oldCount} keyword
              {completed.oldCount !== 1 ? "s" : ""}. Now:{" "}
              {completed.newCount} keyword
              {completed.newCount !== 1 ? "s" : ""}. All future submissions
              will be checked against the updated rule.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] transition-colors cursor-pointer shrink-0"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={reauthorize}
              disabled={busy || !name.trim()}
              className={`bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors ${
                busy
                  ? "opacity-50 cursor-not-allowed animate-pulse"
                  : "cursor-pointer"
              }`}
            >
              {busy ? "Saving..." : "Re-authorize →"}
            </button>
            <button
              type="button"
              onClick={discard}
              className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Discard changes
            </button>
          </div>
          {saveError && (
            <div className="text-[#EF4444] text-sm mt-2">
              Save failed — {saveError}. Try again.
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
