"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

// Shape of one extracted rule. Mirrors the JSON the model is asked to
// return; the UI uses it directly to render the review-and-authorize cards.
export type SuggestedRule = {
  name: string;
  rule_type: "block" | "escalate" | "review" | "guide";
  description: string;
  keywords: string[];
  wsp_reference: string;
  regulatory_basis: string;
};

export type ExtractRulesResult =
  | { ok: true; suggested_rules: SuggestedRule[] }
  | { ok: false; error: string };

const SYSTEM_PROMPT_WSP = `You are a FINRA compliance expert. Extract governance rules from Written Supervisory Procedures text.

For each rule identified, specify:
- name: short rule name
- rule_type: "block" | "escalate" | "review" | "guide"
- description: what the rule prohibits or requires
- keywords: specific words/phrases that trigger it
- wsp_reference: the section or paragraph reference
- regulatory_basis: FINRA/SEC rule that underlies it

Be conservative with rule_type:
- "block" only for clear hard prohibitions
- "escalate" for required principal review
- "review" for items needing attention
- "guide" for best practice reminders

Respond with JSON only:
{
  "suggested_rules": [...]
}`;

// Manual mode — user typed plain-English rules, one per line. We don't
// expect WSP-style headers, so the prompt focuses on faithful conversion
// rather than extraction.
const SYSTEM_PROMPT_MANUAL = `Convert each line into a structured governance rule. Each line is one rule description. Extract keywords from the description. Be precise.

For each line, produce:
- name: short rule name (5 words max)
- rule_type: "block" | "escalate" | "review" | "guide"
- description: one sentence explaining what this governs
- keywords: 3-10 specific trigger words/phrases drawn from the description
- wsp_reference: leave empty string ""
- regulatory_basis: best-fit FINRA/SEC citation, or empty string if none

Verdict mapping:
- "block" when the line says "block", "prohibit", "forbid", "no"
- "escalate" when the line says "escalate", "review by", "needs approval"
- "review" when the line says "flag", "consistency", "check"
- "guide" otherwise

Respond with JSON only:
{
  "suggested_rules": [...]
}`;

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = { content?: AnthropicContentBlock[] };

function parseSuggested(text: string): SuggestedRule[] {
  try {
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as { suggested_rules?: unknown };
    const list = parsed.suggested_rules;
    if (!Array.isArray(list)) return [];
    const out: SuggestedRule[] = [];
    for (const r of list) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : null;
      const rule_type =
        o.rule_type === "block" || o.rule_type === "escalate" || o.rule_type === "review" || o.rule_type === "guide"
          ? o.rule_type
          : "review";
      const description = typeof o.description === "string" ? o.description : "";
      const keywords = Array.isArray(o.keywords) ? o.keywords.filter((k): k is string => typeof k === "string") : [];
      const wsp_reference = typeof o.wsp_reference === "string" ? o.wsp_reference : "";
      const regulatory_basis = typeof o.regulatory_basis === "string" ? o.regulatory_basis : "";
      if (!name) continue;
      out.push({ name, rule_type, description, keywords, wsp_reference, regulatory_basis });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Ask Claude to read a section of WSP text (or a list of plain-English
 * rule descriptions in manual mode) and extract structured governance
 * rules. The user reviews the result in the UI before anything is
 * written to the database — see createRulesFromImport.
 *
 * `isManual` toggles between the WSP-extraction prompt (treats input as
 * a policy document) and the manual prompt (treats each line as one
 * rule). Defaults to false so the existing single-arg call sites keep
 * working without change.
 */
export async function extractRulesFromWsp(
  wspText: string,
  isManual = false,
): Promise<ExtractRulesResult> {
  if (!wspText.trim()) {
    return { ok: false, error: isManual ? "Rule text required." : "WSP text required." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY not configured — extraction unavailable in this environment.",
    };
  }

  const systemPrompt = isManual ? SYSTEM_PROMPT_MANUAL : SYSTEM_PROMPT_WSP;
  const userIntro = isManual
    ? "Convert each of these plain-English rules into structured form (one per line):"
    : "Extract compliance rules from this WSP section:";

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `${userIntro}\n\n${wspText}`,
          },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, error: `Claude API ${response.status}: ${body.slice(0, 200)}` };
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");

  return { ok: true, suggested_rules: parseSuggested(text) };
}

// ---------- Bulk authorize -----------------------------------------------

export type AuthorizeResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

/**
 * Persist a user-curated subset of WSP-extracted rules. Each rule becomes
 * an active row in the rules table effective immediately, no end date.
 * Authorization is recorded in the audit trail by the caller via the
 * existing rule lifecycle.
 */
export async function authorizeSuggestedRulesAction(
  rules: SuggestedRule[],
): Promise<AuthorizeResult> {
  if (rules.length === 0) return { ok: false, error: "No rules selected." };
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const rows = rules.map((r) => ({
    org_id: DEMO_ORG_ID,
    name: r.name,
    // The existing rules table maps verdicts onto the `rule_type` column.
    rule_type: r.rule_type,
    description: `${r.description} Regulatory basis: ${r.regulatory_basis}.`,
    keywords: r.keywords,
    scope: "all_speakers",
    rule_status: "active",
    effective_from: now,
    effective_to: null,
    wsp_reference: r.wsp_reference,
  }));

  const { error } = await sb.from("rules").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, inserted: rows.length };
}
