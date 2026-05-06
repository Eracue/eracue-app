"use client";

import { useRouter } from "next/navigation";

type Props = { currentFilter: "active" | "all" };

export function RulesFilter({ currentFilter }: Props) {
 const router = useRouter();

 return (
 <div className="flex gap-1 mb-6 border-b border-[#E2E1DC]">
 <button
 onClick={() => router.push("/rules?filter=active")}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
 currentFilter === "active"
 ? "border-[#1C1C1A] text-[#1C1C1A]"
 : "border-transparent text-[#6E6E68] hover:text-[#1C1C1A]"
 }`}
 >
 Active now
 </button>
 <button
 onClick={() => router.push("/rules?filter=all")}
 className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
 currentFilter === "all"
 ? "border-[#1C1C1A] text-[#1C1C1A]"
 : "border-transparent text-[#6E6E68] hover:text-[#1C1C1A]"
 }`}
 >
 All rules
 </button>
 </div>
 );
}
