import type { NextConfig } from "next";

const backendBaseUrl =
  process.env.INTERNAL_API_BASE_URL ?? "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
