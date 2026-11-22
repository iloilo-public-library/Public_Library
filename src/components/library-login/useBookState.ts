"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BookState = "login" | "closing" | "opening" | "signup";
export type BookMode = "login" | "signup";

export interface UseBookStateOptions {
  reducedMotion?: boolean;
  /** Animation speed multiplier (1 = default). */
  speed?: number;
}

export interface UseBookStateReturn {
  bookState: BookState;
  /** Mode currently displayed on the tome spread and hologram (swaps while cover is closed). */
  visibleMode: BookMode;
  /** Mode targeted by the user (drives active ribbon tab state). */
  activeMode: BookMode;
  /** True during the full dissolve -> turn -> close -> open -> materialize sequence. */
  isAnimating: boolean;
  /** True when the enchanted cover is closed over the open tome. */
  isCoverClosed: boolean;
  /** True while the right page turns over around the spine. */
  isTurningPage: boolean;
  /** True when the floating hologram is materialized above the book. */
  holoVisible: boolean;
  transitionTo: (target: BookMode) => void;
}

export function useBookState(options: UseBookStateOptions = {}): UseBookStateReturn {
  const { reducedMotion = false, speed = 1 } = options;

  const [bookState, setBookState] = useState<BookState>("login");
  const [visibleMode, setVisibleMode] = useState<BookMode>("login");
  const [activeMode, setActiveMode] = useState<BookMode>("login");
  const [isTurningPage, setIsTurningPage] = useState(false);
  const [isCoverClosed, setIsCoverClosed] = useState(false);
  const [holoVisible, setHoloVisible] = useState(reducedMotion);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  // Initial page-load choreography: book enters, then hologram materializes with rune-draw
  useEffect(() => {
    if (reducedMotion) {
      setHoloVisible(true);
      return;
    }
    const id = window.setTimeout(() => {
      setHoloVisible(true);
    }, 420);
    return () => window.clearTimeout(id);
  }, [reducedMotion]);

  useEffect(() => clearTimers, [clearTimers]);

  const isAnimating = bookState === "closing" || bookState === "opening";

  const transitionTo = useCallback(
    (target: BookMode) => {
      if (isAnimating || target === activeMode) return;

      clearTimers();
      setActiveMode(target);

      if (reducedMotion) {
        setVisibleMode(target);
        setBookState(target);
        setIsTurningPage(false);
        setIsCoverClosed(false);
        setHoloVisible(true);
        return;
      }

      const s = Math.max(0.25, speed);
      // 1) Hologram dissolves (~0.4s)
      // 2) Right page turns around spine (~0.8s) starting slightly as hologram fades
      // 3) Book closes & cover shimmers (~0.6s)
      // 4) Spread swaps under cover, cover opens (~0.9s)
      // 5) New hologram materializes only after book has opened
      const tTurnStart = Math.round(320 * s);
      const tCoverClose = Math.round(920 * s);
      const tCoverOpen = Math.round(1620 * s);
      const tHoloIn = Math.round(2440 * s);
      const tDone = Math.round(2720 * s);

      setBookState("closing");
      setHoloVisible(false);

      timersRef.current.push(
        window.setTimeout(() => {
          setIsTurningPage(true);
        }, tTurnStart),
        window.setTimeout(() => {
          setIsCoverClosed(true);
        }, tCoverClose),
        window.setTimeout(() => {
          setIsTurningPage(false);
          setVisibleMode(target);
          setBookState("opening");
          setIsCoverClosed(false);
        }, tCoverOpen),
        window.setTimeout(() => {
          setHoloVisible(true);
        }, tHoloIn),
        window.setTimeout(() => {
          setBookState(target);
        }, tDone)
      );
    },
    [activeMode, clearTimers, isAnimating, reducedMotion, speed]
  );

  return {
    bookState,
    visibleMode,
    activeMode,
    isAnimating,
    isCoverClosed,
    isTurningPage,
    holoVisible,
    transitionTo,
  };
}

