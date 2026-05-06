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
  // Belt-and-braces cache busting: tell Vercel's edge and the browser to
  // never cache *any* response. Without this, Vercel's ISR layer can serve
  // stale pre-rendered pages even when the page module declares
  // force-dynamic + revalidate=0 — the directives only control the SSR
  // path, not the CDN response cache. `no-store` skips the CDN entirely
  // and forces the browser to revalidate on every request.
  async headers() {
    return [
      // Belt: every path gets no-store. `/(.*)` already matches `/`, but Next's
      // routing precedence gives a more specific source priority — so we add an
      // explicit `/` entry below carrying additional CDN-busting headers.
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
      // Braces: explicit homepage entry. Surrogate-Control targets Vercel's
      // CDN layer (which honours the header in addition to Cache-Control), and
      // Pragma: no-cache covers HTTP/1.0-style intermediaries. This is the
      // belt-and-braces pass to defeat the stale-prerender issue specifically
      // on `/` where ISR was sticking.
      {
        source: "/",
        headers: [
          { key: "Cache-Control",     value: "no-store, must-revalidate" },
          { key: "Surrogate-Control", value: "no-store" },
          { key: "Pragma",            value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
