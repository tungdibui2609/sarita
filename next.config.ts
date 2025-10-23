import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Không chặn build vì lỗi ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
