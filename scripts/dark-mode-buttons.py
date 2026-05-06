#!/usr/bin/env python3
"""Two fixes:
  1. Collapse `dark:hover:hover:` (and other doubled modifier cascades) caused
     by running dark-mode-cleanup.py twice with overlapping rules.
  2. Add `dark:bg-indigo-600 dark:hover:bg-indigo-500` to primary buttons that
     currently use `bg-neutral-900 ... hover:bg-neutral-800` so they don't
     blend into the dark page background.
"""
import re
from pathlib import Path

# Scan more broadly here — primary buttons live across pages and components.
import glob

files = sorted(set(
    glob.glob("src/app/**/*.tsx", recursive=True)
    + glob.glob("src/app/**/*.ts", recursive=True)
))

DOUBLED_MODIFIER = re.compile(
    r"dark:(hover|group-hover|focus|focus-visible|active|disabled):"
    r"(hover|group-hover|focus|focus-visible|active|disabled):"
)

def main() -> int:
    for path_str in files:
        p = Path(path_str)
        text = p.read_text()
        original = text

        # 1. Collapse doubled modifier in dark variants — keep the outermost.
        text = DOUBLED_MODIFIER.sub(lambda m: f"dark:{m.group(1)}:", text)

        # 2. Primary button: bg-neutral-900 ... hover:bg-neutral-800 → add indigo dark variants.
        #    Surgical replacements — only touch tokens, never adding the variant
        #    if it's already there.
        if "dark:bg-indigo-600" not in text:
            text = text.replace(
                "bg-neutral-900 text-white",
                "bg-neutral-900 dark:bg-indigo-600 text-white",
            )
        # Match the hover replacement against the original string. The transition
        # follows `hover:bg-neutral-800` in every primary-button class string.
        if "dark:hover:bg-indigo-500" not in text:
            text = text.replace(
                "hover:bg-neutral-800 transition",
                "hover:bg-neutral-800 dark:hover:bg-indigo-500 transition",
            )

        if text != original:
            p.write_text(text)
            print(f"  modified: {path_str}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
