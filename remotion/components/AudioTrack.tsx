import React from "react";
import { Audio, interpolate, staticFile, useCurrentFrame } from "remotion";

type AudioTrackProps = {
  /** Filename inside `public/audio/`, e.g. "music.mp3". */
  src: string;
  volume?: number;
  /** Frames to fade in/out at the start/end of this track's Sequence. */
  fadeInFrames?: number;
  fadeOutFrames?: number;
  /** Total duration of the enclosing Sequence, needed to compute fade-out. */
  durationInFrames?: number;
  startFrom?: number;
};

/**
 * Plays a background music / voiceover track from `public/audio/` with
 * optional fade in/out, synced to the current composition's timeline.
 *
 * Usage:
 *   <AudioTrack src="music.mp3" volume={0.6} fadeInFrames={30} fadeOutFrames={30} durationInFrames={300} />
 *
 * Put the file at `public/audio/music.mp3` and reference it by filename only
 * (Remotion resolves `staticFile()` paths relative to `public/`).
 */
export const AudioTrack: React.FC<AudioTrackProps> = ({
  src,
  volume = 1,
  fadeInFrames = 0,
  fadeOutFrames = 0,
  durationInFrames,
  startFrom,
}) => {
  const frame = useCurrentFrame();

  const fadeInGain =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const fadeOutGain =
    fadeOutFrames > 0 && durationInFrames
      ? interpolate(
          frame,
          [durationInFrames - fadeOutFrames, durationInFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  return (
    <Audio
      src={staticFile(`audio/${src}`)}
      volume={volume * fadeInGain * fadeOutGain}
      startFrom={startFrom}
    />
  );
};
