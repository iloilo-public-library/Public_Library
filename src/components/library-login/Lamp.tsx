"use client";

import type { CSSProperties } from "react";
import { PhysicsLamp } from "@/components/auth/PhysicsLamp";

export interface LampWrapperProps {
  lampOn: boolean;
  onToggle: () => void;
  isLightTheme?: boolean;
}

/** Wraps PhysicsLamp (plain requestAnimationFrame damped spring physics + layered soft light). */
export function Lamp({ lampOn, onToggle, isLightTheme = false }: LampWrapperProps) {
  const style: CSSProperties = {};
  return (
    <div className="ilpl-lamp-wrap" style={style}>
      <PhysicsLamp lampOn={lampOn} onToggle={onToggle} isLightTheme={isLightTheme} />
    </div>
  );
}
