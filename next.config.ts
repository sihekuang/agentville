import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "./"),
  outputFileTracingIncludes: {
    "/*": [
      "scripts/macos/**/*",
      "node_modules/next/dist/compiled/next-server/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/*": ["dist/**/*", "dist-electron/**/*"],
  },
};

export default nextConfig;
