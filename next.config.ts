import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multipart overhead pushes a 10 MB venue photo beyond the proxy's 10 MB default.
  experimental: {
    proxyClientMaxBodySize: '12mb',
    // Railway's restored Turbopack cache served stale routes despite new source.
    // Build from source each deployment; this does not change the runtime UI.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
