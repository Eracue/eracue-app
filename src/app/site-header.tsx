import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="print:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-lg font-medium text-indigo-700 dark:text-indigo-400" style={{ fontFamily: "var(--font-newsreader)" }}>ERA CUE</span>
          <span className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-600">demo</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
