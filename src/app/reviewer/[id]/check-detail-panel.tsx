"use client";

import { useState } from "react";
import type { CheckEntry } from "@/lib/checks";

type Props = { checks: CheckEntry[] };

function ResultBadge({ result }: { result: CheckEntry["result"] }) {
  const styles: Record<CheckEntry["result"], { bg: string; text: string; border: string; label: string }> = {
    pass: {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-800 dark:text-green-300",
      border: "border-green-300 dark:border-green-900",
      label: "PASS",
    },
    fail: {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-800 dark:text-red-300",
      border: "border-red-300 dark:border-red-900",
      label: "FAIL",
    },
    warn: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-300 dark:border-amber-900",
      label: "WARN",
    },
  };
  const s = styles[result];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

export function CheckDetailPanel({ checks }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          Check detail ({checks.length})
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-neutral-500 dark:text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul className="border-t border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
          {checks.map((c, i) => (
            <li key={`${c.check_name}-${i}`} className="px-6 py-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.check_name}</div>
                {c.detail && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{c.detail}</div>
                )}
                {c.matched_keyword && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Matched keyword: <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{c.matched_keyword}</span>
                  </div>
                )}
              </div>
              <ResultBadge result={c.result} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
