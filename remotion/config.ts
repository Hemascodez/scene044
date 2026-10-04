/**
 * Central video configuration.
 *
 * Change resolution, frame rate, or duration here and every composition
 * that imports from this file will update automatically. This is the
 * single source of truth AI agents and humans should edit when asked to
 * "make the video 4K" or "make it 10 seconds long", etc.
 */

export const VIDEO_CONFIG = {
  /** Width in pixels. 1920 = Full HD, 3840 = 4K. */
  width: 1920,
  /** Height in pixels. */
  height: 1080,
  /** Frames per second. 30 is standard for web video, 60 for smoother motion. */
  fps: 30,
  /** Total length of the default sample composition, in seconds. */
  durationInSeconds: 8,
} as const;

/** Duration expressed in frames (what Remotion's <Composition> expects). */
export const DURATION_IN_FRAMES = Math.round(
  VIDEO_CONFIG.durationInSeconds * VIDEO_CONFIG.fps,
);

/** Shared brand/design-token colors, reused across compositions and components. */
export const COLORS = {
  background: "#0B0F19",
  backgroundAlt: "#131927",
  primary: "#6C5CE7",
  accent: "#00D4FF",
  text: "#FFFFFF",
  textMuted: "#9AA3B2",
} as const;
