import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverComponentsExternalPackages: ["digest-fetch"] },
};

export default nextConfig;
