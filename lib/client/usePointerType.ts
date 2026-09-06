"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether outbound links should open in a new tab.
 *
 * On a desktop, a new tab is the right call: the visitor keeps their place in
 * the feed and comes back to a tab that never navigated away.
 *
 * On a phone it is the opposite. `target="_blank"` opens a brand-new tab with
 * an EMPTY history, so the browser's Back button has nowhere to go — the
 * visitor lands on Eventbrite or Meetup and the only route back to Scene is
 * the tab switcher, which most people will not hunt for. Same-tab navigation
 * makes Back work exactly as expected, and since the modal already pushes a
 * history entry, Back returns them to the open event rather than a cold feed.
 *
 * Read through useSyncExternalStore rather than an effect so the server
 * snapshot stays defined and hydration is clean: the server renders the
 * desktop form, and touch devices swap after hydration.
 */

const QUERY = "(hover: none) and (pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True on touch devices — where a new tab strands the visitor. */
function isTouch(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useOpensInNewTab(): boolean {
  return !useSyncExternalStore(
    subscribe,
    isTouch,
    // Server can't know the device; assume desktop so SSR matches the common
    // case and touch devices correct themselves on hydration.
    () => false,
  );
}
