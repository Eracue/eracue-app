import { SubmitForm, type SpeakerInfo, type SubmitFlow } from "./submit-form";
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
  searchParams: Promise<{ from?: string; count?: string; firmType?: string }>;
}) {
  const params = await searchParams;
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const fromRules = params.from === "rules";
  const activatedCount = parseInt(params.count ?? "0", 10) || 0;

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
  // for the form. Limit to speaker / principal roles so reviewers don't
  // appear in the speaker grid (they're not who we're submitting for).
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
    .filter((u) => u.role === "speaker" || u.role === "principal")
    .map((u) => ({
      id: u.id,
      display_name: u.name,
      title: u.title,
      role: u.role,
      is_current_user:
        currentUserName !== null && u.name === currentUserName,
    }));

  const hasSpeakers = speakers.length > 0;

  // Active rule count — drives the "X rules will be checked" tag below
  // the draft textarea + the stage-1 label in the checking state.
  const { count: ruleCountRaw } = await sb
    .from("rules")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("rule_status", "active");
  const ruleCount = ruleCountRaw ?? 0;

  // Approved-draft count — drives the consistency-check stage-3 label
  // ("Checking against N prior approved statements"). Falls back to a
  // generic phrasing when the corpus is empty.
  const { count: corpusCountRaw } = await sb
    .from("drafts")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "approved");
  const corpusCount = corpusCountRaw ?? 0;

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
          corpusCount={corpusCount}
          currentUserName={currentUserName}
          isDemoMode={isDemoMode}
        />
      </main>
    </>
  );
}
