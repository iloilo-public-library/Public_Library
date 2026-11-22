"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { SignupWizard } from "@/components/auth/SignupWizard";
import type { FlipDirection } from "@/components/auth/useBookFlip";
import type { LegalModalType } from "@/components/landing/LegalModal";
import { StatusBanner } from "./forms";

export interface SignUpPageProps {
  onSuccess: (message: string) => void;
  onSwitchToLogin: () => void;
  onStepFlip: (direction: FlipDirection, stepNumber: number) => void;
  isTransitioning: boolean;
  onOpenLegal: (type: LegalModalType) => void;
}

export function SignUpPage({
  onSuccess,
  onSwitchToLogin,
  onStepFlip,
  isTransitioning,
  onOpenLegal,
}: SignUpPageProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#9fc3ea]">
            Patron Enrollment
          </p>
          <h2 className="ilpl-holo-title mt-0.5">Create Account</h2>
        </div>

        <button
          type="button"
          disabled={isTransitioning}
          onClick={onSwitchToLogin}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-[#9fc3ea]/35 bg-[#9fc3ea]/10 px-3 text-xs font-semibold text-[#e8f1fb] transition hover:border-[#f5cf7a]/65 hover:text-[#f5cf7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a] cursor-pointer disabled:opacity-55"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          Log In
        </button>
      </div>

      <StatusBanner error={error} success={null} />

      <div className="ilpl-holo-wizard">
        <SignupWizard
          onSuccess={(msg) => {
            setError(null);
            onSuccess(msg);
          }}
          onError={setError}
          onSwitchToLogin={() => {
            setError(null);
            onSwitchToLogin();
          }}
          onOpenLegal={onOpenLegal}
          onStepChange={(stepNum, dir) => onStepFlip(dir, stepNum)}
        />
      </div>
    </div>
  );
}
