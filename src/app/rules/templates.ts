// Shared starter-rule templates used by both the rules-client setup
// view and the /rules/confirm review page. Lives here (and not inside
// rules-client.tsx) because the confirm page needs to look up the same
// rules by firm-type key + index when reconstructing the pending list
// from URL params.
//
// Each template is a CandidateRule — the same shape that
// createRulesFromImport() expects, so a curated subset can be passed
// straight to that server action.

import type { CandidateRuleInput } from "./create-rules-action";

export type CandidateRule = CandidateRuleInput;

// Six firm types the setup view + import-panel Templates tab cycle
// through. Each maps to a TEMPLATES bucket via templatesFor() — the
// PR-agency and executive-team buttons fall back to the broker-dealer
// set since their starter governance overlaps heavily with retail
// communications.
export const FIRM_TYPE_BUTTONS: ReadonlyArray<{ key: string; label: string }> =
  [
    { key: "broker_dealer", label: "Broker-Dealer" },
    { key: "ria", label: "RIA" },
    { key: "public_company", label: "Public Company" },
    { key: "pr_agency", label: "PR Agency" },
    { key: "executive_team", label: "Executive Team" },
    { key: "investment_bank", label: "Investment Bank / PE" },
  ];

// Pre-built starter rules per firm type. Keys correspond to firm_type
// values written by the onboarding firm setup form. The Templates tab
// renders these directly (no Claude call).
export const TEMPLATES: Record<string, CandidateRule[]> = {
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
      description: "Client testimonials require specific disclosures.",
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

// Resolve a firm_type string to the matching template bucket. Falls
// back to broker_dealer when the firm_type is absent or unrecognised
// (PR agencies / executive teams overlap heavily with retail comms).
export function templatesFor(
  firmType: string | null | undefined,
): CandidateRule[] {
  if (!firmType) return TEMPLATES.broker_dealer;
  // Onboarding writes "rIA" (camelCase); accept both casings.
  const key = firmType === "rIA" ? "ria" : firmType;
  return TEMPLATES[key] ?? TEMPLATES.broker_dealer;
}
