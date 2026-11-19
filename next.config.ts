import type { NextConfig } from "next";

const FLASK_BACKEND = process.env.FLASK_BACKEND_URL || "http://127.0.0.1:5000";

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
    // Using `fallback` ensures native Next.js + Supabase routes in src/app/api/*
    // always take priority, while unmigrated legacy Flask endpoints still work locally.
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: "/api/:path*", destination: `${FLASK_BACKEND}/api/:path*` },
        { source: "/static/:path*", destination: `${FLASK_BACKEND}/static/:path*` },
        { source: "/cover/:path*", destination: `${FLASK_BACKEND}/cover/:path*` },
        { source: "/download/:path*", destination: `${FLASK_BACKEND}/download/:path*` },
        { source: "/qr/:path*", destination: `${FLASK_BACKEND}/qr/:path*` },
        { source: "/verify_captcha", destination: `${FLASK_BACKEND}/verify_captcha` },
        { source: "/verify_otp", destination: `${FLASK_BACKEND}/verify_otp` },
        { source: "/verify_pin", destination: `${FLASK_BACKEND}/verify_pin` },
        { source: "/resend_otp", destination: `${FLASK_BACKEND}/resend_otp` },
        { source: "/signup", destination: `${FLASK_BACKEND}/signup` },
        { source: "/forgot_password", destination: `${FLASK_BACKEND}/forgot_password` },
        { source: "/forgot_pin/:path*", destination: `${FLASK_BACKEND}/forgot_pin/:path*` },
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
        source: "/cover/:path*",
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
