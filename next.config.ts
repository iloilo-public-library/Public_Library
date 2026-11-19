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
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${FLASK_BACKEND}/api/:path*` },
      { source: "/static/:path*", destination: `${FLASK_BACKEND}/static/:path*` },
      { source: "/cover/:path*", destination: `${FLASK_BACKEND}/cover/:path*` },
      { source: "/download/:path*", destination: `${FLASK_BACKEND}/download/:path*` },
      { source: "/dashboard/stats", destination: `${FLASK_BACKEND}/dashboard/stats` },
      { source: "/librarian_dashboard/stats", destination: `${FLASK_BACKEND}/librarian_dashboard/stats` },
      { source: "/qr/:path*", destination: `${FLASK_BACKEND}/qr/:path*` },
      { source: "/verify_captcha", destination: `${FLASK_BACKEND}/verify_captcha` },
      { source: "/verify_otp", destination: `${FLASK_BACKEND}/verify_otp` },
      { source: "/verify_pin", destination: `${FLASK_BACKEND}/verify_pin` },
      { source: "/resend_otp", destination: `${FLASK_BACKEND}/resend_otp` },
      { source: "/signup", destination: `${FLASK_BACKEND}/signup` },
      { source: "/forgot_password", destination: `${FLASK_BACKEND}/forgot_password` },
      { source: "/forgot_pin/:path*", destination: `${FLASK_BACKEND}/forgot_pin/:path*` },
      { source: "/user/upload_valid_id", destination: `${FLASK_BACKEND}/user/upload_valid_id` },
      { source: "/user/valid-id/view", destination: `${FLASK_BACKEND}/user/valid-id/view` },
      { source: "/user/update_profile", destination: `${FLASK_BACKEND}/user/update_profile` },
      { source: "/user/change_password", destination: `${FLASK_BACKEND}/user/change_password` },
      { source: "/user/scan_valid_id", destination: `${FLASK_BACKEND}/user/scan_valid_id` },
      { source: "/user/clear_search_history", destination: `${FLASK_BACKEND}/user/clear_search_history` },
      { source: "/user/clear_favorites", destination: `${FLASK_BACKEND}/user/clear_favorites` },
      { source: "/user/submit-account-request", destination: `${FLASK_BACKEND}/user/submit-account-request` },
      { source: "/user/mfa/:path*", destination: `${FLASK_BACKEND}/user/mfa/:path*` },
      { source: "/admin/update_profile", destination: `${FLASK_BACKEND}/admin/update_profile` },
      { source: "/admin/security/:path*", destination: `${FLASK_BACKEND}/admin/security/:path*` },
    ];
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
