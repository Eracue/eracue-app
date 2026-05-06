"use client";

import { useState } from "react";
import Link from "next/link";

type Speaker = {
  id: string;
  name: string;
  title: string | null;
  totalDrafts: number;
  blocked: number;
  escalated: number;
  approved: number;
  overridden: number;
  pending: number;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  totalDrafts: number;
  blocked: number;
  escalated: number;
  speakers: {
    id: string;
    name: string;
    title: string | null;
    drafts: { id: string; draft_text: string; status: string; channel: string }[];
  }[];
};

type Props = {
  speakers: Speaker[];
  campaigns: Campaign[];
};

function statusColor(status: string): string {
  if (status === "blocked") return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
  if (status === "escalated") return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
  if (status === "approved") return "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900";
  if (status === "overridden") return "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900";
  return "text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800";
}

export function DashboardTabs({ speakers, campaigns }: Props) {
  const [tab, setTab] = useState<"campaign" | "speaker">("campaign");

  return (
    <>
      <div className="flex gap-1 mb-4 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setTab("campaign")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "campaign"
              ? "border-neutral-900 text-neutral-900 dark:text-neutral-100"
              : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          By campaign
        </button>
        <button
          onClick={() => setTab("speaker")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "speaker"
              ? "border-neutral-900 text-neutral-900 dark:text-neutral-100"
              : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          By speaker
        </button>
      </div>

      {tab === "campaign" ? (
        <CampaignView campaigns={campaigns} />
      ) : (
        <SpeakerView speakers={speakers} />
      )}
    </>
  );
}

function CampaignView({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-12 text-center text-neutral-500 dark:text-neutral-400">
        No campaigns yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {campaigns.map((c) => (
        <div key={c.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{c.name}</h3>
                {c.description && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{c.description}</p>
                )}
              </div>
              <div className="flex gap-3 text-xs text-neutral-600 dark:text-neutral-400">
                <span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{c.totalDrafts}</span> draft{c.totalDrafts === 1 ? "" : "s"}
                </span>
                {c.blocked > 0 && (
                  <span className="text-red-700 dark:text-red-400">
                    <span className="font-medium">{c.blocked}</span> blocked
                  </span>
                )}
                {c.escalated > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    <span className="font-medium">{c.escalated}</span> escalated
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Side-by-side speaker grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {c.speakers.map((sp) => (
                <div key={sp.id} className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
                  <div className="mb-3">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{sp.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{sp.title || ""}</div>
                  </div>
                  <ul className="space-y-2">
                    {sp.drafts.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/drafts/${d.id}`}
                          className="block group"
                        >
                          <div className="flex items-start gap-2">
                            <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide ${statusColor(d.status)}`}>
                              {d.status}
                            </span>
                            <p className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 line-clamp-2">
                              {d.draft_text}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpeakerView({ speakers }: { speakers: Speaker[] }) {
  if (speakers.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-12 text-center text-neutral-500 dark:text-neutral-400">
        No speakers yet.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Speaker</th>
            <th className="text-right px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Total</th>
            <th className="text-right px-4 py-3 font-medium text-red-700 dark:text-red-400">Blocked</th>
            <th className="text-right px-4 py-3 font-medium text-amber-700 dark:text-amber-400">Escalated</th>
            <th className="text-right px-4 py-3 font-medium text-green-700 dark:text-green-400">Approved</th>
            <th className="text-right px-4 py-3 font-medium text-purple-700 dark:text-purple-400">Overridden</th>
          </tr>
        </thead>
        <tbody>
          {speakers.map((s) => (
            <tr key={s.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <td className="px-4 py-3">
                <div className="font-medium text-neutral-900 dark:text-neutral-100">{s.name}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{s.title || ""}</div>
              </td>
              <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-100 font-medium">{s.totalDrafts}</td>
              <td className="px-4 py-3 text-right text-red-700 dark:text-red-400">{s.blocked || ""}</td>
              <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">{s.escalated || ""}</td>
              <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">{s.approved || ""}</td>
              <td className="px-4 py-3 text-right text-purple-700 dark:text-purple-400">{s.overridden || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
