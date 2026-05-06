"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ExaminerRecord = {
  // Stable key (use the action id to dedupe).
  id: string;
  draftId: string;
  speakerName: string;
  draftSnippet: string;
  decision: string | undefined;
  occurredAt: string;
};

type Props = { records: ExaminerRecord[] };

const DECISION_BADGE: Record<string, { cls: string; label: string }> = {
  override:      { cls: "bg-[#EFF8FF] text-[#0F172A] border-[#BAE6FD]", label: "OVERRIDE" },
  confirm_block: { cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]", label: "CONFIRM BLOCK" },
  approve:       { cls: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]", label: "APPROVE" },
  reject:        { cls: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]", label: "REJECT" },
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ExaminerRecordsSection({ records }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return records.slice(0, 10);
    return records
      .filter((r) => r.speakerName.toLowerCase().includes(q))
      .slice(0, 10);
  }, [records, filter]);

  return (
    <section className="mt-10">
      <div className="flex justify-between items-baseline gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
            GOVERNANCE RECORDS
          </div>
          <div className="text-base font-semibold text-[#0F172A] mt-1">
            Direct links to governance records
          </div>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by speaker..."
          aria-label="Filter examiner records by speaker name"
          className="border border-[#E2E8F0] rounded-sm px-3 py-1.5 text-sm font-mono text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#0F172A] w-48"
        />
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="font-mono text-sm text-[#64748B] py-4 text-center">
            No records match your filter.
          </div>
        ) : (
          filtered.map((r) => {
            const badge =
              DECISION_BADGE[r.decision ?? ""] ?? {
                cls: "bg-[#F8F9FB] text-[#64748B] border-[#E2E8F0]",
                label: (r.decision || "—").toUpperCase(),
              };
            return (
              <div
                key={r.id}
                className="bg-white border border-[#E2E8F0] rounded-sm mb-1 px-5 py-4 flex items-center justify-between hover:bg-[#F5F6F8] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#0F172A]">
                    {r.speakerName}
                  </div>
                  <div className="text-xs text-[#374151] truncate max-w-xs mt-0.5">
                    {r.draftSnippet}
                  </div>
                </div>
                <div className="flex gap-2 items-center shrink-0 mx-4">
                  <span
                    className={`font-mono text-xs uppercase px-2 py-0.5 rounded-sm border ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  <span className="font-mono text-xs text-[#94A3B8]">
                    {fmtDateTime(r.occurredAt)}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/drafts/${r.draftId}/examiner?view=full`}
                    className="font-mono text-sm font-medium text-[#1A56DB] hover:text-[#0F172A] transition-colors"
                  >
                    Governance record →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
