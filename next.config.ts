import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every signed-in page is per-user and dynamic, so the request-time model is simpler.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
