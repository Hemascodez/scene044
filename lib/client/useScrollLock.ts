"use client";

import { useEffect } from "react";

/**
 * Locks background scroll while a modal is open.
 *
 * Plain `document.body.style.overflow = "hidden"` is enough on desktop, but
 * iOS Safari mostly ignores it: the page can still rubber-band and scroll
 * behind the modal, and a touch that starts on the backdrop can drag the
 * whole page instead of just the modal — which reads as the page "shaking"
 * and the modal itself refusing to scroll. Pinning the body with
 * `position: fixed` at its current scroll offset actually holds it still on
 * iOS; restoring that offset on unlock is what stops the page jumping back
 * to the top when the modal closes.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
