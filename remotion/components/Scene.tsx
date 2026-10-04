import React from "react";
import { AbsoluteFill } from "remotion";

type SceneProps = {
  children: React.ReactNode;
  background?: string;
  style?: React.CSSProperties;
};

/**
 * Full-frame wrapper for a single scene. Use one `<Scene>` per "slide" of
 * your video, then compose multiple scenes with `<TransitionSeries>` (see
 * `src/compositions/SampleVideo.tsx`) to crossfade/slide between them.
 */
export const Scene: React.FC<SceneProps> = ({
  children,
  background = "transparent",
  style,
}) => {
  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: "center",
        alignItems: "center",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
