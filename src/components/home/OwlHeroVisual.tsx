"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  Clock,
  Pause,
  Play,
  Users,
} from "lucide-react";

const ORBIT_ITEMS = [
  { href: "/librarian/books", label: "Book Catalog", icon: BookOpen },
  { href: "/librarian/users", label: "Member Records", icon: Users },
  { href: "/librarian/library-cards", label: "Borrow & Return", icon: ArrowLeftRight },
  { href: "/librarian/records-returns", label: "Overdue Tracking", icon: Clock },
  { href: "/librarian/calendar", label: "Events", icon: CalendarDays },
] as const;

const CX = 260;
const CY = 282;
const RX = 187;
const RY = 78;

interface OwlHeroVisualProps {
  overdueCount: number | null;
  loadingOverdue: boolean;
  overdueError: boolean;
}

export function OwlHeroVisual({
  overdueCount,
  loadingOverdue,
  overdueError,
}: OwlHeroVisualProps) {
  const [angle, setAngle] = useState<number>(Math.PI / 2 + Math.PI / 6);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [paused, setPaused] = useState<boolean>(false);

  const hoveredRef = useRef(-1);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => {
    hoveredRef.current = hoveredIndex;
  }, [hoveredIndex]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setPaused(true);
      pausedRef.current = true;
    }
    let rafId = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(now - last, 60);
      last = now;
      const targetSpeed = hoveredRef.current >= 0 || pausedRef.current ? 0 : 1;
      speedRef.current += (targetSpeed - speedRef.current) * 0.12;
      if (speedRef.current > 0.002) {
        setAngle((prev) => prev + dt * 0.00011 * speedRef.current);
      }
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  let lookX = 0;
  let lookY = 0;

  const placements = ORBIT_ITEMS.map((item, idx) => {
    const th = angle + (idx * 2 * Math.PI) / ORBIT_ITEMS.length;
    const x = CX + RX * Math.cos(th);
    const y = CY + RY * Math.sin(th);
    const depth = (Math.sin(th) + 1) / 2;
    const isActive = idx === hoveredIndex;
    if (isActive) {
      lookX = ((x - CX) / RX) * 4;
      lookY = y > CY ? 1.5 : -1.5;
    }
    return {
      item,
      x,
      y,
      leftPct: `${(x / 520) * 100}%`,
      topPct: `${(y / 440) * 100}%`,
      scale: (0.82 + 0.18 * depth) * (isActive ? 1.12 : 1),
      opacity: isActive ? 1 : 0.8 + 0.2 * depth,
      zIndex: isActive ? 15 : depth > 0.5 ? 8 : 3,
      isActive,
      delay: `${idx * 0.55}s`,
    };
  });

  const isClear = !loadingOverdue && !overdueError && overdueCount === 0;
  const alertCountDisplay = loadingOverdue
    ? null
    : overdueError
      ? "—"
      : String(overdueCount ?? 0);

  return (
    <div className="lh-visual">
      <div className="lh-scene" aria-label="Interactive librarian module shortcuts">
        {/* Back layer: platform, beam, connector lines */}
        <svg className="layer-back" viewBox="0 0 520 440" aria-hidden="true">
          <defs>
            <radialGradient id="lhGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#9fc1e1" stopOpacity=".45" />
              <stop offset="1" stopColor="#9fc1e1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="lhCore" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#9fc1e1" />
            </radialGradient>
            <linearGradient id="lhBeam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#9fc1e1" stopOpacity=".5" />
              <stop offset="1" stopColor="#9fc1e1" stopOpacity="0" />
            </linearGradient>
          </defs>

          <ellipse cx="260" cy="282" rx="190" ry="80" fill="url(#lhGlow)" />
          <path className="beam" d="M208 284 L222 70 L298 70 L312 284 Z" fill="url(#lhBeam)" />
          <ellipse cx="260" cy="282" rx="130" ry="52" fill="none" stroke="#9fc1e1" strokeOpacity=".45" />
          <ellipse cx="260" cy="282" rx="100" ry="40" fill="none" stroke="#9fc1e1" strokeOpacity=".6" />
          <ellipse
            className="ring-dash"
            cx="260"
            cy="282"
            rx="115"
            ry="46"
            fill="none"
            stroke="#dae8f5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 10"
          />
          <ellipse cx="260" cy="282" rx="72" ry="29" fill="none" stroke="#dae8f5" strokeWidth="2" strokeOpacity=".8" />
          <ellipse cx="260" cy="282" rx="54" ry="22" fill="url(#lhCore)" />

          <g>
            {placements.map((p) => (
              <line
                key={p.item.href}
                className={`conduit ${p.isActive ? "on" : ""}`}
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
              />
            ))}
          </g>
        </svg>

        {/* Orbiting Shortcut Links */}
        {placements.map((p, idx) => {
          const Icon = p.item.icon;
          return (
            <Link
              key={p.item.href}
              href={p.item.href}
              className="lh-orbit-card"
              style={
                {
                  left: p.leftPct,
                  top: p.topPct,
                  transform: `translate(-50%, -50%) scale(${p.scale})`,
                  opacity: p.opacity,
                  zIndex: p.zIndex,
                  "--d": p.delay,
                } as React.CSSProperties
              }
              onPointerEnter={() => setHoveredIndex(idx)}
              onPointerLeave={() => setHoveredIndex((cur) => (cur === idx ? -1 : cur))}
              onFocus={() => setHoveredIndex(idx)}
              onBlur={() => setHoveredIndex((cur) => (cur === idx ? -1 : cur))}
            >
              <Icon className="lh-orbit-icon h-3.5 w-3.5" aria-hidden="true" />
              <span>{p.item.label}</span>
            </Link>
          );
        })}

        {/* Owl Layer */}
        <svg className="layer-owl" viewBox="0 0 520 440" aria-hidden="true">
          <g className="owl">
            {/* ear tufts */}
            <path d="M212 130 L220 96 L248 118 Z" fill="#9fc1e1" />
            <path d="M308 130 L300 96 L272 118 Z" fill="#9fc1e1" />
            {/* wings */}
            <path d="M206 170 Q184 208 214 252 Q224 214 218 174 Z" fill="#9fc1e1" />
            <path d="M314 170 Q336 208 306 252 Q296 214 302 174 Z" fill="#9fc1e1" />
            {/* body + belly */}
            <ellipse cx="260" cy="190" rx="56" ry="68" fill="#c9dcef" />
            <ellipse cx="260" cy="220" rx="34" ry="40" fill="#eef5fb" />
            <path
              d="M244 212 q8 8 16 0 q8 8 16 0 M244 230 q8 8 16 0 q8 8 16 0"
              fill="none"
              stroke="#9fc1e1"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* feet */}
            <rect x="236" y="254" width="20" height="8" rx="4" fill="#ffb74d" />
            <rect x="264" y="254" width="20" height="8" rx="4" fill="#ffb74d" />
            {/* eyes */}
            <g
              className="look"
              style={{ transform: `translate(${lookX.toFixed(1)}px, ${lookY.toFixed(1)}px)` }}
            >
              <g className="pupils">
                <circle cx="238" cy="161" r="9" fill="#1e2d3d" />
                <circle cx="282" cy="161" r="9" fill="#1e2d3d" />
                <circle cx="241" cy="157" r="3" fill="#fff" />
                <circle cx="285" cy="157" r="3" fill="#fff" />
              </g>
            </g>
            {/* round glasses */}
            <g fill="rgba(255,255,255,.35)" stroke="#1e2d3d" strokeWidth="4">
              <circle cx="238" cy="160" r="21" />
              <circle cx="282" cy="160" r="21" />
            </g>
            <path
              d="M259 160 h2 M217 157 L207 150 M303 157 L313 150"
              stroke="#1e2d3d"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            {/* beak */}
            <path d="M253 178 L267 178 L260 192 Z" fill="#ffb74d" />
          </g>
        </svg>

        {/* Pause / Play orbit accessibility toggle */}
        <button
          type="button"
          className="lh-orbit-toggle"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Resume orbiting shortcuts" : "Pause orbiting shortcuts"}
        >
          {paused ? (
            <>
              <Play className="h-3.5 w-3.5" aria-hidden="true" /> Play
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5" aria-hidden="true" /> Pause
            </>
          )}
        </button>
      </div>

      {/* Overdue Books Alert Card */}
      <Link
        href="/librarian/records-returns"
        className={`lh-alert-card ${isClear ? "clear" : ""}`}
      >
        <div className="lh-alert-top">
          <span className={`lh-alert-blink ${isClear ? "clear" : ""}`} aria-hidden="true" />
          <span className={`lh-alert-label ${isClear ? "clear" : ""}`}>
            {overdueError ? "Unavailable" : isClear ? "All clear" : "Needs attention"}
          </span>
        </div>
        <div className="lh-alert-num">
          {alertCountDisplay === null ? (
            <span className="lh-skel-inline" aria-label="Loading overdue count" />
          ) : (
            alertCountDisplay
          )}
        </div>
        <div className={`lh-alert-sub ${isClear ? "clear" : ""}`}>
          {overdueError
            ? "Could not load overdue"
            : isClear
              ? "no overdue books"
              : `overdue book${overdueCount === 1 ? "" : "s"}`}
        </div>
      </Link>
    </div>
  );
}
