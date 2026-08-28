"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

const easeOut = [0, 0, 0.2, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  mode?: "load" | "view";
};

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.5,
  mode = "view",
}: RevealProps) {
  const shouldReduceMotion = usePrefersReducedMotion();
  const initial = { opacity: 0.94, y: 16 };
  const visible = { opacity: 1, y: 0 };
  const transition = {
    delay: shouldReduceMotion ? 0 : delay,
    duration: shouldReduceMotion ? 0 : duration,
    ease: easeOut,
  };

  if (mode === "load") {
    return (
      <motion.div
        className={className}
        data-reveal=""
        initial={initial}
        animate={visible}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      data-reveal=""
      initial={initial}
      whileInView={visible}
      viewport={{ once: true, amount: 0.14 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
