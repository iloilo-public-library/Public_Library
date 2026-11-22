"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BookMode = "login" | "signup";
export type FlipDirection = "forward" | "backward";
export type IntroPhase = "closed" | "opening" | "glowing" | "ready";
export type CardPhase = "hidden" | "out" | "in" | "visible";

export interface UseBookFlipReturn {
  introPhase: IntroPhase;
  visibleMode: BookMode;
  activeMode: BookMode;
  cardPhase: CardPhase;
  cardInteractive: boolean;
  isFlipping: boolean;
  flipDirection: FlipDirection;
  flipKey: number;
  turnedCount: number;
  funnelDimmed: boolean;
  announcement: string;
  switchMode: (target: BookMode) => void;
  triggerStepFlip: (direction: FlipDirection, stepNumber: number) => void;
  triggerRouteFlip: (onNavigate: () => void, label: string) => void;
}

const FALLBACK_SAFETY_MS = 1500;

export function useBookFlip(): UseBookFlipReturn {
  const [introPhase, setIntroPhase] = useState<IntroPhase>("closed");
  const [visibleMode, setVisibleMode] = useState<BookMode>("login");
  const [activeMode, setActiveMode] = useState<BookMode>("login");
  const [cardPhase, setCardPhase] = useState<CardPhase>("hidden");
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<FlipDirection>("forward");
  const [flipKey, setFlipKey] = useState(0);
  const [turnedCount, setTurnedCount] = useState(1);
  const [funnelDimmed, setFunnelDimmed] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const reducedMotionRef = useRef(false);
  const isDesktopRef = useRef(true);
  const isBusyRef = useRef(false);
  const activeModeRef = useRef<BookMode>("login");
  const queuedTargetRef = useRef<BookMode | null>(null);
  const timersRef = useRef<number[]>([]);
  const pendingCompleteRef = useRef<(() => void) | null>(null);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const shouldUseSimpleCrossfade = () => reducedMotionRef.current || !isDesktopRef.current;

  // Media queries (prefers-reduced-motion + >=1024px desktop) & visibilitychange safety
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqDesktop = window.matchMedia("(min-width: 1024px)");
    reducedMotionRef.current = mqMotion.matches;
    isDesktopRef.current = mqDesktop.matches;

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    const onDesktopChange = (e: MediaQueryListEvent) => {
      isDesktopRef.current = e.matches;
    };
    mqMotion.addEventListener("change", onMotionChange);
    mqDesktop.addEventListener("change", onDesktopChange);

    // Intro sequence (A): closed -> opening (1000ms) -> glow/funnel -> card materializes
    if (mqMotion.matches || !mqDesktop.matches) {
      setIntroPhase("ready");
      setCardPhase("visible");
    } else {
      schedule(() => setIntroPhase("opening"), 80);
      schedule(() => setIntroPhase("glowing"), 860);
      schedule(() => {
        setIntroPhase("ready");
        setCardPhase("in");
      }, 1060);
      schedule(() => setCardPhase("visible"), 1660);
    }

    // Pause / finish immediately when tab is hidden so user never returns to a blank screen
    const onVisibility = () => {
      if (document.hidden && pendingCompleteRef.current) {
        clearTimers();
        const finish = pendingCompleteRef.current;
        pendingCompleteRef.current = null;
        finish();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mqMotion.removeEventListener("change", onMotionChange);
      mqDesktop.removeEventListener("change", onDesktopChange);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
  }, [clearTimers, schedule]);

  const runModeSwitch = useCallback(
    (target: BookMode) => {
      const direction: FlipDirection = target === "signup" ? "forward" : "backward";
      isBusyRef.current = true;
      activeModeRef.current = target;
      setActiveMode(target);
      setFlipDirection(direction);

      const finish = () => {
        clearTimers();
        pendingCompleteRef.current = null;
        setVisibleMode(target);
        setIsFlipping(false);
        setFunnelDimmed(false);
        setCardPhase("visible");
        setAnnouncement(target === "signup" ? "Sign Up form" : "Log In form");
        isBusyRef.current = false;

        // If user clicked rapidly during the flip, play ONLY the latest queued target
        const queued = queuedTargetRef.current;
        queuedTargetRef.current = null;
        if (queued && queued !== activeModeRef.current) {
          runModeSwitch(queued);
        }
      };

      pendingCompleteRef.current = finish;

      // Reduced motion or <1024px: simple 200ms card crossfade, static book
      if (shouldUseSimpleCrossfade()) {
        setCardPhase("out");
        schedule(() => {
          setVisibleMode(target);
          setCardPhase("in");
        }, 100);
        schedule(finish, 240);
        return;
      }

      // Full synchronized sequence (~1080ms):
      // 0-200ms: card dematerializes top-down
      // 100-920ms: 3-page CSS 3D flip + funnel dim/surge + gutter pulse
      // ~480ms (midpoint): swap form content while card is invisible
      // 700-1100ms: new card materializes bottom-up
      setCardPhase("out");
      setFunnelDimmed(true);

      schedule(() => {
        setIsFlipping(true);
        setFlipKey((k) => k + 1);
      }, 100);

      schedule(() => {
        setVisibleMode(target);
        setFunnelDimmed(false);
        setTurnedCount((c) => Math.max(1, Math.min(5, direction === "forward" ? c + 1 : c - 1)));
      }, 480);

      schedule(() => {
        setCardPhase("in");
      }, 700);

      schedule(finish, 1100);

      // 1500ms failure-safety fallback
      schedule(() => {
        if (pendingCompleteRef.current === finish) {
          finish();
        }
      }, FALLBACK_SAFETY_MS);
    },
    [clearTimers, schedule]
  );

  const switchMode = useCallback(
    (target: BookMode) => {
      if (isBusyRef.current) {
        // Queue only the latest requested mode; ignore double flips
        if (target !== activeModeRef.current) {
          queuedTargetRef.current = target;
        }
        return;
      }
      if (target === activeModeRef.current) return;
      runModeSwitch(target);
    },
    [runModeSwitch]
  );

  // Wizard step forward/backward flip (keeps wizard mounted and preserves state)
  const triggerStepFlip = useCallback(
    (direction: FlipDirection, stepNumber: number) => {
      setAnnouncement(`Sign Up step ${stepNumber} of 3`);
      if (shouldUseSimpleCrossfade() || isBusyRef.current) return;

      isBusyRef.current = true;
      setFlipDirection(direction);
      setIsFlipping(true);
      setFlipKey((k) => k + 1);
      setFunnelDimmed(true);

      const finish = () => {
        clearTimers();
        pendingCompleteRef.current = null;
        setIsFlipping(false);
        setFunnelDimmed(false);
        isBusyRef.current = false;
      };
      pendingCompleteRef.current = finish;

      schedule(() => {
        setFunnelDimmed(false);
        setTurnedCount((c) => Math.max(1, Math.min(5, direction === "forward" ? c + 1 : c - 1)));
      }, 420);

      schedule(finish, 900);
      schedule(() => {
        if (pendingCompleteRef.current === finish) finish();
      }, FALLBACK_SAFETY_MS);
    },
    [clearTimers, schedule]
  );

  // Page flip before navigating to Forgot Password or QR Login
  const triggerRouteFlip = useCallback(
    (onNavigate: () => void, label: string) => {
      if (shouldUseSimpleCrossfade() || isBusyRef.current) {
        onNavigate();
        return;
      }
      isBusyRef.current = true;
      setAnnouncement(`Opening ${label}`);
      setFlipDirection("forward");
      setCardPhase("out");
      setFunnelDimmed(true);
      setIsFlipping(true);
      setFlipKey((k) => k + 1);

      const finish = () => {
        clearTimers();
        pendingCompleteRef.current = null;
        isBusyRef.current = false;
        onNavigate();
      };
      pendingCompleteRef.current = finish;

      schedule(finish, 460);
      schedule(() => {
        if (pendingCompleteRef.current === finish) finish();
      }, FALLBACK_SAFETY_MS);
    },
    [clearTimers, schedule]
  );

  return {
    introPhase,
    visibleMode,
    activeMode,
    cardPhase,
    cardInteractive: cardPhase === "visible" || cardPhase === "in",
    isFlipping,
    flipDirection,
    flipKey,
    turnedCount,
    funnelDimmed,
    announcement,
    switchMode,
    triggerStepFlip,
    triggerRouteFlip,
  };
}
