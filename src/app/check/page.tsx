import {
  SubmitForm,
  type ActiveRule,
  type SpeakerInfo,
  type SubmitFlow,
} from "./submit-form";
import { SiteHeader } from "@/app/site-header";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Submit page is a server component so the flow detection (demo /
// new-user / returning) and the speaker / rule / corpus counts can be
// resolved in one round trip before the client renders. The actual
// form lives in submit-form.tsx as a client component.

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    count?: string;
    firmType?: string;
    campaign?: string;
  }>;
}) {
  const params = await searchParams;
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const fromRules = params.from === "rules";
  const activatedCount = parseInt(params.count ?? "0", 10) || 0;
  // FIX 2 — `?campaign=` lets a VP Comms send speakers a pre-scoped
  // submit link. The page needs the value at fetch time so it can
  // resolve campaign_rules → the scoped rule allowlist alongside the
  // active-rules query in one round trip; the form also reads the
  // param client-side via useSearchParams for input prefill.
  const campaignParam = params.campaign?.trim() ?? null;

  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  // Pull display_name for the authenticated user so the new-user flow
  // can render a "Yourself" card with the right name. Demo visitors
  // skip this entirely — the demo speakers are hardcoded personas.
  let currentUserName: string | null = null;
  if (!isDemoMode) {
    try {
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await sb
          .from("org_members")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const row = member as { display_name?: string | null } | null;
        currentUserName = row?.display_name ?? null;
      }
    } catch {
      currentUserName = null;
    }
  }

  // Speakers — schema column is `users.name`, surfaced as `display_name`
  // for the form. Principals (reviewers) are excluded from the submitter
  // grid: a reviewer authorizes drafts, they don't submit them.
  type UserRow = {
    id: string;
    name: string;
    title: string | null;
    role: string;
  };
  const { data: usersRaw } = await sb
    .from("users")
    .select("id, name, title, role")
    .eq("org_id", orgId)
    .order("name");

  const speakers: SpeakerInfo[] = ((usersRaw as UserRow[] | null) ?? [])
    .filter((u) => u.role === "speaker")
    .map((u) => ({
      id: u.id,
      display_name: u.name,
      title: u.title,
      role: u.role,
      is_current_user:
        currentUserName !== null && u.name === currentUserName,
    }));

  const hasSpeakers = speakers.length > 0;

  // FIX 2 — full active-rule metadata (id, name, rule_type, keywords,
  // regulatory_basis, authorized_by) so the "Rules active" expandable
  // section and the post-verdict "Rules checked" panel can render
  // without re-querying. The page-load `ruleCount` is still derived
  // from this list.
  type ActiveRuleRow = {
    id: string;
    name: string;
    rule_type: "block" | "review" | "escalate" | "guide";
    keywords: string[] | null;
    regulatory_basis: string | null;
    authorized_by: string | null;
  };
  const { data: activeRulesRaw } = await sb
    .from("rules")
    .select(
      "id, name, rule_type, keywords, regulatory_basis, authorized_by",
    )
    .eq("org_id", orgId)
    .eq("rule_status", "active")
    .order("name");
  const activeRules: ActiveRule[] = (
    (activeRulesRaw ?? []) as ActiveRuleRow[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    verdict: r.rule_type,
    keywords: r.keywords ?? [],
    regulatoryBasis: r.regulatory_basis ?? null,
    authorizedBy: r.authorized_by ?? null,
  }));
  const ruleCount = activeRules.length;

  // FIX 2 — when ?campaign=Series%20B%20Announce is in the URL, look
  // up the campaign + its campaign_rules selection so the form can
  // pre-scope the rules section. An empty selection means
  // implicit-all (every active rule applies); we surface that as
  // null so the form renders the full list.
  let campaignScopedRuleIds: string[] | null = null;
  if (campaignParam) {
    const { data: campaignRow } = await sb
      .from("campaigns")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", campaignParam)
      .maybeSingle();
    const cid = (campaignRow?.id as string | undefined) ?? null;
    if (cid) {
      const { data: scopedRows } = await sb
        .from("campaign_rules")
        .select("rule_id")
        .eq("campaign_id", cid);
      const scoped = ((scopedRows ?? []) as Array<{ rule_id: string }>).map(
        (r) => r.rule_id,
      );
      // Empty rows → implicit-all → null (no scoping).
      if (scoped.length > 0) campaignScopedRuleIds = scoped;
    }
  }

  // Approved-draft count — drives the consistency-check stage-3 label
  // ("Checking against N prior approved statements"). Falls back to a
  // generic phrasing when the corpus is empty.
  const { count: corpusCountRaw } = await sb
    .from("drafts")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "approved");
  const corpusCount = corpusCountRaw ?? 0;

  // FIX 2 — solo founder path. When the org has no principal on
  // record, a BLOCK verdict's "Request principal review" card is
  // hidden. Demo always has a seeded principal so this only matters
  // for production-fresh orgs. Counted via a HEAD query so we only
  // need the boolean answer.
  const { count: principalCountRaw } = await sb
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "principal");
  const hasPrincipal = (principalCountRaw ?? 0) > 0;

  // Firm type — URL param wins (post-setup hand-off), org default
  // second, empty string last. Drives the "Try an example →" payload.
  type OrgRow = { firm_type?: string | null };
  const { data: orgRow } = await sb
    .from("orgs")
    .select("firm_type")
    .eq("id", orgId)
    .maybeSingle();
  const firmType =
    params.firmType ?? (orgRow as OrgRow | null)?.firm_type ?? "";

  const flow: SubmitFlow = isDemoMode
    ? "demo"
    : !hasSpeakers
      ? "new_user"
      : "returning";

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        <SubmitForm
          flow={flow}
          fromRules={fromRules}
          activatedCount={activatedCount}
          firmType={firmType}
          speakers={speakers}
          ruleCount={ruleCount}
          activeRules={activeRules}
          campaignScopedRuleIds={campaignScopedRuleIds}
          corpusCount={corpusCount}
          currentUserName={currentUserName}
          isDemoMode={isDemoMode}
          hasPrincipal={hasPrincipal}
        />
      </main>
    </>
  );
}
