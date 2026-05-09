"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { runOnboardingTestAction } from "../actions";

const VERDICT_BADGE: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  block: { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
  escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
  review: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
  guide: { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
  clear: { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
};

type Result = {
  verdict: string;
  ruleName: string | null;
  matchedKeyword: string | null;
  draftId: string;
};

export function TestRunForm({
  firstRule,
  testDraft,
  triggerKeyword,
}: {
  firstRule: { name: string; description: string; rule_type: string } | null;
  testDraft: string;
  triggerKeyword: string | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function handleRun() {
    setError("");
    setRunning(true);
    const r = await runOnboardingTestAction(testDraft);
    if (!r.ok) {
      setError(r.error);
      setRunning(false);
      return;
    }
    setResult({
      verdict: r.verdict,
      ruleName: r.ruleName,
      matchedKeyword: r.matchedKeyword,
      draftId: r.draftId,
    });
    setRunning(false);
  }

  if (result) {
    const badge = VERDICT_BADGE[result.verdict] ?? VERDICT_BADGE.clear;
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2" aria-hidden>✓</div>
          <div
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="font-light text-2xl text-[#0F172A]"
          >
            ERA CUE is ready.
          </div>
          <div className="text-sm text-[#64748B] mt-1">
            Your governance setup is complete and the engine is live.
          </div>
        </div>

        <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4 mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Verdict
          </div>
          <span
            className={`font-mono text-sm font-bold px-3 py-1 rounded-sm border uppercase tracking-widest inline-flex ${badge.bg} ${badge.text} ${badge.border}`}
          >
            {badge.label}
          </span>
          {result.ruleName && (
            <div className="text-sm text-[#0F172A] font-medium mt-3">{result.ruleName}</div>
          )}
          {result.matchedKeyword && (
            <div className="text-xs text-[#64748B] mt-1">
              Matched keyword:{" "}
              <span className="font-mono bg-[#F1F5F9] text-[#1A56DB] px-1.5 py-0.5 rounded">
                {result.matchedKeyword}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            router.push("/review");
            router.refresh();
          }}
          className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] transition-colors"
        >
          Go to dashboard →
        </button>

        <div className="text-center mt-4">
          <Link
            href={`/drafts/${result.draftId}/examiner`}
            className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            View the test draft&apos;s compliance record →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
        Test your governance setup
      </div>
      <div className="text-sm text-[#374151] mb-4 leading-relaxed">
        {firstRule
          ? <>This draft will trigger your <span className="font-medium text-[#0F172A]">{firstRule.name}</span> rule. Submit it to see ERA CUE in action.</>
          : <>Your rules don&apos;t have any keyword triggers, so this test will return CLEAR. You can add keyword-based rules later.</>}
      </div>

      <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4 text-sm italic text-[#374151] mb-4">
        &ldquo;{testDraft}&rdquo;
      </div>

      {triggerKeyword && (
        <div className="font-mono text-[10px] text-[#94A3B8] mb-4">
          Expected to match keyword:{" "}
          <span className="bg-[#F1F5F9] text-[#1A56DB] px-1.5 py-0.5 rounded">{triggerKeyword}</span>
        </div>
      )}

      {error && (
        <div
          className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-sm px-3 py-2 mb-4"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors"
      >
        {running ? "Running governance check..." : "Run governance check →"}
      </button>
    </div>
  );
}
