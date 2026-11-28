"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LibraryLoginPage } from "@/components/library-login/LibraryLoginPage";
import type {
  LoginCredentials,
  LoginNotice,
  LoginResult,
} from "@/components/library-login/LoginPage";

function getSafeNextUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/\\")
  ) {
    return null;
  }
  try {
    const baseOrigin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const resolved = new URL(trimmed, baseOrigin);
    if (resolved.origin !== baseOrigin) return null;
    if (resolved.pathname === "/login") return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

function getRoleDefaultRedirect(role?: string): string {
  if (role === "admin") return "/dashboard";
  if (role === "librarian") return "/librarian/dashboard";
  return "/user/home";
}

function LoginRouteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawNext = searchParams.get("next");
  const loggedOut = searchParams.get("loggedOut");
  const reason = searchParams.get("reason");

  const safeNext = useMemo(() => getSafeNextUrl(rawNext), [rawNext]);

  const initialNotice = useMemo<LoginNotice | null>(() => {
    if (loggedOut === "1" || reason === "logout") {
      return {
        kind: "success",
        title: "Signed Out",
        message: "You have been signed out successfully.",
      };
    }
    if (reason === "lockdown") {
      return {
        kind: "warning",
        title: "Emergency Lockdown Active",
        message: "System access is restricted. Only administrators may sign in right now.",
      };
    }
    if (reason === "maintenance") {
      return {
        kind: "warning",
        title: "Maintenance Mode",
        message: "The library portal is undergoing scheduled maintenance. Authorized staff may sign in below.",
      };
    }
    return null;
  }, [loggedOut, reason]);

  // Redirect already-signed-in users away from /login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: { role?: string };
        };
        if (!cancelled && data.authenticated && data.user?.role) {
          const target = getSafeNextUrl(rawNext) || getRoleDefaultRedirect(data.user.role);
          router.replace(target);
          router.refresh();
        }
      } catch {
        // Stay on login page on network error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawNext, router]);

  const completeNavigation = (backendRedirect?: string) => {
    const target = safeNext || backendRedirect;
    if (target) {
      router.push(target);
      router.refresh();
    }
  };

  const handleLogin = async ({
    email,
    password,
    captcha_token,
  }: LoginCredentials): Promise<LoginResult> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captcha_token }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      redirectTo?: string;
      pendingApproval?: boolean;
      mfa_required?: boolean;
      methods?: ("otp" | "pin")[];
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        pendingApproval: Boolean(data.pendingApproval),
        error: data.error || "Authentication failed. Please try again.",
      };
    }

    if (data.mfa_required) {
      return {
        ok: true,
        mfaRequired: true,
        mfaMethods: Array.isArray(data.methods) ? data.methods : [],
      };
    }

    const target = safeNext || data.redirectTo;
    return {
      ok: true,
      redirectTo: target,
      onCompleteRedirect: () => completeNavigation(data.redirectTo),
    };
  };

  return (
    <LibraryLoginPage
      onLogin={handleLogin}
      initialNotice={initialNotice}
      onMfaComplete={completeNavigation}
    />
  );
}

export default function LoginRoutePage() {
  return (
    <Suspense fallback={null}>
      <LoginRouteContent />
    </Suspense>
  );
}
