import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multipart overhead pushes a 10 MB venue photo beyond the proxy's 10 MB default.
  experimental: { proxyClientMaxBodySize: '12mb' },
};

export default nextConfig;
