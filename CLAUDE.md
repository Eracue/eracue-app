# ERA CUE — CLAUDE.md
# Read this at the start of every session before touching any file.

## What This Product Is
Pre-publication governance enforcement for executive communications.
Every draft passes through rule checks before it reaches any platform.
Every check produces an immutable, SHA-256 locked record.
No verdict is returned without a log entry.

## Live App
https://app.eracue.com
Stack: Next.js, Supabase, Tailwind

## The 64 Confirmed Changes
This session implements the 64 confirmed fixes across 8 surfaces.
Every fix has been reviewed for: hallucination risk, legal exposure,
technical feasibility, and product logic.

## Rules — Never Violate
1. Never claim ERA CUE determines legal compliance. It records that the process ran.
2. Legal framing on every record: "ERA CUE records that this governance process ran. Whether the communication satisfies applicable regulatory requirements is a determination for qualified legal counsel."
3. AI involvement field stores what is declared. It does not validate or determine AI origin.
4. Version history shows "Authorized [date]" only until backend actions table is confirmed.
5. No governance posture score. No false positive rate claims. No retention period specifics.
6. Never add competitor names to UI copy.
7. Verdict animations: BLOCK = red border. CLEARED = teal #0EA5E9. No page reload.

## Color Tokens
CLEARED/APPROVED: #0EA5E9 (teal)
BLOCK: #EF4444 (red)
REVIEW: #F59E0B (amber)
Background dark: #0F172A
Surface: #1E293B
Border: #334155
Text primary: #F8FAFC
Text muted: #94A3B8
Legal note text: #64748B

## Key File Paths (update if your structure differs)
src/app/page.tsx — homepage
src/app/submit/ — submit page
src/app/rules/ — rules engine
src/app/dashboard/ — campaign view
src/app/record/ — examiner record
src/components/ — shared components
