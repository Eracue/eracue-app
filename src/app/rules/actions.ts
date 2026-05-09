"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

// Demo-mode resilience. NEXT_PUBLIC_DEMO_MODE is inlined at build
// time, so reading it on the server returns the same value the client
// sees. When the live database write fails (or is unreachable) inside
// a demo deploy, we'd rather return a simulated-success result than
// dump the visitor on a "save failed" error — the demo's whole point
// is to walk the flow end-to-end. The 800ms delay matches the
// modal's loading-state animation rhythm.
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Schema notes:
//   • DB column is `rule_type` (not `verdict`) — we accept verdict-style names
//     in inputs and write to the underlying column.
//   • DB column is `effective_to` (not `effective_until`).
//   • No `is_active` column (the existing app derives "active" from dates +
//     rule_status). Skipped on insert/update.
//   • No `authorized_by` column on rules. Skipped on insert; the principal
//     identity comes from the audit trail / fixed demo principal.

type DeactivateInput = { ruleId: string; reason: string };
type DeactivateResult = { ok: true } | { ok: false; error: string };

export async function deactivateRuleAction(
  input: DeactivateInput
): Promise<DeactivateResult> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("rules")
      .update({
        rule_status: "deactivated",
        deactivated_at: new Date().toISOString(),
        deactivated_reason: input.reason,
      })
      .eq("id", input.ruleId)
      .eq("org_id", DEMO_ORG_ID);
    if (error) {
      if (IS_DEMO_MODE) {
        await delay(800);
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (IS_DEMO_MODE) {
      await delay(800);
      return { ok: true };
    }
    return { ok: false, error: message };
  }
}

export async function reactivateRuleAction(
  input: { ruleId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("rules")
      .update({
        rule_status: "active",
        deactivated_at: null,
        deactivated_reason: null,
      })
      .eq("id", input.ruleId)
      .eq("org_id", DEMO_ORG_ID);
    if (error) {
      if (IS_DEMO_MODE) {
        await delay(800);
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (IS_DEMO_MODE) {
      await delay(800);
      return { ok: true };
    }
    return { ok: false, error: message };
  }
}

// Hard-delete a draft rule. Only allowed when rule_status === "draft"
// — authorized rules go through deactivateRuleAction so the audit
// trail is preserved. The Drafts tab "Delete" action calls this.
type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteDraftRuleAction(
  ruleId: string,
): Promise<DeleteResult> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("rules")
      .delete()
      .eq("id", ruleId)
      .eq("org_id", DEMO_ORG_ID)
      .eq("rule_status", "draft");
    if (error) {
      if (IS_DEMO_MODE) {
        await delay(800);
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (IS_DEMO_MODE) {
      await delay(800);
      return { ok: true };
    }
    return { ok: false, error: message };
  }
}

// Hard-delete a rule by id + org_id, regardless of status. Used by the
// rules-table Delete affordance (only surfaced on rules with zero
// triggers, so deletion never erases a fired-rule audit chain). The
// IS_DEMO_MODE fallback is intentionally omitted here so real DB
// errors surface to the operator and the Vercel function logs.
export async function deleteRuleAction(
  ruleId: string,
): Promise<DeleteResult> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("rules")
      .delete()
      .eq("id", ruleId)
      .eq("org_id", DEMO_ORG_ID);
    if (error) {
      console.error("deleteRuleAction DB error:", JSON.stringify(error));
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(
      "deleteRuleAction caught:",
      e instanceof Error ? e.message : String(e),
    );
    return { ok: false, error: message };
  }
}

export type CreateRuleInput = {
  name: string;
  description: string;
  verdict: string; // 'block' | 'escalate' | 'review' | 'guide'
  keywords: string[];
  scope: string;
  effective_from: string;
  effective_until: string | null;
  regulatory_basis: string;
  authorized_by: string;
  // Optional pointer to the firm's Written Supervisory Procedures section
  // that this rule enforces. Spread conditionally so older schemas still work.
  wsp_reference?: string;
  // Lifecycle status. Defaults to "active" — pass "draft" to land the
  // rule in the Drafts tab without firing it on submissions.
  rule_status?: "active" | "draft";
};
type CreateRuleResult =
  | { ok: true; ruleId: string; ruleName: string; keywordCount: number }
  | { ok: false; error: string };

export async function createRuleAction(
  input: CreateRuleInput
): Promise<CreateRuleResult> {
  const trimmedWsp = input.wsp_reference?.trim();
  const ruleName = input.name;
  const keywordCount = input.keywords.length;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("rules")
      .insert({
        org_id: DEMO_ORG_ID,
        name: input.name,
        description: input.description,
        // DB column is `rule_type`, not `verdict`. The inputs use the friendlier
        // name; we map here.
        rule_type: input.verdict,
        keywords: input.keywords,
        scope: input.scope,
        rule_status: input.rule_status ?? "active",
        effective_from: input.effective_from,
        // DB column is `effective_to`, not `effective_until`.
        effective_to: input.effective_until,
        ...(trimmedWsp ? { wsp_reference: trimmedWsp } : {}),
      })
      .select("id")
      .single();
    if (error) {
      // DEBUG — IS_DEMO_MODE fallback temporarily disabled here so
      // the real Supabase error reaches the client and the Vercel
      // function logs. Restore the demo fallback once the underlying
      // schema / RLS issue is identified.
      console.error("createRuleAction DB error:", JSON.stringify(error));
      return { ok: false, error: error.message };
    }
    return { ok: true, ruleId: data.id, ruleName, keywordCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // DEBUG — IS_DEMO_MODE fallback temporarily disabled here too.
    console.error(
      "createRuleAction caught:",
      e instanceof Error ? e.message : String(e),
    );
    return { ok: false, error: message };
  }
}

export type UpdateRuleInput = {
  ruleId: string;
  name: string;
  description: string;
  verdict: string;
  keywords: string[];
  scope: string;
  effective_from: string;
  effective_until: string | null;
  wsp_reference?: string;
};
export async function updateRuleAction(
  input: UpdateRuleInput
): Promise<{ success: true } | { error: string }> {
  // Pass `null` when the user clears the field (so existing values get wiped),
  // but skip the column entirely if it wasn't supplied at all (e.g. older
  // callers / pending migration).
  const wspProvided = Object.prototype.hasOwnProperty.call(input, "wsp_reference");
  const wspTrimmed = input.wsp_reference?.trim();
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("rules")
      .update({
        name: input.name,
        description: input.description,
        rule_type: input.verdict,
        keywords: input.keywords,
        scope: input.scope,
        effective_from: input.effective_from,
        effective_to: input.effective_until,
        ...(wspProvided ? { wsp_reference: wspTrimmed || null } : {}),
      })
      .eq("id", input.ruleId)
      .eq("org_id", DEMO_ORG_ID);
    if (error) {
      // FIX 2 — demo mode falls through with simulated success when
      // the live update can't land. The reviewer flow's confirmation
      // panel already handles this state.
      if (IS_DEMO_MODE) {
        await delay(800);
        return { success: true };
      }
      return { error: error.message };
    }
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (IS_DEMO_MODE) {
      await delay(800);
      return { success: true };
    }
    return { error: message };
  }
}

// ---- Claude rule-drafting (server-side so the API key never reaches the browser) ----

export type DraftedRule = {
  name: string;
  description: string;
  verdict: "block" | "escalate" | "review" | "guide";
  keywords: string[];
  scope: string;
  suggested_end_date: string | null;
  regulatory_basis: string;
};
type DraftResult = { ok: true; drafted: DraftedRule } | { ok: false; error: string };

const CLAUDE_SYSTEM_PROMPT = `You are a compliance rule drafting assistant for ERA CUE, a pre-publication governance platform for regulated communications. Given a plain English description of a governance need, draft a structured compliance rule.

Return ONLY valid JSON with exactly these fields:
{
  "name": "Short rule name, 5 words max",
  "description": "One sentence explaining what this governs",
  "verdict": "block" | "escalate" | "review" | "guide",
  "keywords": ["array", "of", "5-15", "trigger", "keywords"],
  "scope": "all_speakers",
  "suggested_end_date": "YYYY-MM-DD or null",
  "regulatory_basis": "FINRA Rule 2210(d) content standard"
}

Verdict selection:
- block: hard stops — quiet periods, embargos, material nonpublic information, forward guidance restrictions
- escalate: needs human review — enterprise claims, competitor mentions, sensitive announcements
- review: consistency checking — pricing, product claims
- guide: advisory tone — formality, style guidance

Keywords: specific trigger words/phrases that would appear in violating communications. Be precise, not overly broad. 5-15 keywords per rule.

Return ONLY the JSON object. No explanation. No markdown.`;

function stubDraft(description: string): DraftedRule {
  // Heuristic offline fallback used when ANTHROPIC_API_KEY isn't configured.
  const lower = description.toLowerCase();
  const isQuiet = /quiet|embargo|fundraising|series\s*[a-z]|raise/.test(lower);
  const isCompetitor = /competitor|fortune|enterprise|sales|customer/.test(lower);
  const isForward = /forward|guidance|earnings|projection/.test(lower);

  if (isQuiet) {
    return {
      name: "Fundraising Quiet Period",
      description: "No fundraising or financing language during the active quiet window.",
      verdict: "block",
      keywords: ["raised", "raising", "fundraising", "round", "series", "valuation", "term sheet", "investors"],
      scope: "all_speakers",
      suggested_end_date: null,
      regulatory_basis: "FINRA Rule 2210(d) content standard",
    };
  }
  if (isCompetitor) {
    return {
      name: "Enterprise Sales Claims",
      description: "Sales claims about enterprise customers must be reviewed by GC before publication.",
      verdict: "escalate",
      keywords: ["fortune 500", "enterprise customer", "signed", "closed deal", "contract", "won"],
      scope: "all_speakers",
      suggested_end_date: null,
      regulatory_basis: "FINRA Rule 2210(d) content standard",
    };
  }
  if (isForward) {
    return {
      name: "Forward Guidance Restriction",
      description: "Block forward-looking financial guidance during the earnings quiet period.",
      verdict: "block",
      keywords: ["expect", "projection", "guidance", "outlook", "forecast", "anticipate", "next quarter"],
      scope: "all_speakers",
      suggested_end_date: null,
      regulatory_basis: "FINRA Rule 2210(d) content standard · SEC Reg FD",
    };
  }
  return {
    name: "Custom Communication Rule",
    description: description.slice(0, 140),
    verdict: "review",
    keywords: [],
    scope: "all_speakers",
    suggested_end_date: null,
    regulatory_basis: "FINRA Rule 2210(d) content standard",
  };
}

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = { content?: AnthropicContentBlock[] };

export type ScopeContext = {
  type: "all" | "role" | "person";
  label: string; // e.g. "All speakers", "CEO role", "Marcus Rivera"
};

function buildScopeAddendum(scope: ScopeContext | undefined): string {
  if (!scope || scope.type === "all") {
    return "\n\nScope context: This rule applies to All speakers. This is an org-wide rule.";
  }
  return `\n\nScope context: This rule applies to ${scope.label}. Tailor the description to make clear this applies to ${scope.label} specifically. Keep keywords broad enough to catch violations regardless of who writes them.`;
}

export async function draftRuleAction(
  description: string,
  scope?: ScopeContext
): Promise<DraftResult> {
  if (!description.trim()) return { ok: false, error: "Description required." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured → offline stub. Still produces a usable draft so the
    // demo flow works without external API access.
    return { ok: true, drafted: stubDraft(description) };
  }

  try {
    const systemWithScope = CLAUDE_SYSTEM_PROMPT + buildScopeAddendum(scope);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemWithScope,
        messages: [{ role: "user", content: description }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Claude API ${response.status}: ${body.slice(0, 200)}` };
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");

    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as DraftedRule;
    return { ok: true, drafted: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: `Could not draft rule: ${msg}` };
  }
}
