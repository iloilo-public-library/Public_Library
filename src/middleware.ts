import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_ONLY_ROUTE_PREFIXES,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
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

interface EdgeSystemModeSettings {
  maintenance_enabled?: boolean | null;
  maintenance_message?: string | null;
  bypass_role?: string | null;
  lockdown_enabled?: boolean | null;
}

const SESSION_REFRESH_THRESHOLD_SEC = 3000;
const SYSTEM_MODE_CACHE_TTL_MS = 5000;
const SYSTEM_MODE_FETCH_TIMEOUT_MS = 2000;

const ALWAYS_ALLOWED_PREFIXES = [
  "/maintenance",
  "/login",
  "/logout",
  "/reset-password",
  "/reset-pin",
  "/api/auth",
  "/_next",
] as const;

const STATIC_ASSET_RE =
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$/i;

let cachedSystemMode: {
  settings: EdgeSystemModeSettings | null;
  expiresAt: number;
} | null = null;

function getSigningSecret(): string {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.SECRET_KEY?.trim();
    if (!secret) {
      throw new Error("SECRET_KEY must be configured in production.");
    }
    return secret;
  }
  const secret =
    process.env.SECRET_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("SECRET_KEY or SUPABASE_SECRET_KEY must be configured.");
  }
  return secret;
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

async function signSessionEdge(
  payload: Omit<EdgeSessionPayload, "exp">
): Promise<string> {
  const full: EdgeSessionPayload = {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
    sessionToken: payload.sessionToken,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const encoder = new TextEncoder();
  const data = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(full)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const sig = uint8ArrayToBase64Url(new Uint8Array(mac));
  return `${data}.${sig}`;
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

function isAlwaysAllowedPath(pathname: string): boolean {
  if (matchesPrefix(pathname, ALWAYS_ALLOWED_PREFIXES)) return true;
  if (pathname === "/favicon.ico" || pathname.startsWith("/favicon")) return true;
  if (STATIC_ASSET_RE.test(pathname)) return true;
  return false;
}

async function getSystemModeSettingsEdge(): Promise<EdgeSystemModeSettings | null> {
  const now = Date.now();
  if (cachedSystemMode && cachedSystemMode.expiresAt > now) {
    return cachedSystemMode.settings;
  }

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();

  if (!supabaseUrl || !serviceKey || serviceKey.startsWith("REPLACE_")) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYSTEM_MODE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?select=maintenance_enabled,maintenance_message,bypass_role,lockdown_enabled&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      return null;
    }

    const rows = (await res.json()) as unknown;
    const settings =
      Array.isArray(rows) && rows.length > 0
        ? (rows[0] as EdgeSystemModeSettings)
        : null;

    cachedSystemMode = {
      settings,
      expiresAt: now + SYSTEM_MODE_CACHE_TTL_MS,
    };
    return settings;
  } catch {
    // Fail open cleanly if Supabase is unreachable or offline
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function setSessionCookie(response: NextResponse, signedToken: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAlwaysAllowedPath(pathname)) {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionEdge(rawCookie);

  // Enforce emergency lockdown & maintenance mode on page navigations
  if (!pathname.startsWith("/api/")) {
    const systemMode = await getSystemModeSettingsEdge();
    if (systemMode?.lockdown_enabled) {
      if (session?.role !== "admin") {
        if (session) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("reason", "lockdown");
          const response = NextResponse.redirect(loginUrl);
          clearSessionCookie(response);
          return response;
        }
        const maintenanceUrl = new URL("/maintenance", request.url);
        maintenanceUrl.searchParams.set("mode", "lockdown");
        const response = NextResponse.redirect(maintenanceUrl);
        if (rawCookie) {
          clearSessionCookie(response);
        }
        return response;
      }
    } else if (systemMode?.maintenance_enabled) {
      const isBypassed =
        session?.role === "admin" ||
        (session?.role === "librarian" && systemMode.bypass_role === "admin_librarian");

      if (!isBypassed) {
        if (session) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("reason", "maintenance");
          const response = NextResponse.redirect(loginUrl);
          clearSessionCookie(response);
          return response;
        }
        const maintenanceUrl = new URL("/maintenance", request.url);
        maintenanceUrl.searchParams.set("mode", "maintenance");
        const trimmedMessage = String(systemMode.maintenance_message ?? "").trim();
        if (trimmedMessage) {
          maintenanceUrl.searchParams.set("message", trimmedMessage);
        }
        return NextResponse.redirect(maintenanceUrl);
      }
    }
  }

  const isStaffPath = matchesPrefix(pathname, STAFF_ROUTE_PREFIXES);
  const isAdminOnlyPath = matchesPrefix(pathname, ADMIN_ONLY_ROUTE_PREFIXES);
  const isUserPath = matchesPrefix(pathname, USER_ROUTE_PREFIXES);

  if (isStaffPath || isUserPath) {
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
  }

  const response = NextResponse.next();

  // Sliding 1h session expiry on active authenticated requests
  if (session) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (session.exp - nowSec < SESSION_REFRESH_THRESHOLD_SEC) {
      try {
        const refreshed = await signSessionEdge({
          userId: session.userId,
          role: session.role,
          email: session.email,
          sessionToken: session.sessionToken,
        });
        setSessionCookie(response, refreshed);
      } catch {
        // Non-blocking if signing fails
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$).*)",
  ],
};
