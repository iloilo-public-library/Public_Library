"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

const libraryEase = [0.22, 0.68, 0, 1.2] as const;

type RevealDirection = "up" | "down" | "left" | "right" | "zoom" | "flip" | "slide";

const hiddenByDirection: Record<RevealDirection, Record<string, number>> = {
  up: { opacity: 0, y: 40 },
  down: { opacity: 0, y: -28 },
  left: { opacity: 0, x: -48 },
  right: { opacity: 0, x: 48 },
  zoom: { opacity: 0, scale: 0.85 },
  flip: { opacity: 0, y: 24, rotateX: -16 },
  slide: { opacity: 0, y: 52, scale: 0.96 },
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
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.68, delay, ease: libraryEase }}
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
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.52, ease: libraryEase },
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
      viewport={{ once: true, amount: 0.12 }}
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
