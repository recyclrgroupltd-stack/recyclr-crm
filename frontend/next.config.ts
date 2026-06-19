import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        '"http://127.0.0.1:8000"': JSON.stringify(
          process.env.NEXT_PUBLIC_BACKEND_BASE || "http://127.0.0.1:8000",
        ),
      }),
    );
    return config;
  },
};

export default nextConfig;
