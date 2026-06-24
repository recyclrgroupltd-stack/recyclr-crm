import type { NextConfig } from "next";

const backendBase = process.env.NEXT_PUBLIC_BACKEND_BASE || "https://recyclr-crm-backend.onrender.com";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination: `${backendBase}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
