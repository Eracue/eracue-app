"use server";

import { createServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

// ---------- Step 1: firm context -----------------------------------------

export type FirmType =
  | "broker_dealer"
  | "rIA"
  | "public_company"
  | "investment_bank"
  | "non_regulated";

export type FirmSetupInput = {
  firmName: string;
  firmType: FirmType;
  regulatoryFramework: string[];
  userTitle: string;
};

export type FirmSetupResult =
  | { ok: true; orgId: string }
  | { ok: false; error: string };

/**
 * Step 1 of onboarding. Creates the org, makes the current user its
 * first principal, and seeds an `onboarding` row with `firm_context`
 * marked complete. Also writes a legacy `users` table row so that the
 * existing draft / rule schema (which references users.id, not
 * auth.users.id) has somewhere to point speaker_id at later.
 */
export async function setupFirmAction(input: FirmSetupInput): Promise<FirmSetupResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  if (!input.firmName.trim()) return { ok: false, error: "Firm name required." };
  if (!input.userTitle.trim()) return { ok: false, error: "Your role title is required." };

  const sb = getSupabaseAdmin();
  const displayName = user.email?.split("@")[0] ?? "Principal";

  // 1. Create org. The schema's `tier` column is required (legacy demo
  //    table); set 'team' as the default for new firms.
  const { data: org, error: orgErr } = await sb
    .from("orgs")
    .insert({
      name: input.firmName.trim(),
      firm_type: input.firmType,
      regulatory_framework: input.regulatoryFramework,
      tier: "team",
      plan: "trial",
    })
    .select("id")
    .single();
  if (orgErr || !org) return { ok: false, error: "Failed to create org: " + (orgErr?.message ?? "unknown") };

  // 2. Add the user as the first org_member (principal).
  const { error: memberErr } = await sb.from("org_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "principal",
    title: input.userTitle.trim(),
    display_name: displayName,
    accepted_at: new Date().toISOString(),
  });
  if (memberErr) return { ok: false, error: "Failed to add member: " + memberErr.message };

  // 3. Mirror into the legacy `users` table so existing references
  //    (drafts.speaker_id → users.id) have a row to point at when this
  //    user submits drafts post-onboarding.
  await sb.from("users").insert({
    org_id: org.id,
    name: displayName,
    role: "principal",
    title: input.userTitle.trim(),
    email: user.email,
  });

  // 4. Onboarding progress.
  const { error: onbErr } = await sb.from("onboarding").insert({
    org_id: org.id,
    step_completed: ["firm_context"],
  });
  if (onbErr) return { ok: false, error: "Failed to save progress: " + onbErr.message };

  return { ok: true, orgId: org.id };
}

// ---------- Step 2: rules --------------------------------------------------

export type SuggestedRuleInput = {
  name: string;
  rule_type: "block" | "escalate" | "review" | "guide";
  description: string;
  keywords: string[];
  wsp_reference: string;
  regulatory_basis: string;
};

export type AuthorizeRulesResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

/**
 * Resolve the org_id for the currently authenticated user. Used by
 * onboarding actions that write into org-scoped tables.
 */
async function getCallerOrgId(): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const sb = getSupabaseAdmin();
  const { data: member } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "No organization found for this user." };
  return { orgId: member.org_id as string };
}

/**
 * Step 2. Persist the user-curated subset of suggested rules — each
 * becomes an active row in the rules table effective immediately.
 */
export async function authorizeOnboardingRulesAction(
  rules: SuggestedRuleInput[],
): Promise<AuthorizeRulesResult> {
  if (rules.length === 0) return { ok: false, error: "No rules selected." };
  const r = await getCallerOrgId();
  if ("error" in r) return { ok: false, error: r.error };

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const rows = rules.map((rule) => ({
    org_id: r.orgId,
    name: rule.name,
    rule_type: rule.rule_type,
    description: `${rule.description} Regulatory basis: ${rule.regulatory_basis}.`,
    keywords: rule.keywords,
    scope: "all_speakers",
    rule_status: "active",
    effective_from: now,
    effective_to: null,
    wsp_reference: rule.wsp_reference,
  }));

  const { error: insErr } = await sb.from("rules").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  // Mark step complete (idempotent — array_append-style upsert).
  await markStepComplete(r.orgId, "rules");
  return { ok: true, inserted: rows.length };
}

// ---------- Step 3: speakers ----------------------------------------------

export type InviteRow = {
  email: string;
  display_name: string;
  title: string;
  role: "speaker" | "principal";
};

export type SendInvitesResult =
  | { ok: true; sent: number }
  | { ok: false; error: string };

/**
 * Step 3. Insert invitation rows for each populated team member entry.
 * Empty rows are skipped. Email delivery is the principal's responsibility
 * for now — the invitee follows the /auth/invite/[token] URL printed
 * after the onboarding step (see the speakers-form for token display).
 */
export async function sendInvitationsAction(
  invites: InviteRow[],
): Promise<SendInvitesResult> {
  const r = await getCallerOrgId();
  if ("error" in r) return { ok: false, error: r.error };
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const populated = invites.filter((i) => i.email.trim() && i.display_name.trim());
  if (populated.length === 0) {
    // Skipping the speakers step is allowed — still mark it complete.
    await markStepComplete(r.orgId, "speakers");
    return { ok: true, sent: 0 };
  }

  const sb = getSupabaseAdmin();
  const rows = populated.map((i) => ({
    org_id: r.orgId,
    email: i.email.trim().toLowerCase(),
    role: i.role,
    title: i.title.trim() || null,
    display_name: i.display_name.trim(),
    invited_by: user.id,
  }));

  // Upsert — re-running the step shouldn't duplicate invites.
  const { error: insErr } = await sb
    .from("invitations")
    .upsert(rows, { onConflict: "org_id,email" });
  if (insErr) return { ok: false, error: insErr.message };

  await markStepComplete(r.orgId, "speakers");
  return { ok: true, sent: rows.length };
}

// ---------- Step 4: test run ----------------------------------------------

export type TestRunResult =
  | { ok: true; verdict: string; ruleName: string | null; matchedKeyword: string | null; draftId: string }
  | { ok: false; error: string };

/**
 * Step 4. Submit a hard-coded test draft against the user's first rule
 * so they can see the engine fire end-to-end. Uses getSupabaseAdmin
 * directly (rather than submitDraftAction) because the latter expects
 * a speaker_name → legacy users.id lookup that we already populated
 * during firm setup, but submit/actions.ts also performs side effects
 * we don't need here.
 */
export async function runOnboardingTestAction(
  draftText: string,
): Promise<TestRunResult> {
  const r = await getCallerOrgId();
  if ("error" in r) return { ok: false, error: r.error };
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const sb = getSupabaseAdmin();
  // Find the legacy `users` row created during firm setup (or the first
  // principal of the org if anything is missing).
  const { data: legacyUser } = await sb
    .from("users")
    .select("id")
    .eq("org_id", r.orgId)
    .eq("email", user.email ?? "")
    .maybeSingle();
  const speakerId = (legacyUser?.id as string | undefined) ?? null;
  if (!speakerId) return { ok: false, error: "Onboarding mirror user missing — restart Step 1." };

  // Insert the draft.
  const { data: draft, error: draftErr } = await sb
    .from("drafts")
    .insert({
      org_id: r.orgId,
      speaker_id: speakerId,
      channel: "linkedin",
      draft_text: draftText,
      source_origin: "human",
      status: "pending",
    })
    .select("id, submitted_at")
    .single();
  if (draftErr || !draft) return { ok: false, error: draftErr?.message ?? "Failed to insert draft." };

  // Run the rule check against the user's actual rules. We import
  // dynamically so we don't pull the heavy checks module into client
  // bundles via the page tree.
  const { runChecks } = await import("@/lib/checks");
  const result = await runChecks(sb, r.orgId, draftText, draft.submitted_at, "retail");

  // Persist a verdict_issued action so the dashboard / examiner record
  // shows this run alongside future real submissions.
  await sb.from("actions").insert({
    org_id: r.orgId,
    draft_id: draft.id,
    action_type: "verdict_issued",
    actor_kind: "system",
    payload: {
      verdict: result.verdict,
      base_verdict: result.base_verdict,
      primary_match: result.primary_match,
      onboarding_test: true,
    },
    rules_active: result.rules_active,
  });

  await markStepComplete(r.orgId, "test_run", true);

  return {
    ok: true,
    verdict: result.verdict,
    ruleName: result.primary_match?.rule_name ?? null,
    matchedKeyword: result.primary_match?.matched_keyword ?? null,
    draftId: draft.id,
  };
}

// ---------- Helpers -------------------------------------------------------

async function markStepComplete(
  orgId: string,
  step: "firm_context" | "rules" | "speakers" | "test_run",
  finalize = false,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from("onboarding")
    .select("step_completed")
    .eq("org_id", orgId)
    .maybeSingle();
  const current: string[] = (row?.step_completed as string[] | undefined) ?? [];
  if (current.includes(step)) {
    if (finalize) {
      await sb
        .from("onboarding")
        .update({ completed_at: new Date().toISOString() })
        .eq("org_id", orgId);
    }
    return;
  }
  const next = [...current, step];
  await sb
    .from("onboarding")
    .update({
      step_completed: next,
      ...(finalize ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("org_id", orgId);
}
