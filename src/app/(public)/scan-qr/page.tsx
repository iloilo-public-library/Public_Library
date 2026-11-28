"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

function extractQrToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("://") || trimmed.startsWith("/") || trimmed.includes("token=")) {
    try {
      const parsed = new URL(
        trimmed,
        typeof window !== "undefined" ? window.location.origin : "http://localhost"
      );
      const token = parsed.searchParams.get("token")?.trim();
      if (token && /^[A-Za-z0-9_-]{16,256}$/.test(token)) {
        return token;
      }
    } catch {
      // Fallback to direct regex check below
    }
  }
  return /^[A-Za-z0-9_-]{16,256}$/.test(trimmed) ? trimmed : null;
}

function ScanQrContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmToken = searchParams.get("token")?.trim() || "";

  const [mode, setMode] = useState<"display" | "scanner">("display");

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

  // Mobile camera scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<
    "idle" | "starting" | "scanning" | "unsupported" | "error"
  >("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

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

  // Generate QR immediately in desktop display mode
  useEffect(() => {
    if (!confirmToken && mode === "display") {
      void generateQr();
    }
  }, [confirmToken, mode, generateQr]);

  // Countdown timer
  useEffect(() => {
    if (confirmToken || mode !== "display" || status !== "pending") return;
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
  }, [confirmToken, mode, status]);

  // Poll /api/auth/qr every 2s while pending
  useEffect(() => {
    if (confirmToken || mode !== "display" || status !== "pending" || !token) return;
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
  }, [confirmToken, mode, status, token, router]);

  // Camera scanner lifecycle
  useEffect(() => {
    if (confirmToken || mode !== "scanner") {
      stopCamera();
      setCameraState("idle");
      return;
    }

    let cancelled = false;
    let scanTimer: number | null = null;

    const startScanner = async () => {
      setCameraError(null);
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraState("unsupported");
        setCameraError("Camera access is not available in this browser. Paste the QR link or token below.");
        return;
      }

      setCameraState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const DetectorCtor = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
        if (!DetectorCtor) {
          setCameraState("unsupported");
          setCameraError(
            "Automatic QR decoding is unavailable in this browser. Use your device camera app or paste the QR token below."
          );
          return;
        }

        const detector = new DetectorCtor({ formats: ["qr_code"] });
        setCameraState("scanning");

        const scanFrame = async () => {
          if (cancelled || !videoRef.current) return;
          if (videoRef.current.readyState >= 2) {
            try {
              const codes = await detector.detect(videoRef.current);
              for (const item of codes) {
                const decoded = item.rawValue ? extractQrToken(item.rawValue) : null;
                if (decoded) {
                  stopCamera();
                  router.push(`/scan-qr?token=${encodeURIComponent(decoded)}`);
                  return;
                }
              }
            } catch {
              // Ignore transient frame detection failures
            }
          }
          if (!cancelled) {
            scanTimer = window.setTimeout(() => void scanFrame(), 300);
          }
        };

        scanTimer = window.setTimeout(() => void scanFrame(), 300);
      } catch {
        if (!cancelled) {
          setCameraState("error");
          setCameraError(
            "Unable to access camera. Allow camera permission or paste the QR link/token below."
          );
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      if (scanTimer !== null) window.clearTimeout(scanTimer);
      stopCamera();
    };
  }, [confirmToken, mode, router, stopCamera]);

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = extractQrToken(manualInput);
    if (!parsed) {
      setManualError("Enter a valid QR login URL or 16–256 character token.");
      return;
    }
    setManualError(null);
    stopCamera();
    router.push(`/scan-qr?token=${encodeURIComponent(parsed)}`);
  };

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
    const loginHref = `/login?next=${encodeURIComponent(`/scan-qr?token=${confirmToken}`)}`;

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
              role={confirmFeedback.ok ? "status" : "alert"}
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
            <Link href={confirmFeedback?.needsLogin ? loginHref : "/login"}>
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
          {mode === "scanner" ? <Camera className="h-8 w-8" /> : <QrCode className="h-8 w-8" />}
        </div>
        <div className="mb-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent2 uppercase">
          Quick QR Sign-In
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">
          {mode === "scanner" ? "Scan Desktop QR Code" : "QR Code Login"}
        </h1>
        <p className="mb-5 text-xs leading-relaxed text-tl/80">
          {mode === "scanner"
            ? "Point your signed-in mobile device camera at the desktop QR code to approve sign-in."
            : "Scan this QR code with your signed-in mobile device to approve your desktop session."}
        </p>

        {/* Mode switcher: Show QR Code vs Scan QR Code */}
        <div
          role="tablist"
          aria-label="QR login mode"
          className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-bg1/60 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "display"}
            onClick={() => setMode("display")}
            className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${
              mode === "display"
                ? "bg-accent text-on-accent shadow-xs"
                : "text-tl/80 hover:text-white"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            Show QR Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "scanner"}
            onClick={() => setMode("scanner")}
            className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${
              mode === "scanner"
                ? "bg-accent text-on-accent shadow-xs"
                : "text-tl/80 hover:text-white"
            }`}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            Scan QR Code
          </button>
        </div>

        {mode === "display" ? (
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
        ) : (
          <div className="mb-6 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-dashed border-accent/30 bg-bg1/60 p-4">
              {cameraState === "starting" && (
                <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-xs text-tl">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  <span>Starting camera...</span>
                </div>
              )}

              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-label="QR code camera preview"
                className={`mx-auto h-[220px] w-full rounded-xl bg-black/50 object-cover ${
                  cameraState === "scanning" || cameraState === "unsupported" ? "block" : "hidden"
                }`}
              />

              {cameraError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-left text-xs text-warn"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2 text-left">
              <label htmlFor="manual-qr-token" className="block text-xs font-semibold text-tl">
                Or paste QR link / token
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-qr-token"
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    if (manualError) setManualError(null);
                  }}
                  placeholder="Paste QR URL or token"
                  className="min-h-[40px] flex-1 rounded-xl border border-white/15 bg-bg1/80 px-3 text-xs text-white placeholder:text-tl/45 focus:border-accent/60 focus:outline-none"
                />
                <Button type="submit" variant="accent" size="sm">
                  Continue
                </Button>
              </div>
              {manualError && (
                <p role="alert" className="text-xs text-danger">
                  {manualError}
                </p>
              )}
            </form>
          </div>
        )}

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
