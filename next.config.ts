import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // The dev-tools badge sits bottom-left by default, on top of the sidebar
  // account footer. Build/runtime error overlays still show without it.
  devIndicators: false,
  // A stray ~/pnpm-lock.yaml makes Turbopack infer the home dir as the
  // workspace root (and watch all of it). Pin it to this project.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // Only this project's storage — a wildcard lets anyone use our image
        // optimizer as a proxy for any Supabase bucket.
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.supabase.co").hostname,
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No framing (clickjacking on admin pages). A full CSP is left out:
          // Next's inline scripts would need nonces on every page.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Strip /en prefix so existing routes continue to work as-is
      { source: "/en", destination: "/dashboard" },
      { source: "/en/:path*", destination: "/:path*" },
    ];
  },
};

export default withNextIntl(nextConfig);
