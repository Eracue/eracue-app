"use client";

import { useState } from "react";
import type { CheckEntry } from "@/lib/checks";

type Props = { checks: CheckEntry[] };

function ResultBadge({ result }: { result: CheckEntry["result"] }) {
 const styles: Record<CheckEntry["result"], { bg: string; text: string; border: string; label: string }> = {
 pass: {
 bg: "bg-[#F0FDF4]",
 text: "text-[#166534]",
 border: "border-[#BBF7D0]",
 label: "PASS",
 },
 fail: {
 bg: "bg-[#FEF2F2]",
 text: "text-[#B91C1C]",
 border: "border-[#FECACA]",
 label: "FAIL",
 },
 warn: {
 bg: "bg-[#FFF7ED]",
 text: "text-[#C2410C]",
 border: "border-[#FED7AA]",
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
 <div className="bg-white border border-[#E2E8F0] rounded-sm mb-6">
 <button
 type="button"
 onClick={() => setOpen(!open)}
 aria-expanded={open}
 className="w-full flex items-center justify-between px-6 py-4 text-left"
 >
 <span className="text-xs uppercase tracking-widest text-[#64748B]">
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
 className={`text-[#64748B] transition-transform ${open ? "rotate-180" : ""}`}
 >
 <polyline points="6 9 12 15 18 9" />
 </svg>
 </button>
 {open && (
 <ul className="border-t border-[#E2E8F0] divide-y divide-[#E2E8F0]">
 {checks.map((c, i) => (
 <li key={`${c.check_name}-${i}`} className="px-6 py-3 flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-[#0F172A]">{c.check_name}</div>
 {c.detail && (
 <div className="text-xs text-[#64748B] mt-0.5">{c.detail}</div>
 )}
 {c.matched_keyword && (
 <div className="text-xs text-[#64748B] mt-0.5">
 Matched keyword: <span className="font-mono bg-[#F1F5F9] px-1.5 py-0.5 rounded">{c.matched_keyword}</span>
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
