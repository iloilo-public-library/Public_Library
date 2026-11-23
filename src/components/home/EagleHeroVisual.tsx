"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  CreditCard,
  Megaphone,
  Pause,
  Play,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";

const ORBIT_ITEMS = [
  { href: "/admin/account-requests", label: "Account Requests", icon: UserCheck },
  { href: "/admin/librarians", label: "Librarians", icon: UserCog },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/library-cards", label: "Library Cards", icon: CreditCard },
  { href: "/admin/books", label: "Books & Inventory", icon: Boxes },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
] as const;

const CX = 260;
const CY = 282;
const RX = 187;
const RY = 78;

interface EagleHeroVisualProps {
  pendingRequests: number | null;
  loadingPending: boolean;
  pendingError: boolean;
}

export function EagleHeroVisual({
  pendingRequests,
  loadingPending,
  pendingError,
}: EagleHeroVisualProps) {
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

  // Respect prefers-reduced-motion
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

  // Compute card positions & eagle eye look target
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

  const isClear = !loadingPending && !pendingError && pendingRequests === 0;
  const alertCountDisplay = loadingPending
    ? null
    : pendingError
      ? "—"
      : String(pendingRequests ?? 0);

  return (
    <div className="ah-visual">
      <div className="ah-scene" aria-label="Interactive library module shortcuts">
        {/* Back holographic projector + dynamic conduit lines */}
        <svg className="layer-back" viewBox="0 0 520 440" aria-hidden="true">
          <defs>
            <radialGradient id="ahGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#ffb74d" stopOpacity=".4" />
              <stop offset="1" stopColor="#ffb74d" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ahCore" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor="#fff6e0" />
              <stop offset="1" stopColor="#ffb74d" />
            </radialGradient>
            <linearGradient id="ahBeam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#7fe7ff" stopOpacity=".5" />
              <stop offset="1" stopColor="#7fe7ff" stopOpacity="0" />
            </linearGradient>
            <pattern id="ahScanPat" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="2.6" fill="#fff" />
            </pattern>
            <mask id="ahScan" maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="440">
              <rect className="scan-rect" x="0" y="-8" width="520" height="460" fill="url(#ahScanPat)" />
            </mask>
            <pattern id="ahLines" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="1.2" fill="#7fe7ff" opacity=".55" />
            </pattern>
            <clipPath id="ahBeamClip">
              <path d="M208 284 L222 70 L298 70 L312 284 Z" />
            </clipPath>
            <linearGradient id="ahShield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6fa0cf" />
              <stop offset="1" stopColor="#365f88" />
            </linearGradient>
          </defs>

          <ellipse cx="260" cy="282" rx="190" ry="80" fill="url(#ahGlow)" />
          <path className="beam" d="M208 284 L222 70 L298 70 L312 284 Z" fill="url(#ahBeam)" />
          <g clipPath="url(#ahBeamClip)">
            <rect className="beam-lines" x="200" y="60" width="120" height="240" fill="url(#ahLines)" />
          </g>
          <ellipse cx="260" cy="282" rx="130" ry="52" fill="none" stroke="#ffb74d" strokeOpacity=".45" />
          <ellipse cx="260" cy="282" rx="100" ry="40" fill="none" stroke="#ffb74d" strokeOpacity=".6" />
          <ellipse
            className="ring-dash"
            cx="260"
            cy="282"
            rx="115"
            ry="46"
            fill="none"
            stroke="#ffe3b0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 10"
          />
          <ellipse cx="260" cy="282" rx="72" ry="29" fill="none" stroke="#ffe3b0" strokeWidth="2" strokeOpacity=".8" />
          <ellipse cx="260" cy="282" rx="54" ry="22" fill="url(#ahCore)" />
          <ellipse className="ripple" cx="260" cy="282" rx="54" ry="22" fill="none" stroke="#7fe7ff" strokeWidth="2" />
          <ellipse
            className="ripple"
            style={{ animationDelay: "-1.3s" }}
            cx="260"
            cy="282"
            rx="54"
            ry="22"
            fill="none"
            stroke="#7fe7ff"
            strokeWidth="2"
          />

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
              className="ah-orbit-card"
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
              <Icon className="ah-orbit-icon h-3.5 w-3.5" aria-hidden="true" />
              <span>{p.item.label}</span>
            </Link>
          );
        })}

        {/* Holographic Guardian Eagle */}
        <svg className="layer-eagle" viewBox="0 0 520 440" aria-hidden="true">
          <g mask="url(#ahScan)">
            <g className="eagle">
              {/* wings */}
              <path d="M212 168 C150 150 126 214 148 266 C182 254 208 238 218 212 Z" fill="#4a3a2e" />
              <path d="M308 168 C370 150 394 214 372 266 C338 254 312 238 302 212 Z" fill="#4a3a2e" />
              <path
                d="M158 232 L172 214 M172 246 L190 226 M188 252 L206 234 M362 232 L348 214 M348 246 L330 226 M332 252 L314 234"
                stroke="#6b5441"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* body + head */}
              <ellipse cx="260" cy="206" rx="48" ry="62" fill="#5a4637" />
              <circle cx="260" cy="140" r="36" fill="#f6f2ea" />
              <path d="M232 160 Q260 186 288 160 L284 176 Q260 196 236 176 Z" fill="#f6f2ea" />
              {/* eyes */}
              <g
                className="look"
                style={{ transform: `translate(${lookX.toFixed(1)}px, ${lookY.toFixed(1)}px)` }}
              >
                <g className="pupils">
                  <circle cx="244" cy="142" r="5.5" fill="#1e2d3d" />
                  <circle cx="276" cy="142" r="5.5" fill="#1e2d3d" />
                  <circle cx="245.8" cy="140.2" r="1.8" fill="#fff" />
                  <circle cx="277.8" cy="140.2" r="1.8" fill="#fff" />
                </g>
              </g>
              <path d="M232 128 L254 139 M288 128 L266 139" stroke="#8a7a62" strokeWidth="4.5" strokeLinecap="round" />
              {/* hooked beak */}
              <path
                className="beak"
                d="M246 150 H274 Q277 170 261 186 Q263 172 258 165 Q248 160 246 150 Z"
                fill="#ffb74d"
              />
              {/* talons */}
              <path
                d="M236 262 h8 M244 262 v7 M252 262 v7 M268 262 h8 M276 262 v7 M284 262 v7"
                stroke="#ffb74d"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* shield */}
              <path
                className="shield"
                d="M222 188 H298 V228 Q298 258 260 276 Q222 258 222 228 Z"
                fill="url(#ahShield)"
                stroke="#ffb74d"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <circle className="lock" cx="260" cy="224" r="8" fill="#ffb74d" />
              <path className="lock" d="M255 228 L265 228 L268 248 L252 248 Z" fill="#ffb74d" />
              {/* wing tips gripping shield */}
              <ellipse cx="220" cy="214" rx="9" ry="17" fill="#4a3a2e" />
              <ellipse cx="300" cy="214" rx="9" ry="17" fill="#4a3a2e" />
            </g>
          </g>
        </svg>

        {/* Pause / Play orbit accessibility toggle */}
        <button
          type="button"
          className="ah-orbit-toggle"
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

      {/* Pending Account Requests Alert Card */}
      <Link
        href="/admin/account-requests"
        className={`ah-alert-card ${isClear ? "clear" : ""}`}
      >
        <div className="ah-alert-top">
          <span className={`ah-alert-blink ${isClear ? "clear" : ""}`} aria-hidden="true" />
          <span className={`ah-alert-label ${isClear ? "clear" : ""}`}>
            {pendingError ? "Unavailable" : isClear ? "All clear" : "Needs review"}
          </span>
        </div>
        <div className="ah-alert-num">
          {alertCountDisplay === null ? (
            <span className="ah-skel-inline" aria-label="Loading pending count" />
          ) : (
            alertCountDisplay
          )}
        </div>
        <div className={`ah-alert-sub ${isClear ? "clear" : ""}`}>
          {pendingError
            ? "Could not load requests"
            : isClear
              ? "no pending requests"
              : `pending account request${pendingRequests === 1 ? "" : "s"}`}
        </div>
      </Link>
    </div>
  );
}
