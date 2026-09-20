import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // hls.js ships an ESM build that Next.js needs to transpile.
  transpilePackages: ["hls.js"],
  images: {
    // Artwork hosts rotate across providers. Images remain unoptimized so the
    // original CDN is used, while the wildcard lets our resilient Image
    // wrapper keep intrinsic layout and fallbacks consistent.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    const dev = process.env.NODE_ENV !== "production";

    // Poster art comes from many provider CDNs that rotate, so img-src has to
    // accept https broadly; everything with real teeth is locked down instead.
    // Next's bootstrap needs inline script, and dev additionally needs eval.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://cloud.umami.is${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' https: data: blob:",
      // Streams are served from our own proxy; hls.js feeds them in as blobs.
      "media-src 'self' blob:",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // frame-ancestors covers modern browsers; this covers the rest.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // Nothing under /api is ever cacheable by a shared cache.
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/browse",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default config;
