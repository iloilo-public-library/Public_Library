"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

interface DustParticle {
  id: number;
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  dx: number;
  tone?: "gold" | "cyan";
}

interface SparkleParticle {
  id: number;
  left: string;
  top: string;
  delay: number;
  scale: number;
}

/** Client-only lazy-started dust motes floating upward inside the lamp beam. */
export function BeamDustParticles({ active, count = 14 }: { active: boolean; count?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<DustParticle[]>([]);

  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const id = window.setTimeout(() => {
      const next: DustParticle[] = Array.from({ length: count }, (_, idx) => ({
        id: idx,
        left: `${Math.round(8 + Math.random() * 82)}%`,
        top: `${Math.round(18 + Math.random() * 72)}%`,
        size: Number((2 + Math.random() * 2.6).toFixed(1)),
        duration: Number((3.8 + Math.random() * 3.4).toFixed(2)),
        delay: Number((Math.random() * 3.2).toFixed(2)),
        dx: Math.round(-10 + Math.random() * 28),
      }));
      setParticles(next);
    }, 350);

    return () => window.clearTimeout(id);
  }, [active, count, prefersReducedMotion]);

  if (!active || prefersReducedMotion || particles.length === 0) return null;

  return (
    <div className="ilpl-dust-field" aria-hidden="true">
      {particles.map((p) => {
        const style: CSSProperties & { "--dx": string } = {
          left: p.left,
          top: p.top,
          width: `${p.size}px`,
          height: `${p.size}px`,
          animationDuration: `calc(${p.duration}s * var(--speed))`,
          animationDelay: `${p.delay}s`,
          "--dx": `${p.dx}px`,
        };
        return <span key={p.id} className="ilpl-dust-mote" style={style} />;
      })}
    </div>
  );
}

/** Client-only lazy-started magic sparkles drifting up around the holographic panel. */
export function HoloSparkles({ active, count = 14 }: { active: boolean; count?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<DustParticle[]>([]);

  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const id = window.setTimeout(() => {
      const next: DustParticle[] = Array.from({ length: count }, (_, idx) => ({
        id: idx,
        left: `${Math.round(4 + Math.random() * 92)}%`,
        top: `${Math.round(10 + Math.random() * 84)}%`,
        size: Number((2 + Math.random() * 2.8).toFixed(1)),
        duration: Number((3.2 + Math.random() * 2.8).toFixed(2)),
        delay: Number((Math.random() * 2.8).toFixed(2)),
        dx: Math.round(-14 + Math.random() * 28),
        tone: idx % 3 === 0 ? "gold" : "cyan",
      }));
      setParticles(next);
    }, 450);

    return () => window.clearTimeout(id);
  }, [active, count, prefersReducedMotion]);

  if (!active || prefersReducedMotion || particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute -inset-4 z-20 overflow-visible" aria-hidden="true">
      {particles.map((p) => {
        const style: CSSProperties & { "--dx": string } = {
          left: p.left,
          top: p.top,
          width: `${p.size}px`,
          height: `${p.size}px`,
          background:
            p.tone === "gold"
              ? "radial-gradient(circle, #fff8de 0%, rgba(245,207,122,0.8) 55%, transparent 100%)"
              : "radial-gradient(circle, #e8f8ff 0%, rgba(126,214,255,0.85) 55%, transparent 100%)",
          animationDuration: `calc(${p.duration}s * var(--speed))`,
          animationDelay: `${p.delay}s`,
          "--dx": `${p.dx}px`,
        };
        return <span key={p.id} className="ilpl-holo-sparkle" style={style} />;
      })}
    </div>
  );
}

/** Client-only twinkling gold sparkles on the enchanted book cover. */
export function CoverSparkles({ active, count = 12 }: { active: boolean; count?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);

  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const next: SparkleParticle[] = Array.from({ length: count }, (_, idx) => ({
      id: idx,
      left: `${Math.round(12 + Math.random() * 76)}%`,
      top: `${Math.round(12 + Math.random() * 76)}%`,
      delay: Number((Math.random() * 2.2).toFixed(2)),
      scale: Number((0.7 + Math.random() * 0.6).toFixed(2)),
    }));
    setSparkles(next);
  }, [active, count, prefersReducedMotion]);

  if (!active || prefersReducedMotion || sparkles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {sparkles.map((s) => (
        <svg
          key={s.id}
          viewBox="0 0 16 16"
          className="ilpl-sparkle"
          style={{
            left: s.left,
            top: s.top,
            animationDelay: `${s.delay}s`,
            transform: `scale(${s.scale})`,
          }}
        >
          <path
            d="M8 0 L9.8 6.2 L16 8 L9.8 9.8 L8 16 L6.2 9.8 L0 8 L6.2 6.2 Z"
            fill="#f5cf7a"
          />
        </svg>
      ))}
    </div>
  );
}

