#!/usr/bin/env python3
"""Cleanup pass after dark-mode-retrofit.py. Fixes cascade artifacts:
  1. `dark:text-neutral-400 dark:text-neutral-500` ← cascade from text-neutral-500/600
     replacement triggering the text-neutral-400 rule on its own output.
  2. `<modifier>:X dark:Y` ← retrofit added unconditional dark variant after a
     modifier-conditional light variant; the dark variant should also be
     scoped to the same modifier (hover, group-hover, focus, active, disabled).
"""
import re
from pathlib import Path

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

# Modifier-prefixed cleanup. The retrofit always inserted `dark:Y` immediately
# after the matched light class, so any post-retrofit `<mod>:X dark:Y` is a
# cascade artifact — rewrite the dark variant to be modifier-scoped.
MODIFIER_PATTERN = re.compile(
    r"(hover|group-hover|focus|focus-visible|active|disabled):(\S+) dark:(\S+)"
)

def rewrite_modifier(m: re.Match) -> str:
    mod, light, dark = m.group(1), m.group(2), m.group(3)
    return f"{mod}:{light} dark:{mod}:{dark}"

def main() -> int:
    for path_str in FILES:
        p = Path(path_str)
        text = p.read_text()
        original = text

        # 1. Drop the trailing dark:text-neutral-500 the text-neutral-400 rule
        #    appended onto cascaded dark:text-neutral-400.
        text = re.sub(
            r"dark:text-neutral-400 dark:text-neutral-500",
            "dark:text-neutral-400",
            text,
        )

        # 2. Re-scope dark variants that follow modifier-prefixed light variants.
        text = MODIFIER_PATTERN.sub(rewrite_modifier, text)

        if text != original:
            p.write_text(text)
            print(f"  cleaned: {path_str}")
        else:
            print(f"  unchanged: {path_str}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
