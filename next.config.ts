import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload routes enforce smaller authenticated limits in proxy.ts before
      // Next.js parses multipart Server Action bodies. This is a final ceiling.
      bodySizeLimit: "270mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.selahember.com",
          },
        ],
        destination: "https://selahember.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
