"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import Book, { BookRig } from "@/components/Book";

export function BookHeroCanvas({ progress }: { progress: MutableRefObject<number> }) {
  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full translate-x-[20px]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 40, near: 0.1, far: 50, position: [0, 0.5, 8] }}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: "none" }}
      >
        <BookRig progress={progress} />
        <Book progress={progress} />
      </Canvas>
    </div>
  );
}
