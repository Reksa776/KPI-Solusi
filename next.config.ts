import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.99.247"],
  experimental: {
    useTypeScriptCli: false,
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
