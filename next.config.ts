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
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
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
