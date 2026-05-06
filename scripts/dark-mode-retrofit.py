#!/usr/bin/env python3
"""One-shot dark-mode retrofit for the 8 inner pages + their client components.
Adds `dark:...` Tailwind variants alongside existing light-mode classes.
Idempotent only when run once; do not re-run.
"""
import re
import sys
from pathlib import Path

# Each entry: (regex pattern, replacement). Order matters — most specific first.
# `\b` in Python = word boundary; `bg-neutral-50` won't match the prefix of `bg-neutral-500`
# because there's no word boundary between two digits.
REPLACEMENTS = [
    # Surface backgrounds
    (r"\bbg-neutral-50\b",  "bg-neutral-50 dark:bg-neutral-900"),
    (r"\bbg-neutral-100\b", "bg-neutral-100 dark:bg-neutral-800"),
    (r"\bbg-white\b",       "bg-white dark:bg-neutral-900"),

    # Borders
    (r"\bborder-neutral-100\b", "border-neutral-100 dark:border-neutral-800"),
    (r"\bborder-neutral-200\b", "border-neutral-200 dark:border-neutral-800"),
    (r"\bborder-neutral-300\b", "border-neutral-300 dark:border-neutral-700"),

    # Text — primary scale
    (r"\btext-neutral-900\b", "text-neutral-900 dark:text-neutral-100"),
    (r"\btext-neutral-800\b", "text-neutral-800 dark:text-neutral-200"),
    (r"\btext-neutral-700\b", "text-neutral-700 dark:text-neutral-300"),
    (r"\btext-neutral-600\b", "text-neutral-600 dark:text-neutral-400"),
    (r"\btext-neutral-500\b", "text-neutral-500 dark:text-neutral-400"),
    (r"\btext-neutral-400\b", "text-neutral-400 dark:text-neutral-500"),

    # Status — red
    (r"\bbg-red-50\b",      "bg-red-50 dark:bg-red-950/30"),
    (r"\btext-red-700\b",   "text-red-700 dark:text-red-400"),
    (r"\btext-red-800\b",   "text-red-800 dark:text-red-300"),
    (r"\btext-red-900\b",   "text-red-900 dark:text-red-300"),
    (r"\bborder-red-200\b", "border-red-200 dark:border-red-900"),
    (r"\bborder-red-300\b", "border-red-300 dark:border-red-900"),

    # Status — amber
    (r"\bbg-amber-50\b",      "bg-amber-50 dark:bg-amber-950/30"),
    (r"\bbg-amber-100\b",     "bg-amber-100 dark:bg-amber-950/30"),
    (r"\btext-amber-700\b",   "text-amber-700 dark:text-amber-400"),
    (r"\btext-amber-800\b",   "text-amber-800 dark:text-amber-300"),
    (r"\btext-amber-900\b",   "text-amber-900 dark:text-amber-300"),
    (r"\bborder-amber-200\b", "border-amber-200 dark:border-amber-900"),
    (r"\bborder-amber-300\b", "border-amber-300 dark:border-amber-900"),

    # Status — green
    (r"\bbg-green-50\b",      "bg-green-50 dark:bg-green-950/30"),
    (r"\bbg-green-100\b",     "bg-green-100 dark:bg-green-950/30"),
    (r"\btext-green-700\b",   "text-green-700 dark:text-green-400"),
    (r"\btext-green-800\b",   "text-green-800 dark:text-green-300"),
    (r"\btext-green-900\b",   "text-green-900 dark:text-green-300"),
    (r"\bborder-green-200\b", "border-green-200 dark:border-green-900"),
    (r"\bborder-green-300\b", "border-green-300 dark:border-green-900"),

    # Status — blue
    (r"\bbg-blue-50\b",      "bg-blue-50 dark:bg-blue-950/30"),
    (r"\btext-blue-700\b",   "text-blue-700 dark:text-blue-400"),
    (r"\btext-blue-800\b",   "text-blue-800 dark:text-blue-300"),
    (r"\btext-blue-900\b",   "text-blue-900 dark:text-blue-300"),
    (r"\bborder-blue-200\b", "border-blue-200 dark:border-blue-900"),
    (r"\bborder-blue-300\b", "border-blue-300 dark:border-blue-900"),

    # Status — purple
    (r"\bbg-purple-50\b",      "bg-purple-50 dark:bg-purple-950/30"),
    (r"\bbg-purple-100\b",     "bg-purple-100 dark:bg-purple-950/30"),
    (r"\btext-purple-700\b",   "text-purple-700 dark:text-purple-400"),
    (r"\btext-purple-800\b",   "text-purple-800 dark:text-purple-300"),
    (r"\btext-purple-900\b",   "text-purple-900 dark:text-purple-300"),
    (r"\bborder-purple-200\b", "border-purple-200 dark:border-purple-900"),
    (r"\bborder-purple-300\b", "border-purple-300 dark:border-purple-900"),

    # Highlight <mark> — light yellow needs dark contrast or text becomes unreadable
    (r"\bbg-yellow-200\b", "bg-yellow-200 dark:bg-yellow-800/40 dark:text-yellow-100"),
]

FILES = [
    "src/app/rules/page.tsx",
    "src/app/rules/rules-filter.tsx",
    "src/app/submit/page.tsx",
    "src/app/submit/submit-form.tsx",
    "src/app/drafts/page.tsx",
    "src/app/drafts/[id]/page.tsx",
    "src/app/reviewer/queue/page.tsx",
    "src/app/reviewer/[id]/page.tsx",
    "src/app/reviewer/[id]/reviewer-form.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/dashboard-tabs.tsx",
]

def main() -> int:
    changed = 0
    for path_str in FILES:
        p = Path(path_str)
        if not p.exists():
            print(f"MISSING: {path_str}", file=sys.stderr)
            continue
        original = p.read_text()
        text = original
        for pattern, replacement in REPLACEMENTS:
            text = re.sub(pattern, replacement, text)
        if text != original:
            p.write_text(text)
            changed += 1
            print(f"  modified: {path_str}")
        else:
            print(f"  unchanged: {path_str}")
    print(f"\nDone. {changed}/{len(FILES)} files modified.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
