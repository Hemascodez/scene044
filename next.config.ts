import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multipart overhead pushes a 10 MB venue photo beyond the proxy's 10 MB default.
  experimental: { proxyClientMaxBodySize: '12mb' },
  images: {
    formats: ['image/webp'],
    qualities: [75],
    localPatterns: [
      { pathname: '/api/poster/**', search: '' },
      { pathname: '/venues/**', search: '' },
      { pathname: '/stock/**', search: '' },
    ],
  },
};

export default nextConfig;
