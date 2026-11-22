"use client";

import { useRouter } from "next/navigation";
import { LibraryLoginPage } from "@/components/library-login/LibraryLoginPage";
import type { LoginCredentials, LoginResult } from "@/components/library-login/LoginPage";

export default function LoginRoutePage() {
  const router = useRouter();

  const handleLogin = async ({ email, password }: LoginCredentials): Promise<LoginResult> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      redirectTo?: string;
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || "Authentication failed. Please try again.",
      };
    }

    if (data.redirectTo) {
      router.push(data.redirectTo);
      router.refresh();
    }

    return { ok: true };
  };

  return <LibraryLoginPage onLogin={handleLogin} />;
}
