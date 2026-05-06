"use client";

import { useState } from "react";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  return isoDate(d);
}

function todayIso(): string {
  return isoDate(new Date());
}

// Card with a date range + "Generate report →" button. Opens the
// /supervision-report route in a new tab; the route handles fetching and
// printing.
export function SupervisionExport() {
  const [from, setFrom] = useState<string>(() => firstOfMonth());
  const [to, setTo] = useState<string>(() => todayIso());

  function handleGenerate() {
    const url = `/supervision-report?from=${encodeURIComponent(
      from,
    )}&to=${encodeURIComponent(to)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mt-10">
      <div className="bg-[#F5F6F8] border border-[#DDE1E9] rounded-sm p-5 flex justify-between items-center gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#5C6B7A]">
            SUPERVISION PERIOD REPORT
          </div>
          <div className="text-xs text-[#0F1923] mt-1">
            Generate a printable FINRA examination record for any date range.
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Report start date"
              className="border border-[#DDE1E9] rounded-sm px-3 py-1.5 text-xs font-mono text-[#0F1923] bg-white focus:outline-none focus:ring-1 focus:ring-[#1D6EE8]"
            />
            <span className="text-xs text-[#5C6B7A]">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Report end date"
              className="border border-[#DDE1E9] rounded-sm px-3 py-1.5 text-xs font-mono text-[#0F1923] bg-white focus:outline-none focus:ring-1 focus:ring-[#1D6EE8]"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="bg-[#1B2B4B] text-white text-xs font-mono font-medium px-4 py-1.5 rounded-sm hover:bg-[#0F1923] transition-colors"
          >
            Generate report →
          </button>
        </div>
      </div>
    </section>
  );
}
