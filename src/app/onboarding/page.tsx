import { OnboardingShell } from "./onboarding-shell";
import { FirmSetupForm } from "./firm-setup-form";

export const dynamic = "force-dynamic";

export default function OnboardingFirmPage() {
  return (
    <OnboardingShell step={1}>
      <FirmSetupForm />
    </OnboardingShell>
  );
}
