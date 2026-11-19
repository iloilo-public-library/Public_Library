"use client";

import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

export interface LampProps {
  lampOn: boolean;
  onToggle: () => void;
  isLightTheme?: boolean;
}

const MAX_PULL_PX = 30;
const CLICK_PULL_PX = 25;
const DRAG_TOGGLE_THRESHOLD = 12;

export function Lamp({ lampOn, onToggle, isLightTheme = false }: LampProps) {
  const prefersReducedMotion = useReducedMotion();
  const pullY = useMotionValue(0);
  const chainEndY = useTransform(pullY, (v) => 150 + v);
  const beadCy = useTransform(pullY, (v) => 158 + v);
  const beadHighlightCy = useTransform(pullY, (v) => 155.5 + v);

  const dragStartYRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const maxDraggedRef = useRef(0);

  const snapBack = useCallback(() => {
    if (prefersReducedMotion) {
      pullY.set(0);
      return;
    }
    animate(pullY, 0, {
      type: "spring",
      stiffness: 420,
      damping: 18,
      mass: 0.7,
    });
  }, [prefersReducedMotion, pullY]);

  const triggerPullToggle = useCallback(() => {
    onToggle();
    if (prefersReducedMotion) {
      pullY.set(0);
      return;
    }
    animate(pullY, CLICK_PULL_PX, {
      duration: 0.13,
      ease: "easeOut",
      onComplete: () => {
        animate(pullY, 0, {
          type: "spring",
          stiffness: 420,
          damping: 18,
          mass: 0.7,
        });
      },
    });
  }, [onToggle, prefersReducedMotion, pullY]);

  const handlePointerDown = (e: PointerEvent<SVGGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    didDragRef.current = false;
    maxDraggedRef.current = 0;
  };

  const handlePointerMove = (e: PointerEvent<SVGGElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    if (delta > 3) {
      didDragRef.current = true;
    }
    const clamped = Math.max(0, Math.min(MAX_PULL_PX, delta));
    maxDraggedRef.current = Math.max(maxDraggedRef.current, clamped);
    if (!prefersReducedMotion) {
      pullY.set(clamped);
    }
  };

  const handlePointerUp = (e: PointerEvent<SVGGElement>) => {
    if (dragStartYRef.current === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const draggedEnough = maxDraggedRef.current >= DRAG_TOGGLE_THRESHOLD;
    const wasClick = !didDragRef.current;
    dragStartYRef.current = null;

    if (wasClick) {
      triggerPullToggle();
    } else {
      if (draggedEnough) {
        onToggle();
      }
      snapBack();
    }
  };

  const handlePointerCancel = () => {
    dragStartYRef.current = null;
    snapBack();
  };

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerPullToggle();
    }
  };

  const beamScale = isLightTheme ? 0.45 : 1;

  return (
    <div className="relative select-none">
      {/* Soft radial amber glow behind lamp on mobile (< 768px) for calm atmospheric depth */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 z-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-opacity duration-700 md:hidden ${
          lampOn ? "lamp-flicker-active" : ""
        }`}
        style={{
          opacity: lampOn ? (isLightTheme ? 0.22 : 0.38) : isLightTheme ? 0.06 : 0.1,
          background:
            "radial-gradient(circle, rgba(255, 210, 122, 0.72) 0%, rgba(255, 179, 71, 0.28) 52%, transparent 75%)",
        }}
      />

      {/* Architect Lamp SVG — 108px compact accent on mobile, tidy on tablet, generous hero on desktop */}
      <svg
        viewBox="0 0 215 260"
        className="relative z-10 h-[108px] w-[90px] overflow-visible md:h-[210px] md:w-[174px] lg:h-[315px] lg:w-[260px] xl:h-[355px] xl:w-[294px]"
        role="img"
        aria-label="Architect desk lamp"
      >
        <defs>
          {/* Metallic body gradients */}
          <linearGradient id="lamp-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isLightTheme ? "#586d82" : "#6b849c"} />
            <stop offset="50%" stopColor={isLightTheme ? "#354759" : "#3a4d60"} />
            <stop offset="100%" stopColor={isLightTheme ? "#22303e" : "#1f2d3b"} />
          </linearGradient>

          <linearGradient id="lamp-shade-outer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isLightTheme ? "#475c71" : "#5a738c"} />
            <stop offset="55%" stopColor={isLightTheme ? "#2c3d4f" : "#304254"} />
            <stop offset="100%" stopColor={isLightTheme ? "#1a2633" : "#182432"} />
          </linearGradient>

          <linearGradient id="lamp-base-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isLightTheme ? "#4e6277" : "#566e85"} />
            <stop offset="100%" stopColor={isLightTheme ? "#1e2c3a" : "#1a2735"} />
          </linearGradient>

          {/* Warm incandescent bulb & shade interior (2700K–3000K spectrum) */}
          <radialGradient id="lamp-interior-on" cx="38%" cy="44%" r="65%">
            <stop offset="0%" stopColor="#FFFDF2" />
            <stop offset="35%" stopColor="#FFD27A" />
            <stop offset="100%" stopColor="#FFB347" />
          </radialGradient>

          <radialGradient id="lamp-interior-off" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={isLightTheme ? "#465869" : "#273747"} />
            <stop offset="100%" stopColor={isLightTheme ? "#2a3948" : "#15212d"} />
          </radialGradient>

          {/* Inverse-square axial falloff: I(r) ~ 1 / (1 + r/r0)^2 */}
          <linearGradient id="beam-penumbra-grad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#FFD27A" stopOpacity={0.44 * beamScale} />
            <stop offset="16%" stopColor="#FFD27A" stopOpacity={0.3 * beamScale} />
            <stop offset="38%" stopColor="#FFB347" stopOpacity={0.14 * beamScale} />
            <stop offset="68%" stopColor="#FFB347" stopOpacity={0.045 * beamScale} />
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="beam-umbra-grad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#FFF6D6" stopOpacity={0.62 * beamScale} />
            <stop offset="18%" stopColor="#FFD27A" stopOpacity={0.36 * beamScale} />
            <stop offset="48%" stopColor="#FFB347" stopOpacity={0.11 * beamScale} />
            <stop offset="82%" stopColor="#FFB347" stopOpacity={0.02 * beamScale} />
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="lamp-bulb-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF6D6" stopOpacity={0.9 * beamScale} />
            <stop offset="45%" stopColor="#FFD27A" stopOpacity={0.42 * beamScale} />
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="chain-bead-grad" x1="25%" y1="15%" x2="80%" y2="85%">
            <stop offset="0%" stopColor={lampOn ? "#FFF0C2" : "#d4e3f2"} />
            <stop offset="100%" stopColor={lampOn ? "#E0972E" : "#7b93ab"} />
          </linearGradient>

          {/* Generous filter bounds so volumetric cone blur never clips to a box edge */}
          <filter id="beam-blur-soft" x="-30%" y="-80%" width="220%" height="260%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="beam-blur-core" x="-30%" y="-80%" width="220%" height="260%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Ground shadow under weighted base (shifts slightly back when lamp turns ON) */}
        <ellipse
          cx={lampOn ? "62" : "68"}
          cy="248"
          rx="52"
          ry="7.5"
          fill="rgba(0, 0, 0, 0.38)"
          className="transition-all duration-700"
        />

        {/* Weighted Base */}
        <path
          d="M20 245 C20 233 35 227 68 227 C101 227 116 233 116 245 L112 249 L24 249 Z"
          fill="url(#lamp-base-grad)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
        <rect
          x="54"
          y="216"
          width="28"
          height="13"
          rx="4"
          fill="url(#lamp-metal)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="0.9"
        />

        {/* Lower Jointed Arm (dual architect rods + tension spring) */}
        <line
          x1="62"
          y1="219"
          x2="25"
          y2="132"
          stroke="url(#lamp-metal)"
          strokeWidth="5.4"
          strokeLinecap="round"
        />
        <line
          x1="73"
          y1="219"
          x2="36"
          y2="128"
          stroke="url(#lamp-metal)"
          strokeWidth="3.4"
          strokeLinecap="round"
          opacity="0.82"
        />
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

        {/* Upper Jointed Arm */}
        <line
          x1="31"
          y1="130"
          x2="122"
          y2="54"
          stroke="url(#lamp-metal)"
          strokeWidth="5.4"
          strokeLinecap="round"
        />
        <line
          x1="34"
          y1="139"
          x2="125"
          y2="64"
          stroke="url(#lamp-metal)"
          strokeWidth="2.8"
          strokeLinecap="round"
          opacity="0.78"
        />

        {/* Pivot Joints */}
        <circle
          cx="68"
          cy="219"
          r="7"
          fill="#2c3d4f"
          stroke="#9fc1e1"
          strokeWidth="1.2"
          strokeOpacity="0.45"
        />
        <circle cx="68" cy="219" r="2.3" fill="#dae8f5" opacity="0.7" />

        <circle
          cx="31"
          cy="131"
          r="8.5"
          fill="#2b3b4c"
          stroke="#9fc1e1"
          strokeWidth="1.4"
          strokeOpacity="0.5"
        />
        <circle cx="31" cy="131" r="3.1" fill="#dae8f5" opacity="0.75" />

        <circle
          cx="124"
          cy="58"
          r="6.8"
          fill="#2b3b4c"
          stroke="#9fc1e1"
          strokeWidth="1.3"
          strokeOpacity="0.5"
        />
        <circle cx="124" cy="58" r="2.4" fill="#dae8f5" opacity="0.75" />

        {/* Pull Chain Interactive Control */}
        <g
          role="button"
          tabIndex={0}
          aria-pressed={lampOn}
          aria-label="Toggle lamp"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleKeyDown}
          className="cursor-grab active:cursor-grabbing focus:outline-none focus-visible:drop-shadow-[0_0_8px_rgba(255,210,122,0.95)]"
          style={{ touchAction: "none" }}
        >
          {/* Generous invisible hit area for effortless click/tap/drag */}
          <rect x="118" y="84" width="46" height="118" rx="20" fill="transparent" />

          {/* Beaded Pull Cord */}
          <motion.line
            x1="141"
            y1="88"
            x2="141"
            y2={chainEndY}
            stroke={lampOn ? "#FFD27A" : "#9fc1e1"}
            strokeWidth="2.1"
            strokeDasharray="2.5 3.5"
            strokeLinecap="round"
            className="transition-colors duration-500"
          />

          {/* Pull Bead */}
          <motion.circle
            cx="141"
            cy={beadCy}
            r="7.8"
            fill="url(#chain-bead-grad)"
            stroke={lampOn ? "#FFF2C6" : "rgba(255,255,255,0.45)"}
            strokeWidth="1.3"
          />
          <motion.circle cx="138.6" cy={beadHighlightCy} r="2.1" fill="#ffffff" opacity="0.78" />
        </g>

        {/* Angled Conical Shade + Physically Anchored Volumetric Light Cone */}
        {/* Aims downward (52deg) on phone when stacked above text, and across (20deg) on sm+ */}
        <g className="lamp-shade-group">
          {/* Volumetric Light Cone (Umbra + Penumbra) — anchored at the exact shade aperture */}
          <g
            aria-hidden="true"
            className={`pointer-events-none transition-opacity duration-700 ease-out ${
              lampOn ? "lamp-flicker-active opacity-100" : "opacity-0"
            }`}
            style={{
              mixBlendMode: isLightTheme ? "normal" : "screen",
            }}
          >
            {/* Outer Penumbra (wide atmospheric scatter) */}
            <path
              d="M52 -25 L430 -138 L430 172 L52 29 Z"
              fill="url(#beam-penumbra-grad)"
              filter="url(#beam-blur-soft)"
            />
            {/* Inner Umbra (hot directional core along optical axis) */}
            <path
              d="M52 -13 L325 -62 L325 78 L52 17 Z"
              fill="url(#beam-umbra-grad)"
              filter="url(#beam-blur-core)"
            />
            {/* Near-field Bulb Halo */}
            <circle cx="52" cy="2" r="46" fill="url(#lamp-bulb-halo)" />
          </g>

          {/* Shade Neck Cap */}
          <rect
            x="-6"
            y="-10"
            width="21"
            height="17"
            rx="6"
            fill="url(#lamp-metal)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="0.9"
          />

          {/* Conical Shade Body */}
          <path
            d="M11 -12 L54 -25 L54 29 L11 9 Z"
            fill="url(#lamp-shade-outer)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.15"
            strokeLinejoin="round"
          />

          {/* Top metallic specular edge */}
          <line
            x1="15"
            y1="-9"
            x2="49"
            y2="-20"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* Shade Inner Opening Ellipse */}
          <ellipse
            cx="54"
            cy="2"
            rx="11.5"
            ry="27"
            fill={lampOn ? "url(#lamp-interior-on)" : "url(#lamp-interior-off)"}
            stroke={lampOn ? "#FFD27A" : "rgba(255,255,255,0.2)"}
            strokeWidth="1.4"
            className={`transition-all duration-700 ${lampOn ? "lamp-flicker-active" : ""}`}
          />

          {/* Incandescent Bulb */}
          <ellipse
            cx="48"
            cy="2"
            rx="9"
            ry="8"
            fill={lampOn ? "#FFFDF2" : isLightTheme ? "#6c8094" : "#3a4d60"}
            className={`transition-all duration-700 ${lampOn ? "lamp-flicker-active" : ""}`}
            style={{
              filter: lampOn ? "drop-shadow(0 0 12px #FFB347)" : "none",
            }}
          />
        </g>
      </svg>

      {/* "Pull the chain" hint (absolute so toggling causes zero layout shift) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-[84px] top-[52px] z-20 flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide transition-opacity duration-500 md:left-[92px] md:top-[158px] md:px-2.5 md:py-1 md:text-[0.7rem] lg:left-[126px] lg:top-[240px] lg:text-[0.72rem] xl:left-[144px] xl:top-[270px] ${
          lampOn ? "opacity-0" : "lamp-hint-bounce opacity-85"
        } ${
          isLightTheme
            ? "border-[#2563a6]/25 bg-white/85 text-[#1e3a5f] shadow-sm"
            : "border-[#FFD27A]/25 bg-[#121e2b]/85 text-[#FFD27A]/90 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
        }`}
      >
        <span>↓</span>
        <span>Pull the chain</span>
      </div>
    </div>
  );
}
