import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["digest-fetch"],
    // Vercelでのストリーミング対応
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.vercel.app"],
    },
  },
  // VercelでのAPI制限対策
  async headers() {
    return [
      {
        source: "/api/stream",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Connection",
            value: "keep-alive",
          },
        ],
      },
    ];
  },
  // タイムアウト設定
  async rewrites() {
    return [
      {
        source: "/api/stream",
        destination: "/api/stream",
      },
    ];
  },
};

export default nextConfig;
