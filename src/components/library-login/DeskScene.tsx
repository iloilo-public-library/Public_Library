"use client";

import { useState } from "react";
import type { UseBookFlipReturn } from "@/components/auth/useBookFlip";
import type { LegalModalType } from "@/components/landing/LegalModal";
import { Book } from "./Book";
import { HoloPanel } from "./HoloPanel";
import { LoginPage, type LoginCredentials, type LoginResult } from "./LoginPage";
import { SignUpPage } from "./SignUpPage";

export interface DeskSceneProps {
  bookFlip: UseBookFlipReturn;
  loginEmail: string;
  loginPassword: string;
  onLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onLogin: (credentials: LoginCredentials) => Promise<LoginResult>;
  onOpenLegal: (type: LegalModalType) => void;
}

const FUNNEL_PARTICLES = [
  { left: "26%", delay: "0s", duration: "4.6s", size: 3 },
  { left: "34%", delay: "1.2s", duration: "5.2s", size: 2.5 },
  { left: "42%", delay: "0.6s", duration: "4.2s", size: 3.2 },
  { left: "49%", delay: "2.1s", duration: "5.6s", size: 2.4 },
  { left: "56%", delay: "0.9s", duration: "4.8s", size: 3 },
  { left: "63%", delay: "1.8s", duration: "5.0s", size: 2.6 },
  { left: "70%", delay: "0.3s", duration: "4.5s", size: 2.8 },
  { left: "38%", delay: "2.6s", duration: "5.4s", size: 2.2 },
] as const;

export function DeskScene({
  bookFlip,
  loginEmail,
  loginPassword,
  onLoginEmailChange,
  onLoginPasswordChange,
  onLogin,
  onOpenLegal,
}: DeskSceneProps) {
  const [externalSuccess, setExternalSuccess] = useState<string | null>(null);

  const {
    introPhase,
    visibleMode,
    cardPhase,
    cardInteractive,
    isFlipping,
    flipDirection,
    flipKey,
    turnedCount,
    funnelDimmed,
    announcement,
    switchMode,
    triggerStepFlip,
    triggerRouteFlip,
  } = bookFlip;

  const funnelVisible = introPhase === "glowing" || introPhase === "ready";

  return (
    <div className="ilpl-projector-stack">
      {/* 1. Holographic Auth Card — strictly OUTSIDE the book's preserve-3d context */}
      <HoloPanel
        cardPhase={cardPhase}
        interactive={cardInteractive}
        announcement={announcement}
        activeKey={visibleMode}
      >
        {visibleMode === "login" ? (
          <LoginPage
            email={loginEmail}
            password={loginPassword}
            onEmailChange={onLoginEmailChange}
            onPasswordChange={onLoginPasswordChange}
            disabled={!cardInteractive}
            onLogin={onLogin}
            onOpenLegal={onOpenLegal}
            onRouteFlip={triggerRouteFlip}
            externalSuccess={externalSuccess}
            onClearExternalSuccess={() => setExternalSuccess(null)}
          />
        ) : (
          <SignUpPage
            onSuccess={(msg) => {
              setExternalSuccess(msg);
              switchMode("login");
            }}
            onSwitchToLogin={() => switchMode("login")}
            onStepFlip={triggerStepFlip}
            isTransitioning={!cardInteractive || isFlipping}
            onOpenLegal={onOpenLegal}
          />
        )}
      </HoloPanel>

      {/* 2. CSS-Only Projector Funnel of Light (dims slightly on flip, then surges) */}
      <div
        className="ilpl-funnel-wrap"
        data-active={funnelVisible ? "true" : "false"}
        data-dimmed={funnelDimmed ? "true" : "false"}
        aria-hidden="true"
      >
        <div className="ilpl-funnel-beam" />
        <span className="ilpl-funnel-band ilpl-funnel-band-1" />
        <span className="ilpl-funnel-band ilpl-funnel-band-2" />
        <span className="ilpl-funnel-band ilpl-funnel-band-3" />
        <div className="ilpl-funnel-particles">
          {FUNNEL_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="ilpl-funnel-dot"
              style={{
                left: p.left,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>
      </div>

      {/* 3. Small Open Baybayin Book with CSS 3D intro cover open + 3-page riffle flip */}
      <Book
        introPhase={introPhase}
        visibleMode={visibleMode}
        isFlipping={isFlipping}
        flipDirection={flipDirection}
        flipKey={flipKey}
        turnedCount={turnedCount}
      />
    </div>
  );
}
