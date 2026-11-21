import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_ONLY_ROUTE_PREFIXES,
  SESSION_COOKIE_NAME,
  STAFF_ROUTE_PREFIXES,
  USER_ROUTE_PREFIXES,
  type UserRole,
} from "@/config/constants";

interface EdgeSessionPayload {
  userId: number;
  role: UserRole;
  email: string;
  sessionToken: string;
  exp: number;
}

function getSigningSecret(): string {
  return (
    process.env.SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "icpl-dev-fallback-secret-change-me"
  );
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySessionEdge(token: string | undefined): Promise<EdgeSessionPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getSigningSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const expected = uint8ArrayToBase64Url(new Uint8Array(mac));
    if (!timingSafeEqualStrings(sig, expected)) return null;

    const jsonStr = new TextDecoder().decode(base64UrlToUint8Array(data));
    const parsed = JSON.parse(jsonStr) as EdgeSessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (parsed.role !== "admin" && parsed.role !== "librarian" && parsed.role !== "user") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStaffPath = matchesPrefix(pathname, STAFF_ROUTE_PREFIXES);
  const isAdminOnlyPath = matchesPrefix(pathname, ADMIN_ONLY_ROUTE_PREFIXES);
  const isUserPath = matchesPrefix(pathname, USER_ROUTE_PREFIXES);

  if (!isStaffPath && !isUserPath) {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionEdge(rawCookie);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isStaffPath) {
    if (session.role === "user") {
      return NextResponse.redirect(new URL("/user/home", request.url));
    }
    if (isAdminOnlyPath && session.role !== "admin") {
      return NextResponse.redirect(new URL("/librarian/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/admin-settings/:path*",
    "/system-settings/:path*",
    "/librarian/:path*",
    "/user/:path*",
  ],
};
