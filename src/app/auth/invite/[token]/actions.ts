"use server";

import { createServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export type InvitationLookup =
  | {
      ok: true;
      invitation: {
        id: string;
        email: string;
        role: string;
        title: string | null;
        display_name: string | null;
        org_id: string;
        org_name: string;
        invited_by_name: string | null;
        expires_at: string;
        accepted_at: string | null;
      };
    }
  | { ok: false; reason: "not_found" | "expired" | "accepted" | "error"; message: string };

/**
 * Resolve an invitation token to its org + inviter context. Uses the
 * service-role client because the invitation row is RLS-isolated to
 * principals of the inviting org — the invitee won't be a member yet.
 */
export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  const sb = getSupabaseAdmin();
  const { data: invitation, error } = await sb
    .from("invitations")
    .select("id, email, role, title, display_name, org_id, expires_at, accepted_at, invited_by")
    .eq("token", token)
    .maybeSingle();

  if (error) return { ok: false, reason: "error", message: error.message };
  if (!invitation) return { ok: false, reason: "not_found", message: "Invitation not found." };

  if (invitation.accepted_at) {
    return { ok: false, reason: "accepted", message: "This invitation has already been accepted." };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired", message: "This invitation has expired." };
  }

  const { data: org } = await sb
    .from("orgs")
    .select("name")
    .eq("id", invitation.org_id)
    .maybeSingle();

  // The inviter lives in auth.users — we can read their email from there
  // but display_name lives on org_members.
  let invitedByName: string | null = null;
  if (invitation.invited_by) {
    const { data: member } = await sb
      .from("org_members")
      .select("display_name")
      .eq("user_id", invitation.invited_by)
      .eq("org_id", invitation.org_id)
      .maybeSingle();
    invitedByName = member?.display_name ?? null;
  }

  return {
    ok: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      title: invitation.title,
      display_name: invitation.display_name,
      org_id: invitation.org_id,
      org_name: org?.name ?? "your organization",
      invited_by_name: invitedByName,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
    },
  };
}

export type AcceptInvitationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Accept the pending invitation for the currently authenticated user.
 * Idempotent — safe to call twice; the second call no-ops because the
 * invitation row is already marked accepted.
 */
export async function acceptInvitationAction(token: string): Promise<AcceptInvitationResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const lookup = await lookupInvitation(token);
  if (!lookup.ok) return { ok: false, error: lookup.message };
  const invite = lookup.invitation;

  // Email mismatch: the user signed up with a different address than the
  // one the principal invited. Refuse — let them re-auth with the right
  // address rather than silently linking their account to the wrong org.
  if (user.email && user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      ok: false,
      error: `This invitation was sent to ${invite.email}. Sign in with that email to accept.`,
    };
  }

  const sb = getSupabaseAdmin();

  // 1. Insert org_members row (UNIQUE org_id+user_id makes this idempotent).
  const { error: memberErr } = await sb.from("org_members").upsert(
    {
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      title: invite.title,
      display_name: invite.display_name,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "org_id,user_id" },
  );
  if (memberErr) return { ok: false, error: memberErr.message };

  // 2. Mark the invitation accepted.
  const { error: inviteErr } = await sb
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (inviteErr) return { ok: false, error: inviteErr.message };

  return { ok: true };
}
