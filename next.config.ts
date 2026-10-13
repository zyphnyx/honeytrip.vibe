import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Two local origins let emulator UI tests use independent browser persistence.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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
