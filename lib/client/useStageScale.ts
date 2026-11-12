"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * For artwork laid out at a fixed design size (the ticket printer, the
 * flipbook): returns a ref for the frame and the scale that fits the design
 * width into it, never above 1. Scale is 0 until measured, so callers can
 * hide the stage for that first frame instead of flashing it at full size.
 */
export function useStageScale<T extends HTMLElement>(designWidth: number) {
  const frameRef = useRef<T>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setScale(Math.min(1, frame.clientWidth / designWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [designWidth]);

  return { frameRef, scale };
}
