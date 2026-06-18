/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/admin/relationship-recovery": ["./data/**/*.csv"]
    }
  }
};

export default nextConfig;
