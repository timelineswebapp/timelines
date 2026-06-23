/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/admin/relationship-recovery": ["./data/**/*.csv"]
  }
};

export default nextConfig;
