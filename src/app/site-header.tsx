import Link from "next/link";

// Static, dark-band nav. Two variants:
//   • "marketing" — wordmark only. Used on the marketing homepage so
//     visitors aren't pulled into app surfaces before they understand
//     the product.
//   • "app" (default) — wordmark + five labels:
//        Rules · Submit · Inbox · Campaigns · Record
//     in that exact order. Labels were renamed from
//     "Check / Review / Programs / Reports" so the surface vocabulary
//     reads as the workflow stages a speaker / VP Comms moves through.
//     The href targets stay on the same routes — only visible text
//     changed.
//
// `print:hidden` removes the nav from any printed PDF (examiner
// record, campaign export); the print stylesheet in globals.css also
// hides any element inside <nav> as a defensive measure.
type Variant = "marketing" | "app";

export function SiteHeader({ variant = "app" }: { variant?: Variant } = {}) {
  return (
    <header className="bg-[#0D1B2A] border-b border-white/[0.07] px-6 md:px-12 py-4 print:hidden">
      <nav className="max-w-[1100px] mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-[13px] text-white tracking-[0.06em]"
          aria-label="ERA CUE — home"
        >
          <span className="font-bold">ERA</span>
          <span className="italic font-light"> CUE</span>
        </Link>
        {variant === "app" && (
          <div className="flex items-center gap-6">
            {(
              [
                { href: "/rules", label: "Rules" },
                { href: "/check", label: "Submit" },
                { href: "/review", label: "Inbox" },
                { href: "/programs", label: "Campaigns" },
                { href: "/reports", label: "Record" },
              ] as const
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/[0.62] hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
