import { OnboardingShell } from "../onboarding-shell";
import { SpeakersForm } from "./speakers-form";

export const dynamic = "force-dynamic";

export default function OnboardingSpeakersPage() {
  return (
    <OnboardingShell step={3}>
      <SpeakersForm />
    </OnboardingShell>
  );
}
