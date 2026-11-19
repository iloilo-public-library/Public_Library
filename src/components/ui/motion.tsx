"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

const libraryEase = [0.22, 0.68, 0, 1] as const;

type RevealDirection = "up" | "down" | "left" | "right" | "zoom" | "flip" | "slide";

// Strictly GPU-composited properties (translate, scale, opacity) to prevent layout/paint lag
const hiddenByDirection: Record<RevealDirection, Record<string, number>> = {
  up: { opacity: 0, y: 24 },
  down: { opacity: 0, y: -20 },
  left: { opacity: 0, x: -28 },
  right: { opacity: 0, x: 28 },
  zoom: { opacity: 0, scale: 0.94 },
  flip: { opacity: 0, y: 20, scale: 0.97 },
  slide: { opacity: 0, y: 28, scale: 0.98 },
};

export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
}: {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={hiddenByDirection[direction]}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -30px 0px" }}
      transition={{ duration: 0.42, delay: Math.min(delay, 0.2), ease: libraryEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: libraryEase },
  },
};

export function StaggerGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.08 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerChild} className={className}>
      {children}
    </motion.div>
  );
}
