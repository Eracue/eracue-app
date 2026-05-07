/**
 * Server-side helper that resolves the org_id for the currently
 * authenticated user, falling back to DEMO_ORG_ID. Used in Phase 6 so
 * existing pages keep showing demo data for unauthenticated visitors
 * while authenticated users see only their own org's rows.
 *
 * The middleware blocks unauthed users from non-public paths in
 * production, so the fallback is mostly defensive — it lets the demo
 * flow keep working on local dev / preview deployments before Supabase
 * auth env vars are configured.
 */
import { createServerClient } from "./supabase-server";
import { getSupabaseAdmin } from "./supabase";
import { DEMO_ORG_ID } from "./demo-config";

export async function resolveOrgId(): Promise<string> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEMO_ORG_ID;
    const sb = getSupabaseAdmin();
    const { data: member } = await sb
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const orgId = (member?.org_id as string | null | undefined) ?? null;
    return orgId ?? DEMO_ORG_ID;
  } catch {
    return DEMO_ORG_ID;
  }
}
