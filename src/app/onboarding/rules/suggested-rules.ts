/**
 * Static catalogue of starter rules per firm type. The onboarding rules
 * step shows these as authorize-by-checkbox cards so the user gets a
 * working policy in 60 seconds without writing anything.
 *
 * Designed to dovetail with scripts/fix-rules.ts — all keyword sets are
 * narrow enough to avoid the false-positive issues that bare verbs
 * (e.g. "signed", "pricing") produce.
 */
import type { FirmType, SuggestedRuleInput } from "../actions";

const COMMON_AI: SuggestedRuleInput = {
  name: "AI Content Disclosure",
  rule_type: "guide",
  description:
    "Communications containing AI-generated content may require disclosure under EU AI Act Article 50 and FINRA 2026 GenAI guidance.",
  keywords: [],
  wsp_reference: "Section 6.1 — AI-Generated Content",
  regulatory_basis: "EU AI Act Art. 50 · FINRA 2026 GenAI Report",
};

const FINRA_PERFORMANCE: SuggestedRuleInput = {
  name: "Performance Projections",
  rule_type: "block",
  description:
    "Projected or guaranteed performance claims are prohibited in retail communications under FINRA Rule 2210(d)(1)(F).",
  keywords: [
    "guaranteed return",
    "guaranteed yield",
    "will return",
    "no risk",
    "risk-free return",
    "projected return of",
    "target return of",
  ],
  wsp_reference: "Section 4.2 — Performance Communications",
  regulatory_basis: "FINRA Rule 2210(d)(1)(F)",
};

const FINRA_TESTIMONIALS: SuggestedRuleInput = {
  name: "Testimonials Without Disclosure",
  rule_type: "escalate",
  description:
    "Client testimonials and endorsements require specific disclosures under FINRA Rule 2210(d)(6) and the SEC Marketing Rule.",
  keywords: ["my client said", "client testimonial", "client endorses", "client recommends"],
  wsp_reference: "Section 4.5 — Testimonials and Endorsements",
  regulatory_basis: "FINRA Rule 2210(d)(6) · SEC Marketing Rule",
};

const REG_FD: SuggestedRuleInput = {
  name: "Forward Guidance Restriction",
  rule_type: "block",
  description:
    "Forward-looking financial guidance is restricted during earnings quiet periods under Reg FD.",
  keywords: ["projection", "guidance", "outlook", "forecast", "anticipate", "next quarter"],
  wsp_reference: "Section 7.4 — Earnings Communications",
  regulatory_basis: "FINRA Rule 2210(d) · SEC Reg FD",
};

const SEC_MARKETING: SuggestedRuleInput = {
  name: "Performance Advertising Standards",
  rule_type: "escalate",
  description:
    "Performance advertising must follow the SEC Marketing Rule's gross/net presentation requirements.",
  keywords: ["track record", "outperformed", "best-performing", "annualized return"],
  wsp_reference: "Section 4.3 — Performance Advertising",
  regulatory_basis: "SEC Marketing Rule · Rule 206(4)-1",
};

const QUIET_PERIOD: SuggestedRuleInput = {
  name: "Deal Quiet Period",
  rule_type: "block",
  description:
    "No deal-specific commentary during active fundraising or M&A quiet windows.",
  keywords: ["fundraising", "term sheet", "valuation", "round close", "deal close"],
  wsp_reference: "Section 5.1 — Deal Communications",
  regulatory_basis: "FINRA Rule 2210 · SEC Rule 134/135",
};

const BRAND_TONE: SuggestedRuleInput = {
  name: "Brand Voice Consistency",
  rule_type: "review",
  description:
    "Flag drafts that diverge from the firm's approved brand voice and message house.",
  keywords: ["competitor", "industry-leading", "best-in-class", "world-class"],
  wsp_reference: "Section 2.1 — Brand Standards",
  regulatory_basis: "Brand governance",
};

export function suggestedRulesForFirmType(firmType: FirmType): SuggestedRuleInput[] {
  switch (firmType) {
    case "broker_dealer":
      return [FINRA_PERFORMANCE, FINRA_TESTIMONIALS, COMMON_AI];
    case "rIA":
      return [SEC_MARKETING, FINRA_TESTIMONIALS, COMMON_AI];
    case "public_company":
      return [REG_FD, FINRA_TESTIMONIALS, COMMON_AI];
    case "investment_bank":
      return [QUIET_PERIOD, FINRA_PERFORMANCE, COMMON_AI];
    case "non_regulated":
      return [BRAND_TONE, COMMON_AI];
    default:
      return [FINRA_PERFORMANCE, COMMON_AI];
  }
}
