#!/usr/bin/env python3
"""Unify all inner pages onto the warm-light token palette.

Removes every `dark:` modifier outright (the system has no dark mode), then
remaps the entire neutral / status color scale to the explicit hex tokens
from the design spec.

Excludes the examiner page set — those are deliberately print-styled and
the spec does not list them in step 3.
"""
import re
import sys
from pathlib import Path

FILES = [
    "src/app/dashboard/page.tsx",
    "src/app/rules/page.tsx",
    "src/app/rules/rules-filter.tsx",
    "src/app/reviewer/queue/page.tsx",
    "src/app/reviewer/[id]/page.tsx",
    "src/app/reviewer/[id]/reviewer-form.tsx",
    "src/app/reviewer/[id]/check-detail-panel.tsx",
    "src/app/drafts/page.tsx",
    "src/app/drafts/[id]/page.tsx",
    "src/app/submit/page.tsx",
    "src/app/submit/submit-form.tsx",
]

# 1) Strip all dark: modifiers. The pattern matches dark:<utility> followed
#    by a space or close-quote/brace. We capture and drop the whole token.
DARK_MOD_PATTERN = re.compile(r"\s*dark:[A-Za-z0-9/\[\]\.\-#:_]+")

# 2) Color & utility token replacements applied AFTER dark stripping.
#    Order matters — most specific first so we don't double-rewrite.
REPLACEMENTS: list[tuple[str, str]] = [
    # ---- Status colors → tokens (BLOCK / red) ----
    (r"\bbg-red-(?:50|100)\b",        "bg-[#FEF2F2]"),
    (r"\bbg-red-9?5?0/30\b",          "bg-[#FEF2F2]"),
    (r"\bbg-red-9?5?0/40\b",          "bg-[#FEF2F2]"),
    (r"\btext-red-(?:300|400|700|800|900)\b", "text-[#B91C1C]"),
    (r"\bborder-red-(?:200|300|900)\b",       "border-[#FECACA]"),

    # ESCALATE / amber
    (r"\bbg-amber-(?:50|100)\b",      "bg-[#FFF7ED]"),
    (r"\bbg-amber-9?5?0/30\b",        "bg-[#FFF7ED]"),
    (r"\bbg-amber-9?5?0/40\b",        "bg-[#FFF7ED]"),
    (r"\btext-amber-(?:200|300|400|700|800|900)\b", "text-[#C2410C]"),
    (r"\bborder-amber-(?:200|300|900)\b",           "border-[#FED7AA]"),

    # REVIEW / blue
    (r"\bbg-blue-(?:50|100)\b",       "bg-[#EFF6FF]"),
    (r"\bbg-blue-9?5?0/30\b",         "bg-[#EFF6FF]"),
    (r"\btext-blue-(?:300|400|700|800|900)\b", "text-[#1D4ED8]"),
    (r"\bborder-blue-(?:200|300|900)\b",       "border-[#BFDBFE]"),

    # GUIDE/OVERRIDE / purple — unified onto GUIDE token
    (r"\bbg-purple-(?:50|100)\b",     "bg-[#F5F3FF]"),
    (r"\bbg-purple-9?5?0/30\b",       "bg-[#F5F3FF]"),
    (r"\btext-purple-(?:300|400|700|800|900)\b", "text-[#6D28D9]"),
    (r"\bborder-purple-(?:200|300|900)\b",       "border-[#DDD6FE]"),

    # CLEAR / green
    (r"\bbg-green-(?:50|100)\b",      "bg-[#F0FDF4]"),
    (r"\bbg-green-9?5?0/30\b",        "bg-[#F0FDF4]"),
    (r"\btext-green-(?:300|400|700|800|900)\b", "text-[#166534]"),
    (r"\bborder-green-(?:200|300|800|900)\b",   "border-[#BBF7D0]"),

    # Yellow highlight (used by <mark>) → keep visually yellow but with token-friendly hex
    (r"\bbg-yellow-(?:200)\b",        "bg-[#FEF3C7]"),
    (r"\bbg-yellow-(?:800|900)/40\b", "bg-[#FEF3C7]"),
    (r"\btext-yellow-100\b",          "text-[#92400E]"),

    # Indigo (was the dark-mode primary CTA color and link accent) — fold into tokens
    (r"\bhover:bg-indigo-(?:500|600)\b",      "hover:bg-[#333331]"),
    (r"\bbg-indigo-(?:500|600)\b",            "bg-[#1C1C1A]"),
    (r"\btext-indigo-(?:400|500|700)\b",      "text-[#C9A92C]"),
    (r"\bhover:text-indigo-(?:400|500|700)\b","hover:text-[#8A7520]"),
    (r"\bborder-indigo-(?:400|500)\b",        "border-[#E2E1DC]"),

    # ---- Neutrals → tokens ----
    # Backgrounds (most-specific bg utilities first)
    (r"\bbg-neutral-50\b",            "bg-[#F7F6F3]"),
    (r"\bbg-neutral-100\b",           "bg-[#F0EFE9]"),
    (r"\bbg-neutral-200\b",           "bg-[#E2E1DC]"),
    (r"\bbg-neutral-700\b",           "bg-[#1C1C1A]"),
    (r"\bbg-neutral-800\b",           "bg-[#1C1C1A]"),
    (r"\bbg-neutral-900\b",           "bg-[#1C1C1A]"),
    (r"\bbg-neutral-950\b",           "bg-[#1C1C1A]"),
    (r"\bhover:bg-neutral-50\b",      "hover:bg-[#F7F6F3]"),
    (r"\bhover:bg-neutral-100\b",     "hover:bg-[#F0EFE9]"),
    (r"\bhover:bg-neutral-800\b",     "hover:bg-[#333331]"),
    (r"\bhover:bg-neutral-900\b",     "hover:bg-[#333331]"),
    # Text
    (r"\btext-neutral-100\b",         "text-white"),
    (r"\btext-neutral-200\b",         "text-[#9E9E96]"),
    (r"\btext-neutral-300\b",         "text-[#9E9E96]"),
    (r"\btext-neutral-400\b",         "text-[#6E6E68]"),
    (r"\btext-neutral-500\b",         "text-[#6E6E68]"),
    (r"\btext-neutral-600\b",         "text-[#6E6E68]"),
    (r"\btext-neutral-700\b",         "text-[#1C1C1A]"),
    (r"\btext-neutral-800\b",         "text-[#1C1C1A]"),
    (r"\btext-neutral-900\b",         "text-[#1C1C1A]"),
    (r"\bhover:text-neutral-900\b",   "hover:text-[#1C1C1A]"),
    # Borders
    (r"\bborder-neutral-100\b",       "border-[#E2E1DC]"),
    (r"\bborder-neutral-200\b",       "border-[#E2E1DC]"),
    (r"\bborder-neutral-300\b",       "border-[#E2E1DC]"),
    (r"\bborder-neutral-400\b",       "border-[#E2E1DC]"),
    (r"\bborder-neutral-700\b",       "border-[#E2E1DC]"),
    (r"\bborder-neutral-800\b",       "border-[#E2E1DC]"),
    (r"\bborder-neutral-900\b",       "border-[#1C1C1A]"),
    (r"\bhover:border-neutral-(?:400|500)\b", "hover:border-[#1C1C1A]"),
    # Divide
    (r"\bdivide-neutral-(?:100|200|300|800)\b", "divide-[#E2E1DC]"),
    # Ring
    (r"\bring-neutral-900\b",         "ring-[#1C1C1A]"),
    (r"\bfocus:ring-neutral-900\b",   "focus:ring-[#1C1C1A]"),

    # ---- Corner radius unification ----
    (r"\brounded-lg\b",               "rounded-sm"),
    (r"\brounded-md\b",               "rounded-sm"),
]

# Final pass: collapse multiple consecutive spaces inside className strings,
# which can appear after stripping dark: tokens.
def collapse_double_spaces(text: str) -> str:
    # Inside a className="..." (or className={`...`}) only — but a global
    # collapse of >=2 spaces between non-newline characters in JSX is safe
    # enough for our class strings.
    return re.sub(r"(?<! )  +(?!\n)", " ", text)

def main() -> int:
    changed = 0
    for path_str in FILES:
        p = Path(path_str)
        if not p.exists():
            print(f"  MISSING: {path_str}", file=sys.stderr)
            continue
        original = p.read_text()
        text = original

        # Step 1: strip dark: tokens
        text = DARK_MOD_PATTERN.sub("", text)

        # Step 2: token replacements
        for pattern, replacement in REPLACEMENTS:
            text = re.sub(pattern, replacement, text)

        # Step 3: cleanup
        text = collapse_double_spaces(text)

        if text != original:
            p.write_text(text)
            changed += 1
            print(f"  modified: {path_str}")
        else:
            print(f"  unchanged: {path_str}")

    print(f"\n{changed}/{len(FILES)} files modified.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
