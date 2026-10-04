import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fadeSlideIn } from "../utils/animations";

type AnimatedTextProps = {
  children: React.ReactNode;
  delay?: number;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  direction?: "up" | "down" | "left" | "right";
  style?: React.CSSProperties;
};

/**
 * A typography block that fades + slides in with a spring. Use this for
 * titles, subtitles, and captions so animation timing stays consistent
 * across scenes.
 */
export const AnimatedText: React.FC<AnimatedTextProps> = ({
  children,
  delay = 0,
  fontSize = 80,
  fontWeight = 700,
  color = "white",
  direction = "up",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { opacity, transform } = fadeSlideIn({
    frame,
    fps,
    delay,
    direction,
  });

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        opacity,
        transform,
        fontFamily:
          "'Helvetica Neue', Helvetica, Arial, sans-serif",
        letterSpacing: "-0.02em",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
