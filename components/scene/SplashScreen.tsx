"use client";

import { useEffect, useRef, useState } from "react";
import { Mono } from "@/components/scene/ui";
import { isBackForwardNavigation } from "@/lib/client/splashGate";

/** Runtime of public/scene-intro.mp4 (4.71s, read from the file's mvhd atom),
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
      /* Backdrop matches the clip's own corner pixels (#0c1720) purely as a
         safety net for the moment before the first frame decodes — with
         object-cover it should never actually be visible. */
      className={`scene-splash fixed inset-0 z-[100] overflow-hidden bg-[#0c1720] ${
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
        /* `cover`: the clip fills the viewport edge to edge with no bands at
           any aspect ratio, which is the point of a full-bleed intro.
           The cost is a real crop — the clip is 9:16 (0.5625) and a modern
           phone is nearer 0.46, so roughly 18% of the width is cut, which
           clips the outer edges of the SCENE/044 wordmark. Re-rendering the
           clip with ~15% safe margin around the wordmark removes that cost
           without changing anything here. */
        className="absolute inset-0 size-full object-cover"
      />

      <button
        type="button"
        onClick={skip}
        className="absolute bottom-6 right-6 z-10 border border-background/50 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-background/90 transition-colors [text-shadow:0_1px_4px_rgba(0,0,0,0.85)] hover:border-background hover:bg-background/10"
      >
        Skip →
      </button>

      {/* Sits directly on the moving video with no panel behind it — a filled
          box reads as a separate surface pasted over the intro. Legibility over
          bright frames comes from a text shadow instead. */}
      <div className="pointer-events-none absolute left-6 top-6 z-10">
        <Mono className="text-[11px] text-background/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.85)]">
          SCENE<span className="text-primary">/044</span>
        </Mono>
      </div>
    </div>
  );
}
