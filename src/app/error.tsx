"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorRef, setErrorRef] = useState<string | null>(null);

  useEffect(() => {
    console.error("Application error boundary caught:", error);

    const route = typeof window !== "undefined" ? window.location.pathname : "/";
    fetch("/api/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        source: "Client",
        route,
        method: "RENDER",
        status_code: 500,
        message: error?.message || "Unhandled React Error Boundary crash",
        details: [
          error?.digest ? `Digest: ${error.digest}` : "",
          error?.stack || "",
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    })
      .then((r) => r.json())
      .then((d: { ok?: boolean; id?: string }) => {
        if (d.ok && d.id) setErrorRef(d.id);
      })
      .catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-[540px] overflow-hidden rounded-[24px] border border-danger/25 bg-card-glass p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-12"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-danger via-warn to-transparent" />

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/30 bg-danger/12 text-danger">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3.5 py-1 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-danger uppercase">
          ERR // 500 · RUNTIME ERROR
        </div>

        <h1 className="mb-3 text-[1.75rem] font-bold tracking-[-0.02em] text-white">
          Something Went Wrong
        </h1>

        <p className="mx-auto mb-4 max-w-[420px] text-[0.86rem] leading-[1.7] text-tl/80">
          An unexpected error occurred while loading this page. This event has been recorded for
          administrators.
        </p>

        {error?.message && (
          <div className="mb-4 rounded-xl border border-white/8 bg-bg1/70 px-4 py-2.5 font-mono text-[0.74rem] text-danger/90 break-words">
            {error.message}
          </div>
        )}

        {(errorRef || error?.digest) && (
          <div className="mb-6 font-mono text-[0.7rem] text-tl/60">
            Reference:{" "}
            <span className="text-accent">{errorRef || error?.digest}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button variant="accent" size="md" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Try Again
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/">
              <Home className="h-4 w-4" /> Back to Home
            </Link>
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
