"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function ScanQrContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmToken = searchParams.get("token")?.trim() || "";

  // Desktop generate + poll state
  const [token, setToken] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [status, setStatus] = useState<
    "loading" | "pending" | "expired" | "confirmed" | "error"
  >("loading");
  const [message, setMessage] = useState<string | null>(null);

  // Mobile confirm state
  const [confirming, setConfirming] = useState(false);
  const [confirmFeedback, setConfirmFeedback] = useState<{
    ok: boolean;
    msg: string;
    needsLogin?: boolean;
  } | null>(null);

  const generateQr = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        token?: string;
        expires_in?: number;
        qr_image_url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.token) {
        setStatus("error");
        setMessage(data.error || "Unable to generate QR code.");
        return;
      }
      setToken(data.token);
      setQrImageUrl(data.qr_image_url || null);
      setExpiresIn(data.expires_in ?? 60);
      setStatus("pending");
    } catch {
      setStatus("error");
      setMessage("Network error while generating QR code.");
    }
  }, []);

  // Generate QR immediately in desktop mode
  useEffect(() => {
    if (!confirmToken) {
      void generateQr();
    }
  }, [confirmToken, generateQr]);

  // Countdown timer
  useEffect(() => {
    if (confirmToken || status !== "pending") return;
    const id = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [confirmToken, status]);

  // Poll /api/auth/qr every 2s while pending
  useEffect(() => {
    if (confirmToken || status !== "pending" || !token) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          status?: string;
          redirectTo?: string;
          reason?: string;
        };
        if (data.status === "confirmed" && data.redirectTo) {
          setStatus("confirmed");
          router.push(data.redirectTo);
          router.refresh();
        } else if (data.status === "expired") {
          setStatus("expired");
        } else if (data.status === "rejected") {
          setStatus("error");
          setMessage(data.reason || "QR login was rejected.");
        }
      } catch {
        // Ignore transient network poll errors
      }
    }, 2000);
    return () => clearInterval(id);
  }, [confirmToken, status, token, router]);

  const handleConfirmLogin = async () => {
    setConfirming(true);
    setConfirmFeedback(null);
    try {
      const res = await fetch("/api/auth/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", token: confirmToken }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (res.status === 401) {
        setConfirmFeedback({
          ok: false,
          msg: data.error || "Please sign in first on this device to approve the QR login.",
          needsLogin: true,
        });
      } else if (!res.ok || !data.ok) {
        setConfirmFeedback({ ok: false, msg: data.error || "Could not approve QR login." });
      } else {
        setConfirmFeedback({
          ok: true,
          msg: data.message || "Desktop session approved!",
        });
      }
    } catch {
      setConfirmFeedback({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setConfirming(false);
    }
  };

  if (confirmToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px] rounded-[22px] border border-accent2/25 bg-card-glass p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent2/25 bg-accent2/12 text-accent2">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="mb-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent2 uppercase">
            Mobile Session Approval
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">Approve Desktop Sign-In</h1>
          <p className="mb-6 text-xs leading-relaxed text-tl/80">
            Confirm that you want to sign in to the Iloilo City Public Library on the device
            displaying this QR code.
          </p>

          {confirmFeedback && (
            <div
              className={`mb-5 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs ${
                confirmFeedback.ok
                  ? "border-accent2/30 bg-accent2/12 text-accent2"
                  : "border-danger/30 bg-danger/12 text-danger"
              }`}
            >
              {confirmFeedback.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{confirmFeedback.msg}</span>
            </div>
          )}

          {!confirmFeedback?.ok && (
            <Button
              variant="accent"
              size="lg"
              className="mb-3 w-full"
              disabled={confirming}
              onClick={handleConfirmLogin}
            >
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              Approve Login
            </Button>
          )}

          <Button variant="secondary" size="md" className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              {confirmFeedback?.needsLogin ? "Sign In First" : "Back to Login"}
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] rounded-[22px] border border-accent/20 bg-card-glass p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent">
          <QrCode className="h-8 w-8" />
        </div>
        <div className="mb-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent2 uppercase">
          Quick QR Sign-In
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">QR Code Login</h1>
        <p className="mb-6 text-xs leading-relaxed text-tl/80">
          Scan this QR code with your signed-in mobile device to approve your desktop session.
        </p>

        <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-accent/30 bg-bg1/60 p-6">
          {status === "loading" && (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-xs text-tl">
              <Loader2 className="h-7 w-7 animate-spin text-accent" />
              <span>Generating secure QR token...</span>
            </div>
          )}

          {status === "pending" && qrImageUrl && (
            <>
              <div className="overflow-hidden rounded-xl bg-white p-2 shadow-lg">
                <img
                  src={qrImageUrl}
                  alt="Scan to approve login"
                  width={220}
                  height={220}
                  className="h-[220px] w-[220px]"
                />
              </div>
              <div className="mt-3 flex items-center gap-1.5 font-mono text-xs text-accent">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Expires in {expiresIn}s</span>
              </div>
            </>
          )}

          {status === "confirmed" && (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-xs text-accent2">
              <CheckCircle2 className="h-9 w-9" />
              <span className="font-semibold">Login confirmed! Redirecting...</span>
            </div>
          )}

          {(status === "expired" || status === "error") && (
            <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-xs text-tl">
              <AlertCircle className="h-8 w-8 text-warn" />
              <span>{message || "QR code expired. Generate a fresh code to continue."}</span>
              <Button variant="secondary" size="sm" onClick={generateQr}>
                <RefreshCw className="h-3.5 w-3.5" /> Generate New QR
              </Button>
            </div>
          )}
        </div>

        <Button variant="accent" size="md" className="w-full" asChild>
          <Link href="/login">
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </Link>
        </Button>
      </div>
    </main>
  );
}

export default function ScanQrPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-xs text-tl">
          Loading QR login...
        </div>
      }
    >
      <ScanQrContent />
    </Suspense>
  );
}
