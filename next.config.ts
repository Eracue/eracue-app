import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable client-side Router Cache staleness for both dynamic and static
  // segments. Combined with `export const dynamic = "force-dynamic"` and
  // `revalidate = 0` on the page modules, this guarantees every navigation
  // re-fetches from the server instead of serving a stale RSC payload from
  // the in-memory client cache. Required because Supabase data is mutated
  // by server actions and the demo flow relies on seeing changes
  // immediately after navigation.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
