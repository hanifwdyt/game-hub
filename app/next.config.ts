import type { NextConfig } from "next";

const config: NextConfig = {
  // self-contained server for Docker / Coolify (see DEPLOY.md); NEXT_DIST_DIR lets a production build run next to `next dev`
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // the catalogue scans the file system, so tracing would otherwise drag the whole project (docs, local db, legacy…) into the build
  outputFileTracingExcludes: { "*": ["./docs/**", "./legacy/**", "./data/**", "./tools/**", "./deploy/**", "./*.md"] },
  serverExternalPackages: ["better-sqlite3", "sharp"],
  images: {
    // game art is served by /art/[id]/[file] straight from each game's folder
    localPatterns: [{ pathname: "/art/**" }],
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    deviceSizes: [640, 960, 1280, 1920, 2560],
    imageSizes: [96, 160, 240, 320, 480],
  },
  poweredByHeader: false,
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      // the hub (and the games it serves) may only be framed by the hub itself
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    return [{ source: "/:path*", headers: common }];
  },
};

export default config;
