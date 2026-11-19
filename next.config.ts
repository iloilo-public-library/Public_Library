import type { NextConfig } from "next";

const FLASK_BACKEND = process.env.FLASK_BACKEND_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async rewrites() {
    // Only fall back to legacy Flask backend if FLASK_BACKEND_URL is explicitly configured.
    // On Vercel, public/static/* and src/app/api/* (Supabase) are served natively.
    if (!FLASK_BACKEND) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }

    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: "/api/:path*", destination: `${FLASK_BACKEND}/api/:path*` },
        { source: "/cover/:path*", destination: `${FLASK_BACKEND}/cover/:path*` },
        { source: "/download/:path*", destination: `${FLASK_BACKEND}/download/:path*` },
        { source: "/qr/:path*", destination: `${FLASK_BACKEND}/qr/:path*` },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/api/public/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
