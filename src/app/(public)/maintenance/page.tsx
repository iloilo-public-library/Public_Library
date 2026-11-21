"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, Wrench } from "lucide-react";

function MaintenanceContent() {
  const params = useSearchParams();
  const isLockdown = params.get("mode") === "lockdown";
  const message =
    params.get("message") ||
    (isLockdown
      ? "The system is temporarily locked for security reasons. Please try again later or contact an administrator."
      : "We are currently performing scheduled maintenance to improve your experience. Please check back shortly.");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 0.84, 0.44, 1] }}
        className="w-full max-w-[520px] rounded-[24px] border border-white/10 bg-card-glass px-6 py-10 text-center backdrop-blur-md sm:px-12 sm:py-[52px]"
      >
        <div
          className={`mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[22px] ${
            isLockdown
              ? "bg-danger/15 text-[#ff7070]"
              : "bg-warn/15 text-[#ffb74d]"
          }`}
        >
          {isLockdown ? <ShieldAlert className="h-9 w-9" /> : <Wrench className="h-9 w-9" />}
        </div>

        <div
          className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] ${
            isLockdown
              ? "border-danger/25 bg-danger/10 text-[#ff9090]"
              : "border-warn/25 bg-warn/10 text-[#ffb74d]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 animate-pulse rounded-full ${
              isLockdown ? "bg-[#ff7070]" : "bg-[#ffb74d]"
            }`}
          />
          {isLockdown ? "Security Lockdown" : "Scheduled Maintenance"}
        </div>

        <h1 className="mb-3.5 text-[clamp(1.5rem,4vw,2rem)] font-bold tracking-[-0.03em] text-white">
          {isLockdown ? "System Locked" : "Under Maintenance"}
        </h1>

        <p className="mb-8 text-[0.9rem] leading-[1.75] text-tl/65">{message}</p>

        <hr className="mb-7 border-white/8" />

        <div className="flex items-center justify-center gap-2.5 text-white/50">
          <img
            src="/images/logo.png"
            alt="Logo"
            className="h-7 w-7 rounded-[7px] bg-accent/10 object-contain p-0.5"
          />
          <span className="text-[0.82rem] font-semibold">Iloilo City Public Library</span>
        </div>
      </motion.div>
    </main>
  );
}

export default function MaintenancePage() {
  return (
    <Suspense>
      <MaintenanceContent />
    </Suspense>
  );
}
