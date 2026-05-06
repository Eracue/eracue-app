"use client";

import { useRouter } from "next/navigation";

type Props = { currentFilter: "active" | "all" };

export function RulesFilter({ currentFilter }: Props) {
  const router = useRouter();

  return (
    <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800">
      <button
        onClick={() => router.push("/rules?filter=active")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
          currentFilter === "active"
            ? "border-neutral-900 text-neutral-900 dark:text-neutral-100"
            : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        }`}
      >
        Active now
      </button>
      <button
        onClick={() => router.push("/rules?filter=all")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
          currentFilter === "all"
            ? "border-neutral-900 text-neutral-900 dark:text-neutral-100"
            : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        }`}
      >
        All rules
      </button>
    </div>
  );
}
