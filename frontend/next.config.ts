import type { NextConfig } from "next";

const backendBase =
  process.env.NEXT_PUBLIC_BACKEND_BASE ||
  (process.env.NODE_ENV === "production"
    ? "https://recyclr-crm-backend.onrender.com"
    : "http://127.0.0.1:8000");

const nextConfig: NextConfig = {
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
