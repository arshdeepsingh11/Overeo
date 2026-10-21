import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // hide the floating Next.js dev badge (it sat on top of the mobile nav)
  devIndicators: false,
  // No ESLint config in this project yet — don't block production builds on it.
  eslint: { ignoreDuringBuilds: true },
  // three.js ships modern ESM; let Next optimise imports from these packages.
  experimental: {
    optimizePackageImports: ["three", "gsap"],
  },
  async headers() {
    return [
      {
        // map data and fonts are versioned by filename — cache hard
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
