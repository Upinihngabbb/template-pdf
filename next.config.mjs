/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/project",
        destination: "http://localhost:5262/project",
      },
      {
        source: "/api/external-projects",
        destination: "http://localhost:5262/external-projects",
      },
      {
        source: "/api/external-projects/:id",
        destination: "http://localhost:5262/external-projects/:id",
      },
    ];
  },
};

export default nextConfig;
