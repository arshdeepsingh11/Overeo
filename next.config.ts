import type { NextConfig } from "next";

// The backend (backend/) runs as its own service. The website forwards
// /api/v1/* to it, so the browser talks to one address and the session
// cookie stays first-party. Set BACKEND_URL where the website runs.
const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // one self-contained server for your own machines (Docker / PM2)
  output: "standalone",
  poweredByHeader: false,
  // hide the floating Next.js dev badge (it sat on top of the mobile nav)
  devIndicators: false,
  // No ESLint config in this project yet — don't block production builds on it.
  eslint: { ignoreDuringBuilds: true },
  // three.js ships modern ESM; let Next optimise imports from these packages.
  experimental: {
    optimizePackageImports: ["three", "gsap"],
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${BACKEND_URL}/v1/:path*` }];
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
