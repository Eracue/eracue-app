/**
 * Shared layout for the four onboarding steps. Renders the ERA CUE
 * wordmark, a "Step N of 4 — <title>" indicator, and a centered card
 * the step's form fills.
 */
import Link from "next/link";
import type { ReactNode } from "react";

const STEPS = [
  { n: 1, label: "Tell us about your firm" },
  { n: 2, label: "Set up your governance rules" },
  { n: 3, label: "Add your team" },
  { n: 4, label: "Run your first check" },
] as const;

export type OnboardingStep = 1 | 2 | 3 | 4;

export function OnboardingShell({
  step,
  children,
}: {
  step: OnboardingStep;
  children: ReactNode;
}) {
  const current = STEPS.find((s) => s.n === step) ?? STEPS[0];
  return (
    <main className="min-h-screen bg-[#F8F9FB] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo + progress */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="font-mono text-lg text-[#1A56DB] inline-block"
            style={{ fontFamily: "var(--font-newsreader)" }}
          >
            <span className="font-bold">ERA</span>
            <span className="italic font-normal"> CUE</span>
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#1A56DB] mt-3">
            Step {current.n} of 4 — {current.label}
          </div>
          {/* Progress bar — 4 segments, filled to current step */}
          <div className="flex gap-1 mt-3 max-w-xs mx-auto">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className={`h-1 flex-1 rounded-sm ${
                  s.n <= step ? "bg-[#1A56DB]" : "bg-[#E2E8F0]"
                }`}
              />
            ))}
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
