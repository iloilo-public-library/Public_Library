"use client";

import Link from "next/link";
import { ArrowLeft, QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScanQrPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] rounded-[22px] border border-accent/20 bg-card-glass p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent">
          <QrCode className="h-8 w-8" />
        </div>
        <div className="mb-2 font-mono text-[0.7rem] font-bold tracking-[0.14em] text-accent2 uppercase">
          AUTH // QR QUICK LOGIN
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">QR Code Login</h1>
        <p className="mb-6 text-xs leading-relaxed text-tl/80">
          Scan your Iloilo City Public Library QR token using the mobile companion app to approve
          your session.
        </p>

        <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-accent/30 bg-bg1/60 p-8">
          <Smartphone className="mb-2 h-8 w-8 text-accent/60" />
          <span className="font-mono text-xs text-white/55">
            Sign in with email &amp; password on web or scan from mobile app
          </span>
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
