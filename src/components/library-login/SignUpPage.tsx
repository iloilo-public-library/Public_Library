"use client";

import { useState } from "react";
import { SignupWizard } from "@/components/auth/SignupWizard";
import type { LegalModalType } from "@/components/landing/LegalModal";
import { StatusBanner } from "./forms";

export interface SignUpPageProps {
  onSuccess: (message: string) => void;
  onSwitchToLogin: () => void;
  onOpenLegal: (type: LegalModalType) => void;
}

export function SignUpPage({
  onSuccess,
  onSwitchToLogin,
  onOpenLegal,
}: SignUpPageProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div id="ilpl-panel-signup">
      <StatusBanner error={error} success={null} />

      <div className="ilpl-signup-wrap">
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
        />
      </div>
    </div>
  );
}
