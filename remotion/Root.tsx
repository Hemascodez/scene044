import React from "react";
import { Composition } from "remotion";
import { VIDEO_CONFIG } from "./config";
import {
  SampleVideo,
  SAMPLE_VIDEO_DURATION_IN_FRAMES,
} from "./compositions/SampleVideo";

/**
 * All compositions are registered here. To add a new video:
 *  1. Create a component in `src/compositions/YourScene.tsx`.
 *  2. Import it below and add another `<Composition>` with a unique `id`.
 *
 * Resolution and frame rate for new compositions can reference
 * `VIDEO_CONFIG` from `src/config.ts` so they stay consistent project-wide,
 * or override `width` / `height` / `fps` per-composition as needed.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SampleVideo"
        component={SampleVideo}
        durationInFrames={SAMPLE_VIDEO_DURATION_IN_FRAMES}
        fps={VIDEO_CONFIG.fps}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
      />
    </>
  );
};
