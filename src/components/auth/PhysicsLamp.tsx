"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Spring physics tuning constants (plain requestAnimationFrame, zero per-frame React re-renders).
 * Adjust stiffness (higher = snappier) and damping (higher = settles faster with less overshoot).
 */
export const LAMP_SPRING = {
  headStiffness: 120,
  headDamping: 10,
  upperArmStiffness: 105,
  upperArmDamping: 10.5,
  lowerArmStiffness: 90,
  lowerArmDamping: 11,
  chainAngleStiffness: 68,
  chainAngleDamping: 4.2,
  chainPullStiffness: 260,
  chainPullDamping: 16,
  pullToggleThresholdPx: 24,
  maxPullPx: 36,
  restEpsilon: 0.001,
  maxDtSeconds: 0.033,
} as const;

export interface PhysicsLampProps {
  lampOn: boolean;
  onToggle: () => void;
  isLightTheme?: boolean;
}

interface SimState {
  headAngle: number;
  headVel: number;
  upperAngle: number;
  upperVel: number;
  lowerAngle: number;
  lowerVel: number;
  chainAngle: number;
  chainAngleVel: number;
  pullY: number;
  pullVel: number;
  dragging: boolean;
  dragStartY: number;
  maxDragY: number;
  didDrag: boolean;
  toggledDuringDrag: boolean;
}

export function PhysicsLamp({ lampOn, onToggle, isLightTheme = false }: PhysicsLampProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lowerArmRef = useRef<SVGGElement>(null);
  const upperArmRef = useRef<SVGGElement>(null);
  const headGroupRef = useRef<SVGGElement>(null);
  const headLightLayerRef = useRef<HTMLDivElement>(null);
  const chainSwingRef = useRef<SVGGElement>(null);
  const chainButtonRef = useRef<HTMLButtonElement>(null);
  const deskPoolRef = useRef<HTMLDivElement>(null);

  const reducedMotionRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastPointerRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const simRef = useRef<SimState>({
    headAngle: 0,
    headVel: 0,
    upperAngle: 0,
    upperVel: 0,
    lowerAngle: 0,
    lowerVel: 0,
    chainAngle: 0,
    chainAngleVel: 0,
    pullY: 0,
    pullVel: 0,
    dragging: false,
    dragStartY: 0,
    maxDragY: 0,
    didDrag: false,
    toggledDuringDrag: false,
  });

  const applyTransforms = useCallback(() => {
    const s = simRef.current;

    if (lowerArmRef.current) {
      lowerArmRef.current.style.transform = `rotate(${s.lowerAngle.toFixed(3)}deg)`;
    }
    if (upperArmRef.current) {
      upperArmRef.current.style.transform = `rotate(${s.upperAngle.toFixed(3)}deg)`;
    }
    if (headGroupRef.current) {
      headGroupRef.current.style.transform = `rotate(${(20 + s.headAngle).toFixed(3)}deg)`;
    }
    // Synchronize soft HTML light cone + bulb glow with the head's exact rotation
    if (headLightLayerRef.current) {
      headLightLayerRef.current.style.transform = `rotate(${(20 + s.headAngle).toFixed(3)}deg)`;
    }
    if (chainSwingRef.current) {
      chainSwingRef.current.style.transform = `rotate(${s.chainAngle.toFixed(3)}deg) translateY(${s.pullY.toFixed(2)}px)`;
    }
    if (chainButtonRef.current) {
      chainButtonRef.current.style.transform = `translate3d(${(s.chainAngle * 0.9).toFixed(2)}px, ${s.pullY.toFixed(2)}px, 0)`;
    }
    if (deskPoolRef.current) {
      deskPoolRef.current.style.transform = `translate3d(${(s.headAngle * 1.8).toFixed(2)}px, ${(s.headAngle * 0.9).toFixed(2)}px, 0)`;
    }
  }, []);

  const step = useCallback(
    (now: number) => {
      if (reducedMotionRef.current) {
        rafIdRef.current = null;
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min((now - lastTimeRef.current) / 1000, LAMP_SPRING.maxDtSeconds);
      lastTimeRef.current = now;

      const s = simRef.current;

      // 1. Head damped spring (target 0, slight downward tilt while pulling chain)
      const headTarget = s.dragging ? s.pullY * 0.22 : 0;
      const headAcc =
        -LAMP_SPRING.headStiffness * (s.headAngle - headTarget) -
        LAMP_SPRING.headDamping * s.headVel;
      s.headVel += headAcc * dt;
      s.headAngle += s.headVel * dt;

      // 2. Upper & lower arm joints follow head sway with secondary lag
      const upperTarget = s.headAngle * 0.42;
      const upperAcc =
        -LAMP_SPRING.upperArmStiffness * (s.upperAngle - upperTarget) -
        LAMP_SPRING.upperArmDamping * s.upperVel;
      s.upperVel += upperAcc * dt;
      s.upperAngle += s.upperVel * dt;

      const lowerTarget = s.upperAngle * 0.45;
      const lowerAcc =
        -LAMP_SPRING.lowerArmStiffness * (s.lowerAngle - lowerTarget) -
        LAMP_SPRING.lowerArmDamping * s.lowerVel;
      s.lowerVel += lowerAcc * dt;
      s.lowerAngle += s.lowerVel * dt;

      // 3. Pull-chain damped pendulum
      const chainAcc =
        -LAMP_SPRING.chainAngleStiffness * s.chainAngle -
        LAMP_SPRING.chainAngleDamping * s.chainAngleVel -
        s.headVel * 0.14;
      s.chainAngleVel += chainAcc * dt;
      s.chainAngle += s.chainAngleVel * dt;

      // 4. Vertical pull spring (when not actively dragging)
      if (!s.dragging) {
        const pullAcc =
          -LAMP_SPRING.chainPullStiffness * s.pullY -
          LAMP_SPRING.chainPullDamping * s.pullVel;
        s.pullVel += pullAcc * dt;
        s.pullY += s.pullVel * dt;
      }

      applyTransforms();

      // Stop loop when every DOF is at rest
      const eps = LAMP_SPRING.restEpsilon;
      const atRest =
        !s.dragging &&
        Math.abs(s.headAngle) < eps &&
        Math.abs(s.headVel) < eps &&
        Math.abs(s.upperAngle) < eps &&
        Math.abs(s.upperVel) < eps &&
        Math.abs(s.lowerAngle) < eps &&
        Math.abs(s.lowerVel) < eps &&
        Math.abs(s.chainAngle) < eps &&
        Math.abs(s.chainAngleVel) < eps &&
        Math.abs(s.pullY) < eps &&
        Math.abs(s.pullVel) < eps;

      if (atRest) {
        s.headAngle = 0;
        s.upperAngle = 0;
        s.lowerAngle = 0;
        s.chainAngle = 0;
        s.pullY = 0;
        applyTransforms();
        rafIdRef.current = null;
        lastTimeRef.current = 0;
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(step);
    },
    [applyTransforms]
  );

  const wakeLoop = useCallback(() => {
    if (reducedMotionRef.current || typeof window === "undefined") return;
    if (rafIdRef.current === null) {
      lastTimeRef.current = 0;
      rafIdRef.current = window.requestAnimationFrame(step);
    }
  }, [step]);

  // Respect prefers-reduced-motion + initial subtle swing on load + visibilitychange pause
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      if (e.matches && rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    mq.addEventListener("change", handleMotionChange);

    // Small welcoming pendulum swing on initial load
    if (!mq.matches) {
      simRef.current.chainAngle = 7.5;
      simRef.current.chainAngleVel = -14;
      simRef.current.headVel = 12;
      wakeLoop();
    }

    const handleVisibility = () => {
      if (document.hidden && rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        lastTimeRef.current = 0;
      } else if (!document.hidden && !reducedMotionRef.current) {
        wakeLoop();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Mouse nudge: small clamped impulse when moving quickly near the lamp
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (reducedMotionRef.current || !containerRef.current) return;
      const now = performance.now();
      const prev = lastPointerRef.current;
      lastPointerRef.current = { x: e.clientX, y: e.clientY, t: now };
      if (!prev) return;

      const dtMs = Math.max(8, now - prev.t);
      const vx = (e.clientX - prev.x) / dtMs; // px/ms
      const vy = (e.clientY - prev.y) / dtMs;
      const speed = Math.hypot(vx, vy);
      if (speed < 0.75) return; // ignore idle/slow movement

      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.55;
      const cy = rect.top + rect.height * 0.45;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist > 260) return;

      const proximity = 1 - dist / 260;
      const clampedX = Math.max(-1.6, Math.min(1.6, vx)) * proximity;
      simRef.current.chainAngleVel += clampedX * 18;
      simRef.current.headVel += clampedX * 7.5;
      wakeLoop();
    };

    window.addEventListener("mousemove", handleWindowMouseMove, { passive: true });

    return () => {
      mq.removeEventListener("change", handleMotionChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mousemove", handleWindowMouseMove);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [wakeLoop]);

  // Subtle head sway whenever lampOn toggles externally (e.g. header sun button)
  const prevLampOnRef = useRef(lampOn);
  useEffect(() => {
    if (prevLampOnRef.current !== lampOn) {
      prevLampOnRef.current = lampOn;
      if (!reducedMotionRef.current) {
        simRef.current.headVel += 22;
        simRef.current.chainAngleVel += 16;
        wakeLoop();
      }
    }
  }, [lampOn, wakeLoop]);

  const triggerClickPull = useCallback(() => {
    onToggle();
    if (reducedMotionRef.current) return;
    simRef.current.pullY = 22;
    simRef.current.pullVel = -110;
    simRef.current.headVel += 34;
    simRef.current.chainAngleVel += 28;
    wakeLoop();
  }, [onToggle, wakeLoop]);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = simRef.current;
    s.dragging = true;
    s.dragStartY = e.clientY;
    s.maxDragY = 0;
    s.didDrag = false;
    s.toggledDuringDrag = false;
    wakeLoop();
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = simRef.current;
    if (!s.dragging) return;
    const dy = e.clientY - s.dragStartY;
    if (dy > 3) s.didDrag = true;
    const clamped = Math.max(0, Math.min(LAMP_SPRING.maxPullPx, dy));
    s.pullY = clamped;
    s.maxDragY = Math.max(s.maxDragY, clamped);
    if (!s.toggledDuringDrag && clamped >= LAMP_SPRING.pullToggleThresholdPx) {
      s.toggledDuringDrag = true;
      onToggle();
      s.headVel += 26;
    }
    applyTransforms();
  };

  const handlePointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const s = simRef.current;
    if (!s.dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    s.dragging = false;

    if (!s.didDrag) {
      triggerClickPull();
    } else {
      // Release overshoot spring
      s.pullVel = -125;
      s.chainAngleVel += 24;
      s.headVel += 20;
      wakeLoop();
    }
  };

  const handlePointerCancel = () => {
    const s = simRef.current;
    s.dragging = false;
    s.pullVel = -90;
    wakeLoop();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerClickPull();
    }
  };

  return (
    <div
      ref={containerRef}
      className="ilpl-physics-lamp"
      data-lamp-on={lampOn ? "true" : "false"}
      data-light-theme={isLightTheme ? "true" : "false"}
    >
      {/* Soft pool of warm light on the desk surface (lower z-index, behind hero text) */}
      <div ref={deskPoolRef} className="ilpl-desk-pool" aria-hidden="true" />

      {/* Head-coupled layered soft light (bulb glow + feathered radial-masked cone; rotates with lamp head!) */}
      <div className="ilpl-head-light-pivot" aria-hidden="true">
        <div ref={headLightLayerRef} className="ilpl-head-light-rotator">
          <div className="ilpl-bulb-glow" />
          <div className="ilpl-soft-cone" />
        </div>
      </div>

      {/* Architect Desk Lamp SVG — pointer-events: none so it never blocks clicks */}
      <svg
        viewBox="0 0 215 260"
        className="relative z-10 h-[145px] w-[120px] overflow-visible pointer-events-none lg:h-[290px] lg:w-[240px] xl:h-[330px] xl:w-[272px]"
        role="img"
        aria-label="Interactive architect desk lamp"
      >
        <defs>
          <linearGradient id="pl-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isLightTheme ? "#586d82" : "#6b849c"} />
            <stop offset="50%" stopColor={isLightTheme ? "#354759" : "#3a4d60"} />
            <stop offset="100%" stopColor={isLightTheme ? "#22303e" : "#1f2d3b"} />
          </linearGradient>
          <linearGradient id="pl-shade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isLightTheme ? "#475c71" : "#5a738c"} />
            <stop offset="55%" stopColor={isLightTheme ? "#2c3d4f" : "#304254"} />
            <stop offset="100%" stopColor={isLightTheme ? "#1a2633" : "#182432"} />
          </linearGradient>
          <linearGradient id="pl-base" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isLightTheme ? "#4e6277" : "#566e85"} />
            <stop offset="100%" stopColor={isLightTheme ? "#1e2c3a" : "#1a2735"} />
          </linearGradient>
          <radialGradient id="pl-interior-on" cx="38%" cy="44%" r="65%">
            <stop offset="0%" stopColor="#FFFDF2" />
            <stop offset="38%" stopColor="#FFD27A" />
            <stop offset="100%" stopColor="#FFB347" />
          </radialGradient>
          <radialGradient id="pl-interior-off" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={isLightTheme ? "#465869" : "#273747"} />
            <stop offset="100%" stopColor={isLightTheme ? "#2a3948" : "#15212d"} />
          </radialGradient>
          <linearGradient id="pl-bead" x1="25%" y1="15%" x2="80%" y2="85%">
            <stop offset="0%" stopColor={lampOn ? "#FFF0C2" : "#d4e3f2"} />
            <stop offset="100%" stopColor={lampOn ? "#E0972E" : "#7b93ab"} />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="66" cy="248" rx="52" ry="7.5" fill="rgba(0, 0, 0, 0.38)" />

        {/* Weighted Base */}
        <path
          d="M20 245 C20 233 35 227 68 227 C101 227 116 233 116 245 L112 249 L24 249 Z"
          fill="url(#pl-base)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
        <rect
          x="54"
          y="216"
          width="28"
          height="13"
          rx="4"
          fill="url(#pl-metal)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="0.9"
        />

        {/* Lower Arm Pivot Group (origin 68, 219) */}
        <g ref={lowerArmRef} style={{ transformOrigin: "68px 219px" }}>
          <line x1="62" y1="219" x2="25" y2="132" stroke="url(#pl-metal)" strokeWidth="5.4" strokeLinecap="round" />
          <line x1="73" y1="219" x2="36" y2="128" stroke="url(#pl-metal)" strokeWidth="3.4" strokeLinecap="round" opacity="0.82" />
          <line
            x1="67"
            y1="210"
            x2="38"
            y2="145"
            stroke={isLightTheme ? "#95aac0" : "#9fc1e1"}
            strokeWidth="1.2"
            strokeDasharray="2 3"
            opacity="0.55"
          />

          {/* Upper Arm Pivot Group (origin 31, 131) */}
          <g ref={upperArmRef} style={{ transformOrigin: "31px 131px" }}>
            <line x1="31" y1="130" x2="122" y2="54" stroke="url(#pl-metal)" strokeWidth="5.4" strokeLinecap="round" />
            <line x1="34" y1="139" x2="125" y2="64" stroke="url(#pl-metal)" strokeWidth="2.8" strokeLinecap="round" opacity="0.78" />

            {/* Pull Chain Visual (swings from neck 141, 88) */}
            <g ref={chainSwingRef} style={{ transformOrigin: "141px 88px" }}>
              <line
                x1="141"
                y1="88"
                x2="141"
                y2="150"
                stroke={lampOn ? "#FFD27A" : "#9fc1e1"}
                strokeWidth="2.1"
                strokeDasharray="2.5 3.5"
                strokeLinecap="round"
              />
              <circle
                cx="141"
                cy="158"
                r="7.8"
                fill="url(#pl-bead)"
                stroke={lampOn ? "#FFF2C6" : "rgba(255,255,255,0.45)"}
                strokeWidth="1.3"
              />
              <circle cx="138.6" cy="155.5" r="2.1" fill="#ffffff" opacity="0.78" />
            </g>

            {/* Lamp Head Rotating Group (origin 128, 60) */}
            <g transform="translate(128 60)">
              <g ref={headGroupRef} style={{ transformOrigin: "0px 0px", transform: "rotate(20deg)" }}>
                <rect x="-6" y="-10" width="21" height="17" rx="6" fill="url(#pl-metal)" stroke="rgba(255,255,255,0.16)" strokeWidth="0.9" />
                <path
                  d="M11 -12 L54 -25 L54 29 L11 9 Z"
                  fill="url(#pl-shade)"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="1.15"
                  strokeLinejoin="round"
                />
                <line x1="15" y1="-9" x2="49" y2="-20" stroke="rgba(255,255,255,0.24)" strokeWidth="1.6" strokeLinecap="round" />
                <ellipse
                  cx="54"
                  cy="2"
                  rx="11.5"
                  ry="27"
                  fill={lampOn ? "url(#pl-interior-on)" : "url(#pl-interior-off)"}
                  stroke={lampOn ? "#FFD27A" : "rgba(255,255,255,0.2)"}
                  strokeWidth="1.4"
                />
                <ellipse
                  cx="48"
                  cy="2"
                  rx="9"
                  ry="8"
                  fill={lampOn ? "#FFFDF2" : isLightTheme ? "#6c8094" : "#3a4d60"}
                  style={{
                    transition: "fill 300ms ease, opacity 300ms ease",
                  }}
                />
              </g>
            </g>

            {/* Top joint */}
            <circle cx="124" cy="58" r="6.8" fill="#2b3b4c" stroke="#9fc1e1" strokeWidth="1.3" strokeOpacity="0.5" />
            <circle cx="124" cy="58" r="2.4" fill="#dae8f5" opacity="0.75" />
          </g>

          {/* Mid joint */}
          <circle cx="31" cy="131" r="8.5" fill="#2b3b4c" stroke="#9fc1e1" strokeWidth="1.4" strokeOpacity="0.5" />
          <circle cx="31" cy="131" r="3.1" fill="#dae8f5" opacity="0.75" />
        </g>

        {/* Base joint */}
        <circle cx="68" cy="219" r="7" fill="#2c3d4f" stroke="#9fc1e1" strokeWidth="1.2" strokeOpacity="0.45" />
        <circle cx="68" cy="219" r="2.3" fill="#dae8f5" opacity="0.7" />
      </svg>

      {/* Accessible interactive <button> overlay ONLY on the pull-chain bead (pointer-events: auto) */}
      <button
        ref={chainButtonRef}
        type="button"
        aria-label="Toggle lamp"
        aria-pressed={lampOn}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        className="ilpl-chain-btn"
      >
        <span className="sr-only">{lampOn ? "Turn desk lamp off" : "Turn desk lamp on"}</span>
      </button>
    </div>
  );
}
