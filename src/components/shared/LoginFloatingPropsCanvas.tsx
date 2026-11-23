"use client";

import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  FloatingBookItem,
  FloatingPaperSheet,
  LibraryGlobe,
} from "@/components/shared/FloatingBooks";

function LoginFloatingScene() {
  const reducedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <ambientLight intensity={0.75} color="#dbe8f8" />
      <directionalLight position={[-4, 6, 5]} intensity={1.15} color="#ffd996" />
      <pointLight position={[4, 2, 3]} intensity={0.65} color="#9fc3ea" />

      {/* Framed strictly along the outer perimeter of the hero panel (never over title, description, or top bar) */}
      <LibraryGlobe
        position={[-2.9, 1.95, -2.0]}
        scale={0.44}
        phase={1.4}
        reducedRef={reducedRef}
      />

      <FloatingBookItem
        spec={{
          id: "login-open-bottom-left",
          basePos: [-2.65, -2.15, -1.6],
          baseRot: [0.3, 0.36, -0.14],
          bobAmp: 0.07,
          bobSpeed: 1.05,
          rotSpeedX: 0.06,
          rotSpeedY: 0.1,
          phase: 3.4,
          scale: 0.44,
        }}
        coverColor="#5a2a1d"
        open
        reducedRef={reducedRef}
      />

      <FloatingBookItem
        spec={{
          id: "login-open-bottom-right",
          basePos: [2.55, -2.15, -1.6],
          baseRot: [0.32, -0.42, 0.12],
          bobAmp: 0.07,
          bobSpeed: 0.98,
          rotSpeedX: 0.06,
          rotSpeedY: 0.1,
          phase: 2.0,
          scale: 0.42,
        }}
        coverColor="#1d3b5a"
        open
        reducedRef={reducedRef}
      />

      <FloatingPaperSheet
        spec={{
          id: "login-paper-top-right",
          basePos: [2.85, 2.05, -2.0],
          baseRot: [-0.18, -0.4, 0.16],
          bobAmp: 0.07,
          bobSpeed: 0.96,
          rotSpeedX: 0.06,
          rotSpeedY: 0.08,
          phase: 1.9,
          scale: 0.44,
        }}
        docTitle="RA 7743 CHARTER"
        stampText="ARCHIVED"
        reducedRef={reducedRef}
      />
    </>
  );
}

/**
 * Shared 3D floating books, paper sheet, and globe confined inside the sliding hero panel.
 * Reuses the exact components and animation timing from FloatingBooks.tsx.
 */
export function LoginFloatingPropsCanvas() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[2] hidden overflow-hidden lg:block opacity-70"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.2, 7.6], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        style={{ pointerEvents: "none" }}
      >
        <LoginFloatingScene />
      </Canvas>
    </div>
  );
}
