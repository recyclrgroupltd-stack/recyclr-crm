import type { NextConfig } from "next";

const backendBase =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_BACKEND_BASE || "https://recyclr-crm-backend.onrender.com"
    : process.env.NEXT_PUBLIC_BACKEND_BASE || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendBase}/media/:path*`,
      },
    ];
  },
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        '"http://127.0.0.1:8000"': JSON.stringify(backendBase),
      }),
    );
    return config;
  },
};

export default nextConfig;
