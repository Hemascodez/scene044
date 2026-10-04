/**
 * Reusable animation utilities.
 *
 * These wrap Remotion's `interpolate` / `spring` primitives with sensible
 * defaults so new compositions and components can produce consistent,
 * polished motion without re-deriving easing curves every time.
 */

import {
  Easing,
  interpolate,
  type SpringConfig,
  spring,
} from "remotion";

/** Default spring config used across the project for a soft, premium feel. */
export const DEFAULT_SPRING_CONFIG: SpringConfig = {
  damping: 200,
  stiffness: 100,
  mass: 0.5,
  overshootClamping: false,
};

/**
 * Spring-based "pop in" scale/opacity. Returns a 0-1 progress value you can
 * feed into `scale` and `opacity` transforms directly.
 */
export const springIn = ({
  frame,
  fps,
  delay = 0,
  durationInFrames,
  config = DEFAULT_SPRING_CONFIG,
}: {
  frame: number;
  fps: number;
  delay?: number;
  durationInFrames?: number;
  config?: SpringConfig;
}) => {
  return spring({
    frame: frame - delay,
    fps,
    config,
    durationInFrames,
  });
};

/**
 * Fades + slides an element in from a given direction. Returns `{ opacity,
 * translateY }` ready to spread into a style object.
 */
export const fadeSlideIn = ({
  frame,
  fps,
  delay = 0,
  distance = 40,
  direction = "up",
  durationInFrames = 20,
}: {
  frame: number;
  fps: number;
  delay?: number;
  distance?: number;
  direction?: "up" | "down" | "left" | "right";
  durationInFrames?: number;
}) => {
  const progress = spring({
    frame: frame - delay,
    fps,
    config: DEFAULT_SPRING_CONFIG,
    durationInFrames,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const offset = interpolate(progress, [0, 1], [distance, 0]);

  const axis = direction === "left" || direction === "right" ? "X" : "Y";
  const sign = direction === "up" || direction === "left" ? 1 : -1;

  return {
    opacity,
    transform: `translate${axis}(${offset * sign}px)`,
  };
};

/**
 * Smoothly interpolates a value over a frame range with clamped extrapolation
 * and a configurable easing curve. Thin convenience wrapper around
 * Remotion's `interpolate`.
 */
export const easeInterpolate = (
  frame: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  easing: (input: number) => number = Easing.out(Easing.cubic),
) => {
  return interpolate(frame, inputRange, outputRange, {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Simple linear progress between two frames, clamped to [0, 1]. */
export const progressBetween = (
  frame: number,
  startFrame: number,
  endFrame: number,
) => {
  return interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};
