"use client";

import { Lottie } from "lottie-react";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface LottiePlayerProps {
  src: string;
  className?: string;
  loop?: boolean;
  fallback?: ReactNode;
}

/**
 * Plays a Lottie animation, rendering `fallback` instead when the user
 * prefers reduced motion.
 */
export function LottiePlayer({ src, className, loop = true, fallback = null }: LottiePlayerProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{fallback}</>;

  // lottie-react's own stylesheet forces its root to width:100%/height:100%
  // (via a CSS @layer that wins over utility classes), so the size has to
  // come from this wrapper, not from a Tailwind size-* class on Lottie itself.
  return (
    <div className={className}>
      <Lottie src={src} loop={loop} autoplay className="size-full" />
    </div>
  );
}
