/**
 * Onboarding Step 4 — first governance check. Server component looks
 * up the user's first authorized rule and synthesises a short test
 * draft that matches one of its keywords; the client component runs
 * the actual check and shows the verdict.
 */
import { redirect } from "next/navigation";
import { OnboardingShell } from "../onboarding-shell";
import { TestRunForm } from "./test-run-form";
import { createServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FirstRule = {
  name: string;
  description: string;
  keywords: string[];
  rule_type: string;
};

/**
 * Build a short draft that contains the matched keyword in plausible
 * prose. Falls back to a generic line when the rule has no keywords
 * (e.g. AI Content Disclosure is keyword-less).
 */
function buildTestDraft(rule: FirstRule): { draft: string; keyword: string | null } {
  const kw = rule.keywords.find((k) => k.length > 0);
  if (!kw) {
    return {
      draft: "We're publishing a new market-outlook post for the firm.",
      keyword: null,
    };
  }
  return {
    draft: `Excited to share an update — ${kw} from the team.`,
    keyword: kw,
  };
}

export default async function OnboardingTestPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const sb = getSupabaseAdmin();
  const { data: member } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect("/onboarding");

  const { data: rules } = await sb
    .from("rules")
    .select("name, description, keywords, rule_type")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: true })
    .limit(1);
  const firstRule = (rules?.[0] as FirstRule | undefined) ?? null;

  const test = firstRule
    ? buildTestDraft(firstRule)
    : {
        draft: "Excited to share an update from the team this quarter.",
        keyword: null,
      };

  return (
    <OnboardingShell step={4}>
      <TestRunForm
        firstRule={firstRule}
        testDraft={test.draft}
        triggerKeyword={test.keyword}
      />
    </OnboardingShell>
  );
}
