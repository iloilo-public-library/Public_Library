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

      {/* Reused landing-page floating elements: scaled down & framed around the edges (never over the login card) */}
      <LibraryGlobe
        position={[-5.1, 2.35, -1.6]}
        scale={0.48}
        phase={1.4}
        reducedRef={reducedRef}
      />

      <FloatingBookItem
        spec={{
          id: "login-open-top-left",
          basePos: [-3.4, -1.85, -1.2],
          baseRot: [0.3, 0.36, -0.14],
          bobAmp: 0.07,
          bobSpeed: 1.05,
          rotSpeedX: 0.06,
          rotSpeedY: 0.1,
          phase: 3.4,
          scale: 0.5,
        }}
        coverColor="#5a2a1d"
        open
        reducedRef={reducedRef}
      />

      <FloatingBookItem
        spec={{
          id: "login-closed-top-right",
          basePos: [4.85, 2.5, -1.5],
          baseRot: [0.26, -0.4, 0.14],
          bobAmp: 0.08,
          bobSpeed: 1.15,
          rotSpeedX: 0.06,
          rotSpeedY: 0.12,
          phase: 1.2,
          scale: 0.48,
        }}
        coverColor="#1f4d3b"
        reducedRef={reducedRef}
      />

      <FloatingBookItem
        spec={{
          id: "login-open-bottom-right",
          basePos: [5.0, -1.9, -1.3],
          baseRot: [0.32, -0.42, 0.12],
          bobAmp: 0.07,
          bobSpeed: 0.98,
          rotSpeedX: 0.06,
          rotSpeedY: 0.1,
          phase: 2.0,
          scale: 0.46,
        }}
        coverColor="#1d3b5a"
        open
        reducedRef={reducedRef}
      />

      <FloatingPaperSheet
        spec={{
          id: "login-paper-left",
          basePos: [-5.35, -0.35, -1.4],
          baseRot: [0.18, 0.38, -0.16],
          bobAmp: 0.07,
          bobSpeed: 1.06,
          rotSpeedX: 0.06,
          rotSpeedY: 0.08,
          phase: 3.1,
          scale: 0.52,
        }}
        docTitle="HERITAGE FOLIO"
        stampText="ILOILO"
        reducedRef={reducedRef}
      />

      <FloatingPaperSheet
        spec={{
          id: "login-paper-right",
          basePos: [5.35, 0.4, -1.5],
          baseRot: [-0.18, -0.4, 0.16],
          bobAmp: 0.07,
          bobSpeed: 0.96,
          rotSpeedX: 0.06,
          rotSpeedY: 0.08,
          phase: 1.9,
          scale: 0.5,
        }}
        docTitle="RA 7743 CHARTER"
        stampText="ARCHIVED"
        reducedRef={reducedRef}
      />
    </>
  );
}

/**
 * Shared 3D floating books, paper sheets, and globe layer for the login scene.
 * Reuses the exact components and animation timing from FloatingLibraryProps.tsx.
 */
export function LoginFloatingPropsCanvas() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[2] hidden lg:block opacity-75"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 7.6], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        style={{ pointerEvents: "none" }}
      >
        <LoginFloatingScene />
      </Canvas>
    </div>
  );
}
