"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** A ref and that element's current width (0 until measured). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/**
 * For artwork laid out at a fixed design size (the ticket printer, the
 * flipbook): returns a ref for the frame and the scale that fits the design
 * width into it, never above 1. Scale is 0 until measured, so callers can
 * hide the stage for that first frame instead of flashing it at full size.
 */
export function useStageScale<T extends HTMLElement>(designWidth: number) {
  const { ref: frameRef, width } = useElementWidth<T>();
  return { frameRef, scale: Math.min(1, width / designWidth) };
}
