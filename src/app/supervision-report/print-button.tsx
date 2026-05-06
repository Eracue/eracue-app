"use client";

// Tiny client-only wrapper around window.print(). Lives next to the
// supervision report so the report itself remains a server component.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-[#1B2B4B] text-white text-xs font-mono font-medium px-4 py-1.5 rounded-sm hover:bg-[#0F172A] transition-colors"
    >
      Print report
    </button>
  );
}
