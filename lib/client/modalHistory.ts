"use client";

/**
 * The open event-detail modal, stored in browser history rather than component
 * state.
 *
 * Two things fall out of this that were awkward otherwise:
 *
 *   1. The phone's Back button closes the modal. On mobile the modal fills the
 *      screen, so it reads as a page — people press Back expecting the feed and
 *      instead left the site entirely.
 *   2. Returning from the organizer's site reopens the event they were reading.
 *      These pages are force-dynamic, so there is no bfcache: Back re-fetches
 *      the document and all component state is gone. history.state survives.
 *
 * Modelled as an external store so the value is READ during render rather than
 * assigned from an effect — no setState-in-effect, and the server snapshot is
 * defined so hydration stays clean.
 */

const listeners = new Set<() => void>();

/** pushState/replaceState don't fire popstate, so changes are announced here. */
function notify() {
  for (const listener of listeners) listener();
}

export function subscribeModalHistory(onChange: () => void): () => void {
  listeners.add(onChange);
  if (typeof window !== "undefined") window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("popstate", onChange);
  };
}

export function getModalEventId(): number | null {
  if (typeof window === "undefined") return null;
  const value = window.history.state?.sceneEventId;
  return typeof value === "number" ? value : null;
}

/** Server has no history; the modal is never open in the initial HTML. */
export function getServerModalEventId(): null {
  return null;
}

export function openModal(id: number): void {
  if (getModalEventId() === id) return;
  window.history.pushState({ ...window.history.state, sceneEventId: id }, "");
  notify();
}

export function closeModal(): void {
  if (getModalEventId() === null) return;
  // back(), not replaceState — so the entry pushed on open is consumed and the
  // Back button and the close button leave history in the same shape.
  window.history.back();
}
