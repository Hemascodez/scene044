import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { springIn } from "../utils/animations";

type AnimatedShapeProps = {
  size?: number;
  color?: string;
  shape?: "circle" | "square" | "rounded";
  delay?: number;
  /** Continuous rotation speed in degrees per frame. 0 disables rotation. */
  rotationSpeed?: number;
  style?: React.CSSProperties;
};

/**
 * A decorative shape (circle / square / rounded square) that pops in with a
 * spring and can continuously rotate. Useful as background accents behind
 * titles or as simple animated graphics.
 */
export const AnimatedShape: React.FC<AnimatedShapeProps> = ({
  size = 200,
  color = "#6C5CE7",
  shape = "circle",
  delay = 0,
  rotationSpeed = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = springIn({ frame, fps, delay });
  const rotation = rotationSpeed * frame;

  const borderRadius =
    shape === "circle" ? "50%" : shape === "rounded" ? size * 0.2 : 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        ...style,
      }}
    />
  );
};
