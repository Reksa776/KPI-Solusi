import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.99.247"],
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
