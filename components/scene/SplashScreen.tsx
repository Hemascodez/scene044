"use client";

import { useEffect, useRef, useState } from "react";
import { Mono } from "@/components/scene/ui";
import { isBackForwardNavigation } from "@/lib/client/splashGate";

/** Runtime of public/scene-intro.mp4 (4.80s, read from the file's mvhd atom),
 *  plus headroom so `onEnded` normally wins the race and this is only a
 *  backstop for a video that stalls or fails to decode. */
const CLIP_CAP_MS = 5400;
const REDUCED_MOTION_CAP_MS = 600;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);

  // Kept in a ref, updated in an effect rather than during render, so the
  // timer effect below can stay mount-only without going stale on the callback.
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    function finish() {
      if (finished.current) return;
      finished.current = true;
      setLeaving(true);
      window.setTimeout(() => onDoneRef.current(), 480);
    }

    // Back/Forward: unmount immediately, and never assign the video src, so the
    // 4.6 MB clip isn't fetched at all on a navigation that shouldn't play it.
    if (isBackForwardNavigation()) {
      finished.current = true;
      onDoneRef.current();
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cap = window.setTimeout(finish, reduce ? REDUCED_MOTION_CAP_MS : CLIP_CAP_MS);

    const video = videoRef.current;
    // src is assigned here rather than in JSX: the server renders no src, the
    // client's first render matches, and the download only starts once we know
    // the intro is actually going to play.
    if (video) video.src = "/scene-intro.mp4";
    if (video && !reduce) {
      // Autoplay can be refused (low-power mode, a policy block). Failing
      // straight through to the feed is better than a frozen black screen.
      video.play().catch(finish);
    }

    const node = videoRef.current;
    node?.addEventListener("ended", finish);
    node?.addEventListener("error", finish);
    return () => {
      window.clearTimeout(cap);
      node?.removeEventListener("ended", finish);
      node?.removeEventListener("error", finish);
    };
  }, []);

  function skip() {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    window.setTimeout(() => onDoneRef.current(), 480);
  }

  return (
    <div
      className={`scene-splash fixed inset-0 z-[100] flex items-center justify-center bg-foreground ${
        leaving ? "scene-splash-out" : ""
      }`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        preload="auto"
        aria-hidden
        /* Full-bleed by request: `object-contain` left black letterbox bands
           above and below this 720x1280 portrait clip. `cover` fills the
           viewport edge-to-edge and crops instead — which is what the phone
           reference shows. On very wide desktop viewports the crop is heavy,
           the trade-off being no gap at any size. */
        className="size-full object-cover"
      />

      <button
        type="button"
        onClick={skip}
        className="absolute bottom-6 right-6 border border-background/40 bg-black/25 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-background/90 backdrop-blur-sm transition-colors hover:border-background/80 hover:bg-black/40"
      >
        Skip →
      </button>

      {/* Both overlays now sit directly on moving video, so they carry their own
          low-opacity backdrop for legibility instead of a solid black fill —
          translucent reads as part of the scene, a flat block reads as pasted on. */}
      <div className="pointer-events-none absolute left-5 top-5 bg-black/25 px-2.5 py-1.5 backdrop-blur-sm">
        <Mono className="text-[11px] text-background/80">
          SCENE<span className="text-primary">/044</span>
        </Mono>
      </div>
    </div>
  );
}
