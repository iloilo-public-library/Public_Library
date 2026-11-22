"use client";

import type { CSSProperties } from "react";
import { PhysicsLamp } from "@/components/auth/PhysicsLamp";
import { BeamDustParticles } from "./LightParticles";

export interface LampWrapperProps {
  lampOn: boolean;
  onToggle: () => void;
  isLightTheme?: boolean;
  beamX?: string;
  beamY?: string;
}

/**
 * Wraps PhysicsLamp (plain requestAnimationFrame damped spring physics + layered soft light cone)
 * and pairs it with subtle dust motes in the warm beam.
 */
export function Lamp({
  lampOn,
  onToggle,
  isLightTheme = false,
  beamX,
  beamY,
}: LampWrapperProps) {
  const customVars: CSSProperties & {
    "--beam-x"?: string;
    "--beam-y"?: string;
  } = {};
  if (beamX) customVars["--beam-x"] = beamX;
  if (beamY) customVars["--beam-y"] = beamY;

  return (
    <div className="ilpl-lamp-wrap" style={customVars}>
      <PhysicsLamp lampOn={lampOn} onToggle={onToggle} isLightTheme={isLightTheme} />
      <BeamDustParticles active={lampOn} count={12} />
    </div>
  );
}
