import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload routes enforce smaller authenticated limits in proxy.ts before
      // Next.js parses multipart Server Action bodies. This is a final ceiling.
      bodySizeLimit: "270mb",
    },
  },
};

export default nextConfig;
