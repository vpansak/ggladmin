import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/",
        permanent: false,
      },
      {
        source: "/admin/:path+",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
