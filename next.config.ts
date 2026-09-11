import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
