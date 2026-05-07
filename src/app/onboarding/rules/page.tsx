/**
 * Onboarding Step 2 — governance rules. Server component fetches the
 * user's firm_type so the suggested-rules track shows the right
 * starter set; everything interactive is in rules-form.tsx.
 */
import { OnboardingShell } from "../onboarding-shell";
import { RulesForm } from "./rules-form";
import { createServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { suggestedRulesForFirmType } from "./suggested-rules";
import type { FirmType } from "../actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const KNOWN_FIRM_TYPES: FirmType[] = [
  "broker_dealer",
  "rIA",
  "public_company",
  "investment_bank",
  "non_regulated",
];

function isFirmType(s: string | null | undefined): s is FirmType {
  return !!s && (KNOWN_FIRM_TYPES as string[]).includes(s);
}

export default async function OnboardingRulesPage() {
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
  // No org → user hasn't completed Step 1.
  if (!member) redirect("/onboarding");

  const { data: org } = await sb
    .from("orgs")
    .select("firm_type")
    .eq("id", member.org_id)
    .maybeSingle();

  const firmType: FirmType = isFirmType(org?.firm_type as string | undefined)
    ? (org!.firm_type as FirmType)
    : "broker_dealer";

  const suggested = suggestedRulesForFirmType(firmType);

  return (
    <OnboardingShell step={2}>
      <RulesForm suggested={suggested} />
    </OnboardingShell>
  );
}
